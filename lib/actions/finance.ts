'use server'

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

export async function getFinancialMetrics(): Promise<FinancialMetrics> {
    try {
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

        const receivables = calculateSum(arResult.data || [], 'balanceDue')
        const payables = calculateSum(apResult.data || [], 'balanceDue')
        const cashBal = calculateSum(cashResult.data || [], 'balance')
        
        // Burn Rate
        const burnTotal = (burnResult as any).data?.reduce((sum: number, item: any) => sum + (Number(item.debit) || 0), 0) || 0
        const burnRate = burnTotal / 30

        const revVal = calculateSum(revenueResult.data || [], 'totalAmount')
        const expVal = calculateSum(expenseResult.data || [], 'totalAmount')
        const margin = revVal > 0 ? ((revVal - expVal) / revVal) * 100 : 0

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
            overdueInvoices: overdueResult.data?.map(mapInvoice) || [],
            upcomingPayables: upcomingResult.data?.map(mapInvoice) || [],
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
            const journalLines = await prisma.journalLine.findMany({
                where: {
                    journalEntry: {
                        date: {
                            gte: start,
                            lte: end
                        },
                        status: 'POSTED'
                    }
                },
                include: {
                    account: true,
                    journalEntry: true
                }
            })

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
                    journalEntry: {
                        date: { gte: start, lte: end },
                        status: 'POSTED'
                    }
                },
                include: {
                    journalEntry: true,
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
                const description = line.journalEntry.description

                // Categorize based on description or reference
                if (description.includes('Invoice') || description.includes('Payment')) {
                    // Already in netIncome, no adjustment needed
                } else if (description.includes('Asset') || description.includes('Equipment')) {
                    investingActivities.items.push({ description, amount })
                    investingActivities.netCashFromInvesting += amount
                } else if (description.includes('Capital') || description.includes('Dividend')) {
                    financingActivities.items.push({ description, amount })
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
// PROCUREMENT INTEGRATION
// ==========================================

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
            return { success: true, billId: bill.id }
        })
    } catch (error) {
        console.error("Failed to record pending bill:", error)
        return { success: false, error: "Finance Sync Failed" }
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
            }

            return { success: true, voucherId: voucher.id, number: voucher.number }
        })
    } catch (error: any) {
        console.error("Create Payment Voucher Error:", error)
        return { success: false, error: error.message }
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
