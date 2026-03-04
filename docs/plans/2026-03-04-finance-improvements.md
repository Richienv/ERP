# Finance Module Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix invoice-to-GL data consistency, add multi-select checkbox filters, add petty cash module, fix invoice DRAFT flow, and fix reconciliation button placement.

**Architecture:**
- All invoices (from SO, PO, or manual) start as DRAFT — no GL entry until payment
- Reusable `<CheckboxFilter>` popover component for multi-select filtering
- New `PettyCashTransaction` Prisma model with auto GL journal posting
- New `/finance/petty-cash` page with TanStack Query

**Tech Stack:** Next.js App Router, Prisma, TanStack Query, shadcn/ui (Popover, Checkbox), Radix UI

---

## Task 1: Fix `createInvoiceFromSalesOrder` — Always DRAFT, No Auto GL

**Files:**
- Modify: `lib/actions/finance-invoices.ts:595-651`

**Step 1: Change status from ISSUED to DRAFT and remove GL posting**

In `createInvoiceFromSalesOrder()`, line 601: change `status: 'ISSUED'` → `status: 'DRAFT'`

Remove the GL posting block (lines 636-651) entirely — GL entries should only be created when payment is recorded.

```typescript
// Line 601: Change this
status: 'DRAFT',  // was 'ISSUED'

// Lines 636-651: REMOVE this entire block:
// // Post GL journal entry OUTSIDE the main transaction...
// if (result.success && result._gl) { ... }
```

Also remove the `_gl` property from the return object (lines 627-631) since it's no longer needed.

**Step 2: Verify `recordPendingBillFromPO` already uses DRAFT**

In same file, around line 493 — confirm `status: 'DRAFT'` already. No change needed if so.

**Step 3: Verify `recordInvoicePayment` includes invoice reference in GL entry**

In same file, lines 863-884 — the journal entry `reference` field currently uses `txResult.paymentNumber`. Add the invoice number too:

```typescript
// Line 866-867: Update reference to include invoice number
reference: `${txResult.paymentNumber} — ${txResult.invoiceNumber}`,
```

Do the same for the INV_IN branch (line 878).

**Step 4: Commit**

```bash
git add lib/actions/finance-invoices.ts
git commit -m "fix(invoices): all invoices start as DRAFT, remove auto GL on creation"
```

---

## Task 2: Create Reusable `<CheckboxFilter>` Component

**Files:**
- Create: `components/ui/checkbox-filter.tsx`

**Step 1: Create the component**

A popover button that shows checkboxes. Props: `label`, `options: {value, label}[]`, `selected: string[]`, `onChange: (selected: string[]) => void`.

```tsx
"use client"

import { useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { ChevronDown } from "lucide-react"

interface CheckboxFilterOption {
    value: string
    label: string
}

interface CheckboxFilterProps {
    label: string
    options: CheckboxFilterOption[]
    selected: string[]
    onChange: (selected: string[]) => void
}

export function CheckboxFilter({ label, options, selected, onChange }: CheckboxFilterProps) {
    const [open, setOpen] = useState(false)

    const allSelected = selected.length === options.length || selected.length === 0
    const displayText = allSelected
        ? "Semua"
        : selected.length === 1
            ? options.find(o => o.value === selected[0])?.label || selected[0]
            : `${selected.length} dipilih`

    const toggleValue = (value: string) => {
        if (selected.includes(value)) {
            onChange(selected.filter(v => v !== value))
        } else {
            onChange([...selected, value])
        }
    }

    const selectAll = () => onChange(options.map(o => o.value))
    const clearAll = () => onChange([])

    return (
        <div>
            <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1 block">{label}</label>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <button className="flex items-center gap-2 border-2 border-black h-9 px-3 bg-white text-xs font-medium min-w-[160px] justify-between hover:bg-zinc-50 transition-colors">
                        <span className="truncate">{displayText}</span>
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-[220px] p-0 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] rounded-none" align="start">
                    <div className="flex items-center justify-between px-3 py-2 border-b-2 border-zinc-100">
                        <button onClick={selectAll} className="text-[10px] font-bold text-blue-600 hover:underline">Pilih Semua</button>
                        <button onClick={clearAll} className="text-[10px] font-bold text-zinc-400 hover:underline">Hapus</button>
                    </div>
                    <div className="p-2 space-y-1 max-h-[240px] overflow-y-auto">
                        {options.map(opt => (
                            <label key={opt.value} className="flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-zinc-50 cursor-pointer">
                                <Checkbox
                                    checked={allSelected || selected.includes(opt.value)}
                                    onCheckedChange={() => {
                                        if (allSelected) {
                                            // If all selected, clicking one = select only that one
                                            onChange([opt.value])
                                        } else {
                                            toggleValue(opt.value)
                                        }
                                    }}
                                />
                                <span className="text-xs font-medium">{opt.label}</span>
                            </label>
                        ))}
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    )
}
```

**Step 2: Commit**

```bash
git add components/ui/checkbox-filter.tsx
git commit -m "feat: add reusable CheckboxFilter component"
```

---

## Task 3: Multi-Select Filters on Transaksi Akun Page

**Files:**
- Modify: `app/finance/transactions/page.tsx:299-302,572-586`

**Step 1: Change filterType state from string to string array**

```typescript
// Line 302: Change from
const [filterType, setFilterType] = useState("ALL")
// To
const [filterTypes, setFilterTypes] = useState<string[]>([])
```

**Step 2: Import and replace the Account Type dropdown with CheckboxFilter**

Add import at top:
```typescript
import { CheckboxFilter } from "@/components/ui/checkbox-filter"
```

Replace lines 572-586 (the Tipe Akun Select) with:
```tsx
<CheckboxFilter
    label="Tipe Akun"
    options={[
        { value: "ASSET", label: "Aset" },
        { value: "LIABILITY", label: "Kewajiban" },
        { value: "EQUITY", label: "Ekuitas" },
        { value: "REVENUE", label: "Pendapatan" },
        { value: "EXPENSE", label: "Beban" },
    ]}
    selected={filterTypes}
    onChange={setFilterTypes}
/>
```

**Step 3: Update the filtering logic**

Around line 374, change:
```typescript
// From
if (filterType !== "ALL") {
    result = result.filter(e => e.lines.some(l => l.accountType === filterType))
}
// To
if (filterTypes.length > 0) {
    result = result.filter(e => e.lines.some(l => filterTypes.includes(l.accountType)))
}
```

**Step 4: Commit**

```bash
git add app/finance/transactions/page.tsx
git commit -m "feat(transactions): multi-select checkbox filter for account type"
```

---

## Task 4: Multi-Select Filters on Invoices Page

**Files:**
- Modify: `app/finance/invoices/page.tsx` (filter section, around lines 378-417)

**Step 1: Replace type dropdown with CheckboxFilter**

Replace the single-select invoice type dropdown with:
```tsx
<CheckboxFilter
    label="Tipe Invoice"
    options={[
        { value: "INV_OUT", label: "Invoice Keluar" },
        { value: "INV_IN", label: "Invoice Masuk" },
    ]}
    selected={selectedTypes}
    onChange={setSelectedTypes}
/>
```

**Step 2: Add status checkbox filter**

Add a second CheckboxFilter for status:
```tsx
<CheckboxFilter
    label="Status"
    options={[
        { value: "DRAFT", label: "Draft" },
        { value: "ISSUED", label: "Terkirim" },
        { value: "OVERDUE", label: "Jatuh Tempo" },
        { value: "PAID", label: "Lunas" },
    ]}
    selected={selectedStatuses}
    onChange={setSelectedStatuses}
/>
```

**Step 3: Update URL params and data fetching to handle arrays**

Change the URL search param from `type=INV_OUT` to `types=INV_OUT,INV_IN` (comma-separated). Update `useInvoiceKanban()` hook and `getInvoiceKanbanData()` server action to accept an array of types and statuses.

**Step 4: Update client-side filtering logic to use arrays**

Filter invoices by checking `selectedTypes.includes(invoice.type)` and `selectedStatuses.includes(invoice.status)`.

**Step 5: Commit**

```bash
git add app/finance/invoices/page.tsx hooks/use-invoice-kanban.ts
git commit -m "feat(invoices): multi-select checkbox filters for type and status"
```

---

## Task 5: Petty Cash — Prisma Model + Migration

**Files:**
- Modify: `prisma/schema.prisma` (add after line 2811)

**Step 1: Add PettyCashTransaction model and enum**

```prisma
enum PettyCashType {
  TOPUP
  DISBURSEMENT
}

model PettyCashTransaction {
  id              String         @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  date            DateTime       @default(now())
  type            PettyCashType
  amount          Decimal        @db.Decimal(15, 2)
  recipientName   String?                              // Nama pemohon (for disbursements)
  description     String                               // Keterangan
  bankAccountId   String?        @db.Uuid              // Source GL account for top-ups
  bankAccount     GLAccount?     @relation("PettyCashBank", fields: [bankAccountId], references: [id])
  expenseAccountId String?       @db.Uuid              // Expense GL account for disbursements
  expenseAccount  GLAccount?     @relation("PettyCashExpense", fields: [expenseAccountId], references: [id])
  journalEntryId  String?        @db.Uuid
  journalEntry    JournalEntry?  @relation(fields: [journalEntryId], references: [id])
  balanceAfter    Decimal        @db.Decimal(15, 2)    // Running balance after this transaction
  createdAt       DateTime       @default(now())

  @@map("petty_cash_transactions")
}
```

Also add the reverse relations on `GLAccount` model:
```prisma
// In GLAccount model, add:
pettyCashBankTxns     PettyCashTransaction[] @relation("PettyCashBank")
pettyCashExpenseTxns  PettyCashTransaction[] @relation("PettyCashExpense")
```

And on `JournalEntry` model:
```prisma
// In JournalEntry model, add:
pettyCashTransaction  PettyCashTransaction?
```

**Step 2: Push schema**

```bash
npx prisma db push
```

**Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add PettyCashTransaction model"
```

---

## Task 6: Petty Cash — Server Actions

**Files:**
- Create: `lib/actions/finance-petty-cash.ts`

**Step 1: Create server actions file**

```typescript
"use server"

import { withPrismaAuth } from "@/lib/db"
import { postJournalEntry } from "./finance-gl"

// Petty Cash account code — should be in GLAccount table
const PETTY_CASH_ACCOUNT = "1050"  // Kas Kecil (Petty Cash)

export async function getPettyCashTransactions() {
    return await withPrismaAuth(async (prisma) => {
        const transactions = await prisma.pettyCashTransaction.findMany({
            orderBy: { date: "desc" },
            include: {
                bankAccount: { select: { code: true, name: true } },
                expenseAccount: { select: { code: true, name: true } },
            },
            take: 200,
        })

        // Calculate current balance from latest transaction
        const latestTx = transactions[0]
        const currentBalance = latestTx ? Number(latestTx.balanceAfter) : 0

        // Monthly summaries
        const now = new Date()
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        const thisMonth = transactions.filter(t => new Date(t.date) >= monthStart)
        const totalTopup = thisMonth.filter(t => t.type === "TOPUP").reduce((s, t) => s + Number(t.amount), 0)
        const totalDisbursement = thisMonth.filter(t => t.type === "DISBURSEMENT").reduce((s, t) => s + Number(t.amount), 0)

        return {
            success: true,
            transactions: transactions.map(t => ({
                id: t.id,
                date: t.date,
                type: t.type,
                amount: Number(t.amount),
                recipientName: t.recipientName,
                description: t.description,
                bankAccountName: t.bankAccount ? `${t.bankAccount.code} — ${t.bankAccount.name}` : null,
                expenseAccountName: t.expenseAccount ? `${t.expenseAccount.code} — ${t.expenseAccount.name}` : null,
                balanceAfter: Number(t.balanceAfter),
            })),
            currentBalance,
            totalTopup,
            totalDisbursement,
        }
    })
}

export async function topUpPettyCash(data: {
    amount: number
    bankAccountCode: string
    description: string
}) {
    return await withPrismaAuth(async (prisma) => {
        const bankAccount = await prisma.gLAccount.findUnique({ where: { code: data.bankAccountCode } })
        if (!bankAccount) throw new Error("Akun bank tidak ditemukan")

        // Get current balance
        const latest = await prisma.pettyCashTransaction.findFirst({ orderBy: { date: "desc" } })
        const currentBalance = latest ? Number(latest.balanceAfter) : 0
        const newBalance = currentBalance + data.amount

        // Create transaction
        const tx = await prisma.pettyCashTransaction.create({
            data: {
                type: "TOPUP",
                amount: data.amount,
                description: data.description || "Top up dari bank",
                bankAccountId: bankAccount.id,
                balanceAfter: newBalance,
            },
        })

        // Post GL entry: DR Petty Cash, CR Bank
        try {
            await postJournalEntry({
                description: `Top Up Peti Kas — ${data.description}`,
                date: new Date(),
                reference: `PETTY-${tx.id.slice(0, 8).toUpperCase()}`,
                lines: [
                    { accountCode: PETTY_CASH_ACCOUNT, debit: data.amount, credit: 0, description: "Top up peti kas" },
                    { accountCode: data.bankAccountCode, debit: 0, credit: data.amount, description: `Transfer ke peti kas` },
                ],
            })
        } catch (glErr) {
            console.warn("GL entry failed for petty cash top-up:", glErr)
        }

        return { success: true }
    })
}

export async function disbursePettyCash(data: {
    amount: number
    recipientName: string
    description: string
    expenseAccountCode: string
}) {
    return await withPrismaAuth(async (prisma) => {
        const expenseAccount = await prisma.gLAccount.findUnique({ where: { code: data.expenseAccountCode } })
        if (!expenseAccount) throw new Error("Akun beban tidak ditemukan")

        // Get current balance
        const latest = await prisma.pettyCashTransaction.findFirst({ orderBy: { date: "desc" } })
        const currentBalance = latest ? Number(latest.balanceAfter) : 0

        if (currentBalance < data.amount) {
            throw new Error(`Saldo peti kas tidak cukup (saldo: Rp ${currentBalance.toLocaleString("id-ID")})`)
        }

        const newBalance = currentBalance - data.amount

        const tx = await prisma.pettyCashTransaction.create({
            data: {
                type: "DISBURSEMENT",
                amount: data.amount,
                recipientName: data.recipientName,
                description: data.description,
                expenseAccountId: expenseAccount.id,
                balanceAfter: newBalance,
            },
        })

        // Post GL entry: DR Expense, CR Petty Cash
        try {
            await postJournalEntry({
                description: `Pengeluaran Peti Kas — ${data.recipientName}: ${data.description}`,
                date: new Date(),
                reference: `PETTY-${tx.id.slice(0, 8).toUpperCase()}`,
                lines: [
                    { accountCode: data.expenseAccountCode, debit: data.amount, credit: 0, description: `${data.recipientName}: ${data.description}` },
                    { accountCode: PETTY_CASH_ACCOUNT, debit: 0, credit: data.amount, description: "Pengeluaran peti kas" },
                ],
            })
        } catch (glErr) {
            console.warn("GL entry failed for petty cash disbursement:", glErr)
        }

        return { success: true }
    })
}

export async function getExpenseAccounts() {
    return await withPrismaAuth(async (prisma) => {
        const accounts = await prisma.gLAccount.findMany({
            where: { type: "EXPENSE" },
            orderBy: { code: "asc" },
            select: { code: true, name: true },
        })
        return accounts
    })
}

export async function getBankAccounts() {
    return await withPrismaAuth(async (prisma) => {
        const accounts = await prisma.gLAccount.findMany({
            where: { type: "ASSET", code: { in: ["1000", "1010", "1020", "1030"] } },
            orderBy: { code: "asc" },
            select: { code: true, name: true },
        })
        return accounts
    })
}
```

**Step 2: Commit**

```bash
git add lib/actions/finance-petty-cash.ts
git commit -m "feat(petty-cash): server actions for top-up, disbursement, and GL posting"
```

---

## Task 7: Petty Cash — Query Keys + Hook

**Files:**
- Modify: `lib/query-keys.ts:98` (add after vendorPayments)
- Create: `hooks/use-petty-cash.ts`

**Step 1: Add query keys**

```typescript
// In lib/query-keys.ts, after vendorPayments block:
pettyCash: {
    all: ["pettyCash"] as const,
    list: () => [...queryKeys.pettyCash.all, "list"] as const,
},
```

**Step 2: Create hook**

```typescript
"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getPettyCashTransactions } from "@/lib/actions/finance-petty-cash"

export function usePettyCash() {
    return useQuery({
        queryKey: queryKeys.pettyCash.list(),
        queryFn: async () => {
            const result = await getPettyCashTransactions()
            if (!result || !result.success) return { transactions: [], currentBalance: 0, totalTopup: 0, totalDisbursement: 0 }
            return result
        },
    })
}
```

**Step 3: Commit**

```bash
git add lib/query-keys.ts hooks/use-petty-cash.ts
git commit -m "feat(petty-cash): query keys and data hook"
```

---

## Task 8: Petty Cash — Page UI

**Files:**
- Create: `app/finance/petty-cash/page.tsx`

**Step 1: Create the page**

Build page with:
- KPI strip: Saldo Saat Ini, Top Up Bulan Ini, Pengeluaran Bulan Ini
- Two action buttons: "Top Up dari Bank" + "Catat Pengeluaran"
- Transaction table: Tanggal, Tipe (masuk/keluar badge), Nama, Keterangan, Jumlah, Saldo
- Top-up dialog: amount, bank account select (from `getBankAccounts()`), description
- Disbursement dialog: recipient name, amount, expense account select (from `getExpenseAccounts()`), description
- After mutations: `queryClient.invalidateQueries({ queryKey: queryKeys.pettyCash.all })`
- Also invalidate `queryKeys.journal.all` and `queryKeys.financeDashboard.all` since GL entries are created
- Use `mf-page` class, neo-brutalist styling
- Use `TablePageSkeleton` for loading state

**Step 2: Commit**

```bash
git add app/finance/petty-cash/page.tsx
git commit -m "feat(petty-cash): page UI with top-up, disbursement, and transaction list"
```

---

## Task 9: Ensure Petty Cash GL Account Exists

**Step 1: Check if account 1050 exists, create if not**

Add a check in the petty cash server actions, or create a simple seed/migration. Alternatively, in the `getPettyCashTransactions` action, ensure the account exists:

```typescript
// At top of getPettyCashTransactions:
await prisma.gLAccount.upsert({
    where: { code: "1050" },
    create: { code: "1050", name: "Kas Kecil (Petty Cash)", type: "ASSET", balance: 0 },
    update: {},
})
```

**Step 2: Commit**

```bash
git add lib/actions/finance-petty-cash.ts
git commit -m "fix(petty-cash): ensure GL account 1050 exists"
```

---

## Task 10: Fix Reconciliation Button Placement

**Files:**
- Modify: `app/finance/reconciliation/page.tsx` (or wherever the "Rekonsiliasi Baru" button is)

**Step 1: Move button from center to right**

Find the reconciliation page and move the "Rekonsiliasi Baru" button to the right side of the header. Change from centered layout to `flex justify-between` or `flex justify-end`.

**Step 2: Commit**

```bash
git add app/finance/reconciliation/page.tsx
git commit -m "fix(reconciliation): move button to right side of header"
```

---

## Task 11: Final Integration Test + Commit

**Step 1: Run type check**
```bash
npx tsc --noEmit
```

**Step 2: Run tests**
```bash
npx vitest run
```

**Step 3: Manual verification checklist**

| Page | Check |
|------|-------|
| `/manufacturing/bom` | BOMs visible after dev server restart |
| `/finance/invoices` | Multi-select type + status filters work |
| `/finance/invoices` | Creating invoice from SO → DRAFT (not ISSUED) |
| `/finance/invoices` | DRAFT invoices are editable |
| `/finance/transactions` | Multi-select account type filter works |
| `/finance/transactions` | Invoice payments appear with reference |
| `/finance/petty-cash` | Page loads, KPI strip shows |
| `/finance/petty-cash` | Top-up creates transaction + GL entry |
| `/finance/petty-cash` | Disbursement creates transaction + GL entry |
| `/finance/petty-cash` | Insufficient balance shows error |
| `/finance/reconciliation` | Button is on the right |

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat(finance): invoice DRAFT flow, multi-select filters, petty cash module"
```
