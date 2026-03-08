'use server'

import { withPrismaAuth } from "@/lib/db"

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

export interface GLAccountNode {
    id: string
    code: string
    name: string
    type: string
    balance: number
    children: GLAccountNode[]
}

export async function getChartOfAccountsTree(): Promise<GLAccountNode[]> {
    try {
        return await withPrismaAuth(async (prisma) => {
            const accounts = await prisma.gLAccount.findMany({
                orderBy: { code: 'asc' }
            })

            const balances = await prisma.journalLine.groupBy({
                by: ['accountId'],
                _sum: {
                    debit: true,
                    credit: true
                }
            })

            const balanceMap = new Map<string, number>()
            balances.forEach(b => {
                const balance = Number(b._sum.debit || 0) - Number(b._sum.credit || 0)
                balanceMap.set(b.accountId, balance)
            })

            const roots: GLAccountNode[] = []

            accounts.forEach(acc => {
                roots.push({
                    id: acc.id,
                    code: acc.code,
                    name: acc.name,
                    type: acc.type,
                    balance: balanceMap.get(acc.id) || 0,
                    children: []
                })
            })

            roots.sort((a, b) => a.code.localeCompare(b.code))

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
}) {
    try {
        return await withPrismaAuth(async (prisma) => {
            const account = await prisma.gLAccount.create({
                data: {
                    code: data.code,
                    name: data.name,
                    type: data.type
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

        return await withPrismaAuth(async (prisma) => {
            const codes = data.lines.map(l => l.accountCode)
            const accounts = await prisma.gLAccount.findMany({
                where: { code: { in: codes } }
            })

            const accountMap = new Map(accounts.map(a => [a.code, a]))

            await prisma.$transaction(async (tx) => {
                const _entry = await tx.journalEntry.create({
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

            return { success: true }
        })
    } catch (error: any) {
        console.error("Journal Posting Error:", error)
        return { success: false, error: error?.message || "Failed to post journal entry" }
    }
}

export interface JournalEntryItem {
    id: string
    date: Date
    description: string
    reference?: string
    lines: {
        account: { code: string; name: string }
        debit: number
        credit: number
        description?: string
    }[]
    totalDebit: number
    totalCredit: number
}

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

// ==========================================
// RECURRING JOURNAL ENTRIES
// ==========================================

import { calculateNextDate } from "@/lib/finance-gl-helpers"
export type { RecurringPattern } from "@/lib/finance-gl-helpers"

export interface RecurringTemplate {
    id: string
    description: string
    reference: string | null
    recurringPattern: string
    nextRecurringDate: string
    lines: {
        accountCode: string
        accountName: string
        debit: number
        credit: number
    }[]
    totalAmount: number
}

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
                await prisma.$transaction(async (tx) => {
                    // Create the actual posted entry
                    await tx.journalEntry.create({
                        data: {
                            date: template.nextRecurringDate || new Date(),
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
// OPENING BALANCES — GL
// ==========================================

export interface OpeningBalanceGLRow {
    accountCode: string
    debit: number
    credit: number
}

/**
 * Post opening balance journal entries for GL accounts.
 * Creates a single POSTED journal entry with all lines.
 */
export async function postOpeningBalancesGL(data: {
    date: Date
    rows: OpeningBalanceGLRow[]
}): Promise<{ success: boolean; error?: string }> {
    if (!data.rows.length) return { success: false, error: "Tidak ada baris saldo awal" }

    const totalDebit = data.rows.reduce((s, r) => s + r.debit, 0)
    const totalCredit = data.rows.reduce((s, r) => s + r.credit, 0)
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
        return { success: false, error: `Tidak seimbang: Debit (${totalDebit.toLocaleString()}) != Kredit (${totalCredit.toLocaleString()})` }
    }

    return postJournalEntry({
        description: "Saldo Awal GL",
        date: data.date,
        reference: "OPENING-GL",
        lines: data.rows.map(r => ({
            accountCode: r.accountCode,
            debit: r.debit,
            credit: r.credit,
            description: "Saldo Awal",
        })),
    })
}

// ==========================================
// OPENING BALANCES — AP & AR
// ==========================================

export interface OpeningInvoiceRow {
    /** Customer ID (for AR / INV_OUT) or Supplier ID (for AP / INV_IN) */
    partyId: string
    /** User-supplied invoice/bill number */
    invoiceNumber: string
    /** Total amount (already includes tax if any) */
    amount: number
    /** Due date */
    dueDate: string // ISO date string
}

/**
 * Bulk-create opening balance invoices (AP bills or AR invoices).
 * Created with status ISSUED so they appear immediately in payables/receivables.
 */
export async function createOpeningInvoices(data: {
    type: 'AP' | 'AR'
    rows: OpeningInvoiceRow[]
    issueDate?: string // ISO date string, defaults to today
}): Promise<{ success: boolean; createdCount?: number; error?: string }> {
    if (!data.rows.length) return { success: false, error: "Tidak ada baris yang diisi" }

    // Validate all rows have required fields
    for (let i = 0; i < data.rows.length; i++) {
        const row = data.rows[i]
        if (!row.partyId) return { success: false, error: `Baris ${i + 1}: Pilih ${data.type === 'AP' ? 'vendor' : 'pelanggan'}` }
        if (!row.invoiceNumber.trim()) return { success: false, error: `Baris ${i + 1}: Nomor invoice wajib diisi` }
        if (row.amount <= 0) return { success: false, error: `Baris ${i + 1}: Jumlah harus lebih dari 0` }
        if (!row.dueDate) return { success: false, error: `Baris ${i + 1}: Tanggal jatuh tempo wajib diisi` }
    }

    try {
        return await withPrismaAuth(async (prisma) => {
            const issueDate = data.issueDate ? new Date(data.issueDate) : new Date()
            const invoiceType = data.type === 'AP' ? 'INV_IN' : 'INV_OUT'

            // Check for duplicate invoice numbers
            const numbers = data.rows.map(r => r.invoiceNumber.trim())
            const existing = await prisma.invoice.findMany({
                where: { number: { in: numbers } },
                select: { number: true },
            })
            if (existing.length > 0) {
                const dupes = existing.map(e => e.number).join(", ")
                return { success: false, error: `Nomor invoice sudah ada: ${dupes}` }
            }

            // Create all invoices in a transaction
            let createdCount = 0
            await prisma.$transaction(async (tx) => {
                for (const row of data.rows) {
                    const amount = row.amount
                    await tx.invoice.create({
                        data: {
                            number: row.invoiceNumber.trim(),
                            type: invoiceType,
                            customerId: data.type === 'AR' ? row.partyId : null,
                            supplierId: data.type === 'AP' ? row.partyId : null,
                            issueDate,
                            dueDate: new Date(row.dueDate),
                            subtotal: amount,
                            taxAmount: 0,
                            totalAmount: amount,
                            balanceDue: amount,
                            status: 'ISSUED',
                            items: {
                                create: [{
                                    description: `Saldo Awal — ${row.invoiceNumber.trim()}`,
                                    quantity: 1,
                                    unitPrice: amount,
                                    amount: amount,
                                }]
                            }
                        }
                    })
                    createdCount++
                }
            })

            return { success: true, createdCount }
        })
    } catch (error) {
        const msg = error instanceof Error ? error.message : "Gagal membuat saldo awal invoice"
        console.error("[createOpeningInvoices] Error:", error)
        return { success: false, error: msg }
    }
}

/**
 * Fetch customers and suppliers for opening balance form dropdowns.
 */
export async function getOpeningBalanceParties(): Promise<{
    customers: Array<{ id: string; name: string }>
    suppliers: Array<{ id: string; name: string }>
}> {
    try {
        return await withPrismaAuth(async (prisma) => {
            const [customers, suppliers] = await Promise.all([
                prisma.customer.findMany({
                    where: { isActive: true },
                    select: { id: true, name: true },
                    orderBy: { name: 'asc' },
                }),
                prisma.supplier.findMany({
                    where: { isActive: true },
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
