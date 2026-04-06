'use server'

import { InvoiceStatus, InvoiceType } from "@prisma/client"
import { withPrismaAuth, prisma as basePrisma } from "@/lib/db"
import { supabase } from "@/lib/supabase"
import { createClient } from "@/lib/supabase/server"
import { logAudit } from "@/lib/audit-helpers"
import { SYS_ACCOUNTS, ensureSystemAccounts } from "@/lib/gl-accounts-server"
import { assertPeriodOpen } from "@/lib/period-helpers"
import { legacyTermToDays, calculateDueDate } from "@/lib/payment-term-helpers"
import { inferSubType } from "@/lib/account-subtype-helpers"
import { getExchangeRate, convertToIDR } from "@/lib/currency-helpers"
import { TAX_RATES } from "@/lib/tax-rates"
import { toNum } from "@/lib/utils"

export interface FinancialMetrics {
    cashBalance: number
    receivables: number // Piutang
    payables: number    // Hutang
    netMargin: number   // %
    revenue: number
    burnRate: number
    overdueInvoices: any[] // List of overdue customer invoices
    upcomingPayables: any[] // List of supplier invoices due soon
    status: {
        cash: 'Healthy' | 'Low' | 'Critical'
        margin: 'Healthy' | 'Low' | 'Critical'
    }
}

export interface InvoiceKanbanItem {
    id: string
    number: string
    partyName: string
    amount: number
    issueDate: Date
    dueDate: Date
    status: InvoiceStatus
    type: InvoiceType
    daysOverdue?: number
}

export interface InvoiceKanbanData {
    draft: InvoiceKanbanItem[]
    sent: InvoiceKanbanItem[]
    overdue: InvoiceKanbanItem[]
    paid: InvoiceKanbanItem[]
}

export async function getFinancialMetrics(): Promise<FinancialMetrics> {
    try {
        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        startOfMonth.setHours(0, 0, 0, 0)

        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

        const now = new Date()

        // Helper to convert Prisma Decimal to number
        const toNum = (val: any): number => {
            if (val == null) return 0
            if (typeof val === 'number') return val
            if (typeof val.toNumber === 'function') return val.toNumber()
            return Number(val) || 0
        }

        // 1. Expense Account IDs (needed for burn rate query)
        const expenseAccounts = await basePrisma.gLAccount.findMany({
            where: { type: 'EXPENSE' },
            select: { id: true },
        })
        const expenseAccountIds = expenseAccounts.map(a => a.id)

        const openStatuses: InvoiceStatus[] = ['ISSUED', 'PARTIAL', 'OVERDUE']

        // Parallel Fetching
        const [
            arAgg,
            overdueInvoices,
            apAgg,
            upcomingPayables,
            cashAccounts,
            burnLines,
            revenueAgg,
            expenseAgg,
            paidInAgg,
            paidOutAgg,
        ] = await Promise.all([
            // 1. Receivables (All OUT invoices that are OPEN)
            basePrisma.invoice.aggregate({
                _sum: { balanceDue: true },
                where: { type: 'INV_OUT', status: { in: openStatuses } },
            }),

            // 2. Overdue Invoices (top 3)
            basePrisma.invoice.findMany({
                where: {
                    type: 'INV_OUT',
                    status: { in: openStatuses },
                    dueDate: { lt: now },
                },
                include: { customer: { select: { name: true } } },
                orderBy: { dueDate: 'asc' },
                take: 3,
            }),

            // 3. Payables
            basePrisma.invoice.aggregate({
                _sum: { balanceDue: true },
                where: { type: 'INV_IN', status: { in: openStatuses } },
            }),

            // 4. Upcoming Payables (top 3)
            basePrisma.invoice.findMany({
                where: {
                    type: 'INV_IN',
                    status: { in: openStatuses },
                    dueDate: { gte: now },
                },
                include: { supplier: { select: { name: true } } },
                orderBy: { dueDate: 'asc' },
                take: 3,
            }),

            // 5. Cash Balance — cash/bank ASSET accounts (10xx: 1000 Kas, 1010 BCA, 1020 Mandiri, 1050 Petty Cash)
            basePrisma.gLAccount.findMany({
                where: { type: 'ASSET', code: { gte: '1000', lt: '1100' } },
                select: { balance: true, code: true },
            }),

            // 6. Burn Rate (Expenses last 30 days) — journal lines with debit on expense accounts
            expenseAccountIds.length > 0
                ? basePrisma.journalLine.findMany({
                    where: {
                        accountId: { in: expenseAccountIds },
                        entry: { date: { gte: thirtyDaysAgo } },
                    },
                    select: { debit: true },
                })
                : Promise.resolve([]),

            // 7. Revenue (This Month)
            basePrisma.invoice.aggregate({
                _sum: { totalAmount: true },
                where: {
                    type: 'INV_OUT',
                    issueDate: { gte: startOfMonth },
                    status: { not: 'CANCELLED' },
                },
            }),

            // 8. Expenses (This Month)
            basePrisma.invoice.aggregate({
                _sum: { totalAmount: true },
                where: {
                    type: 'INV_IN',
                    issueDate: { gte: startOfMonth },
                    status: { not: 'CANCELLED' },
                },
            }),

            // 9. Paid IN (cash received from customers) — fallback for KAS when GL is empty
            basePrisma.invoice.aggregate({
                _sum: { totalAmount: true },
                where: { type: 'INV_OUT', status: 'PAID' },
            }),

            // 10. Paid OUT (cash paid to suppliers) — fallback for KAS when GL is empty
            basePrisma.invoice.aggregate({
                _sum: { totalAmount: true },
                where: { type: 'INV_IN', status: 'PAID' },
            }),
        ])

        // Aggregations
        const receivables = toNum(arAgg._sum.balanceDue)
        const payables = toNum(apAgg._sum.balanceDue)
        const cashFromGL = cashAccounts.reduce((sum, a) => sum + toNum(a.balance), 0)

        // Revenue & Expenses (This Month)
        const revVal = toNum(revenueAgg._sum.totalAmount)
        const expVal = toNum(expenseAgg._sum.totalAmount)

        // Cash balance from GL is the single source of truth
        // Only fall back to paid invoices if NO cash GL accounts exist at all
        const cashFromPaidIn = toNum(paidInAgg._sum.totalAmount)
        const cashFromPaidOut = toNum(paidOutAgg._sum.totalAmount)
        const cashFromPaid = cashFromPaidIn - cashFromPaidOut
        const cashBal = cashAccounts.length > 0 ? cashFromGL : (cashFromPaid > 0 ? cashFromPaid : Math.max(0, revVal - receivables))

        // Burn Rate — try journal-based first, fallback to expense invoices (INV_IN) last 30 days
        const burnFromJournals = (burnLines as any[]).reduce((sum: number, item: any) => sum + toNum(item.debit), 0)
        // If no journal-based burn, compute from expense invoices (INV_IN)
        const burnFromInvoices = expVal
        const burnTotal = burnFromJournals > 0 ? burnFromJournals : burnFromInvoices
        const burnRate = burnTotal / 30

        const margin = revVal > 0 ? ((revVal - expVal) / revVal) * 100 : 0

        // Mapping Lists — convert Prisma Decimal fields to plain numbers
        const mapInvoice = (inv: any) => ({
            ...inv,
            subtotal: toNum(inv.subtotal),
            taxAmount: toNum(inv.taxAmount),
            discountAmount: toNum(inv.discountAmount),
            totalAmount: toNum(inv.totalAmount),
            balanceDue: toNum(inv.balanceDue),
            exchangeRate: toNum(inv.exchangeRate),
            amountInIDR: toNum(inv.amountInIDR),
            customer: inv.customer?.name ?? inv.customer ?? null,
            supplier: typeof inv.supplier === 'object' ? inv.supplier?.name ?? null : inv.supplier ?? null,
        })

        return {
            cashBalance: cashBal,
            receivables,
            payables,
            netMargin: Number(margin.toFixed(1)),
            revenue: revVal,
            burnRate,
            overdueInvoices: overdueInvoices.map(mapInvoice),
            upcomingPayables: upcomingPayables.map(mapInvoice),
            status: {
                cash: cashBal > 100000000 ? 'Healthy' : 'Low',
                margin: margin > 10 ? 'Healthy' : 'Low',
            },
        }

    } catch (error) {
        console.error("Failed to fetch financial metrics:", error)
        return {
            cashBalance: 0,
            receivables: 0,
            payables: 0,
            netMargin: 0,
            revenue: 0,
            burnRate: 0,
            overdueInvoices: [],
            upcomingPayables: [],
            status: { cash: 'Critical', margin: 'Critical' },
        }
    }
}

export async function getInvoiceKanbanData(): Promise<InvoiceKanbanData> {
    return withPrismaAuth(async (prisma) => {
        const invoices = await prisma.invoice.findMany({
            where: { type: 'INV_OUT' }, // Only Customer Invoices (AR)
            include: {
                customer: { select: { name: true } },
                supplier: { select: { name: true } },
            },
            orderBy: { issueDate: 'desc' },
            take: 200,
        })

        const now = new Date()
        const data: InvoiceKanbanData = { draft: [], sent: [], overdue: [], paid: [] }

        for (const inv of invoices) {
            const partyName = inv.customer?.name || inv.supplier?.name || 'Unknown'
            const amount = Number(inv.totalAmount || 0)
            const dueDate = inv.dueDate
            const issueDate = inv.issueDate

            const base: InvoiceKanbanItem = {
                id: inv.id,
                number: inv.number,
                partyName,
                amount,
                issueDate,
                dueDate,
                status: inv.status,
                type: inv.type,
            }

            if (inv.status === 'DRAFT') {
                data.draft.push(base)
                continue
            }

            if (inv.status === 'PAID') {
                data.paid.push(base)
                continue
            }

            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
            const isOverdue = inv.status === 'OVERDUE' || dueDate < todayStart
            if (isOverdue) {
                const daysOver = Math.max(0, Math.ceil((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)))
                data.overdue.push({ ...base, daysOverdue: daysOver })
            } else {
                data.sent.push(base)
            }
        }

        return data
    })
}

export async function getInvoiceCustomers(): Promise<Array<{ id: string; name: string; type: 'CUSTOMER' | 'SUPPLIER' }>> {
    return withPrismaAuth(async (prisma) => {
        const [customers, suppliers] = await Promise.all([
            prisma.customer.findMany({
                select: { id: true, name: true },
                where: { isActive: true },
                orderBy: { name: 'asc' },
                take: 100,
            }),
            prisma.supplier.findMany({
                select: { id: true, name: true },
                where: { isActive: true },
                orderBy: { name: 'asc' },
                take: 100,
            })
        ])

        return [
            ...customers.map(c => ({ ...c, type: 'CUSTOMER' as const })),
            ...suppliers.map(s => ({ ...s, type: 'SUPPLIER' as const }))
        ]
    })
}

export async function getGLAccounts() {
    try {
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

// ==========================================
// JOURNAL ENTRY SYSTEM (CORE)
// ==========================================

export async function postJournalEntry(data: {
    description: string
    date: Date
    reference: string
    sourceDocumentType?: string
    lines: {
        accountCode: string
        debit: number
        credit: number
        description?: string
    }[]
}) {
    try {
        // 1. Validate Balance (Debit must equal Credit)
        const totalDebit = data.lines.reduce((sum, line) => sum + line.debit, 0)
        const totalCredit = data.lines.reduce((sum, line) => sum + line.credit, 0)

        if (Math.abs(totalDebit - totalCredit) > 0.01) {
            throw new Error(`Unbalanced Journal: Debit (${totalDebit}) != Credit (${totalCredit})`)
        }

        // Period lock check
        await assertPeriodOpen(data.date)

        return await withPrismaAuth(async (prisma) => {
            // 2. Fetch Account IDs
            const codes = data.lines.map(l => l.accountCode)
            const accounts = await prisma.gLAccount.findMany({
                where: { code: { in: codes } }
            })

            const accountMap = new Map(accounts.map(a => [a.code, a]))

            // Block manual journal entries from posting to control accounts
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

            // 3. Create Entry & Lines — relation connect for Prisma 6
            const _entry = await prisma.journalEntry.create({
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
                                account: { connect: { id: account.id } },
                                debit: line.debit,
                                credit: line.credit,
                                description: line.description || data.description
                            }
                        })
                    }
                }
            })

            // Audit trail
            try {
                const sbClient = await createClient()
                const { data: { user: authUser } } = await sbClient.auth.getUser()
                if (authUser) {
                    await logAudit(prisma, {
                        entityType: "JournalEntry",
                        entityId: _entry.id,
                        action: "CREATE",
                        userId: authUser.id,
                        userName: authUser.email || undefined,
                    })
                }
            } catch { /* audit is best-effort */ }

            // Update Account Balances
            for (const line of data.lines) {
                const account = accountMap.get(line.accountCode)!
                let balanceChange = 0

                if (['ASSET', 'EXPENSE'].includes(account.type)) {
                    balanceChange = line.debit - line.credit
                } else {
                    balanceChange = line.credit - line.debit
                }

                await prisma.gLAccount.update({
                    where: { id: account.id },
                    data: { balance: { increment: balanceChange } }
                })
            }

            return { success: true }
        })
    } catch (error: any) {
        console.error("Journal Posting Error:", error)
        return { success: false, error: error?.message || "Failed to post journal entry" }
    }
}

function parseDateInput(date?: Date | string): Date | undefined {
    if (!date) return undefined
    if (date instanceof Date) return date
    const parsed = new Date(date)
    if (Number.isNaN(parsed.getTime())) return undefined
    return parsed
}

export interface ProfitLossData {
    revenue: number
    costOfGoodsSold: number
    grossProfit: number
    operatingExpenses: {
        category: string
        amount: number
        code?: string
    }[]
    totalOperatingExpenses: number
    operatingIncome: number
    otherIncome: number
    otherExpenses: number
    /** Depreciation total (subset of operatingExpenses, separated for display) */
    depreciation?: number
    netIncomeBeforeTax: number
    taxExpense: number
    netIncome: number
    period: {
        startDate: string
        endDate: string
    }
}

export async function getProfitLossStatement(startDate?: Date | string, endDate?: Date | string): Promise<ProfitLossData> {
    try {
        const start = parseDateInput(startDate) || new Date(new Date().getFullYear(), 0, 1)
        const end = parseDateInput(endDate) || new Date()

        const startIso = start.toISOString()
        const endIso = end.toISOString()

        const supabaseClient = await createClient()
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
        if (authError || !user) throw new Error('Unauthorized')

            // Fetch journal lines with accounts (include subType for P&L grouping)
            const journalLines = await (basePrisma.journalLine.findMany({
                where: {
                    entry: {
                        date: {
                            gte: start,
                            lte: end
                        },
                        status: 'POSTED'
                    }
                },
                include: {
                    account: { select: { id: true, code: true, name: true, type: true, subType: true } },
                    entry: true
                }
            }) as any)
            // Calculate by account type
            let revenue = 0
            let costOfGoodsSold = 0
            const operatingExpenses: { category: string; amount: number; code?: string }[] = []
            let otherIncome = 0
            const otherExpenses = 0
            let depreciation = 0

            // Group expenses by account
            const expenseMap = new Map<string, { amount: number; code: string }>()

            for (const line of journalLines) {
                const account = line.account
                const amount = Number(line.debit) - Number(line.credit)

                // Normal balance logic
                const normalBalance = ['ASSET', 'EXPENSE'].includes(account.type) ? 'DEBIT' : 'CREDIT'
                const effectiveAmount = normalBalance === 'DEBIT' ? amount : -amount

                // Resolve subType (prefer DB value, fall back to code-based inference)
                const st = account.subType && account.subType !== 'GENERAL'
                    ? account.subType
                    : inferSubType(account.code)

                switch (account.type) {
                    case 'REVENUE':
                        if (st === 'INCOME_OTHER') {
                            otherIncome += effectiveAmount
                        } else {
                            revenue += effectiveAmount
                        }
                        break
                    case 'EXPENSE':
                        if (st === 'EXPENSE_DIRECT_COST') {
                            costOfGoodsSold += effectiveAmount
                        } else if (st === 'EXPENSE_DEPRECIATION') {
                            depreciation += effectiveAmount
                        } else {
                            // Operating expenses — show each account by name
                            const current = expenseMap.get(account.name) || { amount: 0, code: account.code }
                            expenseMap.set(account.name, { amount: current.amount + effectiveAmount, code: current.code })
                        }
                        break
                }
            }

            // Convert expense map to array, sorted by amount descending
            expenseMap.forEach(({ amount, code }, category) => {
                if (amount > 0) {
                    operatingExpenses.push({ category, amount, code })
                }
            })
            // Add depreciation as a separate line within operating expenses
            if (depreciation > 0) {
                operatingExpenses.push({ category: 'Beban Penyusutan', amount: depreciation, code: 'DEPR' })
            }
            operatingExpenses.sort((a, b) => b.amount - a.amount)

            const totalOperatingExpenses = operatingExpenses.reduce((sum, exp) => sum + exp.amount, 0)
            const grossProfit = revenue - costOfGoodsSold
            const operatingIncome = grossProfit - totalOperatingExpenses
            const netIncomeBeforeTax = operatingIncome + otherIncome - otherExpenses
            const taxExpense = netIncomeBeforeTax > 0 ? netIncomeBeforeTax * TAX_RATES.CORPORATE : 0
            const netIncome = netIncomeBeforeTax - taxExpense

            return {
                revenue,
                costOfGoodsSold,
                grossProfit,
                operatingExpenses,
                totalOperatingExpenses,
                operatingIncome,
                otherIncome,
                otherExpenses,
                depreciation,
                netIncomeBeforeTax,
                taxExpense,
                netIncome,
                period: {
                    startDate: startIso,
                    endDate: endIso
                }
            }
    } catch (error) {
        console.error("Failed to fetch P&L:", error)
        return {
            revenue: 0,
            costOfGoodsSold: 0,
            grossProfit: 0,
            operatingExpenses: [],
            totalOperatingExpenses: 0,
            operatingIncome: 0,
            otherIncome: 0,
            otherExpenses: 0,
            depreciation: 0,
            netIncomeBeforeTax: 0,
            taxExpense: 0,
            netIncome: 0,
            period: { startDate: '', endDate: '' }
        }
    }
}

export interface BalanceSheetData {
    assets: {
        currentAssets: { code: string; name: string; amount: number }[]
        fixedAssets: { code: string; name: string; amount: number }[]
        otherAssets: { code: string; name: string; amount: number }[]
        totalCurrentAssets: number
        totalFixedAssets: number
        totalOtherAssets: number
        totalAssets: number
    }
    liabilities: {
        currentLiabilities: { code: string; name: string; amount: number }[]
        longTermLiabilities: { code: string; name: string; amount: number }[]
        totalCurrentLiabilities: number
        totalLongTermLiabilities: number
        totalLiabilities: number
    }
    equity: {
        capital: { code: string; name: string; amount: number }[]
        retainedEarnings: number
        currentYearNetIncome: number
        totalEquity: number
    }
    totalLiabilitiesAndEquity: number
    balanceCheck?: { assets: number; liabilitiesAndEquity: number; difference: number; isBalanced: boolean }
    asOfDate: string
}

export async function getBalanceSheet(asOfDate?: Date | string): Promise<BalanceSheetData> {
    try {
        const date = parseDateInput(asOfDate) || new Date()

        const supabaseClient = await createClient()
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
        if (authError || !user) throw new Error('Unauthorized')

        // ═══════════════════════════════════════════════════════════════
        // SINGLE-QUERY APPROACH: fetch ALL accounts + journal lines once,
        // then derive everything from one consistent dataset.
        // This GUARANTEES the balance sheet balances (Assets = L + E)
        // because we use the same data for both sides.
        // ═══════════════════════════════════════════════════════════════

        // Step 1: Auto-fix misclassified accounts based on Indonesian COA code ranges
        const expectedType = (code: string): "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE" | null => {
            if (code >= '1000' && code < '2000') return 'ASSET'
            if (code >= '2000' && code < '3000') return 'LIABILITY'
            if (code >= '3000' && code < '4000') return 'EQUITY'
            if (code >= '4000' && code < '5000') return 'REVENUE'
            if (code >= '5000' && code < '9000') return 'EXPENSE'
            return null
        }
        const misclassified = await basePrisma.gLAccount.findMany({
            where: { OR: [
                { code: { gte: '5000', lt: '9000' }, type: { not: 'EXPENSE' } },
                { code: { gte: '4000', lt: '5000' }, type: { not: 'REVENUE' } },
                { code: { gte: '1000', lt: '2000' }, type: { not: 'ASSET' } },
                { code: { gte: '2000', lt: '3000' }, type: { not: 'LIABILITY' } },
                { code: { gte: '3000', lt: '4000' }, type: { not: 'EQUITY' } },
            ]},
            select: { id: true, code: true, type: true },
        })
        for (const acc of misclassified) {
            const correct = expectedType(acc.code)
            if (correct && correct !== acc.type) {
                console.warn(`[Neraca] Auto-fixing account ${acc.code}: ${acc.type} → ${correct}`)
                await basePrisma.gLAccount.update({ where: { id: acc.id }, data: { type: correct } })
            }
        }

        // Step 2: Fetch ALL accounts (all 5 types) with journal lines up to asOfDate
        // Include subType for finer grouping (Aset Lancar vs Tetap, Kewajiban Lancar vs Jk Panjang, etc.)
        const allAccounts = await basePrisma.gLAccount.findMany({
            select: {
                id: true, code: true, name: true, type: true, subType: true, balance: true,
                lines: {
                    where: {
                        entry: { date: { lte: date }, status: 'POSTED' }
                    },
                    select: { debit: true, credit: true, entry: { select: { date: true } } }
                }
            },
            orderBy: { code: 'asc' }
        })

        const currentYear = date.getFullYear()
        const currentYearStart = new Date(currentYear, 0, 1)

        const assets = {
            currentAssets: [] as { code: string; name: string; amount: number }[],
            fixedAssets: [] as { code: string; name: string; amount: number }[],
            otherAssets: [] as { code: string; name: string; amount: number }[],
            totalCurrentAssets: 0,
            totalFixedAssets: 0,
            totalOtherAssets: 0,
            totalAssets: 0
        }

        const liabilities = {
            currentLiabilities: [] as { code: string; name: string; amount: number }[],
            longTermLiabilities: [] as { code: string; name: string; amount: number }[],
            totalCurrentLiabilities: 0,
            totalLongTermLiabilities: 0,
            totalLiabilities: 0
        }

        const equity = {
            capital: [] as { code: string; name: string; amount: number }[],
            retainedEarnings: 0,
            currentYearNetIncome: 0,
            totalEquity: 0
        }

        // Step 3: Process ALL accounts from the SAME dataset
        for (const account of allAccounts) {
            const allLines = account.lines
            if (allLines.length === 0) continue

            // Use effective type based on code range (not DB type, which might be stale)
            const effectiveType = expectedType(account.code) || account.type

            switch (effectiveType) {
                case 'ASSET': {
                    const dr = allLines.reduce((s, l) => s + Number(l.debit), 0)
                    const cr = allLines.reduce((s, l) => s + Number(l.credit), 0)
                    const balance = dr - cr // ASSET normal = DEBIT
                    if (Math.abs(balance) < 0.01) break

                    // Use subType for classification (falls back to code range via inferSubType)
                    const st = account.subType && account.subType !== 'GENERAL'
                        ? account.subType
                        : inferSubType(account.code)

                    const CURRENT_ASSET_SUBTYPES = ['ASSET_CASH', 'ASSET_RECEIVABLE', 'ASSET_CURRENT', 'ASSET_PREPAYMENTS']
                    if (CURRENT_ASSET_SUBTYPES.includes(st)) {
                        assets.currentAssets.push({ code: account.code, name: account.name, amount: balance })
                        assets.totalCurrentAssets += balance
                    } else if (st === 'ASSET_FIXED') {
                        assets.fixedAssets.push({ code: account.code, name: account.name, amount: balance })
                        assets.totalFixedAssets += balance
                    } else {
                        // ASSET_NON_CURRENT or any unrecognized asset subType
                        assets.otherAssets.push({ code: account.code, name: account.name, amount: balance })
                        assets.totalOtherAssets += balance
                    }
                    break
                }

                case 'LIABILITY': {
                    const dr = allLines.reduce((s, l) => s + Number(l.debit), 0)
                    const cr = allLines.reduce((s, l) => s + Number(l.credit), 0)
                    const balance = cr - dr // LIABILITY normal = CREDIT
                    if (Math.abs(balance) < 0.01) break

                    const lst = account.subType && account.subType !== 'GENERAL'
                        ? account.subType
                        : inferSubType(account.code)

                    if (lst === 'LIABILITY_PAYABLE' || lst === 'LIABILITY_CURRENT') {
                        liabilities.currentLiabilities.push({ code: account.code, name: account.name, amount: balance })
                        liabilities.totalCurrentLiabilities += balance
                    } else {
                        // LIABILITY_NON_CURRENT or any unrecognized liability subType
                        liabilities.longTermLiabilities.push({ code: account.code, name: account.name, amount: balance })
                        liabilities.totalLongTermLiabilities += balance
                    }
                    break
                }

                case 'EQUITY': {
                    const dr = allLines.reduce((s, l) => s + Number(l.debit), 0)
                    const cr = allLines.reduce((s, l) => s + Number(l.credit), 0)
                    const balance = cr - dr // EQUITY normal = CREDIT
                    if (Math.abs(balance) < 0.01) break

                    equity.capital.push({ code: account.code, name: account.name, amount: balance })
                    break
                }

                case 'REVENUE': {
                    // Split into prior-year retained earnings vs current-year income
                    const priorLines = allLines.filter(l => new Date(l.entry.date) < currentYearStart)
                    const currentLines = allLines.filter(l => new Date(l.entry.date) >= currentYearStart)

                    // Revenue normal = CREDIT → income = CR - DR
                    const priorIncome = priorLines.reduce((s, l) => s + Number(l.credit) - Number(l.debit), 0)
                    const currentIncome = currentLines.reduce((s, l) => s + Number(l.credit) - Number(l.debit), 0)

                    equity.retainedEarnings += priorIncome
                    equity.currentYearNetIncome += currentIncome
                    break
                }

                case 'EXPENSE': {
                    // Split into prior-year retained earnings vs current-year income
                    const priorLines = allLines.filter(l => new Date(l.entry.date) < currentYearStart)
                    const currentLines = allLines.filter(l => new Date(l.entry.date) >= currentYearStart)

                    // Expense normal = DEBIT → reduces income = -(DR - CR)
                    const priorExpense = priorLines.reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0)
                    const currentExpense = currentLines.reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0)

                    equity.retainedEarnings -= priorExpense
                    equity.currentYearNetIncome -= currentExpense
                    break
                }
            }
        }

        // Step 4: Compute totals
        assets.totalAssets = assets.totalCurrentAssets + assets.totalFixedAssets + assets.totalOtherAssets
        liabilities.totalLiabilities = liabilities.totalCurrentLiabilities + liabilities.totalLongTermLiabilities
        equity.totalEquity = equity.capital.reduce((sum, c) => sum + c.amount, 0) + equity.retainedEarnings + equity.currentYearNetIncome

        const totalLiabilitiesAndEquity = liabilities.totalLiabilities + equity.totalEquity

        return {
            assets,
            liabilities,
            equity,
            totalLiabilitiesAndEquity,
            balanceCheck: {
                assets: assets.totalAssets,
                liabilitiesAndEquity: totalLiabilitiesAndEquity,
                difference: Math.round((assets.totalAssets - totalLiabilitiesAndEquity) * 100) / 100,
                isBalanced: Math.abs(assets.totalAssets - totalLiabilitiesAndEquity) < 1
            },
            asOfDate: date.toISOString()
        }
    } catch (error) {
        console.error("Failed to fetch Balance Sheet:", error)
        return {
            assets: {
                currentAssets: [], fixedAssets: [], otherAssets: [],
                totalCurrentAssets: 0, totalFixedAssets: 0, totalOtherAssets: 0, totalAssets: 0
            },
            liabilities: {
                currentLiabilities: [], longTermLiabilities: [],
                totalCurrentLiabilities: 0, totalLongTermLiabilities: 0, totalLiabilities: 0
            },
            equity: { capital: [], retainedEarnings: 0, currentYearNetIncome: 0, totalEquity: 0 },
            totalLiabilitiesAndEquity: 0,
            asOfDate: ''
        }
    }
}

export interface CFSLineItem {
    description: string
    amount: number
    // Presentation mode controls bracket/sign logic in UI
    // AS_IS | INFLOW_POSITIVE | OUTFLOW_BRACKETED | ADJUSTMENT_ADD_BACK | ADJUSTMENT_DEDUCT
    // WORKING_CAPITAL_ASSET | WORKING_CAPITAL_LIABILITY
    presentationSign?: string
}

export interface CashFlowData {
    operatingActivities: {
        netIncome: number
        // Non-cash adjustments to reconcile net income → cash (depreciation, bad debt, etc.)
        adjustments: CFSLineItem[]
        // Working capital period deltas (AR, inventory, AP, VAT payable, etc.)
        changesInWorkingCapital: CFSLineItem[]
        // Direct operating cash items (interest paid, interest received)
        operatingCashItems: CFSLineItem[]
        netCashFromOperating: number
    }
    investingActivities: {
        items: CFSLineItem[]
        netCashFromInvesting: number
    }
    financingActivities: {
        items: CFSLineItem[]
        netCashFromFinancing: number
    }
    netIncreaseInCash: number
    beginningCash: number
    endingCash: number
    calculatedEndingCash?: number
    cashFlowDiscrepancy?: number
    // Proof equation: openingCash + netChange should === actualClosingCash
    proof: {
        isBalanced: boolean
        openingCash: number
        netChange: number
        calculatedClosing: number
        actualClosing: number
        difference: number
    }
    period: { startDate: string; endDate: string }
}

export async function getCashFlowStatement(startDate?: Date | string, endDate?: Date | string): Promise<CashFlowData> {
    // ── helpers ─────────────────────────────────────────────────────────────────
    const EMPTY_PROOF = {
        isBalanced: true, openingCash: 0, netChange: 0,
        calculatedClosing: 0, actualClosing: 0, difference: 0,
    }
    const emptyResult: CashFlowData = {
        operatingActivities: {
            netIncome: 0, adjustments: [], changesInWorkingCapital: [],
            operatingCashItems: [], netCashFromOperating: 0,
        },
        investingActivities: { items: [], netCashFromInvesting: 0 },
        financingActivities: { items: [], netCashFromFinancing: 0 },
        netIncreaseInCash: 0, beginningCash: 0, endingCash: 0,
        cashFlowDiscrepancy: 0, proof: EMPTY_PROOF,
        period: { startDate: '', endDate: '' },
    }

    try {
        const start = parseDateInput(startDate) ?? new Date(new Date().getFullYear(), 0, 1)
        const end   = parseDateInput(endDate)   ?? new Date()

        // ── Auth ─────────────────────────────────────────────────────────────────
        const supabaseClient = await createClient()
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
        if (authError || !user) throw new Error('Unauthorized')

        // ── Step A: Net Profit from P&L ──────────────────────────────────────────
        const pnlData = await getProfitLossStatement(start, end)
        const netIncome = pnlData.netIncome

        // ── Step B: Cash/Bank account IDs (EXCLUDED accounts, codes 1000-1199) ───
        const cashAccounts = await basePrisma.gLAccount.findMany({
            where: {
                type: 'ASSET',
                OR: [
                    { code: { gte: '1000', lt: '1100' } },
                    { code: { gte: '1100', lt: '1200' } },
                ],
            },
            select: { id: true },
        })
        const cashAccountIds = cashAccounts.map(a => a.id)

        // Helper: sum journal lines for a set of account IDs up to (but not including) a date
        async function sumLines(
            accountIds: string[],
            dateLt?: Date,
            dateLte?: Date,
        ): Promise<number> {
            const where: Record<string, unknown> = {
                accountId: { in: accountIds },
                entry: { status: 'POSTED', ...(dateLt ? { date: { lt: dateLt } } : dateLte ? { date: { lte: dateLte } } : {}) },
            }
            const lines = await basePrisma.journalLine.findMany({ where, select: { debit: true, credit: true } })
            // ASSET balance = debit - credit; LIABILITY/EQUITY = credit - debit
            return lines.reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0)
        }

        // Helper: get point-in-time balance for a single account
        async function getBalance(accountId: string, asOf: Date, type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'): Promise<number> {
            const lines = await basePrisma.journalLine.findMany({
                where: { accountId, entry: { status: 'POSTED', date: { lte: asOf } } },
                select: { debit: true, credit: true },
            })
            const net = lines.reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0)
            // For ASSET/EXPENSE: positive = debit balance; for LIABILITY/EQUITY/REVENUE: positive = credit balance
            return (type === 'ASSET' || type === 'EXPENSE') ? net : -net
        }

        // ── Step C: Opening & Closing Cash ───────────────────────────────────────
        const openingCash = await sumLines(cashAccountIds, start)
        const closingCash = await sumLines(cashAccountIds, undefined, end)

        // ── Step D: Non-cash adjustments (NON_CASH tagged accounts) ─────────────
        // These reconcile net income → cash basis: add back depreciation, bad debt, etc.
        const nonCashAccounts = await basePrisma.gLAccount.findMany({
            where: { cfsActivity: 'NON_CASH' },
            select: { id: true, name: true, cfsLineItem: true, type: true },
        })

        // Group non-cash adjustments by cfsLineItem
        const nonCashMap = new Map<string, { description: string; amount: number; type: string }>()
        for (const acct of nonCashAccounts) {
            const label = acct.cfsLineItem ?? acct.name
            const lines = await basePrisma.journalLine.findMany({
                where: {
                    accountId: acct.id,
                    entry: { status: 'POSTED', date: { gte: start, lte: end } },
                },
                select: { debit: true, credit: true },
            })
            // Use net absolute debit (expense side) as the add-back amount
            const netDebit = lines.reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0)
            const existing = nonCashMap.get(label)
            if (existing) {
                existing.amount += Math.abs(netDebit)
            } else {
                nonCashMap.set(label, { description: label, amount: Math.abs(netDebit), type: acct.type })
            }
        }

        // Classify non-cash items: expenses add back (ADJUSTMENT_ADD_BACK), gains deduct (ADJUSTMENT_DEDUCT)
        const adjustments: CFSLineItem[] = []
        let nonCashTotal = 0
        for (const [, item] of nonCashMap) {
            if (item.amount === 0) continue
            // Gain accounts (REVENUE type) = deduct; everything else = add back
            const isGain = item.description.toLowerCase().includes('gain') ||
                            item.description.toLowerCase().includes('keuntungan')
            const sign = isGain ? 'ADJUSTMENT_DEDUCT' : 'ADJUSTMENT_ADD_BACK'
            const delta = isGain ? -item.amount : item.amount
            adjustments.push({ description: item.description, amount: item.amount, presentationSign: sign })
            nonCashTotal += delta
        }

        // ── Step E: Working Capital changes (OPERATING tagged accounts, period deltas) ──
        const operatingAccounts = await basePrisma.gLAccount.findMany({
            where: { cfsActivity: 'OPERATING' },
            select: { id: true, name: true, cfsLineItem: true, type: true, cfsDirection: true },
        })

        // One day before period start = opening balance reference point
        const dayBeforeStart = new Date(start)
        dayBeforeStart.setDate(dayBeforeStart.getDate() - 1)

        // Group working-capital items by cfsLineItem label
        const wcMap = new Map<string, { description: string; amount: number; sign: string; type: string }>()
        let directOperatingCashTotal = 0
        const operatingCashItems: CFSLineItem[] = []

        for (const acct of operatingAccounts) {
            const label = acct.cfsLineItem ?? acct.name
            const acctType = acct.type as 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'

            // Direct operating INFLOW/OUTFLOW (e.g. interest paid, interest received) — not balance-sheet delta
            if (acct.cfsDirection === 'INFLOW' || acct.cfsDirection === 'OUTFLOW') {
                const lines = await basePrisma.journalLine.findMany({
                    where: { accountId: acct.id, entry: { status: 'POSTED', date: { gte: start, lte: end } } },
                    select: { debit: true, credit: true },
                })
                const net = lines.reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0)
                // For ASSET: debit = inflow; for EXPENSE: debit = outflow
                const cashImpact = (acctType === 'EXPENSE') ? -Math.abs(net) : net
                if (Math.abs(cashImpact) > 0.01) {
                    const sign = acct.cfsDirection === 'OUTFLOW' ? 'OUTFLOW_BRACKETED' : 'INFLOW_POSITIVE'
                    operatingCashItems.push({ description: label, amount: Math.abs(cashImpact), presentationSign: sign })
                    directOperatingCashTotal += cashImpact
                }
                continue
            }

            // Balance-sheet working capital — compute period delta
            const opening = await getBalance(acct.id, dayBeforeStart, acctType)
            const closing  = await getBalance(acct.id, end,            acctType)

            // ASSET: opening - closing = cash impact (increase in AR uses cash → negative)
            // LIABILITY: closing - opening = cash impact (increase in AP defers payment → positive)
            let delta: number
            let sign: string
            if (acctType === 'ASSET') {
                delta = opening - closing
                sign = 'WORKING_CAPITAL_ASSET'
            } else {
                delta = closing - opening
                sign = 'WORKING_CAPITAL_LIABILITY'
            }

            if (Math.abs(delta) < 0.01) continue

            const existing = wcMap.get(label)
            if (existing) {
                existing.amount += delta
            } else {
                wcMap.set(label, { description: label, amount: delta, sign, type: acct.type })
            }
        }

        const changesInWorkingCapital: CFSLineItem[] = []
        let wcTotal = 0
        for (const [, item] of wcMap) {
            if (Math.abs(item.amount) < 0.01) continue
            changesInWorkingCapital.push({ description: item.description, amount: item.amount, presentationSign: item.sign })
            wcTotal += item.amount
        }

        // ── Step F: Net Cash from Operating ──────────────────────────────────────
        const netCashFromOperating = netIncome + nonCashTotal + wcTotal + directOperatingCashTotal

        // ── Step G: Investing activities — tagged cash flows ─────────────────────
        // Find journal entries where one side is cash and counter-party is INVESTING tagged
        const investingItems = await getTaggedCashFlows(basePrisma, cashAccountIds, 'INVESTING', start, end)
        const netCashFromInvesting = investingItems.reduce((s, i) => s + i.amount, 0)

        // ── Step H: Financing activities — tagged cash flows ─────────────────────
        const financingItems = await getTaggedCashFlows(basePrisma, cashAccountIds, 'FINANCING', start, end)
        const netCashFromFinancing = financingItems.reduce((s, i) => s + i.amount, 0)

        // ── Step I: Proof equation ────────────────────────────────────────────────
        const netChange = netCashFromOperating + netCashFromInvesting + netCashFromFinancing
        const calculatedClosing = openingCash + netChange
        const difference = Math.abs(calculatedClosing - closingCash)
        const isBalanced = difference < 1  // Rp 1 tolerance for rounding

        return {
            operatingActivities: {
                netIncome,
                adjustments,
                changesInWorkingCapital,
                operatingCashItems,
                netCashFromOperating,
            },
            investingActivities: {
                items: investingItems,
                netCashFromInvesting,
            },
            financingActivities: {
                items: financingItems,
                netCashFromFinancing,
            },
            netIncreaseInCash: netChange,
            beginningCash: openingCash,
            endingCash: closingCash,
            calculatedEndingCash: calculatedClosing,
            cashFlowDiscrepancy: isBalanced ? 0 : difference,
            proof: {
                isBalanced,
                openingCash,
                netChange,
                calculatedClosing,
                actualClosing: closingCash,
                difference,
            },
            period: { startDate: start.toISOString(), endDate: end.toISOString() },
        }
    } catch (error) {
        console.error('getCashFlowStatement failed:', error)
        return emptyResult
    }
}

/**
 * Find journal entries in period where one side is a cash account and the
 * counter-party is tagged with a specific cfsActivity. Returns signed cash items
 * grouped by cfsLineItem label.
 */
async function getTaggedCashFlows(
    db: typeof basePrisma,
    cashAccountIds: string[],
    activity: string,
    start: Date,
    end: Date,
): Promise<CFSLineItem[]> {
    // Get all journal entries in period that touch a cash account
    const cashLines = await db.journalLine.findMany({
        where: {
            accountId: { in: cashAccountIds },
            entry: { status: 'POSTED', date: { gte: start, lte: end } },
        },
        include: {
            entry: {
                include: {
                    lines: {
                        include: { account: { select: { id: true, cfsActivity: true, cfsLineItem: true, name: true, type: true } } },
                    },
                },
            },
        },
    })

    // For each cash line, check if any counter-party line has matching cfsActivity
    const grouped = new Map<string, { amount: number; sign: string }>()

    for (const cashLine of cashLines) {
        // Net cash movement: positive = inflow (debit cash), negative = outflow (credit cash)
        const cashAmount = Number(cashLine.debit) - Number(cashLine.credit)

        const counterParties = cashLine.entry.lines.filter(
            l => !cashAccountIds.includes(l.accountId) && l.account.cfsActivity === activity
        )
        if (counterParties.length === 0) continue

        // Use the cfsLineItem of the first matched counter-party account (or its name)
        const label = counterParties[0].account.cfsLineItem ?? counterParties[0].account.name

        // Determine presentation sign based on cfsDirection
        const isOutflow = cashAmount < 0
        const sign = isOutflow ? 'OUTFLOW_BRACKETED' : 'INFLOW_POSITIVE'

        const existing = grouped.get(label)
        if (existing) {
            existing.amount += cashAmount
        } else {
            grouped.set(label, { amount: cashAmount, sign })
        }
    }

    const items: CFSLineItem[] = []
    for (const [label, data] of grouped) {
        if (Math.abs(data.amount) < 0.01) continue
        items.push({ description: label, amount: data.amount, presentationSign: data.sign })
    }
    return items
}

// ==========================================
// INVOICE CREATION
// ==========================================

/**
 * Create a new customer invoice (normal manual creation)
 */
export async function createCustomerInvoice(data: {
    customerId: string // Can be Customer ID or Supplier ID
    amount: number
    issueDate?: Date
    dueDate?: Date
    notes?: string
    includeTax?: boolean  // PPN 11%
    // Manual Items
    items?: Array<{
        description: string
        quantity: number
        unitPrice: number
        productCode?: string
        productId?: string
    }>
    type?: 'CUSTOMER' | 'SUPPLIER'
    accountId?: string // User-selected GL account UUID (looked up → glAccountCode on invoice)
}) {
    try {
        // Server-side validation: COA account is mandatory for manual invoices
        if (!data.accountId) {
            return { success: false, error: "Pilih akun pendapatan/beban (COA) terlebih dahulu" }
        }

        return await withPrismaAuth(async (prisma) => {
            // Determine Type
            let invoiceType: 'INV_OUT' | 'INV_IN' = 'INV_OUT'

            // Check if ID belongs to customer or supplier if type not explicit
            if (!data.type) {
                const isCustomer = await prisma.customer.findUnique({ where: { id: data.customerId } })
                invoiceType = isCustomer ? 'INV_OUT' : 'INV_IN'
            } else {
                invoiceType = data.type === 'CUSTOMER' ? 'INV_OUT' : 'INV_IN'
            }

            // Look up GL account code from accountId (user-selected COA)
            let glAccountCode: string | null = null
            if (data.accountId) {
                const glAccount = await prisma.gLAccount.findUnique({
                    where: { id: data.accountId },
                    select: { code: true },
                })
                if (glAccount) glAccountCode = glAccount.code
            }

            // Generate invoice number prefix
            const prefix = invoiceType === 'INV_OUT' ? 'INV' : 'BILL'
            const year = new Date().getFullYear()

            const count = await prisma.invoice.count({
                where: {
                    type: invoiceType,
                    number: { startsWith: `${prefix}-${year}` }
                }
            })
            const invoiceNumber = `${prefix}-${year}-${String(count + 1).padStart(4, '0')}`

            // Calculate due date (default NET 30)
            const issueDate = data.issueDate || new Date()
            const dueDate = data.dueDate || calculateDueDate(issueDate, 30)

            // Prepare Items
            const invoiceItems = data.items && data.items.length > 0 ? data.items.map(item => ({
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                amount: item.quantity * item.unitPrice,
            })) : [{
                description: data.notes || 'Manual Entry',
                quantity: 1,
                unitPrice: data.amount,
                amount: data.amount
            }]

            // Calculate subtotal and tax
            const subtotal = invoiceItems.reduce((sum, item) => sum + Number(item.amount), 0)
            const taxAmount = data.includeTax ? Math.round(subtotal * TAX_RATES.PPN) : 0
            const totalAmount = subtotal + taxAmount

            // Create invoice — use relation connect (Prisma 6 rejects scalar FK mixed with nested creates)
            const invoice = await prisma.invoice.create({
                data: {
                    number: invoiceNumber,
                    type: invoiceType,
                    ...(invoiceType === 'INV_OUT' ? { customer: { connect: { id: data.customerId } } } : {}),
                    ...(invoiceType === 'INV_IN' ? { supplier: { connect: { id: data.customerId } } } : {}),
                    issueDate: issueDate,
                    dueDate: dueDate,
                    subtotal: subtotal,
                    taxAmount: taxAmount,
                    totalAmount: totalAmount,
                    balanceDue: totalAmount,
                    glAccountCode,
                    status: 'DRAFT',
                    items: {
                        create: invoiceItems
                    }
                }
            })

            // Audit trail
            try {
                const sbClient = await createClient()
                const { data: { user: authUser } } = await sbClient.auth.getUser()
                if (authUser) {
                    await logAudit(prisma, {
                        entityType: "Invoice",
                        entityId: invoice.id,
                        action: "CREATE",
                        userId: authUser.id,
                        userName: authUser.email || undefined,
                    })
                }
            } catch { /* audit is best-effort */ }

            return {
                success: true,
                invoiceId: invoice.id,
                invoiceNumber: invoice.number
            }
        })
    } catch (error: any) {
        console.error("Failed to create invoice:", error)
        return { success: false, error: error.message || "Failed to create invoice" }
    }
}

// ==========================================
// PROCUREMENT INTEGRATION
// ==========================================

/**
 * @deprecated Use `recordPendingBillFromPO` from `@/lib/actions/finance-invoices` instead.
 * That version has duplicate detection, force-create option, and incremented bill numbers.
 */
export async function recordPendingBillFromPO(po: any) {
    try {
        console.log("Creating/Updating Finance Bill for PO:", po.number)

        return await withPrismaAuth(async (prisma) => {
            // Check if Bill already exists for this PO
            const existingBill = await prisma.invoice.findFirst({
                where: { orderId: po.id, type: 'INV_IN' }
            })

            if (existingBill) {
                console.log("Bill already exists:", existingBill.number)
                return { success: true, billId: existingBill.id }
            }

            // Create new Bill (Invoice Type IN) — relation connect for Prisma 6
            const bill = await prisma.invoice.create({
                data: {
                    number: `BILL-${po.number}`,
                    type: 'INV_IN',
                    ...(po.supplierId ? { supplier: { connect: { id: po.supplierId } } } : {}),
                    status: 'DRAFT',
                    issueDate: new Date(),
                    dueDate: new Date(new Date().setDate(new Date().getDate() + 30)),
                    subtotal: po.totalAmount || 0,
                    taxAmount: po.taxAmount || 0,
                    totalAmount: po.netAmount || 0,
                    balanceDue: po.netAmount || 0,
                    items: {
                        create: po.items.map((item: any) => ({
                            description: item.product?.name || 'Unknown Item',
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            amount: item.totalPrice,
                            ...(item.productId ? { product: { connect: { id: item.productId } } } : {}),
                        }))
                    }
                }
            })

            console.log("Bill Created:", bill.number)
            return { success: true, billId: bill.id }
        })
    } catch (error) {
        console.error("Failed to record pending bill:", error)
        return { success: false, error: "Finance Sync Failed" }
    }
}

// ==========================================
// SALES INTEGRATION
// ==========================================

export async function createInvoiceFromSalesOrder(salesOrderId: string) {
    try {
        console.log("Creating Customer Invoice for Sales Order:", salesOrderId)

        return await withPrismaAuth(async (prisma) => {
            // Get Sales Order with all details
            const salesOrder = await prisma.salesOrder.findUnique({
                where: { id: salesOrderId },
                include: {
                    customer: true,
                    items: {
                        include: {
                            product: true
                        }
                    }
                }
            })

            if (!salesOrder) {
                throw new Error("Sales Order not found")
            }

            if (!salesOrder.customerId) {
                throw new Error("Sales Order has no customer")
            }

            // Check if Invoice already exists for this Sales Order
            const existingInvoice = await prisma.invoice.findFirst({
                where: {
                    salesOrderId: salesOrder.id,
                    type: 'INV_OUT'
                }
            })

            if (existingInvoice) {
                console.log("Invoice already exists:", existingInvoice.number)
                return { success: true, invoiceId: existingInvoice.id, invoiceNumber: existingInvoice.number }
            }

            // Period lock check
            await assertPeriodOpen(new Date())

            // Generate Invoice Number
            const year = new Date().getFullYear()
            const count = await prisma.invoice.count({
                where: {
                    type: 'INV_OUT',
                    number: { startsWith: `INV-${year}` }
                }
            })
            const invoiceNumber = `INV-${year}-${String(count + 1).padStart(4, '0')}`

            // Determine due date based on payment terms (default: NET_30 = 30 days)
            const paymentTermDays = legacyTermToDays(salesOrder.paymentTerm)
            const dueDate = calculateDueDate(new Date(), paymentTermDays)

            // Multi-currency: inherit from SO
            const soCurrencyCode = salesOrder.currencyCode || "IDR"
            const soExchangeRate = Number(salesOrder.exchangeRate) || 1

            // Create Customer Invoice (Invoice Type OUT) — relation connect for Prisma 6
            const invoice = await prisma.invoice.create({
                data: {
                    number: invoiceNumber,
                    type: 'INV_OUT',
                    ...(salesOrder.customerId ? { customer: { connect: { id: salesOrder.customerId } } } : {}),
                    salesOrder: { connect: { id: salesOrder.id } },
                    status: 'ISSUED',
                    issueDate: new Date(),
                    dueDate: dueDate,
                    subtotal: salesOrder.subtotal,
                    taxAmount: salesOrder.taxAmount,
                    discountAmount: salesOrder.discountAmount || 0,
                    totalAmount: salesOrder.total,
                    balanceDue: salesOrder.total,
                    currencyCode: soCurrencyCode,
                    exchangeRate: soExchangeRate,
                    amountInIDR: 0, // will be computed below
                    items: {
                        create: salesOrder.items.map((item) => ({
                            description: item.product?.name || item.description || 'Unknown Item',
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            amount: item.lineTotal,
                            ...(item.productId ? { product: { connect: { id: item.productId } } } : {}),
                        }))
                    }
                }
            })

            console.log("Customer Invoice Created:", invoice.number)

            // Multi-currency: convert to IDR for GL posting
            const soTotal = Number(salesOrder.total)
            let glAmount = soTotal
            if (soCurrencyCode !== "IDR") {
                try {
                    const rate = await getExchangeRate(soCurrencyCode, new Date())
                    glAmount = convertToIDR(soTotal, rate)
                    // Store computed IDR amount and rate on invoice
                    await prisma.invoice.update({
                        where: { id: invoice.id },
                        data: { exchangeRate: rate, amountInIDR: glAmount }
                    })
                } catch {
                    // Fallback: use SO exchange rate if real-time rate unavailable
                    glAmount = convertToIDR(soTotal, soExchangeRate)
                    await prisma.invoice.update({
                        where: { id: invoice.id },
                        data: { amountInIDR: glAmount }
                    }).catch(() => {})
                }
            } else {
                await prisma.invoice.update({
                    where: { id: invoice.id },
                    data: { amountInIDR: soTotal }
                }).catch(() => {})
            }

            // Auto-post to General Ledger (DR Accounts Receivable, CR Revenue)
            // GL always in IDR
            try {
                // Get GL account codes from database (or use predefined codes)
                const arAccount = await prisma.gLAccount.findFirst({
                    where: { code: '1200' } // Accounts Receivable
                })
                const revenueAccount = await prisma.gLAccount.findFirst({
                    where: { code: '4000' } // Sales Revenue
                })

                if (arAccount && revenueAccount) {
                    const glCurrencyNote = soCurrencyCode !== "IDR" ? ` [${soCurrencyCode}→IDR]` : ""
                    // Post journal entry — always in IDR
                    const glResult = await postJournalEntry({
                        description: `Customer Invoice ${invoice.number} - ${salesOrder.customer?.name}${glCurrencyNote}`,
                        date: new Date(),
                        reference: invoice.number,
                        lines: [
                            {
                                accountCode: arAccount.code,
                                debit: glAmount,
                                credit: 0,
                                description: `AR - ${salesOrder.customer?.name}${glCurrencyNote}`
                            },
                            {
                                accountCode: revenueAccount.code,
                                debit: 0,
                                credit: glAmount,
                                description: `Sales Revenue - SO ${salesOrder.number}${glCurrencyNote}`
                            }
                        ]
                    })
                    if (!glResult?.success) {
                        console.error("GL posting failed:", glResult?.error)
                    }
                    console.log("GL Entry Posted for Invoice:", invoice.number)
                } else {
                    console.warn("GL Accounts not found - skipping auto-posting")
                }
            } catch (glError) {
                console.error("Failed to post GL entry (invoice still created):", glError)
            }

            return {
                success: true,
                invoiceId: invoice.id,
                invoiceNumber: invoice.number
            }
        })
    } catch (error) {
        console.error("Failed to create invoice from sales order:", error)
        return {
            success: false,
            error: (error as any)?.message || "Invoice creation failed"
        }
    }
}

/**
 * Get Sales Orders that are ready for invoicing (CONFIRMED or IN_PROGRESS status)
 */
export async function getPendingSalesOrders() {
    return withPrismaAuth(async (prisma) => {
        const orders = await prisma.salesOrder.findMany({
            where: {
                status: { in: ['CONFIRMED', 'IN_PROGRESS', 'DELIVERED', 'COMPLETED'] },
                invoices: {
                    none: {
                        type: 'INV_OUT',
                        status: { notIn: ['CANCELLED', 'VOID'] }
                    }
                }
            },
            include: {
                customer: { select: { id: true, name: true } }
            },
            orderBy: { orderDate: 'desc' },
            take: 100
        })

        return orders.map(o => ({
            id: o.id,
            number: o.number,
            customerName: (o as any).customer?.name || 'Unknown',
            amount: Number(o.total),
            date: o.orderDate
        }))
    })
}

/**
 * Get Purchase Orders that are ready for billing (ARRIVED status)
 */
export async function getPendingPurchaseOrders() {
    return withPrismaAuth(async (prisma) => {
        const orders = await prisma.purchaseOrder.findMany({
            where: {
                status: { in: ['RECEIVED', 'ORDERED', 'APPROVED'] },
                invoices: {
                    none: {
                        type: 'INV_IN',
                        status: { notIn: ['CANCELLED', 'VOID'] }
                    }
                }
            },
            include: {
                supplier: { select: { id: true, name: true } }
            },
            orderBy: { orderDate: 'desc' },
            take: 100
        })

        return orders.map(o => ({
            id: o.id,
            number: o.number,
            vendorName: (o as any).supplier?.name || 'Unknown',
            amount: Number(o.totalAmount),
            date: o.orderDate
        }))
    })
}

/**
 * @deprecated Use `createBillFromPOId` from `@/lib/actions/finance-invoices` instead.
 * That version has duplicate detection, force-create option, and incremented bill numbers.
 */
export async function createBillFromPOId(poId: string) {
    // Delegate to the newer implementation in finance-invoices.ts
    const { createBillFromPOId: newCreateBillFromPOId } = await import("@/lib/actions/finance-invoices")
    return newCreateBillFromPOId(poId)
}

// ==========================================
// CREDIT NOTES & REFUNDS (AR)
// ==========================================

export async function processRefund(data: {
    invoiceId: string
    amount: number
    method: 'CASH' | 'TRANSFER' | 'CHECK'
    reference?: string
    reason: string
}) {
    try {
        return await withPrismaAuth(async (prisma) => {
            const invoice = await prisma.invoice.findUnique({
                where: { id: data.invoiceId }
            })

            if (!invoice) throw new Error("Invoice not found")
            if (invoice.type !== 'INV_OUT') throw new Error("Can only refund customer payments")

            // Period lock check
            await assertPeriodOpen(new Date())

            // 1. Create Refund Record
            const refund = await prisma.payment.create({
                data: {
                    number: `REF-${Date.now()}`,
                    amount: -data.amount,
                    method: data.method,
                    invoiceId: data.invoiceId,
                    customerId: invoice.customerId,
                    date: new Date(),
                    reference: data.reference || `REF-${data.invoiceId}`,
                    notes: data.reason
                }
            })

            // 2. Update Invoice Balance
            const newBalance = Number(invoice.balanceDue) + data.amount
            await prisma.invoice.update({
                where: { id: data.invoiceId },
                data: {
                    balanceDue: newBalance,
                    status: newBalance <= 0 ? 'PAID' : 'PARTIAL'
                }
            })

            // 3. Post Journal Entry
            let creditAccount = '1101' // Cash
            if (data.method === 'TRANSFER') creditAccount = '1102' // Bank

            const glResult = await postJournalEntry({
                description: `Refund to customer: ${data.reason}`,
                date: new Date(),
                reference: refund.id,
                lines: [
                    {
                        accountCode: '1100', // AR
                        debit: data.amount,
                        credit: 0
                    },
                    {
                        accountCode: creditAccount,
                        debit: 0,
                        credit: data.amount
                    }
                ]
            })
            if (!glResult?.success) {
                console.error("GL posting failed:", glResult?.error)
            }

            return { success: true, refundId: refund.id }
        })
    } catch (error: any) {
        console.error("Process Refund Error:", error)
        return { success: false, error: error.message }
    }
}

// ==========================================
// PAYMENT VOUCHERS (AP)
// ==========================================

export async function createPaymentVoucher(data: {
    supplierId: string
    billIds: string[]
    amount: number
    method: 'CASH' | 'TRANSFER' | 'CHECK' | 'GIRO'
    bankAccount?: string
    dueDate?: Date
    reference?: string
    notes?: string
}) {
    try {
        return await withPrismaAuth(async (prisma) => {
            // 1. Validate Bills
            const bills = await prisma.invoice.findMany({
                where: {
                    id: { in: data.billIds },
                    type: 'INV_IN',
                    status: { in: ['ISSUED', 'PARTIAL', 'OVERDUE'] }
                },
                include: { supplier: true }
            })

            if (bills.length !== data.billIds.length) {
                throw new Error("Some bills not found or already paid")
            }

            // Period lock check
            await assertPeriodOpen(new Date())

            // 2. Generate PV Number
            const count = await prisma.payment.count({ where: { type: 'VOUCHER' } })
            const year = new Date().getFullYear()
            const number = `PV-${year}-${String(count + 1).padStart(4, '0')}`

            // 3. Create Payment Voucher
            const voucher = await prisma.payment.create({
                data: {
                    number,
                    type: 'VOUCHER',
                    amount: data.amount,
                    method: data.method,
                    supplierId: data.supplierId,
                    status: data.method === 'GIRO' ? 'PENDING' : 'APPROVED',
                    date: new Date(),
                    dueDate: data.dueDate,
                    reference: data.reference,
                    bankAccount: data.bankAccount,
                    notes: data.notes,
                    voucherItems: {
                        create: bills.map(bill => ({
                            invoiceId: bill.id,
                            amount: Math.min(data.amount / bills.length, Number(bill.balanceDue))
                        }))
                    }
                }
            })

            // 4. If not GIRO, immediately apply payment
            if (data.method !== 'GIRO') {
                for (const bill of bills) {
                    const paymentAmount = Math.min(data.amount / bills.length, Number(bill.balanceDue))
                    const newBalance = Number(bill.balanceDue) - paymentAmount

                    await prisma.invoice.update({
                        where: { id: bill.id },
                        data: {
                            balanceDue: newBalance,
                            status: newBalance <= 0 ? 'PAID' : 'PARTIAL'
                        }
                    })
                }
            }

            // Post to GL
            let creditAccount = '1101'
            if (data.method === 'TRANSFER') creditAccount = '1102'

            const glResult = await postJournalEntry({
                description: `Payment Voucher ${number} for ${bills.length} bills`,
                date: new Date(),
                reference: voucher.id,
                lines: [
                    {
                        accountCode: '2100', // AP
                        debit: data.amount,
                        credit: 0
                    },
                    {
                        accountCode: creditAccount,
                        debit: 0,
                        credit: data.amount
                    }
                ]
            })
            if (!glResult?.success) {
                console.error("GL posting failed:", glResult?.error)
            }

            return { success: true, voucherNumber: number }
        })
    } catch (error: any) {
        console.error("Failed to create voucher:", error)
        return { success: false, error: "Failed to create payment voucher" }
    }
}

// ==========================================
// INVOICE WORKFLOW (Send & Pay)
// ==========================================

export async function moveInvoiceToSent(invoiceId: string, message?: string, method?: 'WHATSAPP' | 'EMAIL') {
    try {
        return await withPrismaAuth(async (prisma) => {
            const now = new Date()
            const dueDate = new Date(now)
            dueDate.setDate(dueDate.getDate() + 30) // 30-day countdown

            const invoice = await prisma.invoice.update({
                where: { id: invoiceId },
                data: {
                    status: 'ISSUED', // Sent Column
                    issueDate: now,
                    dueDate: dueDate, // Start Countdown
                }
            })

            // Log activity or "send" message (mock for now)
            console.log(`Sending Invoice ${invoice.number} via ${method}: ${message}`)

            return { success: true, dueDate }
        })
    } catch (error) {
        console.error("Failed to move invoice to sent:", error)
        return { success: false, error: "Failed to update invoice status" }
    }
}

export async function recordInvoicePayment(data: {
    invoiceId: string
    paymentMethod: 'CASH' | 'TRANSFER' | 'CHECK' | 'GIRO' | 'CREDIT_CARD' | 'OTHER'
    amount: number
    paymentDate: Date
    reference?: string
    notes?: string
}) {
    try {
        return await withPrismaAuth(async (prisma) => {
            const invoice = await prisma.invoice.findUnique({
                where: { id: data.invoiceId },
                include: { customer: true, supplier: true }
            })

            if (!invoice) throw new Error("Invoice not found")

            // Period lock check
            await assertPeriodOpen(new Date())

            // Create Payment Record
            const payment = await prisma.payment.create({
                data: {
                    number: `PAY-${Date.now()}`, // Simple ID generation
                    date: data.paymentDate,
                    amount: data.amount,
                    method: data.paymentMethod === 'CREDIT_CARD' || data.paymentMethod === 'OTHER' ? 'TRANSFER' : data.paymentMethod,
                    reference: data.reference,
                    notes: data.notes,
                    invoiceId: invoice.id,
                    customerId: invoice.customerId,
                    supplierId: invoice.supplierId
                }
            })

            // Audit trail
            try {
                const sbClient = await createClient()
                const { data: { user: authUser } } = await sbClient.auth.getUser()
                if (authUser) {
                    await logAudit(prisma, {
                        entityType: "Payment",
                        entityId: payment.id,
                        action: "CREATE",
                        userId: authUser.id,
                        userName: authUser.email || undefined,
                    })
                }
            } catch { /* audit is best-effort */ }

            // Update Invoice Status
            const newBalance = Number(invoice.balanceDue) - data.amount
            const newStatus = newBalance <= 0 ? 'PAID' : 'PARTIAL'

            await prisma.invoice.update({
                where: { id: invoice.id },
                data: {
                    status: newStatus,
                    balanceDue: newBalance,
                    // If fully paid, maybe set closing date?
                }
            })

            // Post Journal Entry (Cash Debit / AR Credit)
            // Determine Accounts
            const cashAccountCode = data.paymentMethod === 'CASH' ? '1000' : '1010' // Cash vs Bank
            const arAccountCode = '1200' // Accounts Receivable
            const apAccountCode = '2000' // Accounts Payable

            if (invoice.type === 'INV_OUT') {
                // Customer Payment: Debit Cash, Credit AR
                const arGlResult = await postJournalEntry({
                    description: `Payment for Invoice ${invoice.number}`,
                    date: data.paymentDate,
                    reference: payment.number,
                    lines: [
                        { accountCode: cashAccountCode, debit: data.amount, credit: 0, description: `Receipt from ${invoice.customer?.name}` },
                        { accountCode: arAccountCode, debit: 0, credit: data.amount, description: `Payment for ${invoice.number}` }
                    ]
                })
                if (!arGlResult?.success) {
                    console.error("GL posting failed:", arGlResult?.error)
                }
            } else {
                // Vendor Payment: Debit AP, Credit Cash
                const apGlResult = await postJournalEntry({
                    description: `Payment for Bill ${invoice.number}`,
                    date: data.paymentDate,
                    reference: payment.number,
                    lines: [
                        { accountCode: apAccountCode, debit: data.amount, credit: 0, description: `Payment for ${invoice.supplier?.name}` },
                        { accountCode: cashAccountCode, debit: 0, credit: data.amount, description: `Payment for ${invoice.number}` }
                    ]
                })
                if (!apGlResult?.success) {
                    console.error("GL posting failed:", apGlResult?.error)
                }
            }

            return { success: true }
        })
    } catch (error) {
        console.error("Failed to record payment:", error)
        return { success: false, error: "Failed to record payment" }
    }
}

export async function processGIROClearing(voucherId: string, isCleared: boolean, rejectionReason?: string) {
    try {
        return await withPrismaAuth(async (prisma) => {
            const voucher = await prisma.payment.findUnique({
                where: { id: voucherId },
                include: { voucherItems: { include: { invoice: true } } }
            })

            if (!voucher) throw new Error("Voucher not found")
            if (voucher.method !== 'GIRO') throw new Error("Not a GIRO payment")
            if (voucher.status !== 'PENDING') throw new Error("GIRO already processed")

            // Period lock check
            await assertPeriodOpen(new Date())

            if (isCleared) {
                // GIRO Cleared - apply payments
                for (const item of voucher.voucherItems) {
                    const newBalance = Number(item.invoice.balanceDue) - Number(item.amount)
                    await prisma.invoice.update({
                        where: { id: item.invoiceId },
                        data: {
                            balanceDue: newBalance,
                            status: newBalance <= 0 ? 'PAID' : 'PARTIAL'
                        }
                    })
                }

                await prisma.payment.update({
                    where: { id: voucherId },
                    data: { status: 'CLEARED', clearedDate: new Date() }
                })

                // Post to GL
                const glResult = await postJournalEntry({
                    description: `GIRO ${voucher.number} cleared`,
                    date: new Date(),
                    reference: voucher.id,
                    lines: [
                        {
                            accountCode: '2100',
                            debit: voucher.amount,
                            credit: 0
                        },
                        {
                            accountCode: '1010',
                            debit: 0,
                            credit: voucher.amount
                        }
                    ]
                })
                if (!glResult?.success) {
                    console.error("GL posting failed:", glResult?.error)
                }

                return { success: true, status: 'CLEARED' }
            } else {
                // GIRO Rejected
                await prisma.payment.update({
                    where: { id: voucherId },
                    data: { status: 'REJECTED', notes: rejectionReason }
                })

                return { success: true, status: 'REJECTED', reason: rejectionReason }
            }
        })
    } catch (error: any) {
        console.error("GIRO Processing Error:", error)
        return { success: false, error: error.message }
    }
}

// ==========================================
// BANK RECONCILIATION
// ==========================================

export interface BankStatementLine {
    id: string
    date: string
    description: string
    reference?: string
    debit: number
    credit: number
    isReconciled: boolean
    matchedInvoiceId?: string
    matchedPaymentId?: string
}

export async function importBankStatement(bankAccountId: string, lines: Omit<BankStatementLine, 'id' | 'isReconciled'>[]) {
    try {
        return await withPrismaAuth(async (prisma) => {
            // Create bank statement lines
            const created = await prisma.bankStatement.createMany({
                data: lines.map(line => ({
                    bankAccountId,
                    date: new Date(line.date),
                    description: line.description,
                    reference: line.reference,
                    debit: line.debit,
                    credit: line.credit,
                    isReconciled: false
                }))
            })

            return { success: true, count: created.count }
        })
    } catch (error: any) {
        console.error("Import Bank Statement Error:", error)
        return { success: false, error: error.message }
    }
}

export async function getUnreconciledBankLines(bankAccountId: string) {
    try {
        return await withPrismaAuth(async (prisma) => {
            const lines = await prisma.bankStatement.findMany({
                where: {
                    bankAccountId,
                    isReconciled: false
                },
                orderBy: { date: 'asc' }
            })

            // Get unreconciled payments for matching
            const unreconciledPayments = await prisma.payment.findMany({
                where: {
                    isReconciled: false,
                    method: { in: ['TRANSFER', 'CHECK', 'GIRO'] }
                },
                include: {
                    invoice: true,
                    customer: true,
                    supplier: true
                }
            })

            return {
                success: true,
                bankLines: lines,
                payments: unreconciledPayments
            }
        })
    } catch (error: any) {
        console.error("Get Unreconciled Lines Error:", error)
        return { success: false, error: error.message, bankLines: [], payments: [] }
    }
}

export async function reconcileBankLine(data: {
    bankLineId: string
    paymentId?: string
    invoiceId?: string
    isAutoMatched?: boolean
}) {
    try {
        return await withPrismaAuth(async (prisma) => {
            const bankLine = await prisma.bankStatement.findUnique({
                where: { id: data.bankLineId }
            })

            if (!bankLine) throw new Error("Bank statement line not found")

            // Update bank line
            await prisma.bankStatement.update({
                where: { id: data.bankLineId },
                data: {
                    isReconciled: true,
                    matchedPaymentId: data.paymentId,
                    matchedInvoiceId: data.invoiceId,
                    reconciledAt: new Date()
                }
            })

            // Update payment if matched
            if (data.paymentId) {
                await prisma.payment.update({
                    where: { id: data.paymentId },
                    data: { isReconciled: true }
                })
            }

            return { success: true }
        })
    } catch (error: any) {
        console.error("Reconcile Bank Line Error:", error)
        return { success: false, error: error.message }
    }
}

// ==========================================
// AR PAYMENT MATCHING (Penerimaan AR)
// ==========================================

export interface UnallocatedPayment {
    id: string
    number: string
    from: string
    customerId: string | null
    amount: number
    date: Date
    method: string
    reference: string | null
    allocated: boolean
    invoiceNumber: string | null
}

export interface OpenInvoice {
    id: string
    number: string
    customer: { id: string; name: string } | null
    amount: number
    balanceDue: number
    dueDate: Date
    isOverdue: boolean
}

/**
 * Get all customer (AR) payments — both allocated and unallocated.
 * Allocated = linked to an invoice. Unallocated = received but not yet matched.
 */
export async function getUnallocatedPayments(): Promise<UnallocatedPayment[]> {
    try {
        return await withPrismaAuth(async (prisma) => {
            const payments = await prisma.payment.findMany({
                where: {
                    customerId: { not: null }
                },
                include: {
                    customer: { select: { id: true, name: true } },
                    invoice: { select: { number: true } },
                },
                orderBy: { date: 'desc' },
                take: 50
            })

            return payments.map((p) => ({
                id: p.id,
                number: p.number,
                from: p.customer?.name || 'Unknown Customer',
                customerId: p.customerId,
                amount: Number(p.amount),
                date: p.date,
                method: p.method,
                reference: p.reference,
                allocated: p.invoiceId !== null,
                invoiceNumber: p.invoice?.number || null,
            }))
        })
    } catch (error) {
        console.error("Failed to fetch unallocated payments:", error)
        return []
    }
}

/**
 * Get all open (unpaid/partially paid) customer invoices
 */
export async function getOpenInvoices(): Promise<OpenInvoice[]> {
    try {
        return await withPrismaAuth(async (prisma) => {
            const invoices = await prisma.invoice.findMany({
                where: {
                    type: 'INV_OUT',
                    status: { in: ['ISSUED', 'PARTIAL', 'OVERDUE'] },
                    balanceDue: { gt: 0 }
                },
                include: {
                    customer: { select: { id: true, name: true } }
                },
                orderBy: { dueDate: 'asc' },
                take: 100
            })

            const now = new Date()
            return invoices.map((inv) => ({
                id: inv.id,
                number: inv.number,
                customer: inv.customer ? { id: inv.customer.id, name: inv.customer.name } : null,
                amount: Number(inv.totalAmount),
                balanceDue: Number(inv.balanceDue),
                dueDate: inv.dueDate,
                isOverdue: inv.dueDate < new Date(now.getFullYear(), now.getMonth(), now.getDate())
            }))
        })
    } catch (error) {
        console.error("Failed to fetch open invoices:", error)
        return []
    }
}


/**
 * Record a new customer payment (AR receipt)
 */
export async function recordARPayment(data: {
    customerId: string
    amount: number
    date?: Date
    method?: 'CASH' | 'TRANSFER' | 'CHECK' | 'CARD'
    reference?: string
    notes?: string
    invoiceId?: string // Optional: directly link to invoice
}) {
    try {
        return await withPrismaAuth(async (prisma) => {
            // Period lock check
            await assertPeriodOpen(new Date())

            // Generate payment number
            const year = new Date().getFullYear()
            const count = await prisma.payment.count({
                where: { number: { startsWith: `PAY-${year}` } }
            })
            const paymentNumber = `PAY-${year}-${String(count + 1).padStart(4, '0')}`

            const payment = await prisma.payment.create({
                data: {
                    number: paymentNumber,
                    customerId: data.customerId,
                    amount: data.amount,
                    date: data.date || new Date(),
                    method: data.method || 'TRANSFER',
                    reference: data.reference,
                    notes: data.notes,
                    invoiceId: data.invoiceId || null
                }
            })

            // If linked to invoice, update invoice balance
            if (data.invoiceId) {
                const invoice = await prisma.invoice.findUnique({
                    where: { id: data.invoiceId }
                })

                if (invoice) {
                    const newBalance = Number(invoice.balanceDue) - data.amount
                    await prisma.invoice.update({
                        where: { id: data.invoiceId },
                        data: {
                            balanceDue: newBalance,
                            status: newBalance <= 0 ? 'PAID' : 'PARTIAL'
                        }
                    })

                    // Post GL Entry: DR Cash, CR AR
                    try {
                        const glResult = await postJournalEntry({
                            description: `Payment ${paymentNumber} for Invoice ${invoice.number}`,
                            date: data.date || new Date(),
                            reference: paymentNumber,
                            lines: [
                                { accountCode: '1000', debit: data.amount, credit: 0 }, // Cash
                                { accountCode: '1100', debit: 0, credit: data.amount }  // AR
                            ]
                        })
                        if (!glResult?.success) {
                            console.error("GL posting failed:", glResult?.error)
                        }
                    } catch (glError) {
                        console.error("GL posting failed (payment recorded):", glError)
                    }
                }
            }

            return { success: true, paymentId: payment.id, paymentNumber: payment.number }
        })
    } catch (error: any) {
        console.error("Failed to record AR payment:", error)
        return { success: false, error: error.message || "Failed to record payment" }
    }
}

/**
 * Match an existing unallocated payment to an invoice
 */
export async function matchPaymentToInvoice(paymentId: string, invoiceId: string) {
    try {
        return await withPrismaAuth(async (prisma) => {
            // Get payment and invoice
            const [payment, invoice] = await Promise.all([
                prisma.payment.findUnique({ where: { id: paymentId } }),
                prisma.invoice.findUnique({ where: { id: invoiceId } })
            ])

            if (!payment) throw new Error("Payment not found")
            if (!invoice) throw new Error("Invoice not found")
            if (payment.invoiceId) throw new Error("Payment already allocated")

            // Period lock check
            await assertPeriodOpen(new Date())

            const paymentAmount = Number(payment.amount)
            const newBalance = Number(invoice.balanceDue) - paymentAmount

            // Update payment
            await prisma.payment.update({
                where: { id: paymentId },
                data: { invoiceId: invoice.id }
            })

            // Update invoice
            await prisma.invoice.update({
                where: { id: invoiceId },
                data: {
                    balanceDue: newBalance,
                    status: newBalance <= 0 ? 'PAID' : 'PARTIAL'
                }
            })

            // Post GL Entry: DR Cash, CR AR
            try {
                const glResult = await postJournalEntry({
                    description: `Payment ${payment.number} matched to Invoice ${invoice.number}`,
                    date: payment.date,
                    reference: payment.number,
                    lines: [
                        { accountCode: '1000', debit: paymentAmount, credit: 0 }, // Cash
                        { accountCode: '1100', debit: 0, credit: paymentAmount }  // AR
                    ]
                })
                if (!glResult?.success) {
                    console.error("GL posting failed:", glResult?.error)
                }
            } catch (glError) {
                console.error("GL posting failed (match recorded):", glError)
            }

            return { success: true, message: `Payment matched to invoice ${invoice.number}` }
        })
    } catch (error: any) {
        console.error("Failed to match payment:", error)
        return { success: false, error: error.message || "Failed to match payment" }
    }
}

/**
 * Get AR Payment summary stats
 */
export async function getARPaymentStats() {
    try {
        const [unallocated, openInvoices] = await Promise.all([
            getUnallocatedPayments(),
            getOpenInvoices()
        ])

        // Get today's payments using Prisma
        let todayTotal = 0
        try {
            const today = new Date()
            today.setHours(0, 0, 0, 0)

            const result = await withPrismaAuth(async (prisma) => {
                const payments = await prisma.payment.findMany({
                    where: {
                        date: { gte: today },
                        customerId: { not: null }
                    },
                    select: { amount: true }
                })
                return payments.reduce((sum, p) => sum + Number(p.amount), 0)
            })
            todayTotal = result
        } catch (e) {
            console.error("Failed to get today payments:", e)
        }

        const totalUnallocated = unallocated.reduce((sum, p) => sum + p.amount, 0)
        const totalOutstanding = openInvoices.reduce((sum, inv) => sum + inv.balanceDue, 0)

        return {
            unallocatedCount: unallocated.length,
            unallocatedAmount: totalUnallocated,
            openInvoicesCount: openInvoices.length,
            outstandingAmount: totalOutstanding,
            todayPayments: todayTotal
        }
    } catch (error) {
        console.error("Failed to fetch AR stats:", error)
        return {
            unallocatedCount: 0,
            unallocatedAmount: 0,
            openInvoicesCount: 0,
            outstandingAmount: 0,
            todayPayments: 0
        }
    }
}

// ==========================================
// VENDOR BILLS (AP - From Purchase Orders)
// ==========================================

export interface VendorBill {
    id: string
    number: string
    vendor: {
        id: string;
        name: string;
        bankName?: string;
        bankAccountNumber?: string;
        bankAccountName?: string;
    } | null
    purchaseOrderNumber?: string
    date: Date
    dueDate: Date
    amount: number
    balanceDue: number
    status: string
    isOverdue: boolean
    payments?: { id: string; amount: number; method: string; reference: string | null; date: Date }[]
}

/**
 * Get all pending vendor bills (AP invoices)
 */
export async function getVendorBills(): Promise<VendorBill[]> {
    try {
        return await withPrismaAuth(async (prisma) => {
            const bills = await prisma.invoice.findMany({
                where: {
                    type: 'INV_IN', // Vendor bills
                    status: { in: ['DRAFT', 'ISSUED', 'PARTIAL', 'OVERDUE', 'DISPUTED'] }
                },
                include: {
                    supplier: {
                        select: {
                            id: true,
                            name: true,
                            bankName: true,
                            bankAccountNumber: true,
                            bankAccountName: true
                        }
                    }
                },
                orderBy: { dueDate: 'asc' },
                take: 100
            })

            const now = new Date()
            return bills.map((bill) => ({
                id: bill.id,
                number: bill.number,
                vendor: bill.supplier ? {
                    id: bill.supplier.id,
                    name: bill.supplier.name,
                    bankName: bill.supplier.bankName || undefined,
                    bankAccountNumber: bill.supplier.bankAccountNumber || undefined,
                    bankAccountName: bill.supplier.bankAccountName || undefined
                } : null,
                purchaseOrderNumber: (bill as any).purchaseOrderId || undefined,
                date: bill.issueDate,
                dueDate: bill.dueDate,
                amount: Number(bill.totalAmount),
                balanceDue: Number(bill.balanceDue),
                status: bill.status,
                isOverdue: bill.dueDate < new Date(now.getFullYear(), now.getMonth(), now.getDate()) && bill.status !== 'PAID'
            }))
        })
    } catch (error) {
        console.error("Failed to fetch vendor bills:", error)
        return []
    }
}

/**
 * Approve a vendor bill and post to GL
 */
export async function approveVendorBill(billId: string) {
    try {
        return await withPrismaAuth(async (prisma) => {
            // 1. Get Bill Details
            const bill = await prisma.invoice.findUnique({
                where: { id: billId },
                include: {
                    supplier: true,
                    items: {
                        include: { product: true }
                    }
                }
            })

            if (!bill) throw new Error("Bill not found")
            if (bill.status !== 'DRAFT') throw new Error("Bill already processed")

            // Period lock check
            await assertPeriodOpen(new Date())

            // 2. Update Status to ISSUED (Approved)
            await prisma.invoice.update({
                where: { id: billId },
                data: { status: 'ISSUED' } // Ready for payment
            })

            // 3. Post to General Ledger (Accrual Basis)
            // Debit: Expense / Asset
            // Credit: Accounts Payable (Liability)

            // Prepare GL Lines
            const glLines: any[] = []
            let totalAmount = 0

            // Credit AP (Liability increases)
            // Using standard AP code '2000' (from seed/setup)
            const apAccount = await prisma.gLAccount.findFirst({ where: { code: '2000' } })
            if (!apAccount) throw new Error("AP Account (2000) not configured")

            // Determine Debit Accounts (Expenses/Assets)
            for (const item of bill.items) {
                const amount = Number(item.amount)
                totalAmount += amount

                // Attempt to find expense account from product, else default
                const debitAccountCode = '6000' // Default Expense
                // If we had product.expenseAccount relation, we'd use it here.
                // For now, let's look for a suitable account based on context or default.

                // TODO: enhance with product-specific accounts in future
                const expenseAccount = await prisma.gLAccount.findFirst({ where: { code: debitAccountCode } })

                if (expenseAccount) {
                    glLines.push({
                        accountCode: debitAccountCode,
                        debit: amount,
                        credit: 0,
                        description: `${item.description} (Qty: ${item.quantity})`
                    })
                } else {
                    // Fallback if 6000 doesn't exist, try getting any Expense account
                    const anyExpense = await prisma.gLAccount.findFirst({ where: { type: 'EXPENSE' } })
                    if (anyExpense) {
                        glLines.push({
                            accountCode: anyExpense.code,
                            debit: amount,
                            credit: 0,
                            description: `${item.description}`
                        })
                    } else {
                        // Absolute fallback (should not happen in prod)
                        console.warn("No Expense account found for bill item")
                    }
                }
            }

            // Add Tax if applicable (Input VAT - Asset)
            if (Number(bill.taxAmount) > 0) {
                const vatInAccount = await prisma.gLAccount.findFirst({ where: { code: '1330' } }) // VAT In
                if (vatInAccount) {
                    glLines.push({
                        accountCode: '1330',
                        debit: Number(bill.taxAmount),
                        credit: 0,
                        description: `VAT In - Bill ${bill.number}`
                    })
                    totalAmount += Number(bill.taxAmount)
                }
            }

            // Add AP Credit Line
            glLines.push({
                accountCode: '2100',
                debit: 0,
                credit: totalAmount, // Should match bill total
                description: `AP - ${bill.supplier?.name}`
            })

            // Post Journal Entry
            const glResult = await postJournalEntry({
                description: `Bill Approval #${bill.number} - ${bill.supplier?.name}`,
                date: new Date(),
                reference: bill.number,
                lines: glLines
            })
            if (!glResult?.success) {
                console.error("GL posting failed:", glResult?.error)
            }

            return { success: true }
        })
    } catch (error: any) {
        console.error("Failed to approve bill:", error)
        return { success: false, error: error.message }
    }
}

// ==========================================
// VENDOR PAYMENTS (AP Payments)
// ==========================================

export interface VendorPayment {
    id: string
    number: string
    vendor: {
        id: string
        name: string
        bankName?: string
        bankAccountNumber?: string
        bankAccountName?: string
    } | null
    date: Date
    amount: number
    method: string
    reference?: string
    notes?: string
    billNumber?: string
}

/**
 * Get vendor payment history
 */
export async function getVendorPayments(): Promise<VendorPayment[]> {
    try {
        return await withPrismaAuth(async (prisma) => {
            const payments = await prisma.payment.findMany({
                where: {
                    supplierId: { not: null }
                },
                include: {
                    supplier: { select: { id: true, name: true, bankName: true, bankAccountNumber: true, bankAccountName: true } },
                    invoice: { select: { number: true } }
                },
                orderBy: { date: 'desc' },
                take: 50
            })

            return payments.map((p) => ({
                id: p.id,
                number: p.number,
                vendor: p.supplier ? {
                    id: p.supplier.id,
                    name: p.supplier.name,
                    bankName: p.supplier.bankName || undefined,
                    bankAccountNumber: p.supplier.bankAccountNumber || undefined,
                    bankAccountName: p.supplier.bankAccountName || undefined,
                } : null,
                date: p.date,
                amount: Number(p.amount),
                method: p.method,
                reference: p.reference || undefined,
                notes: p.notes || undefined,
                billNumber: p.invoice?.number
            }))
        })
    } catch (error) {
        console.error("Failed to fetch vendor payments:", error)
        return []
    }
}

/**
 * Record a vendor payment (pay a bill)
 */
export async function recordVendorPayment(data: {
    supplierId: string
    billId?: string
    amount: number
    method?: 'CASH' | 'TRANSFER' | 'CHECK'
    reference?: string
    notes?: string
    bankAccountCode?: string
}) {
    try {
        return await withPrismaAuth(async (prisma) => {
            // Period lock check
            await assertPeriodOpen(new Date())

            // Generate payment number
            const year = new Date().getFullYear()
            const count = await prisma.payment.count({
                where: { number: { startsWith: `VPAY-${year}` } }
            })
            const paymentNumber = `VPAY-${year}-${String(count + 1).padStart(4, '0')}`

            // Auto-derive method for Payment record from selected account name
            const selectedBankCode = data.bankAccountCode || SYS_ACCOUNTS.BANK_BCA
            const bankAcctForMethod = await prisma.gLAccount.findFirst({ where: { code: selectedBankCode }, select: { name: true } })
            const derivedMethod = data.method || (bankAcctForMethod && /kas|cash|petty/i.test(bankAcctForMethod.name) ? 'CASH' : 'TRANSFER')

            const payment = await prisma.payment.create({
                data: {
                    number: paymentNumber,
                    supplierId: data.supplierId,
                    invoiceId: data.billId,
                    amount: data.amount,
                    date: new Date(),
                    method: derivedMethod,
                    reference: data.reference,
                    notes: data.notes || undefined
                }
            })

            // If linked to bill, update bill balance
            if (data.billId) {
                const bill = await prisma.invoice.findUnique({
                    where: { id: data.billId }
                })
                if (bill) {
                    const newBalance = Number(bill.balanceDue) - data.amount
                    await prisma.invoice.update({
                        where: { id: data.billId },
                        data: {
                            balanceDue: Math.max(0, newBalance),
                            status: newBalance <= 0 ? 'PAID' : 'PARTIAL'
                        }
                    })
                }
            }

            // Use selected COA account directly — no method→account mapping
            const bankCode = data.bankAccountCode || SYS_ACCOUNTS.BANK_BCA
            let bankAccountName = 'Cash/Bank'
            try {
                const bankAcct = await prisma.gLAccount.findFirst({ where: { code: bankCode } })
                if (bankAcct) bankAccountName = bankAcct.name
            } catch { /* fallback to default name */ }

            // Post GL entry: DR Hutang Usaha, CR Cash/Bank
            await ensureSystemAccounts()
            const glResult = await postJournalEntry({
                description: `Pembayaran Vendor ${paymentNumber}`,
                date: new Date(),
                reference: paymentNumber,
                lines: [
                    { accountCode: SYS_ACCOUNTS.AP, debit: data.amount, credit: 0, description: 'Pelunasan Hutang Usaha' },
                    { accountCode: bankCode, debit: 0, credit: data.amount, description: bankAccountName }
                ]
            })
            if (!glResult?.success) {
                throw new Error(`Jurnal gagal — pembayaran dibatalkan: ${(glResult as any)?.error || 'Unknown GL error'}`)
            }

            return { success: true, paymentId: payment.id, paymentNumber }
        })
    } catch (error: any) {
        console.error("Failed to record vendor payment:", error)
        return { success: false, error: error.message }
    }
}

// Re-export multi-bill payment from finance-ap as async wrapper functions
// ("use server" files can only export async functions)
export async function recordMultiBillPayment(...args: Parameters<typeof import("./finance-ap").recordMultiBillPayment>) {
    const { recordMultiBillPayment: fn } = await import("./finance-ap")
    return fn(...args)
}

export async function getVendorAPBalances() {
    const { getVendorAPBalances: fn } = await import("./finance-ap")
    return fn()
}

export type { BillAllocation } from "./finance-ap"

// ==========================================
// CHART OF ACCOUNTS (COA)
// ==========================================

export interface GLAccountNode {
    id: string
    code: string
    name: string
    type: string
    subType: string
    balance: number
    parentId: string | null
    isSystem: boolean
    children: GLAccountNode[]
}

/**
 * Get Chart of Accounts as flat list with balances
 */
export async function getChartOfAccountsTree(): Promise<GLAccountNode[]> {
    try {
        return await withPrismaAuth(async (prisma) => {
            const accounts = await prisma.gLAccount.findMany({
                orderBy: { code: 'asc' }
            })

            // Calculate balances from journal entries
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

            // Build tree structure
            const _accountMap = new Map<string, GLAccountNode>()
            const roots: GLAccountNode[] = []

            // Create flat list grouped by type (since no parentId in schema)
            accounts.forEach(acc => {
                roots.push({
                    id: acc.id,
                    code: acc.code,
                    name: acc.name,
                    type: acc.type,
                    subType: acc.subType,
                    balance: balanceMap.get(acc.id) || 0,
                    parentId: acc.parentId,
                    children: []
                })
            })

            // Sort by code for organized display
            roots.sort((a, b) => a.code.localeCompare(b.code))

            return roots
        })
    } catch (error) {
        console.error("Failed to fetch COA tree:", error)
        return []
    }
}

/**
 * Get flat list of GL accounts for dropdowns
 */
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

/**
 * Create a new GL account
 */
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
// JOURNAL ENTRIES (General Ledger)
// ==========================================

export interface JournalEntryItem {
    id: string
    date: Date
    description: string
    reference?: string
    status: string
    lines: {
        account: { code: string; name: string }
        debit: number
        credit: number
        description?: string
    }[]
    totalDebit: number
    totalCredit: number
}

/**
 * Get journal entries list
 */
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

/**
 * Get journal entry by ID
 */
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
// FINANCE STATS FOR DASHBOARD
// ==========================================

/**
 * Get AP (Accounts Payable) stats
 */
export async function getAPStats() {
    try {
        return await withPrismaAuth(async (prisma) => {
            const now = new Date()

            // Total payables
            const payables = await prisma.invoice.aggregate({
                where: {
                    type: 'INV_IN',
                    status: { in: ['ISSUED', 'PARTIAL', 'OVERDUE'] }
                },
                _sum: { balanceDue: true },
                _count: true
            })

            // Overdue payables
            const overdue = await prisma.invoice.aggregate({
                where: {
                    type: 'INV_IN',
                    status: { in: ['ISSUED', 'PARTIAL', 'OVERDUE'] },
                    dueDate: { lt: now }
                },
                _sum: { balanceDue: true },
                _count: true
            })

            // This month payments
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
            const monthPayments = await prisma.payment.aggregate({
                where: {
                    supplierId: { not: null },
                    date: { gte: monthStart }
                },
                _sum: { amount: true }
            })

            return {
                totalPayables: Number(payables._sum.balanceDue || 0),
                payablesCount: payables._count,
                overduePayables: Number(overdue._sum.balanceDue || 0),
                overdueCount: overdue._count,
                monthPayments: Number(monthPayments._sum.amount || 0)
            }
        })
    } catch (error) {
        console.error("Failed to fetch AP stats:", error)
        return {
            totalPayables: 0,
            payablesCount: 0,
            overduePayables: 0,
            overdueCount: 0,
            monthPayments: 0
        }
    }
}



// ==========================================
// BILL ACTIONS (Dispute & Pay)
// ==========================================

/**
 * Dispute a vendor bill
 */
export async function disputeBill(billId: string, reason: string) {
    try {
        return await withPrismaAuth(async (prisma) => {
            await prisma.invoice.update({
                where: { id: billId },
                data: {
                    status: 'DISPUTED' as InvoiceStatus,
                    notes: `Dispute Reason: ${reason}\n` + (await prisma.invoice.findUnique({ where: { id: billId }, select: { notes: true } }))?.notes || ''
                }
            })
            return { success: true }
        })
    } catch (error: any) {
        console.error("Failed to dispute bill:", error)
        return { success: false, error: error.message }
    }
}

/**
 * Approve and Pay a vendor bill immediately
 */
export async function approveAndPayBill(
    billId: string,
    paymentDetails: {
        amount: number,
        bankName?: string,
        bankAccountNumber?: string,
        bankAccountName?: string,
        notes?: string
    }
) {
    try {
        return await withPrismaAuth(async (prisma) => {
            // 1. Get Bill
            const bill = await prisma.invoice.findUnique({
                where: { id: billId },
                include: { supplier: true, items: { include: { product: true } } }
            })
            if (!bill) throw new Error("Bill not found")

            // Period lock check
            await assertPeriodOpen(new Date())

            // 2. Update Supplier Bank Details if provided
            if (bill.supplierId && paymentDetails.bankAccountNumber) {
                await prisma.supplier.update({
                    where: { id: bill.supplierId },
                    data: {
                        bankName: paymentDetails.bankName,
                        bankAccountNumber: paymentDetails.bankAccountNumber,
                        bankAccountName: paymentDetails.bankAccountName
                    }
                })
            }

            // 3. Approve (Start GL Transaction: Debit Expense, Credit AP)
            // If already ISSUED (Approved), skip this step?

            if (bill.status === 'DRAFT' || bill.status === 'DISPUTED' as InvoiceStatus) { // DRAFT or DISPUTED
                // Update Status
                await prisma.invoice.update({ where: { id: billId }, data: { status: 'ISSUED' } })

                // Post AP Journal (Expense vs AP)
                await ensureSystemAccounts()
                const glLines: { accountCode: string; debit: number; credit: number; description: string }[] = []
                let totalAmount = 0

                // Add Expense Lines — DR Beban (Expense)
                // Vendor bills debit EXPENSE_DEFAULT (6900). COGS (5000) is only debited when inventory items are SOLD, not when purchased.
                for (const item of bill.items) {
                    const amount = Number(item.amount)
                    totalAmount += amount
                    glLines.push({
                        accountCode: SYS_ACCOUNTS.EXPENSE_DEFAULT,
                        debit: amount,
                        credit: 0,
                        description: `${item.description}`
                    })
                }

                // Add Tax — DR PPN Masukan
                if (Number(bill.taxAmount) > 0) {
                    glLines.push({
                        accountCode: SYS_ACCOUNTS.PPN_MASUKAN,
                        debit: Number(bill.taxAmount),
                        credit: 0,
                        description: `PPN Masukan - Bill ${bill.number}`
                    })
                    totalAmount += Number(bill.taxAmount)
                }

                // Add AP Credit — CR Hutang Usaha
                glLines.push({
                    accountCode: SYS_ACCOUNTS.AP,
                    debit: 0,
                    credit: totalAmount,
                    description: `Hutang - ${bill.supplier?.name}`
                })

                const approvalGl = await postJournalEntry({
                    description: `Tagihan Pembelian ${bill.number} - ${bill.supplier?.name}`,
                    date: new Date(),
                    reference: bill.number,
                    lines: glLines
                })
                if (!approvalGl?.success) {
                    console.error("GL posting failed:", approvalGl?.error)
                }
            }

            // 4. Pay (Debit AP, Credit Cash/Bank)
            const paymentNumber = `PAY-${Date.now()}` // Simple gen

            // Create Payment Record
            const _payment = await prisma.payment.create({
                data: {
                    number: paymentNumber,
                    amount: paymentDetails.amount,
                    method: 'TRANSFER',
                    date: new Date(),
                    invoiceId: billId,
                    supplierId: bill.supplierId,
                    reference: `REF-${bill.number}`,
                    notes: `Paid to ${paymentDetails.bankName} - ${paymentDetails.bankAccountNumber}`
                }
            })

            // Update Invoice to PAID
            await prisma.invoice.update({
                where: { id: billId },
                data: { status: 'PAID', balanceDue: 0 }
            })

            // Post Cash Journal — DR Hutang Usaha, CR Bank
            const paymentGl = await postJournalEntry({
                description: `Pembayaran ${bill.supplier?.name} - ${bill.number}`,
                date: new Date(),
                reference: paymentNumber,
                lines: [
                    { accountCode: SYS_ACCOUNTS.AP, debit: paymentDetails.amount, credit: 0, description: `Pelunasan hutang ${bill.number}` },
                    { accountCode: SYS_ACCOUNTS.BANK_BCA, debit: 0, credit: paymentDetails.amount, description: `Transfer ke ${bill.supplier?.name}` }
                ]
            })
            if (!paymentGl?.success) {
                console.error("GL posting failed:", paymentGl?.error)
            }

            return { success: true }
        })
    } catch (error: any) {
        console.error("Failed to approve and pay bill:", error)
        return { success: false, error: error.message }
    }
}

// ==========================================
// FINANCE DASHBOARD DATA (aggregated view)
// ==========================================

export async function getFinanceDashboardData() {
    try {
        // Auth check (lightweight, no transaction)
        const supabaseServer = await createClient()
        const { data: { user }, error: authErr } = await supabaseServer.auth.getUser()
        if (authErr || !user) throw new Error('Not authenticated')

        const now = new Date()

        // Build 7-day cash flow skeleton
        const cashFlow: Array<{ date: string; day: string; incoming: number; outgoing: number }> = []
        for (let i = 6; i >= 0; i--) {
            const d = new Date(now)
            d.setDate(d.getDate() - i)
            cashFlow.push({
                date: d.toISOString().slice(0, 10),
                day: d.toLocaleDateString('id-ID', { weekday: 'short' }),
                incoming: 0,
                outgoing: 0,
            })
        }

        const sevenDaysAgo = new Date(now)
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        sevenDaysAgo.setHours(0, 0, 0, 0)

        // Single parallel fetch using prisma singleton (no transaction overhead)
        const [cashFlowEntries, recentEntries, overdueInvoices, pendingBills] = await Promise.all([
            basePrisma.journalEntry.findMany({
                where: { date: { gte: sevenDaysAgo } },
                include: { lines: { include: { account: { select: { code: true, type: true } } } } },
            }),
            basePrisma.journalEntry.findMany({
                orderBy: { date: 'desc' },
                take: 5,
                include: {
                    lines: { take: 2, include: { account: { select: { name: true, code: true, type: true } } } },
                },
            }),
            basePrisma.invoice.count({
                where: { status: 'OVERDUE', type: 'INV_OUT' },
            }),
            basePrisma.invoice.count({
                where: { status: { in: ['DRAFT', 'ISSUED'] }, type: 'INV_IN' },
            }),
        ])

        // Populate cash flow from journal entries — only cash/bank accounts (10xx)
        for (const entry of cashFlowEntries) {
            const dateKey = new Date(entry.date).toISOString().slice(0, 10)
            const dayEntry = cashFlow.find(cf => cf.date === dateKey)
            if (!dayEntry) continue
            for (const line of entry.lines) {
                const code = line.account?.code || ''
                if (code >= '1000' && code < '1100') {
                    dayEntry.incoming += Number(line.debit)
                    dayEntry.outgoing += Number(line.credit)
                }
            }
        }

        // Map recent transactions
        const recentTransactions = recentEntries.map(e => {
            const firstLine = e.lines[0]
            const accountCode = firstLine?.account?.code || ''
            const isIncoming = accountCode.startsWith('4') || (accountCode.startsWith('2') && Number(firstLine?.credit || 0) > 0)
            return {
                id: e.id,
                title: e.description || 'Jurnal Umum',
                subtitle: firstLine?.account?.name || 'N/A',
                date: e.date.toISOString(),
                direction: isIncoming ? 'in' as const : 'out' as const,
                amount: Math.max(Number(firstLine?.debit || 0), Number(firstLine?.credit || 0)),
                href: `/finance/journal`,
            }
        })

        // Build action items
        const actionItems: Array<{ id: string; title: string; type: 'urgent' | 'pending' | 'warning' | 'info'; due: string; href: string }> = []
        if (overdueInvoices > 0) {
            actionItems.push({
                id: 'overdue-invoices',
                title: `${overdueInvoices} invoice jatuh tempo`,
                type: 'urgent',
                due: 'Segera',
                href: '/finance/invoices',
            })
        }
        if (pendingBills > 0) {
            actionItems.push({
                id: 'pending-bills',
                title: `${pendingBills} bill menunggu pembayaran`,
                type: 'pending',
                due: 'Minggu ini',
                href: '/finance/bills',
            })
        }

        return { cashFlow, recentTransactions, actionItems }
    } catch (error) {
        console.error("Failed to get finance dashboard data:", error)
        return {
            cashFlow: [],
            recentTransactions: [],
            actionItems: [],
        }
    }
}

// ==========================================
// AR PAYMENT REGISTRY (paginated view)
// ==========================================

export async function getARPaymentRegistry(params: {
    paymentsQ?: string
    invoicesQ?: string
    customerId?: string
    paymentPage?: number
    invoicePage?: number
    pageSize?: number
}) {
    const pageSize = params.pageSize || 20
    const paymentPage = Math.max(1, params.paymentPage || 1)
    const invoicePage = Math.max(1, params.invoicePage || 1)

    try {
        const [unallocated, openInvoices, allCustomers, recentPayments] = await Promise.all([
            getUnallocatedPayments(),
            getOpenInvoices(),
            basePrisma.customer.findMany({
                where: { isActive: true },
                select: { id: true, name: true, code: true },
                orderBy: { name: 'asc' },
                take: 500,
            }),
            basePrisma.payment.findMany({
                where: {
                    invoiceId: { not: null },
                    customerId: { not: null },
                },
                orderBy: { createdAt: 'desc' },
                take: 20,
                select: {
                    id: true, amount: true, method: true, reference: true, createdAt: true,
                    invoice: { select: { id: true, number: true, status: true } },
                },
            }),
        ])

        // Client-side filtering
        let filteredPayments = unallocated
        if (params.paymentsQ) {
            const q = params.paymentsQ.toLowerCase()
            filteredPayments = unallocated.filter(p =>
                p.from.toLowerCase().includes(q) || p.number.toLowerCase().includes(q)
            )
        }
        if (params.customerId) {
            filteredPayments = filteredPayments.filter(p => p.customerId === params.customerId)
        }

        let filteredInvoices = openInvoices
        if (params.invoicesQ) {
            const q = params.invoicesQ.toLowerCase()
            filteredInvoices = openInvoices.filter(inv =>
                inv.number.toLowerCase().includes(q) ||
                (inv.customer?.name || '').toLowerCase().includes(q)
            )
        }
        if (params.customerId) {
            filteredInvoices = filteredInvoices.filter(inv => inv.customer?.id === params.customerId)
        }

        // Paginate
        const paginatedPayments = filteredPayments.slice((paymentPage - 1) * pageSize, paymentPage * pageSize)
        const paginatedInvoices = filteredInvoices.slice((invoicePage - 1) * pageSize, invoicePage * pageSize)

        return {
            unallocated: paginatedPayments,
            openInvoices: paginatedInvoices,
            recentPayments: recentPayments.map(p => ({
                id: p.id,
                amount: Number(p.amount),
                method: p.method,
                reference: p.reference,
                createdAt: p.createdAt,
                invoice: p.invoice ? { id: p.invoice.id, number: p.invoice.number, status: p.invoice.status } : null,
            })),
            allCustomers: allCustomers.map(c => ({ id: c.id, name: c.name, code: c.code })),
            meta: {
                payments: { page: paymentPage, pageSize, total: filteredPayments.length, totalPages: Math.ceil(filteredPayments.length / pageSize) },
                invoices: { page: invoicePage, pageSize, total: filteredInvoices.length, totalPages: Math.ceil(filteredInvoices.length / pageSize) },
            },
            query: {
                paymentsQ: params.paymentsQ || null,
                invoicesQ: params.invoicesQ || null,
                customerId: params.customerId || null,
            }
        }
    } catch (error) {
        console.error("Failed to get AR payment registry:", error)
        return {
            unallocated: [],
            openInvoices: [],
            recentPayments: [] as { id: string; amount: number; method: string; reference: string | null; createdAt: Date; invoice: { id: string; number: string; status: string } | null }[],
            allCustomers: [],
            meta: {
                payments: { page: 1, pageSize, total: 0, totalPages: 0 },
                invoices: { page: 1, pageSize, total: 0, totalPages: 0 },
            },
            query: {
                paymentsQ: params.paymentsQ || null,
                invoicesQ: params.invoicesQ || null,
                customerId: params.customerId || null,
            }
        }
    }
}

// ==========================================
// VENDOR BILLS REGISTRY (paginated AP view)
// ==========================================

type VendorBillQueryInput = {
    q?: string | null
    status?: string | null
    page?: number | null
    pageSize?: number | null
}

export interface VendorBillRegistryResult {
    rows: VendorBill[]
    meta: {
        page: number
        pageSize: number
        total: number
        totalPages: number
    }
    query: {
        q: string | null
        status: string | null
    }
}

const normalizeVendorBillQuery = (input?: VendorBillQueryInput) => {
    const trimmedQ = (input?.q || "").trim()
    const trimmedStatus = (input?.status || "").trim().toUpperCase()
    const pageRaw = Number(input?.page)
    const pageSizeRaw = Number(input?.pageSize)
    return {
        q: trimmedQ.length > 0 ? trimmedQ : null,
        status: trimmedStatus.length > 0 ? trimmedStatus : null,
        page: Number.isFinite(pageRaw) ? Math.max(1, Math.trunc(pageRaw)) : 1,
        pageSize: Number.isFinite(pageSizeRaw) ? Math.min(50, Math.max(6, Math.trunc(pageSizeRaw))) : 12,
    }
}

export async function getVendorBillsRegistry(input?: VendorBillQueryInput): Promise<VendorBillRegistryResult> {
    const query = normalizeVendorBillQuery(input)

    try {
        return await withPrismaAuth(async (prisma) => {
            const where: any = {
                type: 'INV_IN',
                status: { in: ['DRAFT', 'ISSUED', 'PARTIAL', 'OVERDUE', 'DISPUTED', 'PAID', 'VOID', 'CANCELLED'] }
            }

            if (query.status) where.status = { equals: query.status }
            if (query.q) {
                where.OR = [
                    { number: { contains: query.q, mode: 'insensitive' } },
                    { supplier: { name: { contains: query.q, mode: 'insensitive' } } }
                ]
            }

            const [bills, total] = await Promise.all([
                prisma.invoice.findMany({
                    where,
                    include: {
                        supplier: {
                            select: {
                                id: true,
                                name: true,
                                bankName: true,
                                bankAccountNumber: true,
                                bankAccountName: true
                            }
                        },
                        payments: {
                            select: {
                                id: true,
                                amount: true,
                                method: true,
                                reference: true,
                                date: true,
                            },
                            orderBy: { date: 'desc' },
                            take: 3,
                        }
                    },
                    orderBy: [{ dueDate: 'asc' }, { issueDate: 'desc' }],
                    skip: (query.page - 1) * query.pageSize,
                    take: query.pageSize
                }),
                prisma.invoice.count({ where })
            ])

            const now = new Date()
            const rows: VendorBill[] = bills.map((bill) => ({
                id: bill.id,
                number: bill.number,
                vendor: bill.supplier ? {
                    id: bill.supplier.id,
                    name: bill.supplier.name,
                    bankName: bill.supplier.bankName || undefined,
                    bankAccountNumber: bill.supplier.bankAccountNumber || undefined,
                    bankAccountName: bill.supplier.bankAccountName || undefined
                } : null,
                purchaseOrderNumber: (bill as any).purchaseOrderId || undefined,
                date: bill.issueDate,
                dueDate: bill.dueDate,
                amount: Number(bill.totalAmount),
                balanceDue: Number(bill.balanceDue),
                status: bill.status,
                isOverdue: bill.dueDate < new Date(now.getFullYear(), now.getMonth(), now.getDate()) && bill.status !== 'PAID',
                payments: bill.payments?.map(p => ({
                    id: p.id,
                    amount: Number(p.amount),
                    method: p.method || 'TRANSFER',
                    reference: p.reference,
                    date: p.date,
                })) ?? [],
            }))

            return {
                rows,
                meta: {
                    page: query.page,
                    pageSize: query.pageSize,
                    total,
                    totalPages: Math.max(1, Math.ceil(total / query.pageSize))
                },
                query: {
                    q: query.q,
                    status: query.status,
                }
            }
        })
    } catch (error) {
        console.error("Failed to fetch vendor bills registry:", error)
        return {
            rows: [],
            meta: { page: 1, pageSize: query.pageSize, total: 0, totalPages: 1 },
            query: { q: query.q, status: query.status }
        }
    }
}

// ==========================================
// TRIAL BALANCE REPORT
// ==========================================
export async function getTrialBalance(startDate: Date, endDate: Date) {
    try {
        const supabaseClient = await createClient()
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
        if (authError || !user) throw new Error('Unauthorized')

            const accounts = await basePrisma.gLAccount.findMany({
                orderBy: { code: 'asc' },
                include: {
                    lines: {
                        where: {
                            entry: {
                                date: { gte: startDate, lte: endDate },
                                status: 'POSTED',
                            }
                        },
                        select: { debit: true, credit: true }
                    }
                }
            })

            let totalDebits = 0
            let totalCredits = 0

            const rows = accounts.map(acc => {
                const debit = acc.lines.reduce((sum, l) => sum + Number(l.debit), 0)
                const credit = acc.lines.reduce((sum, l) => sum + Number(l.credit), 0)
                totalDebits += debit
                totalCredits += credit

                return {
                    accountCode: acc.code,
                    accountName: acc.name,
                    accountType: acc.type,
                    debit,
                    credit,
                    balance: debit - credit,
                }
            }).filter(r => r.debit !== 0 || r.credit !== 0) // Only show accounts with activity

            return {
                rows,
                totals: {
                    totalDebits: Math.round(totalDebits * 100) / 100,
                    totalCredits: Math.round(totalCredits * 100) / 100,
                    difference: Math.round((totalDebits - totalCredits) * 100) / 100,
                    isBalanced: Math.abs(totalDebits - totalCredits) < 0.01,
                },
                period: { start: startDate, end: endDate },
            }
    } catch (error) {
        console.error("Failed to generate trial balance:", error)
        return {
            rows: [],
            totals: { totalDebits: 0, totalCredits: 0, difference: 0, isBalanced: true },
            period: { start: startDate, end: endDate },
        }
    }
}

// ==========================================
// REVENUE FROM INVOICES (Omzet / Pendapatan)
// ==========================================
// Calculates revenue from actual invoices issued (not GL journal entries).
// In accrual accounting: invoice issued = revenue recognized = piutang created.
// So total revenue (omzet) is always >= piutang outstanding.
export async function getRevenueFromInvoices(startDate?: Date | string, endDate?: Date | string) {
    try {
        const supabaseClient = await createClient()
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
        if (authError || !user) throw new Error('Unauthorized')

        const start = parseDateInput(startDate) || new Date(new Date().getFullYear(), 0, 1)
        const end = parseDateInput(endDate) || new Date()

        // Total revenue = sum of all non-cancelled outgoing invoices in period
        const invoices = await basePrisma.invoice.findMany({
            where: {
                type: 'INV_OUT',
                status: { notIn: ['CANCELLED', 'VOID'] },
                issueDate: { gte: start, lte: end },
            },
            select: { totalAmount: true, balanceDue: true },
        })

        const totalRevenue = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0)
        const totalPaid = invoices.reduce((sum, inv) => sum + (Number(inv.totalAmount || 0) - Number(inv.balanceDue || 0)), 0)
        const totalOutstanding = invoices.reduce((sum, inv) => sum + Number(inv.balanceDue || 0), 0)

        return {
            totalRevenue,
            totalPaid,
            totalOutstanding,
            invoiceCount: invoices.length,
        }
    } catch (error) {
        console.error("Failed to get revenue from invoices:", error)
        return { totalRevenue: 0, totalPaid: 0, totalOutstanding: 0, invoiceCount: 0 }
    }
}

// ==========================================
// AR AGING REPORT (Accounts Receivable)
// ==========================================
export async function getARAgingReport() {
    try {
        const supabaseClient = await createClient()
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
        if (authError || !user) throw new Error('Unauthorized')

            const openInvoices = await basePrisma.invoice.findMany({
                where: {
                    type: 'INV_OUT',
                    status: { in: ['ISSUED', 'PARTIAL', 'OVERDUE'] },
                },
                include: {
                    customer: { select: { id: true, name: true, code: true } },
                },
                orderBy: { dueDate: 'asc' },
            })

            // Normalize today to start-of-day to avoid timezone-related bucket misplacement
            const now = new Date()
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
            const buckets = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 }
            const customerMap = new Map<string, {
                customerId: string
                customerName: string
                customerCode: string | null
                current: number
                d1_30: number
                d31_60: number
                d61_90: number
                d90_plus: number
                total: number
                invoiceCount: number
                invoices: Array<{ id: string; invoiceNumber: string; dueDate: Date; balanceDue: number; bucket: string; status: string }>
            }>()

            const details: Array<{
                invoiceNumber: string
                customerName: string
                dueDate: Date
                balanceDue: number
                daysOverdue: number
                bucket: string
            }> = []

            for (const inv of openInvoices) {
                const d = new Date(inv.dueDate)
                const due = new Date(d.getFullYear(), d.getMonth(), d.getDate())
                const diffMs = today.getTime() - due.getTime()
                const daysOverdue = Math.floor(diffMs / (1000 * 60 * 60 * 24))
                const balance = toNum(inv.balanceDue)
                const custId = inv.customer?.id || 'unknown'
                const custName = inv.customer?.name || 'Tanpa Pelanggan'
                const custCode = inv.customer?.code ?? null

                let bucket: string = 'current'
                if (daysOverdue < 0) {
                    buckets.current += balance
                    bucket = 'current'
                } else if (daysOverdue <= 30) {
                    buckets.d1_30 += balance
                    bucket = daysOverdue === 0 ? 'jatuh-tempo' : '1-30'
                } else if (daysOverdue <= 60) {
                    buckets.d31_60 += balance
                    bucket = '31-60'
                } else if (daysOverdue <= 90) {
                    buckets.d61_90 += balance
                    bucket = '61-90'
                } else {
                    buckets.d90_plus += balance
                    bucket = '90+'
                }

                // Customer summary
                const existing = customerMap.get(custId) || {
                    customerId: custId, customerName: custName, customerCode: custCode,
                    current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0, total: 0, invoiceCount: 0,
                    invoices: [],
                }
                existing.invoiceCount++
                existing.total += balance
                if (bucket === 'current') existing.current += balance
                else if (bucket === '1-30') existing.d1_30 += balance
                else if (bucket === '31-60') existing.d31_60 += balance
                else if (bucket === '61-90') existing.d61_90 += balance
                else existing.d90_plus += balance
                existing.invoices.push({
                    id: inv.id,
                    invoiceNumber: inv.number,
                    dueDate: due,
                    balanceDue: balance,
                    bucket,
                    status: inv.status,
                })
                customerMap.set(custId, existing)

                details.push({
                    invoiceNumber: inv.number,
                    customerName: custName,
                    dueDate: due,
                    balanceDue: balance,
                    daysOverdue,
                    bucket,
                })
            }

            // ── Unapplied Credit Notes — negative rows in Current bucket ──
            // SALES_CN that are POSTED or PARTIAL with remaining unapplied balance
            // show as customer credit (negative outstanding) in "current" bucket
            const unappliedCNs = await basePrisma.debitCreditNote.findMany({
                where: {
                    type: 'SALES_CN',
                    status: { in: ['POSTED', 'PARTIAL'] },
                    customerId: { not: null },
                },
                include: {
                    customer: { select: { id: true, name: true, code: true } },
                },
            })

            for (const cn of unappliedCNs) {
                const unapplied = Number(cn.totalAmount) - Number(cn.settledAmount)
                if (unapplied <= 0.01) continue // fully settled, skip

                const negBalance = -unapplied
                buckets.current += negBalance

                const custId = cn.customer?.id || 'unknown'
                const custName = cn.customer?.name || 'Tanpa Pelanggan'
                const custCode = cn.customer?.code ?? null

                const existing = customerMap.get(custId) || {
                    customerId: custId, customerName: custName, customerCode: custCode,
                    current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0, total: 0, invoiceCount: 0,
                    invoices: [],
                }
                existing.current += negBalance
                existing.total += negBalance
                existing.invoices.push({
                    id: cn.id,
                    invoiceNumber: cn.number,
                    dueDate: cn.issueDate,
                    balanceDue: negBalance,
                    bucket: 'current',
                    status: 'CREDIT_NOTE',
                })
                customerMap.set(custId, existing)

                details.push({
                    invoiceNumber: cn.number,
                    customerName: custName,
                    dueDate: cn.issueDate,
                    balanceDue: negBalance,
                    daysOverdue: 0,
                    bucket: 'current',
                })
            }

            const totalOutstanding = buckets.current + buckets.d1_30 + buckets.d31_60 + buckets.d61_90 + buckets.d90_plus

            // Fetch DRAFT invoices separately (not mixed into aging buckets)
            const pendingInvoices = await basePrisma.invoice.findMany({
                where: {
                    type: 'INV_OUT',
                    status: 'DRAFT',
                },
                include: {
                    customer: { select: { id: true, name: true, code: true } },
                },
                orderBy: { createdAt: 'desc' },
            })

            const pending = pendingInvoices.map(inv => ({
                id: inv.id,
                invoiceNumber: inv.number,
                customerName: inv.customer?.name || 'Tanpa Pelanggan',
                customerId: inv.customer?.id || '',
                totalAmount: toNum(inv.totalAmount),
                createdAt: inv.createdAt,
                dueDate: inv.dueDate,
            }))

            return {
                summary: {
                    ...buckets,
                    totalOutstanding,
                    invoiceCount: openInvoices.length,
                },
                byCustomer: Array.from(customerMap.values()).sort((a, b) => b.total - a.total),
                details: details.sort((a, b) => b.daysOverdue - a.daysOverdue),
                pending,
            }
    } catch (error) {
        console.error("Failed to generate AR aging report:", error)
        return {
            summary: { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0, totalOutstanding: 0, invoiceCount: 0 },
            byCustomer: [],
            details: [],
            pending: [],
        }
    }
}

// ==========================================
// AP AGING REPORT (Accounts Payable)
// ==========================================
export async function getAPAgingReport() {
    try {
        const supabaseClient = await createClient()
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
        if (authError || !user) throw new Error('Unauthorized')

            const openBills = await basePrisma.invoice.findMany({
                where: {
                    type: 'INV_IN',
                    status: { in: ['ISSUED', 'PARTIAL', 'OVERDUE'] },
                },
                include: {
                    supplier: { select: { id: true, name: true, code: true } },
                },
                orderBy: { dueDate: 'asc' },
            })

            // Normalize today to start-of-day to avoid timezone-related bucket misplacement
            const now2 = new Date()
            const today = new Date(now2.getFullYear(), now2.getMonth(), now2.getDate())
            const buckets = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 }
            const supplierMap = new Map<string, {
                supplierId: string
                supplierName: string
                supplierCode: string | null
                current: number
                d1_30: number
                d31_60: number
                d61_90: number
                d90_plus: number
                total: number
                billCount: number
                bills: Array<{ id: string; billNumber: string; dueDate: Date; balanceDue: number; bucket: string; status: string }>
            }>()

            const details: Array<{
                billNumber: string
                supplierName: string
                dueDate: Date
                balanceDue: number
                daysOverdue: number
                bucket: string
            }> = []

            for (const bill of openBills) {
                const d = new Date(bill.dueDate)
                const due = new Date(d.getFullYear(), d.getMonth(), d.getDate())
                const diffMs = today.getTime() - due.getTime()
                const daysOverdue = Math.floor(diffMs / (1000 * 60 * 60 * 24))
                const balance = toNum(bill.balanceDue)
                const suppId = bill.supplier?.id || 'unknown'
                const suppName = bill.supplier?.name || 'Tanpa Supplier'
                const suppCode = bill.supplier?.code ?? null

                let bucket: string = 'current'
                if (daysOverdue < 0) {
                    buckets.current += balance
                    bucket = 'current'
                } else if (daysOverdue <= 30) {
                    buckets.d1_30 += balance
                    bucket = daysOverdue === 0 ? 'jatuh-tempo' : '1-30'
                } else if (daysOverdue <= 60) {
                    buckets.d31_60 += balance
                    bucket = '31-60'
                } else if (daysOverdue <= 90) {
                    buckets.d61_90 += balance
                    bucket = '61-90'
                } else {
                    buckets.d90_plus += balance
                    bucket = '90+'
                }

                const existing = supplierMap.get(suppId) || {
                    supplierId: suppId, supplierName: suppName, supplierCode: suppCode,
                    current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0, total: 0, billCount: 0,
                    bills: [],
                }
                existing.billCount++
                existing.total += balance
                if (bucket === 'current') existing.current += balance
                else if (bucket === '1-30') existing.d1_30 += balance
                else if (bucket === '31-60') existing.d31_60 += balance
                else if (bucket === '61-90') existing.d61_90 += balance
                else existing.d90_plus += balance
                existing.bills.push({
                    id: bill.id,
                    billNumber: bill.number,
                    dueDate: due,
                    balanceDue: balance,
                    bucket,
                    status: bill.status,
                })
                supplierMap.set(suppId, existing)

                details.push({
                    billNumber: bill.number,
                    supplierName: suppName,
                    dueDate: due,
                    balanceDue: balance,
                    daysOverdue,
                    bucket,
                })
            }

            // ── Unapplied Debit Notes — negative rows in Current bucket ──
            // PURCHASE_DN that are POSTED or PARTIAL with remaining unapplied balance
            // show as supplier credit (negative payable) in "current" bucket
            const unappliedDNs = await basePrisma.debitCreditNote.findMany({
                where: {
                    type: 'PURCHASE_DN',
                    status: { in: ['POSTED', 'PARTIAL'] },
                    supplierId: { not: null },
                },
                include: {
                    supplier: { select: { id: true, name: true, code: true } },
                },
            })

            for (const dn of unappliedDNs) {
                const unapplied = Number(dn.totalAmount) - Number(dn.settledAmount)
                if (unapplied <= 0.01) continue // fully settled, skip

                const negBalance = -unapplied
                buckets.current += negBalance

                const suppId = dn.supplier?.id || 'unknown'
                const suppName = dn.supplier?.name || 'Tanpa Supplier'
                const suppCode = dn.supplier?.code ?? null

                const existing = supplierMap.get(suppId) || {
                    supplierId: suppId, supplierName: suppName, supplierCode: suppCode,
                    current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0, total: 0, billCount: 0,
                    bills: [],
                }
                existing.current += negBalance
                existing.total += negBalance
                existing.bills.push({
                    id: dn.id,
                    billNumber: dn.number,
                    dueDate: dn.issueDate,
                    balanceDue: negBalance,
                    bucket: 'current',
                    status: 'DEBIT_NOTE',
                })
                supplierMap.set(suppId, existing)

                details.push({
                    billNumber: dn.number,
                    supplierName: suppName,
                    dueDate: dn.issueDate,
                    balanceDue: negBalance,
                    daysOverdue: 0,
                    bucket: 'current',
                })
            }

            const totalOutstanding = buckets.current + buckets.d1_30 + buckets.d31_60 + buckets.d61_90 + buckets.d90_plus

            // Fetch DRAFT bills separately (not mixed into aging buckets)
            const pendingBills = await basePrisma.invoice.findMany({
                where: {
                    type: 'INV_IN',
                    status: 'DRAFT',
                },
                include: {
                    supplier: { select: { id: true, name: true, code: true } },
                },
                orderBy: { createdAt: 'desc' },
            })

            const pending = pendingBills.map(bill => ({
                id: bill.id,
                invoiceNumber: bill.number,
                supplierName: bill.supplier?.name || 'Tanpa Supplier',
                supplierId: bill.supplier?.id || '',
                totalAmount: toNum(bill.totalAmount),
                createdAt: bill.createdAt,
                dueDate: bill.dueDate,
            }))

            return {
                summary: {
                    ...buckets,
                    totalOutstanding,
                    billCount: openBills.length,
                },
                bySupplier: Array.from(supplierMap.values()).sort((a, b) => b.total - a.total),
                details: details.sort((a, b) => b.daysOverdue - a.daysOverdue),
                pending,
            }
    } catch (error) {
        console.error("Failed to generate AP aging report:", error)
        return {
            summary: { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0, totalOutstanding: 0, billCount: 0 },
            bySupplier: [],
            details: [],
            pending: [],
        }
    }
}

// ─── Open Vendor Bills (for AP payment allocation) ─────────────────────────
export async function getOpenVendorBills() {
    try {
        return await withPrismaAuth(async (prisma) => {
            const bills = await prisma.invoice.findMany({
                where: {
                    type: 'INV_IN',
                    status: { in: ['ISSUED', 'PARTIAL', 'OVERDUE'] },
                },
                include: {
                    supplier: { select: { id: true, name: true, code: true } },
                },
                orderBy: { dueDate: 'asc' },
            })

            return bills.map(b => ({
                id: b.id,
                number: b.number,
                supplierId: b.supplierId,
                supplierName: b.supplier?.name ?? 'Unknown',
                amount: Number(b.totalAmount),
                balanceDue: Number(b.balanceDue ?? b.totalAmount),
                dueDate: b.dueDate,
                isOverdue: b.dueDate ? (() => { const d = new Date(b.dueDate); const t = new Date(); return d < new Date(t.getFullYear(), t.getMonth(), t.getDate()) })() : false,
            }))
        })
    } catch (error) {
        console.error("Failed to fetch open vendor bills:", error)
        return []
    }
}

// ─── Expenses Module (Buku Kas) ─────────────────────────────────────────────

interface RecordExpenseInput {
    description: string
    amount: number
    date: Date
    category: string
    expenseAccountId: string
    cashAccountId: string
    reference?: string
}

export async function recordExpense(input: RecordExpenseInput) {
    try {
        return await withPrismaAuth(async (prisma) => {
            const { description, amount, date, category, expenseAccountId, cashAccountId, reference } = input

            if (!description || amount <= 0) {
                return { success: false, error: "Deskripsi dan jumlah wajib diisi" }
            }

            await assertPeriodOpen(date)

            const count = await prisma.journalEntry.count({
                where: { description: { startsWith: '[EXPENSE]' } }
            })
            const num = `EXP-${String(count + 1).padStart(5, '0')}`

            const entry = await prisma.journalEntry.create({
                data: {
                    date,
                    description: `[EXPENSE] ${category}: ${description}`,
                    reference: reference || num,
                    status: 'POSTED',
                    lines: {
                        create: [
                            { account: { connect: { id: expenseAccountId } }, debit: amount, credit: 0, description: `${category} — ${description}` },
                            { account: { connect: { id: cashAccountId } }, credit: amount, debit: 0, description: `Pembayaran: ${description}` },
                        ]
                    }
                }
            })

            await prisma.gLAccount.update({ where: { id: expenseAccountId }, data: { balance: { increment: amount } } })
            await prisma.gLAccount.update({ where: { id: cashAccountId }, data: { balance: { decrement: amount } } })

            // Audit trail
            try {
                const sbClient = await createClient()
                const { data: { user: authUser } } = await sbClient.auth.getUser()
                if (authUser) {
                    await logAudit(prisma, {
                        entityType: "JournalEntry",
                        entityId: entry.id,
                        action: "CREATE",
                        userId: authUser.id,
                        userName: authUser.email || undefined,
                    })
                }
            } catch { /* audit is best-effort */ }

            return { success: true, entryId: entry.id, number: num }
        })
    } catch (error) {
        console.error("Failed to record expense:", error)
        return { success: false, error: "Gagal mencatat pengeluaran" }
    }
}

export async function getExpenses() {
    try {
        return await withPrismaAuth(async (prisma) => {
            const entries = await prisma.journalEntry.findMany({
                where: { description: { startsWith: '[EXPENSE]' } },
                include: {
                    lines: { include: { account: { select: { id: true, code: true, name: true } } } }
                },
                orderBy: { date: 'desc' },
                take: 200,
            })

            return entries.map(e => {
                const debitLine = e.lines.find(l => Number(l.debit) > 0)
                const creditLine = e.lines.find(l => Number(l.credit) > 0)
                const match = e.description.match(/^\[EXPENSE\]\s*(.+?):\s*(.+)$/)
                return {
                    id: e.id,
                    date: e.date,
                    category: match?.[1] ?? 'Lainnya',
                    description: match?.[2] ?? e.description,
                    amount: debitLine ? Number(debitLine.debit) : 0,
                    expenseAccount: debitLine?.account ?? null,
                    cashAccount: creditLine?.account ?? null,
                    reference: e.reference,
                    status: e.status,
                }
            })
        })
    } catch (error) {
        console.error("Failed to fetch expenses:", error)
        return []
    }
}

export async function getExpenseAccounts() {
    try {
        return await withPrismaAuth(async (prisma) => {
            const [expenseAccounts, revenueAccounts, cashAccounts] = await Promise.all([
                prisma.gLAccount.findMany({
                    where: { type: 'EXPENSE' },
                    select: { id: true, code: true, name: true },
                    orderBy: { code: 'asc' },
                }),
                prisma.gLAccount.findMany({
                    where: { type: 'REVENUE' },
                    select: { id: true, code: true, name: true },
                    orderBy: { code: 'asc' },
                }),
                prisma.gLAccount.findMany({
                    where: {
                        type: 'ASSET',
                        OR: [
                            { name: { contains: 'kas', mode: 'insensitive' as const } },
                            { name: { contains: 'cash', mode: 'insensitive' as const } },
                            { name: { contains: 'bank', mode: 'insensitive' as const } },
                            { code: { in: ['1000', '1010', '1020', '1100', '1110'] } },
                        ]
                    },
                    select: { id: true, code: true, name: true },
                    orderBy: { code: 'asc' },
                }),
            ])
            return { expenseAccounts, revenueAccounts, cashAccounts }
        })
    } catch (error) {
        console.error("Failed to fetch expense accounts:", error)
        return { expenseAccounts: [], revenueAccounts: [], cashAccounts: [] }
    }
}

// ─── Edit Payments with Lock Period ─────────────────────────────────────────

const LOCK_PERIOD_DAYS = 31

function isWithinLockPeriod(transactionDate: Date): boolean {
    const now = new Date()
    const diffMs = now.getTime() - new Date(transactionDate).getTime()
    const diffDays = diffMs / (1000 * 60 * 60 * 24)
    return diffDays <= LOCK_PERIOD_DAYS
}

interface EditPaymentInput {
    paymentId: string
    amount?: number
    reference?: string
    notes?: string
    date?: Date
}

export async function editARPayment(input: EditPaymentInput) {
    try {
        return await withPrismaAuth(async (prisma) => {
            const payment = await prisma.payment.findUnique({ where: { id: input.paymentId } })
            if (!payment) return { success: false, error: "Pembayaran tidak ditemukan" }

            if (!isWithinLockPeriod(payment.date)) {
                return { success: false, error: `Pembayaran tidak bisa diedit — sudah lebih dari ${LOCK_PERIOD_DAYS} hari` }
            }

            const updateData: any = {}
            if (input.amount !== undefined) updateData.amount = input.amount
            if (input.reference !== undefined) updateData.reference = input.reference
            if (input.notes !== undefined) updateData.notes = input.notes
            if (input.date !== undefined) updateData.date = input.date

            await prisma.payment.update({ where: { id: input.paymentId }, data: updateData })
            return { success: true }
        })
    } catch (error) {
        console.error("Failed to edit AR payment:", error)
        return { success: false, error: "Gagal mengedit pembayaran" }
    }
}

export async function editAPPayment(input: EditPaymentInput) {
    try {
        return await withPrismaAuth(async (prisma) => {
            const payment = await prisma.payment.findUnique({ where: { id: input.paymentId } })
            if (!payment) return { success: false, error: "Pembayaran tidak ditemukan" }

            if (!isWithinLockPeriod(payment.date)) {
                return { success: false, error: `Pembayaran tidak bisa diedit — sudah lebih dari ${LOCK_PERIOD_DAYS} hari` }
            }

            const updateData: any = {}
            if (input.amount !== undefined) updateData.amount = input.amount
            if (input.reference !== undefined) updateData.reference = input.reference
            if (input.notes !== undefined) updateData.notes = input.notes
            if (input.date !== undefined) updateData.date = input.date

            await prisma.payment.update({ where: { id: input.paymentId }, data: updateData })
            return { success: true }
        })
    } catch (error) {
        console.error("Failed to edit AP payment:", error)
        return { success: false, error: "Gagal mengedit pembayaran" }
    }
}

// ─── Credit & Debit Notes ───────────────────────────────────────────────────

interface CreateCreditNoteInput {
    customerId: string
    originalInvoiceId?: string
    amount: number
    reason: string
    date: Date
    revenueAccountId: string
    arAccountId: string
}

export async function createCreditNote(input: CreateCreditNoteInput) {
    try {
        return await withPrismaAuth(async (prisma) => {
            const { customerId, originalInvoiceId, amount, reason, date, revenueAccountId, arAccountId } = input

            if (!customerId || amount <= 0) {
                return { success: false, error: "Customer dan jumlah wajib diisi" }
            }

            await assertPeriodOpen(date)

            // Generate number
            const count = await prisma.invoice.count({ where: { number: { startsWith: 'CN-' } } })
            const num = `CN-${String(count + 1).padStart(5, '0')}`

            // Create invoice as credit note
            const cn = await prisma.invoice.create({
                data: {
                    number: num,
                    type: 'INV_OUT',
                    status: 'PAID',
                    customerId,
                    issueDate: date,
                    dueDate: date,
                    subtotal: -amount,
                    taxAmount: 0,
                    totalAmount: -amount,
                    balanceDue: 0,
                }
            })

            // Journal: Debit Revenue, Credit AR
            await prisma.journalEntry.create({
                data: {
                    date,
                    description: `[CREDIT_NOTE] ${num}: ${reason}`,
                    reference: num,
                    status: 'POSTED',
                    invoice: { connect: { id: cn.id } },
                    lines: {
                        create: [
                            { account: { connect: { id: revenueAccountId } }, debit: amount, credit: 0, description: `Nota Kredit ${num} — pengurangan pendapatan: ${reason}` },
                            { account: { connect: { id: arAccountId } }, credit: amount, debit: 0, description: `Nota Kredit ${num} — pengurangan piutang usaha` },
                        ]
                    }
                }
            })

            // Update account balances
            await prisma.gLAccount.update({ where: { id: revenueAccountId }, data: { balance: { increment: amount } } })
            await prisma.gLAccount.update({ where: { id: arAccountId }, data: { balance: { decrement: amount } } })

            // If linked to original invoice, reduce its balance
            if (originalInvoiceId) {
                const inv = await prisma.invoice.findUnique({ where: { id: originalInvoiceId } })
                if (inv) {
                    const newBalance = Math.max(0, Number(inv.balanceDue) - amount)
                    await prisma.invoice.update({
                        where: { id: originalInvoiceId },
                        data: {
                            balanceDue: newBalance,
                            status: newBalance === 0 ? 'PAID' : inv.status,
                        }
                    })
                }
            }

            return { success: true, number: num, id: cn.id }
        })
    } catch (error) {
        console.error("Failed to create credit note:", error)
        return { success: false, error: "Gagal membuat credit note" }
    }
}

interface CreateDebitNoteInput {
    supplierId: string
    originalBillId?: string
    subtotal: number
    ppnAmount: number
    reason: string
    date: Date
}

export async function createDebitNote(input: CreateDebitNoteInput) {
    try {
        return await withPrismaAuth(async (prisma) => {
            const { supplierId, originalBillId, subtotal, ppnAmount, reason, date } = input
            const total = subtotal + ppnAmount

            if (!supplierId || subtotal <= 0) {
                return { success: false, error: "Supplier dan jumlah wajib diisi" }
            }

            await assertPeriodOpen(date)

            // Resolve GL accounts by code — never rely on client-passed IDs
            const { ensureSystemAccounts } = await import("@/lib/gl-accounts-server")
            const { SYS_ACCOUNTS } = await import("@/lib/gl-accounts")
            await ensureSystemAccounts()

            const apAccount = await prisma.gLAccount.findUnique({ where: { code: SYS_ACCOUNTS.AP } })
            const expenseAccount = await prisma.gLAccount.findUnique({ where: { code: SYS_ACCOUNTS.COGS } })
            const ppnAccount = ppnAmount > 0
                ? await prisma.gLAccount.findUnique({ where: { code: SYS_ACCOUNTS.PPN_MASUKAN } })
                : null

            if (!apAccount || !expenseAccount) {
                return { success: false, error: "Akun GL AP atau HPP tidak ditemukan. Jalankan setup Chart of Accounts." }
            }
            if (ppnAmount > 0 && !ppnAccount) {
                return { success: false, error: "Akun PPN Masukan tidak ditemukan. Jalankan setup Chart of Accounts." }
            }

            const count = await prisma.invoice.count({ where: { number: { startsWith: 'DN-' } } })
            const num = `DN-${String(count + 1).padStart(5, '0')}`

            const dn = await prisma.invoice.create({
                data: {
                    number: num,
                    type: 'INV_IN',
                    status: 'PAID',
                    supplierId,
                    issueDate: date,
                    dueDate: date,
                    subtotal: -subtotal,
                    taxAmount: -ppnAmount,
                    totalAmount: -total,
                    balanceDue: 0,
                }
            })

            // Journal: DR Hutang Usaha, CR HPP (+ CR PPN Masukan if applicable)
            const journalLines: { accountId: string; debit: number; credit: number; description: string }[] = [
                { account: { connect: { id: apAccount.id } }, debit: total, credit: 0, description: `Nota Debit ${num} — pengurangan hutang usaha` },
                { account: { connect: { id: expenseAccount.id } }, debit: 0, credit: subtotal, description: `Nota Debit ${num} — koreksi HPP: ${reason}` },
            ]
            if (ppnAmount > 0 && ppnAccount) {
                journalLines.push({
                    account: { connect: { id: ppnAccount.id } }, debit: 0, credit: ppnAmount,
                    description: `Nota Debit ${num} — reversal PPN Masukan`,
                })
            }

            await prisma.journalEntry.create({
                data: {
                    date,
                    description: `[DEBIT_NOTE] ${num}: ${reason}`,
                    reference: num,
                    status: 'POSTED',
                    invoice: { connect: { id: dn.id } },
                    lines: { create: journalLines },
                }
            })

            // Update GL balances — AP is liability (debit increases = reduces balance)
            await prisma.gLAccount.update({ where: { id: apAccount.id }, data: { balance: { increment: total } } })
            await prisma.gLAccount.update({ where: { id: expenseAccount.id }, data: { balance: { decrement: subtotal } } })
            if (ppnAmount > 0 && ppnAccount) {
                await prisma.gLAccount.update({ where: { id: ppnAccount.id }, data: { balance: { decrement: ppnAmount } } })
            }

            if (originalBillId) {
                const bill = await prisma.invoice.findUnique({ where: { id: originalBillId } })
                if (bill) {
                    const newBalance = Math.max(0, Number(bill.balanceDue) - total)
                    await prisma.invoice.update({
                        where: { id: originalBillId },
                        data: {
                            balanceDue: newBalance,
                            status: newBalance === 0 ? 'PAID' : bill.status,
                        }
                    })
                }
            }

            return { success: true, number: num, id: dn.id }
        })
    } catch (error) {
        console.error("Failed to create debit note:", error)
        const msg = error instanceof Error ? error.message : "Gagal membuat debit note"
        return { success: false, error: msg }
    }
}

export async function getCreditDebitNotes() {
    try {
        return await withPrismaAuth(async (prisma) => {
            const entries = await prisma.journalEntry.findMany({
                where: {
                    OR: [
                        { description: { startsWith: '[CREDIT_NOTE]' } },
                        { description: { startsWith: '[DEBIT_NOTE]' } },
                    ]
                },
                include: {
                    invoice: {
                        include: {
                            customer: { select: { id: true, name: true } },
                            supplier: { select: { id: true, name: true } },
                        }
                    },
                    lines: { include: { account: { select: { id: true, code: true, name: true } } } },
                },
                orderBy: { date: 'desc' },
                take: 200,
            })

            return entries.map(e => {
                const isCN = e.description.startsWith('[CREDIT_NOTE]')
                const debitLine = e.lines.find(l => Number(l.debit) > 0)
                return {
                    id: e.id,
                    type: isCN ? 'CREDIT_NOTE' as const : 'DEBIT_NOTE' as const,
                    number: e.reference || '-',
                    date: e.date,
                    amount: debitLine ? Number(debitLine.debit) : 0,
                    reason: e.description.replace(/^\[(CREDIT|DEBIT)_NOTE\]\s*\S+:\s*/, ''),
                    party: isCN
                        ? e.invoice?.customer?.name ?? '-'
                        : e.invoice?.supplier?.name ?? '-',
                    invoiceId: e.invoice?.id ?? null,
                    invoiceNumber: e.invoice?.number ?? null,
                    status: e.status,
                }
            })
        })
    } catch (error) {
        console.error("Failed to fetch credit/debit notes:", error)
        return []
    }
}

export async function getCreditDebitNoteAccounts() {
    try {
        return await withPrismaAuth(async (prisma) => {
            const [revenueAccounts, arAccounts, apAccounts, expenseAccounts, customers, suppliers] = await Promise.all([
                prisma.gLAccount.findMany({ where: { type: 'REVENUE' }, select: { id: true, code: true, name: true }, orderBy: { code: 'asc' } }),
                prisma.gLAccount.findMany({ where: { type: 'ASSET', code: { startsWith: '1' }, name: { contains: 'piutang', mode: 'insensitive' as const } }, select: { id: true, code: true, name: true }, orderBy: { code: 'asc' } }),
                prisma.gLAccount.findMany({ where: { type: 'LIABILITY', name: { contains: 'hutang', mode: 'insensitive' as const } }, select: { id: true, code: true, name: true }, orderBy: { code: 'asc' } }),
                prisma.gLAccount.findMany({ where: { type: 'EXPENSE' }, select: { id: true, code: true, name: true }, orderBy: { code: 'asc' } }),
                prisma.customer.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
                prisma.supplier.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
            ])
            return { revenueAccounts, arAccounts, apAccounts, expenseAccounts, customers, suppliers }
        })
    } catch (error) {
        console.error("Failed to fetch CN/DN accounts:", error)
        return { revenueAccounts: [], arAccounts: [], apAccounts: [], expenseAccounts: [], customers: [], suppliers: [] }
    }
}

