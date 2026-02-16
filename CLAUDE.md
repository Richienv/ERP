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
