import { describe, it, expect } from 'vitest'
import {
    allowedSubcontractTransitions,
    assertSubcontractTransition,
    canTransitionTo,
    getNextStatuses,
    isTerminal,
    isActive,
    subcontractStatusLabels,
    subcontractStatusColors,
} from '@/lib/subcontract-state-machine'

// ==============================================================================
// Transition Rules
// ==============================================================================

describe('allowedSubcontractTransitions', () => {
    it('SC_DRAFT can go to SC_SENT or SC_CANCELLED', () => {
        expect(allowedSubcontractTransitions.SC_DRAFT).toEqual(['SC_SENT', 'SC_CANCELLED'])
    })

    it('SC_SENT can go to SC_IN_PROGRESS or SC_CANCELLED', () => {
        expect(allowedSubcontractTransitions.SC_SENT).toEqual(['SC_IN_PROGRESS', 'SC_CANCELLED'])
    })

    it('SC_IN_PROGRESS can go to SC_PARTIAL_COMPLETE, SC_COMPLETED, or SC_CANCELLED', () => {
        expect(allowedSubcontractTransitions.SC_IN_PROGRESS).toEqual([
            'SC_PARTIAL_COMPLETE',
            'SC_COMPLETED',
            'SC_CANCELLED',
        ])
    })

    it('SC_PARTIAL_COMPLETE can go to SC_COMPLETED or SC_CANCELLED', () => {
        expect(allowedSubcontractTransitions.SC_PARTIAL_COMPLETE).toEqual([
            'SC_COMPLETED',
            'SC_CANCELLED',
        ])
    })

    it('SC_COMPLETED has no transitions (terminal)', () => {
        expect(allowedSubcontractTransitions.SC_COMPLETED).toBeUndefined()
    })

    it('SC_CANCELLED has no transitions (terminal)', () => {
        expect(allowedSubcontractTransitions.SC_CANCELLED).toBeUndefined()
    })
})

// ==============================================================================
// assertSubcontractTransition
// ==============================================================================

describe('assertSubcontractTransition', () => {
    it('allows valid transition SC_DRAFT → SC_SENT', () => {
        expect(() => assertSubcontractTransition('SC_DRAFT', 'SC_SENT')).not.toThrow()
    })

    it('allows valid transition SC_IN_PROGRESS → SC_COMPLETED', () => {
        expect(() => assertSubcontractTransition('SC_IN_PROGRESS', 'SC_COMPLETED')).not.toThrow()
    })

    it('allows cancellation from SC_DRAFT', () => {
        expect(() => assertSubcontractTransition('SC_DRAFT', 'SC_CANCELLED')).not.toThrow()
    })

    it('throws on invalid transition SC_DRAFT → SC_COMPLETED', () => {
        expect(() => assertSubcontractTransition('SC_DRAFT', 'SC_COMPLETED')).toThrow(
            /tidak valid/
        )
    })

    it('throws on invalid transition SC_SENT → SC_COMPLETED (must go through IN_PROGRESS)', () => {
        expect(() => assertSubcontractTransition('SC_SENT', 'SC_COMPLETED')).toThrow(
            /tidak valid/
        )
    })

    it('throws on transition from terminal state SC_COMPLETED', () => {
        expect(() => assertSubcontractTransition('SC_COMPLETED', 'SC_DRAFT')).toThrow(
            /tidak valid/
        )
    })

    it('throws on transition from terminal state SC_CANCELLED', () => {
        expect(() => assertSubcontractTransition('SC_CANCELLED', 'SC_SENT')).toThrow(
            /tidak valid/
        )
    })
})

// ==============================================================================
// canTransitionTo
// ==============================================================================

describe('canTransitionTo', () => {
    it('returns true for valid transition', () => {
        expect(canTransitionTo('SC_DRAFT', 'SC_SENT')).toBe(true)
    })

    it('returns false for invalid transition', () => {
        expect(canTransitionTo('SC_DRAFT', 'SC_COMPLETED')).toBe(false)
    })

    it('returns false from terminal state', () => {
        expect(canTransitionTo('SC_COMPLETED', 'SC_DRAFT')).toBe(false)
    })
})

// ==============================================================================
// getNextStatuses
// ==============================================================================

describe('getNextStatuses', () => {
    it('returns available transitions for SC_IN_PROGRESS', () => {
        const next = getNextStatuses('SC_IN_PROGRESS')
        expect(next).toHaveLength(3)
        expect(next).toContain('SC_PARTIAL_COMPLETE')
        expect(next).toContain('SC_COMPLETED')
        expect(next).toContain('SC_CANCELLED')
    })

    it('returns empty array for terminal state', () => {
        expect(getNextStatuses('SC_COMPLETED')).toEqual([])
        expect(getNextStatuses('SC_CANCELLED')).toEqual([])
    })
})

// ==============================================================================
// isTerminal / isActive
// ==============================================================================

describe('isTerminal', () => {
    it('SC_COMPLETED is terminal', () => {
        expect(isTerminal('SC_COMPLETED')).toBe(true)
    })

    it('SC_CANCELLED is terminal', () => {
        expect(isTerminal('SC_CANCELLED')).toBe(true)
    })

    it('SC_IN_PROGRESS is not terminal', () => {
        expect(isTerminal('SC_IN_PROGRESS')).toBe(false)
    })

    it('SC_DRAFT is not terminal', () => {
        expect(isTerminal('SC_DRAFT')).toBe(false)
    })
})

describe('isActive', () => {
    it('SC_SENT is active', () => {
        expect(isActive('SC_SENT')).toBe(true)
    })

    it('SC_IN_PROGRESS is active', () => {
        expect(isActive('SC_IN_PROGRESS')).toBe(true)
    })

    it('SC_PARTIAL_COMPLETE is active', () => {
        expect(isActive('SC_PARTIAL_COMPLETE')).toBe(true)
    })

    it('SC_DRAFT is not active', () => {
        expect(isActive('SC_DRAFT')).toBe(false)
    })

    it('SC_COMPLETED is not active', () => {
        expect(isActive('SC_COMPLETED')).toBe(false)
    })

    it('SC_CANCELLED is not active', () => {
        expect(isActive('SC_CANCELLED')).toBe(false)
    })
})

// ==============================================================================
// Labels & Colors
// ==============================================================================

describe('subcontractStatusLabels', () => {
    it('has labels for all 6 statuses', () => {
        const statuses = [
            'SC_DRAFT',
            'SC_SENT',
            'SC_IN_PROGRESS',
            'SC_PARTIAL_COMPLETE',
            'SC_COMPLETED',
            'SC_CANCELLED',
        ] as const

        for (const s of statuses) {
            expect(subcontractStatusLabels[s]).toBeDefined()
            expect(typeof subcontractStatusLabels[s]).toBe('string')
            expect(subcontractStatusLabels[s].length).toBeGreaterThan(0)
        }
    })

    it('SC_DRAFT label is "Draft"', () => {
        expect(subcontractStatusLabels.SC_DRAFT).toBe('Draft')
    })

    it('SC_COMPLETED label is "Selesai"', () => {
        expect(subcontractStatusLabels.SC_COMPLETED).toBe('Selesai')
    })
})

describe('subcontractStatusColors', () => {
    it('has colors for all 6 statuses', () => {
        const statuses = [
            'SC_DRAFT',
            'SC_SENT',
            'SC_IN_PROGRESS',
            'SC_PARTIAL_COMPLETE',
            'SC_COMPLETED',
            'SC_CANCELLED',
        ] as const

        for (const s of statuses) {
            expect(subcontractStatusColors[s]).toBeDefined()
            expect(subcontractStatusColors[s]).toContain('bg-')
        }
    })
})

// ==============================================================================
// Happy path workflow
// ==============================================================================

describe('complete workflow', () => {
    it('SC_DRAFT → SC_SENT → SC_IN_PROGRESS → SC_PARTIAL_COMPLETE → SC_COMPLETED', () => {
        expect(() => assertSubcontractTransition('SC_DRAFT', 'SC_SENT')).not.toThrow()
        expect(() => assertSubcontractTransition('SC_SENT', 'SC_IN_PROGRESS')).not.toThrow()
        expect(() =>
            assertSubcontractTransition('SC_IN_PROGRESS', 'SC_PARTIAL_COMPLETE')
        ).not.toThrow()
        expect(() =>
            assertSubcontractTransition('SC_PARTIAL_COMPLETE', 'SC_COMPLETED')
        ).not.toThrow()

        expect(isTerminal('SC_COMPLETED')).toBe(true)
    })

    it('SC_DRAFT → SC_SENT → SC_IN_PROGRESS → SC_COMPLETED (skip partial)', () => {
        expect(() => assertSubcontractTransition('SC_DRAFT', 'SC_SENT')).not.toThrow()
        expect(() => assertSubcontractTransition('SC_SENT', 'SC_IN_PROGRESS')).not.toThrow()
        expect(() =>
            assertSubcontractTransition('SC_IN_PROGRESS', 'SC_COMPLETED')
        ).not.toThrow()
    })

    it('cancellation from any active state', () => {
        expect(() => assertSubcontractTransition('SC_DRAFT', 'SC_CANCELLED')).not.toThrow()
        expect(() => assertSubcontractTransition('SC_SENT', 'SC_CANCELLED')).not.toThrow()
        expect(() => assertSubcontractTransition('SC_IN_PROGRESS', 'SC_CANCELLED')).not.toThrow()
        expect(() =>
            assertSubcontractTransition('SC_PARTIAL_COMPLETE', 'SC_CANCELLED')
        ).not.toThrow()
    })
})
