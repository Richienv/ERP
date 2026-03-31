import { describe, it, expect } from "vitest"
import { CMDK_BY_ID, buildActionUrl } from "@/lib/cmdk-registry"

describe("Cmd+K action execution — URL construction", () => {
  describe("Buat Produk Baru (act-create-product)", () => {
    const action = CMDK_BY_ID.get("act-create-product")!

    it("exists in the registry", () => {
      expect(action).toBeDefined()
    })

    it("is type open-dialog", () => {
      expect(action.type).toBe("open-dialog")
    })

    it("targets /inventory/products", () => {
      expect(action.route).toBe("/inventory/products")
    })

    it("has signal ?new=true", () => {
      expect(action.signal).toEqual({ param: "new", value: "true" })
    })

    it("buildActionUrl produces /inventory/products?new=true", () => {
      expect(buildActionUrl(action)).toBe("/inventory/products?new=true")
    })

    it("includes 'tambah material' in keywords", () => {
      expect(action.keywords).toContain("tambah material")
    })
  })

  describe("Buat Vendor Baru (act-create-vendor)", () => {
    const action = CMDK_BY_ID.get("act-create-vendor")!

    it("exists in the registry", () => {
      expect(action).toBeDefined()
    })

    it("is type open-dialog", () => {
      expect(action.type).toBe("open-dialog")
    })

    it("targets /procurement/vendors", () => {
      expect(action.route).toBe("/procurement/vendors")
    })

    it("has signal ?new=true", () => {
      expect(action.signal).toEqual({ param: "new", value: "true" })
    })

    it("buildActionUrl produces /procurement/vendors?new=true", () => {
      expect(buildActionUrl(action)).toBe("/procurement/vendors?new=true")
    })

    it("includes both Indonesian and English keywords", () => {
      expect(action.keywords).toContain("buat pemasok")
      expect(action.keywords).toContain("add supplier")
    })
  })

  describe("Buat Invoice Baru (act-create-invoice)", () => {
    const action = CMDK_BY_ID.get("act-create-invoice")!

    it("exists in the registry", () => {
      expect(action).toBeDefined()
    })

    it("is type open-dialog", () => {
      expect(action.type).toBe("open-dialog")
    })

    it("targets /finance/invoices", () => {
      expect(action.route).toBe("/finance/invoices")
    })

    it("has signal ?new=true", () => {
      expect(action.signal).toEqual({ param: "new", value: "true" })
    })

    it("buildActionUrl produces /finance/invoices?new=true", () => {
      expect(buildActionUrl(action)).toBe("/finance/invoices?new=true")
    })
  })

  describe("navigate-only actions have no signal", () => {
    const action = CMDK_BY_ID.get("nav-dashboard")!

    it("has type navigate", () => {
      expect(action.type).toBe("navigate")
    })

    it("has no signal", () => {
      expect(action.signal).toBeUndefined()
    })

    it("buildActionUrl returns plain route", () => {
      expect(buildActionUrl(action)).toBe("/dashboard")
    })
  })

  describe("non-boolean signal values", () => {
    const action = CMDK_BY_ID.get("act-import-products")!

    it("has signal ?action=import", () => {
      expect(action.signal).toEqual({ param: "action", value: "import" })
    })

    it("buildActionUrl produces /inventory/products?action=import", () => {
      expect(buildActionUrl(action)).toBe("/inventory/products?action=import")
    })
  })

  describe("all open-dialog actions have signals", () => {
    it("every open-dialog action has a signal defined", () => {
      for (const [id, action] of CMDK_BY_ID) {
        if (action.type === "open-dialog") {
          expect(action.signal, `${id} missing signal`).toBeDefined()
        }
      }
    })
  })

  describe("all trigger-fn actions have signals", () => {
    it("every trigger-fn action has a signal defined", () => {
      for (const [id, action] of CMDK_BY_ID) {
        if (action.type === "trigger-fn") {
          expect(action.signal, `${id} missing signal`).toBeDefined()
        }
      }
    })
  })
})
