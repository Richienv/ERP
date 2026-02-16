import { describe, it, expect } from 'vitest'
import { calculateRemainingMeters, determineRollStatus } from '@/lib/fabric-roll-helpers'
import {
    getAllowedTransferTransitions,
    assertTransferTransition,
    isTransferTerminal,
    TRANSFER_STATUS_LABELS,
} from '@/lib/stock-transfer-machine'

// ==============================================================================
// Fabric Roll — calculateRemainingMeters
// ==============================================================================

describe('calculateRemainingMeters', () => {
    it('returns initial length when no transactions', () => {
        expect(calculateRemainingMeters(100, [])).toBe(100)
    })

    it('RECEIVE adds meters', () => {
        const txns = [{ type: 'FR_RECEIVE', meters: 20 }]
        expect(calculateRemainingMeters(100, txns)).toBe(120)
    })

    it('CUT subtracts meters', () => {
        const txns = [{ type: 'FR_CUT', meters: 30 }]
        expect(calculateRemainingMeters(100, txns)).toBe(70)
    })

    it('TRANSFER subtracts meters', () => {
        const txns = [{ type: 'FR_TRANSFER', meters: 15 }]
        expect(calculateRemainingMeters(100, txns)).toBe(85)
    })

    it('ADJUST can be positive', () => {
        const txns = [{ type: 'FR_ADJUST', meters: 5 }]
        expect(calculateRemainingMeters(100, txns)).toBe(105)
    })

    it('ADJUST can be negative', () => {
        const txns = [{ type: 'FR_ADJUST', meters: -10 }]
        expect(calculateRemainingMeters(100, txns)).toBe(90)
    })

    it('handles multiple mixed transactions', () => {
        const txns = [
            { type: 'FR_CUT', meters: 20 },
            { type: 'FR_CUT', meters: 30 },
            { type: 'FR_RECEIVE', meters: 10 },
            { type: 'FR_ADJUST', meters: -5 },
        ]
        // 100 - 20 - 30 + 10 - 5 = 55
        expect(calculateRemainingMeters(100, txns)).toBe(55)
    })

    it('never returns negative (clamps to 0)', () => {
        const txns = [{ type: 'FR_CUT', meters: 200 }]
        expect(calculateRemainingMeters(100, txns)).toBe(0)
    })

    it('handles decimal precision', () => {
        const txns = [
            { type: 'FR_CUT', meters: 33.33 },
            { type: 'FR_CUT', meters: 33.33 },
        ]
        // 100 - 33.33 - 33.33 = 33.34
        expect(calculateRemainingMeters(100, txns)).toBe(33.34)
    })
})

// ==============================================================================
// Fabric Roll — determineRollStatus
// ==============================================================================

describe('determineRollStatus', () => {
    it('returns DEPLETED when remaining is 0', () => {
        expect(determineRollStatus(0, 'AVAILABLE')).toBe('DEPLETED')
    })

    it('returns DEPLETED when remaining is negative', () => {
        expect(determineRollStatus(-5, 'AVAILABLE')).toBe('DEPLETED')
    })

    it('keeps RESERVED status when remaining > 0', () => {
        expect(determineRollStatus(50, 'RESERVED')).toBe('RESERVED')
    })

    it('returns AVAILABLE when remaining > 0 and not reserved', () => {
        expect(determineRollStatus(50, 'IN_USE')).toBe('AVAILABLE')
        expect(determineRollStatus(50, 'AVAILABLE')).toBe('AVAILABLE')
    })

    it('RESERVED becomes DEPLETED when remaining is 0', () => {
        expect(determineRollStatus(0, 'RESERVED')).toBe('DEPLETED')
    })
})

// ==============================================================================
// Stock Transfer State Machine
// ==============================================================================

describe('stock-transfer-machine', () => {
    describe('getAllowedTransferTransitions', () => {
        it('DRAFT → PENDING_APPROVAL or CANCELLED', () => {
            const allowed = getAllowedTransferTransitions('DRAFT')
            expect(allowed).toContain('PENDING_APPROVAL')
            expect(allowed).toContain('CANCELLED')
            expect(allowed).toHaveLength(2)
        })

        it('PENDING_APPROVAL → APPROVED or CANCELLED', () => {
            const allowed = getAllowedTransferTransitions('PENDING_APPROVAL')
            expect(allowed).toContain('APPROVED')
            expect(allowed).toContain('CANCELLED')
        })

        it('APPROVED → IN_TRANSIT or CANCELLED', () => {
            const allowed = getAllowedTransferTransitions('APPROVED')
            expect(allowed).toContain('IN_TRANSIT')
            expect(allowed).toContain('CANCELLED')
        })

        it('IN_TRANSIT → RECEIVED or CANCELLED', () => {
            const allowed = getAllowedTransferTransitions('IN_TRANSIT')
            expect(allowed).toContain('RECEIVED')
            expect(allowed).toContain('CANCELLED')
        })

        it('RECEIVED has no transitions', () => {
            expect(getAllowedTransferTransitions('RECEIVED')).toEqual([])
        })

        it('CANCELLED has no transitions', () => {
            expect(getAllowedTransferTransitions('CANCELLED')).toEqual([])
        })
    })

    describe('assertTransferTransition', () => {
        it('allows valid transition', () => {
            expect(() => assertTransferTransition('DRAFT', 'PENDING_APPROVAL')).not.toThrow()
        })

        it('allows cancellation from any non-terminal', () => {
            expect(() => assertTransferTransition('DRAFT', 'CANCELLED')).not.toThrow()
            expect(() => assertTransferTransition('PENDING_APPROVAL', 'CANCELLED')).not.toThrow()
            expect(() => assertTransferTransition('IN_TRANSIT', 'CANCELLED')).not.toThrow()
        })

        it('throws on invalid transition (skip)', () => {
            expect(() => assertTransferTransition('DRAFT', 'IN_TRANSIT')).toThrow()
        })

        it('throws on backward transition', () => {
            expect(() => assertTransferTransition('APPROVED', 'DRAFT')).toThrow()
        })

        it('throws from terminal states', () => {
            expect(() => assertTransferTransition('RECEIVED', 'DRAFT')).toThrow()
            expect(() => assertTransferTransition('CANCELLED', 'DRAFT')).toThrow()
        })

        it('error message contains Indonesian labels', () => {
            try {
                assertTransferTransition('DRAFT', 'RECEIVED')
                expect.fail('Should have thrown')
            } catch (error) {
                const msg = (error as Error).message
                expect(msg).toContain('Draft')
                expect(msg).toContain('Diterima')
            }
        })
    })

    describe('isTransferTerminal', () => {
        it('RECEIVED is terminal', () => expect(isTransferTerminal('RECEIVED')).toBe(true))
        it('CANCELLED is terminal', () => expect(isTransferTerminal('CANCELLED')).toBe(true))
        it('DRAFT is not terminal', () => expect(isTransferTerminal('DRAFT')).toBe(false))
        it('IN_TRANSIT is not terminal', () => expect(isTransferTerminal('IN_TRANSIT')).toBe(false))
    })

    describe('TRANSFER_STATUS_LABELS', () => {
        it('all statuses have labels', () => {
            const statuses = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED'] as const
            for (const s of statuses) {
                expect(TRANSFER_STATUS_LABELS[s]).toBeTruthy()
            }
        })
    })
})
