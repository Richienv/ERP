# Cashflow Simulasi + Aktual Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the PLANNING/RIIL tabs with SIMULASI (interactive what-if sandbox with named scenarios) and AKTUAL (read-only confirmed transactions with partial payment indicators).

**Architecture:** Split current monolithic page into 3 routes (`/finance/planning`, `/finance/planning/simulasi`, `/finance/planning/aktual`). New `CashflowScenario` Prisma model stores named scenarios with JSON config. SIMULASI has a left sidebar for scenarios + source toggles; AKTUAL is full-width read-only. Existing `getCashflowPlanData` is extended to support all-status fetching.

**Tech Stack:** Next.js App Router, Prisma, TanStack Query, shadcn/ui, Tailwind CSS

**Design Doc:** `docs/plans/2026-03-12-cashflow-simulasi-aktual-design.md`

---

## Task 1: Prisma Schema — CashflowScenario Model

**Files:**
- Modify: `prisma/schema.prisma:3359` (after CashflowSnapshot)

**Step 1: Add CashflowScenario model**

Add after the `CashflowSnapshot` model closing brace (line 3359):

```prisma
model CashflowScenario {
  id        String   @id @default(cuid())
  name      String
  month     Int
  year      Int
  config    Json     @default("{}")
  totalIn   Decimal  @default(0)  @db.Decimal(20, 2)
  totalOut  Decimal  @default(0)  @db.Decimal(20, 2)
  netFlow   Decimal  @default(0)  @db.Decimal(20, 2)
  createdBy String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([month, year])
}
```

**Step 2: Generate migration**

Run: `npx prisma migrate dev --name add_cashflow_scenario`
Expected: Migration created, Prisma client regenerated.

**Step 3: Verify Prisma client**

Run: `npx prisma generate`
Expected: "Generated Prisma Client"

**Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(cashflow): add CashflowScenario model for named simulations"
```

---

## Task 2: Server Actions — Scenario CRUD + Actual Data

**Files:**
- Modify: `lib/actions/finance-cashflow.ts` (append after line 1354)

**Step 1: Add scenario CRUD server actions**

Append to end of `lib/actions/finance-cashflow.ts`:

```typescript
// ─── SCENARIO CRUD ─────────────────────────────────────────────
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
  "use server"
  await requireAuth()
  const rows = await prisma.cashflowScenario.findMany({
    where: { month, year },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, month: true, year: true, totalIn: true, totalOut: true, netFlow: true, updatedAt: true },
  })
  return rows.map(r => ({
    ...r,
    totalIn: Number(r.totalIn),
    totalOut: Number(r.totalOut),
    netFlow: Number(r.netFlow),
  }))
}

export async function getCashflowScenario(id: string): Promise<CashflowScenarioFull | null> {
  "use server"
  await requireAuth()
  const row = await prisma.cashflowScenario.findUnique({ where: { id } })
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    month: row.month,
    year: row.year,
    totalIn: Number(row.totalIn),
    totalOut: Number(row.totalOut),
    netFlow: Number(row.netFlow),
    updatedAt: row.updatedAt,
    config: row.config as ScenarioConfig,
  }
}

export async function createCashflowScenario(name: string, month: number, year: number): Promise<{ id: string }> {
  "use server"
  const user = await requireAuth()
  const scenario = await prisma.cashflowScenario.create({
    data: {
      name,
      month,
      year,
      config: { disabledSources: [], items: {} },
      createdBy: user.id,
    },
  })
  return { id: scenario.id }
}

export async function updateCashflowScenario(
  id: string,
  data: { name?: string; config?: ScenarioConfig; totalIn?: number; totalOut?: number; netFlow?: number }
): Promise<void> {
  "use server"
  await requireAuth()
  await prisma.cashflowScenario.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.config !== undefined && { config: data.config as any }),
      ...(data.totalIn !== undefined && { totalIn: data.totalIn }),
      ...(data.totalOut !== undefined && { totalOut: data.totalOut }),
      ...(data.netFlow !== undefined && { netFlow: data.netFlow }),
    },
  })
}

export async function deleteCashflowScenario(id: string): Promise<void> {
  "use server"
  await requireAuth()
  await prisma.cashflowScenario.delete({ where: { id } })
}
```

**Step 2: Add getCashflowActualData server action**

Append below the scenario CRUD:

```typescript
// ─── AKTUAL DATA ───────────────────────────────────────────────
export interface ActualCashflowItem {
  id: string
  date: string
  description: string
  amount: number
  totalAmount: number | null  // original full amount for partial payments
  direction: "IN" | "OUT"
  category: string
  source: string              // e.g., "SO-001", "INV-001"
  status: "LUNAS" | "SEBAGIAN"
  paidPercentage: number      // 0-100
  glAccountCode: string | null
  glAccountName: string | null
}

export interface CashflowActualData {
  actualItems: ActualCashflowItem[]
  startingBalance: number
  summary: {
    totalIn: number
    totalOut: number
    net: number
    endBalance: number
  }
  lastMonthRef: { totalIn: number; totalOut: number; net: number; count: number } | null
}

export async function getCashflowActualData(month: number, year: number): Promise<CashflowActualData> {
  "use server"
  await requireAuth()

  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0, 23, 59, 59)

  // 1. Posted journal entries (same as current RIIL logic)
  const postedJournals = await prisma.journalEntry.findMany({
    where: {
      date: { gte: startDate, lte: endDate },
      status: "POSTED",
    },
    include: {
      lines: { include: { account: true } },
    },
    orderBy: { date: "asc" },
  })

  const actualItems: ActualCashflowItem[] = []

  // Process posted journals into actual items
  for (const je of postedJournals) {
    for (const line of je.lines) {
      // Only include bank/cash accounts (code starts with "10" or "11")
      const code = line.account.code
      if (!code.startsWith("10") && !code.startsWith("11")) continue

      const isDebit = Number(line.debit) > 0
      actualItems.push({
        id: `je-${je.id}-${line.id}`,
        date: je.date.toISOString().slice(0, 10),
        description: je.description || line.description || "",
        amount: isDebit ? Number(line.debit) : Number(line.credit),
        totalAmount: null,
        direction: isDebit ? "IN" : "OUT",
        category: categorizeJournalEntry(je, line),
        source: je.reference || je.id,
        status: "LUNAS",
        paidPercentage: 100,
        glAccountCode: code,
        glAccountName: line.account.name,
      })
    }
  }

  // 2. Partial AR invoices — paid amount < total
  const partialAR = await prisma.invoice.findMany({
    where: {
      type: "INV_OUT",
      dueDate: { gte: startDate, lte: endDate },
      status: { in: ["PARTIAL"] },
    },
    include: { payments: true },
  })

  for (const inv of partialAR) {
    const paid = inv.payments.reduce((sum, p) => sum + Number(p.amount), 0)
    const total = Number(inv.totalAmount)
    if (paid > 0) {
      actualItems.push({
        id: `ar-partial-${inv.id}`,
        date: inv.dueDate?.toISOString().slice(0, 10) ?? inv.createdAt.toISOString().slice(0, 10),
        description: `Piutang ${inv.invoiceNumber}`,
        amount: paid,
        totalAmount: total,
        direction: "IN",
        category: "AR_INVOICE",
        source: inv.invoiceNumber,
        status: "SEBAGIAN",
        paidPercentage: Math.round((paid / total) * 100),
        glAccountCode: null,
        glAccountName: null,
      })
    }
  }

  // 3. Partial AP bills
  const partialAP = await prisma.invoice.findMany({
    where: {
      type: "INV_IN",
      dueDate: { gte: startDate, lte: endDate },
      status: { in: ["PARTIAL"] },
    },
    include: { payments: true },
  })

  for (const bill of partialAP) {
    const paid = bill.payments.reduce((sum, p) => sum + Number(p.amount), 0)
    const total = Number(bill.totalAmount)
    if (paid > 0) {
      actualItems.push({
        id: `ap-partial-${bill.id}`,
        date: bill.dueDate?.toISOString().slice(0, 10) ?? bill.createdAt.toISOString().slice(0, 10),
        description: `Hutang ${bill.invoiceNumber}`,
        amount: paid,
        totalAmount: total,
        direction: "OUT",
        category: "AP_BILL",
        source: bill.invoiceNumber,
        status: "SEBAGIAN",
        paidPercentage: Math.round((paid / total) * 100),
        glAccountCode: null,
        glAccountName: null,
      })
    }
  }

  // 4. Starting balance — sum of bank/cash GL accounts at start of month
  const startingBalance = await getStartingBalance(year, month)

  // 5. Summary
  const totalIn = actualItems.filter(i => i.direction === "IN").reduce((s, i) => s + i.amount, 0)
  const totalOut = actualItems.filter(i => i.direction === "OUT").reduce((s, i) => s + i.amount, 0)

  // 6. Last month ref
  const lastMonthRef = await getLastMonthRef(month, year)

  return {
    actualItems,
    startingBalance,
    summary: {
      totalIn,
      totalOut,
      net: totalIn - totalOut,
      endBalance: startingBalance + totalIn - totalOut,
    },
    lastMonthRef,
  }
}

// Helper to categorize journal entries by looking at linked invoices, POs, payroll
function categorizeJournalEntry(je: any, line: any): string {
  const desc = (je.description || "").toLowerCase()
  if (desc.includes("gaji") || desc.includes("payroll")) return "PAYROLL"
  if (desc.includes("bpjs")) return "BPJS"
  if (desc.includes("kas kecil") || desc.includes("petty")) return "PETTY_CASH"
  if (desc.includes("pinjaman") || desc.includes("loan")) return "LOAN_REPAYMENT"
  if (desc.includes("modal") || desc.includes("capital")) return "FUNDING_CAPITAL"
  // Default based on direction
  return Number(line.debit) > 0 ? "AR_INVOICE" : "AP_BILL"
}
```

**Step 3: Modify getCashflowPlanData to support all-status mode**

In `getCashflowPlanData()` (line ~607), add an optional parameter `allStatuses?: boolean`. When `true`, the PO/SO/AR/AP fetch functions should include draft and pending statuses. This requires modifying:
- `getARItems()` (line 105) — remove `status` filter when allStatuses
- `getAPItems()` (line 134) — remove `status` filter when allStatuses
- `getPOItems()` (line 163) — include DRAFT and PENDING_APPROVAL when allStatuses
- Add `getSOItems()` function for sales orders (currently missing)
- Add `getWOCostItems()` to include PLANNED status

Update the function signature:
```typescript
export async function getCashflowPlanData(month: number, year: number, allStatuses: boolean = false): Promise<CashflowPlanData>
```

Pass `allStatuses` down to each sub-function.

**Step 4: Commit**

```bash
git add lib/actions/finance-cashflow.ts
git commit -m "feat(cashflow): add scenario CRUD + actual data + all-status mode for simulasi"
```

---

## Task 3: API Routes — Actual Data + Scenarios

**Files:**
- Create: `app/api/finance/cashflow-actual/route.ts`
- Create: `app/api/finance/cashflow-scenarios/route.ts`
- Create: `app/api/finance/cashflow-scenarios/[id]/route.ts`
- Modify: `app/api/finance/cashflow-plan/route.ts` (add allStatuses param)

**Step 1: Create actual data API route**

```typescript
// app/api/finance/cashflow-actual/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getCashflowActualData } from "@/lib/actions/finance-cashflow"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1))
    const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()))

    if (month < 1 || month > 12 || year < 2020 || year > 2100) {
      return NextResponse.json({ success: false, error: "Invalid month/year" }, { status: 400 })
    }

    const data = await getCashflowActualData(month, year)
    return NextResponse.json({ success: true, ...data })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error"
    const status = message === "Unauthorized" ? 401 : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
```

**Step 2: Create scenarios API route**

```typescript
// app/api/finance/cashflow-scenarios/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getCashflowScenarios, createCashflowScenario } from "@/lib/actions/finance-cashflow"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1))
    const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()))
    const data = await getCashflowScenarios(month, year)
    return NextResponse.json({ success: true, scenarios: data })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, month, year } = body
    if (!name || !month || !year) {
      return NextResponse.json({ success: false, error: "Missing name, month, or year" }, { status: 400 })
    }
    const result = await createCashflowScenario(name, month, year)
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
```

**Step 3: Create scenario detail API route**

```typescript
// app/api/finance/cashflow-scenarios/[id]/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getCashflowScenario, updateCashflowScenario, deleteCashflowScenario } from "@/lib/actions/finance-cashflow"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const data = await getCashflowScenario(id)
    if (!data) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 })
    return NextResponse.json({ success: true, scenario: data })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    await updateCashflowScenario(id, body)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await deleteCashflowScenario(id)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
```

**Step 4: Modify cashflow-plan route to accept allStatuses**

In `app/api/finance/cashflow-plan/route.ts`, add:
```typescript
const allStatuses = searchParams.get("allStatuses") === "true"
const data = await getCashflowPlanData(month, year, allStatuses)
```

**Step 5: Commit**

```bash
git add app/api/finance/cashflow-actual/ app/api/finance/cashflow-scenarios/ app/api/finance/cashflow-plan/route.ts
git commit -m "feat(cashflow): add API routes for actual data and scenario CRUD"
```

---

## Task 4: TanStack Query Hooks — Scenarios + Actual

**Files:**
- Create: `hooks/use-cashflow-scenarios.ts`
- Create: `hooks/use-cashflow-actual.ts`
- Modify: `hooks/use-cashflow-plan.ts` (add allStatuses option)
- Modify: `lib/query-keys.ts:375` (add scenario + actual keys)

**Step 1: Add query keys**

In `lib/query-keys.ts`, add after the `cashflowAccuracy` block (line ~385):

```typescript
cashflowScenarios: {
  all: ["cashflowScenarios"] as const,
  list: (month: number, year: number) => [...["cashflowScenarios"], "list", month, year] as const,
  detail: (id: string) => [...["cashflowScenarios"], "detail", id] as const,
},
cashflowActual: {
  all: ["cashflowActual"] as const,
  list: (month: number, year: number) => [...["cashflowActual"], "list", month, year] as const,
},
```

**Step 2: Create scenarios hook**

```typescript
// hooks/use-cashflow-scenarios.ts
"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import type { CashflowScenarioSummary, CashflowScenarioFull, ScenarioConfig } from "@/lib/actions/finance-cashflow"

export function useCashflowScenarios(month: number, year: number) {
  return useQuery<CashflowScenarioSummary[]>({
    queryKey: queryKeys.cashflowScenarios.list(month, year),
    queryFn: async () => {
      const res = await fetch(`/api/finance/cashflow-scenarios?month=${month}&year=${year}`)
      if (!res.ok) throw new Error("Failed to fetch scenarios")
      const json = await res.json()
      return json.scenarios ?? []
    },
  })
}

export function useCashflowScenario(id: string | null) {
  return useQuery<CashflowScenarioFull | null>({
    queryKey: queryKeys.cashflowScenarios.detail(id ?? ""),
    queryFn: async () => {
      if (!id) return null
      const res = await fetch(`/api/finance/cashflow-scenarios/${id}`)
      if (!res.ok) throw new Error("Failed to fetch scenario")
      const json = await res.json()
      return json.scenario ?? null
    },
    enabled: !!id,
  })
}

export function useCreateScenario(month: number, year: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/api/finance/cashflow-scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, month, year }),
      })
      if (!res.ok) throw new Error("Failed to create scenario")
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.cashflowScenarios.list(month, year) })
    },
  })
}

export function useSaveScenario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; config?: ScenarioConfig; totalIn?: number; totalOut?: number; netFlow?: number }) => {
      const res = await fetch(`/api/finance/cashflow-scenarios/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error("Failed to save scenario")
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.cashflowScenarios.all })
      qc.invalidateQueries({ queryKey: queryKeys.cashflowScenarios.detail(vars.id) })
    },
  })
}

export function useDeleteScenario(month: number, year: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/finance/cashflow-scenarios/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete scenario")
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.cashflowScenarios.list(month, year) })
    },
  })
}
```

**Step 3: Create actual data hook**

```typescript
// hooks/use-cashflow-actual.ts
"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import type { CashflowActualData } from "@/lib/actions/finance-cashflow"

export function useCashflowActual(month: number, year: number) {
  return useQuery<CashflowActualData>({
    queryKey: queryKeys.cashflowActual.list(month, year),
    queryFn: async () => {
      const res = await fetch(`/api/finance/cashflow-actual?month=${month}&year=${year}`)
      if (!res.ok) throw new Error("Failed to fetch actual cashflow")
      const json = await res.json()
      return json as CashflowActualData
    },
  })
}
```

**Step 4: Add allStatuses to useCashflowPlan**

In `hooks/use-cashflow-plan.ts`, modify `useCashflowPlan`:

```typescript
export function useCashflowPlan(month: number, year: number, allStatuses: boolean = false) {
  return useQuery<CashflowPlanData>({
    queryKey: [...queryKeys.cashflowPlan.list(month, year), allStatuses],
    queryFn: async () => {
      const res = await fetch(`/api/finance/cashflow-plan?month=${month}&year=${year}&allStatuses=${allStatuses}`)
      if (!res.ok) throw new Error("Failed to fetch cashflow plan")
      return res.json() as Promise<CashflowPlanData>
    },
  })
}
```

**Step 5: Commit**

```bash
git add hooks/use-cashflow-scenarios.ts hooks/use-cashflow-actual.ts hooks/use-cashflow-plan.ts lib/query-keys.ts
git commit -m "feat(cashflow): add TanStack Query hooks for scenarios and actual data"
```

---

## Task 5: Shared Components — Item Row + Partial Indicator

**Files:**
- Create: `components/finance/cashflow-item-row.tsx`
- Create: `components/finance/cashflow-partial-indicator.tsx`

**Step 1: Create partial payment indicator**

```typescript
// components/finance/cashflow-partial-indicator.tsx
"use client"

import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils"

interface PartialIndicatorProps {
  paidAmount: number
  totalAmount: number
  percentage: number
}

export function CashflowPartialIndicator({ paidAmount, totalAmount, percentage }: PartialIndicatorProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5 text-xs">
        <span className="font-medium">{formatCurrency(paidAmount)}</span>
        <span className="text-zinc-400">/</span>
        <span className="text-zinc-500">{formatCurrency(totalAmount)}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="h-1.5 w-16 rounded-full bg-zinc-200 overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              percentage >= 100 ? "bg-emerald-500" : percentage >= 50 ? "bg-amber-500" : "bg-red-400"
            )}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
        <span className={cn(
          "text-[10px] font-medium",
          percentage >= 100 ? "text-emerald-600" : "text-amber-600"
        )}>
          {percentage}%
        </span>
      </div>
    </div>
  )
}
```

**Step 2: Create cashflow item row component**

This is a shared row component used in both SIMULASI (with checkbox + editable amount) and AKTUAL (read-only with partial indicator).

```typescript
// components/finance/cashflow-item-row.tsx
"use client"

import { useState, useCallback } from "react"
import { cn, formatCurrency } from "@/lib/utils"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { CashflowPartialIndicator } from "./cashflow-partial-indicator"
import { IconPencil } from "@tabler/icons-react"

// Category color map (same as existing cashflow-planning-board.tsx)
const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string; label: string }> = {
  AR_INVOICE:        { bg: "bg-emerald-50", border: "border-l-emerald-500", text: "text-emerald-700", label: "Piutang" },
  AP_BILL:           { bg: "bg-orange-50",  border: "border-l-orange-500",  text: "text-orange-700",  label: "Hutang" },
  PO_DIRECT:         { bg: "bg-amber-50",   border: "border-l-amber-500",   text: "text-amber-700",   label: "PO" },
  PAYROLL:           { bg: "bg-blue-50",    border: "border-l-blue-500",    text: "text-blue-700",    label: "Gaji" },
  BPJS:              { bg: "bg-indigo-50",  border: "border-l-indigo-500",  text: "text-indigo-700",  label: "BPJS" },
  PETTY_CASH:        { bg: "bg-slate-50",   border: "border-l-slate-500",   text: "text-slate-700",   label: "Kas Kecil" },
  RECURRING_JOURNAL: { bg: "bg-purple-50",  border: "border-l-purple-500",  text: "text-purple-700",  label: "Berulang" },
  BUDGET_ALLOCATION: { bg: "bg-blue-50",    border: "border-l-blue-500",    text: "text-blue-700",    label: "Anggaran" },
  WO_COST:           { bg: "bg-rose-50",    border: "border-l-rose-500",    text: "text-rose-700",    label: "Produksi" },
  LOAN_REPAYMENT:    { bg: "bg-red-50",     border: "border-l-red-500",     text: "text-red-700",     label: "Pinjaman" },
  LOAN_DISBURSEMENT: { bg: "bg-teal-50",    border: "border-l-teal-500",    text: "text-teal-700",    label: "Pencairan" },
  FUNDING_CAPITAL:   { bg: "bg-teal-50",    border: "border-l-teal-500",    text: "text-teal-700",    label: "Modal" },
  EQUITY_WITHDRAWAL: { bg: "bg-red-50",     border: "border-l-red-500",     text: "text-red-700",     label: "Prive" },
  MANUAL:            { bg: "bg-zinc-50",    border: "border-l-zinc-500",    text: "text-zinc-700",    label: "Manual" },
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  DRAFT:             { bg: "bg-zinc-100",   text: "text-zinc-600" },
  PENDING:           { bg: "bg-yellow-100", text: "text-yellow-700" },
  PENDING_APPROVAL:  { bg: "bg-yellow-100", text: "text-yellow-700" },
  APPROVED:          { bg: "bg-emerald-100",text: "text-emerald-700" },
  CONFIRMED:         { bg: "bg-emerald-100",text: "text-emerald-700" },
  ORDERED:           { bg: "bg-blue-100",   text: "text-blue-700" },
  RECEIVED:          { bg: "bg-emerald-100",text: "text-emerald-700" },
  COMPLETED:         { bg: "bg-emerald-100",text: "text-emerald-700" },
  LUNAS:             { bg: "bg-emerald-100",text: "text-emerald-700" },
  SEBAGIAN:          { bg: "bg-amber-100",  text: "text-amber-700" },
}

interface CashflowItemRowProps {
  id: string
  description: string
  amount: number
  direction: "IN" | "OUT"
  category: string
  status?: string
  source?: string
  // Simulasi mode
  simulasi?: boolean
  enabled?: boolean
  overrideAmount?: number | null
  onToggle?: (id: string, enabled: boolean) => void
  onAmountChange?: (id: string, amount: number) => void
  // Aktual mode — partial
  totalAmount?: number | null
  paidPercentage?: number
}

export function CashflowItemRow({
  id, description, amount, direction, category, status, source,
  simulasi = false, enabled = true, overrideAmount, onToggle, onAmountChange,
  totalAmount, paidPercentage,
}: CashflowItemRowProps) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState("")
  const colors = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.MANUAL
  const statusColor = status ? STATUS_COLORS[status] ?? STATUS_COLORS.DRAFT : null
  const displayAmount = overrideAmount ?? amount
  const isPartial = totalAmount != null && paidPercentage != null && paidPercentage < 100

  const handleEdit = useCallback(() => {
    setEditValue(String(displayAmount))
    setEditing(true)
  }, [displayAmount])

  const handleSave = useCallback(() => {
    const parsed = parseFloat(editValue.replace(/[^0-9.]/g, ""))
    if (!isNaN(parsed) && parsed >= 0) {
      onAmountChange?.(id, parsed)
    }
    setEditing(false)
  }, [editValue, id, onAmountChange])

  return (
    <div className={cn(
      "flex items-center gap-2 px-2 py-1.5 rounded border-l-3 text-xs",
      colors.bg, colors.border,
      !enabled && simulasi && "opacity-40 line-through"
    )}>
      {simulasi && (
        <Checkbox
          checked={enabled}
          onCheckedChange={(checked) => onToggle?.(id, !!checked)}
          className="h-3.5 w-3.5"
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={cn("font-medium truncate", colors.text)}>{description}</span>
          {source && <span className="text-zinc-400 text-[10px]">{source}</span>}
        </div>
        {isPartial && !simulasi && (
          <CashflowPartialIndicator
            paidAmount={displayAmount}
            totalAmount={totalAmount!}
            percentage={paidPercentage!}
          />
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {statusColor && status && (
          <Badge variant="outline" className={cn("text-[10px] h-4 px-1", statusColor.bg, statusColor.text)}>
            {status}
          </Badge>
        )}
        <Badge variant="outline" className={cn("text-[10px] h-4 px-1", colors.bg, colors.text)}>
          {colors.label}
        </Badge>
        {simulasi && editing ? (
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            className="w-24 h-6 text-xs text-right"
            autoFocus
          />
        ) : (
          <span className={cn(
            "font-mono font-medium text-right w-24",
            direction === "IN" ? "text-emerald-700" : "text-red-600"
          )}>
            {direction === "IN" ? "+" : "-"}{formatCurrency(displayAmount)}
          </span>
        )}
        {simulasi && !editing && (
          <button onClick={handleEdit} className="p-0.5 hover:bg-zinc-200 rounded">
            <IconPencil size={12} className="text-zinc-400" />
          </button>
        )}
      </div>
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add components/finance/cashflow-item-row.tsx components/finance/cashflow-partial-indicator.tsx
git commit -m "feat(cashflow): add shared item row and partial payment indicator components"
```

---

## Task 6: SIMULASI Sidebar Component

**Files:**
- Create: `components/finance/cashflow-simulasi-sidebar.tsx`
- Create: `components/finance/cashflow-scenario-dialog.tsx`

**Step 1: Create scenario dialog (create/rename)**

```typescript
// components/finance/cashflow-scenario-dialog.tsx
"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { dialogStyles } from "@/lib/dialog-styles"

interface ScenarioDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (name: string) => void
  initialName?: string
  mode: "create" | "rename"
}

export function CashflowScenarioDialog({ open, onOpenChange, onSave, initialName = "", mode }: ScenarioDialogProps) {
  const [name, setName] = useState(initialName)

  const handleSave = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    onSave(trimmed)
    setName("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={dialogStyles.content}>
        <DialogHeader>
          <DialogTitle className={dialogStyles.title}>
            {mode === "create" ? "Buat Skenario Baru" : "Ubah Nama Skenario"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Nama Skenario</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder="Optimis..."
              className="placeholder:text-zinc-300"
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            {mode === "create" ? "Buat" : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

**Step 2: Create simulasi sidebar**

```typescript
// components/finance/cashflow-simulasi-sidebar.tsx
"use client"

import { useState } from "react"
import { cn, formatCurrency } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { CashflowScenarioDialog } from "./cashflow-scenario-dialog"
import { IconPlus, IconDotsVertical, IconTrash, IconPencil } from "@tabler/icons-react"
import type { CashflowScenarioSummary } from "@/lib/actions/finance-cashflow"

const SOURCE_LABELS: Record<string, string> = {
  AR_INVOICE: "Piutang (AR)",
  AP_BILL: "Hutang (AP)",
  PO_DIRECT: "Purchase Order",
  PAYROLL: "Gaji Karyawan",
  BPJS: "BPJS",
  PETTY_CASH: "Peti Kas",
  WO_COST: "Biaya Produksi",
  LOAN_REPAYMENT: "Cicilan Pinjaman",
  LOAN_DISBURSEMENT: "Pencairan Pinjaman",
  FUNDING_CAPITAL: "Modal Masuk",
  EQUITY_WITHDRAWAL: "Prive",
  RECURRING_JOURNAL: "Jurnal Berulang",
  BUDGET_ALLOCATION: "Anggaran",
  MANUAL: "Manual",
}

const ALL_SOURCES = Object.keys(SOURCE_LABELS)

interface SimulasiSidebarProps {
  scenarios: CashflowScenarioSummary[]
  activeScenarioId: string | null
  disabledSources: string[]
  onSelectScenario: (id: string) => void
  onCreateScenario: (name: string) => void
  onRenameScenario: (id: string, name: string) => void
  onDeleteScenario: (id: string) => void
  onToggleSource: (source: string) => void
}

export function CashflowSimulasiSidebar({
  scenarios, activeScenarioId, disabledSources,
  onSelectScenario, onCreateScenario, onRenameScenario, onDeleteScenario, onToggleSource,
}: SimulasiSidebarProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<"create" | "rename">("create")
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameName, setRenameName] = useState("")

  const handleCreate = () => {
    setDialogMode("create")
    setRenameName("")
    setDialogOpen(true)
  }

  const handleRename = (id: string, currentName: string) => {
    setDialogMode("rename")
    setRenameId(id)
    setRenameName(currentName)
    setDialogOpen(true)
  }

  const handleDialogSave = (name: string) => {
    if (dialogMode === "create") {
      onCreateScenario(name)
    } else if (renameId) {
      onRenameScenario(renameId, name)
    }
  }

  return (
    <div className="w-[260px] shrink-0 border-r-2 border-black bg-zinc-50 flex flex-col h-full overflow-y-auto">
      {/* Skenario Section */}
      <div className="p-3 border-b border-zinc-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-zinc-500">Skenario</h3>
          <Button size="sm" variant="ghost" className="h-6 px-1.5" onClick={handleCreate}>
            <IconPlus size={14} />
          </Button>
        </div>
        <div className="space-y-1">
          {scenarios.length === 0 && (
            <p className="text-xs text-zinc-400 italic">Belum ada skenario</p>
          )}
          {scenarios.map((s) => (
            <div
              key={s.id}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer text-xs group",
                activeScenarioId === s.id
                  ? "bg-emerald-100 border border-emerald-300 font-medium"
                  : "hover:bg-zinc-100 border border-transparent"
              )}
              onClick={() => onSelectScenario(s.id)}
            >
              <div className="flex-1 min-w-0">
                <div className="truncate">{s.name}</div>
                <div className="text-[10px] text-zinc-400">
                  Net {formatCurrency(s.netFlow)}
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-0.5 opacity-0 group-hover:opacity-100 hover:bg-zinc-200 rounded"
                    onClick={(e) => e.stopPropagation()}>
                    <IconDotsVertical size={12} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleRename(s.id, s.name)}>
                    <IconPencil size={14} className="mr-1.5" /> Ubah Nama
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-red-600" onClick={() => onDeleteScenario(s.id)}>
                    <IconTrash size={14} className="mr-1.5" /> Hapus
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      </div>

      {/* Sumber Section */}
      <div className="p-3 flex-1">
        <h3 className="text-xs font-bold uppercase tracking-wide text-zinc-500 mb-2">Sumber Data</h3>
        <div className="space-y-1.5">
          {ALL_SOURCES.map((source) => (
            <label key={source} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-zinc-100 px-1.5 py-1 rounded">
              <Checkbox
                checked={!disabledSources.includes(source)}
                onCheckedChange={() => onToggleSource(source)}
                className="h-3.5 w-3.5"
              />
              <span>{SOURCE_LABELS[source]}</span>
            </label>
          ))}
        </div>
      </div>

      <CashflowScenarioDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleDialogSave}
        initialName={renameName}
        mode={dialogMode}
      />
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add components/finance/cashflow-simulasi-sidebar.tsx components/finance/cashflow-scenario-dialog.tsx
git commit -m "feat(cashflow): add simulasi sidebar with scenario list and source toggles"
```

---

## Task 7: SIMULASI Board Component

**Files:**
- Create: `components/finance/cashflow-simulasi-board.tsx`

This is the main area for the SIMULASI page. Extract and adapt the weekly breakdown logic from the existing `cashflow-planning-board.tsx` (lines 106-134 for getWeeks/getItemsForWeek/calcWeekTotals, lines 550-680 for week card rendering).

**Key differences from existing board:**
- Each item row uses `CashflowItemRow` with `simulasi={true}`
- Items have checkboxes and editable amounts
- Source filter applied from sidebar's `disabledSources`
- Scenario config overlay: disabled items and overridden amounts
- Live recalculation of KPIs on any toggle/edit (client-side only, no server call)
- "Simpan" button saves current state to active scenario

**Step 1:** Extract shared helper functions (`getWeeks`, `getItemsForWeek`, `calcWeekTotals`) from `cashflow-planning-board.tsx` into a new `lib/cashflow-helpers.ts` so both boards can reuse them.

**Step 2:** Build `CashflowSimulasiBoard` component using the shared helpers + `CashflowItemRow` with simulasi mode. Include the KPI strip, week cards, summary bar, and proyeksi strip. Wire up local state for `itemStates: Record<string, { enabled: boolean; overrideAmount: number | null }>` that gets populated from scenario config on load and synced on save.

**Step 3: Commit**

```bash
git add components/finance/cashflow-simulasi-board.tsx lib/cashflow-helpers.ts
git commit -m "feat(cashflow): add simulasi board with interactive toggles and live recalculation"
```

---

## Task 8: AKTUAL Board Component

**Files:**
- Create: `components/finance/cashflow-aktual-board.tsx`

Full-width, read-only view. Uses the same shared helpers from `lib/cashflow-helpers.ts`.

**Key features:**
- Same KPI strip and week card layout as simulasi but full-width (no sidebar)
- Items use `CashflowItemRow` with `simulasi={false}`
- Partial payments show `CashflowPartialIndicator` with progress bar
- Status badges: LUNAS (green), SEBAGIAN (amber)
- SNAPSHOT button in header
- Bank account filter dropdown (same as current)

**Step 1:** Build `CashflowAktualBoard` consuming `CashflowActualData` from the hook.

**Step 2: Commit**

```bash
git add components/finance/cashflow-aktual-board.tsx
git commit -m "feat(cashflow): add aktual board with partial payment indicators"
```

---

## Task 9: Pages — Landing + Simulasi + Aktual

**Files:**
- Modify: `app/finance/planning/page.tsx` (becomes landing/redirect)
- Create: `app/finance/planning/simulasi/page.tsx`
- Create: `app/finance/planning/aktual/page.tsx`
- Create: `app/finance/planning/layout.tsx` (shared tab bar + month picker)

**Step 1: Create shared layout with tab bar**

```typescript
// app/finance/planning/layout.tsx
"use client"

import { useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { IconChevronLeft, IconChevronRight, IconCash } from "@tabler/icons-react"

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]

// Context to share month/year state across sub-pages
import { createContext, useContext } from "react"

interface PlanningContextType {
  month: number
  year: number
  setMonth: (m: number) => void
  setYear: (y: number) => void
}

export const PlanningContext = createContext<PlanningContextType>({
  month: new Date().getMonth() + 1,
  year: new Date().getFullYear(),
  setMonth: () => {},
  setYear: () => {},
})

export function usePlanningContext() {
  return useContext(PlanningContext)
}

export default function PlanningLayout({ children }: { children: React.ReactNode }) {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const pathname = usePathname()
  const router = useRouter()

  const isSimulasi = pathname.includes("/simulasi")
  const isAktual = pathname.includes("/aktual")

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  return (
    <PlanningContext.Provider value={{ month, year, setMonth, setYear }}>
      <div className="mf-page">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100 border-2 border-black">
              <IconCash size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">PERENCANAAN ARUS KAS</h1>
              <p className="text-xs text-zinc-500">Cashflow Planning by Management</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Month picker */}
            <div className="flex items-center gap-1 border-2 border-black rounded-lg px-2 py-1">
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={prevMonth}>
                <IconChevronLeft size={16} />
              </Button>
              <span className="text-sm font-bold w-28 text-center">
                {MONTHS[month - 1]} {year}
              </span>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={nextMonth}>
                <IconChevronRight size={16} />
              </Button>
            </div>

            {/* Tab bar */}
            <div className="flex border-2 border-black rounded-lg overflow-hidden">
              <button
                className={cn(
                  "px-4 py-1.5 text-sm font-bold transition-colors",
                  isSimulasi ? "bg-emerald-400 text-black" : "bg-white hover:bg-zinc-100"
                )}
                onClick={() => router.push("/finance/planning/simulasi")}
              >
                SIMULASI
              </button>
              <button
                className={cn(
                  "px-4 py-1.5 text-sm font-bold transition-colors border-l-2 border-black",
                  isAktual ? "bg-emerald-400 text-black" : "bg-white hover:bg-zinc-100"
                )}
                onClick={() => router.push("/finance/planning/aktual")}
              >
                AKTUAL
              </button>
            </div>
          </div>
        </div>

        {/* Sub-page content */}
        {children}
      </div>
    </PlanningContext.Provider>
  )
}
```

**Step 2: Update landing page to redirect**

```typescript
// app/finance/planning/page.tsx
"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function PlanningLandingPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/finance/planning/simulasi")
  }, [router])
  return null
}
```

**Step 3: Create simulasi page**

```typescript
// app/finance/planning/simulasi/page.tsx
"use client"

import { useState, useCallback } from "react"
import { usePlanningContext } from "../layout"
import { useCashflowPlan } from "@/hooks/use-cashflow-plan"
import { useCashflowScenarios, useCashflowScenario, useCreateScenario, useSaveScenario, useDeleteScenario } from "@/hooks/use-cashflow-scenarios"
import { useCashflowForecast } from "@/hooks/use-cashflow-forecast"
import { CashflowSimulasiSidebar } from "@/components/finance/cashflow-simulasi-sidebar"
import { CashflowSimulasiBoard } from "@/components/finance/cashflow-simulasi-board"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import type { ScenarioConfig } from "@/lib/actions/finance-cashflow"

export default function SimulasiPage() {
  const { month, year } = usePlanningContext()
  const { data, isLoading } = useCashflowPlan(month, year, true) // allStatuses=true
  const { data: scenarios = [] } = useCashflowScenarios(month, year)
  const { data: forecast } = useCashflowForecast(6)
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null)
  const { data: activeScenario } = useCashflowScenario(activeScenarioId)

  const createMutation = useCreateScenario(month, year)
  const saveMutation = useSaveScenario()
  const deleteMutation = useDeleteScenario(month, year)

  // Local simulation state derived from scenario config
  const [disabledSources, setDisabledSources] = useState<string[]>([])
  const [itemStates, setItemStates] = useState<Record<string, { enabled: boolean; overrideAmount: number | null }>>({})

  // Load scenario config when active scenario changes
  // (useEffect in actual implementation to sync activeScenario.config → local state)

  const handleToggleSource = useCallback((source: string) => {
    setDisabledSources(prev =>
      prev.includes(source) ? prev.filter(s => s !== source) : [...prev, source]
    )
  }, [])

  const handleToggleItem = useCallback((id: string, enabled: boolean) => {
    setItemStates(prev => ({ ...prev, [id]: { ...prev[id], enabled, overrideAmount: prev[id]?.overrideAmount ?? null } }))
  }, [])

  const handleAmountChange = useCallback((id: string, amount: number) => {
    setItemStates(prev => ({ ...prev, [id]: { enabled: prev[id]?.enabled ?? true, overrideAmount: amount } }))
  }, [])

  const handleSave = useCallback(() => {
    if (!activeScenarioId) return
    // Calculate totals from current state, then save
    saveMutation.mutate({
      id: activeScenarioId,
      config: { disabledSources, items: itemStates },
    })
  }, [activeScenarioId, disabledSources, itemStates, saveMutation])

  if (isLoading || !data) return <TablePageSkeleton accentColor="bg-emerald-400" />

  return (
    <div className="flex gap-0 border-2 border-black rounded-xl overflow-hidden mt-4" style={{ minHeight: "70vh" }}>
      <CashflowSimulasiSidebar
        scenarios={scenarios}
        activeScenarioId={activeScenarioId}
        disabledSources={disabledSources}
        onSelectScenario={setActiveScenarioId}
        onCreateScenario={(name) => createMutation.mutate(name)}
        onRenameScenario={(id, name) => saveMutation.mutate({ id, name })}
        onDeleteScenario={(id) => deleteMutation.mutate(id)}
        onToggleSource={handleToggleSource}
      />
      <CashflowSimulasiBoard
        data={data}
        forecast={forecast}
        disabledSources={disabledSources}
        itemStates={itemStates}
        onToggleItem={handleToggleItem}
        onAmountChange={handleAmountChange}
        onSave={handleSave}
        isSaving={saveMutation.isPending}
        hasActiveScenario={!!activeScenarioId}
      />
    </div>
  )
}
```

**Step 4: Create aktual page**

```typescript
// app/finance/planning/aktual/page.tsx
"use client"

import { usePlanningContext } from "../layout"
import { useCashflowActual } from "@/hooks/use-cashflow-actual"
import { useCashflowForecast } from "@/hooks/use-cashflow-forecast"
import { CashflowAktualBoard } from "@/components/finance/cashflow-aktual-board"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"

export default function AktualPage() {
  const { month, year } = usePlanningContext()
  const { data, isLoading } = useCashflowActual(month, year)
  const { data: forecast } = useCashflowForecast(6)

  if (isLoading || !data) return <TablePageSkeleton accentColor="bg-emerald-400" />

  return (
    <div className="mt-4">
      <CashflowAktualBoard
        data={data}
        month={month}
        year={year}
        forecast={forecast}
      />
    </div>
  )
}
```

**Step 5: Update nav prefetch**

In `hooks/use-nav-prefetch.ts` (line ~484), update the `/finance/planning` route to prefetch both simulasi and actual data, and add sub-routes:

```typescript
"/finance/planning": { /* redirect, no prefetch needed */ },
"/finance/planning/simulasi": {
  queryKey: [...queryKeys.cashflowPlan.list(m, y), true],
  queryFn: async () => {
    const res = await fetch(`/api/finance/cashflow-plan?month=${m}&year=${y}&allStatuses=true`)
    return res.json()
  },
},
"/finance/planning/aktual": {
  queryKey: queryKeys.cashflowActual.list(m, y),
  queryFn: async () => {
    const res = await fetch(`/api/finance/cashflow-actual?month=${m}&year=${y}`)
    return res.json()
  },
},
```

**Step 6: Commit**

```bash
git add app/finance/planning/ hooks/use-nav-prefetch.ts
git commit -m "feat(cashflow): add simulasi + aktual pages with shared layout and tab navigation"
```

---

## Task 10: Integration Testing + Cleanup

**Files:**
- Create: `__tests__/cashflow-scenarios.test.ts`
- Modify: `components/finance/cashflow-planning-board.tsx` (mark deprecated or remove if fully replaced)

**Step 1: Write tests for scenario CRUD**

Test `createCashflowScenario`, `getCashflowScenarios`, `updateCashflowScenario`, `deleteCashflowScenario` with mock Prisma.

**Step 2: Write tests for actual data filtering**

Test `getCashflowActualData` verifying:
- Only POSTED journals included
- Partial AR/AP shows correct amounts and percentages
- Starting balance calculated correctly

**Step 3: Write tests for simulasi state logic**

Test the overlay logic:
- Disabled sources filter out items
- Item toggle sets enabled/disabled
- Override amount replaces original
- Summary recalculates correctly

**Step 4: Run full test suite**

Run: `npx vitest`
Expected: All existing tests pass + new tests pass.

**Step 5: Verify build**

Run: `npm run build`
Expected: Build succeeds.

**Step 6: Cleanup old references**

- Update sidebar nav if needed (the link should still go to `/finance/planning`)
- Remove or deprecate the old `viewMode` state in `cashflow-planning-board.tsx` if no longer used
- Update `app-sidebar.tsx` if the menu label needs changing

**Step 7: Final commit**

```bash
git add __tests__/ components/finance/cashflow-planning-board.tsx
git commit -m "test(cashflow): add scenario CRUD and actual data filtering tests"
```

---

## Task Summary

| Task | Description | Dependencies |
|------|-------------|-------------|
| 1 | Prisma schema — CashflowScenario model | None |
| 2 | Server actions — Scenario CRUD + actual data | Task 1 |
| 3 | API routes — actual, scenarios, allStatuses | Task 2 |
| 4 | TanStack hooks — scenarios, actual, allStatuses | Task 3 |
| 5 | Shared components — item row + partial indicator | None |
| 6 | Simulasi sidebar — scenario list + source toggles | Task 5 |
| 7 | Simulasi board — interactive weekly breakdown | Tasks 5, 6 |
| 8 | Aktual board — read-only with partial indicators | Task 5 |
| 9 | Pages — landing + simulasi + aktual + layout | Tasks 4, 7, 8 |
| 10 | Tests + cleanup | Task 9 |
