'use server'

import { withPrismaAuth, prisma as basePrisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"
import { SYS_ACCOUNTS } from "@/lib/gl-accounts"

// ==========================================
// TYPES
// ==========================================

export interface FinancialMetrics {
    cashBalance: number
    receivables: number
    payables: number
    receivablesCount: number
    payablesCount: number
    unallocatedReceiptsCount: number
    netMargin: number
    revenue: number
    burnRate: number
    overdueInvoices: any[]
    upcomingPayables: any[]
    status: {
        cash: 'Healthy' | 'Low' | 'Critical'
        margin: 'Healthy' | 'Low' | 'Critical'
    }
}

export interface FinanceDashboardCashPoint {
    date: string
    day: string
    incoming: number
    outgoing: number
}

export interface FinanceDashboardActionItem {
    id: string
    title: string
    type: 'urgent' | 'pending' | 'warning' | 'info'
    due: string
    href: string
}

export interface FinanceDashboardRecentTransaction {
    id: string
    title: string
    subtitle: string
    amount: number
    direction: 'in' | 'out'
    date: string
    href: string
}

export interface FinanceDashboardData {
    cashFlow: FinanceDashboardCashPoint[]
    actionItems: FinanceDashboardActionItem[]
    recentTransactions: FinanceDashboardRecentTransaction[]
}

export interface ProfitLossData {
    revenue: number
    costOfGoodsSold: number
    grossProfit: number
    operatingExpenses: {
        category: string
        amount: number
    }[]
    totalOperatingExpenses: number
    operatingIncome: number
    otherIncome: number
    otherExpenses: number
    netIncomeBeforeTax: number
    taxExpense: number
    netIncome: number
    period: {
        startDate: string
        endDate: string
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
        totalEquity: number
    }
    totalLiabilitiesAndEquity: number
    asOfDate: string
}

export interface CashFlowData {
    operatingActivities: {
        netIncome: number
        adjustments: { description: string; amount: number }[]
        changesInWorkingCapital: { description: string; amount: number }[]
        netCashFromOperating: number
    }
    investingActivities: {
        items: { description: string; amount: number }[]
        netCashFromInvesting: number
    }
    financingActivities: {
        items: { description: string; amount: number }[]
        netCashFromFinancing: number
    }
    netIncreaseInCash: number
    beginningCash: number
    endingCash: number
    period: { startDate: string; endDate: string }
}

// ==========================================
// HELPERS
// ==========================================

function parseDateInput(date?: Date | string): Date | undefined {
    if (!date) return undefined
    if (date instanceof Date) return date
    const parsed = new Date(date)
    if (Number.isNaN(parsed.getTime())) return undefined
    return parsed
}

// ==========================================
// DASHBOARD & METRICS
// ==========================================

export async function getFinanceDashboardData(): Promise<FinanceDashboardData> {
    try {
        return await withPrismaAuth(async (prisma) => {
            const now = new Date()
            const today = new Date(now)
            today.setHours(0, 0, 0, 0)

            const sevenDaysAgo = new Date(today)
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)

            const [
                payments,
                journals,
                invoices,
                overdueBillsCount,
                overdueCustomerInvoicesCount,
                pendingPOApprovalCount,
                draftJournalCount,
            ] = await Promise.all([
                prisma.payment.findMany({
                    where: { date: { gte: sevenDaysAgo } },
                    include: {
                        customer: { select: { name: true } },
                        supplier: { select: { name: true } },
                        invoice: { select: { number: true, type: true } },
                    },
                    orderBy: { date: 'desc' },
                    take: 100,
                }),
                prisma.journalEntry.findMany({
                    include: {
                        lines: {
                            select: { debit: true, credit: true }
                        }
                    },
                    orderBy: { date: 'desc' },
                    take: 8,
                }),
                prisma.invoice.findMany({
                    where: {
                        issueDate: { gte: sevenDaysAgo },
                    },
                    include: {
                        customer: { select: { name: true } },
                        supplier: { select: { name: true } },
                    },
                    orderBy: { issueDate: 'desc' },
                    take: 8,
                }),
                prisma.invoice.count({
                    where: {
                        type: 'INV_IN',
                        status: { in: ['ISSUED', 'PARTIAL', 'OVERDUE'] },
                        dueDate: { lt: now },
                        balanceDue: { gt: 0 },
                    }
                }),
                prisma.invoice.count({
                    where: {
                        type: 'INV_OUT',
                        status: { in: ['ISSUED', 'PARTIAL', 'OVERDUE'] },
                        dueDate: { lt: now },
                        balanceDue: { gt: 0 },
                    }
                }),
                prisma.purchaseOrder.count({
                    where: { status: 'PENDING_APPROVAL' }
                }),
                prisma.journalEntry.count({
                    where: { status: 'DRAFT' }
                }),
            ])

            const dayBuckets = new Map<string, FinanceDashboardCashPoint>()
            for (let i = 0; i < 7; i++) {
                const date = new Date(sevenDaysAgo)
                date.setDate(sevenDaysAgo.getDate() + i)
                const iso = date.toISOString().split('T')[0]
                dayBuckets.set(iso, {
                    date: iso,
                    day: new Intl.DateTimeFormat('id-ID', { weekday: 'short' }).format(date),
                    incoming: 0,
                    outgoing: 0,
                })
            }

            for (const payment of payments) {
                const key = payment.date.toISOString().split('T')[0]
                const bucket = dayBuckets.get(key)
                if (!bucket) continue

                if (payment.customerId) bucket.incoming += Number(payment.amount || 0)
                else if (payment.supplierId) bucket.outgoing += Number(payment.amount || 0)
            }

            const recentPaymentTx: FinanceDashboardRecentTransaction[] = payments.slice(0, 6).map((payment) => ({
                id: `payment-${payment.id}`,
                title: payment.customerId
                    ? `Penerimaan ${payment.invoice?.number || payment.number}`
                    : `Pembayaran ${payment.invoice?.number || payment.number}`,
                subtitle: payment.customer?.name || payment.supplier?.name || 'Unknown party',
                amount: Number(payment.amount || 0),
                direction: payment.customerId ? 'in' : 'out',
                date: payment.date.toISOString(),
                href: payment.customerId ? '/finance/payments' : '/finance/vendor-payments',
            }))

            const recentJournalTx: FinanceDashboardRecentTransaction[] = journals.slice(0, 4).map((entry) => {
                const totalDebit = entry.lines.reduce((sum, line) => sum + Number(line.debit || 0), 0)
                return {
                    id: `journal-${entry.id}`,
                    title: entry.description || `Jurnal ${entry.reference || entry.id}`,
                    subtitle: entry.reference || 'General Journal',
                    amount: totalDebit,
                    direction: 'in',
                    date: entry.date.toISOString(),
                    href: '/finance/journal',
                }
            })

            const recentInvoiceTx: FinanceDashboardRecentTransaction[] = invoices.slice(0, 4).map((invoice) => ({
                id: `invoice-${invoice.id}`,
                title: `${invoice.type === 'INV_OUT' ? 'Invoice' : 'Bill'} ${invoice.number}`,
                subtitle: invoice.customer?.name || invoice.supplier?.name || 'Unknown party',
                amount: Number(invoice.totalAmount || 0),
                direction: invoice.type === 'INV_OUT' ? 'in' : 'out',
                date: invoice.issueDate.toISOString(),
                href: invoice.type === 'INV_OUT' ? '/finance/invoices' : '/finance/bills',
            }))

            const recentTransactions = [...recentPaymentTx, ...recentJournalTx, ...recentInvoiceTx]
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, 6)

            const actionItems: FinanceDashboardActionItem[] = [
                {
                    id: 'overdue-bills',
                    title: `${overdueBillsCount} Bill Vendor Melewati Jatuh Tempo`,
                    type: overdueBillsCount > 0 ? 'urgent' : 'info',
                    due: overdueBillsCount > 0 ? 'Butuh tindakan' : 'Tidak ada overdue',
                    href: '/finance/bills',
                },
                {
                    id: 'overdue-ar',
                    title: `${overdueCustomerInvoicesCount} Invoice Pelanggan Overdue`,
                    type: overdueCustomerInvoicesCount > 0 ? 'pending' : 'info',
                    due: overdueCustomerInvoicesCount > 0 ? 'Follow up collection' : 'Semua lancar',
                    href: '/finance/invoices',
                },
                {
                    id: 'po-approval',
                    title: `${pendingPOApprovalCount} PO Menunggu Approval`,
                    type: pendingPOApprovalCount > 0 ? 'warning' : 'info',
                    due: pendingPOApprovalCount > 0 ? 'Review procurement' : 'Tidak ada antrian',
                    href: '/procurement/orders',
                },
                {
                    id: 'draft-journal',
                    title: `${draftJournalCount} Draft Jurnal Belum Diposting`,
                    type: draftJournalCount > 0 ? 'warning' : 'info',
                    due: draftJournalCount > 0 ? 'Posting diperlukan' : 'Ledger clean',
                    href: '/finance/journal',
                },
            ]

            return {
                cashFlow: Array.from(dayBuckets.values()),
                actionItems,
                recentTransactions,
            }
        })
    } catch (error) {
        console.error("Failed to fetch finance dashboard data:", error)
        return {
            cashFlow: [],
            actionItems: [],
            recentTransactions: [],
        }
    }
}

export async function getFinancialMetrics(): Promise<FinancialMetrics> {
    try {
        const supabaseModule = await import("@/lib/supabase")
        const supabase = supabaseModule.supabase

        const hasQueryError = (result: any) => Boolean(result?.error)
        const extractRows = <T,>(result: any): T[] => (hasQueryError(result) ? [] : (result?.data || []))

        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        startOfMonth.setHours(0, 0, 0, 0)
        const startOfMonthIso = startOfMonth.toISOString()

        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        const thirtyDaysAgoIso = thirtyDaysAgo.toISOString()

        const nowIso = new Date().toISOString()

        const { data: expenseAccounts } = await supabase
            .from('gl_accounts')
            .select('id')
            .eq('type', 'EXPENSE')

        const expenseAccountIds = expenseAccounts?.map(a => a.id) || []

        const [
            arResult,
            overdueResult,
            apResult,
            upcomingResult,
            cashResult,
            burnResult,
            revenueResult,
            expenseResult
        ] = await Promise.all([
            supabase.from('invoices')
                .select('balanceDue')
                .eq('type', 'INV_OUT')
                .in('status', ['ISSUED', 'PARTIAL', 'OVERDUE']),

            supabase.from('invoices')
                .select('*, customer:customers(name)')
                .eq('type', 'INV_OUT')
                .in('status', ['ISSUED', 'PARTIAL', 'OVERDUE'])
                .lt('dueDate', nowIso)
                .order('dueDate', { ascending: true })
                .limit(3),

            supabase.from('invoices')
                .select('balanceDue')
                .eq('type', 'INV_IN')
                .in('status', ['ISSUED', 'PARTIAL', 'OVERDUE']),

            supabase.from('invoices')
                .select('*, supplier:suppliers(name)')
                .eq('type', 'INV_IN')
                .in('status', ['ISSUED', 'PARTIAL', 'OVERDUE'])
                .gte('dueDate', nowIso)
                .order('dueDate', { ascending: true })
                .limit(3),

            supabase.from('gl_accounts')
                .select('balance')
                .eq('type', 'ASSET')
                .in('code', [SYS_ACCOUNTS.CASH, SYS_ACCOUNTS.BANK_BCA, SYS_ACCOUNTS.BANK_MANDIRI, SYS_ACCOUNTS.PETTY_CASH]),

            expenseAccountIds.length > 0 ? supabase.from('journal_lines')
                .select('debit, journal_entries!inner(date)')
                .in('accountId', expenseAccountIds)
                .gte('journal_entries.date', thirtyDaysAgoIso) : Promise.resolve({ data: [] }),

            supabase.from('invoices')
                .select('totalAmount')
                .eq('type', 'INV_OUT')
                .gte('issueDate', startOfMonthIso)
                .neq('status', 'CANCELLED'),

            supabase.from('invoices')
                .select('totalAmount')
                .eq('type', 'INV_IN')
                .gte('issueDate', startOfMonthIso)
                .neq('status', 'CANCELLED')
        ])

        const calculateSum = (data: any[], field: string) => data?.reduce((sum, item) => sum + (Number(item[field]) || 0), 0) || 0

        const arRows = extractRows<any>(arResult)
        const apRows = extractRows<any>(apResult)
        const cashRows = extractRows<any>(cashResult)
        const revenueRows = extractRows<any>(revenueResult)
        const expenseRows = extractRows<any>(expenseResult)
        const overdueRows = extractRows<any>(overdueResult)
        const upcomingRows = extractRows<any>(upcomingResult)

        let receivables = calculateSum(arRows, 'balanceDue')
        let payables = calculateSum(apRows, 'balanceDue')
        let cashBal = calculateSum(cashRows, 'balance')

        const burnRows = extractRows<any>(burnResult)
        const burnTotal = burnRows.reduce((sum: number, item: any) => sum + (Number(item.debit) || 0), 0)
        const burnRate = burnTotal / 30

        let revVal = calculateSum(revenueRows, 'totalAmount')
        let expVal = calculateSum(expenseRows, 'totalAmount')
        let margin = revVal > 0 ? ((revVal - expVal) / revVal) * 100 : 0
        let receivablesCount = 0
        let payablesCount = 0
        let unallocatedReceiptsCount = 0

        const requiresPrismaFallback =
            hasQueryError(arResult) ||
            hasQueryError(apResult) ||
            hasQueryError(cashResult) ||
            hasQueryError(revenueResult) ||
            hasQueryError(expenseResult)

        if (requiresPrismaFallback) {
            const prismaMetrics = await withPrismaAuth(async (prisma) => {
                const [arInvoices, apInvoices, cashAccounts, outInvoicesMonth, inInvoicesMonth, unallocatedPayments] = await Promise.all([
                    prisma.invoice.findMany({
                        where: { type: 'INV_OUT', status: { in: ['ISSUED', 'PARTIAL', 'OVERDUE'] } },
                        select: { balanceDue: true },
                    }),
                    prisma.invoice.findMany({
                        where: { type: 'INV_IN', status: { in: ['ISSUED', 'PARTIAL', 'OVERDUE'] } },
                        select: { balanceDue: true },
                    }),
                    prisma.gLAccount.findMany({
                        where: { type: 'ASSET', code: { in: [SYS_ACCOUNTS.CASH, SYS_ACCOUNTS.BANK_BCA, SYS_ACCOUNTS.BANK_MANDIRI, SYS_ACCOUNTS.PETTY_CASH] } },
                        select: { balance: true },
                    }),
                    prisma.invoice.findMany({
                        where: { type: 'INV_OUT', status: { not: 'CANCELLED' }, issueDate: { gte: startOfMonth } },
                        select: { totalAmount: true },
                    }),
                    prisma.invoice.findMany({
                        where: { type: 'INV_IN', status: { not: 'CANCELLED' }, issueDate: { gte: startOfMonth } },
                        select: { totalAmount: true },
                    }),
                    prisma.payment.findMany({
                        where: { invoiceId: null, customerId: { not: null } },
                        select: { id: true },
                    }),
                ])

                return {
                    receivables: arInvoices.reduce((sum, row) => sum + Number(row.balanceDue || 0), 0),
                    payables: apInvoices.reduce((sum, row) => sum + Number(row.balanceDue || 0), 0),
                    receivablesCount: arInvoices.length,
                    payablesCount: apInvoices.length,
                    unallocatedReceiptsCount: unallocatedPayments.length,
                    cashBalance: cashAccounts.reduce((sum, row) => sum + Number(row.balance || 0), 0),
                    revenue: outInvoicesMonth.reduce((sum, row) => sum + Number(row.totalAmount || 0), 0),
                    expense: inInvoicesMonth.reduce((sum, row) => sum + Number(row.totalAmount || 0), 0),
                }
            })

            receivables = prismaMetrics.receivables
            payables = prismaMetrics.payables
            receivablesCount = prismaMetrics.receivablesCount
            payablesCount = prismaMetrics.payablesCount
            unallocatedReceiptsCount = prismaMetrics.unallocatedReceiptsCount
            cashBal = prismaMetrics.cashBalance
            revVal = prismaMetrics.revenue
            expVal = prismaMetrics.expense
            margin = revVal > 0 ? ((revVal - expVal) / revVal) * 100 : 0
        }

        if (!requiresPrismaFallback) {
            try {
                const summaryCounts = await withPrismaAuth(async (prisma) => {
                    const [arCount, apCount, unallocatedCount] = await Promise.all([
                        prisma.invoice.count({
                            where: { type: 'INV_OUT', status: { in: ['ISSUED', 'PARTIAL', 'OVERDUE'] }, balanceDue: { gt: 0 } }
                        }),
                        prisma.invoice.count({
                            where: { type: 'INV_IN', status: { in: ['ISSUED', 'PARTIAL', 'OVERDUE'] }, balanceDue: { gt: 0 } }
                        }),
                        prisma.payment.count({
                            where: { invoiceId: null, customerId: { not: null } }
                        }),
                    ])
                    return { arCount, apCount, unallocatedCount }
                })
                receivablesCount = summaryCounts.arCount
                payablesCount = summaryCounts.apCount
                unallocatedReceiptsCount = summaryCounts.unallocatedCount
            } catch (error) {
                console.error("Failed to fetch finance summary counts:", error)
            }
        }

        const mapInvoice = (inv: any) => ({
            ...inv,
            subtotal: Number(inv.subtotal || 0),
            taxAmount: Number(inv.taxAmount || 0),
            discountAmount: Number(inv.discountAmount || 0),
            totalAmount: Number(inv.totalAmount || 0),
            balanceDue: Number(inv.balanceDue || 0),
            customer: inv.customer,
            supplier: inv.supplier
        })

        return {
            cashBalance: cashBal,
            receivables,
            payables,
            receivablesCount,
            payablesCount,
            unallocatedReceiptsCount,
            netMargin: Number(margin.toFixed(1)),
            revenue: revVal,
            burnRate,
            overdueInvoices: overdueRows.map(mapInvoice),
            upcomingPayables: upcomingRows.map(mapInvoice),
            status: {
                cash: cashBal > 100000000 ? 'Healthy' : 'Low',
                margin: margin > 10 ? 'Healthy' : 'Low'
            }
        }

    } catch (error) {
        console.error("Failed to fetch financial metrics:", error)
        return {
            cashBalance: 0,
            receivables: 0,
            payables: 0,
            receivablesCount: 0,
            payablesCount: 0,
            unallocatedReceiptsCount: 0,
            netMargin: 0,
            revenue: 0,
            burnRate: 0,
            overdueInvoices: [],
            upcomingPayables: [],
            status: { cash: 'Critical', margin: 'Critical' }
        }
    }
}

// ==========================================
// NOTE: getProfitLossStatement, getBalanceSheet, getCashFlowStatement
// are defined in lib/actions/finance.ts (canonical source).
// Do NOT duplicate them here.
// ==========================================

export async function getStatementOfEquityChanges(startDate: string, endDate: string) {
    try {
        const supabaseClient = await createClient()
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
        if (authError || !user) throw new Error('Unauthorized')

            // Get all EQUITY type accounts
            const equityAccounts = await basePrisma.gLAccount.findMany({
                where: { type: 'EQUITY' },
                select: { id: true, code: true, name: true, balance: true },
                orderBy: { code: 'asc' },
            })

            // Get journal lines for equity accounts in the period
            const lines = await basePrisma.journalLine.findMany({
                where: {
                    account: { type: 'EQUITY' },
                    entry: {
                        status: 'POSTED',
                        date: { gte: new Date(startDate), lte: new Date(endDate) },
                    },
                },
                include: {
                    account: { select: { id: true, code: true, name: true } },
                    entry: { select: { date: true, description: true } },
                },
            })

            // Calculate net income for the period (Revenue - Expense)
            const revenueLines = await basePrisma.journalLine.findMany({
                where: {
                    account: { type: 'REVENUE' },
                    entry: { status: 'POSTED', date: { gte: new Date(startDate), lte: new Date(endDate) } },
                },
                select: { debit: true, credit: true },
            })
            const expenseLines = await basePrisma.journalLine.findMany({
                where: {
                    account: { type: 'EXPENSE' },
                    entry: { status: 'POSTED', date: { gte: new Date(startDate), lte: new Date(endDate) } },
                },
                select: { debit: true, credit: true },
            })

            const totalRevenue = revenueLines.reduce((s, l) => s + Number(l.credit) - Number(l.debit), 0)
            const totalExpense = expenseLines.reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0)
            const netIncome = totalRevenue - totalExpense

            // Build per-account changes
            const accountChanges = equityAccounts.map(acc => {
                const accLines = lines.filter(l => l.account.id === acc.id)
                const additions = accLines.reduce((s, l) => s + Number(l.credit), 0)
                const deductions = accLines.reduce((s, l) => s + Number(l.debit), 0)
                const netChange = additions - deductions
                // Opening balance = current balance - net change in period
                const closingBalance = Number(acc.balance)
                const openingBalance = closingBalance - netChange

                return {
                    accountCode: acc.code,
                    accountName: acc.name,
                    openingBalance,
                    additions,
                    deductions,
                    netChange,
                    closingBalance,
                }
            })

            const totalOpening = accountChanges.reduce((s, a) => s + a.openingBalance, 0)
            const totalClosing = accountChanges.reduce((s, a) => s + a.closingBalance, 0)

            return {
                success: true,
                data: {
                    period: { startDate, endDate },
                    accounts: accountChanges,
                    netIncome,
                    totalOpeningEquity: totalOpening,
                    totalClosingEquity: totalClosing,
                    totalChange: totalClosing - totalOpening,
                },
            }
    } catch (error: any) {
        console.error("Failed to get equity changes:", error)
        return { success: false, error: error.message, data: null }
    }
}

// ==========================================
// INVENTORY TURNOVER REPORT
// ==========================================

export async function getInventoryTurnoverReport(startDate: string, endDate: string) {
    try {
        const supabaseClient = await createClient()
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
        if (authError || !user) throw new Error('Unauthorized')

            // Get all products with stock levels
            const products = await basePrisma.product.findMany({
                where: { isActive: true },
                select: {
                    id: true, code: true, name: true, unit: true, costPrice: true,
                    stockLevels: { select: { quantity: true } },
                },
            })

            // Get inventory transactions in period
            const transactions = await basePrisma.inventoryTransaction.findMany({
                where: {
                    date: { gte: new Date(startDate), lte: new Date(endDate) },
                    type: { in: ['SO_SHIPMENT', 'PRODUCTION_OUT', 'ADJUSTMENT_OUT', 'TRANSFER_OUT'] },
                },
                select: { productId: true, quantity: true, type: true },
            })

            // Get incoming transactions for average calculation
            const incomingTx = await basePrisma.inventoryTransaction.findMany({
                where: {
                    date: { gte: new Date(startDate), lte: new Date(endDate) },
                    type: { in: ['PO_RECEIVE', 'PRODUCTION_IN', 'ADJUSTMENT_IN', 'TRANSFER_IN'] },
                },
                select: { productId: true, quantity: true },
            })

            const daysDiff = Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)))

            const items = products.map(p => {
                const currentStock = p.stockLevels.reduce((s, sl) => s + Number(sl.quantity), 0)
                const outQty = transactions.filter(t => t.productId === p.id).reduce((s, t) => s + Math.abs(Number(t.quantity)), 0)
                const inQty = incomingTx.filter(t => t.productId === p.id).reduce((s, t) => s + Number(t.quantity), 0)

                // Average inventory = (beginning + ending) / 2
                const beginningStock = currentStock + outQty - inQty
                const avgInventory = Math.max(1, (beginningStock + currentStock) / 2)
                const turnoverRatio = outQty / avgInventory
                const daysOnHand = turnoverRatio > 0 ? daysDiff / turnoverRatio : 999

                return {
                    productId: p.id,
                    productCode: p.code,
                    productName: p.name,
                    unit: p.unit,
                    currentStock,
                    beginningStock: Math.max(0, beginningStock),
                    totalOut: outQty,
                    totalIn: inQty,
                    avgInventory: Math.round(avgInventory * 100) / 100,
                    turnoverRatio: Math.round(turnoverRatio * 100) / 100,
                    daysOnHand: Math.round(daysOnHand),
                    inventoryValue: currentStock * Number(p.costPrice || 0),
                    isSlowMoving: daysOnHand > 90,
                }
            }).sort((a, b) => a.turnoverRatio - b.turnoverRatio)

            const totalValue = items.reduce((s, i) => s + i.inventoryValue, 0)
            const avgTurnover = items.length > 0 ? items.reduce((s, i) => s + i.turnoverRatio, 0) / items.length : 0
            const slowMovingCount = items.filter(i => i.isSlowMoving).length

            return {
                success: true,
                data: {
                    period: { startDate, endDate, days: daysDiff },
                    items,
                    summary: {
                        totalProducts: items.length,
                        totalInventoryValue: totalValue,
                        averageTurnoverRatio: Math.round(avgTurnover * 100) / 100,
                        slowMovingCount,
                    },
                },
            }
    } catch (error: any) {
        console.error("Failed to get inventory turnover:", error)
        return { success: false, error: error.message, data: null }
    }
}

// ==========================================
// TAX REPORT (PPN)
// ==========================================

export async function getTaxReport(startDate: string, endDate: string) {
    try {
        const supabaseClient = await createClient()
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
        if (authError || !user) throw new Error('Unauthorized')

            // PPN Keluaran (Output Tax) — from customer invoices (INV_OUT)
            const outInvoices = await basePrisma.invoice.findMany({
                where: {
                    type: 'INV_OUT',
                    status: { notIn: ['CANCELLED', 'VOID', 'DRAFT'] },
                    issueDate: { gte: new Date(startDate), lte: new Date(endDate) },
                },
                select: {
                    id: true, number: true, issueDate: true,
                    subtotal: true, taxAmount: true, totalAmount: true,
                    customer: { select: { name: true, code: true } },
                },
                orderBy: { issueDate: 'asc' },
            })

            // PPN Masukan (Input Tax) — from vendor bills (INV_IN)
            const inInvoices = await basePrisma.invoice.findMany({
                where: {
                    type: 'INV_IN',
                    status: { notIn: ['CANCELLED', 'VOID', 'DRAFT'] },
                    issueDate: { gte: new Date(startDate), lte: new Date(endDate) },
                },
                select: {
                    id: true, number: true, issueDate: true,
                    subtotal: true, taxAmount: true, totalAmount: true,
                    supplier: { select: { name: true, code: true } },
                },
                orderBy: { issueDate: 'asc' },
            })

            const totalPPNKeluaran = outInvoices.reduce((s, i) => s + Number(i.taxAmount || 0), 0)
            const totalPPNMasukan = inInvoices.reduce((s, i) => s + Number(i.taxAmount || 0), 0)
            const netPPN = totalPPNKeluaran - totalPPNMasukan

            // Monthly breakdown
            const months: Record<string, { keluaran: number; masukan: number }> = {}
            for (const inv of outInvoices) {
                const key = new Date(inv.issueDate).toISOString().slice(0, 7) // YYYY-MM
                if (!months[key]) months[key] = { keluaran: 0, masukan: 0 }
                months[key].keluaran += Number(inv.taxAmount || 0)
            }
            for (const inv of inInvoices) {
                const key = new Date(inv.issueDate).toISOString().slice(0, 7)
                if (!months[key]) months[key] = { keluaran: 0, masukan: 0 }
                months[key].masukan += Number(inv.taxAmount || 0)
            }

            const monthlyBreakdown = Object.entries(months)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([month, data]) => ({
                    month,
                    ppnKeluaran: data.keluaran,
                    ppnMasukan: data.masukan,
                    netPPN: data.keluaran - data.masukan,
                }))

            return {
                success: true,
                data: {
                    period: { startDate, endDate },
                    ppnKeluaran: {
                        total: totalPPNKeluaran,
                        invoiceCount: outInvoices.length,
                        items: outInvoices.map(i => ({
                            id: i.id,
                            number: i.number,
                            date: i.issueDate,
                            partyName: i.customer?.name || '—',
                            dpp: Number(i.subtotal),
                            ppn: Number(i.taxAmount || 0),
                            total: Number(i.totalAmount),
                        })),
                    },
                    ppnMasukan: {
                        total: totalPPNMasukan,
                        invoiceCount: inInvoices.length,
                        items: inInvoices.map(i => ({
                            id: i.id,
                            number: i.number,
                            date: i.issueDate,
                            partyName: i.supplier?.name || '—',
                            dpp: Number(i.subtotal),
                            ppn: Number(i.taxAmount || 0),
                            total: Number(i.totalAmount),
                        })),
                    },
                    netPPN,
                    status: netPPN >= 0 ? 'KURANG_BAYAR' : 'LEBIH_BAYAR',
                    monthlyBreakdown,
                },
            }
    } catch (error: any) {
        console.error("Failed to get tax report:", error)
        return { success: false, error: error.message, data: null }
    }
}
