import { describe, it, expect } from 'vitest'
import {
    allowedCutPlanTransitions,
    assertCutPlanTransition,
    canCutPlanTransitionTo,
    getCutPlanNextStatuses,
    isCutPlanTerminal,
    cutPlanStatusLabels,
    cutPlanStatusColors,
    calculateMarkerEfficiency,
    calculateFabricRequired,
    calculateCutYield,
} from '@/lib/cut-plan-state-machine'

// ==============================================================================
// Transition Rules
// ==============================================================================

describe('allowedCutPlanTransitions', () => {
    it('CP_DRAFT can go to FABRIC_ALLOCATED or CP_CANCELLED', () => {
        expect(allowedCutPlanTransitions.CP_DRAFT).toEqual(['FABRIC_ALLOCATED', 'CP_CANCELLED'])
    })

    it('FABRIC_ALLOCATED can go to IN_CUTTING, CP_DRAFT, or CP_CANCELLED', () => {
        expect(allowedCutPlanTransitions.FABRIC_ALLOCATED).toEqual([
            'IN_CUTTING',
            'CP_DRAFT',
            'CP_CANCELLED',
        ])
    })

    it('IN_CUTTING can go to CP_COMPLETED or CP_CANCELLED', () => {
        expect(allowedCutPlanTransitions.IN_CUTTING).toEqual(['CP_COMPLETED', 'CP_CANCELLED'])
    })

    it('CP_COMPLETED has no transitions (terminal)', () => {
        expect(allowedCutPlanTransitions.CP_COMPLETED).toBeUndefined()
    })

    it('CP_CANCELLED has no transitions (terminal)', () => {
        expect(allowedCutPlanTransitions.CP_CANCELLED).toBeUndefined()
    })
})

// ==============================================================================
// assertCutPlanTransition
// ==============================================================================

describe('assertCutPlanTransition', () => {
    it('allows valid transition CP_DRAFT → FABRIC_ALLOCATED', () => {
        expect(() => assertCutPlanTransition('CP_DRAFT', 'FABRIC_ALLOCATED')).not.toThrow()
    })

    it('allows revert FABRIC_ALLOCATED → CP_DRAFT', () => {
        expect(() => assertCutPlanTransition('FABRIC_ALLOCATED', 'CP_DRAFT')).not.toThrow()
    })

    it('allows IN_CUTTING → CP_COMPLETED', () => {
        expect(() => assertCutPlanTransition('IN_CUTTING', 'CP_COMPLETED')).not.toThrow()
    })

    it('throws on invalid transition CP_DRAFT → CP_COMPLETED', () => {
        expect(() => assertCutPlanTransition('CP_DRAFT', 'CP_COMPLETED')).toThrow(/tidak valid/)
    })

    it('throws on transition from terminal CP_COMPLETED', () => {
        expect(() => assertCutPlanTransition('CP_COMPLETED', 'CP_DRAFT')).toThrow(/tidak valid/)
    })
})

// ==============================================================================
// canCutPlanTransitionTo / getCutPlanNextStatuses / isCutPlanTerminal
// ==============================================================================

describe('helper functions', () => {
    it('canCutPlanTransitionTo returns true for valid', () => {
        expect(canCutPlanTransitionTo('CP_DRAFT', 'FABRIC_ALLOCATED')).toBe(true)
    })

    it('canCutPlanTransitionTo returns false for invalid', () => {
        expect(canCutPlanTransitionTo('CP_DRAFT', 'CP_COMPLETED')).toBe(false)
    })

    it('getCutPlanNextStatuses returns transitions', () => {
        const next = getCutPlanNextStatuses('FABRIC_ALLOCATED')
        expect(next).toHaveLength(3)
        expect(next).toContain('IN_CUTTING')
    })

    it('getCutPlanNextStatuses returns empty for terminal', () => {
        expect(getCutPlanNextStatuses('CP_COMPLETED')).toEqual([])
    })

    it('isCutPlanTerminal for CP_COMPLETED', () => {
        expect(isCutPlanTerminal('CP_COMPLETED')).toBe(true)
    })

    it('isCutPlanTerminal for CP_CANCELLED', () => {
        expect(isCutPlanTerminal('CP_CANCELLED')).toBe(true)
    })

    it('isCutPlanTerminal for IN_CUTTING', () => {
        expect(isCutPlanTerminal('IN_CUTTING')).toBe(false)
    })
})

// ==============================================================================
// Labels & Colors
// ==============================================================================

describe('cutPlanStatusLabels', () => {
    it('has labels for all 5 statuses', () => {
        const statuses = [
            'CP_DRAFT',
            'FABRIC_ALLOCATED',
            'IN_CUTTING',
            'CP_COMPLETED',
            'CP_CANCELLED',
        ] as const

        for (const s of statuses) {
            expect(cutPlanStatusLabels[s]).toBeDefined()
            expect(cutPlanStatusLabels[s].length).toBeGreaterThan(0)
        }
    })
})

describe('cutPlanStatusColors', () => {
    it('has colors for all 5 statuses', () => {
        const statuses = [
            'CP_DRAFT',
            'FABRIC_ALLOCATED',
            'IN_CUTTING',
            'CP_COMPLETED',
            'CP_CANCELLED',
        ] as const

        for (const s of statuses) {
            expect(cutPlanStatusColors[s]).toBeDefined()
            expect(cutPlanStatusColors[s]).toContain('bg-')
        }
    })
})

// ==============================================================================
// Calculation: Marker Efficiency
// ==============================================================================

describe('calculateMarkerEfficiency', () => {
    it('calculates efficiency correctly', () => {
        // marker area used: 10 m², marker length: 12m, fabric width: 150cm
        // total area = 12 * 1.5 = 18 m²
        // efficiency = 10/18 * 100 = 55.56%
        expect(calculateMarkerEfficiency(10, 12, 150)).toBe(55.56)
    })

    it('returns 0 for zero marker length', () => {
        expect(calculateMarkerEfficiency(10, 0, 150)).toBe(0)
    })

    it('returns 0 for zero fabric width', () => {
        expect(calculateMarkerEfficiency(10, 12, 0)).toBe(0)
    })

    it('handles 100% efficiency', () => {
        // area used = marker length * fabric width = 12 * 1.5 = 18
        expect(calculateMarkerEfficiency(18, 12, 150)).toBe(100)
    })

    it('handles high efficiency (85%+)', () => {
        // 15.3 / 18 = 85%
        expect(calculateMarkerEfficiency(15.3, 12, 150)).toBe(85)
    })
})

// ==============================================================================
// Calculation: Fabric Required
// ==============================================================================

describe('calculateFabricRequired', () => {
    it('calculates with default wastage (3%)', () => {
        // 12m * 50 layers = 600m, + 3% = 618m
        expect(calculateFabricRequired(12, 50)).toBe(618)
    })

    it('calculates with custom wastage', () => {
        // 10m * 40 layers = 400m, + 5% = 420m
        expect(calculateFabricRequired(10, 40, 5)).toBe(420)
    })

    it('calculates with 0% wastage', () => {
        // 12m * 50 layers = 600m, + 0% = 600m
        expect(calculateFabricRequired(12, 50, 0)).toBe(600)
    })

    it('returns 0 for zero marker length', () => {
        expect(calculateFabricRequired(0, 50)).toBe(0)
    })

    it('returns 0 for zero layers', () => {
        expect(calculateFabricRequired(12, 0)).toBe(0)
    })

    it('handles fractional meters', () => {
        // 12.5m * 30 layers = 375m, + 3% = 386.25m
        expect(calculateFabricRequired(12.5, 30)).toBe(386.25)
    })
})

// ==============================================================================
// Calculation: Cut Yield
// ==============================================================================

describe('calculateCutYield', () => {
    it('calculates yield correctly', () => {
        // 950 actual, 50 defect → 950/(950+50) = 95%
        expect(calculateCutYield(950, 50)).toBe(95)
    })

    it('returns 100% for no defects', () => {
        expect(calculateCutYield(100, 0)).toBe(100)
    })

    it('returns 0% for all defects', () => {
        expect(calculateCutYield(0, 100)).toBe(0)
    })

    it('returns 0 for zero total', () => {
        expect(calculateCutYield(0, 0)).toBe(0)
    })

    it('handles precise percentages', () => {
        // 333 actual, 67 defect → 333/400 = 83.25%
        expect(calculateCutYield(333, 67)).toBe(83.25)
    })
})

// ==============================================================================
// Complete Workflow
// ==============================================================================

describe('complete workflow', () => {
    it('CP_DRAFT → FABRIC_ALLOCATED → IN_CUTTING → CP_COMPLETED', () => {
        expect(() => assertCutPlanTransition('CP_DRAFT', 'FABRIC_ALLOCATED')).not.toThrow()
        expect(() => assertCutPlanTransition('FABRIC_ALLOCATED', 'IN_CUTTING')).not.toThrow()
        expect(() => assertCutPlanTransition('IN_CUTTING', 'CP_COMPLETED')).not.toThrow()
        expect(isCutPlanTerminal('CP_COMPLETED')).toBe(true)
    })

    it('can revert FABRIC_ALLOCATED → CP_DRAFT for corrections', () => {
        expect(() => assertCutPlanTransition('CP_DRAFT', 'FABRIC_ALLOCATED')).not.toThrow()
        expect(() => assertCutPlanTransition('FABRIC_ALLOCATED', 'CP_DRAFT')).not.toThrow()
    })

    it('cancellation from any non-terminal state', () => {
        expect(() => assertCutPlanTransition('CP_DRAFT', 'CP_CANCELLED')).not.toThrow()
        expect(() => assertCutPlanTransition('FABRIC_ALLOCATED', 'CP_CANCELLED')).not.toThrow()
        expect(() => assertCutPlanTransition('IN_CUTTING', 'CP_CANCELLED')).not.toThrow()
    })
})
