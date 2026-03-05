/**
 * fix-missing-invoice-gl.ts
 *
 * Finds all invoices (INV_OUT and INV_IN) that are NOT DRAFT/CANCELLED/VOID
 * but have no matching journal entry. Creates the missing GL entries.
 *
 * Safe to run multiple times (idempotent) — checks for existing journal entries
 * by reference before creating.
 *
 * Usage:
 *   npx tsx scripts/fix-missing-invoice-gl.ts
 *   npx tsx scripts/fix-missing-invoice-gl.ts --dry-run   (preview only, no changes)
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

// Required GL accounts to upsert before processing
const REQUIRED_ACCOUNTS = [
    { code: '1100', name: 'Piutang Usaha', type: 'ASSET' as const },
    { code: '1330', name: 'PPN Masukan', type: 'ASSET' as const },
    { code: '2100', name: 'Hutang Usaha', type: 'LIABILITY' as const },
    { code: '2110', name: 'PPN Keluaran', type: 'LIABILITY' as const },
    { code: '4000', name: 'Pendapatan Penjualan', type: 'REVENUE' as const },
    { code: '5000', name: 'Harga Pokok Penjualan', type: 'EXPENSE' as const },
]

async function ensureGLAccounts() {
    console.log('\n--- Memastikan akun GL yang diperlukan ada ---')
    for (const acc of REQUIRED_ACCOUNTS) {
        const existing = await prisma.gLAccount.findFirst({ where: { code: acc.code } })
        if (existing) {
            console.log(`  [OK] ${acc.code} ${acc.name} (sudah ada)`)
        } else {
            if (!DRY_RUN) {
                await prisma.gLAccount.create({
                    data: { code: acc.code, name: acc.name, type: acc.type, balance: 0 }
                })
            }
            console.log(`  [BUAT] ${acc.code} ${acc.name}${DRY_RUN ? ' (dry-run)' : ''}`)
        }
    }
}

/**
 * Posts a journal entry directly using Prisma (no auth needed for scripts).
 * Mirrors the logic from lib/actions/finance-gl.ts postJournalEntry.
 */
async function postJournalEntryDirect(data: {
    description: string
    date: Date
    reference: string
    invoiceId: string
    lines: {
        accountCode: string
        debit: number
        credit: number
        description?: string
    }[]
}) {
    const totalDebit = data.lines.reduce((sum, l) => sum + l.debit, 0)
    const totalCredit = data.lines.reduce((sum, l) => sum + l.credit, 0)

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
        throw new Error(
            `Jurnal tidak seimbang: Debit (${totalDebit.toLocaleString()}) != Kredit (${totalCredit.toLocaleString()}) — ref: ${data.reference}`
        )
    }

    const codes = data.lines.map(l => l.accountCode)
    const accounts = await prisma.gLAccount.findMany({
        where: { code: { in: codes } }
    })
    const accountMap = new Map(accounts.map(a => [a.code, a]))

    // Validate all accounts exist
    for (const line of data.lines) {
        if (!accountMap.has(line.accountCode)) {
            throw new Error(`Kode akun tidak ditemukan: ${line.accountCode}`)
        }
    }

    await prisma.$transaction(async (tx) => {
        // Create journal entry linked to the invoice
        await tx.journalEntry.create({
            data: {
                date: data.date,
                description: data.description,
                reference: data.reference,
                status: 'POSTED',
                invoiceId: data.invoiceId,
                lines: {
                    create: data.lines.map(line => {
                        const account = accountMap.get(line.accountCode)!
                        return {
                            accountId: account.id,
                            debit: line.debit,
                            credit: line.credit,
                            description: line.description || data.description,
                        }
                    })
                }
            }
        })

        // Update GL account balances
        for (const line of data.lines) {
            const account = accountMap.get(line.accountCode)!
            let balanceChange = 0

            if (['ASSET', 'EXPENSE'].includes(account.type)) {
                balanceChange = line.debit - line.credit
            } else {
                balanceChange = line.credit - line.debit
            }

            await tx.gLAccount.update({
                where: { id: account.id },
                data: { balance: { increment: balanceChange } }
            })
        }
    })
}

function formatCurrency(amount: number): string {
    return `Rp ${amount.toLocaleString('id-ID')}`
}

async function main() {
    console.log('==============================================')
    console.log('  FIX: Buat GL Entries untuk Invoice yang Hilang')
    console.log(`  Mode: ${DRY_RUN ? 'DRY RUN (preview saja)' : 'LIVE (akan buat jurnal)'}`)
    console.log('==============================================')

    // Step 1: Ensure GL accounts exist
    await ensureGLAccounts()

    // Step 2: Find invoices that should have GL entries but don't
    // Statuses that should have GL entries (not draft, cancelled, or void)
    const excludedStatuses = ['DRAFT', 'CANCELLED', 'VOID'] as const

    const invoices = await prisma.invoice.findMany({
        where: {
            status: { notIn: [...excludedStatuses] },
        },
        orderBy: { issueDate: 'asc' },
        include: {
            customer: { select: { name: true } },
            supplier: { select: { name: true } },
        }
    })

    console.log(`\n--- Ditemukan ${invoices.length} invoice dengan status aktif ---`)

    // Step 3: Check which ones already have journal entries
    // Look for journal entries by reference pattern "INV-{number}" OR by invoiceId
    const existingReferences = await prisma.journalEntry.findMany({
        where: {
            OR: [
                { reference: { in: invoices.map(inv => `INV-${inv.number}`) } },
                { invoiceId: { in: invoices.map(inv => inv.id) } },
            ]
        },
        select: { reference: true, invoiceId: true }
    })

    const coveredRefs = new Set(existingReferences.map(e => e.reference))
    const coveredIds = new Set(existingReferences.map(e => e.invoiceId).filter(Boolean))

    const missingInvoices = invoices.filter(inv => {
        const ref = `INV-${inv.number}`
        return !coveredRefs.has(ref) && !coveredIds.has(inv.id)
    })

    console.log(`  Invoice dengan GL entry: ${invoices.length - missingInvoices.length}`)
    console.log(`  Invoice TANPA GL entry: ${missingInvoices.length}`)

    if (missingInvoices.length === 0) {
        console.log('\nSemua invoice sudah memiliki GL entry. Tidak ada yang perlu diperbaiki.')
        return
    }

    // Step 4: Process missing invoices
    let fixedARCount = 0
    let fixedAPCount = 0
    let fixedARTotal = 0
    let fixedAPTotal = 0
    let errorCount = 0

    console.log('\n--- Memproses invoice yang hilang GL entry ---\n')

    for (const inv of missingInvoices) {
        const subtotal = Number(inv.subtotal)
        const taxAmount = Number(inv.taxAmount)
        const totalAmount = Number(inv.totalAmount)
        const reference = `INV-${inv.number}`
        const partyName = inv.type === 'INV_OUT'
            ? (inv.customer?.name || 'Customer')
            : (inv.supplier?.name || 'Supplier')

        try {
            if (inv.type === 'INV_OUT') {
                // --- AR (Sales Invoice) ---
                // DR 1100 Piutang Usaha (totalAmount)
                // CR 4000 Pendapatan Penjualan (subtotal)
                // CR 2110 PPN Keluaran (taxAmount) — if > 0
                const lines: { accountCode: string; debit: number; credit: number; description?: string }[] = [
                    {
                        accountCode: '1100',
                        debit: totalAmount,
                        credit: 0,
                        description: `Piutang - ${partyName}`,
                    },
                    {
                        accountCode: '4000',
                        debit: 0,
                        credit: subtotal,
                        description: `Pendapatan - ${inv.number}`,
                    },
                ]

                if (taxAmount > 0) {
                    lines.push({
                        accountCode: '2110',
                        debit: 0,
                        credit: taxAmount,
                        description: `PPN Keluaran - ${inv.number}`,
                    })
                }

                console.log(`  [AR] ${inv.number} | ${partyName} | ${formatCurrency(totalAmount)} | ${inv.status}`)

                if (!DRY_RUN) {
                    await postJournalEntryDirect({
                        description: `Faktur Penjualan ${inv.number} - ${partyName}`,
                        date: inv.issueDate,
                        reference,
                        invoiceId: inv.id,
                        lines,
                    })
                }

                fixedARCount++
                fixedARTotal += totalAmount

            } else if (inv.type === 'INV_IN') {
                // --- AP (Vendor Bill) ---
                // DR 5000 HPP (subtotal)
                // DR 1330 PPN Masukan (taxAmount) — if > 0
                // CR 2100 Hutang Usaha (totalAmount)
                const lines: { accountCode: string; debit: number; credit: number; description?: string }[] = [
                    {
                        accountCode: '5000',
                        debit: subtotal,
                        credit: 0,
                        description: `HPP - ${inv.number}`,
                    },
                ]

                if (taxAmount > 0) {
                    lines.push({
                        accountCode: '1330',
                        debit: taxAmount,
                        credit: 0,
                        description: `PPN Masukan - ${inv.number}`,
                    })
                }

                lines.push({
                    accountCode: '2100',
                    debit: 0,
                    credit: totalAmount,
                    description: `Hutang - ${partyName}`,
                })

                console.log(`  [AP] ${inv.number} | ${partyName} | ${formatCurrency(totalAmount)} | ${inv.status}`)

                if (!DRY_RUN) {
                    await postJournalEntryDirect({
                        description: `Tagihan Pembelian ${inv.number} - ${partyName}`,
                        date: inv.issueDate,
                        reference,
                        invoiceId: inv.id,
                        lines,
                    })
                }

                fixedAPCount++
                fixedAPTotal += totalAmount
            }
        } catch (err) {
            errorCount++
            console.error(`  [ERROR] ${inv.number}: ${err instanceof Error ? err.message : err}`)
        }
    }

    // Step 5: Summary
    console.log('\n==============================================')
    console.log('  RINGKASAN')
    console.log('==============================================')
    console.log(`  Mode:              ${DRY_RUN ? 'DRY RUN (tidak ada perubahan)' : 'LIVE'}`)
    console.log(`  AR (INV_OUT) fix:  ${fixedARCount} invoice | Total: ${formatCurrency(fixedARTotal)}`)
    console.log(`  AP (INV_IN) fix:   ${fixedAPCount} invoice | Total: ${formatCurrency(fixedAPTotal)}`)
    console.log(`  Error:             ${errorCount}`)
    console.log(`  Total diperbaiki:  ${fixedARCount + fixedAPCount} dari ${missingInvoices.length}`)
    console.log('==============================================')

    if (DRY_RUN) {
        console.log('\nJalankan tanpa --dry-run untuk membuat jurnal entry yang sebenarnya:')
        console.log('  npx tsx scripts/fix-missing-invoice-gl.ts')
    }
}

main()
    .catch((err) => {
        console.error('Fatal error:', err)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
