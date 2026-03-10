# Cashflow Planning Board — Swim-Lane Redesign

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the boring forecast page and separate planning page with a single unified Weekly Swim-Lane Planning Board.

**Architecture:** Rewrite `cashflow-planning-board.tsx` as a swim-lane board with 4 weekly columns. Each column shows cashflow items as cards in green (masuk) / red (keluar) zones. Merge forecast + planning into `/finance/planning`. Redirect old forecast URL. Update sidebar nav.

**Tech Stack:** React 19, TanStack Query, Tailwind CSS v4, shadcn/ui, Tabler Icons, existing cashflow API (no backend changes)

---

### Task 1: Update Sidebar Nav + Add Redirect

**Files:**
- Modify: `lib/sidebar-nav-data.ts` (line ~107)
- Modify: `app/finance/cashflow-forecast/page.tsx` (full file)

**Step 1: Update sidebar link**

In `lib/sidebar-nav-data.ts`, change the Proyeksi Arus Kas entry:

```typescript
// FROM:
{ title: "Proyeksi Arus Kas", url: "/finance/cashflow-forecast" },
// TO:
{ title: "Perencanaan Arus Kas", url: "/finance/planning" },
```

**Step 2: Redirect old forecast page**

Replace `app/finance/cashflow-forecast/page.tsx` with a redirect:

```typescript
import { redirect } from "next/navigation"

export default function CashflowForecastRedirect() {
    redirect("/finance/planning")
}
```

**Step 3: Verify** — run `npx tsc --noEmit 2>&1 | grep -E "(sidebar|cashflow-forecast)"` — no new errors

---

### Task 2: Rewrite Planning Page

**Files:**
- Modify: `app/finance/planning/page.tsx`

**Step 1: Update page to fetch both plan + forecast data**

```typescript
"use client"

import { useState } from "react"
import { useCashflowPlan, useAccuracyTrend } from "@/hooks/use-cashflow-plan"
import { useCashflowForecast } from "@/hooks/use-cashflow-forecast"
import { CashflowPlanningBoard } from "@/components/finance/cashflow-planning-board"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"

export const dynamic = "force-dynamic"

export default function CashflowPlanningPage() {
    const now = new Date()
    const [month, setMonth] = useState(now.getMonth() + 1)
    const [year, setYear] = useState(now.getFullYear())
    const { data, isLoading } = useCashflowPlan(month, year)
    const { data: accuracyTrend } = useAccuracyTrend(3)
    const { data: forecast } = useCashflowForecast(6)

    if (isLoading || !data) return <TablePageSkeleton accentColor="bg-emerald-400" />

    return (
        <div className="mf-page">
            <CashflowPlanningBoard
                data={data}
                month={month}
                year={year}
                onMonthChange={setMonth}
                onYearChange={setYear}
                accuracyTrend={accuracyTrend}
                forecast={forecast}
            />
        </div>
    )
}
```

---

### Task 3: Rewrite CashflowPlanningBoard — Top Strip

**Files:**
- Modify: `components/finance/cashflow-planning-board.tsx` — full rewrite

**Design:**
- Cash position strip with total balance, cash runway, bank pills
- Month navigator + action buttons
- Planning/Riil segmented toggle

This is the top ~150 lines of the new component. The component accepts the same props as before plus optional `forecast` data.

---

### Task 4: Rewrite CashflowPlanningBoard — Weekly Swim-Lane Grid

**Design:**
- 4 columns for weeks 1-4
- Each column: Kas Masuk cards (top, green zone) + Kas Keluar cards (bottom, red zone)
- Cards show: category badge, amount, description, bank tag
- Solid border = riil, dashed = estimasi
- Column footer with weekly totals + running balance
- Current week highlighted

Helper functions:
- `getWeekItems(items, weekStart, weekEnd)` — filter items by date range
- `getWeekNumber(date)` — determine which week column a date falls in

---

### Task 5: Rewrite CashflowPlanningBoard — Summary Bar + Accuracy Section

**Design:**
- Horizontal summary bar: Saldo Awal | Total Masuk | Total Keluar | Net | Saldo Akhir
- Collapsible accuracy section with variance table + trend bars
- Create/Edit item dialog (reuse existing CreateCashflowItemDialog)
- Override saldo awal dialog (reuse existing logic)

---

### Task 6: Verify & Clean Up

**Step 1:** Run `npx tsc --noEmit 2>&1 | grep -E "(cashflow|planning)"` — no errors
**Step 2:** Run `npx vitest run __tests__/finance/` — all passing
**Step 3:** Manual check: navigate to `/finance/planning` and `/finance/cashflow-forecast` (should redirect)
**Step 4:** Check sidebar shows "Perencanaan Arus Kas" pointing to `/finance/planning`
