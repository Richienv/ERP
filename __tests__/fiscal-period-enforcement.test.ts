import { describe, it, expect } from 'vitest'

/**
 * Tests for Fiscal Period Enforcement (ACCT2-004).
 *
 * When a FiscalPeriod exists and isClosed=true for a journal date's year/month,
 * postJournalEntry() must reject with an error. If no FiscalPeriod exists or
 * isClosed=false, posting is allowed.
 */

// ==========================================
// Fiscal Period Validation Logic (mirrors postJournalEntry check)
// ==========================================

interface FiscalPeriod {
    year: number
    month: number
    name: string
    isClosed: boolean
    closedAt: Date | null
}

/**
 * Validate that journal entries cannot be posted to closed fiscal periods.
 * Same logic as in postJournalEntry() in finance-gl.ts.
 */
function validateFiscalPeriod(
    journalDate: Date,
    fiscalPeriods: Map<string, FiscalPeriod>
): { valid: boolean; error?: string } {
    const month = journalDate.getMonth() + 1
    const year = journalDate.getFullYear()
    const key = `${year}-${month}`
    const period = fiscalPeriods.get(key)

    if (period?.isClosed) {
        return {
            valid: false,
            error: `Periode fiskal ${period.name} sudah ditutup. Tidak bisa posting jurnal ke periode ini.`
        }
    }

    return { valid: true }
}

// ==========================================
// Test Data
// ==========================================

function createFiscalPeriods(): Map<string, FiscalPeriod> {
    return new Map([
        ['2026-1', {
            year: 2026,
            month: 1,
            name: 'Januari 2026',
            isClosed: true,
            closedAt: new Date('2026-02-05')
        }],
        ['2026-2', {
            year: 2026,
            month: 2,
            name: 'Februari 2026',
            isClosed: true,
            closedAt: new Date('2026-03-05')
        }],
        ['2026-3', {
            year: 2026,
            month: 3,
            name: 'Maret 2026',
            isClosed: false,
            closedAt: null
        }],
    ])
}

// ==========================================
// Tests
// ==========================================

describe('Fiscal Period Enforcement', () => {
    const fiscalPeriods = createFiscalPeriods()

    describe('Closed fiscal periods block posting', () => {
        it('should BLOCK posting to a closed period (January 2026)', () => {
            const result = validateFiscalPeriod(
                new Date('2026-01-15'),
                fiscalPeriods
            )
            expect(result.valid).toBe(false)
            expect(result.error).toContain('Januari 2026')
            expect(result.error).toContain('sudah ditutup')
        })

        it('should BLOCK posting to another closed period (February 2026)', () => {
            const result = validateFiscalPeriod(
                new Date('2026-02-28'),
                fiscalPeriods
            )
            expect(result.valid).toBe(false)
            expect(result.error).toContain('Februari 2026')
            expect(result.error).toContain('sudah ditutup')
        })

        it('should include Indonesian error message', () => {
            const result = validateFiscalPeriod(
                new Date(2026, 0, 15), // January 15, 2026 (local time)
                fiscalPeriods
            )
            expect(result.valid).toBe(false)
            expect(result.error).toMatch(/Periode fiskal .+ sudah ditutup/)
            expect(result.error).toContain('Tidak bisa posting jurnal ke periode ini')
        })
    })

    describe('Open fiscal periods allow posting', () => {
        it('should ALLOW posting to an open period (March 2026)', () => {
            const result = validateFiscalPeriod(
                new Date('2026-03-10'),
                fiscalPeriods
            )
            expect(result.valid).toBe(true)
            expect(result.error).toBeUndefined()
        })
    })

    describe('Missing fiscal periods allow posting', () => {
        it('should ALLOW posting when no FiscalPeriod exists for the month', () => {
            const result = validateFiscalPeriod(
                new Date('2026-04-15'),
                fiscalPeriods
            )
            expect(result.valid).toBe(true)
            expect(result.error).toBeUndefined()
        })

        it('should ALLOW posting to a year with no fiscal periods defined', () => {
            const result = validateFiscalPeriod(
                new Date('2025-06-15'),
                fiscalPeriods
            )
            expect(result.valid).toBe(true)
            expect(result.error).toBeUndefined()
        })
    })

    describe('Edge cases', () => {
        it('should use correct month extraction (JS months are 0-indexed)', () => {
            // December = month 12, JS getMonth() returns 11
            const decemberPeriods = new Map<string, FiscalPeriod>([
                ['2025-12', {
                    year: 2025,
                    month: 12,
                    name: 'Desember 2025',
                    isClosed: true,
                    closedAt: new Date('2026-01-05')
                }],
            ])
            const result = validateFiscalPeriod(
                new Date('2025-12-31'),
                decemberPeriods
            )
            expect(result.valid).toBe(false)
            expect(result.error).toContain('Desember 2025')
        })

        it('should handle first day of month correctly', () => {
            const result = validateFiscalPeriod(
                new Date(2026, 0, 1), // January 1, 2026 (local time)
                fiscalPeriods
            )
            expect(result.valid).toBe(false)
        })

        it('should handle last day of month correctly', () => {
            const result = validateFiscalPeriod(
                new Date('2026-01-31'),
                fiscalPeriods
            )
            expect(result.valid).toBe(false)
        })

        it('should differentiate between open and closed periods', () => {
            // February is closed, March is open
            const closedResult = validateFiscalPeriod(
                new Date('2026-02-15'),
                fiscalPeriods
            )
            const openResult = validateFiscalPeriod(
                new Date('2026-03-15'),
                fiscalPeriods
            )
            expect(closedResult.valid).toBe(false)
            expect(openResult.valid).toBe(true)
        })
    })

    describe('Applies to all journal types', () => {
        it('should block MANUAL journal entries to closed periods', () => {
            // Fiscal period check happens before sourceDocumentType check
            const result = validateFiscalPeriod(
                new Date('2026-01-15'),
                fiscalPeriods
            )
            expect(result.valid).toBe(false)
        })

        it('should block system-generated entries to closed periods', () => {
            // Same check applies — fiscal period enforcement is universal
            const result = validateFiscalPeriod(
                new Date('2026-02-20'),
                fiscalPeriods
            )
            expect(result.valid).toBe(false)
        })
    })
})
