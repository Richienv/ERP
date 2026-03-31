import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { inferSubType } from '@/lib/account-subtype-helpers'
import { TAX_RATES } from '@/lib/tax-rates'

// Pad account code to 4 digits for reliable string comparison (e.g. '900' → '0900')
function padCode(code: string): string {
    return code.padStart(4, '0')
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseDateParam(val: string | null, fallback: Date): Date {
    if (!val) return fallback
    const d = new Date(val)
    return isNaN(d.getTime()) ? fallback : d
}

// ─── 1. Profit & Loss ──────────────────────────────────────────────────────

async function fetchPnL(start: Date, end: Date) {
    const journalLines = await prisma.journalLine.findMany({
        where: {
            entry: {
                date: { gte: start, lte: end },
                status: 'POSTED',
            },
        },
        include: { account: { select: { id: true, code: true, name: true, type: true, subType: true } } },
    })

    let revenue = 0
    let costOfGoodsSold = 0
    let otherIncome = 0
    let otherExpenses = 0
    let depreciation = 0
    const expenseMap = new Map<string, number>()

    for (const line of journalLines) {
        const account = line.account
        const amount = Number(line.debit) - Number(line.credit)
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
                    const current = expenseMap.get(account.name) || 0
                    expenseMap.set(account.name, current + effectiveAmount)
                }
                break
        }
    }

    const operatingExpenses: { category: string; amount: number }[] = []
    expenseMap.forEach((amount, category) => {
        if (amount > 0) operatingExpenses.push({ category, amount })
    })
    if (depreciation > 0) {
        operatingExpenses.push({ category: 'Beban Penyusutan', amount: depreciation })
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
        period: { startDate: start.toISOString(), endDate: end.toISOString() },
    }
}

// ─── 2. Balance Sheet ──────────────────────────────────────────────────────

async function fetchBalanceSheet(asOfDate: Date) {
    const accounts = await prisma.gLAccount.findMany({
        where: { type: { in: ['ASSET', 'LIABILITY', 'EQUITY'] } },
        select: {
            id: true, code: true, name: true, type: true, subType: true, balance: true,
            lines: {
                where: {
                    entry: { date: { lte: asOfDate }, status: 'POSTED' },
                },
                select: { debit: true, credit: true },
            },
        },
        orderBy: { code: 'asc' },
    })

    // Retained earnings: split into prior-year retained + current-year net income
    // Prior years: 2000-01-01 to Dec 31 of previous year
    // Current year: Jan 1 of asOfDate's year to asOfDate
    const currentYearStart = new Date(asOfDate.getFullYear(), 0, 1)
    const priorYearEnd = new Date(asOfDate.getFullYear() - 1, 11, 31, 23, 59, 59)

    const [priorPnL, currentPnL] = await Promise.all([
        asOfDate.getFullYear() > 2000
            ? fetchPnL(new Date(2000, 0, 1), priorYearEnd)
            : Promise.resolve({ netIncome: 0 } as Awaited<ReturnType<typeof fetchPnL>>),
        fetchPnL(currentYearStart, asOfDate),
    ])

    const assets = {
        currentAssets: [] as { code: string; name: string; amount: number }[],
        fixedAssets: [] as { code: string; name: string; amount: number }[],
        otherAssets: [] as { code: string; name: string; amount: number }[],
        totalCurrentAssets: 0,
        totalFixedAssets: 0,
        totalOtherAssets: 0,
        totalAssets: 0,
    }
    const liabilities = {
        currentLiabilities: [] as { code: string; name: string; amount: number }[],
        longTermLiabilities: [] as { code: string; name: string; amount: number }[],
        totalCurrentLiabilities: 0,
        totalLongTermLiabilities: 0,
        totalLiabilities: 0,
    }
    const equity = {
        capital: [] as { code: string; name: string; amount: number }[],
        retainedEarnings: priorPnL.netIncome,
        currentYearNetIncome: currentPnL.netIncome,
        totalEquity: 0,
    }

    for (const account of accounts) {
        const totalDebit = account.lines.reduce((sum, l) => sum + Number(l.debit), 0)
        const totalCredit = account.lines.reduce((sum, l) => sum + Number(l.credit), 0)
        const balance = account.type === 'ASSET' ? totalDebit - totalCredit : totalCredit - totalDebit

        if (Math.abs(balance) < 0.01) continue

        // Resolve subType (prefer DB value, fall back to code-based inference)
        const st = account.subType && account.subType !== 'GENERAL'
            ? account.subType
            : inferSubType(account.code)

        switch (account.type) {
            case 'ASSET': {
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
            case 'LIABILITY':
                if (st === 'LIABILITY_PAYABLE' || st === 'LIABILITY_CURRENT') {
                    liabilities.currentLiabilities.push({ code: account.code, name: account.name, amount: balance })
                    liabilities.totalCurrentLiabilities += balance
                } else {
                    // LIABILITY_NON_CURRENT or any unrecognized liability subType
                    liabilities.longTermLiabilities.push({ code: account.code, name: account.name, amount: balance })
                    liabilities.totalLongTermLiabilities += balance
                }
                break
            case 'EQUITY':
                // Include ALL equity accounts (capital, retained earnings GL, other equity)
                equity.capital.push({ code: account.code, name: account.name, amount: balance })
                break
        }
    }

    // ── Fallback: compute AR/AP from outstanding invoices/bills ──
    // If Piutang (AR) or Hutang (AP) have zero GL balance but there ARE outstanding
    // invoices/bills, show the invoice-derived amount so the Neraca isn't misleading.
    const hasAR = assets.currentAssets.some(a => a.code === '1200')
    const hasAP = liabilities.currentLiabilities.some(l => l.code === '2000')

    if (!hasAR || !hasAP) {
        const [arAgg, apAgg] = await Promise.all([
            !hasAR ? prisma.invoice.aggregate({
                where: { type: 'INV_OUT', status: { in: ['ISSUED', 'PARTIAL', 'OVERDUE'] } },
                _sum: { balanceDue: true },
            }) : Promise.resolve(null),
            !hasAP ? prisma.invoice.aggregate({
                where: { type: 'INV_IN', status: { in: ['ISSUED', 'PARTIAL', 'OVERDUE'] } },
                _sum: { balanceDue: true },
            }) : Promise.resolve(null),
        ])

        if (!hasAR && arAgg) {
            const arAmount = Number(arAgg._sum.balanceDue || 0)
            if (arAmount > 0.01) {
                assets.currentAssets.push({ code: '1200', name: 'Piutang Usaha', amount: arAmount })
                assets.totalCurrentAssets += arAmount
            }
        }
        if (!hasAP && apAgg) {
            const apAmount = Number(apAgg._sum.balanceDue || 0)
            if (apAmount > 0.01) {
                liabilities.currentLiabilities.push({ code: '2000', name: 'Hutang Usaha', amount: apAmount })
                liabilities.totalCurrentLiabilities += apAmount
            }
        }
    }

    assets.totalAssets = assets.totalCurrentAssets + assets.totalFixedAssets + assets.totalOtherAssets

    // If P&L deducts estimated corporate tax, add matching "Estimated Tax Payable" to liabilities
    // so the balance sheet stays balanced (A = L + E). This is a virtual provision that
    // should be replaced by an actual tax JE when the tax return is filed.
    const currentTaxProvision = currentPnL.taxExpense ?? 0
    const priorTaxProvision = priorPnL.taxExpense ?? 0
    if (currentTaxProvision > 0 || priorTaxProvision > 0) {
        const totalProvision = currentTaxProvision + priorTaxProvision
        liabilities.currentLiabilities.push({
            code: 'TAX-EST',
            name: 'Estimasi Hutang Pajak Penghasilan',
            amount: totalProvision,
        })
        liabilities.totalCurrentLiabilities += totalProvision
    }

    liabilities.totalLiabilities = liabilities.totalCurrentLiabilities + liabilities.totalLongTermLiabilities
    const capitalTotal = equity.capital.reduce((sum, c) => sum + c.amount, 0)
    equity.totalEquity = capitalTotal + priorPnL.netIncome + currentPnL.netIncome

    const totalAssets = assets.totalAssets
    const totalLiabilities = liabilities.totalLiabilities
    const totalEquity = equity.totalEquity

    const balanceCheck = {
        totalAssets,
        totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
        difference: totalAssets - (totalLiabilities + totalEquity),
        isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 1,
    }

    return {
        assets,
        liabilities,
        equity,
        totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
        balanceCheck,
        asOfDate: asOfDate.toISOString(),
    }
}

// ─── 3. Cash Flow ──────────────────────────────────────────────────────────

async function fetchCashFlow(start: Date, end: Date) {
    const pnlData = await fetchPnL(start, end)

    // Include all cash & bank accounts (10xx series): 1000 Kas, 1010 BCA, 1020 Mandiri, 1050 Petty Cash, etc.
    const cashAccounts = await prisma.gLAccount.findMany({
        where: {
            type: 'ASSET',
            code: { gte: '1000', lt: '1100' },
        },
        include: {
            lines: {
                where: { entry: { date: { lt: start }, status: 'POSTED' } },
                select: { debit: true, credit: true },
            },
        },
    })

    // Beginning cash = sum of cash account balances before the start date (historical, not current)
    const beginningCash = cashAccounts.reduce((sum, acc) => {
        const d = acc.lines.reduce((s, l) => s + Number(l.debit), 0)
        const c = acc.lines.reduce((s, l) => s + Number(l.credit), 0)
        return sum + d - c
    }, 0)

    const cashAccountIds = new Set(cashAccounts.map(a => a.id))

    // Fetch cash journal lines WITH the full entry (including ALL sibling lines + their accounts)
    // so we can determine the contra account type for classification
    const cashJournalLines = await prisma.journalLine.findMany({
        where: {
            accountId: { in: cashAccounts.map(a => a.id) },
            entry: { date: { gte: start, lte: end }, status: 'POSTED' },
        },
        include: {
            entry: {
                include: {
                    lines: {
                        include: { account: { select: { id: true, type: true, code: true, name: true } } },
                    },
                },
            },
            account: true,
        },
    })

    const operatingActivities = {
        netIncome: pnlData.netIncome,
        adjustments: [] as { description: string; amount: number }[],
        changesInWorkingCapital: [] as { description: string; amount: number }[],
        netCashFromOperating: 0,
    }
    const investingActivities = {
        items: [] as { description: string; amount: number }[],
        netCashFromInvesting: 0,
    }
    const financingActivities = {
        items: [] as { description: string; amount: number }[],
        netCashFromFinancing: 0,
    }

    // Classify each cash movement by the CONTRA account type (the other side of the entry)
    const processedEntries = new Set<string>()
    for (const line of cashJournalLines) {
        // Avoid double-counting if multiple cash lines in same entry
        if (processedEntries.has(line.entry.id)) continue
        processedEntries.add(line.entry.id)

        const amount = line.entry.lines
            .filter(l => cashAccountIds.has(l.accountId))
            .reduce((sum, l) => sum + Number(l.debit) - Number(l.credit), 0)

        // Find contra accounts (non-cash lines in this entry)
        const contraLines = line.entry.lines.filter(l => !cashAccountIds.has(l.accountId))
        const contraTypes = new Set(contraLines.map(l => l.account?.type).filter(Boolean))
        const description = line.entry.description || contraLines[0]?.account?.name || 'Transaksi kas'

        // Classify based on contra account type
        if (contraTypes.has('EQUITY')) {
            // Equity contra → Financing (e.g., Modal Pemilik, Dividen)
            financingActivities.items.push({ description, amount })
            financingActivities.netCashFromFinancing += amount
        } else if (contraTypes.has('ASSET') && !contraTypes.has('REVENUE') && !contraTypes.has('EXPENSE')) {
            // Non-cash asset contra → Investing (e.g., fixed assets, equipment)
            // But only if no revenue/expense lines (otherwise it's operating)
            const nonCashAssetLines = contraLines.filter(l => l.account?.type === 'ASSET')
            const isFixedAsset = nonCashAssetLines.some(l => {
                const code = l.account?.code || ''
                // Cash accounts start with 1000/1010/1020, skip those
                // AR is 1100, Inventory is 1200 — these are operating
                // Fixed assets typically 1300+, 1400+, 1500+
                return padCode(code) >= '1300'
            })
            if (isFixedAsset) {
                investingActivities.items.push({ description, amount })
                investingActivities.netCashFromInvesting += amount
            }
            // If contra is AR/Inventory (1100, 1200), it's operating — already captured via net income + working capital
        } else if (contraTypes.has('LIABILITY')) {
            // Long-term liability could be financing, but current liabilities are operating
            const liabilityLines = contraLines.filter(l => l.account?.type === 'LIABILITY')
            const isLongTerm = liabilityLines.some(l => {
                const code = l.account?.code || ''
                return padCode(code) >= '2200' // Long-term liabilities
            })
            if (isLongTerm) {
                financingActivities.items.push({ description, amount })
                financingActivities.netCashFromFinancing += amount
            }
            // Short-term liabilities (AP, etc.) are working capital — already in operating
        }
        // Revenue/Expense contra → already captured in net income (operating), skip
    }

    // AR and AP working capital changes: use GL period deltas (end balance - beginning balance)
    // This is more accurate than using current invoice totals which don't reflect period changes
    const arAccount = await prisma.gLAccount.findFirst({ where: { code: '1200', type: 'ASSET' } })
    const apAccount = await prisma.gLAccount.findFirst({ where: { code: '2000', type: 'LIABILITY' } })

    async function getAccountBalance(accountId: string | undefined, asOf: Date): Promise<number> {
        if (!accountId) return 0
        const lines = await prisma.journalLine.findMany({
            where: { accountId, entry: { date: { lte: asOf }, status: 'POSTED' } },
            select: { debit: true, credit: true },
        })
        return lines.reduce((sum, l) => sum + Number(l.debit) - Number(l.credit), 0)
    }

    const [arBegin, arEnd, apBegin, apEnd] = await Promise.all([
        getAccountBalance(arAccount?.id, new Date(start.getTime() - 1)),
        getAccountBalance(arAccount?.id, end),
        getAccountBalance(apAccount?.id, new Date(start.getTime() - 1)),
        getAccountBalance(apAccount?.id, end),
    ])

    // AR is asset (debit-normal): increase in AR = cash used (negative for cash flow)
    const arChange = arEnd - arBegin
    // AP is liability (credit-normal): balance is debit-credit, so negative = increase in AP = cash source
    const apChange = apEnd - apBegin

    operatingActivities.changesInWorkingCapital.push(
        { description: 'Perubahan Piutang Usaha', amount: -arChange },
        { description: 'Perubahan Hutang Usaha', amount: -apChange },
    )

    const workingCapitalChange = -arChange + (-apChange)
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
        period: { startDate: start.toISOString(), endDate: end.toISOString() },
    }
}

// ─── 4. Trial Balance ──────────────────────────────────────────────────────

async function fetchTrialBalance(start: Date, end: Date) {
    const accounts = await prisma.gLAccount.findMany({
        orderBy: { code: 'asc' },
        include: {
            lines: {
                where: {
                    entry: { date: { gte: start, lte: end }, status: 'POSTED' },
                },
                select: { debit: true, credit: true },
            },
        },
    })

    let totalDebits = 0
    let totalCredits = 0

    const rows = accounts
        .map(acc => {
            const rawDebit = acc.lines.reduce((sum, l) => sum + Number(l.debit), 0)
            const rawCredit = acc.lines.reduce((sum, l) => sum + Number(l.credit), 0)
            const net = rawDebit - rawCredit

            // Net into a single column based on normal balance direction
            // ASSET & EXPENSE: normal debit balance → positive net = debit
            // LIABILITY, EQUITY, REVENUE: normal credit balance → positive net = credit
            const isDebitNormal = ['ASSET', 'EXPENSE'].includes(acc.type)
            let debit = 0
            let credit = 0

            if (isDebitNormal) {
                // Positive net → debit column; negative net → credit column (contra)
                if (net >= 0) debit = net; else credit = Math.abs(net)
            } else {
                // Positive net (more debits) → debit column (contra); negative net → credit column
                if (net > 0) debit = net; else credit = Math.abs(net)
            }

            totalDebits += debit
            totalCredits += credit

            return {
                accountCode: acc.code,
                accountName: acc.name,
                accountType: acc.type,
                debit,
                credit,
                balance: net,
            }
        })
        .filter(r => r.debit !== 0 || r.credit !== 0)
        .sort((a, b) => {
            const typeOrder: Record<string, number> = { ASSET: 0, LIABILITY: 1, EQUITY: 2, REVENUE: 3, EXPENSE: 4 }
            const ta = typeOrder[a.accountType] ?? 9
            const tb = typeOrder[b.accountType] ?? 9
            if (ta !== tb) return ta - tb
            return a.accountCode.localeCompare(b.accountCode)
        })

    return {
        rows,
        totals: {
            totalDebits: Math.round(totalDebits * 100) / 100,
            totalCredits: Math.round(totalCredits * 100) / 100,
            difference: Math.round((totalDebits - totalCredits) * 100) / 100,
            isBalanced: Math.abs(totalDebits - totalCredits) < 0.01,
        },
        period: { start: start.toISOString(), end: end.toISOString() },
    }
}

// ─── 5. AR Aging ───────────────────────────────────────────────────────────

async function fetchARaging(start?: Date, end?: Date) {
    const where: any = { type: 'INV_OUT', status: { in: ['ISSUED', 'PARTIAL', 'OVERDUE'] } }
    if (start && end) {
        where.issueDate = { gte: start, lte: end }
    }
    const openInvoices = await prisma.invoice.findMany({
        where,
        select: {
            id: true,
            number: true,
            issueDate: true,
            dueDate: true,
            totalAmount: true,
            balanceDue: true,
            status: true,
            customer: { select: { id: true, name: true, code: true } },
        },
        orderBy: { dueDate: 'asc' },
    })

    const today = new Date()
    const buckets = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 }
    const customerMap = new Map<string, {
        customerId: string; customerName: string; customerCode: string | null
        current: number; d1_30: number; d31_60: number; d61_90: number; d90_plus: number
        total: number; invoiceCount: number
        invoices: Array<{
            id: string; invoiceNumber: string; issueDate: Date; dueDate: Date
            totalAmount: number; paidAmount: number; balanceDue: number
            daysOverdue: number; bucket: string; status: string
        }>
    }>()
    const details: Array<{
        invoiceNumber: string; customerName: string; dueDate: Date
        balanceDue: number; daysOverdue: number; bucket: string
    }> = []

    for (const inv of openInvoices) {
        const due = new Date(inv.dueDate)
        const daysOverdue = Math.max(0, Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)))
        const balance = Number(inv.balanceDue)
        const custId = inv.customer?.id || 'unknown'
        const custName = inv.customer?.name || 'Tanpa Pelanggan'
        const custCode = inv.customer?.code ?? null

        let bucket = 'current'
        if (daysOverdue <= 0) { buckets.current += balance; bucket = 'current' }
        else if (daysOverdue <= 30) { buckets.d1_30 += balance; bucket = '1-30' }
        else if (daysOverdue <= 60) { buckets.d31_60 += balance; bucket = '31-60' }
        else if (daysOverdue <= 90) { buckets.d61_90 += balance; bucket = '61-90' }
        else { buckets.d90_plus += balance; bucket = '90+' }

        const existing = customerMap.get(custId) || {
            customerId: custId, customerName: custName, customerCode: custCode,
            current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0, total: 0, invoiceCount: 0,
            invoices: [] as Array<{
                id: string; invoiceNumber: string; issueDate: Date; dueDate: Date
                totalAmount: number; paidAmount: number; balanceDue: number
                daysOverdue: number; bucket: string; status: string
            }>,
        }
        existing.invoiceCount++
        existing.total += balance
        if (bucket === 'current') existing.current += balance
        else if (bucket === '1-30') existing.d1_30 += balance
        else if (bucket === '31-60') existing.d31_60 += balance
        else if (bucket === '61-90') existing.d61_90 += balance
        else existing.d90_plus += balance
        customerMap.set(custId, existing)
        existing.invoices.push({
            id: inv.id,
            invoiceNumber: inv.number,
            issueDate: inv.issueDate,
            dueDate: due,
            totalAmount: Number(inv.totalAmount),
            paidAmount: Number(inv.totalAmount) - balance,
            balanceDue: balance,
            daysOverdue,
            bucket,
            status: inv.status,
        })

        details.push({ invoiceNumber: inv.number, customerName: custName, dueDate: due, balanceDue: balance, daysOverdue, bucket })
    }

    for (const cust of customerMap.values()) {
        cust.invoices.sort((a, b) => b.daysOverdue - a.daysOverdue)
    }

    const totalOutstanding = buckets.current + buckets.d1_30 + buckets.d31_60 + buckets.d61_90 + buckets.d90_plus

    return {
        summary: { ...buckets, totalOutstanding, invoiceCount: openInvoices.length },
        byCustomer: Array.from(customerMap.values()).sort((a, b) => b.total - a.total),
        details: details.sort((a, b) => b.daysOverdue - a.daysOverdue),
    }
}

// ─── 6. AP Aging ───────────────────────────────────────────────────────────

async function fetchAPaging(start?: Date, end?: Date) {
    const where: any = { type: 'INV_IN', status: { in: ['ISSUED', 'PARTIAL', 'OVERDUE'] } }
    if (start && end) {
        where.issueDate = { gte: start, lte: end }
    }
    const openBills = await prisma.invoice.findMany({
        where,
        select: {
            id: true,
            number: true,
            issueDate: true,
            dueDate: true,
            totalAmount: true,
            balanceDue: true,
            status: true,
            supplier: { select: { id: true, name: true, code: true } },
        },
        orderBy: { dueDate: 'asc' },
    })

    const today = new Date()
    const buckets = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 }
    const supplierMap = new Map<string, {
        supplierId: string; supplierName: string; supplierCode: string | null
        current: number; d1_30: number; d31_60: number; d61_90: number; d90_plus: number
        total: number; billCount: number
        bills: Array<{
            id: string; billNumber: string; issueDate: Date; dueDate: Date
            totalAmount: number; paidAmount: number; balanceDue: number
            daysOverdue: number; bucket: string; status: string
        }>
    }>()
    const details: Array<{
        billNumber: string; supplierName: string; dueDate: Date
        balanceDue: number; daysOverdue: number; bucket: string
    }> = []

    for (const bill of openBills) {
        const due = new Date(bill.dueDate)
        const daysOverdue = Math.max(0, Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)))
        const balance = Number(bill.balanceDue)
        const suppId = bill.supplier?.id || 'unknown'
        const suppName = bill.supplier?.name || 'Tanpa Supplier'
        const suppCode = bill.supplier?.code ?? null

        let bucket = 'current'
        if (daysOverdue <= 0) { buckets.current += balance; bucket = 'current' }
        else if (daysOverdue <= 30) { buckets.d1_30 += balance; bucket = '1-30' }
        else if (daysOverdue <= 60) { buckets.d31_60 += balance; bucket = '31-60' }
        else if (daysOverdue <= 90) { buckets.d61_90 += balance; bucket = '61-90' }
        else { buckets.d90_plus += balance; bucket = '90+' }

        const existing = supplierMap.get(suppId) || {
            supplierId: suppId, supplierName: suppName, supplierCode: suppCode,
            current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0, total: 0, billCount: 0,
            bills: [] as Array<{
                id: string; billNumber: string; issueDate: Date; dueDate: Date
                totalAmount: number; paidAmount: number; balanceDue: number
                daysOverdue: number; bucket: string; status: string
            }>,
        }
        existing.billCount++
        existing.total += balance
        if (bucket === 'current') existing.current += balance
        else if (bucket === '1-30') existing.d1_30 += balance
        else if (bucket === '31-60') existing.d31_60 += balance
        else if (bucket === '61-90') existing.d61_90 += balance
        else existing.d90_plus += balance
        supplierMap.set(suppId, existing)
        existing.bills.push({
            id: bill.id,
            billNumber: bill.number,
            issueDate: bill.issueDate,
            dueDate: due,
            totalAmount: Number(bill.totalAmount),
            paidAmount: Number(bill.totalAmount) - balance,
            balanceDue: balance,
            daysOverdue,
            bucket,
            status: bill.status,
        })

        details.push({ billNumber: bill.number, supplierName: suppName, dueDate: due, balanceDue: balance, daysOverdue, bucket })
    }

    for (const supp of supplierMap.values()) {
        supp.bills.sort((a, b) => b.daysOverdue - a.daysOverdue)
    }

    const totalOutstanding = buckets.current + buckets.d1_30 + buckets.d31_60 + buckets.d61_90 + buckets.d90_plus

    return {
        summary: { ...buckets, totalOutstanding, billCount: openBills.length },
        bySupplier: Array.from(supplierMap.values()).sort((a, b) => b.total - a.total),
        details: details.sort((a, b) => b.daysOverdue - a.daysOverdue),
    }
}

// ─── 7. Revenue from Invoices ──────────────────────────────────────────────

async function fetchRevenueFromInvoices(start: Date, end: Date) {
    const invoices = await prisma.invoice.findMany({
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

    return { totalRevenue, totalPaid, totalOutstanding, invoiceCount: invoices.length }
}

// ─── 8. Statement of Equity Changes ────────────────────────────────────────

async function fetchEquityChanges(start: Date, end: Date) {
    const equityAccounts = await prisma.gLAccount.findMany({
        where: { type: 'EQUITY' },
        select: { id: true, code: true, name: true, balance: true },
        orderBy: { code: 'asc' },
    })

    const lines = await prisma.journalLine.findMany({
        where: {
            account: { type: 'EQUITY' },
            entry: { status: 'POSTED', date: { gte: start, lte: end } },
        },
        include: {
            account: { select: { id: true, code: true, name: true } },
            entry: { select: { date: true, description: true } },
        },
    })

    // Net income for equity statement
    const [revenueLines, expenseLines] = await Promise.all([
        prisma.journalLine.findMany({
            where: { account: { type: 'REVENUE' }, entry: { status: 'POSTED', date: { gte: start, lte: end } } },
            select: { debit: true, credit: true },
        }),
        prisma.journalLine.findMany({
            where: { account: { type: 'EXPENSE' }, entry: { status: 'POSTED', date: { gte: start, lte: end } } },
            select: { debit: true, credit: true },
        }),
    ])

    const totalRevenue = revenueLines.reduce((s, l) => s + Number(l.credit) - Number(l.debit), 0)
    const totalExpense = expenseLines.reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0)
    const netIncome = totalRevenue - totalExpense

    const accountChanges = equityAccounts.map(acc => {
        const accLines = lines.filter(l => l.account.id === acc.id)
        const additions = accLines.reduce((s, l) => s + Number(l.credit), 0)
        const deductions = accLines.reduce((s, l) => s + Number(l.debit), 0)
        const netChange = additions - deductions
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
        period: { startDate: start.toISOString(), endDate: end.toISOString() },
        accounts: accountChanges,
        netIncome,
        totalOpeningEquity: totalOpening,
        totalClosingEquity: totalClosing,
        totalChange: totalClosing - totalOpening,
    }
}

// ─── 9. Inventory Turnover ─────────────────────────────────────────────────

async function fetchInventoryTurnover(start: Date, end: Date) {
    const products = await prisma.product.findMany({
        where: { isActive: true },
        select: {
            id: true, code: true, name: true, unit: true, costPrice: true,
            stockLevels: { select: { quantity: true } },
        },
    })

    const [transactions, incomingTx] = await Promise.all([
        prisma.inventoryTransaction.findMany({
            where: {
                createdAt: { gte: start, lte: end },
                type: { in: ['SO_SHIPMENT', 'PRODUCTION_OUT', 'SCRAP', 'RETURN_OUT', 'SUBCONTRACT_OUT'] },
            },
            select: { productId: true, quantity: true, type: true },
        }),
        prisma.inventoryTransaction.findMany({
            where: {
                createdAt: { gte: start, lte: end },
                type: { in: ['PO_RECEIVE', 'PRODUCTION_IN', 'RETURN_IN', 'SUBCONTRACT_IN'] },
            },
            select: { productId: true, quantity: true },
        }),
    ])

    const daysDiff = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))

    const items = products.map(p => {
        const currentStock = p.stockLevels.reduce((s, sl) => s + Number(sl.quantity), 0)
        const outQty = transactions.filter(t => t.productId === p.id).reduce((s, t) => s + Math.abs(Number(t.quantity)), 0)
        const inQty = incomingTx.filter(t => t.productId === p.id).reduce((s, t) => s + Number(t.quantity), 0)

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
        period: { startDate: start.toISOString(), endDate: end.toISOString(), days: daysDiff },
        items,
        summary: {
            totalProducts: items.length,
            totalInventoryValue: totalValue,
            averageTurnoverRatio: Math.round(avgTurnover * 100) / 100,
            slowMovingCount,
        },
    }
}

// ─── 10. Tax Report (PPN) ──────────────────────────────────────────────────

async function fetchTaxReport(start: Date, end: Date) {
    const [outInvoices, inInvoices] = await Promise.all([
        prisma.invoice.findMany({
            where: {
                type: 'INV_OUT',
                status: { notIn: ['CANCELLED', 'VOID', 'DRAFT'] },
                issueDate: { gte: start, lte: end },
            },
            select: {
                id: true, number: true, issueDate: true,
                subtotal: true, taxAmount: true, totalAmount: true,
                customer: { select: { name: true, code: true } },
            },
            orderBy: { issueDate: 'asc' },
        }),
        prisma.invoice.findMany({
            where: {
                type: 'INV_IN',
                status: { notIn: ['CANCELLED', 'VOID', 'DRAFT'] },
                issueDate: { gte: start, lte: end },
            },
            select: {
                id: true, number: true, issueDate: true,
                subtotal: true, taxAmount: true, totalAmount: true,
                supplier: { select: { name: true, code: true } },
            },
            orderBy: { issueDate: 'asc' },
        }),
    ])

    const totalPPNKeluaran = outInvoices.reduce((s, i) => s + Number(i.taxAmount || 0), 0)
    const totalPPNMasukan = inInvoices.reduce((s, i) => s + Number(i.taxAmount || 0), 0)
    const netPPN = totalPPNKeluaran - totalPPNMasukan

    const months: Record<string, { keluaran: number; masukan: number }> = {}
    for (const inv of outInvoices) {
        const key = new Date(inv.issueDate).toISOString().slice(0, 7)
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
        period: { startDate: start.toISOString(), endDate: end.toISOString() },
        ppnKeluaran: {
            total: totalPPNKeluaran,
            invoiceCount: outInvoices.length,
            items: outInvoices.map(i => ({
                number: i.number,
                date: i.issueDate,
                partyName: i.customer?.name || '\u2014',
                dpp: Number(i.subtotal),
                ppn: Number(i.taxAmount || 0),
                total: Number(i.totalAmount),
            })),
        },
        ppnMasukan: {
            total: totalPPNMasukan,
            invoiceCount: inInvoices.length,
            items: inInvoices.map(i => ({
                number: i.number,
                date: i.issueDate,
                partyName: i.supplier?.name || '\u2014',
                dpp: Number(i.subtotal),
                ppn: Number(i.taxAmount || 0),
                total: Number(i.totalAmount),
            })),
        },
        netPPN,
        status: netPPN >= 0 ? 'KURANG_BAYAR' as const : 'LEBIH_BAYAR' as const,
        monthlyBreakdown,
    }
}

// ─── 11. Budget vs Actual ──────────────────────────────────────────────────

async function fetchBudgetVsActual(start: Date, end: Date) {
    // Find active budget for the year
    const year = start.getFullYear()
    const budget = await prisma.budget.findUnique({
        where: { year },
        include: {
            lines: {
                include: { account: { select: { id: true, code: true, name: true, type: true } } },
                orderBy: [{ account: { code: 'asc' } }, { month: 'asc' }],
            },
        },
    })

    if (!budget) {
        return null // No budget for this year
    }

    const actualLines = await prisma.journalLine.findMany({
        where: {
            entry: { status: 'POSTED', date: { gte: start, lte: end } },
        },
        include: {
            account: { select: { id: true, code: true, name: true, type: true } },
            entry: { select: { date: true } },
        },
    })

    const accountMap = new Map<string, {
        accountCode: string; accountName: string; accountType: string
        budgetAmount: number; actualAmount: number
    }>()

    for (const line of budget.lines) {
        const key = line.account.id
        const existing = accountMap.get(key) || {
            accountCode: line.account.code, accountName: line.account.name,
            accountType: line.account.type, budgetAmount: 0, actualAmount: 0,
        }
        existing.budgetAmount += Number(line.amount)
        accountMap.set(key, existing)
    }

    for (const line of actualLines) {
        const key = line.account.id
        const existing = accountMap.get(key) || {
            accountCode: line.account.code, accountName: line.account.name,
            accountType: line.account.type, budgetAmount: 0, actualAmount: 0,
        }
        if (line.account.type === 'EXPENSE' || line.account.type === 'ASSET') {
            existing.actualAmount += Number(line.debit) - Number(line.credit)
        } else {
            existing.actualAmount += Number(line.credit) - Number(line.debit)
        }
        accountMap.set(key, existing)
    }

    const items = Array.from(accountMap.values())
        .map(item => ({
            ...item,
            variance: item.budgetAmount - item.actualAmount,
            variancePct: item.budgetAmount > 0 ? ((item.budgetAmount - item.actualAmount) / item.budgetAmount) * 100 : 0,
        }))
        .sort((a, b) => a.accountCode.localeCompare(b.accountCode))

    const totalBudget = items.reduce((s, i) => s + i.budgetAmount, 0)
    const totalActual = items.reduce((s, i) => s + i.actualAmount, 0)

    return {
        budgetName: budget.name,
        budgetYear: budget.year,
        period: { startDate: start.toISOString(), endDate: end.toISOString() },
        items,
        summary: {
            totalBudget,
            totalActual,
            totalVariance: totalBudget - totalActual,
            totalVariancePct: totalBudget > 0 ? ((totalBudget - totalActual) / totalBudget) * 100 : 0,
        },
    }
}

// ─── GET Handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
    try {
        // 1. Single auth check
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        }

        // 2. Parse date params (default: fiscal year Jan 1 → today)
        const { searchParams } = new URL(request.url)
        const now = new Date()
        const start = parseDateParam(searchParams.get('start'), new Date(now.getFullYear(), 0, 1))
        const end = parseDateParam(searchParams.get('end'), now)

        // 3. Fetch all reports in parallel
        const results = await Promise.allSettled([
            fetchPnL(start, end),                   // 0
            fetchBalanceSheet(end),                   // 1
            fetchCashFlow(start, end),               // 2
            fetchTrialBalance(start, end),           // 3
            fetchARaging(start, end),                // 4
            fetchAPaging(start, end),                // 5
            fetchRevenueFromInvoices(start, end),    // 6
            fetchEquityChanges(start, end),          // 7
            fetchInventoryTurnover(start, end),      // 8
            fetchTaxReport(start, end),              // 9
            fetchBudgetVsActual(start, end),         // 10
        ])

        // Helper to extract value or null
        const val = <T>(r: PromiseSettledResult<T>): T | null =>
            r.status === 'fulfilled' ? r.value : null

        const pnl = val(results[0])
        const bs = val(results[1])
        const cf = val(results[2])
        const tb = val(results[3])
        const arAging = val(results[4])
        const apAging = val(results[5])
        const revenueInv = val(results[6])
        const equityChanges = val(results[7])
        const inventoryTurnover = val(results[8])
        const taxReport = val(results[9])
        const budgetVsActual = val(results[10])

        // 4. Build KPI from results
        const kpi = {
            revenue: pnl?.revenue ?? 0,
            netIncome: pnl?.netIncome ?? 0,
            arOutstanding: arAging?.summary?.totalOutstanding ?? 0,
            apOutstanding: apAging?.summary?.totalOutstanding ?? 0,
            // Invoice-based breakdown for context
            invoicedRevenue: revenueInv?.totalRevenue ?? 0,
            invoicedPaid: revenueInv?.totalPaid ?? 0,
            invoicedOutstanding: revenueInv?.totalOutstanding ?? 0,
            invoiceCount: revenueInv?.invoiceCount ?? 0,
        }

        // Log any rejected promises for debugging
        results.forEach((r, i) => {
            if (r.status === 'rejected') {
                const names = ['pnl', 'bs', 'cf', 'tb', 'ar_aging', 'ap_aging', 'revenue', 'equity', 'inventory', 'tax', 'budget']
                console.error(`[finance/reports] ${names[i]} failed:`, r.reason)
            }
        })

        // 5. Return consolidated response
        return NextResponse.json({
            success: true,
            kpi,
            reports: {
                pnl,
                bs,
                cf,
                tb,
                ar_aging: arAging,
                ap_aging: apAging,
                equity_changes: equityChanges,
                inventory_turnover: inventoryTurnover,
                tax_report: taxReport,
                budget_vs_actual: budgetVsActual,
            },
            period: {
                start: start.toISOString(),
                end: end.toISOString(),
            },
        })
    } catch (error) {
        console.error('[finance/reports] GET error:', error)
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 },
        )
    }
}
