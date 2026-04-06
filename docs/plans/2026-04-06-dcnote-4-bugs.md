# Nota Kredit & Debit — Fix 4 Bugs

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 4 bugs related to Credit Notes (CN) and Debit Notes (DN): race condition causing disappearing items, wrong invoice status after CN discount, missing CN reduction display on invoice list, and missing "Invoice Terkait" column on CN/DN table + AR tab mislabelling.

**Architecture:** Bug 1 is a UI mutation lifecycle fix. Bug 2 is a server-action logic fix in two functions (`postDCNote` and `settleDCNote`). Bug 3 is a query+UI enhancement to show CN reductions on the invoice list. Bug 4 is a UI-only table column addition and AR label improvement.

**Tech Stack:** Next.js, React 19, TanStack Query, Prisma, server actions.

---

## Audit Summary

| Area | Finding |
|------|---------|
| CN/DN mutations | `handlePost`/`handleVoid` in `credit-notes/page.tsx` use `await` correctly before `invalidateAll()`. Dialog `handleSubmit` also uses `await`. No missing `await` found — race condition is likely from multiple rapid invalidations or stale TanStack Query cache. |
| Invoice status logic | `postDCNote()` line 859-865: sets PARTIAL for ALL CN/DN types when `balanceDue < totalAmount`. No distinction between discount-CN and payment-CN. Same in `settleDCNote()` line 947-952. |
| Invoice list | Shows `formatIDR(invoice.amount)` + optional "Sisa" line. No CN reduction info. Invoice detail already shows CN/DN settlements in a "Penyesuaian" section. |
| CN/DN table | 10 columns: No. Nota, Tipe, Tanggal, Pihak, Alasan, Subtotal, PPN, Total, Status, Aksi. `originalInvoice` is included in query but NOT shown in table. |
| AR tab | Shows AR aging KPIs + Penerimaan/Nota Kredit tabs. No "Dibayar vs CN" distinction — balanceDue reduction is treated as one bucket. |
| `DCNoteReasonCode` enum | All 15 reason codes are RET_*, ADJ_*, SVC_*, ORD_* prefixed. NONE are "payment" type — CN/DN is always a discount/return/adjustment, never a payment. |

### Key Insight: Bug 2 Simplification

Looking at the `DCNoteReasonCode` enum, there is NO payment-type reason. CN/DN are ALWAYS price adjustments, returns, or discounts. This means:
- A CN should NEVER change invoice status to PARTIAL (that's for actual payments)
- The fix is simple: CN/DN settlements should reduce `balanceDue` but keep status as ISSUED (until actual payment arrives)
- If CN fully covers the invoice, status should go to PAID (customer owes nothing)

---

## File Map

| File | Action | Bug |
|------|--------|----|
| `app/finance/credit-notes/page.tsx` | Modify | Bug 1 (stabilize list), Bug 4A (add Invoice column) |
| `lib/actions/finance-dcnotes.ts` | Modify | Bug 2 (fix invoice status logic in `postDCNote` + `settleDCNote`) |
| `lib/actions/finance-invoices.ts` | Modify | Bug 3 (include dcNoteSettlements in kanban query) |
| `app/finance/invoices/invoices-client.tsx` | Modify | Bug 3 (show CN reduction in amount column) |
| `app/finance/receivables/receivables-client.tsx` | Modify | Bug 4B (AR aging KPI clarity — minor) |

---

## Task 1: Fix CN/DN list race condition (Bug 1)

**Files:**
- Modify: `app/finance/credit-notes/page.tsx` (lines 134-143, 145-178)

The mutation pattern is technically correct (await before invalidate). The race condition is likely caused by:
1. Multiple `invalidateQueries` calls firing simultaneously, causing multiple refetches that overwrite each other
2. The settlement dialog also invalidates dcNotes causing a second refetch wave

**Fix:** Consolidate invalidations and add `refetchType: 'none'` for secondary caches, letting only the primary query refetch.

**Step 1: Update invalidateAll to use a single await**

Replace the fire-and-forget invalidation calls with a single coordinated invalidation:

```typescript
const invalidateAll = async () => {
    // Primary — refetch immediately
    await queryClient.invalidateQueries({ queryKey: queryKeys.dcNotes.all })
    // Secondary — mark stale but don't refetch until navigated to
    queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all, refetchType: 'none' })
    queryClient.invalidateQueries({ queryKey: queryKeys.journal.all, refetchType: 'none' })
    queryClient.invalidateQueries({ queryKey: queryKeys.bills.all, refetchType: 'none' })
    queryClient.invalidateQueries({ queryKey: queryKeys.financeDashboard.all, refetchType: 'none' })
    queryClient.invalidateQueries({ queryKey: queryKeys.financeReports.all, refetchType: 'none' })
    queryClient.invalidateQueries({ queryKey: queryKeys.accountTransactions.all, refetchType: 'none' })
    queryClient.invalidateQueries({ queryKey: queryKeys.chartAccounts.all, refetchType: 'none' })
}
```

**Step 2: Make handlePost and handleVoid await invalidateAll**

Both handlers already await the server action, but `invalidateAll()` is called without `await`. Add `await`:

```typescript
const handlePost = async (id: string) => {
    setActionLoading(id)
    try {
        const result = await postDCNote(id)
        if (result.success) {
            toast.success("Nota berhasil diposting")
            await invalidateAll()
        } else {
            toast.error(result.error || "Gagal memposting nota")
        }
    } catch {
        toast.error("Terjadi kesalahan")
    } finally {
        setActionLoading(null)
    }
}

const handleVoid = async (id: string) => {
    if (!confirm("Yakin ingin membatalkan nota ini? Jurnal dan settlement akan di-reverse.")) return
    setActionLoading(id)
    try {
        const result = await voidDCNote(id)
        if (result.success) {
            toast.success("Nota berhasil dibatalkan")
            await invalidateAll()
        } else {
            toast.error(result.error || "Gagal membatalkan nota")
        }
    } catch {
        toast.error("Terjadi kesalahan")
    } finally {
        setActionLoading(null)
    }
}
```

**Step 3: Fix the same pattern in create-dcnote-dialog.tsx**

File: `components/finance/create-dcnote-dialog.tsx` (lines 261-265)

Same fix — await the primary invalidation, use refetchType: 'none' for secondary:

```typescript
// After success toast:
await queryClient.invalidateQueries({ queryKey: queryKeys.dcNotes.all })
queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all, refetchType: 'none' })
queryClient.invalidateQueries({ queryKey: queryKeys.journal.all, refetchType: 'none' })
queryClient.invalidateQueries({ queryKey: queryKeys.bills.all, refetchType: 'none' })
```

**Step 4: Fix in dcnote-settlement-dialog.tsx**

File: `components/finance/dcnote-settlement-dialog.tsx` (lines 93-97)

```typescript
await queryClient.invalidateQueries({ queryKey: queryKeys.dcNotes.all })
queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all, refetchType: 'none' })
queryClient.invalidateQueries({ queryKey: queryKeys.bills.all, refetchType: 'none' })
```

**Step 5: Commit**

```bash
git add app/finance/credit-notes/page.tsx components/finance/create-dcnote-dialog.tsx components/finance/dcnote-settlement-dialog.tsx
git commit -m "fix(finance): stabilize CN/DN list — await primary invalidation, defer secondary"
```

---

## Task 2: Fix invoice status after CN/DN settlement (Bug 2)

**Files:**
- Modify: `lib/actions/finance-dcnotes.ts` (lines 858-865 in `postDCNote`, lines 946-953 in `settleDCNote`)

**The problem:** Both `postDCNote` and `settleDCNote` set invoice status to `PARTIAL` when `balanceDue < totalAmount` after a CN/DN settlement. But CN/DN is NOT a payment — it's a price reduction. The invoice status should remain `ISSUED` (customer still hasn't paid) unless the CN fully covers the invoice (then PAID).

**Step 1: Fix postDCNote auto-settlement logic**

In `postDCNote()`, replace lines 858-865:

```typescript
// BEFORE (wrong):
const newBalance = invoiceBalance - settlementAmount
let newInvoiceStatus = linkedInvoice.status
if (newBalance <= 0.01) {
    newInvoiceStatus = 'PAID'
} else if (newBalance < Number(linkedInvoice.totalAmount) - 0.01) {
    newInvoiceStatus = 'PARTIAL'
}

// AFTER (correct):
// CN/DN reduces the effective amount owed — NOT a payment.
// Status stays as-is (ISSUED) unless CN fully covers the balance → PAID.
const newBalance = invoiceBalance - settlementAmount
let newInvoiceStatus = linkedInvoice.status
if (newBalance <= 0.01) {
    newInvoiceStatus = 'PAID'
}
// Do NOT set PARTIAL — CN/DN is a price adjustment, not a payment
```

**Step 2: Fix settleDCNote settlement logic**

In `settleDCNote()`, replace lines 946-953:

```typescript
// BEFORE (wrong):
const newBalance = invoiceBalance - appliedAmount
let newInvoiceStatus = invoice.status
if (newBalance <= 0.01) {
    newInvoiceStatus = 'PAID'
} else if (newBalance < Number(invoice.totalAmount) - 0.01) {
    newInvoiceStatus = 'PARTIAL'
}

// AFTER (correct):
const newBalance = invoiceBalance - appliedAmount
let newInvoiceStatus = invoice.status
if (newBalance <= 0.01) {
    newInvoiceStatus = 'PAID'
}
// Do NOT set PARTIAL — CN/DN is a price adjustment, not a payment
```

**Step 3: Commit**

```bash
git add lib/actions/finance-dcnotes.ts
git commit -m "fix(finance): CN/DN settlement keeps invoice ISSUED — only PAID when fully covered"
```

---

## Task 3: Show CN reduction in invoice list amount column (Bug 3)

**Files:**
- Modify: `lib/actions/finance-invoices.ts` (lines 140-148 — add dcNoteSettlements to kanban query)
- Modify: `app/finance/invoices/invoices-client.tsx` (lines 854-862 — show CN reduction below amount)

**Step 1: Include dcNoteSettlements sum in the kanban query**

In `getInvoiceKanbanData()`, add settlement aggregation to the query include:

```typescript
const invoices = await prisma.invoice.findMany({
    where,
    include: {
        customer: { select: { name: true } },
        supplier: { select: { name: true } },
        dcNoteSettlements: {
            select: { amount: true },
            where: {
                note: { status: { notIn: ['VOID', 'CANCELLED'] } }
            }
        },
    },
    orderBy: { issueDate: 'desc' },
    take: normalizedLimit,
})
```

Then add `cnReduction` to the base object:

```typescript
const cnReduction = inv.dcNoteSettlements.reduce(
    (sum: number, s: { amount: any }) => sum + Number(s.amount), 0
)

const base: InvoiceKanbanItem = {
    id: inv.id,
    number: inv.number,
    partyName,
    amount,
    balanceDue,
    cnReduction,  // NEW
    issueDate,
    dueDate,
    status: inv.status,
    type: inv.type,
}
```

Also update the `InvoiceKanbanItem` type to include `cnReduction?: number`.

**Step 2: Show CN reduction in the invoice list UI**

In `invoices-client.tsx`, around the amount display (line 854-862), add CN reduction info:

```tsx
<div>
    <span className={`font-mono font-black text-sm ${isOverdue ? 'text-red-600 dark:text-red-400' :
        invoice.status === 'PAID' ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-900 dark:text-zinc-100'
        }`}>
        {formatIDR(invoice.amount)}
    </span>
    {(invoice.cnReduction ?? 0) > 0 && (
        <span className="text-[9px] text-emerald-600 dark:text-emerald-400 block font-mono font-bold">
            CN: -{formatIDR(invoice.cnReduction)}
        </span>
    )}
    {invoice.balanceDue != null && invoice.balanceDue > 0 && invoice.balanceDue < invoice.amount && (
        <span className="text-[9px] text-zinc-400 block font-mono">Sisa {formatIDR(invoice.balanceDue)}</span>
    )}
</div>
```

**Step 3: Commit**

```bash
git add lib/actions/finance-invoices.ts app/finance/invoices/invoices-client.tsx
git commit -m "feat(finance): show CN/DN reduction on invoice list amount column"
```

---

## Task 4: Add "Invoice Terkait" column to CN/DN table (Bug 4A)

**Files:**
- Modify: `app/finance/credit-notes/page.tsx` (table header + table body)

The `getDCNotes()` query already includes `originalInvoice: { select: { number: true } }` (line 48 of `finance-dcnotes.ts`), so no server change needed.

**Step 1: Add column header**

In the grid-cols definition (line 401), insert a new column between "Pihak" and "Alasan":

```typescript
// BEFORE:
grid-cols-[1fr_80px_100px_1.2fr_1.2fr_110px_90px_100px_100px_120px]
["No. Nota", "Tipe", "Tanggal", "Pihak", "Alasan", "Subtotal", "PPN", "Total", "Status", "Aksi"]

// AFTER:
grid-cols-[1fr_80px_100px_1fr_120px_1fr_110px_90px_100px_100px_120px]
["No. Nota", "Tipe", "Tanggal", "Pihak", "Invoice", "Alasan", "Subtotal", "PPN", "Total", "Status", "Aksi"]
```

**Step 2: Add column data cell**

After the Pihak column (after line 467), insert:

```tsx
{/* Invoice Terkait */}
<div className="truncate">
    {note.originalInvoice?.number ? (
        <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
            {note.originalInvoice.number}
        </span>
    ) : (
        <span className="text-xs text-zinc-300 dark:text-zinc-600">—</span>
    )}
</div>
```

**Step 3: Update the grid-cols on the row too**

The row (line 439) also has the same `grid-cols-[...]` — update to match.

**Step 4: Commit**

```bash
git add app/finance/credit-notes/page.tsx
git commit -m "feat(finance): add Invoice Terkait column to CN/DN table"
```

---

## Task 5: Fix AR tab — distinguish CN reduction from payment (Bug 4B)

**Files:**
- Modify: `components/finance/nota-kredit-tab.tsx` (table: add Invoice column)

The AR receivables page at `/finance/receivables` has two tabs. The "Nota Kredit" tab currently shows a simple table (No, Customer, Alasan, Jumlah, Status, Tanggal, Aksi) using the legacy `useCreditDebitNotes()` hook. The aging KPI strip shows total AR balance — it already uses `balanceDue` which naturally reflects CN reductions. The AR KPI strip doesn't show "Dibayar" anywhere, so Bug 4B's concern about "DIBAYAR" label is actually about the invoice list (fixed in Bug 3).

For this task, improve the Nota Kredit tab to show the linked invoice:

**Step 1: Read the current table structure**

The `NotaKreditTab` table columns (line 145-151):
```
No | Customer | Alasan | Jumlah | Status | Tanggal | Aksi
```

**Step 2: Add Invoice column**

Update the table header to add "Invoice" between "Customer" and "Alasan":

```tsx
<TableHead className="text-[10px] font-black uppercase tracking-widest">No</TableHead>
<TableHead className="text-[10px] font-black uppercase tracking-widest">Customer</TableHead>
<TableHead className="text-[10px] font-black uppercase tracking-widest">Invoice</TableHead>  <!-- NEW -->
<TableHead className="text-[10px] font-black uppercase tracking-widest">Alasan</TableHead>
```

And add the cell in the row (this uses legacy data which may not have the invoice number — check the data shape).

**Step 3: Commit**

```bash
git add components/finance/nota-kredit-tab.tsx
git commit -m "feat(finance): add Invoice column to AR Nota Kredit tab"
```

---

## Task 6: Final verification

**Step 1: Run tests**

```bash
npx vitest run
```

Expected: No new test failures.

**Step 2: Type check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: No new type errors.

**Step 3: Manual verification**

1. **Bug 1:** Open `/finance/credit-notes`. Create a CN with "Simpan & Posting". Verify it appears immediately and stays visible on page.
2. **Bug 2:** Create CN against invoice INV-2026-0014 (or any ISSUED invoice). Post it. Check invoice status stays ISSUED (not PARTIAL). If CN fully covers invoice, status should be PAID.
3. **Bug 3:** Open `/finance/invoices`. Find the invoice with a CN applied. Verify "CN: -Rp xxx" appears below the amount.
4. **Bug 4A:** Open `/finance/credit-notes`. Verify new "Invoice" column shows linked invoice number.
5. **Bug 4B:** Open `/finance/receivables` → Nota Kredit tab. Verify Invoice column is visible.
