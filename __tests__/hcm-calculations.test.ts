import { describe, it, expect } from 'vitest'
import {
    STANDARD_MONTHLY_HOURS,
    calculateWorkdayOvertimePay,
    calculateHolidayOvertimePay,
    calculateMonthlyOvertimePay,
    calculateBPJS,
    calculateAnnualPPh21,
    calculateMonthlyPPh21,
    calculatePieceRatePayroll,
    calculatePayslip,
    BPJS_KES_MAX_SALARY,
    BPJS_JP_MAX_SALARY,
    PTKP_TK0,
} from '@/lib/hcm-calculations'

// ==============================================================================
// Overtime Calculations (Kepmenaker 102/2004)
// ==============================================================================

describe('calculateWorkdayOvertimePay', () => {
    const salary = 5_000_000 // 5M IDR
    const hourlyRate = salary / STANDARD_MONTHLY_HOURS // ~28,902

    it('returns 0 for 0 hours', () => {
        expect(calculateWorkdayOvertimePay(0, salary)).toBe(0)
    })

    it('returns 0 for negative hours', () => {
        expect(calculateWorkdayOvertimePay(-1, salary)).toBe(0)
    })

    it('calculates 1 hour at 1.5x', () => {
        const pay = calculateWorkdayOvertimePay(1, salary)
        const expected = Math.round(1.5 * hourlyRate)
        expect(pay).toBe(expected)
    })

    it('calculates 2 hours (1h at 1.5x + 1h at 2x)', () => {
        const pay = calculateWorkdayOvertimePay(2, salary)
        const expected = Math.round(1.5 * hourlyRate + 2 * hourlyRate)
        expect(pay).toBe(expected)
    })

    it('calculates 3 hours (1h at 1.5x + 2h at 2x)', () => {
        const pay = calculateWorkdayOvertimePay(3, salary)
        const expected = Math.round(1.5 * hourlyRate + 2 * 2 * hourlyRate)
        expect(pay).toBe(expected)
    })

    it('caps at 3 hours max', () => {
        const pay3 = calculateWorkdayOvertimePay(3, salary)
        const pay5 = calculateWorkdayOvertimePay(5, salary)
        expect(pay5).toBe(pay3)
    })

    it('handles partial hours', () => {
        const pay = calculateWorkdayOvertimePay(0.5, salary)
        const expected = Math.round(0.5 * 1.5 * hourlyRate)
        expect(pay).toBe(expected)
    })
})

describe('calculateHolidayOvertimePay', () => {
    const salary = 5_000_000
    const hourlyRate = salary / STANDARD_MONTHLY_HOURS

    it('returns 0 for 0 hours', () => {
        expect(calculateHolidayOvertimePay(0, salary)).toBe(0)
    })

    it('calculates hours within base (6-day week, 7h) at 2x', () => {
        const pay = calculateHolidayOvertimePay(5, salary, true)
        expect(pay).toBe(Math.round(5 * 2 * hourlyRate))
    })

    it('calculates 8th hour at 3x (6-day week)', () => {
        const pay = calculateHolidayOvertimePay(8, salary, true)
        const expected = Math.round(7 * 2 * hourlyRate + 1 * 3 * hourlyRate)
        expect(pay).toBe(expected)
    })

    it('calculates 9th+ hours at 4x (6-day week)', () => {
        const pay = calculateHolidayOvertimePay(9, salary, true)
        const expected = Math.round(7 * 2 * hourlyRate + 1 * 3 * hourlyRate + 1 * 4 * hourlyRate)
        expect(pay).toBe(expected)
    })

    it('uses 8h base for 5-day week', () => {
        const pay = calculateHolidayOvertimePay(9, salary, false)
        const expected = Math.round(8 * 2 * hourlyRate + 1 * 3 * hourlyRate)
        expect(pay).toBe(expected)
    })
})

describe('calculateMonthlyOvertimePay', () => {
    it('sums workday and holiday overtime', () => {
        const salary = 5_000_000
        const records = [
            { hours: 2, isHoliday: false },
            { hours: 1, isHoliday: false },
            { hours: 8, isHoliday: true },
        ]
        const pay = calculateMonthlyOvertimePay(records, salary)
        const expected =
            calculateWorkdayOvertimePay(2, salary) +
            calculateWorkdayOvertimePay(1, salary) +
            calculateHolidayOvertimePay(8, salary)
        expect(pay).toBe(expected)
    })

    it('returns 0 for empty records', () => {
        expect(calculateMonthlyOvertimePay([], 5_000_000)).toBe(0)
    })
})

// ==============================================================================
// BPJS Calculations
// ==============================================================================

describe('calculateBPJS', () => {
    it('calculates correctly for salary below caps', () => {
        const bpjs = calculateBPJS(5_000_000)

        // Kesehatan: 1% employee = 50,000; 4% employer = 200,000
        expect(bpjs.kesehatanEmployee).toBe(50_000)
        expect(bpjs.kesehatanEmployer).toBe(200_000)

        // JHT: 2% employee = 100,000; 3.7% employer = 185,000
        expect(bpjs.jhtEmployee).toBe(100_000)
        expect(bpjs.jhtEmployer).toBe(185_000)

        // JP: 1% employee = 50,000; 2% employer = 100,000
        expect(bpjs.jpEmployee).toBe(50_000)
        expect(bpjs.jpEmployer).toBe(100_000)

        // Total employee
        expect(bpjs.totalEmployee).toBe(200_000) // 50K + 100K + 50K
    })

    it('caps Kesehatan at max salary', () => {
        const bpjs = calculateBPJS(20_000_000) // Above 12M cap
        expect(bpjs.kesehatanEmployee).toBe(Math.round(BPJS_KES_MAX_SALARY * 0.01))
        expect(bpjs.kesehatanEmployer).toBe(Math.round(BPJS_KES_MAX_SALARY * 0.04))
    })

    it('caps JP at max salary', () => {
        const bpjs = calculateBPJS(20_000_000) // Above 9.5M cap
        expect(bpjs.jpEmployee).toBe(Math.round(BPJS_JP_MAX_SALARY * 0.01))
        expect(bpjs.jpEmployer).toBe(Math.round(BPJS_JP_MAX_SALARY * 0.02))
    })

    it('JHT is based on full salary (no cap)', () => {
        const bpjs = calculateBPJS(50_000_000)
        expect(bpjs.jhtEmployee).toBe(Math.round(50_000_000 * 0.02))
        expect(bpjs.jhtEmployer).toBe(Math.round(50_000_000 * 0.037))
    })

    it('handles 0 salary', () => {
        const bpjs = calculateBPJS(0)
        expect(bpjs.totalEmployee).toBe(0)
        expect(bpjs.totalEmployer).toBe(0)
        expect(bpjs.total).toBe(0)
    })

    it('total = employee + employer', () => {
        const bpjs = calculateBPJS(8_000_000)
        expect(bpjs.total).toBe(bpjs.totalEmployee + bpjs.totalEmployer)
    })
})

// ==============================================================================
// PPh 21 Calculations
// ==============================================================================

describe('calculateAnnualPPh21', () => {
    it('returns 0 when income below PTKP', () => {
        expect(calculateAnnualPPh21(50_000_000)).toBe(0) // Below 54M PTKP
    })

    it('returns 0 for exactly PTKP', () => {
        expect(calculateAnnualPPh21(PTKP_TK0)).toBe(0)
    })

    it('calculates 5% for first bracket (up to 60M above PTKP)', () => {
        // 80M gross - 54M PTKP = 26M taxable
        const tax = calculateAnnualPPh21(80_000_000)
        expect(tax).toBe(Math.round(26_000_000 * 0.05)) // 1,300,000
    })

    it('calculates progressive rates correctly', () => {
        // 200M gross - 54M PTKP = 146M taxable
        // First 60M at 5% = 3,000,000
        // Next 86M at 15% = 12,900,000
        // Total = 15,900,000
        const tax = calculateAnnualPPh21(200_000_000)
        expect(tax).toBe(15_900_000)
    })

    it('handles high income (all brackets)', () => {
        // 1B gross - 54M PTKP = 946M taxable
        // 60M at 5% = 3M
        // 190M at 15% = 28.5M
        // 250M at 25% = 62.5M
        // 446M at 30% = 133.8M
        // Total = 227,800,000
        const tax = calculateAnnualPPh21(1_000_000_000)
        expect(tax).toBe(227_800_000)
    })

    it('accepts custom PTKP', () => {
        const customPTKP = 58_500_000 // K/0 PTKP
        const tax = calculateAnnualPPh21(80_000_000, customPTKP)
        expect(tax).toBe(Math.round(21_500_000 * 0.05))
    })
})

describe('calculateMonthlyPPh21', () => {
    it('returns monthly tax (1/12 of annual)', () => {
        const monthlyGross = 10_000_000
        const bpjsDeduction = 200_000
        const monthlyTax = calculateMonthlyPPh21(monthlyGross, bpjsDeduction)

        // Annual taxable = (10M - 200K) * 12 = 117.6M
        // 117.6M - 54M PTKP = 63.6M
        // 60M at 5% = 3M; 3.6M at 15% = 540K
        // Annual tax = 3,540,000
        // Monthly = 295,000
        expect(monthlyTax).toBe(295_000)
    })

    it('returns 0 for low income', () => {
        const tax = calculateMonthlyPPh21(3_000_000, 100_000)
        // Annual taxable = (3M - 100K) * 12 = 34.8M < 54M PTKP
        expect(tax).toBe(0)
    })
})

// ==============================================================================
// Piece-Rate Payroll
// ==============================================================================

describe('calculatePieceRatePayroll', () => {
    it('calculates piece earnings', () => {
        const result = calculatePieceRatePayroll(100, 5000)
        expect(result.pieceEarnings).toBe(500_000)
        expect(result.totalGross).toBe(500_000) // No base salary
    })

    it('adds base salary to piece earnings', () => {
        const result = calculatePieceRatePayroll(50, 10000, 3_000_000)
        expect(result.pieceEarnings).toBe(500_000)
        expect(result.totalGross).toBe(3_500_000)
    })

    it('handles 0 pieces', () => {
        const result = calculatePieceRatePayroll(0, 5000, 3_000_000)
        expect(result.pieceEarnings).toBe(0)
        expect(result.totalGross).toBe(3_000_000)
    })

    it('rounds to whole numbers', () => {
        const result = calculatePieceRatePayroll(3, 3333)
        expect(result.pieceEarnings).toBe(9999)
    })
})

// ==============================================================================
// Complete Payslip
// ==============================================================================

describe('calculatePayslip', () => {
    it('calculates complete payslip with all components', () => {
        const result = calculatePayslip({
            baseSalary: 8_000_000,
            overtimePay: 500_000,
            pieceEarnings: 200_000,
            allowances: 1_000_000,
        })

        // Gross = 8M + 500K + 200K + 1M = 9.7M
        expect(result.grossIncome).toBe(9_700_000)

        // BPJS on base salary (8M)
        expect(result.bpjs.kesehatanEmployee).toBe(80_000)
        expect(result.bpjs.jhtEmployee).toBe(160_000)
        expect(result.bpjs.jpEmployee).toBe(80_000)
        expect(result.bpjs.totalEmployee).toBe(320_000)

        // PPh21 on gross - BPJS employee
        expect(result.pph21).toBeGreaterThan(0)

        // Net = gross - totalDeductions
        expect(result.netIncome).toBe(result.grossIncome - result.totalDeductions)
        expect(result.netIncome).toBeLessThan(result.grossIncome)
    })

    it('handles salary-only payslip', () => {
        const result = calculatePayslip({ baseSalary: 5_000_000 })
        expect(result.grossIncome).toBe(5_000_000)
        expect(result.overtimePay).toBe(0)
        expect(result.pieceEarnings).toBe(0)
        expect(result.allowances).toBe(0)
    })

    it('net income is always less than gross (due to deductions)', () => {
        const result = calculatePayslip({ baseSalary: 10_000_000 })
        expect(result.netIncome).toBeLessThan(result.grossIncome)
    })

    it('totalDeductions = BPJS employee + PPh21', () => {
        const result = calculatePayslip({ baseSalary: 7_000_000 })
        expect(result.totalDeductions).toBe(result.bpjs.totalEmployee + result.pph21)
    })
})
