# Meeting Backlog (11 Juni) — Remaining Items Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the 5 remaining items from the 11 Juni meeting backlog (MTG-003, MTG-004, MTG-011, MTG-027, MTG-029).

**Architecture:** Each task is independent — can be parallelized. We fix partially-implemented items by adding pagination, activating existing fields, and creating missing linking workflows. Database changes are minimal (1 migration for MTG-029, 1 enum update for MTG-004).

**Tech Stack:** Next.js 16 + Prisma 6 + TanStack Query + Server Actions + shadcn/ui

---

## Pre-Flight: Backlog Status Summary

| # | Item | Status | Action |
|---|------|--------|--------|
| MTG-001–002 | Balance Sheet / Bank Recon | **FIXED** | None |
| MTG-003 | Bank Recon detail slow | **PARTIAL** | Task 1 |
| MTG-004 | Cashflow funding auto-pull | **PARTIAL** | Task 2 |
| MTG-005–006 | Transaction overlap / Payment methods | **FIXED** | None |
| MTG-007 | Cashflow Planning Board | **FIXED** | None |
| MTG-008 | CSV BCA upload | **BATCH 2** | Deferred |
| MTG-009–010 | DC Notes / Fiscal Period | **FIXED** | None |
| MTG-011 | Edit History / Versioning | **PARTIAL** | Task 3 |
| MTG-012 | Export reports | **FIXED** | None |
| MTG-013–025 | Manufacturing bugs (all) | **FIXED** | None |
| MTG-026 | Loading optimization | **FIXED** | None |
| MTG-027 | Database reset script | **PARTIAL** | Task 4 |
| MTG-028 | AP Payment expand | **FIXED** | None |
| MTG-029 | Invoicing from PR | **NOT DONE** | Task 5 |
| MTG-030 | Balance sheet layout | **FIXED** | None |

**Score before this plan: 23/30 FIXED, 4 PARTIAL, 1 NOT DONE, 1 PENDING, 1 BATCH 2**
**Target after this plan: 28/30 FIXED (MTG-008 deferred to batch 2, MTG-024 pending team decision)**

---

## Task 1: MTG-003 — Bank Reconciliation Detail Pagination (P1)

**Files:**
- Modify: `lib/actions/finance-reconciliation.ts` — `getReconciliationDetail()`
- Modify: `components/finance/bank-reconciliation-view.tsx` — add "Load More"
- Modify: `hooks/use-reconciliation.ts` — pass pagination params

### Step 1: Add pagination params to `getReconciliationDetail`

Open `lib/actions/finance-reconciliation.ts`, find `getReconciliationDetail`. Add `skip` and `take` params:

```typescript
export async function getReconciliationDetail(
    reconciliationId: string,
    skip = 0,
    take = 100,
) {
    // ... existing auth ...

    const bankItems = await prisma.bankReconciliationItem.findMany({
        where: { reconciliationId },
        orderBy: { date: "asc" },
        skip,
        take: take + 1, // fetch 1 extra to detect hasMore
    })

    const hasMore = bankItems.length > take
    const items = hasMore ? bankItems.slice(0, take) : bankItems

    // ... rest of function ...

    return {
        // ... existing return fields ...
        items,         // paginated
        hasMore,       // new field
        nextSkip: skip + take,  // new field
    }
}
```

### Step 2: Update the reconciliation hook

In `hooks/use-reconciliation.ts`, update the detail query to accept pagination:

```typescript
// Add useInfiniteQuery or manual pagination state
const [detailSkip, setDetailSkip] = useState(0)
const DETAIL_PAGE_SIZE = 100

// In the detail fetch callback:
const detail = await getReconciliationDetail(id, detailSkip, DETAIL_PAGE_SIZE)
```

### Step 3: Add "Muat Lagi" button in view component

In `components/finance/bank-reconciliation-view.tsx`, after the items list:

```tsx
{detail?.hasMore && (
    <button
        onClick={() => loadMore()}
        className="w-full py-2 text-[10px] font-bold text-blue-600 hover:bg-blue-50 border border-dashed border-blue-300"
    >
        Muat Lagi ({detail.nextSkip}+ item)
    </button>
)}
```

### Step 4: Verify

Run: `npx tsc --noEmit 2>&1 | grep -i reconciliation`
Expected: 0 errors in reconciliation files

### Step 5: Commit

```bash
git add lib/actions/finance-reconciliation.ts hooks/use-reconciliation.ts components/finance/bank-reconciliation-view.tsx
git commit -m "perf(recon): add pagination to reconciliation detail view (MTG-003)"
```

---

## Task 2: MTG-004 — Cashflow Funding Activity Auto-Pull (P1)

**Files:**
- Modify: `prisma/schema.prisma` — add enum values to `CashflowCategory`
- Modify: `lib/actions/finance-cashflow.ts` — add funding helper functions
- Migration: `npx prisma migrate dev --name "add-cashflow-funding-categories"`

### Step 1: Add enum values to CashflowCategory

In `prisma/schema.prisma`, find `enum CashflowCategory` and add:

```prisma
enum CashflowCategory {
    AR_INVOICE
    AP_INVOICE
    PO_DIRECT
    PAYROLL
    BPJS
    PETTY_CASH
    RECURRING
    BUDGET
    ACTUAL
    MANUAL
    // New funding categories
    FUNDING_CAPITAL     // Modal masuk dari pemilik
    EQUITY_WITHDRAWAL   // Dividen / penarikan pemilik
    LOAN_DISBURSEMENT   // Pencairan pinjaman
    LOAN_REPAYMENT      // Pembayaran cicilan pinjaman
}
```

### Step 2: Run migration

```bash
npx prisma migrate dev --name "add-cashflow-funding-categories"
npx prisma generate
```

### Step 3: Add funding helper functions

In `lib/actions/finance-cashflow.ts`, add 4 helper functions before `getCashflowPlanData`:

```typescript
/** Auto-pull capital injections from EQUITY accounts (3xxx) */
async function getCapitalItems(monthStart: Date, monthEnd: Date) {
    const entries = await prisma.journalLine.findMany({
        where: {
            journalEntry: {
                date: { gte: monthStart, lte: monthEnd },
                status: "POSTED",
            },
            account: { type: "EQUITY" },
            credit: { gt: 0 },  // Credit to equity = capital in
        },
        include: {
            account: { select: { name: true, code: true } },
            journalEntry: { select: { reference: true, date: true, description: true } },
        },
    })
    return entries.map(e => ({
        description: `Modal: ${e.account.name} — ${e.journalEntry.description || e.journalEntry.reference || ""}`,
        amount: Number(e.credit),
        date: e.journalEntry.date,
        direction: "IN" as const,
        category: "FUNDING_CAPITAL" as const,
        source: "auto",
    }))
}

/** Auto-pull equity withdrawals from EQUITY accounts (3xxx) */
async function getEquityWithdrawalItems(monthStart: Date, monthEnd: Date) {
    const entries = await prisma.journalLine.findMany({
        where: {
            journalEntry: {
                date: { gte: monthStart, lte: monthEnd },
                status: "POSTED",
            },
            account: { type: "EQUITY" },
            debit: { gt: 0 },  // Debit to equity = withdrawal
        },
        include: {
            account: { select: { name: true, code: true } },
            journalEntry: { select: { reference: true, date: true, description: true } },
        },
    })
    return entries.map(e => ({
        description: `Penarikan: ${e.account.name} — ${e.journalEntry.description || ""}`,
        amount: Number(e.debit),
        date: e.journalEntry.date,
        direction: "OUT" as const,
        category: "EQUITY_WITHDRAWAL" as const,
        source: "auto",
    }))
}

/** Auto-pull loan disbursements from LIABILITY accounts */
async function getLoanDisbursementItems(monthStart: Date, monthEnd: Date) {
    const entries = await prisma.journalLine.findMany({
        where: {
            journalEntry: {
                date: { gte: monthStart, lte: monthEnd },
                status: "POSTED",
            },
            account: {
                type: "LIABILITY",
                code: { startsWith: "23" },  // Long-term debt accounts
            },
            credit: { gt: 0 },  // Credit to liability = new loan
        },
        include: {
            account: { select: { name: true, code: true } },
            journalEntry: { select: { reference: true, date: true, description: true } },
        },
    })
    return entries.map(e => ({
        description: `Pinjaman: ${e.account.name} — ${e.journalEntry.description || ""}`,
        amount: Number(e.credit),
        date: e.journalEntry.date,
        direction: "IN" as const,
        category: "LOAN_DISBURSEMENT" as const,
        source: "auto",
    }))
}

/** Auto-pull loan repayments from LIABILITY accounts */
async function getLoanRepaymentItems(monthStart: Date, monthEnd: Date) {
    const entries = await prisma.journalLine.findMany({
        where: {
            journalEntry: {
                date: { gte: monthStart, lte: monthEnd },
                status: "POSTED",
            },
            account: {
                type: "LIABILITY",
                code: { startsWith: "23" },
            },
            debit: { gt: 0 },  // Debit to liability = repayment
        },
        include: {
            account: { select: { name: true, code: true } },
            journalEntry: { select: { reference: true, date: true, description: true } },
        },
    })
    return entries.map(e => ({
        description: `Cicilan: ${e.account.name} — ${e.journalEntry.description || ""}`,
        amount: Number(e.debit),
        date: e.journalEntry.date,
        direction: "OUT" as const,
        category: "LOAN_REPAYMENT" as const,
        source: "auto",
    }))
}
```

### Step 4: Wire into getCashflowPlanData

In `getCashflowPlanData()`, add the 4 new calls to the existing `Promise.all`:

```typescript
const [
    arItems, apItems, poItems, payrollItems, bpjsItems,
    pettyCashItems, recurringItems, budgetItems, actualItems,
    // New:
    capitalItems, withdrawalItems, loanInItems, loanOutItems,
] = await Promise.all([
    // ... existing calls ...
    getCapitalItems(monthStart, monthEnd),
    getEquityWithdrawalItems(monthStart, monthEnd),
    getLoanDisbursementItems(monthStart, monthEnd),
    getLoanRepaymentItems(monthStart, monthEnd),
])

// Merge into autoItems:
const autoItems = [
    ...arItems, ...apItems, ...poItems, ...payrollItems,
    ...bpjsItems, ...pettyCashItems, ...recurringItems,
    ...budgetItems, ...actualItems,
    // New:
    ...capitalItems, ...withdrawalItems, ...loanInItems, ...loanOutItems,
]
```

### Step 5: Update planning board to show funding section

In `components/finance/cashflow-planning-board.tsx`, add a "Pendanaan" section label for funding-category items in the table/list.

### Step 6: Verify

```bash
npx tsc --noEmit 2>&1 | grep -i cashflow
npx vitest run 2>&1 | tail -5
```

### Step 7: Commit

```bash
git add prisma/schema.prisma prisma/migrations/ lib/actions/finance-cashflow.ts components/finance/cashflow-planning-board.tsx
git commit -m "feat(cashflow): auto-pull funding, loan, equity activities (MTG-004)"
```

---

## Task 3: MTG-011 — Activate Edit History / Revision Timeline UI (P2)

**Files:**
- Create: `components/shared/revision-history-timeline.tsx`
- Modify: `app/sales/orders/[id]/page.tsx` — add revision tab/section
- Modify: `app/procurement/orders/[id]/page.tsx` — add revision tab/section
- Confirm: `lib/actions/order-amendments.ts` already writes revision data (no changes needed)

### Step 1: Check that revision data is being written

Read `lib/actions/order-amendments.ts` to confirm `amendSalesOrder` and `amendPurchaseOrder` are writing `revisionHistory` JSON. This is already implemented — we just need the UI.

### Step 2: Create shared revision timeline component

Create `components/shared/revision-history-timeline.tsx`:

```tsx
"use client"

import { formatDistanceToNow, format } from "date-fns"
import { id as localeId } from "date-fns/locale/id"
import { Clock, User, FileText } from "lucide-react"

interface RevisionEntry {
    revision: number
    changedAt: string
    changedBy?: string
    changedByEmail?: string
    reason?: string
    changes?: Record<string, { from: any; to: any }>
}

interface RevisionHistoryTimelineProps {
    revisions: RevisionEntry[]
}

export function RevisionHistoryTimeline({ revisions }: RevisionHistoryTimelineProps) {
    if (!revisions || revisions.length === 0) {
        return (
            <p className="text-xs text-zinc-400 font-bold py-4 text-center">
                Belum ada riwayat perubahan
            </p>
        )
    }

    const sorted = [...revisions].sort((a, b) => b.revision - a.revision)

    return (
        <div className="space-y-3">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-1">
                <Clock className="h-3 w-3" /> Riwayat Perubahan
            </h3>
            <div className="relative pl-4 border-l-2 border-zinc-200 space-y-4">
                {sorted.map((rev) => (
                    <div key={rev.revision} className="relative">
                        <div className="absolute -left-[21px] top-0.5 w-3 h-3 bg-white border-2 border-zinc-400 rounded-full" />
                        <div className="bg-white border border-zinc-200 p-3 space-y-1">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase text-zinc-600">
                                    Revisi #{rev.revision}
                                </span>
                                <span className="text-[9px] text-zinc-400 font-mono">
                                    {format(new Date(rev.changedAt), "dd MMM yyyy HH:mm", { locale: localeId })}
                                </span>
                            </div>
                            {rev.changedByEmail && (
                                <p className="text-[9px] text-zinc-400 flex items-center gap-1">
                                    <User className="h-2.5 w-2.5" /> {rev.changedByEmail}
                                </p>
                            )}
                            {rev.reason && (
                                <p className="text-[10px] text-zinc-600 font-bold flex items-center gap-1">
                                    <FileText className="h-2.5 w-2.5 text-zinc-400" /> {rev.reason}
                                </p>
                            )}
                            {rev.changes && Object.keys(rev.changes).length > 0 && (
                                <div className="mt-2 space-y-0.5">
                                    {Object.entries(rev.changes).map(([field, { from, to }]) => (
                                        <div key={field} className="text-[9px] font-mono bg-zinc-50 px-2 py-0.5">
                                            <span className="text-zinc-400">{field}:</span>{" "}
                                            <span className="text-red-500 line-through">{String(from ?? "—")}</span>
                                            {" → "}
                                            <span className="text-emerald-600 font-bold">{String(to ?? "—")}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
```

### Step 3: Add to Sales Order detail page

In `app/sales/orders/[id]/page.tsx`, after loading order data:

```tsx
import { RevisionHistoryTimeline } from "@/components/shared/revision-history-timeline"

// In the page component, after order details:
{order.revisionHistory && (
    <RevisionHistoryTimeline
        revisions={order.revisionHistory as any[]}
    />
)}
```

### Step 4: Add to Purchase Order detail page

Same pattern in `app/procurement/orders/[id]/page.tsx`:

```tsx
import { RevisionHistoryTimeline } from "@/components/shared/revision-history-timeline"

{po.revisionHistory && (
    <RevisionHistoryTimeline
        revisions={po.revisionHistory as any[]}
    />
)}
```

### Step 5: Verify

```bash
npx tsc --noEmit 2>&1 | grep -i revision
```

### Step 6: Commit

```bash
git add components/shared/revision-history-timeline.tsx app/sales/orders/*/page.tsx app/procurement/orders/*/page.tsx
git commit -m "feat(audit): add revision history timeline UI for SO and PO (MTG-011)"
```

---

## Task 4: MTG-027 — Database Reset Script (P1)

**Files:**
- Modify: `package.json` — add npm scripts
- Verify: `prisma/seed.ts` — confirm cleanup order

### Step 1: Add npm scripts to package.json

```json
{
  "scripts": {
    "db:reset": "npx prisma migrate reset --force",
    "db:seed": "npx prisma db seed",
    "db:fresh": "npx prisma migrate reset --force && echo '✓ Database reset & seeded'"
  }
}
```

### Step 2: Verify prisma seed config

Check `package.json` has the `prisma.seed` field:

```json
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

### Step 3: Test the reset command

```bash
# Dry run — just verify the command is valid
npm run db:reset -- --help
```

### Step 4: Commit

```bash
git add package.json
git commit -m "chore: add db:reset and db:fresh npm scripts (MTG-027)"
```

---

## Task 5: MTG-029 — Invoice Creation from Purchase Request (P1)

**Files:**
- Modify: `prisma/schema.prisma` — add `purchaseRequestId` to Invoice model
- Create migration: `npx prisma migrate dev --name "add-pr-link-to-invoice"`
- Modify: `lib/actions/finance-invoices.ts` — add `createBillFromPR()`
- Modify: `app/procurement/requests/[id]/page.tsx` or relevant PR detail page — add "Buat Invoice" button

### Step 1: Add purchaseRequestId to Invoice model

In `prisma/schema.prisma`, find `model Invoice` and add:

```prisma
model Invoice {
    // ... existing fields ...
    purchaseOrderId    String? @db.Uuid
    purchaseRequestId  String? @db.Uuid    // NEW
    salesOrderId       String? @db.Uuid

    // ... existing relations ...
    purchaseOrder      PurchaseOrder?   @relation(fields: [purchaseOrderId], references: [id])
    purchaseRequest    PurchaseRequest? @relation(fields: [purchaseRequestId], references: [id])  // NEW
    salesOrder         SalesOrder?      @relation(fields: [salesOrderId], references: [id])
}
```

Also add reverse relation to PurchaseRequest model:

```prisma
model PurchaseRequest {
    // ... existing fields ...
    invoices   Invoice[]  // NEW
}
```

### Step 2: Run migration

```bash
npx prisma migrate dev --name "add-pr-link-to-invoice"
npx prisma generate
```

### Step 3: Create createBillFromPR server action

In `lib/actions/finance-invoices.ts`, add:

```typescript
export async function createBillFromPR(purchaseRequestId: string) {
    "use server"
    const user = await requireAuth()

    const pr = await prisma.purchaseRequest.findUnique({
        where: { id: purchaseRequestId },
        include: {
            items: {
                include: {
                    product: { select: { name: true, costPrice: true } },
                },
            },
            supplier: { select: { id: true, name: true } },
        },
    })

    if (!pr) throw new Error("Purchase Request tidak ditemukan")

    // Check if invoice already exists for this PR
    const existing = await prisma.invoice.findFirst({
        where: { purchaseRequestId },
    })
    if (existing) throw new Error(`Invoice sudah dibuat untuk PR ini: ${existing.invoiceNumber}`)

    // Calculate total from PR items
    const items = pr.items.map((item: any) => ({
        description: item.product?.name || item.description || "Item",
        quantity: item.quantity,
        unitPrice: Number(item.estimatedUnitPrice || item.product?.costPrice || 0),
        amount: item.quantity * Number(item.estimatedUnitPrice || item.product?.costPrice || 0),
    }))

    const subtotal = items.reduce((sum: number, i: any) => sum + i.amount, 0)

    // Generate invoice number
    const count = await prisma.invoice.count({
        where: { type: "INV_IN" },
    })
    const invoiceNumber = `BILL-${String(count + 1).padStart(4, "0")}`

    const invoice = await prisma.invoice.create({
        data: {
            invoiceNumber,
            type: "INV_IN",
            status: "DRAFT",
            customerId: pr.supplier?.id || null,  // vendor as "customer" for AP
            purchaseRequestId,
            subtotal,
            taxAmount: subtotal * 0.11,  // PPN 11%
            totalAmount: subtotal * 1.11,
            balanceDue: subtotal * 1.11,
            issueDate: new Date(),
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),  // NET_30
            items: {
                create: items.map((item: any, idx: number) => ({
                    description: item.description,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    amount: item.amount,
                    sequence: idx + 1,
                })),
            },
        },
    })

    return { success: true, invoiceId: invoice.id, invoiceNumber }
}
```

### Step 4: Add button to PR detail page

In the PR detail page, add a "Buat Invoice" button:

```tsx
import { createBillFromPR } from "@/lib/actions/finance-invoices"

// In the action buttons section:
<Button
    onClick={async () => {
        try {
            const result = await createBillFromPR(pr.id)
            toast.success(`Invoice ${result.invoiceNumber} berhasil dibuat`)
            queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
            router.push(`/finance/invoices`)
        } catch (err: any) {
            toast.error(err.message)
        }
    }}
    variant="outline"
    className="h-8 text-xs font-bold rounded-none"
>
    <FileText className="h-3 w-3 mr-1" /> Buat Invoice
</Button>
```

### Step 5: Verify

```bash
npx tsc --noEmit 2>&1 | grep -i invoice
npx vitest run 2>&1 | tail -5
```

### Step 6: Commit

```bash
git add prisma/schema.prisma prisma/migrations/ lib/actions/finance-invoices.ts app/procurement/requests/
git commit -m "feat(finance): create invoice from purchase request (MTG-029)"
```

---

## Verification Checklist

After all tasks, run full verification:

```bash
npx vitest run                    # Tests pass (baseline: 459/464)
npx tsc --noEmit                  # No new TS errors
npm run lint                      # Lint clean
```

## User Verification Guide

| Task | Page | How to Test |
|------|------|-------------|
| MTG-003 | `/finance/reconciliation` | Open a large reconciliation → should load fast, show "Muat Lagi" if 100+ items |
| MTG-004 | `/finance/planning` | Check monthly planning → should show Pendanaan section with auto-pulled equity/loan entries |
| MTG-011 | `/sales/orders/[id]` or `/procurement/orders/[id]` | Amend an order → revision timeline appears showing what changed |
| MTG-027 | Terminal | Run `npm run db:fresh` → database resets and seeds cleanly |
| MTG-029 | `/procurement/requests/[id]` | Click "Buat Invoice" on a PR → invoice created in `/finance/invoices` |
