'use server'

import { InvoiceStatus, InvoiceType } from "@prisma/client"
import { withPrismaAuth } from "@/lib/db"
import { supabase } from "@/lib/supabase"

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

        // 1. Expense Accounts
        const { data: expenseAccounts } = await supabase
            .from('gl_accounts')
            .select('id')
            .eq('type', 'EXPENSE')

        const expenseAccountIds = expenseAccounts?.map(a => a.id) || []

        // Parallel Fetching
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
            // 1. Receivables (All OUT invoices that are OPEN)
            supabase.from('invoices')
                .select('balanceDue')
                .eq('type', 'INV_OUT')
                .in('status', ['ISSUED', 'PARTIAL', 'OVERDUE']),

            // 2. Overdue Invoices
            supabase.from('invoices')
                .select('*, customer:customers(name)')
                .eq('type', 'INV_OUT')
                .in('status', ['ISSUED', 'PARTIAL', 'OVERDUE'])
                .lt('dueDate', nowIso)
                .order('dueDate', { ascending: true })
                .limit(3),

            // 3. Payables
            supabase.from('invoices')
                .select('balanceDue')
                .eq('type', 'INV_IN')
                .in('status', ['ISSUED', 'PARTIAL', 'OVERDUE']),

            // 4. Upcoming Payables
            supabase.from('invoices')
                .select('*, supplier:suppliers(name)')
                .eq('type', 'INV_IN')
                .in('status', ['ISSUED', 'PARTIAL', 'OVERDUE'])
                .gte('dueDate', nowIso)
                .order('dueDate', { ascending: true })
                .limit(3),

            // 5. Cash Balance
            supabase.from('gl_accounts')
                .select('balance')
                .eq('type', 'ASSET')
                .in('code', ['1000', '1010', '1020']),

            // 6. Burn Rate (Expenses last 30 days)
            // Need join with journal_entries to filter by date
            expenseAccountIds.length > 0 ? supabase.from('journal_lines')
                .select('debit, journal_entries!inner(date)')
                .in('accountId', expenseAccountIds)
                .gte('journal_entries.date', thirtyDaysAgoIso) : Promise.resolve({ data: [] }),

            // 7. Revenue (This Month)
            supabase.from('invoices')
                .select('totalAmount')
                .eq('type', 'INV_OUT')
                .gte('issueDate', startOfMonthIso)
                .neq('status', 'CANCELLED'),

            // 8. Expenses (This Month)
            supabase.from('invoices')
                .select('totalAmount')
                .eq('type', 'INV_IN')
                .gte('issueDate', startOfMonthIso)
                .neq('status', 'CANCELLED')
        ])

        // Aggregations (JS Side)
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

        // Burn Rate
        const burnRows = extractRows<any>(burnResult)
        const burnTotal = burnRows.reduce((sum: number, item: any) => sum + (Number(item.debit) || 0), 0)
        const burnRate = burnTotal / 30

        let revVal = calculateSum(revenueRows, 'totalAmount')
        let expVal = calculateSum(expenseRows, 'totalAmount')
        let margin = revVal > 0 ? ((revVal - expVal) / revVal) * 100 : 0

        // Prisma fallback keeps dashboard populated even if any Supabase query is blocked/fails.
        const requiresPrismaFallback =
            hasQueryError(arResult) ||
            hasQueryError(apResult) ||
            hasQueryError(cashResult) ||
            hasQueryError(revenueResult) ||
            hasQueryError(expenseResult)

        if (requiresPrismaFallback) {
            const prismaMetrics = await withPrismaAuth(async (prisma) => {
                const [arInvoices, apInvoices, cashAccounts, outInvoicesMonth, inInvoicesMonth] = await Promise.all([
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
                ])

                return {
                    receivables: arInvoices.reduce((sum, row) => sum + Number(row.balanceDue || 0), 0),
                    payables: apInvoices.reduce((sum, row) => sum + Number(row.balanceDue || 0), 0),
                    cashBalance: cashAccounts.reduce((sum, row) => sum + Number(row.balance || 0), 0),
                    revenue: outInvoicesMonth.reduce((sum, row) => sum + Number(row.totalAmount || 0), 0),
                    expense: inInvoicesMonth.reduce((sum, row) => sum + Number(row.totalAmount || 0), 0),
                }
            })

            receivables = prismaMetrics.receivables
            payables = prismaMetrics.payables
            cashBal = prismaMetrics.cashBalance
            revVal = prismaMetrics.revenue
            expVal = prismaMetrics.expense
            margin = revVal > 0 ? ((revVal - expVal) / revVal) * 100 : 0
        }

        // Mapping Lists
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
            netMargin: 0,
            revenue: 0,
            burnRate: 0,
            overdueInvoices: [],
            upcomingPayables: [],
            status: { cash: 'Critical', margin: 'Critical' }
        }
    }
}

export async function getInvoiceKanbanData(): Promise<InvoiceKanbanData> {
    return withPrismaAuth(async (prisma) => {
        const invoices = await prisma.invoice.findMany({
            where: { type: { in: ['INV_OUT', 'INV_IN'] } }, // Customer Invoices + Vendor Bills
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

            const isOverdue = inv.status === 'OVERDUE' || dueDate < now
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

        return await withPrismaAuth(async (prisma) => {
            // 2. Fetch Account IDs
            const codes = data.lines.map(l => l.accountCode)
            const accounts = await prisma.gLAccount.findMany({
                where: { code: { in: codes } }
            })

            const accountMap = new Map(accounts.map(a => [a.code, a]))

            // 3. Create Entry & Lines Transactionally
            await prisma.$transaction(async (tx) => {
                // Create Header
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

                // Update Account Balances
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

export async function getProfitLossStatement(startDate?: Date | string, endDate?: Date | string): Promise<ProfitLossData> {
    try {
        const start = parseDateInput(startDate) || new Date(new Date().getFullYear(), 0, 1)
        const end = parseDateInput(endDate) || new Date()

        const startIso = start.toISOString()
        const endIso = end.toISOString()

        return await withPrismaAuth(async (prisma) => {
            // Fetch journal lines with accounts
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
            // Calculate by account type
            let revenue = 0
            let costOfGoodsSold = 0
            const operatingExpenses: { category: string; amount: number }[] = []
            let otherIncome = 0
            let otherExpenses = 0

            // Group expenses by account
            const expenseMap = new Map<string, number>()

            for (const line of journalLines) {
                const account = line.account
                const amount = Number(line.debit) - Number(line.credit)

                // Normal balance logic
                const normalBalance = ['ASSET', 'EXPENSE'].includes(account.type) ? 'DEBIT' : 'CREDIT'
                const effectiveAmount = normalBalance === 'DEBIT' ? amount : -amount

                switch (account.type) {
                    case 'REVENUE':
                        revenue += effectiveAmount
                        break
                    case 'EXPENSE':
                        // Check if COGS account (code 5xxx)
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

            // Convert expense map to array
            expenseMap.forEach((amount, category) => {
                if (amount > 0) {
                    operatingExpenses.push({ category, amount })
                }
            })

            const totalOperatingExpenses = operatingExpenses.reduce((sum, exp) => sum + exp.amount, 0)
            const grossProfit = revenue - costOfGoodsSold
            const operatingIncome = grossProfit - totalOperatingExpenses
            const netIncomeBeforeTax = operatingIncome + otherIncome - otherExpenses
            const taxExpense = netIncomeBeforeTax > 0 ? netIncomeBeforeTax * 0.22 : 0 // 22% corporate tax
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

export async function getBalanceSheet(asOfDate?: Date | string): Promise<BalanceSheetData> {
    try {
        const date = parseDateInput(asOfDate) || new Date()

        return await withPrismaAuth(async (prisma) => {
            // Get all accounts with their balances
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

            // Calculate retained earnings from journal entries
            const currentYear = date.getFullYear()
            const yearStart = new Date(currentYear, 0, 1)

            const pnlData = await getProfitLossStatement(yearStart, date)
            equity.retainedEarnings = pnlData.netIncome

            for (const account of accounts) {
                const balance = Number(account.balance)

                switch (account.type) {
                    case 'ASSET':
                        // Current assets: codes 1-1000 to 1-1999
                        if (account.code >= '1000' && account.code < '1500') {
                            assets.currentAssets.push({ name: account.name, amount: balance })
                            assets.totalCurrentAssets += balance
                        }
                        // Fixed assets: codes 1-1500 to 1-1999
                        else if (account.code >= '1500' && account.code < '2000') {
                            assets.fixedAssets.push({ name: account.name, amount: balance })
                            assets.totalFixedAssets += balance
                        }
                        // Other assets
                        else {
                            assets.otherAssets.push({ name: account.name, amount: balance })
                            assets.totalOtherAssets += balance
                        }
                        break

                    case 'LIABILITY':
                        // Current liabilities: codes 2-1000 to 2-1999
                        if (account.code >= '2000' && account.code < '2500') {
                            liabilities.currentLiabilities.push({ name: account.name, amount: balance })
                            liabilities.totalCurrentLiabilities += balance
                        }
                        // Long-term liabilities
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

export async function getCashFlowStatement(startDate?: Date | string, endDate?: Date | string): Promise<CashFlowData> {
    try {
        const start = parseDateInput(startDate) || new Date(new Date().getFullYear(), 0, 1)
        const end = parseDateInput(endDate) || new Date()

        const pnlData = await getProfitLossStatement(start, end)

        return await withPrismaAuth(async (prisma) => {
            // Get cash account changes
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

            // Get beginning balance (start of period)
            const beginningCash = cashAccounts.reduce((sum, acc) => sum + Number(acc.balance), 0)

            // Get journal entries affecting cash
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

            // Calculate cash flow by analyzing journal entries
            for (const line of cashJournalLines) {
                const amount = Number(line.debit) - Number(line.credit)
                const description = line.entry.description

                // Categorize based on description or reference
                if (description?.includes('Invoice') || description?.includes('Payment')) {
                    // Already in netIncome, no adjustment needed
                } else if (description?.includes('Asset') || description?.includes('Equipment')) {
                    investingActivities.items.push({ description: description || 'Unknown', amount })
                    investingActivities.netCashFromInvesting += amount
                } else if (description?.includes('Capital') || description?.includes('Dividend')) {
                    financingActivities.items.push({ description: description || 'Unknown', amount })
                    financingActivities.netCashFromFinancing += amount
                }
            }

            // Get AR and AP changes for working capital
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
    // Manual Items
    items?: Array<{
        description: string
        quantity: number
        unitPrice: number
        productCode?: string
        productId?: string
    }>
    type?: 'CUSTOMER' | 'SUPPLIER'
}) {
    try {
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
            const dueDate = data.dueDate || new Date(issueDate.getTime() + 30 * 24 * 60 * 60 * 1000)

            // Prepare Items
            const invoiceItems = data.items && data.items.length > 0 ? data.items.map(item => ({
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                amount: item.quantity * item.unitPrice,
                // If productId is provided, use it, otherwise maybe look up by code? 
                // For now, manual entry might not link to product table unless strictly required.
            })) : [{
                description: data.notes || 'Manual Entry',
                quantity: 1,
                unitPrice: data.amount,
                amount: data.amount
            }]

            // Recalculate total if items exist
            const totalAmount = invoiceItems.reduce((sum, item) => sum + Number(item.amount), 0)

            // Create invoice
            const invoice = await prisma.invoice.create({
                data: {
                    number: invoiceNumber,
                    type: invoiceType,
                    customerId: invoiceType === 'INV_OUT' ? data.customerId : null,
                    supplierId: invoiceType === 'INV_IN' ? data.customerId : null,
                    issueDate: issueDate,
                    dueDate: dueDate,
                    subtotal: totalAmount,
                    taxAmount: 0,
                    totalAmount: totalAmount,
                    balanceDue: totalAmount,
                    status: 'DRAFT',
                    items: {
                        create: invoiceItems
                    }
                }
            })


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

export async function recordPendingBillFromPO(
    po: any,
    options?: { forceCreate?: boolean; requireConfirmationOnDuplicate?: boolean }
) {
    try {
        console.log("Creating/Updating Finance Bill for PO:", po.number)

        return await withPrismaAuth(async (prisma) => {
            // Check if Bill already exists for this PO
            const existingBill = await prisma.invoice.findFirst({
                where: {
                    type: 'INV_IN',
                    OR: [{ orderId: po.id }, { purchaseOrderId: po.id }],
                    status: { notIn: ['CANCELLED', 'VOID'] }
                },
                orderBy: { createdAt: 'desc' }
            })

            if (existingBill) {
                console.log("Bill already exists:", existingBill.number)
                if (!options?.forceCreate) {
                    if (options?.requireConfirmationOnDuplicate) {
                        return {
                            success: false,
                            code: 'INVOICE_ALREADY_EXISTS',
                            requiresConfirmation: true,
                            existingInvoiceId: existingBill.id,
                            existingInvoiceNumber: existingBill.number,
                            existingInvoiceStatus: existingBill.status,
                            error: `Bill ${existingBill.number} already exists for this PO`
                        } as const
                    }

                    return {
                        success: true,
                        billId: existingBill.id,
                        billNumber: existingBill.number,
                        alreadyExists: true,
                        existingStatus: existingBill.status
                    } as const
                }
            }

            const billBaseNumber = `BILL-${po.number}`
            const duplicateCount = await prisma.invoice.count({
                where: {
                    type: 'INV_IN',
                    number: { startsWith: billBaseNumber }
                }
            })
            const billNumber = duplicateCount > 0
                ? `${billBaseNumber}-${String(duplicateCount + 1).padStart(2, '0')}`
                : billBaseNumber

            // Create new Bill (Invoice Type IN)
            const bill = await prisma.invoice.create({
                data: {
                    number: billNumber,
                    type: 'INV_IN',
                    supplierId: po.supplierId,
                    orderId: po.id,
                    purchaseOrderId: po.id,
                    status: 'DRAFT',
                    issueDate: new Date(),
                    dueDate: new Date(new Date().setDate(new Date().getDate() + 30)),
                    subtotal: po.netAmount || 0,
                    taxAmount: po.taxAmount || 0,
                    totalAmount: po.totalAmount || 0,
                    balanceDue: po.totalAmount || 0,
                    items: {
                        create: po.items.map((item: any) => ({
                            description: item.product?.name || 'Unknown Item',
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            amount: item.totalPrice,
                            productId: item.productId
                        }))
                    }
                }
            })

            console.log("Bill Created:", bill.number)
            return { success: true, billId: bill.id, billNumber: bill.number, alreadyExists: false } as const
        })
    } catch (error) {
        console.error("Failed to record pending bill:", error)
        return { success: false, error: "Finance Sync Failed" }
    }
}

// ==========================================
// SALES INTEGRATION
// ==========================================

export async function createInvoiceFromSalesOrder(
    salesOrderId: string,
    options?: { forceCreate?: boolean }
) {
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
                    type: 'INV_OUT',
                    status: { notIn: ['CANCELLED', 'VOID'] }
                },
                orderBy: { createdAt: 'desc' }
            })

            if (existingInvoice && !options?.forceCreate) {
                console.log("Invoice already exists:", existingInvoice.number)
                return {
                    success: false as const,
                    code: 'INVOICE_ALREADY_EXISTS',
                    requiresConfirmation: true as const,
                    existingInvoiceId: existingInvoice.id,
                    existingInvoiceNumber: existingInvoice.number,
                    existingInvoiceStatus: existingInvoice.status,
                    error: `Invoice ${existingInvoice.number} already exists for this Sales Order`
                }
            }

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
            const paymentTermDays = salesOrder.paymentTerm === 'NET_30' ? 30 :
                salesOrder.paymentTerm === 'NET_15' ? 15 :
                    salesOrder.paymentTerm === 'NET_60' ? 60 : 30
            const dueDate = new Date()
            dueDate.setDate(dueDate.getDate() + paymentTermDays)

            // Create Customer Invoice (Invoice Type OUT)
            const invoice = await prisma.invoice.create({
                data: {
                    number: invoiceNumber,
                    type: 'INV_OUT',
                    customerId: salesOrder.customerId,
                    salesOrderId: salesOrder.id,
                    status: 'ISSUED',
                    issueDate: new Date(),
                    dueDate: dueDate,
                    subtotal: salesOrder.subtotal,
                    taxAmount: salesOrder.taxAmount,
                    discountAmount: salesOrder.discountAmount || 0,
                    totalAmount: salesOrder.total,
                    balanceDue: salesOrder.total,
                    items: {
                        create: salesOrder.items.map((item) => ({
                            description: item.product?.name || item.description || 'Unknown Item',
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            amount: item.lineTotal,
                            productId: item.productId
                        }))
                    }
                }
            })

            console.log("Customer Invoice Created:", invoice.number)

            // Auto-post to General Ledger (DR Accounts Receivable, CR Revenue)
            try {
                // Get GL account codes from database (or use predefined codes)
                const arAccount = await prisma.gLAccount.findFirst({
                    where: { code: '1200' } // Accounts Receivable
                })
                const revenueAccount = await prisma.gLAccount.findFirst({
                    where: { code: '4000' } // Sales Revenue
                })

                if (arAccount && revenueAccount) {
                    // Post journal entry
                    await postJournalEntry({
                        description: `Customer Invoice ${invoice.number} - ${salesOrder.customer?.name}`,
                        date: new Date(),
                        reference: invoice.number,
                        lines: [
                            {
                                accountCode: arAccount.code,
                                debit: Number(salesOrder.total),
                                credit: 0,
                                description: `AR - ${salesOrder.customer?.name}`
                            },
                            {
                                accountCode: revenueAccount.code,
                                debit: 0,
                                credit: Number(salesOrder.total),
                                description: `Sales Revenue - SO ${salesOrder.number}`
                            }
                        ]
                    })
                    console.log("GL Entry Posted for Invoice:", invoice.number)
                } else {
                    console.warn("GL Accounts not found - skipping auto-posting")
                }
            } catch (glError) {
                console.error("Failed to post GL entry (invoice still created):", glError)
            }

            return {
                success: true as const,
                invoiceId: invoice.id,
                invoiceNumber: invoice.number
            }
        })
    } catch (error) {
        console.error("Failed to create invoice from sales order:", error)
        return {
            success: false as const,
            error: (error as any)?.message || "Invoice creation failed"
        }
    }
}

/**
 * Get Sales Orders that are ready for invoicing (CONFIRMED status)
 */
export async function getPendingSalesOrders() {
    return withPrismaAuth(async (prisma) => {
        const orders = await prisma.salesOrder.findMany({
            where: {
                status: 'CONFIRMED',
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
        const [orders, existingBills] = await Promise.all([
            prisma.purchaseOrder.findMany({
                where: {
                    status: { in: ['RECEIVED', 'ORDERED', 'APPROVED'] }, // Allow APPROVED for early billing
                },
                include: {
                    supplier: { select: { id: true, name: true } }
                },
                orderBy: { orderDate: 'desc' },
                take: 100
            }),
            prisma.invoice.findMany({
                where: {
                    type: 'INV_IN',
                    status: { notIn: ['CANCELLED', 'VOID'] },
                    OR: [{ purchaseOrderId: { not: null } }, { orderId: { not: null } }]
                },
                select: { purchaseOrderId: true, orderId: true }
            })
        ])

        const poIdsWithBill = new Set<string>()
        for (const bill of existingBills) {
            if (bill.purchaseOrderId) poIdsWithBill.add(bill.purchaseOrderId)
            if (bill.orderId) poIdsWithBill.add(bill.orderId)
        }

        const pendingOrders = orders.filter((order) => !poIdsWithBill.has(order.id))

        return pendingOrders.map(o => ({
            id: o.id,
            number: o.number,
            vendorName: (o as any).supplier?.name || 'Unknown',
            amount: Number(o.totalAmount),
            date: o.orderDate
        }))
    })
}

/**
 * Create a Bill (INV_IN) from a Purchase Order ID
 */
export async function createBillFromPOId(
    poId: string,
    options?: { forceCreate?: boolean }
) {
    try {
        return await withPrismaAuth(async (prisma) => {
            const po = await prisma.purchaseOrder.findUnique({
                where: { id: poId },
                include: {
                    items: {
                        include: {
                            product: true
                        }
                    }
                }
            })

            if (!po) throw new Error("Purchase Order not found")
            return await recordPendingBillFromPO(po, {
                forceCreate: options?.forceCreate,
                requireConfirmationOnDuplicate: true
            })
        })
    } catch (error: any) {
        console.error("Failed to create bill from PO:", error)
        return { success: false, error: error.message }
    }
}

// ==========================================
// CREDIT NOTES & REFUNDS (AR)
// ==========================================

export async function createCreditNote(data: {
    originalInvoiceId: string
    reason: string
    items: {
        description: string
        quantity: number
        unitPrice: number
    }[]
}) {
    try {
        return await withPrismaAuth(async (prisma) => {
            // 1. Get Original Invoice
            const originalInvoice = await prisma.invoice.findUnique({
                where: { id: data.originalInvoiceId },
                include: { customer: true }
            })

            if (!originalInvoice) throw new Error("Original invoice not found")
            if (originalInvoice.type !== 'INV_OUT') throw new Error("Can only credit customer invoices")

            // 2. Calculate Credit Amount
            const creditSubtotal = data.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
            const creditTax = creditSubtotal * 0.11
            const creditTotal = creditSubtotal + creditTax

            // 3. Generate Credit Note Number
            const count = await prisma.invoice.count({ where: { type: 'CREDIT_NOTE' } })
            const year = new Date().getFullYear()
            const number = `CN-${year}-${String(count + 1).padStart(4, '0')}`

            // 4. Create Credit Note
            const creditNote = await prisma.invoice.create({
                data: {
                    number,
                    type: 'CREDIT_NOTE',
                    customerId: originalInvoice.customerId,
                    referenceId: originalInvoice.id,
                    status: 'ISSUED',
                    issueDate: new Date(),
                    dueDate: new Date(),
                    subtotal: -creditSubtotal,
                    taxAmount: -creditTax,
                    totalAmount: -creditTotal,
                    balanceDue: -creditTotal,
                    notes: data.reason,
                    items: {
                        create: data.items.map(item => ({
                            description: item.description,
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            amount: -(item.quantity * item.unitPrice)
                        }))
                    }
                }
            })

            // 5. Apply Credit to Original Invoice
            const newBalance = Number(originalInvoice.balanceDue) - creditTotal
            await prisma.invoice.update({
                where: { id: originalInvoice.id },
                data: {
                    balanceDue: newBalance,
                    status: newBalance <= 0 ? 'PAID' : 'PARTIAL'
                }
            })

            // 6. Post Journal Entry
            await postJournalEntry({
                description: `Credit Note for ${originalInvoice.number}: ${data.reason}`,
                date: new Date(),
                reference: creditNote.id,
                lines: [
                    {
                        accountCode: '1200', // AR Account
                        debit: creditTotal,
                        credit: 0
                    },
                    {
                        accountCode: '4101', // Revenue (negative)
                        debit: 0,
                        credit: creditSubtotal
                    },
                    {
                        accountCode: '2200', // Tax Payable
                        debit: 0,
                        credit: creditTax
                    }
                ]
            })

            return { success: true, creditNoteId: creditNote.id, number: creditNote.number }
        })
    } catch (error: any) {
        console.error("Create Credit Note Error:", error)
        return { success: false, error: error.message }
    }
}

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

            await postJournalEntry({
                description: `Refund to customer: ${data.reason}`,
                date: new Date(),
                reference: refund.id,
                lines: [
                    {
                        accountCode: '1200', // AR
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

            await postJournalEntry({
                description: `Payment Voucher ${number} for ${bills.length} bills`,
                date: new Date(),
                reference: voucher.id,
                lines: [
                    {
                        accountCode: '2101', // AP
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
            const existing = await prisma.invoice.findUnique({
                where: { id: invoiceId },
                select: { id: true, dueDate: true }
            })

            if (!existing) {
                throw new Error("Invoice not found")
            }

            const fallbackDueDate = new Date(now)
            fallbackDueDate.setDate(fallbackDueDate.getDate() + 30)
            const dueDate = existing.dueDate || fallbackDueDate
            const nextStatus = dueDate < now ? 'OVERDUE' : 'ISSUED'

            const invoice = await prisma.invoice.update({
                where: { id: invoiceId },
                data: {
                    status: nextStatus,
                    issueDate: now,
                    dueDate, // Preserve user-selected due date when available.
                }
            })

            // Log activity or "send" message (mock for now)
            console.log(`Sending Invoice ${invoice.number} via ${method}: ${message}`)

            return { success: true, dueDate, status: nextStatus }
        })
    } catch (error) {
        console.error("Failed to move invoice to sent:", error)
        return { success: false, error: "Failed to update invoice status" }
    }
}

export async function recordInvoicePayment(data: {
    invoiceId: string
    paymentMethod: 'CASH' | 'TRANSFER' | 'CHECK' | 'CREDIT_CARD' | 'OTHER'
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
                await postJournalEntry({
                    description: `Payment for Invoice ${invoice.number}`,
                    date: data.paymentDate,
                    reference: payment.number,
                    lines: [
                        { accountCode: cashAccountCode, debit: data.amount, credit: 0, description: `Receipt from ${invoice.customer?.name}` },
                        { accountCode: arAccountCode, debit: 0, credit: data.amount, description: `Payment for ${invoice.number}` }
                    ]
                })
            } else {
                // Vendor Payment: Debit AP, Credit Cash
                await postJournalEntry({
                    description: `Payment for Bill ${invoice.number}`,
                    date: data.paymentDate,
                    reference: payment.number,
                    lines: [
                        { accountCode: apAccountCode, debit: data.amount, credit: 0, description: `Payment for ${invoice.supplier?.name}` },
                        { accountCode: cashAccountCode, debit: 0, credit: data.amount, description: `Payment for ${invoice.number}` }
                    ]
                })
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
                await postJournalEntry({
                    description: `GIRO ${voucher.number} cleared`,
                    date: new Date(),
                    reference: voucher.id,
                    lines: [
                        {
                            accountCode: '2101',
                            debit: voucher.amount,
                            credit: 0
                        },
                        {
                            accountCode: '1102',
                            debit: 0,
                            credit: voucher.amount
                        }
                    ]
                })

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
 * Get all unallocated (unmatched) customer payments
 * These are payments received but not yet linked to specific invoices
 */
export async function getUnallocatedPayments(): Promise<UnallocatedPayment[]> {
    try {
        return await withPrismaAuth(async (prisma) => {
            const payments = await prisma.payment.findMany({
                where: {
                    invoiceId: null,
                    customerId: { not: null }
                },
                include: {
                    customer: { select: { id: true, name: true } }
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
                reference: p.reference
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
                isOverdue: inv.dueDate < now
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
                        await postJournalEntry({
                            description: `Payment ${paymentNumber} for Invoice ${invoice.number}`,
                            date: data.date || new Date(),
                            reference: paymentNumber,
                            lines: [
                                { accountCode: '1000', debit: data.amount, credit: 0 }, // Cash
                                { accountCode: '1200', debit: 0, credit: data.amount }  // AR
                            ]
                        })
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
                await postJournalEntry({
                    description: `Payment ${payment.number} matched to Invoice ${invoice.number}`,
                    date: payment.date,
                    reference: payment.number,
                    lines: [
                        { accountCode: '1000', debit: paymentAmount, credit: 0 }, // Cash
                        { accountCode: '1200', debit: 0, credit: paymentAmount }  // AR
                    ]
                })
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
}

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
                isOverdue: bill.dueDate < now && bill.status !== 'PAID'
            }))
        })
    } catch (error) {
        console.error("Failed to fetch vendor bills:", error)
        return []
    }
}

export async function getVendorBillsRegistry(input?: VendorBillQueryInput): Promise<VendorBillRegistryResult> {
    const query = normalizeVendorBillQuery(input)

    try {
        return await withPrismaAuth(async (prisma) => {
            const where: any = {
                type: 'INV_IN',
                status: { in: ['DRAFT', 'ISSUED', 'PARTIAL', 'OVERDUE', 'DISPUTED'] }
            }

            if (query.status) where.status = query.status
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
                        }
                    },
                    orderBy: [{ dueDate: 'asc' }, { issueDate: 'desc' }],
                    skip: (query.page - 1) * query.pageSize,
                    take: query.pageSize
                }),
                prisma.invoice.count({ where })
            ])

            const now = new Date()
            const rows = bills.map((bill) => ({
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
                isOverdue: bill.dueDate < now && bill.status !== 'PAID'
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
                const vatInAccount = await prisma.gLAccount.findFirst({ where: { code: '1300' } }) // VAT In
                if (vatInAccount) {
                    glLines.push({
                        accountCode: '1300',
                        debit: Number(bill.taxAmount),
                        credit: 0,
                        description: `VAT In - Bill ${bill.number}`
                    })
                    totalAmount += Number(bill.taxAmount)
                }
            }

            // Add AP Credit Line
            glLines.push({
                accountCode: '2000',
                debit: 0,
                credit: totalAmount, // Should match bill total
                description: `AP - ${bill.supplier?.name}`
            })

            // Post Journal Entry
            await postJournalEntry({
                description: `Bill Approval #${bill.number} - ${bill.supplier?.name}`,
                date: new Date(),
                reference: bill.number,
                lines: glLines
            })

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
    vendor: { id: string; name: string } | null
    date: Date
    amount: number
    method: string
    reference?: string
    billNumber?: string
    notes?: string
}

/**
 * Get vendor payment history
 */
export async function getVendorPayments(): Promise<VendorPayment[]> {
    try {
        return await withPrismaAuth(async (prisma) => {
            const payments = await prisma.payment.findMany({
                where: {
                    OR: [
                        { supplierId: { not: null } },
                        { notes: { contains: '"source":"PAYROLL_DISBURSEMENT"' } }
                    ]
                },
                include: {
                    supplier: { select: { id: true, name: true } },
                    invoice: { select: { number: true } }
                },
                orderBy: { date: 'desc' },
                take: 50
            })

            return payments.map((p) => ({
                id: p.id,
                number: p.number,
                vendor: p.supplier
                    ? { id: p.supplier.id, name: p.supplier.name }
                    : (p.notes?.includes('"source":"PAYROLL_DISBURSEMENT"')
                        ? { id: "PAYROLL", name: "Payroll Disbursement Batch" }
                        : null),
                date: p.date,
                amount: Number(p.amount),
                method: p.method,
                reference: p.reference || undefined,
                billNumber: p.invoice?.number,
                notes: p.notes || undefined,
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
}) {
    try {
        return await withPrismaAuth(async (prisma) => {
            if (!data.supplierId) {
                throw new Error("Supplier is required")
            }
            if (!data.amount || Number(data.amount) <= 0) {
                throw new Error("Amount must be greater than 0")
            }
            if (data.method === 'CHECK' && !data.reference) {
                throw new Error("Check number/reference is required for CHECK payments")
            }

            // Generate payment number
            const year = new Date().getFullYear()
            const count = await prisma.payment.count({
                where: { number: { startsWith: `VPAY-${year}` } }
            })
            const paymentNumber = `VPAY-${year}-${String(count + 1).padStart(4, '0')}`

            const payment = await prisma.payment.create({
                data: {
                    number: paymentNumber,
                    supplierId: data.supplierId,
                    invoiceId: data.billId,
                    amount: data.amount,
                    date: new Date(),
                    method: data.method || 'TRANSFER',
                    reference: data.reference,
                    notes: data.notes
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

            // Post GL entry: DR AP, CR Cash
            await postJournalEntry({
                description: `Vendor Payment ${paymentNumber}`,
                date: new Date(),
                reference: paymentNumber,
                lines: [
                    { accountCode: '2100', debit: data.amount, credit: 0, description: 'Accounts Payable' },
                    { accountCode: '1000', debit: 0, credit: data.amount, description: 'Cash/Bank' }
                ]
            })

            return { success: true, paymentId: payment.id, paymentNumber }
        })
    } catch (error: any) {
        console.error("Failed to record vendor payment:", error)
        return { success: false, error: error.message }
    }
}

// ==========================================
// CHART OF ACCOUNTS (COA)
// ==========================================

export interface GLAccountNode {
    id: string
    code: string
    name: string
    type: string
    balance: number
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
            const roots: GLAccountNode[] = []

            // Create flat list grouped by type (since no parentId in schema)
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
// JOURNAL ENTRIES (General Ledger)
// ==========================================

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
                const glLines: any[] = []
                let totalAmount = 0

                // Add Expense Lines
                for (const item of bill.items) {
                    const amount = Number(item.amount)
                    totalAmount += amount
                    glLines.push({
                        accountCode: '6000', // Default Expense for now
                        debit: amount,
                        credit: 0,
                        description: `${item.description}`
                    })
                }

                // Add Tax
                if (Number(bill.taxAmount) > 0) {
                    glLines.push({
                        accountCode: '1300', // VAT In
                        debit: Number(bill.taxAmount),
                        credit: 0,
                        description: `VAT In - Bill ${bill.number}`
                    })
                    totalAmount += Number(bill.taxAmount)
                }

                // Add AP Credit
                glLines.push({
                    accountCode: '2000',
                    debit: 0,
                    credit: totalAmount,
                    description: `AP - ${bill.supplier?.name}`
                })

                await postJournalEntry({
                    description: `Bill Approval (Instant Pay) #${bill.number} - ${bill.supplier?.name}`,
                    date: new Date(),
                    reference: bill.number,
                    lines: glLines
                })
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

            // Post Cash Journal (Credit Bank 1100, Debit AP 2000)
            await postJournalEntry({
                description: `Payment to ${bill.supplier?.name} for ${bill.number}`,
                date: new Date(),
                reference: paymentNumber,
                lines: [
                    { accountCode: '2000', debit: paymentDetails.amount, credit: 0, description: `AP Payment` }, // Debit AP (Liability connects)
                    { accountCode: '1100', debit: 0, credit: paymentDetails.amount, description: `Bank Transfer` } // Credit Bank (Asset decreases)
                ]
            })

            return { success: true }
        })
    } catch (error: any) {
        console.error("Failed to approve and pay bill:", error)
        return { success: false, error: error.message }
    }
}
