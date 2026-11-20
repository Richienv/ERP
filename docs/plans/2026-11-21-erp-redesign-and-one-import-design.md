# ERP redesign for 40–60+ users, and one import that does the work

**Date:** 2026-11-21 · **Branch:** `feat/erp-redesign` (stacked on `feat/sparepart-purchasing`, PR #20)
**Status:** decided and built in one night while Richie slept; every ⚑ is his to overturn.

## What Richie asked (paraphrased)

The old look feels unprofessional and makes him dizzy. The people using it are 40–60+: it must be
truly easy, familiar (SAP, Accurate, Excel), never cheap. They should never wonder what to click or
what they are waiting for, and should feel clever using it. Fewer clicks; one upload that makes
everything happen; still fast. Money is Rupiah.

## Who and what, from the real files (read locally, never committed — public repo)

the purchase-cycle folder on the external SSD shows the whole trading cycle:

| Folder | Document | Direction | Layout facts the parser must handle |
|---|---|---|---|
| `USER [PO]` | PO from **the main customer (a vehicle-rental company)**, e.g. `PO24 - CBANG - 00777` | customer → us | PDF; `TO / PIC / REF PR / MODEL UNIT`; lines `MATERIAL, QTY, HARGA SATUAN, DISC, JUMLAH HARGA`; `Jumlah / PPN 11% / Jumlah Total` |
| `VENDOR [PO]/<vendor>` | our **PO** or **CO** (= *Cash Order*) to a vendor, e.g. `CO24-03-0016` to a vendor (with a named PIC) | us → vendor | xlsx + PDF; doc number printed alone; `KEPADA / PIC / PEMBAYARAN / MODEL UNIT`; columns `MATERIAL, PART NUMBER, QTY, unit, HARGA SATUAN, DISC, JUMLAH HARGA`; accounting format `(  200,000.00)` and `-Rp 100,000-` that is **not** negative |
| `SURAT JALAN` | our delivery note, e.g. `SJ2023-07-0005` to the customer | us → customer | xlsx; `KEPADA / PIC / REFF PO`; lines `MATERIAL, PART NUMBER, JML, unit`, no prices |
| `INVOICE` | our invoice, e.g. `050/INV-CJ/JKT/XII/2023` to the customer | us → customer | xlsx, 3 sheets (Invoice, kwitansi, tanda terima); `Nomor PO / Tanggal PO`; part number and name in separate cells; `Jumlah / PPN 11% / Total` |

Part numbers are Mitsubishi OE codes (`4605A930`, `MR527540`, sometimes `3880A036 / MR992374`),
model units are Triton / L200 / bus. Amounts are Rupiah; English digit grouping is common in these
Excel files (`2,520,000.00`).

## Visual system ("Integra Pro")

- **Familiar, calm, dense enough:** the SAP/Accurate look — white surfaces, light grey canvas,
  thin 1 px borders, 8 px radius, soft shadow only on raised things. No black slabs, no hard
  offset shadows, no SHOUTING UPPERCASE labels.
- **Brand colour:** deep blue (trust, banks, SAP). Every former orange accent becomes blue;
  amber stays for "needs attention", red for "late / error", green for "done".
- **Type for older eyes:** Plus Jakarta Sans (made for Indonesia, very legible, tabular figures),
  root size 17 px (≈ +6%), nothing below 12.75 px, labels in sentence case, semibold not black.
- **Status in words, never colour alone:** every badge says *Belum bayar*, *Dibayar sebagian*,
  *Lunas*, *Dalam perjalanan*, … with a dot.
- **Every wait says what it waits for:** skeletons carry a line like "Memuat daftar pembelian…".
- **Every action confirms what happened:** toasts are larger, in Indonesian, say the result and
  the document number, stay 6 s, and offer the next step.
- **Logo:** a navy rounded square holding three stacked ledger bars that form an "I" — Integra,
  books in order. Wordmark "integra" in Plus Jakarta Sans semibold.

How it is applied to 350+ files without hand-editing each: theme tokens in `app/globals.css`, the
shared `NB` tokens in `lib/dialog-styles.ts` re-pointed to the new look, and one reviewed codemod
(`scripts/redesign-codemod.mjs`) that rewrites the brutalist utility classes everywhere
(`border-2 border-black` → `border border-border`, hard shadows → `shadow-sm`, `rounded-none` →
`rounded-md`, `font-black` → `font-semibold`, `uppercase`/`tracking-*` removed, `text-[10px|11px]`
→ `text-xs`, `orange-*` → `blue-*`). Shell pieces (sidebar, header, logo, toasts, skeletons, status
badges) get hand-made polish.

## One import ("Import dokumen")

One drop zone on the spare-part page accepts **PDF, photo or Excel**. Excel cells are turned into
the same positioned text the PDF reader produces, so one parser reads all of them.

1. **Recognise** the document type (invoice / surat jalan / PO / CO) and direction (is the issuer
   us — our company — or someone else?) from its title words and header block.
2. **Read** number, date, counterparty, PIC, reference PO, model unit, lines (part number, name,
   qty, unit, price, disc, amount), totals and PPN.
3. **Do everything it implies, in one click:**
   - **Our PO / CO to a vendor** → creates the purchase order (vendor, parts, prices, model unit as
     compatibility), ready to receive and to match the vendor's invoice later.
   - **Vendor invoice** → if it names one of our POs/COs, the bill attaches to **that** PO (no
     second PO) with a quantity/price match; otherwise the existing fast lane creates both.
   - **Surat jalan from a vendor** (goods arrived) → receives the matching PO lines by part
     number: stock and GR/IR journal in one go.
   - **Customer documents (the customer's PO, our SJ and invoice to the customer)** → recognised and read, and the
     screen says plainly that sales is not switched on in this edition yet. ⚑ Sales flow is the next
     step (it needs the hidden Sales module).
4. The review screen states, before Simpan, exactly what will happen ("Buat PO CO24-03-0016 ke
   a vendor · 17 barang · Rp 20.158.000").

## Not in this round

Sales-side automation (customer PO → sales order → SJ → AR invoice); restyling every chart colour;
print layouts; mobile-first redesign of dense tables (they scroll horizontally at 375 px).

## What shipped (2026-11-21, branch `feat/erp-redesign`)

### One import — verified end to end in the browser on the local DB

Real CO from the SSD (a real CO workbook, read locally, never committed) → a synthetic vendor
invoice and surat jalan that reference it:

| Step | What the screen said before Simpan | Result | Time |
|---|---|---|---|
| Drop the CO (Excel) | "Cash Order CO24-03-0016 · PIC (vendor) · Unit TRITON — Simpan akan membuat CO ke VENDOR A · 16 barang · Rp 20.158.000" | PO `CO24-03-0016` (ORDERED), "Belum ada tagihan" | read 87–114 ms, save 139 ms |
| Drop the vendor invoice | "Tagihan akan ditempel ke CO24-03-0016 — 3 barang cocok. Tidak ada PO dobel." | bill `BILL-CO24-03-0016` on the same PO, posted DR GR/IR / CR Hutang | 117 ms |
| Drop the vendor surat jalan | "Barang … akan diterima ke CO24-03-0016: stok bertambah dan jurnal persediaan tercatat otomatis." | GRN, 22 pcs into stock, DR Persediaan / CR GR/IR | 103 ms |
| Drop the customer's PO (customer) | "Dokumen penjualan … modul penjualan belum aktif" | read in full, nothing saved, button explains why | read 47 ms |

Books afterwards: one PO for the vendor (no twin), trial balance difference 0, GR/IR left open
exactly for the invoiced-but-not-yet-delivered lines.

Parser on 10 real documents (vendor PO/CO in PDF and Excel, customer POs, surat jalan, invoices): every
line, part number, quantity, price and total read; arithmetic check 0 on all but one — `PO24-04-019`
whose own printed JUMLAH (Rp 17.222.500) does not match its 45 lines (Rp 60.451.000). The review
screen shows that difference in amber, which is the point.

### Redesign

- Theme tokens, Plus Jakarta Sans, 17 px root, deep-blue brand, navy-ready sidebar tokens.
- Codemod over 446 files (22,010 class rewrites); `NB` tokens re-valued (keys unchanged).
- Shell polish (logo, sidebar, header, toasts, waiting states, status words, login): see the commit
  "Integra Pro shell".
