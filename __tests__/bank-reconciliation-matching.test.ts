import { describe, it, expect } from "vitest"
import {
  findMatches,
  computeMatchScore,
  extractDocNumbers,
  scoreReference,
  normalizeBankDescription,
  type BankLine,
  type SystemTransaction,
} from "@/lib/finance-reconciliation-helpers"

// =============================================================================
// Factories
// =============================================================================

const makeBank = (overrides: Partial<BankLine> = {}): BankLine => ({
  id: "bank-1",
  bankDate: new Date("2026-03-01"),
  bankAmount: 5000000,
  bankDescription: "TRF/INV/2026/001",
  bankRef: "INV-2026-001",
  ...overrides,
})

const makeTxn = (
  overrides: Partial<SystemTransaction> = {}
): SystemTransaction => ({
  id: "txn-1",
  date: new Date("2026-03-01"),
  amount: 5000000,
  description: "Pembayaran Invoice INV-2026-001",
  reference: "INV-2026-001",
  ...overrides,
})

// =============================================================================
// Core matching — tier classification
// =============================================================================

describe("findMatches - HIGH confidence", () => {
  it("matches exact amount + date + reference -> HIGH", () => {
    const results = findMatches(makeBank(), [makeTxn()])
    expect(results).toHaveLength(1)
    expect(results[0].confidence).toBe("HIGH")
    expect(results[0].transactionId).toBe("txn-1")
  })

  it("matches when date is within 3 days", () => {
    const results = findMatches(
      makeBank({ bankDate: new Date("2026-03-03") }),
      [makeTxn({ date: new Date("2026-03-01") })]
    )
    expect(results).toHaveLength(1)
    expect(results[0].confidence).toBe("HIGH")
  })

  it("does not match HIGH when reference and description both mismatch", () => {
    const results = findMatches(
      makeBank({
        bankRef: "DIFFERENT-REF",
        bankDescription: "Unrelated transfer",
      }),
      [makeTxn()]
    )
    const highResults = results.filter((r) => r.confidence === "HIGH")
    expect(highResults).toHaveLength(0)
  })
})

describe("findMatches - MEDIUM confidence", () => {
  it("matches exact amount + same date without reference -> MEDIUM", () => {
    const results = findMatches(
      makeBank({ bankRef: "", bankDescription: "TRF MASUK" }),
      [makeTxn({ reference: null })]
    )
    expect(results).toHaveLength(1)
    expect(results[0].confidence).toBe("MEDIUM")
  })
})

describe("findMatches - amount edge cases", () => {
  it("Rp 50 diff + ref match + 4-day offset -> HIGH (new engine: ref-first)", () => {
    // Old engine: LOW (strict name match required). New: ref match + tiny % diff = HIGH.
    const results = findMatches(
      makeBank({ bankAmount: 5000050, bankDate: new Date("2026-03-05") }),
      [makeTxn()]
    )
    expect(results).toHaveLength(1)
    expect(results[0].confidence).toBe("HIGH")
  })

  it("Rp 1000 diff on Rp 5M with ref match -> still HIGH (0.02%)", () => {
    // Old engine: 0 results. New: 0.02% diff is sub-0.5% threshold.
    const results = findMatches(makeBank({ bankAmount: 5001000 }), [makeTxn()])
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].confidence).toBe("HIGH")
  })
})

describe("findMatches - scoring", () => {
  it("returns highest confidence match first when multiple exist", () => {
    const results = findMatches(makeBank(), [
      makeTxn({ id: "txn-high", reference: "INV-2026-001" }),
      makeTxn({
        id: "txn-medium",
        reference: null,
        description: "Transfer masuk",
        date: new Date("2026-03-02"),
      }),
    ])
    expect(results[0].confidence).toBe("HIGH")
  })

  it("returns no MEDIUM/HIGH results when amount wildly different and no ref", () => {
    const results = findMatches(
      makeBank({
        bankAmount: 99999999,
        bankDescription: "RANDOM TRF",
        bankRef: "",
      }),
      [makeTxn({ reference: null })]
    )
    const meaningful = results.filter((r) => r.confidence !== "LOW")
    expect(meaningful).toHaveLength(0)
  })
})

// =============================================================================
// Task 1: Direction-sign enforcement
// =============================================================================

describe("Task 1: direction-sign enforcement", () => {
  it("A: direction mismatch (bank + vs GL -) -> score = 0, no results", () => {
    const bank = makeBank({ bankAmount: 300000 }) // positive = deposit
    const txn = makeTxn({ amount: -300000 }) // negative = credit (money out)
    const results = findMatches(bank, [txn])
    expect(results).toHaveLength(0)
  })

  it("bank negative matches GL negative (both money out)", () => {
    const bank = makeBank({ bankAmount: -5000000 })
    const txn = makeTxn({ amount: -5000000 })
    const results = findMatches(bank, [txn])
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].score).toBeGreaterThan(0)
  })

  it("bank positive matches GL positive (both money in)", () => {
    const results = findMatches(
      makeBank({ bankAmount: 5000000 }),
      [makeTxn({ amount: 5000000 })]
    )
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].confidence).toBe("HIGH")
  })

  it("computeMatchScore returns score 0 on direction mismatch", () => {
    const scoring = computeMatchScore(
      makeBank({ bankAmount: 5000000 }),
      makeTxn({ amount: -5000000 })
    )
    expect(scoring.score).toBe(0)
  })
})

// =============================================================================
// Task 2: Percentage-based amount tolerance
// =============================================================================

describe("Task 2: percentage-based amount tolerance", () => {
  it("D: large amount, small % diff (Rp 350 on Rp 933M) -> HIGH score", () => {
    const results = findMatches(
      makeBank({
        bankAmount: 933250000,
        bankDescription: "TRF/INV-2026-050",
        bankRef: "INV-2026-050",
      }),
      [
        makeTxn({
          amount: 933249650,
          reference: "INV-2026-050",
          description: "Invoice INV-2026-050",
        }),
      ]
    )
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].score).toBeGreaterThanOrEqual(70)
  })

  it("G: Rp 100k vs Rp 106.5k (6.5% diff) should NOT match as MEDIUM/HIGH", () => {
    const results = findMatches(
      makeBank({
        bankAmount: 100000,
        bankDescription: "Transfer",
        bankRef: "",
      }),
      [makeTxn({ amount: 106500, description: "Payment", reference: null })]
    )
    const meaningful = results.filter((r) => r.confidence !== "LOW")
    expect(meaningful).toHaveLength(0)
  })

  it("0.3% diff on Rp 10M -> still matches as POTENTIAL or better", () => {
    const results = findMatches(
      makeBank({
        bankAmount: 10000000,
        bankDescription: "TRF MASUK",
        bankRef: "",
      }),
      [makeTxn({ amount: 9970000, reference: null, description: "TRF MASUK" })]
    )
    const potentialOrBetter = results.filter((r) => r.confidence !== "LOW")
    expect(potentialOrBetter.length).toBeGreaterThan(0)
  })
})

// =============================================================================
// Task 3: Token-based description matching
// =============================================================================

describe("Task 3: token-based description matching", () => {
  it("extractDocNumbers finds INV pattern", () => {
    const docs = extractDocNumbers("TRF/INV-2026-001/BCA")
    expect(docs.length).toBeGreaterThan(0)
    expect(docs[0]).toBe("INV2026001")
  })

  it("extractDocNumbers finds 16-digit VA number", () => {
    const docs = extractDocNumbers("BIFAST/8800012345678901")
    expect(docs).toContain("8800012345678901")
  })

  it("normalizeBankDescription strips known prefixes", () => {
    expect(
      normalizeBankDescription("TRSF E-BANKING DR/PT RICHIE CEPAT")
    ).toBe("PT RICHIE CEPAT")
    expect(normalizeBankDescription("BIFAST/INV-2026-001")).toBe(
      "INV 2026 001"
    )
  })

  it("token matching handles reordered words", () => {
    const bank = makeBank({
      bankAmount: 5000000,
      bankDescription: "PAYMENT PT RICHIE CEPAT",
      bankRef: "",
    })
    const txn = makeTxn({
      amount: 5000000,
      description: "PT Richie Cepat Payment",
      reference: null,
    })
    const results = findMatches(bank, [txn])
    expect(results.length).toBeGreaterThan(0)
    // Token matching makes reordered words score well
    expect(results[0].score).toBeGreaterThanOrEqual(40)
  })
})

// =============================================================================
// Task 4: Reference match bonus
// =============================================================================

describe("Task 4: reference match bonus", () => {
  it("E: ref match forces score >= 75 even with poor description/date", () => {
    const bank = makeBank({
      bankDescription: "BIFAST/INV-2026-0012/PT XYZ",
      bankRef: "",
      bankAmount: 5000000,
      bankDate: new Date("2026-03-15"),
    })
    const txn = makeTxn({
      description: "Pembayaran vendor",
      reference: "INV-2026-0012",
      amount: 5000000,
      date: new Date("2026-03-01"),
    })
    const results = findMatches(bank, [txn])
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].score).toBeGreaterThanOrEqual(75)
  })

  it("F: VA number reference match -> refSignal = 1.0", () => {
    const bank = makeBank({
      bankDescription: "BIFAST/8800012345678901",
      bankRef: "",
      bankAmount: 1000000,
    })
    const txn = makeTxn({
      reference: "8800012345678901",
      amount: 1000000,
      description: "Payment VA",
    })
    const scoring = computeMatchScore(bank, txn)
    expect(scoring.refSignal).toBe(1.0)
    expect(scoring.score).toBeGreaterThanOrEqual(75)
  })

  it("ref match elevates score above non-ref match of same amount", () => {
    const bankItem = makeBank({
      bankRef: "INV-2026-005",
      bankDescription: "INCOMING TRF",
      bankAmount: 7500000,
    })
    const txnWithRef = makeTxn({
      id: "with-ref",
      reference: "INV-2026-005",
      amount: 7500000,
      description: "Some payment",
    })
    const txnNoRef = makeTxn({
      id: "no-ref",
      reference: null,
      amount: 7500000,
      description: "Some payment",
    })
    const results = findMatches(bankItem, [txnWithRef, txnNoRef])
    const withRefResult = results.find((r) => r.transactionId === "with-ref")
    const noRefResult = results.find((r) => r.transactionId === "no-ref")
    expect(withRefResult).toBeDefined()
    expect(noRefResult).toBeDefined()
    expect(withRefResult!.score).toBeGreaterThan(noRefResult!.score)
  })

  it("scoreReference returns 1.0 for exact match, 0.85 for substring", () => {
    expect(scoreReference(["INV2026001"], ["INV2026001"])).toBe(1.0)
    expect(scoreReference(["INV2026"], ["INV2026001"])).toBe(0.85)
    expect(scoreReference(["RANDOM"], ["DIFFERENT"])).toBe(0)
    expect(scoreReference([], ["INV2026001"])).toBe(0)
  })
})

// =============================================================================
// Task 6: Composite scoring integration
// =============================================================================

describe("Composite scoring integration", () => {
  it("B: exact match (same amount + description + date + ref) -> score >= 92", () => {
    const bank = makeBank({
      bankAmount: 5000000,
      bankDescription: "PT Richie Cepat Payment",
      bankRef: "INV-2026-001",
    })
    const txn = makeTxn({
      amount: 5000000,
      description: "PT Richie Cepat Payment",
      reference: "INV-2026-001",
    })
    const results = findMatches(bank, [txn])
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].score).toBeGreaterThanOrEqual(92)
  })

  it("C: fuzzy name + 1-day offset -> 55-85 range", () => {
    const bank = makeBank({
      bankAmount: 5000000,
      bankDescription: "PT Richie Cepot",
      bankRef: "",
      bankDate: new Date("2026-03-02"),
    })
    const txn = makeTxn({
      amount: 5000000,
      description: "PT Richie Cepat",
      reference: null,
      date: new Date("2026-03-01"),
    })
    const results = findMatches(bank, [txn])
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].score).toBeGreaterThanOrEqual(55)
    expect(results[0].score).toBeLessThanOrEqual(85)
  })
})

// =============================================================================
// 99% → 100% rounding fix
// =============================================================================

describe("99% score rounding fix", () => {
  it("should round 99% score to 100% (sub-rupiah rounding artifact)", () => {
    // Near-perfect match: sub-rupiah diff + exact ref + same date + good desc
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
    expect(result.score).toBe(100)
  })
})
