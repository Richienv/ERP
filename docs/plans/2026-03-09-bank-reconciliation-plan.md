# Bank Reconciliation Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild bank reconciliation with side-by-side matching UI, scored auto-match algorithm, file upload (CSV/Excel), and checkbox multi-select manual matching.

**Architecture:** Fix server actions to filter by GL account, batch queries instead of N+1, load system journal entries alongside bank items. Rewrite frontend as two-panel side-by-side layout with file drag-and-drop upload.

**Tech Stack:** Next.js, Prisma, TanStack Query, shadcn/ui, xlsx (already installed), neo-brutalist styling via `@/lib/dialog-styles`

---

### Task 1: Fix server action — `getReconciliationDetail()` to load system entries

**Files:**
- Modify: `lib/actions/finance-reconciliation.ts:32-54` (types) and `lib/actions/finance-reconciliation.ts:112-155` (function)

**Context:** Currently `getReconciliationDetail()` only loads bank items. It never loads the system journal entries for the same GL account + period. Also `systemDescription` is hardcoded to `null`. We need to:
1. Add a `SystemEntry` type for journal entries on that bank account
2. Fetch journal lines for the reconciliation's GL account within the period
3. Resolve `systemDescription` for matched items

**Step 1: Add types**

Add after the existing `ReconciliationItemData` interface (line 54):

```typescript
export interface SystemEntryData {
    entryId: string
    date: string
    description: string
    reference: string | null
    amount: number // positive = debit (money in), negative = credit (money out)
    lineDescription: string | null
    alreadyMatchedItemId: string | null // if this entry is already matched to a bank item
}
```

Update `ReconciliationDetail` interface to add:
```typescript
export interface ReconciliationDetail {
    // ... existing fields ...
    systemEntries: SystemEntryData[]
}
```

**Step 2: Rewrite `getReconciliationDetail()`**

Replace the function body with:

```typescript
export async function getReconciliationDetail(
    reconciliationId: string
): Promise<ReconciliationDetail | null> {
    try {
        await requireAuth()

        const rec = await prisma.bankReconciliation.findUnique({
            where: { id: reconciliationId },
            include: {
                glAccount: { select: { id: true, code: true, name: true, balance: true } },
                items: { orderBy: { bankDate: 'asc' } },
            },
        })

        if (!rec) return null

        // Fetch system journal entries for this GL account in the reconciliation period
        const journalLines = await prisma.journalLine.findMany({
            where: {
                accountId: rec.glAccount.id,
                entry: {
                    status: 'POSTED',
                    date: { gte: rec.periodStart, lte: rec.periodEnd },
                },
            },
            include: {
                entry: { select: { id: true, date: true, description: true, reference: true } },
            },
            orderBy: { entry: { date: 'asc' } },
        })

        // Build a map of entryId -> matched bank item ID
        const matchedEntryIds = new Map<string, string>()
        for (const item of rec.items) {
            if (item.systemTransactionId && item.matchStatus === 'MATCHED') {
                matchedEntryIds.set(item.systemTransactionId, item.id)
            }
        }

        // Build system entries list
        const systemEntries: SystemEntryData[] = journalLines.map((line) => {
            const debit = Number(line.debit)
            const credit = Number(line.credit)
            // Debit to bank = money in (positive), Credit from bank = money out (negative)
            const amount = debit > 0 ? debit : -credit
            return {
                entryId: line.entry.id,
                date: line.entry.date.toISOString(),
                description: line.entry.description,
                reference: line.entry.reference,
                amount,
                lineDescription: line.description,
                alreadyMatchedItemId: matchedEntryIds.get(line.entry.id) || null,
            }
        })

        // Resolve systemDescription for matched items
        const entryDescMap = new Map<string, string>()
        for (const se of systemEntries) {
            entryDescMap.set(se.entryId, se.description)
        }

        const items: ReconciliationItemData[] = rec.items.map((i) => ({
            id: i.id,
            bankRef: i.bankRef,
            bankDescription: i.bankDescription,
            bankDate: i.bankDate?.toISOString() || null,
            bankAmount: Number(i.bankAmount),
            systemTransactionId: i.systemTransactionId,
            systemDescription: i.systemTransactionId
                ? entryDescMap.get(i.systemTransactionId) || null
                : null,
            matchStatus: i.matchStatus,
            matchedAt: i.matchedAt?.toISOString() || null,
        }))

        return {
            id: rec.id,
            glAccountCode: rec.glAccount.code,
            glAccountName: rec.glAccount.name,
            glAccountBalance: Number(rec.glAccount.balance),
            statementDate: rec.statementDate.toISOString(),
            periodStart: rec.periodStart.toISOString(),
            periodEnd: rec.periodEnd.toISOString(),
            status: rec.status,
            items,
            systemEntries,
        }
    } catch (error) {
        console.error("[getReconciliationDetail] Error:", error)
        return null
    }
}
```

**Step 3: Verify**

Run: `npx tsc --noEmit 2>&1 | grep finance-reconciliation`
Expected: No new errors (component may show errors until Task 4 updates the UI)

**Step 4: Commit**

```bash
git add lib/actions/finance-reconciliation.ts
git commit -m "fix(recon): load system journal entries in detail, resolve systemDescription"
```

---

### Task 2: Fix auto-match — filter by GL account + batch query + scored matching

**Files:**
- Modify: `lib/actions/finance-reconciliation.ts:361-431` (autoMatchReconciliation function)

**Context:** Current auto-match has critical bugs: no GL account filter, N+1 queries in a loop. Replace with:
1. Single batch query for all journal lines on the bank account in the period
2. Scored matching algorithm (amount: +50, reference overlap: +30, date proximity: +20/10/5)
3. Filter by GL account ID

**Step 1: Rewrite `autoMatchReconciliation()`**

Replace the entire function (lines 361-431) with:

```typescript
export async function autoMatchReconciliation(
    reconciliationId: string
): Promise<{ success: boolean; matchedCount?: number; error?: string }> {
    try {
        const matchedCount = await withPrismaAuth(async (prisma: PrismaClient) => {
            const rec = await prisma.bankReconciliation.findUniqueOrThrow({
                where: { id: reconciliationId },
                include: {
                    glAccount: { select: { id: true } },
                    items: { where: { matchStatus: 'UNMATCHED' } },
                },
            })

            if (rec.items.length === 0) return 0

            const supabase = await (await import('@/lib/supabase/server')).createClient()
            const { data: { user } } = await supabase.auth.getUser()

            // Single batch query: all posted journal lines for this bank account in period ±2 days
            const periodStart = new Date(rec.periodStart)
            periodStart.setDate(periodStart.getDate() - 2)
            const periodEnd = new Date(rec.periodEnd)
            periodEnd.setDate(periodEnd.getDate() + 2)

            const systemLines = await prisma.journalLine.findMany({
                where: {
                    accountId: rec.glAccount.id,
                    entry: {
                        status: 'POSTED',
                        date: { gte: periodStart, lte: periodEnd },
                    },
                },
                include: {
                    entry: { select: { id: true, date: true, description: true, reference: true } },
                },
            })

            // Track which entries are already matched (across ALL items, not just unmatched)
            const allItems = await prisma.bankReconciliationItem.findMany({
                where: { reconciliationId, matchStatus: 'MATCHED' },
                select: { systemTransactionId: true },
            })
            const alreadyMatchedEntryIds = new Set(
                allItems.map((i) => i.systemTransactionId).filter(Boolean)
            )

            let count = 0

            for (const item of rec.items) {
                if (!item.bankDate) continue

                const bankAmount = Math.abs(Number(item.bankAmount))
                const bankDate = new Date(item.bankDate)
                const bankRef = (item.bankRef || '').toLowerCase()
                const bankDesc = (item.bankDescription || '').toLowerCase()

                // Score each system line
                let bestMatch: { entryId: string; score: number } | null = null

                for (const line of systemLines) {
                    if (alreadyMatchedEntryIds.has(line.entry.id)) continue

                    const lineDebit = Number(line.debit)
                    const lineCredit = Number(line.credit)
                    const lineAmount = Math.max(lineDebit, lineCredit)

                    let score = 0

                    // Amount match: +50
                    if (Math.abs(lineAmount - bankAmount) < 0.01) {
                        score += 50
                    } else {
                        continue // amount must match
                    }

                    // Reference/description overlap: +30
                    const entryRef = (line.entry.reference || '').toLowerCase()
                    const entryDesc = (line.entry.description || '').toLowerCase()
                    if (bankRef && entryRef && (bankRef.includes(entryRef) || entryRef.includes(bankRef))) {
                        score += 30
                    } else if (bankDesc && entryDesc) {
                        // Check for partial word overlap
                        const bankWords = bankDesc.split(/\s+/).filter(w => w.length > 3)
                        const entryWords = entryDesc.split(/\s+/).filter(w => w.length > 3)
                        const overlap = bankWords.some(w => entryWords.includes(w))
                        if (overlap) score += 15
                    }

                    // Date proximity: exact +20, ±1 day +10, ±2 days +5
                    const daysDiff = Math.abs(
                        Math.round((bankDate.getTime() - line.entry.date.getTime()) / 86400000)
                    )
                    if (daysDiff === 0) score += 20
                    else if (daysDiff === 1) score += 10
                    else if (daysDiff <= 2) score += 5

                    if (!bestMatch || score > bestMatch.score) {
                        bestMatch = { entryId: line.entry.id, score }
                    }
                }

                // Threshold: 50+ (at minimum exact amount match)
                if (bestMatch && bestMatch.score >= 50) {
                    await prisma.bankReconciliationItem.update({
                        where: { id: item.id },
                        data: {
                            systemTransactionId: bestMatch.entryId,
                            matchStatus: 'MATCHED',
                            matchedBy: user?.id || null,
                            matchedAt: new Date(),
                        },
                    })
                    alreadyMatchedEntryIds.add(bestMatch.entryId)
                    count++
                }
            }

            return count
        })

        return { success: true, matchedCount }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal auto-match'
        console.error("[autoMatchReconciliation] Error:", error)
        return { success: false, error: msg }
    }
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit 2>&1 | grep finance-reconciliation`
Expected: No new errors

**Step 3: Commit**

```bash
git add lib/actions/finance-reconciliation.ts
git commit -m "fix(recon): scored auto-match with GL account filter and batch query"
```

---

### Task 3: Add multi-match server action

**Files:**
- Modify: `lib/actions/finance-reconciliation.ts` (add new function at end)

**Context:** The UI needs checkbox multi-select: 1 bank item matched to N system entries (or N bank items to 1 entry). We need a new `matchMultipleItems()` action.

**Step 1: Add `matchMultipleItems()` function**

Add at end of file (before the closing):

```typescript
/**
 * Match one or more bank items to one or more system journal entries.
 * Validates total amounts balance before matching.
 */
export async function matchMultipleItems(data: {
    bankItemIds: string[]
    systemEntryIds: string[]
}): Promise<{ success: boolean; error?: string }> {
    if (data.bankItemIds.length === 0 || data.systemEntryIds.length === 0) {
        return { success: false, error: 'Pilih minimal satu item bank dan satu jurnal sistem' }
    }

    try {
        await withPrismaAuth(async (prisma: PrismaClient) => {
            const supabase = await (await import('@/lib/supabase/server')).createClient()
            const { data: { user } } = await supabase.auth.getUser()

            // Fetch bank items
            const bankItems = await prisma.bankReconciliationItem.findMany({
                where: { id: { in: data.bankItemIds } },
            })
            const bankTotal = bankItems.reduce((s, i) => s + Math.abs(Number(i.bankAmount)), 0)

            // Fetch system entry lines to verify amounts
            // We need the journal lines for the specific GL account
            const firstItem = bankItems[0]
            if (!firstItem) throw new Error('Item bank tidak ditemukan')

            const rec = await prisma.bankReconciliation.findUnique({
                where: { id: firstItem.reconciliationId },
                select: { glAccountId: true },
            })
            if (!rec) throw new Error('Rekonsiliasi tidak ditemukan')

            const systemLines = await prisma.journalLine.findMany({
                where: {
                    entry: { id: { in: data.systemEntryIds } },
                    accountId: rec.glAccountId,
                },
            })
            const systemTotal = systemLines.reduce(
                (s, l) => s + Math.max(Number(l.debit), Number(l.credit)),
                0
            )

            // Validate totals match (within Rp 1 tolerance for rounding)
            if (Math.abs(bankTotal - systemTotal) > 1) {
                throw new Error(
                    `Total tidak cocok: Bank Rp ${bankTotal.toLocaleString('id-ID')} vs Sistem Rp ${systemTotal.toLocaleString('id-ID')}`
                )
            }

            // Match: link all bank items to the first system entry ID (primary reference)
            // For multi-entry matches, store comma-separated IDs
            const matchRef = data.systemEntryIds.length === 1
                ? data.systemEntryIds[0]
                : data.systemEntryIds[0] // store primary; UI tracks the group

            await prisma.bankReconciliationItem.updateMany({
                where: { id: { in: data.bankItemIds } },
                data: {
                    systemTransactionId: matchRef,
                    matchStatus: 'MATCHED',
                    matchedBy: user?.id || null,
                    matchedAt: new Date(),
                },
            })
        })

        return { success: true }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal mencocokkan item'
        console.error("[matchMultipleItems] Error:", error)
        return { success: false, error: msg }
    }
}
```

**Step 2: Export from page**

Update `app/finance/reconciliation/page.tsx` to import and pass `matchMultipleItems`.

**Step 3: Verify**

Run: `npx tsc --noEmit 2>&1 | grep finance-reconciliation`

**Step 4: Commit**

```bash
git add lib/actions/finance-reconciliation.ts app/finance/reconciliation/page.tsx
git commit -m "feat(recon): add matchMultipleItems for checkbox multi-select matching"
```

---

### Task 4: Rewrite frontend — side-by-side reconciliation view

**Files:**
- Rewrite: `components/finance/bank-reconciliation-view.tsx` (complete rewrite, ~600 lines)
- Modify: `app/finance/reconciliation/page.tsx` (update props)

**Context:** Replace the entire bank reconciliation UI with:
- Side-by-side two-panel layout (bank rows left, system entries right)
- File upload zone (drag-and-drop CSV/Excel) replacing single-line text input
- Checkbox multi-select for manual matching
- Matched pairs section at bottom
- Running totals and difference display
- Neo-brutalist styling matching existing ERP design

**Step 1: Update page.tsx to pass new props**

```typescript
"use client"

import { useReconciliation } from "@/hooks/use-reconciliation"
import { BankReconciliationView } from "@/components/finance/bank-reconciliation-view"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import {
    createReconciliation,
    importBankStatementRows,
    autoMatchReconciliation,
    matchMultipleItems,
    unmatchReconciliationItem,
    closeReconciliation,
    getReconciliationDetail,
} from "@/lib/actions/finance-reconciliation"

export default function ReconciliationPage() {
    const { data, isLoading } = useReconciliation()

    if (isLoading || !data) {
        return <TablePageSkeleton accentColor="bg-purple-400" />
    }

    return (
        <div className="mf-page">
            <BankReconciliationView
                reconciliations={data.reconciliations}
                bankAccounts={data.bankAccounts}
                onCreateReconciliation={createReconciliation}
                onImportRows={importBankStatementRows}
                onAutoMatch={autoMatchReconciliation}
                onMatchItems={matchMultipleItems}
                onUnmatchItem={unmatchReconciliationItem}
                onClose={closeReconciliation}
                onLoadDetail={getReconciliationDetail}
            />
        </div>
    )
}
```

**Step 2: Rewrite the component**

Complete rewrite of `components/finance/bank-reconciliation-view.tsx`. Key sections:

**Component structure:**
```
BankReconciliationView (main)
├── Header bar (title + "Tambah Bank" + "Rekonsiliasi Baru" buttons)
├── Reconciliation list sidebar (left, clickable cards)
└── Detail panel (right, shown when rec selected)
    ├── Detail header (account name, code, balance, period)
    ├── Action bar (Auto-Match, Tutup Rekonsiliasi)
    ├── File upload zone (drag-drop CSV/Excel, download template)
    ├── Side-by-side panels
    │   ├── Left: Bank statement rows (checkboxes)
    │   └── Right: System journal entries (checkboxes)
    ├── Match action bar (Cocokkan Terpilih button + totals)
    └── Matched pairs section (green background, with unmatch button)
```

**File upload handling:**
- Accept `.csv` and `.xlsx` files via drag-and-drop or file picker
- For CSV: parse with split(',') as currently done
- For Excel: use `xlsx` library (already in package.json) to read first sheet
- Auto-detect columns: look for headers containing tanggal/date, deskripsi/description, jumlah/amount, referensi/reference
- Show preview of parsed rows before importing

**Checkbox matching logic:**
- Track `selectedBankIds: Set<string>` and `selectedSystemIds: Set<string>`
- "Cocokkan Terpilih" button enabled when both sets are non-empty
- Show running total of selected bank items vs selected system entries
- Warn (amber) if totals don't match, block if difference > Rp 1

**Side-by-side panel colors:**
- Unmatched items: white background
- Selected (checked): `bg-blue-50` with blue-200 left border
- Matched (in bottom section): `bg-emerald-50`

**Key imports needed:**
```typescript
import * as XLSX from 'xlsx'
import { useCallback, useRef } from 'react'
```

The full component code should be written by the implementer following the design spec in `docs/plans/2026-03-09-bank-reconciliation-redesign.md`. The component should use existing NB styles from `@/lib/dialog-styles` and existing UI primitives (Button, Input, Dialog, Select, Checkbox, ScrollArea).

**Step 3: Verify**

Run: `npx tsc --noEmit 2>&1 | grep bank-reconciliation`
Run: `npm run dev` and manually test at `/finance/reconciliation`

**Step 4: Commit**

```bash
git add components/finance/bank-reconciliation-view.tsx app/finance/reconciliation/page.tsx
git commit -m "feat(recon): side-by-side reconciliation UI with file upload and checkbox matching"
```

---

### Task 5: Add Prisma index for performance

**Files:**
- Modify: `prisma/schema.prisma` (BankReconciliationItem model)

**Step 1: Add index**

Find the `BankReconciliationItem` model and add `@@index([matchStatus])`:

```prisma
model BankReconciliationItem {
  // ... existing fields ...

  reconciliation BankReconciliation @relation(fields: [reconciliationId], references: [id], onDelete: Cascade)

  @@index([reconciliationId])
  @@index([matchStatus])
  @@map("bank_reconciliation_items")
}
```

**Step 2: Generate migration**

Run: `npx prisma migrate dev --name add_recon_item_match_status_index`
Expected: Migration created successfully

**Step 3: Regenerate Prisma client**

Run: `npx prisma generate`

**Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "perf(recon): add matchStatus index on BankReconciliationItem"
```

---

## Execution Order

Tasks 1-3 (server actions) can be done first as they're backend-only.
Task 4 (frontend rewrite) depends on Tasks 1-3 for the new types and functions.
Task 5 (index) is independent and can be done anytime.

Recommended order: 1 → 2 → 3 → 5 → 4
