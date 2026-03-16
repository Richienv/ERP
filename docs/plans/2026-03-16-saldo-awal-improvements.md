# Saldo Awal (Opening Balances) Improvements Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix backend safety issues (duplicate posting, hardcoded account codes) and upgrade UI to full NB v2 compliance with dynamic KPI data and active input indicators.

**Architecture:** Add `OPENING_EQUITY` (3900) to `SYS_ACCOUNTS`, add duplicate check in `postOpeningBalancesGL`, make KPI strip show real totals from existing opening balance data, add active input indicators per CLAUDE.md mandate.

**Tech Stack:** Next.js server actions, Prisma, React, TanStack Query, NB Design System

---

## File Structure

| Action | File | Purpose |
|--------|------|---------|
| Modify | `lib/gl-accounts.ts` | Add OPENING_EQUITY constant |
| Modify | `lib/actions/finance-gl.ts` | Add duplicate check + use SYS_ACCOUNTS for 3900 + ensureSystemAccounts |
| Modify | `app/finance/opening-balances/page.tsx` | Dynamic KPI strip with real totals |
| Modify | `components/finance/opening-balances-gl.tsx` | Active input indicators + minor UI polish |
| Modify | `components/finance/opening-balances-apar.tsx` | Active input indicators + minor UI polish |

---

## Task 1: Add OPENING_EQUITY to SYS_ACCOUNTS + Fix Backend

**Files:**
- Modify: `lib/gl-accounts.ts`
- Modify: `lib/actions/finance-gl.ts`

- [ ] **Step 1: Add OPENING_EQUITY to SYS_ACCOUNTS**

In `lib/gl-accounts.ts`, add to the SYS_ACCOUNTS object in the Equity section:

```typescript
OPENING_EQUITY: "3900",  // Saldo Awal Ekuitas (Opening Balance Equity)
```

Add to SYSTEM_ACCOUNT_DEFS:
```typescript
{ code: SYS_ACCOUNTS.OPENING_EQUITY, name: "Saldo Awal Ekuitas", type: "EQUITY" },
```

- [ ] **Step 2: Fix hardcoded "3900" in createOpeningInvoices**

In `lib/actions/finance-gl.ts`, around line 999, replace:
```typescript
const openingEquityCode = "3900"
```
with:
```typescript
const openingEquityCode = SYS_ACCOUNTS.OPENING_EQUITY
```

- [ ] **Step 3: Add ensureSystemAccounts() to both opening balance functions**

In `postOpeningBalancesGL()` (line ~891), add before the account lookup:
```typescript
await ensureSystemAccounts()
```

In `createOpeningInvoices()` (line ~965), add at the start of `withPrismaAuth`:
```typescript
await ensureSystemAccounts()
```

This replaces the manual auto-create block for account 3900 (lines 1009-1013) since `ensureSystemAccounts()` now handles it.

- [ ] **Step 4: Add duplicate posting check to postOpeningBalancesGL**

In `postOpeningBalancesGL()`, after the year calculation (line ~889), add:

```typescript
// Check for existing opening balance for this year
return await withPrismaAuth(async (prisma) => {
    const existing = await prisma.journalEntry.findFirst({
        where: { reference: `OPENING-BALANCE-${year}` },
        select: { id: true, date: true },
    })
    if (existing) {
        return {
            success: false,
            error: `Saldo awal untuk tahun ${year} sudah pernah diposting. Hapus jurnal OPENING-BALANCE-${year} terlebih dahulu jika ingin mengulang.`
        }
    }
    // ... rest of the function
```

- [ ] **Step 5: Commit**

```bash
git add lib/gl-accounts.ts lib/actions/finance-gl.ts
git commit -m "fix(saldo-awal): add OPENING_EQUITY to SYS_ACCOUNTS + duplicate check + ensureSystemAccounts"
```

---

## Task 2: Dynamic KPI Strip + Server Action

**Files:**
- Modify: `lib/actions/finance-gl.ts`
- Modify: `app/finance/opening-balances/page.tsx`

- [ ] **Step 1: Add getOpeningBalanceSummary server action**

In `lib/actions/finance-gl.ts`, add a new exported function:

```typescript
export async function getOpeningBalanceSummary(): Promise<{
    glPosted: boolean
    glDate: string | null
    glTotalDebit: number
    glTotalCredit: number
    glAccountCount: number
    apCount: number
    apTotal: number
    arCount: number
    arTotal: number
}> {
    try {
        const { prisma } = await import('@/lib/db')

        // Check GL opening balance
        const glEntry = await prisma.journalEntry.findFirst({
            where: { reference: { startsWith: 'OPENING-BALANCE-' } },
            include: { lines: true },
            orderBy: { date: 'desc' },
        })

        // Count AP/AR opening invoices
        const [apData, arData] = await Promise.all([
            prisma.invoice.aggregate({
                where: { type: 'INV_IN', number: { not: { startsWith: 'BILL-' } }, status: 'ISSUED' },
                _count: true,
                _sum: { totalAmount: true },
            }),
            prisma.invoice.aggregate({
                where: { type: 'INV_OUT', number: { not: { startsWith: 'INV-' } }, status: 'ISSUED' },
                _count: true,
                _sum: { totalAmount: true },
            }),
        ])

        return {
            glPosted: !!glEntry,
            glDate: glEntry?.date?.toISOString().slice(0, 10) ?? null,
            glTotalDebit: glEntry?.lines.reduce((s, l) => s + Number(l.debit), 0) ?? 0,
            glTotalCredit: glEntry?.lines.reduce((s, l) => s + Number(l.credit), 0) ?? 0,
            glAccountCount: glEntry?.lines.length ?? 0,
            apCount: apData._count ?? 0,
            apTotal: Number(apData._sum.totalAmount ?? 0),
            arCount: arData._count ?? 0,
            arTotal: Number(arData._sum.totalAmount ?? 0),
        }
    } catch {
        return { glPosted: false, glDate: null, glTotalDebit: 0, glTotalCredit: 0, glAccountCount: 0, apCount: 0, apTotal: 0, arCount: 0, arTotal: 0 }
    }
}
```

NOTE: The AP/AR aggregate queries use a heuristic to find opening invoices (those NOT starting with the auto-generated prefix). A more robust approach would be to check for `reference: { startsWith: 'OPENING-' }` on the linked journal entry. Adjust the filter logic based on how Raymond's data actually looks.

- [ ] **Step 2: Update page.tsx KPI strip to show real data**

In `app/finance/opening-balances/page.tsx`:

1. Add imports:
```typescript
import { useEffect, useState } from "react"
import { getOpeningBalanceSummary } from "@/lib/actions/finance-gl"
import { formatIDR } from "@/lib/utils"
```

2. Add state and fetch in the component:
```typescript
const [summary, setSummary] = useState<Awaited<ReturnType<typeof getOpeningBalanceSummary>> | null>(null)

useEffect(() => {
    getOpeningBalanceSummary().then(setSummary)
}, [activeTab]) // refetch when switching tabs (user may have posted)
```

3. Replace the static KPI strip (Row 2) with dynamic data:

```tsx
{/* Row 2: KPI strip — dynamic */}
<div className={`flex items-center divide-x divide-zinc-200 dark:divide-zinc-800 ${NB.pageRowBorder}`}>
    <div className="flex-1 px-4 py-3 flex items-center justify-between gap-3 cursor-default">
        <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 ${summary?.glPosted ? "bg-emerald-500" : "bg-amber-500"}`} />
            <span className={NB.kpiLabel}>Saldo GL</span>
        </div>
        <span className="text-xs font-bold text-zinc-500">
            {summary?.glPosted ? `${summary.glAccountCount} akun` : "Belum diposting"}
        </span>
    </div>
    <div className="flex-1 px-4 py-3 flex items-center justify-between gap-3 cursor-default">
        <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 ${summary && summary.apCount > 0 ? "bg-red-500" : "bg-zinc-300"}`} />
            <span className={NB.kpiLabel}>Hutang (AP)</span>
        </div>
        <span className="text-xs font-bold text-zinc-500">
            {summary && summary.apCount > 0 ? `${summary.apCount} bill — ${formatIDR(summary.apTotal)}` : "Belum ada"}
        </span>
    </div>
    <div className="flex-1 px-4 py-3 flex items-center justify-between gap-3 cursor-default">
        <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 ${summary && summary.arCount > 0 ? "bg-blue-500" : "bg-zinc-300"}`} />
            <span className={NB.kpiLabel}>Piutang (AR)</span>
        </div>
        <span className="text-xs font-bold text-zinc-500">
            {summary && summary.arCount > 0 ? `${summary.arCount} invoice — ${formatIDR(summary.arTotal)}` : "Belum ada"}
        </span>
    </div>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add lib/actions/finance-gl.ts app/finance/opening-balances/page.tsx
git commit -m "feat(saldo-awal): dynamic KPI strip showing real GL/AP/AR opening balance status"
```

---

## Task 3: Active Input Indicators on GL Tab

**Files:**
- Modify: `components/finance/opening-balances-gl.tsx`

Per CLAUDE.md, every input MUST show a visual state change when it has a value:
- **Empty:** `border-zinc-300`, `bg-white`
- **Has value:** `border-orange-400`, `bg-orange-50/50`

- [ ] **Step 1: Add active input classes to the account select**

```tsx
// BEFORE:
<select
    value={row.accountCode}
    onChange={(e) => updateRow(idx, "accountCode", e.target.value)}
    className={`${NB.select} text-sm`}
    disabled={accountsLoading}
>

// AFTER:
<select
    value={row.accountCode}
    onChange={(e) => updateRow(idx, "accountCode", e.target.value)}
    className={`${NB.select} text-sm ${row.accountCode ? NB.inputActive : NB.inputEmpty}`}
    disabled={accountsLoading}
>
```

- [ ] **Step 2: Add active input classes to debit/credit inputs**

```tsx
// Debit input — AFTER:
<input
    type="number"
    value={row.debit || ""}
    onChange={(e) => updateRow(idx, "debit", Number(e.target.value) || 0)}
    placeholder="0"
    className={`${NB.inputMono} w-full text-sm text-right ${row.debit > 0 ? NB.inputActive : NB.inputEmpty}`}
    min={0}
/>

// Credit input — AFTER:
<input
    type="number"
    value={row.credit || ""}
    onChange={(e) => updateRow(idx, "credit", Number(e.target.value) || 0)}
    placeholder="0"
    className={`${NB.inputMono} w-full text-sm text-right ${row.credit > 0 ? NB.inputActive : NB.inputEmpty}`}
    min={0}
/>
```

- [ ] **Step 3: Add active input class to date picker**

```tsx
<input
    type="date"
    value={balanceDate}
    onChange={(e) => setBalanceDate(e.target.value)}
    className={`${NB.input} w-48 ${balanceDate ? NB.inputActive : NB.inputEmpty}`}
/>
```

- [ ] **Step 4: Commit**

```bash
git add components/finance/opening-balances-gl.tsx
git commit -m "fix(saldo-awal): add NB active input indicators to GL tab"
```

---

## Task 4: Active Input Indicators on AP/AR Tab

**Files:**
- Modify: `components/finance/opening-balances-apar.tsx`

- [ ] **Step 1: Add active input classes to all inputs**

Apply the same pattern to all 4 input fields per row:

```tsx
// Vendor/Customer select:
className={`${NB.select} text-sm ${row.partyId ? NB.inputActive : NB.inputEmpty}`}

// Invoice number input:
className={`${NB.input} w-full text-sm ${row.invoiceNumber.trim() ? NB.inputActive : NB.inputEmpty}`}

// Amount input:
className={`${NB.inputMono} w-full text-sm text-right ${row.amount > 0 ? NB.inputActive : NB.inputEmpty}`}

// Due date input:
className={`${NB.input} w-full text-sm ${row.dueDate ? NB.inputActive : NB.inputEmpty}`}
```

- [ ] **Step 2: Commit**

```bash
git add components/finance/opening-balances-apar.tsx
git commit -m "fix(saldo-awal): add NB active input indicators to AP/AR tab"
```

---

## Summary

| Task | What | Impact |
|------|------|--------|
| 1 | Add 3900 to SYS_ACCOUNTS + duplicate check + ensureSystemAccounts | Prevents silent GL failures and accidental double-posting |
| 2 | Dynamic KPI strip | Users see at a glance what's been posted vs pending |
| 3 | Active input indicators (GL) | NB v2 compliance — users see which fields have data |
| 4 | Active input indicators (AP/AR) | Same |
