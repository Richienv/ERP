'use server'

import { prisma, withPrismaAuth } from "@/lib/db"
import { PrismaClient, ShiftType } from "@prisma/client"
import { createClient } from "@/lib/supabase/server"
async function requireAuth() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new Error("Unauthorized")
    return user
}

// ==============================================================================
// Types
// ==============================================================================

export interface ShiftAssignment {
    employeeId: string
    employeeName: string
    employeeCode: string
    department: string
    date: string
    shiftType: ShiftType
}

export interface ShiftScheduleDay {
    date: string
    dayOfWeek: number
    shifts: {
        MORNING: string[]   // employee names
        AFTERNOON: string[]
        NIGHT: string[]
    }
    totalWorkers: number
}

export interface EmployeeShiftSummary {
    employeeId: string
    employeeName: string
    employeeCode: string
    department: string
    defaultShift: ShiftType | null
    currentWeekShifts: { date: string; shiftType: ShiftType }[]
}

// ==============================================================================
// Read Actions (use singleton prisma to avoid connection pool exhaustion)
// ==============================================================================

/**
 * Get weekly shift schedule for all employees.
 */
export async function getWeeklyShiftSchedule(
    weekStartDate: string
): Promise<ShiftScheduleDay[]> {
    try {
        await requireAuth()

        const weekStart = new Date(weekStartDate)
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekEnd.getDate() + 7)

        // Get all active employees with their default shifts
        const employees = await prisma.employee.findMany({
            where: { status: 'ACTIVE' },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeId: true,
                department: true,
                shiftType: true,
            },
        })

        // Get attendance records for the week (as proxy for shift assignments)
        const attendance = await prisma.attendance.findMany({
            where: {
                date: { gte: weekStart, lt: weekEnd },
            },
            select: {
                employeeId: true,
                date: true,
                status: true,
            },
        })

        // Build employee name map
        const empMap = new Map(
            employees.map((e) => [
                e.id,
                {
                    name: [e.firstName, e.lastName].filter(Boolean).join(' '),
                    shift: e.shiftType || 'MORNING' as ShiftType,
                },
            ])
        )

        // Build attendance map by date
        const attendByDate = new Map<string, Set<string>>()
        for (const a of attendance) {
            const dateKey = a.date.toISOString().split('T')[0]
            if (!attendByDate.has(dateKey)) attendByDate.set(dateKey, new Set())
            attendByDate.get(dateKey)!.add(a.employeeId)
        }

        // Generate 7 days
        const days: ShiftScheduleDay[] = []
        for (let i = 0; i < 7; i++) {
            const d = new Date(weekStart)
            d.setDate(d.getDate() + i)
            const dateStr = d.toISOString().split('T')[0]

            const shifts: ShiftScheduleDay['shifts'] = {
                MORNING: [],
                AFTERNOON: [],
                NIGHT: [],
            }

            // Assign employees to their default shifts
            for (const emp of employees) {
                const empInfo = empMap.get(emp.id)!
                const shift = emp.shiftType || 'MORNING'
                shifts[shift as keyof typeof shifts].push(empInfo.name)
            }

            days.push({
                date: dateStr,
                dayOfWeek: d.getDay(),
                shifts,
                totalWorkers: employees.length,
            })
        }

        return days
    } catch (error) {
        console.error("[getWeeklyShiftSchedule] Error:", error)
        return []
    }
}

/**
 * Get employee shift summaries for assignment management.
 */
export async function getEmployeeShifts(): Promise<EmployeeShiftSummary[]> {
    try {
        await requireAuth()

        const employees = await prisma.employee.findMany({
            where: { status: 'ACTIVE' },
            select: {
                id: true,
                employeeId: true,
                firstName: true,
                lastName: true,
                department: true,
                shiftType: true,
            },
            orderBy: [{ department: 'asc' }, { firstName: 'asc' }],
        })

        return employees.map((e) => ({
            employeeId: e.id,
            employeeName: [e.firstName, e.lastName].filter(Boolean).join(' '),
            employeeCode: e.employeeId,
            department: e.department,
            defaultShift: e.shiftType,
            currentWeekShifts: [],
        }))
    } catch (error) {
        console.error("[getEmployeeShifts] Error:", error)
        return []
    }
}

// ==============================================================================
// Write Actions (keep withPrismaAuth for transactional safety)
// ==============================================================================

/**
 * Assign default shift to an employee.
 */
export async function assignEmployeeShift(
    employeeId: string,
    shiftType: ShiftType
): Promise<{ success: boolean; error?: string }> {
    try {
        await withPrismaAuth(async (prisma: PrismaClient) => {
            await prisma.employee.update({
                where: { id: employeeId },
                data: { shiftType },
            })
        })

        return { success: true }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal mengubah shift'
        console.error("[assignEmployeeShift] Error:", error)
        return { success: false, error: msg }
    }
}

/**
 * Batch assign shifts to multiple employees.
 */
export async function batchAssignShifts(
    assignments: { employeeId: string; shiftType: ShiftType }[]
): Promise<{ success: boolean; count?: number; error?: string }> {
    if (assignments.length === 0) {
        return { success: false, error: 'Tidak ada assignment' }
    }

    try {
        const count = await withPrismaAuth(async (prisma: PrismaClient) => {
            let updated = 0
            for (const a of assignments) {
                await prisma.employee.update({
                    where: { id: a.employeeId },
                    data: { shiftType: a.shiftType },
                })
                updated++
            }
            return updated
        })

        return { success: true, count }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal batch assign shift'
        console.error("[batchAssignShifts] Error:", error)
        return { success: false, error: msg }
    }
}
