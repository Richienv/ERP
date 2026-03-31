import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"
import { AttendanceStatus, EmployeeStatus } from "@prisma/client"

export const dynamic = "force-dynamic"

function toDayWindow(raw?: string | Date) {
    const base = raw ? new Date(raw) : new Date()
    const start = new Date(base)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(end.getDate() + 1)
    return { start, end }
}

function formatTime(value?: Date | null) {
    if (!value) return "-"
    return new Date(value).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
}

function calculateWorkingHours(checkIn?: Date | null, checkOut?: Date | null) {
    if (!checkIn || !checkOut) return 0
    const diffMs = new Date(checkOut).getTime() - new Date(checkIn).getTime()
    if (diffMs <= 0) return 0
    const rawHours = diffMs / (1000 * 60 * 60)
    const standardBreak = rawHours >= 6 ? 1 : 0
    return Math.max(0, Number((rawHours - standardBreak).toFixed(2)))
}

function calculateOvertimeHours(workingHours: number) {
    return Number(Math.max(0, workingHours - 8).toFixed(2))
}

function toEmployeeName(firstName: string, lastName?: string | null) {
    return `${firstName} ${lastName || ""}`.trim()
}

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const { start, end } = toDayWindow()

        // Run all 3 queries in parallel
        const [employees, attendanceRows, leaveRequests, allEmployees] = await Promise.all([
            // Attendance snapshot employees
            prisma.employee.findMany({
                where: { status: { in: ["ACTIVE", "ON_LEAVE"] as EmployeeStatus[] } },
                orderBy: [{ department: "asc" }, { firstName: "asc" }],
                select: {
                    id: true,
                    employeeId: true,
                    firstName: true,
                    lastName: true,
                    department: true,
                    position: true,
                },
            }),
            prisma.attendance.findMany({
                where: { date: { gte: start, lt: end } },
                include: {
                    employee: {
                        select: {
                            id: true,
                            employeeId: true,
                            firstName: true,
                            lastName: true,
                            department: true,
                            position: true,
                        },
                    },
                },
            }),
            // Leave requests
            prisma.leaveRequest.findMany({
                include: {
                    employee: {
                        select: {
                            id: true,
                            employeeId: true,
                            firstName: true,
                            lastName: true,
                            department: true,
                            position: true,
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
                take: 20,
            }),
            // Employees for employee list
            prisma.employee.findMany({
                where: { status: { in: ["ACTIVE", "ON_LEAVE"] as EmployeeStatus[] } },
                orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
                include: {
                    _count: {
                        select: { attendance: true, leaveRequests: true, tasks: true },
                    },
                },
            }),
        ])

        // Build attendance snapshot
        const attendanceMap = new Map(attendanceRows.map((row) => [row.employeeId, row]))
        const rows = employees.map((employee) => {
            const attendance = attendanceMap.get(employee.id)
            const status = attendance?.status || AttendanceStatus.ABSENT
            const workingHours = calculateWorkingHours(attendance?.checkIn, attendance?.checkOut)
            const overtimeHours = calculateOvertimeHours(workingHours)

            return {
                id: employee.id,
                employeeCode: employee.employeeId,
                name: toEmployeeName(employee.firstName, employee.lastName),
                department: employee.department,
                position: employee.position,
                clockIn: formatTime(attendance?.checkIn),
                clockOut: formatTime(attendance?.checkOut),
                workingHours,
                overtimeHours,
                status,
                isLate: Boolean(attendance?.isLate),
            }
        })

        const presentCount = rows.filter((r) => r.status === "PRESENT" || r.status === "REMOTE").length
        const leaveCount = rows.filter((r) => r.status === "LEAVE").length
        const lateCount = rows.filter((r) => r.isLate).length
        const absentCount = Math.max(rows.length - presentCount - leaveCount, 0)
        const departments = [...new Set(rows.map((r) => r.department))].sort((a, b) => a.localeCompare(b))

        const initialSnapshot = {
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
        }

        const initialEmployees = allEmployees.map((employee) => ({
            id: employee.id,
            employeeCode: employee.employeeId,
            name: toEmployeeName(employee.firstName, employee.lastName),
            firstName: employee.firstName,
            lastName: employee.lastName,
            email: employee.email,
            phone: employee.phone,
            department: employee.department,
            position: employee.position,
            status: employee.status,
            joinDate: employee.joinDate.toISOString().slice(0, 10),
            baseSalary: Number(employee.baseSalary || 0),
            metrics: {
                attendanceEntries: employee._count.attendance,
                leaveRequests: employee._count.leaveRequests,
                openTasks: employee._count.tasks,
            },
        }))

        // Build leave requests with approval task info
        const leaveIds = leaveRequests.map((r) => r.id)
        const approvalTasks = leaveIds.length
            ? await prisma.employeeTask.findMany({
                where: {
                    relatedId: { in: leaveIds },
                    notes: { startsWith: "LEAVE_APPROVAL::" },
                },
                include: { employee: { select: { firstName: true, lastName: true } } },
                orderBy: { createdAt: "desc" },
            })
            : []

        const taskMap = new Map<string, { approverName: string; taskStatus: string }>()
        for (const task of approvalTasks) {
            if (!task.relatedId || taskMap.has(task.relatedId)) continue
            taskMap.set(task.relatedId, {
                approverName: toEmployeeName(task.employee.firstName, task.employee.lastName),
                taskStatus: task.status,
            })
        }

        const initialLeaveRequests = leaveRequests.map((request) => {
            const meta = taskMap.get(request.id)
            return {
                id: request.id,
                employeeId: request.employee.id,
                employeeCode: request.employee.employeeId,
                employeeName: toEmployeeName(request.employee.firstName, request.employee.lastName),
                department: request.employee.department,
                position: request.employee.position,
                startDate: request.startDate.toISOString(),
                endDate: request.endDate.toISOString(),
                type: request.type,
                reason: request.reason,
                status: request.status,
                approverName: meta?.approverName || "-",
                approvalTaskStatus: meta?.taskStatus || null,
                createdAt: request.createdAt.toISOString(),
            }
        })

        return NextResponse.json({ initialSnapshot, initialEmployees, initialLeaveRequests })
    } catch (e) {
        console.error("[API] attendance-full:", e)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
