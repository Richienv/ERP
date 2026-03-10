'use server'

import { prisma, withPrismaAuth } from "@/lib/db"
import { PrismaClient } from "@prisma/client"
import { createClient } from "@/lib/supabase/server"
import { findMatches, type BankLine, type SystemTransaction, type MatchResult } from "@/lib/finance-reconciliation-helpers"
async function requireAuth() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new Error("Unauthorized")
    return user
}

// ==============================================================================
// Types
// ==============================================================================

export interface ReconciliationSummary {
    id: string
    glAccountCode: string
    glAccountName: string
    statementDate: string
    periodStart: string
    periodEnd: string
    status: string
    itemCount: number
    matchedCount: number
    unmatchedCount: number
    totalBankAmount: number
    createdAt: string
}

export interface ReconciliationDetail {
    id: string
    glAccountCode: string
    glAccountName: string
    glAccountBalance: number
    statementDate: string
    periodStart: string
    periodEnd: string
    status: string
    items: ReconciliationItemData[]
    hasMore: boolean
    nextSkip: number
}

export interface ReconciliationItemData {
    id: string
    bankRef: string | null
    bankDescription: string | null
    bankDate: string | null
    bankAmount: number
    systemTransactionId: string | null
    systemDescription: string | null
    matchStatus: string
    matchedAt: string | null
}

export interface BankStatementRow {
    date: string
    description: string
    amount: number
    reference?: string
}

// ==============================================================================
// Read Actions (use singleton prisma to avoid connection pool exhaustion)
// ==============================================================================

/**
 * Get all reconciliations, most recent first.
 */
export async function getReconciliations(): Promise<ReconciliationSummary[]> {
    try {
        await requireAuth()

        const recs = await prisma.bankReconciliation.findMany({
            include: {
                glAccount: { select: { code: true, name: true } },
                items: { select: { matchStatus: true, bankAmount: true } },
            },
            orderBy: { statementDate: 'desc' },
            take: 50,
        })

        return recs.map((r) => {
            const matchedCount = r.items.filter((i) => i.matchStatus === 'MATCHED').length
            const unmatchedCount = r.items.filter((i) => i.matchStatus === 'UNMATCHED').length
            const totalBank = r.items.reduce((s, i) => s + Number(i.bankAmount), 0)

            return {
                id: r.id,
                glAccountCode: r.glAccount.code,
                glAccountName: r.glAccount.name,
                statementDate: r.statementDate.toISOString(),
                periodStart: r.periodStart.toISOString(),
                periodEnd: r.periodEnd.toISOString(),
                status: r.status,
                itemCount: r.items.length,
                matchedCount,
                unmatchedCount,
                totalBankAmount: totalBank,
                createdAt: r.statementDate.toISOString(),
            }
        })
    } catch (error) {
        console.error("[getReconciliations] Error:", error)
        return []
    }
}

/**
 * Get reconciliation detail with paginated items.
 */
export async function getReconciliationDetail(
    reconciliationId: string,
    skip = 0,
    take = 100
): Promise<ReconciliationDetail | null> {
    try {
        await requireAuth()

        const rec = await prisma.bankReconciliation.findUnique({
            where: { id: reconciliationId },
            include: {
                glAccount: { select: { code: true, name: true, balance: true } },
                items: {
                    orderBy: { bankDate: 'asc' },
                    skip,
                    take: take + 1,
                },
            },
        })

        if (!rec) return null

        const hasMore = rec.items.length > take
        const itemsSlice = hasMore ? rec.items.slice(0, take) : rec.items

        return {
            id: rec.id,
            glAccountCode: rec.glAccount.code,
            glAccountName: rec.glAccount.name,
            glAccountBalance: Number(rec.glAccount.balance),
            statementDate: rec.statementDate.toISOString(),
            periodStart: rec.periodStart.toISOString(),
            periodEnd: rec.periodEnd.toISOString(),
            status: rec.status,
            items: itemsSlice.map((i) => ({
                id: i.id,
                bankRef: i.bankRef,
                bankDescription: i.bankDescription,
                bankDate: i.bankDate?.toISOString() || null,
                bankAmount: Number(i.bankAmount),
                systemTransactionId: i.systemTransactionId,
                systemDescription: null,
                matchStatus: i.matchStatus,
                matchedAt: i.matchedAt?.toISOString() || null,
            })),
            hasMore,
            nextSkip: skip + take,
        }
    } catch (error) {
        console.error("[getReconciliationDetail] Error:", error)
        return null
    }
}

/**
 * Get bank-type GL accounts for reconciliation.
 */
export async function getBankAccounts(): Promise<
    { id: string; code: string; name: string; balance: number }[]
> {
    try {
        await requireAuth()

        // Bank & Cash accounts: type ASSET, name contains bank/kas/cash, or specific codes
        const accounts = await prisma.gLAccount.findMany({
            where: {
                type: 'ASSET',
                OR: [
                    { name: { contains: 'bank', mode: 'insensitive' as const } },
                    { name: { contains: 'kas', mode: 'insensitive' as const } },
                    { name: { contains: 'cash', mode: 'insensitive' as const } },
                    { code: { in: ['1000', '1010', '1020', '1100', '1110'] } },
                ],
            },
            select: { id: true, code: true, name: true, balance: true },
            orderBy: { code: 'asc' },
        })

        const seen = new Set<string>()
        return accounts.filter((a) => {
            if (seen.has(a.id)) return false
            seen.add(a.id)
            return true
        }).map((a) => ({ ...a, balance: Number(a.balance) }))
    } catch (error) {
        console.error("[getBankAccounts] Error:", error)
        return []
    }
}

/**
 * Create a new bank GL account for reconciliation.
 */
export async function createBankAccount(data: {
    code: string
    name: string
    initialBalance?: number
}): Promise<{ success: boolean; accountId?: string; error?: string }> {
    try {
        const result = await withPrismaAuth(async (prisma: PrismaClient) => {
            // Check code uniqueness
            const existing = await prisma.gLAccount.findFirst({ where: { code: data.code } })
            if (existing) return { success: false as const, error: `Kode ${data.code} sudah digunakan` }

            const account = await prisma.gLAccount.create({
                data: {
                    code: data.code,
                    name: data.name,
                    type: 'ASSET',
                    balance: data.initialBalance ?? 0,
                },
            })

            return { success: true as const, accountId: account.id }
        })

        return result
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal membuat akun bank'
        console.error("[createBankAccount] Error:", error)
        return { success: false, error: msg }
    }
}

// ==============================================================================
// Write Actions (keep withPrismaAuth for transactional safety)
// ==============================================================================

/**
 * Create a new reconciliation session.
 */
export async function createReconciliation(data: {
    glAccountId: string
    statementDate: string
    periodStart: string
    periodEnd: string
}): Promise<{ success: boolean; reconciliationId?: string; error?: string }> {
    try {
        const recId = await withPrismaAuth(async (prisma: PrismaClient) => {
            const rec = await prisma.bankReconciliation.create({
                data: {
                    glAccountId: data.glAccountId,
                    statementDate: new Date(data.statementDate),
                    periodStart: new Date(data.periodStart),
                    periodEnd: new Date(data.periodEnd),
                    status: 'REC_DRAFT',
                },
            })
            return rec.id
        })

        return { success: true, reconciliationId: recId }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal membuat rekonsiliasi'
        console.error("[createReconciliation] Error:", error)
        return { success: false, error: msg }
    }
}

/**
 * Import bank statement rows into a reconciliation.
 */
export async function importBankStatementRows(
    reconciliationId: string,
    rows: BankStatementRow[]
): Promise<{ success: boolean; importedCount?: number; error?: string }> {
    if (rows.length === 0) {
        return { success: false, error: 'Tidak ada baris untuk diimpor' }
    }

    try {
        const count = await withPrismaAuth(async (prisma: PrismaClient) => {
            const items = rows.map((r) => ({
                reconciliationId,
                bankRef: r.reference || null,
                bankDescription: r.description,
                bankDate: new Date(r.date),
                bankAmount: r.amount,
                matchStatus: 'UNMATCHED' as const,
            }))

            const result = await prisma.bankReconciliationItem.createMany({
                data: items,
            })

            // Update status to IN_PROGRESS
            await prisma.bankReconciliation.update({
                where: { id: reconciliationId },
                data: { status: 'REC_IN_PROGRESS' },
            })

            return result.count
        })

        return { success: true, importedCount: count }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal mengimpor laporan bank'
        console.error("[importBankStatementRows] Error:", error)
        return { success: false, error: msg }
    }
}

/**
 * Match a bank statement item to a system transaction (journal entry).
 */
export async function matchReconciliationItem(
    itemId: string,
    systemTransactionId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        await withPrismaAuth(async (prisma: PrismaClient) => {
            const supabase = await (await import('@/lib/supabase/server')).createClient()
            const { data: { user } } = await supabase.auth.getUser()

            await prisma.bankReconciliationItem.update({
                where: { id: itemId },
                data: {
                    systemTransactionId,
                    matchStatus: 'MATCHED',
                    matchedBy: user?.id || null,
                    matchedAt: new Date(),
                },
            })
        })

        return { success: true }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal mencocokkan item'
        console.error("[matchReconciliationItem] Error:", error)
        return { success: false, error: msg }
    }
}

/**
 * Unmatch a previously matched item.
 */
export async function unmatchReconciliationItem(
    itemId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        await withPrismaAuth(async (prisma: PrismaClient) => {
            await prisma.bankReconciliationItem.update({
                where: { id: itemId },
                data: {
                    systemTransactionId: null,
                    matchStatus: 'UNMATCHED',
                    matchedBy: null,
                    matchedAt: null,
                },
            })
        })

        return { success: true }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal membatalkan pencocokan'
        console.error("[unmatchReconciliationItem] Error:", error)
        return { success: false, error: msg }
    }
}

/**
 * Auto-match bank items with journal entries using 3-pass confidence scoring.
 * HIGH confidence matches are auto-applied; MEDIUM/LOW are returned as suggestions.
 */
export async function autoMatchReconciliation(
    reconciliationId: string
): Promise<{
    success: boolean
    matched?: number
    suggestions?: { bankItemId: string; matches: MatchResult[] }[]
    error?: string
}> {
    try {
        const result = await withPrismaAuth(async (prisma: PrismaClient) => {
            const rec = await prisma.bankReconciliation.findUniqueOrThrow({
                where: { id: reconciliationId },
                include: {
                    items: {
                        where: { matchStatus: 'UNMATCHED' },
                    },
                },
            })

            // Expand date range by ±5 days for broader matching
            const dateFrom = new Date(rec.periodStart)
            dateFrom.setDate(dateFrom.getDate() - 5)
            const dateTo = new Date(rec.periodEnd)
            dateTo.setDate(dateTo.getDate() + 5)

            // Fetch POSTED journal lines for the GL account within expanded date range
            const journalLines = await prisma.journalLine.findMany({
                where: {
                    accountId: rec.glAccountId,
                    entry: {
                        date: { gte: dateFrom, lte: dateTo },
                        status: 'POSTED',
                    },
                },
                include: {
                    entry: {
                        select: { id: true, date: true, description: true, reference: true },
                    },
                },
            })

            // Get already-matched transaction IDs to exclude
            const alreadyMatchedItems = await prisma.bankReconciliationItem.findMany({
                where: {
                    reconciliationId,
                    matchStatus: 'MATCHED',
                    systemTransactionId: { not: null },
                },
                select: { systemTransactionId: true },
            })
            const matchedTxnIds = new Set(
                alreadyMatchedItems.map((i) => i.systemTransactionId).filter(Boolean) as string[]
            )

            // Convert journal lines to SystemTransaction[], de-duplicate by entry ID
            const seenEntryIds = new Set<string>()
            const systemTransactions: SystemTransaction[] = []

            for (const line of journalLines) {
                const entryId = line.entry.id
                if (seenEntryIds.has(entryId) || matchedTxnIds.has(entryId)) continue
                seenEntryIds.add(entryId)

                const debit = Number(line.debit)
                const credit = Number(line.credit)
                const amount = debit > 0 ? debit : -credit

                systemTransactions.push({
                    id: entryId,
                    date: line.entry.date,
                    amount,
                    description: line.entry.description || '',
                    reference: line.entry.reference,
                })
            }

            const supabase = await (await import('@/lib/supabase/server')).createClient()
            const { data: { user } } = await supabase.auth.getUser()

            let matched = 0
            const suggestions: { bankItemId: string; matches: MatchResult[] }[] = []

            // Pool of available transactions — remove after each HIGH match
            const availablePool = [...systemTransactions]

            for (const item of rec.items) {
                if (!item.bankDate) continue

                const bankLine: BankLine = {
                    id: item.id,
                    bankDate: item.bankDate,
                    bankAmount: Number(item.bankAmount),
                    bankDescription: item.bankDescription || '',
                    bankRef: item.bankRef || '',
                }

                const matches = findMatches(bankLine, availablePool)

                if (matches.length === 0) continue

                // Auto-apply only HIGH confidence single matches
                const highMatches = matches.filter((m) => m.confidence === 'HIGH')

                if (highMatches.length === 1) {
                    const best = highMatches[0]

                    await prisma.bankReconciliationItem.update({
                        where: { id: item.id },
                        data: {
                            systemTransactionId: best.transactionId,
                            matchStatus: 'MATCHED',
                            matchedBy: user?.id || null,
                            matchedAt: new Date(),
                        },
                    })

                    // Remove matched transaction from pool
                    const poolIdx = availablePool.findIndex((t) => t.id === best.transactionId)
                    if (poolIdx !== -1) availablePool.splice(poolIdx, 1)

                    matched++
                } else {
                    // Store MEDIUM/LOW (or multiple HIGH) as suggestions
                    suggestions.push({ bankItemId: item.id, matches })
                }
            }

            // Update reconciliation status if matches were made
            if (matched > 0) {
                await prisma.bankReconciliation.update({
                    where: { id: reconciliationId },
                    data: { status: 'REC_IN_PROGRESS' },
                })
            }

            return { matched, suggestions }
        })

        return { success: true, matched: result.matched, suggestions: result.suggestions }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal auto-match'
        console.error("[autoMatchReconciliation] Error:", error)
        return { success: false, error: msg }
    }
}

/**
 * Close/complete a reconciliation.
 */
export async function closeReconciliation(
    reconciliationId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        await withPrismaAuth(async (prisma: PrismaClient) => {
            const supabase = await (await import('@/lib/supabase/server')).createClient()
            const { data: { user } } = await supabase.auth.getUser()

            await prisma.bankReconciliation.update({
                where: { id: reconciliationId },
                data: {
                    status: 'REC_COMPLETED',
                    closedBy: user?.id || null,
                    closedAt: new Date(),
                },
            })
        })

        return { success: true }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal menutup rekonsiliasi'
        console.error("[closeReconciliation] Error:", error)
        return { success: false, error: msg }
    }
}
