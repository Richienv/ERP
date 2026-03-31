# Multi-Currency on Invoices Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add currency support to Invoice, Quotation, and SalesOrder so foreign-currency transactions auto-convert to IDR at posting time using the ExchangeRate table.

**Architecture:** Add `currencyCode`, `exchangeRate`, `amountInIDR` fields to Invoice (and `currencyCode`+`exchangeRate` to Quotation/SalesOrder). Create a server-side `getExchangeRate(currencyCode, date)` helper. Update `moveInvoiceToSent()` to fetch the rate and compute IDR equivalent. GL posting always uses IDR amounts. Customer form shows currency dropdown.

**Tech Stack:** Prisma 6.x (migration), TypeScript, Vitest

---

### Task 1: Add currency fields to Invoice, Quotation, SalesOrder + migration

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add fields to Invoice model (line 1778)**

After `balanceDue` (line 1802), add:

```prisma
  // Multi-currency
  currencyCode  String   @default("IDR")
  exchangeRate  Decimal  @default(1) @db.Decimal(15, 4) // IDR per 1 unit foreign currency at posting
  amountInIDR   Decimal  @default(0) @db.Decimal(15, 2) // IDR equivalent of totalAmount
```

**Step 2: Add fields to Quotation model (line 647)**

After the existing amount fields, add:

```prisma
  // Multi-currency
  currencyCode  String   @default("IDR")
  exchangeRate  Decimal  @default(1) @db.Decimal(15, 4)
```

**Step 3: Add fields to SalesOrder model (line 724)**

After the existing amount fields, add:

```prisma
  // Multi-currency
  currencyCode  String   @default("IDR")
  exchangeRate  Decimal  @default(1) @db.Decimal(15, 4)
```

**Step 4: Run migration**

```bash
npx prisma migrate dev --name add_multi_currency_fields
```

All existing rows get defaults (IDR, rate=1, amountInIDR=0). For existing invoices, amountInIDR should equal totalAmount (since they're all IDR). We'll backfill in the script step.

**Step 5: Backfill amountInIDR for existing invoices**

Quick script or raw SQL:
```sql
UPDATE invoices SET "amountInIDR" = "totalAmount" WHERE "currencyCode" = 'IDR';
```

Run via: `npx prisma db execute --stdin <<< 'UPDATE invoices SET "amountInIDR" = "totalAmount" WHERE "currencyCode" = '\''IDR'\'';'`

**Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(currency): add currencyCode, exchangeRate, amountInIDR to Invoice/Quotation/SO"
```

---

### Task 2: Create server-side exchange rate helper + tests

**Files:**
- Create: `lib/currency-helpers.ts`
- Create: `__tests__/currency-helpers.test.ts`

**Step 1: Write tests**

```typescript
// __tests__/currency-helpers.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"

const mockFindFirst = vi.fn()
vi.mock("@/lib/db", () => ({
    prisma: {
        exchangeRate: {
            findFirst: (...args: any[]) => mockFindFirst(...args),
        },
    },
}))

import { getExchangeRate, convertToIDR } from "@/lib/currency-helpers"

describe("getExchangeRate", () => {
    beforeEach(() => mockFindFirst.mockReset())

    it("returns 1 for IDR", async () => {
        const rate = await getExchangeRate("IDR", new Date())
        expect(rate).toBe(1)
        expect(mockFindFirst).not.toHaveBeenCalled()
    })

    it("returns middleRate for foreign currency", async () => {
        mockFindFirst.mockResolvedValue({ middleRate: 16300 })
        const rate = await getExchangeRate("USD", new Date("2026-03-27"))
        expect(rate).toBe(16300)
    })

    it("throws when no rate found", async () => {
        mockFindFirst.mockResolvedValue(null)
        await expect(getExchangeRate("EUR", new Date("2026-03-27")))
            .rejects.toThrow("Kurs EUR belum tersedia")
    })
})

describe("convertToIDR", () => {
    it("converts amount using rate", () => {
        expect(convertToIDR(100, 16300)).toBe(1630000)
    })

    it("returns same amount for rate=1 (IDR)", () => {
        expect(convertToIDR(50000, 1)).toBe(50000)
    })
})
```

**Step 2: Write implementation**

```typescript
// lib/currency-helpers.ts
import { prisma } from "@/lib/db"

/**
 * Get the exchange rate (middleRate) for a currency on a given date.
 * Returns 1 for IDR. Throws if no rate found for foreign currency.
 * Looks for the most recent rate on or before the given date.
 */
export async function getExchangeRate(currencyCode: string, date: Date): Promise<number> {
    if (currencyCode === "IDR") return 1

    const rate = await prisma.exchangeRate.findFirst({
        where: {
            currency: { code: currencyCode },
            date: { lte: date },
        },
        orderBy: { date: "desc" },
        select: { middleRate: true },
    })

    if (!rate) {
        throw new Error(`Kurs ${currencyCode} belum tersedia untuk tanggal ini. Tambahkan kurs di halaman Mata Uang.`)
    }

    return Number(rate.middleRate)
}

/**
 * Convert a foreign currency amount to IDR.
 */
export function convertToIDR(amount: number, exchangeRate: number): number {
    return Math.round(amount * exchangeRate * 100) / 100
}
```

**Step 3: Run tests**

```bash
npx vitest run __tests__/currency-helpers.test.ts
```
Expected: 5 tests PASS.

**Step 4: Commit**

```bash
git add lib/currency-helpers.ts __tests__/currency-helpers.test.ts
git commit -m "feat(currency): add getExchangeRate + convertToIDR server helpers with tests"
```

---

### Task 3: Wire currency into invoice posting + quotation/SO creation

**Files:**
- Modify: `lib/actions/finance-invoices.ts` (moveInvoiceToSent, createInvoiceFromSalesOrder)
- Modify: `lib/actions/sales.ts` (createQuotation, createSalesOrder — if they exist)
- Modify: `lib/actions/finance.ts` (createInvoiceFromSalesOrder duplicate)

**Step 1: Update moveInvoiceToSent() to handle currency conversion**

In `lib/actions/finance-invoices.ts`, find `moveInvoiceToSent()`. After fetching the invoice, before GL posting:

```typescript
import { getExchangeRate, convertToIDR } from "@/lib/currency-helpers"

// Inside moveInvoiceToSent, after fetching invoice:
const currencyCode = invoice.currencyCode || "IDR"
const rate = await getExchangeRate(currencyCode, new Date())
const amountInIDR = currencyCode === "IDR"
    ? Number(invoice.totalAmount)
    : convertToIDR(Number(invoice.totalAmount), rate)

// Update invoice with rate and IDR amount
await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
        exchangeRate: rate,
        amountInIDR: amountInIDR,
    }
})

// Use amountInIDR for GL posting instead of totalAmount
```

The GL posting lines should use `amountInIDR` (and proportionally for subtotal/tax) so the journal is always in IDR.

**Step 2: Update createInvoiceFromSalesOrder to inherit currency**

When creating an invoice from a sales order, copy `currencyCode` and `exchangeRate` from the SO:

```typescript
const invoice = await prisma.invoice.create({
    data: {
        // ... existing fields ...
        currencyCode: salesOrder.currencyCode || "IDR",
        exchangeRate: salesOrder.exchangeRate || 1,
        amountInIDR: 0, // Will be computed at posting time
    }
})
```

**Step 3: Update quotation/SO creation to inherit from customer**

When creating a quotation for a customer with `currency: "USD"`, set `currencyCode: customer.currency || "IDR"`.

Search for quotation creation functions and add currency pass-through.

**Step 4: Run tests**

```bash
npx vitest run
```
Expected: Same pass count.

**Step 5: Commit**

```bash
git add lib/actions/finance-invoices.ts lib/actions/finance.ts lib/actions/sales.ts
git commit -m "feat(currency): wire multi-currency into invoice posting + SO/quotation creation"
```

---

### Task 4: Show customer currency in form + invoice currency display + final verification

**Files:**
- Modify: `components/sales/customer-form.tsx` (show currency dropdown)
- Modify: `app/finance/invoices/page.tsx` (show currency + IDR equivalent)

**Step 1: Add currency dropdown to customer form**

In `components/sales/customer-form.tsx`, find the form fields. The `currency` field exists in the data model but is NOT rendered. Add a FormField:

```tsx
import { useCurrencies } from "@/hooks/use-currencies"

// Inside component:
const { data: currencies = [] } = useCurrencies()

// In JSX, add a currency select field:
<FormField name="currency" label="Mata Uang Default">
    <Select value={...} onValueChange={...}>
        <SelectItem value="IDR">IDR - Rupiah Indonesia</SelectItem>
        {currencies.map(c => (
            <SelectItem key={c.id} value={c.code}>{c.code} - {c.name}</SelectItem>
        ))}
    </Select>
</FormField>
```

**Step 2: Show currency on invoice display**

In the invoice list page or invoice detail, if `currencyCode !== "IDR"`, show the original amount + IDR equivalent:

```tsx
{invoice.currencyCode !== "IDR" && (
    <span className="text-xs text-zinc-500">
        ({invoice.currencyCode} {formatCurrency(invoice.totalAmount)})
        = Rp {formatCurrency(invoice.amountInIDR)}
    </span>
)}
```

**Step 3: Seed initial currencies (if not exists)**

Create `scripts/seed-currencies.ts`:

```typescript
const CURRENCIES = [
    { code: "USD", name: "Dolar Amerika", symbol: "$" },
    { code: "EUR", name: "Euro", symbol: "€" },
    { code: "SGD", name: "Dolar Singapura", symbol: "S$" },
    { code: "CNY", name: "Yuan Tiongkok", symbol: "¥" },
]
```

**Step 4: Run full test suite + TS check**

```bash
npx vitest run && npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add components/sales/customer-form.tsx app/finance/invoices/page.tsx scripts/seed-currencies.ts
git commit -m "feat(currency): show customer currency dropdown + invoice currency display"
```

---

## Verification Guide

| # | Halaman | Aksi | Expected |
|---|---------|------|----------|
| 1 | `/finance/currencies` | Pastikan ada mata uang USD dengan kurs terbaru. Jika belum, klik **"+ Tambah Mata Uang"** → isi USD, "Dolar Amerika", $ → **Simpan**. Lalu klik **"+ Tambah Kurs"** → tanggal hari ini, Beli: 16200, Jual: 16400 → **Simpan** | USD muncul di list dengan kurs 16.200/16.400/16.300 |
| 2 | `/sales/customers` | Edit customer → sekarang ada dropdown **"Mata Uang Default"** → pilih **"USD"** → klik **"Simpan"** | Customer tersimpan. Badge/field menunjukkan USD |
| 3 | `/sales/quotations/new` | Buat quotation untuk customer USD. Isi harga dalam USD (misal $1,000) | Field mata uang menunjukkan USD. Harga tersimpan dalam USD |
| 4 | `/sales/orders/new` | Buat SO dari quotation USD | SO mewarisi currencyCode=USD |
| 5 | `/finance/invoices` | Buat invoice dari SO USD → klik **"Kirim"** | Invoice menampilkan: **$1,000** + teks kecil *"Setara Rp 16.300.000"*. Kurs otomatis diambil dari tabel ExchangeRate |
| 6 | `/finance/journal` | Cek jurnal entry invoice USD | GL posting **dalam IDR**: DR Piutang Rp 16.300.000, CR Pendapatan Rp 16.300.000 |
| 7 | `/finance/invoices` | Buat invoice dari SO IDR (customer normal) → klik **"Kirim"** | Tetap berfungsi biasa. currencyCode=IDR, exchangeRate=1, amountInIDR=totalAmount |
| 8 | `/finance/currencies` | Hapus kurs USD → lalu coba kirim invoice USD | Error toast merah: **"Kurs USD belum tersedia untuk tanggal ini. Tambahkan kurs di halaman Mata Uang."** Invoice tetap DRAFT |
| 9 | `/finance/reports` → **Neraca** | Cek saldo | Semua dalam IDR — tidak berubah |
