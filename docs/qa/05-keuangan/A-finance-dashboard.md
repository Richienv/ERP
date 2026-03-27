# QA — A. Finance Dashboard (Keuangan & Akuntansi)

> **Last verified**: 2026-03-27
> **Source**: `app/finance/page.tsx` (265 lines)

---

## 1. Page Info

| Field | Value |
|-------|-------|
| **Name** | Keuangan & Akuntansi |
| **Route** | `/finance` |
| **Breadcrumb** | Sidebar → Keuangan |
| **Client-side** | `"use client"` — fully client-rendered |
| **Component** | `FinanceDashboardPage` (default export) |

---

## 2. Purpose

Main finance dashboard showing KPI metrics (cash balance, AR, AP, net margin), a 7-day cash flow chart, recent transactions, accounting action items, and quick-access module shortcuts with inline dialog forms.

---

## 3. UI Elements

### 3.1 Command Header (NB-styled card)

| Element | Details |
|---------|---------|
| **Icon** | `Wallet` (indigo), left side |
| **Title** | "Keuangan & Akuntansi" — `h1`, uppercase, font-black |
| **Subtitle** | "Gambaran umum posisi keuangan, arus kas, dan tugas akuntansi" |
| **Button: "Laporan Cepat"** | Right side, outline variant, `Activity` icon, links to `/finance/reports` |
| **Button: "Entri Jurnal Baru"** | Right side, black bg, `Scale` icon, links to `/finance/journal` |

### 3.2 KPI Pulse Strip (4-card grid)

| KPI Card | Icon | Label | Value Source | Color |
|----------|------|-------|-------------|-------|
| **Posisi Kas** | `Wallet` | "Posisi Kas" | `metrics.cashBalance` | Emerald (green) |
| **Piutang (AR)** | `FileText` | "Piutang (AR)" | `metrics.receivables` | Blue |
| **Utang (AP)** | `CreditCard` | "Utang (AP)" | `metrics.payables` | Rose (red) |
| **Laba Bersih (YTD)** | `PiggyBank` | "Laba Bersih (YTD)" | `metrics.netMargin` (%) | Amber |

- Layout: `grid-cols-2 md:grid-cols-4`
- Each card has colored top bar (`h-1`), formatted with `formatCompactNumber()`
- Net Margin shows percentage with `%` suffix
- Subtitles: "Cash on Hand", "Invoice terbuka", "Bill belum lunas", "Net Margin"

### 3.3 Finance Module Actions Card (`AccountingModuleActions`)

**Trigger buttons** (4-column grid `sm:grid-cols-2 xl:grid-cols-4`):

| Button | Icon | Opens Dialog |
|--------|------|-------------|
| "Pembayaran (AP)" | `Receipt` | AP Payment dialog |
| "Chart of Accounts" | `BookOpenText` | COA creation dialog |
| "Jurnal Umum" | `FileSpreadsheet` | Journal entry dialog |
| "Laporan Keuangan" | `FileBarChart` | Report selection dialog |

**Quick-link buttons** (below separator):

| Button | Links to |
|--------|---------|
| "Buka Modul Pembayaran AP" | `/finance/vendor-payments` |
| "Buka Chart of Accounts" | `/finance/chart-accounts` |
| "Buka Jurnal Umum" | `/finance/journal` |
| "Buka Laporan Keuangan" | `/finance/reports` |

### 3.4 Cash Flow Chart (7 Days)

| Element | Details |
|---------|---------|
| **Component** | `CashFlowChart` from `components/finance/cash-flow-chart.tsx` |
| **Type** | Recharts `AreaChart` with two areas |
| **Green area** | `incoming` — "Masuk" |
| **Red area** | `outgoing` — "Keluar" |
| **X-axis** | Day names (Indonesian: Sen, Sel, Rab...) |
| **Y-axis** | Amount (numeric, auto-scaled) |
| **Tooltip** | Custom styled (rounded, bordered) |
| **Legend** | Two dots: green "Masuk", red "Keluar" |
| **Height** | 250px |
| **Header** | "Cash Flow (7 Hari)" with `TrendingUp` icon, indigo accent |

### 3.5 Recent Transactions List

| Element | Details |
|---------|---------|
| **Header** | "Transaksi Terakhir" with `DollarSign` icon |
| **Link** | "Lihat Jurnal Umum" → `/finance/journal` |
| **Each row** | Direction badge (IN green / OUT red), title, subtitle, date, formatted amount |
| **Amount prefix** | `+` for incoming, `-` for outgoing |
| **Date format** | `id-ID` locale via `toLocaleDateString()` |
| **Empty state** | `DollarSign` icon + "Belum ada transaksi terbaru" |
| **Max items** | 6 (from backend) |
| **Clickable** | Yes — each row links to relevant page (`/finance/payments`, `/finance/vendor-payments`, `/finance/journal`, `/finance/invoices`, `/finance/bills`) |

### 3.6 Action Items (To-Do Accounting)

| Element | Details |
|---------|---------|
| **Header** | "To-Do Accounting" with `AlertCircle` icon, amber accent |
| **Badge** | Count of action items (amber background) |
| **Item types** | `urgent` (red), `pending` (amber), `warning` (blue), `info` (zinc) |
| **Each item** | Type icon, title (truncated), due date |
| **Empty state** | `AlertCircle` icon + "Tidak ada action item" |
| **Items are always 4** | Overdue bills, Overdue AR invoices, PO pending approval, Draft journals |
| **Clickable** | Yes — each links to respective page |

### 3.7 Quick Access Grid (2x2)

| Cell | Icon | Label | Links to |
|------|------|-------|---------|
| Top-left | `FileText` (blue) | "Buat Invoice" | `/finance/invoices` |
| Top-right | `CreditCard` (rose) | "Catat Bill" | `/finance/bills` |
| Bottom-left | `Activity` (amber) | "Rekonsiliasi" | `/finance/reports` |
| Bottom-right | `ArrowUpRight` (emerald) | "Transfer Kas" | `/finance/vendor-payments` |

---

## 4. User Actions

### 4.1 Navigation Actions

| # | Action | Trigger | Destination |
|---|--------|---------|-------------|
| 1 | Open financial reports | Click "Laporan Cepat" button | `/finance/reports` |
| 2 | Open journal list | Click "Entri Jurnal Baru" button | `/finance/journal` |
| 3 | Click recent transaction | Click any row in "Transaksi Terakhir" | Varies (`/finance/payments`, `/finance/vendor-payments`, `/finance/journal`, `/finance/invoices`, `/finance/bills`) |
| 4 | Click action item | Click any To-Do item | Varies (`/finance/bills`, `/finance/invoices`, `/procurement/orders`, `/finance/journal`) |
| 5 | Quick access links | Click any 2x2 grid cell | Varies (see 3.7) |
| 6 | Quick link buttons | Click "Buka Modul..." | 4 different finance routes |

### 4.2 Dialog: Pembayaran AP (AP Payment)

| Step | Details |
|------|---------|
| **Trigger** | Click "Pembayaran (AP)" button |
| **Success** | Toast: "Pembayaran AP tersimpan (PAY-xxx)", dialog closes, queries invalidated (`financeDashboard`, `vendorPayments`, `bills`, `invoices`, `journal`) |
| **Failure** | Toast error: server error message or "Gagal membuat pembayaran AP" |
| **Validation** | Client-side: vendor and amount > 0 required → toast: "Lengkapi vendor dan jumlah pembayaran" |
| **Loading** | Button shows `Loader2` spinner + "Menyimpan..." |
| **Server action** | `recordVendorPayment()` from `lib/actions/finance.ts` |

### 4.3 Dialog: Chart of Accounts (COA)

| Step | Details |
|------|---------|
| **Trigger** | Click "Chart of Accounts" button |
| **Success** | Toast: "Akun COA berhasil dibuat", dialog closes, queries invalidated (`financeDashboard`, `chartAccounts`, `glAccounts`) |
| **Failure** | Toast error: server error message or "Gagal membuat akun COA" |
| **Validation** | Client-side: code and name required → toast: "Kode akun dan nama akun wajib diisi". Submit button also disabled when `!coaCode.trim() || !coaName.trim()` |
| **Loading** | Button shows `Loader2` spinner + "Menyimpan..." |
| **Server action** | `createGLAccount()` from `lib/actions/finance.ts` |
| **Preview** | Live preview strip shows code, name, type when user types |

### 4.4 Dialog: Jurnal Umum (General Journal)

| Step | Details |
|------|---------|
| **Trigger** | Click "Jurnal Umum" button |
| **Success** | Toast: "Jurnal umum berhasil diposting", dialog closes, queries invalidated (`financeDashboard`, `journal`, `chartAccounts`) |
| **Failure** | Toast error: server error message or "Gagal memposting jurnal" |
| **Validation** | Client-side: description, debit account, credit account, amount > 0 all required → toast: "Lengkapi deskripsi, akun debit/kredit, dan nominal jurnal". Debit ≠ credit → toast: "Akun debit dan kredit harus berbeda". Invalid account → toast: "Akun jurnal tidak valid" |
| **Loading** | Button shows `Loader2` spinner + "Memproses..." |
| **Server action** | `postJournalEntry()` from `lib/actions/finance.ts` |

### 4.5 Dialog: Laporan Keuangan (Financial Reports)

| Step | Details |
|------|---------|
| **Trigger** | Click "Laporan Keuangan" button |
| **Behavior** | No server call — builds URL params and navigates to `/finance/reports?type=pnl&startDate=...&endDate=...` |
| **Defaults** | Report type: `pnl`, Start: Jan 1 current year, End: today |

---

## 5. Form Validations

### 5.1 AP Payment Dialog

| Field | Required | Type | Validation | Error Message |
|-------|----------|------|-----------|---------------|
| Vendor | Yes (*) | Select (dropdown) | Must select a vendor | "Lengkapi vendor dan jumlah pembayaran" |
| Tagihan | No | Select (dropdown) | Optional bill link; "Tidak ditautkan" option | — |
| Jumlah | Yes (*) | `number` (min=0) | Must be > 0 | "Lengkapi vendor dan jumlah pembayaran" |
| Metode | Yes (*) | Select | TRANSFER / CASH / CHECK, defaults to TRANSFER | — (always has value) |
| Referensi | No | Text | Free text | — |

### 5.2 COA Dialog

| Field | Required | Type | Validation | Error Message |
|-------|----------|------|-----------|---------------|
| Tipe Akun | Yes (*) | Tile selector (5 options) | ASSET / LIABILITY / EQUITY / REVENUE / EXPENSE, defaults to ASSET | — (always has value) |
| Kode | Yes (*) | Text (mono) | Non-empty after trim | "Kode akun dan nama akun wajib diisi" |
| Nama Akun | Yes (*) | Text | Non-empty after trim | "Kode akun dan nama akun wajib diisi" |

**Note**: No format validation on code (no check for numeric, length, uniqueness on client). Server may reject duplicates.

### 5.3 Journal Dialog

| Field | Required | Type | Validation | Error Message |
|-------|----------|------|-----------|---------------|
| Deskripsi | Yes (*) | Text | Non-empty | "Lengkapi deskripsi, akun debit/kredit, dan nominal jurnal" |
| Referensi | No | Text | Free text | — |
| Akun Debit | Yes (*) | Select (dropdown) | Must select an account | (same as above) |
| Akun Kredit | Yes (*) | Select (dropdown) | Must select an account; must ≠ debit | "Akun debit dan kredit harus berbeda" |
| Nominal | Yes (*) | `number` (min=0) | Must be > 0 | (same as deskripsi) |

### 5.4 Report Dialog

| Field | Required | Type | Validation | Error Message |
|-------|----------|------|-----------|---------------|
| Jenis Laporan | Yes | Tile selector (3 options) | pnl / bs / cf, defaults to pnl | — (always has value) |
| Dari | No | `date` | Defaults to Jan 1 current year | — |
| Sampai | No | `date` | Defaults to today | — |

**Note**: No validation that `startDate < endDate`.

---

## 6. API Calls

### 6.1 Page Load — `useFinanceDashboard()` hook

| Item | Details |
|------|---------|
| **Hook** | `hooks/use-finance-dashboard.ts` |
| **Query key** | `["financeDashboard", "list"]` |
| **Calls** | `Promise.all([getFinancialMetrics(), getFinanceDashboardData()])` |
| **Loading state** | Full-page `TablePageSkeleton` with indigo accent |
| **Error state** | None explicitly — if `isLoading || !data`, shows skeleton forever |

#### `getFinancialMetrics()` — `lib/actions/finance-reports.ts:328`

| Detail | Value |
|--------|-------|
| **Returns** | `FinancialMetrics` object |
| **Queries** | Supabase direct queries for: AR invoices (open), AP invoices (open), Cash accounts (ASSET type, specific codes), Expenses (30 days), Revenue (MTD), Overdue invoices |
| **Fallback** | If Supabase queries error, falls back to Prisma queries |
| **Key fields** | `cashBalance`, `receivables`, `payables`, `netMargin`, `revenue`, `burnRate`, `overdueInvoices`, `upcomingPayables`, `status.cash`, `status.margin` |

#### `getFinanceDashboardData()` — `lib/actions/finance-reports.ts:147`

| Detail | Value |
|--------|-------|
| **Returns** | `FinanceDashboardData` object |
| **Auth** | `withPrismaAuth()` — requires Supabase session |
| **Queries** | Payments (7 days, limit 100), Journal entries (limit 8), Invoices (7 days, limit 8), Overdue bills count, Overdue customer invoices count, PO pending approval count, Draft journal count |
| **Key fields** | `cashFlow` (7-day array), `actionItems` (4 items always), `recentTransactions` (up to 6, sorted by date desc) |

### 6.2 Module Actions — Master Data Load

| Detail | Value |
|--------|-------|
| **Trigger** | `useEffect` on mount (runs once) |
| **Calls** | `Promise.all([getVendors(), getVendorBills(), getGLAccountsList()])` |
| **Error handling** | Toast: "Gagal memuat data master finance" |
| **Loading indicator** | `loadingMaster` state disables vendor select |

### 6.3 Dialog Submit Actions

| Dialog | Server Action | Invalidates |
|--------|--------------|-------------|
| AP Payment | `recordVendorPayment()` | financeDashboard, vendorPayments, bills, invoices, journal |
| COA | `createGLAccount()` | financeDashboard, chartAccounts, glAccounts |
| Journal | `postJournalEntry()` | financeDashboard, journal, chartAccounts |
| Reports | (no API — client-side navigation only) | — |

---

## 7. State & Dependencies

### 7.1 Data Dependencies

| Data | Source | Required for |
|------|--------|-------------|
| `metrics` | `getFinancialMetrics()` | KPI strip (cash, AR, AP, margin) |
| `dashboardData.cashFlow` | `getFinanceDashboardData()` | Cash flow chart |
| `dashboardData.recentTransactions` | `getFinanceDashboardData()` | Recent transactions list |
| `dashboardData.actionItems` | `getFinanceDashboardData()` | To-Do accounting widget |
| `vendors` | `getVendors()` | AP payment dialog vendor dropdown |
| `bills` | `getVendorBills()` | AP payment dialog bill dropdown |
| `glAccounts` | `getGLAccountsList()` | Journal dialog account selects, COA context |

### 7.2 Component Dependencies

| Component | File | Used for |
|-----------|------|---------|
| `AccountingModuleActions` | `components/finance/accounting-module-actions.tsx` | 4 dialog forms + quick links |
| `CashFlowChart` | `components/finance/cash-flow-chart.tsx` | 7-day chart |
| `ActionItemsWidget` | `components/finance/action-items-widget.tsx` | (imported but NOT used inline — the page renders its own version) |
| `TablePageSkeleton` | `components/ui/page-skeleton.tsx` | Loading state |

### 7.3 State Management

- `useFinanceDashboard()` — TanStack Query, no staleTime set (default)
- `AccountingModuleActions` has 15+ `useState` hooks for 4 dialog forms
- No URL state — dashboard has no filters or pagination

---

## 8. Edge Cases & States

### 8.1 Loading State

- Full-page `TablePageSkeleton` with indigo accent bar
- Shown when `isLoading || !data`

### 8.2 Empty States

| Area | Empty Condition | Display |
|------|----------------|---------|
| Recent Transactions | `recentTransactions.length === 0` | `DollarSign` icon + "Belum ada transaksi terbaru" (centered, padded) |
| Action Items | `actionItems.length === 0` | `AlertCircle` icon + "Tidak ada action item" |
| Cash Flow Chart | Empty `data` array | Chart renders empty (no data points, axes still show) |
| Vendor Select (AP dialog) | `vendors.length === 0` | Empty dropdown, disabled while loading |
| Bill Select (AP dialog) | No bills for selected vendor | Only "Tidak ditautkan" option shown |
| GL Accounts (Journal) | `glAccounts.length === 0` | Empty dropdown |

### 8.3 Error States

| Scenario | Handling |
|----------|---------|
| `useFinanceDashboard` query fails | **No explicit error UI** — page stays on skeleton forever |
| Master data load fails | Toast: "Gagal memuat data master finance" |
| AP payment submit fails | Toast with server error or fallback message |
| COA create fails | Toast with server error or fallback message |
| Journal post fails | Toast with server error or fallback message |
| `getFinanceDashboardData` throws | Returns empty objects (cashFlow: [], actionItems: [], recentTransactions: []) — silent fallback |
| `getFinancialMetrics` Supabase errors | Falls back to Prisma queries silently |

### 8.4 Permission / Role

- No role-based visibility checks on this page
- Auth enforced at server action level via `withPrismaAuth()`
- Route protected by middleware (Supabase session required)

### 8.5 Large Dataset Behavior

| Area | Limit |
|------|-------|
| Recent transactions | Hard-capped at 6 items (backend) |
| Action items | Always exactly 4 items (hardcoded categories) |
| Cash flow | Always 7 data points (7 days) |
| Payments query | Capped at 100 (backend), only last 7 days |
| Journal entries query | Capped at 8 (backend) |

### 8.6 Responsive Behavior

- KPI strip: `grid-cols-2` on mobile, `grid-cols-4` on md+
- Main content: single column on mobile, `lg:grid-cols-3` (chart 2/3, sidebar 1/3)
- Module actions grid: `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4`

---

## 9. Issues & Notes

### 9.1 Bugs / Potential Issues

| # | Issue | Severity | Details |
|---|-------|----------|---------|
| 1 | **No error state for main query** | Medium | If `useFinanceDashboard` query fails, page shows skeleton forever. No error message, no retry button. User is stuck. |
| 2 | **ActionItemsWidget imported but not used** | Low | `ActionItemsWidget` component is imported (line 14) but the page renders its own inline action items widget (lines 193-228). The imported component is dead code. |
| 3 | **Action items always 4 regardless** | Low | Even when counts are 0, all 4 action items show with `type: 'info'`. This could be confusing — 4 "info" items saying "Tidak ada overdue" is noise, not actionable. Consider hiding zero-count items. |
| 4 | **No date validation in Report dialog** | Low | Start date can be after end date. No client-side check. Server may handle this but user gets no immediate feedback. |
| 5 | **Journal dialog limited to 2 lines** | Low | Quick journal only creates 1 debit + 1 credit line. Complex multi-line journals must use the full `/finance/journal/new` page. This is by design but not communicated to the user. |
| 6 | **Quick Access "Rekonsiliasi" links to `/finance/reports`** | Low | The "Rekonsiliasi" quick link goes to `/finance/reports`, not `/finance/reconciliation`. Potentially misleading label. |
| 7 | **Mixed Supabase + Prisma in metrics** | Info | `getFinancialMetrics` uses Supabase client directly (not Prisma), with Prisma as fallback. This dual-path approach adds complexity. |
| 8 | **`any` type usage** | Info | `dashboardData.recentTransactions.map((item: any)` and `dashboardData.actionItems.map((action: any)` — loses type safety. Data is typed at the server action level but cast to `any` at render. |
| 9 | **Master data loads on every mount** | Info | `AccountingModuleActions` loads vendors, bills, and GL accounts in a `useEffect` on mount. This is not cached via TanStack Query — it re-fetches every time the component mounts. |

### 9.2 Design Consistency

| Item | Status |
|------|--------|
| NB border-2 border-black | ✅ Used consistently in header, KPI strip, chart wrapper, transactions, action items, quick access |
| Shadow `[3px_3px...]` or `[4px_4px...]` | ✅ Consistent |
| Font-black uppercase tracking | ✅ All section headers |
| Color accent bars | ✅ Indigo (header, chart), emerald/blue/rose/amber (KPI), amber (action items), zinc (transactions, quick access) |
| `AccountingModuleActions` card style | ⚠️ Uses `rounded-2xl` Card (non-NB) while rest of page is NB-styled. Visual inconsistency. |
