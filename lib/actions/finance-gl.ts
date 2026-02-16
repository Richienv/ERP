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
