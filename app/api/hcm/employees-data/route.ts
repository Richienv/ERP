import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const { searchParams } = new URL(request.url)
        const includeInactive = searchParams.get("includeInactive") === "true"

        const employees = await prisma.employee.findMany({
            where: includeInactive ? undefined : { status: { in: ["ACTIVE", "ON_LEAVE"] } },
            orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
            include: {
                _count: {
                    select: {
                        attendance: true,
                        leaveRequests: true,
                        tasks: true,
                    },
                },
            },
        })

        const data = employees.map((employee) => ({
            id: employee.id,
            employeeCode: employee.employeeId,
            name: `${employee.firstName} ${employee.lastName || ""}`.trim(),
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

        return NextResponse.json(data)
    } catch (e) {
        console.error("[API] employees-data:", e)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
