/**
 * Multi-strategy ranked currency search with fuzzy matching.
 * No external dependencies — Jaro-Winkler implemented inline.
 */

export type RankedCurrency = {
  code: string
  name: string
  symbol: string
  score: number
  matchTier: 1 | 2 | 3 | 4
}

// ─── Alias map: en↔id synonyms for currency names ───
const ALIASES: Record<string, string[]> = {
  dollar: ["dolar"],
  dolar: ["dollar"],
  euro: ["eur"],
  eur: ["euro"],
  pound: ["sterling", "gbp"],
  yen: ["jpy"],
  yuan: ["cny", "rmb", "renminbi"],
  baht: ["thb"],
  ringgit: ["myr"],
  won: ["krw"],
  franc: ["chf"],
  america: ["amerika", "us", "usa", "usd"],
  amerika: ["america", "us", "usa", "usd"],
  singapore: ["singapura", "sgd"],
  singapura: ["singapore", "sgd"],
  australia: ["aud"],
  japan: ["jepang", "jpy"],
  jepang: ["japan", "jpy"],
  china: ["cina", "tiongkok", "cny"],
  cina: ["china", "tiongkok", "cny"],
  tiongkok: ["china", "cina", "cny"],
  sterling: ["pound", "gbp"],
  swiss: ["chf"],
  korea: ["krw"],
  hong: ["hkd"],
  taiwan: ["twd"],
  india: ["inr"],
  filipina: ["php"],
  vietnam: ["vnd"],
  saudi: ["sar"],
  emirat: ["aed"],
  selandia: ["nzd"],
  kanada: ["cad"],
  swedia: ["sek"],
  brasil: ["brl"],
  malaysia: ["myr"],
  thailand: ["thb"],
}

// ─── Jaro-Winkler Similarity ───
function jaroWinkler(s1: string, s2: string): number {
  if (s1 === s2) return 1.0
  const len1 = s1.length
  const len2 = s2.length
  if (len1 === 0 || len2 === 0) return 0.0

  const matchWindow = Math.max(Math.floor(Math.max(len1, len2) / 2) - 1, 0)

  const s1Matches = new Array(len1).fill(false)
  const s2Matches = new Array(len2).fill(false)

  let matches = 0
  let transpositions = 0

  // Count matches
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchWindow)
    const end = Math.min(i + matchWindow + 1, len2)
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue
      s1Matches[i] = true
      s2Matches[j] = true
      matches++
      break
    }
  }

  if (matches === 0) return 0.0

  // Count transpositions
  let k = 0
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue
    while (!s2Matches[k]) k++
    if (s1[i] !== s2[k]) transpositions++
    k++
  }

  const jaro =
    (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3

  // Winkler bonus: up to 4-char common prefix
  let prefix = 0
  for (let i = 0; i < Math.min(4, Math.min(len1, len2)); i++) {
    if (s1[i] === s2[i]) prefix++
    else break
  }

  return jaro + prefix * 0.1 * (1 - jaro)
}

// ─── Expand a query into its aliases ───
function expandQuery(query: string): string[] {
  const words = query.toLowerCase().split(/\s+/)
  const expanded = new Set<string>(words)
  for (const word of words) {
    const aliases = ALIASES[word]
    if (aliases) {
      for (const alias of aliases) {
        expanded.add(alias)
      }
    }
  }
  return Array.from(expanded)
}

// ─── Main search function ───
export function searchCurrencies(
  query: string,
  currencies: { code: string; name: string; symbol: string }[]
): RankedCurrency[] {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []

  const expandedTerms = expandQuery(q)
  const results: RankedCurrency[] = []
  const seen = new Set<string>()

  for (const c of currencies) {
    const codeLower = c.code.toLowerCase()
    const nameLower = c.name.toLowerCase()
    const nameWords = nameLower.split(/\s+/)

    let bestScore = 0
    let bestTier: 1 | 2 | 3 | 4 = 4

    // ── Tier 1: Exact or prefix match on code or name start ──
    if (codeLower === q || codeLower.startsWith(q)) {
      bestScore = 100
      bestTier = 1
    } else if (nameLower.startsWith(q)) {
      bestScore = 100
      bestTier = 1
    } else {
      // Check if any expanded term prefix-matches code
      for (const term of expandedTerms) {
        if (codeLower === term || codeLower.startsWith(term)) {
          bestScore = 100
          bestTier = 1
          break
        }
      }
    }

    // ── Tier 2: Token/keyword match (expanded with aliases) ──
    if (bestScore < 70) {
      for (const term of expandedTerms) {
        for (const word of nameWords) {
          if (word.startsWith(term) || word === term) {
            bestScore = 70
            bestTier = 2
            break
          }
        }
        if (bestScore >= 70) break
        // Also check code match via alias
        if (codeLower === term) {
          bestScore = 70
          bestTier = 2
          break
        }
      }
    }

    // ── Tier 3: Substring match anywhere ──
    if (bestScore < 50) {
      if (codeLower.includes(q) || nameLower.includes(q)) {
        bestScore = 50
        bestTier = 3
      } else {
        // Check expanded terms for substring
        for (const term of expandedTerms) {
          if (nameLower.includes(term)) {
            bestScore = 50
            bestTier = 3
            break
          }
        }
      }
    }

    // ── Tier 4: Fuzzy match (Jaro-Winkler) ──
    if (bestScore < 1) {
      // Compare query against each name word and against code
      let maxSim = jaroWinkler(q, codeLower)
      for (const word of nameWords) {
        const sim = jaroWinkler(q, word)
        if (sim > maxSim) maxSim = sim
      }
      if (maxSim > 0.6) {
        bestScore = Math.floor(maxSim * 40)
        bestTier = 4
      }
    }

    if (bestScore > 0 && !seen.has(c.code)) {
      seen.add(c.code)
      results.push({
        code: c.code,
        name: c.name,
        symbol: c.symbol,
        score: bestScore,
        matchTier: bestTier,
      })
    }
  }

  // Sort: descending by score, then alphabetically by name
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.name.localeCompare(b.name)
  })

  // Cap at 8 results
  return results.slice(0, 8)
}
