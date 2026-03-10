# Cashflow Planning Board (MTG-007) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a monthly calendar-based cashflow planning board that auto-pulls all financial data (AR, AP, payroll, BPJS, petty cash, recurring journals, budgets), supports manual/recurring items with GL account selection, dual Riil/Planning tabs, and variance tracking with snapshots.

**Architecture:** Hybrid approach — auto-pulled items computed on-the-fly from existing models (Invoice, Employee, PettyCashTransaction, JournalEntry, BudgetLine), manual items stored in new `CashflowPlanItem` model, monthly snapshots in `CashflowSnapshot` for accuracy tracking. API route fetches all sources and merges. TanStack Query hook for instant loading.

**Tech Stack:** Prisma (new models + migration), Next.js API route, TanStack Query, shadcn/ui Calendar + Dialog, neo-brutalist styling (NB from `lib/dialog-styles.ts`), Framer Motion.

**Design doc:** `docs/plans/2026-03-10-cashflow-planning-board-design.md`

---

### Task 1: Schema — Add Enums and Models

**Files:**
- Modify: `prisma/schema.prisma:3255` (append after StockReservation)

**Step 1: Add enums and models to schema**

Append after line 3255 in `prisma/schema.prisma`:

```prisma
// ================================
// Cashflow Planning (MTG-007)
// ================================

enum CashflowDirection {
  IN
  OUT
}

enum CashflowCategory {
  // Auto-pulled (virtual, used in API response)
  AR_INVOICE
  AP_BILL
  PAYROLL
  BPJS
  PETTY_CASH
  RECURRING_JOURNAL
  BUDGET_ALLOCATION
  // Stored in CashflowPlanItem
  MANUAL
  RECURRING_EXPENSE
  RECURRING_INCOME
}

model CashflowPlanItem {
  id               String            @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  date             DateTime          @db.Date
  description      String
  amount           Decimal           @db.Decimal(18, 2)
  direction        CashflowDirection
  category         CashflowCategory  @default(MANUAL)
  glAccountId      String?           @db.Uuid
  glAccount        GLAccount?        @relation(fields: [glAccountId], references: [id])
  isRecurring      Boolean           @default(false)
  recurringPattern String?           // WEEKLY, MONTHLY, QUARTERLY, ANNUAL
  recurringEndDate DateTime?         @db.Date
  notes            String?
  createdBy        String?           @db.Uuid
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt

  @@index([date])
  @@index([direction])
  @@index([category])
  @@map("cashflow_plan_items")
}

model CashflowSnapshot {
  id                      String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  month                   Int
  year                    Int
  startingBalance         Decimal  @db.Decimal(18, 2)
  startingBalanceOverride Decimal? @db.Decimal(18, 2)
  items                   Json     // frozen copy of all items at snapshot time
  totalPlannedIn          Decimal  @db.Decimal(18, 2)
  totalPlannedOut         Decimal  @db.Decimal(18, 2)
  plannedEndBalance       Decimal  @db.Decimal(18, 2)
  snapshotDate            DateTime @default(now())
  createdAt               DateTime @default(now())

  @@unique([month, year])
  @@map("cashflow_snapshots")
}
```

**Step 2: Add relation to GLAccount**

In `prisma/schema.prisma`, inside the `GLAccount` model (around line 2061), add after `budgetLines`:

```prisma
  cashflowPlanItems     CashflowPlanItem[]
```

**Step 3: Run migration**

```bash
npx prisma migrate dev --name add_cashflow_planning
```

Expected: Migration created successfully, Prisma client regenerated.

**Step 4: Verify**

```bash
npx prisma generate
```

Expected: `✔ Generated Prisma Client`

**Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(cashflow): add CashflowPlanItem and CashflowSnapshot models"
```

---

### Task 2: Server Actions — `lib/actions/finance-cashflow.ts`

**Files:**
- Create: `lib/actions/finance-cashflow.ts`

**Step 1: Create the server actions file**

```typescript
"use server"

import { prisma } from "@/lib/db"
import { withPrismaAuth } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"
import { CashflowDirection, CashflowCategory, Prisma } from "@prisma/client"

// ─── Auth helper (reads only) ──────────────────────────────────────────────

async function requireAuth() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new Error("Unauthorized")
    return user
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CashflowItem {
    id: string
    date: string // ISO date
    description: string
    amount: number
    direction: "IN" | "OUT"
    category: string
    glAccountCode?: string
    glAccountName?: string
    sourceId?: string // invoice/employee/journal ID
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

// ─── Auto-pull: AR Invoices (pemasukan) ─────────────────────────────────────

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
    return invoices.map(inv => ({
        id: `ar-${inv.id}`,
        date: inv.dueDate.toISOString().split("T")[0],
        description: `${inv.number} — ${inv.customer?.name ?? "Pelanggan"}`,
        amount: Number(inv.balanceDue),
        direction: "IN" as const,
        category: "AR_INVOICE",
        glAccountCode: "1100",
        glAccountName: "Piutang Usaha",
        sourceId: inv.id,
        isRecurring: false,
        isManual: false,
    }))
}

// ─── Auto-pull: AP Bills (pengeluaran) ──────────────────────────────────────

async function getAPItems(monthStart: Date, monthEnd: Date): Promise<CashflowItem[]> {
    const bills = await prisma.invoice.findMany({
        where: {
            type: "INV_IN",
            balanceDue: { gt: 0 },
            dueDate: { gte: monthStart, lte: monthEnd },
            status: { notIn: ["CANCELLED", "VOID"] },
        },
        include: { supplier: { select: { name: true } } },
    })
    return bills.map(bill => ({
        id: `ap-${bill.id}`,
        date: bill.dueDate.toISOString().split("T")[0],
        description: `${bill.number} — ${bill.supplier?.name ?? "Vendor"}`,
        amount: Number(bill.balanceDue),
        direction: "OUT" as const,
        category: "AP_BILL",
        glAccountCode: "2100",
        glAccountName: "Hutang Usaha",
        sourceId: bill.id,
        isRecurring: false,
        isManual: false,
    }))
}

// ─── Auto-pull: Payroll (gaji bulanan) ──────────────────────────────────────

async function getPayrollItems(month: number, year: number): Promise<CashflowItem[]> {
    const employees = await prisma.employee.findMany({
        where: {
            status: "ACTIVE",
            baseSalary: { gt: 0 },
        },
        select: { id: true, name: true, baseSalary: true },
    })
    if (employees.length === 0) return []

    const totalSalary = employees.reduce((sum, e) => sum + Number(e.baseSalary), 0)
    // Payroll date: 25th of each month
    const payDate = `${year}-${String(month).padStart(2, "0")}-25`

    return [{
        id: `payroll-${month}-${year}`,
        date: payDate,
        description: `Gaji ${getMonthName(month)} ${year} (${employees.length} karyawan)`,
        amount: totalSalary,
        direction: "OUT" as const,
        category: "PAYROLL",
        glAccountCode: "6200",
        glAccountName: "Biaya Gaji",
        isRecurring: true,
        isManual: false,
    }]
}

// ─── Auto-pull: BPJS & potongan ─────────────────────────────────────────────

async function getBPJSItems(month: number, year: number): Promise<CashflowItem[]> {
    const employees = await prisma.employee.findMany({
        where: { status: "ACTIVE", baseSalary: { gt: 0 } },
        select: { id: true, baseSalary: true, bpjsKesehatan: true, bpjsKetenagakerjaan: true },
    })
    if (employees.length === 0) return []

    // Estimate BPJS: 4% kesehatan + 5.74% ketenagakerjaan of base salary (employer portion)
    const totalBase = employees.reduce((sum, e) => sum + Number(e.baseSalary), 0)
    const bpjsKesehatan = totalBase * 0.04
    const bpjsKetenagakerjaan = totalBase * 0.0574
    const payDate = `${year}-${String(month).padStart(2, "0")}-15`

    const items: CashflowItem[] = []
    if (bpjsKesehatan > 0) {
        items.push({
            id: `bpjs-kes-${month}-${year}`,
            date: payDate,
            description: `BPJS Kesehatan ${getMonthName(month)} ${year}`,
            amount: Math.round(bpjsKesehatan),
            direction: "OUT",
            category: "BPJS",
            glAccountCode: "6210",
            glAccountName: "Biaya BPJS Kesehatan",
            isRecurring: true,
            isManual: false,
        })
    }
    if (bpjsKetenagakerjaan > 0) {
        items.push({
            id: `bpjs-tk-${month}-${year}`,
            date: payDate,
            description: `BPJS Ketenagakerjaan ${getMonthName(month)} ${year}`,
            amount: Math.round(bpjsKetenagakerjaan),
            direction: "OUT",
            category: "BPJS",
            glAccountCode: "6220",
            glAccountName: "Biaya BPJS Ketenagakerjaan",
            isRecurring: true,
            isManual: false,
        })
    }
    return items
}

// ─── Auto-pull: Petty Cash recurring ────────────────────────────────────────

async function getPettyCashItems(monthStart: Date, monthEnd: Date): Promise<CashflowItem[]> {
    const txns = await prisma.pettyCashTransaction.findMany({
        where: {
            date: { gte: monthStart, lte: monthEnd },
        },
        include: {
            bankAccount: { select: { code: true, name: true } },
            expenseAccount: { select: { code: true, name: true } },
        },
    })
    return txns.map(txn => ({
        id: `petty-${txn.id}`,
        date: txn.date.toISOString().split("T")[0],
        description: txn.description,
        amount: Number(txn.amount),
        direction: txn.type === "TOPUP" ? "IN" as const : "OUT" as const,
        category: "PETTY_CASH",
        glAccountCode: txn.expenseAccount?.code ?? txn.bankAccount?.code,
        glAccountName: txn.expenseAccount?.name ?? txn.bankAccount?.name,
        sourceId: txn.id,
        isRecurring: false,
        isManual: false,
    }))
}

// ─── Auto-pull: Recurring journal entries ───────────────────────────────────

async function getRecurringJournalItems(monthStart: Date, monthEnd: Date): Promise<CashflowItem[]> {
    const entries = await prisma.journalEntry.findMany({
        where: {
            isRecurring: true,
            status: "POSTED",
            nextRecurringDate: { gte: monthStart, lte: monthEnd },
        },
        include: {
            lines: { include: { account: { select: { code: true, name: true } } } },
        },
    })
    return entries.map(entry => {
        const totalDebit = entry.lines.reduce((s, l) => s + Number(l.debit), 0)
        const totalCredit = entry.lines.reduce((s, l) => s + Number(l.credit), 0)
        // If more debit = expense (OUT), more credit = income (IN)
        const isExpense = totalDebit >= totalCredit
        const amount = Math.max(totalDebit, totalCredit)
        return {
            id: `recj-${entry.id}`,
            date: entry.nextRecurringDate?.toISOString().split("T")[0] ?? entry.date.toISOString().split("T")[0],
            description: `[Recurring] ${entry.description}`,
            amount,
            direction: isExpense ? "OUT" as const : "IN" as const,
            category: "RECURRING_JOURNAL",
            glAccountCode: entry.lines[0]?.account?.code,
            glAccountName: entry.lines[0]?.account?.name,
            sourceId: entry.id,
            isRecurring: true,
            isManual: false,
        }
    })
}

// ─── Auto-pull: Budget allocations ──────────────────────────────────────────

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
    if (!budget?.lines?.length) return []

    return budget.lines
        .filter(line => Number(line.amount) > 0)
        .map(line => ({
            id: `budget-${line.id}`,
            date: `${year}-${String(month).padStart(2, "0")}-01`,
            description: `Anggaran: ${line.account.name}`,
            amount: Number(line.amount),
            direction: (line.account.type === "REVENUE" ? "IN" : "OUT") as CashflowDirection,
            category: "BUDGET_ALLOCATION",
            glAccountCode: line.account.code,
            glAccountName: line.account.name,
            isRecurring: false,
            isManual: false,
        }))
}

// ─── Get starting balance (sum of 10xx accounts) ───────────────────────────

async function getStartingBalance(): Promise<number> {
    const bankAccounts = await prisma.gLAccount.findMany({
        where: { code: { startsWith: "10" } },
        select: { balance: true },
    })
    return bankAccounts.reduce((sum, a) => sum + Number(a.balance), 0)
}

// ─── Get actual transactions (Riil tab) ─────────────────────────────────────

async function getActualTransactions(monthStart: Date, monthEnd: Date): Promise<CashflowItem[]> {
    const entries = await prisma.journalEntry.findMany({
        where: {
            date: { gte: monthStart, lte: monthEnd },
            status: "POSTED",
            isRecurring: false,
        },
        include: {
            lines: { include: { account: { select: { code: true, name: true } } } },
            invoice: { select: { number: true, type: true } },
            payment: { select: { number: true, method: true } },
        },
        orderBy: { date: "asc" },
    })

    return entries.map(entry => {
        const totalDebit = entry.lines.reduce((s, l) => s + Number(l.debit), 0)
        const totalCredit = entry.lines.reduce((s, l) => s + Number(l.credit), 0)
        const isExpense = totalDebit >= totalCredit
        const amount = Math.max(totalDebit, totalCredit)

        let desc = entry.description
        if (entry.invoice) desc = `${entry.invoice.number} — ${desc}`
        if (entry.payment) desc = `${entry.payment.number} — ${desc}`

        return {
            id: `actual-${entry.id}`,
            date: entry.date.toISOString().split("T")[0],
            description: desc,
            amount,
            direction: isExpense ? "OUT" as const : "IN" as const,
            category: entry.invoice?.type === "INV_OUT" ? "AR_INVOICE" : entry.invoice?.type === "INV_IN" ? "AP_BILL" : "MANUAL",
            glAccountCode: entry.lines[0]?.account?.code,
            glAccountName: entry.lines[0]?.account?.name,
            sourceId: entry.id,
            isRecurring: false,
            isManual: false,
        }
    })
}

// ─── Main data fetcher ──────────────────────────────────────────────────────

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
        recurringJournalItems,
        budgetItems,
        manualItemsRaw,
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
            include: { glAccount: { select: { code: true, name: true } } },
            orderBy: { date: "asc" },
        }),
        getStartingBalance(),
        prisma.cashflowSnapshot.findUnique({ where: { month_year: { month, year } } }),
        getActualTransactions(monthStart, monthEnd),
    ])

    const autoItems = [
        ...arItems,
        ...apItems,
        ...payrollItems,
        ...bpjsItems,
        ...pettyCashItems,
        ...recurringJournalItems,
        ...budgetItems,
    ]

    const manualItems: CashflowItem[] = manualItemsRaw.map(item => ({
        id: item.id,
        date: item.date.toISOString().split("T")[0],
        description: item.description,
        amount: Number(item.amount),
        direction: item.direction as "IN" | "OUT",
        category: item.category,
        glAccountCode: item.glAccount?.code,
        glAccountName: item.glAccount?.name,
        isRecurring: item.isRecurring,
        isManual: true,
    }))

    const allPlanItems = [...autoItems, ...manualItems]
    const totalIn = allPlanItems.filter(i => i.direction === "IN").reduce((s, i) => s + i.amount, 0)
    const totalOut = allPlanItems.filter(i => i.direction === "OUT").reduce((s, i) => s + i.amount, 0)

    const effectiveBalance = snapshot?.startingBalanceOverride
        ? Number(snapshot.startingBalanceOverride)
        : startingBalance

    return {
        month,
        year,
        startingBalance,
        startingBalanceOverride: snapshot?.startingBalanceOverride ? Number(snapshot.startingBalanceOverride) : null,
        effectiveStartingBalance: effectiveBalance,
        autoItems,
        manualItems,
        actualItems,
        snapshot: snapshot ? {
            id: snapshot.id,
            totalPlannedIn: Number(snapshot.totalPlannedIn),
            totalPlannedOut: Number(snapshot.totalPlannedOut),
            plannedEndBalance: Number(snapshot.plannedEndBalance),
            snapshotDate: snapshot.snapshotDate.toISOString(),
        } : null,
        summary: {
            totalIn,
            totalOut,
            netFlow: totalIn - totalOut,
            estimatedEndBalance: effectiveBalance + totalIn - totalOut,
        },
    }
}

// ─── CRUD: Manual items ─────────────────────────────────────────────────────

export async function createCashflowPlanItem(data: {
    date: string
    description: string
    amount: number
    direction: "IN" | "OUT"
    category?: string
    glAccountId?: string
    isRecurring?: boolean
    recurringPattern?: string
    recurringEndDate?: string
    notes?: string
}) {
    return withPrismaAuth(async (tx, user) => {
        const item = await tx.cashflowPlanItem.create({
            data: {
                date: new Date(data.date),
                description: data.description,
                amount: data.amount,
                direction: data.direction as CashflowDirection,
                category: (data.category ?? (data.isRecurring
                    ? (data.direction === "IN" ? "RECURRING_INCOME" : "RECURRING_EXPENSE")
                    : "MANUAL")) as CashflowCategory,
                glAccountId: data.glAccountId || null,
                isRecurring: data.isRecurring ?? false,
                recurringPattern: data.recurringPattern ?? null,
                recurringEndDate: data.recurringEndDate ? new Date(data.recurringEndDate) : null,
                notes: data.notes ?? null,
                createdBy: user.id,
            },
        })
        return item
    })
}

export async function updateCashflowPlanItem(id: string, data: {
    date?: string
    description?: string
    amount?: number
    direction?: "IN" | "OUT"
    glAccountId?: string | null
    isRecurring?: boolean
    recurringPattern?: string | null
    recurringEndDate?: string | null
    notes?: string | null
}) {
    return withPrismaAuth(async (tx) => {
        const updateData: Record<string, unknown> = {}
        if (data.date !== undefined) updateData.date = new Date(data.date)
        if (data.description !== undefined) updateData.description = data.description
        if (data.amount !== undefined) updateData.amount = data.amount
        if (data.direction !== undefined) updateData.direction = data.direction
        if (data.glAccountId !== undefined) updateData.glAccountId = data.glAccountId
        if (data.isRecurring !== undefined) updateData.isRecurring = data.isRecurring
        if (data.recurringPattern !== undefined) updateData.recurringPattern = data.recurringPattern
        if (data.recurringEndDate !== undefined) updateData.recurringEndDate = data.recurringEndDate ? new Date(data.recurringEndDate) : null
        if (data.notes !== undefined) updateData.notes = data.notes

        return tx.cashflowPlanItem.update({ where: { id }, data: updateData })
    })
}

export async function deleteCashflowPlanItem(id: string) {
    return withPrismaAuth(async (tx) => {
        return tx.cashflowPlanItem.delete({ where: { id } })
    })
}

// ─── Snapshot ───────────────────────────────────────────────────────────────

export async function saveCashflowSnapshot(month: number, year: number) {
    return withPrismaAuth(async (tx) => {
        const data = await getCashflowPlanData(month, year)
        const allItems = [...data.autoItems, ...data.manualItems]

        return tx.cashflowSnapshot.upsert({
            where: { month_year: { month, year } },
            create: {
                month,
                year,
                startingBalance: data.startingBalance,
                startingBalanceOverride: data.startingBalanceOverride,
                items: allItems as unknown as Prisma.InputJsonValue,
                totalPlannedIn: data.summary.totalIn,
                totalPlannedOut: data.summary.totalOut,
                plannedEndBalance: data.summary.estimatedEndBalance,
            },
            update: {
                startingBalance: data.startingBalance,
                startingBalanceOverride: data.startingBalanceOverride,
                items: allItems as unknown as Prisma.InputJsonValue,
                totalPlannedIn: data.summary.totalIn,
                totalPlannedOut: data.summary.totalOut,
                plannedEndBalance: data.summary.estimatedEndBalance,
                snapshotDate: new Date(),
            },
        })
    })
}

export async function overrideStartingBalance(month: number, year: number, amount: number) {
    return withPrismaAuth(async (tx) => {
        const startingBalance = await getStartingBalance()
        return tx.cashflowSnapshot.upsert({
            where: { month_year: { month, year } },
            create: {
                month,
                year,
                startingBalance,
                startingBalanceOverride: amount,
                items: [],
                totalPlannedIn: 0,
                totalPlannedOut: 0,
                plannedEndBalance: amount,
            },
            update: {
                startingBalanceOverride: amount,
            },
        })
    })
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getMonthName(month: number): string {
    const names = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"]
    return names[month] ?? ""
}
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

Expected: No errors in `finance-cashflow.ts` (existing errors in other files are OK).

**Step 3: Commit**

```bash
git add lib/actions/finance-cashflow.ts
git commit -m "feat(cashflow): add server actions for cashflow planning with 7 auto-pull sources"
```

---

### Task 3: API Route — `/api/finance/cashflow-plan`

**Files:**
- Create: `app/api/finance/cashflow-plan/route.ts`

**Step 1: Create API route**

```bash
ls "app/api/finance/"
```

Verify directory exists, then create:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { getCashflowPlanData } from "@/lib/actions/finance-cashflow"

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = req.nextUrl
        const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1))
        const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()))

        if (month < 1 || month > 12 || year < 2020 || year > 2100) {
            return NextResponse.json({ success: false, error: "Invalid month/year" }, { status: 400 })
        }

        const data = await getCashflowPlanData(month, year)
        return NextResponse.json({ success: true, ...data })
    } catch (err) {
        const message = err instanceof Error ? err.message : "Internal error"
        return NextResponse.json({ success: false, error: message }, { status: 500 })
    }
}
```

**Step 2: Commit**

```bash
git add app/api/finance/cashflow-plan/route.ts
git commit -m "feat(cashflow): add GET /api/finance/cashflow-plan API route"
```

---

### Task 4: Query Keys + Hook

**Files:**
- Modify: `lib/query-keys.ts:370` (add after fiscalPeriods)
- Create: `hooks/use-cashflow-plan.ts`

**Step 1: Add query keys**

In `lib/query-keys.ts`, insert before line 371 (`} as const`):

```typescript
    cashflowPlan: {
        all: ["cashflowPlan"] as const,
        list: (month: number, year: number) => [...["cashflowPlan"], "list", month, year] as const,
    },
```

**Step 2: Create hook**

```typescript
"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import type { CashflowPlanData } from "@/lib/actions/finance-cashflow"

export function useCashflowPlan(month: number, year: number) {
    return useQuery<CashflowPlanData>({
        queryKey: queryKeys.cashflowPlan.list(month, year),
        queryFn: async () => {
            const res = await fetch(`/api/finance/cashflow-plan?month=${month}&year=${year}`)
            if (!res.ok) throw new Error("Failed to fetch cashflow plan")
            const json = await res.json()
            return json as CashflowPlanData
        },
    })
}
```

**Step 3: Commit**

```bash
git add lib/query-keys.ts hooks/use-cashflow-plan.ts
git commit -m "feat(cashflow): add query keys and useCashflowPlan hook"
```

---

### Task 5: Page + KPI Strip + Month Navigation

**Files:**
- Create: `app/finance/planning/page.tsx`
- Create: `components/finance/cashflow-planning-board.tsx`

**Step 1: Create the page**

```typescript
"use client"

import { useState } from "react"
import { useCashflowPlan } from "@/hooks/use-cashflow-plan"
import { CashflowPlanningBoard } from "@/components/finance/cashflow-planning-board"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"

export const dynamic = "force-dynamic"

export default function CashflowPlanningPage() {
    const now = new Date()
    const [month, setMonth] = useState(now.getMonth() + 1)
    const [year, setYear] = useState(now.getFullYear())
    const { data, isLoading } = useCashflowPlan(month, year)

    if (isLoading || !data) return <TablePageSkeleton accentColor="bg-emerald-400" />

    return (
        <div className="mf-page">
            <CashflowPlanningBoard
                data={data}
                month={month}
                year={year}
                onMonthChange={setMonth}
                onYearChange={setYear}
            />
        </div>
    )
}
```

**Step 2: Create the planning board component**

Create `components/finance/cashflow-planning-board.tsx`. This is the main component containing:
- Header with month/year navigation (prev/next buttons)
- KPI strip: Saldo Awal, Est. Pemasukan, Est. Pengeluaran, Est. Saldo Akhir
- Tabs: Riil | Planning
- Calendar grid (7 columns, dates of the month)
- Each date cell shows items colored green (IN) / red (OUT)
- Right sidebar with running balance
- Action buttons: Tambah Item, Simpan Snapshot, Override Saldo

**Key UI patterns to follow:**
- Neo-brutalist styling: `border-2 border-black`, `shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`
- KPI cards: use `components/finance/finance-metric-card.tsx` pattern
- Tabs: use shadcn `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`
- Month navigation: `<Button variant="outline">` with `IconChevronLeft/Right`
- Calendar grid: `grid grid-cols-7 gap-1`
- Item badges: small pills with amount, colored by direction
- Indonesian labels: "Pemasukan", "Pengeluaran", "Saldo Awal", "Saldo Akhir"
- Dialog for create item: use `NB` styles from `lib/dialog-styles.ts`
- GL account select: use existing `GLAccount` dropdown pattern (fetch from `getGLAccountsList()`)
- Running balance sidebar: list of dates with cumulative balance
- Responsive: full-width, cards stack on mobile

**Implementation notes:**
- Use `framer-motion` `AnimatePresence` for smooth tab transitions
- Use `useQueryClient` + `queryKeys.cashflowPlan.all` for invalidation after mutations
- Import server actions: `createCashflowPlanItem`, `updateCashflowPlanItem`, `deleteCashflowPlanItem`, `saveCashflowSnapshot`, `overrideStartingBalance`
- Category color mapping:
  - AR_INVOICE: emerald
  - AP_BILL: red
  - PAYROLL: orange
  - BPJS: amber
  - PETTY_CASH: slate
  - RECURRING_JOURNAL: purple
  - BUDGET_ALLOCATION: blue
  - MANUAL: zinc
  - RECURRING_EXPENSE: rose
  - RECURRING_INCOME: teal
- Variance display (for past dates): show Rencana vs Aktual columns with green/red Selisih

**Step 3: Commit**

```bash
git add app/finance/planning/page.tsx components/finance/cashflow-planning-board.tsx
git commit -m "feat(cashflow): add planning board page with calendar view, KPI strip, dual tabs"
```

---

### Task 6: Create Item Dialog

**Files:**
- Create: `components/finance/create-cashflow-item-dialog.tsx`

**Step 1: Create dialog component**

Dialog for creating/editing manual cashflow plan items. Pattern follows `create-dcnote-dialog.tsx`:

- `NB.content` for dialog container
- `NB.header` black header: "Tambah Item Cashflow"
- Form fields:
  - **Tanggal** — date picker (react-day-picker)
  - **Deskripsi** — text input (`NB.input`)
  - **Jumlah** — number input with IDR formatting
  - **Arah** — toggle: Pemasukan (IN) / Pengeluaran (OUT) with color indication
  - **Rekening** — GL account combobox (fetch from `getGLAccountsList()`)
  - **Recurring** — checkbox, when checked shows:
    - Pattern select: Mingguan, Bulanan, Kuartalan, Tahunan
    - End date picker (optional)
  - **Catatan** — optional textarea
- Submit: calls `createCashflowPlanItem()` → `invalidateQueries(cashflowPlan.all)`
- Edit mode: pre-fills form, calls `updateCashflowPlanItem()`

**Step 2: Integrate into planning board**

Add "+ Tambah Item" button in the planning board header. Wire up the dialog.

**Step 3: Commit**

```bash
git add components/finance/create-cashflow-item-dialog.tsx components/finance/cashflow-planning-board.tsx
git commit -m "feat(cashflow): add create/edit item dialog with GL account selection and recurring support"
```

---

### Task 7: Sidebar Navigation + Prefetch

**Files:**
- Modify: `components/app-sidebar.tsx:240` (add menu item before closing `],`)
- Modify: `hooks/use-nav-prefetch.ts:518` (add route before closing `}`)

**Step 1: Add sidebar menu item**

In `components/app-sidebar.tsx`, insert before line 241 (the `],` closing Finance items array):

```typescript
        {
          title: "Perencanaan Kas",
          url: "/finance/planning",
        },
```

**Step 2: Add prefetch route**

In `hooks/use-nav-prefetch.ts`, insert before line 519 (closing `}` of routePrefetchMap):

```typescript
    "/finance/planning": {
        queryKey: queryKeys.cashflowPlan.list(new Date().getMonth() + 1, new Date().getFullYear()),
        queryFn: async () => {
            const m = new Date().getMonth() + 1
            const y = new Date().getFullYear()
            const res = await fetch(`/api/finance/cashflow-plan?month=${m}&year=${y}`)
            return res.json()
        },
    },
```

Also add the import for `queryKeys.cashflowPlan` if not already imported (it should be, since `queryKeys` is imported at the top).

**Step 3: Commit**

```bash
git add components/app-sidebar.tsx hooks/use-nav-prefetch.ts
git commit -m "feat(cashflow): add sidebar menu item and hover prefetch for planning page"
```

---

### Task 8: Snapshot + Override + Variance

**Files:**
- Modify: `components/finance/cashflow-planning-board.tsx` (add snapshot and override features)

**Step 1: Add "Simpan Snapshot" button**

- Button in header area, calls `saveCashflowSnapshot(month, year)`
- Shows toast on success: "Snapshot bulan {month} {year} tersimpan"
- Invalidates cashflowPlan queries

**Step 2: Add "Override Saldo Awal" dialog**

- Small dialog/popover triggered from KPI "Saldo Awal" card
- Input field for custom starting balance
- Calls `overrideStartingBalance(month, year, amount)`
- Shows current GL balance vs override value
- "Reset ke GL" button to clear override

**Step 3: Add variance display**

For past dates (date < today), show variance columns:
- Compare planning items against actual items (from `data.actualItems`)
- Match by category + date proximity
- Display: Rencana | Aktual | Selisih
- Color: green if actual <= plan (underspent/overearned), red if over

**Step 4: Commit**

```bash
git add components/finance/cashflow-planning-board.tsx
git commit -m "feat(cashflow): add snapshot save, balance override, and variance tracking"
```

---

### Task 9: Tests

**Files:**
- Create: `__tests__/finance/cashflow-plan.test.ts`

**Step 1: Write tests**

Test the helper/utility logic:
- `getMonthName()` returns correct Indonesian month names
- `CashflowItem` type validation
- Summary calculation: totalIn, totalOut, netFlow, estimatedEndBalance
- Variance: plan vs actual comparison logic
- Month boundary calculation (first/last day of month)

**Step 2: Run tests**

```bash
npx vitest run __tests__/finance/cashflow-plan.test.ts
```

Expected: All tests pass.

**Step 3: Run full test suite**

```bash
npx vitest
```

Expected: No regressions from existing tests.

**Step 4: Commit**

```bash
git add __tests__/finance/cashflow-plan.test.ts
git commit -m "test(cashflow): add unit tests for cashflow planning calculations"
```

---

### Task 10: Final Verification

**Step 1: TypeScript check**

```bash
npx tsc --noEmit
```

**Step 2: Lint**

```bash
npm run lint
```

**Step 3: Full test suite**

```bash
npx vitest
```

**Step 4: Manual verification guide**

```
Halaman: /finance/planning
Sebelumnya: Tidak ada fitur perencanaan arus kas
Sekarang: Planning board dengan calendar view, auto-pull 7 sumber data, manual items, recurring, snapshot

Cara Test:
1. Buka /finance/planning → lihat KPI strip (Saldo Awal, Pemasukan, Pengeluaran, Saldo Akhir)
2. Tab "Planning" → lihat items di calendar (AR hijau, AP merah, Gaji oranye)
3. Tab "Riil" → lihat transaksi aktual dari GL
4. Klik "+ Tambah Item" → buat item manual dengan rekening GL
5. Set recurring → pilih Bulanan → item muncul otomatis
6. Klik "Simpan Snapshot" → snapshot tersimpan
7. Klik Saldo Awal → override ke angka lain → saldo akhir berubah
8. Navigasi bulan (prev/next) → data berubah sesuai bulan
9. Tanggal yang sudah lewat → lihat kolom Rencana vs Aktual vs Selisih
```

**Step 5: Commit all remaining changes**

```bash
git add -A
git commit -m "feat(cashflow): MTG-007 cashflow planning board complete"
```
