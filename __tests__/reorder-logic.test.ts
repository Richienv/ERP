import { describe, it, expect } from 'vitest'
import {
    calculateDaysOfStock,
    determineUrgency,
    calculateSuggestedQty,
} from '@/lib/procurement-reorder-helpers'
import {
    allocateLandedCost,
} from '@/components/procurement/landed-cost-dialog'
import {
    calculateOverallScore,
    getGrade,
} from '@/components/procurement/supplier-scorecard'

// ==============================================================================
// Reorder — calculateDaysOfStock
// ==============================================================================

describe('calculateDaysOfStock', () => {
    it('returns Infinity when burn rate is 0', () => {
        expect(calculateDaysOfStock(100, 0)).toBe(Infinity)
    })

    it('returns Infinity when burn rate is negative', () => {
        expect(calculateDaysOfStock(100, -5)).toBe(Infinity)
    })

    it('calculates days correctly', () => {
        expect(calculateDaysOfStock(100, 10)).toBe(10)
    })

    it('handles decimal results', () => {
        expect(calculateDaysOfStock(100, 3)).toBe(33.33)
    })

    it('returns 0 when stock is 0', () => {
        expect(calculateDaysOfStock(0, 10)).toBe(0)
    })

    it('never returns negative', () => {
        expect(calculateDaysOfStock(-5, 10)).toBe(0)
    })
})

// ==============================================================================
// Reorder — determineUrgency
// ==============================================================================

describe('determineUrgency', () => {
    it('returns CRITICAL when stock <= safety stock', () => {
        expect(determineUrgency(5, 20, 10)).toBe('CRITICAL')
        expect(determineUrgency(10, 20, 10)).toBe('CRITICAL')
    })

    it('returns WARNING when stock below reorder but above safety', () => {
        expect(determineUrgency(15, 20, 10)).toBe('WARNING')
    })

    it('returns WARNING when stock equals reorder level', () => {
        expect(determineUrgency(20, 20, 10)).toBe('WARNING')
    })

    it('returns NORMAL when stock above reorder level', () => {
        expect(determineUrgency(21, 20, 10)).toBe('NORMAL')
        expect(determineUrgency(100, 20, 10)).toBe('NORMAL')
    })

    it('CRITICAL at zero stock', () => {
        expect(determineUrgency(0, 20, 10)).toBe('CRITICAL')
    })
})

// ==============================================================================
// Reorder — calculateSuggestedQty
// ==============================================================================

describe('calculateSuggestedQty', () => {
    it('suggests qty to fill up to max stock', () => {
        // current=10, max=100, safety=5, burn=2/day, leadTime=7, openPO=0
        // target = 100 - 10 - 0 = 90
        // leadTimeDemand = ceil(2*7) = 14, min = 14 + 5 - 10 - 0 = 9
        // suggested = max(90, 9) = 90
        expect(calculateSuggestedQty(10, 100, 5, 2, 7, 0)).toBe(90)
    })

    it('accounts for open PO quantities', () => {
        // current=10, max=100, safety=5, burn=2, lead=7, openPO=50
        // target = 100 - 10 - 50 = 40
        // min = 14 + 5 - 10 - 50 = -41 → 0
        // suggested = max(40, 0) = 40
        expect(calculateSuggestedQty(10, 100, 5, 2, 7, 50)).toBe(40)
    })

    it('returns 0 when open POs already cover the gap', () => {
        // current=10, max=100, safety=5, burn=2, lead=7, openPO=100
        // target = 100 - 10 - 100 = -10 → 0
        expect(calculateSuggestedQty(10, 100, 5, 2, 7, 100)).toBe(0)
    })

    it('ensures lead time coverage in minimum qty', () => {
        // current=0, max=50, safety=10, burn=5/day, leadTime=10, openPO=0
        // target = 50 - 0 - 0 = 50
        // leadTimeDemand = ceil(5*10) = 50, min = 50 + 10 - 0 - 0 = 60
        // suggested = max(50, 60) = 60
        expect(calculateSuggestedQty(0, 50, 10, 5, 10, 0)).toBe(60)
    })

    it('always returns non-negative', () => {
        expect(calculateSuggestedQty(200, 100, 5, 1, 7, 0)).toBe(0)
    })

    it('returns ceiling value', () => {
        // With fractional burn rate
        // current=10, max=50, safety=5, burn=1.5, lead=3, openPO=0
        // target = 50 - 10 = 40
        // leadTimeDemand = ceil(1.5*3) = ceil(4.5) = 5
        // min = 5 + 5 - 10 = 0
        // suggested = max(40, 0) = 40
        expect(calculateSuggestedQty(10, 50, 5, 1.5, 3, 0)).toBe(40)
    })
})

// ==============================================================================
// Landed Cost — allocateLandedCost
// ==============================================================================

describe('allocateLandedCost', () => {
    const items = [
        { id: '1', productName: 'A', productCode: 'A', quantity: 10, unitPrice: 1000, totalPrice: 10000 },
        { id: '2', productName: 'B', productCode: 'B', quantity: 20, unitPrice: 500, totalPrice: 10000 },
    ]

    it('BY_VALUE allocates proportionally to value', () => {
        const result = allocateLandedCost(items, 2000, 'BY_VALUE')
        // Both items have equal value (10000 each), so equal split
        expect(result[0].allocated).toBe(1000)
        expect(result[1].allocated).toBe(1000)
    })

    it('BY_QUANTITY allocates proportionally to qty', () => {
        const result = allocateLandedCost(items, 3000, 'BY_QUANTITY')
        // 10/(10+20) = 1/3, 20/(10+20) = 2/3
        expect(result[0].allocated).toBe(1000)
        expect(result[1].allocated).toBe(2000)
    })

    it('EQUAL splits evenly', () => {
        const result = allocateLandedCost(items, 2000, 'EQUAL')
        expect(result[0].allocated).toBe(1000)
        expect(result[1].allocated).toBe(1000)
    })

    it('BY_WEIGHT with weights', () => {
        const weightedItems = [
            { ...items[0], weight: 5 },
            { ...items[1], weight: 15 },
        ]
        const result = allocateLandedCost(weightedItems, 4000, 'BY_WEIGHT')
        // 5/20 = 0.25, 15/20 = 0.75
        expect(result[0].allocated).toBe(1000)
        expect(result[1].allocated).toBe(3000)
    })

    it('BY_WEIGHT falls back to equal when no weights', () => {
        const result = allocateLandedCost(items, 2000, 'BY_WEIGHT')
        expect(result[0].allocated).toBe(1000)
        expect(result[1].allocated).toBe(1000)
    })

    it('returns 0 allocation when total cost is 0', () => {
        const result = allocateLandedCost(items, 0, 'BY_VALUE')
        expect(result[0].allocated).toBe(0)
        expect(result[1].allocated).toBe(0)
    })

    it('returns empty array for no items', () => {
        const result = allocateLandedCost([], 1000, 'BY_VALUE')
        expect(result).toHaveLength(0)
    })

    it('calculates landed unit cost correctly', () => {
        const result = allocateLandedCost(items, 2000, 'BY_VALUE')
        // Item 1: (10000 + 1000) / 10 = 1100
        expect(result[0].landedUnitCost).toBe(1100)
        // Item 2: (10000 + 1000) / 20 = 550
        expect(result[1].landedUnitCost).toBe(550)
    })
})

// ==============================================================================
// Supplier Scorecard — calculateOverallScore
// ==============================================================================

describe('calculateOverallScore', () => {
    const makeData = (overrides?: Partial<{
        onTimeDeliveryPct: number
        defectRate: number
        rating: number
        responsiveness: number
    }>) => ({
        supplier: {
            id: '1', name: 'Test', code: 'T1',
            rating: overrides?.rating ?? 4,
            onTimeRate: 80,
            qualityScore: 90,
            responsiveness: overrides?.responsiveness ?? 80,
        },
        metrics: {
            totalPOs: 10,
            completedPOs: 8,
            avgLeadTimeDays: 7,
            totalSpend: 100000,
            defectRate: overrides?.defectRate ?? 1,
            onTimeDeliveryPct: overrides?.onTimeDeliveryPct ?? 90,
        },
    })

    it('calculates weighted score', () => {
        const score = calculateOverallScore(makeData())
        // delivery: 90*0.3=27, quality: (100-10)*0.3=27, price: (4/5*100)*0.2=16, response: 80*0.2=16
        // total = 27 + 27 + 16 + 16 = 86
        expect(score).toBe(86)
    })

    it('perfect supplier gets near 100', () => {
        const score = calculateOverallScore(makeData({
            onTimeDeliveryPct: 100,
            defectRate: 0,
            rating: 5,
            responsiveness: 100,
        }))
        // 100*0.3 + 100*0.3 + 100*0.2 + 100*0.2 = 100
        expect(score).toBe(100)
    })

    it('poor supplier gets low score', () => {
        const score = calculateOverallScore(makeData({
            onTimeDeliveryPct: 30,
            defectRate: 20,
            rating: 1,
            responsiveness: 20,
        }))
        // 30*0.3=9, max(0,100-200)*0.3=0, 20*0.2=4, 20*0.2=4 = 17
        expect(score).toBe(17)
    })
})

// ==============================================================================
// Supplier Scorecard — getGrade
// ==============================================================================

describe('getGrade', () => {
    it('A for 90+', () => {
        expect(getGrade(90).letter).toBe('A')
        expect(getGrade(100).letter).toBe('A')
    })

    it('B for 80-89', () => {
        expect(getGrade(80).letter).toBe('B')
        expect(getGrade(89).letter).toBe('B')
    })

    it('C for 70-79', () => {
        expect(getGrade(70).letter).toBe('C')
        expect(getGrade(79).letter).toBe('C')
    })

    it('D for 60-69', () => {
        expect(getGrade(60).letter).toBe('D')
        expect(getGrade(69).letter).toBe('D')
    })

    it('F for below 60', () => {
        expect(getGrade(59).letter).toBe('F')
        expect(getGrade(0).letter).toBe('F')
    })
})
