import { describe, it, expect } from 'vitest'
import {
    STAGE_ORDER,
    STAGE_LABELS,
    STAGE_COLORS,
    getNextStage,
    getReworkStage,
    getAllowedTransitions,
    assertStageTransition,
    getStageIndex,
    getStageProgress,
    isTerminal,
    isRework,
} from '@/lib/garment-stage-machine'

describe('garment-stage-machine', () => {
    // ==========================================================================
    // STAGE_ORDER
    // ==========================================================================
    describe('STAGE_ORDER', () => {
        it('has 6 stages in correct order', () => {
            expect(STAGE_ORDER).toEqual([
                'CUTTING', 'SEWING', 'FINISHING', 'QC', 'PACKING', 'DONE',
            ])
        })

        it('every stage has a label', () => {
            for (const stage of STAGE_ORDER) {
                expect(STAGE_LABELS[stage]).toBeTruthy()
            }
        })

        it('every stage has colors', () => {
            for (const stage of STAGE_ORDER) {
                expect(STAGE_COLORS[stage]).toHaveProperty('bg')
                expect(STAGE_COLORS[stage]).toHaveProperty('text')
                expect(STAGE_COLORS[stage]).toHaveProperty('accent')
            }
        })
    })

    // ==========================================================================
    // getNextStage
    // ==========================================================================
    describe('getNextStage', () => {
        it('CUTTING → SEWING', () => {
            expect(getNextStage('CUTTING')).toBe('SEWING')
        })

        it('SEWING → FINISHING', () => {
            expect(getNextStage('SEWING')).toBe('FINISHING')
        })

        it('FINISHING → QC', () => {
            expect(getNextStage('FINISHING')).toBe('QC')
        })

        it('QC → PACKING', () => {
            expect(getNextStage('QC')).toBe('PACKING')
        })

        it('PACKING → DONE', () => {
            expect(getNextStage('PACKING')).toBe('DONE')
        })

        it('DONE → null (terminal)', () => {
            expect(getNextStage('DONE')).toBeNull()
        })
    })

    // ==========================================================================
    // getReworkStage
    // ==========================================================================
    describe('getReworkStage', () => {
        it('QC can rework to FINISHING', () => {
            expect(getReworkStage('QC')).toBe('FINISHING')
        })

        it('FINISHING can rework to SEWING', () => {
            expect(getReworkStage('FINISHING')).toBe('SEWING')
        })

        it('CUTTING has no rework', () => {
            expect(getReworkStage('CUTTING')).toBeNull()
        })

        it('SEWING has no rework', () => {
            expect(getReworkStage('SEWING')).toBeNull()
        })

        it('PACKING has no rework', () => {
            expect(getReworkStage('PACKING')).toBeNull()
        })

        it('DONE has no rework', () => {
            expect(getReworkStage('DONE')).toBeNull()
        })
    })

    // ==========================================================================
    // getAllowedTransitions
    // ==========================================================================
    describe('getAllowedTransitions', () => {
        it('CUTTING can only go forward to SEWING', () => {
            expect(getAllowedTransitions('CUTTING')).toEqual(['SEWING'])
        })

        it('QC can go forward (PACKING) or rework (FINISHING)', () => {
            const transitions = getAllowedTransitions('QC')
            expect(transitions).toContain('PACKING')
            expect(transitions).toContain('FINISHING')
            expect(transitions).toHaveLength(2)
        })

        it('FINISHING can go forward (QC) or rework (SEWING)', () => {
            const transitions = getAllowedTransitions('FINISHING')
            expect(transitions).toContain('QC')
            expect(transitions).toContain('SEWING')
            expect(transitions).toHaveLength(2)
        })

        it('DONE has no transitions', () => {
            expect(getAllowedTransitions('DONE')).toEqual([])
        })
    })

    // ==========================================================================
    // assertStageTransition
    // ==========================================================================
    describe('assertStageTransition', () => {
        it('allows valid forward transition', () => {
            expect(() => assertStageTransition('CUTTING', 'SEWING')).not.toThrow()
        })

        it('allows valid rework transition', () => {
            expect(() => assertStageTransition('QC', 'FINISHING')).not.toThrow()
        })

        it('throws on invalid transition (skip stage)', () => {
            expect(() => assertStageTransition('CUTTING', 'QC')).toThrow()
        })

        it('throws on invalid transition (backward non-rework)', () => {
            expect(() => assertStageTransition('PACKING', 'SEWING')).toThrow()
        })

        it('throws on DONE → anything', () => {
            expect(() => assertStageTransition('DONE', 'CUTTING')).toThrow()
        })

        it('error message contains stage labels in Indonesian', () => {
            try {
                assertStageTransition('CUTTING', 'DONE')
                expect.fail('Should have thrown')
            } catch (error) {
                const msg = (error as Error).message
                expect(msg).toContain('Potong')
                expect(msg).toContain('Selesai')
            }
        })
    })

    // ==========================================================================
    // getStageIndex / getStageProgress
    // ==========================================================================
    describe('getStageIndex', () => {
        it('CUTTING = 0', () => expect(getStageIndex('CUTTING')).toBe(0))
        it('DONE = 5', () => expect(getStageIndex('DONE')).toBe(5))
    })

    describe('getStageProgress', () => {
        it('CUTTING = 17%', () => expect(getStageProgress('CUTTING')).toBe(17))
        it('QC = 67%', () => expect(getStageProgress('QC')).toBe(67))
        it('DONE = 100%', () => expect(getStageProgress('DONE')).toBe(100))
    })

    // ==========================================================================
    // isTerminal / isRework
    // ==========================================================================
    describe('isTerminal', () => {
        it('DONE is terminal', () => expect(isTerminal('DONE')).toBe(true))
        it('CUTTING is not terminal', () => expect(isTerminal('CUTTING')).toBe(false))
        it('QC is not terminal', () => expect(isTerminal('QC')).toBe(false))
    })

    describe('isRework', () => {
        it('QC → FINISHING is rework', () => expect(isRework('QC', 'FINISHING')).toBe(true))
        it('FINISHING → SEWING is rework', () => expect(isRework('FINISHING', 'SEWING')).toBe(true))
        it('CUTTING → SEWING is not rework', () => expect(isRework('CUTTING', 'SEWING')).toBe(false))
        it('SEWING → FINISHING is not rework', () => expect(isRework('SEWING', 'FINISHING')).toBe(false))
    })
})
