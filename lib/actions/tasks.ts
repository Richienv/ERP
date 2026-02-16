'use server'

import { prisma, withPrismaAuth } from "@/lib/db"
import { TaskType, TaskStatus, Priority } from "@prisma/client"
import { createClient } from "@/lib/supabase/server"
import { getAuthzUser } from "@/lib/authz"
import {
    resolveEmployeeContext,
    isManagerPosition,
    isSuperRole,
} from "@/lib/employee-context"
import { revalidatePath } from "next/cache"

async function requireAuth() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new Error("Unauthorized")
    return user
}

// ==============================================================================
// Types
// ==============================================================================

export interface StaffTaskDTO {
    id: string
    title: string
    description: string
    priority: "low" | "medium" | "high" | "urgent"
    status: "pending" | "running" | "completed" | "issue"
    type: "production" | "quality" | "warehouse" | "maintenance"
    time: string
    location?: string
    createdAt: string
    workOrderId?: string
    workOrderNumber?: string
    purchaseOrderId?: string
    purchaseOrderNumber?: string
    salesOrderId?: string
    salesOrderNumber?: string
}

export interface StaffPageData {
    employee: {
        id: string
        name: string
        department: string
        position: string
        shiftType: string | null
    }
    tasks: StaffTaskDTO[]
}

export interface ManagerTaskDTO {
    id: string
    title: string
    notes: string | null
    type: string
    status: string
    priority: string
    employeeId: string
    employeeName: string
    employeeDepartment: string
    deadline: string | null
    createdAt: string
    completedAt: string | null
    workOrderId: string | null
    workOrderNumber: string | null
    purchaseOrderId: string | null
    purchaseOrderNumber: string | null
    salesOrderId: string | null
    salesOrderNumber: string | null
}

export interface ManagerTasksData {
    pending: ManagerTaskDTO[]
    inProgress: ManagerTaskDTO[]
    blocked: ManagerTaskDTO[]
    completed: ManagerTaskDTO[]
}

export interface AssignableEmployee {
    id: string
    name: string
    position: string
    department: string
}

export interface AssignableOrder {
    type: "WO" | "PO" | "SO"
    id: string
    number: string
    label: string
}

export interface ManagerDashboardStats {
    productionLines: {
        id: string
        number: string
        product: string
        status: string
        progress: number
        dueDate: string | null
        machineName: string | null
    }[]
    staffSummary: {
        id: string
        name: string
        position: string
        department: string
        activeTaskCount: number
        status: string
    }[]
    materials: {
        id: string
        name: string
        code: string
        currentStock: number
        minStock: number
        unit: string
    }[]
    quality: {
        passRate: number
        totalInspections: number
        recentInspections: {
            id: string
            batchNumber: string
            status: string
            score: number
            date: string
            inspectorName: string
        }[]
    }
}

// ==============================================================================
// Helpers
// ==============================================================================

const PRIORITY_MAP: Record<string, StaffTaskDTO["priority"]> = {
    LOW: "low", MEDIUM: "medium", HIGH: "high", URGENT: "urgent",
}

const STATUS_MAP: Record<string, StaffTaskDTO["status"]> = {
    PENDING: "pending", IN_PROGRESS: "running", COMPLETED: "completed",
    BLOCKED: "issue", REJECTED: "issue",
}

const TYPE_MAP: Record<string, StaffTaskDTO["type"]> = {
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

// ==============================================================================
// Staff — Read
// ==============================================================================

export async function getStaffTasks(): Promise<StaffPageData | null> {
    try {
        const authUser = await getAuthzUser()
        const ctx = await resolveEmployeeContext(prisma as any, authUser)
        if (!ctx) return null

        const employee = await prisma.employee.findUnique({
            where: { id: ctx.id },
            select: {
                id: true, firstName: true, lastName: true,
                department: true, position: true, shiftType: true,
            },
        })
        if (!employee) return null

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
                // Hide internal admin tasks (leave/payroll approvals)
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
            orderBy: [
                { priority: "desc" },
                { createdAt: "desc" },
            ],
        })

        return {
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
    } catch (error) {
        console.error("[getStaffTasks] Error:", error)
        return null
    }
}

// ==============================================================================
// Staff — Write
// ==============================================================================

export async function startTask(taskId: string): Promise<{ success: boolean; error?: string }> {
    return withPrismaAuth(async (tx) => {
        const authUser = await getAuthzUser()
        const ctx = await resolveEmployeeContext(tx as any, authUser)
        if (!ctx) return { success: false, error: "Profil karyawan tidak ditemukan" }

        const task = await (tx as any).employeeTask.findUnique({ where: { id: taskId } })
        if (!task) return { success: false, error: "Tugas tidak ditemukan" }
        if (task.employeeId !== ctx.id) return { success: false, error: "Bukan tugas Anda" }
        if (task.status !== "PENDING") return { success: false, error: "Tugas tidak dalam status menunggu" }

        await (tx as any).employeeTask.update({
            where: { id: taskId },
            data: { status: "IN_PROGRESS" },
        })

        revalidatePath("/staff")
        revalidatePath("/manager")
        return { success: true }
    })
}

export async function completeTask(taskId: string): Promise<{ success: boolean; error?: string }> {
    return withPrismaAuth(async (tx) => {
        const authUser = await getAuthzUser()
        const ctx = await resolveEmployeeContext(tx as any, authUser)
        if (!ctx) return { success: false, error: "Profil karyawan tidak ditemukan" }

        const task = await (tx as any).employeeTask.findUnique({ where: { id: taskId } })
        if (!task) return { success: false, error: "Tugas tidak ditemukan" }
        if (task.employeeId !== ctx.id) return { success: false, error: "Bukan tugas Anda" }
        if (task.status !== "IN_PROGRESS") return { success: false, error: "Tugas belum dimulai" }

        await (tx as any).employeeTask.update({
            where: { id: taskId },
            data: { status: "COMPLETED", completedAt: new Date() },
        })

        revalidatePath("/staff")
        revalidatePath("/manager")
        return { success: true }
    })
}

export async function reportTaskIssue(
    taskId: string,
    data: { category: string; location: string; description: string }
): Promise<{ success: boolean; error?: string }> {
    return withPrismaAuth(async (tx) => {
        const authUser = await getAuthzUser()
        const ctx = await resolveEmployeeContext(tx as any, authUser)
        if (!ctx) return { success: false, error: "Profil karyawan tidak ditemukan" }

        const task = await (tx as any).employeeTask.findUnique({ where: { id: taskId } })
        if (!task) return { success: false, error: "Tugas tidak ditemukan" }
        if (task.employeeId !== ctx.id) return { success: false, error: "Bukan tugas Anda" }

        const issuePayload = JSON.stringify({
            category: data.category,
            location: data.location,
            description: data.description,
            reportedAt: new Date().toISOString(),
            reportedBy: ctx.fullName,
        })

        const existingNotes = task.notes || ""
        const newNotes = existingNotes
            ? `${existingNotes}\nISSUE::${issuePayload}`
            : `ISSUE::${issuePayload}`

        await (tx as any).employeeTask.update({
            where: { id: taskId },
            data: { status: "BLOCKED", notes: newNotes },
        })

        revalidatePath("/staff")
        revalidatePath("/manager")
        return { success: true }
    })
}

// ==============================================================================
// Manager — Read
// ==============================================================================

export async function getManagerTasks(): Promise<ManagerTasksData> {
    try {
        const authUser = await getAuthzUser()
        const ctx = await resolveEmployeeContext(prisma as any, authUser)

        // Build where clause based on role
        let departmentFilter: any = {}
        if (ctx && !isSuperRole(authUser.role) && !isManagerPosition(ctx.position)) {
            // Regular employee — shouldn't see manager tasks, but return empty
            return { pending: [], inProgress: [], blocked: [], completed: [] }
        }
        if (ctx && !isSuperRole(authUser.role)) {
            // Manager — scope to their department
            departmentFilter = { employee: { department: ctx.department } }
        }
        // Super role — no filter, see all

        const tasks = await prisma.employeeTask.findMany({
            where: {
                ...departmentFilter,
                // Exclude internal admin tasks
                NOT: {
                    AND: [
                        { type: "ADMIN" },
                        { notes: { startsWith: "LEAVE_APPROVAL::" } },
                    ],
                },
            },
            include: {
                employee: { select: { firstName: true, lastName: true, department: true } },
                workOrder: { select: { id: true, number: true } },
                purchaseOrder: { select: { id: true, number: true } },
                salesOrder: { select: { id: true, number: true } },
            },
            orderBy: [
                { priority: "desc" },
                { createdAt: "desc" },
            ],
            take: 200,
        })

        const mapTask = (t: any): ManagerTaskDTO => ({
            id: t.id,
            title: t.title,
            notes: t.notes,
            type: t.type,
            status: t.status,
            priority: t.priority,
            employeeId: t.employeeId,
            employeeName: `${t.employee.firstName} ${t.employee.lastName || ""}`.trim(),
            employeeDepartment: t.employee.department,
            deadline: t.deadline?.toISOString() || null,
            createdAt: t.createdAt.toISOString(),
            completedAt: t.completedAt?.toISOString() || null,
            workOrderId: t.workOrder?.id || null,
            workOrderNumber: t.workOrder?.number || null,
            purchaseOrderId: t.purchaseOrder?.id || null,
            purchaseOrderNumber: t.purchaseOrder?.number || null,
            salesOrderId: t.salesOrder?.id || null,
            salesOrderNumber: t.salesOrder?.number || null,
        })

        return {
            pending: tasks.filter((t) => t.status === "PENDING").map(mapTask),
            inProgress: tasks.filter((t) => t.status === "IN_PROGRESS").map(mapTask),
            blocked: tasks.filter((t) => t.status === "BLOCKED" || t.status === "REJECTED").map(mapTask),
            completed: tasks.filter((t) => t.status === "COMPLETED").slice(0, 20).map(mapTask),
        }
    } catch (error) {
        console.error("[getManagerTasks] Error:", error)
        return { pending: [], inProgress: [], blocked: [], completed: [] }
    }
}

export async function getDepartmentEmployees(): Promise<AssignableEmployee[]> {
    try {
        const authUser = await getAuthzUser()
        const ctx = await resolveEmployeeContext(prisma as any, authUser)

        let whereClause: any = { status: "ACTIVE" }
        if (ctx && !isSuperRole(authUser.role)) {
            whereClause.department = ctx.department
        }

        const employees = await prisma.employee.findMany({
            where: whereClause,
            select: { id: true, firstName: true, lastName: true, position: true, department: true },
            orderBy: { firstName: "asc" },
        })

        return employees.map((e) => ({
            id: e.id,
            name: `${e.firstName} ${e.lastName || ""}`.trim(),
            position: e.position,
            department: e.department,
        }))
    } catch (error) {
        console.error("[getDepartmentEmployees] Error:", error)
        return []
    }
}

export async function getAssignableOrders(): Promise<AssignableOrder[]> {
    try {
        await requireAuth()

        const [workOrders, purchaseOrders, salesOrders] = await Promise.all([
            prisma.workOrder.findMany({
                where: { status: { in: ["PLANNED", "IN_PROGRESS"] } },
                select: { id: true, number: true, product: { select: { name: true } } },
                orderBy: { createdAt: "desc" },
                take: 50,
            }),
            prisma.purchaseOrder.findMany({
                where: { status: { in: ["APPROVED", "ORDERED", "VENDOR_CONFIRMED", "SHIPPED"] } },
                select: { id: true, number: true, supplier: { select: { name: true } } },
                orderBy: { createdAt: "desc" },
                take: 50,
            }),
            prisma.salesOrder.findMany({
                where: { status: { in: ["CONFIRMED", "IN_PROGRESS"] } },
                select: { id: true, number: true, customer: { select: { name: true } } },
                orderBy: { createdAt: "desc" },
                take: 50,
            }),
        ])

        const orders: AssignableOrder[] = [
            ...workOrders.map((wo) => ({
                type: "WO" as const,
                id: wo.id,
                number: wo.number,
                label: `[WO] ${wo.number} — ${wo.product.name}`,
            })),
            ...purchaseOrders.map((po: any) => ({
                type: "PO" as const,
                id: po.id,
                number: po.number,
                label: `[PO] ${po.number} — ${po.supplier.name}`,
            })),
            ...salesOrders.map((so: any) => ({
                type: "SO" as const,
                id: so.id,
                number: so.number,
                label: `[SO] ${so.number} — ${so.customer.name}`,
            })),
        ]

        return orders
    } catch (error) {
        console.error("[getAssignableOrders] Error:", error)
        return []
    }
}

// ==============================================================================
// Manager — Write
// ==============================================================================

export async function createTask(data: {
    title: string
    employeeId: string
    type: string
    priority: string
    notes?: string
    deadline?: string
    workOrderId?: string
    purchaseOrderId?: string
    salesOrderId?: string
}): Promise<{ success: boolean; error?: string }> {
    return withPrismaAuth(async (tx) => {
        const authUser = await getAuthzUser()
        const ctx = await resolveEmployeeContext(tx as any, authUser)
        if (!ctx) return { success: false, error: "Profil tidak ditemukan" }

        // Verify the manager has permission
        if (!isSuperRole(authUser.role) && !isManagerPosition(ctx.position)) {
            return { success: false, error: "Anda tidak memiliki izin membuat tugas" }
        }

        // Verify the target employee exists
        const targetEmployee = await (tx as any).employee.findUnique({
            where: { id: data.employeeId },
            select: { id: true, status: true },
        })
        if (!targetEmployee || targetEmployee.status !== "ACTIVE") {
            return { success: false, error: "Karyawan tidak ditemukan atau tidak aktif" }
        }

        const taskType = (data.type as TaskType) || "OTHER"
        const taskPriority = (data.priority as Priority) || "MEDIUM"

        const creatorNote = `Dibuat oleh: ${ctx.fullName}`
        const fullNotes = data.notes
            ? `${data.notes}\n---\n${creatorNote}`
            : creatorNote

        await (tx as any).employeeTask.create({
            data: {
                title: data.title,
                employeeId: data.employeeId,
                type: taskType,
                priority: taskPriority,
                status: "PENDING",
                notes: fullNotes,
                deadline: data.deadline ? new Date(data.deadline) : null,
                workOrderId: data.workOrderId || null,
                purchaseOrderId: data.purchaseOrderId || null,
                salesOrderId: data.salesOrderId || null,
            },
        })

        revalidatePath("/staff")
        revalidatePath("/manager")
        return { success: true }
    })
}

// ==============================================================================
// Manager Dashboard Stats
// ==============================================================================

export async function getManagerDashboardStats(): Promise<ManagerDashboardStats> {
    try {
        await requireAuth()

        // Sequential queries to avoid exhausting Supabase session-mode pool
        const workOrders = await prisma.workOrder.findMany({
            where: { status: { in: ["PLANNED", "IN_PROGRESS"] } },
            select: {
                id: true, number: true, status: true,
                plannedQty: true, actualQty: true, dueDate: true,
                product: { select: { name: true } },
                machine: { select: { name: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 20,
        })

        const lowStockProducts = await prisma.product.findMany({
            where: {
                stockLevels: { some: {} },
            },
            select: {
                id: true, name: true, code: true, unit: true,
                minStock: true,
                stockLevels: { select: { quantity: true } },
            },
            take: 20,
        })

        const inspections = await prisma.qualityInspection.findMany({
            select: {
                id: true, batchNumber: true, status: true,
                score: true, inspectionDate: true,
                inspector: { select: { firstName: true, lastName: true } },
            },
            orderBy: { inspectionDate: "desc" },
            take: 10,
        })

        const employees = await prisma.employee.findMany({
            where: { status: "ACTIVE" },
            select: {
                id: true, firstName: true, lastName: true,
                position: true, department: true,
                _count: {
                    select: {
                        tasks: { where: { status: { in: ["PENDING", "IN_PROGRESS"] } } },
                    },
                },
            },
            orderBy: { firstName: "asc" },
            take: 30,
        })

        // Calculate quality pass rate
        const passedCount = inspections.filter((i) => i.status === "PASS").length
        const passRate = inspections.length > 0
            ? Math.round((passedCount / inspections.length) * 100)
            : 0

        // Filter low stock items
        const lowStockItems = lowStockProducts
            .map((p) => {
                const totalQty = p.stockLevels.reduce((sum, sl) => sum + sl.quantity, 0)
                return { ...p, currentStock: totalQty }
            })
            .filter((p) => p.currentStock <= p.minStock && p.minStock > 0)

        return {
            productionLines: workOrders.map((wo) => ({
                id: wo.id,
                number: wo.number,
                product: wo.product.name,
                status: wo.status,
                progress: wo.plannedQty > 0 ? Math.round((wo.actualQty / wo.plannedQty) * 100) : 0,
                dueDate: wo.dueDate?.toISOString() || null,
                machineName: wo.machine?.name || null,
            })),
            staffSummary: employees.map((e) => ({
                id: e.id,
                name: `${e.firstName} ${e.lastName || ""}`.trim(),
                position: e.position,
                department: e.department,
                activeTaskCount: e._count.tasks,
                status: "ACTIVE",
            })),
            materials: lowStockItems.map((p) => ({
                id: p.id,
                name: p.name,
                code: p.code,
                currentStock: p.currentStock,
                minStock: p.minStock,
                unit: p.unit,
            })),
            quality: {
                passRate,
                totalInspections: inspections.length,
                recentInspections: inspections.map((i) => ({
                    id: i.id,
                    batchNumber: i.batchNumber,
                    status: i.status,
                    score: Number(i.score),
                    date: i.inspectionDate.toISOString(),
                    inspectorName: `${i.inspector.firstName} ${i.inspector.lastName || ""}`.trim(),
                })),
            },
        }
    } catch (error) {
        console.error("[getManagerDashboardStats] Error:", error)
        return {
            productionLines: [],
            staffSummary: [],
            materials: [],
            quality: { passRate: 0, totalInspections: 0, recentInspections: [] },
        }
    }
}
