import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"
import type { ShiftType } from "@prisma/client"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        // Calculate current week Monday
        const now = new Date()
        const dayOfWeek = now.getDay()
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
        const weekStart = new Date(now)
        weekStart.setDate(weekStart.getDate() + mondayOffset)
        weekStart.setHours(0, 0, 0, 0)
        const currentWeekStart = weekStart.toISOString().split("T")[0]

        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekEnd.getDate() + 7)

        // Run queries in parallel
        const [activeEmployees, attendance] = await Promise.all([
            prisma.employee.findMany({
                where: { status: "ACTIVE" },
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    employeeId: true,
                    department: true,
                    shiftType: true,
                },
                orderBy: [{ department: "asc" }, { firstName: "asc" }],
            }),
            prisma.attendance.findMany({
                where: { date: { gte: weekStart, lt: weekEnd } },
                select: { employeeId: true, date: true, status: true },
            }),
        ])

        // Build schedule (7 days)
        const empMap = new Map(
            activeEmployees.map((e) => [
                e.id,
                {
                    name: [e.firstName, e.lastName].filter(Boolean).join(" "),
                    shift: (e.shiftType || "MORNING") as ShiftType,
                },
            ])
        )

        const schedule = []
        for (let i = 0; i < 7; i++) {
            const d = new Date(weekStart)
            d.setDate(d.getDate() + i)
            const dateStr = d.toISOString().split("T")[0]

            const shifts: Record<string, string[]> = { MORNING: [], AFTERNOON: [], NIGHT: [] }
            for (const emp of activeEmployees) {
                const empInfo = empMap.get(emp.id)!
                const shift = emp.shiftType || "MORNING"
                shifts[shift as string]?.push(empInfo.name)
            }

            schedule.push({
                date: dateStr,
                dayOfWeek: d.getDay(),
                shifts,
                totalWorkers: activeEmployees.length,
            })
        }

        // Build employee shift summaries
        const employees = activeEmployees.map((e) => ({
            employeeId: e.id,
            employeeName: [e.firstName, e.lastName].filter(Boolean).join(" "),
            employeeCode: e.employeeId,
            department: e.department,
            defaultShift: e.shiftType,
            currentWeekShifts: [],
        }))

        return NextResponse.json({ schedule, employees, currentWeekStart })
    } catch (e) {
        console.error("[API] shifts-data:", e)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
