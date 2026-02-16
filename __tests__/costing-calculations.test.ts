import { describe, it, expect } from 'vitest'
import {
    calculateCostSheetTotal,
    calculateActualTotal,
    calculateMargin,
    calculateSellingPrice,
    calculateCostPerUnit,
    calculateVariance,
    aggregateByCategoryPlanned,
    calculateFabricCost,
    calculateCMTCost,
    COST_CATEGORY_LABELS,
    COST_CATEGORY_COLORS,
    type CostItem,
} from '@/lib/costing-calculations'

// ==============================================================================
// Cost Sheet Total
// ==============================================================================

describe('calculateCostSheetTotal', () => {
    it('sums item totalCosts', () => {
        const items: CostItem[] = [
            { category: 'FABRIC', quantity: 1.5, unitCost: 50000, totalCost: 75000 },
            { category: 'TRIM', quantity: 3, unitCost: 5000, totalCost: 15000 },
            { category: 'LABOR', quantity: 1, unitCost: 20000, totalCost: 20000 },
        ]
        expect(calculateCostSheetTotal(items)).toBe(110000)
    })

    it('returns 0 for empty items', () => {
        expect(calculateCostSheetTotal([])).toBe(0)
    })
})

describe('calculateActualTotal', () => {
    it('sums actual costs where available', () => {
        const items: CostItem[] = [
            { category: 'FABRIC', quantity: 1.5, unitCost: 50000, totalCost: 75000, actualTotalCost: 80000 },
            { category: 'TRIM', quantity: 3, unitCost: 5000, totalCost: 15000, actualTotalCost: null },
            { category: 'LABOR', quantity: 1, unitCost: 20000, totalCost: 20000, actualTotalCost: 22000 },
        ]
        expect(calculateActualTotal(items)).toBe(102000) // 80000 + 0 + 22000
    })

    it('returns 0 when no actuals', () => {
        const items: CostItem[] = [
            { category: 'FABRIC', quantity: 1.5, unitCost: 50000, totalCost: 75000 },
        ]
        expect(calculateActualTotal(items)).toBe(0)
    })
})

// ==============================================================================
// Margin Calculations
// ==============================================================================

describe('calculateMargin', () => {
    it('calculates margin correctly', () => {
        // Cost: 70,000, Price: 100,000 → margin = 30%
        expect(calculateMargin(70000, 100000)).toBe(30)
    })

    it('returns 0 for zero selling price', () => {
        expect(calculateMargin(50000, 0)).toBe(0)
    })

    it('returns negative for cost exceeding price', () => {
        // Cost: 120,000, Price: 100,000 → margin = -20%
        expect(calculateMargin(120000, 100000)).toBe(-20)
    })

    it('handles 100% margin (free product)', () => {
        expect(calculateMargin(0, 100000)).toBe(100)
    })
})

describe('calculateSellingPrice', () => {
    it('calculates price from cost and margin', () => {
        // Cost: 70,000, Margin: 30% → Price = 70000 / (1 - 0.30) = 100,000
        expect(calculateSellingPrice(70000, 30)).toBe(100000)
    })

    it('returns cost for 0% margin', () => {
        expect(calculateSellingPrice(70000, 0)).toBe(70000)
    })

    it('returns Infinity for 100% margin', () => {
        expect(calculateSellingPrice(70000, 100)).toBe(Infinity)
    })

    it('handles 50% margin', () => {
        // 70000 / (1 - 0.50) = 140,000
        expect(calculateSellingPrice(70000, 50)).toBe(140000)
    })
})

describe('calculateCostPerUnit', () => {
    it('divides total by quantity', () => {
        expect(calculateCostPerUnit(100000, 100)).toBe(1000)
    })

    it('returns 0 for zero quantity', () => {
        expect(calculateCostPerUnit(100000, 0)).toBe(0)
    })

    it('rounds to 2 decimal places', () => {
        expect(calculateCostPerUnit(100000, 3)).toBe(33333.33)
    })
})

// ==============================================================================
// Variance
// ==============================================================================

describe('calculateVariance', () => {
    it('returns OVER for actual > planned', () => {
        const v = calculateVariance(100000, 110000)
        expect(v.amount).toBe(10000)
        expect(v.percentage).toBe(10)
        expect(v.direction).toBe('OVER')
    })

    it('returns UNDER for actual < planned', () => {
        const v = calculateVariance(100000, 90000)
        expect(v.amount).toBe(-10000)
        expect(v.percentage).toBe(-10)
        expect(v.direction).toBe('UNDER')
    })

    it('returns ON_TARGET for small difference (<1%)', () => {
        const v = calculateVariance(100000, 100500)
        expect(v.direction).toBe('ON_TARGET')
    })

    it('returns 0% for zero planned', () => {
        const v = calculateVariance(0, 10000)
        expect(v.percentage).toBe(0)
    })
})

// ==============================================================================
// Aggregate by Category
// ==============================================================================

describe('aggregateByCategoryPlanned', () => {
    it('groups costs by category', () => {
        const items: CostItem[] = [
            { category: 'FABRIC', quantity: 1.5, unitCost: 50000, totalCost: 75000 },
            { category: 'FABRIC', quantity: 0.5, unitCost: 30000, totalCost: 15000 },
            { category: 'LABOR', quantity: 1, unitCost: 20000, totalCost: 20000 },
        ]

        const result = aggregateByCategoryPlanned(items)
        const fabric = result.find((r) => r.category === 'FABRIC')
        const labor = result.find((r) => r.category === 'LABOR')

        expect(fabric?.planned).toBe(90000)
        expect(labor?.planned).toBe(20000)
    })

    it('excludes empty categories', () => {
        const items: CostItem[] = [
            { category: 'FABRIC', quantity: 1, unitCost: 50000, totalCost: 50000 },
        ]

        const result = aggregateByCategoryPlanned(items)
        expect(result).toHaveLength(1)
        expect(result[0].category).toBe('FABRIC')
    })

    it('calculates variance percentage', () => {
        const items: CostItem[] = [
            { category: 'FABRIC', quantity: 1, unitCost: 50000, totalCost: 50000, actualTotalCost: 55000 },
        ]

        const result = aggregateByCategoryPlanned(items)
        expect(result[0].variance).toBe(5000)
        expect(result[0].variancePct).toBe(10)
    })
})

// ==============================================================================
// Fabric Cost
// ==============================================================================

describe('calculateFabricCost', () => {
    it('calculates with default 5% wastage', () => {
        // 1.5m * (1.05) * 50,000/m = 78,750
        expect(calculateFabricCost(1.5, 50000)).toBe(78750)
    })

    it('calculates with custom wastage', () => {
        // 1.5m * (1.10) * 50,000/m = 82,500
        expect(calculateFabricCost(1.5, 50000, 10)).toBe(82500)
    })

    it('returns 0 for zero meters', () => {
        expect(calculateFabricCost(0, 50000)).toBe(0)
    })

    it('returns 0 for zero price', () => {
        expect(calculateFabricCost(1.5, 0)).toBe(0)
    })
})

// ==============================================================================
// CMT Cost
// ==============================================================================

describe('calculateCMTCost', () => {
    it('sums operation costs', () => {
        const ops = [
            { rate: 5000 },    // SEW
            { rate: 2000 },    // WASH
            { rate: 3000 },    // FINISHING
        ]
        expect(calculateCMTCost(ops)).toBe(10000)
    })

    it('handles quantity multiplier', () => {
        const ops = [
            { rate: 5000, quantity: 2 },
            { rate: 3000, quantity: 1 },
        ]
        expect(calculateCMTCost(ops)).toBe(13000)
    })

    it('returns 0 for empty operations', () => {
        expect(calculateCMTCost([])).toBe(0)
    })
})

// ==============================================================================
// Labels & Colors
// ==============================================================================

describe('COST_CATEGORY_LABELS', () => {
    it('has labels for all 6 categories', () => {
        const categories = ['FABRIC', 'TRIM', 'LABOR', 'OVERHEAD', 'SUBCONTRACT', 'OTHER'] as const
        for (const cat of categories) {
            expect(COST_CATEGORY_LABELS[cat]).toBeDefined()
            expect(COST_CATEGORY_LABELS[cat].length).toBeGreaterThan(0)
        }
    })
})

describe('COST_CATEGORY_COLORS', () => {
    it('has hex colors for all 6 categories', () => {
        const categories = ['FABRIC', 'TRIM', 'LABOR', 'OVERHEAD', 'SUBCONTRACT', 'OTHER'] as const
        for (const cat of categories) {
            expect(COST_CATEGORY_COLORS[cat]).toBeDefined()
            expect(COST_CATEGORY_COLORS[cat]).toMatch(/^#[0-9a-f]{6}$/i)
        }
    })
})
