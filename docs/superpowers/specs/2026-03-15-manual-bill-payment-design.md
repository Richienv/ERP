# Manual Bill Payment — Design Spec

## Problem

The AP (Hutang Usaha) bill payment dialog only supports Xendit API payments (Bank Transfer + E-Wallet). In practice, Indonesian SMEs pay vendors manually (bank transfer outside the app, cash, check, giro) and need to record these payments in the system. Currently there is no way to do this from the bill page — users must navigate to a separate vendor payments page.

**Sebelumnya:** User pays vendor via manual bank transfer, then has no easy way to record it from the bill page. The only "Bayar" option goes through Xendit API.

**Sekarang:** User clicks "Bayar" on a bill, chooses MANUAL or XENDIT tab, and can record an offline payment with multi-bill allocation — all from one dialog.

**Kenapa penting:** Most SME vendor payments are manual transfers. Forcing everything through Xendit is unrealistic. Recording payments should be where users already are (the bill list).

## Scope

- **In scope:** Add MANUAL payment tab to existing pay dialog on `app/finance/bills/page.tsx`
- **Out of scope:** AR payments, schema changes, Xendit tab changes

## Design

### Dialog Changes

**File:** `app/finance/bills/page.tsx` (lines 522-569, the PAY DIALOG section)

**Current:** Dialog titled "Bayar via Xendit" with Bank Transfer / E-Wallet tabs.

**New:** Dialog titled "Pembayaran Tagihan" with top-level `[MANUAL] [XENDIT]` tabs. MANUAL is the default tab. Dialog uses `NB.contentWide` to accommodate the allocation table.

### MANUAL Tab UI

1. **Amount display** — Pre-filled from the clicked bill's `balanceDue`, shown in large font (same emerald style as current Xendit amount display)

2. **Method & Account section:**
   - Metode Pembayaran (dropdown): Transfer Manual (`TRANSFER`), Tunai (`CASH`), Cek (`CHECK`), Giro (`GIRO`) — display labels map to `PaymentMethod` enum values
   - Akun Pembayaran (dropdown): GL bank/cash accounts from `useBankAccounts()` hook (new import from `@/hooks/use-bank-accounts`) — auto-switches to cash account (`1000`) when method is CASH, bank account (`1010`) when TRANSFER
   - Referensi (text input): required for CHECK/GIRO, optional for TRANSFER/CASH
   - Catatan (text input): optional
   - **No date field** — payment date is set to `new Date()` by the server action. Adding a custom date would require server action changes which is out of scope.

3. **Bill allocation table** — Shows all open bills from the same vendor. Since `useBills()` returns paginated data, filter `bills` array by `activeBill.vendor?.id` to get same-vendor bills from the current page. This is a known limitation — if a vendor has bills across multiple pages, not all will appear. The clicked bill is pre-selected with full `balanceDue` allocated. User can check additional bills and edit allocation amounts. Includes Select All / Deselect All buttons.

4. **Payment summary** — Shows selected count, total amount, and GL entry preview using a 3-column grid (Akun/Debit/Kredit):
   - DR: `2000 - Hutang Usaha` (matching `SYS_ACCOUNTS.AP` from `lib/gl-accounts.ts`)
   - CR: Selected bank account code + name
   - **Note:** The existing `VendorMultiPaymentDialog` incorrectly shows `2100` in its preview — do NOT replicate this bug. Use `2000`.

### XENDIT Tab

No changes — keeps current Bank Transfer + E-Wallet form and `handlePaySubmit()` logic.

### Server Action

Reuses existing `recordMultiBillPayment()` from `lib/actions/finance-ap.ts` (re-exported via `lib/actions/finance.ts`). No new server action needed. This action already:
- Creates Payment records per bill
- Updates bill `balanceDue` and status
- Posts balanced GL journal entries (DR AP `2000`, CR Bank/Cash)

The `supplierId` parameter must be derived from `activeBill.vendor?.id`. If `vendor` is null on the active bill, disable the MANUAL tab and show a message ("Vendor tidak ditemukan").

### State Management

New state variables added to the page component:
- `paymentTab`: "manual" | "xendit" (default "manual")
- `manualMethod`: "TRANSFER" | "CHECK" | "GIRO" | "CASH"
- `manualBankAccount`: string (GL account code, default "1010")
- `manualReference`: string
- `manualNotes`: string
- `manualAllocations`: array of `{ billId, billNumber, totalAmount, balanceDue, selected, allocatedAmount, dueDate, isOverdue }`

When `isPayOpen` is set to true with an `activeBill`, the manual allocations are initialized with all open bills from the same vendor (filtered from current page's `bills` array), with the active bill pre-selected.

**Tab switch behavior:** Switching between MANUAL and XENDIT tabs does NOT reset form state. Each tab maintains its own state independently. Only closing the dialog resets all state.

### Query Invalidation

After successful manual payment, invalidate the same query keys as the existing Xendit flow: `bills.all`, `invoices.all`, `financeDashboard.all`, `vendorPayments.all`, `financeReports.all`, `journal.all`, `accountTransactions.all`, `chartAccounts.all`.

### Data Flow

```
User clicks "Bayar" on bill row
  → setActiveBill(bill), setIsPayOpen(true)
  → Initialize manual allocations from same-vendor bills (activeBill.vendor?.id)
  → Dialog opens with MANUAL tab active

User fills form, selects bills, clicks "Konfirmasi Pembayaran"
  → Validate: vendor exists (activeBill.vendor?.id), at least 1 bill selected, amount > 0, ref required for CHECK/GIRO
  → Call recordMultiBillPayment({ supplierId: activeBill.vendor.id, allocations, method, reference, notes, bankAccountCode })
  → On success: toast, reset form, close dialog, invalidate queries
  → On error: toast error, keep dialog open
```

### Dependencies

- `useBankAccounts()` hook from `@/hooks/use-bank-accounts` (new import, already used in VendorMultiPaymentDialog)
- `recordMultiBillPayment()` from `@/lib/actions/finance` (already imported on bills page via finance-ap.ts)
- `queryKeys` from `@/lib/query-keys` (already imported)
- `Checkbox` from `@/components/ui/checkbox` (new import for allocation table)
- No new packages, no schema changes, no new API routes
