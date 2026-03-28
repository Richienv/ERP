// lib/cmdk-search.ts
// Custom scoring function for the Cmd+K command palette.
// Implements: exact > starts-with > all-tokens > fuzzy, with usage + action boosts.

import type { CmdKAction } from "./cmdk-registry"

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

/** Lowercase + strip diacritics so "Crédit" matches "credit" */
function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

// ---------------------------------------------------------------------------
// Levenshtein distance (bounded — bails early when > maxDist)
// ---------------------------------------------------------------------------

function levenshtein(a: string, b: string, maxDist: number): number {
  const la = a.length
  const lb = b.length
  if (Math.abs(la - lb) > maxDist) return maxDist + 1

  // Single-row DP
  const row: number[] = Array.from({ length: lb + 1 }, (_, i) => i)
  for (let i = 1; i <= la; i++) {
    let prev = i
    let rowMin = prev
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      const val = Math.min(
        row[j] + 1,      // deletion
        prev + 1,         // insertion
        row[j - 1] + cost // substitution
      )
      row[j - 1] = prev
      prev = val
      if (val < rowMin) rowMin = val
    }
    row[lb] = prev
    // Early exit — entire row exceeds maxDist
    if (rowMin > maxDist) return maxDist + 1
  }
  return row[lb]
}

// ---------------------------------------------------------------------------
// Fuzzy matching (design doc §3.2)
// ---------------------------------------------------------------------------

function fuzzyMatch(searchToken: string, corpus: string): boolean {
  // Short tokens — require exact substring
  if (searchToken.length <= 3) return corpus.includes(searchToken)

  // Longer tokens — allow Levenshtein distance 1-2
  const words = corpus.split(/\s+/)
  const maxDist = searchToken.length <= 5 ? 1 : 2

  return words.some((word) => levenshtein(searchToken, word, maxDist) <= maxDist)
}

// ---------------------------------------------------------------------------
// Usage frequency tracking (localStorage)
// ---------------------------------------------------------------------------

const USAGE_KEY = "erp_cmdk_usage"
const USAGE_MAX = 200

interface UsageEntry {
  count: number
  last: number
}

type UsageMap = Record<string, UsageEntry>

function getUsageMap(): UsageMap {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(USAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveUsageMap(map: UsageMap) {
  try {
    const entries = Object.entries(map)
    if (entries.length > USAGE_MAX) {
      entries.sort((a, b) => b[1].count - a[1].count)
      map = Object.fromEntries(entries.slice(0, USAGE_MAX))
    }
    localStorage.setItem(USAGE_KEY, JSON.stringify(map))
  } catch {
    // silently fail
  }
}

/** Record that an action was selected */
export function recordActionUsage(actionId: string) {
  const map = getUsageMap()
  const existing = map[actionId] || { count: 0, last: 0 }
  map[actionId] = { count: existing.count + 1, last: Date.now() }
  saveUsageMap(map)
}

/** Get usage count for a specific action */
export function getActionUsageCount(actionId: string): number {
  const map = getUsageMap()
  return map[actionId]?.count ?? 0
}

/** Get recently used action IDs sorted by recency, up to `limit` */
export function getRecentActionIds(limit = 5): string[] {
  const map = getUsageMap()
  return Object.entries(map)
    .sort((a, b) => b[1].last - a[1].last)
    .slice(0, limit)
    .map(([id]) => id)
}

// ---------------------------------------------------------------------------
// Scoring function (design doc §3.1 + §3.4)
// ---------------------------------------------------------------------------

/**
 * Usage boost: 0.0 – 0.1 based on frequency.
 * Top used action gets +0.1, others scale linearly.
 */
function getUsageBoost(actionId: string): number {
  const map = getUsageMap()
  const entry = map[actionId]
  if (!entry || entry.count === 0) return 0

  // Find max count across all entries
  let maxCount = 1
  for (const k in map) {
    if (map[k].count > maxCount) maxCount = map[k].count
  }

  return (entry.count / maxCount) * 0.1
}

/**
 * Custom filter for cmdk's `filter` prop.
 *
 * `value` = action.id (set on the cmdk Item)
 * We look up the action to get label + keywords for matching.
 *
 * Returns 0-1 score. 0 = hidden from results.
 */
export function createCmdKFilter(actionMap: ReadonlyMap<string, CmdKAction>) {
  return function cmdkFilter(value: string, search: string): number {
    if (!search) return 1 // show everything when search is empty

    const action = actionMap.get(value)
    if (!action) {
      // Fallback for non-registry items (recent pages, etc.)
      // Do basic substring matching on the value itself
      const nv = normalize(value)
      const ns = normalize(search)
      if (nv.includes(ns)) return 0.7
      const tokens = ns.split(/\s+/).filter(Boolean)
      if (tokens.every((t) => nv.includes(t))) return 0.5
      if (tokens.some((t) => nv.split(/\s+/).some((w) => w.startsWith(t)))) return 0.3
      return 0
    }

    // Build the searchable corpus: label + all keywords
    const corpus = normalize(
      action.label + " " + action.keywords.join(" ")
    )
    const ns = normalize(search)
    const tokens = ns.split(/\s+/).filter(Boolean)

    let score = 0

    // 1. Exact phrase match (highest)
    if (corpus.includes(ns)) {
      score = 1.0
    }
    // 2. All tokens present (AND logic)
    else if (tokens.every((t) => corpus.includes(t))) {
      score = 0.8
    }
    // 3. Starts-with on any corpus word
    else if (
      tokens.some((t) =>
        corpus.split(/\s+/).some((w) => w.startsWith(t))
      )
    ) {
      score = 0.6
    }
    // 4. Fuzzy match (Levenshtein)
    else if (tokens.some((t) => fuzzyMatch(t, corpus))) {
      score = 0.4
    }
    // 5. No match
    else {
      return 0
    }

    // Boost: action types rank above navigate
    if (action.type !== "navigate") {
      score = Math.min(1.0, score + 0.05)
    }

    // Boost: usage frequency
    score = Math.min(1.0, score + getUsageBoost(action.id))

    return score
  }
}
