export interface MaterialVarianceLine {
    materialId: string
    materialCode: string
    materialName: string
    unit: string
    plannedQty: number
    actualQty: number
    qtyVariance: number
    qtyVariancePct: number
    plannedUnitCost: number
    actualUnitCost: number
    plannedCost: number
    actualCost: number
    costVariance: number
    costVariancePct: number
    plannedWastePct: number
    status: "HEMAT" | "SESUAI" | "BOROS"
}

export interface MaterialVarianceResult {
    workOrderId: string
    workOrderNumber: string
    lines: MaterialVarianceLine[]
    totalPlannedCost: number
    totalActualCost: number
    totalCostVariance: number
    totalVariancePct: number
    woStatus: "HEMAT" | "SESUAI" | "BOROS"
}

interface WOInput {
    id: string
    number: string
    plannedQty: number
    actualQty: number
}

interface BOMItemInput {
    materialId: string
    materialCode: string
    materialName: string
    unit: string
    quantityPerUnit: number
    wastePct: number
    currentCostPrice: number
}

interface TransactionInput {
    productId: string
    quantity: number
    unitCost: number
    totalValue: number
}

function getStatus(variancePct: number): "HEMAT" | "SESUAI" | "BOROS" {
    if (variancePct < -2) return "HEMAT"
    if (variancePct > 2) return "BOROS"
    return "SESUAI"
}

export function calculateMaterialVariance(
    workOrder: WOInput,
    bomItems: BOMItemInput[],
    transactions: TransactionInput[]
): MaterialVarianceResult {
    const qtyUsed = workOrder.actualQty || workOrder.plannedQty

    const txByMaterial = new Map<string, { totalQty: number; totalValue: number }>()
    for (const tx of transactions) {
        const existing = txByMaterial.get(tx.productId) || { totalQty: 0, totalValue: 0 }
        existing.totalQty += Math.abs(tx.quantity)
        existing.totalValue += Math.abs(tx.totalValue)
        txByMaterial.set(tx.productId, existing)
    }

    const lines: MaterialVarianceLine[] = bomItems.map((item) => {
        const plannedQty = Math.ceil(item.quantityPerUnit * qtyUsed * (1 + item.wastePct / 100))
        const tx = txByMaterial.get(item.materialId) || { totalQty: 0, totalValue: 0 }
        const actualQty = tx.totalQty
        const qtyVariance = actualQty - plannedQty
        const qtyVariancePct = plannedQty > 0 ? (qtyVariance / plannedQty) * 100 : 0

        const plannedCost = plannedQty * item.currentCostPrice
        const actualCost = tx.totalValue
        const costVariance = actualCost - plannedCost
        const costVariancePct = plannedCost > 0 ? (costVariance / plannedCost) * 100 : 0
        const actualUnitCost = actualQty > 0 ? actualCost / actualQty : 0

        return {
            materialId: item.materialId,
            materialCode: item.materialCode,
            materialName: item.materialName,
            unit: item.unit,
            plannedQty,
            actualQty,
            qtyVariance,
            qtyVariancePct,
            plannedUnitCost: item.currentCostPrice,
            actualUnitCost,
            plannedCost,
            actualCost,
            costVariance,
            costVariancePct,
            plannedWastePct: item.wastePct,
            status: getStatus(qtyVariancePct),
        }
    })

    const totalPlannedCost = lines.reduce((s, l) => s + l.plannedCost, 0)
    const totalActualCost = lines.reduce((s, l) => s + l.actualCost, 0)
    const totalCostVariance = totalActualCost - totalPlannedCost
    const totalVariancePct = totalPlannedCost > 0 ? (totalCostVariance / totalPlannedCost) * 100 : 0

    return {
        workOrderId: workOrder.id,
        workOrderNumber: workOrder.number,
        lines,
        totalPlannedCost,
        totalActualCost,
        totalCostVariance,
        totalVariancePct,
        woStatus: getStatus(totalVariancePct),
    }
}
