'use server'

import { prisma, withPrismaAuth } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"
import type { CashflowDirection, CashflowCategory, ProcurementStatus } from "@prisma/client"
import { SYS_ACCOUNTS } from "@/lib/gl-accounts"

// ================================
// Types
// ================================

export interface CashflowItem {
    id: string
    date: string // YYYY-MM-DD
    description: string
    amount: number
    direction: "IN" | "OUT"
    category: string
    glAccountCode?: string
    glAccountName?: string
    sourceId?: string
    isRecurring: boolean
    isManual: boolean
}

export interface CashflowPlanData {
    month: number
    year: number
    startingBalance: number
    startingBalanceOverride: number | null
    effectiveStartingBalance: number
    autoItems: CashflowItem[]
    manualItems: CashflowItem[]
    actualItems: CashflowItem[]
    snapshot: {
        id: string
        totalPlannedIn: number
        totalPlannedOut: number
        plannedEndBalance: number
        snapshotDate: string
    } | null
    summary: {
        totalIn: number
        totalOut: number
        netFlow: number
        estimatedEndBalance: number
    }
    lastMonthSummary: {
        totalIn: number
        totalOut: number
        netFlow: number
        itemCount: number
    } | null
}

// ================================
// Auth helper
// ================================

async function requireAuth() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new Error("Unauthorized")
    return user
}

// ================================
// Helpers
// ================================

function toNum(val: unknown): number {
    if (val == null) return 0
    if (typeof val === 'number') return val
    if (typeof (val as any).toNumber === 'function') return (val as any).toNumber()
    return Number(val) || 0
}

function toDateStr(d: Date): string {
    return d.toISOString().split("T")[0]
}

async function getMonthName(month: number): Promise<string> {
    const names = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ]
    return names[month - 1] || ""
}

// ================================
// Starting balance — sum of bank/cash GL accounts (code starts with "10")
// ================================

async function getStartingBalance(): Promise<number> {
    const accounts = await prisma.gLAccount.findMany({
        where: { code: { startsWith: "10" } },
        select: { balance: true },
    })
    return accounts.reduce((sum, a) => sum + toNum(a.balance), 0)
}

// ================================
// Auto-pull source #1: AR Invoices
// ================================

async function getARItems(monthStart: Date, monthEnd: Date): Promise<CashflowItem[]> {
    const invoices = await prisma.invoice.findMany({
        where: {
            type: "INV_OUT",
            balanceDue: { gt: 0 },
            dueDate: { gte: monthStart, lte: monthEnd },
            status: { notIn: ["CANCELLED", "VOID"] },
        },
        include: { customer: { select: { name: true } } },
    })

    return invoices.map((inv) => ({
        id: `ar-${inv.id}`,
        date: toDateStr(inv.dueDate),
        description: `Piutang ${inv.number} — ${inv.customer?.name || "Pelanggan"}`,
        amount: toNum(inv.balanceDue),
        direction: "IN" as const,
        category: "AR_INVOICE",
        glAccountCode: SYS_ACCOUNTS.AR,
        sourceId: inv.id,
        isRecurring: false,
        isManual: false,
    }))
}

// ================================
// Auto-pull source #2: AP Bills
// ================================

async function getAPItems(monthStart: Date, monthEnd: Date): Promise<CashflowItem[]> {
    const invoices = await prisma.invoice.findMany({
        where: {
            type: "INV_IN",
            balanceDue: { gt: 0 },
            dueDate: { gte: monthStart, lte: monthEnd },
            status: { notIn: ["CANCELLED", "VOID"] },
        },
        include: { supplier: { select: { name: true } } },
    })

    return invoices.map((inv) => ({
        id: `ap-${inv.id}`,
        date: toDateStr(inv.dueDate),
        description: `Hutang ${inv.number} — ${inv.supplier?.name || "Pemasok"}`,
        amount: toNum(inv.balanceDue),
        direction: "OUT" as const,
        category: "AP_BILL",
        glAccountCode: SYS_ACCOUNTS.AP,
        sourceId: inv.id,
        isRecurring: false,
        isManual: false,
    }))
}

// ================================
// Auto-pull source #3: PO Direct (approved/ordered but not yet billed)
// ================================

async function getPOItems(monthStart: Date, monthEnd: Date, allStatuses: boolean = false): Promise<CashflowItem[]> {
    const statusFilter: ProcurementStatus[] = allStatuses
        ? ["PO_DRAFT", "PENDING_APPROVAL", "APPROVED", "ORDERED", "VENDOR_CONFIRMED", "SHIPPED", "PARTIAL_RECEIVED", "RECEIVED"]
        : ["APPROVED", "ORDERED", "VENDOR_CONFIRMED", "SHIPPED", "PARTIAL_RECEIVED"]
    const pos = await prisma.purchaseOrder.findMany({
        where: {
            status: { in: statusFilter },
            paymentStatus: { not: "PAID" },
            invoices: { none: {} }, // No invoice yet = not yet billed
            OR: [
                { expectedDate: { gte: monthStart, lte: monthEnd } },
                { expectedDate: null, orderDate: { gte: monthStart, lte: monthEnd } },
            ],
        },
        include: { supplier: { select: { name: true } } },
    })

    return pos.map((po) => ({
        id: `po-${po.id}`,
        date: toDateStr(po.expectedDate || po.orderDate),
        description: `PO ${po.number} — ${po.supplier?.name || "Pemasok"}`,
        amount: toNum(po.totalAmount),
        direction: "OUT" as const,
        category: "PO_DIRECT",
        glAccountCode: SYS_ACCOUNTS.AP,
        sourceId: po.id,
        isRecurring: false,
        isManual: false,
    }))
}

// ================================
// Auto-pull source #4 (was #3): Payroll
// ================================

async function getPayrollItems(month: number, year: number): Promise<CashflowItem[]> {
    const employees = await prisma.employee.findMany({
        where: { status: "ACTIVE", baseSalary: { gt: 0 } },
        select: { baseSalary: true },
    })

    if (employees.length === 0) return []

    const totalSalary = employees.reduce((sum, e) => sum + toNum(e.baseSalary), 0)
    const payDate = new Date(year, month - 1, 25)

    return [{
        id: `payroll-${year}-${month}`,
        date: toDateStr(payDate),
        description: `Gaji ${employees.length} karyawan — ${await getMonthName(month)} ${year}`,
        amount: totalSalary,
        direction: "OUT" as const,
        category: "PAYROLL",
        glAccountCode: "6200",
        isRecurring: false,
        isManual: false,
    }]
}

// ================================
// Auto-pull source #4: BPJS
// ================================

async function getBPJSItems(month: number, year: number): Promise<CashflowItem[]> {
    const employees = await prisma.employee.findMany({
        where: { status: "ACTIVE", baseSalary: { gt: 0 } },
        select: { baseSalary: true },
    })

    if (employees.length === 0) return []

    const totalSalary = employees.reduce((sum, e) => sum + toNum(e.baseSalary), 0)
    const bpjsDate = new Date(year, month - 1, 15)
    const dateStr = toDateStr(bpjsDate)

    const items: CashflowItem[] = []

    // BPJS Kesehatan: 4% of total salary
    const kesehatanAmount = totalSalary * 0.04
    if (kesehatanAmount > 0) {
        items.push({
            id: `bpjs-kes-${year}-${month}`,
            date: dateStr,
            description: `BPJS Kesehatan — ${await getMonthName(month)} ${year}`,
            amount: kesehatanAmount,
            direction: "OUT" as const,
            category: "BPJS",
            isRecurring: false,
            isManual: false,
        })
    }

    // BPJS Ketenagakerjaan: 5.74% of total salary
    const ketenagakerjaanAmount = totalSalary * 0.0574
    if (ketenagakerjaanAmount > 0) {
        items.push({
            id: `bpjs-tk-${year}-${month}`,
            date: dateStr,
            description: `BPJS Ketenagakerjaan — ${await getMonthName(month)} ${year}`,
            amount: ketenagakerjaanAmount,
            direction: "OUT" as const,
            category: "BPJS",
            isRecurring: false,
            isManual: false,
        })
    }

    return items
}

// ================================
// Auto-pull source #5: Petty Cash
// ================================

async function getPettyCashItems(monthStart: Date, monthEnd: Date): Promise<CashflowItem[]> {
    const transactions = await prisma.pettyCashTransaction.findMany({
        where: {
            date: { gte: monthStart, lte: monthEnd },
        },
        include: {
            bankAccount: { select: { code: true, name: true } },
            expenseAccount: { select: { code: true, name: true } },
        },
    })

    return transactions.map((tx) => {
        const isIn = tx.type === "TOPUP"
        const account = isIn ? tx.bankAccount : tx.expenseAccount
        return {
            id: `pc-${tx.id}`,
            date: toDateStr(tx.date),
            description: `Kas Kecil: ${tx.description}`,
            amount: toNum(tx.amount),
            direction: (isIn ? "IN" : "OUT") as "IN" | "OUT",
            category: "PETTY_CASH",
            glAccountCode: account?.code,
            glAccountName: account?.name,
            sourceId: tx.id,
            isRecurring: false,
            isManual: false,
        }
    })
}

// ================================
// Auto-pull source #6: Recurring Journal Entries
// ================================

async function getRecurringJournalItems(monthStart: Date, monthEnd: Date): Promise<CashflowItem[]> {
    const entries = await prisma.journalEntry.findMany({
        where: {
            isRecurring: true,
            status: "POSTED",
            nextRecurringDate: { gte: monthStart, lte: monthEnd },
        },
        include: {
            lines: {
                include: { account: { select: { code: true, name: true } } },
            },
        },
    })

    return entries.map((entry) => {
        const totalDebit = entry.lines.reduce((sum, l) => sum + toNum(l.debit), 0)
        const totalCredit = entry.lines.reduce((sum, l) => sum + toNum(l.credit), 0)
        // If debit > credit, money is going out (expense); otherwise in (income)
        const direction: "IN" | "OUT" = totalDebit > totalCredit ? "OUT" : "IN"
        const amount = Math.abs(totalDebit - totalCredit)
        const firstLine = entry.lines[0]

        return {
            id: `rj-${entry.id}`,
            date: toDateStr(entry.nextRecurringDate || entry.date),
            description: `Jurnal Berulang: ${entry.description}`,
            amount,
            direction,
            category: "RECURRING_JOURNAL",
            glAccountCode: firstLine?.account?.code,
            glAccountName: firstLine?.account?.name,
            sourceId: entry.id,
            isRecurring: true,
            isManual: false,
        }
    })
}

// ================================
// Auto-pull source #7: Capital Injections (Modal Masuk)
// ================================

async function getCapitalItems(monthStart: Date, monthEnd: Date): Promise<CashflowItem[]> {
    const lines = await prisma.journalLine.findMany({
        where: {
            credit: { gt: 0 },
            account: { type: "EQUITY" },
            entry: {
                status: "POSTED",
                date: { gte: monthStart, lte: monthEnd },
            },
        },
        include: {
            account: { select: { code: true, name: true } },
            entry: { select: { id: true, description: true, date: true } },
        },
    })

    return lines.map((line) => ({
        id: `capital-${line.id}`,
        date: toDateStr(line.entry.date),
        description: `Modal Masuk: ${line.entry.description} (${line.account.name})`,
        amount: toNum(line.credit),
        direction: "IN" as const,
        category: "FUNDING_CAPITAL",
        glAccountCode: line.account.code,
        glAccountName: line.account.name,
        sourceId: line.entry.id,
        isRecurring: false,
        isManual: false,
    }))
}

// ================================
// Auto-pull source #8: Equity Withdrawals (Penarikan Ekuitas)
// ================================

async function getEquityWithdrawalItems(monthStart: Date, monthEnd: Date): Promise<CashflowItem[]> {
    const lines = await prisma.journalLine.findMany({
        where: {
            debit: { gt: 0 },
            account: { type: "EQUITY" },
            entry: {
                status: "POSTED",
                date: { gte: monthStart, lte: monthEnd },
            },
        },
        include: {
            account: { select: { code: true, name: true } },
            entry: { select: { id: true, description: true, date: true } },
        },
    })

    return lines.map((line) => ({
        id: `equity-wd-${line.id}`,
        date: toDateStr(line.entry.date),
        description: `Penarikan Ekuitas: ${line.entry.description} (${line.account.name})`,
        amount: toNum(line.debit),
        direction: "OUT" as const,
        category: "EQUITY_WITHDRAWAL",
        glAccountCode: line.account.code,
        glAccountName: line.account.name,
        sourceId: line.entry.id,
        isRecurring: false,
        isManual: false,
    }))
}

// ================================
// Auto-pull source #9: Loan Disbursements (Pencairan Pinjaman)
// ================================

async function getLoanDisbursementItems(monthStart: Date, monthEnd: Date): Promise<CashflowItem[]> {
    const lines = await prisma.journalLine.findMany({
        where: {
            credit: { gt: 0 },
            account: {
                type: "LIABILITY",
                code: { startsWith: "23" },
            },
            entry: {
                status: "POSTED",
                date: { gte: monthStart, lte: monthEnd },
            },
        },
        include: {
            account: { select: { code: true, name: true } },
            entry: { select: { id: true, description: true, date: true } },
        },
    })

    return lines.map((line) => ({
        id: `loan-in-${line.id}`,
        date: toDateStr(line.entry.date),
        description: `Pencairan Pinjaman: ${line.entry.description} (${line.account.name})`,
        amount: toNum(line.credit),
        direction: "IN" as const,
        category: "LOAN_DISBURSEMENT",
        glAccountCode: line.account.code,
        glAccountName: line.account.name,
        sourceId: line.entry.id,
        isRecurring: false,
        isManual: false,
    }))
}

// ================================
// Auto-pull source #10: Loan Repayments (Cicilan Pinjaman)
// ================================

async function getLoanRepaymentItems(monthStart: Date, monthEnd: Date): Promise<CashflowItem[]> {
    const lines = await prisma.journalLine.findMany({
        where: {
            debit: { gt: 0 },
            account: {
                type: "LIABILITY",
                code: { startsWith: "23" },
            },
            entry: {
                status: "POSTED",
                date: { gte: monthStart, lte: monthEnd },
            },
        },
        include: {
            account: { select: { code: true, name: true } },
            entry: { select: { id: true, description: true, date: true } },
        },
    })

    return lines.map((line) => ({
        id: `loan-out-${line.id}`,
        date: toDateStr(line.entry.date),
        description: `Cicilan Pinjaman: ${line.entry.description} (${line.account.name})`,
        amount: toNum(line.debit),
        direction: "OUT" as const,
        category: "LOAN_REPAYMENT",
        glAccountCode: line.account.code,
        glAccountName: line.account.name,
        sourceId: line.entry.id,
        isRecurring: false,
        isManual: false,
    }))
}

// ================================
// Auto-pull source #12: Work Order Production Costs
// ================================

async function getWOCostItems(monthStart: Date, monthEnd: Date): Promise<CashflowItem[]> {
    const workOrders = await prisma.workOrder.findMany({
        where: {
            status: { in: ["PLANNED", "IN_PROGRESS"] },
            estimatedCostTotal: { gt: 0 },
            OR: [
                { scheduledStart: { gte: monthStart, lte: monthEnd } },
                { startDate: { gte: monthStart, lte: monthEnd } },
            ],
        },
        include: { product: { select: { name: true } } },
    })

    return workOrders.map((wo) => ({
        id: `wo-${wo.id}`,
        date: toDateStr(wo.scheduledStart || wo.startDate || monthStart),
        description: `Produksi ${wo.number} — ${wo.product?.name || "Produk"}`,
        amount: toNum(wo.estimatedCostTotal),
        direction: "OUT" as const,
        category: "WO_COST",
        sourceId: wo.id,
        isRecurring: false,
        isManual: false,
    }))
}

// ================================
// Auto-pull source #11: Budget Allocations
// ================================

async function getBudgetItems(month: number, year: number): Promise<CashflowItem[]> {
    const budget = await prisma.budget.findUnique({
        where: { year },
        include: {
            lines: {
                where: { month },
                include: { account: { select: { code: true, name: true, type: true } } },
            },
        },
    })

    if (!budget) return []

    return budget.lines.map((line) => {
        const direction: "IN" | "OUT" = line.account.type === "REVENUE" ? "IN" : "OUT"
        return {
            id: `budget-${line.id}`,
            date: toDateStr(new Date(year, month - 1, 1)),
            description: `Anggaran: ${line.account.name} (${line.account.code})`,
            amount: toNum(line.amount),
            direction,
            category: "BUDGET_ALLOCATION",
            glAccountCode: line.account.code,
            glAccountName: line.account.name,
            isRecurring: false,
            isManual: false,
        }
    })
}

// ================================
// Actual transactions (posted journal entries in period)
// ================================

async function getActualTransactions(monthStart: Date, monthEnd: Date): Promise<CashflowItem[]> {
    const entries = await prisma.journalEntry.findMany({
        where: {
            status: "POSTED",
            isRecurring: false,
            date: { gte: monthStart, lte: monthEnd },
        },
        include: {
            lines: {
                include: { account: { select: { code: true, name: true } } },
            },
            invoice: { select: { number: true } },
            payment: { select: { number: true, method: true } },
        },
    })

    return entries.map((entry) => {
        const totalDebit = entry.lines.reduce((sum, l) => sum + toNum(l.debit), 0)
        const totalCredit = entry.lines.reduce((sum, l) => sum + toNum(l.credit), 0)
        const direction: "IN" | "OUT" = totalCredit > totalDebit ? "IN" : "OUT"
        const amount = Math.abs(totalDebit - totalCredit)
        const firstLine = entry.lines[0]

        let desc = entry.description
        if (entry.invoice) desc += ` (${entry.invoice.number})`
        if (entry.payment) desc += ` [${entry.payment.number}]`

        return {
            id: `actual-${entry.id}`,
            date: toDateStr(entry.date),
            description: desc,
            amount,
            direction,
            category: "ACTUAL",
            glAccountCode: firstLine?.account?.code,
            glAccountName: firstLine?.account?.name,
            sourceId: entry.id,
            isRecurring: false,
            isManual: false,
        }
    })
}

// ================================
// Auto-pull source: Sales Orders (for allStatuses mode)
// ================================

async function getSOItems(monthStart: Date, monthEnd: Date): Promise<CashflowItem[]> {
    const orders = await prisma.salesOrder.findMany({
        where: {
            status: { notIn: ["CANCELLED"] },
            OR: [
                { requestedDate: { gte: monthStart, lte: monthEnd } },
                { requestedDate: null, orderDate: { gte: monthStart, lte: monthEnd } },
            ],
        },
        include: { customer: { select: { name: true } } },
    })

    return orders.map((so) => ({
        id: `so-${so.id}`,
        date: toDateStr(so.requestedDate || so.orderDate),
        description: `SO ${so.number} — ${so.customer?.name || "Pelanggan"}`,
        amount: toNum(so.total),
        direction: "IN" as const,
        category: "SO_ORDER",
        glAccountCode: SYS_ACCOUNTS.AR,
        sourceId: so.id,
        isRecurring: false,
        isManual: false,
    }))
}

// ================================
// Exported: Main data fetcher
// ================================

export async function getCashflowPlanData(month: number, year: number, allStatuses: boolean = false): Promise<CashflowPlanData> {
    await requireAuth()

    const monthStart = new Date(year, month - 1, 1)
    const monthEnd = new Date(year, month, 0) // last day of month

    // Calculate last month boundaries for historical reference
    const lastMonth = month === 1 ? 12 : month - 1
    const lastYear = month === 1 ? year - 1 : year
    const lastMonthStart = new Date(lastYear, lastMonth - 1, 1)
    const lastMonthEnd = new Date(lastYear, lastMonth, 0)

    // Safe wrapper: if an auto-pull source fails, return empty array instead of crashing all
    const safe = <T,>(p: Promise<T>, fallback: T): Promise<T> =>
        p.catch(() => fallback)

    const [
        arItems,
        apItems,
        poItems,
        payrollItems,
        bpjsItems,
        pettyCashItems,
        recurringItems,
        budgetItems,
        capitalItems,
        equityWithdrawalItems,
        loanDisbursementItems,
        loanRepaymentItems,
        woCostItems,
        soItems,
        manualDbItems,
        startingBalance,
        snapshot,
        actualItems,
        lastMonthActuals,
    ] = await Promise.all([
        safe(getARItems(monthStart, monthEnd), []),
        safe(getAPItems(monthStart, monthEnd), []),
        safe(getPOItems(monthStart, monthEnd, allStatuses), []),
        safe(getPayrollItems(month, year), []),
        safe(getBPJSItems(month, year), []),
        safe(getPettyCashItems(monthStart, monthEnd), []),
        safe(getRecurringJournalItems(monthStart, monthEnd), []),
        safe(getBudgetItems(month, year), []),
        safe(getCapitalItems(monthStart, monthEnd), []),
        safe(getEquityWithdrawalItems(monthStart, monthEnd), []),
        safe(getLoanDisbursementItems(monthStart, monthEnd), []),
        safe(getLoanRepaymentItems(monthStart, monthEnd), []),
        safe(getWOCostItems(monthStart, monthEnd), []),
        allStatuses ? safe(getSOItems(monthStart, monthEnd), []) : Promise.resolve([] as CashflowItem[]),
        prisma.cashflowPlanItem.findMany({
            where: {
                date: { gte: monthStart, lte: monthEnd },
            },
            include: {
                glAccount: { select: { code: true, name: true } },
            },
            orderBy: { date: "asc" },
        }),
        safe(getStartingBalance(), 0),
        prisma.cashflowSnapshot.findUnique({
            where: { month_year: { month, year } },
        }),
        safe(getActualTransactions(monthStart, monthEnd), []),
        safe(getActualTransactions(lastMonthStart, lastMonthEnd), []),
    ])

    // Map manual DB items to CashflowItem
    const manualItems: CashflowItem[] = manualDbItems.map((item) => ({
        id: item.id,
        date: toDateStr(item.date),
        description: item.description,
        amount: toNum(item.amount),
        direction: item.direction as "IN" | "OUT",
        category: item.category,
        glAccountCode: item.glAccount?.code,
        glAccountName: item.glAccount?.name,
        isRecurring: item.isRecurring,
        isManual: true,
    }))

    // Combine all auto items
    const autoItems: CashflowItem[] = [
        ...arItems,
        ...apItems,
        ...poItems,
        ...soItems,
        ...payrollItems,
        ...bpjsItems,
        ...pettyCashItems,
        ...recurringItems,
        ...budgetItems,
        ...capitalItems,
        ...equityWithdrawalItems,
        ...loanDisbursementItems,
        ...loanRepaymentItems,
        ...woCostItems,
    ]

    // Effective starting balance (override takes precedence)
    const startingBalanceOverride = snapshot?.startingBalanceOverride
        ? toNum(snapshot.startingBalanceOverride)
        : null
    const effectiveStartingBalance = startingBalanceOverride ?? startingBalance

    // Summary
    const allPlannedItems = [...autoItems, ...manualItems]
    const totalIn = allPlannedItems
        .filter((i) => i.direction === "IN")
        .reduce((sum, i) => sum + i.amount, 0)
    const totalOut = allPlannedItems
        .filter((i) => i.direction === "OUT")
        .reduce((sum, i) => sum + i.amount, 0)
    const netFlow = totalIn - totalOut
    const estimatedEndBalance = effectiveStartingBalance + netFlow

    // Last month summary for historical reference
    const lastMonthSummary = lastMonthActuals.length > 0 ? {
        totalIn: lastMonthActuals.filter(i => i.direction === "IN").reduce((s, i) => s + i.amount, 0),
        totalOut: lastMonthActuals.filter(i => i.direction === "OUT").reduce((s, i) => s + i.amount, 0),
        netFlow: 0,
        itemCount: lastMonthActuals.length,
    } : null

    if (lastMonthSummary) {
        lastMonthSummary.netFlow = lastMonthSummary.totalIn - lastMonthSummary.totalOut
    }

    return {
        month,
        year,
        startingBalance,
        startingBalanceOverride,
        effectiveStartingBalance,
        autoItems,
        manualItems,
        actualItems,
        snapshot: snapshot
            ? {
                id: snapshot.id,
                totalPlannedIn: toNum(snapshot.totalPlannedIn),
                totalPlannedOut: toNum(snapshot.totalPlannedOut),
                plannedEndBalance: toNum(snapshot.plannedEndBalance),
                snapshotDate: toDateStr(snapshot.snapshotDate),
            }
            : null,
        summary: { totalIn, totalOut, netFlow, estimatedEndBalance },
        lastMonthSummary,
    }
}

// ================================
// Exported: CRUD for manual items
// ================================

export async function createCashflowPlanItem(data: {
    date: string
    description: string
    amount: number
    direction: "IN" | "OUT"
    glAccountId?: string
    isRecurring?: boolean
    recurringPattern?: string
    recurringEndDate?: string
    notes?: string
}): Promise<{ id: string }> {
    return withPrismaAuth(async (tx) => {
        // Auto-determine category
        let category: CashflowCategory = "MANUAL"
        if (data.isRecurring) {
            category = data.direction === "IN" ? "RECURRING_INCOME" : "RECURRING_EXPENSE"
        }

        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        const item = await tx.cashflowPlanItem.create({
            data: {
                date: new Date(data.date),
                description: data.description,
                amount: data.amount,
                direction: data.direction as CashflowDirection,
                category,
                glAccountId: data.glAccountId || null,
                isRecurring: data.isRecurring || false,
                recurringPattern: data.recurringPattern || null,
                recurringEndDate: data.recurringEndDate ? new Date(data.recurringEndDate) : null,
                notes: data.notes || null,
                createdBy: user?.id || null,
            },
        })

        return { id: item.id }
    })
}

export async function updateCashflowPlanItem(
    id: string,
    data: {
        date?: string
        description?: string
        amount?: number
        direction?: "IN" | "OUT"
        glAccountId?: string | null
        isRecurring?: boolean
        recurringPattern?: string | null
        recurringEndDate?: string | null
        notes?: string | null
    }
): Promise<{ id: string }> {
    return withPrismaAuth(async (tx) => {
        const updateData: Record<string, unknown> = {}

        if (data.date !== undefined) updateData.date = new Date(data.date)
        if (data.description !== undefined) updateData.description = data.description
        if (data.amount !== undefined) updateData.amount = data.amount
        if (data.direction !== undefined) updateData.direction = data.direction as CashflowDirection
        if (data.glAccountId !== undefined) updateData.glAccountId = data.glAccountId
        if (data.isRecurring !== undefined) updateData.isRecurring = data.isRecurring
        if (data.recurringPattern !== undefined) updateData.recurringPattern = data.recurringPattern
        if (data.recurringEndDate !== undefined) {
            updateData.recurringEndDate = data.recurringEndDate ? new Date(data.recurringEndDate) : null
        }
        if (data.notes !== undefined) updateData.notes = data.notes

        // Re-determine category if direction or isRecurring changed
        if (data.direction !== undefined || data.isRecurring !== undefined) {
            const existing = await tx.cashflowPlanItem.findUniqueOrThrow({ where: { id } })
            const dir = data.direction || existing.direction
            const recurring = data.isRecurring ?? existing.isRecurring
            if (recurring) {
                updateData.category = (dir === "IN" ? "RECURRING_INCOME" : "RECURRING_EXPENSE") as CashflowCategory
            } else {
                updateData.category = "MANUAL" as CashflowCategory
            }
        }

        const item = await tx.cashflowPlanItem.update({
            where: { id },
            data: updateData,
        })

        return { id: item.id }
    })
}

export async function deleteCashflowPlanItem(id: string): Promise<{ success: boolean }> {
    return withPrismaAuth(async (tx) => {
        await tx.cashflowPlanItem.delete({ where: { id } })
        return { success: true }
    })
}

// ================================
// Exported: Snapshot management
// ================================

export async function saveCashflowSnapshot(month: number, year: number): Promise<{ id: string }> {
    return withPrismaAuth(async (tx) => {
        // We need to call getCashflowPlanData but it uses requireAuth + prisma singleton.
        // Instead, replicate the essential logic inline using the tx client.
        // Get all planned items (auto + manual) by calling the read function
        // Since we're already authenticated via withPrismaAuth, call the main function
        const planData = await getCashflowPlanData(month, year)

        const allItems = [...planData.autoItems, ...planData.manualItems]

        const item = await tx.cashflowSnapshot.upsert({
            where: { month_year: { month, year } },
            create: {
                month,
                year,
                startingBalance: planData.effectiveStartingBalance,
                startingBalanceOverride: planData.startingBalanceOverride,
                items: allItems as any,
                totalPlannedIn: planData.summary.totalIn,
                totalPlannedOut: planData.summary.totalOut,
                plannedEndBalance: planData.summary.estimatedEndBalance,
            },
            update: {
                startingBalance: planData.effectiveStartingBalance,
                startingBalanceOverride: planData.startingBalanceOverride,
                items: allItems as any,
                totalPlannedIn: planData.summary.totalIn,
                totalPlannedOut: planData.summary.totalOut,
                plannedEndBalance: planData.summary.estimatedEndBalance,
                snapshotDate: new Date(),
            },
        })

        return { id: item.id }
    })
}

export async function overrideStartingBalance(
    month: number,
    year: number,
    amount: number | null
): Promise<{ id: string }> {
    return withPrismaAuth(async (tx) => {
        const item = await tx.cashflowSnapshot.upsert({
            where: { month_year: { month, year } },
            create: {
                month,
                year,
                startingBalance: 0,
                startingBalanceOverride: amount,
                items: [],
                totalPlannedIn: 0,
                totalPlannedOut: 0,
                plannedEndBalance: amount ?? 0,
            },
            update: {
                startingBalanceOverride: amount,
            },
        })

        return { id: item.id }
    })
}

// ================================
// Exported: Multi-month forecast (6 months forward)
// ================================

export interface CashflowForecastMonth {
    month: number
    year: number
    label: string
    totalIn: number
    totalOut: number
    netFlow: number
    runningBalance: number
    breakdown: {
        category: string
        direction: "IN" | "OUT"
        amount: number
        itemCount: number
    }[]
}

export interface CashflowForecastData {
    startingBalance: number
    months: CashflowForecastMonth[]
    totals: {
        totalIn: number
        totalOut: number
        netFlow: number
        endingBalance: number
    }
}

export async function getCashflowForecast(monthsAhead: number = 6): Promise<CashflowForecastData> {
    await requireAuth()

    const startingBalance = await getStartingBalance()
    const now = new Date()
    const months: CashflowForecastMonth[] = []
    let runningBalance = startingBalance

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]

    for (let i = 0; i < monthsAhead; i++) {
        const targetDate = new Date(now.getFullYear(), now.getMonth() + i, 1)
        const month = targetDate.getMonth() + 1
        const year = targetDate.getFullYear()

        const data = await getCashflowPlanData(month, year)
        const allItems = [...data.autoItems, ...data.manualItems]

        // Build category breakdown
        const categoryMap = new Map<string, { direction: "IN" | "OUT"; amount: number; count: number }>()
        for (const item of allItems) {
            const key = `${item.category}-${item.direction}`
            const existing = categoryMap.get(key) || { direction: item.direction, amount: 0, count: 0 }
            existing.amount += item.amount
            existing.count += 1
            categoryMap.set(key, existing)
        }

        const breakdown = Array.from(categoryMap.entries()).map(([key, val]) => ({
            category: key.split("-")[0],
            direction: val.direction,
            amount: val.amount,
            itemCount: val.count,
        }))

        runningBalance += data.summary.netFlow

        months.push({
            month,
            year,
            label: `${monthNames[month - 1]} ${year}`,
            totalIn: data.summary.totalIn,
            totalOut: data.summary.totalOut,
            netFlow: data.summary.netFlow,
            runningBalance,
            breakdown,
        })
    }

    const totalIn = months.reduce((s, m) => s + m.totalIn, 0)
    const totalOut = months.reduce((s, m) => s + m.totalOut, 0)

    return {
        startingBalance,
        months,
        totals: {
            totalIn,
            totalOut,
            netFlow: totalIn - totalOut,
            endingBalance: runningBalance,
        },
    }
}

// ================================
// Exported: Accuracy trend (past N months)
// ================================

export interface AccuracyTrendMonth {
    month: number
    year: number
    label: string
    plannedIn: number
    plannedOut: number
    actualIn: number
    actualOut: number
    variancePctIn: number | null
    variancePctOut: number | null
    accuracyScore: number | null
}

export async function getAccuracyTrend(monthsBack: number = 3): Promise<AccuracyTrendMonth[]> {
    await requireAuth()

    const now = new Date()
    const result: AccuracyTrendMonth[] = []
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]

    for (let i = monthsBack; i >= 1; i--) {
        const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const month = targetDate.getMonth() + 1
        const year = targetDate.getFullYear()

        const snapshot = await prisma.cashflowSnapshot.findUnique({
            where: { month_year: { month, year } },
        })

        if (!snapshot) continue

        const monthStart = new Date(year, month - 1, 1)
        const monthEnd = new Date(year, month, 0)
        const actuals = await getActualTransactions(monthStart, monthEnd)

        const actualIn = actuals.filter(i => i.direction === "IN").reduce((s, i) => s + i.amount, 0)
        const actualOut = actuals.filter(i => i.direction === "OUT").reduce((s, i) => s + i.amount, 0)
        const plannedIn = toNum(snapshot.totalPlannedIn)
        const plannedOut = toNum(snapshot.totalPlannedOut)

        const variancePctIn = plannedIn > 0 ? ((actualIn - plannedIn) / plannedIn) * 100 : null
        const variancePctOut = plannedOut > 0 ? ((actualOut - plannedOut) / plannedOut) * 100 : null

        const accIn = variancePctIn !== null ? Math.max(0, 100 - Math.abs(variancePctIn)) : null
        const accOut = variancePctOut !== null ? Math.max(0, 100 - Math.abs(variancePctOut)) : null
        const accuracyScore = accIn !== null && accOut !== null
            ? (accIn + accOut) / 2
            : accIn ?? accOut ?? null

        result.push({
            month,
            year,
            label: `${monthNames[month - 1]} ${year}`,
            plannedIn,
            plannedOut,
            actualIn,
            actualOut,
            variancePctIn,
            variancePctOut,
            accuracyScore: accuracyScore !== null ? Math.round(accuracyScore) : null,
        })
    }

    return result
}

// ================================
// Upcoming Obligations (next N days, cross-month)
// ================================

export interface UpcomingObligationItem {
    id: string
    date: string // YYYY-MM-DD
    description: string
    amount: number
    direction: "IN" | "OUT"
    category: string
    sourceType: "AR" | "AP" | "PO" | "PAYROLL" | "BPJS" | "LOAN" | "MANUAL"
    sourceUrl?: string // link to detail page
    glAccountCode?: string
    glAccountName?: string
}

export interface UpcomingObligationsData {
    items: UpcomingObligationItem[]
    summary: {
        totalIn: number
        totalOut: number
        net: number
        itemCount: number
    }
    periodLabel: string // e.g. "90 hari ke depan"
}

export async function getUpcomingObligations(days: number = 90): Promise<UpcomingObligationsData> {
    await requireAuth()

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const endDate = new Date(today)
    endDate.setDate(endDate.getDate() + days)

    const safe = <T,>(p: Promise<T>, fallback: T, label?: string): Promise<T> =>
        p.catch((err) => {
            console.error(`[cashflow-upcoming] ${label || "query"} failed:`, err?.message || err)
            return fallback
        })

    // 1. AR Invoices — money coming in (include overdue + future due)
    const arInvoices = await safe(
        prisma.invoice.findMany({
            where: {
                type: "INV_OUT",
                balanceDue: { gt: 0 },
                dueDate: { lte: endDate },
                status: { notIn: ["CANCELLED", "VOID", "PAID"] },
            },
            include: { customer: { select: { name: true } } },
            orderBy: { dueDate: "asc" },
        }),
        [],
        "AR invoices"
    )

    const arItems: UpcomingObligationItem[] = arInvoices.map(inv => {
        const isOverdue = inv.dueDate < today
        return {
            id: `upcoming-ar-${inv.id}`,
            date: toDateStr(inv.dueDate),
            description: `${isOverdue ? "⚠ Jatuh tempo: " : ""}Piutang ${inv.number} — ${inv.customer?.name || "Pelanggan"}`,
            amount: toNum(inv.balanceDue),
            direction: "IN" as const,
            category: "AR_INVOICE",
            sourceType: "AR" as const,
            sourceUrl: `/finance/invoices?highlight=${inv.id}`,
            glAccountCode: SYS_ACCOUNTS.AR,
        }
    })

    // 2. AP Bills — money going out (include overdue + future due)
    const apInvoices = await safe(
        prisma.invoice.findMany({
            where: {
                type: "INV_IN",
                balanceDue: { gt: 0 },
                dueDate: { lte: endDate },
                status: { notIn: ["CANCELLED", "VOID", "PAID"] },
            },
            include: { supplier: { select: { name: true } } },
            orderBy: { dueDate: "asc" },
        }),
        [],
        "AP invoices"
    )

    const apItems: UpcomingObligationItem[] = apInvoices.map(inv => {
        const isOverdue = inv.dueDate < today
        return {
            id: `upcoming-ap-${inv.id}`,
            date: toDateStr(inv.dueDate),
            description: `${isOverdue ? "⚠ Jatuh tempo: " : ""}Hutang ${inv.number} — ${inv.supplier?.name || "Pemasok"}`,
            amount: toNum(inv.balanceDue),
            direction: "OUT" as const,
            category: "AP_BILL",
            sourceType: "AP" as const,
            sourceUrl: `/finance/invoices?highlight=${inv.id}`,
            glAccountCode: SYS_ACCOUNTS.AP,
        }
    })

    // 3. PO — approved/ordered, not yet billed (include past POs still unpaid)
    const pos = await safe(
        prisma.purchaseOrder.findMany({
            where: {
                status: { in: ["APPROVED", "ORDERED", "VENDOR_CONFIRMED", "SHIPPED", "PARTIAL_RECEIVED"] },
                paymentStatus: { not: "PAID" },
                invoices: { none: {} },
            },
            include: { supplier: { select: { name: true } } },
        }),
        [],
        "PO obligations"
    )

    const poItems: UpcomingObligationItem[] = pos.map(po => ({
        id: `upcoming-po-${po.id}`,
        date: toDateStr(po.expectedDate || po.orderDate),
        description: `PO ${po.number} — ${po.supplier?.name || "Pemasok"}`,
        amount: toNum(po.totalAmount),
        direction: "OUT",
        category: "PO_DIRECT",
        sourceType: "PO",
        sourceUrl: `/procurement/orders?highlight=${po.id}`,
        glAccountCode: SYS_ACCOUNTS.AP,
    }))

    // 4. Payroll — next 3 months
    const employees = await safe(
        prisma.employee.findMany({
            where: { status: "ACTIVE", baseSalary: { gt: 0 } },
            select: { baseSalary: true },
        }),
        [],
        "Employee payroll"
    )

    const payrollItems: UpcomingObligationItem[] = []
    const bpjsItems: UpcomingObligationItem[] = []

    if (employees.length > 0) {
        const totalSalary = employees.reduce((sum, e) => sum + toNum(e.baseSalary), 0)

        // Generate payroll + BPJS for each month in range
        const startMonth = today.getMonth() // 0-indexed
        const startYear = today.getFullYear()

        for (let i = 0; i < 4; i++) {
            const m = ((startMonth + i) % 12) + 1 // 1-indexed
            const y = startYear + Math.floor((startMonth + i) / 12)
            const payDate = new Date(y, m - 1, 25)
            const bpjsDate = new Date(y, m - 1, 15)

            if (payDate >= today && payDate <= endDate) {
                const monthName = await getMonthName(m)
                payrollItems.push({
                    id: `upcoming-payroll-${y}-${m}`,
                    date: toDateStr(payDate),
                    description: `Gaji ${employees.length} karyawan — ${monthName} ${y}`,
                    amount: totalSalary,
                    direction: "OUT",
                    category: "PAYROLL",
                    sourceType: "PAYROLL",
                    sourceUrl: `/hcm/payroll`,
                    glAccountCode: "6200",
                })
            }

            if (bpjsDate >= today && bpjsDate <= endDate) {
                const monthName = await getMonthName(m)
                const kesehatanAmt = totalSalary * 0.04
                const tkAmt = totalSalary * 0.0574

                if (kesehatanAmt > 0) {
                    bpjsItems.push({
                        id: `upcoming-bpjs-kes-${y}-${m}`,
                        date: toDateStr(bpjsDate),
                        description: `BPJS Kesehatan — ${monthName} ${y}`,
                        amount: kesehatanAmt,
                        direction: "OUT",
                        category: "BPJS",
                        sourceType: "BPJS",
                        sourceUrl: `/hcm/payroll`,
                    })
                }
                if (tkAmt > 0) {
                    bpjsItems.push({
                        id: `upcoming-bpjs-tk-${y}-${m}`,
                        date: toDateStr(bpjsDate),
                        description: `BPJS Ketenagakerjaan — ${monthName} ${y}`,
                        amount: tkAmt,
                        direction: "OUT",
                        category: "BPJS",
                        sourceType: "BPJS",
                        sourceUrl: `/hcm/payroll`,
                    })
                }
            }
        }
    }

    // 5. Loan repayments
    const loanEntries = await safe(
        prisma.journalEntry.findMany({
            where: {
                status: "POSTED",
                date: { gte: today, lte: endDate },
                lines: {
                    some: {
                        account: { type: "LIABILITY" },
                        debit: { gt: 0 },
                    },
                },
            },
            include: {
                lines: {
                    where: { account: { type: "LIABILITY" }, debit: { gt: 0 } },
                    include: { account: { select: { code: true, name: true } } },
                },
            },
        }),
        [],
        "Loan repayments"
    )

    const loanItems: UpcomingObligationItem[] = loanEntries.map(je => {
        const totalDebit = je.lines.reduce((s, l) => s + toNum(l.debit), 0)
        return {
            id: `upcoming-loan-${je.id}`,
            date: toDateStr(je.date),
            description: `Cicilan: ${je.description || "Pembayaran pinjaman"}`,
            amount: totalDebit,
            direction: "OUT" as const,
            category: "LOAN_REPAYMENT",
            sourceType: "LOAN" as const,
            sourceUrl: `/finance/journal`,
            glAccountCode: je.lines[0]?.account?.code,
            glAccountName: je.lines[0]?.account?.name,
        }
    })

    console.log(`[cashflow-upcoming] Results: AR=${arItems.length}, AP=${apItems.length}, PO=${poItems.length}, Payroll=${payrollItems.length}, BPJS=${bpjsItems.length}, Loan=${loanItems.length}`)

    // Combine & sort by date
    const allItems = [...arItems, ...apItems, ...poItems, ...payrollItems, ...bpjsItems, ...loanItems]
        .sort((a, b) => a.date.localeCompare(b.date))

    const totalIn = allItems.filter(i => i.direction === "IN").reduce((s, i) => s + i.amount, 0)
    const totalOut = allItems.filter(i => i.direction === "OUT").reduce((s, i) => s + i.amount, 0)

    return {
        items: allItems,
        summary: {
            totalIn,
            totalOut,
            net: totalIn - totalOut,
            itemCount: allItems.length,
        },
        periodLabel: `${days} hari ke depan`,
    }
}

// ================================
// Scenario CRUD
// ================================

export interface ScenarioConfig {
    disabledSources: string[]
    items: Record<string, { enabled: boolean; overrideAmount: number | null }>
}

export interface CashflowScenarioSummary {
    id: string
    name: string
    month: number
    year: number
    totalIn: number
    totalOut: number
    netFlow: number
    updatedAt: Date
}

export interface CashflowScenarioFull extends CashflowScenarioSummary {
    config: ScenarioConfig
}

export async function getCashflowScenarios(month: number, year: number): Promise<CashflowScenarioSummary[]> {
    await requireAuth()

    const scenarios = await prisma.cashflowScenario.findMany({
        where: { month, year },
        orderBy: { updatedAt: "desc" },
    })

    return scenarios.map((s) => ({
        id: s.id,
        name: s.name,
        month: s.month,
        year: s.year,
        totalIn: toNum(s.totalIn),
        totalOut: toNum(s.totalOut),
        netFlow: toNum(s.netFlow),
        updatedAt: s.updatedAt,
    }))
}

export async function getCashflowScenario(id: string): Promise<CashflowScenarioFull | null> {
    await requireAuth()

    const s = await prisma.cashflowScenario.findUnique({ where: { id } })
    if (!s) return null

    return {
        id: s.id,
        name: s.name,
        month: s.month,
        year: s.year,
        totalIn: toNum(s.totalIn),
        totalOut: toNum(s.totalOut),
        netFlow: toNum(s.netFlow),
        updatedAt: s.updatedAt,
        config: (s.config as unknown as ScenarioConfig) || { disabledSources: [], items: {} },
    }
}

export async function createCashflowScenario(
    name: string,
    month: number,
    year: number
): Promise<{ id: string }> {
    return withPrismaAuth(async (tx) => {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        const scenario = await tx.cashflowScenario.create({
            data: {
                name,
                month,
                year,
                config: { disabledSources: [], items: {} },
                createdBy: user?.id || null,
            },
        })

        return { id: scenario.id }
    })
}

export async function updateCashflowScenario(
    id: string,
    data: {
        name?: string
        config?: ScenarioConfig
        totalIn?: number
        totalOut?: number
        netFlow?: number
    }
): Promise<{ id: string }> {
    return withPrismaAuth(async (tx) => {
        const updateData: Record<string, unknown> = {}

        if (data.name !== undefined) updateData.name = data.name
        if (data.config !== undefined) updateData.config = data.config
        if (data.totalIn !== undefined) updateData.totalIn = data.totalIn
        if (data.totalOut !== undefined) updateData.totalOut = data.totalOut
        if (data.netFlow !== undefined) updateData.netFlow = data.netFlow

        const scenario = await tx.cashflowScenario.update({
            where: { id },
            data: updateData,
        })

        return { id: scenario.id }
    })
}

export async function deleteCashflowScenario(id: string): Promise<{ success: boolean }> {
    return withPrismaAuth(async (tx) => {
        await tx.cashflowScenario.delete({ where: { id } })
        return { success: true }
    })
}

// ================================
// Actual Cashflow Data
// ================================

export interface ActualCashflowItem {
    id: string
    date: string
    description: string
    amount: number
    totalAmount: number | null // for partial payments
    direction: "IN" | "OUT"
    category: string
    source: string
    status: "LUNAS" | "SEBAGIAN"
    paidPercentage: number
    glAccountCode: string | null
    glAccountName: string | null
}

export interface CashflowActualData {
    actualItems: ActualCashflowItem[]
    startingBalance: number
    summary: { totalIn: number; totalOut: number; net: number; endBalance: number }
    lastMonthRef: { totalIn: number; totalOut: number; net: number; count: number } | null
}

function categorizeJournalEntry(
    je: { description: string },
    line: { debit: unknown; credit: unknown }
): string {
    const desc = (je.description || "").toLowerCase()
    if (desc.includes("gaji") || desc.includes("payroll")) return "PAYROLL"
    if (desc.includes("bpjs")) return "BPJS"
    if (desc.includes("kas kecil") || desc.includes("petty")) return "PETTY_CASH"
    if (desc.includes("pinjaman") || desc.includes("loan")) return "LOAN_REPAYMENT"
    if (desc.includes("modal") || desc.includes("capital")) return "FUNDING_CAPITAL"
    // Default: debit = outgoing (AP), credit = incoming (AR)
    return toNum(line.debit) > 0 ? "AP_BILL" : "AR_INVOICE"
}

export async function getCashflowActualData(month: number, year: number): Promise<CashflowActualData> {
    await requireAuth()

    const monthStart = new Date(year, month - 1, 1)
    const monthEnd = new Date(year, month, 0)

    const safe = <T,>(p: Promise<T>, fallback: T): Promise<T> =>
        p.catch(() => fallback)

    // 1. POSTED journal entries — only bank/cash account lines (code starts with "10" or "11")
    const journalEntries = await safe(
        prisma.journalEntry.findMany({
            where: {
                status: "POSTED",
                date: { gte: monthStart, lte: monthEnd },
            },
            include: {
                lines: {
                    where: {
                        account: {
                            OR: [
                                { code: { startsWith: "10" } },
                                { code: { startsWith: "11" } },
                            ],
                        },
                    },
                    include: { account: { select: { code: true, name: true } } },
                },
                invoice: { select: { number: true } },
                payment: { select: { number: true, method: true } },
            },
        }),
        []
    )

    const jeItems: ActualCashflowItem[] = []
    for (const je of journalEntries) {
        for (const line of je.lines) {
            const debitAmt = toNum(line.debit)
            const creditAmt = toNum(line.credit)
            if (debitAmt === 0 && creditAmt === 0) continue

            const direction: "IN" | "OUT" = debitAmt > 0 ? "IN" : "OUT"
            const amount = debitAmt > 0 ? debitAmt : creditAmt
            const category = categorizeJournalEntry(je, line)

            let desc = je.description
            if (je.invoice) desc += ` (${je.invoice.number})`
            if (je.payment) desc += ` [${je.payment.number}]`

            jeItems.push({
                id: `actual-je-${je.id}-${line.id}`,
                date: toDateStr(je.date),
                description: desc,
                amount,
                totalAmount: null,
                direction,
                category,
                source: "JOURNAL",
                status: "LUNAS",
                paidPercentage: 100,
                glAccountCode: line.account?.code || null,
                glAccountName: line.account?.name || null,
            })
        }
    }

    // 2. PARTIAL AR invoices (type INV_OUT, status PARTIAL)
    const partialAR = await safe(
        prisma.invoice.findMany({
            where: {
                type: "INV_OUT",
                status: "PARTIAL",
                dueDate: { gte: monthStart, lte: monthEnd },
            },
            include: { customer: { select: { name: true } } },
        }),
        []
    )

    const arPartialItems: ActualCashflowItem[] = partialAR.map((inv) => {
        const total = toNum(inv.totalAmount)
        const due = toNum(inv.balanceDue)
        const paid = total - due
        const pct = total > 0 ? Math.round((paid / total) * 100) : 0

        return {
            id: `actual-ar-partial-${inv.id}`,
            date: toDateStr(inv.dueDate),
            description: `Piutang ${inv.number} — ${inv.customer?.name || "Pelanggan"} (sebagian)`,
            amount: paid,
            totalAmount: total,
            direction: "IN" as const,
            category: "AR_INVOICE",
            source: "INVOICE_PARTIAL",
            status: "SEBAGIAN" as const,
            paidPercentage: pct,
            glAccountCode: SYS_ACCOUNTS.AR,
            glAccountName: "Piutang Usaha",
        }
    })

    // 3. PARTIAL AP bills (type INV_IN, status PARTIAL)
    const partialAP = await safe(
        prisma.invoice.findMany({
            where: {
                type: "INV_IN",
                status: "PARTIAL",
                dueDate: { gte: monthStart, lte: monthEnd },
            },
            include: { supplier: { select: { name: true } } },
        }),
        []
    )

    const apPartialItems: ActualCashflowItem[] = partialAP.map((inv) => {
        const total = toNum(inv.totalAmount)
        const due = toNum(inv.balanceDue)
        const paid = total - due
        const pct = total > 0 ? Math.round((paid / total) * 100) : 0

        return {
            id: `actual-ap-partial-${inv.id}`,
            date: toDateStr(inv.dueDate),
            description: `Hutang ${inv.number} — ${inv.supplier?.name || "Pemasok"} (sebagian)`,
            amount: paid,
            totalAmount: total,
            direction: "OUT" as const,
            category: "AP_BILL",
            source: "INVOICE_PARTIAL",
            status: "SEBAGIAN" as const,
            paidPercentage: pct,
            glAccountCode: SYS_ACCOUNTS.AP,
            glAccountName: "Hutang Usaha",
        }
    })

    // 4. Starting balance
    const startingBalance = await safe(getStartingBalance(), 0)

    // 5. Combine all actual items
    const actualItems = [...jeItems, ...arPartialItems, ...apPartialItems]
        .sort((a, b) => a.date.localeCompare(b.date))

    // 6. Summary
    const totalIn = actualItems.filter(i => i.direction === "IN").reduce((s, i) => s + i.amount, 0)
    const totalOut = actualItems.filter(i => i.direction === "OUT").reduce((s, i) => s + i.amount, 0)
    const net = totalIn - totalOut
    const endBalance = startingBalance + net

    // 7. Last month reference
    const lastMonth = month === 1 ? 12 : month - 1
    const lastYear = month === 1 ? year - 1 : year
    const lastMonthStart = new Date(lastYear, lastMonth - 1, 1)
    const lastMonthEnd = new Date(lastYear, lastMonth, 0)
    const lastMonthActuals = await safe(getActualTransactions(lastMonthStart, lastMonthEnd), [])

    const lastMonthRef = lastMonthActuals.length > 0 ? {
        totalIn: lastMonthActuals.filter(i => i.direction === "IN").reduce((s, i) => s + i.amount, 0),
        totalOut: lastMonthActuals.filter(i => i.direction === "OUT").reduce((s, i) => s + i.amount, 0),
        net: 0,
        count: lastMonthActuals.length,
    } : null

    if (lastMonthRef) {
        lastMonthRef.net = lastMonthRef.totalIn - lastMonthRef.totalOut
    }

    return {
        actualItems,
        startingBalance,
        summary: { totalIn, totalOut, net, endBalance },
        lastMonthRef,
    }
}
