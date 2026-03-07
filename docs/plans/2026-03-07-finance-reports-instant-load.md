# Laporan Keuangan Instant-Load Architecture

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the Laporan Keuangan page load instantly by consolidating 10+ server actions into a single API route, prefetching all reports on app startup.

**Architecture:** Replace per-report server action calls (each with its own Supabase auth roundtrip) with one consolidated API route `/api/finance/reports` that does a single auth check and fetches all 10 reports + KPI in parallel. The page reads everything from a single TanStack Query cache entry. WarmCache prefetches this on login. Date range within current fiscal year is served from cache; custom ranges outside it re-fetch.

**Tech Stack:** Next.js API route, Prisma singleton, TanStack Query, existing finance server action logic (inlined into API route)

---

### Task 1: Create consolidated API route

**Files:**
- Create: `app/api/finance/reports/route.ts`

**Step 1: Create the API route file**

This is the core change. The route does ONE auth check, then runs all report queries in parallel using `Promise.allSettled`. It reuses the same Prisma query logic from the existing server actions but without per-function auth overhead.

```ts
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

// Helper: parse date from query param or return default
function parseDate(val: string | null, fallback: Date): Date {
    if (!val) return fallback
    const d = new Date(val)
    return isNaN(d.getTime()) ? fallback : d
}

export async function GET(request: NextRequest) {
    try {
        // Single auth check for ALL reports
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
        }

        const url = request.nextUrl
        const year = new Date().getFullYear()
        const start = parseDate(url.searchParams.get("start"), new Date(year, 0, 1))
        const end = parseDate(url.searchParams.get("end"), new Date())
        const startISO = start.toISOString()
        const endISO = end.toISOString()

        // Run ALL reports in parallel
        const [
            pnlResult,
            bsResult,
            cfResult,
            tbResult,
            arResult,
            apResult,
            revenueResult,
            equityResult,
            inventoryResult,
            taxResult,
            budgetResult,
        ] = await Promise.allSettled([
            fetchPnL(start, end),
            fetchBalanceSheet(end),
            fetchCashFlow(start, end),
            fetchTrialBalance(start, end),
            fetchARaging(),
            fetchAPaging(),
            fetchRevenueFromInvoices(start, end),
            fetchEquityChanges(start, end),
            fetchInventoryTurnover(start, end),
            fetchTaxReport(start, end),
            fetchBudgetVsActual(start, end),
        ])

        const val = <T,>(r: PromiseSettledResult<T>, fallback: T): T =>
            r.status === "fulfilled" ? r.value : fallback

        const pnl = val(pnlResult, null)
        const ar = val(arResult, null)
        const ap = val(apResult, null)
        const invoiceRevenue = val(revenueResult, null)

        // KPI summary
        const kpi = {
            revenue: invoiceRevenue?.totalRevenue ?? (pnl as any)?.revenue ?? 0,
            netIncome: (pnl as any)?.netIncome ?? 0,
            arOutstanding: (ar as any)?.summary?.totalOutstanding ?? 0,
            apOutstanding: (ap as any)?.summary?.totalOutstanding ?? 0,
        }

        // All reports keyed by type
        const reports = {
            pnl: val(pnlResult, null),
            bs: val(bsResult, null),
            cf: val(cfResult, null),
            tb: val(tbResult, null),
            ar_aging: val(arResult, null),
            ap_aging: val(apResult, null),
            equity_changes: val(equityResult, null),
            inventory_turnover: val(inventoryResult, null),
            tax_report: val(taxResult, null),
            budget_vs_actual: val(budgetResult, null),
        }

        return NextResponse.json({
            success: true,
            kpi,
            reports,
            period: { start: startISO, end: endISO },
        })
    } catch (error) {
        console.error("Finance reports API error:", error)
        return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 })
    }
}

// ── Inlined report fetchers (no auth — already checked above) ──

async function fetchPnL(start: Date, end: Date) {
    const journalLines = await prisma.journalLine.findMany({
        where: {
            entry: { date: { gte: start, lte: end }, status: "POSTED" },
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
        const normalBalance = ["ASSET", "EXPENSE"].includes(account.type) ? "DEBIT" : "CREDIT"
        const effectiveAmount = normalBalance === "DEBIT" ? amount : -amount

        switch (account.type) {
            case "REVENUE":
                if (account.code >= "7000" && account.code < "9000") {
                    otherIncome += effectiveAmount
                } else {
                    revenue += effectiveAmount
                }
                break
            case "EXPENSE":
                if (account.code === "5000" || account.name.toLowerCase().includes("harga pokok")) {
                    costOfGoodsSold += effectiveAmount
                } else if (account.code >= "8000") {
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
        revenue, costOfGoodsSold, grossProfit, operatingExpenses,
        totalOperatingExpenses, operatingIncome, otherIncome, otherExpenses,
        netIncomeBeforeTax, taxExpense, netIncome,
        period: { startDate: start.toISOString(), endDate: end.toISOString() },
    }
}

async function fetchBalanceSheet(asOfDate: Date) {
    const accounts = await prisma.gLAccount.findMany({
        where: { type: { in: ["ASSET", "LIABILITY", "EQUITY"] } },
        include: {
            lines: {
                where: { entry: { date: { lte: asOfDate }, status: "POSTED" } },
                select: { debit: true, credit: true },
            },
        },
        orderBy: { code: "asc" },
    })

    const assets = {
        currentAssets: [] as { name: string; amount: number }[],
        fixedAssets: [] as { name: string; amount: number }[],
        otherAssets: [] as { name: string; amount: number }[],
        totalCurrentAssets: 0, totalFixedAssets: 0, totalOtherAssets: 0, totalAssets: 0,
    }
    const liabilities = {
        currentLiabilities: [] as { name: string; amount: number }[],
        longTermLiabilities: [] as { name: string; amount: number }[],
        totalCurrentLiabilities: 0, totalLongTermLiabilities: 0, totalLiabilities: 0,
    }
    const equity = {
        capital: [] as { name: string; amount: number }[],
        retainedEarnings: 0, totalEquity: 0,
    }

    // Retained earnings from PnL
    const currentYear = asOfDate.getFullYear()
    const pnl = await fetchPnL(new Date(currentYear, 0, 1), asOfDate)
    equity.retainedEarnings = pnl.netIncome

    for (const account of accounts) {
        const totalDebit = account.lines.reduce((sum, l) => sum + Number(l.debit), 0)
        const totalCredit = account.lines.reduce((sum, l) => sum + Number(l.credit), 0)
        const balance = account.type === "ASSET" ? totalDebit - totalCredit : totalCredit - totalDebit
        if (Math.abs(balance) < 0.01) continue

        switch (account.type) {
            case "ASSET":
                if (account.code >= "1000" && account.code < "1500") {
                    assets.currentAssets.push({ name: account.name, amount: balance })
                    assets.totalCurrentAssets += balance
                } else if (account.code >= "1500" && account.code < "2000") {
                    assets.fixedAssets.push({ name: account.name, amount: balance })
                    assets.totalFixedAssets += balance
                } else {
                    assets.otherAssets.push({ name: account.name, amount: balance })
                    assets.totalOtherAssets += balance
                }
                break
            case "LIABILITY":
                if (account.code >= "2000" && account.code < "2500") {
                    liabilities.currentLiabilities.push({ name: account.name, amount: balance })
                    liabilities.totalCurrentLiabilities += balance
                } else {
                    liabilities.longTermLiabilities.push({ name: account.name, amount: balance })
                    liabilities.totalLongTermLiabilities += balance
                }
                break
            case "EQUITY":
                if (account.code >= "3000" && account.code < "3500") {
                    equity.capital.push({ name: account.name, amount: balance })
                }
                break
        }
    }

    assets.totalAssets = assets.totalCurrentAssets + assets.totalFixedAssets + assets.totalOtherAssets
    liabilities.totalLiabilities = liabilities.totalCurrentLiabilities + liabilities.totalLongTermLiabilities
    equity.totalEquity = equity.capital.reduce((sum, c) => sum + c.amount, 0) + equity.retainedEarnings

    return {
        assets, liabilities, equity,
        totalLiabilitiesAndEquity: liabilities.totalLiabilities + equity.totalEquity,
        asOfDate: asOfDate.toISOString(),
    }
}

async function fetchCashFlow(start: Date, end: Date) {
    const pnl = await fetchPnL(start, end)

    // Get cash/bank account movements
    const cashLines = await prisma.journalLine.findMany({
        where: {
            account: { code: { startsWith: "1" }, type: "ASSET" },
            entry: { date: { gte: start, lte: end }, status: "POSTED" },
        },
        include: {
            account: { select: { code: true, name: true } },
            entry: { select: { description: true } },
        },
    })

    // Beginning cash: sum of cash accounts before start
    const cashAccountsBefore = await prisma.gLAccount.findMany({
        where: { type: "ASSET", code: { gte: "1000", lt: "1100" } },
        include: {
            lines: {
                where: { entry: { date: { lt: start }, status: "POSTED" } },
                select: { debit: true, credit: true },
            },
        },
    })
    const beginningCash = cashAccountsBefore.reduce((sum, acc) => {
        const d = acc.lines.reduce((s, l) => s + Number(l.debit), 0)
        const c = acc.lines.reduce((s, l) => s + Number(l.credit), 0)
        return sum + d - c
    }, 0)

    // Simplified cash flow: operating = netIncome, investing/financing = 0
    const netCashFromOperating = pnl.netIncome
    const netCashFromInvesting = 0
    const netCashFromFinancing = 0
    const netIncreaseInCash = netCashFromOperating + netCashFromInvesting + netCashFromFinancing

    return {
        operatingActivities: {
            netIncome: pnl.netIncome,
            adjustments: [],
            changesInWorkingCapital: [],
            netCashFromOperating,
        },
        investingActivities: { items: [], netCashFromInvesting },
        financingActivities: { items: [], netCashFromFinancing },
        netIncreaseInCash,
        beginningCash,
        endingCash: beginningCash + netIncreaseInCash,
        period: { startDate: start.toISOString(), endDate: end.toISOString() },
    }
}

async function fetchTrialBalance(start: Date, end: Date) {
    const accounts = await prisma.gLAccount.findMany({
        orderBy: { code: "asc" },
        include: {
            lines: {
                where: { entry: { date: { gte: start, lte: end }, status: "POSTED" } },
                select: { debit: true, credit: true },
            },
        },
    })

    let totalDebits = 0
    let totalCredits = 0
    const rows = accounts.map((acc) => {
        const debit = acc.lines.reduce((sum, l) => sum + Number(l.debit), 0)
        const credit = acc.lines.reduce((sum, l) => sum + Number(l.credit), 0)
        totalDebits += debit
        totalCredits += credit
        return { accountCode: acc.code, accountName: acc.name, accountType: acc.type, debit, credit, balance: debit - credit }
    }).filter((r) => r.debit !== 0 || r.credit !== 0)

    return {
        rows,
        totals: {
            totalDebits: Math.round(totalDebits * 100) / 100,
            totalCredits: Math.round(totalCredits * 100) / 100,
            difference: Math.round((totalDebits - totalCredits) * 100) / 100,
            isBalanced: Math.abs(totalDebits - totalCredits) < 0.01,
        },
        period: { start, end },
    }
}

async function fetchARaging() {
    const openInvoices = await prisma.invoice.findMany({
        where: { type: "INV_OUT", status: { in: ["ISSUED", "PARTIAL", "OVERDUE"] } },
        include: { customer: { select: { id: true, name: true, code: true } } },
        orderBy: { dueDate: "asc" },
    })

    const today = new Date()
    const buckets = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 }
    const customerMap = new Map<string, any>()
    const details: any[] = []

    for (const inv of openInvoices) {
        const due = new Date(inv.dueDate)
        const daysOverdue = Math.max(0, Math.floor((today.getTime() - due.getTime()) / 86400000))
        const balance = Number(inv.balanceDue)
        const custId = inv.customer?.id || "unknown"
        const custName = inv.customer?.name || "Tanpa Pelanggan"
        const custCode = inv.customer?.code ?? null

        let bucket = "current"
        if (daysOverdue <= 0) { buckets.current += balance; bucket = "current" }
        else if (daysOverdue <= 30) { buckets.d1_30 += balance; bucket = "1-30" }
        else if (daysOverdue <= 60) { buckets.d31_60 += balance; bucket = "31-60" }
        else if (daysOverdue <= 90) { buckets.d61_90 += balance; bucket = "61-90" }
        else { buckets.d90_plus += balance; bucket = "90+" }

        const existing = customerMap.get(custId) || {
            customerId: custId, customerName: custName, customerCode: custCode,
            current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0, total: 0, invoiceCount: 0,
        }
        existing.invoiceCount++
        existing.total += balance
        if (bucket === "current") existing.current += balance
        else if (bucket === "1-30") existing.d1_30 += balance
        else if (bucket === "31-60") existing.d31_60 += balance
        else if (bucket === "61-90") existing.d61_90 += balance
        else existing.d90_plus += balance
        customerMap.set(custId, existing)

        details.push({ invoiceNumber: inv.number, customerName: custName, dueDate: due, balanceDue: balance, daysOverdue, bucket })
    }

    const totalOutstanding = buckets.current + buckets.d1_30 + buckets.d31_60 + buckets.d61_90 + buckets.d90_plus
    return {
        summary: { ...buckets, totalOutstanding, invoiceCount: openInvoices.length },
        byCustomer: Array.from(customerMap.values()).sort((a: any, b: any) => b.total - a.total),
        details: details.sort((a, b) => b.daysOverdue - a.daysOverdue),
    }
}

async function fetchAPaging() {
    const openBills = await prisma.invoice.findMany({
        where: { type: "INV_IN", status: { in: ["ISSUED", "PARTIAL", "OVERDUE"] } },
        include: { supplier: { select: { id: true, name: true, code: true } } },
        orderBy: { dueDate: "asc" },
    })

    const today = new Date()
    const buckets = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 }
    const supplierMap = new Map<string, any>()
    const details: any[] = []

    for (const bill of openBills) {
        const due = new Date(bill.dueDate)
        const daysOverdue = Math.max(0, Math.floor((today.getTime() - due.getTime()) / 86400000))
        const balance = Number(bill.balanceDue)
        const suppId = bill.supplier?.id || "unknown"
        const suppName = bill.supplier?.name || "Tanpa Supplier"
        const suppCode = bill.supplier?.code ?? null

        let bucket = "current"
        if (daysOverdue <= 0) { buckets.current += balance; bucket = "current" }
        else if (daysOverdue <= 30) { buckets.d1_30 += balance; bucket = "1-30" }
        else if (daysOverdue <= 60) { buckets.d31_60 += balance; bucket = "31-60" }
        else if (daysOverdue <= 90) { buckets.d61_90 += balance; bucket = "61-90" }
        else { buckets.d90_plus += balance; bucket = "90+" }

        const existing = supplierMap.get(suppId) || {
            supplierId: suppId, supplierName: suppName, supplierCode: suppCode,
            current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0, total: 0, billCount: 0,
        }
        existing.billCount++
        existing.total += balance
        if (bucket === "current") existing.current += balance
        else if (bucket === "1-30") existing.d1_30 += balance
        else if (bucket === "31-60") existing.d31_60 += balance
        else if (bucket === "61-90") existing.d61_90 += balance
        else existing.d90_plus += balance
        supplierMap.set(suppId, existing)

        details.push({ billNumber: bill.number, supplierName: suppName, dueDate: due, balanceDue: balance, daysOverdue, bucket })
    }

    const totalOutstanding = buckets.current + buckets.d1_30 + buckets.d31_60 + buckets.d61_90 + buckets.d90_plus
    return {
        summary: { ...buckets, totalOutstanding, billCount: openBills.length },
        bySupplier: Array.from(supplierMap.values()).sort((a: any, b: any) => b.total - a.total),
        details: details.sort((a, b) => b.daysOverdue - a.daysOverdue),
    }
}

async function fetchRevenueFromInvoices(start: Date, end: Date) {
    const invoices = await prisma.invoice.findMany({
        where: { type: "INV_OUT", status: { notIn: ["CANCELLED", "VOID"] }, issueDate: { gte: start, lte: end } },
        select: { totalAmount: true, balanceDue: true },
    })
    const totalRevenue = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0)
    const totalPaid = invoices.reduce((sum, inv) => sum + (Number(inv.totalAmount || 0) - Number(inv.balanceDue || 0)), 0)
    const totalOutstanding = invoices.reduce((sum, inv) => sum + Number(inv.balanceDue || 0), 0)
    return { totalRevenue, totalPaid, totalOutstanding, invoiceCount: invoices.length }
}

async function fetchEquityChanges(start: Date, end: Date) {
    const equityAccounts = await prisma.gLAccount.findMany({
        where: { type: "EQUITY" },
        select: { id: true, code: true, name: true, balance: true },
        orderBy: { code: "asc" },
    })
    const lines = await prisma.journalLine.findMany({
        where: {
            account: { type: "EQUITY" },
            entry: { status: "POSTED", date: { gte: start, lte: end } },
        },
        include: {
            account: { select: { id: true, code: true, name: true } },
            entry: { select: { date: true, description: true } },
        },
    })
    const revenueLines = await prisma.journalLine.findMany({
        where: { account: { type: "REVENUE" }, entry: { status: "POSTED", date: { gte: start, lte: end } } },
        select: { debit: true, credit: true },
    })
    const expenseLines = await prisma.journalLine.findMany({
        where: { account: { type: "EXPENSE" }, entry: { status: "POSTED", date: { gte: start, lte: end } } },
        select: { debit: true, credit: true },
    })
    const totalRevenue = revenueLines.reduce((s, l) => s + Number(l.credit) - Number(l.debit), 0)
    const totalExpense = expenseLines.reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0)
    const netIncome = totalRevenue - totalExpense

    const accountChanges = equityAccounts.map((acc) => {
        const accLines = lines.filter((l) => l.account.id === acc.id)
        const additions = accLines.reduce((s, l) => s + Number(l.credit), 0)
        const deductions = accLines.reduce((s, l) => s + Number(l.debit), 0)
        const netChange = additions - deductions
        const closingBalance = Number(acc.balance)
        const openingBalance = closingBalance - netChange
        return { accountCode: acc.code, accountName: acc.name, openingBalance, additions, deductions, netChange, closingBalance }
    })

    return {
        period: { startDate: start.toISOString(), endDate: end.toISOString() },
        accounts: accountChanges,
        netIncome,
        totalOpeningEquity: accountChanges.reduce((s, a) => s + a.openingBalance, 0),
        totalClosingEquity: accountChanges.reduce((s, a) => s + a.closingBalance, 0),
        totalChange: accountChanges.reduce((s, a) => s + a.closingBalance, 0) - accountChanges.reduce((s, a) => s + a.openingBalance, 0),
    }
}

async function fetchInventoryTurnover(start: Date, end: Date) {
    const products = await prisma.product.findMany({
        where: { isActive: true },
        select: {
            id: true, name: true, sku: true,
            stockLevels: { select: { quantity: true } },
        },
    })
    const transactions = await prisma.inventoryTransaction.findMany({
        where: { createdAt: { gte: start, lte: end }, type: { in: ["SO_SHIPMENT", "PRODUCTION_IN"] } },
        select: { productId: true, quantity: true },
    })

    const txMap = new Map<string, number>()
    for (const tx of transactions) {
        txMap.set(tx.productId, (txMap.get(tx.productId) || 0) + tx.quantity)
    }

    const items = products.map((p) => {
        const currentStock = p.stockLevels.reduce((s, sl) => s + sl.quantity, 0)
        const unitsSold = txMap.get(p.id) || 0
        const avgInventory = currentStock > 0 ? currentStock : 1
        const turnoverRatio = unitsSold / avgInventory
        return { productId: p.id, productName: p.name, sku: p.sku, currentStock, unitsSold, turnoverRatio }
    }).filter((i) => i.unitsSold > 0 || i.currentStock > 0)
        .sort((a, b) => b.turnoverRatio - a.turnoverRatio)

    return {
        period: { startDate: start.toISOString(), endDate: end.toISOString() },
        items,
        averageTurnover: items.length > 0 ? items.reduce((s, i) => s + i.turnoverRatio, 0) / items.length : 0,
    }
}

async function fetchTaxReport(start: Date, end: Date) {
    const invoicesOut = await prisma.invoice.findMany({
        where: { type: "INV_OUT", status: { notIn: ["CANCELLED", "VOID"] }, issueDate: { gte: start, lte: end } },
        select: { number: true, totalAmount: true, taxAmount: true, issueDate: true, customer: { select: { name: true, npwp: true } } },
    })
    const invoicesIn = await prisma.invoice.findMany({
        where: { type: "INV_IN", status: { notIn: ["CANCELLED", "VOID"] }, issueDate: { gte: start, lte: end } },
        select: { number: true, totalAmount: true, taxAmount: true, issueDate: true, supplier: { select: { name: true, npwp: true } } },
    })

    const ppnKeluaran = invoicesOut.reduce((s, i) => s + Number(i.taxAmount || 0), 0)
    const ppnMasukan = invoicesIn.reduce((s, i) => s + Number(i.taxAmount || 0), 0)

    return {
        period: { startDate: start.toISOString(), endDate: end.toISOString() },
        ppnKeluaran, ppnMasukan,
        ppnKurangBayar: ppnKeluaran - ppnMasukan,
        salesTransactions: invoicesOut.map((i) => ({
            invoiceNumber: i.number, customerName: i.customer?.name, npwp: i.customer?.npwp,
            amount: Number(i.totalAmount), tax: Number(i.taxAmount || 0), date: i.issueDate,
        })),
        purchaseTransactions: invoicesIn.map((i) => ({
            invoiceNumber: i.number, supplierName: i.supplier?.name, npwp: i.supplier?.npwp,
            amount: Number(i.totalAmount), tax: Number(i.taxAmount || 0), date: i.issueDate,
        })),
    }
}

async function fetchBudgetVsActual(start: Date, end: Date) {
    const budgets = await prisma.budget.findMany({
        where: { isActive: true },
        orderBy: { year: "desc" },
        take: 1,
        include: {
            lines: {
                include: { account: { select: { id: true, code: true, name: true, type: true } } },
                orderBy: [{ account: { code: "asc" } }, { month: "asc" }],
            },
        },
    })

    if (budgets.length === 0) return { budgets: [], data: null }

    const budget = budgets[0]
    const actualLines = await prisma.journalLine.findMany({
        where: { entry: { status: "POSTED", date: { gte: start, lte: end } } },
        include: {
            account: { select: { id: true, code: true, name: true, type: true } },
        },
    })

    const accountMap = new Map<string, { accountCode: string; accountName: string; accountType: string; budgetAmount: number; actualAmount: number }>()
    for (const line of budget.lines) {
        const key = line.account.id
        const existing = accountMap.get(key) || { accountCode: line.account.code, accountName: line.account.name, accountType: line.account.type, budgetAmount: 0, actualAmount: 0 }
        existing.budgetAmount += Number(line.amount)
        accountMap.set(key, existing)
    }
    for (const line of actualLines) {
        const key = line.account.id
        const existing = accountMap.get(key) || { accountCode: line.account.code, accountName: line.account.name, accountType: line.account.type, budgetAmount: 0, actualAmount: 0 }
        const amount = ["ASSET", "EXPENSE"].includes(line.account.type) ? Number(line.debit) - Number(line.credit) : Number(line.credit) - Number(line.debit)
        existing.actualAmount += amount
        accountMap.set(key, existing)
    }

    const items = Array.from(accountMap.values())
        .map((i) => ({ ...i, variance: i.budgetAmount - i.actualAmount, variancePercent: i.budgetAmount > 0 ? ((i.budgetAmount - i.actualAmount) / i.budgetAmount) * 100 : 0 }))
        .sort((a, b) => a.accountCode.localeCompare(b.accountCode))

    return {
        budgets: budgets.map((b) => ({ id: b.id, name: b.name, year: b.year })),
        data: {
            budgetName: budget.name,
            period: { startDate: start.toISOString(), endDate: end.toISOString() },
            items,
            totalBudget: items.reduce((s, i) => s + i.budgetAmount, 0),
            totalActual: items.reduce((s, i) => s + i.actualAmount, 0),
        },
    }
}
```

**Step 2: Verify the route compiles**

Run: `npx tsc --noEmit 2>&1 | grep "api/finance/reports"`
Expected: No errors from this file

**Step 3: Commit**

```bash
git add app/api/finance/reports/route.ts
git commit -m "feat(finance): add consolidated /api/finance/reports endpoint"
```

---

### Task 2: Add `useFinanceReportsAll()` hook

**Files:**
- Modify: `hooks/use-finance-reports.ts`

**Step 1: Add the new hook**

Add `useFinanceReportsAll` at the top of the file, below existing imports. This hook fetches everything from the consolidated API and the page reads from its cache — tab switching is pure client-side with zero fetching.

```ts
// Add after existing imports, before useFinanceKPI:

export interface AllReportsData {
    kpi: { revenue: number; netIncome: number; arOutstanding: number; apOutstanding: number }
    reports: {
        pnl: any
        bs: any
        cf: any
        tb: any
        ar_aging: any
        ap_aging: any
        equity_changes: any
        inventory_turnover: any
        tax_report: any
        budget_vs_actual: any
    }
    period: { start: string; end: string }
}

export function useFinanceReportsAll(startDate: Date, endDate: Date) {
    const startISO = startDate.toISOString().slice(0, 10)
    const endISO = endDate.toISOString().slice(0, 10)

    return useQuery<AllReportsData>({
        queryKey: queryKeys.financeReports.list(startISO, endISO),
        queryFn: async () => {
            const res = await fetch(`/api/finance/reports?start=${startISO}&end=${endISO}`)
            const json = await res.json()
            if (!json.success) throw new Error(json.error || "Failed to load reports")
            return { kpi: json.kpi, reports: json.reports, period: json.period }
        },
        staleTime: 2 * 60 * 1000,
    })
}
```

**Step 2: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | grep "use-finance-reports"`
Expected: No errors

**Step 3: Commit**

```bash
git add hooks/use-finance-reports.ts
git commit -m "feat(finance): add useFinanceReportsAll hook for consolidated data"
```

---

### Task 3: Update page to use consolidated hook

**Files:**
- Modify: `app/finance/reports/page.tsx` (lines ~1-128)

**Step 1: Replace the two hook calls with one**

Change the imports and hook usage at the top of the component:

```ts
// Replace this import:
import { useFinanceKPI, useFinanceReport } from "@/hooks/use-finance-reports"

// With:
import { useFinanceReportsAll } from "@/hooks/use-finance-reports"
```

Then in the component body, replace:

```ts
// OLD (lines 111-127):
const { data: kpi, isLoading: kpiLoading } = useFinanceKPI(startDate, endDate)
const { data: reportResult, isLoading: reportLoading, isError, error } = useFinanceReport(reportType, startDate, endDate)
const pnlData = reportResult?.type === "pnl" ? reportResult.data : null
const balanceSheetData = reportResult?.type === "bs" ? reportResult.data : null
const cashFlowData = reportResult?.type === "cf" ? reportResult.data : null
const trialBalanceData = reportResult?.type === "tb" ? reportResult.data : null
const arAgingData = reportResult?.type === "ar_aging" ? reportResult.data : null
const apAgingData = reportResult?.type === "ap_aging" ? reportResult.data : null
const equityData = reportResult?.type === "equity_changes" ? reportResult.data : null
const inventoryTurnoverData = reportResult?.type === "inventory_turnover" ? reportResult.data : null
const taxData = reportResult?.type === "tax_report" ? reportResult.data : null
const budgetVsActualData = reportResult?.type === "budget_vs_actual" ? reportResult.data : null

// NEW:
const { data, isLoading, isError, error } = useFinanceReportsAll(startDate, endDate)
const kpi = data?.kpi
const kpiLoading = isLoading
const reportLoading = isLoading
const pnlData = data?.reports?.pnl ?? null
const balanceSheetData = data?.reports?.bs ?? null
const cashFlowData = data?.reports?.cf ?? null
const trialBalanceData = data?.reports?.tb ?? null
const arAgingData = data?.reports?.ar_aging ?? null
const apAgingData = data?.reports?.ap_aging ?? null
const equityData = data?.reports?.equity_changes ?? null
const inventoryTurnoverData = data?.reports?.inventory_turnover ?? null
const taxData = data?.reports?.tax_report ?? null
const budgetVsActualData = data?.reports?.budget_vs_actual?.data ?? null
```

Note: `budgetVsActualData` uses `.data` because the API returns `{ budgets, data }` structure.

**Step 2: Verify compilation and test in browser**

Run: `npx tsc --noEmit 2>&1 | grep "finance/reports"`
Expected: No errors

Manual test:
1. Go to `/finance/reports`
2. KPI strip + Laba Rugi should load together (single request)
3. Click Neraca, Arus Kas, etc. — should switch instantly with NO loading spinner

**Step 3: Commit**

```bash
git add app/finance/reports/page.tsx
git commit -m "feat(finance): switch reports page to consolidated API for instant tab switching"
```

---

### Task 4: Simplify prefetch in nav-prefetch

**Files:**
- Modify: `hooks/use-nav-prefetch.ts`

**Step 1: Replace the array-based prefetch with single API call**

Replace the `/finance/reports` entry (the IIFE returning array) with a simple single-entry fetch:

```ts
// Replace the entire "/finance/reports": (() => { ... })(), block with:
"/finance/reports": {
    queryKey: queryKeys.financeReports.list(
        new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10),
        new Date().toISOString().slice(0, 10)
    ),
    queryFn: () => fetch(`/api/finance/reports`).then((r) => r.json()).then((p) => ({
        kpi: p.kpi,
        reports: p.reports,
        period: p.period,
    })),
},
```

Also revert the type back to single config (remove array support since it's no longer needed):

```ts
// Revert type to:
export const routePrefetchMap: Record<string, { queryKey: readonly unknown[]; queryFn: () => Promise<unknown> }> = {
```

And revert `useNavPrefetch` and `WarmCache` array handling back to single config.

**Step 2: Remove unused imports from nav-prefetch**

Remove the finance server action imports that were added for the array-based prefetch:
```ts
// Remove this line:
import { getProfitLossStatement, getARAgingReport, getAPAgingReport, getRevenueFromInvoices } from "@/lib/actions/finance"
// Also remove unused PrefetchConfig type
```

**Step 3: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | grep "use-nav-prefetch\|warm-cache"`
Expected: No errors

**Step 4: Commit**

```bash
git add hooks/use-nav-prefetch.ts components/warm-cache.tsx
git commit -m "refactor(finance): simplify reports prefetch to single API call"
```

---

### Task 5: Verify everything works end-to-end

**Step 1: Run type check**

Run: `npx tsc --noEmit 2>&1 | grep -E "finance|reports" | head -20`
Expected: No new errors from our changed files

**Step 2: Run dev server and test**

Run: `npm run dev`

Manual verification:
1. Login → wait 2 seconds → navigate to Laporan Keuangan
2. Expected: KPI strip + Laba Rugi appear INSTANTLY (no "Mengambil data dari database...")
3. Click through ALL 10 report tabs — each should appear instantly, no loading spinner
4. Open Periode dialog → change date range → reports reload (one fetch, then instant again)
5. Check Network tab: should see single `/api/finance/reports` call, not 5+ server actions

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat(finance): laporan keuangan instant-load - consolidated API + prefetch"
```
