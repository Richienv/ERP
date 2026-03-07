import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

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
        include: { account: true },
    })

    let revenue = 0
    let costOfGoodsSold = 0
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
                if (account.code >= '7000' && account.code < '9000') {
                    otherIncome += effectiveAmount
                } else {
                    revenue += effectiveAmount
                }
                break
            case 'EXPENSE':
                if (account.code === '5000' || account.name.toLowerCase().includes('harga pokok')) {
                    costOfGoodsSold += effectiveAmount
                } else if (account.code >= '8000') {
                    otherExpenses += effectiveAmount
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
    operatingExpenses.sort((a, b) => b.amount - a.amount)

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
        period: { startDate: start.toISOString(), endDate: end.toISOString() },
    }
}

// ─── 2. Balance Sheet ──────────────────────────────────────────────────────

async function fetchBalanceSheet(asOfDate: Date, start: Date) {
    const accounts = await prisma.gLAccount.findMany({
        where: { type: { in: ['ASSET', 'LIABILITY', 'EQUITY'] } },
        include: {
            lines: {
                where: {
                    entry: { date: { lte: asOfDate }, status: 'POSTED' },
                },
                select: { debit: true, credit: true },
            },
        },
        orderBy: { code: 'asc' },
    })

    // Retained earnings from P&L for current year
    const yearStart = new Date(asOfDate.getFullYear(), 0, 1)
    const pnlForRetained = await fetchPnL(yearStart, asOfDate)

    const assets = {
        currentAssets: [] as { name: string; amount: number }[],
        fixedAssets: [] as { name: string; amount: number }[],
        otherAssets: [] as { name: string; amount: number }[],
        totalCurrentAssets: 0,
        totalFixedAssets: 0,
        totalOtherAssets: 0,
        totalAssets: 0,
    }
    const liabilities = {
        currentLiabilities: [] as { name: string; amount: number }[],
        longTermLiabilities: [] as { name: string; amount: number }[],
        totalCurrentLiabilities: 0,
        totalLongTermLiabilities: 0,
        totalLiabilities: 0,
    }
    const equity = {
        capital: [] as { name: string; amount: number }[],
        retainedEarnings: pnlForRetained.netIncome,
        totalEquity: 0,
    }

    for (const account of accounts) {
        const totalDebit = account.lines.reduce((sum, l) => sum + Number(l.debit), 0)
        const totalCredit = account.lines.reduce((sum, l) => sum + Number(l.credit), 0)
        const balance = account.type === 'ASSET' ? totalDebit - totalCredit : totalCredit - totalDebit

        if (Math.abs(balance) < 0.01) continue

        switch (account.type) {
            case 'ASSET':
                if (account.code >= '1000' && account.code < '1500') {
                    assets.currentAssets.push({ name: account.name, amount: balance })
                    assets.totalCurrentAssets += balance
                } else if (account.code >= '1500' && account.code < '2000') {
                    assets.fixedAssets.push({ name: account.name, amount: balance })
                    assets.totalFixedAssets += balance
                } else {
                    assets.otherAssets.push({ name: account.name, amount: balance })
                    assets.totalOtherAssets += balance
                }
                break
            case 'LIABILITY':
                if (account.code >= '2000' && account.code < '2500') {
                    liabilities.currentLiabilities.push({ name: account.name, amount: balance })
                    liabilities.totalCurrentLiabilities += balance
                } else {
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
        asOfDate: asOfDate.toISOString(),
    }
}

// ─── 3. Cash Flow ──────────────────────────────────────────────────────────

async function fetchCashFlow(start: Date, end: Date) {
    const pnlData = await fetchPnL(start, end)

    const cashAccounts = await prisma.gLAccount.findMany({
        where: {
            type: 'ASSET',
            OR: [
                { code: { startsWith: '1000' } },
                { code: { startsWith: '1010' } },
                { code: { startsWith: '1020' } },
            ],
        },
    })

    const beginningCash = cashAccounts.reduce((sum, acc) => sum + Number(acc.balance), 0)

    const cashJournalLines = await prisma.journalLine.findMany({
        where: {
            accountId: { in: cashAccounts.map(a => a.id) },
            entry: { date: { gte: start, lte: end }, status: 'POSTED' },
        },
        include: { entry: true, account: true },
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

    // AR and AP for working capital changes
    const [arInvoices, apInvoices] = await Promise.all([
        prisma.invoice.findMany({
            where: { type: 'INV_OUT', status: { in: ['ISSUED', 'PARTIAL', 'OVERDUE'] } },
            select: { balanceDue: true },
        }),
        prisma.invoice.findMany({
            where: { type: 'INV_IN', status: { in: ['ISSUED', 'PARTIAL', 'OVERDUE'] } },
            select: { balanceDue: true },
        }),
    ])

    const arChange = arInvoices.reduce((sum, inv) => sum + Number(inv.balanceDue), 0)
    const apChange = apInvoices.reduce((sum, inv) => sum + Number(inv.balanceDue), 0)

    operatingActivities.changesInWorkingCapital.push(
        { description: 'Increase in Accounts Receivable', amount: -arChange },
        { description: 'Increase in Accounts Payable', amount: apChange },
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
        })
        .filter(r => r.debit !== 0 || r.credit !== 0)

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

async function fetchARaging() {
    const openInvoices = await prisma.invoice.findMany({
        where: { type: 'INV_OUT', status: { in: ['ISSUED', 'PARTIAL', 'OVERDUE'] } },
        include: { customer: { select: { id: true, name: true, code: true } } },
        orderBy: { dueDate: 'asc' },
    })

    const today = new Date()
    const buckets = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 }
    const customerMap = new Map<string, {
        customerId: string; customerName: string; customerCode: string | null
        current: number; d1_30: number; d31_60: number; d61_90: number; d90_plus: number
        total: number; invoiceCount: number
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
        }
        existing.invoiceCount++
        existing.total += balance
        if (bucket === 'current') existing.current += balance
        else if (bucket === '1-30') existing.d1_30 += balance
        else if (bucket === '31-60') existing.d31_60 += balance
        else if (bucket === '61-90') existing.d61_90 += balance
        else existing.d90_plus += balance
        customerMap.set(custId, existing)

        details.push({ invoiceNumber: inv.number, customerName: custName, dueDate: due, balanceDue: balance, daysOverdue, bucket })
    }

    const totalOutstanding = buckets.current + buckets.d1_30 + buckets.d31_60 + buckets.d61_90 + buckets.d90_plus

    return {
        summary: { ...buckets, totalOutstanding, invoiceCount: openInvoices.length },
        byCustomer: Array.from(customerMap.values()).sort((a, b) => b.total - a.total),
        details: details.sort((a, b) => b.daysOverdue - a.daysOverdue),
    }
}

// ─── 6. AP Aging ───────────────────────────────────────────────────────────

async function fetchAPaging() {
    const openBills = await prisma.invoice.findMany({
        where: { type: 'INV_IN', status: { in: ['ISSUED', 'PARTIAL', 'OVERDUE'] } },
        include: { supplier: { select: { id: true, name: true, code: true } } },
        orderBy: { dueDate: 'asc' },
    })

    const today = new Date()
    const buckets = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 }
    const supplierMap = new Map<string, {
        supplierId: string; supplierName: string; supplierCode: string | null
        current: number; d1_30: number; d31_60: number; d61_90: number; d90_plus: number
        total: number; billCount: number
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
        }
        existing.billCount++
        existing.total += balance
        if (bucket === 'current') existing.current += balance
        else if (bucket === '1-30') existing.d1_30 += balance
        else if (bucket === '31-60') existing.d31_60 += balance
        else if (bucket === '61-90') existing.d61_90 += balance
        else existing.d90_plus += balance
        supplierMap.set(suppId, existing)

        details.push({ billNumber: bill.number, supplierName: suppName, dueDate: due, balanceDue: balance, daysOverdue, bucket })
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
            fetchBalanceSheet(end, start),           // 1
            fetchCashFlow(start, end),               // 2
            fetchTrialBalance(start, end),           // 3
            fetchARaging(),                          // 4
            fetchAPaging(),                          // 5
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
            grossMargin: pnl && pnl.revenue > 0
                ? ((pnl.grossProfit / pnl.revenue) * 100)
                : 0,
            totalAR: arAging?.summary?.totalOutstanding ?? 0,
            totalAP: apAging?.summary?.totalOutstanding ?? 0,
            invoiceRevenue: revenueInv?.totalRevenue ?? 0,
            cashPosition: cf?.endingCash ?? 0,
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
