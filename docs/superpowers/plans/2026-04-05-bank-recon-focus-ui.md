# Bank Reconciliation Focus UI — 5-Signal Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the client-side matching engine to 5-signal composite scoring and redesign the focus-view UI so finance experts can see exactly why each match scored the way it did — direction indicators, signal breakdown bars, reference highlights, and zero-match diagnostics.

**Architecture:** Two files change: `lib/reconciliation-match-client.ts` (complete rewrite to port 5-signal engine from `lib/finance-reconciliation-helpers.ts`) and `components/finance/reconciliation-focus-view.tsx` (UI modifications to BankLineCard, MatchRow, AutoMatchCard, QueueSidebar, JournalSuggestions). No new files. No schema/API changes.

**Tech Stack:** TypeScript, React 19, fastest-levenshtein, Tailwind CSS v4, Lucide icons, Framer Motion

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `lib/reconciliation-match-client.ts` | Major rewrite | Port 5-signal scoring from server-side helpers. Add `signals` + `matchedRefs` to `ClientMatchResult`. |
| `components/finance/reconciliation-focus-view.tsx` | Modify | SignalBar component, direction chips on BankLineCard + GL rows, ref highlight, zero-match diagnostic, queue direction dots |
| `lib/finance-reconciliation-helpers.ts` | No change | Source of truth — already upgraded |

---

## Task 1: Upgrade client-side matching engine

**Files:**
- Rewrite: `lib/reconciliation-match-client.ts`

Port all 5-signal scoring functions from `lib/finance-reconciliation-helpers.ts` to the client-side module. The client version uses string dates (ISO) and nullable fields — adapt accordingly.

- [ ] **Step 1: Add `MatchSignals` type and update `ClientMatchResult`**

At the top of the types section, add:

```ts
export interface MatchSignals {
  amount: number      // 0..1
  reference: number   // 0..1
  description: number // 0..1
  date: number        // 0..1
  direction: number   // 0 or 1
}
```

Update `ClientMatchResult`:

```ts
export interface ClientMatchResult {
  entryId: string
  entry: ClientSystemEntry
  tier: ClientMatchTier
  score: number             // 0-100
  amountDiff: number
  nameSimilarity: number
  daysDiff: number
  signals: MatchSignals
  matchedRefs: string[]     // doc numbers found in both sides
}
```

- [ ] **Step 2: Port `sameDirection`, `amountTolerance`, `scoreAmount`**

Add after the existing `daysBetween` function. These are identical to the server-side versions:

```ts
function sameDirection(bankAmount: number, txnAmount: number): boolean {
  if (bankAmount >= 0 && txnAmount >= 0) return true
  if (bankAmount < 0 && txnAmount < 0) return true
  return false
}

function amountTolerance(amount: number): number {
  return Math.max(1000, Math.abs(amount) * 0.005)
}

function scoreAmount(bankAbs: number, glAbs: number): number {
  const diff = Math.abs(bankAbs - glAbs)
  const maxVal = Math.max(bankAbs, glAbs, 1)
  const pct = diff / maxVal

  if (diff === 0) return 1.0
  if (diff < 1) return 0.99
  if (diff < 1000) return 0.95
  if (pct < 0.005) return 0.9
  if (pct < 0.01) return 0.8
  if (pct < 0.02) return 0.65
  if (pct < 0.03) return 0.45
  if (pct < 0.05) return 0.25
  return 0
}
```

- [ ] **Step 3: Port description normalization + scoring**

Add the bank prefix list and description functions:

```ts
const BANK_PREFIXES = [
  "TRSF E-BANKING DR/", "TRSF E-BANKING CR/",
  "SWITCHING DEBIT ", "SWITCHING KREDIT ",
  "ATM TRANSFER ", "POS DEBIT ", "POS CREDIT ",
  "ATM TUNAI ", "SETORAN TUNAI", "TARIK TUNAI",
  "BIFAST/", "RTGS/", "SKN/", "QRIS", "TRF/", "TRF ", "VA ",
]

function normalizeBankDescription(raw: string): string {
  let text = raw.toUpperCase().trim()
  for (const prefix of BANK_PREFIXES) {
    if (text.startsWith(prefix)) { text = text.slice(prefix.length).trim(); break }
  }
  return text.replace(/[\/\-_\.]/g, " ").replace(/[^A-Z0-9\s]/g, "").replace(/\s+/g, " ").trim()
}

function normalizeTextForComparison(text: string): string {
  return text.toUpperCase().trim()
    .replace(/[\/\-_\.]/g, " ").replace(/[^A-Z0-9\s]/g, "").replace(/\s+/g, " ").trim()
}

export function extractDocNumbers(text: string): string[] {
  const patterns: RegExp[] = [
    /(?:INV|BILL|PO|SO|GRN|JE|PAY|DN|CN|PR|WO)[-\/]?\d{2,4}[-\/]?\d{1,6}/gi,
    /\b\d{16}\b/g,
    /\b\d{10,15}\b/g,
  ]
  const refs: string[] = []
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const cleaned = match[0].toUpperCase().replace(/[\s\-\/]/g, "").replace(/^0+/, "")
      if (cleaned.length > 0 && !refs.includes(cleaned)) refs.push(cleaned)
    }
  }
  return refs
}

function tokenSortRatio(a: string, b: string): number {
  const tokensA = a.split(" ").filter((t) => t.length > 2).sort().join(" ")
  const tokensB = b.split(" ").filter((t) => t.length > 2).sort().join(" ")
  if (tokensA.length === 0 && tokensB.length === 0) return 1
  if (tokensA.length === 0 || tokensB.length === 0) return 0
  return stringSimilarity(tokensA, tokensB)
}

function scoreDescription(bankDesc: string, glDesc: string): number {
  const bankNorm = normalizeBankDescription(bankDesc)
  const glNorm = normalizeTextForComparison(glDesc)
  if (bankNorm.length === 0 && glNorm.length === 0) return 1
  if (bankNorm.length === 0 || glNorm.length === 0) return 0

  const tokenScore = tokenSortRatio(bankNorm, glNorm)

  const bankTokens = new Set(bankNorm.split(" ").filter((t) => t.length > 2))
  const glTokens = new Set(glNorm.split(" ").filter((t) => t.length > 2))
  const intersection = new Set([...bankTokens].filter((t) => glTokens.has(t)))
  const union = new Set([...bankTokens, ...glTokens])
  const jaccardScore = union.size > 0 ? intersection.size / union.size : 0

  return Math.max(tokenScore, jaccardScore)
}
```

- [ ] **Step 4: Port reference + date scoring**

```ts
function scoreReference(bankRefs: string[], glRefs: string[]): number {
  if (bankRefs.length === 0 || glRefs.length === 0) return 0
  const bankNorm = bankRefs.map((r) => r.toUpperCase().replace(/[\s\-\/]/g, "").replace(/^0+/, ""))
  const glNorm = glRefs.map((r) => r.toUpperCase().replace(/[\s\-\/]/g, "").replace(/^0+/, ""))
  for (const b of bankNorm) {
    for (const g of glNorm) {
      if (b === g) return 1.0
      if (b.includes(g) || g.includes(b)) return 0.85
    }
  }
  return 0
}

function scoreDateProximity(bankDate: string | null, glDate: string): number {
  const diff = daysBetween(bankDate, glDate)
  if (diff === 0) return 1.0
  if (diff === 1) return 0.9
  if (diff <= 3) return 0.75
  if (diff <= 7) return 0.4
  if (diff <= 14) return 0.15
  return 0
}
```

- [ ] **Step 5: Rewrite `computeMatchScore` with 5-signal composite**

Replace the old 3-signal function with:

```ts
const MATCH_WEIGHTS = {
  amount: 0.35, reference: 0.25, description: 0.20, date: 0.10, direction: 0.10,
} as const

function collectRefs(
  bankRef: string | null, bankDesc: string | null,
  txnRef: string | null, txnDesc: string
): { bankRefs: string[]; glRefs: string[]; matched: string[] } {
  const bankRefs = extractDocNumbers(`${bankRef || ""} ${bankDesc || ""}`)
  const glRefs = extractDocNumbers(`${txnRef || ""} ${txnDesc}`)
  if (bankRef) { const nr = normalizeRef(bankRef); if (nr && !bankRefs.includes(nr)) bankRefs.push(nr) }
  if (txnRef) { const nr = normalizeRef(txnRef); if (nr && !glRefs.includes(nr)) glRefs.push(nr) }

  // Find matched refs (for UI highlighting)
  const bNorm = bankRefs.map((r) => r.toUpperCase().replace(/[\s\-\/]/g, "").replace(/^0+/, ""))
  const gNorm = glRefs.map((r) => r.toUpperCase().replace(/[\s\-\/]/g, "").replace(/^0+/, ""))
  const matched: string[] = []
  for (const b of bNorm) {
    for (const g of gNorm) {
      if (b === g || b.includes(g) || g.includes(b)) {
        if (!matched.includes(b)) matched.push(b)
      }
    }
  }

  return { bankRefs, glRefs, matched }
}

export function computeMatchScore(
  bank: ClientBankLine, entry: ClientSystemEntry
): { score: number; amountDiff: number; nameSimilarity: number; daysDiff: number; signals: MatchSignals; matchedRefs: string[] } {
  const amountDiff = Math.abs(Math.abs(bank.bankAmount) - Math.abs(entry.amount))
  const dd = daysBetween(bank.bankDate, entry.date)

  if (!sameDirection(bank.bankAmount, entry.amount)) {
    return {
      score: 0, amountDiff, nameSimilarity: 0, daysDiff: dd, matchedRefs: [],
      signals: { amount: 0, reference: 0, description: 0, date: 0, direction: 0 },
    }
  }

  const { bankRefs, glRefs, matched } = collectRefs(
    bank.bankRef, bank.bankDescription,
    entry.reference, entry.lineDescription || entry.description
  )

  const signals: MatchSignals = {
    amount: scoreAmount(Math.abs(bank.bankAmount), Math.abs(entry.amount)),
    reference: scoreReference(bankRefs, glRefs),
    description: scoreDescription(bank.bankDescription || "", entry.lineDescription || entry.description || ""),
    date: scoreDateProximity(bank.bankDate, entry.date),
    direction: 1.0,
  }

  let rawScore =
    signals.amount * MATCH_WEIGHTS.amount +
    signals.reference * MATCH_WEIGHTS.reference +
    signals.description * MATCH_WEIGHTS.description +
    signals.date * MATCH_WEIGHTS.date +
    signals.direction * MATCH_WEIGHTS.direction

  if (signals.reference === 1.0) rawScore = Math.max(rawScore, 0.75)

  const score = Math.min(100, Math.round(Math.min(1.0, rawScore) * 100))

  return { score, amountDiff, nameSimilarity: signals.description, daysDiff: dd, signals, matchedRefs: matched }
}
```

- [ ] **Step 6: Rewrite `rankMatchesForBankLine` with score-based tier classification**

Replace the old function that uses separate `isAutoMatch`/`isPotentialMatch` boolean classifiers:

```ts
function scoreTier(score: number, refSignal: number): ClientMatchTier {
  if (refSignal === 1.0 && score >= 70) return "AUTO"
  if (score >= 75) return "AUTO"
  if (score >= 40) return "POTENTIAL"
  return "MANUAL"
}

export function rankMatchesForBankLine(
  bankLine: ClientBankLine,
  systemEntries: ClientSystemEntry[]
): TieredMatches {
  const auto: ClientMatchResult[] = []
  const potential: ClientMatchResult[] = []
  const manual: ClientMatchResult[] = []

  for (const entry of systemEntries) {
    const { score, amountDiff, nameSimilarity, daysDiff, signals, matchedRefs } =
      computeMatchScore(bankLine, entry)

    if (score <= 0) continue // direction mismatch or zero score

    const tier = scoreTier(score, signals.reference)
    const result: ClientMatchResult = {
      entryId: entry.entryId, entry, tier, score,
      amountDiff, nameSimilarity, daysDiff, signals, matchedRefs,
    }

    if (tier === "AUTO") auto.push(result)
    else if (tier === "POTENTIAL") potential.push(result)
    else if (score > 10) manual.push(result)
  }

  auto.sort((a, b) => b.score - a.score)
  potential.sort((a, b) => b.score - a.score)
  manual.sort((a, b) => b.score - a.score)

  const bestTier: ClientMatchTier =
    auto.length > 0 ? "AUTO" : potential.length > 0 ? "POTENTIAL" : "MANUAL"

  return { auto, potential, manual, bestTier }
}
```

- [ ] **Step 7: Delete old functions that are no longer used**

Remove `isAutoMatch`, `isPotentialMatch`, and `referenceOverlap` — all replaced by composite scoring.

- [ ] **Step 8: Verify TypeScript compiles**

```bash
npx tsc --noEmit lib/reconciliation-match-client.ts 2>&1 | head -20
```

Expected: no new errors from this file (pre-existing errors elsewhere are OK).

- [ ] **Step 9: Commit**

```bash
git add lib/reconciliation-match-client.ts
git commit -m "feat(bank-recon): port 5-signal matching engine to client-side — direction gate, tiered amount, token descriptions, ref bonus"
```

---

## Task 2: Add SignalBar component + direction chips to focus view

**Files:**
- Modify: `components/finance/reconciliation-focus-view.tsx`

This task adds: (A) the `SignalBar` micro-visualization, (B) direction chips on BankLineCard, and (C) DR/CR labels on GL entry rows.

- [ ] **Step 1: Add `SignalBar` component after the `TierBadge` component (around line 143)**

Insert this new component below the existing `TierBadge`:

```tsx
// ==============================================================================
// Signal Bar — 5-segment match quality visualization
// ==============================================================================

const SIGNAL_LABELS: { key: keyof MatchSignals; label: string; weight: number }[] = [
  { key: "amount", label: "Jumlah", weight: 35 },
  { key: "reference", label: "Ref", weight: 25 },
  { key: "description", label: "Nama", weight: 20 },
  { key: "date", label: "Tgl", weight: 10 },
  { key: "direction", label: "Arah", weight: 10 },
]

function signalColor(value: number): string {
  if (value >= 0.75) return "bg-emerald-500"
  if (value >= 0.40) return "bg-amber-400"
  if (value > 0) return "bg-zinc-300"
  return "bg-red-400"
}

function SignalBar({ signals, score }: { signals: MatchSignals; score: number }) {
  return (
    <div className="mt-2">
      {/* Bar */}
      <div className="flex h-2 border border-black overflow-hidden">
        {SIGNAL_LABELS.map(({ key, weight }) => (
          <div
            key={key}
            className={`${signalColor(signals[key])} transition-colors`}
            style={{ width: `${weight}%` }}
            title={`${key}: ${Math.round(signals[key] * 100)}%`}
          />
        ))}
      </div>
      {/* Labels below */}
      <div className="flex mt-0.5">
        {SIGNAL_LABELS.map(({ key, label, weight }) => (
          <span
            key={key}
            className="text-[6px] font-bold uppercase text-zinc-400 text-center truncate"
            style={{ width: `${weight}%` }}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
```

Also add the import for `MatchSignals` at the top of the file (line 47–51 area):

```ts
import {
    rankMatchesForBankLine,
    type ClientBankLine,
    type ClientMatchResult,
    type TieredMatches,
    type MatchSignals,
} from "@/lib/reconciliation-match-client"
```

- [ ] **Step 2: Add `DirectionChip` component below `SignalBar`**

```tsx
function DirectionChip({ amount }: { amount: number }) {
  const isInflow = amount >= 0
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[8px] font-black border ${
      isInflow
        ? "bg-emerald-100 text-emerald-700 border-emerald-400"
        : "bg-red-100 text-red-700 border-red-400"
    }`}>
      {isInflow ? "\u2191 MASUK" : "\u2193 KELUAR"}
    </span>
  )
}
```

- [ ] **Step 3: Wire DirectionChip into BankLineCard (around line 314)**

In the `BankLineCard` function, find the "Jumlah" section and add the chip after the amount:

Replace:
```tsx
                    <div>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 block">Jumlah</span>
                        <span className={`text-lg font-mono font-black ${
                            item.bankAmount >= 0 ? "text-emerald-600" : "text-red-600"
                        }`}>
                            Rp {formatIDR(Math.abs(item.bankAmount))}
                        </span>
                    </div>
```

With:
```tsx
                    <div>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 block">Jumlah</span>
                        <div className="flex items-center gap-2">
                            <span className={`text-lg font-mono font-black ${
                                item.bankAmount >= 0 ? "text-emerald-600" : "text-red-600"
                            }`}>
                                Rp {formatIDR(Math.abs(item.bankAmount))}
                            </span>
                            <DirectionChip amount={item.bankAmount} />
                        </div>
                    </div>
```

- [ ] **Step 4: Add DR/CR label to GL entry amounts in `MatchRow` (around line 728-731)**

Find the amount display in `MatchRow` and add DR/CR:

Replace:
```tsx
                <span className={`text-sm font-mono font-bold shrink-0 ${
                    e.amount >= 0 ? "text-emerald-600" : "text-red-600"
                }`}>
                    Rp {formatIDR(Math.abs(e.amount))}
                </span>
```

With:
```tsx
                <span className={`text-sm font-mono font-bold shrink-0 ${
                    e.amount >= 0 ? "text-emerald-600" : "text-red-600"
                }`}>
                    Rp {formatIDR(Math.abs(e.amount))}
                    <span className="text-[8px] font-black ml-1 opacity-60">
                        {e.amount >= 0 ? "DR" : "CR"}
                    </span>
                </span>
```

Do the same in `AutoMatchCard` (around line 666-669):

Replace:
```tsx
                <span className={`text-sm font-mono font-black shrink-0 ${
                    e.amount >= 0 ? "text-emerald-600" : "text-red-600"
                }`}>
                    Rp {formatIDR(Math.abs(e.amount))}
                </span>
```

With:
```tsx
                <span className={`text-sm font-mono font-black shrink-0 ${
                    e.amount >= 0 ? "text-emerald-600" : "text-red-600"
                }`}>
                    Rp {formatIDR(Math.abs(e.amount))}
                    <span className="text-[8px] font-black ml-1 opacity-60">
                        {e.amount >= 0 ? "DR" : "CR"}
                    </span>
                </span>
```

- [ ] **Step 5: Wire SignalBar into MatchRow — replace old 3-metric line**

In `MatchRow` (around line 742-747), replace the old score details with SignalBar + compact summary:

Replace:
```tsx
            {/* Score details */}
            <div className="flex items-center gap-3 mt-1.5 text-[9px] text-zinc-400">
                <span>Selisih: <span className={`font-mono font-bold ${match.amountDiff === 0 ? "text-emerald-500" : "text-zinc-500"}`}>Rp {formatIDR(Math.round(match.amountDiff))}</span></span>
                <span>Nama: <span className={`font-mono font-bold ${match.nameSimilarity >= 0.65 ? "text-amber-500" : "text-zinc-500"}`}>{Math.round(match.nameSimilarity * 100)}%</span></span>
                <span>±{match.daysDiff} hari</span>
            </div>
```

With:
```tsx
            {/* Signal breakdown */}
            <SignalBar signals={match.signals} score={match.score} />
            <div className="flex items-center gap-2.5 mt-1 text-[8px] text-zinc-400">
                {match.amountDiff === 0 ? (
                    <span className="text-emerald-500 font-bold">Jumlah cocok</span>
                ) : (
                    <span>Selisih <span className="font-mono font-bold text-zinc-500">Rp {formatIDR(Math.round(match.amountDiff))}</span></span>
                )}
                {match.matchedRefs.length > 0 && (
                    <span className="text-orange-600 font-bold">Ref \u2713</span>
                )}
                {match.daysDiff > 0 && (
                    <span>\u00b1{match.daysDiff} hari</span>
                )}
            </div>
```

- [ ] **Step 6: Wire SignalBar into AutoMatchCard**

In `AutoMatchCard`, after the reference line (around line 678), before the selected/unselected message, add a compact signal bar:

Find:
```tsx
            {isSelected ? (
                <div className="mt-2 flex items-center gap-1.5 text-[9px] font-bold text-emerald-700">
```

Insert before it:
```tsx
            {/* Signal breakdown (compact for AUTO) */}
            <SignalBar signals={match.signals} score={match.score} />
```

- [ ] **Step 7: Add direction dots to QueueSidebar (around line 273-276)**

In the queue sidebar, add a small direction indicator before the amount. Find:

```tsx
                                        <span className={`text-[9px] font-mono ${
                                            item.bankAmount >= 0 ? "text-emerald-600" : "text-red-500"
                                        }`}>
                                            Rp {formatIDR(Math.abs(item.bankAmount))}
                                        </span>
```

Replace with:
```tsx
                                        <span className={`text-[9px] font-mono ${
                                            item.bankAmount >= 0 ? "text-emerald-600" : "text-red-500"
                                        }`}>
                                            <span className="text-[7px]">{item.bankAmount >= 0 ? "\u25B2" : "\u25BC"}</span>{" "}
                                            Rp {formatIDR(Math.abs(item.bankAmount))}
                                        </span>
```

- [ ] **Step 8: Verify the page loads without errors**

```bash
npm run dev &
sleep 5
curl -s http://localhost:3002/finance/reconciliation | head -5
```

Check for no React rendering errors in the terminal output.

- [ ] **Step 9: Commit**

```bash
git add components/finance/reconciliation-focus-view.tsx
git commit -m "feat(bank-recon): signal bar, direction chips, DR/CR labels in focus view"
```

---

## Task 3: Reference highlight + zero-match diagnostic

**Files:**
- Modify: `components/finance/reconciliation-focus-view.tsx`

- [ ] **Step 1: Add `RefHighlight` helper component after `DirectionChip`**

```tsx
/**
 * Highlight a document reference in a text string.
 * If the ref appears in the text, wrap it in an orange underline span.
 */
function HighlightedText({ text, matchedRefs }: { text: string; matchedRefs: string[] }) {
  if (!text || matchedRefs.length === 0) return <>{text || "-"}</>

  // Build a regex from the raw (un-normalized) ref patterns found in the text
  const patterns = matchedRefs.map((ref) => {
    // Re-insert optional separators for matching in raw text: INV2026001 → INV[-/]?2026[-/]?001
    const chars = ref.split("")
    let pattern = ""
    for (let i = 0; i < chars.length; i++) {
      pattern += chars[i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      // Allow optional separator between letter-digit or digit-letter transitions
      if (i < chars.length - 1) {
        const curr = /[A-Z]/.test(chars[i])
        const next = /[A-Z]/.test(chars[i + 1])
        if (curr !== next) pattern += "[-\\/]?"
      }
    }
    return pattern
  })

  try {
    const regex = new RegExp(`(${patterns.join("|")})`, "gi")
    const parts = text.split(regex)

    return (
      <>
        {parts.map((part, i) =>
          regex.test(part) ? (
            <span key={i} className="bg-orange-100 border-b border-orange-400 font-bold text-orange-800 px-0.5">
              {part}
            </span>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </>
    )
  } catch {
    return <>{text}</>
  }
}
```

- [ ] **Step 2: Wire `HighlightedText` into `MatchRow` description (around line 734-736)**

Replace:
```tsx
            <div className="text-xs font-medium truncate text-zinc-700 dark:text-zinc-300">
                {e.lineDescription || e.description || "-"}
            </div>
```

With:
```tsx
            <div className="text-xs font-medium truncate text-zinc-700 dark:text-zinc-300">
                <HighlightedText text={e.lineDescription || e.description || "-"} matchedRefs={match.matchedRefs} />
            </div>
```

And for the reference line (around line 738-740):

Replace:
```tsx
            {e.reference && (
                <div className="text-[9px] text-zinc-400 font-mono truncate mt-0.5">
                    Ref: {e.reference}
                </div>
            )}
```

With:
```tsx
            {e.reference && (
                <div className="text-[9px] text-zinc-400 font-mono truncate mt-0.5">
                    Ref: <HighlightedText text={e.reference} matchedRefs={match.matchedRefs} />
                </div>
            )}
```

- [ ] **Step 3: Wire `HighlightedText` into `AutoMatchCard` description and reference**

In `AutoMatchCard`, replace the description (around line 672-673):

Replace:
```tsx
            <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate">
                {e.lineDescription || e.description || "-"}
            </div>
```

With:
```tsx
            <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate">
                <HighlightedText text={e.lineDescription || e.description || "-"} matchedRefs={match.matchedRefs} />
            </div>
```

And the reference (around line 675-678):

Replace:
```tsx
            {e.reference && (
                <div className="text-[9px] text-emerald-500 font-mono truncate mt-0.5">
                    Ref: {e.reference}
                </div>
            )}
```

With:
```tsx
            {e.reference && (
                <div className="text-[9px] text-emerald-500 font-mono truncate mt-0.5">
                    Ref: <HighlightedText text={e.reference} matchedRefs={match.matchedRefs} />
                </div>
            )}
```

- [ ] **Step 4: Add `ZeroMatchDiagnostic` component**

Add after the `HighlightedText` component:

```tsx
function ZeroMatchDiagnostic({
  currentItem,
  allSystemEntries,
}: {
  currentItem: ReconciliationItemData
  allSystemEntries: SystemEntryData[]
}) {
  const diagnostic = useMemo(() => {
    if (allSystemEntries.length === 0) {
      return { icon: AlertCircle, message: "Belum ada jurnal umum \u2014 buat jurnal baru?" }
    }

    const bankIsInflow = currentItem.bankAmount >= 0
    const sameDir = allSystemEntries.filter((e) => {
      const glIsInflow = e.amount >= 0
      return bankIsInflow === glIsInflow
    })

    if (sameDir.length === 0) {
      return {
        icon: ArrowRightLeft,
        message: `Semua jurnal GL berlawanan arah (bank: ${bankIsInflow ? "masuk" : "keluar"}, GL: semua ${bankIsInflow ? "keluar" : "masuk"})`,
      }
    }

    // Check date range
    const bankDate = currentItem.bankDate ? new Date(currentItem.bankDate) : null
    if (bankDate) {
      const within30 = sameDir.filter((e) => {
        const d = new Date(e.date)
        return Math.abs(d.getTime() - bankDate.getTime()) <= 30 * 86400000
      })
      if (within30.length === 0) {
        return {
          icon: AlertCircle,
          message: "Tidak ada jurnal dalam 30 hari dari tanggal bank",
        }
      }
    }

    // Check amount proximity
    const bankAbs = Math.abs(currentItem.bankAmount)
    const closest = sameDir.reduce((best, e) => {
      const diff = Math.abs(Math.abs(e.amount) - bankAbs)
      return diff < best.diff ? { diff, amount: Math.abs(e.amount) } : best
    }, { diff: Infinity, amount: 0 })

    if (closest.diff > 0 && bankAbs > 0) {
      const pct = (closest.diff / bankAbs * 100).toFixed(1)
      return {
        icon: AlertCircle,
        message: `Selisih jumlah terlalu besar \u2014 jurnal terdekat: Rp ${formatIDR(Math.round(closest.amount))} (selisih ${pct}%)`,
      }
    }

    return { icon: AlertCircle, message: "Tidak ada kecocokan ditemukan" }
  }, [currentItem, allSystemEntries])

  const Icon = diagnostic.icon

  return (
    <div className="p-8 text-center space-y-3">
      <Icon className="h-6 w-6 mx-auto text-zinc-300 mb-2" />
      <span className="text-[11px] font-bold text-zinc-500 block">
        Tidak ada jurnal yang cocok
      </span>
      <p className="text-[10px] text-zinc-400 italic">
        {diagnostic.message}
      </p>
    </div>
  )
}
```

- [ ] **Step 5: Wire `ZeroMatchDiagnostic` into `JournalSuggestions`**

In the `JournalSuggestions` component (around line 492-518), find the zero-match state:

Replace:
```tsx
                {totalFiltered === 0 && !showInlineForm ? (
                    <div className="p-8 text-center space-y-3">
                        <AlertCircle className="h-6 w-6 mx-auto text-zinc-300 mb-2" />
                        <span className="text-[11px] font-bold text-zinc-500 block">
                            {searchQuery ? `Tidak ada jurnal untuk "${searchQuery}"` : "Tidak ada jurnal yang bisa dicocokkan"}
                        </span>
                        <p className="text-[10px] text-zinc-400">
                            Buat jurnal baru untuk transaksi ini.
                        </p>
                        <div className="flex items-center justify-center gap-2 pt-1">
                            {onCreateJournalAndMatch && (
                                <Button
                                    variant="outline"
                                    className="h-8 text-[10px] font-black uppercase tracking-wider rounded-none border-2 border-amber-400 text-amber-700 bg-amber-50 hover:bg-amber-100 px-4"
                                    onClick={() => {
                                        setShowInlineForm(true)
                                        setInlineDescription(currentItem.bankDescription || "")
                                        setInlineDate(currentItem.bankDate ? currentItem.bankDate.slice(0, 10) : new Date().toISOString().slice(0, 10))
                                        setInlineRef(currentItem.bankRef || "")
                                        setInlineDebitCode("")
                                    }}
                                >
                                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Buat Jurnal Baru
                                </Button>
                            )}
                        </div>
                    </div>
```

With:
```tsx
                {totalFiltered === 0 && !showInlineForm ? (
                    <div>
                        {searchQuery ? (
                            <div className="p-8 text-center space-y-3">
                                <AlertCircle className="h-6 w-6 mx-auto text-zinc-300 mb-2" />
                                <span className="text-[11px] font-bold text-zinc-500 block">
                                    Tidak ada jurnal untuk &quot;{searchQuery}&quot;
                                </span>
                            </div>
                        ) : (
                            <ZeroMatchDiagnostic
                                currentItem={currentItem}
                                allSystemEntries={allSystemEntries}
                            />
                        )}
                        <div className="flex items-center justify-center gap-2 py-3">
                            {onCreateJournalAndMatch && (
                                <Button
                                    variant="outline"
                                    className="h-8 text-[10px] font-black uppercase tracking-wider rounded-none border-2 border-amber-400 text-amber-700 bg-amber-50 hover:bg-amber-100 px-4"
                                    onClick={() => {
                                        setShowInlineForm(true)
                                        setInlineDescription(currentItem.bankDescription || "")
                                        setInlineDate(currentItem.bankDate ? currentItem.bankDate.slice(0, 10) : new Date().toISOString().slice(0, 10))
                                        setInlineRef(currentItem.bankRef || "")
                                        setInlineDebitCode("")
                                    }}
                                >
                                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Buat Jurnal Baru
                                </Button>
                            )}
                        </div>
                    </div>
```

- [ ] **Step 6: Update AUTO tier header to show dynamic score instead of hardcoded "100%"**

In `JournalSuggestions` (around line 528-533), replace:
```tsx
                                <div className="px-4 py-2 bg-emerald-500 flex items-center gap-2">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-white">
                                        100% Cocok — Auto
                                    </span>
                                </div>
```

With:
```tsx
                                <div className="px-4 py-2 bg-emerald-500 flex items-center gap-2">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-white">
                                        Cocok Otomatis
                                    </span>
                                    <span className="text-[9px] font-mono font-bold text-emerald-200 ml-auto">
                                        {filteredAuto[0]?.score ?? 100}% kecocokan
                                    </span>
                                </div>
```

- [ ] **Step 7: Verify the page loads without errors**

```bash
npm run dev &
sleep 5
curl -s http://localhost:3002/finance/reconciliation | head -5
```

- [ ] **Step 8: Commit**

```bash
git add components/finance/reconciliation-focus-view.tsx
git commit -m "feat(bank-recon): reference highlight, zero-match diagnostic, dynamic AUTO score in focus view"
```

---

## Self-Review

### Spec Coverage Check

| Spec Requirement | Task |
|---|---|
| Upgrade client engine to 5-signal | Task 1 (Steps 1-7) |
| Direction indicator on BankLineCard | Task 2 (Steps 2-3) |
| DR/CR labels on GL entries | Task 2 (Step 4) |
| Signal breakdown bar | Task 2 (Steps 1, 5-6) |
| Reference highlight | Task 3 (Steps 1-3) |
| Zero-match diagnostic | Task 3 (Steps 4-5) |
| Queue sidebar direction dots | Task 2 (Step 7) |
| Dynamic AUTO score (not hardcoded 100%) | Task 3 (Step 6) |

No gaps found.

### Placeholder Scan

All code blocks are complete. No "TBD", "TODO", or "similar to above".

### Type Consistency Check

- `MatchSignals` — defined in Task 1 Step 1, used in Task 1 Steps 5-6, Task 2 Steps 1, 5-6. Consistent fields: `amount`, `reference`, `description`, `date`, `direction`.
- `ClientMatchResult.signals` — added in Task 1 Step 1, populated in Task 1 Step 5, consumed in Task 2 Steps 5-6.
- `ClientMatchResult.matchedRefs` — added in Task 1 Step 1, populated in Task 1 Step 5, consumed in Task 3 Steps 2-3.
- `SignalBar` — defined in Task 2 Step 1, used in Task 2 Steps 5-6. Props: `{ signals: MatchSignals; score: number }`.
- `HighlightedText` — defined in Task 3 Step 1, used in Task 3 Steps 2-3. Props: `{ text: string; matchedRefs: string[] }`.
- `ZeroMatchDiagnostic` — defined in Task 3 Step 4, used in Task 3 Step 5. Props: `{ currentItem: ReconciliationItemData; allSystemEntries: SystemEntryData[] }`.

All consistent.
