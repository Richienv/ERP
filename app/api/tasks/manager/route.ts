import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getAuthzUser } from "@/lib/authz"
import { resolveEmployeeContext, isManagerPosition, isSuperRole } from "@/lib/employee-context"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const authUser = await getAuthzUser()
        const ctx = await resolveEmployeeContext(prisma as any, authUser)

        // Build department filter based on role
        let departmentFilter: any = {}
        if (ctx && !isSuperRole(authUser.role) && !isManagerPosition(ctx.position)) {
            return NextResponse.json({
                tasks: { pending: [], inProgress: [], blocked: [], completed: [] },
                employees: [],
                orders: [],
                dashboard: { productionLines: [], staffSummary: [], materials: [], quality: { passRate: 0, totalInspections: 0, recentInspections: [] } },
            })
        }
        if (ctx && !isSuperRole(authUser.role)) {
            departmentFilter = { employee: { department: ctx.department } }
        }

        // Run all queries in parallel
        const [rawTasks, rawEmployees, workOrders, purchaseOrders, salesOrders, lowStockProducts, inspections, staffEmployees] = await Promise.all([
            // Manager tasks
            prisma.employeeTask.findMany({
                where: {
                    ...departmentFilter,
                    NOT: { AND: [{ type: "ADMIN" }, { notes: { startsWith: "LEAVE_APPROVAL::" } }] },
                },
                include: {
                    employee: { select: { firstName: true, lastName: true, department: true } },
                    workOrder: { select: { id: true, number: true } },
                    purchaseOrder: { select: { id: true, number: true } },
                    salesOrder: { select: { id: true, number: true } },
                },
                orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
                take: 200,
            }),
            // Department employees
            prisma.employee.findMany({
                where: {
                    status: "ACTIVE",
                    ...(ctx && !isSuperRole(authUser.role) ? { department: ctx.department } : {}),
                },
                select: { id: true, firstName: true, lastName: true, position: true, department: true },
                orderBy: { firstName: "asc" },
            }),
            // Assignable orders — work orders
            prisma.workOrder.findMany({
                where: { status: { in: ["PLANNED", "IN_PROGRESS"] } },
                select: { id: true, number: true, status: true, plannedQty: true, actualQty: true, dueDate: true, product: { select: { name: true } }, machine: { select: { name: true } } },
                orderBy: { createdAt: "desc" },
                take: 50,
            }),
            // Assignable orders — purchase orders
            prisma.purchaseOrder.findMany({
                where: { status: { in: ["APPROVED", "ORDERED", "VENDOR_CONFIRMED", "SHIPPED"] } },
                select: { id: true, number: true, supplier: { select: { name: true } } },
                orderBy: { createdAt: "desc" },
                take: 50,
            }),
            // Assignable orders — sales orders
            prisma.salesOrder.findMany({
                where: { status: { in: ["CONFIRMED", "IN_PROGRESS"] } },
                select: { id: true, number: true, customer: { select: { name: true } } },
                orderBy: { createdAt: "desc" },
                take: 50,
            }),
            // Dashboard: low stock
            prisma.product.findMany({
                where: { stockLevels: { some: {} } },
                select: { id: true, name: true, code: true, unit: true, minStock: true, stockLevels: { select: { quantity: true } } },
                take: 20,
            }),
            // Dashboard: quality inspections
            prisma.qualityInspection.findMany({
                select: { id: true, batchNumber: true, status: true, score: true, inspectionDate: true, inspector: { select: { firstName: true, lastName: true } } },
                orderBy: { inspectionDate: "desc" },
                take: 10,
            }),
            // Dashboard: staff summary
            prisma.employee.findMany({
                where: { status: "ACTIVE" },
                select: {
                    id: true, firstName: true, lastName: true, position: true, department: true,
                    _count: { select: { tasks: { where: { status: { in: ["PENDING", "IN_PROGRESS"] } } } } },
                },
                orderBy: { firstName: "asc" },
                take: 30,
            }),
        ])

        // Map tasks into categories
        const mapTask = (t: any) => ({
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

        const tasks = {
            pending: rawTasks.filter((t) => t.status === "PENDING").map(mapTask),
            inProgress: rawTasks.filter((t) => t.status === "IN_PROGRESS").map(mapTask),
            blocked: rawTasks.filter((t) => t.status === "BLOCKED" || t.status === "REJECTED").map(mapTask),
            completed: rawTasks.filter((t) => t.status === "COMPLETED").slice(0, 20).map(mapTask),
        }

        const employees = rawEmployees.map((e) => ({
            id: e.id,
            name: `${e.firstName} ${e.lastName || ""}`.trim(),
            position: e.position,
            department: e.department,
        }))

        // Build assignable orders
        const orders = [
            ...workOrders.map((wo) => ({ type: "WO", id: wo.id, number: wo.number, label: `[WO] ${wo.number} — ${wo.product.name}` })),
            ...purchaseOrders.map((po: any) => ({ type: "PO", id: po.id, number: po.number, label: `[PO] ${po.number} — ${po.supplier.name}` })),
            ...salesOrders.map((so: any) => ({ type: "SO", id: so.id, number: so.number, label: `[SO] ${so.number} — ${so.customer.name}` })),
        ]

        // Build dashboard stats
        const passedCount = inspections.filter((i) => i.status === "PASS").length
        const passRate = inspections.length > 0 ? Math.round((passedCount / inspections.length) * 100) : 0

        const lowStockItems = lowStockProducts
            .map((p) => {
                const totalQty = p.stockLevels.reduce((sum, sl) => sum + Number(sl.quantity), 0)
                return { ...p, currentStock: totalQty }
            })
            .filter((p) => p.currentStock <= p.minStock && p.minStock > 0)

        const dashboard = {
            productionLines: workOrders.map((wo) => ({
                id: wo.id,
                number: wo.number,
                product: wo.product.name,
                status: wo.status,
                progress: wo.plannedQty > 0 ? Math.round((wo.actualQty / wo.plannedQty) * 100) : 0,
                dueDate: wo.dueDate?.toISOString() || null,
                machineName: wo.machine?.name || null,
            })),
            staffSummary: staffEmployees.map((e) => ({
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

        return NextResponse.json({ tasks, employees, orders, dashboard })
    } catch (e) {
        console.error("[API] tasks/manager:", e)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
