import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const now = new Date()
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
        const periodLabel = now.toLocaleDateString("id-ID", { month: "long", year: "numeric" })

        const [activeCount, totalCount, todayAttendance, pendingLeaveCount, leaveRequests, payrollAgg] = await Promise.all([
            prisma.employee.count({ where: { status: "ACTIVE" } }),
            prisma.employee.count(),
            prisma.attendance.findMany({
                where: { date: { gte: start, lt: end } },
                include: { employee: { select: { firstName: true, lastName: true, department: true } } },
            }),
            prisma.leaveRequest.count({ where: { status: "PENDING" } }),
            prisma.leaveRequest.findMany({
                where: { status: "PENDING" },
                include: { employee: { select: { firstName: true, lastName: true, department: true } } },
                orderBy: { createdAt: "desc" },
                take: 5,
            }),
            prisma.employee.aggregate({ _sum: { baseSalary: true }, where: { status: "ACTIVE" } }),
        ])

        const present = todayAttendance.filter(a => a.status === "PRESENT" || a.status === "REMOTE").length
        const late = todayAttendance.filter(a => a.isLate).length
        const onLeave = todayAttendance.filter(a => a.status === "LEAVE").length
        const absent = Math.max(activeCount - present - onLeave, 0)
        const gross = Number(payrollAgg._sum.baseSalary || 0)

        return NextResponse.json({
            attendance: {
                present,
                total: activeCount,
                late,
                onLeave,
                absent,
                attendanceRate: activeCount > 0 ? Math.round(((present + onLeave) / activeCount) * 100) : 0,
                timestamp: new Date().toISOString(),
            },
            payroll: {
                gross,
                deductions: 0,
                net: gross,
                status: pendingLeaveCount > 0 ? "REVIEW" : "READY",
                period: periodLabel,
            },
            leaves: {
                pendingCount: pendingLeaveCount,
                requests: leaveRequests.map(r => ({
                    id: r.id,
                    employeeName: `${r.employee.firstName} ${r.employee.lastName || ""}`.trim(),
                    department: r.employee.department,
                    type: r.type,
                    startDate: r.startDate.toISOString(),
                    endDate: r.endDate.toISOString(),
                    days: Math.max(1, Math.ceil((r.endDate.getTime() - r.startDate.getTime()) / 86400000) + 1),
                })),
            },
            headcount: {
                active: activeCount,
                total: totalCount,
            },
        })
    } catch (error) {
        console.error("[API] hcm/dashboard-data error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
