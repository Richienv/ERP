'use server'

import { z } from "zod"
import MODULES_CONFIG from "@/config/modules.json"
import { withPrismaAuth } from "@/lib/db"
import { assertRole, getAuthzUser } from "@/lib/authz"

const DOCUMENTS_ADMIN_ROLES = ["ROLE_CEO", "ROLE_DIRECTOR", "ROLE_ADMIN"]
const PAYROLL_RUN_PREFIX = "PAYROLL_RUN::"
const SYSTEM_ROLE_EVENT_TABLE = "system_role_events"

const ROLE_PERMISSION_ALIASES: Record<string, string[]> = {
    ROLE_ADMIN: ["ADMIN", "ALL"],
    ROLE_CEO: ["CEO", "ADMIN", "ALL"],
    ROLE_DIRECTOR: ["DIRECTOR", "ADMIN", "ALL"],
    ROLE_MANAGER: ["MANAGER", "PRODUCTION", "RD_MANAGER", "MANUFACTURING"],
    ROLE_ACCOUNTANT: ["ACCOUNTANT", "FINANCE", "ACCOUNTING", "INVOICE", "PAYMENT", "BILL"],
    ROLE_PURCHASING: ["PURCHASING", "PURCHASE", "VENDOR"],
    ROLE_WAREHOUSE: ["WAREHOUSE", "INVENTORY", "STOCK", "STOCK_OPNAME"],
    ROLE_SALES: ["SALES", "CRM"],
    ROLE_STAFF: ["STAFF"],
}

const BASE_PERMISSION_OPTIONS = [
    { key: "SALES", label: "Penjualan & CRM", group: "MODULE" },
    { key: "CRM", label: "CRM & Leads", group: "MODULE" },
    { key: "INVENTORY", label: "Inventori", group: "MODULE" },
    { key: "STOCK_OPNAME", label: "Stock Opname", group: "MODULE" },
    { key: "PURCHASING", label: "Pengadaan", group: "MODULE" },
    { key: "VENDOR", label: "Vendor Management", group: "MODULE" },
    { key: "FINANCE", label: "Keuangan", group: "MODULE" },
    { key: "ACCOUNTING", label: "Accounting", group: "MODULE" },
    { key: "MANUFACTURING", label: "Manufaktur", group: "MODULE" },
    { key: "PRODUCTION", label: "Produksi", group: "MODULE" },
    { key: "HR", label: "SDM", group: "MODULE" },
    { key: "DOCUMENTS", label: "Dokumen & Sistem", group: "MODULE" },
    { key: "ALL", label: "Akses Semua Modul", group: "SYSTEM" },
]

const categorySchema = z.object({
    code: z.string().trim().min(2).max(20).transform((value) => value.toUpperCase()),
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(500).optional(),
    parentId: z.string().uuid().optional().nullable(),
    isActive: z.boolean().default(true),
})

const warehouseSchema = z.object({
    code: z.string().trim().min(2).max(30).transform((value) => value.toUpperCase()),
    name: z.string().trim().min(2).max(140),
    address: z.string().trim().max(500).optional(),
    city: z.string().trim().max(120).optional(),
    province: z.string().trim().max(120).optional(),
    capacity: z.coerce.number().int().min(0).optional(),
    managerId: z.string().uuid().optional().nullable(),
    isActive: z.boolean().default(true),
})

const roleSchema = z.object({
    code: z.string().trim().min(2).max(80).transform((value) => value.toUpperCase()),
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(500).optional(),
    permissions: z.array(z.string().trim().min(1)).default([]),
})

const rolePermissionSchema = z.object({
    permissions: z.array(z.string().trim().min(1)).default([]),
})

type RegistryQueryInput = {
    q?: string | null
    status?: string | null
    type?: string | null
    from?: string | null
    to?: string | null
    page?: number | null
    pageSize?: number | null
}

type RegistryQueryNormalized = {
    q: string | null
    status: string | null
    type: string | null
    from: string | null
    to: string | null
    page: number
    pageSize: number
}

type DocumentsOverviewInput = {
    registryQuery?: {
        purchaseOrders?: RegistryQueryInput
        invoices?: RegistryQueryInput
        goodsReceipts?: RegistryQueryInput
        payrollRuns?: RegistryQueryInput
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

const normalizeToken = (token: string) => token.trim().toUpperCase()

const dedupeTokens = (tokens: string[]) => Array.from(new Set(tokens.map(normalizeToken).filter(Boolean)))

const arraysEqual = (a: string[], b: string[]) => {
    if (a.length !== b.length) return false
    const sortedA = [...a].sort()
    const sortedB = [...b].sort()
    return sortedA.every((value, index) => value === sortedB[index])
}

const buildActorLabel = (user: Awaited<ReturnType<typeof getAuthzUser>>) =>
    `${user.email || "unknown"} (${user.role})`

const normalizeText = (value?: string | null) => {
    const trimmed = (value || "").trim()
    return trimmed.length > 0 ? trimmed : null
}

const clampInt = (value: number | null | undefined, defaults: { min: number; max: number; fallback: number }) => {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return defaults.fallback
    return Math.min(defaults.max, Math.max(defaults.min, Math.trunc(parsed)))
}

const normalizeRegistryQuery = (input?: RegistryQueryInput): RegistryQueryNormalized => ({
    q: normalizeText(input?.q),
    status: normalizeText(input?.status),
    type: normalizeText(input?.type),
    from: normalizeText(input?.from),
    to: normalizeText(input?.to),
    page: clampInt(input?.page, { min: 1, max: 100000, fallback: 1 }),
    pageSize: clampInt(input?.pageSize, { min: 10, max: 100, fallback: 20 }),
})

const parseDateStart = (value?: string | null) => {
    if (!value) return null
    const parsed = new Date(`${value}T00:00:00`)
    if (Number.isNaN(parsed.getTime())) return null
    return parsed
}

const parseDateEnd = (value?: string | null) => {
    if (!value) return null
    const parsed = new Date(`${value}T23:59:59.999`)
    if (Number.isNaN(parsed.getTime())) return null
    return parsed
}

const ensureRoleEventTable = async (prisma: any) => {
    try {
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS ${SYSTEM_ROLE_EVENT_TABLE} (
                id BIGSERIAL PRIMARY KEY,
                role_id UUID NOT NULL,
                role_code TEXT NOT NULL,
                role_name TEXT,
                event_type TEXT NOT NULL,
                actor_label TEXT,
                before_permissions TEXT[] DEFAULT '{}',
                after_permissions TEXT[] DEFAULT '{}',
                changed_permissions TEXT[] DEFAULT '{}',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `)
        await prisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS idx_${SYSTEM_ROLE_EVENT_TABLE}_created_at
            ON ${SYSTEM_ROLE_EVENT_TABLE} (created_at DESC);
        `)
        await prisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS idx_${SYSTEM_ROLE_EVENT_TABLE}_role_id
            ON ${SYSTEM_ROLE_EVENT_TABLE} (role_id);
        `)
        return true
    } catch (error) {
        console.warn("Role event table unavailable:", error)
        return false
    }
}

const insertRoleAuditEvent = async (
    prisma: any,
    payload: {
        roleId: string
        roleCode: string
        roleName?: string | null
        eventType: string
        actorLabel?: string | null
        beforePermissions?: string[]
        afterPermissions?: string[]
    }
) => {
    const ready = await ensureRoleEventTable(prisma)
    if (!ready) return

    const beforePermissions = dedupeTokens(payload.beforePermissions || [])
    const afterPermissions = dedupeTokens(payload.afterPermissions || [])
    const changedPermissions = dedupeTokens(
        [...beforePermissions, ...afterPermissions].filter((token) => !beforePermissions.includes(token) || !afterPermissions.includes(token))
    )

    try {
        await prisma.$executeRaw`
            INSERT INTO system_role_events
            (role_id, role_code, role_name, event_type, actor_label, before_permissions, after_permissions, changed_permissions)
            VALUES
            (${payload.roleId}::uuid, ${payload.roleCode}, ${payload.roleName || null}, ${payload.eventType}, ${payload.actorLabel || null}, ${beforePermissions}::text[], ${afterPermissions}::text[], ${changedPermissions}::text[])
        `
    } catch (error) {
        console.warn("Failed to insert role audit event:", error)
    }
}

const derivePermissionOptions = () => {
    const dynamic = Object.entries(MODULES_CONFIG).map(([key, value]) => ({
        key: normalizeToken(key),
        label: `${value.name} (${key})`,
        group: "WORKFLOW",
    }))

    return dedupeByKey([...BASE_PERMISSION_OPTIONS, ...dynamic])
}

const dedupeByKey = <T extends { key: string }>(items: T[]): T[] => {
    const seen = new Set<string>()
    return items.filter((item) => {
        const normalized = normalizeToken(item.key)
        if (seen.has(normalized)) return false
        seen.add(normalized)
        item.key = normalized
        return true
    })
}

const getRoleCodeCandidates = (role?: string | null) => {
    if (!role) return []
    const normalizedRole = normalizeToken(role)
    const stripped = normalizedRole.replace(/^ROLE_/, "")
    const aliases = ROLE_PERMISSION_ALIASES[normalizedRole] || []
    return dedupeTokens([normalizedRole, stripped, ...aliases])
}

const findSystemRoleByAppRole = (roles: Array<{ code: string }>, appRole?: string | null) => {
    const candidates = getRoleCodeCandidates(appRole)
    if (candidates.length === 0) return null
    const roleMap = new Map(roles.map((role) => [normalizeToken(role.code), role]))
    for (const candidate of candidates) {
        const role = roleMap.get(candidate)
        if (role) return role
    }
    return null
}

const parsePayrollTask = (notes?: string | null) => {
    if (!notes || !notes.startsWith(PAYROLL_RUN_PREFIX)) return null
    const raw = notes.slice(PAYROLL_RUN_PREFIX.length)
    try {
        return JSON.parse(raw)
    } catch {
        return null
    }
}

export async function getDocumentSystemOverview(input?: DocumentsOverviewInput) {
    try {
        const authUser = await getAuthzUser()
        return await withPrismaAuth(async (prisma) => {
            const roleEventTableReady = await ensureRoleEventTable(prisma)

            const poQuery = normalizeRegistryQuery(input?.registryQuery?.purchaseOrders)
            const invoiceQuery = normalizeRegistryQuery(input?.registryQuery?.invoices)
            const grnQuery = normalizeRegistryQuery(input?.registryQuery?.goodsReceipts)
            const payrollQuery = normalizeRegistryQuery(input?.registryQuery?.payrollRuns)

            const poWhere: any = {}
            if (poQuery.status) poWhere.status = poQuery.status
            const poDateFrom = parseDateStart(poQuery.from)
            const poDateTo = parseDateEnd(poQuery.to)
            if (poDateFrom || poDateTo) {
                poWhere.updatedAt = {}
                if (poDateFrom) poWhere.updatedAt.gte = poDateFrom
                if (poDateTo) poWhere.updatedAt.lte = poDateTo
            }
            if (poQuery.q) {
                poWhere.OR = [
                    { number: { contains: poQuery.q, mode: "insensitive" } },
                    { supplier: { name: { contains: poQuery.q, mode: "insensitive" } } },
                ]
            }

            const invoiceWhere: any = {}
            if (invoiceQuery.status) invoiceWhere.status = invoiceQuery.status
            if (invoiceQuery.type) invoiceWhere.type = invoiceQuery.type
            const invoiceDateFrom = parseDateStart(invoiceQuery.from)
            const invoiceDateTo = parseDateEnd(invoiceQuery.to)
            if (invoiceDateFrom || invoiceDateTo) {
                invoiceWhere.updatedAt = {}
                if (invoiceDateFrom) invoiceWhere.updatedAt.gte = invoiceDateFrom
                if (invoiceDateTo) invoiceWhere.updatedAt.lte = invoiceDateTo
            }
            if (invoiceQuery.q) {
                invoiceWhere.OR = [
                    { number: { contains: invoiceQuery.q, mode: "insensitive" } },
                    { customer: { name: { contains: invoiceQuery.q, mode: "insensitive" } } },
                    { supplier: { name: { contains: invoiceQuery.q, mode: "insensitive" } } },
                ]
            }

            const grnWhere: any = {}
            if (grnQuery.status) grnWhere.status = grnQuery.status
            const grnDateFrom = parseDateStart(grnQuery.from)
            const grnDateTo = parseDateEnd(grnQuery.to)
            if (grnDateFrom || grnDateTo) {
                grnWhere.updatedAt = {}
                if (grnDateFrom) grnWhere.updatedAt.gte = grnDateFrom
                if (grnDateTo) grnWhere.updatedAt.lte = grnDateTo
            }
            if (grnQuery.q) {
                grnWhere.OR = [
                    { number: { contains: grnQuery.q, mode: "insensitive" } },
                    { purchaseOrder: { number: { contains: grnQuery.q, mode: "insensitive" } } },
                    { warehouse: { name: { contains: grnQuery.q, mode: "insensitive" } } },
                    { warehouse: { code: { contains: grnQuery.q, mode: "insensitive" } } },
                ]
            }

            const payrollWhere: any = {
                relatedId: { startsWith: "PAYROLL-" },
                notes: { startsWith: PAYROLL_RUN_PREFIX },
            }
            if (payrollQuery.status) payrollWhere.status = payrollQuery.status
            const payrollDateFrom = parseDateStart(payrollQuery.from)
            const payrollDateTo = parseDateEnd(payrollQuery.to)
            if (payrollDateFrom || payrollDateTo) {
                payrollWhere.updatedAt = {}
                if (payrollDateFrom) payrollWhere.updatedAt.gte = payrollDateFrom
                if (payrollDateTo) payrollWhere.updatedAt.lte = payrollDateTo
            }
            if (payrollQuery.q) {
                payrollWhere.OR = [
                    { relatedId: { contains: payrollQuery.q, mode: "insensitive" } },
                    { notes: { contains: payrollQuery.q, mode: "insensitive" } },
                ]
            }

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
                prisma.warehouse.findMany({
                    orderBy: [{ code: "asc" }],
                }),
                prisma.systemRole.findMany({
                    orderBy: [{ code: "asc" }],
                }),
                prisma.purchaseOrder.findMany({
                    where: poWhere,
                    select: {
                        id: true,
                        number: true,
                        status: true,
                        orderDate: true,
                        updatedAt: true,
                        netAmount: true,
                        supplier: { select: { name: true } },
                    },
                    orderBy: { updatedAt: "desc" },
                    skip: (poQuery.page - 1) * poQuery.pageSize,
                    take: poQuery.pageSize,
                }),
                prisma.invoice.findMany({
                    where: invoiceWhere,
                    select: {
                        id: true,
                        number: true,
                        type: true,
                        status: true,
                        issueDate: true,
                        updatedAt: true,
                        totalAmount: true,
                        customer: { select: { name: true } },
                        supplier: { select: { name: true } },
                    },
                    orderBy: { updatedAt: "desc" },
                    skip: (invoiceQuery.page - 1) * invoiceQuery.pageSize,
                    take: invoiceQuery.pageSize,
                }),
                prisma.goodsReceivedNote.findMany({
                    where: grnWhere,
                    select: {
                        id: true,
                        number: true,
                        status: true,
                        receivedDate: true,
                        updatedAt: true,
                        warehouse: { select: { name: true, code: true } },
                        purchaseOrder: { select: { number: true } },
                    },
                    orderBy: { updatedAt: "desc" },
                    skip: (grnQuery.page - 1) * grnQuery.pageSize,
                    take: grnQuery.pageSize,
                }),
                prisma.employeeTask.findMany({
                    where: payrollWhere,
                    select: {
                        id: true,
                        relatedId: true,
                        status: true,
                        updatedAt: true,
                        notes: true,
                    },
                    orderBy: { updatedAt: "desc" },
                    skip: (payrollQuery.page - 1) * payrollQuery.pageSize,
                    take: payrollQuery.pageSize,
                }),
                prisma.employee.findMany({
                    where: { status: "ACTIVE" },
                    select: {
                        id: true,
                        employeeId: true,
                        firstName: true,
                        lastName: true,
                        department: true,
                        position: true,
                    },
                    orderBy: [{ department: "asc" }, { firstName: "asc" }],
                    take: 300,
                }),
                roleEventsPromise,
                prisma.purchaseOrder.count({ where: poWhere }),
                prisma.invoice.count({ where: invoiceWhere }),
                prisma.goodsReceivedNote.count({ where: grnWhere }),
                prisma.employeeTask.count({ where: payrollWhere }),
            ])

            const managerIds = dedupeTokens(warehouses.map((warehouse) => warehouse.managerId || "").filter(Boolean))
            const managers = managerIds.length
                ? await prisma.employee.findMany({
                    where: { id: { in: managerIds } },
                    select: { id: true, firstName: true, lastName: true, employeeId: true },
                })
                : []
            const managerMap = new Map(managers.map((manager) => [manager.id, manager]))

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

            return {
                success: true,
                data: {
                    categories: categories.map((category) => ({
                        id: category.id,
                        code: category.code,
                        name: category.name,
                        description: category.description || "",
                        isActive: category.isActive,
                        parentId: category.parentId,
                        parentName: category.parent?.name || null,
                        itemCount: category._count.products,
                        updatedAt: category.updatedAt,
                    })),
                    warehouses: warehouses.map((warehouse) => {
                        const manager = warehouse.managerId ? managerMap.get(warehouse.managerId) : null
                        return {
                            id: warehouse.id,
                            code: warehouse.code,
                            name: warehouse.name,
                            address: warehouse.address || "",
                            city: warehouse.city || "",
                            province: warehouse.province || "",
                            capacity: warehouse.capacity || 0,
                            isActive: warehouse.isActive,
                            managerId: warehouse.managerId,
                            managerName: manager ? `${manager.firstName} ${manager.lastName || ""}`.trim() : "",
                            managerCode: manager?.employeeId || "",
                            updatedAt: warehouse.updatedAt,
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
                        invoices: invoices.map((invoice) => ({
                            id: invoice.id,
                            number: invoice.number,
                            status: invoice.status,
                            type: invoice.type,
                            updatedAt: invoice.updatedAt,
                            date: invoice.issueDate,
                            partnerName: invoice.customer?.name || invoice.supplier?.name || "-",
                            totalAmount: Number(invoice.totalAmount || 0),
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
                        purchaseOrders: {
                            page: poQuery.page,
                            pageSize: poQuery.pageSize,
                            total: poTotal,
                            totalPages: Math.max(1, Math.ceil(poTotal / poQuery.pageSize)),
                        },
                        invoices: {
                            page: invoiceQuery.page,
                            pageSize: invoiceQuery.pageSize,
                            total: invoiceTotal,
                            totalPages: Math.max(1, Math.ceil(invoiceTotal / invoiceQuery.pageSize)),
                        },
                        goodsReceipts: {
                            page: grnQuery.page,
                            pageSize: grnQuery.pageSize,
                            total: grnTotal,
                            totalPages: Math.max(1, Math.ceil(grnTotal / grnQuery.pageSize)),
                        },
                        payrollRuns: {
                            page: payrollQuery.page,
                            pageSize: payrollQuery.pageSize,
                            total: payrollTotal,
                            totalPages: Math.max(1, Math.ceil(payrollTotal / payrollQuery.pageSize)),
                        },
                    },
                    documentsQuery: {
                        purchaseOrders: poQuery,
                        invoices: invoiceQuery,
                        goodsReceipts: grnQuery,
                        payrollRuns: payrollQuery,
                    },
                    permissionOptions: derivePermissionOptions(),
                    moduleCatalog: Object.entries(MODULES_CONFIG).map(([key, value]) => ({
                        key: normalizeToken(key),
                        name: value.name,
                        model: value.model,
                        action: value.action,
                        roleRequired: value.role_required,
                        description: value.description,
                    })),
                    managerOptions: managerDirectory.map((employee) => ({
                        id: employee.id,
                        employeeCode: employee.employeeId,
                        name: `${employee.firstName} ${employee.lastName || ""}`.trim(),
                        department: employee.department,
                        position: employee.position,
                    })),
                    currentUserRole: authUser.role,
                    currentSystemRoleCode: currentSystemRole?.code || null,
                    canManage: DOCUMENTS_ADMIN_ROLES.includes(authUser.role),
                },
            }
        })
    } catch (error: any) {
        console.error("Failed to fetch documents system overview:", error)
        return { success: false, error: error?.message || "Gagal memuat data Dokumen & Sistem" }
    }
}

export async function getActiveModulesForCurrentUser() {
    try {
        const authUser = await getAuthzUser()
        return await withPrismaAuth(async (prisma) => {
            // 1) Check TenantConfig first (multi-tenant mode)
            const tenantSlug = process.env.TENANT_SLUG
            if (tenantSlug) {
                try {
                    const tenant = await (prisma as any).tenantConfig.findUnique({
                        where: { tenantSlug },
                        select: { enabledModules: true, tenantName: true, planType: true },
                    })
                    if (tenant && tenant.enabledModules?.length > 0) {
                        // Expand module IDs to permission keys using catalog
                        const catalog = await import("@/config/modules-catalog.json")
                        const allPermKeys: string[] = []
                        for (const modId of tenant.enabledModules) {
                            const modDef = catalog.modules.find((m: any) => m.id === modId)
                            if (modDef) {
                                allPermKeys.push(...modDef.permissionKeys)
                            }
                            allPermKeys.push(modId) // Also add the module ID itself
                        }
                        const permissions = dedupeTokens(allPermKeys)
                        return {
                            success: true,
                            data: {
                                appRole: authUser.role,
                                systemRoleCode: null,
                                permissions,
                                tenantName: tenant.tenantName,
                                planType: tenant.planType,
                            },
                        }
                    }
                } catch {
                    // TenantConfig table may not exist yet — fall through to role-based
                }
            }

            // 2) Fallback: existing SystemRole-based logic
            const roles = await prisma.systemRole.findMany({
                select: { code: true, permissions: true },
            })
            const resolvedRole = findSystemRoleByAppRole(roles, authUser.role)
            const permissions = dedupeTokens(resolvedRole?.permissions || [])
            return {
                success: true,
                data: {
                    appRole: authUser.role,
                    systemRoleCode: resolvedRole?.code || null,
                    permissions,
                },
            }
        })
    } catch (error: any) {
        console.error("Failed to resolve active modules:", error)
        return { success: false, error: error?.message || "Gagal memuat modul aktif" }
    }
}

export async function createDocumentCategory(input: z.input<typeof categorySchema>) {
    try {
        const user = await getAuthzUser()
        assertRole(user, DOCUMENTS_ADMIN_ROLES)
        const data = categorySchema.parse(input)

        return await withPrismaAuth(async (prisma) => {
            const existing = await prisma.category.findUnique({ where: { code: data.code } })
            if (existing) return { success: false, error: "Kode kategori sudah digunakan" }

            const category = await prisma.category.create({
                data: {
                    code: data.code,
                    name: data.name,
                    description: data.description || null,
                    parentId: data.parentId || null,
                    isActive: data.isActive,
                },
            })
            return { success: true, data: category }
        })
    } catch (error: any) {
        console.error("Failed to create category from documents system:", error)
        return { success: false, error: error?.message || "Gagal membuat kategori" }
    }
}

export async function updateDocumentCategory(categoryId: string, input: z.input<typeof categorySchema>) {
    try {
        const user = await getAuthzUser()
        assertRole(user, DOCUMENTS_ADMIN_ROLES)
        const data = categorySchema.parse(input)

        return await withPrismaAuth(async (prisma) => {
            const existing = await prisma.category.findFirst({
                where: {
                    code: data.code,
                    id: { not: categoryId },
                },
                select: { id: true },
            })
            if (existing) return { success: false, error: "Kode kategori sudah digunakan" }

            const category = await prisma.category.update({
                where: { id: categoryId },
                data: {
                    code: data.code,
                    name: data.name,
                    description: data.description || null,
                    parentId: data.parentId || null,
                    isActive: data.isActive,
                },
            })
            return { success: true, data: category }
        })
    } catch (error: any) {
        console.error("Failed to update category from documents system:", error)
        return { success: false, error: error?.message || "Gagal memperbarui kategori" }
    }
}

export async function createDocumentWarehouse(input: z.input<typeof warehouseSchema>) {
    try {
        const user = await getAuthzUser()
        assertRole(user, DOCUMENTS_ADMIN_ROLES)
        const data = warehouseSchema.parse(input)

        return await withPrismaAuth(async (prisma) => {
            const existing = await prisma.warehouse.findUnique({ where: { code: data.code } })
            if (existing) return { success: false, error: "Kode gudang sudah digunakan" }

            const warehouse = await prisma.warehouse.create({
                data: {
                    code: data.code,
                    name: data.name,
                    address: data.address || null,
                    city: data.city || null,
                    province: data.province || null,
                    capacity: data.capacity || null,
                    managerId: data.managerId || null,
                    isActive: data.isActive,
                },
            })
            return { success: true, data: warehouse }
        })
    } catch (error: any) {
        console.error("Failed to create warehouse from documents system:", error)
        return { success: false, error: error?.message || "Gagal membuat gudang" }
    }
}

export async function updateDocumentWarehouse(warehouseId: string, input: z.input<typeof warehouseSchema>) {
    try {
        const user = await getAuthzUser()
        assertRole(user, DOCUMENTS_ADMIN_ROLES)
        const data = warehouseSchema.parse(input)

        return await withPrismaAuth(async (prisma) => {
            const existing = await prisma.warehouse.findFirst({
                where: {
                    code: data.code,
                    id: { not: warehouseId },
                },
                select: { id: true },
            })
            if (existing) return { success: false, error: "Kode gudang sudah digunakan" }

            const warehouse = await prisma.warehouse.update({
                where: { id: warehouseId },
                data: {
                    code: data.code,
                    name: data.name,
                    address: data.address || null,
                    city: data.city || null,
                    province: data.province || null,
                    capacity: data.capacity || null,
                    managerId: data.managerId || null,
                    isActive: data.isActive,
                },
            })
            return { success: true, data: warehouse }
        })
    } catch (error: any) {
        console.error("Failed to update warehouse from documents system:", error)
        return { success: false, error: error?.message || "Gagal memperbarui gudang" }
    }
}

export async function createDocumentSystemRole(input: z.input<typeof roleSchema>) {
    try {
        const user = await getAuthzUser()
        assertRole(user, DOCUMENTS_ADMIN_ROLES)
        const data = roleSchema.parse(input)
        const permissions = dedupeTokens(data.permissions)

        return await withPrismaAuth(async (prisma) => {
            const existing = await prisma.systemRole.findUnique({ where: { code: data.code } })
            if (existing) return { success: false, error: "Kode role sudah digunakan" }

            const role = await prisma.systemRole.create({
                data: {
                    code: data.code,
                    name: data.name,
                    description: data.description || null,
                    permissions,
                    isSystem: false,
                },
            })
            await insertRoleAuditEvent(prisma, {
                roleId: role.id,
                roleCode: role.code,
                roleName: role.name,
                eventType: "ROLE_CREATED",
                actorLabel: buildActorLabel(user),
                beforePermissions: [],
                afterPermissions: permissions,
            })
            return { success: true, data: role }
        })
    } catch (error: any) {
        console.error("Failed to create system role from documents system:", error)
        return { success: false, error: error?.message || "Gagal membuat role" }
    }
}

export async function updateDocumentSystemRole(roleId: string, input: z.input<typeof roleSchema>) {
    try {
        const user = await getAuthzUser()
        assertRole(user, DOCUMENTS_ADMIN_ROLES)
        const data = roleSchema.parse(input)
        const permissions = dedupeTokens(data.permissions)

        return await withPrismaAuth(async (prisma) => {
            const previous = await prisma.systemRole.findUnique({
                where: { id: roleId },
                select: { id: true, code: true, name: true, permissions: true },
            })
            if (!previous) return { success: false, error: "Role tidak ditemukan" }

            const duplicate = await prisma.systemRole.findFirst({
                where: {
                    code: data.code,
                    id: { not: roleId },
                },
                select: { id: true },
            })
            if (duplicate) return { success: false, error: "Kode role sudah digunakan" }

            const role = await prisma.systemRole.update({
                where: { id: roleId },
                data: {
                    code: data.code,
                    name: data.name,
                    description: data.description || null,
                    permissions,
                },
            })
            await insertRoleAuditEvent(prisma, {
                roleId: role.id,
                roleCode: role.code,
                roleName: role.name,
                eventType: arraysEqual(dedupeTokens(previous.permissions || []), permissions) ? "ROLE_UPDATED" : "ROLE_UPDATED_WITH_PERMISSION_CHANGE",
                actorLabel: buildActorLabel(user),
                beforePermissions: dedupeTokens(previous.permissions || []),
                afterPermissions: permissions,
            })
            return { success: true, data: role }
        })
    } catch (error: any) {
        console.error("Failed to update system role from documents system:", error)
        return { success: false, error: error?.message || "Gagal memperbarui role" }
    }
}

export async function updateRolePermissionsFromDocuments(roleId: string, input: z.input<typeof rolePermissionSchema>) {
    try {
        const user = await getAuthzUser()
        assertRole(user, DOCUMENTS_ADMIN_ROLES)
        const payload = rolePermissionSchema.parse(input)
        const permissions = dedupeTokens(payload.permissions)

        return await withPrismaAuth(async (prisma) => {
            const previous = await prisma.systemRole.findUnique({
                where: { id: roleId },
                select: { id: true, code: true, name: true, permissions: true },
            })
            if (!previous) return { success: false, error: "Role tidak ditemukan" }

            const role = await prisma.systemRole.update({
                where: { id: roleId },
                data: { permissions },
            })
            await insertRoleAuditEvent(prisma, {
                roleId: role.id,
                roleCode: role.code,
                roleName: role.name,
                eventType: "PERMISSIONS_UPDATED",
                actorLabel: buildActorLabel(user),
                beforePermissions: dedupeTokens(previous.permissions || []),
                afterPermissions: permissions,
            })
            return { success: true, data: role }
        })
    } catch (error: any) {
        console.error("Failed to update role permissions from documents system:", error)
        return { success: false, error: error?.message || "Gagal menyimpan permissions role" }
    }
}
