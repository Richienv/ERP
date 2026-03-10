# MTG-007: Cashflow Planning Board Design

**Date:** 2026-03-10
**Module:** Finance / New Feature
**Approach:** Hybrid (auto-pull on-the-fly + manual items + monthly snapshots)

## Problem

Tidak ada fitur perencanaan arus kas. Semua dilakukan manual di Excel. User tidak bisa melihat estimasi pengeluaran dan pemasukan per bulan, termasuk gaji, PO yang harus dibayar, dan piutang yang seharusnya masuk.

## Solution

Planning board dengan monthly calendar view, dual tab (Riil/Planning), auto-pull dari semua sumber data keuangan, manual/recurring items, dan variance tracking.

## Data Architecture

### New Prisma Models

```prisma
model CashflowPlanItem {
  id               String   @id @default(uuid())
  date             DateTime @db.Date
  description      String
  amount           Decimal  @db.Decimal(18, 2)
  direction        CashflowDirection // IN or OUT
  category         CashflowCategory  // MANUAL, RECURRING_EXPENSE, RECURRING_INCOME
  glAccountId      String?
  glAccount        GLAccount? @relation(fields: [glAccountId], references: [id])
  isRecurring      Boolean  @default(false)
  recurringPattern String?  // WEEKLY, MONTHLY, QUARTERLY, ANNUAL
  recurringEndDate DateTime? @db.Date
  notes            String?
  createdBy        String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@index([date])
  @@index([direction])
}

model CashflowSnapshot {
  id                      String   @id @default(uuid())
  month                   Int      // 1-12
  year                    Int
  startingBalance         Decimal  @db.Decimal(18, 2)
  startingBalanceOverride Decimal? @db.Decimal(18, 2)
  items                   Json     // frozen copy of all items at snapshot time
  totalPlannedIn          Decimal  @db.Decimal(18, 2)
  totalPlannedOut         Decimal  @db.Decimal(18, 2)
  plannedEndBalance       Decimal  @db.Decimal(18, 2)
  snapshotDate            DateTime @default(now())
  createdAt               DateTime @default(now())

  @@unique([month, year])
}

enum CashflowDirection {
  IN
  OUT
}

enum CashflowCategory {
  // Auto-pulled (virtual, not stored)
  AR_INVOICE
  AP_BILL
  PAYROLL
  BPJS
  PETTY_CASH
  RECURRING_JOURNAL
  BUDGET_ALLOCATION
  // Stored in CashflowPlanItem
  MANUAL
  RECURRING_EXPENSE
  RECURRING_INCOME
}
```

### Auto-Pull Sources (computed on-the-fly, 7 categories)

| # | Category | Source Model | Filter | Direction |
|---|----------|-------------|--------|-----------|
| 1 | AR_INVOICE | Invoice (type=INV_OUT) | balanceDue > 0, dueDate in month | IN |
| 2 | AP_BILL | Invoice (type=INV_IN) | balanceDue > 0, dueDate in month | OUT |
| 3 | PAYROLL | Employee | active, baseSalary > 0 (placed on 25th) | OUT |
| 4 | BPJS | Employee | bpjsKesehatan/Ketenagakerjaan fields | OUT |
| 5 | PETTY_CASH | PettyCashTransaction | recurring patterns in month | OUT |
| 6 | RECURRING_JOURNAL | JournalEntry | isRecurring=true, nextRecurringDate in month | IN/OUT |
| 7 | BUDGET_ALLOCATION | BudgetLine | matching month + year | IN/OUT |

### Starting Balance

- **Default:** Sum of GLAccount.balance where code matches `10xx` (kas/bank accounts: 1000, 1010, 1020, etc.)
- **Override:** User can set `CashflowSnapshot.startingBalanceOverride` for what-if simulation
- **Effective balance:** `startingBalanceOverride ?? startingBalance`

## UI Design

### Page: `/finance/planning`

**Layout:**
- Full-width `mf-page` layout
- KPI strip at top: Saldo Awal, Est. Pemasukan, Est. Pengeluaran, Est. Saldo Akhir
- Two tabs: **Riil** (actual) | **Planning** (projected)
- Monthly calendar grid (7 columns x 4-5 rows)
- Each date cell shows items with color coding (green=masuk, red=keluar)
- Right sidebar: running balance strip, month summary, quick actions

**Tab: Riil**
- Shows actual GL transactions (from JournalEntry/Payment records) that already happened
- Read-only view of what actually occurred this month
- Data source: JournalEntry where status=POSTED, date in selected month

**Tab: Planning**
- Shows all auto-pulled items + manual items for selected month
- Items are editable (manual ones) or read-only (auto-pulled)
- Running balance recalculates as items are added/removed
- Can add manual items, set recurring, override starting balance

**Variance Display (per item):**
- Column: Rencana | Aktual | Selisih
- Green if selisih <= 0 (spent less or received more than planned)
- Red if selisih > 0 (overspent or received less than planned)
- Only visible for past dates where actual data exists

**Actions:**
- "+ Tambah Item" — open dialog to create CashflowPlanItem
- "Set Recurring" — toggle recurring on any manual item
- "Override Saldo Awal" — input field to override starting balance
- "Simpan Snapshot" — freeze current plan as CashflowSnapshot
- Month navigation (prev/next) with year selector

### Components

```
components/finance/
├── cashflow-planning-board.tsx    # Main board component
├── cashflow-calendar.tsx          # Monthly calendar grid
├── cashflow-item-card.tsx         # Individual item in calendar cell
├── cashflow-sidebar.tsx           # Running balance + summary
├── cashflow-kpi-strip.tsx         # Top KPI cards
├── create-cashflow-item-dialog.tsx # Manual item creation
└── cashflow-variance-table.tsx    # Variance comparison view
```

## API Design

### API Route: `GET /api/finance/cashflow-plan`

**Query params:** `month`, `year`

**Response:**
```json
{
  "success": true,
  "startingBalance": 150000000,
  "startingBalanceOverride": null,
  "autoItems": [
    { "id": "auto-ar-1", "source": "AR_INVOICE", "date": "2026-03-15", "description": "INV-2026-0042 - PT Maju Jaya", "amount": 50000000, "direction": "IN", "glAccountCode": "1100", "invoiceId": "..." },
    { "id": "auto-ap-1", "source": "AP_BILL", "date": "2026-03-20", "description": "BILL-2026-0018 - CV Bahan Kain", "amount": 30000000, "direction": "OUT", "glAccountCode": "2100", "invoiceId": "..." },
    { "id": "auto-payroll-1", "source": "PAYROLL", "date": "2026-03-25", "description": "Gaji Maret 2026 (15 karyawan)", "amount": 75000000, "direction": "OUT" }
  ],
  "manualItems": [...CashflowPlanItem records...],
  "actualItems": [...JournalEntry/Payment records for Riil tab...],
  "snapshot": { ...CashflowSnapshot if exists... },
  "summary": {
    "totalIn": 120000000,
    "totalOut": 180000000,
    "netFlow": -60000000,
    "estimatedEndBalance": 90000000
  }
}
```

### Server Actions: `lib/actions/finance-cashflow.ts`

```
getCashflowPlanData(month, year)        # Main data fetcher (auto-pull + manual)
createCashflowPlanItem(data)            # Create manual item
updateCashflowPlanItem(id, data)        # Update manual item
deleteCashflowPlanItem(id)              # Delete manual item
saveCashflowSnapshot(month, year)       # Freeze current plan
overrideStartingBalance(month, year, amount) # Set balance override
getActualTransactions(month, year)      # Riil tab data
```

### Hook: `hooks/use-cashflow-plan.ts`

```ts
useCashflowPlan(month, year) {
  queryKey: queryKeys.cashflowPlan.list(month, year)
  queryFn: fetch('/api/finance/cashflow-plan?month=M&year=Y')
}
```

### Query Keys: `lib/query-keys.ts`

```ts
cashflowPlan: {
  all: ["cashflowPlan"],
  list: (month, year) => ["cashflowPlan", "list", month, year],
}
```

## Cross-Module Data Dependencies

| Module | Data Used | How |
|--------|-----------|-----|
| Sales | Invoice (INV_OUT) dueDate + balanceDue | Auto-pull AR items |
| Procurement | Invoice (INV_IN) dueDate + balanceDue | Auto-pull AP items |
| HCM | Employee.baseSalary, bpjsKesehatan, bpjsKetenagakerjaan | Auto-pull payroll |
| Finance/GL | GLAccount balances (10xx) | Starting balance |
| Finance/GL | JournalEntry (isRecurring) | Auto-pull recurring journals |
| Finance/GL | JournalEntry (POSTED, in month) | Riil tab actual data |
| Finance | PettyCashTransaction | Auto-pull petty cash |
| Finance | BudgetLine | Auto-pull budget allocations |
| Finance | Payment records | Riil tab actual payments |

## Implementation Order

1. **Schema + Migration** — Add CashflowPlanItem, CashflowSnapshot, enums
2. **Server Actions** — `finance-cashflow.ts` with all auto-pull queries
3. **API Route** — `GET /api/finance/cashflow-plan`
4. **Hook** — `use-cashflow-plan.ts` with TanStack Query
5. **UI: Page + KPI strip** — Basic layout with month navigation
6. **UI: Calendar view** — Monthly grid with items
7. **UI: Manual item CRUD** — Create/edit/delete dialog
8. **UI: Recurring items** — Recurring pattern support
9. **UI: Riil tab** — Actual transactions view
10. **UI: Variance** — Plan vs actual comparison
11. **UI: Snapshot** — Save/load monthly snapshots
12. **UI: Balance override** — What-if starting balance
