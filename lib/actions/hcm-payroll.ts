'use server'

import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"
import { calculatePieceRatePayroll, calculatePayslip } from "@/lib/hcm-calculations"

async function requireAuth() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new Error("Unauthorized")
    return user
}

// ==============================================================================
// Types
// ==============================================================================

export interface PieceRateEmployee {
    employeeId: string
    employeeName: string
    employeeCode: string
    department: string
    pieceRate: number
    totalPieces: number
    pieceEarnings: number
    baseSalary: number
    totalGross: number
}

export interface PieceRatePayrollSummary {
    period: string
    employees: PieceRateEmployee[]
    totalPieces: number
    totalEarnings: number
    totalGross: number
}

// ==============================================================================
// Server Actions (read-only — use singleton prisma)
// ==============================================================================

/**
 * Calculate piece-rate payroll for a given period.
 * Uses WorkOrder completions to count pieces per employee.
 */
export async function getPieceRatePayroll(
    period: string
): Promise<PieceRatePayrollSummary> {
    try {
        await requireAuth()

        // Parse period (YYYY-MM)
        const [year, month] = period.split('-').map(Number)
        const periodStart = new Date(year, month - 1, 1)
        const periodEnd = new Date(year, month, 1)

        // Get employees with piece rates
        const employees = await prisma.employee.findMany({
            where: {
                status: 'ACTIVE',
                pieceRate: { not: null, gt: 0 },
            },
            select: {
                id: true,
                employeeId: true,
                firstName: true,
                lastName: true,
                department: true,
                baseSalary: true,
                pieceRate: true,
            },
        })

        // For each employee, count completed work order outputs
        const results: PieceRateEmployee[] = []

        for (const emp of employees) {
            const pieceRate = Number(emp.pieceRate) || 0
            const baseSalary = Number(emp.baseSalary) || 0

            // Count completed inspections as proxy for pieces produced
            const completedCount = await prisma.qualityInspection.count({
                where: {
                    inspectorId: emp.id,
                    createdAt: { gte: periodStart, lt: periodEnd },
                },
            })

            const totalPieces = completedCount
            const calc = calculatePieceRatePayroll(totalPieces, pieceRate, baseSalary)

            results.push({
                employeeId: emp.id,
                employeeName: [emp.firstName, emp.lastName].filter(Boolean).join(' '),
                employeeCode: emp.employeeId,
                department: emp.department,
                pieceRate,
                totalPieces: calc.totalPieces,
                pieceEarnings: calc.pieceEarnings,
                baseSalary,
                totalGross: calc.totalGross,
            })
        }

        return {
            period,
            employees: results,
            totalPieces: results.reduce((s, r) => s + r.totalPieces, 0),
            totalEarnings: results.reduce((s, r) => s + r.pieceEarnings, 0),
            totalGross: results.reduce((s, r) => s + r.totalGross, 0),
        }
    } catch (error) {
        console.error("[getPieceRatePayroll] Error:", error)
        return { period, employees: [], totalPieces: 0, totalEarnings: 0, totalGross: 0 }
    }
}

/**
 * Calculate full payslip with Indonesian statutory deductions.
 */
export async function getEmployeePayslip(
    employeeId: string,
    period: string
): Promise<{
    employee: { name: string; code: string; department: string } | null
    payslip: ReturnType<typeof calculatePayslip> | null
}> {
    try {
        await requireAuth()

        const employee = await prisma.employee.findUnique({
            where: { id: employeeId },
            select: {
                firstName: true,
                lastName: true,
                employeeId: true,
                department: true,
                baseSalary: true,
                pieceRate: true,
            },
        })

        if (!employee) return { employee: null, payslip: null }

        const baseSalary = Number(employee.baseSalary) || 0
        const payslip = calculatePayslip({
            baseSalary,
            overtimePay: 0, // Would be calculated from attendance
            pieceEarnings: 0, // Would be from piece rate records
            allowances: Math.round(baseSalary * 0.20), // 20% allowances
        })

        return {
            employee: {
                name: [employee.firstName, employee.lastName].filter(Boolean).join(' '),
                code: employee.employeeId,
                department: employee.department,
            },
            payslip,
        }
    } catch (error) {
        console.error("[getEmployeePayslip] Error:", error)
        return { employee: null, payslip: null }
    }
}
