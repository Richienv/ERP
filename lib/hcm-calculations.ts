/**
 * Indonesian HCM Calculation Functions
 * Based on Indonesian labor law (UU Ketenagakerjaan, Kepmenaker 102/2004, PP 35/2021)
 *
 * All functions are pure and exported for unit testing.
 */

// ==============================================================================
// Constants
// ==============================================================================

/** Standard working hours per month (UU 13/2003: 40 hours/week × 52 weeks / 12 months) */
export const STANDARD_MONTHLY_HOURS = 173

/** Standard working hours per day */
export const STANDARD_DAILY_HOURS = 8

/** Standard working days per week (6-day work week) */
export const STANDARD_WORK_DAYS_PER_WEEK = 6

// BPJS Rates (PP 35/2021 & Perpres 64/2020)

/** BPJS Kesehatan employee rate: 1% */
export const BPJS_KES_EMPLOYEE_RATE = 0.01
/** BPJS Kesehatan employer rate: 4% */
export const BPJS_KES_EMPLOYER_RATE = 0.04
/** BPJS Kesehatan max salary basis: Rp 12,000,000 */
export const BPJS_KES_MAX_SALARY = 12_000_000

/** BPJS Ketenagakerjaan JHT employee rate: 2% */
export const BPJS_JHT_EMPLOYEE_RATE = 0.02
/** BPJS Ketenagakerjaan JHT employer rate: 3.7% */
export const BPJS_JHT_EMPLOYER_RATE = 0.037

/** BPJS JP (Pensiun) employee rate: 1% */
export const BPJS_JP_EMPLOYEE_RATE = 0.01
/** BPJS JP employer rate: 2% */
export const BPJS_JP_EMPLOYER_RATE = 0.02
/** BPJS JP max salary basis: Rp 9,559,600 (2024, updated annually) */
export const BPJS_JP_MAX_SALARY = 9_559_600

/** BPJS JKK employer rate (varies by risk class): 0.24% - 1.74% */
export const BPJS_JKK_RATE = 0.0089 // Mid-range for manufacturing
/** BPJS JKM employer rate: 0.3% */
export const BPJS_JKM_RATE = 0.003

// PPh 21 Progressive Tax Brackets (UU HPP, effective 2022)
export const PPH21_BRACKETS = [
    { limit: 60_000_000, rate: 0.05 },    // 5% up to 60M
    { limit: 250_000_000, rate: 0.15 },   // 15% 60M-250M
    { limit: 500_000_000, rate: 0.25 },   // 25% 250M-500M
    { limit: 5_000_000_000, rate: 0.30 }, // 30% 500M-5B
    { limit: Infinity, rate: 0.35 },       // 35% above 5B
] as const

/** PTKP (Non-Taxable Income) - Single, no dependents (TK/0) */
export const PTKP_TK0 = 54_000_000

// ==============================================================================
// Overtime Calculations (Kepmenaker 102/MEN/VI/2004)
// ==============================================================================

/**
 * Calculate overtime pay for a workday (non-holiday).
 * - First hour: 1.5x hourly rate
 * - Subsequent hours: 2x hourly rate
 * - Max overtime: 3 hours/day, 14 hours/week
 */
export function calculateWorkdayOvertimePay(
    overtimeHours: number,
    monthlySalary: number
): number {
    if (overtimeHours <= 0) return 0

    const hourlyRate = monthlySalary / STANDARD_MONTHLY_HOURS
    const cappedHours = Math.min(overtimeHours, 3) // Max 3 hours on workday

    let pay = 0
    if (cappedHours >= 1) {
        pay += 1.5 * hourlyRate // First hour at 1.5x
        pay += Math.min(cappedHours - 1, 2) * 2 * hourlyRate // Remaining at 2x
    } else {
        pay += cappedHours * 1.5 * hourlyRate // Partial first hour
    }

    return Math.round(pay)
}

/**
 * Calculate overtime pay for a rest day/holiday.
 * - First 7 hours (6-day week) or 8 hours (5-day week): 2x hourly rate
 * - 8th hour: 3x hourly rate
 * - 9th+ hours: 4x hourly rate
 */
export function calculateHolidayOvertimePay(
    overtimeHours: number,
    monthlySalary: number,
    isSixDayWeek: boolean = true
): number {
    if (overtimeHours <= 0) return 0

    const hourlyRate = monthlySalary / STANDARD_MONTHLY_HOURS
    const baseHours = isSixDayWeek ? 7 : 8

    let pay = 0
    const h = Math.min(overtimeHours, 12) // Reasonable cap

    if (h <= baseHours) {
        pay = h * 2 * hourlyRate
    } else if (h <= baseHours + 1) {
        pay = baseHours * 2 * hourlyRate
        pay += (h - baseHours) * 3 * hourlyRate
    } else {
        pay = baseHours * 2 * hourlyRate
        pay += 1 * 3 * hourlyRate
        pay += (h - baseHours - 1) * 4 * hourlyRate
    }

    return Math.round(pay)
}

/**
 * Calculate total monthly overtime pay from daily records.
 */
export function calculateMonthlyOvertimePay(
    dailyOvertimeRecords: { hours: number; isHoliday: boolean }[],
    monthlySalary: number
): number {
    let total = 0
    for (const record of dailyOvertimeRecords) {
        if (record.isHoliday) {
            total += calculateHolidayOvertimePay(record.hours, monthlySalary)
        } else {
            total += calculateWorkdayOvertimePay(record.hours, monthlySalary)
        }
    }
    return total
}

// ==============================================================================
// BPJS Calculations
// ==============================================================================

export interface BPJSBreakdown {
    // Employee deductions
    kesehatanEmployee: number
    jhtEmployee: number
    jpEmployee: number
    totalEmployee: number

    // Employer contributions
    kesehatanEmployer: number
    jhtEmployer: number
    jpEmployer: number
    jkkEmployer: number
    jkmEmployer: number
    totalEmployer: number

    // Grand total
    total: number
}

/**
 * Calculate BPJS contributions for both employee and employer.
 */
export function calculateBPJS(monthlySalary: number): BPJSBreakdown {
    // BPJS Kesehatan: based on salary, capped at max
    const kesSalary = Math.min(monthlySalary, BPJS_KES_MAX_SALARY)
    const kesehatanEmployee = Math.round(kesSalary * BPJS_KES_EMPLOYEE_RATE)
    const kesehatanEmployer = Math.round(kesSalary * BPJS_KES_EMPLOYER_RATE)

    // BPJS JHT: based on full salary
    const jhtEmployee = Math.round(monthlySalary * BPJS_JHT_EMPLOYEE_RATE)
    const jhtEmployer = Math.round(monthlySalary * BPJS_JHT_EMPLOYER_RATE)

    // BPJS JP: based on salary, capped at max
    const jpSalary = Math.min(monthlySalary, BPJS_JP_MAX_SALARY)
    const jpEmployee = Math.round(jpSalary * BPJS_JP_EMPLOYEE_RATE)
    const jpEmployer = Math.round(jpSalary * BPJS_JP_EMPLOYER_RATE)

    // JKK & JKM: employer only
    const jkkEmployer = Math.round(monthlySalary * BPJS_JKK_RATE)
    const jkmEmployer = Math.round(monthlySalary * BPJS_JKM_RATE)

    const totalEmployee = kesehatanEmployee + jhtEmployee + jpEmployee
    const totalEmployer = kesehatanEmployer + jhtEmployer + jpEmployer + jkkEmployer + jkmEmployer

    return {
        kesehatanEmployee,
        jhtEmployee,
        jpEmployee,
        totalEmployee,
        kesehatanEmployer,
        jhtEmployer,
        jpEmployer,
        jkkEmployer,
        jkmEmployer,
        totalEmployer,
        total: totalEmployee + totalEmployer,
    }
}

// ==============================================================================
// PPh 21 (Income Tax) Calculations
// ==============================================================================

/**
 * Calculate annual PPh 21 using progressive tax brackets.
 * Uses the simplified TER method introduced in 2024.
 */
export function calculateAnnualPPh21(
    annualTaxableIncome: number,
    ptkp: number = PTKP_TK0
): number {
    const taxable = Math.max(0, annualTaxableIncome - ptkp)
    if (taxable <= 0) return 0

    let tax = 0
    let remaining = taxable

    let previousLimit = 0
    for (const bracket of PPH21_BRACKETS) {
        const bracketAmount = bracket.limit - previousLimit
        const taxableInBracket = Math.min(remaining, bracketAmount)
        tax += taxableInBracket * bracket.rate
        remaining -= taxableInBracket
        previousLimit = bracket.limit
        if (remaining <= 0) break
    }

    return Math.round(tax)
}

/**
 * Calculate monthly PPh 21 (1/12 of annual tax).
 */
export function calculateMonthlyPPh21(
    monthlyGrossIncome: number,
    bpjsEmployeeDeduction: number,
    ptkp: number = PTKP_TK0
): number {
    const monthlyTaxable = monthlyGrossIncome - bpjsEmployeeDeduction
    const annualTaxable = monthlyTaxable * 12
    const annualTax = calculateAnnualPPh21(annualTaxable, ptkp)
    return Math.round(annualTax / 12)
}

// ==============================================================================
// Piece-Rate Payroll
// ==============================================================================

export interface PieceRatePayroll {
    totalPieces: number
    pieceRate: number
    pieceEarnings: number
    baseSalary: number
    totalGross: number
}

/**
 * Calculate piece-rate earnings for an employee.
 * If employee has both base salary and piece rate, piece earnings are additive.
 */
export function calculatePieceRatePayroll(
    totalPieces: number,
    pieceRate: number,
    baseSalary: number = 0
): PieceRatePayroll {
    const pieceEarnings = Math.round(totalPieces * pieceRate)
    return {
        totalPieces,
        pieceRate,
        pieceEarnings,
        baseSalary,
        totalGross: baseSalary + pieceEarnings,
    }
}

// ==============================================================================
// Complete Payslip Calculation
// ==============================================================================

export interface PayslipCalculation {
    // Income
    baseSalary: number
    overtimePay: number
    pieceEarnings: number
    allowances: number
    grossIncome: number

    // Deductions
    bpjs: BPJSBreakdown
    pph21: number
    totalDeductions: number

    // Net
    netIncome: number
}

/**
 * Calculate a complete payslip with all Indonesian statutory requirements.
 */
export function calculatePayslip(params: {
    baseSalary: number
    overtimePay?: number
    pieceEarnings?: number
    allowances?: number
    ptkp?: number
}): PayslipCalculation {
    const baseSalary = params.baseSalary
    const overtimePay = params.overtimePay ?? 0
    const pieceEarnings = params.pieceEarnings ?? 0
    const allowances = params.allowances ?? 0

    const grossIncome = baseSalary + overtimePay + pieceEarnings + allowances

    // BPJS calculated on base salary (not on overtime/allowances)
    const bpjs = calculateBPJS(baseSalary)

    // PPh 21 on gross income minus employee BPJS deductions
    const pph21 = calculateMonthlyPPh21(grossIncome, bpjs.totalEmployee, params.ptkp)

    const totalDeductions = bpjs.totalEmployee + pph21

    return {
        baseSalary,
        overtimePay,
        pieceEarnings,
        allowances,
        grossIncome,
        bpjs,
        pph21,
        totalDeductions,
        netIncome: grossIncome - totalDeductions,
    }
}
