import { describe, it, expect } from "vitest"
import {
  findMatches,
  type BankLine,
  type SystemTransaction,
} from "@/lib/finance-reconciliation-helpers"

const makeBank = (overrides: Partial<BankLine> = {}): BankLine => ({
  id: "bank-1",
  bankDate: new Date("2026-03-01"),
  bankAmount: 5000000,
  bankDescription: "TRF/INV/2026/001",
  bankRef: "INV-2026-001",
  ...overrides,
})

const makeTxn = (overrides: Partial<SystemTransaction> = {}): SystemTransaction => ({
  id: "txn-1",
  date: new Date("2026-03-01"),
  amount: 5000000,
  description: "Pembayaran Invoice INV-2026-001",
  reference: "INV-2026-001",
  ...overrides,
})

describe("findMatches - Pass 1: HIGH confidence", () => {
  it("matches exact amount + date within 3 days + reference substring", () => {
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

  it("does not match HIGH when reference doesn't match", () => {
    const results = findMatches(
      makeBank({ bankRef: "DIFFERENT-REF", bankDescription: "Unrelated transfer" }),
      [makeTxn()]
    )
    const highResults = results.filter(r => r.confidence === "HIGH")
    expect(highResults).toHaveLength(0)
  })
})

describe("findMatches - Pass 2: MEDIUM confidence", () => {
  it("matches exact amount + date within 3 days without reference", () => {
    const results = findMatches(
      makeBank({ bankRef: "", bankDescription: "TRF MASUK" }),
      [makeTxn({ reference: null })]
    )
    expect(results).toHaveLength(1)
    expect(results[0].confidence).toBe("MEDIUM")
  })
})

describe("findMatches - Pass 3: LOW confidence", () => {
  it("matches amount within Rp 100 tolerance + date within 5 days", () => {
    const results = findMatches(
      makeBank({ bankAmount: 5000050, bankDate: new Date("2026-03-05") }),
      [makeTxn()]
    )
    expect(results).toHaveLength(1)
    expect(results[0].confidence).toBe("LOW")
  })

  it("does not match when amount differs by more than Rp 100", () => {
    const results = findMatches(
      makeBank({ bankAmount: 5001000 }),
      [makeTxn()]
    )
    expect(results).toHaveLength(0)
  })
})

describe("findMatches - scoring", () => {
  it("returns highest confidence match first when multiple exist", () => {
    const results = findMatches(
      makeBank(),
      [
        makeTxn({ id: "txn-high", reference: "INV-2026-001" }),
        makeTxn({ id: "txn-medium", reference: null, date: new Date("2026-03-02") }),
      ]
    )
    expect(results[0].confidence).toBe("HIGH")
  })

  it("returns empty array when no matches", () => {
    const results = findMatches(
      makeBank({ bankAmount: 99999999 }),
      [makeTxn()]
    )
    expect(results).toHaveLength(0)
  })
})
