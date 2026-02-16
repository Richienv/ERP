// ==============================================================================
// Garment Costing Pure Functions
// ==============================================================================

export type CostCategoryType = 'FABRIC' | 'TRIM' | 'LABOR' | 'OVERHEAD' | 'SUBCONTRACT' | 'OTHER'

export interface CostItem {
    category: CostCategoryType
    quantity: number
    unitCost: number
    totalCost: number
    actualQuantity?: number | null
    actualUnitCost?: number | null
    actualTotalCost?: number | null
}

export interface CostBreakdown {
    category: CostCategoryType
    planned: number
    actual: number
    variance: number
    variancePct: number
}

export const COST_CATEGORY_LABELS: Record<CostCategoryType, string> = {
    FABRIC: 'Kain',
    TRIM: 'Aksesoris',
    LABOR: 'Tenaga Kerja',
    OVERHEAD: 'Overhead',
    SUBCONTRACT: 'Subkontrak',
    OTHER: 'Lain-lain',
}

export const COST_CATEGORY_COLORS: Record<CostCategoryType, string> = {
    FABRIC: '#3b82f6',
    TRIM: '#8b5cf6',
    LABOR: '#f59e0b',
    OVERHEAD: '#6b7280',
    SUBCONTRACT: '#ec4899',
    OTHER: '#14b8a6',
}

// ==============================================================================
// Cost Sheet Status Labels & Colors
// ==============================================================================

export type CostSheetStatusType = 'CS_DRAFT' | 'CS_FINALIZED' | 'CS_APPROVED'

export const costSheetStatusLabels: Record<CostSheetStatusType, string> = {
    CS_DRAFT: 'Draft',
    CS_FINALIZED: 'Final',
    CS_APPROVED: 'Disetujui',
}

export const costSheetStatusColors: Record<CostSheetStatusType, string> = {
    CS_DRAFT: 'bg-zinc-100 text-zinc-600 border-zinc-300',
    CS_FINALIZED: 'bg-blue-100 text-blue-700 border-blue-300',
    CS_APPROVED: 'bg-emerald-100 text-emerald-700 border-emerald-300',
}

// ==============================================================================
// Calculations
// ==============================================================================

/**
 * Calculate total cost from items.
 */
export function calculateCostSheetTotal(items: CostItem[]): number {
    return Math.round(items.reduce((sum, item) => sum + item.totalCost, 0) * 100) / 100
}

/**
 * Calculate actual total from items (only where actuals exist).
 */
export function calculateActualTotal(items: CostItem[]): number {
    return Math.round(
        items.reduce((sum, item) => sum + (item.actualTotalCost ?? 0), 0) * 100
    ) / 100
}

/**
 * Calculate margin from cost and selling price.
 * @returns margin percentage (0-100)
 */
export function calculateMargin(totalCost: number, sellingPrice: number): number {
    if (sellingPrice <= 0) return 0
    return Math.round(((sellingPrice - totalCost) / sellingPrice) * 10000) / 100
}

/**
 * Calculate selling price from cost and target margin.
 */
export function calculateSellingPrice(totalCost: number, targetMarginPct: number): number {
    if (targetMarginPct >= 100) return Infinity
    if (targetMarginPct <= 0) return totalCost
    return Math.round((totalCost / (1 - targetMarginPct / 100)) * 100) / 100
}

/**
 * Calculate cost per unit.
 */
export function calculateCostPerUnit(totalCost: number, quantity: number): number {
    if (quantity <= 0) return 0
    return Math.round((totalCost / quantity) * 100) / 100
}

/**
 * Calculate variance between planned and actual.
 */
export function calculateVariance(
    planned: number,
    actual: number
): { amount: number; percentage: number; direction: 'OVER' | 'UNDER' | 'ON_TARGET' } {
    const amount = actual - planned
    const percentage = planned > 0
        ? Math.round((amount / planned) * 10000) / 100
        : 0

    return {
        amount: Math.round(amount * 100) / 100,
        percentage,
        direction: Math.abs(percentage) < 1 ? 'ON_TARGET' : amount > 0 ? 'OVER' : 'UNDER',
    }
}

/**
 * Aggregate costs by category.
 */
export function aggregateByCategoryPlanned(items: CostItem[]): CostBreakdown[] {
    const categories: CostCategoryType[] = ['FABRIC', 'TRIM', 'LABOR', 'OVERHEAD', 'SUBCONTRACT', 'OTHER']
    return categories
        .map((cat) => {
            const catItems = items.filter((i) => i.category === cat)
            const planned = catItems.reduce((s, i) => s + i.totalCost, 0)
            const actual = catItems.reduce((s, i) => s + (i.actualTotalCost ?? 0), 0)
            const variance = actual - planned
            const variancePct = planned > 0 ? Math.round((variance / planned) * 10000) / 100 : 0
            return { category: cat, planned, actual, variance, variancePct }
        })
        .filter((b) => b.planned > 0 || b.actual > 0)
}

/**
 * Calculate fabric cost for a garment.
 * @param fabricMetersPerUnit - meters of fabric needed per unit
 * @param fabricPricePerMeter - price per meter
 * @param wastagePercent - wastage percentage (default 5%)
 */
export function calculateFabricCost(
    fabricMetersPerUnit: number,
    fabricPricePerMeter: number,
    wastagePercent: number = 5
): number {
    if (fabricMetersPerUnit <= 0 || fabricPricePerMeter <= 0) return 0
    const metersWithWastage = fabricMetersPerUnit * (1 + wastagePercent / 100)
    return Math.round(metersWithWastage * fabricPricePerMeter * 100) / 100
}

/**
 * Calculate CMT (subcontract) cost per garment.
 */
export function calculateCMTCost(
    operations: { rate: number; quantity?: number }[]
): number {
    return Math.round(
        operations.reduce((sum, op) => sum + op.rate * (op.quantity ?? 1), 0) * 100
    ) / 100
}
