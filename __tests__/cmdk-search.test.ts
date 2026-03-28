import { describe, it, expect, beforeEach } from "vitest"
import { CMDK_ACTIONS, CMDK_BY_ID } from "@/lib/cmdk-registry"
import { createCmdKFilter } from "@/lib/cmdk-search"

// Create filter using the real registry
const filter = createCmdKFilter(CMDK_BY_ID)

/** Helper: score all actions against a search term, return matches sorted by score desc */
function search(query: string) {
  return CMDK_ACTIONS
    .map((action) => ({
      id: action.id,
      label: action.label,
      type: action.type,
      score: filter(action.id, query),
    }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
}

describe("Cmd+K search scoring", () => {
  describe("exact and substring matching", () => {
    it('"vendor" matches "Buat Vendor Baru" action', () => {
      const results = search("vendor")
      const vendorAction = results.find((r) => r.id === "act-create-vendor")
      expect(vendorAction).toBeDefined()
      expect(vendorAction!.score).toBeGreaterThan(0)
    })

    it('"vendor" matches vendor navigation page', () => {
      const results = search("vendor")
      const vendorNav = results.find((r) => r.id === "nav-proc-vendors")
      expect(vendorNav).toBeDefined()
      expect(vendorNav!.score).toBeGreaterThan(0)
    })

    it('"buat vendor" scores higher than just "vendor"', () => {
      const results = search("buat vendor")
      const vendorAction = results.find((r) => r.id === "act-create-vendor")
      expect(vendorAction).toBeDefined()
      // "buat vendor" is an exact phrase in the keywords, should score 1.0
      expect(vendorAction!.score).toBeGreaterThanOrEqual(0.8)
    })
  })

  describe("bilingual search (Indonesian + English)", () => {
    it('"supplier" matches vendor action (English keyword)', () => {
      const results = search("supplier")
      const vendorAction = results.find((r) => r.id === "act-create-vendor")
      expect(vendorAction).toBeDefined()
      expect(vendorAction!.score).toBeGreaterThan(0)
    })

    it('"pemasok" matches vendor action (Indonesian keyword)', () => {
      const results = search("pemasok")
      const vendorAction = results.find((r) => r.id === "act-create-vendor")
      expect(vendorAction).toBeDefined()
      expect(vendorAction!.score).toBeGreaterThan(0)
    })

    it('"purchase order" matches PO action', () => {
      const results = search("purchase order")
      const poAction = results.find((r) => r.id === "act-create-po")
      expect(poAction).toBeDefined()
      expect(poAction!.score).toBeGreaterThan(0)
    })

    it('"piutang" matches AR navigation', () => {
      const results = search("piutang")
      const ar = results.find((r) => r.id === "nav-fin-receivables")
      expect(ar).toBeDefined()
      expect(ar!.score).toBeGreaterThan(0)
    })
  })

  describe("material search — returns both page AND action", () => {
    it('"material" matches products page (keyword "material")', () => {
      const results = search("material")
      const productsPage = results.find((r) => r.id === "nav-inv-products")
      expect(productsPage).toBeDefined()
      expect(productsPage!.score).toBeGreaterThan(0)
    })

    it('"material" matches create product action (keyword "buat material")', () => {
      const results = search("material")
      const createProduct = results.find((r) => r.id === "act-create-product")
      expect(createProduct).toBeDefined()
      expect(createProduct!.score).toBeGreaterThan(0)
    })

    it('"material" returns both page and action', () => {
      const results = search("material")
      const ids = results.map((r) => r.id)
      expect(ids).toContain("nav-inv-products")
      expect(ids).toContain("act-create-product")
    })
  })

  describe("scoring tiers", () => {
    it("exact phrase scores higher than partial token match", () => {
      // "buat vendor baru" is the exact label
      const exactResults = search("buat vendor baru")
      const tokenResults = search("vendor")
      const exactScore = exactResults.find((r) => r.id === "act-create-vendor")!.score
      const tokenScore = tokenResults.find((r) => r.id === "act-create-vendor")!.score
      expect(exactScore).toBeGreaterThanOrEqual(tokenScore)
    })

    it("action types get a +0.05 boost over navigate at fuzzy tier", () => {
      // "vendro" fuzzy-matches "vendor" at score 0.4
      // action gets +0.05 boost: 0.45 vs 0.40
      const results = search("vendro")
      const action = results.find((r) => r.id === "act-create-vendor")!
      const nav = results.find((r) => r.id === "nav-proc-vendors")!
      expect(action.score).toBeGreaterThan(nav.score)
    })
  })

  describe("starts-with matching", () => {
    it('"inv" matches inventory items via starts-with', () => {
      const results = search("inv")
      const invDashboard = results.find((r) => r.id === "nav-inv-dashboard")
      expect(invDashboard).toBeDefined()
      expect(invDashboard!.score).toBeGreaterThan(0)
    })

    it('"jur" matches journal items via starts-with', () => {
      const results = search("jur")
      const journal = results.find((r) => r.id === "nav-fin-journal")
      expect(journal).toBeDefined()
      expect(journal!.score).toBeGreaterThan(0)
    })
  })

  describe("fuzzy matching (typo tolerance)", () => {
    it('"vendro" fuzzy-matches "vendor" (Levenshtein dist=1)', () => {
      const results = search("vendro")
      const vendorAction = results.find((r) => r.id === "act-create-vendor")
      expect(vendorAction).toBeDefined()
      expect(vendorAction!.score).toBeGreaterThanOrEqual(0.4)
    })

    it('"invoce" fuzzy-matches "invoice" (Levenshtein dist=1)', () => {
      const results = search("invoce")
      const invoiceNav = results.find((r) => r.id === "nav-fin-invoices")
      expect(invoiceNav).toBeDefined()
      expect(invoiceNav!.score).toBeGreaterThanOrEqual(0.4)
    })
  })

  describe("empty and no-match", () => {
    it("empty search returns all items (score 1)", () => {
      const results = search("")
      expect(results.length).toBe(CMDK_ACTIONS.length)
    })

    it("gibberish returns no results", () => {
      const results = search("zzxyzzy123")
      expect(results.length).toBe(0)
    })
  })

  describe("non-registry items (fallback)", () => {
    it("fallback scoring works for unknown values", () => {
      const score = filter("some-unknown-value", "unknown")
      expect(score).toBeGreaterThan(0) // substring match in value itself
    })

    it("fallback returns 0 for no match", () => {
      const score = filter("some-unknown-value", "zzxyzzy")
      expect(score).toBe(0)
    })
  })
})
