# QA — Peti Kas (Petty Cash)

## 1. Page Info

| Field | Value |
|-------|-------|
| **Name** | Peti Kas |
| **Route** | `/finance/petty-cash` |
| **File** | `app/finance/petty-cash/page.tsx` |
| **Breadcrumb** | Keuangan → Peti Kas |
| **Type** | Client component (`"use client"`, `force-dynamic`) |
| **Accent** | Orange (NB design system) |

---

## 2. Purpose

Manage the company petty cash fund — top up from a bank account, record daily operational expenses (disbursements), view transaction history, and track the running balance.

---

## 3. UI Elements

### 3.1 Page Header (NB Unified Card)

| Element | Detail |
|---------|--------|
| Accent bar | Orange gradient (`NB.pageAccent`) |
| Icon | `Wallet` on orange square (w-9 h-9) |
| Title | `PETI KAS` (uppercase, font-black) |
| Subtitle | "Kas kecil untuk pengeluaran operasional harian" |

### 3.2 Toolbar Buttons (top-right, Row 1)

| # | Label | Style | Icon | Action |
|---|-------|-------|------|--------|
| 1 | EXPORT | Outline, joined (`NB.toolbarBtnJoin`) | `Download` | Exports all transactions to Excel |
| 2 | REFRESH | Outline, joined (`NB.toolbarBtnJoin`) | `RefreshCcw` | Invalidates petty cash query cache |
| 3 | TOP UP | Outline | `Plus` | Opens Top Up dialog |
| 4 | CATAT PENGELUARAN | Primary (`NB.toolbarBtnPrimary`) | `Minus` | Opens Disbursement dialog |

### 3.3 KPI Strip (Row 2, 5 cells with `divide-x`)

| # | Label | Data | Color | Eye toggle? |
|---|-------|------|-------|-------------|
| 1 | Saldo Saat Ini | `data.currentBalance` | Emerald | Yes |
| 2 | Top Up Bulan Ini | `data.totalTopup` | Blue | Yes |
| 3 | Pengeluaran Bulan Ini | `data.totalDisbursement` | Red | Yes |
| 4 | Transaksi Masuk | Count of TOPUP type | Zinc | No (count only) |
| 5 | Transaksi Keluar | Count of non-TOPUP type | Zinc | No (count only) |

- **Show/hide amounts**: Eye/EyeOff toggle button on each monetary KPI. When hidden, shows `*** ***`.
- KPI counts (Masuk/Keluar) are derived client-side from the full transaction list.

### 3.4 Transaction Table

| Column | Width | Content | Responsive |
|--------|-------|---------|------------|
| Tanggal | 120px | Date in `dd Mmm yyyy` format (id-ID locale) | Hidden on mobile (<md) |
| Tipe | 90px | Badge: green "Masuk" (`ArrowUpCircle`) or red "Keluar" (`ArrowDownCircle`) | Hidden on mobile |
| Nama | 1fr | `tx.recipientName` or "—" | Truncated |
| Keterangan | 1.5fr | `tx.description` | Truncated |
| Jumlah | 130px | Mono font, `+Rp X` (green) or `−Rp X` (red) | — |
| Saldo | 130px | Mono font, `Rp X` (bold) | — |

- **Header row**: Black bg, uppercase 10px labels
- **Alternating rows**: White / zinc-50 stripes
- **Hover**: `bg-orange-50/50`
- **Row animation**: `fadeX` with stagger delay (0.03s per row)

### 3.5 Pagination Footer

| Element | Detail |
|---------|--------|
| Left | "{count} transaksi" label |
| Right | Prev/Next buttons with "page/totalPages" indicator |
| Page size | 15 transactions per page (constant `PAGE_SIZE = 15`) |
| Hidden if | Total transactions ≤ 15 |
| Prev disabled | On page 1 |
| Next disabled | On last page |

### 3.6 Top Up Dialog

| Field | Type | Required | Placeholder | Notes |
|-------|------|----------|-------------|-------|
| Jumlah (IDR) | Number input with "Rp" prefix | Yes | "500000" | `pl-9` for prefix spacing |
| Dari Akun Bank | `ComboboxWithCreate` | Yes | "Pilih akun bank..." | Dropdown of ASSET GL accounts (code starts with "1", or name contains "Bank"/"Kas"), excludes petty cash account "1050". Shows loading state "Memuat..." while fetching. Supports inline creation: `+ Buat Akun Bank Baru`. |
| Keterangan | Text input | No | "Top up bulanan..." | — |

**Dialog styling**: `NB.contentNarrow`, black header with `ArrowUpCircle` icon + "Top Up Peti Kas" title.

### 3.7 Disbursement Dialog

| Field | Type | Required | Placeholder | Notes |
|-------|------|----------|-------------|-------|
| Nama Pemohon | Text input | Yes | "Nama..." | Free text, no validation |
| Jumlah (IDR) | Number input with "Rp" prefix | Yes | "150000" | `pl-9` for prefix spacing |
| Kategori Beban | `ComboboxWithCreate` | Yes | "Pilih kategori beban..." | Dropdown of EXPENSE GL accounts. Default seeded accounts: Beban Transportasi (5100), Makan & Minum (5200), ATK & Supplies (5300), Operasional Lainnya (5400), Perbaikan & Maintenance (5500). Supports inline creation: `+ Buat Akun Beban Baru`. |
| Keterangan | Text input | No | "Keterangan..." | — |

**Dialog styling**: `NB.contentNarrow`, black header with red `ArrowDownCircle` icon + "Catat Pengeluaran" title.

---

## 4. User Actions

### 4.1 Top Up Petty Cash

| Step | Behavior |
|------|----------|
| **Trigger** | Click "Top Up" toolbar button |
| **Dialog opens** | Bank accounts are loaded on dialog open (`loadBanks()` on `onOpenChange(true)`) |
| **Submit** | Calls `topUpPettyCash({ amount, bankAccountCode, description })` |
| **GL posting** | DR Petty Cash (1050), CR selected Bank account |
| **Success** | Toast "Top up berhasil!". Dialog closes. Form resets. 7 query keys invalidated. |
| **Failure (GL)** | Server throws error → Toast with error message. Dialog stays open. |
| **Failure (period closed)** | `assertPeriodOpen()` throws → error propagates to catch → Toast with error message |
| **Created records** | 1 `PettyCashTransaction` (TOPUP) + 1 `JournalEntry` (POSTED) with 2 lines |

### 4.2 Record Disbursement

| Step | Behavior |
|------|----------|
| **Trigger** | Click "Catat Pengeluaran" primary button |
| **Dialog opens** | Expense accounts are loaded on dialog open (`loadExpenses()` on `onOpenChange(true)`) |
| **Submit** | Calls `disbursePettyCash({ amount, recipientName, description, expenseAccountCode })` |
| **Balance check** | Server checks `currentBalance >= amount`. If insufficient, returns `{ success: false, error: "Saldo peti kas tidak cukup (saldo: Rp X)" }` |
| **GL posting** | DR selected Expense account, CR Petty Cash (1050) |
| **Success** | Toast "Pengeluaran tercatat!". Dialog closes. Form resets. 7 query keys invalidated. |
| **Failure (insufficient)** | Toast "Saldo peti kas tidak cukup (saldo: Rp X)". Dialog stays open. |
| **Failure (GL)** | Returns `{ success: false, error }` → Toast with error. No transaction created. |
| **Created records** | 1 `PettyCashTransaction` (DISBURSEMENT) + 1 `JournalEntry` (POSTED) with 2 lines |

### 4.3 Create Bank Account On-The-Fly (Top Up Dialog)

| Step | Behavior |
|------|----------|
| **Trigger** | Click `+ Buat Akun Bank Baru` in ComboboxWithCreate |
| **Action** | Calls `createBankAccount(name)` — auto-generates code in 10xx series (skips 1050) |
| **Success** | Toast `Akun "{name}" berhasil dibuat`. Bank list refreshed. Account auto-selected. Finance caches invalidated. |
| **Failure** | Toast "Gagal membuat akun bank" |

### 4.4 Create Expense Account On-The-Fly (Disburse Dialog)

| Step | Behavior |
|------|----------|
| **Trigger** | Click `+ Buat Akun Beban Baru` in ComboboxWithCreate |
| **Action** | Calls `createExpenseAccount(name)` — auto-generates code in 5xxx series (+100 increments, collision-safe) |
| **Duplicate check** | If name already exists (case-insensitive), returns the existing account instead of creating a new one |
| **Success** | Toast `Akun "{name}" berhasil dibuat ({code})`. Local expense list updated optimistically + server refresh. COA/GL caches invalidated. |
| **Failure** | Toast "Gagal membuat akun beban" |

### 4.5 Export to Excel

| Step | Behavior |
|------|----------|
| **Trigger** | Click "Export" toolbar button |
| **Action** | Calls `exportToExcel()` with ALL transactions (not just current page) |
| **Columns** | Tanggal (formatted), Tipe, Nama, Keterangan, Jumlah, Saldo |
| **Filename** | `peti-kas.xlsx` |
| **No loading state** | Export is synchronous/client-side |

### 4.6 Refresh

| Step | Behavior |
|------|----------|
| **Trigger** | Click "Refresh" toolbar button |
| **Action** | Invalidates `queryKeys.pettyCash.all` → triggers TanStack Query refetch |

### 4.7 Toggle Amount Visibility

| Step | Behavior |
|------|----------|
| **Trigger** | Click Eye/EyeOff icon on any monetary KPI cell |
| **Action** | Toggles `showAmounts` state — affects all 3 monetary KPIs simultaneously |
| **Show** | Displays formatted IDR amounts |
| **Hide** | Displays `*** ***` placeholder |
| **Scope** | KPI strip only — table amounts are always visible |

---

## 5. Form Validations

### 5.1 Top Up Dialog

| Field | Required | Client Validation | Server Validation | Error |
|-------|----------|-------------------|-------------------|-------|
| Jumlah | Yes | Submit button disabled if empty | None (no min check) | Button stays disabled |
| Dari Akun Bank | Yes | Submit button disabled if empty | `findUnique` → throws if not found | Toast: "Akun bank tidak ditemukan" |
| Keterangan | No | None | Defaults to "Top up dari bank" if empty | — |

**Submit button disabled when**: `!amount || !bankCode || loading`

### 5.2 Disbursement Dialog

| Field | Required | Client Validation | Server Validation | Error |
|-------|----------|-------------------|-------------------|-------|
| Nama Pemohon | Yes | Submit button disabled if empty | None | Button stays disabled |
| Jumlah | Yes | Submit button disabled if empty | Balance check: `currentBalance < amount` | Toast: "Saldo peti kas tidak cukup" |
| Kategori Beban | Yes | Submit button disabled if empty | `findUnique` → throws if not found | Toast: "Akun beban tidak ditemukan" |
| Keterangan | No | None | Passed as-is (can be empty string) | — |

**Submit button disabled when**: `!amount || !recipientName || !expenseCode || loading`

### 5.3 Missing Validations

- **No minimum amount**: User can enter `0` or negative numbers for both top-up and disbursement. The `type="number"` input has no `min` attribute.
- **No maximum amount**: No server-side cap on top-up amount.
- **No format validation**: Amount is parsed with `Number()` which allows floats, but the "Rp" prefix suggests whole numbers. The DB stores `Decimal(15,2)`.

---

## 6. API Calls

### 6.1 Main Data — Petty Cash Transactions

| Field | Value |
|-------|-------|
| **Hook** | `usePettyCash()` from `hooks/use-petty-cash.ts` |
| **Library** | TanStack Query (`useQuery`) |
| **QueryFn** | Server action `getPettyCashTransactions()` |
| **Query key** | `queryKeys.pettyCash.list()` |
| **Retry** | 1 attempt |
| **Loading** | Full-page `TablePageSkeleton` with `bg-orange-400` accent |

#### Response Shape

```typescript
{
  success: true,
  transactions: Array<{
    id: string,
    date: Date,
    type: "TOPUP" | "DISBURSEMENT",
    amount: number,
    recipientName: string | null,
    description: string,
    bankAccountName: string | null,   // "{code} — {name}"
    expenseAccountName: string | null, // "{code} — {name}"
    balanceAfter: number,
  }>,
  currentBalance: number,  // from latest transaction's balanceAfter
  totalTopup: number,      // sum of TOPUP amounts this month
  totalDisbursement: number, // sum of DISBURSEMENT amounts this month
}
```

**Query limit**: Server fetches at most 200 transactions (`take: 200`). KPI monthly totals are calculated from this capped list.

### 6.2 Server Actions (mutations)

| Action | Server Function | File |
|--------|----------------|------|
| Top up | `topUpPettyCash(data)` | `lib/actions/finance-petty-cash.ts` |
| Disburse | `disbursePettyCash(data)` | `lib/actions/finance-petty-cash.ts` |
| Get expense accounts | `getExpenseAccounts()` | `lib/actions/finance-petty-cash.ts` |
| Get bank accounts | `getBankAccounts()` | `lib/actions/finance-petty-cash.ts` |
| Create expense account | `createExpenseAccount(name)` | `lib/actions/finance-petty-cash.ts` |
| Create bank account | `createBankAccount(name)` | `lib/actions/finance-petty-cash.ts` |

### 6.3 Cache Invalidation (after top-up / disbursement)

7 query key families are invalidated:
1. `pettyCash.all`
2. `journal.all`
3. `financeDashboard.all`
4. `financeReports.all`
5. `chartAccounts.all`
6. `accountTransactions.all`
7. `cashflowPlan.all`

---

## 7. State & Dependencies

### 7.1 Data Dependencies

| Dependency | Source | Required |
|------------|--------|----------|
| Petty cash transactions | `getPettyCashTransactions()` server action | Yes — page shows skeleton until loaded |
| Bank accounts | `getBankAccounts()` server action | Only when Top Up dialog opens |
| Expense accounts | `getExpenseAccounts()` server action | Only when Disbursement dialog opens |

### 7.2 Component Dependencies

| Component | File | Purpose |
|-----------|------|---------|
| `TablePageSkeleton` | `components/ui/page-skeleton.tsx` | Loading state |
| `ComboboxWithCreate` | `components/ui/combobox-with-create.tsx` | Account selector with inline creation |
| `NB` style constants | `lib/dialog-styles.ts` | NB design system tokens |
| `exportToExcel` | `lib/table-export.ts` | Excel file download |

### 7.3 GL Account Dependencies

| Account | Code | Created by |
|---------|------|------------|
| Kas Kecil (Petty Cash) | `1050` | Auto-upserted on `getPettyCashTransactions()` |
| Default expense accounts | `5100-5500` | Auto-upserted on `getExpenseAccounts()` |
| System bank accounts | Various | `ensureSystemAccounts()` on `getBankAccounts()` |

### 7.4 Client State

| State | Type | Default | Purpose |
|-------|------|---------|---------|
| `topUpOpen` | boolean | false | Top Up dialog visibility |
| `disburseOpen` | boolean | false | Disbursement dialog visibility |
| `showAmounts` | boolean | true | KPI amount visibility toggle |
| `page` | number | 1 | Current pagination page |

---

## 8. Edge Cases & States

### 8.1 Loading State

- **Full page**: `TablePageSkeleton` with `bg-orange-400` accent while `isLoading || !data`.
- **Dialog dropdowns**: Show "Memuat..." placeholder while bank/expense accounts load.
- **Submit buttons**: Show `Loader2` spinner during mutation; button disabled.

### 8.2 Empty State

| Area | State | Visual |
|------|-------|--------|
| No transactions | `transactions.length === 0` | Wallet icon (zinc-200) + "Belum ada transaksi" + "Top up peti kas untuk memulai" |
| No bank accounts | Empty dropdown | "Tidak ada akun bank" message in combobox |
| No expense accounts | Empty dropdown | "Tidak ada akun beban" message in combobox |

### 8.3 Error State

- **API failure**: `usePettyCash` hook returns fallback `{ transactions: [], currentBalance: 0, totalTopup: 0, totalDisbursement: 0 }`. Page renders with empty state, not error message.
- **Server action failures**: Caught in try/catch → Toast error notification. Dialog stays open.
- **Period closed**: `assertPeriodOpen()` throws → error propagates to client → Toast with server message.
- **No global error boundary for this specific page** — inherits from `app/finance/error.tsx`.

### 8.4 Permission / Role-Based Visibility

- **Auth**: `requireAuth()` checks Supabase session. All 6 server actions require authentication.
- **No role-based restrictions**: Any authenticated user can top up and disburse. No manager approval required.
- **Period lock**: `assertPeriodOpen()` enforced on write operations (top-up and disburse), not on read.

### 8.5 Large Dataset Behavior

- **Server cap**: `take: 200` — only the 200 most recent transactions are fetched.
- **Client pagination**: 15 per page → max 14 pages (200 / 15 = 13.3).
- **KPI monthly totals**: Calculated from the capped 200 — if there are 200+ transactions, the totals may be inaccurate for old months.
- **Export**: Exports all fetched transactions (up to 200), not the full history.

### 8.6 Animations

- Page uses Framer Motion throughout:
  - `stagger` container with child delay
  - `fadeUp` for page card and table card
  - `fadeX` for individual table rows (0.03s stagger)
  - `AnimatePresence` for KPI amount show/hide transitions
  - Spring physics for KPI count changes

### 8.7 Responsive Design

- Table header: Hidden on mobile (`hidden md:grid`)
- Table rows: `grid-cols-1 md:grid-cols-[120px_90px_1fr_1.5fr_130px_130px]`
- On mobile, all columns stack vertically in a single column

### 8.8 Dark Mode

- Full dark mode support with `dark:` variants on all elements.

---

## 9. Issues & Notes

### 9.1 Hardcoded Petty Cash Account Code

**File**: `lib/actions/finance-petty-cash.ts:9`
```typescript
const PETTY_CASH_ACCOUNT = "1050"
```
**Issue**: The petty cash GL account code is hardcoded as `"1050"` rather than referencing `SYS_ACCOUNTS.PETTY_CASH` from `lib/gl-accounts.ts`. Per CLAUDE.md rules, system account codes should never be hardcoded as string literals.

**Severity**: Medium — if `SYS_ACCOUNTS.PETTY_CASH` and this constant diverge, transactions would post to different accounts.

### 9.2 Race Condition on Balance Calculation

**File**: `lib/actions/finance-petty-cash.ts:83-85` (top-up) and `:142-143` (disburse)
```typescript
const latest = await basePrisma.pettyCashTransaction.findFirst({ orderBy: { date: "desc" } })
const currentBalance = latest ? Number(latest.balanceAfter) : 0
```
**Issue**: Balance is read outside a transaction. Two concurrent requests could read the same `balanceAfter`, causing one to overwrite the other's balance calculation. Neither top-up nor disburse uses `$transaction`. The GL journal is posted first (separate operation), then the petty cash record is created — if the record creation fails, the GL entry orphans.

**Severity**: High — concurrent usage can produce incorrect running balances. The GL posting + record creation is not atomic.

### 9.3 No Minimum/Maximum Amount Validation

**File**: `app/finance/petty-cash/page.tsx:402,527` (client) and `lib/actions/finance-petty-cash.ts` (server)
**Issue**: Neither client nor server validates that `amount > 0`. User can submit:
- `amount = 0` → creates a zero-value transaction with a zero-value journal entry
- `amount = -100` → `Number("-100")` = -100 → negative top-up or disbursement; the disbursement balance check `currentBalance < data.amount` would pass if amount is negative

**Severity**: Medium — negative amounts can corrupt the running balance.

### 9.4 200-Transaction Cap Affects KPI Accuracy

**File**: `lib/actions/finance-petty-cash.ts:37`
```typescript
take: 200,
```
**Issue**: Server fetches only the last 200 transactions. The monthly totals (`totalTopup`, `totalDisbursement`) are computed from this capped set. If there are more than 200 transactions total and the month spans beyond the 200th, the KPI values for "Bulan Ini" will be understated. The "Transaksi Masuk/Keluar" counts are computed client-side from the full (capped) list, counting ALL transactions ever, not just this month.

**Severity**: Low — 200 is generous for petty cash, but the count KPIs are misleading (they show all-time counts, not monthly).

### 9.5 Export Exports Only Fetched Data (Max 200)

**File**: `app/finance/petty-cash/page.tsx:115-128`
**Issue**: The Excel export uses `transactions` (the client-side array, max 200 items). Users may expect a full export of all historical transactions. No warning is shown that the export is limited.

**Severity**: Low — 200 should cover most use cases, but could be confusing.

### 9.6 Dialog Form State Not Reset on Close Without Submit

**File**: `app/finance/petty-cash/page.tsx:368-479` (TopUpDialog) and `:483-616` (DisburseDialog)
**Issue**: Form fields (amount, bankCode, description, etc.) are only reset on successful submit. If the user fills in fields, closes the dialog with "Batal", and reopens it, all previous values remain. The dialog does reset the `open` state but not the form state.

**Severity**: Low — minor UX annoyance.

### 9.7 Bank Account Query Excludes Valid Cash Accounts

**File**: `lib/actions/finance-petty-cash.ts:274-285`
```typescript
where: {
    type: "ASSET",
    code: { not: PETTY_CASH_ACCOUNT },
    OR: [
        { code: { startsWith: "1" } },
        { name: { contains: "Bank", mode: "insensitive" } },
        { name: { contains: "Kas", mode: "insensitive" } },
    ],
}
```
**Issue**: The filter is broad — `code: { startsWith: "1" }` matches ALL asset accounts in the 1xxx range (inventory `1300`, AR `1200`, etc.), not just bank/cash accounts. Combined with the OR conditions, this returns many non-bank accounts as selectable bank sources for top-up.

**Severity**: Medium — users could accidentally top up petty cash from the "Piutang Usaha" or "Persediaan" account, creating incorrect journal entries.

### 9.8 Expense Account Code Generation Can Overflow

**File**: `lib/actions/finance-petty-cash.ts:247-255`
```typescript
let nextNum = allExpenseCodes.length > 0
    ? Number(allExpenseCodes[0].code) + 100
    : 5100
```
**Issue**: The code generation takes the highest existing 5xxx code and adds 100. If the highest code is `5900`, the next would be `6000` — which is outside the expense code range and may collide with other account type ranges. No boundary check exists.

**Severity**: Low — would only occur after many custom expense accounts.

### 9.9 Date Defaults to Server `new Date()` — No User Date Selection

**Issue**: Both top-up and disbursement use `new Date()` as the transaction date. There is no date picker in either dialog. Users cannot backdate transactions (e.g., recording a petty cash disbursement from yesterday).

**Severity**: Low — may be intentional for audit purposes, but limits flexibility.

### 9.10 "Transaksi Masuk/Keluar" Counts Are All-Time, Not Monthly

**File**: `app/finance/petty-cash/page.tsx:78-79`
```typescript
const topUpCount = transactions.filter((tx: any) => tx.type === "TOPUP").length
const disburseCount = transactions.filter((tx: any) => tx.type !== "TOPUP").length
```
**Issue**: These counts are from the entire `transactions` array (up to 200), not filtered to the current month. But they sit in the KPI strip alongside monthly monetary values, creating a misleading juxtaposition.

**Severity**: Low — cosmetic mismatch in temporal scope.
