/**
 * BOM cost calculation helpers — all client-side.
 * Material prices come from Product.costPrice (fetched via API).
 */

export interface BOMItemWithCost {
    id: string
    materialId?: string
    material?: { id: string; costPrice?: number | string; name?: string; unit?: string; code?: string }
    quantityPerUnit: number | string
    wastePct?: number | string
    unit?: string
}

/** Get the cost price of a BOM item's material as a number */
export function getMaterialCostPrice(item: BOMItemWithCost): number {
    return Number(item.material?.costPrice || 0)
}

/** Calculate material cost per unit (qty × price, with waste) */
export function calcItemCostPerUnit(item: BOMItemWithCost): number {
    const qty = Number(item.quantityPerUnit || 0)
    const price = getMaterialCostPrice(item)
    const wastePct = Number(item.wastePct || 0)
    const wasteMultiplier = 1 + wastePct / 100
    return qty * price * wasteMultiplier
}

/** Calculate total material cost for a step (sum of its assigned items × target qty) */
export function calcStepMaterialCost(
    step: { materials?: { bomItemId: string }[] },
    allItems: BOMItemWithCost[],
    targetQty: number,
): number {
    if (!step.materials?.length) return 0
    let total = 0
    for (const sm of step.materials) {
        const item = allItems.find((i) => i.id === sm.bomItemId)
        if (item) total += calcItemCostPerUnit(item)
    }
    return total * targetQty
}

/**
 * Labour cost per pcs based on monthly salary + duration per piece.
 * Formula: gaji_bulanan / (172 / (durasi_menit / 60))
 *        = gaji_bulanan * durasi_menit / 10320
 * 172 = standard Indonesian working hours per month (26 hari kerja × ~6.6 jam)
 */
export const WORKING_HOURS_PER_MONTH = 172

export function calcLaborCostPerPcs(
    laborMonthlySalary: number | string | null | undefined,
    durationMinutes: number | null | undefined,
): number {
    const salary = Number(laborMonthlySalary || 0)
    const duration = Number(durationMinutes || 0)
    if (salary <= 0 || duration <= 0) return 0
    return salary * duration / (WORKING_HOURS_PER_MONTH * 60)
}

/** Calculate total labor/station cost for a step */
export function calcStepLaborCost(
    step: { station?: { costPerUnit?: number | string }; laborMonthlySalary?: number | string | null; durationMinutes?: number | null },
    targetQty: number,
): number {
    // If step has monthly salary + duration, use calculated per-pcs cost
    const calculatedCost = calcLaborCostPerPcs(step.laborMonthlySalary, step.durationMinutes)
    if (calculatedCost > 0) return calculatedCost * targetQty
    // Fallback to static station costPerUnit
    return Number(step.station?.costPerUnit || 0) * targetQty
}

/** Calculate grand total material cost across all items (not per-step, avoids double counting) */
export function calcTotalMaterialCost(
    items: BOMItemWithCost[],
    targetQty: number,
): number {
    let total = 0
    for (const item of items) {
        total += calcItemCostPerUnit(item)
    }
    return total * targetQty
}

/** Calculate grand total labor cost across all steps */
export function calcTotalLaborCost(
    steps: { station?: { costPerUnit?: number | string }; laborMonthlySalary?: number | string | null; durationMinutes?: number | null }[],
    targetQty: number,
): number {
    let total = 0
    for (const step of steps) {
        const calculated = calcLaborCostPerPcs(step.laborMonthlySalary, step.durationMinutes)
        total += calculated > 0 ? calculated : Number(step.station?.costPerUnit || 0)
    }
    return total * targetQty
}
