# Cashflow Planning: Simulasi + Aktual Redesign

**Date:** 2026-03-12
**Status:** Approved

## Problem

The current Perencanaan Arus Kas page has "PLANNING" and "RIIL" tabs, but the naming and functionality don't match what users actually need:

- **PLANNING** shows auto-pulled items but doesn't let users simulate what-if scenarios (e.g., "what if we approve this draft PO?", "what if we pay half salary?")
- **RIIL** shows posted journal entries but doesn't clearly distinguish confirmed vs partial payments

## Solution

Rename and redesign into two distinct views:

- **SIMULASI** — Interactive what-if sandbox where users toggle and edit ALL items from ALL statuses
- **AKTUAL** — Read-only view of only confirmed/paid transactions with partial payment indicators

---

## Routes

```
/finance/planning/          → Landing with [SIMULASI] [AKTUAL] tab bar
/finance/planning/simulasi  → Simulation workspace with left sidebar
/finance/planning/aktual    → Actuals-only clean view
```

Both sub-pages share the month/year picker. Sidebar nav link stays at `/finance/planning`.

---

## SIMULASI Page

### Layout

Left sidebar (~260px) + main area (weekly breakdown).

**Sidebar:**
- **Skenario section** — List of saved named scenarios (e.g., "Optimis", "Hemat", "Worst Case"). Click to load. Active highlighted. `[+ Buat Skenario]` button. Kebab menu for rename/delete.
- **Sumber section** — Checkboxes per source category (PO, SO, Payroll, BPJS, Peti Kas, WO, Loan, Budget, Recurring, Manual). Toggling hides/shows ALL items from that source.

**Main area:**
- KPI cards: Posisi Kas, Cash Runway, Rekening (recalculate live on toggle/edit)
- Weekly breakdown (MGG 1-4), each item row has:
  - **Checkbox** — include/exclude from simulation
  - **Editable amount** — inline edit, original amount as placeholder
  - **Source badge** — color-coded category (PO, SO, Payroll, etc.)
  - **Status badge** — Draft (gray), Pending (yellow), Approved (green)
- Summary bar: Saldo Awal, Total Masuk, Total Keluar, Net, Saldo Akhir
- Proyeksi 6 Bulan strip
- `[+ TAMBAH]` button for manual items

### Named Scenarios

Users can create multiple simulations per month. Each scenario stores:
- Which sources are disabled
- Which items are toggled off
- Amount overrides per item

Scenarios are saved to DB and loaded fresh data on each visit (config applied as overlay).

### Data Sources — All Statuses

| Source | Statuses Pulled |
|--------|----------------|
| PO | DRAFT, PENDING_APPROVAL, APPROVED, ORDERED, SHIPPED, PARTIAL_RECEIVED, RECEIVED |
| Sales Order | DRAFT, CONFIRMED, IN_PROGRESS, DELIVERED, INVOICED |
| AR Invoice | DRAFT, ISSUED, PARTIAL, OVERDUE |
| AP Bill | DRAFT, ISSUED, PARTIAL, OVERDUE |
| Payroll | Estimated from active employees (base + tunjangan) |
| BPJS | Calculated 4% + 5.74% of estimated payroll |
| Petty Cash | All transactions in period |
| Work Orders | PLANNED, IN_PROGRESS (estimated cost) |
| Loan | All scheduled repayments |
| Budget | All allocations for the month |
| Recurring Journal | All with nextRecurringDate in period |
| Manual Items | All CashflowPlanItem for the month |

---

## AKTUAL Page

### Layout

Full-width (no sidebar), read-only.

- KPI cards: Posisi Kas, Cash Runway, Rekening
- Weekly breakdown (MGG 1-4) — no checkboxes, no editable amounts
- **Partial payment indicator** — items show `6jt / 10jt` with mini progress bar and percentage
- Status badges: `LUNAS` (paid), `SEBAGIAN 60%` (partial)
- Summary bar + Proyeksi 6 Bulan
- `[SNAPSHOT]` button for historical locking

### Data Sources — Confirmed Only

| Source | What Counts as "Actual" |
|--------|------------------------|
| PO | RECEIVED, COMPLETED — actual amount paid |
| Sales Order | DELIVERED, INVOICED, COMPLETED — actual amount received |
| AR Invoice | PAID amount only. Partial = amount received so far |
| AP Bill | PAID amount only. Partial = amount paid so far |
| Payroll | Only after payment journal POSTED |
| BPJS | Only after payment journal POSTED |
| Petty Cash | All posted transactions (actual by nature) |
| Work Orders | COMPLETED only — actual cost |
| Loan | Only POSTED journal entries |
| Budget | Only allocations with POSTED journals |
| Recurring Journal | Only POSTED entries |
| Manual Items | Not shown (manual = planning only) |

---

## Data Model

### New: CashflowScenario

```prisma
model CashflowScenario {
  id        String   @id @default(cuid())
  name      String
  month     Int
  year      Int
  config    Json
  // config shape:
  // {
  //   disabledSources: ["WO_COST", "BUDGET_ALLOCATION"],
  //   items: {
  //     "po-PO001": { enabled: true, overrideAmount: 5000000 },
  //     "payroll-2026-03": { enabled: false },
  //     "ar-INV001": { enabled: true, overrideAmount: null }
  //   }
  // }
  totalIn   Decimal  @default(0)
  totalOut  Decimal  @default(0)
  netFlow   Decimal  @default(0)
  createdBy String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([month, year])
}
```

### Unchanged Models

- CashflowPlanItem (manual items)
- CashflowSnapshot (historical locking)
- PettyCashTransaction

---

## Server Actions & API

### New Server Actions (in `lib/actions/finance-cashflow.ts`)

```
createCashflowScenario(name, month, year)
updateCashflowScenario(id, config, name?)
deleteCashflowScenario(id)
getCashflowScenarios(month, year)
getCashflowScenario(id)
getCashflowActualData(month, year)
```

### New API Route

```
GET /api/finance/cashflow-actual?month=3&year=2026
```

### Modified Existing

- `getCashflowPlanData()` — add option to fetch ALL statuses (not just approved) for simulasi

### New Hooks

```ts
// hooks/use-cashflow-scenarios.ts
useCashflowScenarios(month, year)
useCashflowScenario(id)

// hooks/use-cashflow-actual.ts
useCashflowActual(month, year)
```

### Data Flow

**SIMULASI:**
```
Page loads → fetch all items (all statuses) + fetch scenarios list
User picks scenario → apply config overlay
User edits toggles/amounts → live recalculation in UI (no server call)
User clicks "Simpan" → updateCashflowScenario() saves to DB
```

**AKTUAL:**
```
Page loads → getCashflowActualData() → confirmed transactions only
Partial payments → show actual paid + total + progress bar
Read-only, no user interaction
```

---

## Component Structure

```
components/finance/
├── cashflow-planning-board.tsx      → KEEP (refactor, extract shared pieces)
├── cashflow-simulasi-board.tsx      → NEW (simulasi main area)
├── cashflow-simulasi-sidebar.tsx    → NEW (scenario list + source toggles)
├── cashflow-aktual-board.tsx        → NEW (aktual main area)
├── cashflow-scenario-dialog.tsx     → NEW (create/rename scenario)
├── cashflow-item-row.tsx            → NEW (shared item row with checkbox + editable amount)
├── cashflow-partial-indicator.tsx   → NEW (progress bar for partial payments)
├── create-cashflow-item-dialog.tsx  → KEEP (manual item creation)
```

---

## UI Details

### Status Badge Colors (SIMULASI)
- Draft → `bg-zinc-100 text-zinc-600`
- Pending → `bg-yellow-100 text-yellow-700`
- Approved/Confirmed → `bg-emerald-100 text-emerald-700`

### Partial Payment Indicator (AKTUAL)
```
INV-001                    SEBAGIAN
Rp 6.000.000 / 10.000.000   60%
████████░░░░░░
```

### Category Color Coding
Same as existing: emerald (AR), orange (AP), amber (PO), blue (Payroll), indigo (BPJS), slate (Petty Cash), purple (Recurring), etc.
