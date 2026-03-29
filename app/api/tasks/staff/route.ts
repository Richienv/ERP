import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getAuthzUser } from "@/lib/authz"
import { resolveEmployeeContext } from "@/lib/employee-context"

export const dynamic = "force-dynamic"

const PRIORITY_MAP: Record<string, string> = {
    LOW: "low", MEDIUM: "medium", HIGH: "high", URGENT: "urgent",
}

const STATUS_MAP: Record<string, string> = {
    PENDING: "pending", IN_PROGRESS: "running", COMPLETED: "completed",
    BLOCKED: "issue", REJECTED: "issue",
}

const TYPE_MAP: Record<string, string> = {
    PRODUCTION: "production",
    QUALITY_CHECK: "quality",
    LOGISTICS: "warehouse",
    SALES: "warehouse",
    PO_REVIEW: "warehouse",
    PURCHASE_REQUEST: "warehouse",
    OTHER: "maintenance",
    ADMIN: "maintenance",
}

function formatRelativeTime(date: Date): string {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    if (hours < 1) return "Baru saja"
    if (hours < 24) return `${hours} jam lalu`
    const days = Math.floor(hours / 24)
    return `${days} hari lalu`
}

function formatDeadline(date: Date | null): string {
    if (!date) return ""
    const now = new Date()
    const diff = date.getTime() - now.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    if (hours < 0) return "Terlambat"
    if (hours < 24) return `Due: ${date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`
    return date.toLocaleDateString("id-ID", { day: "numeric", month: "short" })
}

export async function GET() {
    try {
        const authUser = await getAuthzUser()
        const ctx = await resolveEmployeeContext(prisma as any, authUser)
        if (!ctx) return NextResponse.json(null)

        const employee = await prisma.employee.findUnique({
            where: { id: ctx.id },
            select: {
                id: true, firstName: true, lastName: true,
                department: true, position: true, shiftType: true,
            },
        })
        if (!employee) return NextResponse.json(null)

        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

        const tasks = await prisma.employeeTask.findMany({
            where: {
                employeeId: ctx.id,
                OR: [
                    { status: { in: ["PENDING", "IN_PROGRESS", "BLOCKED"] } },
                    {
                        status: { in: ["COMPLETED", "REJECTED"] },
                        completedAt: { gte: twentyFourHoursAgo },
                    },
                ],
                NOT: {
                    AND: [
                        { type: "ADMIN" },
                        { notes: { startsWith: "LEAVE_APPROVAL::" } },
                    ],
                },
            },
            include: {
                workOrder: { select: { id: true, number: true } },
                purchaseOrder: { select: { id: true, number: true } },
                salesOrder: { select: { id: true, number: true } },
            },
            orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
        })

        const data = {
            employee: {
                id: employee.id,
                name: `${employee.firstName} ${employee.lastName || ""}`.trim(),
                department: employee.department,
                position: employee.position,
                shiftType: employee.shiftType,
            },
            tasks: tasks.map((t: any) => ({
                id: t.id,
                title: t.title,
                description: t.notes || "",
                priority: PRIORITY_MAP[t.priority] || "medium",
                status: STATUS_MAP[t.status] || "pending",
                type: TYPE_MAP[t.type] || "maintenance",
                time: t.deadline ? formatDeadline(t.deadline) : formatRelativeTime(t.createdAt),
                createdAt: t.createdAt.toISOString(),
                workOrderId: t.workOrder?.id,
                workOrderNumber: t.workOrder?.number,
                purchaseOrderId: t.purchaseOrder?.id,
                purchaseOrderNumber: t.purchaseOrder?.number,
                salesOrderId: t.salesOrder?.id,
                salesOrderNumber: t.salesOrder?.number,
            })),
        }

        return NextResponse.json(data)
    } catch (e) {
        console.error("[API] tasks/staff:", e)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
