import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getAuthzUser } from "@/lib/authz"
import MODULES_CONFIG from "@/config/modules.json"

export const dynamic = "force-dynamic"

const PAYROLL_RUN_PREFIX = "PAYROLL_RUN::"
const DOCUMENTS_ADMIN_ROLES = ["ROLE_CEO", "ROLE_DIRECTOR", "ROLE_ADMIN"]

const normalizeToken = (token: string) => token.trim().toUpperCase()
const dedupeTokens = (tokens: string[]) => Array.from(new Set(tokens.map(normalizeToken).filter(Boolean)))

function parsePayrollTask(notes?: string | null) {
    if (!notes || !notes.startsWith(PAYROLL_RUN_PREFIX)) return null
    try {
        return JSON.parse(notes.slice(PAYROLL_RUN_PREFIX.length))
    } catch {
        return null
    }
}

function findSystemRoleByAppRole(roles: Array<{ code: string }>, appRole?: string | null) {
    if (!appRole) return null
    const roleMap = new Map(roles.map((role) => [normalizeToken(role.code), role]))
    const normalized = normalizeToken(appRole)
    return roleMap.get(normalized) || roleMap.get(`ROLE_${normalized}`) || null
}

async function ensureRoleEventTable(db: typeof prisma) {
    try {
        await db.$queryRaw`SELECT 1 FROM system_role_events LIMIT 0`
        return true
    } catch {
        return false
    }
}

type RoleAuditEventRecord = {
    id: string
    roleId: string
    roleCode: string
    roleName: string | null
    eventType: string
    actorLabel: string | null
    beforePermissions: string[]
    afterPermissions: string[]
    changedPermissions: string[]
    createdAt: Date
}

export async function GET() {
    try {
        const authUser = await getAuthzUser()

        const roleEventTableReady = await ensureRoleEventTable(prisma)

        const roleEventsPromise = roleEventTableReady
            ? prisma.$queryRaw<RoleAuditEventRecord[]>`
                SELECT
                    sre.id::text AS id,
                    sre.role_id::text AS "roleId",
                    sre.role_code AS "roleCode",
                    sre.role_name AS "roleName",
                    sre.event_type AS "eventType",
                    sre.actor_label AS "actorLabel",
                    COALESCE(sre.before_permissions, ARRAY[]::text[]) AS "beforePermissions",
                    COALESCE(sre.after_permissions, ARRAY[]::text[]) AS "afterPermissions",
                    COALESCE(sre.changed_permissions, ARRAY[]::text[]) AS "changedPermissions",
                    sre.created_at AS "createdAt"
                FROM system_role_events sre
                ORDER BY sre.created_at DESC
                LIMIT 60
            `.catch(() => [] as RoleAuditEventRecord[])
            : Promise.resolve([] as RoleAuditEventRecord[])

        const [categories, warehouses, roles, purchaseOrders, invoices, grns, payrollRuns, managerDirectory, roleEvents, poTotal, invoiceTotal, grnTotal, payrollTotal] = await Promise.all([
            prisma.category.findMany({
                include: {
                    _count: { select: { products: true } },
                    parent: { select: { id: true, code: true, name: true } },
                },
                orderBy: [{ code: "asc" }],
            }),
            prisma.warehouse.findMany({ orderBy: [{ code: "asc" }] }),
            prisma.systemRole.findMany({ orderBy: [{ code: "asc" }] }),
            prisma.purchaseOrder.findMany({
                select: {
                    id: true, number: true, status: true, orderDate: true, updatedAt: true, netAmount: true,
                    supplier: { select: { name: true } },
                },
                orderBy: { updatedAt: "desc" },
                take: 20,
            }),
            prisma.invoice.findMany({
                select: {
                    id: true, number: true, type: true, status: true, issueDate: true, updatedAt: true, totalAmount: true,
                    customer: { select: { name: true } },
                    supplier: { select: { name: true } },
                },
                orderBy: { updatedAt: "desc" },
                take: 20,
            }),
            prisma.goodsReceivedNote.findMany({
                select: {
                    id: true, number: true, status: true, receivedDate: true, updatedAt: true,
                    warehouse: { select: { name: true, code: true } },
                    purchaseOrder: { select: { number: true } },
                },
                orderBy: { updatedAt: "desc" },
                take: 20,
            }),
            prisma.employeeTask.findMany({
                where: {
                    relatedId: { startsWith: "PAYROLL-" },
                    notes: { startsWith: PAYROLL_RUN_PREFIX },
                },
                select: { id: true, relatedId: true, status: true, updatedAt: true, notes: true },
                orderBy: { updatedAt: "desc" },
                take: 20,
            }),
            prisma.employee.findMany({
                where: { status: "ACTIVE" },
                select: { id: true, employeeId: true, firstName: true, lastName: true, department: true, position: true },
                orderBy: [{ department: "asc" }, { firstName: "asc" }],
                take: 300,
            }),
            roleEventsPromise,
            prisma.purchaseOrder.count(),
            prisma.invoice.count(),
            prisma.goodsReceivedNote.count(),
            prisma.employeeTask.count({
                where: { relatedId: { startsWith: "PAYROLL-" }, notes: { startsWith: PAYROLL_RUN_PREFIX } },
            }),
        ])

        const managerIds = dedupeTokens(warehouses.map((w) => w.managerId || "").filter(Boolean))
        const managers = managerIds.length
            ? await prisma.employee.findMany({
                where: { id: { in: managerIds } },
                select: { id: true, firstName: true, lastName: true, employeeId: true },
            })
            : []
        const managerMap = new Map(managers.map((m) => [m.id, m]))

        const payrollRegistry = payrollRuns.map((task) => {
            const payload = parsePayrollTask(task.notes)
            const period = typeof task.relatedId === "string" ? task.relatedId.replace("PAYROLL-", "") : "-"
            return {
                id: task.id,
                period,
                periodLabel: payload?.periodLabel || period,
                status: payload?.status || task.status,
                updatedAt: task.updatedAt,
            }
        })

        const normalizedRoles = roles.map((role) => ({
            ...role,
            permissions: dedupeTokens(role.permissions || []),
        }))

        const currentSystemRole = findSystemRoleByAppRole(normalizedRoles, authUser.role)

        const data = {
            categories: categories.map((cat) => ({
                id: cat.id,
                code: cat.code,
                name: cat.name,
                description: cat.description || "",
                isActive: cat.isActive,
                parentId: cat.parentId,
                parentName: cat.parent?.name || null,
                itemCount: cat._count.products,
                updatedAt: cat.updatedAt,
            })),
            warehouses: warehouses.map((wh) => {
                const mgr = wh.managerId ? managerMap.get(wh.managerId) : null
                return {
                    id: wh.id,
                    code: wh.code,
                    name: wh.name,
                    address: wh.address || "",
                    city: wh.city || "",
                    province: wh.province || "",
                    capacity: wh.capacity || 0,
                    isActive: wh.isActive,
                    managerId: wh.managerId,
                    managerName: mgr ? `${mgr.firstName} ${mgr.lastName || ""}`.trim() : "",
                    managerCode: mgr?.employeeId || "",
                    updatedAt: wh.updatedAt,
                }
            }),
            roles: normalizedRoles.map((role) => ({
                id: role.id,
                code: role.code,
                name: role.name,
                description: role.description || "",
                isSystem: role.isSystem,
                permissions: role.permissions,
                updatedAt: role.updatedAt,
            })),
            roleAuditEvents: roleEvents.map((event) => ({
                id: event.id,
                roleId: event.roleId,
                roleCode: event.roleCode,
                roleName: event.roleName || null,
                eventType: event.eventType,
                actorLabel: event.actorLabel || null,
                beforePermissions: dedupeTokens(event.beforePermissions || []),
                afterPermissions: dedupeTokens(event.afterPermissions || []),
                changedPermissions: dedupeTokens(event.changedPermissions || []),
                createdAt: event.createdAt,
            })),
            documents: {
                purchaseOrders: purchaseOrders.map((po) => ({
                    id: po.id,
                    number: po.number,
                    status: po.status,
                    updatedAt: po.updatedAt,
                    date: po.orderDate,
                    partnerName: po.supplier?.name || "-",
                    totalAmount: Number(po.netAmount || 0),
                    viewUrl: `/api/documents/purchase-order/${po.id}?disposition=inline`,
                })),
                invoices: invoices.map((inv) => ({
                    id: inv.id,
                    number: inv.number,
                    status: inv.status,
                    type: inv.type,
                    updatedAt: inv.updatedAt,
                    date: inv.issueDate,
                    partnerName: inv.customer?.name || inv.supplier?.name || "-",
                    totalAmount: Number(inv.totalAmount || 0),
                    viewUrl: "/finance/invoices",
                })),
                goodsReceipts: grns.map((grn) => ({
                    id: grn.id,
                    number: grn.number,
                    status: grn.status,
                    updatedAt: grn.updatedAt,
                    date: grn.receivedDate,
                    warehouse: `${grn.warehouse.code} - ${grn.warehouse.name}`,
                    purchaseOrderNumber: grn.purchaseOrder.number,
                    viewUrl: "/procurement/receiving",
                })),
                payrollRuns: payrollRegistry.map((payroll) => ({
                    ...payroll,
                    viewUrl: `/api/documents/payroll/${encodeURIComponent(payroll.period)}?disposition=inline`,
                })),
            },
            documentsMeta: {
                purchaseOrders: { page: 1, pageSize: 20, total: poTotal, totalPages: Math.max(1, Math.ceil(poTotal / 20)) },
                invoices: { page: 1, pageSize: 20, total: invoiceTotal, totalPages: Math.max(1, Math.ceil(invoiceTotal / 20)) },
                goodsReceipts: { page: 1, pageSize: 20, total: grnTotal, totalPages: Math.max(1, Math.ceil(grnTotal / 20)) },
                payrollRuns: { page: 1, pageSize: 20, total: payrollTotal, totalPages: Math.max(1, Math.ceil(payrollTotal / 20)) },
            },
            moduleCatalog: Object.entries(MODULES_CONFIG).map(([key, value]: [string, any]) => ({
                key: normalizeToken(key),
                name: value.name,
                model: value.model,
                action: value.action,
                roleRequired: value.role_required,
                description: value.description,
            })),
            managerOptions: managerDirectory.map((emp) => ({
                id: emp.id,
                employeeCode: emp.employeeId,
                name: `${emp.firstName} ${emp.lastName || ""}`.trim(),
                department: emp.department,
                position: emp.position,
            })),
            currentUserRole: authUser.role,
            currentSystemRoleCode: currentSystemRole?.code || null,
            canManage: DOCUMENTS_ADMIN_ROLES.includes(authUser.role),
        }

        return NextResponse.json({ success: true, data })
    } catch (e) {
        console.error("[API] documents/overview:", e)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
