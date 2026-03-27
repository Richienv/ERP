# QA Checklist — Modul Penjualan & CRM

> **Cakupan:** Semua halaman, subhalaman, komponen, modal, dan dialog di bawah `/sales/*`
> **Tanggal:** 2026-03-27
> **Status:** Selesai — lihat `_module-summary.md` untuk ringkasan lengkap

---

## A. Halaman & Route

| # | Subpage / Feature | File Path | Route | Status |
|---|-------------------|-----------|-------|--------|
| A1 | Dashboard Penjualan (main) | `app/sales/page.tsx` | `/sales` | ✅ |
| A2 | Error Boundary (sales module) | `app/sales/error.tsx` | `/sales/*` (error) | ✅ |

### Pelanggan (Customers)

| # | Subpage / Feature | File Path | Route | Status |
|---|-------------------|-----------|-------|--------|
| A3 | Daftar Pelanggan | `app/sales/customers/page.tsx` | `/sales/customers` | ✅ |
| A4 | Loading Skeleton Pelanggan | `app/sales/customers/loading.tsx` | `/sales/customers` (loading) | ✅ |
| A5 | Buat Pelanggan Baru | `app/sales/customers/new/page.tsx` | `/sales/customers/new` | ✅ |
| A6 | Detail Pelanggan | `app/sales/customers/[id]/page.tsx` | `/sales/customers/[id]` | ✅ |

### Pesanan Penjualan (Sales Orders)

| # | Subpage / Feature | File Path | Route | Status |
|---|-------------------|-----------|-------|--------|
| A7 | Daftar Pesanan | `app/sales/orders/page.tsx` | `/sales/orders` | ✅ |
| A8 | Loading Skeleton Pesanan | `app/sales/orders/loading.tsx` | `/sales/orders` (loading) | ✅ |
| A9 | Buat Pesanan Baru | `app/sales/orders/new/page.tsx` | `/sales/orders/new` | ✅ |
| A10 | Detail Pesanan | `app/sales/orders/[id]/page.tsx` | `/sales/orders/[id]` | ✅ |

### Penawaran (Quotations)

| # | Subpage / Feature | File Path | Route | Status |
|---|-------------------|-----------|-------|--------|
| A11 | Daftar Penawaran (Kanban) | `app/sales/quotations/page.tsx` + `client-view.tsx` | `/sales/quotations` | ✅ |
| A12 | Loading Skeleton Penawaran | `app/sales/quotations/loading.tsx` | `/sales/quotations` (loading) | ✅ |
| A13 | Buat Penawaran Baru | `app/sales/quotations/new/page.tsx` | `/sales/quotations/new` | ✅ |
| A14 | Detail Penawaran | `app/sales/quotations/[id]/page.tsx` | `/sales/quotations/[id]` | ✅ |
| A15 | Edit Penawaran | `app/sales/quotations/[id]/edit/page.tsx` | `/sales/quotations/[id]/edit` | ✅ |

### Prospek / Leads

| # | Subpage / Feature | File Path | Route | Status |
|---|-------------------|-----------|-------|--------|
| A16 | Pipeline Prospek (Kanban) | `app/sales/leads/page.tsx` | `/sales/leads` | ✅ |
| A17 | Loading Skeleton Leads | `app/sales/leads/loading.tsx` | `/sales/leads` (loading) | ✅ |
| A18 | Buat Prospek Baru | `app/sales/leads/new/page.tsx` | `/sales/leads/new` | ✅ |

### Daftar Harga (Price Lists)

| # | Subpage / Feature | File Path | Route | Status |
|---|-------------------|-----------|-------|--------|
| A19 | Galeri Daftar Harga | `app/sales/pricelists/page.tsx` + `client-view.tsx` | `/sales/pricelists` | ✅ |
| A20 | Buat Daftar Harga Baru | `app/sales/pricelists/new/page.tsx` | `/sales/pricelists/new` | ✅ |

### Diskon (Discounts)

| # | Subpage / Feature | File Path | Route | Status |
|---|-------------------|-----------|-------|--------|
| A21 | Daftar Skema Diskon | `app/sales/discounts/page.tsx` + `client-view.tsx` | `/sales/discounts` | ✅ |

### Salesperson & Komisi

| # | Subpage / Feature | File Path | Route | Status |
|---|-------------------|-----------|-------|--------|
| A22 | Master Salesperson + Laporan Komisi | `app/sales/salespersons/page.tsx` | `/sales/salespersons` | ✅ |

### Arus Penjualan (Sales Stream)

| # | Subpage / Feature | File Path | Route | Status |
|---|-------------------|-----------|-------|--------|
| A23 | Dashboard Arus Penjualan | `app/sales/sales/page.tsx` | `/sales/sales` | ✅ |

---

## B. Komponen Utama

### Pelanggan (Customer Components)

| # | Komponen / Feature | File Path | Status |
|---|-------------------|-----------|--------|
| B1 | Customer Rolodex Card (card view) | `components/sales/customer-rolodex-card.tsx` | ✅ |
| B2 | Customer Data Table (table view) | `components/sales/customer-data-table.tsx` | ✅ |
| B3 | Customer Form (full-page create/edit) | `components/sales/customer-form.tsx` | ✅ |
| B4 | Customer Edit Dialog (inline edit modal) | `components/sales/customer-edit-dialog.tsx` | ✅ |

### Pesanan (Sales Order Components)

| # | Komponen / Feature | File Path | Status |
|---|-------------------|-----------|--------|
| B5 | Sales Order Form (create/edit) | `components/sales/sales-order-form.tsx` | ✅ |
| B6 | Sales Order Data Table | `components/sales/sales-order-data-table.tsx` | ✅ |
| B7 | Order Execution Card (status + actions) | `components/sales/order-execution-card.tsx` | ✅ |
| B8 | Quick Order Dialog (1-step creation) | `components/sales/quick-order-dialog.tsx` | ✅ |
| B9 | Amend Order Dialog (revisi pesanan) | `components/sales/amend-order-dialog.tsx` | ✅ |
| B10 | Sales Return Dialog (retur penjualan) | `components/sales/sales-return-dialog.tsx` | ✅ |
| B11 | Fulfillment Tracker (pengiriman) | `components/sales/fulfillment-tracker.tsx` | ✅ |
| B12 | Revision History Panel | `components/sales/revision-history-panel.tsx` | ✅ |

### Penawaran (Quotation Components)

| # | Komponen / Feature | File Path | Status |
|---|-------------------|-----------|--------|
| B13 | Quotation Form (create/edit) | `components/sales/quotation-form.tsx` | ✅ |
| B14 | Quotation Kanban Board (drag-drop) | `components/sales/quotation-kanban.tsx` | ✅ |
| B15 | Color-Size Quotation Grid (variant matrix) | `components/sales/color-size-quotation-grid.tsx` | ✅ |

### Prospek (Lead Components)

| # | Komponen / Feature | File Path | Status |
|---|-------------------|-----------|--------|
| B16 | Lead Kanban Board | `components/sales/leads/lead-kanban.tsx` | ✅ |
| B17 | Lead Card | `components/sales/leads/lead-card.tsx` | ✅ |
| B18 | Lead Column | `components/sales/leads/lead-column.tsx` | ✅ |

### Daftar Harga (Pricelist Components)

| # | Komponen / Feature | File Path | Status |
|---|-------------------|-----------|--------|
| B19 | Price Book Gallery | `components/sales/pricelists/price-book-gallery.tsx` | ✅ |
| B20 | Booklet Viewer (sheet detail) | `components/sales/pricelists/booklet-viewer.tsx` | ✅ |

### Diskon (Discount Components)

| # | Komponen / Feature | File Path | Status |
|---|-------------------|-----------|--------|
| B21 | Discount Form Dialog (create/edit) | `app/sales/discounts/discount-form-dialog.tsx` | ✅ |

### Penjualan (Sales Data Components)

| # | Komponen / Feature | File Path | Status |
|---|-------------------|-----------|--------|
| B22 | Sales Data Table (invoice list) | `components/sales/sales-data-table.tsx` | ✅ |

### Dashboard Widgets

| # | Komponen / Feature | File Path | Status |
|---|-------------------|-----------|--------|
| B23 | Sales Pipeline Widget | `components/sales-dashboard/sales-pipeline.tsx` | ✅ |
| B24 | Sales Action Center | `components/sales-dashboard/sales-action-center.tsx` | ✅ |
| B25 | Order Book Widget (capacity chart) | `components/sales-dashboard/order-book.tsx` | ✅ |
| B26 | Product Variants Widget | `components/sales-dashboard/product-variants.tsx` | ✅ |

---

## C. Data Hooks (React Query)

| # | Hook | File Path | Status |
|---|------|-----------|--------|
| C1 | useCustomers | `hooks/use-customers.ts` | ✅ |
| C2 | useCustomerDetail | `hooks/use-customer-detail.ts` | ✅ |
| C3 | useSalesOrders | `hooks/use-sales-orders.ts` | ✅ |
| C4 | useSalesOrderDetail | `hooks/use-sales-order-detail.ts` | ✅ |
| C5 | useQuotations | `hooks/use-quotations.ts` | ✅ |
| C6 | useQuotationDetail | `hooks/use-quotation-detail.ts` | ✅ |
| C7 | useLeads | `hooks/use-leads.ts` | ✅ |
| C8 | usePriceLists | `hooks/use-price-lists.ts` | ✅ |
| C9 | useDiscounts | `hooks/use-discounts.ts` | ✅ |
| C10 | useSalespersons | `hooks/use-salespersons.ts` | ✅ |
| C11 | useSalesDashboard | `hooks/use-sales-dashboard.ts` | ✅ |
| C12 | useSalesPage | `hooks/use-sales-page.ts` | ✅ |
| C13 | useSalesOptions | `hooks/use-sales-options.ts` | ✅ |

---

## D. API Routes

| # | Endpoint | File Path | Methods | Status |
|---|----------|-----------|---------|--------|
| D1 | `/api/sales/customers` | `app/api/sales/customers/route.ts` | GET | ✅ |
| D2 | `/api/sales/customers/[id]` | `app/api/sales/customers/[id]/route.ts` | GET, PUT | ✅ |
| D3 | `/api/sales/orders` | `app/api/sales/orders/route.ts` | GET, POST | ✅ |
| D4 | `/api/sales/orders/[id]` | `app/api/sales/orders/[id]/route.ts` | GET | ✅ |
| D5 | `/api/sales/orders/[id]/create-work-orders` | `app/api/sales/orders/[id]/create-work-orders/route.ts` | POST | ✅ |
| D6 | `/api/sales/quotations` | `app/api/sales/quotations/route.ts` | GET, POST | ✅ |
| D7 | `/api/sales/quotations/[id]` | `app/api/sales/quotations/[id]/route.ts` | GET | ✅ |
| D8 | `/api/sales/leads` | `app/api/sales/leads/route.ts` | GET | ✅ |
| D9 | `/api/sales/leads/[id]` | `app/api/sales/leads/[id]/route.ts` | PATCH | ✅ |
| D10 | `/api/sales/discounts` | `app/api/sales/discounts/route.ts` | GET, POST | ✅ |
| D11 | `/api/sales/salespersons` | `app/api/sales/salespersons/route.ts` | GET, POST | ✅ |
| D12 | `/api/sales/salespersons/commission-report` | `app/api/sales/salespersons/commission-report/route.ts` | GET | ✅ |
| D13 | `/api/sales/dashboard` | `app/api/sales/dashboard/route.ts` | GET | ✅ |
| D14 | `/api/sales/page-data` | `app/api/sales/page-data/route.ts` | GET | ✅ |
| D15 | `/api/sales/options` | `app/api/sales/options/route.ts` | GET | ✅ |

---

## E. Server Actions (`lib/actions/`)

### Core Sales (`lib/actions/sales.ts`)

| # | Action / Function | Status |
|---|-------------------|--------|
| E1 | `getSalesStats()` — KPI bulanan | ✅ |
| E2 | `getAllCustomers()` — daftar pelanggan | ✅ |
| E3 | `getQuotations(filters)` — daftar penawaran | ✅ |
| E4 | `createQuotation(data)` — buat penawaran | ✅ |
| E5 | `updateQuotationStatus(id, status)` — ubah status penawaran | ✅ |
| E6 | `createInvoice(data)` — buat invoice | ✅ |
| E7 | `approveInvoice(id)` — setujui invoice | ✅ |
| E8 | `recordPayment(invoiceId, amount, method)` — catat pembayaran | ✅ |
| E9 | `convertQuotationToSalesOrder(quotationId)` — konversi penawaran → SO | ✅ |
| E10 | `getAllPriceLists()` — daftar harga | ✅ |
| E11 | `getPriceListById(id)` — detail daftar harga | ✅ |
| E12 | `createPriceList(data)` — buat daftar harga | ✅ |
| E13 | `updatePriceList(id, data)` — update daftar harga | ✅ |
| E14 | `deletePriceList(id)` — hapus daftar harga | ✅ |
| E15 | `addPriceListItem(data)` — tambah item harga | ✅ |
| E16 | `removePriceListItem(id)` — hapus item harga | ✅ |
| E17 | `getProductsForPriceList()` — produk tersedia | ✅ |
| E18 | `createQuotationRevision(id, data)` — revisi penawaran | ✅ |
| E19 | `getQuotationVersionHistory(id)` — riwayat versi | ✅ |
| E20 | `getSOFulfillment(salesOrderId)` — status pengiriman | ✅ |
| E21 | `recordPartialShipment(salesOrderId, items)` — pengiriman parsial | ✅ |
| E22 | `generateInvoiceFromSalesOrder(salesOrderId)` — invoice dari SO | ✅ |
| E23 | `createSalesReturn(data)` — retur penjualan | ✅ |
| E24 | `getSalesOrderForReturn(salesOrderId)` — data SO untuk retur | ✅ |
| E25 | `cancelSalesOrder(salesOrderId)` — batalkan SO | ✅ |

### Order Amendments (`lib/actions/order-amendments.ts`)

| # | Action / Function | Status |
|---|-------------------|--------|
| E26 | `amendSalesOrder(input)` — revisi SO | ✅ |
| E27 | `getSalesOrderRevisionHistory(salesOrderId)` — riwayat revisi SO | ✅ |

### AR & Payments (`lib/actions/finance-ar.ts` — sales-related)

| # | Action / Function | Status |
|---|-------------------|--------|
| E28 | `createCreditNote(data)` — nota kredit | ✅ |
| E29 | `recordARPayment(data)` — pembayaran AR | ✅ |
| E30 | `matchPaymentToInvoice(paymentId, invoiceId)` — matching pembayaran | ✅ |
| E31 | `getARPaymentRegistry(input)` — registri pembayaran AR | ✅ |
| E32 | `getOpenInvoices()` — invoice belum lunas | ✅ |

### Invoices (`lib/actions/finance-invoices.ts` — sales-related)

| # | Action / Function | Status |
|---|-------------------|--------|
| E33 | `createCustomerInvoice(data)` — buat invoice pelanggan | ✅ |
| E34 | `createInvoiceFromSalesOrder(salesOrderId)` — invoice dari SO | ✅ |
| E35 | `moveInvoiceToSent(invoiceId, message, method)` — kirim invoice | ✅ |
| E36 | `recordInvoicePayment(data)` — pembayaran invoice | ✅ |

---

## F. Alur Bisnis End-to-End (Cross-Feature)

| # | Alur / Workflow | Halaman Terkait | Status |
|---|----------------|-----------------|--------|
| F1 | Buat Prospek → Follow-up → Won | A16, A18, B16-B18 | ✅ |
| F2 | Buat Pelanggan → Buat Penawaran → Kirim | A5, A13, B3, B13 | ✅ |
| F3 | Penawaran → Konversi ke SO | A14, B14 (konversi button) | ✅ |
| F4 | SO → Buat Work Order (manufaktur) | A10, B7 (create WO button) | ✅ |
| F5 | SO → Pengiriman Parsial → Selesai | A10, B11 | ✅ |
| F6 | SO → Generate Invoice → Pembayaran | A10, B7, E22 | ✅ |
| F7 | Revisi Penawaran (version history) | A15, B12, E18-E19 | ✅ |
| F8 | Amend SO (revisi pesanan) | B9, E26-E27 | ✅ |
| F9 | Retur Penjualan → Credit Note | B10, E23, E28 | ✅ |
| F10 | Pembatalan SO → Reverse GL | B7, E25 | ✅ |
| F11 | Quick Order (1-step dari customer card) | B1, B8 | ✅ |
| F12 | Daftar Harga → Pasang ke Pelanggan | A19-A20, B19-B20, E10-E17 | ✅ |
| F13 | Skema Diskon → Terapkan ke Penawaran | A21, B21 | ✅ |
| F14 | Salesperson → Komisi (laporan) | A22, D11-D12 | ✅ |

---

## Ringkasan

| Kategori | Jumlah Item | Selesai |
|----------|-------------|---------|
| A. Halaman & Route | 23 | 23 ✅ |
| B. Komponen Utama | 26 | 26 ✅ |
| C. Data Hooks | 13 | 13 ✅ |
| D. API Routes | 15 | 15 ✅ |
| E. Server Actions | 36 | 36 ✅ |
| F. Alur End-to-End | 14 | 14 ✅ |
| **TOTAL** | **127** | **127 ✅** |

> **Issue ditemukan:** 13 Critical, 35+ Medium, 25+ Low — lihat `_module-summary.md` Section 3
