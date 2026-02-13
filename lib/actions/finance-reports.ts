'use server'

import { withPrismaAuth } from "@/lib/db"

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
        currentAssets: { name: string; amount: number }[]
        fixedAssets: { name: string; amount: number }[]
        otherAssets: { name: string; amount: number }[]
        totalCurrentAssets: number
        totalFixedAssets: number
        totalOtherAssets: number
        totalAssets: number
    }
    liabilities: {
        currentLiabilities: { name: string; amount: number }[]
        longTermLiabilities: { name: string; amount: number }[]
        totalCurrentLiabilities: number
        totalLongTermLiabilities: number
        totalLiabilities: number
    }
    equity: {
        capital: { name: string; amount: number }[]
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
                .in('code', ['1000', '1010', '1020']),

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
                        where: { type: 'ASSET', code: { in: ['1000', '1010', '1020'] } },
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
// FINANCIAL REPORTS
// ==========================================

export async function getProfitLossStatement(startDate?: Date | string, endDate?: Date | string): Promise<ProfitLossData> {
    try {
        const start = parseDateInput(startDate) || new Date(new Date().getFullYear(), 0, 1)
        const end = parseDateInput(endDate) || new Date()

        const startIso = start.toISOString()
        const endIso = end.toISOString()

        return await withPrismaAuth(async (prisma) => {
            const journalLines = await (prisma.journalLine.findMany({
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
                    account: true,
                    entry: true
                }
            }) as any)

            let revenue = 0
            let costOfGoodsSold = 0
            const operatingExpenses: { category: string; amount: number }[] = []
            let otherIncome = 0
            let otherExpenses = 0

            const expenseMap = new Map<string, number>()

            for (const line of journalLines) {
                const account = line.account
                const amount = Number(line.debit) - Number(line.credit)

                const normalBalance = ['ASSET', 'EXPENSE'].includes(account.type) ? 'DEBIT' : 'CREDIT'
                const effectiveAmount = normalBalance === 'DEBIT' ? amount : -amount

                switch (account.type) {
                    case 'REVENUE':
                        revenue += effectiveAmount
                        break
                    case 'EXPENSE':
                        if (account.code.startsWith('5') && account.code < '6000') {
                            costOfGoodsSold += effectiveAmount
                        } else {
                            const current = expenseMap.get(account.name) || 0
                            expenseMap.set(account.name, current + effectiveAmount)
                        }
                        break
                    case 'OTHER_INCOME':
                        otherIncome += effectiveAmount
                        break
                    case 'OTHER_EXPENSE':
                        otherExpenses += effectiveAmount
                        break
                }
            }

            expenseMap.forEach((amount, category) => {
                if (amount > 0) {
                    operatingExpenses.push({ category, amount })
                }
            })

            const totalOperatingExpenses = operatingExpenses.reduce((sum, exp) => sum + exp.amount, 0)
            const grossProfit = revenue - costOfGoodsSold
            const operatingIncome = grossProfit - totalOperatingExpenses
            const netIncomeBeforeTax = operatingIncome + otherIncome - otherExpenses
            const taxExpense = netIncomeBeforeTax > 0 ? netIncomeBeforeTax * 0.22 : 0
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
                netIncomeBeforeTax,
                taxExpense,
                netIncome,
                period: {
                    startDate: startIso,
                    endDate: endIso
                }
            }
        })
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
            netIncomeBeforeTax: 0,
            taxExpense: 0,
            netIncome: 0,
            period: { startDate: '', endDate: '' }
        }
    }
}

export async function getBalanceSheet(asOfDate?: Date | string): Promise<BalanceSheetData> {
    try {
        const date = parseDateInput(asOfDate) || new Date()

        return await withPrismaAuth(async (prisma) => {
            const accounts = await prisma.gLAccount.findMany({
                where: {
                    OR: [
                        { type: 'ASSET' },
                        { type: 'LIABILITY' },
                        { type: 'EQUITY' }
                    ]
                },
                orderBy: { code: 'asc' }
            })

            const assets = {
                currentAssets: [] as { name: string; amount: number }[],
                fixedAssets: [] as { name: string; amount: number }[],
                otherAssets: [] as { name: string; amount: number }[],
                totalCurrentAssets: 0,
                totalFixedAssets: 0,
                totalOtherAssets: 0,
                totalAssets: 0
            }

            const liabilities = {
                currentLiabilities: [] as { name: string; amount: number }[],
                longTermLiabilities: [] as { name: string; amount: number }[],
                totalCurrentLiabilities: 0,
                totalLongTermLiabilities: 0,
                totalLiabilities: 0
            }

            const equity = {
                capital: [] as { name: string; amount: number }[],
                retainedEarnings: 0,
                totalEquity: 0
            }

            const currentYear = date.getFullYear()
            const yearStart = new Date(currentYear, 0, 1)

            const pnlData = await getProfitLossStatement(yearStart, date)
            equity.retainedEarnings = pnlData.netIncome

            for (const account of accounts) {
                const balance = Number(account.balance)

                switch (account.type) {
                    case 'ASSET':
                        if (account.code >= '1000' && account.code < '1500') {
                            assets.currentAssets.push({ name: account.name, amount: balance })
                            assets.totalCurrentAssets += balance
                        }
                        else if (account.code >= '1500' && account.code < '2000') {
                            assets.fixedAssets.push({ name: account.name, amount: balance })
                            assets.totalFixedAssets += balance
                        }
                        else {
                            assets.otherAssets.push({ name: account.name, amount: balance })
                            assets.totalOtherAssets += balance
                        }
                        break

                    case 'LIABILITY':
                        if (account.code >= '2000' && account.code < '2500') {
                            liabilities.currentLiabilities.push({ name: account.name, amount: balance })
                            liabilities.totalCurrentLiabilities += balance
                        }
                        else {
                            liabilities.longTermLiabilities.push({ name: account.name, amount: balance })
                            liabilities.totalLongTermLiabilities += balance
                        }
                        break

                    case 'EQUITY':
                        if (account.code >= '3000' && account.code < '3500') {
                            equity.capital.push({ name: account.name, amount: balance })
                        }
                        break
                }
            }

            assets.totalAssets = assets.totalCurrentAssets + assets.totalFixedAssets + assets.totalOtherAssets
            liabilities.totalLiabilities = liabilities.totalCurrentLiabilities + liabilities.totalLongTermLiabilities
            equity.totalEquity = equity.capital.reduce((sum, c) => sum + c.amount, 0) + equity.retainedEarnings

            return {
                assets,
                liabilities,
                equity,
                totalLiabilitiesAndEquity: liabilities.totalLiabilities + equity.totalEquity,
                asOfDate: date.toISOString()
            }
        })
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
            equity: { capital: [], retainedEarnings: 0, totalEquity: 0 },
            totalLiabilitiesAndEquity: 0,
            asOfDate: ''
        }
    }
}

export async function getCashFlowStatement(startDate?: Date | string, endDate?: Date | string): Promise<CashFlowData> {
    try {
        const start = parseDateInput(startDate) || new Date(new Date().getFullYear(), 0, 1)
        const end = parseDateInput(endDate) || new Date()

        const pnlData = await getProfitLossStatement(start, end)

        return await withPrismaAuth(async (prisma) => {
            const cashAccounts = await prisma.gLAccount.findMany({
                where: {
                    type: 'ASSET',
                    OR: [
                        { code: { startsWith: '1000' } },
                        { code: { startsWith: '1010' } },
                        { code: { startsWith: '1020' } }
                    ]
                }
            })

            const beginningCash = cashAccounts.reduce((sum, acc) => sum + Number(acc.balance), 0)

            const cashJournalLines = await prisma.journalLine.findMany({
                where: {
                    accountId: { in: cashAccounts.map(a => a.id) },
                    entry: {
                        date: { gte: start, lte: end },
                        status: 'POSTED'
                    }
                },
                include: {
                    entry: true,
                    account: true
                }
            })

            const operatingActivities = {
                netIncome: pnlData.netIncome,
                adjustments: [] as { description: string; amount: number }[],
                changesInWorkingCapital: [] as { description: string; amount: number }[],
                netCashFromOperating: 0
            }

            const investingActivities = {
                items: [] as { description: string; amount: number }[],
                netCashFromInvesting: 0
            }

            const financingActivities = {
                items: [] as { description: string; amount: number }[],
                netCashFromFinancing: 0
            }

            for (const line of cashJournalLines) {
                const amount = Number(line.debit) - Number(line.credit)
                const description = line.entry.description

                if (description?.includes('Invoice') || description?.includes('Payment')) {
                    // Already in netIncome
                } else if (description?.includes('Asset') || description?.includes('Equipment')) {
                    investingActivities.items.push({ description: description || 'Unknown', amount })
                    investingActivities.netCashFromInvesting += amount
                } else if (description?.includes('Capital') || description?.includes('Dividend')) {
                    financingActivities.items.push({ description: description || 'Unknown', amount })
                    financingActivities.netCashFromFinancing += amount
                }
            }

            const supabaseModule = await import("@/lib/supabase")
            const supabase = supabaseModule.supabase

            const { data: arData } = await supabase
                .from('invoices')
                .select('balanceDue')
                .eq('type', 'INV_OUT')
                .in('status', ['ISSUED', 'PARTIAL', 'OVERDUE'])

            const arChange = (arData || []).reduce((sum, inv) => sum + Number(inv.balanceDue), 0)

            const { data: apData } = await supabase
                .from('invoices')
                .select('balanceDue')
                .eq('type', 'INV_IN')
                .in('status', ['ISSUED', 'PARTIAL', 'OVERDUE'])

            const apChange = (apData || []).reduce((sum, inv) => sum + Number(inv.balanceDue), 0)

            operatingActivities.changesInWorkingCapital.push(
                { description: 'Increase in Accounts Receivable', amount: -arChange },
                { description: 'Increase in Accounts Payable', amount: apChange }
            )

            const workingCapitalChange = -arChange + apChange
            operatingActivities.netCashFromOperating = pnlData.netIncome + workingCapitalChange

            const netIncreaseInCash =
                operatingActivities.netCashFromOperating +
                investingActivities.netCashFromInvesting +
                financingActivities.netCashFromFinancing

            return {
                operatingActivities,
                investingActivities,
                financingActivities,
                netIncreaseInCash,
                beginningCash,
                endingCash: beginningCash + netIncreaseInCash,
                period: {
                    startDate: start.toISOString(),
                    endDate: end.toISOString()
                }
            }
        })
    } catch (error) {
        console.error("Failed to fetch Cash Flow:", error)
        return {
            operatingActivities: {
                netIncome: 0, adjustments: [], changesInWorkingCapital: [], netCashFromOperating: 0
            },
            investingActivities: { items: [], netCashFromInvesting: 0 },
            financingActivities: { items: [], netCashFromFinancing: 0 },
            netIncreaseInCash: 0,
            beginningCash: 0,
            endingCash: 0,
            period: { startDate: '', endDate: '' }
        }
    }
}
