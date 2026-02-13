# CLAUDE.md

This file provides guidance to Claude Code when working with this Indonesian ERP system.

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

## Project Structure

```
app/
├── dashboard/           # Executive dashboard, approvals, POS, e-commerce
├── inventory/           # Products, stock, warehouses, movements, adjustments, alerts, audit
├── sales/               # Customers, leads, quotations, orders, pricelists, invoices
├── procurement/         # Purchase requests, POs, vendors, receiving/GRN
├── finance/             # COA, journal entries, bills, invoices, payments, reports
├── manufacturing/       # BOM, work orders, machines, routing, quality, planning
├── hcm/                 # Employee master, attendance, payroll
├── documents/           # Master data docs, operational docs, reports archive
├── admin/               # Workflow management
├── accountant/          # COA management, financial command center
├── manager/             # Operations dashboard, task board
├── staff/               # Task management
├── settings/            # Users, system preferences
├── reports/             # Cross-module reporting
├── api/                 # REST API routes
│   ├── manufacturing/   # 13 endpoints (BOM, work orders, machines, routing, quality, planning)
│   ├── products/        # Product CRUD
│   ├── sales/           # Sales order → work order creation
│   ├── xendit/          # Payment gateway (payout, banks, webhook, test)
│   ├── documents/       # PO document generation
│   └── cache-warm/      # Cache warming endpoint
├── auth/                # Auth callback handler
├── login/               # Login page
├── signup/              # Registration page
└── forgot-password/     # Password recovery

components/
├── ui/                  # 50+ shadcn/ui primitives
├── inventory/           # 20+ inventory components
├── sales/               # 25+ sales & CRM components
├── procurement/         # 15+ procurement components
├── manufacturing/       # 20+ manufacturing components
├── finance/             # 10+ finance components
├── dashboard/           # 20+ dashboard widgets & KPI cards
├── documents/           # 10+ document management components
├── hcm/                 # 8+ HR components
├── analytics/           # BI dashboard views
├── accountant/          # Accountant-specific views
├── manager/             # Manager-specific views
├── sales-dashboard/     # Sales analytics components
├── workflow/            # Workflow config & import
├── ai/                  # AI assistant (context, sidebar, floating button)
├── app-sidebar.tsx      # Main navigation sidebar
└── global-layout.tsx    # Global layout wrapper

lib/
├── actions/             # Server actions
│   ├── finance.ts       # GL, journal entries, invoices, payments
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
├── utils.ts             # Shared utilities (cn, formatCurrency, etc.)
├── types.ts             # Shared TypeScript types
├── validations.ts       # Zod schemas
├── inventory-logic.ts   # Inventory business logic
├── inventory-utils.ts   # Inventory helpers
├── po-state-machine.ts  # Purchase order status transitions
├── excel-parser.ts      # Excel import/export
├── workflow-validator.ts # Workflow validation
├── xendit.ts            # Xendit SDK wrapper
├── auth-context.tsx     # React auth context (useAuth hook)
└── authz.ts             # Authorization utilities

prisma/
├── schema.prisma        # 60+ models, 30+ enums
├── migrations/          # Database migrations
└── seed*.ts             # Seed scripts (various modules)

templates/
└── purchase_order/      # Typst templates for PO PDF generation

docs/
├── specs/               # Architecture, role flows, gap analysis
└── examples/            # Workflow import samples
```

## Database Schema (60+ models)

| Domain | Key Models |
|--------|-----------|
| Auth | User, Account, Session, VerificationToken, SystemRole |
| Inventory | Product, Category, Warehouse, Location, StockLevel, InventoryTransaction, StockAlert, StockAudit |
| Sales & CRM | Customer, CustomerCategory, CustomerAddress, CustomerContact, PriceList, Quotation, SalesOrder, Lead, CreditNote |
| Procurement | Supplier, SupplierProduct, PurchaseRequest, PurchaseOrder, PurchaseOrderEvent, GoodsReceivedNote, GRNItem |
| Manufacturing | WorkOrder, Machine, MaintenanceLog, BillOfMaterials, BOMItem, WorkCenterGroup, Routing, RoutingStep, QualityInspection |
| HCM | Employee, Attendance, LeaveRequest, EmployeeTask |
| Finance | Invoice, InvoiceItem, Payment, GLAccount, JournalEntry, JournalLine |
| Executive | ExecutiveSnapshot, StrategicGoal |

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

## Development Notes

- Path alias: `@/*` resolves to project root
- `npm run dev` clears `.next` cache on every start
- TypeScript build errors are currently ignored in `next.config.ts` (for dev velocity)
- React Strict Mode is disabled
- Many `._*` dot-underscore files exist from macOS — these are ignored by lint and git
- `force-dynamic` is exported from async pages to prevent build-time DB queries
- Test coverage is low — only inventory module has tests currently
- Prisma client is regenerated on `npm install` via `postinstall` script
