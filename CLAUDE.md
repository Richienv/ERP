# CLAUDE.md

This file provides guidance to Claude Code when working with this Indonesian ERP system.

## Implementation SOP — User-First Thinking

> **MANDATORY**: Every feature we build must be justified by a real user problem. After completing any implementation, always explain the impact in this format:
>
> **Sebelumnya (Before):** What the user had to do manually / what was broken / what was missing
> **Sekarang (Now):** What the user can do now, in fewer steps
> **Kenapa penting (Why it matters):** How this saves time, reduces errors, or follows industry standard
>
> This keeps us honest — if we can't explain the user benefit, we shouldn't build it.

### Design Principles for Indonesian SME Users

1. **Simplicity over features** — Our target users are Indonesian textile/garment SMEs who value straightforward workflows. If a feature is "cool" but adds complexity without clear benefit, skip it.
2. **Fewer steps = better** — Always look for ways to reduce clicks, combine screens, auto-calculate values. If the system can figure it out, don't ask the user.
3. **Bahasa Indonesia first** — All labels, statuses, error messages in Bahasa. Use industry terms that Indonesian factory workers actually use (CMT, potong, jahit, etc.).
4. **No feature without a use-case** — Before implementing, identify: Who is the user? What problem do they have? How does this solve it? If the answer is vague, clarify first.
5. **Industry standard as baseline, simplify from there** — Match what competitors offer (Accurate, Jurnal, HashMicro) but strip away enterprise bloat that SMEs don't need.

## UI Design System — NB (Neo-Brutalist) Standard

> **Reference implementation:** `app/finance/invoices/page.tsx` (Invoice Center)
> **Style constants:** `lib/dialog-styles.ts` — import as `import { NB } from "@/lib/dialog-styles"`

Our design identity is Neo-Brutalist (NB) — `border-2 border-black`, `shadow-[4px_4px...]`, bold uppercase headings, `rounded-none`. All new pages and components MUST follow these patterns.

### Page Layout: Unified Header Card

Every list page uses **one card** (`NB.pageCard`) with an orange accent bar and 3 internal rows separated by light borders (`border-b border-zinc-200`), NOT 3 separate heavy blocks.

```
┌─ orange gradient accent bar (h-1) ────────────────────────┐
│ Row 1: Title + Toolbar Actions                            │
│   Left: icon (orange bg) + title + subtitle               │
│   Right: [Export | Transaksi] + [+ Buat Invoice]          │
│          ↑ joined (border-r-0)    ↑ primary CTA (orange)  │
├───────────────────────────────────────────────────────────│
│ Row 2: KPI Strip                                          │
│   ● Semua    12  Rp xxx  │  ● Draft  3  │  ● Terkirim  5 │
│   label left, count+amount right, divide-x between cells  │
├───────────────────────────────────────────────────────────│
│ Row 3: Filter Toolbar (bg-zinc-50/80)                     │
│   [🔍 Search input  ][Tipe ▼][Status ▼][Terapkan]  12 inv│
│   ↑ joined strip, all h-9, border-r-0 between elements   │
└───────────────────────────────────────────────────────────┘
```

### Toolbar Button System

All toolbar buttons are `h-9 rounded-none text-[10px] font-bold uppercase tracking-wider`.

- **Secondary buttons** (Export, Transaksi): `NB.toolbarBtn` — `border border-zinc-300`, ghost style. Joined with `NB.toolbarBtnJoin` (`border-r-0`) when adjacent.
- **Primary CTA** (Buat Invoice): `NB.toolbarBtnPrimary` — `bg-orange-500 text-white border-orange-600`, separated with `ml-2`.
- **Filter toolbar** uses the same h-9 system. Search, dropdowns, and action buttons join into one continuous strip via `border-r-0`.

### Active Input Indicator (MANDATORY)

Every input, select, and filter in the system must show a visual state change when it has a value. This is a core UX pattern — the user should always know at a glance which fields have data.

```tsx
// Usage pattern:
<Input className={`... ${value ? NB.inputActive : NB.inputEmpty}`} />
<Icon className={`... ${value ? NB.inputIconActive : NB.inputIconEmpty}`} />
```

| State | Border | Background | Icon |
|-------|--------|------------|------|
| **Empty** | `border-zinc-300` | `bg-white` | `text-zinc-500` |
| **Has value** | `border-orange-400` | `bg-orange-50/50` | `text-orange-500` |

When the input has a value, also show a small **X clear button** on the right (`absolute right-2`) to let the user clear the field.

### KPI Strip

Horizontal cells with `flex-1` equal width, `divide-x divide-zinc-200` between. Each cell: label+dot left, count+amount right (`justify-between`). Count is `text-xl font-black`. Amounts are `text-xs font-mono font-bold`. Overdue counts use `text-red-600`.

### CheckboxFilter Integration

When using `CheckboxFilter` in toolbars (not in dialogs), pass `hideLabel` and `triggerClassName={NB.filterDropdown}` to match the toolbar height and borders.

### Dialog Styling

Dialogs use `NB.content` / `NB.contentNarrow` / `NB.contentWide` with `NB.header` (black bg), `NB.section` containers, and `NB.submitBtn*` colored action buttons. See `lib/dialog-styles.ts` for all tokens.

### NB Constants Quick Reference

| Token | Purpose |
|-------|---------|
| `NB.pageCard` | Page-level card wrapper |
| `NB.pageAccent` | Orange gradient top bar |
| `NB.toolbarBtn` | Secondary toolbar button |
| `NB.toolbarBtnPrimary` | Primary CTA button |
| `NB.filterBar` | Filter row container |
| `NB.filterDropdown` | CheckboxFilter trigger in toolbars |
| `NB.inputActive` / `NB.inputEmpty` | Active input indicator |
| `NB.inputIconActive` / `NB.inputIconEmpty` | Icon color for active inputs |
| `NB.kpiStrip` / `NB.kpiCell` | KPI summary row |
| `NB.content` / `NB.header` | Dialog container + header |
| `NB.submitBtnOrange` | Orange submit button (dialogs) |

## Development Commands

```bash
npm run dev          # Start dev server (clears .next cache, Turbopack, port 3002)
npm run build        # Production build
npm start            # Start production server
npm run lint         # ESLint across app/, lib/, components/
npx prisma generate  # Regenerate Prisma client after schema changes
npx prisma migrate dev --name <name>  # Create new migration
npx vitest           # Run all tests
npx vitest run <path>                 # Run specific test file
```

### Testing Standards

> **CRITICAL**: After every implementation task, run `npx vitest` to verify tests pass. Visually confirm output before considering a task complete. Always create or update tests for new features/logic.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 with App Router + Turbopack |
| Runtime | React 19 + TypeScript (strict mode) |
| Database | PostgreSQL via Supabase |
| ORM | Prisma 6.x |
| Auth | Supabase Auth (SSR, cookie-based sessions) |
| UI | shadcn/ui (Radix UI primitives) + Tailwind CSS v4 |
| Tables | TanStack Table |
| Forms | React Hook Form + Zod |
| Charts | Recharts |
| Drag & Drop | @dnd-kit + @hello-pangea/dnd |
| Payments | Xendit (Indonesian payment gateway) |
| Documents | Typst templates for PDF generation |
| Testing | Vitest |
| Icons | Tabler Icons + Lucide React |
| Notifications | Sonner (toast) |
| Animations | Framer Motion |

## Project Scale

- **167** app pages/routes
- **237** UI components (TSX files)
- **57** Prisma models, **30+** enums
- **92** npm dependencies
- **32** API endpoints
- **10** server action files

## Project Structure

```
app/
├── dashboard/           # Executive dashboard, approvals, POS, e-commerce
│   ├── page.tsx         # Main dashboard
│   ├── layout.tsx       # Dashboard layout
│   ├── loading.tsx      # Loading skeleton
│   ├── approvals/       # Approval workflow page
│   ├── ecommerce/       # E-commerce analytics
│   └── pos/             # Point of Sale view
├── inventory/           # Products, stock, warehouses, movements, adjustments, alerts, audit
│   ├── products/        # Product listing & CRUD
│   │   ├── [id]/        # Product details
│   │   └── new/         # Create product
│   ├── stock/           # Stock level dashboard
│   ├── warehouses/      # Warehouse management
│   │   └── [id]/        # Warehouse details
│   ├── movements/       # Stock movement history
│   ├── adjustments/     # Stock adjustment forms
│   ├── alerts/          # Stock alert notifications
│   ├── audit/           # Stock audit management
│   └── categories/      # Product categories
├── sales/               # Customers, leads, quotations, orders, pricelists
│   ├── customers/       # Customer master data
│   │   ├── [id]/        # Customer details
│   │   └── new/         # Create customer
│   ├── leads/           # Lead management
│   │   └── new/         # Create lead
│   ├── quotations/      # Price quotations
│   │   └── new/         # Create quotation
│   ├── orders/          # Sales orders
│   │   └── new/         # Create order
│   ├── pricelists/      # Price list management
│   │   └── new/         # Create pricelist
│   └── sales/           # Sales analytics
├── procurement/         # Purchase requests, POs, vendors, receiving/GRN
│   ├── requests/        # Purchase requests
│   │   └── new/         # Create PR
│   ├── orders/          # Purchase orders
│   ├── receiving/       # Goods receiving notes (GRN)
│   └── vendors/         # Vendor management
├── finance/             # COA, journal entries, bills, invoices, payments, reports
│   ├── invoices/        # Invoice management
│   ├── payments/        # Payment processing
│   ├── bills/           # Vendor bills
│   ├── journal/         # Journal entries
│   │   └── new/         # Create journal entry
│   ├── chart-accounts/  # Chart of accounts
│   ├── vendor-payments/ # Vendor payment tracking
│   └── reports/         # Financial reports
├── manufacturing/       # BOM, work orders, machines, routing, quality, planning
│   ├── orders/          # Work orders
│   ├── bom/             # Bill of Materials
│   ├── routing/         # Manufacturing routing
│   ├── groups/          # Work center groups
│   ├── machines/        # Machine management
│   ├── work-centers/    # Work center configuration
│   ├── planning/        # Production planning
│   └── quality/         # Quality control
├── hcm/                 # Employee master, attendance, payroll
│   ├── employee-master/ # Employee records
│   ├── attendance/      # Attendance tracking
│   └── payroll/         # Payroll management
├── documents/           # Master data docs, operational docs, reports archive
│   ├── docs/            # Operational documents
│   ├── master/          # Master data documents
│   └── reports/         # Report archive
├── admin/               # Workflow management
│   └── workflows/       # Workflow configuration
├── accountant/          # COA management, financial command center
│   └── coa/             # Chart of accounts management
├── manager/             # Operations dashboard, task board
├── staff/               # Task management
├── settings/            # Users, system preferences
│   └── users/           # User management
├── reports/             # Cross-module reporting
├── demo/                # Demo/prototype pages
│   ├── bento-grid/      # Bento grid demo
│   ├── kanban/          # Kanban board demo
│   ├── mini-chart/      # Chart demo
│   └── infinite-grid/   # Infinite grid demo
├── help/                # Help page
├── api/                 # REST API routes (32 endpoints)
│   ├── manufacturing/   # 13 endpoints (BOM, work orders, machines, routing, quality, planning, dashboard)
│   ├── products/        # Product CRUD + [id] detail
│   ├── sales/           # Customers, leads, quotations, orders, options
│   │   ├── customers/   # Customer CRUD + [id]
│   │   ├── leads/       # Lead management
│   │   ├── quotations/  # Quotation creation
│   │   ├── orders/      # Sales orders + [id]/create-work-orders
│   │   └── options/     # Sales dropdowns
│   ├── xendit/          # Payment gateway (payout, banks, webhook, test)
│   ├── documents/       # PO & payroll document generation
│   │   ├── purchase-order/[id]/ # PO PDF
│   │   ├── payroll/[period]/    # Payroll report
│   │   └── payslip/[period]/[employeeId]/ # Payslip
│   ├── system/          # Module access control
│   └── cache-warm/      # Cache warming endpoint
├── auth/                # Auth callback handler
├── login/               # Login page
├── signup/              # Registration page
└── forgot-password/     # Password recovery

components/
├── ui/                  # 40+ shadcn/ui primitives (accordion, dialog, form, table, etc.)
├── inventory/           # 25+ inventory components
│   # adjustment-form, currency-display, detailed-material-table, global-kpis,
│   # goods-receipt-dialog, inventory-kanban-board, product-create-dialog,
│   # product-data-table, product-form, product-quick-view, purchase-request-dialog,
│   # stock-level-indicator, stock-status-badge, warehouse-card, warehouse-form-dialog
├── sales/               # 25+ sales & CRM components
│   # customer-data-table, customer-form, customer-rolodex-card, order-execution-card,
│   # quotation-form, quotation-kanban, sales-data-table, sales-order-form
│   ├── leads/           # lead-card, lead-column, lead-kanban
│   └── pricelists/      # booklet-viewer, price-book-gallery
├── procurement/         # 20+ procurement components
│   # action-center, create-grn-dialog, create-request-form, grn-details-sheet,
│   # new-po-dialog, new-vendor-dialog, po-details-sheet, po-finalize-dialog,
│   # procurement-pipeline, request-list, spend-analytics, vendor-list, vendor-performance
├── manufacturing/       # 25+ manufacturing components
│   # create-bom-dialog, create-inspection-dialog, create-work-order-dialog,
│   # group-form-dialog, machine-form-dialog, routing-form-dialog
│   ├── bom/             # BOM-specific components
│   ├── orders/          # Work order components
│   └── dashboard/       # ai-coach, planning-board, production-health, quality-workspace
├── finance/             # 10+ finance components
│   # accounting-module-actions, action-items-widget, cash-flow-chart, finance-metric-card
│   ├── journal/         # Journal entry components
│   └── reports/         # Financial report components
├── dashboard/           # 40+ dashboard widgets & KPI cards
│   # activity-feed, bento-launcher, ceo-action-center, company-pulse-bar,
│   # dashboard-view, executive-alerts, executive-kpis, finance-snapshot,
│   # morning-focus, operations-strip, quick-actions, trending-widget
├── documents/           # 10+ document management components
│   # batch-traceability, bom-version-control, document-system-control-center,
│   # duplicate-detector, equipment-tracker, impact-analyzer, master-data-health
│   ├── master/          # Master data views
│   ├── docs/            # Operational docs
│   └── reports/         # Reports
├── hcm/                 # 8+ HR components
│   # attendance-widget, detailed-performance-table, leave-requests,
│   # payroll-summary, performance-widget
├── analytics/           # BI dashboard views
│   └── dashboard/       # efficiency-view, executive-scorecard, inventory-cash-view,
│                        # operations-cockpit, profit-loss-view, report-catalog
├── accountant/          # bank-reconciliation, financial-command-center, invoice-aging
├── manager/             # operations-dashboard, task-board, production-line-status,
│                        # quality-tracking-card, staff-tracking-card, material-tracking-card
├── sales-dashboard/     # order-book, product-variants, sales-action-center, sales-pipeline
├── workflow/            # workflow-config-context, workflow-import-dialog
├── settings/users/      # User management components
├── staff/               # task-card
├── ai/                  # ai-context, ai-floating-button, ai-sidebar
├── app-sidebar.tsx      # Main navigation sidebar
├── global-layout.tsx    # Global layout wrapper
├── data-table.tsx       # Generic data table
├── route-guard.tsx      # Route protection
├── nav-main.tsx         # Primary navigation
├── nav-secondary.tsx    # Secondary navigation
├── nav-documents.tsx    # Document navigation
├── user-nav.tsx         # User controls
├── mode-toggle.tsx      # Theme toggle
└── site-header.tsx      # Page header

lib/
├── actions/             # Server actions (10 files)
│   ├── finance.ts       # General finance operations
│   ├── finance-ap.ts    # Accounts Payable
│   ├── finance-ar.ts    # Accounts Receivable
│   ├── finance-gl.ts    # General Ledger
│   ├── finance-invoices.ts # Invoice operations
│   ├── finance-reports.ts  # Financial reports
│   ├── procurement.ts   # PR/PO workflows
│   ├── grn.ts           # Goods receiving
│   ├── sales.ts         # Sales operations
│   └── xendit.ts        # Payment integration
├── auth/
│   └── role-guard.ts    # Role-based access control
├── supabase/
│   ├── server.ts        # Server-side Supabase client
│   └── client.ts        # Client-side Supabase client
├── services/
│   └── document-service.ts
├── validators/
│   └── document.ts
├── performance/
│   └── procurement-prefetch.ts
├── db.ts                # Database connection & query utilities
├── db-fallbacks.ts      # Mock data for development
├── prisma.ts            # Prisma client singleton
├── supabase.ts          # Supabase wrapper
├── utils.ts             # Shared utilities (cn, formatCurrency, etc.)
├── types.ts             # Shared TypeScript types
├── validations.ts       # Zod schemas
├── inventory-logic.ts   # Inventory business logic
├── inventory-utils.ts   # Inventory helpers
├── po-state-machine.ts  # Purchase order status transitions (13 statuses)
├── excel-parser.ts      # Excel import/export
├── workflow-validator.ts # Workflow validation
├── xendit.ts            # Xendit SDK wrapper
├── auth-context.tsx     # React auth context (useAuth hook)
├── authz.ts             # Authorization utilities
└── employee-context.ts  # Employee context provider

prisma/
├── schema.prisma        # 57 models, 30+ enums, 1843 lines
├── migrations/          # Database migrations
│   ├── 20250125000000_add_po_events/
│   └── 20260203000100_purchase_order_events/
└── seed*.ts             # 10 seed scripts (main, inventory, dashboard, GL, procurement, sales, etc.)

templates/
├── purchase_order/      # Typst templates for PO PDF generation
├── payslip/             # Payslip PDF template
└── payroll_report/      # Payroll report PDF template

hooks/
├── use-mobile.ts        # Mobile detection hook
└── use-products.ts      # Product data fetching hook

types/
└── workflow.ts          # Workflow type definitions

config/
└── modules.json         # Module access control configuration

scripts/                 # 9 utility scripts
├── install-typst.js     # Typst installation
├── check_enum.ts        # Schema enum checker
├── debug-gap-analysis.ts
├── list_pending_bills.ts
├── test-procurement.js
├── verify-procurement-flow.ts
├── verify-schema.ts
├── verify_bill_gl.ts
└── test-db.ts

actions/
└── workflow-actions.ts  # Workflow server actions (root level)

docs/
├── specs/               # Architecture, role flows, gap analysis
└── examples/            # Workflow import samples

__tests__/               # Test files (currently inventory module only)
```

## Database Schema (57 models, 30+ enums)

| Domain | Key Models |
|--------|-----------|
| Auth (5) | User, Account, Session, VerificationToken, SystemRole |
| Inventory (8) | Product, Category, Warehouse, Location, StockLevel, InventoryTransaction, StockAlert, StockAudit/StockAuditItem |
| Sales & CRM (10) | Customer, CustomerCategory, CustomerAddress, CustomerContact, PriceList/PriceListItem, Quotation/QuotationItem, SalesOrder/SalesOrderItem, Lead, CreditNote |
| Procurement (8) | Supplier, SupplierProduct, PurchaseOrder, PurchaseOrderEvent, PurchaseOrderItem, PurchaseRequest/PurchaseRequestItem, GoodsReceivedNote/GRNItem |
| Manufacturing (8) | WorkOrder, Machine, MaintenanceLog, BillOfMaterials/BOMItem, WorkCenterGroup, Routing/RoutingStep |
| HCM (5) | Employee, Attendance, LeaveRequest, EmployeeTask, QualityInspection/InspectionDefect |
| Finance (5) | Invoice/InvoiceItem, Payment, GLAccount, JournalEntry/JournalLine |
| Executive (2) | ExecutiveSnapshot, StrategicGoal |

### Key Enums

| Enum | Values |
|------|--------|
| TransactionType | PO_RECEIVE, PRODUCTION_IN, SO_SHIPMENT + 7 more |
| ProcurementStatus | GAP_DETECTED → PR_CREATED → PO_DRAFT → PENDING_APPROVAL → APPROVED → ORDERED → VENDOR_CONFIRMED → SHIPPED → PARTIAL_RECEIVED → RECEIVED → COMPLETED / REJECTED / CANCELLED |
| SalesOrderStatus | DRAFT, CONFIRMED, IN_PROGRESS, DELIVERED, INVOICED, COMPLETED, CANCELLED |
| InvoiceStatus | DRAFT, ISSUED, PARTIAL, PAID, OVERDUE, CANCELLED, VOID, DISPUTED |
| InvoiceType | INV_OUT (AR), INV_IN (AP) |
| CustomerType | INDIVIDUAL, COMPANY, GOVERNMENT |
| LeadStatus | NEW, CONTACTED, QUALIFIED, PROPOSAL, NEGOTIATION, WON, LOST |
| WOStatus | PLANNED, IN_PROGRESS, COMPLETED, CANCELLED, ON_HOLD |
| MachineStatus | IDLE, RUNNING, MAINTENANCE, BREAKDOWN, OFFLINE |
| AccountType | ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE |
| EntryStatus | DRAFT, POSTED, VOID |
| PaymentTerm | CASH, NET_15, NET_30, NET_45, NET_60, NET_90, COD |

## Authentication

- **Provider**: Supabase Auth (SSR mode, cookie-based)
- **Middleware**: `middleware.ts` protects all business routes (`/dashboard`, `/inventory`, `/finance`, `/sales`, `/procurement`, `/manufacturing`, `/hcm`, `/accountant`, `/manager`, `/staff`)
- **Client hook**: `useAuth()` from `lib/auth-context.tsx`
- **Server**: `createClient()` from `lib/supabase/server.ts`
- **Role guard**: `lib/auth/role-guard.ts` for role-based access

### Required Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
DATABASE_URL=              # Supabase connection pooling URL
DIRECT_URL=                # Direct Supabase DB connection
XENDIT_SECRET_KEY=         # Xendit payment API key (optional)
```

## Key Business Workflows

### Procurement Flow
```
Gap Detected → PR Created → PO Draft → Pending Approval → Approved →
Ordered → Vendor Confirmed → Shipped → Received → Completed
```
State machine in `lib/po-state-machine.ts`. Events tracked via `PurchaseOrderEvent` model.

### Sales Flow
```
Lead → Quotation → Sales Order → Invoice → Payment
```

### Manufacturing Flow
```
Sales Order → Work Order (BOM explosion) → Production → Quality Inspection → Completion
```

## Indonesian Localization

- All UI text in Bahasa Indonesia
- Currency: Indonesian Rupiah (IDR) formatting via `formatCurrency()`
- Tax: PPN 11% calculations
- Business fields: NPWP, NIK, PKP status, e-Faktur readiness
- Customer types: Perorangan (Individual), Perusahaan (Company), Pemerintah (Government)
- Date/time: Indonesian locale formatting
- Provinces: Complete Indonesian province list for addresses

## Module Status

| Module | Frontend | Backend | API | Tests | Overall |
|--------|----------|---------|-----|-------|---------|
| Inventory | 90% | 80% | Partial | Yes | **80%** |
| Sales & CRM | 85% | 70% | Partial | No | **72%** |
| Procurement | 90% | 60% | Partial | No | **68%** |
| Manufacturing | 85% | 75% | Full | No | **77%** |
| Finance | 60% | 50% | No | No | **50%** |
| HCM | 50% | 40% | No | No | **40%** |
| Documents | 90% | 80% | Partial | No | **80%** |

## Key Dependencies (package.json)

### Core
- next@16.1.1, react@19.1.0, typescript@5.9.3
- @prisma/client@6.19.2, pg@8.18.0
- @supabase/supabase-js@2.78.0, @supabase/ssr@0.8.0
- next-auth@4.24.13, @auth/prisma-adapter@2.11.1

### UI & Interaction
- 20+ @radix-ui/* primitives
- react-hook-form@7.66.0, zod@4.1.12
- @tanstack/react-table@8.21.3
- recharts@2.15.4, framer-motion@12.25.0
- @dnd-kit/*, @hello-pangea/dnd@18.0.1
- sonner@2.0.7, cmdk@1.1.1, vaul@1.1.2
- lucide-react@0.552.0, @tabler/icons-react@3.35.0

### Integrations
- xendit-node@7.0.0 (Indonesian payment gateway)
- xlsx@0.18.5 (Excel import/export)
- date-fns@4.1.0, react-day-picker@9.13.0

## Development Notes

- Path alias: `@/*` resolves to project root
- `npm run dev` clears `.next` cache on every start
- TypeScript build errors are currently ignored in `next.config.ts` (for dev velocity)
- React Strict Mode is disabled
- Many `._*` dot-underscore files exist from macOS — these are ignored by lint and git
- `force-dynamic` is exported from async pages to prevent build-time DB queries
- Test coverage is low — only inventory module has tests currently
- Prisma client is regenerated on `npm install` via `postinstall` script
- Server actions are split across `app/actions/` (page-level) and `lib/actions/` (shared)
- Finance server actions are split by domain: `finance-ap.ts`, `finance-ar.ts`, `finance-gl.ts`, `finance-invoices.ts`, `finance-reports.ts`

## Finance Module — Double-Entry Bookkeeping Rules

> **MANDATORY SKILL**: Before implementing ANY finance feature, run `/finance-guardrails` to get the full checklist. This prevents recurring bugs like missing journal entries, hardcoded GL codes, broken reports, and unbalanced books.

> **CRITICAL**: This ERP is an accounting system. Every financial transaction MUST create double-entry journal entries. Implementing a feature that creates invoices, bills, payments, credit notes, or any money movement WITHOUT posting to the General Ledger is a **critical bug**. This has caused production issues multiple times — do NOT repeat it.

### Tax Rate Constants

**NEVER hardcode tax rates** (`* 0.11`, `* 0.22`). Use `lib/tax-rates.ts`:
- `TAX_RATES.PPN` = 0.11 (11% VAT)
- `TAX_RATES.CORPORATE` = 0.22 (22% corporate tax)
- `TAX_RATES.PPH23` = 0.02 (2% withholding)

### COGS Classification

**NEVER check only `code === '5000'`**. Use `isCOGSAccount()` from `lib/gl-accounts.ts` which checks:
- Code range `5000`-`5099`
- Name contains: harga pokok, hpp, cogs, beban pokok

### The Rule

**Any server action that creates or changes a financial document (invoice, bill, payment, credit note, petty cash, fixed asset depreciation) MUST:**

1. **Create balanced journal entries** via `postJournalEntry()` from `lib/actions/finance-gl.ts`
2. **Use system account constants** from `lib/gl-accounts.ts` — NEVER hardcode account codes as string literals like `'1100'` or `'2100'`
3. **Call `ensureSystemAccounts()`** before posting, to guarantee the referenced GL accounts exist in the database
4. **Handle GL failures atomically** — if the journal entry fails, revert the document status change. NEVER leave a document in ISSUED/PAID status without a corresponding journal entry

### Standard Journal Entry Patterns

| Transaction | Debit | Credit |
|-------------|-------|--------|
| Invoice sent (AR) | Piutang Usaha | Pendapatan + PPN Keluaran |
| Bill approved (AP) | Beban/HPP + PPN Masukan | Hutang Usaha |
| AR Payment received | Kas/Bank | Piutang Usaha |
| AP Payment made | Hutang Usaha | Kas/Bank |
| Credit Note (AR) | Pendapatan | Piutang Usaha |
| Petty Cash top-up | Kas Kecil | Kas/Bank |
| Petty Cash disbursement | Beban | Kas Kecil |
| Depreciation | Beban Penyusutan | Akumulasi Penyusutan |

### System Account Constants (`lib/gl-accounts.ts`)

All system-critical account codes are defined in `lib/gl-accounts.ts`, aligned with `prisma/seed-gl.ts`:
- `SYS_ACCOUNTS.AR` = `"1200"` (Piutang Usaha)
- `SYS_ACCOUNTS.AP` = `"2000"` (Hutang Usaha)
- `SYS_ACCOUNTS.BANK_BCA` = `"1110"` (Bank BCA)
- `SYS_ACCOUNTS.EXPENSE_DEFAULT` = `"6900"` (Beban Lain-lain)
- `SYS_ACCOUNTS.PPN_MASUKAN` = `"1330"` (PPN Masukan)

When adding new transaction types:
1. Add the account code constant to `SYS_ACCOUNTS` in `lib/gl-accounts.ts`
2. Add it to the `ensureSystemAccounts()` upsert list
3. Reference it via `SYS_ACCOUNTS.YOUR_CODE` in your server action
4. Add it to `prisma/seed-gl.ts` for fresh databases

### Verification Checklist (after any finance feature implementation)

- [ ] Does the transaction create a journal entry? Check `journalEntry` table after the action.
- [ ] Is the journal balanced? `SUM(debit) === SUM(credit)` for each entry.
- [ ] Do COA balances update? Check `GLAccount.balance` for affected accounts.
- [ ] Do financial reports reflect it? Check Laba Rugi, Neraca, Arus Kas.
- [ ] Does the AR/AP page show the correct outstanding balance?
- [ ] If the GL posting fails, does the document revert to its previous status?

## Multi-Session Safety Rules

> **CRITICAL**: This project is often worked on by **multiple Claude Code sessions running simultaneously** in separate terminals. If you don't follow these rules, sessions will overwrite each other's work and changes will be lost.

### The Problem

When 2+ Claude sessions edit the same file, the last write wins. Session A writes `receivables/page.tsx`, then session B writes a different version — session A's work is gone. Git only tracks the final state on disk, not each session's writes.

### Rules for Every Session

1. **ASK which files are yours before editing.** At the start of every session, confirm with the user which files/modules you are responsible for. Only edit those files. If you need to touch a file outside your scope, ask first.

2. **Never run `git checkout`, `git restore`, `git reset`, or `git stash pop/apply` without user confirmation.** These commands can overwrite other sessions' uncommitted work.

3. **Commit frequently.** After finishing a logical unit of work, suggest committing. Uncommitted changes are vulnerable to being overwritten by other sessions.

4. **Check before writing.** Before editing a file, do a quick `git diff <file>` to see if it has uncommitted changes from another session. If it does, **do not overwrite** — ask the user.

5. **Never run `git add .` or `git add -A`.** Only stage specific files you worked on. Other sessions may have in-progress work that shouldn't be committed yet.

### Recommended Session Scoping

Each terminal session should be assigned a **non-overlapping file scope**:

| Session | Scope | Example Files |
|---------|-------|---------------|
| Session 1 | Finance pages | `app/finance/**/*.tsx` |
| Session 2 | Finance components | `components/finance/**/*.tsx` |
| Session 3 | HCM module | `app/hcm/**`, `components/hcm/**` |
| Session 4 | Backend / actions | `lib/actions/**`, `app/api/**` |
| Session 5 | Manufacturing | `app/manufacturing/**` |
| Session 6 | Sales / Procurement | `app/sales/**`, `app/procurement/**` |

### Best Practice: Git Worktrees

For maximum safety, use **git worktrees** so each session has its own isolated copy:

```bash
# Create isolated working directories (run once):
git worktree add ../ERP-finance -b work/finance
git worktree add ../ERP-hcm -b work/hcm
git worktree add ../ERP-backend -b work/backend

# Each terminal uses its own directory:
# Terminal 1: cd /Volumes/ORICO/ERP-MAC/ERP-finance
# Terminal 2: cd /Volumes/ORICO/ERP-MAC/ERP-hcm
# Terminal 3: cd /Volumes/ORICO/ERP-MAC/ERP-backend

# When done, merge each branch back to main:
git checkout main
git merge work/finance
git merge work/hcm
git merge work/backend

# Clean up:
git worktree remove ../ERP-finance
```

With worktrees, sessions **cannot** overwrite each other because they work on separate copies of the repo.
