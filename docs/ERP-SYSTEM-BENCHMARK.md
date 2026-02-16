# ERP System — Product & Architecture Benchmark Document

> **Purpose**: Internal reference document for competitive analysis and benchmarking.
> **Version**: 1.0 — February 2026
> **Classification**: Confidential

---

## 1. EXECUTIVE SUMMARY

This is a **full-stack, cloud-native Indonesian ERP system** purpose-built for mid-market manufacturing, trading, and service organizations in Indonesia. It covers 10 core business modules across 167 pages, backed by 57 data models and 30+ business enums.

**Key differentiators:**
- Neo-brutalist design language — a bold, high-contrast UI that prioritizes information density and clarity over decorative aesthetics
- Deep Indonesian localization — PPN tax calculations, NPWP/NIK fields, e-Faktur readiness, IDR formatting, Bahasa Indonesia throughout
- AI-assisted features — floating AI assistant, POS upselling engine, executive search
- Role-specific command centers — CEO, Accountant, Factory Manager, and Floor Staff each get purpose-built dashboards
- Manufacturing-aware — integrated BOM, routing, work orders, OEE tracking, and quality control
- Xendit payment gateway — native payout and e-wallet support for Indonesian banks

**Tech stack**: Next.js 16 (App Router), React 19, TypeScript, PostgreSQL (Supabase), Prisma 6.x, Tailwind CSS v4, shadcn/ui (Radix), Recharts, Framer Motion, Typst (PDF generation).

---

## 2. MODULE INVENTORY

### 2.1 Dashboard & Executive Hub

| Feature | Description |
|---------|-------------|
| **Company Pulse Bar** | Real-time KPIs: cash balance, revenue MTD, net margin, inventory value, burn rate |
| **CEO Action Center** | Procurement approvals, pending leave requests, PO/PR pipeline at a glance |
| **Financial Health Card** | 7-day cash flow chart, AR/AP tracking, upcoming payables |
| **AI Search** | Natural-language search across all modules |
| **Operations Strip** | 5-tile health summary: active work orders, low stock alerts, sales revenue, attendance rate, quality pass rate |
| **Activity Feed** | System-wide event timeline |
| **Trending Widget** | Active POs, stock alerts, pending leaves, active orders |
| **Executive Alerts** | Pulsing critical notifications with severity badges |
| **Data Streaming** | React Suspense-based progressive loading with 8-second timeout fallbacks |

### 2.2 Inventory & Warehouse Management

**Dashboard name**: Logistik Command Center

| Sub-Module | Path | Features |
|------------|------|----------|
| Products | `/inventory/products` | Kanban board + data table, product creation dialog with structured code builder (4-segment: Category/Type/Brand/Color), barcode generation |
| Stock Levels | `/inventory/stock` | Real-time per-warehouse monitoring |
| Warehouses | `/inventory/warehouses` | Warehouse master with location management, dock status (CONGESTED/BUSY/IDLE), staff count, active POs |
| Stock Movements | `/inventory/movements` | Ledger-style transaction history (10 transaction types) |
| Stock Adjustments | `/inventory/adjustments` | Physical inventory / stock opname with two-panel layout |
| Categories | `/inventory/categories` | Hierarchical product categorization with parent-child tree |
| Alerts | `/inventory/alerts` | Threshold-based notifications (LOW_STOCK, OUT_OF_STOCK, OVERSTOCK, EXPIRY_WARNING) |
| Audit | `/inventory/audit` | Cycle count management with expected vs. actual discrepancy tracking |

**Unique features:**
- Structured product code system: `{CATEGORY}-{TYPE}-{BRAND}-{COLOR}-{SEQ}` (e.g., `TRD-OTR-XX-NAT-001`)
- Auto-generated barcodes from product codes
- Kanban-style stock status visualization (CRITICAL / LOW_STOCK / NEW / HEALTHY)
- Safety stock, reorder level, lead time, manual burn rate planning
- Global KPIs widget with inventory value, item count, warehouse utilization

### 2.3 Sales & CRM

**Dashboard name**: Penjualan & CRM

| Sub-Module | Path | Features |
|------------|------|----------|
| Customers | `/sales/customers` | Customer master (Individual/Company/Government), credit management, NPWP/NIK tracking |
| Leads | `/sales/leads` | 7-stage Kanban pipeline (NEW > CONTACTED > QUALIFIED > PROPOSAL > NEGOTIATION > WON/LOST) with win probability heat map |
| Quotations | `/sales/quotations` | 4-column Kanban (Draft/Sent/Accepted/Expired), pipeline value per column, win % per deal, salesperson tracking |
| Sales Orders | `/sales/orders` | Order fulfillment tracking with delivery/invoice qty per line |
| Price Lists | `/sales/pricelists` | Volume-based pricing with validity dates, booklet-style gallery viewer |
| Sales Analytics | `/sales/sales` | Revenue reporting and trend analysis |

**Unique features:**
- Lead-to-customer conversion workflow
- Quotation-to-sales-order conversion with PPN tax auto-calculation
- Credit limit management with 4-tier status (GOOD/WATCH/HOLD/BLOCKED)
- 5 KPI metrics: Revenue MTD, Sales Orders, Active Orders, Quotations, AR Outstanding
- Priority system: URGENT, HIGH, MEDIUM, LOW with color-coded badges

### 2.4 Point of Sale (POS)

**Path**: `/dashboard/pos`

| Feature | Description |
|---------|-------------|
| **Shift Ledger** | Real-time daily sales target vs. actual tracking |
| **Product Catalog** | Category filtering with barcode scanning support |
| **AI Upselling** | "Ritchie AI" suggests complementary items based on cart contents |
| **Receipt Preview** | Dot-matrix style paper receipt simulation |
| **Payment Processing** | Cash, Card, QRIS payment modals with processing simulation |
| **Parked Orders** | Queue management for multiple active transactions |
| **Discount System** | Percentage discount toggle with visual feedback |
| **Motion UX** | Framer Motion animations for smooth transitions |

### 2.5 Procurement & Supply Chain

**Dashboard name**: Dashboard Pengadaan

| Sub-Module | Path | Features |
|------------|------|----------|
| Purchase Requests | `/procurement/requests` | Employee-initiated PR creation with department-level approval |
| Purchase Orders | `/procurement/orders` | 13-state lifecycle management with full event sourcing |
| Vendors | `/procurement/vendors` | Supplier master with performance metrics (rating, on-time rate) |
| Goods Receiving | `/procurement/receiving` | GRN creation, quality inspection per line item, acceptance/rejection |

**State machine (13 states):**
```
GAP_DETECTED → PR_CREATED → PO_DRAFT → PENDING_APPROVAL → APPROVED →
ORDERED → VENDOR_CONFIRMED → SHIPPED → PARTIAL_RECEIVED → RECEIVED → COMPLETED
                                                          (REJECTED / CANCELLED)
```

**Unique features:**
- Every PO transition is logged as a `PurchaseOrderEvent` (full audit trail)
- Role-based approval authority (Purchasing vs. CEO/Director)
- Inline approval lists with item-level detail
- Vendor performance tracking (star rating + on-time %)
- Spend analytics dashboard with monthly growth %
- Multi-vendor sourcing per product with preference flags

### 2.6 Manufacturing & Production

**Dashboard name**: Manufacturing Dashboard

| Sub-Module | Path | Features |
|------------|------|----------|
| Work Centers | `/manufacturing/work-centers` | Machine/station configuration |
| Work Center Groups | `/manufacturing/groups` | Logical grouping for resource planning |
| Bill of Materials | `/manufacturing/bom` | Version-controlled recipes with waste % and cost rollup |
| Routing | `/manufacturing/routing` | Process step sequences with duration, machine, and material links |
| Production Planning | `/manufacturing/planning` | Master Production Schedule (MPS) |
| Work Orders | `/manufacturing/work-orders` | Batch production execution with priority levels |
| Quality Control | `/manufacturing/quality` | Inspection scoring (0-100), defect classification (CRITICAL/MAJOR/MINOR) |

**Unique features:**
- **OEE Dashboard**: Real-time Overall Equipment Effectiveness with Availability, Performance, Quality breakdown — color-coded thresholds (green >= 85%, amber >= 60%, red < 60%)
- Machine health monitoring (0-100 score) with maintenance scheduling
- BOM explosion for material cost calculations including waste percentage
- Work order priority system: CRITICAL, HIGH, NORMAL, LOW
- Sales order to work order conversion (make-to-order support)
- 30-second auto-refresh for live production metrics
- AI Coach component for manufacturing insights

### 2.7 Finance & Accounting

**Dashboard name**: Keuangan & Akuntansi

| Sub-Module | Path | Features |
|------------|------|----------|
| Invoices (AR) | `/finance/invoices` | Customer invoice management (INV_OUT) |
| Vendor Bills (AP) | `/finance/bills` | Supplier bill tracking (INV_IN) |
| Customer Payments | `/finance/payments` | Cash receipt processing |
| Vendor Payments | `/finance/vendor-payments` | Disbursement management via Xendit |
| Chart of Accounts | `/finance/chart-accounts` | GL account tree (ASSET/LIABILITY/EQUITY/REVENUE/EXPENSE) |
| Journal Entries | `/finance/journal` | Double-entry bookkeeping with DRAFT/POSTED/VOID lifecycle |
| Financial Reports | `/finance/reports` | P&L, Balance Sheet, Cash Flow |

**Unique features:**
- Full double-entry bookkeeping with auto-journal posting rules
- Polymorphic invoices: same model for AR (INV_OUT) and AP (INV_IN)
- Payment terms: CASH, NET_15, NET_30, NET_45, NET_60, NET_90, COD
- PPN 11% tax auto-calculation on all invoices
- Xendit integration for bank payouts and e-wallet disbursements
- Cash flow visualization (7-day Recharts chart)
- Action items widget for reconciliation reminders

### 2.8 Human Resources & Payroll

**Dashboard name**: Sumber Daya Manusia (SDM)

| Sub-Module | Path | Features |
|------------|------|----------|
| Employee Master | `/hcm/employee-master` | Personnel records with NIK, department, position, salary |
| Attendance | `/hcm/attendance` | Check-in/out tracking, late detection, leave/sick/remote status |
| Payroll | `/hcm/payroll` | Salary processing with PDF slip generation |

**Unique features:**
- Attendance rate dashboard with present/late/leave/absent/remote breakdown
- Leave request workflow (PENDING > APPROVED/REJECTED/CANCELLED)
- Payslip PDF generation via Typst templates
- PPh 21 tax calculations (Indonesian income tax)
- Employee task routing linked to POs, SOs, and Work Orders

### 2.9 Document Management

**Path**: `/documents`

| Sub-Module | Path | Features |
|------------|------|----------|
| Master Data | `/documents/master` | System-generated master records |
| Operational Docs | `/documents/docs` | SOPs and procedural documentation |
| Reports Archive | `/documents/reports` | Report archive with search and date filtering |

**Document generation:**
- Typst-based PDF generation for Purchase Orders, Payroll Reports, Payslips
- Binary PDF streaming via API endpoints
- Template expansion system ready for additional document types

**Document health monitoring:**
- Batch traceability across supply chain
- BOM version control tracking
- Duplicate detector
- Equipment tracker
- Impact analyzer for change management
- Master data health dashboard

### 2.10 Specialized Modules

#### E-commerce Integration (Demo)
**Path**: `/dashboard/ecommerce`
- Marketplace integrations: Tokopedia, Shopee, Lazada
- Online order aggregation from website + marketplaces
- Catalog synchronization toggle
- Integration status monitoring

#### Workflow Engine
**Path**: `/admin/workflows`
- JSON/Excel-based process definition import
- Mermaid diagram generation for visual process mapping
- Multi-model support (SalesOrder, Quotation, Customer, StockLevel, etc.)
- Gap detection between defined workflows and implemented modules
- Conditional branching and step chaining

#### AI Features
- Floating AI assistant button (bottom-right, toggle)
- Context-aware AI sidebar for in-page help
- AI-powered POS upselling ("Ritchie AI")
- Natural language search in executive dashboard

---

## 3. ROLE-SPECIFIC COMMAND CENTERS

The system provides purpose-built dashboards for different organizational roles:

### 3.1 Executive / CEO Dashboard
**Path**: `/dashboard`
- Full visibility across all modules
- Company pulse bar with critical financial metrics
- Approval center for POs, PRs, and leave requests
- Strategic goal tracking (ON_TRACK / AT_RISK / BEHIND)
- Executive snapshots: daily KPI records for trend analysis

### 3.2 Financial Command Center
**Path**: `/accountant`
- Simplified navigation: Finance module only
- Invoice aging analysis
- Bank reconciliation with smart matching
- GL account management
- Financial metrics dashboard

### 3.3 Factory Command Center
**Path**: `/manager`
- "God mode" view of all factory KPIs
- Real-time production line status
- Staff tracking with attendance and performance
- Material tracking for raw material flow
- Quality metrics inline
- Task board for assignment and tracking

### 3.4 Staff Portal
**Path**: `/staff`
- Task-oriented interface for floor workers
- 4 tabs: Production, Quality, Warehouse, Maintenance
- Task types: WO execution, machine setup, inline inspection, material picking, equipment repair
- Start/Complete/Report Issue actions
- Shift time allocation tracking

---

## 4. DESIGN PHILOSOPHY

### 4.1 Visual Identity: Neo-Brutalism

The UI employs a **neo-brutalist design language** — a deliberately bold, high-contrast aesthetic that prioritizes functional clarity over decorative polish.

**Core principles:**
- **Raw geometry**: 2px solid black borders on all containers, zero border-radius on interactive elements
- **Hard shadows**: Offset drop shadows (`4px 4px 0 0 rgba(0,0,0,1)`) that create a stackable, paper-like depth
- **High contrast**: Black and white as the primary palette, with accent colors reserved for functional meaning
- **Dense typography**: Heavy font weights (`font-black`), uppercase labels, wide letter-spacing for scanability
- **Information density**: Every pixel serves a purpose — no decorative whitespace or ornamental elements

**Why neo-brutalism for an ERP:**
- **Clarity under pressure**: Factory floor operators and warehouse staff need instant visual parsing — bold borders and high contrast achieve this
- **Hierarchy through weight**: Font weight and border thickness communicate importance without relying on color alone
- **Memorability**: The distinctive visual identity makes it immediately recognizable vs. generic enterprise software
- **Reduced ambiguity**: Square corners and hard edges leave no room for visual confusion about where one element ends and another begins

### 4.2 Interaction Design

**Shadow-based depth system:**
```
Resting state:    shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]    — lifted, ready
Hover:            shadow-[2px_2px] + translate-y-[2px]        — partially pressed
Active:           shadow-[0px_0px] + translate-y-[4px]        — fully pressed
Dialog elevation: shadow-[8px_8px]                            — floating overlay
Kanban card:      shadow-[3px_3px]                            — grouped element
```

This creates a tactile, physical interaction model where buttons and cards feel like they're being physically pressed into the surface.

### 4.3 Color System

**Module accent colors** (functional, not decorative):

| Module | Accent Color | Semantic Meaning |
|--------|-------------|------------------|
| Inventory | Emerald (500/600) | Growth, stock health, warehouse |
| Sales / CRM | Amber (400/500) | Revenue, opportunity, warmth |
| Procurement | Violet (400/500) | Process, supplier chain |
| Manufacturing | Blue (400/500) | Production, machinery, precision |
| Finance | Orange (400/500) | Money, accounting, attention |
| HR / HCM | Soft green/neutral | People, wellness |

**Status color coding** (universal):

| Color | Meaning |
|-------|---------|
| Emerald/Green | Healthy, approved, completed, received |
| Blue | Active, in-progress, sent, confirmed |
| Amber/Orange | Warning, pending, draft, needs attention |
| Red | Critical, rejected, expired, overdue, failed |
| Zinc/Gray | Neutral, draft, inactive |
| Violet/Purple | Conversion, special action, PO |

### 4.4 Typography Hierarchy

| Element | Style |
|---------|-------|
| Page header | `text-xl font-black uppercase tracking-tight` on black background |
| Section header | `text-xs font-black uppercase tracking-widest` on light tinted background |
| Form label | `text-[10px] font-black uppercase tracking-wider text-zinc-500` |
| KPI number | `text-2xl md:text-3xl font-black tracking-tighter` |
| KPI label | `text-[10px] font-black uppercase tracking-widest text-zinc-500` |
| Table header | `text-[10px] font-black uppercase tracking-widest text-zinc-500` |
| Body text | `text-sm font-medium` |
| Monospace data | `font-mono font-bold text-xs` (product codes, barcodes, amounts) |

**Font stack:**
- Sans: Geist Sans (primary)
- Display: Outfit (geometric headings)
- Mono: Geist Mono (codes, numbers, barcodes)

### 4.5 Recurring UI Patterns

**Command Header** — appears on every module page:
- Black left accent stripe (6px, module color)
- Icon + uppercase title + subtitle
- Action buttons on the right (Template, Create New)

**KPI Pulse Strip** — horizontal metric cards:
- Colored top accent line (1px)
- Metric icon + uppercase label
- Large number value
- Trend subtitle

**Search & Filter Bar** — consistent filtering:
- Search input with icon prefix
- Segmented status toggle (border-2, active = bg-black text-white)
- Result count display

**Kanban Boards** — used across Sales, Inventory, Leads:
- Square columns with colored accent bars
- Cards with border-2 and 3px shadow
- Status-specific column grouping
- Value aggregation per column
- Empty state with dashed border

**Neo-Brutalist Dialogs** — for all create/edit forms:
- Black header with white text
- ScrollArea for long forms (max-h 72vh)
- Grouped sections with tinted headers
- Cancel (white) + Submit (black with shadow) footer

**Data Tables** — TanStack Table with custom styling:
- Border-2 wrapper
- Zinc-100 header row with border-b-2
- Zebra-style rows
- Pagination with page controls

### 4.6 Theme Variants

The system supports 7 visual themes:
1. **Light (Default)** — Ritchie Minimal: high contrast black/white
2. **Dark** — Premium zinc with glass effects
3. **Claude** — Warm paper aesthetic with terracotta accents
4. **Ritchie Pop** — High-saturation charts with engineering grid
5. **Autumn** — Deep warm browns with orange/amber
6. **Earth** — Forest greens with natural tones
7. **IDE** — VS Code Dark Modern inspired

### 4.7 Responsive Strategy

- **Mobile-first** with Tailwind breakpoints (md: 768px, lg: 1024px)
- **Dialogs** → full-viewport drawer on mobile, floating modal on desktop
- **Tables** → horizontal scroll on mobile, column picker on desktop
- **Grids** → 1 col mobile → 2-3 tablet → 4+ desktop
- **Kanban** → horizontal scroll with fixed-width columns
- **Sidebar** → collapsible on mobile, persistent on desktop

---

## 5. DATA ARCHITECTURE

### 5.1 Database Schema (57 Models, 30+ Enums)

| Domain | Models | Key Tables |
|--------|--------|------------|
| Auth & Access (5) | User, Account, Session, VerificationToken, SystemRole |
| Inventory (8) | Product, Category, Warehouse, Location, StockLevel, InventoryTransaction, StockAlert, StockAudit/StockAuditItem |
| Sales & CRM (10) | Customer, CustomerCategory, CustomerAddress, CustomerContact, PriceList/Item, Quotation/Item, SalesOrder/Item, Lead, CreditNote |
| Procurement (8) | Supplier, SupplierProduct, PurchaseOrder, PurchaseOrderEvent, PurchaseOrderItem, PurchaseRequest/Item, GoodsReceivedNote/GRNItem |
| Manufacturing (8) | WorkOrder, Machine, MaintenanceLog, BillOfMaterials/BOMItem, WorkCenterGroup, Routing/RoutingStep |
| HCM (5) | Employee, Attendance, LeaveRequest, EmployeeTask, QualityInspection/InspectionDefect |
| Finance (5) | Invoice/InvoiceItem, Payment, GLAccount, JournalEntry/JournalLine |
| Executive (2) | ExecutiveSnapshot, StrategicGoal |

### 5.2 Key Business Enums

| Enum | Values |
|------|--------|
| ProductType | MANUFACTURED, TRADING, RAW_MATERIAL, WIP |
| TransactionType | PO_RECEIVE, PRODUCTION_IN, SO_SHIPMENT, PRODUCTION_OUT, RETURN_IN, RETURN_OUT, SCRAP, TRANSFER, ADJUSTMENT, INITIAL |
| ProcurementStatus | GAP_DETECTED, PR_CREATED, PO_DRAFT, PENDING_APPROVAL, APPROVED, ORDERED, VENDOR_CONFIRMED, SHIPPED, PARTIAL_RECEIVED, RECEIVED, COMPLETED, REJECTED, CANCELLED |
| SalesOrderStatus | DRAFT, CONFIRMED, IN_PROGRESS, DELIVERED, INVOICED, COMPLETED, CANCELLED |
| InvoiceStatus | DRAFT, ISSUED, PARTIAL, PAID, OVERDUE, CANCELLED, VOID, DISPUTED |
| InvoiceType | INV_OUT (AR), INV_IN (AP) |
| LeadStatus | NEW, CONTACTED, QUALIFIED, PROPOSAL, NEGOTIATION, WON, LOST |
| WOStatus | PLANNED, IN_PROGRESS, COMPLETED, CANCELLED, ON_HOLD |
| MachineStatus | IDLE, RUNNING, MAINTENANCE, BREAKDOWN, OFFLINE |
| AccountType | ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE |
| PaymentTerm | CASH, NET_15, NET_30, NET_45, NET_60, NET_90, COD |
| CustomerType | INDIVIDUAL, COMPANY, GOVERNMENT |
| TaxStatus | PKP, NON_PKP, EXEMPT |

### 5.3 Core Business Flows

**Procure-to-Pay:**
```
PurchaseRequest → PurchaseOrder → PurchaseOrderEvent (approval chain)
  → GoodsReceivedNote (quality gate) → InventoryTransaction (PO_RECEIVE)
  → Invoice (INV_IN) → Payment (Xendit payout) → JournalEntry (GL posting)
```

**Quote-to-Cash:**
```
Lead → Quotation → SalesOrder → InventoryTransaction (SO_SHIPMENT)
  → Invoice (INV_OUT) → Payment (customer receipt) → JournalEntry (GL posting)
  → Optionally: WorkOrder (if manufactured product)
```

**Make-to-Order:**
```
SalesOrder → WorkOrder (BOM explosion) → Machine assignment
  → RoutingStep execution → QualityInspection → InventoryTransaction (PRODUCTION_IN)
  → Delivery → Invoice
```

**Stock Movement Audit:**
```
Any transaction → InventoryTransaction (ledger entry)
  → StockLevel update (quantity, reserved, available)
  → StockAlert trigger (if threshold breached)
  → JournalEntry (if financial impact)
```

---

## 6. TECHNICAL ARCHITECTURE

### 6.1 Stack Overview

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router + Turbopack) | 16.1.1 |
| Runtime | React + TypeScript (strict) | 19.1.0 / 5.9.3 |
| Database | PostgreSQL via Supabase | — |
| ORM | Prisma | 6.19.2 |
| Auth | Supabase Auth (SSR, cookie-based) | 2.78.0 |
| UI Library | shadcn/ui (Radix primitives) | — |
| Styling | Tailwind CSS | v4 |
| Tables | TanStack Table | 8.21.3 |
| Forms | React Hook Form + Zod | 7.66.0 / 4.1.12 |
| Charts | Recharts | 2.15.4 |
| Animation | Framer Motion | 12.25.0 |
| Drag & Drop | @dnd-kit + @hello-pangea/dnd | — |
| Payments | Xendit | 7.0.0 |
| PDF | Typst templates | — |
| Testing | Vitest | — |
| Icons | Lucide React + Tabler Icons | — |
| Notifications | Sonner (toast) | 2.0.7 |

### 6.2 Architecture Patterns

| Pattern | Implementation |
|---------|---------------|
| **Server Actions** | Primary mutation layer — 10 action files (~9,500 LOC) |
| **REST API** | 32 endpoints for manufacturing, sales, products, payments, documents |
| **Event Sourcing** | PurchaseOrderEvent table for complete PO audit trail |
| **State Machine** | `po-state-machine.ts` with strict transition validation |
| **Double-Entry Bookkeeping** | JournalEntry/JournalLine with auto-posting rules |
| **Role-Based Access** | 4-tier: STAFF, ACCOUNTANT, MANAGER, ADMIN + super roles (CEO, DIRECTOR) |
| **Module Visibility** | Workflow-driven menu filtering per role |
| **Progressive Loading** | React Suspense with timeout-based fallbacks |
| **Caching** | `unstable_cache()` + `revalidateTag()` for ISR |
| **Resilience** | Fallback data, `withRetry()`, `safeQuery()` wrappers |
| **Singleton DB** | `globalForPrisma.prisma` across hot reloads |

### 6.3 Integrations

**Xendit Payment Gateway (Indonesian):**
- Supported banks: BCA, MANDIRI, BNI, BRI, PERMATA, CIMB, BSI, BTN, DANAMON, MAYBANK
- E-wallets: OVO, GOPAY, DANA, LINKAJA, SHOPEEPAY
- Account format validation per channel
- Idempotency keys for duplicate prevention
- Fee calculation engine
- Webhook handler for async confirmation

**Document Generation (Typst):**
- Purchase Order PDFs with supplier details, line items, terms
- Payroll reports (monthly aggregate, department summaries)
- Payslips (individual, gross/net, deductions)
- Binary PDF streaming via API

**Excel Import/Export:**
- Workflow definition import from Excel
- Module mapping and gap detection
- Column validation and error reporting

### 6.4 Authentication & Authorization

| Layer | Mechanism |
|-------|-----------|
| Identity | Supabase Auth (JWT, cookie-based SSR sessions) |
| Middleware | Route protection on all business paths |
| Role Guard | `assertRole(user, allowedRoles)` with super-role bypass |
| Employee Context | Auth user → Employee mapping with department/position detection |
| Approval Authority | `canApproveForDepartment()` checks hierarchical authorization |
| Session Timeout | 5-second race condition handling with stale cookie cleanup |

---

## 7. INDONESIAN LOCALIZATION

### 7.1 Language & Culture

| Aspect | Implementation |
|--------|---------------|
| UI Language | Bahasa Indonesia throughout all pages |
| Currency | IDR with `Intl.NumberFormat('id-ID')` — dot thousands, comma decimal |
| Tax | PPN (VAT) 11% default, auto-calculated on invoices |
| Tax Status | PKP (registered), NON_PKP, EXEMPT |
| Business IDs | NPWP (tax ID), NIK (national ID for individuals) |
| e-Faktur | Integration-ready with encrypted credential storage |
| Customer Types | Perorangan (Individual), Perusahaan (Company), Pemerintah (Government) |
| Geography | Full address model: kelurahan, kecamatan, kabupaten, provinsi |
| Province List | Complete Indonesian administrative division database |
| Date Format | Indonesian locale (`id-ID`) — "14 Feb 2026" |
| Income Tax | PPh 21 calculations in payroll |

### 7.2 Indonesian Payment Ecosystem

- Full Xendit integration (Indonesia's leading payment gateway)
- Support for all major Indonesian banks (BCA, Mandiri, BNI, BRI, etc.)
- E-wallet payout support (OVO, GoPay, DANA, LinkAja, ShopeePay)
- QRIS payment support in POS module
- IDR-native — no multi-currency conversion overhead

---

## 8. SCALE & METRICS

### 8.1 System Size

| Metric | Count |
|--------|-------|
| App pages/routes | 167 |
| UI components (TSX) | 237+ |
| Prisma models | 57 |
| Business enums | 30+ |
| Server action files | 10 (~9,500 LOC) |
| REST API endpoints | 32 |
| npm dependencies | 92 |
| Database migrations | 2+ |
| Seed scripts | 10 |
| PDF templates | 3 |
| Theme variants | 7 |

### 8.2 Module Maturity

| Module | Frontend | Backend | API | Tests | Overall |
|--------|----------|---------|-----|-------|---------|
| Inventory | 90% | 80% | Partial | Yes | **80%** |
| Manufacturing | 85% | 75% | Full | No | **77%** |
| Sales & CRM | 85% | 70% | Partial | No | **72%** |
| Procurement | 90% | 60% | Partial | No | **68%** |
| Documents | 90% | 80% | Partial | No | **80%** |
| Finance | 60% | 50% | No | No | **50%** |
| HCM | 50% | 40% | No | No | **40%** |
| E-commerce | 80% | 0% | No | No | **15%** (demo) |

---

## 9. COMPETITIVE DIFFERENTIATORS

### 9.1 Unique Strengths

1. **Neo-brutalist design language** — visually distinctive, high information density, excellent scanability for industrial/warehouse environments
2. **Deep Indonesian market fit** — not a translated Western ERP; built ground-up with PPN, NPWP, e-Faktur, Indonesian banks, Bahasa Indonesia
3. **Manufacturing-integrated** — most Indonesian ERPs treat manufacturing as an add-on; this has native BOM, routing, OEE, quality control
4. **AI-native features** — floating assistant, POS upselling, executive search (not bolted-on AI)
5. **Role-specific command centers** — 4 tailored dashboards vs. one-size-fits-all approach
6. **Modern tech stack** — Next.js 16, React 19, TypeScript strict — attracts developer talent and enables rapid iteration
7. **Event-sourced procurement** — full audit trail on every PO state change (compliance advantage)
8. **Xendit-native payments** — direct payout to Indonesian banks and e-wallets without middleware
9. **Typst PDF generation** — fast, modern template engine for documents vs. heavy HTML-to-PDF
10. **POS with AI upselling** — retail module with shift tracking, barcode scanning, receipt preview, and AI suggestions

### 9.2 Architecture Advantages

- **Full-stack TypeScript** — shared types between frontend and backend, single language for the entire team
- **Server Actions** — zero API boilerplate for mutations, type-safe end-to-end
- **Supabase ecosystem** — managed PostgreSQL, auth, storage, real-time — reduces DevOps burden
- **Progressive enhancement** — Suspense-based streaming with fallbacks keeps the UI responsive even on slow connections
- **Single codebase** — no microservice complexity; one deploy covers all modules

### 9.3 Market Positioning

**Target segment**: Indonesian mid-market manufacturers and traders (50-500 employees) who need:
- Manufacturing execution (not just inventory and accounting)
- Indonesian tax compliance built-in (not configured after the fact)
- Modern UX that factory floor staff can actually use
- POS integration for companies with retail operations
- Affordable cloud-native deployment (no on-premise hardware)

---

## 10. APPENDIX

### A. Key File Paths

| Purpose | Path |
|---------|------|
| Database schema | `prisma/schema.prisma` |
| PO state machine | `lib/po-state-machine.ts` |
| Inventory logic | `lib/inventory-logic.ts` |
| NB design constants | `lib/dialog-styles.ts` |
| Theme definitions | `app/globals.css` |
| Module config | `config/modules.json` |
| Auth middleware | `middleware.ts` |
| Role guard | `lib/auth/role-guard.ts` |
| Xendit integration | `lib/xendit.ts` |
| Server actions | `lib/actions/*.ts` |
| PDF templates | `templates/` |
| Navigation | `components/app-sidebar.tsx` |

### B. Environment Requirements

```
NEXT_PUBLIC_SUPABASE_URL=        # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # Supabase anonymous key
DATABASE_URL=                     # Connection pooling URL
DIRECT_URL=                       # Direct DB connection
XENDIT_SECRET_KEY=                # Xendit API key (optional)
```

### C. Development Commands

```bash
npm run dev          # Dev server (Turbopack, port 3002)
npm run build        # Production build
npm run lint         # ESLint
npx prisma generate  # Regenerate Prisma client
npx prisma migrate dev --name <name>  # Create migration
npx vitest           # Run tests
```
