# AR/AP Aging Expandable Invoice Detail — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add expandable invoice-level detail rows to the AR and AP aging report tables, so users can see individual invoices per customer/supplier without leaving the report.

**Architecture:** Nest invoice detail arrays inside each `byCustomer`/`bySupplier` entry in the API response (no new endpoints). Frontend uses React state (`Set<string>`) to track which rows are expanded, rendering a sub-table with chevron toggle.

**Tech Stack:** Prisma (Invoice model fields: id, number, issueDate, totalAmount, balanceDue, status), React useState, Lucide ChevronRight/ChevronDown icons, shadcn Table components.

---

### Task 1: Add invoice fields to AR aging API

**Files:**
- Modify: `app/api/finance/reports/route.ts:353-414`

**Step 1: Expand Prisma select to include extra fields**

In `fetchARaging()` at line 358, add `select` to the `findMany`:
```typescript
const openInvoices = await prisma.invoice.findMany({
    where,
    select: {
        id: true,
        number: true,
        issueDate: true,
        dueDate: true,
        totalAmount: true,
        balanceDue: true,
        status: true,
        customer: { select: { id: true, name: true, code: true } },
    },
    orderBy: { dueDate: 'asc' },
})
```

**Step 2: Add `invoices` array to customerMap type**

Change the customerMap type (line 366) to include:
```typescript
invoices: Array<{
    id: string; invoiceNumber: string; issueDate: Date; dueDate: Date
    totalAmount: number; paidAmount: number; balanceDue: number
    daysOverdue: number; bucket: string; status: string
}>
```

Initialize `invoices: []` in the default object (line 393).

**Step 3: Push invoice detail into customer's invoices array**

After `customerMap.set(custId, existing)` (line 402), add:
```typescript
existing.invoices.push({
    id: inv.id,
    invoiceNumber: inv.number,
    issueDate: inv.issueDate,
    dueDate: due,
    totalAmount: Number(inv.totalAmount),
    paidAmount: Number(inv.totalAmount) - balance,
    balanceDue: balance,
    daysOverdue,
    bucket,
    status: inv.status,
})
```

**Step 4: Sort invoices within each customer by daysOverdue desc**

Before the return statement (line 409), add:
```typescript
for (const cust of customerMap.values()) {
    cust.invoices.sort((a, b) => b.daysOverdue - a.daysOverdue)
}
```

**Step 5: Verify build**

Run: `npx tsc --noEmit 2>&1 | grep "route.ts"` — should show no new errors from this file.

**Step 6: Commit**

```bash
git add app/api/finance/reports/route.ts
git commit -m "feat(finance): nest invoice detail in AR aging byCustomer response"
```

---

### Task 2: Add bill fields to AP aging API

**Files:**
- Modify: `app/api/finance/reports/route.ts:418-479`

**Step 1: Expand Prisma select for AP**

Same pattern as Task 1 but for `fetchAPaging()` at line 423:
```typescript
const openBills = await prisma.invoice.findMany({
    where,
    select: {
        id: true,
        number: true,
        issueDate: true,
        dueDate: true,
        totalAmount: true,
        balanceDue: true,
        status: true,
        supplier: { select: { id: true, name: true, code: true } },
    },
    orderBy: { dueDate: 'asc' },
})
```

**Step 2: Add `bills` array to supplierMap type**

Change supplierMap type (line 431) to include:
```typescript
bills: Array<{
    id: string; billNumber: string; issueDate: Date; dueDate: Date
    totalAmount: number; paidAmount: number; balanceDue: number
    daysOverdue: number; bucket: string; status: string
}>
```

Initialize `bills: []` in default object (line 458).

**Step 3: Push bill detail into supplier's bills array**

After `supplierMap.set(suppId, existing)` (line 467):
```typescript
existing.bills.push({
    id: bill.id,
    billNumber: bill.number,
    issueDate: bill.issueDate,
    dueDate: due,
    totalAmount: Number(bill.totalAmount),
    paidAmount: Number(bill.totalAmount) - balance,
    balanceDue: balance,
    daysOverdue,
    bucket,
    status: bill.status,
})
```

**Step 4: Sort bills within each supplier**

Before the return (line 474):
```typescript
for (const supp of supplierMap.values()) {
    supp.bills.sort((a, b) => b.daysOverdue - a.daysOverdue)
}
```

**Step 5: Verify build**

Run: `npx tsc --noEmit 2>&1 | grep "route.ts"` — no new errors.

**Step 6: Commit**

```bash
git add app/api/finance/reports/route.ts
git commit -m "feat(finance): nest bill detail in AP aging bySupplier response"
```

---

### Task 3: Add ChevronDown import and expand state to reports page

**Files:**
- Modify: `app/finance/reports/page.tsx:2,21`

**Step 1: Add ChevronDown to lucide imports**

At line 21, change:
```typescript
    ChevronRight,
```
to:
```typescript
    ChevronRight,
    ChevronDown,
```

**Step 2: Add Link import from next/link**

Check if `Link` is already imported. If not, add:
```typescript
import Link from "next/link"
```

**Step 3: Add expand state**

After the existing `useState` declarations in the component body, add:
```typescript
const [expandedAR, setExpandedAR] = useState<Set<string>>(new Set())
const [expandedAP, setExpandedAP] = useState<Set<string>>(new Set())
```

Add toggle helpers:
```typescript
const toggleAR = (id: string) => setExpandedAR(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
})
const toggleAP = (id: string) => setExpandedAP(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
})
```

**Step 4: Verify build**

Run: `npx tsc --noEmit 2>&1 | grep "reports/page"` — no new errors.

**Step 5: Commit**

```bash
git add app/finance/reports/page.tsx
git commit -m "feat(finance): add expand/collapse state for aging detail rows"
```

---

### Task 4: Render expandable AR aging rows with invoice sub-table

**Files:**
- Modify: `app/finance/reports/page.tsx:978-988`

**Step 1: Replace the AR customer map block**

Replace lines 978-988 (the `arAgingData.byCustomer.map(...)`) with:

```tsx
arAgingData.byCustomer.map((cust: any, idx: number) => {
    const isExpanded = expandedAR.has(cust.customerId)
    return (
        <React.Fragment key={idx}>
            <TableRow className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <TableCell className="font-bold text-sm">
                    <button
                        onClick={() => toggleAR(cust.customerId)}
                        className="flex items-center gap-1.5 hover:text-orange-600 transition-colors"
                    >
                        {isExpanded
                            ? <ChevronDown className="h-3.5 w-3.5 text-orange-500" />
                            : <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />}
                        {cust.customerName}
                        <span className="text-[9px] font-mono text-zinc-400 ml-1">({cust.invoiceCount})</span>
                    </button>
                </TableCell>
                <TableCell className="text-right font-mono text-sm">{cust.current > 0 ? formatIDR(cust.current) : "-"}</TableCell>
                <TableCell className="text-right font-mono text-sm">{cust.d1_30 > 0 ? formatIDR(cust.d1_30) : "-"}</TableCell>
                <TableCell className="text-right font-mono text-sm">{cust.d31_60 > 0 ? formatIDR(cust.d31_60) : "-"}</TableCell>
                <TableCell className="text-right font-mono text-sm">{cust.d61_90 > 0 ? formatIDR(cust.d61_90) : "-"}</TableCell>
                <TableCell className="text-right font-mono text-sm text-red-600">{cust.d90_plus > 0 ? formatIDR(cust.d90_plus) : "-"}</TableCell>
                <TableCell className="text-right font-mono text-sm font-black">{formatIDR(cust.total)}</TableCell>
            </TableRow>
            {isExpanded && cust.invoices?.map((inv: any, j: number) => (
                <TableRow key={`inv-${j}`} className="bg-orange-50/50 dark:bg-orange-900/10">
                    <TableCell className="pl-8 text-xs" colSpan={1}>
                        <Link
                            href={`/finance/invoices?highlight=${inv.id}`}
                            className="text-orange-600 hover:underline font-mono font-bold"
                        >
                            {inv.invoiceNumber}
                        </Link>
                    </TableCell>
                    <TableCell className="text-right text-[10px] font-mono text-zinc-500">
                        {new Date(inv.issueDate).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                    </TableCell>
                    <TableCell className="text-right text-[10px] font-mono text-zinc-500">
                        {new Date(inv.dueDate).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                    </TableCell>
                    <TableCell className="text-right text-[10px] font-mono">{formatIDR(inv.totalAmount)}</TableCell>
                    <TableCell className="text-right text-[10px] font-mono text-emerald-600">{formatIDR(inv.paidAmount)}</TableCell>
                    <TableCell className="text-right text-[10px] font-mono text-orange-600 font-bold">{formatIDR(inv.balanceDue)}</TableCell>
                    <TableCell className="text-right">
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-sm ${
                            inv.status === 'OVERDUE' ? 'bg-red-100 text-red-700' :
                            inv.status === 'PARTIAL' ? 'bg-amber-100 text-amber-700' :
                            'bg-blue-100 text-blue-700'
                        }`}>{inv.status}</span>
                    </TableCell>
                </TableRow>
            ))}
        </React.Fragment>
    )
})
```

**Step 2: Update AR table header to match sub-table columns**

Replace AR table header (lines 960-968) — keep same column count (7) but update labels to work for both parent and child rows:

```tsx
<TableRow className="bg-zinc-50 dark:bg-zinc-800">
    <TableHead className="text-[10px] font-black uppercase tracking-widest">Pelanggan</TableHead>
    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Current / Tgl Invoice</TableHead>
    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">1-30 / Jatuh Tempo</TableHead>
    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">31-60 / Total</TableHead>
    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">61-90 / Dibayar</TableHead>
    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">90+ / Sisa</TableHead>
    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Total / Status</TableHead>
</TableRow>
```

**Step 3: Verify build**

Run: `npx tsc --noEmit 2>&1 | grep "reports/page"` — no new errors.

**Step 4: Commit**

```bash
git add app/finance/reports/page.tsx
git commit -m "feat(finance): add expandable invoice detail rows to AR aging table"
```

---

### Task 5: Render expandable AP aging rows with bill sub-table

**Files:**
- Modify: `app/finance/reports/page.tsx:1051-1061`

**Step 1: Replace the AP supplier map block**

Same pattern as Task 4 but for AP. Replace lines 1051-1061 with:

```tsx
apAgingData.bySupplier.map((supp: any, idx: number) => {
    const isExpanded = expandedAP.has(supp.supplierId)
    return (
        <React.Fragment key={idx}>
            <TableRow className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <TableCell className="font-bold text-sm">
                    <button
                        onClick={() => toggleAP(supp.supplierId)}
                        className="flex items-center gap-1.5 hover:text-red-600 transition-colors"
                    >
                        {isExpanded
                            ? <ChevronDown className="h-3.5 w-3.5 text-red-500" />
                            : <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />}
                        {supp.supplierName}
                        <span className="text-[9px] font-mono text-zinc-400 ml-1">({supp.billCount})</span>
                    </button>
                </TableCell>
                <TableCell className="text-right font-mono text-sm">{supp.current > 0 ? formatIDR(supp.current) : "-"}</TableCell>
                <TableCell className="text-right font-mono text-sm">{supp.d1_30 > 0 ? formatIDR(supp.d1_30) : "-"}</TableCell>
                <TableCell className="text-right font-mono text-sm">{supp.d31_60 > 0 ? formatIDR(supp.d31_60) : "-"}</TableCell>
                <TableCell className="text-right font-mono text-sm">{supp.d61_90 > 0 ? formatIDR(supp.d61_90) : "-"}</TableCell>
                <TableCell className="text-right font-mono text-sm text-red-600">{supp.d90_plus > 0 ? formatIDR(supp.d90_plus) : "-"}</TableCell>
                <TableCell className="text-right font-mono text-sm font-black">{formatIDR(supp.total)}</TableCell>
            </TableRow>
            {isExpanded && supp.bills?.map((bill: any, j: number) => (
                <TableRow key={`bill-${j}`} className="bg-red-50/50 dark:bg-red-900/10">
                    <TableCell className="pl-8 text-xs" colSpan={1}>
                        <Link
                            href={`/finance/bills?highlight=${bill.id}`}
                            className="text-red-600 hover:underline font-mono font-bold"
                        >
                            {bill.billNumber}
                        </Link>
                    </TableCell>
                    <TableCell className="text-right text-[10px] font-mono text-zinc-500">
                        {new Date(bill.issueDate).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                    </TableCell>
                    <TableCell className="text-right text-[10px] font-mono text-zinc-500">
                        {new Date(bill.dueDate).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                    </TableCell>
                    <TableCell className="text-right text-[10px] font-mono">{formatIDR(bill.totalAmount)}</TableCell>
                    <TableCell className="text-right text-[10px] font-mono text-emerald-600">{formatIDR(bill.paidAmount)}</TableCell>
                    <TableCell className="text-right text-[10px] font-mono text-red-600 font-bold">{formatIDR(bill.balanceDue)}</TableCell>
                    <TableCell className="text-right">
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-sm ${
                            bill.status === 'OVERDUE' ? 'bg-red-100 text-red-700' :
                            bill.status === 'PARTIAL' ? 'bg-amber-100 text-amber-700' :
                            'bg-blue-100 text-blue-700'
                        }`}>{bill.status}</span>
                    </TableCell>
                </TableRow>
            ))}
        </React.Fragment>
    )
})
```

**Step 2: Update AP table header**

Same dual-label pattern as AR (lines 1033-1041):
```tsx
<TableRow className="bg-zinc-50 dark:bg-zinc-800">
    <TableHead className="text-[10px] font-black uppercase tracking-widest">Pemasok</TableHead>
    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Current / Tgl Bill</TableHead>
    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">1-30 / Jatuh Tempo</TableHead>
    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">31-60 / Total</TableHead>
    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">61-90 / Dibayar</TableHead>
    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">90+ / Sisa</TableHead>
    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Total / Status</TableHead>
</TableRow>
```

**Step 3: Verify build + tests**

Run: `npx tsc --noEmit 2>&1 | grep "reports/page"` — no new errors.
Run: `npx vitest run` — 430 pass, 5 pre-existing fail (unchanged).

**Step 4: Commit**

```bash
git add app/finance/reports/page.tsx
git commit -m "feat(finance): add expandable bill detail rows to AP aging table"
```

---

### Task 6: Final verification

**Step 1:** Run `npx tsc --noEmit 2>&1 | grep -E "route.ts|reports/page"` — no new errors.

**Step 2:** Run `npx vitest run` — 430 pass, 5 pre-existing fail.

**Step 3:** Manual test at `/finance/reports` → AR Aging:
- Each customer row has `▸` chevron
- Click chevron → expands to show invoices with link, dates, amounts, status
- Click again → collapses
- Invoice link navigates to `/finance/invoices?highlight={id}`

**Step 4:** Manual test at `/finance/reports` → AP Aging:
- Same behavior for suppliers/bills

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat(finance): expandable invoice/bill detail in AR/AP aging reports"
```
