# Bank Reconciliation Full Overhaul — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current queue-based bank reconciliation UI with a full 4-layer grouped view (COCOK/POTENSI/HAMPIR/BELUM), add confirm/reject/ignore actions with GL journal reconciliation stamps, and surface warnings on financial reports for unreconciled bank entries.

**Architecture:** The existing 3-tier matching engine (AUTO/POTENTIAL/MANUAL) stays intact but the UI maps scores to 4 display layers. New `CONFIRMED`/`IGNORED` values are added to the `MatchStatus` enum. JournalEntry gets reconciliation stamp fields. A new `UnreconciledWarning` component is wired into the financial reports page.

**Tech Stack:** Prisma migration (PostgreSQL enum + columns), React server actions, TanStack Query cache invalidation, shadcn/ui components, NB design system.

---

## File Map (all files touched by this plan)

| File | Action | Purpose |
|------|--------|---------|
| `prisma/schema.prisma` | Modify | Add stamp fields to JournalEntry, add CONFIRMED/IGNORED to MatchStatus |
| `lib/finance-reconciliation-helpers.ts` | Modify | Fix 99%→100% score rounding, add 4-layer classification helper |
| `lib/reconciliation-match-client.ts` | Modify | Export 4-layer types, update tier mapping |
| `lib/actions/finance-reconciliation.ts` | Modify | Add confirm/reject/ignore server actions, update bulkConfirm |
| `components/finance/reconciliation-focus-view.tsx` | Modify | Overhaul QueueSidebar → grouped list, add filter tabs, action buttons |
| `components/finance/unreconciled-warning.tsx` | Create | Warning banner component |
| `app/finance/reports/page.tsx` | Modify | Wire unreconciled warning |
| `lib/actions/finance-reports.ts` | Modify | Add `getUnreconciledBankEntries()` query |
| `__tests__/bank-reconciliation-matching.test.ts` | Modify | Add tests for 4-layer scoring, 99% fix |
| `__tests__/bank-reconciliation-actions.test.ts` | Create | Tests for confirm/reject/ignore actions |

---

## Phase 1 — Schema & Bug Fix

### Task 1: Add reconciliation stamp fields to JournalEntry model

**Files:**
- Modify: `prisma/schema.prisma` (JournalEntry model, ~line 60-100)

**Step 1: Add fields to JournalEntry model**

In `prisma/schema.prisma`, find the `JournalEntry` model (search for `model JournalEntry`). Add these fields BEFORE the `createdAt` line:

```prisma
  // Reconciliation stamp — written when bank recon item is CONFIRMED
  isReconciled        Boolean   @default(false)
  reconciledAt        DateTime?
  reconciledBy        String?   @db.Uuid
  reconciliationId    String?   @db.Uuid  // reference to BankReconciliation session
  bankItemRef         String?              // bank statement reference string
```

**Step 2: Add CONFIRMED and IGNORED to MatchStatus enum**

Find the `MatchStatus` enum in `prisma/schema.prisma`. Add two new values:

```prisma
enum MatchStatus {
  UNMATCHED  // Belum Cocok
  MATCHED    // Cocok
  PARTIAL    // Sebagian Cocok
  EXCLUDED   // DEPRECATED
  CONFIRMED  // Dikonfirmasi oleh user
  IGNORED    // Diabaikan (no GL match, known exception)
}
```

**Step 3: Add index for reconciliation queries**

Add an index to JournalEntry for fast unreconciled lookups:

```prisma
  @@index([isReconciled])
```

Add this inside the JournalEntry model, next to the existing `@@index([date])`.

---

### Task 2: Run Prisma migration

**Step 1: Run migration**

```bash
cd "/Volumes/Extreme SSD/new-erp-feb/ERP"
npx prisma migrate dev --name add_reconciliation_stamp_and_confirm_status
```

Expected: Migration succeeds. New columns added to `journal_entries` table, new enum values added to `MatchStatus`.

**Step 2: Regenerate client**

```bash
npx prisma generate
```

Expected: Prisma client regenerated with new fields and enum values.

---

### Task 3: Fix 99% → 100% score rounding bug

**Files:**
- Modify: `lib/finance-reconciliation-helpers.ts:432`

**Step 1: Write failing test**

In `__tests__/bank-reconciliation-matching.test.ts`, add:

```typescript
it("should round 99% score to 100% (sub-rupiah rounding artifact)", () => {
  // Perfect match except sub-rupiah amount diff
  const bank: BankLine = {
    id: "test-99",
    bankDate: new Date("2026-03-15"),
    bankAmount: 1000000.50,
    bankDescription: "PT NICHOLAS PEMBAYARAN INV-001",
    bankRef: "INV-001",
  }
  const txn: SystemTransaction = {
    id: "gl-99",
    date: new Date("2026-03-15"),
    amount: 1000000.00,
    description: "Pembayaran INV-001 PT Nicholas",
    reference: "INV-001",
  }
  const result = computeMatchScore(bank, txn)
  // Sub-rupiah diff + exact ref + exact date + good desc → should be 100, not 99
  expect(result.score).toBeGreaterThanOrEqual(95)
  // If score would round to 99, it should be forced to 100
  if (result.score >= 99) {
    expect(result.score).toBe(100)
  }
})
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run __tests__/bank-reconciliation-matching.test.ts
```

Expected: FAIL — score is 99, not 100.

**Step 3: Fix the score computation**

In `lib/finance-reconciliation-helpers.ts`, find line 432:

```typescript
// BEFORE:
const score = Math.min(100, Math.round(Math.min(1.0, rawScore) * 100))

// AFTER:
let score = Math.min(100, Math.round(Math.min(1.0, rawScore) * 100))
// Fix: 99% is a rounding artifact from sub-rupiah amount diffs — force to 100
if (score >= 99) score = 100
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run __tests__/bank-reconciliation-matching.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add lib/finance-reconciliation-helpers.ts __tests__/bank-reconciliation-matching.test.ts
git commit -m "fix(recon): force 99% match score to 100% — sub-rupiah rounding artifact"
```

---

## Phase 2 — 4-Layer Status & Confirm/Reject Backend

### Task 4: Add 4-layer classification types and helper

**Files:**
- Modify: `lib/finance-reconciliation-helpers.ts` (add new types + helper at ~line 37)
- Modify: `lib/reconciliation-match-client.ts` (export new types)

**Step 1: Add 4-layer type and classifier to helpers**

In `lib/finance-reconciliation-helpers.ts`, after the existing `MatchTier` type (line 37), add:

```typescript
/** 4-layer display classification for bank recon UI */
export type ReconLayer = "COCOK" | "POTENSI" | "HAMPIR" | "BELUM"

/** Classify a match score into one of 4 display layers */
export function scoreToLayer(score: number | null | undefined): ReconLayer {
  if (score == null || score < 40) return "BELUM"
  if (score < 70) return "HAMPIR"
  if (score < 95) return "POTENSI"
  return "COCOK"
}
```

**Step 2: Export from client adapter**

In `lib/reconciliation-match-client.ts`, add re-export at the top imports section:

```typescript
export { scoreToLayer, type ReconLayer } from "./finance-reconciliation-helpers"
```

**Step 3: Write test for layer classification**

In `__tests__/bank-reconciliation-matching.test.ts`, add:

```typescript
import { scoreToLayer } from "@/lib/finance-reconciliation-helpers"

describe("scoreToLayer — 4-layer classification", () => {
  it("COCOK for score >= 95", () => {
    expect(scoreToLayer(95)).toBe("COCOK")
    expect(scoreToLayer(100)).toBe("COCOK")
  })
  it("POTENSI for score 70-94", () => {
    expect(scoreToLayer(70)).toBe("POTENSI")
    expect(scoreToLayer(94)).toBe("POTENSI")
  })
  it("HAMPIR for score 40-69", () => {
    expect(scoreToLayer(40)).toBe("HAMPIR")
    expect(scoreToLayer(69)).toBe("HAMPIR")
  })
  it("BELUM for score < 40 or null", () => {
    expect(scoreToLayer(39)).toBe("BELUM")
    expect(scoreToLayer(0)).toBe("BELUM")
    expect(scoreToLayer(null)).toBe("BELUM")
    expect(scoreToLayer(undefined)).toBe("BELUM")
  })
})
```

**Step 4: Run tests**

```bash
npx vitest run __tests__/bank-reconciliation-matching.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add lib/finance-reconciliation-helpers.ts lib/reconciliation-match-client.ts __tests__/bank-reconciliation-matching.test.ts
git commit -m "feat(recon): add 4-layer classification (COCOK/POTENSI/HAMPIR/BELUM)"
```

---

### Task 5: Create confirm server action

**Files:**
- Modify: `lib/actions/finance-reconciliation.ts` (add after `bulkConfirmAutoMatches`, ~line 975)

**Step 1: Write the `confirmReconciliationItem` action**

Add to `lib/actions/finance-reconciliation.ts`:

```typescript
/**
 * Confirm a matched bank reconciliation item.
 * - Sets matchStatus to CONFIRMED
 * - Writes reconciliation stamp on the matched JournalEntry
 */
export async function confirmReconciliationItem(
    itemId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        await withPrismaAuth(async (prisma: PrismaClient) => {
            const supabase = await (await import('@/lib/supabase/server')).createClient()
            const { data: { user } } = await supabase.auth.getUser()

            const item = await prisma.bankReconciliationItem.findUnique({
                where: { id: itemId },
                include: { reconciliation: true },
            })
            if (!item) throw new Error('Item tidak ditemukan')
            if (item.matchStatus !== 'MATCHED') {
                throw new Error('Item harus berstatus MATCHED untuk dikonfirmasi')
            }
            if (!item.systemTransactionId) {
                throw new Error('Item belum dipasangkan dengan transaksi sistem')
            }

            // Update item status to CONFIRMED
            await prisma.bankReconciliationItem.update({
                where: { id: itemId },
                data: {
                    matchStatus: 'CONFIRMED',
                    matchedBy: user?.id ?? null,
                    matchedAt: new Date(),
                },
            })

            // Write reconciliation stamp on matched JournalEntry
            await prisma.journalEntry.update({
                where: { id: item.systemTransactionId },
                data: {
                    isReconciled: true,
                    reconciledAt: new Date(),
                    reconciledBy: user?.id ?? null,
                    reconciliationId: item.reconciliationId,
                    bankItemRef: item.bankRef,
                },
            })
        })
        return { success: true }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal konfirmasi item'
        console.error("[confirmReconciliationItem] Error:", error)
        return { success: false, error: msg }
    }
}
```

---

### Task 6: Create reject server action

**Files:**
- Modify: `lib/actions/finance-reconciliation.ts`

**Step 1: Write the `rejectReconciliationItem` action**

Add after `confirmReconciliationItem`:

```typescript
/**
 * Reject a matched bank reconciliation item.
 * - Clears the matched journal link
 * - Removes reconciliation stamp from JournalEntry
 * - Sets matchStatus back to UNMATCHED
 */
export async function rejectReconciliationItem(
    itemId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        await withPrismaAuth(async (prisma: PrismaClient) => {
            const item = await prisma.bankReconciliationItem.findUnique({
                where: { id: itemId },
            })
            if (!item) throw new Error('Item tidak ditemukan')
            if (item.matchStatus !== 'MATCHED' && item.matchStatus !== 'CONFIRMED') {
                throw new Error('Item harus berstatus MATCHED atau CONFIRMED untuk ditolak')
            }

            // Remove stamp from JournalEntry if linked
            if (item.systemTransactionId) {
                await prisma.journalEntry.update({
                    where: { id: item.systemTransactionId },
                    data: {
                        isReconciled: false,
                        reconciledAt: null,
                        reconciledBy: null,
                        reconciliationId: null,
                        bankItemRef: null,
                    },
                })
            }

            // Reset item to UNMATCHED
            await prisma.bankReconciliationItem.update({
                where: { id: itemId },
                data: {
                    matchStatus: 'UNMATCHED',
                    systemTransactionId: null,
                    matchedBy: null,
                    matchedAt: null,
                    matchTier: null,
                    matchScore: null,
                    matchAmountDiff: null,
                    matchNameSimilarity: null,
                    matchDaysDiff: null,
                },
            })
        })
        return { success: true }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal menolak match'
        console.error("[rejectReconciliationItem] Error:", error)
        return { success: false, error: msg }
    }
}
```

---

### Task 7: Create ignore server action

**Files:**
- Modify: `lib/actions/finance-reconciliation.ts`

**Step 1: Write the `ignoreReconciliationItem` action**

```typescript
/**
 * Ignore a bank reconciliation item (no GL match, known exception).
 * Does NOT write a journal stamp — this is a deliberate skip.
 */
export async function ignoreReconciliationItem(
    itemId: string,
    reason?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        await withPrismaAuth(async (prisma: PrismaClient) => {
            const item = await prisma.bankReconciliationItem.findUnique({
                where: { id: itemId },
            })
            if (!item) throw new Error('Item tidak ditemukan')
            if (item.matchStatus === 'CONFIRMED') {
                throw new Error('Item sudah dikonfirmasi — tolak dulu sebelum mengabaikan')
            }

            await prisma.bankReconciliationItem.update({
                where: { id: itemId },
                data: {
                    matchStatus: 'IGNORED',
                    excludeReason: reason || null,
                },
            })
        })
        return { success: true }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal mengabaikan item'
        console.error("[ignoreReconciliationItem] Error:", error)
        return { success: false, error: msg }
    }
}
```

---

### Task 8: Update bulkConfirmAutoMatches to write stamps

**Files:**
- Modify: `lib/actions/finance-reconciliation.ts:953-975`

**Step 1: Replace the existing `bulkConfirmAutoMatches` function**

The current implementation is a no-op — it finds AUTO items but doesn't actually confirm them. Replace it with:

```typescript
/**
 * Bulk confirm all COCOK-tier matched items (score >= 95).
 * Writes reconciliation stamp on each matched JournalEntry.
 */
export async function bulkConfirmCocokItems(
    reconciliationId: string
): Promise<{ success: boolean; confirmed?: number; error?: string }> {
    try {
        const result = await withPrismaAuth(async (prisma: PrismaClient) => {
            const supabase = await (await import('@/lib/supabase/server')).createClient()
            const { data: { user } } = await supabase.auth.getUser()

            // Find all matched items with score >= 95 that haven't been confirmed yet
            const cocokItems = await prisma.bankReconciliationItem.findMany({
                where: {
                    reconciliationId,
                    matchStatus: 'MATCHED',
                    matchScore: { gte: 95 },
                    systemTransactionId: { not: null },
                },
            })

            if (cocokItems.length === 0) return { confirmed: 0 }

            const now = new Date()

            // Batch update items to CONFIRMED
            await prisma.bankReconciliationItem.updateMany({
                where: {
                    id: { in: cocokItems.map(i => i.id) },
                },
                data: {
                    matchStatus: 'CONFIRMED',
                    matchedBy: user?.id ?? null,
                    matchedAt: now,
                },
            })

            // Write stamp on each matched JournalEntry
            const journalIds = cocokItems
                .map(i => i.systemTransactionId)
                .filter((id): id is string => id !== null)

            if (journalIds.length > 0) {
                await prisma.journalEntry.updateMany({
                    where: { id: { in: journalIds } },
                    data: {
                        isReconciled: true,
                        reconciledAt: now,
                        reconciledBy: user?.id ?? null,
                        reconciliationId,
                    },
                })
            }

            return { confirmed: cocokItems.length }
        })

        return { success: true, confirmed: result.confirmed }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal konfirmasi bulk'
        console.error("[bulkConfirmCocokItems] Error:", error)
        return { success: false, error: msg }
    }
}
```

**Important:** Keep the old `bulkConfirmAutoMatches` function as a deprecated alias that calls `bulkConfirmCocokItems`, since it may be referenced elsewhere:

```typescript
/** @deprecated Use bulkConfirmCocokItems instead */
export const bulkConfirmAutoMatches = bulkConfirmCocokItems
```

**Step 2: Commit**

```bash
git add lib/actions/finance-reconciliation.ts prisma/schema.prisma
git commit -m "feat(recon): confirm/reject/ignore server actions + reconciliation stamp"
```

---

## Phase 3 — New Full-View UI

### Task 9: Add 4-layer UI constants and item classifier

**Files:**
- Modify: `components/finance/reconciliation-focus-view.tsx` (~line 107-133)

**Step 1: Replace QUEUE_CONFIG and TIER_CONFIG with 4-layer system**

Replace the `QueueStatus` type, `getQueueStatus` function, `QUEUE_CONFIG`, and `TIER_CONFIG` (lines 107-133) with:

```typescript
// 4-Layer display classification
type ReconDisplayLayer = "COCOK" | "POTENSI" | "HAMPIR" | "BELUM" | "CONFIRMED" | "IGNORED"

function getItemDisplayLayer(item: ReconciliationItemData): ReconDisplayLayer {
    // Terminal states first
    if (item.matchStatus === "CONFIRMED") return "CONFIRMED"
    if (item.matchStatus === "IGNORED") return "IGNORED"
    // Matched items — classify by score
    if (item.matchStatus === "MATCHED") {
        const score = item.matchScore ?? 0
        if (score >= 95) return "COCOK"
        if (score >= 70) return "POTENSI"
        if (score >= 40) return "HAMPIR"
        return "BELUM"  // Matched but low score — shouldn't happen normally
    }
    // Unmatched — always BELUM
    return "BELUM"
}

const LAYER_CONFIG: Record<ReconDisplayLayer, {
    icon: typeof CheckCircle2
    bg: string
    text: string
    border: string
    label: string
    headerIcon: string
    headerBg: string
}> = {
    COCOK: {
        icon: CircleCheck,
        bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-300",
        label: "COCOK",
        headerIcon: "✅", headerBg: "bg-emerald-50",
    },
    POTENSI: {
        icon: CircleDot,
        bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-300",
        label: "POTENSI",
        headerIcon: "⚡", headerBg: "bg-amber-50",
    },
    HAMPIR: {
        icon: AlertCircle,
        bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-300",
        label: "HAMPIR",
        headerIcon: "⚠️", headerBg: "bg-orange-50",
    },
    BELUM: {
        icon: Circle,
        bg: "bg-zinc-50", text: "text-zinc-500", border: "border-zinc-200",
        label: "BELUM",
        headerIcon: "❌", headerBg: "bg-zinc-50",
    },
    CONFIRMED: {
        icon: CheckCircle2,
        bg: "bg-emerald-100", text: "text-emerald-800", border: "border-emerald-400",
        label: "DIKONFIRMASI",
        headerIcon: "✓", headerBg: "bg-emerald-100",
    },
    IGNORED: {
        icon: X,
        bg: "bg-zinc-100", text: "text-zinc-500", border: "border-zinc-300",
        label: "DIABAIKAN",
        headerIcon: "—", headerBg: "bg-zinc-100",
    },
}

// Filter tab type — SEMUA plus the 4 main layers
type FilterTab = "SEMUA" | "COCOK" | "POTENSI" | "HAMPIR" | "BELUM"
```

---

### Task 10: Refactor QueueSidebar into grouped 4-layer list

**Files:**
- Modify: `components/finance/reconciliation-focus-view.tsx` (QueueSidebar function, line 388-459)

**Step 1: Rewrite QueueSidebar with grouped sections and filter tabs**

Replace the entire `QueueSidebar` function with a new implementation that:

1. Groups items by their display layer (COCOK/POTENSI/HAMPIR/BELUM + CONFIRMED/IGNORED)
2. Shows filter tabs at top: SEMUA | COCOK | POTENSI | HAMPIR | BELUM
3. Shows section headers with counts and group actions
4. Each item shows contextual action buttons

```typescript
function QueueSidebar({
    items,
    currentIndex,
    onSelect,
    activeFilter,
    onFilterChange,
    onConfirmItem,
    onRejectItem,
    onIgnoreItem,
    onBulkConfirmCocok,
    actionLoading,
    isCompleted,
}: {
    items: ReconciliationItemData[]
    currentIndex: number
    onSelect: (index: number) => void
    activeFilter: FilterTab
    onFilterChange: (tab: FilterTab) => void
    onConfirmItem: (itemId: string) => Promise<void>
    onRejectItem: (itemId: string) => Promise<void>
    onIgnoreItem: (itemId: string) => Promise<void>
    onBulkConfirmCocok: () => Promise<void>
    actionLoading: string | null
    isCompleted: boolean
}) {
    // Classify all items
    const classified = useMemo(() => {
        const groups: Record<ReconDisplayLayer, { item: ReconciliationItemData; originalIndex: number }[]> = {
            CONFIRMED: [], COCOK: [], POTENSI: [], HAMPIR: [], BELUM: [], IGNORED: [],
        }
        items.forEach((item, idx) => {
            const layer = getItemDisplayLayer(item)
            groups[layer].push({ item, originalIndex: idx })
        })
        return groups
    }, [items])

    // Tab counts
    const tabCounts = useMemo(() => ({
        SEMUA: items.length,
        COCOK: classified.COCOK.length,
        POTENSI: classified.POTENSI.length,
        HAMPIR: classified.HAMPIR.length,
        BELUM: classified.BELUM.length,
    }), [items.length, classified])

    // Filter items based on active tab
    const displayOrder: ReconDisplayLayer[] = ["CONFIRMED", "COCOK", "POTENSI", "HAMPIR", "BELUM", "IGNORED"]
    const filteredGroups = useMemo(() => {
        if (activeFilter === "SEMUA") return displayOrder.filter(l => classified[l].length > 0)
        // Show CONFIRMED/IGNORED always + the selected layer
        return displayOrder.filter(l => {
            if (l === "CONFIRMED" || l === "IGNORED") return classified[l].length > 0
            if (l === activeFilter) return classified[l].length > 0
            return false
        })
    }, [activeFilter, classified])

    // Progress
    const confirmedCount = classified.CONFIRMED.length + classified.IGNORED.length
    const totalCount = items.length

    return (
        <div className="w-[300px] shrink-0 border-r border-zinc-200 dark:border-zinc-700 flex flex-col bg-zinc-50/50 dark:bg-zinc-900/50">
            {/* Header + progress */}
            <div className="px-3.5 py-2.5 border-b border-zinc-200 dark:border-zinc-700">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        Rekonsiliasi
                    </span>
                    <span className="text-[10px] font-mono font-bold text-zinc-400">
                        {confirmedCount}/{totalCount}
                    </span>
                </div>
                {/* Progress bar */}
                <div className="h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-emerald-500 transition-all duration-300"
                        style={{ width: `${totalCount > 0 ? (confirmedCount / totalCount) * 100 : 0}%` }}
                    />
                </div>
            </div>

            {/* Filter tabs */}
            <div className="px-2 py-1.5 border-b border-zinc-200 dark:border-zinc-700 flex gap-0.5 overflow-x-auto">
                {(["SEMUA", "COCOK", "POTENSI", "HAMPIR", "BELUM"] as FilterTab[]).map(tab => (
                    <button
                        key={tab}
                        onClick={() => onFilterChange(tab)}
                        className={`px-2 py-1 text-[8px] font-black uppercase tracking-wider whitespace-nowrap border transition-colors ${
                            activeFilter === tab
                                ? "bg-zinc-900 text-white border-zinc-900"
                                : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400"
                        }`}
                    >
                        {tab} {tabCounts[tab]}
                    </button>
                ))}
            </div>

            {/* Grouped item list */}
            <ScrollArea className="flex-1">
                <div className="p-1.5 space-y-2">
                    {filteredGroups.map(layer => {
                        const groupItems = classified[layer]
                        if (groupItems.length === 0) return null
                        const layerCfg = LAYER_CONFIG[layer]

                        return (
                            <div key={layer}>
                                {/* Section header */}
                                <div className={`flex items-center justify-between px-2 py-1.5 ${layerCfg.headerBg} border-b border-zinc-200`}>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs">{layerCfg.headerIcon}</span>
                                        <span className={`text-[9px] font-black uppercase tracking-wider ${layerCfg.text}`}>
                                            {layerCfg.label} ({groupItems.length})
                                        </span>
                                    </div>
                                    {/* Bulk confirm for COCOK */}
                                    {layer === "COCOK" && groupItems.length > 0 && !isCompleted && (
                                        <button
                                            onClick={onBulkConfirmCocok}
                                            disabled={!!actionLoading}
                                            className="text-[7px] font-bold uppercase px-1.5 py-0.5 bg-emerald-600 text-white border border-emerald-700 hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                                        >
                                            {actionLoading === "bulk-confirm" ? "..." : "Konfirmasi Semua"}
                                        </button>
                                    )}
                                </div>

                                {/* Items */}
                                <div className="space-y-0.5">
                                    {groupItems.map(({ item, originalIndex }) => {
                                        const isActive = originalIndex === currentIndex
                                        return (
                                            <QueueItemRow
                                                key={item.id}
                                                item={item}
                                                layer={layer}
                                                isActive={isActive}
                                                onSelect={() => onSelect(originalIndex)}
                                                onConfirm={
                                                    (layer === "COCOK" || layer === "POTENSI") && !isCompleted
                                                        ? () => onConfirmItem(item.id)
                                                        : undefined
                                                }
                                                onReject={
                                                    (layer === "COCOK" || layer === "POTENSI" || layer === "CONFIRMED") && !isCompleted
                                                        ? () => onRejectItem(item.id)
                                                        : undefined
                                                }
                                                onIgnore={
                                                    layer === "BELUM" && !isCompleted
                                                        ? () => onIgnoreItem(item.id)
                                                        : undefined
                                                }
                                                actionLoading={actionLoading}
                                            />
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </ScrollArea>
        </div>
    )
}
```

---

### Task 11: Create QueueItemRow component with per-item actions

**Files:**
- Modify: `components/finance/reconciliation-focus-view.tsx` (add before QueueSidebar)

**Step 1: Write the QueueItemRow sub-component**

```typescript
function QueueItemRow({
    item,
    layer,
    isActive,
    onSelect,
    onConfirm,
    onReject,
    onIgnore,
    actionLoading,
}: {
    item: ReconciliationItemData
    layer: ReconDisplayLayer
    isActive: boolean
    onSelect: () => void
    onConfirm?: () => void
    onReject?: () => void
    onIgnore?: () => void
    actionLoading: string | null
}) {
    const cfg = LAYER_CONFIG[layer]
    const Icon = cfg.icon
    const isLoading = actionLoading === item.id

    return (
        <div
            className={`relative text-left px-3 py-2 transition-all duration-100 group ${
                isActive
                    ? `${cfg.bg} border ${cfg.border} shadow-sm`
                    : `border border-transparent hover:bg-white dark:hover:bg-zinc-800 hover:border-zinc-200`
            }`}
        >
            {/* Active indicator */}
            {isActive && (
                <div className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-orange-500 rounded-r" />
            )}

            {/* Clickable area */}
            <button onClick={onSelect} className="w-full text-left flex items-center gap-2.5">
                <Icon className={`h-3.5 w-3.5 shrink-0 ${cfg.text}`} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1.5">
                        <span className={`text-[11px] font-medium truncate ${
                            layer === "CONFIRMED" ? "text-zinc-500 line-through" :
                            layer === "IGNORED" ? "text-zinc-400 italic" :
                            isActive ? "text-zinc-900 font-bold" :
                            "text-zinc-700"
                        }`}>
                            {item.bankDescription || item.bankRef || "-"}
                        </span>
                    </div>
                    <div className="flex items-center justify-between gap-1 mt-0.5">
                        <span className={`text-[9px] font-mono ${
                            item.bankAmount >= 0 ? "text-emerald-600" : "text-red-500"
                        }`}>
                            <span className="text-[7px]">{item.bankAmount >= 0 ? "\u25B2" : "\u25BC"}</span>{" "}
                            Rp {formatIDR(Math.abs(item.bankAmount))}
                        </span>
                        <span className={`text-[7px] font-black px-1 py-0.5 border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                            {cfg.label}
                            {item.matchScore != null && layer !== "CONFIRMED" && layer !== "IGNORED" && (
                                <span className="font-mono ml-0.5">{item.matchScore}%</span>
                            )}
                        </span>
                    </div>
                </div>
            </button>

            {/* Per-item action buttons — show on hover or when active */}
            {(onConfirm || onReject || onIgnore) && (
                <div className={`flex gap-1 mt-1.5 ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity`}>
                    {onConfirm && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onConfirm() }}
                            disabled={isLoading}
                            className="flex-1 text-[7px] font-bold uppercase px-1.5 py-1 bg-emerald-500 text-white border border-emerald-600 hover:bg-emerald-600 disabled:opacity-50"
                        >
                            {isLoading ? "..." : "Konfirmasi"}
                        </button>
                    )}
                    {onReject && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onReject() }}
                            disabled={isLoading}
                            className="flex-1 text-[7px] font-bold uppercase px-1.5 py-1 bg-white text-red-600 border border-red-300 hover:bg-red-50 disabled:opacity-50"
                        >
                            Tolak
                        </button>
                    )}
                    {onIgnore && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onIgnore() }}
                            disabled={isLoading}
                            className="flex-1 text-[7px] font-bold uppercase px-1.5 py-1 bg-white text-zinc-500 border border-zinc-300 hover:bg-zinc-50 disabled:opacity-50"
                        >
                            Abaikan
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}
```

---

### Task 12: Wire new actions into ReconciliationFocusView main component

**Files:**
- Modify: `components/finance/reconciliation-focus-view.tsx` (ReconciliationFocusView props + main component)

**Step 1: Extend ReconciliationFocusViewProps**

Add new handler props to the interface (after existing handlers ~line 64-69):

```typescript
    // Confirm/Reject/Ignore handlers (Phase 2)
    onConfirmItem: (itemId: string) => Promise<void>
    onRejectItem: (itemId: string) => Promise<void>
    onIgnoreItem: (itemId: string, reason?: string) => Promise<void>
    onBulkConfirmCocok: () => Promise<void>
```

**Step 2: Add filter state in main component**

Inside `ReconciliationFocusView`, after the `currentIndex` state declaration (~line 1336), add:

```typescript
    const [activeFilter, setActiveFilter] = useState<FilterTab>("SEMUA")
```

**Step 3: Update QueueSidebar usage**

Replace the `<QueueSidebar>` call (~line 1632) with:

```tsx
<QueueSidebar
    items={allItems}
    currentIndex={currentIndex}
    onSelect={goTo}
    activeFilter={activeFilter}
    onFilterChange={setActiveFilter}
    onConfirmItem={onConfirmItem}
    onRejectItem={onRejectItem}
    onIgnoreItem={(id) => onIgnoreItem(id)}
    onBulkConfirmCocok={onBulkConfirmCocok}
    actionLoading={actionLoading}
    isCompleted={isCompleted}
/>
```

**Step 4: Update progress display**

Replace the existing progress calculation (~line 1346-1348):

```typescript
// BEFORE:
const matchedCount = allItems.filter(i => i.matchStatus === "MATCHED").length
const totalCount = allItems.length
const allDone = allItems.every(i => i.matchStatus === "MATCHED")

// AFTER:
const confirmedCount = allItems.filter(i =>
    i.matchStatus === "CONFIRMED" || i.matchStatus === "IGNORED"
).length
const matchedCount = allItems.filter(i =>
    i.matchStatus === "MATCHED" || i.matchStatus === "CONFIRMED"
).length
const totalCount = allItems.length
const allDone = allItems.every(i =>
    i.matchStatus === "CONFIRMED" || i.matchStatus === "IGNORED"
)
```

---

### Task 13: Wire new actions from parent page into ReconciliationFocusView

**Files:**
- Modify: `components/finance/bank-reconciliation-view.tsx` (where ReconciliationFocusView is rendered)
- Modify: `app/finance/reconciliation/page.tsx` (add new server action imports)

**Step 1: Import new server actions in the page**

In `app/finance/reconciliation/page.tsx`, add imports:

```typescript
import {
    // ...existing imports...
    confirmReconciliationItem,
    rejectReconciliationItem,
    ignoreReconciliationItem,
    bulkConfirmCocokItems,
} from "@/lib/actions/finance-reconciliation"
```

**Step 2: Pass handlers through BankReconciliationView to ReconciliationFocusView**

In `components/finance/bank-reconciliation-view.tsx`, add the new props to `ReconciliationViewProps`:

```typescript
    onConfirmItem: (itemId: string) => Promise<{ success: boolean; error?: string }>
    onRejectItem: (itemId: string) => Promise<{ success: boolean; error?: string }>
    onIgnoreItem: (itemId: string, reason?: string) => Promise<{ success: boolean; error?: string }>
    onBulkConfirmCocok: (reconId: string) => Promise<{ success: boolean; confirmed?: number; error?: string }>
```

Then pass them through to `ReconciliationFocusView` in the detail view section, wrapping with toast feedback:

```typescript
onConfirmItem={async (itemId) => {
    setActionLoading(itemId)
    const result = await onConfirmItem(itemId)
    if (result.success) {
        toast.success("Item dikonfirmasi")
        await reloadDetail()
    } else {
        toast.error(result.error || "Gagal konfirmasi")
    }
    setActionLoading(null)
}}
onRejectItem={async (itemId) => {
    setActionLoading(itemId)
    const result = await onRejectItem(itemId)
    if (result.success) {
        toast.success("Match ditolak")
        await reloadDetail()
    } else {
        toast.error(result.error || "Gagal menolak")
    }
    setActionLoading(null)
}}
onIgnoreItem={async (itemId) => {
    setActionLoading(itemId)
    const result = await onIgnoreItem(itemId)
    if (result.success) {
        toast.success("Item diabaikan")
        await reloadDetail()
    } else {
        toast.error(result.error || "Gagal mengabaikan")
    }
    setActionLoading(null)
}}
onBulkConfirmCocok={async () => {
    setActionLoading("bulk-confirm")
    const result = await onBulkConfirmCocok(selectedReconId!)
    if (result.success) {
        toast.success(`${result.confirmed} item dikonfirmasi`)
        await reloadDetail()
    } else {
        toast.error(result.error || "Gagal konfirmasi bulk")
    }
    setActionLoading(null)
}}
```

**Step 3: Commit**

```bash
git add components/finance/reconciliation-focus-view.tsx components/finance/bank-reconciliation-view.tsx app/finance/reconciliation/page.tsx
git commit -m "feat(recon): 4-layer grouped sidebar with confirm/reject/ignore actions"
```

---

## Phase 4 — Financial Statement Warning

### Task 14: Add unreconciled bank entries detection query

**Files:**
- Modify: `lib/actions/finance-reports.ts` (add new export at end of file)

**Step 1: Write the detection query**

```typescript
/**
 * Detect unreconciled POSTED journal entries that touch bank/cash accounts
 * within a given date range. Used by financial reports to warn users.
 */
export async function getUnreconciledBankEntryCount(
    startDate: Date,
    endDate: Date
): Promise<{ count: number; totalAmount: number }> {
    const prisma = (await import('@/lib/db')).default

    // Find POSTED journal lines on bank-type accounts that aren't reconciled
    const unreconciledLines = await prisma.journalLine.findMany({
        where: {
            entry: {
                status: 'POSTED',
                isReconciled: false,
                date: {
                    gte: startDate,
                    lte: endDate,
                },
            },
            account: {
                // Bank accounts typically have codes starting with 111x
                // Or we can check by account type — adjust based on your COA structure
                code: { startsWith: '111' },
            },
        },
        select: {
            debit: true,
            credit: true,
        },
    })

    const totalAmount = unreconciledLines.reduce(
        (sum, line) => sum + Math.abs(Number(line.debit) - Number(line.credit)),
        0
    )

    return { count: unreconciledLines.length, totalAmount }
}
```

---

### Task 15: Create unreconciled warning banner component

**Files:**
- Create: `components/finance/unreconciled-warning.tsx`

**Step 1: Write the component**

```typescript
"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle } from "lucide-react"
import { getUnreconciledBankEntryCount } from "@/lib/actions/finance-reports"

interface UnreconciledWarningProps {
    startDate: Date
    endDate: Date
}

export function UnreconciledWarning({ startDate, endDate }: UnreconciledWarningProps) {
    const router = useRouter()
    const [data, setData] = useState<{ count: number; totalAmount: number } | null>(null)

    useEffect(() => {
        getUnreconciledBankEntryCount(startDate, endDate).then(setData).catch(() => {})
    }, [startDate.toISOString(), endDate.toISOString()])

    if (!data || data.count === 0) return null

    return (
        <div className="bg-amber-50 border-2 border-amber-300 shadow-[3px_3px_0px_0px_rgba(0,0,0,0.1)] p-4 mb-4">
            <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <span className="text-[11px] font-black uppercase tracking-wider text-amber-800">
                    {data.count} transaksi bank belum direkonsiliasi
                </span>
            </div>
            <p className="text-[11px] text-amber-700 mt-1.5 leading-relaxed">
                Laporan keuangan ini mungkin tidak akurat. Selesaikan rekonsiliasi bank
                sebelum mencetak laporan.
            </p>
            <button
                onClick={() => router.push("/finance/reconciliation")}
                className="mt-2 text-[9px] font-black uppercase tracking-wider px-3 py-1.5 bg-amber-500 text-white border border-amber-600 hover:bg-amber-600 transition-colors"
            >
                Selesaikan Rekonsiliasi →
            </button>
        </div>
    )
}
```

---

### Task 16: Wire warning into financial reports page

**Files:**
- Modify: `app/finance/reports/page.tsx` (~line 207+)

**Step 1: Import the component**

At the top of the file, add:

```typescript
import { UnreconciledWarning } from "@/components/finance/unreconciled-warning"
```

**Step 2: Add the warning banner**

Find the main report content area in `FinancialReportsPage`. Add the warning BEFORE the report content, right after the date range selector and before the report tabs render content. The warning should appear when viewing Laba Rugi (pnl), Neraca (bs), or Arus Kas (cf) report types.

```tsx
{/* Unreconciled bank entries warning — shown for P&L, Balance Sheet, Cash Flow */}
{(reportType === "pnl" || reportType === "bs" || reportType === "cf") && (
    <UnreconciledWarning startDate={startDate} endDate={endDate} />
)}
```

Insert this JSX inside the report content area, just before the conditional rendering of each report type. Find the pattern where `reportType === "pnl"` is checked for rendering the P&L section and add the warning above it.

**Step 3: Commit**

```bash
git add lib/actions/finance-reports.ts components/finance/unreconciled-warning.tsx app/finance/reports/page.tsx
git commit -m "feat(recon): unreconciled bank entry warning on financial reports"
```

---

### Task 17: Final verification and integration test

**Step 1: Run all tests**

```bash
npx vitest run
```

Expected: All tests pass.

**Step 2: Run type check**

```bash
npx tsc --noEmit
```

Expected: No type errors.

**Step 3: Run dev server and verify manually**

```bash
npm run dev
```

Then verify:
1. `/finance/reconciliation` — open an existing reconciliation
2. Left panel shows ALL items grouped by COCOK/POTENSI/HAMPIR/BELUM
3. Filter tabs work (SEMUA shows all, each tab filters)
4. Confirm button on COCOK item → item moves to DIKONFIRMASI
5. "Konfirmasi Semua" bulk button on COCOK header → all COCOK items confirmed
6. Reject button → item returns to BELUM
7. Abaikan button on BELUM item → item moves to DIABAIKAN
8. `/finance/reports` with P&L/BS/CF selected → warning banner appears if unreconciled entries exist
9. Progress bar shows confirmed+ignored / total

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat(recon): bank reconciliation 4-layer overhaul — confirm/reject/ignore + statement warning"
```

---

## Verification Guide

**Halaman:** `/finance/reconciliation`

**Sebelumnya (Before):** Bank reconciliation only showed unmatched items in a flat queue. No way to confirm/reject matches. No reconciliation stamp on GL journals. Financial reports had no warning about unreconciled entries.

**Sekarang (Now):** All bank statement items visible in 4 layers (COCOK/POTENSI/HAMPIR/BELUM). User can confirm, reject, or ignore each item. Confirmed items stamp the matched GL journal. Financial reports warn about unreconciled bank entries.

**Kenapa penting (Why it matters):** Bank reconciliation is the core audit trail for cash management. Without confirm/reject, there's no user accountability. Without stamps on GL journals, financial statements can't detect unreconciled items. This brings the ERP to SAP/NetSuite parity for bank recon.

**Cara Test:**
1. Go to `/finance/reconciliation`, open an existing session
2. Verify left panel shows grouped items: COCOK (green), POTENSI (amber), HAMPIR (orange), BELUM (gray)
3. Click filter tabs — COCOK tab shows only COCOK items, etc.
4. Click "Konfirmasi" on a COCOK item → moves to DIKONFIRMASI section
5. Click "Konfirmasi Semua" on COCOK header → all COCOK items confirmed at once
6. Click "Tolak" on a confirmed item → item returns to BELUM
7. Click "Abaikan" on a BELUM item → item moves to DIABAIKAN
8. Check progress bar: shows confirmed+ignored / total
9. Go to `/finance/reports` → select Laba Rugi → see amber warning banner about unreconciled entries
10. Click "Selesaikan Rekonsiliasi →" → navigates back to reconciliation page
