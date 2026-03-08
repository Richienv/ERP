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
            // Check if fiscal period is closed for the journal date
            const entryDate = new Date(data.date)
            const entryMonth = entryDate.getMonth() + 1
            const entryYear = entryDate.getFullYear()
            const fiscalPeriod = await prisma.fiscalPeriod.findUnique({
                where: { year_month: { year: entryYear, month: entryMonth } }
            })
            if (fiscalPeriod?.isClosed) {
                throw new Error(`Periode fiskal ${fiscalPeriod.name} sudah ditutup. Tidak bisa posting jurnal ke periode ini.`)
            }

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
// CLOSING JOURNAL (JURNAL PENUTUP)
// ==========================================

export interface ClosingJournalPreviewLine {
    accountId: string
    accountCode: string
    accountName: string
    accountType: string
    debit: number
    credit: number
    description: string
}

export interface ClosingJournalPreview {
    fiscalYear: number
    alreadyClosed: boolean
    revenueTotal: number
    expenseTotal: number
    netIncome: number
    lines: ClosingJournalPreviewLine[]
    retainedEarningsAccount: { id: string; code: string; name: string } | null
}

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
