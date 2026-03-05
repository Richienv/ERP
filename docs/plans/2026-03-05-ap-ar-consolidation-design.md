# AP/AR Consolidation + Debit/Credit Notes — Design

## Problem

The sidebar has two separate AP pages ("Tagihan Vendor" and "Pembayaran AP") which should be one unified page. Additionally, Debit Notes (for correcting supplier bills) need to be accessible within the AP flow, and Credit Notes need to be within the AR flow.

## Design

### Sidebar Changes

**Before:**
```
Penerimaan (AR)        → /finance/payments
Tagihan Vendor (AP)    → /finance/bills
Pembayaran (AP)        → /finance/vendor-payments
```

**After:**
```
Piutang Usaha (AR)     → /finance/receivables    [tabs: Penerimaan, Nota Kredit]
Hutang Usaha (AP)      → /finance/payables       [tabs: Tagihan, Pembayaran, Nota Debit]
```

Remove "Credit Notes" standalone sidebar item.

### Page 1: Hutang Usaha (AP) — `/finance/payables`

Top tabs layout with KPI strip above tabs.

**KPI Strip:** Total Hutang, Jatuh Tempo, Total Nota Debit bulan ini

**Tab: Tagihan** — Existing bills page content (move from `/finance/bills`)
**Tab: Pembayaran** — Existing vendor payments content (move from `/finance/vendor-payments`)
**Tab: Nota Debit** — NEW tab for purchase debit notes

#### Nota Debit Tab
- List of debit notes with: Number, Supplier, Bill Asal, Jumlah, Alasan, Status, Tanggal
- "+ Buat Nota Debit" button opens dialog
- Dialog fields: Supplier, Bill Asal (optional), Alasan (dropdown), Jumlah, PPN checkbox, Catatan
- GL preview at bottom of dialog
- Two save options: "Simpan sebagai Draft" and "Simpan & Posting"
- On posting: auto-updates linked bill's balanceDue

#### Nota Debit GL Posting
```
DR 2100 Hutang Usaha         (total incl. PPN)
CR 5000 HPP                  (subtotal — for goods returns)
CR 1330 PPN Masukan          (PPN amount — if applicable)
```

#### Reason Codes
- Barang Cacat/Rusak (RET-DEFECT)
- Barang Tidak Sesuai (RET-WRONG)
- Kualitas Tidak Standar (RET-QUALITY)
- Koreksi Harga / Kelebihan Bayar (ADJ-OVERCHARGE)
- Diskon Belum Dipotong (ADJ-DISCOUNT)
- Lainnya (OTHER)

### Page 2: Piutang Usaha (AR) — `/finance/receivables`

Top tabs layout with KPI strip above tabs.

**KPI Strip:** Total Piutang, Jatuh Tempo, Total Nota Kredit bulan ini

**Tab: Penerimaan** — Existing AR payments content (move from `/finance/payments`)
**Tab: Nota Kredit** — Credit notes (refactored from `/finance/credit-notes`, customer-side only)

#### Nota Kredit GL Posting (already exists, fix account codes)
```
DR 4000 Pendapatan Penjualan  (subtotal — revenue reversal)
DR 2110 PPN Keluaran          (PPN — if applicable)
CR 1100 Piutang Usaha         (total — reduce AR)
```

### Database

Use existing `CreditNote` model for both CN and DN (add a `type` field if needed), or create a new `DebitNote` model. The existing model has: number, customerId, reference, reason, amount, taxAmount, total, status, issueDate.

For DN, we need: supplierId, originalBillId (linked invoice), plus the same financial fields.

### Routes

Old routes (`/finance/bills`, `/finance/vendor-payments`, `/finance/payments`) should redirect to the new consolidated pages, or be kept as standalone for backward compatibility.
