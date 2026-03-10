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

/**
 * Calculate overhead cost per piece for a single step.
 * Two sources: (1) station overheadPct applied on labor cost, (2) machine overhead per hour.
 */
export function calcOverheadCostPerPcs(
    laborCostPerPcs: number,
    overheadPct: number | string | null | undefined,
    machineOverhead: { overheadMaterialCostPerHour?: number | string; durationMinutes?: number | null } | null | undefined,
): number {
    let total = 0
    const pct = Number(overheadPct || 0)
    if (pct > 0) {
        total += laborCostPerPcs * pct / 100
    }
    if (machineOverhead) {
        const costPerHour = Number(machineOverhead.overheadMaterialCostPerHour || 0)
        const minutes = Number(machineOverhead.durationMinutes || 0)
        if (costPerHour > 0 && minutes > 0) {
            total += costPerHour * (minutes / 60)
        }
    }
    return total
}

/**
 * Calculate total overhead cost across all in-house steps × target quantity.
 */
export function calcTotalOverheadCost(
    steps: {
        laborMonthlySalary?: number | string | null
        durationMinutes?: number | null
        station?: { overheadPct?: number | string | null; operationType?: string; machine?: { overheadMaterialCostPerHour?: number | string } | null } | null
        useSubkon?: boolean | null
        allocations?: unknown[]
    }[],
    targetQty: number,
): number {
    let total = 0
    for (const step of steps) {
        const isSubkon = step.useSubkon ?? step.station?.operationType === "SUBCONTRACTOR"
        if (isSubkon) continue
        const laborPerPcs = calcLaborCostPerPcs(step.laborMonthlySalary, step.durationMinutes)
        const overheadPerPcs = calcOverheadCostPerPcs(
            laborPerPcs,
            step.station?.overheadPct,
            step.station?.machine
                ? { overheadMaterialCostPerHour: step.station.machine.overheadMaterialCostPerHour, durationMinutes: step.durationMinutes }
                : null,
        )
        total += overheadPerPcs * targetQty
    }
    return total
}

/** Simple HPP per piece = material + labor + overhead */
export function calcHPPPerPcs(materialPerPcs: number, laborPerPcs: number, overheadPerPcs: number): number {
    return materialPerPcs + laborPerPcs + overheadPerPcs
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

/** Calculate grand total labor cost across all steps (in-house + subcon) */
export function calcTotalLaborCost(
    steps: {
        station?: { costPerUnit?: number | string; operationType?: string }
        laborMonthlySalary?: number | string | null
        durationMinutes?: number | null
        useSubkon?: boolean | null
        allocations?: { pricePerPcs?: number; quantity?: number }[]
    }[],
    targetQty: number,
): number {
    let total = 0
    for (const step of steps) {
        const isSubkon = step.useSubkon ?? step.station?.operationType === "SUBCONTRACTOR"
        if (isSubkon) {
            // Subcon: sum(pricePerPcs × quantity) per allocation — already total, not per-unit
            const allocs = step.allocations || []
            total += allocs.reduce(
                (s, a) => s + (Number(a.pricePerPcs) || 0) * (Number(a.quantity) || 0),
                0,
            )
        } else {
            // In-house: labor formula per pcs, or fallback to station costPerUnit, × targetQty
            const calculated = calcLaborCostPerPcs(step.laborMonthlySalary, step.durationMinutes)
            const perPcs = calculated > 0 ? calculated : Number(step.station?.costPerUnit || 0)
            total += perPcs * targetQty
        }
    }
    return total
}
