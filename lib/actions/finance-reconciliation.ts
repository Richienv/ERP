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
    systemEntries: SystemEntryData[]
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
                glAccount: { select: { id: true, code: true, name: true, balance: true } },
                items: {
                    orderBy: { bankDate: 'asc' },
                },
            },
        })

        if (!rec) return null

        // Fetch journal lines for this GL account within the reconciliation period
        const journalLines = await prisma.journalLine.findMany({
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
        })

        // Build a map: entryId → matched bank item ID (from already-matched items)
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
            // Positive = debit (money in), negative = credit (money out)
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

        // Cash & Bank accounts only: 10xx codes (Kas, Bank BCA, Bank Mandiri, etc.)
        const accounts = await prisma.gLAccount.findMany({
            where: {
                type: 'ASSET',
                code: { startsWith: '10' },
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
 * Auto-match bank items with journal entries using scored matching.
 *
 * Scoring algorithm:
 *   - Exact amount match (required):    +50 pts
 *   - Reference text contains ref:      +30 pts
 *   - Description word overlap:         +15 pts
 *   - Date: exact same day:             +20 pts
 *   - Date: ±1 day:                     +10 pts
 *   - Date: ±2 days:                    +5 pts
 *   Threshold: 50+ to auto-match (minimum = exact amount match)
 *
 * Fixes vs previous implementation:
 *   1. Filters journal lines to ONLY the reconciliation's GL account
 *   2. Single batch query instead of N+1 (one query per unmatched item)
 *   3. Scored matching with reference/description text overlap
 *   4. Tracks already-matched entries to prevent double-matching
 */
export async function autoMatchReconciliation(
    reconciliationId: string
): Promise<{ success: boolean; matchedCount?: number; error?: string }> {
    try {
        const matchedCount = await withPrismaAuth(async (prisma: PrismaClient) => {
            // 1. Fetch reconciliation with GL account ID and all items
            const rec = await prisma.bankReconciliation.findUniqueOrThrow({
                where: { id: reconciliationId },
                include: {
                    glAccount: { select: { id: true } },
                    items: true,
                },
            })

            const unmatchedItems = rec.items.filter(
                (i) => i.matchStatus === 'UNMATCHED' && i.bankDate !== null
            )
            if (unmatchedItems.length === 0) return 0

            // 2. Compute the widest date window needed (period ±2 days)
            const bankDates = unmatchedItems.map((i) => i.bankDate!.getTime())
            const minDate = new Date(Math.min(...bankDates))
            minDate.setDate(minDate.getDate() - 2)
            const maxDate = new Date(Math.max(...bankDates))
            maxDate.setDate(maxDate.getDate() + 2)

            // 3. Single batch query: all posted journal lines for THIS GL account in the date window
            const candidateLines = await prisma.journalLine.findMany({
                where: {
                    accountId: rec.glAccount.id,
                    entry: {
                        status: 'POSTED',
                        date: { gte: minDate, lte: maxDate },
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
            })

            // 4. Build set of already-matched entry IDs (from previously matched items)
            const alreadyMatchedEntryIds = new Set<string>()
            for (const item of rec.items) {
                if (item.matchStatus === 'MATCHED' && item.systemTransactionId) {
                    alreadyMatchedEntryIds.add(item.systemTransactionId)
                }
            }

            // 5. Get current user for matchedBy
            const supabase = await (await import('@/lib/supabase/server')).createClient()
            const { data: { user } } = await supabase.auth.getUser()

            // 6. Helper: extract words for description overlap scoring
            const extractWords = (text: string | null): Set<string> => {
                if (!text) return new Set()
                return new Set(
                    text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter((w) => w.length > 2)
                )
            }

            // 7. Helper: compute day difference between two dates
            const dayDiff = (a: Date, b: Date): number => {
                const msPerDay = 86_400_000
                return Math.abs(
                    Math.round((a.getTime() - b.getTime()) / msPerDay)
                )
            }

            // 8. Track entries matched during this run to prevent double-matching
            const matchedInThisRun = new Set<string>()

            // 9. Score all candidates for each unmatched bank item
            type MatchCandidate = { entryId: string; score: number }

            const itemMatches: { itemId: string; best: MatchCandidate }[] = []

            for (const item of unmatchedItems) {
                const bankAmount = Number(item.bankAmount)
                const absBankAmount = Math.abs(bankAmount)
                const bankDate = item.bankDate!
                const bankRef = item.bankRef?.toLowerCase() || ''
                const bankDescWords = extractWords(item.bankDescription)

                let bestMatch: MatchCandidate | null = null

                for (const line of candidateLines) {
                    // Skip entries already matched (previously or in this run)
                    if (alreadyMatchedEntryIds.has(line.entryId)) continue
                    if (matchedInThisRun.has(line.entryId)) continue

                    // Amount check (required): bank positive → debit, bank negative → credit
                    const debit = Number(line.debit)
                    const credit = Number(line.credit)
                    const lineAmount = debit > 0 ? debit : -credit

                    // Exact amount match within Rp 0.01
                    if (Math.abs(bankAmount - lineAmount) > 0.01) continue

                    // Start scoring — amount matched = +50
                    let score = 50

                    // Reference matching: +30 if ref contains ref, +15 for word overlap
                    const entryRef = line.entry.reference?.toLowerCase() || ''
                    if (bankRef && entryRef && (entryRef.includes(bankRef) || bankRef.includes(entryRef))) {
                        score += 30
                    } else {
                        // Description word overlap: +15 if any meaningful overlap
                        const entryDescWords = extractWords(line.entry.description)
                        const lineDescWords = extractWords(line.description)
                        const allEntryWords = new Set([...entryDescWords, ...lineDescWords])
                        let overlapCount = 0
                        for (const w of bankDescWords) {
                            if (allEntryWords.has(w)) overlapCount++
                        }
                        if (overlapCount >= 1) score += 15
                    }

                    // Date proximity scoring
                    const days = dayDiff(bankDate, line.entry.date)
                    if (days === 0) score += 20
                    else if (days === 1) score += 10
                    else if (days === 2) score += 5

                    // Track best match for this bank item
                    if (!bestMatch || score > bestMatch.score) {
                        bestMatch = { entryId: line.entryId, score }
                    }
                }

                // Threshold: 50+ (at minimum exact amount match)
                if (bestMatch && bestMatch.score >= 50) {
                    matchedInThisRun.add(bestMatch.entryId)
                    itemMatches.push({ itemId: item.id, best: bestMatch })
                }
            }

            // 10. Batch update all matched items
            const now = new Date()
            let count = 0
            for (const { itemId, best } of itemMatches) {
                await prisma.bankReconciliationItem.update({
                    where: { id: itemId },
                    data: {
                        systemTransactionId: best.entryId,
                        matchStatus: 'MATCHED',
                        matchedBy: user?.id || null,
                        matchedAt: now,
                    },
                })
                count++
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
