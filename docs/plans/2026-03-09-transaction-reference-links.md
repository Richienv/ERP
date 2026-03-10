# Transaction Reference Links — End-to-End Fix

**Date:** 2026-03-09
**Status:** Approved

## Problem

Reference links in **Transaksi Akun** (`/finance/transactions`) navigate to generic list pages that ignore the `?highlight=` query param. Users click a reference like "VPAY-2026-0001" and land on an empty dashboard or unhelpful list page instead of seeing the specific document.

## Design

### 1. API Enhancement — `/api/finance/transactions`

Add `paymentSupplierId` and `paymentCustomerId` to the response so the frontend can distinguish AR vs AP payments for routing.

```diff
  payment: { select: { id: true, number: true, method: true } },
+ payment: { select: { id: true, number: true, method: true, supplierId: true, customerId: true } },
```

Response adds:
- `paymentSupplierId: string | null`
- `paymentCustomerId: string | null`

### 2. ReferenceLink Component — Better Routing

Current: All invoices → `/finance/invoices?highlight={id}`, all payments → `/finance/payments?highlight={id}`

New routing:
| Reference Type | Destination |
|---|---|
| Invoice (any) | `/finance/invoices?highlight={invoiceId}` |
| Payment with `customerId` (AR) | `/finance/payments?highlight={paymentId}` |
| Payment with `supplierId` (AP) | `/finance/vendor-payments?highlight={paymentId}` |
| No invoice/payment linked | Plain text "-" (no link) — unchanged |

### 3. Invoices Page — Auto-open Detail Dialog

- Read `highlight` from `useSearchParams()`
- When data loads and `highlight` is set, find the invoice in `allInvoices` by ID
- Auto-call `openEditDialog(invoice)` to show the detail dialog
- Clear `highlight` from URL after opening (prevent re-triggering)

### 4. AR Payments Page — Auto-select Payment

- Already has `selectedPaymentId` state with visual highlight
- Read `highlight` from `useSearchParams()` in the wrapper page
- Pass `highlightPaymentId` prop to `ARPaymentsView`
- Auto-set `selectedPaymentId` when highlight is present

### 5. Vendor Payments Page — Highlight Row

- Read `highlight` from `useSearchParams()`
- Add `highlightedId` state
- Apply visual highlight (emerald border-left + background) to the matching row
- Auto-scroll to the highlighted row using `scrollIntoView`

## Files to Change

1. `app/api/finance/transactions/route.ts` — add payment customer/supplier IDs
2. `app/finance/transactions/page.tsx` — update ReferenceLink routing + types
3. `app/finance/invoices/page.tsx` — handle `?highlight` param
4. `app/finance/invoices/[id]/page.tsx` — keep redirect (now it works)
5. `app/finance/payments/page.tsx` — pass highlight prop
6. `app/finance/payments/payments-view.tsx` — accept + use highlight prop
7. `app/finance/vendor-payments/page.tsx` — handle `?highlight` param
