# PPh Withholding Tax — Design Document

**Date:** 2026-03-27
**Branch:** `feat/csa-parity`
**Task:** T5 from finance gap analysis
**Scope:** PPh 23 + PPh 4(2) + fix PPh 21 GL posting

## Problem

Indonesian companies must withhold PPh (Pajak Penghasilan) when making certain payments. Our ERP has no withholding tax infrastructure — vendors get paid full amounts with no PPh deducted, and when customers withhold PPh from our AR, there's no way to record the shortfall as a prepaid tax asset. PPh 21 payroll exists but posts to an expense account (7900) instead of the correct liability account.

## Approach: WithholdingTax on Payment (Approach B)

PPh is withheld at **payment time**, not at bill issuance. A new `WithholdingTax` model links to `Payment` and tracks the type, rate, amount, Bukti Potong reference, and deposit status.

## Data Model

### New Enums

```prisma
enum PPhType {
  PPH_21
  PPH_23
  PPH_4_2
}

enum WithholdingDirection {
  OUT   // We withhold from vendor (AP payments)
  IN    // Customer withholds from us (AR receipts)
}
```

### New Model

```prisma
model WithholdingTax {
  id              String   @id @default(uuid()) @db.Uuid
  paymentId       String   @db.Uuid
  invoiceId       String?  @db.Uuid

  type            PPhType
  direction       WithholdingDirection

  rate            Decimal  @db.Decimal(5, 2)   // 2.00, 10.00, 15.00
  baseAmount      Decimal  @db.Decimal(15, 2)  // DPP (taxable base)
  amount          Decimal  @db.Decimal(15, 2)  // Withheld amount

  buktiPotongNo   String?
  buktiPotongDate DateTime?

  deposited       Boolean  @default(false)
  depositDate     DateTime?
  depositRef      String?

  payment         Payment  @relation(fields: [paymentId], references: [id])
  invoice         Invoice? @relation(fields: [invoiceId], references: [id])

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([type, deposited])
  @@index([paymentId])
  @@map("withholding_taxes")
}
```

### New GL Accounts

| Code | Name | Type | Purpose |
|------|------|------|---------|
| 1500 | PPh Dibayar Dimuka | ASSET | Customer withheld PPh from our AR |
| 2210 | Utang PPh 21 | LIABILITY | Employee PPh 21 from payroll |
| 2220 | Utang PPh 23 | LIABILITY | PPh 23 we withhold from vendors |
| 2230 | Utang PPh 4(2) | LIABILITY | PPh 4(2) we withhold from vendors |

## GL Journal Patterns

### AP — We withhold PPh 23 (consulting Rp20M, 2%)

Bill issuance unchanged (full AP). Payment with withholding — 3-line split:

```
DR  Hutang Usaha (2000)       Rp20,000,000
CR  Bank (1110)               Rp19,600,000
CR  Utang PPh 23 (2220)         Rp400,000
```

Deposit to tax office:

```
DR  Utang PPh 23 (2220)         Rp400,000
CR  Bank (1110)                  Rp400,000
```

### AP — PPh 4(2) on rent (Rp100M, 10%)

```
DR  Hutang Usaha (2000)      Rp100,000,000
CR  Bank (1110)               Rp90,000,000
CR  Utang PPh 4(2) (2230)   Rp10,000,000
```

### AR — Customer withholds PPh 23 from us (Rp20M service)

Invoice issuance unchanged. Payment received:

```
DR  Bank (1110)               Rp19,600,000
DR  PPh Dibayar Dimuka (1500)    Rp400,000
CR  Piutang Usaha (1200)     Rp20,000,000
```

### PPh 21 Payroll (fix)

Change from expense (7900) to liability (2210):

```
DR  Beban Gaji               Rp150,000,000
CR  Utang PPh 21 (2210)        Rp5,000,000
CR  Utang Gaji               Rp145,000,000
```

## Server Actions & Helpers

### New: `lib/pph-helpers.ts` (sync, not "use server")

- `calculateWithholding(type, rate, baseAmount)` → `{ rate, amount }`
- `getDefaultRate(type)` → number (PPh 23 → 2, PPh 4(2) → 10)
- `getDepositDeadline(txDate)` → Date (10th of M+1)
- `getFilingDeadline(txDate)` → Date (20th of M+1)
- `doubleRateIfNoNpwp(rate)` → number (PPh 23 doubles without NPWP)
- Default rate constants: PPH_23_SERVICES=2, PPH_23_ROYALTY=15, PPH_4_2_RENT=10, etc.

### New: `lib/actions/finance-pph.ts`

- `getWithholdingTaxes(filters)` — list with type/period/deposited filters
- `markWithholdingDeposited(ids[], depositDate, depositRef)` — batch + GL posting
- `getPPhSummary(period)` — aggregated report by type, outstanding vs deposited

### Modified: `lib/actions/finance-ap.ts`

`recordVendorPayment` + `recordMultiBillPayment` gain optional `withholding` param:

```typescript
withholding?: {
  type: 'PPH_23' | 'PPH_4_2'
  rate: number
  baseAmount: number
  buktiPotongNo?: string
}
```

### Modified: `lib/actions/finance-ar.ts`

`recordARPayment` gains optional `withheldByCustomer` param (same shape).

### Modified: `app/actions/hcm.ts`

PPh 21 GL posting: change from `7900` to `SYS_ACCOUNTS.PPH_21_PAYABLE` (`2210`).

## UI Changes

### Vendor Payment Dialog — "Potong PPh" section

Collapsible section with checkbox toggle. When enabled: type dropdown (PPh 23 / PPh 4(2)), auto-filled rate, editable, DPP defaults to bill subtotal, shows calculated withholding and net payment. Warning if vendor has no NPWP.

### AR Payment Dialog — "Dipotong PPh oleh Customer" section

Same pattern. Shows net received amount.

### PPh Report — new tab in finance/reports

- KPI strip: Total PPh 23 | Total PPh 4(2) | Belum Disetor | Jatuh Tempo
- Table: date, type, vendor/customer, DPP, rate, amount, bukti potong, deposit status
- Filters: type, period, deposit status
- Bulk action: "Tandai Sudah Disetor" with deposit date + NTPN
- Filing deadline display

### No new pages

PPh report is a tab in existing reports page. Payment dialogs are modified, not new.

## Test Plan

- `calculateWithholding()` — all rate scenarios (2%, 10%, 15%, double-without-NPWP)
- `getDepositDeadline()` / `getFilingDeadline()` — date math
- Vendor payment with PPh 23 → GL 3-line split + WithholdingTax record
- Vendor payment with PPh 4(2) → correct liability account
- AR payment with customer withholding → PPh Dibayar Dimuka debit
- Multi-bill payment with withholding
- Mark deposited → GL: DR Utang PPh, CR Bank
- PPh summary report aggregation
- PPh 21 payroll fix → posts to 2210 instead of 7900
