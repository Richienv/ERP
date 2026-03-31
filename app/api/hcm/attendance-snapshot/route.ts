import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const url = new URL(request.url)
        const dateParam = url.searchParams.get("date")
        const now = dateParam ? new Date(dateParam) : new Date()
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)

        const [employees, attendanceRows] = await Promise.all([
            prisma.employee.findMany({
                where: { status: { in: ["ACTIVE", "ON_LEAVE"] } },
                orderBy: [{ department: "asc" }, { firstName: "asc" }],
                select: { id: true, employeeId: true, firstName: true, lastName: true, department: true, position: true },
            }),
            prisma.attendance.findMany({
                where: { date: { gte: start, lt: end } },
                include: { employee: { select: { id: true, employeeId: true, firstName: true, lastName: true, department: true, position: true } } },
            }),
        ])

        const attendanceMap = new Map(attendanceRows.map(row => [row.employeeId, row]))

        const rows = employees.map(emp => {
            const att = attendanceMap.get(emp.id)
            const status = att?.status || "ABSENT"
            return {
                id: emp.id,
                employeeCode: emp.employeeId,
                name: `${emp.firstName} ${emp.lastName || ""}`.trim(),
                department: emp.department,
                position: emp.position,
                clockIn: att?.checkIn?.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) || null,
                clockOut: att?.checkOut?.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) || null,
                workingHours: att?.checkIn && att?.checkOut
                    ? Number(((att.checkOut.getTime() - att.checkIn.getTime()) / 3600000).toFixed(1))
                    : 0,
                overtimeHours: 0,
                status,
                isLate: Boolean(att?.isLate),
            }
        })

        const presentCount = rows.filter(r => r.status === "PRESENT" || r.status === "REMOTE").length
        const leaveCount = rows.filter(r => r.status === "LEAVE").length
        const lateCount = rows.filter(r => r.isLate).length
        const absentCount = Math.max(rows.length - presentCount - leaveCount, 0)
        const departments = [...new Set(rows.map(r => r.department))].sort()

        return NextResponse.json({
            date: start.toISOString(),
            rows,
            departments,
            stats: {
                totalEmployees: rows.length,
                presentCount,
                leaveCount,
                lateCount,
                absentCount,
                attendanceRate: rows.length > 0 ? Math.round(((presentCount + leaveCount) / rows.length) * 100) : 0,
            },
        })
    } catch (error) {
        console.error("[API] hcm/attendance-snapshot error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
