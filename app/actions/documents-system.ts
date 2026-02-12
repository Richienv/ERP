'use server'

import { revalidatePath } from "next/cache"
import { z } from "zod"
import MODULES_CONFIG from "@/config/modules.json"
import { withPrismaAuth } from "@/lib/db"
import { assertRole, getAuthzUser } from "@/lib/authz"

const DOCUMENTS_ADMIN_ROLES = ["ROLE_CEO", "ROLE_DIRECTOR", "ROLE_ADMIN"]
const PAYROLL_RUN_PREFIX = "PAYROLL_RUN::"

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

const normalizeToken = (token: string) => token.trim().toUpperCase()

const dedupeTokens = (tokens: string[]) => Array.from(new Set(tokens.map(normalizeToken).filter(Boolean)))

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

const revalidateDocumentSystemPages = () => {
    revalidatePath("/documents")
    revalidatePath("/documents/master")
    revalidatePath("/documents/reports")
    revalidatePath("/documents/docs")
    revalidatePath("/dashboard")
    revalidatePath("/inventory")
    revalidatePath("/inventory/categories")
    revalidatePath("/inventory/warehouses")
}

export async function getDocumentSystemOverview() {
    try {
        const authUser = await getAuthzUser()
        return await withPrismaAuth(async (prisma) => {
            const [categories, warehouses, roles, purchaseOrders, invoices, grns, payrollRuns, managerDirectory] = await Promise.all([
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
                    take: 20,
                }),
                prisma.invoice.findMany({
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
                    take: 20,
                }),
                prisma.goodsReceivedNote.findMany({
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
                    take: 20,
                }),
                prisma.employeeTask.findMany({
                    where: {
                        relatedId: { startsWith: "PAYROLL-" },
                        notes: { startsWith: PAYROLL_RUN_PREFIX },
                    },
                    select: {
                        id: true,
                        relatedId: true,
                        status: true,
                        updatedAt: true,
                        notes: true,
                    },
                    orderBy: { updatedAt: "desc" },
                    take: 50,
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
            revalidateDocumentSystemPages()
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
            revalidateDocumentSystemPages()
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
            revalidateDocumentSystemPages()
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
            revalidateDocumentSystemPages()
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
            revalidateDocumentSystemPages()
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
            revalidateDocumentSystemPages()
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
            const role = await prisma.systemRole.update({
                where: { id: roleId },
                data: { permissions },
            })
            revalidateDocumentSystemPages()
            return { success: true, data: role }
        })
    } catch (error: any) {
        console.error("Failed to update role permissions from documents system:", error)
        return { success: false, error: error?.message || "Gagal menyimpan permissions role" }
    }
}
