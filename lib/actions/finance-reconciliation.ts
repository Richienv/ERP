'use server'

import { prisma, withPrismaAuth } from "@/lib/db"
import { PrismaClient } from "@prisma/client"
import { createClient } from "@/lib/supabase/server"
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
 * Get reconciliation detail with all items.
 */
export async function getReconciliationDetail(
    reconciliationId: string
): Promise<ReconciliationDetail | null> {
    try {
        await requireAuth()

        const rec = await prisma.bankReconciliation.findUnique({
            where: { id: reconciliationId },
            include: {
                glAccount: { select: { code: true, name: true, balance: true } },
                items: {
                    orderBy: { bankDate: 'asc' },
                },
            },
        })

        if (!rec) return null

        return {
            id: rec.id,
            glAccountCode: rec.glAccount.code,
            glAccountName: rec.glAccount.name,
            glAccountBalance: Number(rec.glAccount.balance),
            statementDate: rec.statementDate.toISOString(),
            periodStart: rec.periodStart.toISOString(),
            periodEnd: rec.periodEnd.toISOString(),
            status: rec.status,
            items: rec.items.map((i) => ({
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

        // Bank accounts typically have codes starting with 101x or 110x
        const accounts = await prisma.gLAccount.findMany({
            where: {
                type: 'ASSET',
                code: { startsWith: '1' },
                name: {
                    contains: 'bank',
                    mode: 'insensitive' as const,
                },
            },
            select: { id: true, code: true, name: true, balance: true },
            orderBy: { code: 'asc' },
        })

        // Also include cash accounts
        const cashAccounts = await prisma.gLAccount.findMany({
            where: {
                type: 'ASSET',
                code: { in: ['1000', '1010', '1020'] },
            },
            select: { id: true, code: true, name: true, balance: true },
            orderBy: { code: 'asc' },
        })

        const all = [...accounts, ...cashAccounts]
        const seen = new Set<string>()
        return all.filter((a) => {
            if (seen.has(a.id)) return false
            seen.add(a.id)
            return true
        }).map((a) => ({ ...a, balance: Number(a.balance) }))
    } catch (error) {
        console.error("[getBankAccounts] Error:", error)
        return []
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
 * Auto-match bank items with journal entries by amount and date range.
 */
export async function autoMatchReconciliation(
    reconciliationId: string
): Promise<{ success: boolean; matchedCount?: number; error?: string }> {
    try {
        const matchedCount = await withPrismaAuth(async (prisma: PrismaClient) => {
            const rec = await prisma.bankReconciliation.findUniqueOrThrow({
                where: { id: reconciliationId },
                include: {
                    items: {
                        where: { matchStatus: 'UNMATCHED' },
                    },
                },
            })

            const supabase = await (await import('@/lib/supabase/server')).createClient()
            const { data: { user } } = await supabase.auth.getUser()

            let count = 0

            for (const item of rec.items) {
                if (!item.bankDate) continue

                // Look for journal entries with matching amount within ±2 days
                const dateFrom = new Date(item.bankDate)
                dateFrom.setDate(dateFrom.getDate() - 2)
                const dateTo = new Date(item.bankDate)
                dateTo.setDate(dateTo.getDate() + 2)

                const amount = Number(item.bankAmount)
                const absAmount = Math.abs(amount)

                // Find journal lines with matching debit or credit
                const matchingLines = await prisma.journalLine.findMany({
                    where: {
                        entry: {
                            date: { gte: dateFrom, lte: dateTo },
                            status: 'POSTED',
                        },
                        OR: [
                            { debit: absAmount },
                            { credit: absAmount },
                        ],
                    },
                    select: { entryId: true },
                    take: 1,
                })

                if (matchingLines.length > 0) {
                    await prisma.bankReconciliationItem.update({
                        where: { id: item.id },
                        data: {
                            systemTransactionId: matchingLines[0].entryId,
                            matchStatus: 'MATCHED',
                            matchedBy: user?.id || null,
                            matchedAt: new Date(),
                        },
                    })
                    count++
                }
            }

            return count
        })

        return { success: true, matchedCount }
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
