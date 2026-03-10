'use server'

import { prisma, withPrismaAuth } from "@/lib/db"
import { PrismaClient } from "@prisma/client"
import { createClient } from "@/lib/supabase/server"
import { findMatchesIndexed, buildTransactionIndex, type BankLine, type SystemTransaction, type MatchResult } from "@/lib/finance-reconciliation-helpers"
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

export interface PaginationMeta {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
    matchedCount?: number
    unmatchedCount?: number
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
    systemEntries: SystemEntryData[]
    bankPagination?: PaginationMeta
    systemPagination?: PaginationMeta
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

export interface SystemEntryData {
    entryId: string
    date: string
    description: string
    reference: string | null
    amount: number // positive = debit (money in), negative = credit (money out)
    lineDescription: string | null
    alreadyMatchedItemId: string | null
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
 * Get reconciliation detail with paginated items and system journal entries.
 */
export async function getReconciliationDetail(
    reconciliationId: string,
    options?: { bankPage?: number; bankPageSize?: number; systemPage?: number; systemPageSize?: number }
): Promise<ReconciliationDetail | null> {
    try {
        await requireAuth()

        const bankPage = options?.bankPage ?? 1
        const bankPageSize = options?.bankPageSize ?? 50
        const systemPage = options?.systemPage ?? 1
        const systemPageSize = options?.systemPageSize ?? 50

        const rec = await prisma.bankReconciliation.findUnique({
            where: { id: reconciliationId },
            include: {
                glAccount: { select: { id: true, code: true, name: true, balance: true } },
                items: {
                    orderBy: { bankDate: 'asc' },
                    skip: (bankPage - 1) * bankPageSize,
                    take: bankPageSize,
                },
                _count: { select: { items: true } },
            },
        })

        if (!rec) return null

        // Get counts by match status for the header
        const [totalItems, matchedItemCount] = await Promise.all([
            prisma.bankReconciliationItem.count({ where: { reconciliationId } }),
            prisma.bankReconciliationItem.count({ where: { reconciliationId, matchStatus: 'MATCHED' } }),
        ])

        // Fetch journal lines for this GL account within the reconciliation period (paginated)
        const [journalLines, totalSystemEntries] = await Promise.all([
            prisma.journalLine.findMany({
                where: {
                    accountId: rec.glAccount.id,
                    entry: {
                        status: 'POSTED',
                        date: {
                            gte: rec.periodStart,
                            lte: rec.periodEnd,
                        },
                    },
                },
                select: {
                    id: true,
                    entryId: true,
                    description: true,
                    debit: true,
                    credit: true,
                    entry: {
                        select: {
                            id: true,
                            date: true,
                            description: true,
                            reference: true,
                        },
                    },
                },
                skip: (systemPage - 1) * systemPageSize,
                take: systemPageSize,
            }),
            prisma.journalLine.count({
                where: {
                    accountId: rec.glAccount.id,
                    entry: {
                        status: 'POSTED',
                        date: {
                            gte: rec.periodStart,
                            lte: rec.periodEnd,
                        },
                    },
                },
            }),
        ])

        // Build a map: entryId → matched bank item ID (from already-matched items in current page)
        const entryToItemMap = new Map<string, string>()
        for (const item of rec.items) {
            if (item.systemTransactionId && item.matchStatus === 'MATCHED') {
                entryToItemMap.set(item.systemTransactionId, item.id)
            }
        }

        // Build a map: entryId → entry description (for resolving systemDescription)
        const entryDescriptionMap = new Map<string, string>()
        for (const line of journalLines) {
            entryDescriptionMap.set(line.entryId, line.entry.description)
        }

        // Map journal lines to SystemEntryData[]
        const systemEntries: SystemEntryData[] = journalLines.map((line) => {
            const debit = Number(line.debit)
            const credit = Number(line.credit)
            const amount = debit > 0 ? debit : -credit

            return {
                entryId: line.entryId,
                date: line.entry.date.toISOString(),
                description: line.entry.description,
                reference: line.entry.reference,
                amount,
                lineDescription: line.description,
                alreadyMatchedItemId: entryToItemMap.get(line.entryId) ?? null,
            }
        })

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
                systemDescription: i.systemTransactionId
                    ? (entryDescriptionMap.get(i.systemTransactionId) ?? null)
                    : null,
                matchStatus: i.matchStatus,
                matchedAt: i.matchedAt?.toISOString() || null,
            })),
            systemEntries,
            // Pagination metadata
            bankPagination: {
                page: bankPage,
                pageSize: bankPageSize,
                totalItems,
                totalPages: Math.ceil(totalItems / bankPageSize),
                matchedCount: matchedItemCount,
                unmatchedCount: totalItems - matchedItemCount,
            },
            systemPagination: {
                page: systemPage,
                pageSize: systemPageSize,
                totalItems: totalSystemEntries,
                totalPages: Math.ceil(totalSystemEntries / systemPageSize),
            },
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

            // Build indexed pool for O(1) exact-amount lookups instead of O(n) per bank item
            let availablePool = [...systemTransactions]
            let txnIndex = buildTransactionIndex(availablePool)

            // Batch updates for better DB performance
            const batchUpdates: { id: string; systemTransactionId: string }[] = []

            for (const item of rec.items) {
                if (!item.bankDate) continue

                const bankLine: BankLine = {
                    id: item.id,
                    bankDate: item.bankDate,
                    bankAmount: Number(item.bankAmount),
                    bankDescription: item.bankDescription || '',
                    bankRef: item.bankRef || '',
                }

                const matches = findMatchesIndexed(bankLine, txnIndex)

                if (matches.length === 0) continue

                // Auto-apply only HIGH confidence single matches
                const highMatches = matches.filter((m) => m.confidence === 'HIGH')

                if (highMatches.length === 1) {
                    const best = highMatches[0]
                    batchUpdates.push({ id: item.id, systemTransactionId: best.transactionId })

                    // Remove matched transaction and rebuild index
                    availablePool = availablePool.filter((t) => t.id !== best.transactionId)
                    txnIndex = buildTransactionIndex(availablePool)

                    matched++
                } else {
                    // Store MEDIUM/LOW (or multiple HIGH) as suggestions
                    suggestions.push({ bankItemId: item.id, matches })
                }
            }

            // Apply all HIGH matches in batch
            const now = new Date()
            for (const update of batchUpdates) {
                await prisma.bankReconciliationItem.update({
                    where: { id: update.id },
                    data: {
                        systemTransactionId: update.systemTransactionId,
                        matchStatus: 'MATCHED',
                        matchedBy: user?.id || null,
                        matchedAt: now,
                    },
                })
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
 * Match multiple bank items to multiple system journal entries (checkbox multi-select).
 * User selects 1+ bank items and 1+ system entries, totals must match within Rp 1.
 */
export async function matchMultipleItems(data: {
    bankItemIds: string[]
    systemEntryIds: string[]
}): Promise<{ success: boolean; error?: string }> {
    if (!data.bankItemIds.length || !data.systemEntryIds.length) {
        return { success: false, error: 'Pilih minimal 1 item bank dan 1 transaksi sistem' }
    }

    try {
        await withPrismaAuth(async (prisma: PrismaClient) => {
            const supabase = await (await import('@/lib/supabase/server')).createClient()
            const { data: { user } } = await supabase.auth.getUser()

            // Fetch bank items
            const bankItems = await prisma.bankReconciliationItem.findMany({
                where: { id: { in: data.bankItemIds } },
                include: { reconciliation: { select: { glAccountId: true } } },
            })

            if (bankItems.length === 0) {
                throw new Error('Item bank tidak ditemukan')
            }

            // Get GL account from first bank item's reconciliation
            const glAccountId = bankItems[0].reconciliation.glAccountId

            // Fetch journal lines for the system entry IDs filtered to that GL account
            const journalLines = await prisma.journalLine.findMany({
                where: {
                    entryId: { in: data.systemEntryIds },
                    accountId: glAccountId,
                },
                select: {
                    entryId: true,
                    debit: true,
                    credit: true,
                },
            })

            // Calculate totals
            const bankTotal = bankItems.reduce(
                (sum, item) => sum + Math.abs(Number(item.bankAmount)),
                0
            )
            const systemTotal = journalLines.reduce(
                (sum, line) => sum + Math.max(Number(line.debit), Number(line.credit)),
                0
            )

            // Validate totals match within Rp 1 tolerance
            if (Math.abs(bankTotal - systemTotal) > 1) {
                throw new Error(
                    `Total tidak cocok: Bank Rp ${bankTotal.toLocaleString('id-ID')} vs Sistem Rp ${systemTotal.toLocaleString('id-ID')}`
                )
            }

            // Update all bank items as matched
            await prisma.bankReconciliationItem.updateMany({
                where: { id: { in: data.bankItemIds } },
                data: {
                    systemTransactionId: data.systemEntryIds[0],
                    matchStatus: 'MATCHED',
                    matchedBy: user?.id || null,
                    matchedAt: new Date(),
                },
            })
        })

        return { success: true }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal mencocokkan item'
        console.error("[matchMultipleItems] Error:", error)
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
