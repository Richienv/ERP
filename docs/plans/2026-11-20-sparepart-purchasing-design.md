# Pembelian Sparepart: upload invoice supplier, langsung jadi

**Date:** 2026-11-20
**Status:** Design (written in a side session for Richie; decisions marked ⚑ are his to overturn)
**Branch:** `feat/sparepart-purchasing`

## Problem

His father's company is starting a spare-parts line. The first files on disk show what it looks like:
Mitsubishi L200 parts bought from China, priced in RMB, identified by **OE number**, with a
1 RMB = Rp 2.490 rate (`Sparepart-Data-China.pdf`, `L200-Parts-Quotation.pdf`). Local suppliers will
send ordinary Indonesian faktur in IDR with PPN 11%.

Today a purchase has to be typed by hand through PR → PO → GRN → bill → payment, five screens
apart. The supplier's own invoice number is not stored anywhere, the invoice file is a public URL,
and nothing shows at a glance which purchases are unpaid or still on the boat.

**Sebelumnya:** ketik ulang invoice supplier baris per baris di beberapa layar.
**Sekarang:** seret PDF invoice ke layar → field terisi sendiri → cek → Simpan. Status bayar dan
barang terlihat di satu daftar, satu tombol untuk langkah berikutnya.
**Kenapa penting:** input lebih cepat, angka sama dengan dokumen asli, dan jurnal tetap benar.

## Users and the one job per screen

| Screen | The one obvious action |
|---|---|
| Daftar Pembelian Sparepart | **Upload Invoice** (or drop a file anywhere on the page) |
| Review hasil baca | **Simpan Pembelian** |
| Detail pembelian | the next step only: *Catat Bayar* → *Tandai Dikirim* → *Terima Barang* |

## Lifecycle

A purchase moves on two independent tracks. Imports are paid (30% deposit, 70% before shipment)
before the goods move, so one linear status would lie.

```
Barang:  Dipesan ──► Dikirim (resi, ETA) ──► Datang sebagian (n%) ──► Lengkap
Bayar:   Belum bayar ──► Dibayar sebagian (n%) ──► Lunas
Tagihan: Draft ──► Diposting (jurnal AP)          (only visible when it is stuck)
```

Each row shows both tracks as two small progress bars plus one next-action button. Partial
deliveries are first-class: every receipt is a GRN with per-line quantities, defaulting to what is
still outstanding; a second shipment can be marked shipped while the first part is already in.

## Reuse, not duplicate

| Concept | Existing piece reused | New |
|---|---|---|
| Supplier | `Supplier` (+ `npwp`) | create inline from the parsed header |
| Part | `Product.code` = OE number, `equipmentType = spare_part`, `equipmentCompatibility` | create inline for unknown lines |
| Supplier's code for a part | `SupplierProduct.skuCode`, `price`, `currency` | upserted on save = the learned item map |
| Order | `PurchaseOrder` + items, created at **VENDOR_CONFIRMED** (the invoice is the confirmation) | — |
| Shipping | `markAsShipped` state transition + `PurchaseOrderEvent` | shipped date, tracking, ETA kept on the capture row |
| Receiving | `createGRN` + `acceptGRN` (stock, `DR Persediaan / CR GR/IR`) | — |
| Bill (AP) | `Invoice` INV_IN, posted by `moveInvoiceToSent` (`DR GR/IR + PPN Masukan / CR Hutang`) | `glAccountCode = SYS_ACCOUNTS.GR_IR_CLEARING` so posting before receipt still hits GR/IR, not Beban |
| Payment | `recordVendorPayment` (`DR Hutang / CR Bank`) | also sets `PurchaseOrder.paymentStatus` / `datePaid`, which nothing updated before |
| File | `InvoiceAttachment` on the bill | private storage + streamed through an auth-checked route |

**New tables (2):**

```prisma
model SupplierInvoiceCapture {        // one per captured supplier invoice = one purchase
  id, line ("SPAREPART"), purchaseOrderId @unique, billId @unique?, supplierId,
  supplierInvoiceNo, invoiceDate, dueDate?,
  currencyCode, exchangeRate, subtotalOriginal, taxOriginal, totalOriginal,   // as printed
  fileName?, fileType?, fileSize?, fileSha256?, storagePath?,
  parseMethod (TEXT | OCR | MANUAL), parseMs?, parseConfidence?, parsed Json?,
  shippedAt?, trackingNumber?, eta?,
  searchText,                                 // lower-case: PO no, supplier, invoice no, OE numbers
  createdBy?, createdAt, updatedAt
  @@unique([supplierId, supplierInvoiceNo])   // the same invoice can never be entered twice
  @@index([line, createdAt(sort: Desc), id])  // default list + keyset pagination
  @@index([fileSha256])                       // "this file was already uploaded"
  // + GIN pg_trgm index on searchText (raw SQL in the migration)
}

model SupplierInvoiceTemplate {       // what the parser learned about one supplier's layout
  supplierId @unique, fingerprint Json, columnMap Json, labelMap Json,
  numberLocale, dateOrder, currencyCode?, samples, updatedAt
}
```

Nothing else in the schema changes. Payment and receipt progress are **read live** from the bill
(`balanceDue`) and PO items (`receivedQty`), never copied, so a payment made from the Finance
pages shows up here too.

One guard in shared code: `recordPendingBillFromPO` (called after every GRN) must **skip POs that
have a capture**. Otherwise a DRAFT bill built from the supplier's invoice would be overwritten by
received lines with a forced 11% PPN, which is wrong for imports. (Ripple check required.)

## Money: IDR books, RMB on screen ⚑

`recordVendorPayment` posts the raw amount to the GL with no currency conversion, and
`moveInvoiceToSent` replaces the rate with the rate table's rate at posting time. To keep the books
right without rewriting shared AP code:

- The bill and PO are stored **in IDR**, converted at the rate on the review screen (default: the
  rate table for that date, else the last rate used for that supplier, else blank and required).
- The capture row keeps the invoice exactly as printed (RMB amounts, rate, OE numbers), and the
  UI shows both: `¥88.650 · Rp 220.738.500 @ 2.490`.
- Payment for an RMB purchase is entered in RMB; the UI converts at the booked rate.
- **Not in v1:** realised FX gain/loss when the bank rate differs from the booked rate. Listed as
  a follow-up; it needs an FX account and a change to the canonical AP payment path.
- Import landed cost (freight, bea masuk, PPN impor, PPh 22) is also a follow-up; the PO already
  has `landedCostTotal` for it.

## Invoice parsing pipeline

Runs **in the browser**, in a Web Worker. The invoice never leaves the device until Simpan, and
there is no upload round-trip before the fields appear.

1. **Read** with pdf.js `getTextContent()` → text items with x/y/width per page. The worker and
   module are preloaded when the page is idle, so the first parse does not pay the load cost.
2. **No text layer?** (scan or photo, fewer than ~20 characters per page) → OCR fallback with
   tesseract.js, also in the browser, language files served from our own `/public`. Loaded only
   when needed.
3. **Layout:** cluster items into lines by y, cells by x-gap.
4. **Header fields:** label dictionaries in Indonesian, English and Chinese (No. Faktur / Invoice
   No. / 发票号码, Tanggal / Date, Jatuh Tempo / Due Date, Mata Uang / Currency, PPN / VAT, Total…),
   NPWP regex, currency detection (RMB/CNY/¥, USD/$, IDR/Rp).
5. **Item table:** find the header row from column vocabulary (OE Number / Part No / Kode,
   Description / Nama Barang, Qty, Satuan / Unit, Harga / Unit Price, Disc, Jumlah / Amount); map
   each later line to columns by x-overlap; lines without numbers are continuations of the previous
   description; stop at the totals block.
6. **Numbers:** detect `1.234.567,00` vs `1,234,567.00` per document by voting, with the currency
   as tie-breaker (IDR → dot thousands).
7. **Self-check:** qty × price − disc = amount per line; Σ lines = subtotal; subtotal + tax =
   total. Each field gets a confidence; anything that does not add up is outlined amber on the
   review screen with the difference shown. No silent guesses.
8. **Templates learned over time:** the supplier is recognised from NPWP, email domain or name.
   If a template exists, its column map, label map and number format are applied first. On Simpan,
   whatever the user corrected is written back to the template, and each line's supplier code is
   written to `SupplierProduct.skuCode` so the same part maps itself next time.
9. **LLM fallback: designed, not built, off.** Sending invoice content to an outside API needs
   Richie's OK first (it is his father's company's data). The hook is a single function that would
   receive the extracted text only when confidence is low.

Matching runs client-side too, against a slim lookup (suppliers, templates, products with codes and
supplier SKUs) that is prefetched when the page opens and persisted by React Query.

## Review screen

Split view. Left: the PDF page rendered by pdf.js, with boxes over the text each field came
from (hover a field → its source lights up). Right: supplier (matched chip or "Supplier baru"),
invoice no., dates, currency + rate, item table with a matched-product chip or "Produk baru" per
line, totals with ✓ or the difference. Two optional toggles for things that already happened:
*Sudah dibayar* (amount) and *Barang sudah datang semua*. One button: **Simpan Pembelian**.

Duplicate guard before any typing: the file's SHA-256 is hashed in the browser and checked against
captures; a known invoice number for the same supplier blocks Simpan and links to the existing one.

## Speed design

| Lever | What we do | Target |
|---|---|---|
| Parse | pdf.js in a preloaded worker, pure-TS parser | < 300 ms for a 1–2 page text PDF |
| List query | one SQL statement, slim columns, `LATERAL` sums for paid/received, keyset pagination on `(createdAt, id)` | < 20 ms in the DB |
| Search | GIN trigram index on `searchText` (OE number, invoice no, supplier, PO no) | < 20 ms |
| Clicks | detail opens from cached row data instantly; full detail prefetched on hover/pointerdown | next frame |
| Mutations | optimistic cache updates (pay, ship, receive, save) with rollback on error | 0 ms perceived |
| Navigation | sidebar prefetch entry + `ROUTE_TIERS` tier; React Query persistence | instant revisit |
| Save | one transaction for the core records; bill posting, first payment and receipt run after commit and report back per step | user never waits on a spinner |

Deploy note (not changed here): production DB is in Tokyo (`ap-northeast-1`) while the Vercel
plan says Singapore. Every server round trip pays that distance; pinning functions next to the DB
would cut each request noticeably.

## Error handling

- Parse finds nothing: the review screen still opens with the PDF and an empty form (manual entry),
  never an error wall.
- Save fails in the core transaction: nothing is written, the optimistic row turns red with
  *Coba lagi*.
- Bill posting fails after save (role, closed period, missing rate): the purchase is saved, the row
  shows *Tagihan belum diposting* with the reason and a retry button.
- Payment/receipt fail: rollback of the optimistic change + toast with the server's reason.

## Security

- Files go to a **private** storage path, served through an authenticated route (the existing
  invoice attachment route returns public URLs; that is left alone but noted).
- Local demo mode stores files on disk under `.local-uploads/` (git-ignored) instead of Supabase.
- Role checks follow the existing lists: save and ship need PURCHASING, receipt needs RECEIVING,
  bill posting and payment need FINANCE_POSTING roles. A user without posting rights still saves;
  the bill waits as DRAFT for finance.
- ⚑ SoD: the fast lane records an invoice the supplier already issued, so it creates no APPROVE
  event; the GRN separation-of-duties prompt therefore does not trigger for the uploader.

## Testing

- Pure parser: unit tests on fixture text items (CN commercial invoice in RMB, ID faktur with PPN
  and discount, multi-line descriptions, number formats, totals check, template application).
- PDF → items: test on the two generated fixture PDFs with pdf.js in Node.
- Server actions: mocked Prisma tests in the house style (save creates PO + bill + capture in one
  transaction, duplicate invoice rejected, IDR conversion, guard in `recordPendingBillFromPO`).
- GL: balance check of the three postings (bill, receipt, payment) with GR/IR netting to zero.
- Browser walkthrough on the local DB with the sample invoices; measured parse time and click
  latency.

## Follow-ups (out of v1)

- FX gain/loss on payment; landed cost allocation for imports.
- LLM fallback (needs Richie's OK).
- Moving the existing public invoice-attachment URLs to private storage.
- Pre-existing bugs found on the way: `createDirectPurchase` books PPN into inventory and skips
  GR/IR; `totalsFromReceivedLines` always adds 11% PPN; `createGRN` counts DRAFT/REJECTED GRNs as
  received; `cancelPurchaseOrder` writes a non-existent `Invoice.notes`.

## What shipped (2026-11-20, branch `feat/sparepart-purchasing`, not pushed)

Page: **Pengadaan → Pembelian Sparepart** (`/procurement/spareparts`).

- Drop / paste / pick a PDF or photo anywhere on the page → review screen with the real invoice on
  the left (boxes over the source of each field) and the parsed form on the right → **Simpan**.
- Save creates supplier (if new), parts (if new), supplier SKUs, PO (VENDOR_CONFIRMED), bill
  (debit GR/IR), capture, learned template; then posts the bill, records "sudah dibayar" and
  "barang sudah datang semua" if ticked, each step reported in the toast.
- List with paid / received bars and one next action; KPI chips double as filters; trigram search
  over part code, invoice no, supplier and PO; keyset infinite scroll.
- Detail sheet: next action button, pay (RMB-aware, DP 30% / lunasi chips), mark shipped (resi,
  ETA), receive per line (partial deliveries), original invoice file.
- OCR fallback (tesseract.js in the browser) for scans and photos, plus a headerless table reader
  for when OCR garbles the header. Lines it is unsure of are amber; the total check shows what is
  missing.
- Shared-code change: `recordPendingBillFromPO` skips POs that have a capture (ripple-checked:
  acceptGRN, app/actions/inventory receive, create-invoice dialog, approve/confirm PO; the
  deprecated copy in finance.ts now delegates).

### Verified

- `npx vitest run`: 1,223 pass; the same 7 failures as before the branch
  (`app/actions/inventory.test.ts` ×5, `__tests__/finance/invoice-payment-flow.test.ts` ×2). 29 new
  tests (parser on both sample PDFs, matching, templates, status rules, save/pay actions with a
  mocked Prisma, the bill guard).
- `npx tsc --noEmit`: 21 errors = baseline. `NODE_ENV=production npm run build`: pass.
- Browser walkthrough on a local Postgres with the two sample invoices: RMB import saved, 30% deposit,
  shipped with resi, partial receipt (140/690), rest received, paid off. Books afterwards:
  GR/IR 0, Hutang 0, Persediaan +Rp 220.738.500, Bank −Rp 220.738.500. IDR faktur with PPN saved
  with "dibayar + datang" ticked: DPP to GR/IR, PPN 1.084.325 to PPN Masukan (1330), trial balance
  difference 0. Duplicate file and duplicate invoice number are both caught before Simpan.

### Measured (Apple Silicon, local Postgres, `next dev` — production builds render faster)

| What | Time |
|---|---|
| Drop text PDF → form on screen | 129 ms first drop, 59–64 ms after (pdf.js read 37–103 ms) |
| Scan/photo via OCR | 10.8 s the very first time (engine + model download), then 0.85–1.3 s |
| Simpan → row in list (optimistic) | 23–29 ms; server done incl. bill posting 120–150 ms |
| Pay / receive → screen updated (optimistic) | 13 ms; server done 46–90 ms |
| Open pay / ship / receive dialog | 17–22 ms |
| Filter chip | 8–9 ms |
| Search a part code | 44 ms |
| Open detail from list (prefetched on hover) | ~51 ms |
| Sidebar → list with data (prefetched) | 53–64 ms |
| SQL at 5,000 purchases / 30,000 lines: first page · page 50 · search · filter · KPI | 0.28 · 0.81 · 0.61 · 0.07 · 9.4 ms |

Click latency was measured from the click to the DOM change with a MutationObserver (the
browser pane was hidden, which throttles requestAnimationFrame, so frame-based numbers were not
usable).

### Not done yet

- **Production:** migration not applied to Supabase, nothing pushed or deployed (needs Richie's OK).
- Cancel / edit a saved purchase from this page. The existing `cancelPurchaseOrder` writes a
  non-existent `Invoice.notes` column, so cancelling a PO that has a bill fails today.
- FX gain/loss when the bank rate differs from the booked rate; landed cost (freight, bea masuk,
  PPN impor, PPh 22) for imports.
- LLM fallback for low-confidence invoices — needs Richie's OK before any invoice content goes to
  an outside API.
- OCR engine and language model load from public CDNs on first use (no invoice content is sent);
  self-hosting them under `public/` would make the first scan faster and work offline.
- Only generated sample invoices were tested. The first real supplier invoices will show which
  layouts need template tweaks.
- Seen in local demo mode only: a hard reload of any page lands on `/dashboard` (pre-existing,
  also on `/procurement/orders`).
- Speed in production: the DB is in Tokyo and every server action also calls Supabase Auth;
  pinning Vercel functions to the DB's region would cut each round trip.
