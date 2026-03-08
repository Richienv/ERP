export interface BOMRequirement {
    materialId: string
    unit: string
    requiredQty: number
}

export function calculateBOMRequirements(
    items: Array<{ materialId: string; quantityPerUnit: number; wastePct: number; unit: string }>,
    plannedQty: number
): BOMRequirement[] {
    return items.map((item) => ({
        materialId: item.materialId,
        unit: item.unit,
        requiredQty: Math.ceil(item.quantityPerUnit * plannedQty * (1 + item.wastePct / 100)),
    }))
}

export function calculateReservationDelta(
    requiredQty: number,
    availableQty: number,
    onOrderQty: number
) {
    const shortfall = Math.max(0, requiredQty - availableQty - onOrderQty)
    const canReserve = Math.min(requiredQty, Math.max(0, availableQty))
    return { shortfall, canReserve }
}
