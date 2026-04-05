'use server'

import { prisma, withPrismaAuth } from "@/lib/db"
import { PrismaClient } from "@prisma/client"
import { createClient } from "@/lib/supabase/server"
import { SYS_ACCOUNTS, ensureSystemAccounts } from "@/lib/gl-accounts-server"
import { findMatchesIndexed, buildTransactionIndex, type BankLine, type SystemTransaction, type MatchResult, type MatchTier } from "@/lib/finance-reconciliation-helpers"
import { postJournalEntry, getNextJournalRef } from "@/lib/actions/finance-gl"
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
    bankStatementBalance: number | null
    bookBalanceSnapshot: number | null
    notes: string | null
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
    // 3-tier automatch fields
    matchTier: MatchTier | null
    matchScore: number | null
    matchAmountDiff: number | null
    matchNameSimilarity: number | null
    matchDaysDiff: number | null
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
    options?: { bankPage?: number; bankPageSize?: number; systemPage?: number; systemPageSize?: number; activeBankItemId?: string }
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

        // Resolve active bank item for per-transaction filtering
        let activeBankItem: { bankAmount: number; bankDate: Date | null } | null = null
        if (options?.activeBankItemId) {
            const item = rec.items.find(i => i.id === options.activeBankItemId)
                ?? await prisma.bankReconciliationItem.findUnique({
                    where: { id: options.activeBankItemId },
                    select: { bankAmount: true, bankDate: true },
                })
            if (item) {
                activeBankItem = {
                    bankAmount: Number(item.bankAmount),
                    bankDate: item.bankDate,
                }
            }
        }

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

        // ── Server-side per-transaction pre-filter ──
        // When an active bank item is specified, filter journal lines to plausible matches only.
        const filteredJournalLines = activeBankItem
            ? journalLines.filter(line => {
                const debit = Number(line.debit)
                const credit = Number(line.credit)
                const lineAmount = debit > 0 ? debit : credit

                // Direction gate: bank KELUAR (negative) → only CREDIT journal lines on bank GL
                const bankIsKeluar = activeBankItem!.bankAmount < 0
                if (bankIsKeluar && debit > 0) return false
                if (!bankIsKeluar && credit > 0) return false

                // Amount tolerance: ±10% or ±Rp 10.000 (whichever is larger)
                const bankAbsAmount = Math.abs(activeBankItem!.bankAmount)
                const tolerance = Math.max(bankAbsAmount * 0.10, 10_000)
                if (Math.abs(lineAmount - bankAbsAmount) > tolerance) return false

                // Date proximity: ±30 days from bank transaction date
                if (activeBankItem!.bankDate && line.entry.date) {
                    const diffMs = Math.abs(new Date(activeBankItem!.bankDate).getTime() - new Date(line.entry.date).getTime())
                    if (diffMs > 30 * 86_400_000) return false
                }

                return true
            })
            : journalLines

        // Build a map: entryId → matched bank item ID (from already-matched items in current page)
        const entryToItemMap = new Map<string, string>()
        for (const item of rec.items) {
            if (item.systemTransactionId && item.matchStatus === 'MATCHED') {
                entryToItemMap.set(item.systemTransactionId, item.id)
            }
        }

        // Build a map: entryId → entry description (for resolving systemDescription)
        const entryDescriptionMap = new Map<string, string>()
        for (const line of filteredJournalLines) {
            entryDescriptionMap.set(line.entryId, line.entry.description)
        }

        // Map journal lines to SystemEntryData[]
        const systemEntries: SystemEntryData[] = filteredJournalLines.map((line) => {
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
            bankStatementBalance: rec.bankStatementBalance != null ? Number(rec.bankStatementBalance) : null,
            bookBalanceSnapshot: rec.bookBalanceSnapshot != null ? Number(rec.bookBalanceSnapshot) : null,
            notes: rec.notes ?? null,
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
                matchTier: (i.matchTier as MatchTier) ?? null,
                matchScore: i.matchScore ?? null,
                matchAmountDiff: i.matchAmountDiff != null ? Number(i.matchAmountDiff) : null,
                matchNameSimilarity: i.matchNameSimilarity != null ? Number(i.matchNameSimilarity) : null,
                matchDaysDiff: i.matchDaysDiff ?? null,
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
                totalItems: activeBankItem ? filteredJournalLines.length : totalSystemEntries,
                totalPages: activeBankItem
                    ? Math.ceil(filteredJournalLines.length / systemPageSize)
                    : Math.ceil(totalSystemEntries / systemPageSize),
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
                    { code: { in: [SYS_ACCOUNTS.CASH, SYS_ACCOUNTS.PETTY_CASH, SYS_ACCOUNTS.BANK_BCA, SYS_ACCOUNTS.BANK_MANDIRI] } },
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
 * Create a new bank account with full details.
 * Creates both a BankAccount record and (optionally) a linked GLAccount.
 */
export async function createBankAccount(data: {
    code: string
    bankName: string
    accountNumber: string
    accountHolder: string
    branch?: string
    currency?: string
    coaAccountId?: string
    openingBalance?: number
    description?: string
    isActive?: boolean
}): Promise<{ success: boolean; bankAccountId?: string; error?: string }> {
    try {
        await requireAuth()

        // Validate code range — bank accounts must be ASSET type (1000–1999)
        const codeNum = Number(data.code)
        if (isNaN(codeNum) || codeNum < 1000 || codeNum > 1999) {
            return { success: false, error: 'Kode harus dalam range 1000–1999 (Akun Aset)' }
        }

        // Validate currency — must be IDR or exist in Currency table
        const currencyCode = data.currency || 'IDR'
        if (currencyCode !== 'IDR') {
            const currExists = await prisma.currency.findUnique({ where: { code: currencyCode } })
            if (!currExists) {
                return { success: false, error: `Mata uang ${currencyCode} belum terdaftar. Tambahkan di halaman Kurs Mata Uang terlebih dahulu.` }
            }
        }

        // Check code uniqueness on BankAccount table
        const existingBank = await prisma.bankAccount.findFirst({ where: { code: data.code } })
        if (existingBank) return { success: false, error: `Kode ${data.code} sudah digunakan` }

        // If no COA account linked, create a new GLAccount for this bank
        let coaAccountId = data.coaAccountId
        if (!coaAccountId) {
            // Check GL code uniqueness
            const existingGL = await prisma.gLAccount.findFirst({ where: { code: data.code } })
            if (existingGL) {
                // Link to existing GL account
                coaAccountId = existingGL.id
            } else {
                // Create new GL account
                const glName = data.description
                    ? `${data.bankName} — ${data.description}`
                    : `${data.bankName} (${data.accountNumber})`
                const glAccount = await prisma.gLAccount.create({
                    data: {
                        code: data.code,
                        name: glName,
                        type: 'ASSET',
                        balance: data.openingBalance ?? 0,
                    },
                })
                coaAccountId = glAccount.id
            }
        }

        const bankAccount = await prisma.bankAccount.create({
            data: {
                code: data.code,
                bankName: data.bankName,
                accountNumber: data.accountNumber,
                accountHolder: data.accountHolder,
                branch: data.branch || null,
                currency: data.currency || 'IDR',
                coaAccountId,
                openingBalance: data.openingBalance ?? 0,
                description: data.description || null,
                isActive: data.isActive ?? true,
            },
        })

        return { success: true, bankAccountId: bankAccount.id }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal membuat akun bank'
        console.error("[createBankAccount] Error:", error)
        return { success: false, error: msg }
    }
}

/**
 * Get all bank accounts (from BankAccount table).
 */
export async function getBankAccountsList(): Promise<
    { id: string; code: string; bankName: string; accountNumber: string; accountHolder: string; branch: string | null; currency: string; coaAccountId: string | null; openingBalance: number; description: string | null; isActive: boolean; coaBalance: number }[]
> {
    try {
        await requireAuth()

        const accounts = await prisma.bankAccount.findMany({
            where: { isActive: true },
            include: {
                coaAccount: { select: { id: true, code: true, name: true, balance: true } },
            },
            orderBy: { code: 'asc' },
        })

        return accounts.map((a) => ({
            id: a.id,
            code: a.code,
            bankName: a.bankName,
            accountNumber: a.accountNumber,
            accountHolder: a.accountHolder,
            branch: a.branch,
            currency: a.currency,
            coaAccountId: a.coaAccountId,
            openingBalance: Number(a.openingBalance),
            description: a.description,
            isActive: a.isActive,
            coaBalance: a.coaAccount ? Number(a.coaAccount.balance) : 0,
        }))
    } catch (error) {
        console.error("[getBankAccountsList] Error:", error)
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
    bankStatementBalance?: number
    notes?: string
}): Promise<{ success: boolean; reconciliationId?: string; error?: string }> {
    try {
        const recId = await withPrismaAuth(async (prisma: PrismaClient) => {
            // Capture the current GL account balance as the book balance snapshot
            const glAccount = await prisma.gLAccount.findUnique({
                where: { id: data.glAccountId },
                select: { balance: true },
            })

            const rec = await prisma.bankReconciliation.create({
                data: {
                    glAccountId: data.glAccountId,
                    statementDate: new Date(data.statementDate),
                    periodStart: new Date(data.periodStart),
                    periodEnd: new Date(data.periodEnd),
                    status: 'REC_DRAFT',
                    bankStatementBalance: data.bankStatementBalance ?? null,
                    bookBalanceSnapshot: glAccount ? Number(glAccount.balance) : null,
                    notes: data.notes ?? null,
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
 * Parse a date string in dd/mm/yyyy, yyyy-mm-dd, or other common formats.
 * Returns a valid Date or null.
 */
function parseBankDate(dateStr: string): Date | null {
    if (!dateStr) return null
    const cleaned = dateStr.trim()

    // Try dd/mm/yyyy or dd-mm-yyyy or dd.mm.yyyy (Indonesian standard)
    const ddmmyyyy = cleaned.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/)
    if (ddmmyyyy) {
        const [, day, month, year] = ddmmyyyy
        const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0)
        if (!isNaN(d.getTime())) return d
    }

    // Try yyyy-mm-dd (ISO)
    const iso = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (iso) {
        const d = new Date(parseInt(iso[1]), parseInt(iso[2]) - 1, parseInt(iso[3]), 12, 0, 0)
        if (!isNaN(d.getTime())) return d
    }

    // Fallback
    const d = new Date(cleaned)
    if (!isNaN(d.getTime())) return d

    return null
}

/**
 * Import bank statement rows into a reconciliation.
 * Atomic: if any row has an invalid date, no rows are imported.
 */
export async function importBankStatementRows(
    reconciliationId: string,
    rows: BankStatementRow[]
): Promise<{ success: boolean; importedCount?: number; error?: string }> {
    if (rows.length === 0) {
        return { success: false, error: 'Tidak ada baris untuk diimpor' }
    }

    // Validate all dates upfront (atomic — all or nothing)
    const invalidRows: number[] = []
    const parsedDates: Date[] = []
    for (let i = 0; i < rows.length; i++) {
        const d = parseBankDate(rows[i].date)
        if (!d) {
            invalidRows.push(i + 1) // 1-based row number
        } else {
            parsedDates.push(d)
        }
    }
    if (invalidRows.length > 0) {
        const rowNums = invalidRows.slice(0, 5).join(', ')
        const suffix = invalidRows.length > 5 ? ` ...dan ${invalidRows.length - 5} lainnya` : ''
        return {
            success: false,
            error: `Format tanggal tidak valid di baris ${rowNums}${suffix}. Gunakan format dd/mm/yyyy.`
        }
    }

    try {
        const count = await withPrismaAuth(async (prisma: PrismaClient) => {
            const items = rows.map((r, i) => ({
                reconciliationId,
                bankRef: r.reference || null,
                bankDescription: r.description,
                bankDate: parsedDates[i],
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
 * 3-Tier Auto-match: classify every unmatched bank item as AUTO / POTENTIAL / MANUAL.
 *
 * - AUTO (Tier 1): exact amount + name + (date|ref) → auto-apply match
 * - POTENTIAL (Tier 2): fuzzy (≤Rp6.500, similarity≥0.75, ±3 days) → suggest
 * - MANUAL (Tier 3): everything else → ranked suggestions for manual matching
 *
 * Tier metadata is persisted to BankReconciliationItem for UI badges.
 */
export async function autoMatchReconciliation(
    reconciliationId: string
): Promise<{
    success: boolean
    matched?: number
    potentialCount?: number
    manualCount?: number
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

            // Expand date range by ±30 days for MANUAL tier scoring
            const dateFrom = new Date(rec.periodStart)
            dateFrom.setDate(dateFrom.getDate() - 30)
            const dateTo = new Date(rec.periodEnd)
            dateTo.setDate(dateTo.getDate() + 30)

            // Fetch POSTED journal lines for the GL account
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
            let potentialCount = 0
            let manualCount = 0
            const suggestions: { bankItemId: string; matches: MatchResult[] }[] = []

            // Build indexed pool for O(1) exact-amount lookups
            let availablePool = [...systemTransactions]
            let txnIndex = buildTransactionIndex(availablePool)

            // Collect batch updates
            const autoUpdates: {
                id: string
                systemTransactionId: string
                best: MatchResult
            }[] = []
            const tierUpdates: {
                id: string
                tier: string
                score: number
                amountDiff: number
                nameSimilarity: number
                daysDiff: number
            }[] = []

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

                if (matches.length === 0) {
                    // No matches at all — mark as MANUAL with score 0
                    tierUpdates.push({
                        id: item.id,
                        tier: 'MANUAL',
                        score: 0,
                        amountDiff: 0,
                        nameSimilarity: 0,
                        daysDiff: 0,
                    })
                    manualCount++
                    continue
                }

                const best = matches[0]

                if (best.tier === 'AUTO') {
                    // Tier 1: Auto-apply match
                    autoUpdates.push({ id: item.id, systemTransactionId: best.transactionId, best })

                    // Remove matched transaction from pool and rebuild index
                    availablePool = availablePool.filter((t) => t.id !== best.transactionId)
                    txnIndex = buildTransactionIndex(availablePool)

                    matched++
                } else if (best.tier === 'POTENTIAL') {
                    // Tier 2: Store as suggestion with tier metadata
                    tierUpdates.push({
                        id: item.id,
                        tier: 'POTENTIAL',
                        score: best.score,
                        amountDiff: best.amountDiff,
                        nameSimilarity: best.nameSimilarity,
                        daysDiff: best.daysDiff,
                    })
                    suggestions.push({ bankItemId: item.id, matches })
                    potentialCount++
                } else {
                    // Tier 3: Manual
                    tierUpdates.push({
                        id: item.id,
                        tier: 'MANUAL',
                        score: best.score,
                        amountDiff: best.amountDiff,
                        nameSimilarity: best.nameSimilarity,
                        daysDiff: best.daysDiff,
                    })
                    suggestions.push({ bankItemId: item.id, matches })
                    manualCount++
                }
            }

            // Persist AUTO matches
            const now = new Date()
            for (const update of autoUpdates) {
                await prisma.bankReconciliationItem.update({
                    where: { id: update.id },
                    data: {
                        systemTransactionId: update.systemTransactionId,
                        matchStatus: 'MATCHED',
                        matchedBy: user?.id || null,
                        matchedAt: now,
                        matchTier: 'AUTO',
                        matchScore: 100,
                        matchAmountDiff: update.best.amountDiff,
                        matchNameSimilarity: update.best.nameSimilarity,
                        matchDaysDiff: update.best.daysDiff,
                    },
                })
            }

            // Persist tier metadata for POTENTIAL and MANUAL items
            for (const update of tierUpdates) {
                await prisma.bankReconciliationItem.update({
                    where: { id: update.id },
                    data: {
                        matchTier: update.tier,
                        matchScore: update.score,
                        matchAmountDiff: update.amountDiff,
                        matchNameSimilarity: update.nameSimilarity,
                        matchDaysDiff: update.daysDiff,
                    },
                })
            }

            // Update reconciliation status
            if (matched > 0 || potentialCount > 0) {
                await prisma.bankReconciliation.update({
                    where: { id: reconciliationId },
                    data: { status: 'REC_IN_PROGRESS' },
                })
            }

            return { matched, potentialCount, manualCount, suggestions }
        })

        return {
            success: true,
            matched: result.matched,
            potentialCount: result.potentialCount,
            manualCount: result.manualCount,
            suggestions: result.suggestions,
        }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal auto-match'
        console.error("[autoMatchReconciliation] Error:", error)
        return { success: false, error: msg }
    }
}

/**
 * Confirm a matched bank reconciliation item.
 * Sets matchStatus to CONFIRMED and writes reconciliation stamp on the matched JournalEntry.
 */
export async function confirmReconciliationItem(
    itemId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        await withPrismaAuth(async (prisma: PrismaClient) => {
            const supabase = await (await import('@/lib/supabase/server')).createClient()
            const { data: { user } } = await supabase.auth.getUser()

            const item = await prisma.bankReconciliationItem.findUnique({
                where: { id: itemId },
                include: { reconciliation: true },
            })
            if (!item) throw new Error('Item tidak ditemukan')
            if (item.matchStatus !== 'MATCHED') {
                throw new Error('Item harus berstatus MATCHED untuk dikonfirmasi')
            }
            if (!item.systemTransactionId) {
                throw new Error('Item belum dipasangkan dengan transaksi sistem')
            }

            // Update item status to CONFIRMED
            await prisma.bankReconciliationItem.update({
                where: { id: itemId },
                data: {
                    matchStatus: 'CONFIRMED',
                    matchedBy: user?.id ?? null,
                    matchedAt: new Date(),
                },
            })

            // Write reconciliation stamp on matched JournalEntry
            await prisma.journalEntry.update({
                where: { id: item.systemTransactionId },
                data: {
                    isReconciled: true,
                    reconciledAt: new Date(),
                    reconciledBy: user?.id ?? null,
                    reconciliationId: item.reconciliationId,
                    bankItemRef: item.bankRef,
                },
            })
        })
        return { success: true }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal konfirmasi item'
        console.error("[confirmReconciliationItem] Error:", error)
        return { success: false, error: msg }
    }
}

/**
 * Reject a matched bank reconciliation item.
 * Clears the match link, removes reconciliation stamp from JournalEntry,
 * and sets matchStatus back to UNMATCHED.
 */
export async function rejectReconciliationItem(
    itemId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        await withPrismaAuth(async (prisma: PrismaClient) => {
            const item = await prisma.bankReconciliationItem.findUnique({
                where: { id: itemId },
            })
            if (!item) throw new Error('Item tidak ditemukan')
            if (item.matchStatus !== 'MATCHED' && item.matchStatus !== 'CONFIRMED') {
                throw new Error('Item harus berstatus MATCHED atau CONFIRMED untuk ditolak')
            }

            // Remove stamp from JournalEntry if linked
            if (item.systemTransactionId) {
                await prisma.journalEntry.update({
                    where: { id: item.systemTransactionId },
                    data: {
                        isReconciled: false,
                        reconciledAt: null,
                        reconciledBy: null,
                        reconciliationId: null,
                        bankItemRef: null,
                    },
                })
            }

            // Reset item to UNMATCHED
            await prisma.bankReconciliationItem.update({
                where: { id: itemId },
                data: {
                    matchStatus: 'UNMATCHED',
                    systemTransactionId: null,
                    matchedBy: null,
                    matchedAt: null,
                    matchTier: null,
                    matchScore: null,
                    matchAmountDiff: null,
                    matchNameSimilarity: null,
                    matchDaysDiff: null,
                },
            })
        })
        return { success: true }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal menolak match'
        console.error("[rejectReconciliationItem] Error:", error)
        return { success: false, error: msg }
    }
}

/**
 * Ignore a bank reconciliation item (no GL match, known exception).
 * Does NOT write a journal stamp — this is a deliberate skip.
 */
export async function ignoreReconciliationItem(
    itemId: string,
    reason?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        await withPrismaAuth(async (prisma: PrismaClient) => {
            const item = await prisma.bankReconciliationItem.findUnique({
                where: { id: itemId },
            })
            if (!item) throw new Error('Item tidak ditemukan')
            if (item.matchStatus === 'CONFIRMED') {
                throw new Error('Item sudah dikonfirmasi — tolak dulu sebelum mengabaikan')
            }

            await prisma.bankReconciliationItem.update({
                where: { id: itemId },
                data: {
                    matchStatus: 'IGNORED',
                    excludeReason: reason || null,
                },
            })
        })
        return { success: true }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal mengabaikan item'
        console.error("[ignoreReconciliationItem] Error:", error)
        return { success: false, error: msg }
    }
}

/**
 * Bulk confirm all COCOK-tier matched items (score >= 95).
 * Writes reconciliation stamp on each matched JournalEntry.
 */
export async function bulkConfirmCocokItems(
    reconciliationId: string
): Promise<{ success: boolean; confirmed?: number; error?: string }> {
    try {
        const result = await withPrismaAuth(async (prisma: PrismaClient) => {
            const supabase = await (await import('@/lib/supabase/server')).createClient()
            const { data: { user } } = await supabase.auth.getUser()

            // Find all matched items with score >= 95 that haven't been confirmed yet
            const cocokItems = await prisma.bankReconciliationItem.findMany({
                where: {
                    reconciliationId,
                    matchStatus: 'MATCHED',
                    matchScore: { gte: 95 },
                    systemTransactionId: { not: null },
                },
            })

            if (cocokItems.length === 0) return { confirmed: 0 }

            const now = new Date()

            // Batch update items to CONFIRMED
            await prisma.bankReconciliationItem.updateMany({
                where: {
                    id: { in: cocokItems.map(i => i.id) },
                },
                data: {
                    matchStatus: 'CONFIRMED',
                    matchedBy: user?.id ?? null,
                    matchedAt: now,
                },
            })

            // Write stamp on each matched JournalEntry
            const journalIds = cocokItems
                .map(i => i.systemTransactionId)
                .filter((id): id is string => id !== null)

            if (journalIds.length > 0) {
                await prisma.journalEntry.updateMany({
                    where: { id: { in: journalIds } },
                    data: {
                        isReconciled: true,
                        reconciledAt: now,
                        reconciledBy: user?.id ?? null,
                        reconciliationId,
                    },
                })
            }

            return { confirmed: cocokItems.length }
        })

        return { success: true, confirmed: result.confirmed }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal konfirmasi bulk'
        console.error("[bulkConfirmCocokItems] Error:", error)
        return { success: false, error: msg }
    }
}

/** @deprecated Use bulkConfirmCocokItems instead */
export const bulkConfirmAutoMatches = bulkConfirmCocokItems

/**
 * Match multiple bank items to multiple system journal entries (checkbox multi-select).
 * User selects 1+ bank items and 1+ system entries, totals must match within Rp 1.
 */
export async function matchMultipleItems(data: {
    bankItemIds: string[]
    systemEntryIds: string[]
}): Promise<{ success: boolean; error?: string; amountDiff?: number }> {
    if (!data.bankItemIds.length || !data.systemEntryIds.length) {
        return { success: false, error: 'Pilih minimal 1 item bank dan 1 transaksi sistem' }
    }

    let amountDiff = 0

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

            // Calculate difference — allow user-initiated matches even if amounts differ
            amountDiff = Math.abs(bankTotal - systemTotal)

            // Match bank items to system entries
            // For N:1 (multiple bank items to 1 system entry) — all items get the same systemTransactionId
            // For 1:1 — straightforward single mapping
            // For N:N — pair items by index order (bank[0]→system[0], bank[1]→system[1], etc.)
            //          remaining bank items (if more) get the last system entry ID
            const now = new Date()
            const userId = user?.id || null

            if (data.systemEntryIds.length === 1) {
                // N:1 — all bank items map to the single system entry
                await prisma.bankReconciliationItem.updateMany({
                    where: { id: { in: data.bankItemIds } },
                    data: {
                        systemTransactionId: data.systemEntryIds[0],
                        matchStatus: 'MATCHED',
                        matchedBy: userId,
                        matchedAt: now,
                    },
                })
            } else {
                // 1:1 or N:N — pair bank items to system entries by index
                for (let i = 0; i < data.bankItemIds.length; i++) {
                    const sysId = data.systemEntryIds[Math.min(i, data.systemEntryIds.length - 1)]
                    await prisma.bankReconciliationItem.update({
                        where: { id: data.bankItemIds[i] },
                        data: {
                            systemTransactionId: sysId,
                            matchStatus: 'MATCHED',
                            matchedBy: userId,
                            matchedAt: now,
                        },
                    })
                }
            }
        })

        return { success: true, amountDiff }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal mencocokkan item'
        console.error("[matchMultipleItems] Error:", error)
        return { success: false, error: msg }
    }
}

/**
 * Classify a bank reconciliation item as BANK_CHARGE or INTEREST_INCOME.
 * These items will have auto-GL entries created during reconciliation finalization.
 * Sets matchStatus to MATCHED so closeReconciliation allows it (no system match needed).
 */
export async function classifyReconciliationItem(
    itemId: string,
    itemType: 'BANK_CHARGE' | 'INTEREST_INCOME'
): Promise<{ success: boolean; error?: string }> {
    try {
        await withPrismaAuth(async (prisma: PrismaClient) => {
            await prisma.bankReconciliationItem.update({
                where: { id: itemId },
                data: {
                    itemType,
                    matchStatus: 'MATCHED',
                },
            })
        })

        return { success: true }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal mengklasifikasi item'
        console.error("[classifyReconciliationItem] Error:", error)
        return { success: false, error: msg }
    }
}

/**
 * Close/complete a reconciliation.
 * Auto-creates journal entries for BANK_CHARGE and INTEREST_INCOME items.
 */
export async function closeReconciliation(
    reconciliationId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const result = await withPrismaAuth(async (prisma: PrismaClient) => {
            // Validate: all items must be MATCHED before closing
            const unmatchedCount = await prisma.bankReconciliationItem.count({
                where: {
                    reconciliationId,
                    matchStatus: { in: ['UNMATCHED', 'EXCLUDED'] },
                },
            })

            if (unmatchedCount > 0) {
                return {
                    success: false as const,
                    error: `Masih ada ${unmatchedCount} item belum dicocokkan`,
                }
            }

            // Get reconciliation with GL account info for auto-GL posting
            const rec = await prisma.bankReconciliation.findUniqueOrThrow({
                where: { id: reconciliationId },
                include: { glAccount: { select: { code: true } } },
            })
            const bankAccountCode = rec.glAccount.code

            // Find items classified as BANK_CHARGE or INTEREST_INCOME for auto-GL
            const autoGlItems = await prisma.bankReconciliationItem.findMany({
                where: {
                    reconciliationId,
                    itemType: { in: ['BANK_CHARGE', 'INTEREST_INCOME'] },
                },
            })

            // Auto-post journal entries for classified items
            if (autoGlItems.length > 0) {
                await ensureSystemAccounts()

                for (const item of autoGlItems) {
                    const amount = Math.abs(Number(item.bankAmount))
                    if (amount === 0) continue

                    const ref = await getNextJournalRef('RECON')
                    const itemDate = item.bankDate ?? rec.statementDate

                    if (item.itemType === 'BANK_CHARGE') {
                        // Bank Charge: DR Bank Charges (7200), CR Bank GL account
                        const glResult = await postJournalEntry({
                            description: `Biaya bank — rekonsiliasi ${rec.id.slice(0, 8)}${item.bankDescription ? ': ' + item.bankDescription : ''}`,
                            date: itemDate,
                            reference: ref,
                            sourceDocumentType: 'BANK_RECONCILIATION',
                            lines: [
                                { accountCode: SYS_ACCOUNTS.BANK_CHARGES, debit: amount, credit: 0, description: 'Biaya bank' },
                                { accountCode: bankAccountCode, debit: 0, credit: amount, description: 'Biaya bank' },
                            ],
                        })
                        if (!glResult.success) {
                            throw new Error(`Gagal posting jurnal biaya bank: ${'error' in glResult ? glResult.error : 'Unknown error'}`)
                        }
                    } else if (item.itemType === 'INTEREST_INCOME') {
                        // Interest Income: DR Bank GL account, CR Interest Income (4400)
                        const glResult = await postJournalEntry({
                            description: `Pendapatan bunga — rekonsiliasi ${rec.id.slice(0, 8)}${item.bankDescription ? ': ' + item.bankDescription : ''}`,
                            date: itemDate,
                            reference: ref,
                            sourceDocumentType: 'BANK_RECONCILIATION',
                            lines: [
                                { accountCode: bankAccountCode, debit: amount, credit: 0, description: 'Pendapatan bunga' },
                                { accountCode: SYS_ACCOUNTS.INTEREST_INCOME, debit: 0, credit: amount, description: 'Pendapatan bunga' },
                            ],
                        })
                        if (!glResult.success) {
                            throw new Error(`Gagal posting jurnal pendapatan bunga: ${'error' in glResult ? glResult.error : 'Unknown error'}`)
                        }
                    }
                }
            }

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

            return { success: true as const }
        })

        if (!result.success) {
            return { success: false, error: result.error }
        }

        return { success: true }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal menutup rekonsiliasi'
        console.error("[closeReconciliation] Error:", error)
        return { success: false, error: msg }
    }
}

/**
 * Update reconciliation metadata (bank statement balance and notes).
 */
export async function updateReconciliationMeta(
    reconciliationId: string,
    data: { bankStatementBalance?: number; notes?: string }
): Promise<{ success: boolean; error?: string }> {
    try {
        await withPrismaAuth(async (prisma: PrismaClient) => {
            const updateData: Record<string, unknown> = {}
            if (data.bankStatementBalance !== undefined) {
                updateData.bankStatementBalance = data.bankStatementBalance
            }
            if (data.notes !== undefined) {
                updateData.notes = data.notes
            }

            await prisma.bankReconciliation.update({
                where: { id: reconciliationId },
                data: updateData,
            })
        })

        return { success: true }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal memperbarui rekonsiliasi'
        console.error("[updateReconciliationMeta] Error:", error)
        return { success: false, error: msg }
    }
}

// REMOVED: excludeReconciliationItem and includeReconciliationItem
// EXCLUDED status is deprecated — bank recon no longer supports excluding items.

// ==============================================================================
// Search + Inline Journal Creation
// ==============================================================================

export interface SearchJournalResult {
    entryId: string
    date: string
    description: string
    reference: string | null
    amount: number
    lineDescription: string | null
}

/**
 * Search unmatched journal entries for a reconciliation session.
 * Filters out already-matched entries and searches by description, reference, or account name.
 */
export async function searchUnmatchedJournals(
    reconciliationId: string,
    query: string,
    bankItemContext?: { bankAmount: number; bankDate: string | null }
): Promise<SearchJournalResult[]> {
    try {
        await requireAuth()

        if (!query || query.length < 2) return []

        const rec = await prisma.bankReconciliation.findUnique({
            where: { id: reconciliationId },
            select: { glAccountId: true, periodStart: true, periodEnd: true },
        })
        if (!rec) return []

        // Get already-matched entry IDs to exclude
        const matchedItems = await prisma.bankReconciliationItem.findMany({
            where: {
                reconciliationId,
                matchStatus: 'MATCHED',
                systemTransactionId: { not: null },
            },
            select: { systemTransactionId: true },
        })
        const excludeEntryIds = matchedItems
            .map((i) => i.systemTransactionId)
            .filter(Boolean) as string[]

        // Expand date range by ±30 days for broader search
        const dateFrom = new Date(rec.periodStart)
        dateFrom.setDate(dateFrom.getDate() - 30)
        const dateTo = new Date(rec.periodEnd)
        dateTo.setDate(dateTo.getDate() + 30)

        // Search journal lines that belong to this GL account
        const journalLines = await prisma.journalLine.findMany({
            where: {
                accountId: rec.glAccountId,
                entry: {
                    status: 'POSTED',
                    date: { gte: dateFrom, lte: dateTo },
                    id: excludeEntryIds.length > 0 ? { notIn: excludeEntryIds } : undefined,
                    OR: [
                        { description: { contains: query, mode: 'insensitive' as const } },
                        { reference: { contains: query, mode: 'insensitive' as const } },
                    ],
                },
            },
            select: {
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
            take: 15,
        })

        // De-duplicate by entry ID
        const seen = new Set<string>()
        const results: SearchJournalResult[] = []

        for (const line of journalLines) {
            if (seen.has(line.entryId)) continue
            seen.add(line.entryId)

            const debit = Number(line.debit)
            const credit = Number(line.credit)
            const amount = debit > 0 ? debit : -credit

            results.push({
                entryId: line.entryId,
                date: line.entry.date.toISOString(),
                description: line.entry.description,
                reference: line.entry.reference,
                amount,
                lineDescription: line.description,
            })
        }

        // Per-transaction filter when bank item context is available
        if (bankItemContext) {
            const bankAbsAmount = Math.abs(bankItemContext.bankAmount)
            const bankIsKeluar = bankItemContext.bankAmount < 0
            const tolerance = Math.max(bankAbsAmount * 0.10, 10_000)
            const bankDateMs = bankItemContext.bankDate ? new Date(bankItemContext.bankDate).getTime() : null

            return results.filter(r => {
                // Direction gate
                if (bankIsKeluar && r.amount > 0) return false
                if (!bankIsKeluar && r.amount < 0) return false

                // Amount tolerance
                if (Math.abs(Math.abs(r.amount) - bankAbsAmount) > tolerance) return false

                // Date proximity (±30 days)
                if (bankDateMs) {
                    const diffMs = Math.abs(new Date(r.date).getTime() - bankDateMs)
                    if (diffMs > 30 * 86_400_000) return false
                }

                return true
            })
        }

        return results
    } catch (error) {
        console.error("[searchUnmatchedJournals] Error:", error)
        return []
    }
}

/**
 * Create a journal entry and immediately match it to a bank reconciliation item.
 * Atomic: if journal creation or matching fails, both are rolled back.
 *
 * Finance guardrail: uses postJournalEntry() for balanced double-entry.
 */
export async function createJournalAndMatch(
    reconciliationId: string,
    bankLineId: string,
    journalData: {
        date: string // ISO date string
        description: string
        reference?: string
        amount: number // always positive
        debitAccountCode: string
        creditAccountCode: string
    }
): Promise<{ success: boolean; journalId?: string; error?: string }> {
    try {
        const result = await withPrismaAuth(async (prisma: PrismaClient) => {
            // Validate the bank line exists and is unmatched
            const bankItem = await prisma.bankReconciliationItem.findUnique({
                where: { id: bankLineId },
                select: { id: true, matchStatus: true, reconciliationId: true },
            })
            if (!bankItem) throw new Error('Item bank tidak ditemukan')
            if (bankItem.reconciliationId !== reconciliationId) throw new Error('Item bukan milik rekonsiliasi ini')
            if (bankItem.matchStatus === 'MATCHED') throw new Error('Item sudah dicocokkan')

            const amount = Math.abs(journalData.amount)
            if (amount === 0) throw new Error('Jumlah tidak boleh nol')

            // Ensure system accounts exist
            await ensureSystemAccounts()

            // Generate reference
            const ref = journalData.reference || await getNextJournalRef('RECON')

            // Create balanced journal entry via postJournalEntry
            const jeResult = await postJournalEntry({
                description: journalData.description,
                date: new Date(journalData.date),
                reference: ref,
                sourceDocumentType: 'BANK_RECONCILIATION',
                lines: [
                    {
                        accountCode: journalData.debitAccountCode,
                        debit: amount,
                        credit: 0,
                        description: journalData.description,
                    },
                    {
                        accountCode: journalData.creditAccountCode,
                        debit: 0,
                        credit: amount,
                        description: journalData.description,
                    },
                ],
            }, prisma) // Pass prisma client for transactional safety

            if (!jeResult || !jeResult.success) {
                const errMsg = jeResult && 'error' in jeResult ? (jeResult as { error: string }).error : 'Gagal membuat jurnal'
                throw new Error(errMsg)
            }

            const journalId = 'journalEntryId' in jeResult
                ? (jeResult as { journalEntryId: string }).journalEntryId
                : null

            if (!journalId) throw new Error('Journal entry ID tidak ditemukan')

            // Immediately match the bank item to this journal
            const supabase = await (await import('@/lib/supabase/server')).createClient()
            const { data: { user } } = await supabase.auth.getUser()

            await prisma.bankReconciliationItem.update({
                where: { id: bankLineId },
                data: {
                    systemTransactionId: journalId,
                    matchStatus: 'MATCHED',
                    matchedBy: user?.id || null,
                    matchedAt: new Date(),
                    matchTier: 'MANUAL',
                    matchScore: 100,
                },
            })

            return { journalId }
        })

        return { success: true, journalId: result.journalId }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal membuat jurnal & mencocokkan'
        console.error("[createJournalAndMatch] Error:", error)
        return { success: false, error: msg }
    }
}
