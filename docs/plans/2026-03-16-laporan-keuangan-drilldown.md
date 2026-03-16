# Laporan Keuangan Drill-Down Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add inline expand/collapse drill-down to P&L and Balance Sheet line items, showing journal entry transactions with full traceability and clickable links to source documents.

**Architecture:** New server action `getAccountDrillDown()` queries journal lines by account code range + date period, enriched with invoice/payment relations for source links. Frontend adds expand/collapse with framer-motion to each P&L and Balance Sheet row, fetching drill-down on demand.

**Tech Stack:** Next.js server actions, Prisma, React, framer-motion, TanStack Query (for cache invalidation context)

**Spec:** `docs/superpowers/specs/2026-03-16-laporan-keuangan-drilldown-design.md`

---

## File Structure

| Action | File | Purpose |
|--------|------|---------|
| Modify | `lib/actions/finance-gl.ts` | Add `getAccountDrillDown()` server action |
| Modify | `app/finance/reports/page.tsx` | Add expand/collapse UI to P&L and Balance Sheet panels |

---

## Task 1: Backend — getAccountDrillDown Server Action

**Files:**
- Modify: `lib/actions/finance-gl.ts`

- [ ] **Step 1: Add the DrillDownRow type and getAccountDrillDown function**

Add at the end of `lib/actions/finance-gl.ts` (before the closing of the file), the following:

```typescript
// ==========================================
// DRILL-DOWN — Transaction Detail for Reports
// ==========================================

export interface DrillDownRow {
    id: string
    date: string
    reference: string
    description: string
    counterparty: string
    journalNumber: string
    accountCode: string
    accountName: string
    debit: number
    credit: number
    sourceType: 'INVOICE_AR' | 'INVOICE_AP' | 'PAYMENT' | 'JOURNAL' | 'PETTY_CASH' | 'OPENING'
    sourceUrl: string
}

/**
 * Fetch journal line transactions for a specific GL account code range within a period.
 * Used for drill-down in P&L and Balance Sheet reports.
 *
 * @param accountFilter - single code ("4000"), code range ("5100-5999"), or type ("REVENUE")
 * @param startDate - period start
 * @param endDate - period end
 * @param limit - max rows (default 100)
 */
export async function getAccountDrillDown(
    accountFilter: string,
    startDate: Date,
    endDate: Date,
    limit = 100
): Promise<DrillDownRow[]> {
    try {
        const { prisma } = await import('@/lib/db')

        // Build account filter
        let accountWhere: any = {}
        if (accountFilter.includes('-')) {
            // Range: "5100-5999"
            const [from, to] = accountFilter.split('-')
            accountWhere = { code: { gte: from, lte: to } }
        } else if (['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'].includes(accountFilter)) {
            // Type filter
            accountWhere = { type: accountFilter }
        } else {
            // Exact code
            accountWhere = { code: accountFilter }
        }

        const lines = await prisma.journalLine.findMany({
            where: {
                account: accountWhere,
                entry: {
                    status: 'POSTED',
                    date: { gte: startDate, lte: endDate },
                },
            },
            include: {
                account: { select: { code: true, name: true } },
                entry: {
                    select: {
                        id: true,
                        date: true,
                        reference: true,
                        description: true,
                        invoiceId: true,
                        paymentId: true,
                        pettyCashTransactionId: true,
                        invoice: {
                            select: {
                                id: true,
                                number: true,
                                type: true,
                                customer: { select: { name: true } },
                                supplier: { select: { name: true } },
                            },
                        },
                        payment: {
                            select: {
                                id: true,
                                number: true,
                                customer: { select: { name: true } },
                                supplier: { select: { name: true } },
                            },
                        },
                    },
                },
            },
            orderBy: { entry: { date: 'desc' } },
            take: limit,
        })

        return lines.map((line: any) => {
            const entry = line.entry
            const invoice = entry.invoice
            const payment = entry.payment

            // Determine source type and URL
            let sourceType: DrillDownRow['sourceType'] = 'JOURNAL'
            let sourceUrl = '/finance/journal'
            let counterparty = ''

            if (invoice) {
                if (invoice.type === 'INV_OUT') {
                    sourceType = 'INVOICE_AR'
                    sourceUrl = `/finance/invoices?highlight=${invoice.id}`
                    counterparty = invoice.customer?.name || ''
                } else {
                    sourceType = 'INVOICE_AP'
                    sourceUrl = `/finance/bills?highlight=${invoice.id}`
                    counterparty = invoice.supplier?.name || ''
                }
            } else if (payment) {
                sourceType = 'PAYMENT'
                sourceUrl = '/finance/payments'
                counterparty = payment.customer?.name || payment.supplier?.name || ''
            } else if (entry.pettyCashTransactionId) {
                sourceType = 'PETTY_CASH'
                sourceUrl = '/finance/petty-cash'
            } else if (entry.reference?.startsWith('OPENING')) {
                sourceType = 'OPENING'
                sourceUrl = '/finance/opening-balances'
            }

            return {
                id: line.id,
                date: entry.date.toISOString().slice(0, 10),
                reference: invoice?.number || payment?.number || entry.reference || '',
                description: entry.description || '',
                counterparty,
                journalNumber: entry.reference || entry.id.slice(0, 8),
                accountCode: line.account.code,
                accountName: line.account.name,
                debit: Number(line.debit),
                credit: Number(line.credit),
                sourceType,
                sourceUrl,
            }
        })
    } catch (error) {
        console.error('[getAccountDrillDown] Error:', error)
        return []
    }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit lib/actions/finance-gl.ts 2>&1 | grep finance-gl | head -5`

- [ ] **Step 3: Commit**

```bash
git add lib/actions/finance-gl.ts
git commit -m "feat(reports): add getAccountDrillDown server action for report drill-down"
```

---

## Task 2: Frontend — P&L Drill-Down

**Files:**
- Modify: `app/finance/reports/page.tsx`

- [ ] **Step 1: Add imports and drill-down state**

At the top of the file, add the import:
```typescript
import { getAccountDrillDown, type DrillDownRow } from "@/lib/actions/finance-gl"
```

Inside the main component, add state for drill-down:
```typescript
// Drill-down state
const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set())
const [drillDownCache, setDrillDownCache] = useState<Map<string, DrillDownRow[]>>(new Map())
const [drillDownLoading, setDrillDownLoading] = useState<string | null>(null)
```

Add the toggle function:
```typescript
async function toggleDrillDown(accountKey: string, accountFilter: string) {
    if (expandedAccounts.has(accountKey)) {
        setExpandedAccounts(prev => { const next = new Set(prev); next.delete(accountKey); return next })
        return
    }
    if (drillDownCache.has(accountKey)) {
        setExpandedAccounts(prev => new Set(prev).add(accountKey))
        return
    }
    // Fetch
    setDrillDownLoading(accountKey)
    try {
        const rows = await getAccountDrillDown(
            accountFilter,
            new Date(periodStart),
            new Date(periodEnd),
        )
        setDrillDownCache(prev => new Map(prev).set(accountKey, rows))
        setExpandedAccounts(prev => new Set(prev).add(accountKey))
    } catch {
        toast.error("Gagal memuat detail transaksi")
    } finally {
        setDrillDownLoading(null)
    }
}
```

- [ ] **Step 2: Add the DrillDownPanel helper component**

Add this inside the file (before the main component or as a nested function):

```typescript
const SOURCE_BADGE: Record<string, { label: string; cls: string }> = {
    INVOICE_AR: { label: "FAKTUR", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
    INVOICE_AP: { label: "TAGIHAN", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
    PAYMENT: { label: "BAYAR", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
    JOURNAL: { label: "JURNAL", cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" },
    PETTY_CASH: { label: "PETTY", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
    OPENING: { label: "SALDO AWAL", cls: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
}

function DrillDownPanel({ rows, loading }: { rows: DrillDownRow[]; loading: boolean }) {
    const router = useRouter()
    if (loading) {
        return (
            <div className="px-8 py-4 flex items-center gap-2 text-xs text-zinc-400 bg-zinc-50/50 dark:bg-zinc-800/30">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Memuat transaksi...
            </div>
        )
    }
    if (rows.length === 0) {
        return (
            <div className="px-8 py-3 text-xs text-zinc-400 italic bg-zinc-50/50 dark:bg-zinc-800/30">
                Tidak ada transaksi ditemukan untuk periode ini
            </div>
        )
    }
    return (
        <div className="bg-zinc-50/50 dark:bg-zinc-800/20 border-t border-zinc-200 dark:border-zinc-700">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="text-[9px] font-black uppercase tracking-widest text-zinc-400">
                            <th className="px-3 py-1.5 text-left pl-10">Tanggal</th>
                            <th className="px-3 py-1.5 text-left">Tipe</th>
                            <th className="px-3 py-1.5 text-left">Referensi</th>
                            <th className="px-3 py-1.5 text-left">Deskripsi</th>
                            <th className="px-3 py-1.5 text-left">Pihak</th>
                            <th className="px-3 py-1.5 text-left">Akun</th>
                            <th className="px-3 py-1.5 text-right">Debit</th>
                            <th className="px-3 py-1.5 text-right">Kredit</th>
                            <th className="px-3 py-1.5 w-8" />
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, idx) => {
                            const badge = SOURCE_BADGE[row.sourceType] || SOURCE_BADGE.JOURNAL
                            return (
                                <motion.tr
                                    key={row.id}
                                    initial={{ opacity: 0, y: -4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.03 }}
                                    className="border-t border-zinc-100 dark:border-zinc-800 hover:bg-orange-50/40 dark:hover:bg-orange-950/10 group transition-colors text-xs"
                                >
                                    <td className="px-3 py-1.5 pl-10 font-mono text-zinc-500 whitespace-nowrap">{row.date}</td>
                                    <td className="px-3 py-1.5">
                                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 ${badge.cls}`}>{badge.label}</span>
                                    </td>
                                    <td className="px-3 py-1.5 font-bold text-zinc-700 dark:text-zinc-300">{row.reference || '—'}</td>
                                    <td className="px-3 py-1.5 text-zinc-500 max-w-[200px] truncate">{row.description}</td>
                                    <td className="px-3 py-1.5 font-medium text-zinc-600 dark:text-zinc-400">{row.counterparty || '—'}</td>
                                    <td className="px-3 py-1.5 font-mono text-[10px] text-zinc-400">{row.accountCode}</td>
                                    <td className="px-3 py-1.5 text-right font-mono text-emerald-600 tabular-nums">
                                        {row.debit > 0 ? formatIDR(row.debit) : ''}
                                    </td>
                                    <td className="px-3 py-1.5 text-right font-mono text-red-500 tabular-nums">
                                        {row.credit > 0 ? formatIDR(row.credit) : ''}
                                    </td>
                                    <td className="px-3 py-1.5">
                                        <button
                                            onClick={() => router.push(row.sourceUrl)}
                                            className="opacity-0 group-hover:opacity-100 text-orange-500 hover:text-orange-700 transition-all"
                                            title="Lihat sumber"
                                        >
                                            <ArrowRight className="h-3.5 w-3.5" />
                                        </button>
                                    </td>
                                </motion.tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
```

NOTE: `ArrowRight` should already be imported from lucide-react. If not, add it. `Loader2` is likely already imported too. Check existing imports.

- [ ] **Step 3: Make P&L rows clickable with drill-down**

Replace the P&L section (~lines 748-804) to make each row clickable. The key pattern for each drillable row:

```tsx
// Example for Revenue row:
<TableRow
    className="font-black bg-zinc-50 dark:bg-zinc-800 cursor-pointer hover:bg-orange-50/50 dark:hover:bg-orange-950/10 transition-colors group"
    onClick={() => toggleDrillDown('pnl-revenue', 'REVENUE')}
>
    <TableCell className="w-[60%]">
        <div className="flex items-center gap-2">
            <ChevronRight className={`h-3.5 w-3.5 text-zinc-400 transition-transform ${expandedAccounts.has('pnl-revenue') ? 'rotate-90' : ''}`} />
            Pendapatan (Revenue)
        </div>
    </TableCell>
    <TableCell className="text-right font-mono">{formatIDR(pnlData.revenue)}</TableCell>
</TableRow>
{expandedAccounts.has('pnl-revenue') && (
    <TableRow>
        <TableCell colSpan={2} className="p-0">
            <AnimatePresence>
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                    <DrillDownPanel
                        rows={drillDownCache.get('pnl-revenue') || []}
                        loading={drillDownLoading === 'pnl-revenue'}
                    />
                </motion.div>
            </AnimatePresence>
        </TableCell>
    </TableRow>
)}
```

Apply this pattern to each P&L line item:

| Row | accountKey | accountFilter | Notes |
|-----|-----------|---------------|-------|
| Pendapatan | `pnl-revenue` | `REVENUE` | All revenue accounts (< 7000) |
| HPP | `pnl-cogs` | `5000` | Single account code |
| Each operating expense | `pnl-opex-{category}` | Use account code from extended P&L data | See Step 4 |
| Pendapatan Lain-lain | `pnl-other-income` | `7000-8999` | Code range |
| Biaya Lain-lain | `pnl-other-expense` | `8000-9999` | Code range |

For operating expenses, the P&L currently returns `{ category: string, amount: number }` without account codes. We need to extend this — see Step 4.

- [ ] **Step 4: Extend P&L data to include account codes**

In `lib/actions/finance.ts`, modify the `operatingExpenses` array to include account codes:

Find line ~490-534 where operating expenses are built. Change the map and array to include code:

```typescript
// Current: expenseMap = Map<string, number> (name → amount)
// Change to: Map<string, { amount: number; code: string }> (name → {amount, code})
const expenseMap = new Map<string, { amount: number; code: string }>()

// In the loop (line ~524):
const current = expenseMap.get(account.name) || { amount: 0, code: account.code }
expenseMap.set(account.name, { amount: current.amount + effectiveAmount, code: current.code })

// In the conversion (line ~532-535):
expenseMap.forEach(({ amount, code }, category) => {
    if (amount > 0) {
        operatingExpenses.push({ category, amount, code })
    }
})
```

Update the `ProfitLossData` interface to include code:
```typescript
operatingExpenses: {
    category: string
    amount: number
    code?: string  // GL account code for drill-down
}[]
```

- [ ] **Step 5: Commit P&L drill-down**

```bash
git add app/finance/reports/page.tsx lib/actions/finance.ts
git commit -m "feat(reports): P&L inline drill-down with color-coded source badges and navigation links"
```

---

## Task 3: Frontend — Balance Sheet Drill-Down

**Files:**
- Modify: `app/finance/reports/page.tsx`

- [ ] **Step 1: Make Balance Sheet account rows clickable**

The Balance Sheet already renders individual accounts in expandable sections (currentAssets, currentLiabilities, capitalItems). Each account has `.code` and `.name`. Apply the drill-down pattern:

For each account in the lists (e.g., `currentAssets.map(...)`, `currentLiabilities.map(...)`, etc.), wrap the row with click handler:

```tsx
{currentAssets.map((acc: any) => (
    <React.Fragment key={acc.code}>
        <TableRow
            className="cursor-pointer hover:bg-orange-50/50 dark:hover:bg-orange-950/10 transition-colors group"
            onClick={() => toggleDrillDown(`bs-${acc.code}`, acc.code)}
        >
            <TableCell className="pl-12 text-sm">
                <div className="flex items-center gap-2">
                    <ChevronRight className={`h-3 w-3 text-zinc-400 transition-transform ${expandedAccounts.has(`bs-${acc.code}`) ? 'rotate-90' : ''}`} />
                    <span className="font-mono text-[10px] text-zinc-400 mr-1">{acc.code}</span>
                    {acc.name}
                </div>
            </TableCell>
            <TableCell className="text-right font-mono text-sm">{formatIDR(acc.balance)}</TableCell>
        </TableRow>
        {expandedAccounts.has(`bs-${acc.code}`) && (
            <TableRow>
                <TableCell colSpan={2} className="p-0">
                    <AnimatePresence>
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                            <DrillDownPanel
                                rows={drillDownCache.get(`bs-${acc.code}`) || []}
                                loading={drillDownLoading === `bs-${acc.code}`}
                            />
                        </motion.div>
                    </AnimatePresence>
                </TableCell>
            </TableRow>
        )}
    </React.Fragment>
))}
```

Apply to all account lists in Balance Sheet:
- `currentAssets` (Aset Lancar)
- `fixedAssets` (if rendered)
- `otherAssets` (if rendered)
- `currentLiabilities` (Kewajiban Lancar)
- `longTermLiabilities` (if rendered)
- `capitalItems` (Modal)

NOTE: For Balance Sheet, the date range is inception to asOfDate. Pass `new Date(0)` as startDate and `new Date(periodEnd)` as endDate for the drill-down fetch.

- [ ] **Step 2: Adjust toggleDrillDown for Balance Sheet context**

The `toggleDrillDown` function uses `periodStart`/`periodEnd` which is the P&L period. For Balance Sheet accounts, we want all transactions up to the asOfDate. Add a parameter:

```typescript
async function toggleDrillDown(accountKey: string, accountFilter: string, useFullHistory = false) {
    // ... existing expand/cache check ...
    const start = useFullHistory ? new Date(2020, 0, 1) : new Date(periodStart)
    const end = new Date(periodEnd)
    const rows = await getAccountDrillDown(accountFilter, start, end)
    // ... rest same
}
```

Balance Sheet calls pass `true` for `useFullHistory`:
```tsx
onClick={() => toggleDrillDown(`bs-${acc.code}`, acc.code, true)}
```

- [ ] **Step 3: Commit Balance Sheet drill-down**

```bash
git add app/finance/reports/page.tsx
git commit -m "feat(reports): Balance Sheet inline drill-down with full transaction history per account"
```

---

## Summary

| Task | What | User Impact |
|------|------|-------------|
| 1 | `getAccountDrillDown()` server action | Backend: queries journal lines with invoice/payment relations |
| 2 | P&L drill-down | Click any P&L line → see invoices, bills, payments behind the number |
| 3 | Balance Sheet drill-down | Click any BS account → see all transactions that make up the balance |
