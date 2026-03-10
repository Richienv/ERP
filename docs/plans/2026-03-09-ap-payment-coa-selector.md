# AP Payment COA Account Selector

**Date:** 2026-03-09
**Status:** Approved

## Problem

AP payments hardcode GL accounts (1000 for single, 1010 for multi-bill). Users can't specify which bank/cash account money comes from, breaking bank reconciliation.

## Solution

Add "Akun Pembayaran" dropdown to all 3 AP payment flows (single-bill, multi-bill, Xendit), filtered to cash/bank accounts (code `10xx`, type ASSET).

## API Changes

1. `recordVendorPayment()` in `finance-ap.ts`: Add `bankAccountCode?: string` param, default `'1000'`. Use in GL CR line.
2. `recordMultiBillPayment()`: Already has `bankAccountCode` — ensure UI passes it.
3. Xendit: Store selected account code, use in GL entry on webhook confirmation.

## UI Changes

All payment forms get required field:
- Label: "Akun Pembayaran"
- Data: GLAccount where type=ASSET AND code starts with '10'
- Default: 1010 for TRANSFER/CHECK, 1000 for CASH
- Auto-switch default on method change

## Files to Modify

1. `lib/actions/finance-ap.ts` — `recordVendorPayment()`: add bankAccountCode param
2. `app/finance/vendor-payments/page.tsx` — single-bill form: add COA dropdown + pass to action
3. `components/finance/vendor-multi-payment-dialog.tsx` — add COA dropdown + pass to action
4. Xendit payment dialog (if exists as separate component)
5. Need to fetch cash/bank accounts — add to existing useVendorPayments hook or create small fetch
