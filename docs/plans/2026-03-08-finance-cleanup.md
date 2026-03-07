# Finance Module Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Clean up the finance module — delete orphaned page, fix layout class, migrate transactions page from useEffect to TanStack Query with API route for 0s instant loading.

**Architecture:** Create `/api/finance/transactions` API route using prisma singleton (read-only, no auth transaction overhead). Add `useAccountTransactions` hook with TanStack Query. Wire into nav-prefetch for hover prefetching. Delete dead `accounts-payable` page.

**Tech Stack:** Next.js API route, Prisma singleton, TanStack Query, existing `getAccountTransactions` query logic (inlined into API route)

---

### Task 1: Delete orphaned `/finance/accounts-payable` page

**Files:**
- Delete: `app/finance/accounts-payable/page.tsx`
- Delete: `app/finance/accounts-payable/._page.tsx`

This page is orphaned — no sidebar link points to it. `/finance/payables` already provides the same functionality with tabs for bills, vendor payments, and nota debit.

**Step 1: Delete the directory**

```bash
rm -rf app/finance/accounts-payable
```

**Step 2: Verify no references exist**

```bash
grep -r "accounts-payable" app/ components/ hooks/ lib/ --include="*.tsx" --include="*.ts" -l
```

Expected: No results (the sidebar uses `/finance/payables` not `/finance/accounts-payable`)

**Step 3: Commit**

```bash
git add -A
git commit -m "chore(finance): remove orphaned accounts-payable page (replaced by /payables)"
```

---

### Task 2: Fix reconciliation page layout class

**Files:**
- Modify: `app/finance/reconciliation/page.tsx:24`

**Step 1: Replace the outer div class**

Change line 24 from:
```tsx
<div className="p-6 space-y-6">
```
To:
```tsx
<div className="mf-page">
```

**Step 2: Verify visually (optional)**

Navigate to `/finance/reconciliation` — should have consistent spacing and subtle gradient background matching other finance pages.

**Step 3: Commit**

```bash
git add app/finance/reconciliation/page.tsx
git commit -m "fix(reconciliation): use mf-page class for consistent layout"
```

---

### Task 3: Create `/api/finance/transactions` API route

**Files:**
- Create: `app/api/finance/transactions/route.ts`

**Step 1: Create the API route**

This inlines the query logic from `getAccountTransactions` in `lib/actions/finance-invoices.ts:347-425` but uses the prisma singleton directly (no `withPrismaAuth` transaction overhead for read-only queries). Single auth check via Supabase.

```ts
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
        }

        const url = request.nextUrl
        const limit = Math.min(Number(url.searchParams.get("limit")) || 500, 1000)

        const where: any = { status: "POSTED" }

        const entries = await prisma.journalEntry.findMany({
            where,
            include: {
                lines: {
                    include: {
                        account: { select: { id: true, code: true, name: true, type: true } },
                    },
                },
                invoice: { select: { id: true, number: true, type: true } },
                payment: { select: { id: true, number: true, method: true } },
            },
            orderBy: { date: "desc" },
            take: limit,
        })

        const accounts = await prisma.gLAccount.findMany({
            orderBy: { code: "asc" },
            select: { id: true, code: true, name: true, type: true, balance: true },
        })

        return NextResponse.json({
            success: true,
            entries: entries.map((e) => ({
                id: e.id,
                date: e.date,
                description: e.description,
                reference: e.reference,
                invoiceNumber: e.invoice?.number || null,
                invoiceType: e.invoice?.type || null,
                paymentNumber: e.payment?.number || null,
                paymentMethod: e.payment?.method || null,
                lines: e.lines.map((l) => ({
                    id: l.id,
                    accountCode: l.account.code,
                    accountName: l.account.name,
                    accountType: l.account.type,
                    description: l.description,
                    debit: Number(l.debit),
                    credit: Number(l.credit),
                })),
            })),
            accounts: accounts.map((a) => ({
                id: a.id,
                code: a.code,
                name: a.name,
                type: a.type,
                balance: Number(a.balance),
            })),
        })
    } catch (error: any) {
        console.error("Finance transactions API error:", error)
        return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 })
    }
}
```

**Step 2: Verify compilation**

```bash
npx tsc --noEmit 2>&1 | grep "api/finance/transactions" | head -5
```

Expected: No errors

**Step 3: Commit**

```bash
git add app/api/finance/transactions/route.ts
git commit -m "feat(finance): add /api/finance/transactions API route"
```

---

### Task 4: Add query key + create `useAccountTransactions` hook

**Files:**
- Modify: `lib/query-keys.ts:108` (add after `financeReports` block)
- Create: `hooks/use-account-transactions.ts`

**Step 1: Add query key**

Add after the `financeReports` block (line 108) in `lib/query-keys.ts`:

```ts
accountTransactions: {
    all: ["accountTransactions"] as const,
    list: () => [...queryKeys.accountTransactions.all, "list"] as const,
},
```

**Step 2: Create the hook**

```ts
"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

interface TransactionLine {
    id: string
    accountCode: string
    accountName: string
    accountType: string
    description: string | null
    debit: number
    credit: number
}

interface TransactionEntry {
    id: string
    date: string
    description: string
    reference: string | null
    invoiceNumber: string | null
    invoiceType: string | null
    paymentNumber: string | null
    paymentMethod: string | null
    lines: TransactionLine[]
}

interface AccountInfo {
    id: string
    code: string
    name: string
    type: string
    balance: number
}

export interface AccountTransactionsData {
    entries: TransactionEntry[]
    accounts: AccountInfo[]
}

export function useAccountTransactions() {
    return useQuery<AccountTransactionsData>({
        queryKey: queryKeys.accountTransactions.list(),
        queryFn: async () => {
            const res = await fetch("/api/finance/transactions?limit=500")
            const json = await res.json()
            if (!json.success) throw new Error(json.error || "Failed to load transactions")
            return { entries: json.entries ?? [], accounts: json.accounts ?? [] }
        },
        staleTime: 2 * 60 * 1000,
    })
}
```

**Step 3: Verify compilation**

```bash
npx tsc --noEmit 2>&1 | grep -E "query-keys|use-account-transactions" | head -5
```

Expected: No errors

**Step 4: Commit**

```bash
git add lib/query-keys.ts hooks/use-account-transactions.ts
git commit -m "feat(finance): add accountTransactions query key and useAccountTransactions hook"
```

---

### Task 5: Migrate transactions page to use TanStack Query hook

**Files:**
- Modify: `app/finance/transactions/page.tsx`

**Step 1: Replace imports**

Remove:
```ts
import { useCallback, useEffect, useMemo, useState } from "react"
```
```ts
import { getAccountTransactions } from "@/lib/actions/finance-invoices"
```

Replace with:
```ts
import { useCallback, useMemo, useState } from "react"
```
```ts
import { useAccountTransactions } from "@/hooks/use-account-transactions"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
```

**Step 2: Remove `export const dynamic = "force-dynamic"` (line 13)**

This is only needed for server components. Delete this line.

**Step 3: Replace state + useEffect with hook**

Remove these lines (119-137):
```ts
const [loading, setLoading] = useState(true)
const [entries, setEntries] = useState<TransactionEntry[]>([])
const [accounts, setAccounts] = useState<AccountInfo[]>([])
```
```ts
useEffect(() => { loadData() }, [])
```

And the `loadData` function (163-180):
```ts
const loadData = async () => { ... }
```

Replace with:
```ts
const { data, isLoading } = useAccountTransactions()

if (isLoading || !data) {
    return <TablePageSkeleton accentColor="bg-indigo-400" />
}

const entries = data.entries
const accounts = data.accounts
```

**Step 4: Remove the "Update" button**

Remove the button (around line 396) since data auto-refreshes via TanStack Query:
```tsx
<Button onClick={loadData} className="bg-indigo-600 ...">
    Update
</Button>
```

**Step 5: Remove the manual loading state in the main content**

Replace the loading check (around line 403):
```tsx
{loading ? (
    <div className="border-2 ...">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span ...>Memuat transaksi akun...</span>
    </div>
) : groupMode === "ACCOUNT" ...
```

With just:
```tsx
{groupMode === "ACCOUNT" && groupedByAccount ? (
```

Since we already return `TablePageSkeleton` above when loading.

**Step 6: Clean up unused imports**

Remove `Loader2` from lucide-react imports since the loading spinner is no longer used inline.

**Step 7: Remove the `TransactionEntry`, `AccountInfo`, `TransactionLine` type definitions**

These are now exported from the hook file. Import them if needed, or since the data is already typed by the hook, the local type definitions at lines 16-44 can stay (they match). Keep them to avoid churn — the hook returns the same shape.

**Step 8: Sort entries by date descending after receiving from hook**

The API route already sorts by date desc, so no additional sorting needed. But the `filtered` useMemo already works off `entries` which comes sorted.

**Step 9: Verify compilation**

```bash
npx tsc --noEmit 2>&1 | grep "finance/transactions" | head -5
```

Expected: No errors

**Step 10: Commit**

```bash
git add app/finance/transactions/page.tsx
git commit -m "refactor(finance): migrate transactions page to TanStack Query"
```

---

### Task 6: Add transactions to nav-prefetch

**Files:**
- Modify: `hooks/use-nav-prefetch.ts` (add after the `/finance/reconciliation` block, around line 430)

**Step 1: Add prefetch entry**

Add after the `/finance/reconciliation` block:

```ts
"/finance/transactions": {
    queryKey: queryKeys.accountTransactions.list(),
    queryFn: () => fetch("/api/finance/transactions?limit=500").then((r) => r.json()).then((p) => ({
        entries: p.entries ?? [],
        accounts: p.accounts ?? [],
    })),
},
```

**Step 2: Add import for accountTransactions query key**

The `queryKeys` import already exists at line 6. No new import needed — `queryKeys.accountTransactions` is available after Task 4.

**Step 3: Verify compilation**

```bash
npx tsc --noEmit 2>&1 | grep "use-nav-prefetch" | head -5
```

Expected: No errors

**Step 4: Commit**

```bash
git add hooks/use-nav-prefetch.ts
git commit -m "perf(finance): add transactions page to nav-prefetch for instant loading"
```

---

### Task 7: Verify everything works end-to-end

**Step 1: Run type check**

```bash
npx tsc --noEmit 2>&1 | grep -E "finance|transaction|reconciliation" | head -20
```

Expected: No new errors

**Step 2: Run tests**

```bash
npx vitest run
```

Expected: Same pass rate as baseline (296/301)

**Step 3: Manual verification checklist**

| Page | Check |
|------|-------|
| `/finance/transactions` | Page loads with skeleton, then shows data instantly |
| `/finance/transactions` | All filters work (account type, date preset, search) |
| `/finance/transactions` | CSV export still works |
| `/finance/transactions` | Group by account + flat view both work |
| `/finance/transactions` | Hover sidebar link, then click — should load instantly |
| `/finance/payables` | Still works as expected (AP consolidated page) |
| `/finance/reconciliation` | Layout matches other finance pages (mf-page spacing) |
| `/finance/accounts-payable` | Returns 404 (deleted) |

**Step 4: Final commit (if any uncommitted changes remain)**

```bash
git add -A
git commit -m "fix(finance): code review fixes for finance cleanup"
```
