'use server'

import { withPrismaAuth } from "@/lib/db"
import { SYS_ACCOUNTS, ensureSystemAccounts } from "@/lib/gl-accounts"
import { assertPeriodOpen } from "@/lib/period-helpers"
import { inferSubType } from "@/lib/account-subtype-helpers"

// ==========================================
// JOURNAL REFERENCE NUMBER GENERATION
// ==========================================

export async function getNextJournalRef(prefix: string): Promise<string> {
    const year = new Date().getFullYear()
    const search = `${prefix}-${year}`
    const { prisma } = await withPrismaAuth()
    const count = await prisma.journalEntry.count({
        where: { reference: { startsWith: search } }
    })
    return `${search}-${String(count + 1).padStart(4, '0')}`
}

// ==========================================
// GL ACCOUNTS & CHART OF ACCOUNTS
// ==========================================

export async function getGLAccounts() {
    try {
        const { supabase } = await import("@/lib/supabase")
        const { data: accounts, error } = await supabase
            .from('gl_accounts')
            .select('*')
            .order('code', { ascending: true })

        if (error) throw error

        return { success: true, data: accounts }
    } catch (error) {
        console.error("Error fetching GL Accounts:", error)
        return { success: false, error: "Failed to fetch accounts" }
    }
}

export type { GLAccountNode } from "@/lib/finance-gl-helpers"
import type { GLAccountNode } from "@/lib/finance-gl-helpers"
export type { TrialBalanceRow, TrialBalanceData, ReconciliationPreviewRow, ReconciliationPreview } from '@/lib/finance-gl-helpers'

export async function getChartOfAccountsTree(): Promise<GLAccountNode[]> {
    try {
        return await withPrismaAuth(async (prisma) => {
            const accounts = await prisma.gLAccount.findMany({
                orderBy: { code: 'asc' }
            })

            // Get balances from journal lines
            const balances = await prisma.journalLine.groupBy({
                by: ['accountId'],
                _sum: { debit: true, credit: true }
            })
            const balanceMap = new Map<string, number>()
            balances.forEach(b => {
                balanceMap.set(b.accountId, Number(b._sum.debit || 0) - Number(b._sum.credit || 0))
            })

            // Build node map keyed by ID
            const nodeMap = new Map<string, GLAccountNode>()
            for (const acc of accounts) {
                nodeMap.set(acc.id, {
                    id: acc.id,
                    code: acc.code,
                    name: acc.name,
                    type: acc.type,
                    subType: acc.subType,
                    balance: balanceMap.get(acc.id) || 0,
                    parentId: acc.parentId,
                    children: [],
                })
            }

            // Build tree: accounts with parentId go under their parent, rest are roots
            const roots: GLAccountNode[] = []
            for (const node of nodeMap.values()) {
                if (node.parentId && nodeMap.has(node.parentId)) {
                    nodeMap.get(node.parentId)!.children.push(node)
                } else {
                    roots.push(node)
                }
            }

            // Sort children recursively by code
            const sortTree = (nodes: GLAccountNode[]) => {
                nodes.sort((a, b) => a.code.localeCompare(b.code))
                nodes.forEach(n => sortTree(n.children))
            }
            sortTree(roots)

            return roots
        })
    } catch (error) {
        console.error("Failed to fetch COA tree:", error)
        return []
    }
}

export async function getGLAccountsList(): Promise<Array<{ id: string; code: string; name: string; type: string }>> {
    try {
        return await withPrismaAuth(async (prisma) => {
            const accounts = await prisma.gLAccount.findMany({
                select: { id: true, code: true, name: true, type: true },
                orderBy: { code: 'asc' }
            })
            return accounts
        })
    } catch (error) {
        console.error("Failed to fetch GL accounts list:", error)
        return []
    }
}

export async function createGLAccount(data: {
    code: string
    name: string
    type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'
    parentId?: string | null
}) {
    try {
        return await withPrismaAuth(async (prisma) => {
            let parentId = data.parentId ?? null

            // Auto-suggest parent: find account with same first 2 digits + "00" suffix
            if (!parentId && data.code.length >= 4) {
                const prefix = data.code.substring(0, 2)
                const parentCode = prefix + "00"
                if (parentCode !== data.code) {
                    const candidate = await prisma.gLAccount.findUnique({
                        where: { code: parentCode },
                        select: { id: true },
                    })
                    if (candidate) parentId = candidate.id
                }
            }

            const account = await prisma.gLAccount.create({
                data: {
                    code: data.code,
                    name: data.name,
                    type: data.type,
                    subType: inferSubType(data.code) as any,
                    parentId,
                }
            })
            return { success: true, accountId: account.id }
        })
    } catch (error: any) {
        console.error("Failed to create GL account:", error)
        return { success: false, error: error.message }
    }
}

// ==========================================
// JOURNAL ENTRY SYSTEM
// ==========================================

export async function postJournalEntry(data: {
    description: string
    date: Date
    reference: string
    invoiceId?: string
    paymentId?: string
    sourceDocumentType?: string // e.g. 'MANUAL', 'INVOICE', 'PAYMENT', 'GRN', 'COGS_RECOGNITION', etc.
    lines: {
        accountCode: string
        debit: number
        credit: number
        description?: string
    }[]
}) {
    try {
        const totalDebit = data.lines.reduce((sum, line) => sum + line.debit, 0)
        const totalCredit = data.lines.reduce((sum, line) => sum + line.credit, 0)

        if (Math.abs(totalDebit - totalCredit) > 0.01) {
            throw new Error(`Unbalanced Journal: Debit (${totalDebit}) != Credit (${totalCredit})`)
        }

        // Fail fast: check period lock BEFORE acquiring withPrismaAuth transaction
        await assertPeriodOpen(data.date)

        return await withPrismaAuth(async (prisma) => {
            const codes = data.lines.map(l => l.accountCode)
            const accounts = await prisma.gLAccount.findMany({
                where: { code: { in: codes } }
            })

            const accountMap = new Map(accounts.map(a => [a.code, a]))

            // Block manual journal entries from posting to control accounts (AR, AP, Inventory)
            if (data.sourceDocumentType === 'MANUAL') {
                for (const line of data.lines) {
                    const account = accountMap.get(line.accountCode)
                    if (account && !account.allowDirectPosting) {
                        throw new Error(
                            `Akun kontrol ${account.code} (${account.name}) tidak boleh diposting langsung — gunakan modul AR/AP/Inventory`
                        )
                    }
                }
            }

            let entryId: string | undefined

            await prisma.$transaction(async (tx) => {
                const entry = await tx.journalEntry.create({
                    data: {
                        date: data.date,
                        description: data.description,
                        reference: data.reference,
                        status: 'POSTED',
                        ...(data.invoiceId ? { invoiceId: data.invoiceId } : {}),
                        ...(data.paymentId ? { paymentId: data.paymentId } : {}),
                        lines: {
                            create: data.lines.map(line => {
                                const account = accountMap.get(line.accountCode)
                                if (!account) throw new Error(`Account code not found: ${line.accountCode}`)

                                return {
                                    accountId: account.id,
                                    debit: line.debit,
                                    credit: line.credit,
                                    description: line.description || data.description
                                }
                            })
                        }
                    }
                })

                entryId = entry.id

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

            return { success: true, id: entryId }
        })
    } catch (error: any) {
        console.error("Journal Posting Error:", error)
        return { success: false, error: error?.message || "Failed to post journal entry" }
    }
}

export type { JournalEntryItem } from "@/lib/finance-gl-helpers"
import type { JournalEntryItem } from "@/lib/finance-gl-helpers"

export async function getJournalEntries(limit = 50): Promise<JournalEntryItem[]> {
    try {
        return await withPrismaAuth(async (prisma) => {
            const entries = await prisma.journalEntry.findMany({
                include: {
                    lines: {
                        include: {
                            account: { select: { code: true, name: true } }
                        }
                    }
                },
                orderBy: { date: 'desc' },
                take: limit
            })

            return entries.map((entry) => ({
                id: entry.id,
                date: entry.date,
                description: entry.description || '',
                reference: entry.reference || undefined,
                status: entry.status,
                lines: entry.lines.map(line => ({
                    account: { code: line.account.code, name: line.account.name },
                    debit: Number(line.debit),
                    credit: Number(line.credit),
                    description: line.description || undefined
                })),
                totalDebit: entry.lines.reduce((sum, l) => sum + Number(l.debit), 0),
                totalCredit: entry.lines.reduce((sum, l) => sum + Number(l.credit), 0)
            }))
        })
    } catch (error) {
        console.error("Failed to fetch journal entries:", error)
        return []
    }
}

export async function getJournalEntryById(entryId: string): Promise<JournalEntryItem | null> {
    try {
        return await withPrismaAuth(async (prisma) => {
            const entry = await prisma.journalEntry.findUnique({
                where: { id: entryId },
                include: {
                    lines: {
                        include: {
                            account: { select: { code: true, name: true } }
                        }
                    }
                }
            })

            if (!entry) return null

            return {
                id: entry.id,
                date: entry.date,
                description: entry.description || '',
                reference: entry.reference || undefined,
                status: entry.status,
                lines: entry.lines.map(line => ({
                    account: { code: line.account.code, name: line.account.name },
                    debit: Number(line.debit),
                    credit: Number(line.credit),
                    description: line.description || undefined
                })),
                totalDebit: entry.lines.reduce((sum, l) => sum + Number(l.debit), 0),
                totalCredit: entry.lines.reduce((sum, l) => sum + Number(l.credit), 0)
            }
        })
    } catch (error) {
        console.error("Failed to fetch journal entry:", error)
        return null
    }
}

export async function updateJournalEntry(
    entryId: string,
    data: {
        description: string
        date: Date
        reference: string
        lines: {
            accountCode: string
            debit: number
            credit: number
            description?: string
        }[]
    }
) {
    try {
        const totalDebit = data.lines.reduce((sum, line) => sum + line.debit, 0)
        const totalCredit = data.lines.reduce((sum, line) => sum + line.credit, 0)

        if (Math.abs(totalDebit - totalCredit) > 0.01) {
            throw new Error(`Unbalanced Journal: Debit (${totalDebit}) != Credit (${totalCredit})`)
        }

        return await withPrismaAuth(async (prisma) => {
            const existing = await prisma.journalEntry.findUnique({
                where: { id: entryId },
                select: { status: true }
            })

            if (!existing) throw new Error("Jurnal tidak ditemukan")
            if (existing.status === "POSTED") throw new Error("Jurnal yang sudah diposting tidak dapat diubah — buat jurnal balik")
            if (existing.status !== "DRAFT") throw new Error("Hanya jurnal DRAFT yang dapat diedit")

            const codes = data.lines.map(l => l.accountCode)
            const accounts = await prisma.gLAccount.findMany({
                where: { code: { in: codes } }
            })
            const accountMap = new Map(accounts.map(a => [a.code, a]))

            await prisma.$transaction(async (tx) => {
                // Delete old lines
                await tx.journalLine.deleteMany({ where: { entryId } })

                // Update entry + create new lines
                await tx.journalEntry.update({
                    where: { id: entryId },
                    data: {
                        date: data.date,
                        description: data.description,
                        reference: data.reference,
                        lines: {
                            create: data.lines.map(line => {
                                const account = accountMap.get(line.accountCode)
                                if (!account) throw new Error(`Account code not found: ${line.accountCode}`)
                                return {
                                    accountId: account.id,
                                    debit: line.debit,
                                    credit: line.credit,
                                    description: line.description || data.description
                                }
                            })
                        }
                    }
                })
            })

            return { success: true }
        })
    } catch (error: any) {
        console.error("Journal Update Error:", error)
        return { success: false, error: error?.message || "Failed to update journal entry" }
    }
}

// ==========================================
// JOURNAL ENTRY REVERSAL
// ==========================================

export async function reverseJournalEntry(journalEntryId: string) {
    try {
        return await withPrismaAuth(async (prisma) => {
            const original = await prisma.journalEntry.findUnique({
                where: { id: journalEntryId },
                include: {
                    lines: {
                        include: { account: true }
                    }
                }
            })

            if (!original) throw new Error("Jurnal tidak ditemukan")
            if (original.status !== "POSTED") throw new Error("Hanya jurnal POSTED yang dapat dibalik")
            if (original.isReversed) throw new Error("Jurnal ini sudah dibalik")

            // Check if fiscal period is closed for today's date (reversal date)
            const reversalDate = new Date()
            const reversalMonth = reversalDate.getMonth() + 1
            const reversalYear = reversalDate.getFullYear()
            const fiscalPeriod = await prisma.fiscalPeriod.findUnique({
                where: { year_month: { year: reversalYear, month: reversalMonth } }
            })
            if (fiscalPeriod?.isClosed) {
                throw new Error(`Periode fiskal ${fiscalPeriod.name} sudah ditutup. Tidak bisa posting jurnal balik ke periode ini.`)
            }

            let reversalId: string | undefined

            await prisma.$transaction(async (tx) => {
                // Create reversal entry with swapped debit/credit lines
                const reversal = await tx.journalEntry.create({
                    data: {
                        date: reversalDate,
                        description: `Pembalikan: ${original.description}`,
                        reference: original.reference ? `REV-${original.reference}` : `REV-${journalEntryId.slice(0, 8)}`,
                        status: 'POSTED',
                        lines: {
                            create: original.lines.map(line => ({
                                accountId: line.accountId,
                                debit: Number(line.credit),   // swap: original credit → reversal debit
                                credit: Number(line.debit),   // swap: original debit → reversal credit
                                description: `Pembalikan: ${line.description || original.description}`
                            }))
                        }
                    }
                })

                reversalId = reversal.id

                // Mark original as reversed, linking to reversal entry
                await tx.journalEntry.update({
                    where: { id: journalEntryId },
                    data: {
                        isReversed: true,
                        reversedById: reversal.id
                    }
                })

                // Update GL account balances (reverse the original impact)
                for (const line of original.lines) {
                    let balanceChange = 0
                    const debit = Number(line.credit)   // swapped
                    const credit = Number(line.debit)    // swapped

                    if (['ASSET', 'EXPENSE'].includes(line.account.type)) {
                        balanceChange = debit - credit
                    } else {
                        balanceChange = credit - debit
                    }

                    await tx.gLAccount.update({
                        where: { id: line.accountId },
                        data: { balance: { increment: balanceChange } }
                    })
                }
            })

            return { success: true, id: reversalId }
        })
    } catch (error: any) {
        console.error("Journal Reversal Error:", error)
        return { success: false, error: error?.message || "Gagal membalik jurnal" }
    }
}

// ==========================================
// OPENING BALANCES
// ==========================================

export async function getGLAccountsGrouped() {
    try {
        return await withPrismaAuth(async (prisma) => {
            const accounts = await prisma.gLAccount.findMany({
                select: { id: true, code: true, name: true, type: true, balance: true },
                orderBy: { code: 'asc' }
            })

            const grouped: Record<string, typeof accounts> = {
                ASSET: [],
                LIABILITY: [],
                EQUITY: [],
                REVENUE: [],
                EXPENSE: [],
            }

            for (const account of accounts) {
                if (grouped[account.type]) {
                    grouped[account.type].push(account)
                }
            }

            return { success: true, data: grouped }
        })
    } catch (error) {
        console.error("Failed to fetch grouped GL accounts:", error)
        return { success: false, error: "Gagal memuat akun" }
    }
}

export async function checkOpeningBalanceExists(year: number) {
    try {
        return await withPrismaAuth(async (prisma) => {
            const existing = await prisma.journalEntry.findFirst({
                where: { reference: `OPENING-BALANCE-${year}` }
            })
            return { exists: !!existing }
        })
    } catch (error) {
        return { exists: false }
    }
}

export async function postOpeningBalances(data: {
    year: number
    lines: { accountCode: string; debit: number; credit: number }[]
}) {
    try {
        const filledLines = data.lines.filter(l => l.debit > 0 || l.credit > 0)
        if (filledLines.length === 0) {
            return { success: false, error: "Tidak ada saldo yang diisi" }
        }

        const totalDebit = filledLines.reduce((sum, l) => sum + l.debit, 0)
        const totalCredit = filledLines.reduce((sum, l) => sum + l.credit, 0)

        if (Math.abs(totalDebit - totalCredit) > 0.01) {
            return {
                success: false,
                error: `Total Debit (${totalDebit.toLocaleString('id-ID')}) harus sama dengan Total Kredit (${totalCredit.toLocaleString('id-ID')})`
            }
        }

        await assertPeriodOpen(new Date(`${data.year}-01-01T00:00:00Z`))

        return await withPrismaAuth(async (prisma) => {
            // Check for existing opening balance entry
            const existing = await prisma.journalEntry.findFirst({
                where: { reference: `OPENING-BALANCE-${data.year}` }
            })
            if (existing) {
                return { success: false, error: `Saldo awal tahun ${data.year} sudah pernah dibuat` }
            }

            const codes = filledLines.map(l => l.accountCode)
            const accounts = await prisma.gLAccount.findMany({
                where: { code: { in: codes } }
            })
            const accountMap = new Map(accounts.map(a => [a.code, a]))

            await prisma.$transaction(async (tx) => {
                await tx.journalEntry.create({
                    data: {
                        date: new Date(`${data.year}-01-01T00:00:00Z`),
                        description: 'Saldo Awal',
                        reference: `OPENING-BALANCE-${data.year}`,
                        status: 'POSTED',
                        lines: {
                            create: filledLines.map(line => {
                                const account = accountMap.get(line.accountCode)
                                if (!account) throw new Error(`Kode akun tidak ditemukan: ${line.accountCode}`)
                                return {
                                    accountId: account.id,
                                    debit: line.debit,
                                    credit: line.credit,
                                    description: 'Saldo Awal'
                                }
                            })
                        }
                    }
                })

                // Update account balances
                for (const line of filledLines) {
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

            return { success: true }
        })
    } catch (error: any) {
        console.error("Opening Balance Error:", error)
        return { success: false, error: error?.message || "Gagal menyimpan saldo awal" }
    }
}

// ==========================================
// RECURRING JOURNAL ENTRIES
// ==========================================

import { calculateNextDate } from "@/lib/finance-gl-helpers"
export type { RecurringPattern, OpeningBalanceGLRow, OpeningInvoiceRow } from "@/lib/finance-gl-helpers"
import type { RecurringPattern, OpeningBalanceGLRow, OpeningInvoiceRow } from "@/lib/finance-gl-helpers"

export type { RecurringTemplate } from "@/lib/finance-gl-helpers"
import type { RecurringTemplate } from "@/lib/finance-gl-helpers"

/**
 * Create a recurring journal entry template.
 */
export async function createRecurringJournalTemplate(data: {
    description: string
    reference?: string
    recurringPattern: RecurringPattern
    startDate: Date
    lines: {
        accountCode: string
        debit: number
        credit: number
        description?: string
    }[]
}): Promise<{ success: boolean; entryId?: string; error?: string }> {
    try {
        const totalDebit = data.lines.reduce((sum, l) => sum + l.debit, 0)
        const totalCredit = data.lines.reduce((sum, l) => sum + l.credit, 0)

        if (Math.abs(totalDebit - totalCredit) > 0.01) {
            return { success: false, error: `Tidak seimbang: Debit (${totalDebit}) != Kredit (${totalCredit})` }
        }

        const entryId = await withPrismaAuth(async (prisma) => {
            const codes = data.lines.map(l => l.accountCode)
            const accounts = await prisma.gLAccount.findMany({
                where: { code: { in: codes } }
            })
            const accountMap = new Map(accounts.map(a => [a.code, a]))

            for (const line of data.lines) {
                if (!accountMap.has(line.accountCode)) {
                    throw new Error(`Kode akun tidak ditemukan: ${line.accountCode}`)
                }
            }

            const entry = await prisma.journalEntry.create({
                data: {
                    date: data.startDate,
                    description: data.description,
                    reference: data.reference || null,
                    status: 'DRAFT',
                    isRecurring: true,
                    recurringPattern: data.recurringPattern,
                    nextRecurringDate: data.startDate,
                    lines: {
                        create: data.lines.map(line => ({
                            accountId: accountMap.get(line.accountCode)!.id,
                            debit: line.debit,
                            credit: line.credit,
                            description: line.description || data.description,
                        })),
                    },
                },
            })

            return entry.id
        })

        return { success: true, entryId }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal membuat template jurnal berulang'
        console.error("[createRecurringJournalTemplate] Error:", error)
        return { success: false, error: msg }
    }
}

/**
 * Get all recurring journal templates.
 */
export async function getRecurringTemplates(): Promise<RecurringTemplate[]> {
    try {
        return await withPrismaAuth(async (prisma) => {
            const entries = await prisma.journalEntry.findMany({
                where: { isRecurring: true },
                include: {
                    lines: {
                        include: {
                            account: { select: { code: true, name: true } },
                        },
                    },
                },
                orderBy: { nextRecurringDate: 'asc' },
            })

            return entries.map((e) => ({
                id: e.id,
                description: e.description || '',
                reference: e.reference,
                recurringPattern: e.recurringPattern || 'MONTHLY',
                nextRecurringDate: (e.nextRecurringDate || e.date).toISOString(),
                lines: e.lines.map((l) => ({
                    accountCode: l.account.code,
                    accountName: l.account.name,
                    debit: Number(l.debit),
                    credit: Number(l.credit),
                })),
                totalAmount: e.lines.reduce((s, l) => s + Number(l.debit), 0),
            }))
        })
    } catch (error) {
        console.error("[getRecurringTemplates] Error:", error)
        return []
    }
}

/**
 * Process all recurring entries that are due (nextRecurringDate <= today).
 * Creates new posted journal entries and advances the next date.
 */
export async function processRecurringEntries(): Promise<{
    success: boolean
    processedCount: number
    error?: string
}> {
    try {
        const processedCount = await withPrismaAuth(async (prisma) => {
            const now = new Date()
            now.setHours(23, 59, 59, 999)

            const dueEntries = await prisma.journalEntry.findMany({
                where: {
                    isRecurring: true,
                    nextRecurringDate: { lte: now },
                },
                include: {
                    lines: {
                        include: {
                            account: { select: { id: true, code: true, type: true } },
                        },
                    },
                },
            })

            let count = 0

            for (const template of dueEntries) {
                const entryDate = template.nextRecurringDate || new Date()
                await assertPeriodOpen(entryDate)

                await prisma.$transaction(async (tx) => {
                    // Create the actual posted entry
                    await tx.journalEntry.create({
                        data: {
                            date: entryDate,
                            description: `[Otomatis] ${template.description}`,
                            reference: template.reference,
                            status: 'POSTED',
                            isRecurring: false,
                            lines: {
                                create: template.lines.map((l) => ({
                                    accountId: l.accountId,
                                    debit: l.debit,
                                    credit: l.credit,
                                    description: l.description,
                                })),
                            },
                        },
                    })

                    // Update GL account balances
                    for (const line of template.lines) {
                        let balanceChange = 0
                        if (['ASSET', 'EXPENSE'].includes(line.account.type)) {
                            balanceChange = Number(line.debit) - Number(line.credit)
                        } else {
                            balanceChange = Number(line.credit) - Number(line.debit)
                        }

                        await tx.gLAccount.update({
                            where: { id: line.accountId },
                            data: { balance: { increment: balanceChange } },
                        })
                    }

                    // Advance the next recurring date
                    const pattern = (template.recurringPattern || 'MONTHLY') as RecurringPattern
                    const nextDate = calculateNextDate(
                        template.nextRecurringDate || new Date(),
                        pattern
                    )

                    await tx.journalEntry.update({
                        where: { id: template.id },
                        data: { nextRecurringDate: nextDate },
                    })
                })

                count++
            }

            return count
        })

        return { success: true, processedCount }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal memproses jurnal berulang'
        console.error("[processRecurringEntries] Error:", error)
        return { success: false, processedCount: 0, error: msg }
    }
}

// ==========================================
// CLOSING JOURNAL (JURNAL PENUTUP)
// ==========================================

export type { ClosingJournalPreviewLine, ClosingJournalPreview } from "@/lib/finance-gl-helpers"
import type { ClosingJournalPreviewLine, ClosingJournalPreview } from "@/lib/finance-gl-helpers"

/**
 * Preview closing journal entries for a fiscal year.
 * Calculates net balances of all REVENUE and EXPENSE accounts for the year,
 * then generates closing entries to zero them out and transfer net income
 * to Retained Earnings (equity account).
 */
export async function previewClosingJournal(fiscalYear: number): Promise<{
    success: boolean
    data?: ClosingJournalPreview
    error?: string
}> {
    try {
        const result = await withPrismaAuth(async (prisma) => {
            // 1. Check if closing entry already exists for this year
            const existingClosing = await prisma.journalEntry.findFirst({
                where: {
                    reference: `CLOSING-${fiscalYear}`,
                    status: 'POSTED',
                },
            })

            if (existingClosing) {
                return {
                    fiscalYear,
                    alreadyClosed: true,
                    revenueTotal: 0,
                    expenseTotal: 0,
                    netIncome: 0,
                    lines: [],
                    retainedEarningsAccount: null,
                } satisfies ClosingJournalPreview
            }

            // 2. Get date range for the fiscal year
            const startDate = new Date(fiscalYear, 0, 1) // Jan 1
            const endDate = new Date(fiscalYear, 11, 31, 23, 59, 59, 999) // Dec 31

            // 3. Get all REVENUE and EXPENSE accounts
            const accounts = await prisma.gLAccount.findMany({
                where: { type: { in: ['REVENUE', 'EXPENSE'] } },
                orderBy: { code: 'asc' },
            })

            // 4. Calculate net balance for each account within the fiscal year
            const accountBalances = await prisma.journalLine.groupBy({
                by: ['accountId'],
                where: {
                    accountId: { in: accounts.map(a => a.id) },
                    entry: {
                        date: { gte: startDate, lte: endDate },
                        status: 'POSTED',
                    },
                },
                _sum: { debit: true, credit: true },
            })

            const balanceMap = new Map(
                accountBalances.map(b => [
                    b.accountId,
                    { debit: Number(b._sum.debit || 0), credit: Number(b._sum.credit || 0) },
                ])
            )

            // 5. Find Retained Earnings account (equity, typically code starting with "3" and named "Laba Ditahan" or "Retained Earnings")
            const retainedEarnings = await prisma.gLAccount.findFirst({
                where: {
                    type: 'EQUITY',
                    OR: [
                        { name: { contains: 'Laba Ditahan', mode: 'insensitive' } },
                        { name: { contains: 'Retained', mode: 'insensitive' } },
                        { name: { contains: 'Saldo Laba', mode: 'insensitive' } },
                    ],
                },
            })

            // 6. Build closing entries
            const lines: ClosingJournalPreviewLine[] = []
            let revenueTotal = 0
            let expenseTotal = 0

            // Close Revenue accounts: DR Revenue, CR Income Summary
            // Revenue normal balance is CREDIT, so net = credit - debit
            for (const account of accounts.filter(a => a.type === 'REVENUE')) {
                const bal = balanceMap.get(account.id)
                if (!bal) continue
                const netBalance = bal.credit - bal.debit // Revenue normal = credit side
                if (Math.abs(netBalance) < 0.01) continue

                revenueTotal += netBalance

                // Debit Revenue to zero it out
                lines.push({
                    accountId: account.id,
                    accountCode: account.code,
                    accountName: account.name,
                    accountType: 'REVENUE',
                    debit: netBalance > 0 ? netBalance : 0,
                    credit: netBalance < 0 ? Math.abs(netBalance) : 0,
                    description: `Penutupan akun pendapatan ${account.code} - ${account.name}`,
                })
            }

            // Close Expense accounts: DR Income Summary, CR Expense
            // Expense normal balance is DEBIT, so net = debit - credit
            for (const account of accounts.filter(a => a.type === 'EXPENSE')) {
                const bal = balanceMap.get(account.id)
                if (!bal) continue
                const netBalance = bal.debit - bal.credit // Expense normal = debit side
                if (Math.abs(netBalance) < 0.01) continue

                expenseTotal += netBalance

                // Credit Expense to zero it out
                lines.push({
                    accountId: account.id,
                    accountCode: account.code,
                    accountName: account.name,
                    accountType: 'EXPENSE',
                    debit: netBalance < 0 ? Math.abs(netBalance) : 0,
                    credit: netBalance > 0 ? netBalance : 0,
                    description: `Penutupan akun beban ${account.code} - ${account.name}`,
                })
            }

            // Transfer net income to Retained Earnings
            const netIncome = revenueTotal - expenseTotal
            if (retainedEarnings && Math.abs(netIncome) >= 0.01) {
                lines.push({
                    accountId: retainedEarnings.id,
                    accountCode: retainedEarnings.code,
                    accountName: retainedEarnings.name,
                    accountType: 'EQUITY',
                    debit: netIncome < 0 ? Math.abs(netIncome) : 0,
                    credit: netIncome > 0 ? netIncome : 0,
                    description: `Transfer laba bersih ke Laba Ditahan tahun ${fiscalYear}`,
                })
            }

            return {
                fiscalYear,
                alreadyClosed: false,
                revenueTotal,
                expenseTotal,
                netIncome,
                lines,
                retainedEarningsAccount: retainedEarnings
                    ? { id: retainedEarnings.id, code: retainedEarnings.code, name: retainedEarnings.name }
                    : null,
            } satisfies ClosingJournalPreview
        })

        return { success: true, data: result }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal memuat preview jurnal penutup'
        console.error("[previewClosingJournal] Error:", error)
        return { success: false, error: msg }
    }
}

// ==========================================
// OPENING BALANCES — GL (new form)
// ==========================================

/**
 * Post a balanced journal entry for GL opening balances.
 * Each row becomes a JournalLine under a single JournalEntry.
 */
export async function postOpeningBalancesGL(data: {
    date: Date
    rows: OpeningBalanceGLRow[]
}): Promise<{ success: boolean; error?: string }> {
    try {
        const filledRows = data.rows.filter(r => r.accountCode && (r.debit > 0 || r.credit > 0))
        if (filledRows.length === 0) {
            return { success: false, error: "Tidak ada baris yang valid" }
        }

        const totalDebit = filledRows.reduce((sum, r) => sum + r.debit, 0)
        const totalCredit = filledRows.reduce((sum, r) => sum + r.credit, 0)

        if (Math.abs(totalDebit - totalCredit) > 0.01) {
            return { success: false, error: `Total Debit (${totalDebit.toLocaleString('id-ID')}) harus sama dengan Total Kredit (${totalCredit.toLocaleString('id-ID')})` }
        }

        const year = new Date(data.date).getFullYear()

        return await withPrismaAuth(async (prisma) => {
            await ensureSystemAccounts()

            // Check for existing opening balance for this year
            const existing = await prisma.journalEntry.findFirst({
                where: { reference: `OPENING-BALANCE-${year}` },
                select: { id: true },
            })
            if (existing) {
                return {
                    success: false,
                    error: `Saldo awal untuk tahun ${year} sudah pernah diposting. Hapus jurnal OPENING-BALANCE-${year} terlebih dahulu jika ingin mengulang.`
                }
            }

            const codes = filledRows.map(r => r.accountCode)
            const accounts = await prisma.gLAccount.findMany({
                where: { code: { in: codes } }
            })
            const accountMap = new Map(accounts.map(a => [a.code, a]))

            await prisma.$transaction(async (tx) => {
                await tx.journalEntry.create({
                    data: {
                        date: data.date,
                        description: 'Saldo Awal',
                        reference: `OPENING-BALANCE-${year}`,
                        status: 'POSTED',
                        lines: {
                            create: filledRows.map(row => {
                                const account = accountMap.get(row.accountCode)
                                if (!account) throw new Error(`Kode akun tidak ditemukan: ${row.accountCode}`)
                                return {
                                    accountId: account.id,
                                    debit: row.debit,
                                    credit: row.credit,
                                    description: 'Saldo Awal',
                                }
                            })
                        }
                    }
                })

                // Update GL account balances
                for (const row of filledRows) {
                    const account = accountMap.get(row.accountCode)!
                    let balanceChange = 0
                    if (['ASSET', 'EXPENSE'].includes(account.type)) {
                        balanceChange = row.debit - row.credit
                    } else {
                        balanceChange = row.credit - row.debit
                    }
                    await tx.gLAccount.update({
                        where: { id: account.id },
                        data: { balance: { increment: balanceChange } }
                    })
                }
            })

            return { success: true }
        })
    } catch (error: any) {
        console.error("[postOpeningBalancesGL] Error:", error)
        return { success: false, error: error?.message || "Gagal menyimpan saldo awal GL" }
    }
}

// ==========================================
// OPENING BALANCES — AP/AR INVOICES
// ==========================================

/**
 * Bulk create opening AP/AR invoices.
 * Creates Invoice records with status ISSUED so they appear in the
 * Hutang Usaha (AP) or Piutang Usaha (AR) pages.
 */
export async function createOpeningInvoices(data: {
    type: "AP" | "AR"
    rows: OpeningInvoiceRow[]
}): Promise<{ success: boolean; createdCount?: number; error?: string }> {
    try {
        const validRows = data.rows.filter(r => r.partyId && r.invoiceNumber.trim() && r.amount > 0 && r.dueDate)
        if (validRows.length === 0) {
            return { success: false, error: "Tidak ada baris yang valid untuk disimpan" }
        }

        const invoiceType = data.type === "AP" ? "INV_IN" : "INV_OUT"

        const createdCount = await withPrismaAuth(async (prisma) => {
            await ensureSystemAccounts()
            let count = 0

            for (const row of validRows) {
                const invoiceData: any = {
                    number: row.invoiceNumber.trim(),
                    type: invoiceType,
                    issueDate: new Date(),
                    dueDate: new Date(row.dueDate),
                    subtotal: row.amount,
                    taxAmount: 0,
                    discountAmount: 0,
                    totalAmount: row.amount,
                    balanceDue: row.amount,
                    status: 'ISSUED',
                }

                if (data.type === "AP") {
                    invoiceData.supplierId = row.partyId
                } else {
                    invoiceData.customerId = row.partyId
                }

                await prisma.invoice.create({ data: invoiceData })
                count++
            }

            // Post GL journal entry for opening AP/AR balances
            const totalAmount = validRows.reduce((sum, r) => sum + r.amount, 0)
            if (totalAmount > 0) {
                // AR opening: DR Piutang (1100), CR Opening Balance Equity (3900)
                // AP opening: DR Opening Balance Equity (3900), CR Hutang (2100)
                const arCode = SYS_ACCOUNTS.AR
                const apCode = SYS_ACCOUNTS.AP
                const openingEquityCode = SYS_ACCOUNTS.OPENING_EQUITY
                const balanceAccountCode = data.type === "AR" ? arCode : apCode

                // Ensure accounts exist
                const accountCodes = [balanceAccountCode, openingEquityCode]
                const accounts = await prisma.gLAccount.findMany({
                    where: { code: { in: accountCodes } }
                })

                const allAccounts = await prisma.gLAccount.findMany({
                    where: { code: { in: accountCodes } }
                })
                const accountMap = new Map(allAccounts.map(a => [a.code, a]))
                const balanceAccount = accountMap.get(balanceAccountCode)
                const equityAccount = accountMap.get(openingEquityCode)

                if (balanceAccount && equityAccount) {
                    const lines = data.type === "AR"
                        ? [
                            { accountId: balanceAccount.id, debit: totalAmount, credit: 0, description: `Saldo Awal Piutang (${count} invoice)` },
                            { accountId: equityAccount.id, debit: 0, credit: totalAmount, description: `Saldo Awal Piutang (${count} invoice)` },
                        ]
                        : [
                            { accountId: equityAccount.id, debit: totalAmount, credit: 0, description: `Saldo Awal Hutang (${count} bill)` },
                            { accountId: balanceAccount.id, debit: 0, credit: totalAmount, description: `Saldo Awal Hutang (${count} bill)` },
                        ]

                    await prisma.journalEntry.create({
                        data: {
                            date: new Date(),
                            description: `Saldo Awal ${data.type === "AR" ? "Piutang Usaha" : "Hutang Usaha"}`,
                            reference: `OPENING-${data.type}-${new Date().getFullYear()}`,
                            status: 'POSTED',
                            lines: { create: lines },
                        }
                    })

                    // Update GL balances
                    if (data.type === "AR") {
                        await prisma.gLAccount.update({ where: { id: balanceAccount.id }, data: { balance: { increment: totalAmount } } })
                        await prisma.gLAccount.update({ where: { id: equityAccount.id }, data: { balance: { increment: totalAmount } } })
                    } else {
                        await prisma.gLAccount.update({ where: { id: equityAccount.id }, data: { balance: { decrement: totalAmount } } })
                        await prisma.gLAccount.update({ where: { id: balanceAccount.id }, data: { balance: { increment: totalAmount } } })
                    }
                }
            }

            return count
        })

        return { success: true, createdCount }
    } catch (error: any) {
        console.error("[createOpeningInvoices] Error:", error)
        return { success: false, error: error?.message || "Gagal membuat saldo awal invoice" }
    }
}

/**
 * Get summary of existing opening balance data for the KPI strip.
 */
export async function getOpeningBalanceSummary(): Promise<{
    glPosted: boolean
    glDate: string | null
    glAccountCount: number
    apCount: number
    apTotal: number
    arCount: number
    arTotal: number
}> {
    try {
        const { prisma } = await import('@/lib/db')

        const [glEntry, apAgg, arAgg] = await Promise.all([
            prisma.journalEntry.findFirst({
                where: { reference: { startsWith: 'OPENING-BALANCE-' } },
                include: { lines: { select: { id: true } } },
                orderBy: { date: 'desc' },
            }),
            prisma.invoice.aggregate({
                where: {
                    type: 'INV_IN',
                    status: 'ISSUED',
                    journalEntries: { some: { reference: { startsWith: 'OPENING-AP' } } },
                },
                _count: true,
                _sum: { totalAmount: true },
            }).catch(() => ({ _count: 0, _sum: { totalAmount: null } })),
            prisma.invoice.aggregate({
                where: {
                    type: 'INV_OUT',
                    status: 'ISSUED',
                    journalEntries: { some: { reference: { startsWith: 'OPENING-AR' } } },
                },
                _count: true,
                _sum: { totalAmount: true },
            }).catch(() => ({ _count: 0, _sum: { totalAmount: null } })),
        ])

        return {
            glPosted: !!glEntry,
            glDate: glEntry?.date?.toISOString().slice(0, 10) ?? null,
            glAccountCount: glEntry?.lines.length ?? 0,
            apCount: apAgg._count ?? 0,
            apTotal: Number(apAgg._sum.totalAmount ?? 0),
            arCount: arAgg._count ?? 0,
            arTotal: Number(arAgg._sum.totalAmount ?? 0),
        }
    } catch {
        return { glPosted: false, glDate: null, glAccountCount: 0, apCount: 0, apTotal: 0, arCount: 0, arTotal: 0 }
    }
}

/**
 * Fetch customers and suppliers for AP/AR opening balance dropdown menus.
 */
export async function getOpeningBalanceParties(): Promise<{
    customers: Array<{ id: string; name: string }>
    suppliers: Array<{ id: string; name: string }>
}> {
    try {
        return await withPrismaAuth(async (prisma) => {
            const [customers, suppliers] = await Promise.all([
                prisma.customer.findMany({
                    select: { id: true, name: true },
                    orderBy: { name: 'asc' },
                }),
                prisma.supplier.findMany({
                    select: { id: true, name: true },
                    orderBy: { name: 'asc' },
                }),
            ])

            return { customers, suppliers }
        })
    } catch (error) {
        console.error("[getOpeningBalanceParties] Error:", error)
        return { customers: [], suppliers: [] }
    }
}

// ==========================================
// TRIAL BALANCE & RECONCILIATION
// ==========================================

import type { TrialBalanceRow, TrialBalanceData, ReconciliationPreviewRow, ReconciliationPreview } from '@/lib/finance-gl-helpers'

export async function getTrialBalance(asOfDate?: Date): Promise<TrialBalanceData> {
  const { prisma } = await import('@/lib/db')
  const cutoff = asOfDate || new Date()

  const accounts = await prisma.gLAccount.findMany({
    include: {
      lines: {
        where: {
          entry: { status: 'POSTED', date: { lte: cutoff } },
        },
        select: { debit: true, credit: true },
      },
    },
    orderBy: { code: 'asc' },
  })

  let grandDebit = 0
  let grandCredit = 0
  let mismatchCount = 0

  const rows: TrialBalanceRow[] = accounts.map((acc) => {
    const totalDebit = acc.lines.reduce((s, l) => s + Number(l.debit), 0)
    const totalCredit = acc.lines.reduce((s, l) => s + Number(l.credit), 0)
    const calculatedBalance = acc.type === 'ASSET' || acc.type === 'EXPENSE'
      ? totalDebit - totalCredit
      : totalCredit - totalDebit
    const storedBalance = Number(acc.balance)
    const difference = Math.round((storedBalance - calculatedBalance) * 100) / 100

    grandDebit += totalDebit
    grandCredit += totalCredit
    if (Math.abs(difference) > 0.01) mismatchCount++

    return {
      accountId: acc.id, accountCode: acc.code, accountName: acc.name,
      accountType: acc.type as TrialBalanceRow['accountType'],
      totalDebit: Math.round(totalDebit * 100) / 100,
      totalCredit: Math.round(totalCredit * 100) / 100,
      storedBalance, calculatedBalance: Math.round(calculatedBalance * 100) / 100, difference,
    }
  })

  return {
    rows, totalDebit: Math.round(grandDebit * 100) / 100,
    totalCredit: Math.round(grandCredit * 100) / 100,
    isBalanced: Math.abs(grandDebit - grandCredit) < 0.01,
    mismatchCount, asOfDate: cutoff.toISOString(),
  }
}

export async function previewBalanceReconciliation(): Promise<ReconciliationPreview> {
  const trialBalance = await getTrialBalance()
  const rows: ReconciliationPreviewRow[] = trialBalance.rows
    .filter((r) => Math.abs(r.difference) > 0.01)
    .map((r) => ({
      accountId: r.accountId, accountCode: r.accountCode, accountName: r.accountName,
      oldBalance: r.storedBalance, newBalance: r.calculatedBalance, difference: r.difference,
    }))
  return { rows, totalAccounts: rows.length, totalDifference: rows.reduce((s, r) => s + Math.abs(r.difference), 0) }
}

export async function applyBalanceReconciliation(): Promise<{ updated: number }> {
  const { prisma } = await import('@/lib/db')
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const preview = await previewBalanceReconciliation()
  if (preview.rows.length === 0) return { updated: 0 }

  await prisma.$transaction(async (tx) => {
    for (const row of preview.rows) {
      await tx.gLAccount.update({ where: { id: row.accountId }, data: { balance: row.newBalance } })
    }
    const { logAudit } = await import('@/lib/audit-helpers')
    await logAudit({
      entityType: 'GL_RECONCILIATION', entityId: 'system', action: 'UPDATE',
      userId: user.id, userName: user.email || 'System',
      changes: preview.rows.map((r) => ({ field: `${r.accountCode} ${r.accountName}`, from: r.oldBalance, to: r.newBalance })),
      narrative: `Rekonsiliasi saldo ${preview.rows.length} akun GL. Total selisih: Rp ${preview.totalDifference.toLocaleString('id-ID')}`,
    })
  })
  return { updated: preview.rows.length }
}

/**
 * Post the closing journal entries for a fiscal year.
 * Creates a single JournalEntry with reference CLOSING-YYYY that zeros out
 * all REVENUE and EXPENSE accounts and transfers net income to Retained Earnings.
 */
export async function postClosingJournal(fiscalYear: number): Promise<{
    success: boolean
    entryId?: string
    error?: string
}> {
    try {
        // First get the preview to know what to post
        const preview = await previewClosingJournal(fiscalYear)
        if (!preview.success || !preview.data) {
            return { success: false, error: preview.error || 'Gagal memuat data penutupan' }
        }

        if (preview.data.alreadyClosed) {
            return { success: false, error: `Tahun fiskal ${fiscalYear} sudah ditutup` }
        }

        if (preview.data.lines.length === 0) {
            return { success: false, error: 'Tidak ada saldo untuk ditutup' }
        }

        if (!preview.data.retainedEarningsAccount) {
            return { success: false, error: 'Akun Laba Ditahan (Retained Earnings) tidak ditemukan. Buat akun ekuitas dengan nama "Laba Ditahan" terlebih dahulu.' }
        }

        const entryId = await withPrismaAuth(async (prisma) => {
            // Double-check no closing entry exists (race condition guard)
            const existingClosing = await prisma.journalEntry.findFirst({
                where: {
                    reference: `CLOSING-${fiscalYear}`,
                    status: 'POSTED',
                },
            })

            if (existingClosing) {
                throw new Error(`Tahun fiskal ${fiscalYear} sudah ditutup`)
            }

            const lines = preview.data!.lines

            // Verify balance: total debit must equal total credit
            const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0)
            const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0)

            if (Math.abs(totalDebit - totalCredit) > 0.01) {
                throw new Error(`Jurnal tidak seimbang: Debit (${totalDebit}) != Kredit (${totalCredit})`)
            }

            return await prisma.$transaction(async (tx) => {
                // Create the closing journal entry
                const entry = await tx.journalEntry.create({
                    data: {
                        date: new Date(fiscalYear, 11, 31), // Dec 31 of fiscal year
                        description: `Jurnal Penutup Tahun Fiskal ${fiscalYear}`,
                        reference: `CLOSING-${fiscalYear}`,
                        status: 'POSTED',
                        lines: {
                            create: lines.map(line => ({
                                accountId: line.accountId,
                                debit: line.debit,
                                credit: line.credit,
                                description: line.description,
                            })),
                        },
                    },
                })

                // Update GL account balances
                for (const line of lines) {
                    let balanceChange = 0
                    if (['ASSET', 'EXPENSE'].includes(line.accountType)) {
                        balanceChange = line.debit - line.credit
                    } else {
                        balanceChange = line.credit - line.debit
                    }

                    await tx.gLAccount.update({
                        where: { id: line.accountId },
                        data: { balance: { increment: balanceChange } },
                    })
                }

                return entry.id
            })
        })

        return { success: true, entryId }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal memposting jurnal penutup'
        console.error("[postClosingJournal] Error:", error)
        return { success: false, error: msg }
    }
}

// ==========================================
// DRILL-DOWN — Transaction Detail for Reports
// ==========================================

export interface DrillDownRow {
    id: string
    date: string
    reference: string
    description: string
    counterparty: string
    journalNumber: string
    accountCode: string
    accountName: string
    debit: number
    credit: number
    sourceType: 'INVOICE_AR' | 'INVOICE_AP' | 'PAYMENT' | 'JOURNAL' | 'PETTY_CASH' | 'OPENING'
    sourceUrl: string
}

export async function getAccountDrillDown(
    accountFilter: string,
    startDate: Date,
    endDate: Date,
    limit = 100
): Promise<DrillDownRow[]> {
    try {
        const { prisma } = await import('@/lib/db')

        let accountWhere: any = {}
        if (accountFilter.includes('-')) {
            const [from, to] = accountFilter.split('-')
            accountWhere = { code: { gte: from, lte: to } }
        } else if (['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'].includes(accountFilter)) {
            accountWhere = { type: accountFilter }
        } else {
            accountWhere = { code: accountFilter }
        }

        const lines = await prisma.journalLine.findMany({
            where: {
                account: accountWhere,
                entry: {
                    status: 'POSTED',
                    date: { gte: startDate, lte: endDate },
                },
            },
            include: {
                account: { select: { code: true, name: true } },
                entry: {
                    select: {
                        id: true,
                        date: true,
                        reference: true,
                        description: true,
                        invoiceId: true,
                        paymentId: true,
                        pettyCashTransaction: { select: { id: true } },
                        invoice: {
                            select: {
                                id: true,
                                number: true,
                                type: true,
                                customer: { select: { name: true } },
                                supplier: { select: { name: true } },
                            },
                        },
                        payment: {
                            select: {
                                id: true,
                                number: true,
                                customer: { select: { name: true } },
                                supplier: { select: { name: true } },
                            },
                        },
                    },
                },
            },
            orderBy: { entry: { date: 'desc' } },
            take: limit,
        })

        return lines.map((line: any) => {
            const entry = line.entry
            const invoice = entry.invoice
            const payment = entry.payment

            let sourceType: DrillDownRow['sourceType'] = 'JOURNAL'
            let sourceUrl = '/finance/journal'
            let counterparty = ''

            if (invoice) {
                if (invoice.type === 'INV_OUT') {
                    sourceType = 'INVOICE_AR'
                    sourceUrl = `/finance/invoices?highlight=${invoice.id}`
                    counterparty = invoice.customer?.name || ''
                } else {
                    sourceType = 'INVOICE_AP'
                    sourceUrl = `/finance/bills?highlight=${invoice.id}`
                    counterparty = invoice.supplier?.name || ''
                }
            } else if (payment) {
                sourceType = 'PAYMENT'
                sourceUrl = '/finance/payments'
                counterparty = payment.customer?.name || payment.supplier?.name || ''
            } else if (entry.pettyCashTransaction) {
                sourceType = 'PETTY_CASH'
                sourceUrl = '/finance/petty-cash'
            } else if (entry.reference?.startsWith('OPENING')) {
                sourceType = 'OPENING'
                sourceUrl = '/finance/opening-balances'
            }

            return {
                id: line.id,
                date: entry.date.toISOString().slice(0, 10),
                reference: invoice?.number || payment?.number || entry.reference || '',
                description: entry.description || '',
                counterparty,
                journalNumber: entry.reference || entry.id.slice(0, 8),
                accountCode: line.account.code,
                accountName: line.account.name,
                debit: Number(line.debit),
                credit: Number(line.credit),
                sourceType,
                sourceUrl,
            }
        })
    } catch (error) {
        console.error('[getAccountDrillDown] Error:', error)
        return []
    }
}

// ==========================================
// GL INTEGRITY CHECKS (Pemeriksaan Integritas Buku Besar)
// ==========================================

export type IntegrityCheckResult = {
    name: string
    nameBahasa: string
    status: 'PASS' | 'FAIL'
    expected: number
    actual: number
    difference: number
}

/**
 * Run automated integrity checks on the General Ledger.
 * Returns an array of check results — any FAIL indicates data inconsistency.
 */
export async function runIntegrityChecks(): Promise<{ success: true; checks: IntegrityCheckResult[] } | { success: false; error: string }> {
    try {
        return await withPrismaAuth(async (prisma) => {
            await ensureSystemAccounts()
            const checks: IntegrityCheckResult[] = []
            const TOLERANCE = 0.01

            // Check 1: AR sub-ledger = GL 1200
            const arSubLedger = await prisma.invoice.aggregate({
                where: { type: 'INV_OUT', status: { notIn: ['CANCELLED', 'VOID', 'DRAFT'] } },
                _sum: { balanceDue: true },
            })
            const arGLAccount = await prisma.gLAccount.findFirst({ where: { code: SYS_ACCOUNTS.AR } })
            const arSubTotal = Number(arSubLedger._sum.balanceDue || 0)
            const arGLBalance = Number(arGLAccount?.balance || 0)
            checks.push({
                name: 'AR Sub-ledger vs GL 1200',
                nameBahasa: 'Piutang Usaha — Sub-ledger vs Buku Besar',
                status: Math.abs(arSubTotal - arGLBalance) <= TOLERANCE ? 'PASS' : 'FAIL',
                expected: arSubTotal,
                actual: arGLBalance,
                difference: arGLBalance - arSubTotal,
            })

            // Check 2: AP sub-ledger = GL 2000
            const apSubLedger = await prisma.invoice.aggregate({
                where: { type: 'INV_IN', status: { notIn: ['CANCELLED', 'VOID', 'DRAFT'] } },
                _sum: { balanceDue: true },
            })
            const apGLAccount = await prisma.gLAccount.findFirst({ where: { code: SYS_ACCOUNTS.AP } })
            const apSubTotal = Number(apSubLedger._sum.balanceDue || 0)
            const apGLBalance = Number(apGLAccount?.balance || 0)
            checks.push({
                name: 'AP Sub-ledger vs GL 2000',
                nameBahasa: 'Hutang Usaha — Sub-ledger vs Buku Besar',
                status: Math.abs(apSubTotal - apGLBalance) <= TOLERANCE ? 'PASS' : 'FAIL',
                expected: apSubTotal,
                actual: apGLBalance,
                difference: apGLBalance - apSubTotal,
            })

            // Check 3: Trial Balance — total debits = total credits (POSTED entries only)
            const trialBalance = await prisma.journalLine.aggregate({
                where: { entry: { status: 'POSTED' } },
                _sum: { debit: true, credit: true },
            })
            const totalDebits = Number(trialBalance._sum.debit || 0)
            const totalCredits = Number(trialBalance._sum.credit || 0)
            checks.push({
                name: 'Trial Balance (Debits = Credits)',
                nameBahasa: 'Neraca Saldo — Total Debit = Total Kredit',
                status: Math.abs(totalDebits - totalCredits) <= TOLERANCE ? 'PASS' : 'FAIL',
                expected: totalDebits,
                actual: totalCredits,
                difference: totalDebits - totalCredits,
            })

            // Check 4: Balance Sheet equation — Assets = Liabilities + Equity
            const allAccounts = await prisma.gLAccount.findMany({ select: { code: true, type: true, balance: true } })
            let totalAssets = 0
            let totalLiabilities = 0
            let totalEquity = 0

            for (const acc of allAccounts) {
                const bal = Number(acc.balance)
                if (acc.type === 'ASSET') totalAssets += bal
                else if (acc.type === 'LIABILITY') totalLiabilities += bal
                else if (acc.type === 'EQUITY') totalEquity += bal
                else if (acc.type === 'REVENUE') totalEquity += bal // Revenue increases equity
                else if (acc.type === 'EXPENSE') totalEquity -= bal // Expense decreases equity
            }
            const liabPlusEquity = totalLiabilities + totalEquity
            checks.push({
                name: 'Balance Sheet (Assets = Liabilities + Equity)',
                nameBahasa: 'Neraca Seimbang — Aset = Kewajiban + Ekuitas',
                status: Math.abs(totalAssets - liabPlusEquity) <= TOLERANCE ? 'PASS' : 'FAIL',
                expected: totalAssets,
                actual: liabPlusEquity,
                difference: totalAssets - liabPlusEquity,
            })

            // Check 5: No orphan journal lines
            const orphanLines = await prisma.journalLine.count({
                where: {
                    entry: { status: { not: 'POSTED' } }
                }
            })
            checks.push({
                name: 'No Orphan Journal Lines',
                nameBahasa: 'Tidak Ada Baris Jurnal Yatim',
                status: orphanLines === 0 ? 'PASS' : 'FAIL',
                expected: 0,
                actual: orphanLines,
                difference: orphanLines,
            })

            return { success: true as const, checks }
        })
    } catch (error: any) {
        console.error("[runIntegrityChecks] Error:", error)
        return { success: false as const, error: error.message || "Gagal menjalankan pemeriksaan integritas" }
    }
}

// ==========================================
// PPN SETTLEMENT (Setor PPN Bulanan)
// ==========================================

/**
 * Post monthly PPN settlement: offset PPN Keluaran (2110) against PPN Masukan (1330).
 *
 * If PPN Keluaran > PPN Masukan: DR PPN Keluaran, CR PPN Masukan, CR Bank (net owed)
 * If PPN Masukan > PPN Keluaran: DR PPN Keluaran, CR PPN Masukan, CR PPN Lebih Bayar (1410, carry-forward)
 */
export async function postPPNSettlement(data: {
    periodStart: string
    periodEnd: string
    bankAccountCode?: string
    notes?: string
}) {
    try {
        return await withPrismaAuth(async (prisma) => {
            const start = new Date(data.periodStart)
            const end = new Date(data.periodEnd)

            // Validate fiscal period is open
            const lockedPeriod = await prisma.fiscalPeriod.findFirst({
                where: { isClosed: true, startDate: { lte: end }, endDate: { gte: start } },
            })
            if (lockedPeriod) {
                return { success: false as const, error: `Periode ${lockedPeriod.name} sudah dikunci` }
            }

            await ensureSystemAccounts()

            // Calculate PPN Keluaran balance (output tax, LIABILITY — credit normal)
            const ppnKeluaranAccount = await prisma.gLAccount.findFirst({ where: { code: SYS_ACCOUNTS.PPN_KELUARAN } })
            const ppnMasukanAccount = await prisma.gLAccount.findFirst({ where: { code: SYS_ACCOUNTS.PPN_MASUKAN } })

            if (!ppnKeluaranAccount || !ppnMasukanAccount) {
                return { success: false as const, error: "Akun PPN Keluaran atau PPN Masukan tidak ditemukan" }
            }

            const ppnKeluaranBalance = Number(ppnKeluaranAccount.balance) // Positive = we owe tax
            const ppnMasukanBalance = Number(ppnMasukanAccount.balance)   // Positive = tax we can claim

            if (ppnKeluaranBalance <= 0 && ppnMasukanBalance <= 0) {
                return { success: false as const, error: "Tidak ada saldo PPN untuk disetor" }
            }

            const lines: { accountCode: string; debit: number; credit: number; description: string }[] = []

            if (ppnKeluaranBalance >= ppnMasukanBalance) {
                // We owe tax: net = PPN Keluaran - PPN Masukan
                const netOwed = ppnKeluaranBalance - ppnMasukanBalance

                // DR PPN Keluaran (zero out the liability)
                lines.push({ accountCode: SYS_ACCOUNTS.PPN_KELUARAN, debit: ppnKeluaranBalance, credit: 0, description: 'Offset PPN Keluaran' })
                // CR PPN Masukan (zero out the asset)
                if (ppnMasukanBalance > 0) {
                    lines.push({ accountCode: SYS_ACCOUNTS.PPN_MASUKAN, debit: 0, credit: ppnMasukanBalance, description: 'Offset PPN Masukan' })
                }
                // CR Bank (pay the net amount to tax office)
                if (netOwed > 0) {
                    const bankCode = data.bankAccountCode || SYS_ACCOUNTS.BANK_BCA
                    lines.push({ accountCode: bankCode, debit: 0, credit: netOwed, description: `Setor PPN ke kas negara` })
                }
            } else {
                // Excess input tax: PPN Masukan > PPN Keluaran — carry forward
                const excessInput = ppnMasukanBalance - ppnKeluaranBalance

                // DR PPN Keluaran (zero out)
                if (ppnKeluaranBalance > 0) {
                    lines.push({ accountCode: SYS_ACCOUNTS.PPN_KELUARAN, debit: ppnKeluaranBalance, credit: 0, description: 'Offset PPN Keluaran' })
                }
                // CR PPN Masukan (use up to match keluaran)
                lines.push({ accountCode: SYS_ACCOUNTS.PPN_MASUKAN, debit: 0, credit: ppnMasukanBalance, description: 'Offset PPN Masukan' })
                // DR PPN Lebih Bayar (carry-forward excess)
                lines.push({ accountCode: SYS_ACCOUNTS.PPN_LEBIH_BAYAR, debit: excessInput, credit: 0, description: 'PPN Lebih Bayar (carry-forward)' })
            }

            const glResult = await postJournalEntry({
                description: `Setor PPN Bulanan — ${data.periodStart} s/d ${data.periodEnd}${data.notes ? ` (${data.notes})` : ''}`,
                date: end,
                reference: `PPN-${data.periodStart.substring(0, 7)}`,
                lines,
            })

            if (!glResult?.success) {
                return { success: false as const, error: `Jurnal PPN gagal: ${(glResult as any)?.error || 'Unknown error'}` }
            }

            return {
                success: true as const,
                ppnKeluaran: ppnKeluaranBalance,
                ppnMasukan: ppnMasukanBalance,
                netAmount: Math.abs(ppnKeluaranBalance - ppnMasukanBalance),
                direction: ppnKeluaranBalance >= ppnMasukanBalance ? 'SETOR' : 'LEBIH_BAYAR',
            }
        })
    } catch (error: any) {
        console.error("[postPPNSettlement] Error:", error)
        return { success: false as const, error: error.message || "Gagal memposting setor PPN" }
    }
}
