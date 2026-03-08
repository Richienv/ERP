/**
 * BOM Costing (HPP/COGS) — server-safe, pure calculation functions.
 *
 * calculateBOMCost() is the main entry point: given BOM items with material
 * cost prices, it returns a full cost breakdown per material line and totals.
 */

export interface BOMCostItem {
  id: string
  materialId: string
  materialCode: string
  materialName: string
  unit: string
  quantity: number        // base quantity from BOM
  wastePct: number        // e.g. 5 means 5%
  effectiveQty: number    // quantity * (1 + wastePct/100)
  unitCost: number        // cost per unit of material (from costPrice or supplier)
  lineCost: number        // effectiveQty * unitCost
  costPortion: number     // percentage of total material cost (0-100)
}

export interface BOMCostResult {
  bomId: string
  productId: string
  productName: string
  outputQty: number        // BOM output quantity (default 1)
  items: BOMCostItem[]
  totalMaterialCost: number
  costPerUnit: number      // totalMaterialCost / outputQty
  itemCount: number
  calculatedAt: string     // ISO timestamp
}

export interface BOMCostInput {
  id: string
  productId: string
  productName: string
  outputQty?: number       // defaults to 1 if not set
  items: Array<{
    id: string
    materialId: string
    materialCode: string
    materialName: string
    unit: string
    quantity: number | string
    wastePct: number | string
    unitCost: number | string  // already resolved (costPrice or supplier price)
  }>
}

/**
 * Calculate the full BOM cost breakdown.
 *
 * Each item's effective quantity = quantity * (1 + wastePct / 100)
 * Line cost = effectiveQty * unitCost
 * Total = sum of all line costs
 * Cost per unit = total / outputQty
 */
export function calculateBOMCost(input: BOMCostInput): BOMCostResult {
  const outputQty = Math.max(Number(input.outputQty) || 1, 1)

  const costItems: BOMCostItem[] = input.items.map((item) => {
    const quantity = Number(item.quantity) || 0
    const wastePct = Number(item.wastePct) || 0
    const unitCost = Number(item.unitCost) || 0
    const effectiveQty = quantity * (1 + wastePct / 100)
    const lineCost = Math.round(effectiveQty * unitCost)

    return {
      id: item.id,
      materialId: item.materialId,
      materialCode: item.materialCode,
      materialName: item.materialName,
      unit: item.unit,
      quantity,
      wastePct,
      effectiveQty: Math.round(effectiveQty * 10000) / 10000, // 4 decimal places
      unitCost,
      lineCost,
      costPortion: 0, // calculated below
    }
  })

  const totalMaterialCost = costItems.reduce((sum, item) => sum + item.lineCost, 0)

  // Calculate cost portion percentages
  if (totalMaterialCost > 0) {
    for (const item of costItems) {
      item.costPortion = Math.round((item.lineCost / totalMaterialCost) * 10000) / 100
    }
  }

  return {
    bomId: input.id,
    productId: input.productId,
    productName: input.productName,
    outputQty,
    items: costItems,
    totalMaterialCost,
    costPerUnit: totalMaterialCost > 0 ? Math.round(totalMaterialCost / outputQty) : 0,
    itemCount: costItems.length,
    calculatedAt: new Date().toISOString(),
  }
}
