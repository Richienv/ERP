import { describe, it, expect } from "vitest"
import { generateNarrative, computeChanges } from "@/lib/audit-helpers"

describe("generateNarrative", () => {
  it("generates Indonesian narrative for creation", () => {
    const result = generateNarrative("Invoice", "CREATE", "admin@test.com", {})
    expect(result).toContain("membuat")
    expect(result).toContain("Invoice")
  })

  it("generates narrative for status change", () => {
    const result = generateNarrative("Invoice", "STATUS_CHANGE", "admin@test.com", {
      status: { from: "DRAFT", to: "ISSUED" },
    })
    expect(result).toContain("DRAFT")
    expect(result).toContain("ISSUED")
  })

  it("generates narrative for field update", () => {
    const result = generateNarrative("Product", "UPDATE", "admin@test.com", {
      name: { from: "Kain A", to: "Kain B" },
      price: { from: 50000, to: 55000 },
    })
    expect(result).toContain("name")
    expect(result).toContain("price")
  })
})

describe("computeChanges", () => {
  it("detects changed fields", () => {
    const before = { name: "A", price: 100, status: "DRAFT" }
    const after = { name: "B", price: 100, status: "DRAFT" }
    const changes = computeChanges(before, after)
    expect(changes).toEqual({ name: { from: "A", to: "B" } })
  })

  it("ignores updatedAt field", () => {
    const before = { name: "A", updatedAt: new Date("2026-01-01") }
    const after = { name: "A", updatedAt: new Date("2026-03-10") }
    const changes = computeChanges(before, after)
    expect(changes).toEqual({})
  })

  it("returns empty for identical objects", () => {
    const obj = { name: "A", price: 100 }
    const changes = computeChanges(obj, obj)
    expect(changes).toEqual({})
  })
})
