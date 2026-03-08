import { describe, it, expect } from "vitest"
import { calculateBOMCost, type BOMCostInput } from "@/lib/bom-costing"

describe("calculateBOMCost", () => {
  const baseBOM: BOMCostInput = {
    id: "bom-001",
    productId: "prod-001",
    productName: "Kaos Polos",
    outputQty: 1,
    items: [
      {
        id: "item-1",
        materialId: "mat-1",
        materialCode: "KAI-001",
        materialName: "Kain Cotton 30s",
        unit: "meter",
        quantity: 1.5,
        wastePct: 5,
        unitCost: 35000,
      },
      {
        id: "item-2",
        materialId: "mat-2",
        materialCode: "BEN-001",
        materialName: "Benang Jahit",
        unit: "cone",
        quantity: 0.2,
        wastePct: 0,
        unitCost: 15000,
      },
      {
        id: "item-3",
        materialId: "mat-3",
        materialCode: "LBL-001",
        materialName: "Label Brand",
        unit: "pcs",
        quantity: 1,
        wastePct: 2,
        unitCost: 500,
      },
    ],
  }

  it("calculates total material cost correctly", () => {
    const result = calculateBOMCost(baseBOM)

    // Item 1: 1.5 * 1.05 * 35000 = 55125
    // Item 2: 0.2 * 1.00 * 15000 = 3000
    // Item 3: 1.0 * 1.02 * 500 = 510
    // Total: 55125 + 3000 + 510 = 58635
    expect(result.totalMaterialCost).toBe(55125 + 3000 + 510)
    expect(result.itemCount).toBe(3)
  })

  it("includes waste percentage in effective quantity", () => {
    const result = calculateBOMCost(baseBOM)

    const kain = result.items.find((i) => i.id === "item-1")!
    expect(kain.effectiveQty).toBe(1.575) // 1.5 * 1.05
    expect(kain.wastePct).toBe(5)

    const benang = result.items.find((i) => i.id === "item-2")!
    expect(benang.effectiveQty).toBe(0.2) // no waste
  })

  it("calculates line cost per item as effectiveQty * unitCost", () => {
    const result = calculateBOMCost(baseBOM)

    const kain = result.items.find((i) => i.id === "item-1")!
    expect(kain.lineCost).toBe(55125) // 1.575 * 35000 = 55125

    const benang = result.items.find((i) => i.id === "item-2")!
    expect(benang.lineCost).toBe(3000) // 0.2 * 15000 = 3000

    const label = result.items.find((i) => i.id === "item-3")!
    expect(label.lineCost).toBe(510) // 1.02 * 500 = 510
  })

  it("calculates cost per unit when outputQty > 1", () => {
    const bom: BOMCostInput = {
      ...baseBOM,
      outputQty: 10,
    }
    const result = calculateBOMCost(bom)

    // Total is same: 58635, but per unit = 58635 / 10 = 5864 (rounded)
    expect(result.costPerUnit).toBe(Math.round(58635 / 10))
    expect(result.outputQty).toBe(10)
  })

  it("calculates cost portion percentages", () => {
    const result = calculateBOMCost(baseBOM)

    // Total = 58635
    const kain = result.items.find((i) => i.id === "item-1")!
    expect(kain.costPortion).toBeGreaterThan(90) // 55125/58635 = ~94%

    const portions = result.items.reduce((sum, i) => sum + i.costPortion, 0)
    // Portions should sum to ~100 (with rounding)
    expect(portions).toBeGreaterThan(99)
    expect(portions).toBeLessThanOrEqual(100.1)
  })

  it("handles zero cost items gracefully", () => {
    const bom: BOMCostInput = {
      ...baseBOM,
      items: [
        {
          id: "item-free",
          materialId: "mat-free",
          materialCode: "FREE-001",
          materialName: "Free Sample",
          unit: "pcs",
          quantity: 5,
          wastePct: 0,
          unitCost: 0,
        },
      ],
    }
    const result = calculateBOMCost(bom)

    expect(result.totalMaterialCost).toBe(0)
    expect(result.costPerUnit).toBe(0)
    expect(result.items[0].costPortion).toBe(0)
  })

  it("handles empty items array", () => {
    const bom: BOMCostInput = {
      ...baseBOM,
      items: [],
    }
    const result = calculateBOMCost(bom)

    expect(result.totalMaterialCost).toBe(0)
    expect(result.costPerUnit).toBe(0)
    expect(result.itemCount).toBe(0)
    expect(result.items).toEqual([])
  })

  it("handles string numeric values", () => {
    const bom: BOMCostInput = {
      ...baseBOM,
      items: [
        {
          id: "item-str",
          materialId: "mat-str",
          materialCode: "STR-001",
          materialName: "String Qty Test",
          unit: "meter",
          quantity: "2.5" as any,
          wastePct: "10" as any,
          unitCost: "20000" as any,
        },
      ],
    }
    const result = calculateBOMCost(bom)

    // 2.5 * 1.10 * 20000 = 55000
    expect(result.totalMaterialCost).toBe(55000)
    expect(result.items[0].effectiveQty).toBe(2.75)
  })

  it("defaults outputQty to 1 when 0 or negative", () => {
    const bom0: BOMCostInput = { ...baseBOM, outputQty: 0 }
    const bomNeg: BOMCostInput = { ...baseBOM, outputQty: -5 }

    expect(calculateBOMCost(bom0).outputQty).toBe(1)
    expect(calculateBOMCost(bomNeg).outputQty).toBe(1)
  })

  it("includes metadata in result", () => {
    const result = calculateBOMCost(baseBOM)

    expect(result.bomId).toBe("bom-001")
    expect(result.productId).toBe("prod-001")
    expect(result.productName).toBe("Kaos Polos")
    expect(result.calculatedAt).toBeTruthy()
    expect(new Date(result.calculatedAt).getTime()).toBeGreaterThan(0)
  })

  it("calculates high-waste scenario correctly", () => {
    const bom: BOMCostInput = {
      ...baseBOM,
      items: [
        {
          id: "item-waste",
          materialId: "mat-waste",
          materialCode: "WST-001",
          materialName: "Kain Potong (High Waste)",
          unit: "meter",
          quantity: 2,
          wastePct: 25, // 25% waste
          unitCost: 50000,
        },
      ],
    }
    const result = calculateBOMCost(bom)

    // 2 * 1.25 * 50000 = 125000
    expect(result.totalMaterialCost).toBe(125000)
    expect(result.items[0].effectiveQty).toBe(2.5)
  })
})
