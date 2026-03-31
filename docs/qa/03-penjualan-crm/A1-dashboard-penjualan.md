# QA: A1 — Dashboard Penjualan (Main)

## 1. Page Info

| Field | Value |
|-------|-------|
| **Name** | Dashboard Penjualan & CRM |
| **Route** | `/sales` |
| **File** | `app/sales/page.tsx` |
| **Breadcrumb** | Penjualan & CRM (top-level, no parent breadcrumb) |
| **Rendering** | Client-side (`"use client"`) |

## 2. Purpose

Displays a real-time overview of sales performance, CRM pipeline status, and recent financial activity — serving as the main entry point for the Penjualan & CRM module.

## 3. UI Elements

### 3.1 Header Row

| Element | Detail |
|---------|--------|
| **Title** | `<h1>` "Penjualan & CRM" — uppercase, font-black, tracking-widest |
| **Subtitle** | "Monitor performa Sales, CRM pipeline, dan status eksekusi order" |
| **Button: "Quotation"** | Position: top-right. Icon: `FileText` (left). Variant: outline, NB style (`border-2 border-black shadow-[2px_2px]`). Links to `/sales/quotations/new` |
| **Button: "Sales Order"** | Position: top-right, next to Quotation. Icon: `Package` (left). Variant: filled black (`bg-black text-white`). Links to `/sales/orders/new` |

### 3.2 KPI Strip (5 cards, horizontal grid)

Rendered inside a single NB card (`border-2 border-black shadow-[4px_4px]`). Grid: `grid-cols-2 md:grid-cols-5`. Each cell is a clickable `<Link>`.

| # | KPI Label | Value Source | Detail Text | Icon | Health Indicator | Link Target |
|---|-----------|-------------|-------------|------|------------------|-------------|
| 1 | Revenue MTD | `monthlyRevenue._sum.totalAmount` (INV_OUT, non-cancelled, current month) | Current month name (id-ID locale) | `TrendingUp` | Green if >0, Amber if 0 | `/finance` |
| 2 | Sales Orders | `orderStats` total count across all statuses | Total order value (IDR) | `ShoppingCart` | Green if >0, Amber if 0 | `/sales/orders` |
| 3 | Order Aktif | Count of orders with status CONFIRMED, IN_PROGRESS, DELIVERED, INVOICED | "dalam proses" | `Package` | Green if >0, Amber if 0 | `/sales/orders` |
| 4 | Quotation | Count of quotes with status DRAFT, SENT, ACCEPTED | Pipeline value (IDR) | `FileText` | Green if >0, Amber if 0 | `/sales/quotations` |
| 5 | AR Outstanding | `openAR._sum.balanceDue` (INV_OUT with ISSUED/PARTIAL/OVERDUE) | "piutang aktif" | `CircleDollarSign` | Green if 0, Critical (red) if >50M, Amber otherwise | `/finance/invoices` |

**Health indicator**: Small 2x2 square (`h-2 w-2 border border-black`) with color: `bg-emerald-500` (good), `bg-amber-500` (warning), `bg-red-500` (critical).

### 3.3 Recent Sales Orders Panel (left column, `md:col-span-7`)

| Element | Detail |
|---------|--------|
| **Section header** | Icon: `Package`. Title: "Sales Order Terbaru". Link: "Semua" with `ArrowRight` → `/sales/orders` |
| **Order list** | Up to 5 most recent orders. Each row is a clickable `<Link>` to `/sales/orders/[id]` |
| **Row content (left)** | Blue dot indicator (`h-2 w-2 bg-blue-500`), Order number (bold uppercase), Customer name + date (mono, zinc-400) |
| **Row content (right)** | Total amount (IDR, font-black), Status badge (NB style `border-2 border-black`) |
| **Empty state** | "Belum ada sales order." (centered, zinc-400) |

**Status badge colors:**
| Status | Background |
|--------|-----------|
| COMPLETED | `bg-emerald-100 text-emerald-800` |
| CANCELLED | `bg-red-100 text-red-800` |
| CONFIRMED | `bg-blue-100 text-blue-800` |
| Other | `bg-zinc-100 text-zinc-800` |

### 3.4 CRM Snapshot Panel (right column, `md:col-span-5`)

| Element | Detail |
|---------|--------|
| **Section header** | Icon: `Users`. Title: "CRM Snapshot". Link: "Detail" with `ArrowRight` → `/sales/leads` |
| **Summary cards** | 2-column grid of bordered boxes |
| **Card 1: Total Leads** | Count: `totalLeads`. Sub-text: "Open: {openLeadValue}" (IDR) |
| **Card 2: Quotations** | Count: `activeQuotes`. Sub-text: "Pipeline: {quotePipelineValue}" (IDR) |
| **Recent Quotations list** | Up to 4 recent quotations. Each row: quote number + customer name → links to `/sales/quotations/[id]` |
| **Quotation empty state** | "Belum ada quotation." |
| **CRM Action buttons** | 2-column grid: "CRM Leads" → `/sales/leads`, "Quotations" → `/sales/quotations`. Both NB outline style |

**Quotation status badge colors:**
| Status | Style |
|--------|-------|
| ACCEPTED | `text-emerald-700 bg-emerald-50` |
| SENT | `text-blue-700 bg-blue-50` |
| REJECTED | `text-red-700 bg-red-50` |
| Other | `text-zinc-600` (white bg) |

### 3.5 Recent Invoices Strip (conditional — only shown if invoices exist)

| Element | Detail |
|---------|--------|
| **Section header** | Icon: `Receipt`. Title: "Invoice Terbaru". Link: "Semua" → `/finance/invoices` |
| **Layout** | Grid: `grid-cols-1 md:grid-cols-5`, divided by `divide-x-2 divide-black` |
| **Each invoice cell** | Number (bold uppercase), customer name, total amount (IDR), status badge |
| **All cells link to** | `/finance/invoices` (not individual invoice detail) |

**Invoice status badge colors:**
| Status | Style |
|--------|-------|
| PAID | `bg-emerald-100 text-emerald-700` |
| ISSUED | `bg-blue-100 text-blue-700` |
| OVERDUE | `bg-red-100 text-red-700` |
| Other | `bg-zinc-100 text-zinc-700` |

### 3.6 Quick Links Strip (3 groups, bottom row)

| Group | Header Color | Links |
|-------|-------------|-------|
| **Link Cepat Keuangan** | `bg-emerald-500` | "Penerimaan (AR)" → `/finance/invoices`, "Jurnal Umum" → `/finance/journal` |
| **Eksekusi Order** | `bg-blue-500` | "Sales Order Queue" → `/sales/orders`, "Manufacturing WO" → `/manufacturing` |
| **Master Data** | `bg-purple-500` | "Customer Master" → `/sales/customers`, "Product & Stock" → `/inventory` |

Each link: NB style with `border-2 border-black`, shadow hover effect, icon + label.

## 4. User Actions

### 4.1 Navigation Actions

| # | Action | Trigger | Target |
|---|--------|---------|--------|
| 1 | Create new quotation | Click "Quotation" button (header) | `/sales/quotations/new` |
| 2 | Create new sales order | Click "Sales Order" button (header) | `/sales/orders/new` |
| 3 | View all sales orders | Click "Semua" link (SO panel header) | `/sales/orders` |
| 4 | View specific sales order | Click any order row in Recent SO list | `/sales/orders/[id]` |
| 5 | View CRM leads pipeline | Click "Detail" link (CRM header) OR "CRM Leads" button | `/sales/leads` |
| 6 | View specific quotation | Click any quote row in Recent Quotations | `/sales/quotations/[id]` |
| 7 | View all quotations | Click "Quotations" button (CRM panel) | `/sales/quotations` |
| 8 | View all invoices | Click "Semua" link (Invoice header) OR any invoice cell | `/finance/invoices` |
| 9 | Navigate to finance | Click "Revenue MTD" KPI | `/finance` |
| 10 | Navigate to AR invoices | Click "AR Outstanding" KPI | `/finance/invoices` |
| 11 | Navigate via quick links | Click any quick link card | Various (see 3.6) |

### 4.2 Data Actions

This page is **read-only** — no create, update, or delete operations are performed directly. All mutations happen on the linked sub-pages.

### 4.3 Trigger → Success → Failure

| Action | Trigger | Success | Failure |
|--------|---------|---------|---------|
| Page load / data fetch | Navigate to `/sales` | KPI strip, order list, CRM snapshot, invoices all populate | Hook throws error → caught by `app/sales/error.tsx` → `ErrorFallback` with moduleName "Penjualan" and retry button |

## 5. Form Validations

**None** — this page contains no forms or input fields.

## 6. API Calls

### 6.1 `GET /api/sales/page-data`

| Field | Value |
|-------|-------|
| **Called by** | `useSalesPage()` hook → `hooks/use-sales-page.ts` |
| **Query key** | `["salesPage", "list"]` |
| **Auth** | Supabase `getUser()` — returns 401 if not authenticated |
| **Method** | GET |
| **Parameters** | None |
| **Loading state** | `CardPageSkeleton` with `accentColor="bg-blue-400"` |

**Response shape** (`data` field):

```typescript
{
  monthlyRevenue: {
    _sum: { totalAmount: Decimal | null }
  },
  orderStats: Array<{
    status: string,
    _count: { _all: number },
    _sum: { total: Decimal | null }
  }>,
  quotationStats: Array<{
    status: string,
    _count: { _all: number },
    _sum: { total: Decimal | null }
  }>,
  leadStats: Array<{
    status: string,
    _count: { _all: number },
    _sum: { estimatedValue: Decimal | null }
  }>,
  openAR: {
    _sum: { balanceDue: Decimal | null }
  },
  recentOrders: Array<{
    id: string, number: string, status: string,
    orderDate: string, total: number,
    customer: { name: string } | null
  }>,  // max 5, ordered by orderDate desc
  recentQuotations: Array<{
    id: string, number: string, status: string,
    quotationDate: string, total: number,
    customer: { name: string } | null
  }>,  // max 4, ordered by quotationDate desc
  recentInvoices: Array<{
    id: string, number: string, status: string,
    totalAmount: number, balanceDue: number,
    customer: { name: string } | null
  }>   // max 5, INV_OUT only, ordered by issueDate desc
}
```

**Prisma queries executed (8 parallel):**

| # | Query | Filter |
|---|-------|--------|
| 1 | `invoice.aggregate` (sum totalAmount) | INV_OUT, not CANCELLED/VOID, issueDate >= 1st of current month |
| 2 | `salesOrder.groupBy` (by status) | None — all orders |
| 3 | `quotation.groupBy` (by status) | None — all quotations |
| 4 | `lead.groupBy` (by status) | None — all leads |
| 5 | `invoice.aggregate` (sum balanceDue) | INV_OUT, status in ISSUED/PARTIAL/OVERDUE |
| 6 | `salesOrder.findMany` (take 5) | Ordered by orderDate desc, includes customer.name |
| 7 | `quotation.findMany` (take 4) | Ordered by quotationDate desc, includes customer.name |
| 8 | `invoice.findMany` (take 5) | INV_OUT, ordered by issueDate desc, includes customer.name |

## 7. State & Dependencies

### 7.1 Data Dependencies

| Dependency | Source | Required? |
|-----------|--------|-----------|
| Authentication | Supabase session cookie | Yes — 401 without it |
| Sales Orders | `SalesOrder` table + `Customer` relation | Yes (for KPIs + recent list) |
| Quotations | `Quotation` table + `Customer` relation | Yes (for KPIs + recent list) |
| Leads | `Lead` table | Yes (for CRM snapshot KPIs) |
| Invoices (AR) | `Invoice` table (type=INV_OUT) + `Customer` relation | Yes (for revenue, AR, recent invoices) |

### 7.2 Component Dependencies

| Component | Source | Purpose |
|-----------|--------|---------|
| `useSalesPage` | `hooks/use-sales-page.ts` | React Query data fetching |
| `CardPageSkeleton` | `components/ui/page-skeleton.tsx` | Loading state |
| `Button` | `components/ui/button` | Header CTA buttons, CRM action buttons |
| `ErrorFallback` | `components/ui/error-fallback` (via `app/sales/error.tsx`) | Error boundary |
| Lucide icons (10 used, 12 imported) | `lucide-react` | All icons throughout the page |

### 7.3 Local Utilities

| Function | Purpose |
|----------|---------|
| `formatIDR(value)` | Formats number as IDR currency (no decimals, id-ID locale) |
| `toNumber(value, fallback)` | Safely converts unknown to finite number with fallback |

## 8. Edge Cases & States

### 8.1 Loading State

- **Trigger**: `isLoading === true` or `raw` is falsy
- **Display**: `CardPageSkeleton` with `accentColor="bg-blue-400"`
- **Skeleton includes**: Page header bones + card grid bones (from shared skeleton component)

### 8.2 Empty State — No Sales Orders

- Recent Sales Orders panel shows: "Belum ada sales order." (centered)
- KPI "Sales Orders" shows `0`, health indicator is amber
- KPI "Order Aktif" shows `0`, health indicator is amber

### 8.3 Empty State — No Quotations

- CRM Snapshot "Quotations" card shows `0`, pipeline Rp 0
- "Quotation Terbaru" section shows: "Belum ada quotation."

### 8.4 Empty State — No Invoices

- "Invoice Terbaru" strip is **completely hidden** (conditional render: `(recentInvoices ?? []).length > 0`)
- Revenue MTD shows Rp 0, health indicator is amber

### 8.5 Empty State — No Leads

- CRM Snapshot "Total Leads" card shows `0`, Open: Rp 0

### 8.6 Error State

- API returns 500 → `useQuery` throws → React error boundary catches
- `app/sales/error.tsx` renders `ErrorFallback` with `moduleName="Penjualan"` and a retry button

### 8.7 Unauthenticated

- API returns `{ error: "Unauthorized" }` with status 401
- `useSalesPage` hook treats non-ok response as thrown error → error boundary

### 8.8 Permission / Role-Based Visibility

- No role-based filtering within the page itself
- Route protection handled by `middleware.ts` and `route-guard.tsx` (managers have access to `/sales`)
- All data returned regardless of user role (no per-role query filtering in API)

### 8.9 Large Dataset Behavior

- Not a concern for this page — all lists are hardcoded `take: 5` (orders), `take: 4` (quotations), `take: 5` (invoices)
- KPI aggregations use `groupBy` and `aggregate` which scale fine

### 8.10 Decimal / Null Safety

- `toNumber()` helper handles `null`, `undefined`, `NaN`, `Infinity` from Prisma Decimal fields
- All `??` null coalescing used on array fields: `recentOrders ?? []`, `orderStats ?? []`, etc.
- API route converts Decimal to Number explicitly: `Number(o.total) || 0`

## 9. Issues & Notes

### 9.1 Invoice Links Are Generic

All invoice cells in "Invoice Terbaru" link to `/finance/invoices` (the list page), not to the individual invoice detail page. This is inconsistent with the sales orders section where each row links to its detail page (`/sales/orders/[id]`).

**Severity**: Low (UX inconsistency)
**Expected**: Each invoice cell should link to `/finance/invoices/[id]` (if such a route exists) or at least pass a filter.

### 9.2 `accentColor` Prop is Unused

`CardPageSkeleton` accepts an `accentColor` prop (`"bg-blue-400"`) but the skeleton implementation hardcodes the accent bar as `bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500`. The prop has no effect.

**Severity**: Low (cosmetic dead code)

### 9.3 No Auto-Refresh / Polling

The page fetches data once on mount via React Query defaults. There is no `refetchInterval` configured, so the dashboard becomes stale if left open. For a dashboard page, periodic refresh would be expected.

**Severity**: Low (stale data risk for users who keep the tab open)

### 9.4 Status Badges Show Raw English Enum Values

Order statuses (`COMPLETED`, `CONFIRMED`, `IN_PROGRESS`, etc.) and quotation/invoice statuses are displayed as raw English enum strings. Given the Bahasa Indonesia localization requirement, these should be translated (e.g., `CONFIRMED` → "Dikonfirmasi", `IN_PROGRESS` → "Dalam Proses").

**Severity**: Medium (localization gap, violates "Bahasa Indonesia first" principle)

### 9.5 `orderStats` Includes All Orders (No Date Filter)

KPIs "Sales Orders" and "Order Aktif" count ALL orders ever created (no date filter), while "Revenue MTD" is filtered to the current month. This mismatch can be confusing — a user may see revenue of Rp 0 for the month but 50 total orders.

**Severity**: Low (potential confusion, but may be intentional — lifetime vs. monthly view)

### 9.6 Health Threshold for AR Outstanding is Hardcoded

The AR Outstanding KPI uses a hardcoded threshold of `50_000_000` (50M IDR) to determine `critical` vs `warning`. This isn't configurable and may not suit all businesses.

**Severity**: Low (business logic assumption)

### 9.7 No Loading Skeleton for Individual Sections

The entire page shows `CardPageSkeleton` during initial load. There is no per-section skeleton or progressive loading — it's all-or-nothing.

**Severity**: Low (acceptable for a single API call pattern)

### 9.8 Unused Imports

`BarChart3` and `Square` are imported from `lucide-react` (lines 12, 16) but never used in the JSX. Dead code.

**Severity**: Trivial (lint warning, no runtime impact)

### 9.9 Dark Mode Support

All components include `dark:` Tailwind variants. Should be tested to ensure proper contrast and readability across all sections.

---

**QA Tester Notes:**
- Verify all 11 navigation links resolve to valid pages
- Verify KPI values match database state
- Test with zero data (fresh database) — all empty states should render cleanly
- Test with unauthenticated session — should redirect/show error, not crash
- Check mobile layout (2-column KPI grid on mobile, single-column on smaller screens)
- Verify IDR formatting shows correct grouping separators for large numbers
