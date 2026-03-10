# Bulk Payment CSV Export (MTG-008) — Design

**Date:** 2026-03-10
**Status:** Approved
**Priority:** P3 (Batch 2)

## Problem
Users need to export payment data as CSV/TXT files for bulk bank transfers (e.g., BCA internet banking). Currently there's no mechanism to generate bank-specific file formats from the ERP.

## Solution
Add a "Download CSV Transfer" button on the vendor payments page that exports selected/filtered payments as a bank-uploadable file. The format is configurable via presets (BCA, Generic CSV).

## Architecture

### Data Flow
```
Vendor Payments Page → Select/filter payments → Click "Download CSV"
→ lib/bank-csv-generator.ts formats data → Browser downloads file
```

### New File: `lib/bank-csv-generator.ts`
- `BankFormat` interface: `{ name, columns[], delimiter, extension, encoding, headerRow? }`
- `BCA_FORMAT` preset: pipe-delimited TXT
  - Fields: TransferDate | BeneficiaryAccount | BeneficiaryName | Amount | Remark | BankCode
  - Bank codes: BCA=014, Mandiri=008, BNI=009, BRI=002, CIMB=022, etc.
- `GENERIC_CSV` preset: comma-separated with header row
  - Fields: Tanggal, Nama Penerima, No Rekening, Bank, Jumlah, Keterangan
- `generateBankFile(payments[], format)` → string content
- `downloadBankFile(content, filename, format)` → triggers browser download

### UI: `app/finance/vendor-payments/page.tsx`
- New "Download CSV Transfer" button (icon: Download)
- Bank format selector: BCA / CSV Umum
- Exports currently filtered/visible payments
- Client-side generation, no API needed

### Data Sources (already available)
- `Supplier.bankAccountNumber` — beneficiary account
- `Supplier.bankName` — beneficiary bank
- `Supplier.name` — beneficiary name
- `Payment.amount` — transfer amount
- `Payment.date` — transfer date
- `Payment.reference` — remark/description

## Out of Scope
- CSV import/parsing
- Checksum file generation (BCA-specific, add when spec available)
- Planning board export (separate feature)
- Bank API integration

## Adaptation Plan
When Raymond provides the exact BCA format:
1. Update `BCA_FORMAT` column definitions in `bank-csv-generator.ts`
2. Add checksum generation if required
3. No other changes needed — format engine is pluggable
