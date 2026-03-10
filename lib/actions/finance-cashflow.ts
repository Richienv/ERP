'use server'

import { prisma, withPrismaAuth } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"
import type { CashflowDirection, CashflowCategory } from "@prisma/client"

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
        glAccountCode: "1100",
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
        glAccountCode: "2100",
        sourceId: inv.id,
        isRecurring: false,
        isManual: false,
    }))
}

// ================================
// Auto-pull source #3: Payroll
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
// Auto-pull source #7: Budget Allocations
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
// Exported: Main data fetcher
// ================================

export async function getCashflowPlanData(month: number, year: number): Promise<CashflowPlanData> {
    await requireAuth()

    const monthStart = new Date(year, month - 1, 1)
    const monthEnd = new Date(year, month, 0) // last day of month

    const [
        arItems,
        apItems,
        payrollItems,
        bpjsItems,
        pettyCashItems,
        recurringItems,
        budgetItems,
        manualDbItems,
        startingBalance,
        snapshot,
        actualItems,
    ] = await Promise.all([
        getARItems(monthStart, monthEnd),
        getAPItems(monthStart, monthEnd),
        getPayrollItems(month, year),
        getBPJSItems(month, year),
        getPettyCashItems(monthStart, monthEnd),
        getRecurringJournalItems(monthStart, monthEnd),
        getBudgetItems(month, year),
        prisma.cashflowPlanItem.findMany({
            where: {
                date: { gte: monthStart, lte: monthEnd },
            },
            include: {
                glAccount: { select: { code: true, name: true } },
            },
            orderBy: { date: "asc" },
        }),
        getStartingBalance(),
        prisma.cashflowSnapshot.findUnique({
            where: { month_year: { month, year } },
        }),
        getActualTransactions(monthStart, monthEnd),
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
        ...payrollItems,
        ...bpjsItems,
        ...pettyCashItems,
        ...recurringItems,
        ...budgetItems,
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
