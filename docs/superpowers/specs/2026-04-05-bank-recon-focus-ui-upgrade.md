# Bank Reconciliation Focus View — 5-Signal UI Upgrade

**Goal:** Upgrade the reconciliation focus view so finance experts can see exactly WHY each match scored the way it did, make confident match/reject decisions in seconds, and flow through the queue step-by-step without confusion.

**Context:** The server-side matching engine was just upgraded with 5-signal composite scoring (direction, amount, reference, description, date). The client-side engine and UI still use the old 3-signal approach. This spec brings both in sync.

---

## Problem Statement

| What's Wrong | Impact on Finance Expert |
|---|---|
| Client engine uses old scoring (3 signals, no direction gate) | Wrong matches shown; direction mismatches appear as suggestions |
| UI only shows 3 metrics (amount diff, name %, days) | Expert can't tell WHY a match is good/bad — has to mental-math it |
| No reference/doc number highlighting | INV-2026-001 appears in both bank and GL but expert has to spot it manually |
| No direction indicator on bank lines or GL entries | Expert can't tell at a glance if money is in/out |
| Zero-match state gives no explanation | Expert doesn't know if it's a direction issue, amount issue, or missing journal |

---

## Design

### Part 1: Upgrade Client-Side Matching Engine

Port all scoring functions from `lib/finance-reconciliation-helpers.ts` to `lib/reconciliation-match-client.ts`:

- `sameDirection()` — hard gate, reject direction mismatches entirely
- `scoreAmount()` — tiered percentage-based (exact=1.0, <0.5%=0.90, ..., >5%=0)
- `normalizeBankDescription()` — strip 17 Indonesian bank prefixes
- `extractDocNumbers()` — find INV/PO/SO patterns + 16-digit VA numbers
- `tokenSortRatio()` + Jaccard — order-independent description matching
- `scoreReference()` — exact=1.0, substring=0.85
- `scoreDateProximity()` — tiered (0d=1.0, 1d=0.90, 3d=0.75, 7d=0.40, 14d=0.15)

New composite: `amount(35%) + reference(25%) + description(20%) + date(10%) + direction(10%)`

Tier classification by score: AUTO >= 75, POTENTIAL >= 40, MANUAL > 10.

Add `signals` object to `ClientMatchResult`:
```ts
interface MatchSignals {
  amount: number      // 0..1
  reference: number   // 0..1
  description: number // 0..1
  date: number        // 0..1
  direction: number   // 0 or 1
}

interface ClientMatchResult {
  // ... existing fields ...
  signals: MatchSignals
  matchedRefs: string[]  // doc numbers found in both sides (for highlight)
}
```

### Part 2: Direction Indicator — Bank Line Card + GL Entries

**Bank line card** (the blue-header card on the left):
Add a direction chip next to the amount:

```
┌─ sky-500 header ──────────────────────────┐
│  01 Mar 2026          Rp 5.000.000  ↑MASUK│
│  TRF/INV-2026-001                         │
│  Ref: INV-2026-001                        │
└───────────────────────────────────────────┘
```

- Positive: `↑ MASUK` chip — `bg-emerald-100 text-emerald-700 border-emerald-400`
- Negative: `↓ KELUAR` chip — `bg-red-100 text-red-700 border-red-400`

**GL entry rows** in the suggestion list:
Show DR/CR direction on each entry's amount:

```
Rp 5.000.000 DR    (emerald = debit/money in)
Rp 3.200.000 CR    (red = credit/money out)
```

### Part 3: Signal Breakdown Bar — The Core Innovation

Replace the current 3-metric line with a **5-segment horizontal signal bar** on every match card. This is the primary decision tool for the finance expert.

```
┌─ Match Card ──────────────────────────────────────┐
│  01 Mar 2026   [AUTO 92%]     Rp 5.000.000 DR    │
│  Pembayaran Invoice INV-2026-001                  │
│  Ref: INV-2026-001                                │
│                                                   │
│  ┌──────────────────────────────────────────────┐ │
│  │▓▓▓▓▓▓▓▓▓▓▓│▓▓▓▓▓▓▓▓│▓▓▓▓▓▓│▓▓▓│▓▓▓│  92%  │ │
│  │  Jumlah    │  Ref   │ Nama │Tgl│Arah│       │ │
│  │   35%      │  25%   │ 12%  │10%│10% │       │ │
│  └──────────────────────────────────────────────┘ │
│                                                   │
│  Jumlah cocok (selisih Rp 0)                      │
│  Ref: INV-2026-001 ditemukan ✓                    │
│  ±0 hari                                          │
└───────────────────────────────────────────────────┘
```

**Segment colors** (each segment independently colored):
- Signal >= 0.75 → emerald (`bg-emerald-500`)
- Signal >= 0.40 → amber (`bg-amber-400`)
- Signal > 0 → zinc (`bg-zinc-300`)
- Signal = 0 → red/invisible (hard gate failed or no data)

**Segment widths** proportional to weight:
- Amount: 35% of bar width
- Reference: 25% of bar width
- Description: 20% of bar width
- Date: 10% of bar width
- Direction: 10% of bar width

**Below the bar** — compact text summary (replaces old 3-metric line):
- If amount exact: "Jumlah cocok (selisih Rp 0)"
- If amount close: "Jumlah dekat (selisih Rp 350, 0.04%)"
- If ref matched: "Ref: INV-2026-001 ditemukan ✓" (orange text)
- If ref not found: omit line entirely (don't clutter)
- Always show: "±X hari"

### Part 4: Reference Highlight

When `matchedRefs` is non-empty:

1. In the **bank line card**: the matching doc number gets `bg-orange-100 border-b border-orange-400 font-bold` styling
2. In the **GL suggestion row**: same doc number gets the same highlight
3. A small `REF ✓` badge appears on the match card (orange pill)

This creates a visual connection between bank and GL — the expert's eye can trace the matching reference instantly.

### Part 5: Zero-Match Explanation

When a bank line has 0 suggestions, the suggestion panel currently shows a generic "Tidak ada kecocokan otomatis" message.

Replace with a diagnostic message based on the data:

| Condition | Message (Bahasa) |
|---|---|
| All GL entries have opposite direction | "Semua jurnal GL berlawanan arah (bank: masuk, GL: semua keluar)" |
| Nearest GL amount >5% different | "Selisih jumlah terlalu besar — jurnal terdekat: Rp X (selisih Y%)" |
| No GL entries within 30 days | "Tidak ada jurnal dalam 30 hari dari tanggal bank" |
| No GL entries at all | "Belum ada jurnal umum — buat jurnal baru?" |
| Default | "Tidak ada kecocokan ditemukan" |

The diagnostic logic runs client-side by scanning `allSystemEntries` once.

### Part 6: Enhanced Queue Sidebar

Small improvement to the left sidebar queue items:

Add a tiny **direction dot** next to each queue item amount:
- Green dot (●) for deposits (masuk)
- Red dot (●) for withdrawals (keluar)

This lets the expert scan the queue and immediately see the cash flow pattern.

---

## NB Design Compliance

| Element | NB Tokens |
|---|---|
| Signal bar container | `border border-black bg-white h-3` (tiny, data-dense) |
| Signal bar segments | No border between segments, just color blocks |
| Signal bar labels | `text-[7px] font-bold uppercase text-zinc-400` below bar |
| Direction chip | `px-1.5 py-0.5 text-[8px] font-black border` |
| Ref highlight | `bg-orange-100 border-b border-orange-400` |
| Ref badge | `text-[7px] font-black px-1 py-0.5 bg-orange-100 text-orange-700 border border-orange-400` |
| Diagnostic message | `text-[10px] text-zinc-500 italic` with relevant icon |

---

## File Map

| File | Action | What Changes |
|---|---|---|
| `lib/reconciliation-match-client.ts` | Major rewrite | Port 5-signal engine from helpers, add signals/matchedRefs to result type |
| `components/finance/reconciliation-focus-view.tsx` | Modify | Signal bar component, direction chips, ref highlight, zero-match diagnostic, queue direction dots |
| `lib/finance-reconciliation-helpers.ts` | No change | Already upgraded (source of truth for scoring logic) |

No new files needed. No schema changes. No API changes.

---

## User Flow (Step-by-Step for Finance Expert)

```
1. Expert opens reconciliation → sees queue sidebar with direction dots (green/red)
2. First unmatched item auto-selected → bank line card shows with ↑MASUK / ↓KELUAR chip
3. Right panel shows tiered suggestions:
   a. AUTO matches (green) with signal bar showing WHY it's confident
   b. POTENTIAL matches (amber) with signal bar showing which signals are weak
   c. MANUAL matches (gray) sorted by score
4. Expert scans signal bars — sees green segments = strong signals
5. Reference match? Orange "REF ✓" badge + highlighted doc number in both cards
6. Expert clicks best match → orange selection indicator appears
7. Clicks "Cocokkan & Lanjut" → matched, queue auto-advances to next item
8. If 0 suggestions → diagnostic message explains WHY (direction? amount? no journals?)
9. Expert creates inline journal if needed → matches and continues
10. Repeat until queue is empty → close reconciliation
```

---

## Success Criteria

- [ ] Direction mismatches never appear as suggestions (hard gate)
- [ ] Expert can identify the best match in <3 seconds by scanning signal bars
- [ ] Reference matches are visually obvious (orange highlight on both sides)
- [ ] Zero-match items explain why (not just "no matches")
- [ ] Score breakdown is transparent — expert understands the 92% intuitively
- [ ] Queue sidebar shows cash flow direction at a glance
- [ ] All new elements follow NB design system (no rounded corners, bold borders, uppercase labels)
