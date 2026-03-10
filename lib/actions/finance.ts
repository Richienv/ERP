'use server'

import { InvoiceStatus, InvoiceType } from "@prisma/client"
import { withPrismaAuth, prisma as basePrisma } from "@/lib/db"
import { supabase } from "@/lib/supabase"
import { createClient } from "@/lib/supabase/server"
import { logAudit } from "@/lib/audit-helpers"

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

            // 5. Cash Balance — ALL cash/bank ASSET accounts (codes starting with 1)
            basePrisma.gLAccount.findMany({
                where: { type: 'ASSET', code: { startsWith: '1' } },
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

        // Fallback chain for KAS:
        // 1. GL accounts (proper accounting — preferred)
        // 2. Paid invoices (net cash = paid IN - paid OUT)
        // 3. Revenue MTD minus receivables (estimated realized cash)
        const cashFromPaidIn = toNum(paidInAgg._sum.totalAmount)
        const cashFromPaidOut = toNum(paidOutAgg._sum.totalAmount)
        const cashFromPaid = cashFromPaidIn - cashFromPaidOut
        const cashBal = cashFromGL > 0 ? cashFromGL : cashFromPaid > 0 ? cashFromPaid : Math.max(0, revVal - receivables)

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
            customer: inv.customer,
            supplier: inv.supplier,
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

            // 3. Create Entry & Lines (already inside withPrismaAuth transaction)
            // Create Header
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
                                accountId: account.id,
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

        const supabaseClient = await createClient()
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
        if (authError || !user) throw new Error('Unauthorized')

            // Fetch journal lines with accounts
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
                        // Other income: code 7xxx-8xxx (pendapatan lain-lain)
                        if (account.code >= '7000' && account.code < '9000') {
                            otherIncome += effectiveAmount
                        } else {
                            revenue += effectiveAmount
                        }
                        break
                    case 'EXPENSE':
                        // COGS: only code 5000 "HPP" or accounts containing "Harga Pokok"
                        // (5100+ are operating expenses like Beban Transportasi, Makan & Minum, etc.)
                        if (account.code === '5000' || account.name.toLowerCase().includes('harga pokok')) {
                            costOfGoodsSold += effectiveAmount
                        // Other expenses: code 8xxx-9xxx (biaya lain-lain)
                        } else if (account.code >= '8000') {
                            otherExpenses += effectiveAmount
                        } else {
                            // Operating expenses — show each account by name (Beban Transportasi, Beban Makan & Minum, etc.)
                            const current = expenseMap.get(account.name) || 0
                            expenseMap.set(account.name, current + effectiveAmount)
                        }
                        break
                }
            }

            // Convert expense map to array, sorted by amount descending
            expenseMap.forEach((amount, category) => {
                if (amount > 0) {
                    operatingExpenses.push({ category, amount })
                }
            })
            operatingExpenses.sort((a, b) => b.amount - a.amount)

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
        currentYearNetIncome: number
        totalEquity: number
    }
    totalLiabilitiesAndEquity: number
    balanceCheck?: { assets: number; liabilitiesAndEquity: number; difference: number }
    asOfDate: string
}

export async function getBalanceSheet(asOfDate?: Date | string): Promise<BalanceSheetData> {
    try {
        const date = parseDateInput(asOfDate) || new Date()

        const supabaseClient = await createClient()
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
        if (authError || !user) throw new Error('Unauthorized')

            // Get all BS accounts (ASSET, LIABILITY, EQUITY) with journal lines up to asOfDate
            const accounts = await basePrisma.gLAccount.findMany({
                where: {
                    type: { in: ['ASSET', 'LIABILITY', 'EQUITY'] }
                },
                include: {
                    lines: {
                        where: {
                            entry: {
                                date: { lte: date },
                                status: 'POSTED',
                            }
                        },
                        select: { debit: true, credit: true }
                    }
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
                currentYearNetIncome: 0,
                totalEquity: 0
            }

            // Calculate retained earnings: prior years + current year net income
            const currentYear = date.getFullYear()
            const priorYearEnd = new Date(currentYear - 1, 11, 31, 23, 59, 59)
            const currentYearStart = new Date(currentYear, 0, 1)

            // Prior-year retained earnings (all P&L from inception to end of last year)
            if (currentYear > 2000) {
                const priorPnl = await getProfitLossStatement(new Date(2000, 0, 1), priorYearEnd)
                equity.retainedEarnings = priorPnl.netIncome
            }

            // Current-year net income (YTD)
            const currentPnl = await getProfitLossStatement(currentYearStart, date)
            equity.currentYearNetIncome = currentPnl.netIncome

            for (const account of accounts) {
                // Compute balance from journal entries (debit - credit for ASSET, credit - debit for LIABILITY/EQUITY)
                const totalDebit = account.lines.reduce((sum, l) => sum + Number(l.debit), 0)
                const totalCredit = account.lines.reduce((sum, l) => sum + Number(l.credit), 0)

                // Normal balance: ASSET=DEBIT (debit-credit), LIABILITY/EQUITY=CREDIT (credit-debit)
                const balance = account.type === 'ASSET'
                    ? totalDebit - totalCredit
                    : totalCredit - totalDebit

                // Skip accounts with zero balance
                if (Math.abs(balance) < 0.01) continue

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
                    difference: assets.totalAssets - totalLiabilitiesAndEquity
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

        const supabaseClient = await createClient()
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
        if (authError || !user) throw new Error('Unauthorized')

            // Get cash account changes
            const cashAccounts = await basePrisma.gLAccount.findMany({
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
            const cashJournalLines = await basePrisma.journalLine.findMany({
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
            })) : [{
                description: data.notes || 'Manual Entry',
                quantity: 1,
                unitPrice: data.amount,
                amount: data.amount
            }]

            // Calculate subtotal and tax
            const subtotal = invoiceItems.reduce((sum, item) => sum + Number(item.amount), 0)
            const taxAmount = data.includeTax ? Math.round(subtotal * 0.11) : 0
            const totalAmount = subtotal + taxAmount

            // Create invoice
            const invoice = await prisma.invoice.create({
                data: {
                    number: invoiceNumber,
                    type: invoiceType,
                    customerId: invoiceType === 'INV_OUT' ? data.customerId : null,
                    supplierId: invoiceType === 'INV_IN' ? data.customerId : null,
                    issueDate: issueDate,
                    dueDate: dueDate,
                    subtotal: subtotal,
                    taxAmount: taxAmount,
                    totalAmount: totalAmount,
                    balanceDue: totalAmount,
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

            // Create new Bill (Invoice Type IN)
            const bill = await prisma.invoice.create({
                data: {
                    number: `BILL-${po.number}`,
                    type: 'INV_IN',
                    supplierId: po.supplierId,
                    orderId: po.id,
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
                            productId: item.productId
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
                                { accountCode: '1100', debit: 0, credit: data.amount }  // AR
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
                        { accountCode: '1100', debit: 0, credit: paymentAmount }  // AR
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
                let debitAccountCode = '6000' // Default Expense
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
                    supplier: { select: { id: true, name: true } },
                    invoice: { select: { number: true } }
                },
                orderBy: { date: 'desc' },
                take: 50
            })

            return payments.map((p) => ({
                id: p.id,
                number: p.number,
                vendor: p.supplier ? { id: p.supplier.id, name: p.supplier.name } : null,
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

            // Resolve bank account code and name
            const bankCode = data.bankAccountCode || '1000'
            let bankAccountName = 'Cash/Bank'
            try {
                const bankAcct = await prisma.gLAccount.findFirst({ where: { code: bankCode } })
                if (bankAcct) bankAccountName = bankAcct.name
            } catch { /* fallback to default name */ }

            // Post GL entry: DR AP, CR Cash/Bank
            await postJournalEntry({
                description: `Vendor Payment ${paymentNumber}`,
                date: new Date(),
                reference: paymentNumber,
                lines: [
                    { accountCode: '2100', debit: data.amount, credit: 0, description: 'Hutang Usaha' },
                    { accountCode: bankCode, debit: 0, credit: data.amount, description: bankAccountName }
                ]
            })

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
            const accountMap = new Map<string, GLAccountNode>()
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
                        accountCode: '5000', // Default Expense (HPP)
                        debit: amount,
                        credit: 0,
                        description: `${item.description}`
                    })
                }

                // Add Tax
                if (Number(bill.taxAmount) > 0) {
                    glLines.push({
                        accountCode: '1330', // VAT In
                        debit: Number(bill.taxAmount),
                        credit: 0,
                        description: `VAT In - Bill ${bill.number}`
                    })
                    totalAmount += Number(bill.taxAmount)
                }

                // Add AP Credit
                glLines.push({
                    accountCode: '2100',
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
            const payment = await prisma.payment.create({
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
                    { accountCode: '2100', debit: paymentDetails.amount, credit: 0, description: `AP Payment` }, // Debit AP (Liability connects)
                    { accountCode: '1010', debit: 0, credit: paymentDetails.amount, description: `Bank Transfer` } // Credit Bank (Asset decreases)
                ]
            })

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

        // Populate cash flow from journal entries
        for (const entry of cashFlowEntries) {
            const dateKey = new Date(entry.date).toISOString().slice(0, 10)
            const dayEntry = cashFlow.find(cf => cf.date === dateKey)
            if (!dayEntry) continue
            for (const line of entry.lines) {
                if (line.account?.code?.startsWith('1')) {
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

            const today = new Date()
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
                const due = new Date(inv.dueDate)
                const diffMs = today.getTime() - due.getTime()
                const daysOverdue = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
                const balance = Number(inv.balanceDue)
                const custId = inv.customer?.id || 'unknown'
                const custName = inv.customer?.name || 'Tanpa Pelanggan'
                const custCode = inv.customer?.code ?? null

                let bucket: string = 'current'
                if (daysOverdue <= 0) {
                    buckets.current += balance
                    bucket = 'current'
                } else if (daysOverdue <= 30) {
                    buckets.d1_30 += balance
                    bucket = '1-30'
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
                }
                existing.invoiceCount++
                existing.total += balance
                if (bucket === 'current') existing.current += balance
                else if (bucket === '1-30') existing.d1_30 += balance
                else if (bucket === '31-60') existing.d31_60 += balance
                else if (bucket === '61-90') existing.d61_90 += balance
                else existing.d90_plus += balance
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

            const totalOutstanding = buckets.current + buckets.d1_30 + buckets.d31_60 + buckets.d61_90 + buckets.d90_plus

            return {
                summary: {
                    ...buckets,
                    totalOutstanding,
                    invoiceCount: openInvoices.length,
                },
                byCustomer: Array.from(customerMap.values()).sort((a, b) => b.total - a.total),
                details: details.sort((a, b) => b.daysOverdue - a.daysOverdue),
            }
    } catch (error) {
        console.error("Failed to generate AR aging report:", error)
        return {
            summary: { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0, totalOutstanding: 0, invoiceCount: 0 },
            byCustomer: [],
            details: [],
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

            const today = new Date()
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
                const due = new Date(bill.dueDate)
                const diffMs = today.getTime() - due.getTime()
                const daysOverdue = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
                const balance = Number(bill.balanceDue)
                const suppId = bill.supplier?.id || 'unknown'
                const suppName = bill.supplier?.name || 'Tanpa Supplier'
                const suppCode = bill.supplier?.code ?? null

                let bucket: string = 'current'
                if (daysOverdue <= 0) {
                    buckets.current += balance
                    bucket = 'current'
                } else if (daysOverdue <= 30) {
                    buckets.d1_30 += balance
                    bucket = '1-30'
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
                }
                existing.billCount++
                existing.total += balance
                if (bucket === 'current') existing.current += balance
                else if (bucket === '1-30') existing.d1_30 += balance
                else if (bucket === '31-60') existing.d31_60 += balance
                else if (bucket === '61-90') existing.d61_90 += balance
                else existing.d90_plus += balance
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

            const totalOutstanding = buckets.current + buckets.d1_30 + buckets.d31_60 + buckets.d61_90 + buckets.d90_plus

            return {
                summary: {
                    ...buckets,
                    totalOutstanding,
                    billCount: openBills.length,
                },
                bySupplier: Array.from(supplierMap.values()).sort((a, b) => b.total - a.total),
                details: details.sort((a, b) => b.daysOverdue - a.daysOverdue),
            }
    } catch (error) {
        console.error("Failed to generate AP aging report:", error)
        return {
            summary: { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0, totalOutstanding: 0, billCount: 0 },
            bySupplier: [],
            details: [],
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
                isOverdue: b.dueDate ? new Date(b.dueDate) < new Date() : false,
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
                            { accountId: expenseAccountId, debit: amount, credit: 0, description: `${category} — ${description}` },
                            { accountId: cashAccountId, credit: amount, debit: 0, description: `Pembayaran: ${description}` },
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
            const [expenseAccounts, cashAccounts] = await Promise.all([
                prisma.gLAccount.findMany({
                    where: { type: 'EXPENSE' },
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
            return { expenseAccounts, cashAccounts }
        })
    } catch (error) {
        console.error("Failed to fetch expense accounts:", error)
        return { expenseAccounts: [], cashAccounts: [] }
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
                    totalAmount: -amount,
                    balanceDue: 0,
                    taxAmount: 0,
                    subtotalAmount: -amount,
                }
            })

            // Journal: Debit Revenue, Credit AR
            await prisma.journalEntry.create({
                data: {
                    date,
                    description: `[CREDIT_NOTE] ${num}: ${reason}`,
                    reference: num,
                    status: 'POSTED',
                    invoiceId: cn.id,
                    lines: {
                        create: [
                            { accountId: revenueAccountId, debit: amount, credit: 0, description: `Nota Kredit ${num} — pengurangan pendapatan: ${reason}` },
                            { accountId: arAccountId, credit: amount, debit: 0, description: `Nota Kredit ${num} — pengurangan piutang usaha` },
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
    amount: number
    reason: string
    date: Date
    apAccountId: string
    expenseAccountId: string
}

export async function createDebitNote(input: CreateDebitNoteInput) {
    try {
        return await withPrismaAuth(async (prisma) => {
            const { supplierId, originalBillId, amount, reason, date, apAccountId, expenseAccountId } = input

            if (!supplierId || amount <= 0) {
                return { success: false, error: "Supplier dan jumlah wajib diisi" }
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
                    totalAmount: -amount,
                    balanceDue: 0,
                    taxAmount: 0,
                    subtotalAmount: -amount,
                }
            })

            // Journal: Debit AP, Credit Expense
            await prisma.journalEntry.create({
                data: {
                    date,
                    description: `[DEBIT_NOTE] ${num}: ${reason}`,
                    reference: num,
                    status: 'POSTED',
                    invoiceId: dn.id,
                    lines: {
                        create: [
                            { accountId: apAccountId, debit: amount, credit: 0, description: `Nota Debit ${num} — pengurangan hutang usaha` },
                            { accountId: expenseAccountId, credit: amount, debit: 0, description: `Nota Debit ${num} — koreksi beban/HPP: ${reason}` },
                        ]
                    }
                }
            })

            await prisma.gLAccount.update({ where: { id: apAccountId }, data: { balance: { increment: amount } } })
            await prisma.gLAccount.update({ where: { id: expenseAccountId }, data: { balance: { decrement: amount } } })

            if (originalBillId) {
                const bill = await prisma.invoice.findUnique({ where: { id: originalBillId } })
                if (bill) {
                    const newBalance = Math.max(0, Number(bill.balanceDue) - amount)
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
        return { success: false, error: "Gagal membuat debit note" }
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

