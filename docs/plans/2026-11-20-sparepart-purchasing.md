# Pembelian Sparepart Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upload a supplier invoice PDF, review the parsed fields, save it as a PO + bill, then record payment, shipment and (partial) receipt from one fast list.

**Architecture:** Parsing runs in the browser (pdf.js text layer → pure-TS parser, tesseract.js only for scans). One new action file `lib/actions/sparepart-purchasing.ts` composes the existing canonical actions (`moveInvoiceToSent`, `recordVendorPayment`, `markAsShipped`, `createGRN`/`acceptGRN`). Two new tables (`SupplierInvoiceCapture`, `SupplierInvoiceTemplate`); list reads live from bill + PO items with keyset pagination and a trigram search index.

**Tech Stack:** Next.js 16 App Router, React 19, Prisma 6 / Postgres, TanStack Query 5, pdfjs-dist 5.7.284, tesseract.js 7 (lazy), Vitest 4.

Design: `docs/plans/2026-11-20-sparepart-purchasing-design.md`.

Local setup used for every task: Postgres 16 on `localhost:54329` (db `erp_spareparts`, user `erp`, trust auth), `.env.local` with `DATABASE_URL`/`DIRECT_URL` pointing there, `ALLOW_LOCAL_DEMO=1`, `NEXT_PUBLIC_ALLOW_LOCAL_DEMO=1`. Never point at the Supabase production URL.

---

### Task 1: Baseline

**Step 1:** `npx prisma migrate deploy` against the local DB, then `npx prisma db seed` (or the lightest seed that gives GL accounts + a warehouse).
**Step 2:** `npx vitest run` → record the baseline (5 known failures in `app/actions/inventory.test.ts`).
**Step 3:** `npx tsc --noEmit | grep -c "error TS"` → expect 21 (baseline in `docs/reliability/TYPECHECK_BASELINE.md`).

### Task 2: Number, date and currency helpers (pure)

**Files:** Create `lib/invoice-parse/numbers.ts`, Test `__tests__/invoice-parse-numbers.test.ts`

- `detectNumberLocale(samples: string[], currency?: string): "id" | "en"` — votes on `\d{1,3}(\.\d{3})+(,\d+)?` vs `\d{1,3}(,\d{3})+(\.\d+)?`; ambiguous → IDR ⇒ "id", else "en".
- `parseAmount(raw: string, locale): number | null` — strips `Rp`, `RMB`, `¥`, `$`, spaces, `%`.
- `parseDocDate(raw: string, order?: "DMY"|"YMD"|"MDY"): Date | null` — `12/11/2026`, `2026-11-08`, `8 Nov 2026`, `12 November 2026`, `2026年11月8日`.
- `detectCurrency(text: string): "IDR"|"CNY"|"USD"|null` — RMB/CNY/¥/人民币 → CNY; USD/US$ → USD; Rp/IDR/Rupiah → IDR.

Tests: `"18,000.00"`→18000 (en), `"2.040.000"`→2040000 (id), `"1.084.325"`, `"4.037.500"`, `"88,650.00"`, `"5%"`→5; dates above; currency detection on both fixtures' text.
Run: `npx vitest run __tests__/invoice-parse-numbers.test.ts` → FAIL, implement, PASS. Commit.

### Task 3: Layout + field + table parser (pure)

**Files:** Create `lib/invoice-parse/types.ts`, `lib/invoice-parse/layout.ts`, `lib/invoice-parse/parse-invoice.ts`; Test `__tests__/invoice-parse.test.ts` with fixtures `__tests__/fixtures/invoices/*.items.json` (text items dumped from the PDFs in Task 4).

```ts
export type TextItem = { str: string; x: number; y: number; w: number; h: number; page: number }
export type FieldKey = "supplierName"|"supplierNpwp"|"supplierEmail"|"invoiceNo"|"invoiceDate"|"dueDate"|"poRef"|"currency"|"paymentTerms"|"subtotal"|"tax"|"taxRate"|"total"
export type ParsedField<T> = { value: T; confidence: number; source?: { page: number; x: number; y: number; w: number; h: number } }
export type ParsedLine = { partNo: string|null; description: string; qty: number|null; unit: string|null; unitPrice: number|null; discountPct: number|null; amount: number|null; confidence: number; issues: string[]; source?: Box }
export type ParsedInvoice = { fields: Partial<Record<FieldKey, ParsedField<any>>>; lines: ParsedLine[]; numberLocale: "id"|"en"; checks: { linesVsSubtotal: number|null; subtotalPlusTaxVsTotal: number|null }; confidence: number; headerCells: string[]; method: "TEXT"|"OCR" }
export type SupplierTemplate = { columnMap: Record<string, ColumnKey>; labelMap: Partial<Record<FieldKey, string>>; numberLocale?: "id"|"en"; dateOrder?: "DMY"|"YMD"|"MDY" }
export function parseInvoice(items: TextItem[], opts?: { template?: SupplierTemplate }): ParsedInvoice
```

Tests (both fixtures): invoice no, date, currency, supplier name, NPWP (ID), every line's partNo/qty/unitPrice/amount, wrapped description joined ("DIESEL PUMP VACUUM PRESSURE VALVE"), discount 5% line, subtotal/tax/total, both checks = 0, overall confidence ≥ 0.9. A template test: a header "Kode Part" unknown to the dictionary is mapped via `template.columnMap`. A garbage test: empty items → empty result, no throw.
Commit.

### Task 4: PDF → text items (pdf.js) + fixtures

**Files:** Create `lib/invoice-parse/pdf-text.ts` (works in browser worker and Node), `scripts/gen-invoice-fixtures.sh` (Typst → PDF), fixtures `__tests__/fixtures/invoices/{cn-commercial-invoice,id-faktur-lokal}.pdf`; Test `__tests__/invoice-parse-pdf.test.ts`.

- `extractTextItems(data: ArrayBuffer, pdfjs): Promise<{ items: TextItem[]; pages: number; chars: number }>` — y flipped to top-left origin.
- Test loads `pdfjs-dist/legacy/build/pdf.mjs`, extracts both fixtures, runs `parseInvoice`, asserts the same totals as Task 3, and logs timing (expect < 300 ms each).
Commit.

### Task 5: Matching + template learning (pure)

**Files:** Create `lib/invoice-parse/match.ts`; Test `__tests__/invoice-parse-match.test.ts`.

- `matchSupplier(parsed, suppliers)` → by NPWP digits, then email domain, then normalized name similarity (fastest-levenshtein) ≥ 0.8.
- `matchLines(lines, products, supplierSkus)` → supplier SKU exact → product code exact (normalized: uppercase, strip spaces/dashes) → none.
- `learnTemplate(prev, parsed, corrected)` → merges column/label maps, bumps `samples`.
Commit.

### Task 6: Schema + migration

**Files:** Modify `prisma/schema.prisma` (add the two models + back-relations on Supplier/PurchaseOrder/Invoice), Create `prisma/migrations/20261120090000_sparepart_invoice_capture/migration.sql` (tables, unique, btree indexes, `CREATE EXTENSION IF NOT EXISTS pg_trgm`, GIN trigram index on `search_text`).

Run: `npx prisma migrate deploy && npx prisma generate`. Verify with `\d supplier_invoice_captures`. Commit.

### Task 7: Ripple-guarded change in shared bill code

**Files:** Modify `lib/actions/finance-invoices.ts` (`recordPendingBillFromPO`), Test `__tests__/sparepart-bill-guard.test.ts`.

Load `erp-ripple-check` first. In `recordPendingBillFromPO`, after loading `livePo`, return `{ success: true, skipped: true, reason: "supplier_invoice_captured" }` when a capture exists for the PO. Trace consumers (`acceptGRN`, `createBillFromPOId`, `approvePurchaseOrder`, `confirmPurchaseOrder`) — all treat `skipped` as success. Commit.

### Task 8: Server actions

**Files:** Create `lib/actions/sparepart-purchasing.ts`, `lib/sparepart-purchase-logic.ts` (pure: IDR conversion, status derivation, next action, search text); Tests `__tests__/sparepart-purchase-logic.test.ts`, `__tests__/sparepart-purchasing-actions.test.ts`.

Actions (all `"use server"`, `getAuthzUser` + `assertRole`, one `withPrismaAuth` per transaction, never nested):
- `getSparepartLookup()` → suppliers (id, code, name, npwp, email), templates, products (id, code, name, unit), supplier SKUs, last rate per supplier, warehouses, default warehouse.
- `listSparepartPurchases({ cursor?, q?, filter?, limit=30 })` → one `$queryRaw` with keyset pagination; returns rows with `paidPct`, `receivedPct`, `stage`, `nextAction`, plus KPI counts when no cursor.
- `getSparepartPurchase(id)` → detail: items with ordered/received, payments, GRNs, events, file info.
- `checkSupplierInvoiceDuplicate({ sha256?, supplierId?, invoiceNo? })`.
- `saveSupplierInvoice(input)` → core transaction (supplier/product upserts, SupplierProduct skuCode/price, PO at VENDOR_CONFIRMED, bill DRAFT with `glAccountCode = GR_IR_CLEARING`, capture, event, template) → after commit: `moveInvoiceToSent` if role allows → optional first payment → optional full receipt. Returns per-step results.
- `postSparepartBill(id)`, `recordSparepartPayment({ id, amountOriginal, method, bankAccountCode, date })`, `markSparepartShipped({ id, trackingNumber?, eta? })`, `receiveSparepartGoods({ id, warehouseId, lines: [{ poItemId, qty }] })`.
Tests: transaction contents and order, duplicate invoice → friendly error, RMB → IDR conversion and rounding, payment updates `PurchaseOrder.paymentStatus`, role failure. Commit.

### Task 9: File storage route

**Files:** Create `lib/sparepart-file-store.ts`, `app/api/procurement/sparepart-invoices/upload/route.ts` (POST, auth, ≤10 MB, PDF/JPEG/PNG/WebP, content-addressed path `supplier-invoices/<sha256>.<ext>`), `app/api/procurement/sparepart-invoices/[id]/file/route.ts` (GET, auth, streams). Local demo → `.local-uploads/` (add to `.gitignore`); otherwise Supabase bucket `documents` with signed URL redirect. Commit.

### Task 10: Client data layer

**Files:** Modify `lib/query-keys.ts` (`sparepartPurchases: { all, list(params), detail(id), lookup() }`), `lib/cache-tiers.ts` (`ROUTE_TIERS`), `hooks/use-nav-prefetch.ts` (`/procurement/spareparts`), `lib/sidebar-nav-data.ts` (Pengadaan → "Sparepart"); Create `hooks/use-sparepart-purchases.ts` (infinite list, detail, lookup, optimistic mutations with rollback + `invalidateOpsLoop`). Commit.

### Task 11: Parse worker + review screen

**Files:** Create `lib/invoice-parse/worker.ts` (module worker: pdf.js + parse), `lib/invoice-parse/client.ts` (preload, `parseInvoiceFile(file)`, timing), `components/procurement/spareparts/invoice-review.tsx` (split view, PDF canvas + boxes, form, checks, toggles, Simpan), `components/procurement/spareparts/invoice-dropzone.tsx`.
Commit.

### Task 12: List + detail page

**Files:** Create `app/procurement/spareparts/page.tsx`, `components/procurement/spareparts/purchase-list.tsx`, `purchase-detail-sheet.tsx`, `payment-dialog.tsx`, `ship-dialog.tsx`, `receive-dialog.tsx`, `stage-bars.tsx`. NB design tokens, Bahasa Indonesia labels, one primary CTA per screen. Commit.

### Task 13: OCR fallback

**Files:** Modify `lib/invoice-parse/client.ts`; Create `lib/invoice-parse/ocr.ts` (tesseract.js lazy import, words → `TextItem`), copy language data to `public/ocr/`. Test with a rasterised fixture. Commit.

### Task 14: Verify

- `npx vitest run` (no new failures), `npx tsc --noEmit` (≤ 21), `npm run lint` on new files, `NODE_ENV=production npm run build`.
- Browser walkthrough on local demo: upload both fixtures, save, pay 30% of the RMB one, mark shipped, receive partially then fully, pay the rest. Check journal entries balance and GR/IR nets to zero.
- Measure: parse time (performance marks), click → paint latency for open detail / filter / search / optimistic pay (PerformanceObserver `event` timing), list query time (`EXPLAIN ANALYZE` with ~2,000 seeded captures).
- Write results into the design doc's "What shipped" section. Commit. **No push, no deploy** without Richie's OK.
