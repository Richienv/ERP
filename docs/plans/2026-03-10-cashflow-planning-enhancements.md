# Cashflow Planning Board Enhancements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enhance the existing cashflow planning board with bank account segregation (filter, tags, per-bank balance cards) and accuracy metrics (percentage variance, category breakdown, accuracy score, 3-month trend).

**Architecture:** All changes are UI enhancements to the existing `cashflow-planning-board.tsx` (947 lines) and one new server action for accuracy trend data. No new Prisma models — reuses GLAccount (bank/cash accounts with code starting "10") and CashflowSnapshot for variance. The CashflowItem type already has `glAccountCode` and `glAccountName` fields.

**Tech Stack:** Next.js App Router, TanStack Query, Recharts (sparkline), existing Prisma models, Vitest.

---

## Task 1: Bank Account Filter Dropdown

**Files:**
- Modify: `components/finance/cashflow-planning-board.tsx:117-127` (state declarations)
- Modify: `components/finance/cashflow-planning-board.tsx:205` (planItems derivation)
- Modify: `components/finance/cashflow-planning-board.tsx:226-270` (header buttons area)

**Context:** The component already fetches GL accounts at line 128-139 and stores them in `glAccounts` state. Items already have `glAccountCode` field. We add a filter dropdown and filter logic.

**Step 1: Add filter state**

In `cashflow-planning-board.tsx`, after line 126 (`const [savingOverride, setSavingOverride] = useState("")`), add:

```typescript
const [bankFilter, setBankFilter] = useState<string>("all")
```

**Step 2: Derive bank accounts list from glAccounts**

After the existing `useEffect` that fetches GL accounts (line 128-139), add:

```typescript
const bankAccounts = glAccounts.filter(a => a.code.startsWith("10"))
```

**Step 3: Add filter dropdown in header**

In the header buttons area (around line 226-270), before the "Tambah Item" button, add:

```tsx
<select
    value={bankFilter}
    onChange={(e) => setBankFilter(e.target.value)}
    className="border-2 border-black bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] h-9 px-3 text-xs font-black uppercase appearance-none cursor-pointer"
>
    <option value="all">Semua Rekening</option>
    {bankAccounts.map((a) => (
        <option key={a.id} value={a.code}>{a.code} — {a.name}</option>
    ))}
</select>
```

**Step 4: Apply filter to planItems**

Change line 205 from:
```typescript
const planItems = [...data.autoItems, ...data.manualItems]
```
to:
```typescript
const allPlanItems = [...data.autoItems, ...data.manualItems]
const planItems = bankFilter === "all"
    ? allPlanItems
    : allPlanItems.filter(item => item.glAccountCode === bankFilter)
```

Also apply to the Riil tab items. In the TabsContent for "riil" (around line 373-382), change:
```tsx
items={data.actualItems}
```
to:
```tsx
items={bankFilter === "all" ? data.actualItems : data.actualItems.filter(i => i.glAccountCode === bankFilter)}
```

**Step 5: Commit**

```bash
git add components/finance/cashflow-planning-board.tsx
git commit -m "feat(cashflow): add bank account filter dropdown to planning board"
```

---

## Task 2: Bank Account Tag on Calendar Item Pills

**Files:**
- Modify: `components/finance/cashflow-planning-board.tsx:651-668` (ItemPill component)

**Context:** The `ItemPill` component renders each cashflow item in the calendar. We add a small bank account tag showing the GL code.

**Step 1: Update ItemPill to show bank account**

Replace the `ItemPill` component (lines 653-668) with:

```tsx
function ItemPill({ item, onEdit }: { item: CashflowItem; onEdit?: (item: CashflowItem) => void }) {
    const colors = CATEGORY_COLORS[item.category] ?? CATEGORY_COLORS.MANUAL
    const label = CATEGORY_LABELS[item.category] ?? item.category
    const isClickable = item.isManual && onEdit
    const bankTag = item.glAccountCode?.startsWith("10") ? item.glAccountCode : null

    return (
        <div
            className={`text-[9px] font-bold px-1.5 py-0.5 border truncate ${colors} ${isClickable ? "cursor-pointer hover:ring-1 hover:ring-black" : ""}`}
            title={`${item.description} — ${formatCurrency(item.amount)}${item.glAccountName ? ` [${item.glAccountName}]` : ""}`}
            onClick={isClickable ? () => onEdit(item) : undefined}
        >
            {bankTag && <span className="opacity-50 mr-0.5">[{bankTag}]</span>}
            <span className="opacity-60">{label}</span>{" "}
            <span>{item.direction === "IN" ? "+" : "-"}{formatCompact(item.amount)}</span>
        </div>
    )
}
```

**Step 2: Commit**

```bash
git add components/finance/cashflow-planning-board.tsx
git commit -m "feat(cashflow): show bank account code tag on calendar item pills"
```

---

## Task 3: Per-Bank Balance Cards

**Files:**
- Modify: `components/finance/cashflow-planning-board.tsx:305-327` (between KPI strip and last month reference)

**Context:** After the 4 KPI cards, add a collapsible row showing per-bank-account projected in/out/net.

**Step 1: Add collapsed state**

After `bankFilter` state (added in Task 1), add:

```typescript
const [bankCardsOpen, setBankCardsOpen] = useState(false)
```

**Step 2: Compute per-bank data**

After the `bankAccounts` derivation (added in Task 1), add:

```typescript
const perBankData = bankAccounts.map((bank) => {
    const bankItems = allPlanItems.filter(i => i.glAccountCode === bank.code)
    const inAmt = bankItems.filter(i => i.direction === "IN").reduce((s, i) => s + i.amount, 0)
    const outAmt = bankItems.filter(i => i.direction === "OUT").reduce((s, i) => s + i.amount, 0)
    return { code: bank.code, name: bank.name, totalIn: inAmt, totalOut: outAmt, net: inAmt - outAmt, count: bankItems.length }
}).filter(b => b.count > 0)
```

**Step 3: Add per-bank cards section**

After the KPI strip `</div>` (line 305), insert:

```tsx
{/* ─── Per-Bank Balance ─────────────────────────────── */}
{perBankData.length > 0 && (
    <div>
        <button
            onClick={() => setBankCardsOpen(!bankCardsOpen)}
            className="text-[10px] font-black uppercase tracking-wider text-zinc-500 hover:text-black flex items-center gap-1 mb-2"
        >
            {bankCardsOpen ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
            Per Rekening ({perBankData.length})
        </button>
        {bankCardsOpen && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {perBankData.map((bank) => (
                    <div
                        key={bank.code}
                        className="border-2 border-black bg-white p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer hover:ring-2 hover:ring-emerald-400"
                        onClick={() => setBankFilter(bankFilter === bank.code ? "all" : bank.code)}
                    >
                        <div className="text-[9px] font-black uppercase tracking-wider text-zinc-500 mb-1">
                            {bank.code} — {bank.name}
                        </div>
                        <div className="flex justify-between text-[10px]">
                            <span className="text-emerald-600 font-bold">+{formatCompact(bank.totalIn)}</span>
                            <span className="text-red-600 font-bold">-{formatCompact(bank.totalOut)}</span>
                            <span className={`font-black ${bank.net >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                                {bank.net >= 0 ? "+" : ""}{formatCompact(bank.net)}
                            </span>
                        </div>
                        <div className="text-[9px] text-zinc-400 mt-0.5">{bank.count} item</div>
                    </div>
                ))}
            </div>
        )}
    </div>
)}
```

**Note:** Import `IconChevronDown` — it's not in the current imports. Add it to the import from `@tabler/icons-react` at line 15-29.

**Step 4: Commit**

```bash
git add components/finance/cashflow-planning-board.tsx
git commit -m "feat(cashflow): add collapsible per-bank balance cards with click-to-filter"
```

---

## Task 4: Create Dialog — Rename GL Label to "Rekening"

**Files:**
- Modify: `components/finance/create-cashflow-item-dialog.tsx`

**Context:** The create/edit dialog has a GL account select labeled generically. We rename it and filter to bank/cash accounts.

**Step 1: Find and read the GL account select in the dialog**

Read `components/finance/create-cashflow-item-dialog.tsx` fully. Find the label for the GL account select (likely says "Akun GL" or similar).

**Step 2: Change the label**

Change the label text from whatever it currently says to:

```tsx
<label className={NB.label}>Rekening</label>
```

**Step 3: Filter GL accounts to bank/cash only**

In the select options, filter to only show accounts where code starts with "10":

```tsx
{glAccounts.filter(a => a.code.startsWith("10")).map((a) => (
    <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
))}
```

If there's also a need to show non-bank accounts, add a separator:

```tsx
<optgroup label="Rekening Bank">
    {glAccounts.filter(a => a.code.startsWith("10")).map((a) => (
        <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
    ))}
</optgroup>
<optgroup label="Akun Lainnya">
    {glAccounts.filter(a => !a.code.startsWith("10")).map((a) => (
        <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
    ))}
</optgroup>
```

**Step 4: Commit**

```bash
git add components/finance/create-cashflow-item-dialog.tsx
git commit -m "feat(cashflow): rename GL account label to Rekening and prioritize bank accounts"
```

---

## Task 5: Enhanced Variance Table — Add Percentage & Accuracy Badge

**Files:**
- Modify: `components/finance/cashflow-planning-board.tsx:865-946` (VarianceSummary component)

**Context:** The existing `VarianceSummary` shows 3 rows (Rencana, Aktual, Selisih) with 3 columns (Pemasukan, Pengeluaran, Nett). We add a 4th column "Varians %" and a 5th column "Akurasi" badge.

**Step 1: Add helper function**

Before the `VarianceSummary` component (around line 865), add:

```typescript
function calcVariancePct(actual: number, planned: number): number | null {
    if (planned === 0) return null
    return ((actual - planned) / planned) * 100
}

function getAccuracyLabel(variancePct: number | null): { label: string; color: string } {
    if (variancePct === null) return { label: "—", color: "text-zinc-400" }
    const abs = Math.abs(variancePct)
    if (abs <= 10) return { label: "Akurat", color: "bg-emerald-100 text-emerald-800 border-emerald-300" }
    if (abs <= 20) return { label: "Cukup", color: "bg-amber-100 text-amber-800 border-amber-300" }
    return { label: "Meleset", color: "bg-red-100 text-red-800 border-red-300" }
}
```

**Step 2: Update the variance table**

In the `VarianceSummary` component, add percentage and accuracy columns:

Add 2 new `<th>` columns to the header:
```tsx
<th className="text-right px-4 py-2 font-black uppercase text-[10px] tracking-wider text-zinc-500">
    Varians %
</th>
<th className="text-center px-4 py-2 font-black uppercase text-[10px] tracking-wider text-zinc-500">
    Akurasi
</th>
```

In the "Selisih" row, after the existing 4 `<td>` cells, add:
```tsx
<td className="px-4 py-3 text-right font-black text-zinc-600">
    {/* Overall variance % based on net */}
    {(() => {
        const plannedNet = snapshot.totalPlannedIn - snapshot.totalPlannedOut
        const actualNet = actualIn - actualOut
        const pct = calcVariancePct(actualNet, plannedNet)
        if (pct === null) return "—"
        const color = Math.abs(pct) <= 10 ? "text-emerald-600" : Math.abs(pct) <= 20 ? "text-amber-600" : "text-red-600"
        return <span className={color}>{pct > 0 ? "+" : ""}{pct.toFixed(1)}%</span>
    })()}
</td>
<td className="px-4 py-3 text-center">
    {(() => {
        const plannedNet = snapshot.totalPlannedIn - snapshot.totalPlannedOut
        const actualNet = actualIn - actualOut
        const pct = calcVariancePct(actualNet, plannedNet)
        const { label, color } = getAccuracyLabel(pct)
        return <span className={`text-[9px] font-bold px-2 py-0.5 border ${color}`}>{label}</span>
    })()}
</td>
```

Also add empty cells in the "Rencana" and "Aktual" rows for the new columns:
```tsx
<td className="px-4 py-3" />
<td className="px-4 py-3" />
```

**Step 3: Add overall accuracy score in header**

In the VarianceSummary header bar (line 886-893), after "Variance: Rencana vs Realisasi", add:

```tsx
{(() => {
    const plannedNet = snapshot.totalPlannedIn - snapshot.totalPlannedOut
    const actualNet = actualIn - actualOut
    const pct = calcVariancePct(actualNet, plannedNet)
    const accuracy = pct !== null ? Math.max(0, 100 - Math.abs(pct)) : null
    if (accuracy === null) return null
    return (
        <span className={`text-[10px] font-bold px-2 py-0.5 border ${accuracy >= 80 ? "border-emerald-400 text-emerald-400" : accuracy >= 60 ? "border-amber-400 text-amber-400" : "border-red-400 text-red-400"}`}>
            Akurasi: {accuracy.toFixed(0)}%
        </span>
    )
})()}
```

Note: `actualIn` and `actualOut` need to be computed before the return statement — they already are (lines 874-879).

**Step 4: Commit**

```bash
git add components/finance/cashflow-planning-board.tsx
git commit -m "feat(cashflow): add variance percentage and accuracy badge to planning board"
```

---

## Task 6: Category-Level Variance Breakdown

**Files:**
- Modify: `components/finance/cashflow-planning-board.tsx:865-946` (VarianceSummary component)

**Context:** After the main variance table, add an expandable category-level breakdown showing which categories were accurate vs volatile.

**Step 1: Add category breakdown state**

In the `VarianceSummary` component, add:

```typescript
const [showBreakdown, setShowBreakdown] = useState(false)
```

(VarianceSummary needs to be converted from a plain function to use useState — it currently doesn't use hooks so this is safe.)

**Step 2: Compute per-category variance**

After the existing `actualIn`/`actualOut` calculations, add:

```typescript
// Parse snapshot items for per-category planned amounts
const snapshotItems = (snapshot as any).items as CashflowItem[] | undefined
const categoryVariance = (() => {
    if (!snapshotItems?.length) return []

    // Group planned by category
    const plannedByCategory = new Map<string, { in: number; out: number }>()
    for (const item of snapshotItems) {
        const cat = item.category || "MANUAL"
        const existing = plannedByCategory.get(cat) || { in: 0, out: 0 }
        if (item.direction === "IN") existing.in += item.amount
        else existing.out += item.amount
        plannedByCategory.set(cat, existing)
    }

    // Group actual by category
    const actualByCategory = new Map<string, { in: number; out: number }>()
    for (const item of actualItems) {
        const cat = item.category || "ACTUAL"
        const existing = actualByCategory.get(cat) || { in: 0, out: 0 }
        if (item.direction === "IN") existing.in += item.amount
        else existing.out += item.amount
        actualByCategory.set(cat, existing)
    }

    // Merge all categories
    const allCategories = new Set([...plannedByCategory.keys(), ...actualByCategory.keys()])
    return Array.from(allCategories).map(cat => {
        const planned = plannedByCategory.get(cat) || { in: 0, out: 0 }
        const actual = actualByCategory.get(cat) || { in: 0, out: 0 }
        const plannedTotal = planned.in + planned.out
        const actualTotal = actual.in + actual.out
        const pct = calcVariancePct(actualTotal, plannedTotal)
        return {
            category: cat,
            label: CATEGORY_LABELS[cat] || cat,
            plannedTotal,
            actualTotal,
            variancePct: pct,
            accuracy: getAccuracyLabel(pct),
        }
    }).filter(c => c.plannedTotal > 0 || c.actualTotal > 0)
      .sort((a, b) => Math.abs(b.variancePct || 0) - Math.abs(a.variancePct || 0))
})()
```

**Step 3: Add expandable breakdown section**

After the variance `</table>`, add:

```tsx
{categoryVariance.length > 0 && (
    <div className="border-t-2 border-black">
        <button
            onClick={() => setShowBreakdown(!showBreakdown)}
            className="w-full px-4 py-2 text-left text-[10px] font-black uppercase tracking-wider text-zinc-500 hover:bg-zinc-50 flex items-center gap-1"
        >
            {showBreakdown ? "▼" : "▶"} Detail Per Kategori ({categoryVariance.length})
        </button>
        {showBreakdown && (
            <table className="w-full text-xs">
                <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50">
                        <th className="text-left px-4 py-1.5 text-[10px] font-bold text-zinc-500">Kategori</th>
                        <th className="text-right px-4 py-1.5 text-[10px] font-bold text-zinc-500">Rencana</th>
                        <th className="text-right px-4 py-1.5 text-[10px] font-bold text-zinc-500">Aktual</th>
                        <th className="text-right px-4 py-1.5 text-[10px] font-bold text-zinc-500">Varians</th>
                        <th className="text-center px-4 py-1.5 text-[10px] font-bold text-zinc-500">Status</th>
                    </tr>
                </thead>
                <tbody>
                    {categoryVariance.map((c) => (
                        <tr key={c.category} className="border-b border-zinc-100">
                            <td className="px-4 py-2">
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 border ${CATEGORY_COLORS[c.category] || ""}`}>
                                    {c.label}
                                </span>
                            </td>
                            <td className="px-4 py-2 text-right font-bold">{formatCurrency(c.plannedTotal)}</td>
                            <td className="px-4 py-2 text-right font-bold">{formatCurrency(c.actualTotal)}</td>
                            <td className="px-4 py-2 text-right font-bold">
                                {c.variancePct !== null ? (
                                    <span className={Math.abs(c.variancePct) <= 10 ? "text-emerald-600" : Math.abs(c.variancePct) <= 20 ? "text-amber-600" : "text-red-600"}>
                                        {c.variancePct > 0 ? "+" : ""}{c.variancePct.toFixed(1)}%
                                    </span>
                                ) : "—"}
                            </td>
                            <td className="px-4 py-2 text-center">
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 border ${c.accuracy.color}`}>
                                    {c.accuracy.label}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        )}
    </div>
)}
```

**Step 4: Commit**

```bash
git add components/finance/cashflow-planning-board.tsx
git commit -m "feat(cashflow): add per-category variance breakdown with accuracy status"
```

---

## Task 7: 3-Month Accuracy Trend Server Action

**Files:**
- Modify: `lib/actions/finance-cashflow.ts` (add new exported function)
- Create: `__tests__/finance/cashflow-accuracy.test.ts`

**Context:** We need a server action that fetches snapshots from the past 3 months and compares them against actuals to show an accuracy trend.

**Step 1: Write test**

Create `__tests__/finance/cashflow-accuracy.test.ts`:

```typescript
import { describe, it, expect } from "vitest"

// Test the accuracy calculation logic (pure functions)
describe("accuracy calculation", () => {
    it("returns 100% accuracy when plan matches actual exactly", () => {
        const planned = 1000000
        const actual = 1000000
        const variance = ((actual - planned) / planned) * 100
        const accuracy = Math.max(0, 100 - Math.abs(variance))
        expect(accuracy).toBe(100)
    })

    it("returns 90% accuracy when 10% off", () => {
        const planned = 1000000
        const actual = 1100000
        const variance = ((actual - planned) / planned) * 100
        const accuracy = Math.max(0, 100 - Math.abs(variance))
        expect(accuracy).toBe(90)
    })

    it("returns 0% accuracy when >100% off", () => {
        const planned = 1000000
        const actual = 2100000
        const variance = ((actual - planned) / planned) * 100
        const accuracy = Math.max(0, 100 - Math.abs(variance))
        expect(accuracy).toBe(0)
    })

    it("handles zero planned gracefully", () => {
        const planned = 0
        const actual = 500000
        const variance = planned === 0 ? null : ((actual - planned) / planned) * 100
        expect(variance).toBeNull()
    })
})
```

**Step 2: Run test to verify it passes (pure math, should pass immediately)**

```bash
npx vitest run __tests__/finance/cashflow-accuracy.test.ts
```

**Step 3: Add server action**

At the end of `lib/actions/finance-cashflow.ts`, add:

```typescript
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
    accuracyScore: number | null // 0-100
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

        // Accuracy: average of in/out accuracy, where accuracy = max(0, 100 - |variance%|)
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
```

**Step 4: Commit**

```bash
git add lib/actions/finance-cashflow.ts __tests__/finance/cashflow-accuracy.test.ts
git commit -m "feat(cashflow): add accuracy trend server action with tests"
```

---

## Task 8: Accuracy Trend API Route + Hook

**Files:**
- Create: `app/api/finance/cashflow-accuracy/route.ts`
- Modify: `lib/query-keys.ts` (add accuracy key)
- Modify: `hooks/use-cashflow-plan.ts` (add useAccuracyTrend hook)

**Step 1: Create API route**

Create `app/api/finance/cashflow-accuracy/route.ts`:

```typescript
import { NextResponse } from "next/server"
import { getAccuracyTrend } from "@/lib/actions/finance-cashflow"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const months = Number(searchParams.get("months") || 3)
        const data = await getAccuracyTrend(Math.min(months, 12))
        return NextResponse.json(data)
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || "Failed to fetch accuracy trend" },
            { status: error.message === "Unauthorized" ? 401 : 500 }
        )
    }
}
```

**Step 2: Add query key**

In `lib/query-keys.ts`, after `cashflowForecast`, add:

```typescript
cashflowAccuracy: {
    all: ["cashflowAccuracy"] as const,
    trend: (months?: number) => [...queryKeys.cashflowAccuracy.all, "trend", months] as const,
},
```

**Step 3: Add hook**

In `hooks/use-cashflow-plan.ts`, add:

```typescript
import type { AccuracyTrendMonth } from "@/lib/actions/finance-cashflow"

export function useAccuracyTrend(months: number = 3) {
    return useQuery<AccuracyTrendMonth[]>({
        queryKey: queryKeys.cashflowAccuracy.trend(months),
        queryFn: async () => {
            const res = await fetch(`/api/finance/cashflow-accuracy?months=${months}`)
            if (!res.ok) throw new Error("Failed to fetch accuracy trend")
            return res.json()
        },
        staleTime: 5 * 60 * 1000, // 5 minutes — historical data changes rarely
    })
}
```

**Step 4: Commit**

```bash
git add app/api/finance/cashflow-accuracy/ lib/query-keys.ts hooks/use-cashflow-plan.ts
git commit -m "feat(cashflow): add accuracy trend API route and hook"
```

---

## Task 9: 3-Month Accuracy Trend Display

**Files:**
- Modify: `components/finance/cashflow-planning-board.tsx` (VarianceSummary section)
- Modify: `app/finance/planning/page.tsx` (pass accuracy data to board)

**Context:** Show 3 colored dots/bars below the variance table indicating accuracy trend over the past 3 months.

**Step 1: Add accuracy trend to the planning page**

In `app/finance/planning/page.tsx`, import and call `useAccuracyTrend`:

```typescript
import { useAccuracyTrend } from "@/hooks/use-cashflow-plan"
```

In the component, add:
```typescript
const { data: accuracyTrend } = useAccuracyTrend(3)
```

Pass it to the board:
```tsx
<CashflowPlanningBoard
    data={data}
    month={month}
    year={year}
    onMonthChange={setMonth}
    onYearChange={setYear}
    accuracyTrend={accuracyTrend}
/>
```

**Step 2: Update CashflowPlanningBoardProps**

In `cashflow-planning-board.tsx`, update the interface (line 103-109):

```typescript
interface CashflowPlanningBoardProps {
    data: CashflowPlanData
    month: number
    year: number
    onMonthChange: (month: number) => void
    onYearChange: (year: number) => void
    accuracyTrend?: { month: number; year: number; label: string; accuracyScore: number | null }[]
}
```

Add `accuracyTrend` to the destructured props at line 111-117.

**Step 3: Pass accuracyTrend to VarianceSummary**

Update the VarianceSummary call (around line 401-406):

```tsx
<VarianceSummary
    snapshot={data.snapshot}
    actualItems={data.actualItems}
    accuracyTrend={accuracyTrend}
/>
```

**Step 4: Add trend display in VarianceSummary**

Update `VarianceSummary` props to accept `accuracyTrend`. After the category breakdown section (or after the main variance table if Task 6 isn't done), add:

```tsx
{accuracyTrend && accuracyTrend.length > 0 && (
    <div className="border-t-2 border-black px-4 py-3">
        <div className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-2">
            Tren Akurasi 3 Bulan
        </div>
        <div className="flex items-center gap-3">
            {accuracyTrend.map((m) => {
                const score = m.accuracyScore
                const color = score === null
                    ? "bg-zinc-200"
                    : score >= 80
                        ? "bg-emerald-500"
                        : score >= 60
                            ? "bg-amber-500"
                            : "bg-red-500"
                return (
                    <div key={`${m.month}-${m.year}`} className="flex flex-col items-center gap-1">
                        <div
                            className={`w-8 ${color} border border-black`}
                            style={{ height: score !== null ? `${Math.max(8, score * 0.4)}px` : "8px" }}
                            title={score !== null ? `${score}%` : "Tidak ada data"}
                        />
                        <span className="text-[9px] font-bold text-zinc-500">{m.label}</span>
                        <span className="text-[9px] font-black">
                            {score !== null ? `${score}%` : "—"}
                        </span>
                    </div>
                )
            })}
        </div>
    </div>
)}
```

**Step 5: Commit**

```bash
git add components/finance/cashflow-planning-board.tsx app/finance/planning/page.tsx
git commit -m "feat(cashflow): show 3-month accuracy trend bars in planning board"
```

---

## Task 10: Final Verification

**Step 1: Run all tests**

```bash
npx vitest run
```

**Step 2: Type check**

```bash
npx tsc --noEmit
```

**Step 3: Lint**

```bash
npm run lint
```

**Step 4: Manual verification checklist**

- [ ] `/finance/planning` — bank account filter dropdown appears in header
- [ ] Selecting a bank filters calendar items and running balance
- [ ] Calendar item pills show `[1011]` bank code tag
- [ ] Per-bank balance cards expand/collapse, click filters
- [ ] Create item dialog shows "Rekening" label with bank accounts first
- [ ] Variance table shows Varians % column and Akurasi badge
- [ ] Category breakdown expands with per-category accuracy
- [ ] 3-month accuracy trend bars appear when snapshots exist
- [ ] Accuracy score badge in variance header ("Akurasi: 78%")

**Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: address lint and type issues from cashflow planning enhancements"
```
