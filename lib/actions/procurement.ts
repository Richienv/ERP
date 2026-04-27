"use server"

import { withPrismaAuth, prisma } from "@/lib/db"
import { ProcurementStatus, PrismaClient, Prisma } from "@prisma/client"
import type { POFilter, PRFilter } from "@/lib/types/procurement-filters"

export type { POFilter, PRFilter } from "@/lib/types/procurement-filters"
import { recordPendingBillFromPO } from "@/lib/actions/finance-invoices"
import { FALLBACK_PURCHASE_ORDERS, FALLBACK_VENDORS } from "@/lib/db-fallbacks"
import { assertRole, getAuthzUser } from "@/lib/authz"
import { assertPOTransition } from "@/lib/po-state-machine"
import { canApproveForDepartment, resolveEmployeeContext } from "@/lib/employee-context"
import { SYS_ACCOUNTS } from "@/lib/gl-accounts"
import { ensureSystemAccounts } from "@/lib/gl-accounts-server"
import { postJournalEntry } from "@/lib/actions/finance-gl"
import { postInventoryGLEntry } from "@/lib/actions/inventory-gl"
import { assertPeriodOpen } from "@/lib/period-helpers"
import { TAX_RATES } from "@/lib/tax-rates"
import { getNextDocNumber } from "@/lib/document-numbering"
import { revalidatePath } from "next/cache"

/*
 * Procurement Role Matrix (H10):
 *
 *                        Create PO   Approve PO   Approve PR   Override Requester
 *   ROLE_PURCHASING         ✓           ✗            ✓              ✗
 *   ROLE_MANAGER            ✗           ✓            ✓              ✗
 *   ROLE_DIRECTOR           ✓           ✓            ✓              ✓
 *   ROLE_CEO                ✓           ✓            ✓              ✓
 *   ROLE_ADMIN              ✓           ✓            ✓              ✓
 *
 * Asymmetry: ROLE_MANAGER can approve POs/PRs but cannot create POs.
 * In a small SME where Purchasing staff is absent, a manager-approved PR
 * cannot be auto-converted to a PO — see approveAndCreatePOFromPR which
 * surfaces this clearly to the user (H9).
 *
 * SoD (Segregation of Duties): the same user cannot both create AND
 * approve a PO — enforced in approvePurchaseOrder (C8).
 */
const PURCHASING_ROLES = ["ROLE_PURCHASING", "ROLE_ADMIN", "ROLE_CEO", "ROLE_DIRECTOR"]
const APPROVER_ROLES = ["ROLE_CEO", "ROLE_DIRECTOR", "ROLE_ADMIN", "ROLE_MANAGER"]
const PR_APPROVER_ROLES = ["ROLE_MANAGER", "ROLE_CEO", "ROLE_DIRECTOR", "ROLE_PURCHASING", "ROLE_ADMIN"]
const REQUESTER_OVERRIDE_ROLES = ["ROLE_ADMIN", "ROLE_CEO", "ROLE_DIRECTOR"]

/** Invalidate every page that displays procurement, inventory, or finance
 * state derived from a PO/PR mutation. Call after any write action. */
function revalidateProcurementPaths() {
    revalidatePath("/procurement")
    revalidatePath("/procurement/orders")
    revalidatePath("/procurement/requests")
    revalidatePath("/procurement/receiving")
    revalidatePath("/inventory")
    revalidatePath("/inventory/stock")
    revalidatePath("/finance")
    revalidatePath("/dashboard")
}

type ProcurementRegistryQueryInput = {
    status?: string | null
    page?: number | null
    pageSize?: number | null
}

type ProcurementStatsInput = {
    registryQuery?: {
        purchaseOrders?: ProcurementRegistryQueryInput
        purchaseRequests?: ProcurementRegistryQueryInput
        receiving?: ProcurementRegistryQueryInput
    }
}

const normalizeProcurementText = (value?: string | null) => {
    const trimmed = (value || "").trim()
    return trimmed.length > 0 ? trimmed : null
}

const clampInt = (value: number | null | undefined, defaults: { min: number; max: number; fallback: number }) => {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return defaults.fallback
    return Math.min(defaults.max, Math.max(defaults.min, Math.trunc(parsed)))
}

const normalizeRegistryQuery = (input?: ProcurementRegistryQueryInput) => ({
    status: normalizeProcurementText(input?.status),
    page: clampInt(input?.page, { min: 1, max: 100000, fallback: 1 }),
    pageSize: clampInt(input?.pageSize, { min: 4, max: 50, fallback: 6 }),
})

async function requireActiveProcurementActor(prismaClient: any, user: { role: string; email?: string | null; employeeId?: string | null }) {
    const actor = await resolveEmployeeContext(prismaClient, user as any)
    if (!actor) {
        throw new Error("Akun belum terhubung ke employee aktif. Hubungi admin SDM.")
    }
    return actor
}

async function createPurchaseOrderEvent(tx: typeof prisma, params: {
    purchaseOrderId: string
    status: ProcurementStatus
    changedBy: string
    action: string
    notes?: string
    metadata?: any
}) {
    await (tx as any).purchaseOrderEvent.create({
        data: {
            purchaseOrderId: params.purchaseOrderId,
            status: params.status,
            changedBy: params.changedBy,
            action: params.action,
            notes: params.notes,
            metadata: params.metadata,
        }
    })
}

export async function getVendors() {
    try {
        await getAuthzUser()

        const [vendors, spendBySupplier] = await Promise.all([
            prisma.supplier.findMany({
                where: { isActive: true },
                orderBy: { name: 'asc' },
                include: {
                    _count: {
                        select: { purchaseOrders: true }
                    }
                }
            }),
            prisma.purchaseOrder.groupBy({
                by: ['supplierId'],
                where: {
                    status: { in: ['ORDERED', 'VENDOR_CONFIRMED', 'SHIPPED', 'PARTIAL_RECEIVED', 'RECEIVED', 'COMPLETED'] }
                },
                _sum: { netAmount: true }
            })
        ])

        if (!vendors) return []

        const spendMap = new Map(spendBySupplier.map(s => [s.supplierId, Number(s._sum.netAmount || 0)]))

        return vendors.map((v) => ({
            id: v.id,
            name: v.name,
            code: v.code,
            category: v.code?.startsWith('IMP') ? "Import" : "General",
            status: v.isActive ? "Active" : "Inactive",
            rating: v.rating,
            contact: v.contactName || "-",
            phone: v.phone || "-",
            email: v.email || "-",
            address: v.address || "-",
            totalSpend: spendMap.get(v.id)?.toString() || "0",
            activeOrders: v._count.purchaseOrders,
            color: "bg-zinc-500",
            logo: v.name?.substring(0, 2).toUpperCase() || "??"
        }))
    } catch (error) {
        console.error("Prisma Error fetching vendors:", error)
        return FALLBACK_VENDORS
    }
}

// ==========================================
// DASHBOARD STATS
// ==========================================

export async function getProcurementStats(input?: ProcurementStatsInput) {
    try {
        await getAuthzUser()

        const safe = async <T,>(label: string, promise: Promise<T>, fallback: T): Promise<T> =>
            promise.catch((error) => {
                console.error(`Procurement stats segment failed: ${label}`, error)
                return fallback
            })

        const now = new Date()
        const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
        const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const poQuery = normalizeRegistryQuery(input?.registryQuery?.purchaseOrders)
        const prQuery = normalizeRegistryQuery(input?.registryQuery?.purchaseRequests)
        const receivingQuery = normalizeRegistryQuery(input?.registryQuery?.receiving)

        const activeSpendStatuses: ProcurementStatus[] = ['ORDERED', 'VENDOR_CONFIRMED', 'SHIPPED', 'RECEIVED', 'COMPLETED']
        const poWhere = poQuery.status ? { status: poQuery.status as ProcurementStatus } : {}
        const prWhere = prQuery.status ? { status: prQuery.status as any } : {}
        const receivingWhere = receivingQuery.status ? { status: receivingQuery.status as any } : {}

        // Batch queries into smaller groups to avoid exhausting DB connection pool
        // Group 1: Lightweight counts + aggregates (6 queries)
        const [
            pendingPOs,
            pendingPRs,
            incomingCount,
            poStatusRows,
            prStatusRows,
            grnStatusRows,
        ] = await Promise.all([
            safe("pending-po-count", prisma.purchaseOrder.count({ where: { status: 'PENDING_APPROVAL' } }), 0),
            safe("pending-pr-count", prisma.purchaseRequest.count({ where: { status: 'PENDING' } }), 0),
            safe("incoming-po-count", prisma.purchaseOrder.count({ where: { status: { in: ['ORDERED', 'VENDOR_CONFIRMED', 'SHIPPED', 'PARTIAL_RECEIVED'] } } }), 0),
            safe("po-status-group", prisma.purchaseOrder.groupBy({ by: ['status'], _count: { _all: true } }), [] as Array<{ status: string; _count: { _all: number } }>),
            safe("pr-status-group", prisma.purchaseRequest.groupBy({ by: ['status'], _count: { _all: true } }), [] as Array<{ status: string; _count: { _all: number } }>),
            safe("grn-status-group", prisma.goodsReceivedNote.groupBy({ by: ['status'], _count: { _all: true } }), [] as Array<{ status: string; _count: { _all: number } }>),
        ])

        // Group 2: Spend, vendors, urgentNeeds, filtered totals (6 queries)
        const [
            currentMonthPOs,
            previousMonthPOs,
            vendors,
            urgentNeedsCount,
            poFilteredTotal,
            prFilteredTotal,
        ] = await Promise.all([
            safe("current-month-pos", prisma.purchaseOrder.findMany({
                where: { status: { in: activeSpendStatuses }, createdAt: { gte: startOfCurrentMonth, lt: startOfNextMonth } },
                select: { netAmount: true }
            }), [] as Array<{ netAmount: any }>),
            safe("previous-month-pos", prisma.purchaseOrder.findMany({
                where: { status: { in: activeSpendStatuses }, createdAt: { gte: startOfPreviousMonth, lt: startOfCurrentMonth } },
                select: { netAmount: true }
            }), [] as Array<{ netAmount: any }>),
            safe("vendors-health", prisma.supplier.findMany({ where: { isActive: true }, select: { rating: true, onTimeRate: true } }), [] as Array<{ rating: number | null; onTimeRate: number | null }>),
            safe("urgent-needs", prisma.$queryRaw<[{ count: bigint }]>`
                    SELECT COUNT(DISTINCT p.id)::bigint as count
                    FROM public."Product" p
                    LEFT JOIN (SELECT "productId", SUM(quantity) as total_qty FROM public."StockLevel" GROUP BY "productId") sl ON sl."productId" = p.id
                    WHERE p."isActive" = true AND p."minStock" > 0 AND COALESCE(sl.total_qty, 0) <= p."minStock"
                `.then(rows => Number(rows[0]?.count || 0)), 0),
            safe("po-filtered-total", prisma.purchaseOrder.count({ where: poWhere }), 0),
            safe("pr-filtered-total", prisma.purchaseRequest.count({ where: prWhere }), 0),
        ])

        // Group 3: Registry lists (4 queries)
        const [
            recentPOs,
            recentPRsRaw,
            recentGRNsRaw,
            receivingFilteredTotal,
        ] = await Promise.all([
            safe("recent-po", prisma.purchaseOrder.findMany({
                where: poWhere,
                orderBy: { createdAt: 'desc' },
                skip: (poQuery.page - 1) * poQuery.pageSize,
                take: poQuery.pageSize,
                include: { supplier: { select: { name: true } } }
            }), [] as Array<any>),
            safe("recent-pr", prisma.purchaseRequest.findMany({
                where: prWhere,
                orderBy: { createdAt: 'desc' },
                skip: (prQuery.page - 1) * prQuery.pageSize,
                take: prQuery.pageSize,
                select: { id: true, number: true, status: true, requesterId: true, createdAt: true, priority: true }
            }), [] as Array<any>),
            safe("recent-grn", prisma.goodsReceivedNote.findMany({
                where: receivingWhere,
                orderBy: { receivedDate: 'desc' },
                skip: (receivingQuery.page - 1) * receivingQuery.pageSize,
                take: receivingQuery.pageSize,
                select: { id: true, number: true, status: true, receivedDate: true, purchaseOrder: { select: { number: true } }, warehouse: { select: { name: true } } }
            }), [] as Array<any>),
            safe("receiving-filtered-total", prisma.goodsReceivedNote.count({ where: receivingWhere }), 0),
        ])

        const currentSpend = currentMonthPOs.reduce((sum, po) => sum + Number(po.netAmount || 0), 0)
        const previousSpend = previousMonthPOs.reduce((sum, po) => sum + Number(po.netAmount || 0), 0)
        const growth = previousSpend > 0 ? ((currentSpend - previousSpend) / previousSpend) * 100 : 0

        const avgRating = vendors.length > 0 ? vendors.reduce((sum, v) => sum + (v.rating || 0), 0) / vendors.length : 0
        const avgOnTime = vendors.length > 0 ? vendors.reduce((sum, v) => sum + (v.onTimeRate || 0), 0) / vendors.length : 0

        const urgentNeeds = urgentNeedsCount

        const requesterIds = [...new Set(recentPRsRaw.map((pr) => pr.requesterId))]
        const [requesters, prItemCounts] = await Promise.all([
            requesterIds.length > 0
                ? prisma.employee.findMany({
                    where: { id: { in: requesterIds } },
                    select: { id: true, firstName: true, lastName: true }
                })
                : Promise.resolve([]),
            recentPRsRaw.length > 0
                ? prisma.purchaseRequestItem.groupBy({
                    by: ['purchaseRequestId'],
                    _count: { _all: true },
                    where: { purchaseRequestId: { in: recentPRsRaw.map((pr) => pr.id) } }
                })
                : Promise.resolve([])
        ])

        const requesterMap = new Map(requesters.map((r) => [r.id, `${r.firstName} ${r.lastName || ''}`.trim()]))
        const prItemCountMap = new Map(prItemCounts.map((r) => [r.purchaseRequestId, r._count._all || 0]))

        const poSummary = {
            draft: 0,
            pendingApproval: 0,
            approved: 0,
            inProgress: 0,
            received: 0,
            completed: 0,
            rejected: 0,
            cancelled: 0,
        }
        for (const row of poStatusRows) {
            const count = row._count._all || 0
            if (row.status === 'PO_DRAFT') poSummary.draft = count
            else if (row.status === 'PENDING_APPROVAL') poSummary.pendingApproval = count
            else if (row.status === 'APPROVED') poSummary.approved = count
            else if (['ORDERED', 'VENDOR_CONFIRMED', 'SHIPPED', 'PARTIAL_RECEIVED'].includes(row.status)) poSummary.inProgress += count
            else if (row.status === 'RECEIVED') poSummary.received = count
            else if (row.status === 'COMPLETED') poSummary.completed = count
            else if (row.status === 'REJECTED') poSummary.rejected = count
            else if (row.status === 'CANCELLED') poSummary.cancelled = count
        }

        const prSummary = {
            draft: 0,
            pending: 0,
            approved: 0,
            poCreated: 0,
            rejected: 0,
            cancelled: 0,
        }
        for (const row of prStatusRows) {
            const count = row._count._all || 0
            if (row.status === 'DRAFT') prSummary.draft = count
            else if (row.status === 'PENDING') prSummary.pending = count
            else if (row.status === 'APPROVED') prSummary.approved = count
            else if (row.status === 'PO_CREATED') prSummary.poCreated = count
            else if (row.status === 'REJECTED') prSummary.rejected = count
            else if (row.status === 'CANCELLED') prSummary.cancelled = count
        }

        const receivingSummary = {
            draft: 0,
            inspecting: 0,
            partialAccepted: 0,
            accepted: 0,
            rejected: 0,
        }
        for (const row of grnStatusRows) {
            const count = row._count._all || 0
            if (row.status === 'DRAFT') receivingSummary.draft = count
            else if (row.status === 'INSPECTING') receivingSummary.inspecting = count
            else if (row.status === 'PARTIAL_ACCEPTED') receivingSummary.partialAccepted = count
            else if (row.status === 'ACCEPTED') receivingSummary.accepted = count
            else if (row.status === 'REJECTED') receivingSummary.rejected = count
        }

        return {
            spend: { current: currentSpend, growth },
            needsApproval: pendingPOs + pendingPRs,
            urgentNeeds,
            vendorHealth: { rating: avgRating, onTime: avgOnTime },
            incomingCount,
            recentActivity: recentPOs || [],
            purchaseOrders: {
                summary: poSummary,
                recent: recentPOs.map((po) => ({
                    id: po.id,
                    number: po.number,
                    status: po.status,
                    supplier: po.supplier?.name || 'Unknown',
                    total: Number(po.netAmount || po.totalAmount || 0),
                    date: po.createdAt
                }))
            },
            purchaseRequests: {
                summary: prSummary,
                recent: recentPRsRaw.map((pr) => ({
                    id: pr.id,
                    number: pr.number,
                    status: pr.status,
                    requester: requesterMap.get(pr.requesterId) || pr.requesterId,
                    itemCount: prItemCountMap.get(pr.id) || 0,
                    priority: pr.priority,
                    date: pr.createdAt
                }))
            },
            receiving: {
                summary: receivingSummary,
                recent: recentGRNsRaw.map((grn) => ({
                    id: grn.id,
                    number: grn.number,
                    status: grn.status,
                    poNumber: grn.purchaseOrder?.number || '-',
                    warehouse: grn.warehouse?.name || '-',
                    date: grn.receivedDate
                }))
            },
            registryMeta: {
                purchaseOrders: {
                    page: poQuery.page,
                    pageSize: poQuery.pageSize,
                    total: poFilteredTotal,
                    totalPages: Math.max(1, Math.ceil(poFilteredTotal / poQuery.pageSize)),
                },
                purchaseRequests: {
                    page: prQuery.page,
                    pageSize: prQuery.pageSize,
                    total: prFilteredTotal,
                    totalPages: Math.max(1, Math.ceil(prFilteredTotal / prQuery.pageSize)),
                },
                receiving: {
                    page: receivingQuery.page,
                    pageSize: receivingQuery.pageSize,
                    total: receivingFilteredTotal,
                    totalPages: Math.max(1, Math.ceil(receivingFilteredTotal / receivingQuery.pageSize)),
                }
            },
            registryQuery: {
                purchaseOrders: poQuery,
                purchaseRequests: prQuery,
                receiving: receivingQuery,
            }
        }

    } catch (error) {
        console.error("Error fetching procurement stats:", error)
        return {
            spend: { current: 0, growth: 0 },
            needsApproval: 0,
            urgentNeeds: 0,
            vendorHealth: { rating: 0, onTime: 0 },
            incomingCount: 0,
            recentActivity: [],
            purchaseOrders: {
                summary: { draft: 0, pendingApproval: 0, approved: 0, inProgress: 0, received: 0, completed: 0, rejected: 0, cancelled: 0 },
                recent: []
            },
            purchaseRequests: {
                summary: { draft: 0, pending: 0, approved: 0, poCreated: 0, rejected: 0, cancelled: 0 },
                recent: []
            },
            receiving: {
                summary: { draft: 0, inspecting: 0, partialAccepted: 0, accepted: 0, rejected: 0 },
                recent: []
            },
            registryMeta: {
                purchaseOrders: { page: 1, pageSize: 6, total: 0, totalPages: 1 },
                purchaseRequests: { page: 1, pageSize: 6, total: 0, totalPages: 1 },
                receiving: { page: 1, pageSize: 6, total: 0, totalPages: 1 },
            },
            registryQuery: {
                purchaseOrders: { status: null, page: 1, pageSize: 6 },
                purchaseRequests: { status: null, page: 1, pageSize: 6 },
                receiving: { status: null, page: 1, pageSize: 6 },
            }
        }
    }
}

// ==========================================
// PURCHASE REQUEST ACTIONS
// ==========================================

export async function getPurchaseRequests(filter?: PRFilter) {
    try {
        return await withPrismaAuth(async (prisma) => {
            const where: Prisma.PurchaseRequestWhereInput = {}

            if (filter?.status?.length) {
                where.status = { in: filter.status as any }
            }
            if (filter?.departments?.length) {
                where.department = { in: filter.departments }
            }
            if (filter?.priority?.length) {
                where.priority = { in: filter.priority }
            }
            if (filter?.dateStart || filter?.dateEnd) {
                const createdAt: Prisma.DateTimeFilter = {}
                if (filter.dateStart) createdAt.gte = new Date(filter.dateStart)
                if (filter.dateEnd) createdAt.lte = new Date(filter.dateEnd)
                where.createdAt = createdAt
            }
            if (filter?.search) {
                where.OR = [
                    { number: { contains: filter.search, mode: "insensitive" } },
                    { department: { contains: filter.search, mode: "insensitive" } },
                    {
                        requester: {
                            OR: [
                                { firstName: { contains: filter.search, mode: "insensitive" } },
                                { lastName: { contains: filter.search, mode: "insensitive" } },
                            ],
                        },
                    },
                ]
            }

            const requests = await prisma.purchaseRequest.findMany({
                where,
                include: {
                    requester: {
                        select: { firstName: true, lastName: true, department: true },
                    },
                    approver: {
                        select: { firstName: true, lastName: true },
                    },
                    items: {
                        include: {
                            product: {
                                select: { name: true, unit: true, costPrice: true },
                            },
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
            })

            return requests.map((req: any) => {
                const requesterName = `${req.requester?.firstName || ""} ${req.requester?.lastName || ""}`.trim()
                const approverName = req.approver
                    ? `${req.approver.firstName || ""} ${req.approver.lastName || ""}`.trim()
                    : null
                // Estimated total = sum(qty * costPrice) when costPrice is known; else 0.
                const estimatedTotal = (req.items ?? []).reduce((sum: number, item: any) => {
                    const cost = Number(item.product?.costPrice ?? 0)
                    const qty = Number(item.quantity ?? 0)
                    return sum + cost * qty
                }, 0)
                return {
                    id: req.id,
                    number: req.number,
                    requester: requesterName,
                    requesterFirstName: req.requester?.firstName ?? "",
                    requesterLastName: req.requester?.lastName ?? "",
                    department: req.department || req.requester?.department || "",
                    status: req.status,
                    priority: req.priority || "NORMAL",
                    notes: req.notes,
                    date: new Date(req.createdAt),
                    approver: approverName,
                    estimatedTotal,
                    itemCount: req.items?.length || 0,
                    items: req.items?.map((i: any) => ({
                        id: i.id,
                        productName: i.product?.name,
                        quantity: i.quantity,
                        unit: i.product?.unit,
                        status: i.status,
                    })) || [],
                }
            })
        })
    } catch (error) {
        console.error("Error fetching requests:", error)
        return []
    }
}

/**
 * Fetch a single Purchase Request with full relations for the detail page.
 * Returns null if not found. Decimal fields are converted to numbers for
 * JSON serialization.
 */
export async function getPurchaseRequestById(id: string) {
    try {
        await getAuthzUser()
        const pr = await prisma.purchaseRequest.findUnique({
            where: { id },
            include: {
                requester: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        department: true,
                        position: true,
                    },
                },
                approver: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        department: true,
                        position: true,
                    },
                },
                items: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                code: true,
                                name: true,
                                unit: true,
                                costPrice: true,
                            },
                        },
                        preferredSupplier: {
                            select: { id: true, name: true, email: true, phone: true },
                        },
                    },
                },
                purchaseOrder: {
                    select: {
                        id: true,
                        number: true,
                        status: true,
                        totalAmount: true,
                    },
                },
            },
        })

        if (!pr) return null

        // Estimated unit/total cost helper
        const items = pr.items.map((i: any) => {
            const unitPrice = Number(i.product?.costPrice ?? 0)
            const qty = Number(i.quantity ?? 0)
            return {
                ...i,
                quantity: qty,
                unitPrice,
                totalPrice: unitPrice * qty,
                product: i.product
                    ? {
                          ...i.product,
                          costPrice: Number(i.product.costPrice ?? 0),
                      }
                    : null,
            }
        })

        const estimatedTotal = items.reduce((s, i) => s + i.totalPrice, 0)

        return {
            ...pr,
            items,
            estimatedTotal,
            purchaseOrder: pr.purchaseOrder
                ? {
                      ...pr.purchaseOrder,
                      totalAmount: Number(pr.purchaseOrder.totalAmount ?? 0),
                  }
                : null,
        }
    } catch (e) {
        console.error("getPurchaseRequestById failed", e)
        return null
    }
}

export async function createPurchaseRequest(data: {
    requesterId: string,
    department?: string,
    priority?: string,
    notes?: string,
    items: { productId: string, quantity: number, targetDate?: Date, notes?: string }[]
}) {
    try {
        const user = await getAuthzUser()
        const hasItems = Array.isArray(data.items) && data.items.length > 0
        if (!hasItems) {
            return { success: false, error: "PR minimal harus memiliki 1 item." }
        }

        const invalidQty = data.items.find((item) => !item.quantity || item.quantity <= 0)
        if (invalidQty) {
            return { success: false, error: "Kuantitas setiap item harus lebih dari 0." }
        }

        const created = await withPrismaAuth(async (prisma) => {
            const actor = await resolveEmployeeContext(prisma, user)
            if (!actor) {
                throw new Error("Akun belum terhubung ke employee aktif. Hubungi admin SDM.")
            }

            let requesterId = actor.id
            if (data.requesterId && data.requesterId !== actor.id && REQUESTER_OVERRIDE_ROLES.includes(user.role)) {
                const requestedEmployee = await prisma.employee.findUnique({
                    where: { id: data.requesterId },
                    select: { id: true, status: true },
                })
                if (requestedEmployee?.status === "ACTIVE") {
                    requesterId = requestedEmployee.id
                }
            }

            // withPrismaAuth already provides a transaction-scoped Prisma client.
            // Calling prisma.$transaction() here crashes because the callback client
            // is an active transaction, not the root PrismaClient instance.
            const now = new Date()
            const year = now.getFullYear()
            const month = String(now.getMonth() + 1).padStart(2, "0")
            const prefix = `PR-${year}${month}`
            const number = await getNextDocNumber(prisma, prefix, 4)

            const pr = await prisma.purchaseRequest.create({
                data: {
                    number,
                    requesterId,
                    department: data.department?.trim() || actor.department || "General",
                    priority: data.priority || "NORMAL",
                    notes: data.notes || null,
                    status: "PENDING",
                    requestDate: new Date(),
                    items: {
                        create: data.items.map((item) => ({
                            productId: item.productId,
                            quantity: Number(item.quantity || 0),
                            targetDate: item.targetDate || null,
                            notes: item.notes || null,
                            status: "PENDING",
                        })),
                    },
                },
                select: { id: true },
            })

            return pr
        })

        revalidateProcurementPaths()

        return { success: true, prId: created.id }
    } catch (e: any) {
        console.error("Failed to create PR", e)
        return { success: false, error: e.message }
    }
}

export async function approvePurchaseRequest(id: string, _approverId?: string) {
    try {
        const user = await getAuthzUser()
        assertRole(user, PR_APPROVER_ROLES)

        await withPrismaAuth(async (prisma) => {
            const actor = await resolveEmployeeContext(prisma, user)
            if (!actor) throw new Error("Akun approver belum terhubung ke employee aktif.")

            const pr = await prisma.purchaseRequest.findUnique({
                where: { id },
                include: {
                    requester: {
                        select: { id: true, department: true },
                    },
                },
            })

            if (!pr) throw new Error("Purchase request not found")

            if (pr.status !== 'PENDING') {
                throw new Error(`Tidak bisa approve PR dengan status ${pr.status}. Hanya PR dengan status PENDING yang bisa di-approve.`)
            }

            const allowed = canApproveForDepartment({
                role: user.role,
                actorDepartment: actor.department,
                actorPosition: actor.position,
                targetDepartment: pr.department || pr.requester?.department || "",
            })
            if (!allowed) {
                throw new Error("Anda hanya dapat meng-approve PR untuk departemen Anda.")
            }

            // Atomic guard: only one approval succeeds even under concurrent
            // clicks (avoid duplicate audit events / downstream triggers).
            const updateRes = await prisma.purchaseRequest.updateMany({
                where: { id, status: 'PENDING' },
                data: {
                    status: 'APPROVED',
                    approverId: actor.id,
                },
            })
            if (updateRes.count === 0) {
                throw new Error('PR sudah diproses oleh pengguna lain. Refresh halaman.')
            }
            await prisma.purchaseRequestItem.updateMany({
                where: { purchaseRequestId: id, status: 'PENDING' },
                data: { status: 'APPROVED' },
            })
        })
        revalidateProcurementPaths()

        return { success: true }
    } catch (error) {
        console.error("Error approving PR:", error)
        return { success: false, error: (error as any)?.message || "Failed to approve" }
    }
}

export async function approveAndCreatePOFromPR(id: string, _approverId?: string) {
    try {
        const approvalResult = await approvePurchaseRequest(id, _approverId)
        if (!approvalResult.success) {
            return approvalResult
        }

        const user = await getAuthzUser()
        if (!PURCHASING_ROLES.includes(user.role)) {
            // PR approved by manager but they lack purchasing role — surface
            // this clearly so a Purchasing staff member knows to create the PO
            // (otherwise the PR sits in "approved but unfulfilled" limbo).
            return {
                success: true,
                poCreated: false,
                poIds: [] as string[],
                message: "PR berhasil disetujui — staf Purchasing harus membuat PO sekarang. PR menunggu konversi ke PO.",
            }
        }

        const itemIds = await withPrismaAuth(async (prisma) => {
            await requireActiveProcurementActor(prisma, user)
            const pr = await prisma.purchaseRequest.findUnique({
                where: { id },
                include: {
                    items: {
                        where: {
                            status: { in: ["APPROVED", "PENDING"] },
                        },
                        select: { id: true },
                    },
                },
            })

            if (!pr) throw new Error("Purchase request not found")
            return pr.items.map((item) => item.id)
        })

        if (itemIds.length === 0) {
            return {
                success: true,
                poCreated: false,
                poIds: [] as string[],
                message: "PR approved. No eligible items found for PO conversion.",
            }
        }

        const poResult = await convertPRToPO(id, itemIds)
        if (!poResult.success) {
            return {
                success: false,
                poCreated: false,
                poIds: [] as string[],
                error: poResult.error || "Failed to generate PO after approval",
            }
        }

        return {
            success: true,
            poCreated: true,
            poIds: (poResult as any).poIds || [],
            message: "PR approved and PO generated",
        }
    } catch (error: any) {
        return { success: false, poCreated: false, poIds: [] as string[], error: error?.message || "Failed to run fast-lane approval" }
    }
}

export async function rejectPurchaseRequest(id: string, reason: string) {
    try {
        const user = await getAuthzUser()
        assertRole(user, PR_APPROVER_ROLES)

        await withPrismaAuth(async (prisma) => {
            const actor = await resolveEmployeeContext(prisma, user)
            if (!actor) throw new Error("Akun approver belum terhubung ke employee aktif.")

            const pr = await prisma.purchaseRequest.findUnique({
                where: { id },
                include: {
                    requester: {
                        select: { id: true, department: true },
                    },
                },
            })
            if (!pr) throw new Error("Purchase request not found")

            if (pr.status !== 'PENDING') {
                throw new Error(`Tidak bisa reject PR dengan status ${pr.status}. Hanya PR dengan status PENDING yang bisa di-reject.`)
            }

            const allowed = canApproveForDepartment({
                role: user.role,
                actorDepartment: actor.department,
                actorPosition: actor.position,
                targetDepartment: pr.department || pr.requester?.department || "",
            })
            if (!allowed) {
                throw new Error("Anda hanya dapat menolak PR untuk departemen Anda.")
            }

            await prisma.purchaseRequest.update({
                where: { id },
                data: {
                    status: 'REJECTED',
                    notes: `[DITOLAK] ${reason}${pr.notes ? `\n\n[Catatan asal] ${pr.notes}` : ''}`,
                    items: {
                        updateMany: {
                            where: { status: 'PENDING' },
                            data: { status: 'REJECTED' }
                        }
                    }
                }
            })
        })
        revalidateProcurementPaths()

        return { success: true }
    } catch (error) {
        console.error("Error rejecting PR:", error)
        return { success: false, error: (error as any)?.message || "Failed to reject" }
    }
}

// ==========================================
// PO CREATION & LIFECYCLE
// ==========================================

export async function convertPRToPO(prId: string, itemIds: string[], _creatorId?: string) {
    try {
        const user = await getAuthzUser()
        assertRole(user, PURCHASING_ROLES)

        const result = await withPrismaAuth(async (prisma) => {
            await requireActiveProcurementActor(prisma, user)
            // 1. Fetch PR Items
            const pr = await prisma.purchaseRequest.findUnique({
                where: { id: prId },
                include: {
                    items: {
                        where: { id: { in: itemIds } },
                        include: { product: { include: { supplierItems: { include: { supplier: true } } } } }
                    }
                }
            })

            if (!pr || pr.items.length === 0) throw new Error("PR Invalid or Empty")

            // Filter out items that already have POs
            const eligibleItems = pr.items.filter((item: any) => item.status !== 'PO_CREATED')
            if (eligibleItems.length === 0) {
                return { success: false, error: 'Semua item sudah dikonversi ke PO' }
            }

            // 2. Group by Supplier
            const poMap = new Map<string, { supplierId: string, items: any[] }>()

            // Find or Create "Pending Assignment" Vendor
            let pendingVendor = await prisma.supplier.findFirst({ where: { code: 'PENDING' } })
            if (!pendingVendor) {
                pendingVendor = await prisma.supplier.create({
                    data: {
                        name: "Vendor Pending Assignment",
                        code: "PENDING",
                        address: "System Placeholder",
                        contactName: "System",
                        isActive: true
                    }
                })
            }

            for (const item of eligibleItems) {
                // Try to find preferred supplier, or use Pending Vendor
                let supplierId = pendingVendor.id
                let unitPrice = 0

                const preferredSupplier = item.product.supplierItems.find(s => s.isPreferred) || item.product.supplierItems[0]

                if (preferredSupplier) {
                    supplierId = preferredSupplier.supplierId
                    unitPrice = Number(preferredSupplier.price)
                } else {
                    // Fallback to Cost Price if no vendor price
                    unitPrice = Number(item.product.costPrice) || 0
                }

                if (!poMap.has(supplierId)) {
                    poMap.set(supplierId, { supplierId, items: [] })
                }

                poMap.get(supplierId)!.items.push({
                    productId: item.productId,
                    quantity: item.quantity,
                    unitPrice: unitPrice,
                    totalPrice: unitPrice * item.quantity,
                    prItemId: item.id
                })
            }

            // 3. Create POs (already inside withPrismaAuth transaction)
            const poNow = new Date()
            const poYear = poNow.getFullYear()
            const poMonth = String(poNow.getMonth() + 1).padStart(2, '0')
            const poPrefix = `PO-${poYear}${poMonth}`

            const createdPOIds: string[] = []

            for (const [supplierId, groupData] of poMap.entries()) {
                const poNumber = await getNextDocNumber(prisma, poPrefix, 4)

                const subtotal = groupData.items.reduce((sum: number, i: any) => sum + i.totalPrice, 0)
                const taxAmount = Math.round(subtotal * TAX_RATES.PPN)
                const netAmount = subtotal + taxAmount

                const po = await prisma.purchaseOrder.create({
                    data: {
                        number: poNumber,
                        supplierId,
                        status: 'PO_DRAFT',
                        createdBy: user.id,
                        totalAmount: subtotal,
                        taxAmount,
                        netAmount,
                        items: {
                            create: groupData.items.map((i: any) => ({
                                productId: i.productId,
                                quantity: i.quantity,
                                unitPrice: i.unitPrice,
                                totalPrice: i.totalPrice,
                                // C1: traceability FK back to source PR item.
                                // Partial unique index on this column blocks
                                // double-conversion at the DB level.
                                purchaseRequestItemId: i.prItemId,
                            }))
                        },
                        purchaseRequests: { connect: { id: prId } }
                    }
                })

                await createPurchaseOrderEvent(prisma as any, {
                    purchaseOrderId: po.id,
                    status: "PO_DRAFT",
                    changedBy: user.id,
                    action: "CREATE_DRAFT",
                    metadata: { source: "SYSTEM" },
                })

                // Atomic dedupe — only flip items that aren't already PO_CREATED.
                // Two concurrent convertPRToPO calls would both create POs but
                // only one updateMany succeeds for each item; the other races
                // to update 0 rows and we detect it.
                const itemUpdated = await prisma.purchaseRequestItem.updateMany({
                    where: {
                        id: { in: groupData.items.map((i: any) => i.prItemId) },
                        status: { not: 'PO_CREATED' },
                    },
                    data: { status: 'PO_CREATED' }
                })
                if (itemUpdated.count !== groupData.items.length) {
                    throw new Error(
                        'Konversi PR→PO race detected — beberapa item PR sudah dikonversi oleh user lain. ' +
                        'Refresh halaman lalu coba lagi.'
                    )
                }

                createdPOIds.push(po.id)
            }

            // 4. Update PR Status if all items handled
            const remainingItems = await prisma.purchaseRequestItem.count({
                where: { purchaseRequestId: prId, status: { not: 'PO_CREATED' } }
            })

            if (remainingItems === 0) {
                await prisma.purchaseRequest.update({
                    where: { id: prId },
                    data: { status: 'PO_CREATED' }
                })
            }

            return { success: true, poIds: createdPOIds }
        })

        return result

    } catch (error: any) {
        console.error("Error converting PR to PO:", error)
        return { success: false, error: error.message }
    }
}

export async function submitPOForApproval(poId: string) {
    try {
        const user = await getAuthzUser()
        assertRole(user, PURCHASING_ROLES)

        await withPrismaAuth(async (prisma) => {
            await requireActiveProcurementActor(prisma, user)
            const current = await prisma.purchaseOrder.findUnique({ where: { id: poId } })
            if (!current) throw new Error("Purchase Order not found")

            assertPOTransition(current.status as any, "PENDING_APPROVAL")

            await prisma.purchaseOrder.update({
                where: { id: poId },
                data: {
                    previousStatus: current.status as any,
                    status: 'PENDING_APPROVAL',
                }
            })

            await createPurchaseOrderEvent(prisma as any, {
                purchaseOrderId: poId,
                status: "PENDING_APPROVAL",
                changedBy: user.id,
                action: "SUBMIT_APPROVAL",
                metadata: { source: "MANUAL_ENTRY" },
            })
        })

        revalidateProcurementPaths()

        return { success: true }
    } catch (error) {
        return { success: false, error: (error as any)?.message || "Submit failed" }
    }
}

export async function approvePurchaseOrder(poId: string, _approverId?: string) {
    try {
        const user = await getAuthzUser()
        assertRole(user, APPROVER_ROLES)

        const po = await withPrismaAuth(async (prisma) => {
            await requireActiveProcurementActor(prisma, user)
            const current = await prisma.purchaseOrder.findUnique({ where: { id: poId } })
            if (!current) throw new Error("Purchase Order not found")

            // SoD (Segregation of Duties): same user can't both create AND
            // approve a PO. Mirrors the GRN's pattern (override w/ reason
            // can be added later if a small SME workflow needs it).
            if ((current as any).createdBy && (current as any).createdBy === user.id) {
                throw new Error('SoD: Anda yang membuat PO ini. Minta persetujuan dari pengguna lain.')
            }

            assertPOTransition(current.status as any, "APPROVED")

            // Atomic status guard — updateMany with WHERE status = current
            // ensures two concurrent approvers can't both succeed.
            const updateRes = await prisma.purchaseOrder.updateMany({
                where: { id: poId, status: current.status },
                data: {
                    previousStatus: current.status as any,
                    status: 'APPROVED',
                    approvedBy: user.id,
                },
            })
            if (updateRes.count === 0) {
                throw new Error('PO sudah diproses oleh pengguna lain. Refresh halaman.')
            }
            const updated = await prisma.purchaseOrder.findUniqueOrThrow({
                where: { id: poId },
                include: { supplier: true, items: { include: { product: true } } }
            })

            await createPurchaseOrderEvent(prisma as any, {
                purchaseOrderId: poId,
                status: "APPROVED",
                changedBy: user.id,
                action: "APPROVE",
                metadata: { source: "MANUAL_ENTRY" },
            })

            return updated
        })

        // TRIGGER FINANCE (Bill Creation)
        await recordPendingBillFromPO(po)

        revalidateProcurementPaths()

        return { success: true }
    } catch (error) {
        console.error("Approval Error:", error)
        return { success: false, error: (error as any)?.message || "Approval failed" }
    }
}

export async function rejectPurchaseOrder(poId: string, reason: string) {
    try {
        const user = await getAuthzUser()
        assertRole(user, APPROVER_ROLES)

        await withPrismaAuth(async (prisma) => {
            await requireActiveProcurementActor(prisma, user)
            const current = await prisma.purchaseOrder.findUnique({ where: { id: poId } })
            if (!current) throw new Error("Purchase Order not found")

            assertPOTransition(current.status as any, "REJECTED")

            await prisma.purchaseOrder.update({
                where: { id: poId },
                data: {
                    previousStatus: current.status as any,
                    status: 'REJECTED',
                    rejectionReason: reason,
                }
            })

            await createPurchaseOrderEvent(prisma as any, {
                purchaseOrderId: poId,
                status: "REJECTED",
                changedBy: user.id,
                action: "REJECT",
                notes: reason,
                metadata: { source: "MANUAL_ENTRY" },
            })
        })

        revalidateProcurementPaths()

        return { success: true }
    } catch (error) {
        return { success: false, error: (error as any)?.message || "Rejection failed" }
    }
}

export async function cancelPurchaseOrder(id: string, reason: string) {
    try {
        return await withPrismaAuth(async (prisma, user) => {
            const po = await prisma.purchaseOrder.findUnique({
                where: { id },
                select: { id: true, number: true, status: true }
            })

            if (!po) throw new Error('Purchase order not found')

            // Use state machine to validate transition
            assertPOTransition(po.status as ProcurementStatus, 'CANCELLED')

            const updated = await prisma.purchaseOrder.update({
                where: { id },
                data: {
                    previousStatus: po.status as any,
                    status: 'CANCELLED',
                    notes: reason ? `[DIBATALKAN] ${reason}` : '[DIBATALKAN]',
                }
            })

            // C1: when a PO is cancelled, release the PR-item link so the
            // source PR items can be re-converted to a new PO. The partial
            // unique index on (purchaseRequestItemId) would otherwise block
            // future conversions. Read the linked PR item IDs FIRST, then
            // reset both sides.
            const cancelledPOItems = await prisma.purchaseOrderItem.findMany({
                where: { purchaseOrderId: id, purchaseRequestItemId: { not: null } },
                select: { purchaseRequestItemId: true },
            })
            const releasedPrItemIds = cancelledPOItems
                .map((it) => it.purchaseRequestItemId)
                .filter((v): v is string => Boolean(v))

            if (releasedPrItemIds.length > 0) {
                await prisma.purchaseOrderItem.updateMany({
                    where: { purchaseOrderId: id, purchaseRequestItemId: { not: null } },
                    data: { purchaseRequestItemId: null },
                })
                await prisma.purchaseRequestItem.updateMany({
                    where: { id: { in: releasedPrItemIds }, status: 'PO_CREATED' },
                    data: { status: 'PENDING' },
                })
            }

            await createPurchaseOrderEvent(prisma as any, {
                purchaseOrderId: id,
                status: "CANCELLED",
                changedBy: user.id,
                action: "CANCEL",
                notes: reason || 'PO dibatalkan',
                metadata: { source: "MANUAL_ENTRY" },
            })

            // Void any associated vendor bills (INV_IN) to keep finance clean
            const associatedBills = await (prisma as any).invoice.findMany({
                where: {
                    type: 'INV_IN',
                    OR: [{ orderId: id }, { purchaseOrderId: id }],
                    status: { notIn: ['CANCELLED', 'VOID', 'PAID'] }
                }
            })

            for (const bill of associatedBills) {
                await (prisma as any).invoice.update({
                    where: { id: bill.id },
                    data: {
                        status: 'VOID',
                        notes: `[AUTO-VOID] PO ${po.number} dibatalkan. Alasan: ${reason || '-'}`,
                    }
                })
            }

            if (associatedBills.length > 0) {
                console.log(`[Cancel PO] Voided ${associatedBills.length} vendor bill(s) for PO ${po.number}`)
            }

            return { success: true, data: updated }
        })
    } catch (error: any) {
        console.error('Cancel PO error:', error)
        return { success: false, error: error.message || 'Gagal membatalkan PO' }
    }
}

export async function markAsOrdered(poId: string) {
    try {
        const user = await getAuthzUser()
        assertRole(user, PURCHASING_ROLES)

        await withPrismaAuth(async (prisma) => {
            await requireActiveProcurementActor(prisma, user)
            const current = await prisma.purchaseOrder.findUnique({ where: { id: poId } })
            if (!current) throw new Error("Purchase Order not found")

            assertPOTransition(current.status as any, "ORDERED")

            const updateRes = await prisma.purchaseOrder.updateMany({
                where: { id: poId, status: current.status },
                data: {
                    previousStatus: current.status as any,
                    status: 'ORDERED',
                    sentToVendorAt: new Date()
                }
            })
            if (updateRes.count === 0) throw new Error('PO sudah diproses oleh pengguna lain. Refresh halaman.')

            await createPurchaseOrderEvent(prisma as any, {
                purchaseOrderId: poId,
                status: "ORDERED",
                changedBy: user.id,
                action: "MARK_ORDERED",
                metadata: { source: "MANUAL_ENTRY" },
            })
        })

        revalidateProcurementPaths()

        return { success: true }
    } catch (error) {
        return { success: false, error: (error as any)?.message || "Update failed" }
    }
}

export async function markAsVendorConfirmed(poId: string, notes?: string) {
    try {
        const user = await getAuthzUser()
        assertRole(user, PURCHASING_ROLES)

        await withPrismaAuth(async (prisma) => {
            await requireActiveProcurementActor(prisma, user)
            const current = await prisma.purchaseOrder.findUnique({ where: { id: poId } })
            if (!current) throw new Error("Purchase Order not found")

            assertPOTransition(current.status as any, "VENDOR_CONFIRMED")

            const updateRes = await prisma.purchaseOrder.updateMany({
                where: { id: poId, status: current.status },
                data: {
                    previousStatus: current.status as any,
                    status: "VENDOR_CONFIRMED",
                }
            })
            if (updateRes.count === 0) throw new Error('PO sudah diproses oleh pengguna lain. Refresh halaman.')

            await createPurchaseOrderEvent(prisma as any, {
                purchaseOrderId: poId,
                status: "VENDOR_CONFIRMED",
                changedBy: user.id,
                action: "VENDOR_CONFIRM",
                notes,
                metadata: { source: "MANUAL_ENTRY" },
            })
        })

        revalidateProcurementPaths()

        return { success: true }
    } catch (error) {
        return { success: false, error: (error as any)?.message || "Update failed" }
    }
}

export async function markAsShipped(poId: string, trackingNumber?: string) {
    try {
        const user = await getAuthzUser()
        assertRole(user, PURCHASING_ROLES)

        await withPrismaAuth(async (prisma) => {
            await requireActiveProcurementActor(prisma, user)
            const current = await prisma.purchaseOrder.findUnique({ where: { id: poId } })
            if (!current) throw new Error("Purchase Order not found")

            assertPOTransition(current.status as any, "SHIPPED")

            const updateRes = await prisma.purchaseOrder.updateMany({
                where: { id: poId, status: current.status },
                data: {
                    previousStatus: current.status as any,
                    status: "SHIPPED",
                }
            })
            if (updateRes.count === 0) throw new Error('PO sudah diproses oleh pengguna lain. Refresh halaman.')

            await createPurchaseOrderEvent(prisma as any, {
                purchaseOrderId: poId,
                status: "SHIPPED",
                changedBy: user.id,
                action: "MARK_SHIPPED",
                metadata: { source: "MANUAL_ENTRY", trackingNumber },
            })
        })

        revalidateProcurementPaths()

        return { success: true }
    } catch (error) {
        return { success: false, error: (error as any)?.message || "Update failed" }
    }
}

export async function confirmPurchaseOrder(id: string) {
    try {
        const user = await getAuthzUser()
        assertRole(user, PURCHASING_ROLES)

        await withPrismaAuth(async (prisma) => {
            await requireActiveProcurementActor(prisma, user)
            const po = await prisma.purchaseOrder.findUnique({
                where: { id },
                include: { supplier: true, items: true }
            })

            if (!po) throw new Error("Purchase Order not found")

            assertPOTransition(po.status as any, "COMPLETED")

            await prisma.purchaseOrder.update({
                where: { id },
                data: {
                    previousStatus: po.status as any,
                    status: 'COMPLETED',
                    paymentStatus: 'UNPAID'
                }
            })

            await createPurchaseOrderEvent(prisma as any, {
                purchaseOrderId: id,
                status: "COMPLETED",
                changedBy: user.id,
                action: "COMPLETE",
                metadata: { source: "SYSTEM" },
            })
        })

        // Ensure vendor bill exists (normally created at approval stage)
        // Only creates if missing — recordPendingBillFromPO has built-in duplicate check
        try {
            const po = await prisma.purchaseOrder.findUnique({
                where: { id },
                include: { supplier: true, items: { include: { product: true } } }
            })
            if (po) {
                await recordPendingBillFromPO(po)
            }
        } catch (billError) {
            console.warn("[Auto-AP] Bill check failed (PO still completed):", billError)
        }

        revalidateProcurementPaths()

        return { success: true }

    } catch (error: any) {
        console.error("Confirm PO Error:", error)
        return { success: false, error: error.message }
    }
}

// Alias for backward compatibility
export async function createPOFromPR(...args: Parameters<typeof convertPRToPO>) {
    return convertPRToPO(...args)
}

export async function getAllPurchaseOrders(filter?: POFilter) {
    try {
        await getAuthzUser()

        // Build Prisma where clause from filter dimensions. Empty/undefined
        // filter -> no constraints (returns everything, original behaviour).
        const where: Prisma.PurchaseOrderWhereInput = {}

        if (filter?.status?.length) {
            where.status = { in: filter.status as ProcurementStatus[] }
        }
        if (filter?.vendorIds?.length) {
            where.supplierId = { in: filter.vendorIds }
        }
        if (filter?.dateStart || filter?.dateEnd) {
            const orderDate: Prisma.DateTimeFilter = {}
            if (filter.dateStart) orderDate.gte = new Date(filter.dateStart)
            if (filter.dateEnd) orderDate.lte = new Date(filter.dateEnd)
            where.orderDate = orderDate
        }
        if (filter?.amountMin != null || filter?.amountMax != null) {
            const totalAmount: Prisma.DecimalFilter = {}
            if (filter.amountMin != null) totalAmount.gte = filter.amountMin
            if (filter.amountMax != null) totalAmount.lte = filter.amountMax
            where.totalAmount = totalAmount
        }
        if (filter?.paymentTerms?.length) {
            // PurchaseOrder has no paymentTerm column — filter via supplier.
            where.supplier = {
                paymentTerm: { in: filter.paymentTerms as any },
            }
        }
        if (filter?.search) {
            where.OR = [
                { number: { contains: filter.search, mode: "insensitive" } },
                { supplier: { name: { contains: filter.search, mode: "insensitive" } } },
            ]
        }

        const orders = await prisma.purchaseOrder.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                supplier: {
                    select: { name: true, email: true, phone: true }
                },
                items: {
                    select: { id: true, quantity: true }
                },
                purchaseRequests: {
                    take: 1, // Get the primary PR
                    include: {
                        requester: { select: { firstName: true, lastName: true } },
                        approver: { select: { firstName: true, lastName: true } }
                    }
                }
            }
        })

        if (!orders) return []

        return orders.map((po) => {
            const pr = po.purchaseRequests[0]
            const requesterName = pr?.requester
                ? `${pr.requester.firstName} ${pr.requester.lastName}`
                : 'System'
            const approverName = pr?.approver
                ? `${pr.approver.firstName} ${pr.approver.lastName}`
                : '-'

            return {
                id: po.revision > 0 ? `${po.number} Rev.${po.revision}` : po.number,
                dbId: po.id,
                vendorId: po.supplierId,
                vendor: po.supplier?.name || 'Unknown',
                vendorEmail: po.supplier?.email || '',
                vendorPhone: po.supplier?.phone || '',
                date: new Date(po.orderDate).toLocaleDateString('id-ID'),
                total: Number(po.netAmount),
                subtotal: Number(po.totalAmount),
                status: po.status,
                revision: po.revision,
                items: po.items?.reduce((sum, item) => sum + Number(item.quantity || 0), 0) || 0,
                eta: po.expectedDate ? new Date(po.expectedDate).toLocaleDateString('id-ID') : '-',
                requester: requesterName,
                approver: approverName
            }
        })
    } catch (error) {
        console.error("Prisma Error fetching purchase orders:", error)
        return FALLBACK_PURCHASE_ORDERS
    }
}

export async function updatePurchaseOrderVendor(poId: string, supplierId: string) {
    try {
        const user = await getAuthzUser()
        assertRole(user, PURCHASING_ROLES)

        await withPrismaAuth(async (prisma) => {
            await requireActiveProcurementActor(prisma, user)
            const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } })
            if (!supplier) throw new Error("Supplier not found")

            await prisma.purchaseOrder.update({
                where: { id: poId },
                data: {
                    supplierId: supplierId,
                    updatedAt: new Date()
                }
            })
        })

        revalidateProcurementPaths()

        return { success: true }
    } catch (error) {
        console.error("Error updating PO Vendor:", error)
        return { success: false, error: (error as any)?.message || "Update failed" }
    }
}

export async function updatePurchaseOrderTaxMode(poId: string, taxMode: "PPN" | "NON_PPN") {
    try {
        const user = await getAuthzUser()
        assertRole(user, PURCHASING_ROLES)

        await withPrismaAuth(async (prisma) => {
            await requireActiveProcurementActor(prisma, user)
            const po = await prisma.purchaseOrder.findUnique({
                where: { id: poId },
                include: {
                    items: {
                        select: { totalPrice: true }
                    }
                }
            })

            if (!po) throw new Error("Purchase Order not found")
            if (po.status !== "PO_DRAFT") throw new Error("Tax can only be changed while PO is draft")

            const subtotal = po.items.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0)
            const taxAmount = taxMode === "PPN" ? Math.round(subtotal * TAX_RATES.PPN) : 0
            const netAmount = subtotal + taxAmount

            await prisma.purchaseOrder.update({
                where: { id: poId },
                data: {
                    totalAmount: subtotal,
                    taxAmount,
                    netAmount,
                    updatedAt: new Date()
                }
            })

            await createPurchaseOrderEvent(prisma as any, {
                purchaseOrderId: poId,
                status: po.status as ProcurementStatus,
                changedBy: user.id,
                action: "UPDATE_TAX_MODE",
                metadata: {
                    source: "MANUAL_ENTRY",
                    taxMode,
                    taxRate: taxMode === "PPN" ? 11 : 0,
                },
            })
        })

        revalidateProcurementPaths()

        return { success: true }
    } catch (error) {
        return { success: false, error: (error as any)?.message || "Update failed" }
    }
}

export async function getPendingApprovalPOs() {
    try {
        await getAuthzUser()

        const pos = await prisma.purchaseOrder.findMany({
            where: { status: 'PENDING_APPROVAL' },
            include: {
                supplier: {
                    select: { name: true, email: true, phone: true, address: true }
                },
                items: {
                    include: {
                        product: {
                            select: { name: true, code: true }
                        }
                    }
                },
                purchaseRequests: {
                    take: 1,
                    include: {
                        requester: { select: { firstName: true, lastName: true } },
                        approver: { select: { firstName: true, lastName: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        })

        return pos.map(po => {
            const pr = po.purchaseRequests[0]
            const requesterName = pr?.requester
                ? `${pr.requester.firstName} ${pr.requester.lastName}`
                : 'System'
            const approverName = pr?.approver
                ? `${pr.approver.firstName} ${pr.approver.lastName}`
                : '-'

            return {
                id: po.id,
                number: po.number,
                orderDate: po.orderDate,
                supplier: {
                    name: po.supplier?.name || 'Unknown',
                    email: po.supplier?.email || '',
                    phone: po.supplier?.phone || '',
                    address: po.supplier?.address || ''
                },
                totalAmount: Number(po.totalAmount || 0),
                taxAmount: Number(po.taxAmount || 0),
                netAmount: Number(po.netAmount || 0),
                items: po.items.map(item => ({
                    id: item.id,
                    productName: item.product.name,
                    productCode: item.product.code,
                    quantity: item.quantity,
                    unitPrice: Number(item.unitPrice),
                    totalPrice: Number(item.totalPrice)
                })),
                requester: requesterName,
                approver: approverName
            }
        })
    } catch (error) {
        console.error("Error fetching pending POs:", error)
        return []
    }
}

// ==========================================
// CREATE VENDOR (re-implemented here for import compatibility)
// ==========================================

export async function createVendor(data: {
    code: string
    name: string
    contactName?: string
    contactTitle?: string
    email?: string
    phone?: string
    picPhone?: string
    officePhone?: string
    address?: string
    address2?: string
    paymentTerm?: string
    categoryIds?: string[]
    bankName?: string
    bankAccountNumber?: string
    bankAccountName?: string
    npwp?: string
}) {
    try {
        if (!data.code || !data.name) {
            return { success: false, error: "Code and Name are required" }
        }

        // Bank fields must be set as a complete triple — partial bank data
        // (only account number with no bank name) silently breaks payment
        // voucher generation later.
        const bankFieldsCount = [data.bankName, data.bankAccountNumber, data.bankAccountName]
            .filter((v) => v && v.trim().length > 0).length
        if (bankFieldsCount > 0 && bankFieldsCount < 3) {
            return {
                success: false,
                error: "Data bank harus diisi lengkap: Nama Bank, Nomor Rekening, dan Nama Pemilik Rekening (atau kosongkan ketiganya).",
            }
        }

        // NPWP must be 15 (legacy) or 16 (new NIK-based) digits when provided.
        if (data.npwp && data.npwp.trim().length > 0) {
            const npwpDigits = data.npwp.replace(/\D/g, '')
            if (npwpDigits.length !== 15 && npwpDigits.length !== 16) {
                return {
                    success: false,
                    error: "NPWP harus 15 digit (format lama) atau 16 digit (format baru NIK).",
                }
            }
            data.npwp = npwpDigits
        }

        return await withPrismaAuth(async (prisma) => {
            const existing = await prisma.supplier.findUnique({
                where: { code: data.code }
            })

            if (existing) {
                return { success: false, error: `Vendor code "${data.code}" already exists` }
            }

            const vendor = await prisma.supplier.create({
                data: {
                    code: data.code.toUpperCase(),
                    name: data.name,
                    contactName: data.contactName || null,
                    contactTitle: data.contactTitle || null,
                    email: data.email || null,
                    phone: data.phone || null,
                    picPhone: data.picPhone || null,
                    officePhone: data.officePhone || null,
                    address: data.address || null,
                    address2: data.address2 || null,
                    paymentTerm: (data.paymentTerm as import("@prisma/client").PaymentTermLegacy) || "CASH",
                    bankName: data.bankName || null,
                    bankAccountNumber: data.bankAccountNumber || null,
                    bankAccountName: data.bankAccountName || null,
                    npwp: data.npwp || null,
                    rating: 0,
                    onTimeRate: 0,
                    isActive: true,
                    categories: data.categoryIds?.length ? { connect: data.categoryIds.map(id => ({ id })) } : undefined
                }
            })

            return {
                success: true,
                message: "Vendor created successfully",
                vendor: { id: vendor.id, name: vendor.name }
            }
        })
    } catch (error: any) {
        console.error("Error creating vendor:", error)
        return { success: false, error: error.message || "Failed to create vendor" }
    }
}

// ==============================================================================
// PO Templates
// ==============================================================================

export interface POTemplate {
    templateName: string
    supplierId: string
    supplierName: string
    supplierCode: string
    itemCount: number
    lastUsed: string
    items: {
        productId: string
        productName: string
        productCode: string
        quantity: number
        unitPrice: number
    }[]
}

/**
 * Save a PO configuration as a reusable template.
 */
export async function savePOAsTemplate(
    poId: string,
    templateName: string
): Promise<{ success: boolean; error?: string }> {
    if (!templateName.trim()) {
        return { success: false, error: 'Nama template wajib diisi' }
    }

    try {
        await withPrismaAuth(async (prisma: PrismaClient) => {
            await prisma.purchaseOrder.update({
                where: { id: poId },
                data: { templateName: templateName.trim() },
            })
        })

        revalidateProcurementPaths()

        return { success: true }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal menyimpan template'
        console.error("[savePOAsTemplate] Error:", error)
        return { success: false, error: msg }
    }
}

/**
 * Get all PO templates (POs with templateName set).
 */
export async function getPOTemplates(): Promise<POTemplate[]> {
    try {
        return await withPrismaAuth(async (prisma: PrismaClient) => {
            const pos = await prisma.purchaseOrder.findMany({
                where: {
                    templateName: { not: null },
                },
                select: {
                    templateName: true,
                    supplierId: true,
                    orderDate: true,
                    supplier: { select: { name: true, code: true } },
                    items: {
                        select: {
                            productId: true,
                            quantity: true,
                            unitPrice: true,
                            product: { select: { name: true, code: true } },
                        },
                    },
                },
                orderBy: { orderDate: 'desc' },
            })

            // Deduplicate by template name (keep most recent)
            const seen = new Map<string, POTemplate>()
            for (const po of pos) {
                const name = po.templateName!
                if (seen.has(name)) continue
                seen.set(name, {
                    templateName: name,
                    supplierId: po.supplierId,
                    supplierName: po.supplier.name,
                    supplierCode: po.supplier.code,
                    itemCount: po.items.length,
                    lastUsed: po.orderDate.toISOString(),
                    items: po.items.map((i: { productId: string; product: { name: string; code: string }; quantity: number; unitPrice: unknown }) => ({
                        productId: i.productId,
                        productName: i.product.name,
                        productCode: i.product.code,
                        quantity: i.quantity,
                        unitPrice: Number(i.unitPrice),
                    })),
                })
            }

            return Array.from(seen.values())
        })
    } catch (error) {
        console.error("[getPOTemplates] Error:", error)
        return []
    }
}

/**
 * Create a new draft PO from a template.
 */
export async function createPOFromTemplate(
    templateName: string
): Promise<{ success: boolean; poId?: string; error?: string }> {
    try {
        const poId = await withPrismaAuth(async (prisma: PrismaClient) => {
            // Find the most recent PO with this template name
            const template = await prisma.purchaseOrder.findFirst({
                where: { templateName },
                orderBy: { orderDate: 'desc' },
                select: {
                    supplierId: true,
                    items: {
                        select: {
                            productId: true,
                            quantity: true,
                            unitPrice: true,
                            totalPrice: true,
                        },
                    },
                },
            })

            if (!template) throw new Error('Template tidak ditemukan')

            // Get user
            const supabase = await (await import('@/lib/supabase/server')).createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Tidak terautentikasi')

            // Generate PO number atomically
            const date = new Date()
            const year = date.getFullYear()
            const month = String(date.getMonth() + 1).padStart(2, '0')
            const poNumber = await getNextDocNumber(prisma, `PO-${year}${month}`, 4)

            const subtotal = template.items.reduce((s: number, i: { totalPrice: unknown }) => s + Number(i.totalPrice), 0)
            const taxAmount = Math.round(subtotal * TAX_RATES.PPN)
            const netAmount = subtotal + taxAmount

            const po = await prisma.purchaseOrder.create({
                data: {
                    number: poNumber,
                    supplierId: template.supplierId,
                    templateName,
                    status: 'PO_DRAFT',
                    createdBy: user.id,
                    totalAmount: subtotal,
                    taxAmount,
                    netAmount,
                    items: {
                        create: template.items.map((i: Record<string, unknown>) => ({
                            productId: i.productId as string,
                            quantity: i.quantity as number,
                            unitPrice: Number(i.unitPrice),
                            totalPrice: Number(i.totalPrice),
                        })),
                    },
                },
            })

            await createPurchaseOrderEvent(prisma as any, {
                purchaseOrderId: po.id,
                status: 'PO_DRAFT',
                changedBy: user.id,
                action: 'CREATE_FROM_TEMPLATE',
                metadata: { source: 'TEMPLATE', templateName },
            })

            return po.id
        })

        revalidateProcurementPaths()

        return { success: true, poId }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal membuat PO dari template'
        console.error("[createPOFromTemplate] Error:", error)
        return { success: false, error: msg }
    }
}

// ==============================================================================
// Landed Cost
// ==============================================================================

/**
 * Save landed cost total to a PO.
 */
export async function saveLandedCost(
    poId: string,
    landedCostTotal: number,
    allocations?: { poItemId: string; allocated: number; landedUnitCost: number }[],
): Promise<{ success: boolean; error?: string; revaluationDelta?: number }> {
    if (landedCostTotal < 0) {
        return { success: false, error: 'Landed cost tidak boleh negatif' }
    }

    try {
        // Post inventory revaluation for received stock so Inventory Asset
        // tracks the true landed cost. Without per-item allocation we can
        // only update the PO total (no revaluation possible — flag below).
        const result = await withPrismaAuth(async (prisma: PrismaClient) => {
            const po = await prisma.purchaseOrder.findUnique({
                where: { id: poId },
                select: { id: true, number: true, supplier: { select: { name: true } } },
            })
            if (!po) throw new Error('Purchase order tidak ditemukan')

            await prisma.purchaseOrder.update({
                where: { id: poId },
                data: { landedCostTotal },
            })

            let totalRevaluationDelta = 0

            if (allocations && allocations.length > 0) {
                for (const alloc of allocations) {
                    const poItem = await prisma.purchaseOrderItem.findUnique({
                        where: { id: alloc.poItemId },
                        include: { product: { select: { id: true, name: true } } },
                    })
                    if (!poItem) continue

                    const oldUnitCost = Number(poItem.unitPrice)
                    const newUnitCost = alloc.landedUnitCost
                    const receivedQty = poItem.receivedQty ?? 0

                    // Update PO item to reflect landed unit cost (qty stays, total recomputed)
                    await prisma.purchaseOrderItem.update({
                        where: { id: alloc.poItemId },
                        data: {
                            unitPrice: newUnitCost,
                            totalPrice: newUnitCost * poItem.quantity,
                        },
                    })

                    // Revaluation: only the portion already received affects
                    // Inventory Asset on the books. Items not yet received will
                    // be valued at landed cost when they're received later.
                    if (receivedQty > 0 && newUnitCost !== oldUnitCost) {
                        const delta = (newUnitCost - oldUnitCost) * receivedQty
                        totalRevaluationDelta += delta

                        const invTx = await prisma.inventoryTransaction.create({
                            data: {
                                productId: poItem.productId,
                                warehouseId: (await prisma.stockLevel.findFirst({
                                    where: { productId: poItem.productId, quantity: { gt: 0 } },
                                    select: { warehouseId: true },
                                }))?.warehouseId ?? "",
                                type: "ADJUSTMENT",
                                quantity: 0,
                                unitCost: newUnitCost,
                                totalValue: Math.abs(delta),
                                purchaseOrderId: poId,
                                notes: `Landed cost ${po.number}: ${oldUnitCost} → ${newUnitCost} × ${receivedQty} unit = ${delta >= 0 ? '+' : ''}${delta}`,
                            },
                        })

                        await postInventoryGLEntry(prisma, {
                            transactionId: invTx.id,
                            type: delta > 0 ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
                            productName: poItem.product?.name ?? poItem.productId,
                            quantity: receivedQty,
                            unitCost: newUnitCost,
                            totalValue: Math.abs(delta),
                            reference: `LANDED-${po.number}`,
                            transactionDate: invTx.createdAt,
                        })
                    }
                }
            }

            return { totalRevaluationDelta }
        })

        revalidateProcurementPaths()

        return { success: true, revaluationDelta: result.totalRevaluationDelta }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal menyimpan landed cost'
        console.error("[saveLandedCost] Error:", error)
        return { success: false, error: msg }
    }
}

/**
 * Get supplier performance metrics for scorecard.
 */
export async function getSupplierScorecard(supplierId: string): Promise<{
    supplier: {
        id: string
        name: string
        code: string
        rating: number
        onTimeRate: number
        qualityScore: number
        responsiveness: number
    }
    metrics: {
        totalPOs: number
        completedPOs: number
        avgLeadTimeDays: number
        totalSpend: number
        defectRate: number
        onTimeDeliveryPct: number
    }
} | null> {
    try {
        return await withPrismaAuth(async (prisma: PrismaClient) => {
            const supplier = await prisma.supplier.findUnique({
                where: { id: supplierId },
                select: {
                    id: true,
                    name: true,
                    code: true,
                    rating: true,
                    onTimeRate: true,
                    qualityScore: true,
                    responsiveness: true,
                },
            })

            if (!supplier) return null

            // Get PO statistics
            const [totalPOs, completedPOs, poAggregates] = await Promise.all([
                prisma.purchaseOrder.count({ where: { supplierId } }),
                prisma.purchaseOrder.count({
                    where: { supplierId, status: 'COMPLETED' },
                }),
                prisma.purchaseOrder.aggregate({
                    where: { supplierId, status: { in: ['COMPLETED', 'RECEIVED'] } },
                    _sum: { netAmount: true },
                }),
            ])

            // Calculate avg lead time from completed POs
            const completedPOsWithDates = await prisma.purchaseOrder.findMany({
                where: {
                    supplierId,
                    status: 'COMPLETED',
                    expectedDate: { not: null },
                },
                select: {
                    orderDate: true,
                    expectedDate: true,
                    updatedAt: true,
                },
                take: 50,
                orderBy: { updatedAt: 'desc' },
            })

            let totalLeadDays = 0
            let onTimeCount = 0
            for (const po of completedPOsWithDates) {
                const orderDate = po.orderDate.getTime()
                const completedDate = po.updatedAt.getTime()
                const leadDays = Math.ceil((completedDate - orderDate) / (1000 * 60 * 60 * 24))
                totalLeadDays += leadDays

                if (po.expectedDate && completedDate <= po.expectedDate.getTime()) {
                    onTimeCount++
                }
            }

            const avgLeadTimeDays = completedPOsWithDates.length > 0
                ? Math.round(totalLeadDays / completedPOsWithDates.length)
                : 0
            const onTimeDeliveryPct = completedPOsWithDates.length > 0
                ? Math.round((onTimeCount / completedPOsWithDates.length) * 100)
                : supplier.onTimeRate

            // Get defect rate from GRN items
            const grnStats = await prisma.gRNItem.aggregate({
                where: {
                    grn: {
                        purchaseOrder: { supplierId },
                    },
                },
                _sum: { quantityReceived: true, quantityRejected: true },
            })

            const totalReceived = grnStats._sum.quantityReceived || 0
            const totalRejected = grnStats._sum.quantityRejected || 0
            const defectRate = totalReceived > 0
                ? Math.round((totalRejected / totalReceived) * 10000) / 100
                : 0

            return {
                supplier: {
                    ...supplier,
                    qualityScore: Number(supplier.qualityScore ?? 0),
                    responsiveness: Number(supplier.responsiveness ?? 0),
                },
                metrics: {
                    totalPOs,
                    completedPOs,
                    avgLeadTimeDays,
                    totalSpend: Number(poAggregates._sum.netAmount ?? 0),
                    defectRate,
                    onTimeDeliveryPct,
                },
            }
        })
    } catch (error) {
        console.error("[getSupplierScorecard] Error:", error)
        return null
    }
}

// ==============================================================================
// Update Vendor
// ==============================================================================

export async function updateVendor(
    id: string,
    data: {
        name?: string
        contactName?: string
        contactTitle?: string
        email?: string
        phone?: string
        picPhone?: string
        officePhone?: string
        address?: string
        address2?: string
        paymentTerm?: string
        bankName?: string
        bankAccountNumber?: string
        bankAccountName?: string
        npwp?: string
    }
): Promise<{ success: boolean; error?: string }> {
    try {
        // NPWP validation: 15 (legacy) or 16 (new) digits if provided.
        if (data.npwp && data.npwp.trim().length > 0) {
            const npwpDigits = data.npwp.replace(/\D/g, '')
            if (npwpDigits.length !== 15 && npwpDigits.length !== 16) {
                return {
                    success: false,
                    error: "NPWP harus 15 digit (format lama) atau 16 digit (format baru NIK).",
                }
            }
            data.npwp = npwpDigits
        }
        const user = await getAuthzUser()
        assertRole(user, PURCHASING_ROLES)

        return await withPrismaAuth(async (prisma) => {
            const existing = await prisma.supplier.findUnique({
                where: { id },
                select: {
                    id: true,
                    bankName: true,
                    bankAccountNumber: true,
                    bankAccountName: true,
                },
            })
            if (!existing) {
                return { success: false, error: "Vendor tidak ditemukan" }
            }

            // Bank fields must end up as a complete triple OR all empty.
            // Compute the post-update value for each field (undefined = keep
            // existing) and validate consistency.
            const finalBankName = data.bankName !== undefined ? data.bankName : existing.bankName
            const finalBankAccNum = data.bankAccountNumber !== undefined ? data.bankAccountNumber : existing.bankAccountNumber
            const finalBankAccName = data.bankAccountName !== undefined ? data.bankAccountName : existing.bankAccountName
            const bankFieldsCount = [finalBankName, finalBankAccNum, finalBankAccName]
                .filter((v) => v && v.trim().length > 0).length
            if (bankFieldsCount > 0 && bankFieldsCount < 3) {
                return {
                    success: false,
                    error: "Data bank harus diisi lengkap: Nama Bank, Nomor Rekening, dan Nama Pemilik Rekening (atau kosongkan ketiganya).",
                }
            }

            await prisma.supplier.update({
                where: { id },
                data: {
                    name: data.name || undefined,
                    contactName: data.contactName ?? undefined,
                    contactTitle: data.contactTitle ?? undefined,
                    email: data.email ?? undefined,
                    phone: data.phone ?? undefined,
                    picPhone: data.picPhone ?? undefined,
                    officePhone: data.officePhone ?? undefined,
                    address: data.address ?? undefined,
                    address2: data.address2 ?? undefined,
                    paymentTerm: data.paymentTerm
                        ? (data.paymentTerm as import("@prisma/client").PaymentTermLegacy)
                        : undefined,
                    bankName: data.bankName ?? undefined,
                    bankAccountNumber: data.bankAccountNumber ?? undefined,
                    bankAccountName: data.bankAccountName ?? undefined,
                    npwp: data.npwp ?? undefined,
                },
            })

            return { success: true }
        })
    } catch (error: any) {
        console.error("[updateVendor] Error:", error)
        return { success: false, error: error.message || "Gagal memperbarui vendor" }
    }
}

// ==============================================================================
// Deactivate Vendor
// ==============================================================================

export async function deactivateVendor(
    id: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const user = await getAuthzUser()
        assertRole(user, PURCHASING_ROLES)

        return await withPrismaAuth(async (prisma) => {
            const vendor = await prisma.supplier.findUnique({
                where: { id },
                select: { id: true, name: true, isActive: true },
            })
            if (!vendor) {
                return { success: false, error: "Vendor tidak ditemukan" }
            }
            if (!vendor.isActive) {
                return { success: false, error: "Vendor sudah non-aktif" }
            }

            // Check for active POs (not completed, rejected, or cancelled)
            const activePOs = await prisma.purchaseOrder.count({
                where: {
                    supplierId: id,
                    status: {
                        notIn: ['COMPLETED', 'REJECTED', 'CANCELLED'] as ProcurementStatus[],
                    },
                },
            })

            if (activePOs > 0) {
                return {
                    success: false,
                    error: `Vendor "${vendor.name}" masih memiliki ${activePOs} PO aktif. Selesaikan atau batalkan PO terlebih dahulu.`,
                }
            }

            await prisma.supplier.update({
                where: { id },
                data: { isActive: false },
            })

            return { success: true }
        })
    } catch (error: any) {
        console.error("[deactivateVendor] Error:", error)
        return { success: false, error: error.message || "Gagal menonaktifkan vendor" }
    }
}

// ==============================================================================
// Direct Purchase (Pembelian Langsung)
// ==============================================================================

interface DirectPurchaseItem {
    productId: string
    quantity: number
    unitPrice: number
}

interface DirectPurchaseInput {
    supplierId: string
    warehouseId: string
    items: DirectPurchaseItem[]
    notes?: string
}

/**
 * Creates a direct purchase: PO (COMPLETED) + GRN (ACCEPTED) + Bill (DRAFT) atomically.
 * Also updates stock levels, creates inventory transactions, and posts GL journal entry.
 * Shortcut for walk-in / cash purchases that skip the PR->PO->GRN workflow.
 */
export async function createDirectPurchase(input: DirectPurchaseInput) {
    try {
        const user = await getAuthzUser()
        assertRole(user, PURCHASING_ROLES)

        if (!input.supplierId) throw new Error("Vendor wajib dipilih")
        if (!input.warehouseId) throw new Error("Gudang wajib dipilih")
        if (!input.items || input.items.length === 0) throw new Error("Minimal 1 item diperlukan")

        for (const item of input.items) {
            if (!item.productId) throw new Error("Produk wajib dipilih untuk setiap item")
            if (!item.quantity || item.quantity <= 0) throw new Error("Kuantitas harus lebih dari 0")
            if (!item.unitPrice || item.unitPrice < 0) throw new Error("Harga satuan tidak valid")
        }

        // Get employee ID for GRN receivedBy (optional — users without Employee records can still receive)
        const empRecord = await prisma.employee.findFirst({
            where: { email: user.email ?? undefined },
            select: { id: true }
        })
        const employeeId = empRecord?.id || null

        const result = await withPrismaAuth(async (prisma) => {
            const pAny = prisma as any
            const now = new Date()
            const year = now.getFullYear()
            const month = String(now.getMonth() + 1).padStart(2, '0')

            // ─── 1. Generate PO number atomically ───
            const poPrefix = `PO-${year}${month}`
            const poNumber = await getNextDocNumber(prisma, poPrefix, 4)

            // ─── 2. Calculate totals ───
            const poItems = input.items.map(item => ({
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                totalPrice: item.quantity * item.unitPrice,
            }))
            const subtotal = poItems.reduce((sum, i) => sum + i.totalPrice, 0)
            const taxAmount = Math.round(subtotal * TAX_RATES.PPN)
            const netAmount = subtotal + taxAmount

            // ─── 3. Create PO (COMPLETED) ───
            const po = await prisma.purchaseOrder.create({
                data: {
                    number: poNumber,
                    supplierId: input.supplierId,
                    status: 'COMPLETED',
                    previousStatus: 'RECEIVED',
                    createdBy: user.id,
                    orderDate: now,
                    totalAmount: subtotal,
                    taxAmount,
                    netAmount,
                    items: {
                        create: poItems.map(item => ({
                            productId: item.productId,
                            quantity: item.quantity,
                            receivedQty: item.quantity,
                            unitPrice: item.unitPrice,
                            totalPrice: item.totalPrice,
                        }))
                    }
                },
                include: { items: true }
            })

            // ─── 4. Record PO events ───
            await pAny.purchaseOrderEvent.create({
                data: {
                    purchaseOrderId: po.id,
                    status: 'COMPLETED',
                    changedBy: user.id,
                    action: 'DIRECT_PURCHASE',
                    notes: input.notes || 'Pembelian langsung — PO+GRN+Bill dibuat otomatis',
                    metadata: { source: 'DIRECT_PURCHASE' },
                }
            })

            // ─── 5. Generate GRN number atomically & create GRN (ACCEPTED) ───
            const grnPrefix = `SJM-${year}${month}`
            const grnNumber = await getNextDocNumber(pAny, grnPrefix, 4)

            const grn = await pAny.goodsReceivedNote.create({
                data: {
                    number: grnNumber,
                    purchaseOrderId: po.id,
                    warehouseId: input.warehouseId,
                    receivedById: employeeId || undefined,
                    status: 'ACCEPTED',
                    acceptedBy: employeeId || user.id,
                    acceptedAt: now,
                    notes: input.notes || 'Pembelian langsung — otomatis diterima',
                    items: {
                        create: po.items.map(poItem => ({
                            poItemId: poItem.id,
                            productId: poItem.productId,
                            quantityOrdered: poItem.quantity,
                            quantityReceived: poItem.quantity,
                            quantityAccepted: poItem.quantity,
                            quantityRejected: 0,
                            unitCost: poItem.unitPrice,
                        }))
                    }
                }
            })

            // ─── 6. Update stock levels & create inventory transactions ───
            for (const poItem of po.items) {
                // Create inventory transaction
                await prisma.inventoryTransaction.create({
                    data: {
                        productId: poItem.productId,
                        warehouseId: input.warehouseId,
                        type: 'PO_RECEIVE',
                        quantity: poItem.quantity,
                        unitCost: poItem.unitPrice,
                        totalValue: Number(poItem.unitPrice) * poItem.quantity,
                        purchaseOrderId: po.id,
                        referenceId: grnNumber,
                        performedBy: user.id,
                        notes: `Pembelian Langsung via ${poNumber}`,
                    }
                })

                // Update stock level (findFirst + create/update to avoid Prisma null-in-composite-key issue)
                const existingStock = await prisma.stockLevel.findFirst({
                    where: {
                        productId: poItem.productId,
                        warehouseId: input.warehouseId,
                        locationId: null,
                    }
                })
                if (existingStock) {
                    await prisma.stockLevel.update({
                        where: { id: existingStock.id },
                        data: {
                            quantity: { increment: poItem.quantity },
                            availableQty: { increment: poItem.quantity },
                        }
                    })
                } else {
                    await prisma.stockLevel.create({
                        data: {
                            productId: poItem.productId,
                            warehouseId: input.warehouseId,
                            quantity: poItem.quantity,
                            availableQty: poItem.quantity,
                            reservedQty: 0,
                        }
                    })
                }
            }

            // ─── 7. Create vendor bill (INV_IN, DRAFT) atomically ───
            const billPrefix = `BILL-${year}`
            const billNumber = await getNextDocNumber(prisma, billPrefix, 4)

            const bill = await prisma.invoice.create({
                data: {
                    number: billNumber,
                    type: 'INV_IN',
                    supplierId: input.supplierId,
                    purchaseOrderId: po.id,
                    orderId: po.id,
                    status: 'DRAFT',
                    issueDate: now,
                    dueDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
                    subtotal,
                    taxAmount,
                    totalAmount: netAmount,
                    balanceDue: netAmount,
                    items: {
                        create: po.items.map(poItem => ({
                            description: `Produk ${poItem.productId}`,
                            quantity: poItem.quantity,
                            unitPrice: poItem.unitPrice,
                            amount: poItem.totalPrice,
                            productId: poItem.productId,
                        }))
                    }
                }
            })

            // ─── 8. Post GL journal entry — atomic with PO/GRN/Bill creation.
            // Pass tx client (`prisma`) so it joins the same DB transaction.
            // Throw on failure → entire $transaction rolls back, no orphan
            // PO/GRN/Bill/stock without a journal entry.
            const glResult = await postJournalEntry({
                description: `Pembelian Langsung ${po.number}`,
                date: now,
                reference: po.number,
                invoiceId: bill.id,
                sourceDocumentType: 'DIRECT_PURCHASE',
                lines: [
                    {
                        accountCode: SYS_ACCOUNTS.INVENTORY_ASSET,
                        debit: netAmount,
                        credit: 0,
                        description: `Persediaan masuk — ${po.number}`,
                    },
                    {
                        accountCode: SYS_ACCOUNTS.AP,
                        debit: 0,
                        credit: netAmount,
                        description: `Hutang Usaha — ${po.number}`,
                    },
                ],
            }, prisma)
            if (!glResult?.success) {
                throw new Error(`GL posting gagal: ${(glResult as any)?.error || 'Unknown'}`)
            }

            return {
                poId: po.id,
                poNumber: po.number,
                grnId: grn.id,
                grnNumber: grn.number,
                billId: bill.id,
                billNumber: bill.number,
                totalAmount: netAmount,
            }
        })

        revalidateProcurementPaths()

        return { success: true, ...result }
    } catch (error: any) {
        console.error("[createDirectPurchase] Error:", error)
        return { success: false, error: error.message || "Gagal membuat pembelian langsung" }
    }
}

// ==========================================
// PURCHASE RETURN (Retur Pembelian)
// ==========================================

interface PurchaseReturnItemInput {
    poItemId: string
    productId: string
    quantity: number
    unitPrice: number
    reason: string
}

interface CreatePurchaseReturnInput {
    purchaseOrderId: string
    warehouseId: string
    notes?: string
    items: PurchaseReturnItemInput[]
}

export async function getReturnablePurchaseOrders() {
    await getAuthzUser()

    try {
        const orders = await (prisma as any).purchaseOrder.findMany({
            where: {
                status: {
                    in: ['RECEIVED', 'COMPLETED', 'PARTIAL_RECEIVED'] as any
                }
            },
            orderBy: { orderDate: 'desc' },
            include: {
                supplier: { select: { id: true, name: true } },
                items: {
                    include: {
                        product: { select: { id: true, name: true, code: true } }
                    }
                }
            }
        })

        return {
            success: true,
            data: orders.map((po: any) => ({
                id: po.id,
                number: po.number,
                supplierName: po.supplier?.name || "Unknown",
                supplierId: po.supplier?.id,
                orderDate: po.orderDate,
                items: po.items.map((item: any) => ({
                    id: item.id,
                    productId: item.productId,
                    productName: item.product?.name || "Unknown",
                    productCode: item.product?.code || "",
                    quantity: item.quantity,
                    receivedQty: item.receivedQty,
                    returnedQty: item.returnedQty || 0,
                    returnableQty: item.receivedQty - (item.returnedQty || 0),
                    unitPrice: Number(item.unitPrice),
                }))
            }))
        }
    } catch (error: any) {
        console.error("[getReturnablePurchaseOrders] Error:", error)
        return { success: false, error: error.message, data: [] }
    }
}

export async function createPurchaseReturn(input: CreatePurchaseReturnInput) {
    const user = await getAuthzUser()

    return withPrismaAuth(async (tx) => {
        const { purchaseOrderId, warehouseId, notes, items } = input

        if (!items || items.length === 0) {
            throw new Error("Minimal 1 item untuk retur")
        }

        // Validate PO exists and is in returnable status
        const po = await (tx as any).purchaseOrder.findUnique({
            where: { id: purchaseOrderId },
            include: {
                supplier: true,
                items: { include: { product: true } },
                invoices: { where: { type: 'INV_IN' as any }, take: 1 }
            }
        })

        if (!po) throw new Error("PO tidak ditemukan")
        if (!['RECEIVED', 'COMPLETED', 'PARTIAL_RECEIVED'].includes(po.status)) {
            throw new Error("PO belum bisa diretur — status harus RECEIVED, COMPLETED, atau PARTIAL_RECEIVED")
        }

        // Validate warehouse
        const warehouse = await (tx as any).warehouse.findUnique({ where: { id: warehouseId } })
        if (!warehouse) throw new Error("Gudang tidak ditemukan")

        // Validate quantities
        let subtotal = 0
        for (const item of items) {
            if (item.quantity <= 0) throw new Error("Jumlah retur harus lebih dari 0")
            const poItem = po.items.find((pi: any) => pi.id === item.poItemId)
            if (!poItem) throw new Error(`Item PO ${item.poItemId} tidak ditemukan`)
            const maxReturnable = poItem.receivedQty - (poItem.returnedQty || 0)
            if (item.quantity > maxReturnable) {
                throw new Error(`Jumlah retur (${item.quantity}) melebihi sisa yang bisa diretur (${maxReturnable}) untuk ${poItem.product?.name}`)
            }
            subtotal += item.quantity * item.unitPrice
        }

        const ppnAmount = Math.round(subtotal * TAX_RATES.PPN)
        const totalAmount = subtotal + ppnAmount

        // 1. Create DebitCreditNote (PURCHASE_DN — buyer issues debit note to reduce AP) atomically
        const noteNumber = await getNextDocNumber(tx, "DN", 5)

        const dcNote = await (tx as any).debitCreditNote.create({
            data: {
                number: noteNumber,
                type: 'PURCHASE_DN' as any,
                status: 'POSTED' as any,
                reasonCode: items[0].reason as any || 'RET_DEFECT',
                supplierId: po.supplierId,
                originalInvoiceId: po.invoices?.[0]?.id || null,
                originalReference: po.number,
                subtotal,
                ppnAmount,
                totalAmount,
                settledAmount: 0,
                issueDate: new Date(),
                postingDate: new Date(),
                notes: notes || `Retur pembelian dari PO ${po.number}`,
                description: `Nota Debit — Retur barang ke ${po.supplier?.name}`,
                items: {
                    create: items.map(item => ({
                        productId: item.productId,
                        description: `Retur: ${item.reason || "Barang cacat/rusak"}`,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        amount: item.quantity * item.unitPrice,
                        ppnAmount: Math.round(item.quantity * item.unitPrice * TAX_RATES.PPN),
                        totalAmount: Math.round(item.quantity * item.unitPrice * (1 + TAX_RATES.PPN)),
                    }))
                }
            }
        })

        // 2. Create InventoryTransaction RETURN_OUT for each item (stock decreases)
        for (const item of items) {
            await (tx as any).inventoryTransaction.create({
                data: {
                    productId: item.productId,
                    warehouseId,
                    type: 'RETURN_OUT' as any,
                    quantity: -item.quantity, // Negative for outbound
                    unitCost: item.unitPrice,
                    totalValue: item.quantity * item.unitPrice,
                    purchaseOrderId,
                    referenceId: dcNote.id,
                    performedBy: user.id,
                    notes: `Retur ke supplier: ${item.reason || "Barang cacat"}`,
                }
            })

            // Update stock level — atomic guard prevents negative stock and
            // requires the row to exist (silent no-op was an audit finding).
            const stockUpdated = await (tx as any).stockLevel.updateMany({
                where: {
                    productId: item.productId,
                    warehouseId,
                    locationId: null,
                    quantity: { gte: item.quantity },
                },
                data: {
                    quantity: { decrement: item.quantity },
                    availableQty: { decrement: item.quantity },
                },
            })
            if (stockUpdated.count === 0) {
                throw new Error(
                    `Stok tidak mencukupi untuk retur ${item.quantity} unit ` +
                    `produk ${item.productId} di gudang ${warehouseId}.`
                )
            }

            // Update PO item returnedQty
            await (tx as any).purchaseOrderItem.update({
                where: { id: item.poItemId },
                data: { returnedQty: { increment: item.quantity } }
            })
        }

        // 3. Post GL journal entry via canonical helper.
        // Correct accounting (mirror of original purchase):
        //   DR Hutang Usaha (AP)            totalAmount   ← release liability
        //   CR Persediaan (Inventory)        subtotal      ← reduce stock asset
        //   CR PPN Masukan (1330)            ppnAmount     ← reverse input VAT
        // (Previously: credited Inventory by totalAmount and never reversed
        //  PPN Masukan — over-credited Inventory and over-claimed VAT to tax
        //  authority. Also silently skipped if accounts missing → orphan stock.)
        await ensureSystemAccounts()
        const returnDate = new Date()
        const glLines: { accountCode: string; debit: number; credit: number; description?: string }[] = [
            { accountCode: SYS_ACCOUNTS.AP, debit: totalAmount, credit: 0, description: `Retur barang ke ${po.supplier?.name} — ${po.number}` },
            { accountCode: SYS_ACCOUNTS.INVENTORY_ASSET, debit: 0, credit: subtotal, description: `Pengurangan persediaan — retur ${po.number}` },
        ]
        if (ppnAmount > 0) {
            glLines.push({ accountCode: SYS_ACCOUNTS.PPN_MASUKAN, debit: 0, credit: ppnAmount, description: `Pembalikan PPN Masukan — retur ${po.number}` })
        }

        const glResult = await postJournalEntry({
            description: `Retur pembelian — ${po.number} → ${po.supplier?.name}`,
            date: returnDate,
            reference: noteNumber,
            sourceDocumentType: 'PURCHASE_RETURN',
            lines: glLines,
        }, tx)

        if (!glResult?.success) {
            throw new Error(`Jurnal retur gagal: ${(glResult as any)?.error || 'Unknown'}`)
        }

        // Link journal entry to DC note
        await (tx as any).debitCreditNote.update({
            where: { id: dcNote.id },
            data: { journalEntryId: (glResult as any).id ?? null }
        })

        // 4. Update invoice balance if linked
        if (po.invoices?.[0]) {
            await (tx as any).invoice.update({
                where: { id: po.invoices[0].id },
                data: { balanceDue: { decrement: totalAmount } }
            })
        }

        return {
            success: true,
            data: {
                debitNoteId: dcNote.id,
                debitNoteNumber: noteNumber,
                totalAmount,
            }
        }
    })
}

// ──────────────────────────────────────────────────────────────────
// Bulk actions — per-id transaction (partial success aware)
// ──────────────────────────────────────────────────────────────────

export type BulkPOResult = {
    succeeded: string[]
    failed: { id: string; reason: string }[]
}

/**
 * Bulk approve POs. Each id runs in its own transaction so partial
 * success works — failures are collected per-id rather than aborting
 * the whole batch. Mirrors approvePurchaseOrder() semantics (SoD,
 * status guard, event log, finance trigger).
 */
export async function bulkApprovePurchaseOrders(ids: string[]): Promise<BulkPOResult> {
    const result: BulkPOResult = { succeeded: [], failed: [] }
    if (!Array.isArray(ids) || ids.length === 0) return result

    let user: Awaited<ReturnType<typeof getAuthzUser>>
    try {
        user = await getAuthzUser()
        assertRole(user, APPROVER_ROLES)
    } catch (e) {
        const reason = e instanceof Error ? e.message : "Unauthorized"
        for (const id of ids) result.failed.push({ id, reason })
        return result
    }

    for (const id of ids) {
        try {
            const po = await withPrismaAuth(async (prismaClient) => {
                await requireActiveProcurementActor(prismaClient, user)
                const current = await prismaClient.purchaseOrder.findUnique({ where: { id } })
                if (!current) throw new Error("PO tidak ditemukan")

                if ((current as any).createdBy && (current as any).createdBy === user.id) {
                    throw new Error("SoD: Anda yang membuat PO ini. Minta persetujuan dari pengguna lain.")
                }

                if (current.status !== ProcurementStatus.PENDING_APPROVAL) {
                    throw new Error(`PO sudah ${current.status} — tidak bisa di-approve`)
                }

                assertPOTransition(current.status as any, "APPROVED")

                const updateRes = await prismaClient.purchaseOrder.updateMany({
                    where: { id, status: current.status },
                    data: {
                        previousStatus: current.status as any,
                        status: "APPROVED",
                        approvedBy: user.id,
                    },
                })
                if (updateRes.count === 0) {
                    throw new Error("PO sudah diproses oleh pengguna lain. Refresh halaman.")
                }
                const updated = await prismaClient.purchaseOrder.findUniqueOrThrow({
                    where: { id },
                    include: { supplier: true, items: { include: { product: true } } },
                })

                await createPurchaseOrderEvent(prismaClient as any, {
                    purchaseOrderId: id,
                    status: "APPROVED",
                    changedBy: user.id,
                    action: "APPROVE",
                    metadata: { source: "BULK_ACTION" },
                })

                return updated
            })

            // Trigger finance bill creation outside the transaction (mirrors single approve)
            try {
                await recordPendingBillFromPO(po)
            } catch (financeErr) {
                // Non-fatal: PO approved but bill creation failed; log.
                console.error("bulkApprove finance trigger failed for", id, financeErr)
            }

            result.succeeded.push(id)
        } catch (e: unknown) {
            const reason = e instanceof Error ? e.message : "Unknown error"
            result.failed.push({ id, reason })
        }
    }

    if (result.succeeded.length > 0) {
        revalidateProcurementPaths()
    }

    return result
}

/**
 * Bulk reject POs. Per-id transaction — same partial-success semantics
 * as bulkApprovePurchaseOrders. Mirrors rejectPurchaseOrder().
 */
export async function bulkRejectPurchaseOrders(
    ids: string[],
    reason?: string,
): Promise<BulkPOResult> {
    const result: BulkPOResult = { succeeded: [], failed: [] }
    if (!Array.isArray(ids) || ids.length === 0) return result

    const rejectionReason = reason?.trim() || "Ditolak via bulk action"

    let user: Awaited<ReturnType<typeof getAuthzUser>>
    try {
        user = await getAuthzUser()
        assertRole(user, APPROVER_ROLES)
    } catch (e) {
        const failReason = e instanceof Error ? e.message : "Unauthorized"
        for (const id of ids) result.failed.push({ id, reason: failReason })
        return result
    }

    for (const id of ids) {
        try {
            await withPrismaAuth(async (prismaClient) => {
                await requireActiveProcurementActor(prismaClient, user)
                const current = await prismaClient.purchaseOrder.findUnique({ where: { id } })
                if (!current) throw new Error("PO tidak ditemukan")

                if (current.status !== ProcurementStatus.PENDING_APPROVAL) {
                    throw new Error(`PO sudah ${current.status} — tidak bisa ditolak`)
                }

                assertPOTransition(current.status as any, "REJECTED")

                const updateRes = await prismaClient.purchaseOrder.updateMany({
                    where: { id, status: current.status },
                    data: {
                        previousStatus: current.status as any,
                        status: "REJECTED",
                        rejectionReason: rejectionReason,
                    },
                })
                if (updateRes.count === 0) {
                    throw new Error("PO sudah diproses oleh pengguna lain. Refresh halaman.")
                }

                await createPurchaseOrderEvent(prismaClient as any, {
                    purchaseOrderId: id,
                    status: "REJECTED",
                    changedBy: user.id,
                    action: "REJECT",
                    notes: rejectionReason,
                    metadata: { source: "BULK_ACTION" },
                })
            })

            result.succeeded.push(id)
        } catch (e: unknown) {
            const failReason = e instanceof Error ? e.message : "Unknown error"
            result.failed.push({ id, reason: failReason })
        }
    }

    if (result.succeeded.length > 0) {
        revalidateProcurementPaths()
    }

    return result
}

// ──────────────────────────────────────────────────────────────────
// Purchase Request — Bulk approve / reject (per-id transaction)
// ──────────────────────────────────────────────────────────────────

export type BulkPRResult = {
    succeeded: string[]
    failed: { id: string; reason: string }[]
}

/**
 * Bulk approve PRs. Each id runs in its own transaction so partial
 * success works — failures are collected per-id rather than aborting
 * the whole batch. Mirrors approvePurchaseRequest() semantics
 * (department guard, status guard, atomic update).
 */
export async function bulkApprovePurchaseRequests(ids: string[]): Promise<BulkPRResult> {
    const result: BulkPRResult = { succeeded: [], failed: [] }
    if (!Array.isArray(ids) || ids.length === 0) return result

    let user: Awaited<ReturnType<typeof getAuthzUser>>
    try {
        user = await getAuthzUser()
        assertRole(user, PR_APPROVER_ROLES)
    } catch (e) {
        const reason = e instanceof Error ? e.message : "Unauthorized"
        for (const id of ids) result.failed.push({ id, reason })
        return result
    }

    for (const id of ids) {
        try {
            await withPrismaAuth(async (prismaClient) => {
                const actor = await resolveEmployeeContext(prismaClient, user)
                if (!actor) throw new Error("Akun approver belum terhubung ke employee aktif.")

                const pr = await prismaClient.purchaseRequest.findUnique({
                    where: { id },
                    include: {
                        requester: { select: { id: true, department: true } },
                    },
                })
                if (!pr) throw new Error("PR tidak ditemukan")
                if (pr.status !== "PENDING") {
                    throw new Error(`PR sudah ${pr.status} — tidak bisa di-approve`)
                }

                const allowed = canApproveForDepartment({
                    role: user.role,
                    actorDepartment: actor.department,
                    actorPosition: actor.position,
                    targetDepartment: pr.department || pr.requester?.department || "",
                })
                if (!allowed) {
                    throw new Error("Anda hanya dapat meng-approve PR untuk departemen Anda.")
                }

                const updateRes = await prismaClient.purchaseRequest.updateMany({
                    where: { id, status: "PENDING" },
                    data: {
                        status: "APPROVED",
                        approverId: actor.id,
                    },
                })
                if (updateRes.count === 0) {
                    throw new Error("PR sudah diproses oleh pengguna lain. Refresh halaman.")
                }

                await prismaClient.purchaseRequestItem.updateMany({
                    where: { purchaseRequestId: id, status: "PENDING" },
                    data: { status: "APPROVED" },
                })
            })

            result.succeeded.push(id)
        } catch (e: unknown) {
            const reason = e instanceof Error ? e.message : "Unknown error"
            result.failed.push({ id, reason })
        }
    }

    if (result.succeeded.length > 0) {
        revalidateProcurementPaths()
    }

    return result
}

/**
 * Bulk reject PRs. Per-id transaction — same partial-success semantics
 * as bulkApprovePurchaseRequests. Mirrors rejectPurchaseRequest().
 */
export async function bulkRejectPurchaseRequests(
    ids: string[],
    reason?: string,
): Promise<BulkPRResult> {
    const result: BulkPRResult = { succeeded: [], failed: [] }
    if (!Array.isArray(ids) || ids.length === 0) return result

    const rejectionReason = reason?.trim() || "Ditolak via bulk action"

    let user: Awaited<ReturnType<typeof getAuthzUser>>
    try {
        user = await getAuthzUser()
        assertRole(user, PR_APPROVER_ROLES)
    } catch (e) {
        const failReason = e instanceof Error ? e.message : "Unauthorized"
        for (const id of ids) result.failed.push({ id, reason: failReason })
        return result
    }

    for (const id of ids) {
        try {
            await withPrismaAuth(async (prismaClient) => {
                const actor = await resolveEmployeeContext(prismaClient, user)
                if (!actor) throw new Error("Akun approver belum terhubung ke employee aktif.")

                const pr = await prismaClient.purchaseRequest.findUnique({
                    where: { id },
                    include: {
                        requester: { select: { id: true, department: true } },
                    },
                })
                if (!pr) throw new Error("PR tidak ditemukan")
                if (pr.status !== "PENDING") {
                    throw new Error(`PR sudah ${pr.status} — tidak bisa ditolak`)
                }

                const allowed = canApproveForDepartment({
                    role: user.role,
                    actorDepartment: actor.department,
                    actorPosition: actor.position,
                    targetDepartment: pr.department || pr.requester?.department || "",
                })
                if (!allowed) {
                    throw new Error("Anda hanya dapat menolak PR untuk departemen Anda.")
                }

                const updateRes = await prismaClient.purchaseRequest.updateMany({
                    where: { id, status: "PENDING" },
                    data: {
                        status: "REJECTED",
                        notes: `[DITOLAK] ${rejectionReason}${pr.notes ? `\n\n[Catatan asal] ${pr.notes}` : ""}`,
                    },
                })
                if (updateRes.count === 0) {
                    throw new Error("PR sudah diproses oleh pengguna lain. Refresh halaman.")
                }

                await prismaClient.purchaseRequestItem.updateMany({
                    where: { purchaseRequestId: id, status: "PENDING" },
                    data: { status: "REJECTED" },
                })
            })

            result.succeeded.push(id)
        } catch (e: unknown) {
            const failReason = e instanceof Error ? e.message : "Unknown error"
            result.failed.push({ id, reason: failReason })
        }
    }

    if (result.succeeded.length > 0) {
        revalidateProcurementPaths()
    }

    return result
}

// ==========================================
// BULK IMPORT PURCHASE REQUESTS (XLSX/CSV — 2 sheets)
// ==========================================
//
// Karena PR memiliki line items, template-nya 2 sheet:
//   • Sheet "PR Header" → satu baris per PR (Reference, Email Pemohon, ...)
//   • Sheet "PR Items"  → baris per item, di-match ke header via Reference
//
// Per-PR validation (partial-success aware):
//   - Reference wajib (di header DAN items)
//   - Email Pemohon wajib + harus terdaftar di Employee
//   - Departemen wajib (fallback ke department employee jika kosong)
//   - Prioritas opsional, harus salah satu dari LOW/NORMAL/MEDIUM/HIGH/URGENT
//   - Setiap PR harus punya minimal 1 item di Sheet 'PR Items'
//   - Setiap item: Kode Produk wajib + harus terdaftar, Qty > 0
//
// Strategi: satu transaction per PR — kalau item gagal, hanya PR itu yg
// di-skip; PR lain tetap berhasil (sesuai pattern bulkImportVendors).

export interface BulkImportPRRow {
    /** Identifier user-defined untuk hubungkan header dengan items. */
    reference?: string
    requesterEmail?: string
    department?: string
    priority?: string
    notes?: string
}

export interface BulkImportPRItemRow {
    /** Harus match dengan reference di BulkImportPRRow. */
    reference?: string
    productCode?: string
    quantity?: number
    notes?: string
}

export interface BulkImportPRResult {
    imported: number
    errors: { row: number; reason: string }[]
}

const VALID_PR_PRIORITIES = ["LOW", "NORMAL", "MEDIUM", "HIGH", "URGENT"] as const

export async function bulkImportPurchaseRequests(
    headerRows: BulkImportPRRow[],
    itemRows: BulkImportPRItemRow[],
): Promise<BulkImportPRResult> {
    const result: BulkImportPRResult = { imported: 0, errors: [] }

    // ── Auth (sekali untuk seluruh batch)
    try {
        await getAuthzUser()
    } catch {
        for (let i = 0; i < headerRows.length; i++) {
            result.errors.push({ row: i + 2, reason: "Tidak terautentikasi" })
        }
        return result
    }

    if (!Array.isArray(headerRows) || headerRows.length === 0) return result

    // ── Group items by reference (case-insensitive trim)
    const itemsByRef = new Map<string, BulkImportPRItemRow[]>()
    for (const item of itemRows ?? []) {
        const ref = item.reference?.trim()
        if (!ref) continue
        const key = ref.toLowerCase()
        if (!itemsByRef.has(key)) itemsByRef.set(key, [])
        itemsByRef.get(key)!.push(item)
    }

    for (let i = 0; i < headerRows.length; i++) {
        const row = headerRows[i]
        // Row index in the report (header at row 1, data starts at row 2)
        const rowNum = i + 2

        try {
            const reference = row.reference?.trim()
            if (!reference) {
                result.errors.push({ row: rowNum, reason: "Reference wajib diisi" })
                continue
            }

            // ── Requester lookup via email
            const email = row.requesterEmail?.trim().toLowerCase()
            if (!email) {
                result.errors.push({ row: rowNum, reason: "Email Pemohon wajib diisi" })
                continue
            }
            const employee = await prisma.employee.findFirst({
                where: { email },
                select: { id: true, department: true, status: true },
            })
            if (!employee) {
                result.errors.push({
                    row: rowNum,
                    reason: `Email pemohon "${row.requesterEmail}" tidak ditemukan di master karyawan`,
                })
                continue
            }
            if (employee.status !== "ACTIVE") {
                result.errors.push({
                    row: rowNum,
                    reason: `Karyawan "${row.requesterEmail}" berstatus ${employee.status} (harus ACTIVE)`,
                })
                continue
            }

            // ── Priority validation
            const priorityInput = row.priority?.toUpperCase().trim() || "NORMAL"
            if (!VALID_PR_PRIORITIES.includes(priorityInput as typeof VALID_PR_PRIORITIES[number])) {
                result.errors.push({
                    row: rowNum,
                    reason: `Prioritas "${row.priority}" tidak valid. Pilihan: ${VALID_PR_PRIORITIES.join(", ")}`,
                })
                continue
            }

            // ── Department (fallback ke department employee jika kosong)
            const department = row.department?.trim() || employee.department || "General"

            // ── Items lookup
            const itemsForPR = itemsByRef.get(reference.toLowerCase()) ?? []
            if (itemsForPR.length === 0) {
                result.errors.push({
                    row: rowNum,
                    reason: `PR "${reference}" tidak punya item di Sheet 'PR Items' (minimal 1)`,
                })
                continue
            }

            // Lookup all referenced products in one query
            const productCodes = Array.from(
                new Set(
                    itemsForPR
                        .map((it) => it.productCode?.trim().toUpperCase())
                        .filter((c): c is string => Boolean(c)),
                ),
            )
            const products = productCodes.length
                ? await prisma.product.findMany({
                      where: { code: { in: productCodes } },
                      select: { id: true, code: true },
                  })
                : []
            const productMap = new Map(products.map((p) => [p.code.toUpperCase(), p]))

            const itemsToCreate: { productId: string; quantity: number; notes: string | null; status: "PENDING" }[] = []
            let itemError: string | null = null
            for (const it of itemsForPR) {
                const code = it.productCode?.trim().toUpperCase()
                if (!code) {
                    itemError = `Item PR "${reference}": Kode Produk wajib diisi`
                    break
                }
                const product = productMap.get(code)
                if (!product) {
                    itemError = `Item PR "${reference}": Produk dengan kode "${code}" tidak ditemukan`
                    break
                }
                const qty = Number(it.quantity)
                if (!Number.isFinite(qty) || qty <= 0) {
                    itemError = `Item PR "${reference}" produk "${code}": Qty wajib > 0`
                    break
                }
                itemsToCreate.push({
                    productId: product.id,
                    quantity: Math.round(qty),
                    notes: it.notes?.trim() || null,
                    status: "PENDING",
                })
            }

            if (itemError) {
                result.errors.push({ row: rowNum, reason: itemError })
                continue
            }

            // ── Create PR + items dalam single transaction (per-PR atomicity).
            // Sequential PO/PR-style numbering via getNextDocNumber.
            await withPrismaAuth(async (tx) => {
                const now = new Date()
                const year = now.getFullYear()
                const month = String(now.getMonth() + 1).padStart(2, "0")
                const prefix = `PR-${year}${month}`
                const number = await getNextDocNumber(tx, prefix, 4)

                await tx.purchaseRequest.create({
                    data: {
                        number,
                        requesterId: employee.id,
                        department,
                        priority: priorityInput,
                        status: "PENDING",
                        notes: row.notes?.trim() || null,
                        requestDate: new Date(),
                        items: { create: itemsToCreate },
                    },
                    select: { id: true },
                })
            })

            result.imported++
        } catch (e: unknown) {
            const reason = e instanceof Error ? e.message : "Unknown error"
            result.errors.push({ row: rowNum, reason })
        }
    }

    if (result.imported > 0) {
        revalidateProcurementPaths()
    }

    return result
}

// ==========================================
// BULK IMPORT PURCHASE ORDERS (XLSX/CSV — 2 sheets)
// ==========================================
//
// Karena PO memiliki line items, template-nya 2 sheet:
//   • Sheet "PO Header" → satu baris per PO (Reference, Kode Pemasok, ...)
//   • Sheet "PO Items"  → baris per item, di-match ke header via Reference
//
// Per-PO validation (partial-success aware):
//   - Reference wajib (di header DAN items)
//   - Kode Pemasok wajib + harus terdaftar di Supplier
//   - Tanggal opsional (default = hari ini), format DD/MM/YYYY atau YYYY-MM-DD
//   - Setiap PO harus punya minimal 1 item di Sheet 'PO Items'
//   - Setiap item: Kode Produk wajib + harus terdaftar, Qty > 0, Harga Satuan > 0
//
// Strategi: satu transaction per PO — kalau item gagal, hanya PO itu yg
// di-skip; PO lain tetap berhasil (sesuai pattern bulkImportVendors/PR).
//
// PPN 11% dihitung server-side berdasarkan TAX_RATES.PPN — tidak diimport.
// Status default = PO_DRAFT. Nomor PO di-generate via getNextDocNumber.

export interface BulkImportPORow {
    /** Identifier user-defined untuk hubungkan header dengan items. */
    reference?: string
    supplierCode?: string
    /** Format DD/MM/YYYY atau YYYY-MM-DD. */
    orderDate?: string
    /** Format DD/MM/YYYY atau YYYY-MM-DD. */
    expectedDate?: string
    notes?: string
}

export interface BulkImportPOItemRow {
    /** Harus match dengan reference di BulkImportPORow. */
    reference?: string
    productCode?: string
    quantity?: number
    unitPrice?: number
    notes?: string
}

export interface BulkImportPOResult {
    imported: number
    errors: { row: number; reason: string }[]
}

/**
 * Parse a date cell into a JS Date. Accepts:
 *   - DD/MM/YYYY or DD-MM-YYYY (Indonesian format)
 *   - YYYY-MM-DD (ISO)
 *   - Excel serial number (rare; converted before reaching here, but guarded)
 * Returns null if unparseable.
 */
function parsePODate(value: string | undefined | null): Date | null {
    if (value === undefined || value === null) return null
    const trimmed = String(value).trim()
    if (!trimmed) return null
    // DD/MM/YYYY or DD-MM-YYYY
    const ddmm = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
    if (ddmm) {
        const [, d, m, y] = ddmm
        const date = new Date(Number(y), Number(m) - 1, Number(d))
        if (!isNaN(date.getTime())) return date
    }
    // ISO YYYY-MM-DD (or full ISO with time)
    const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (iso) {
        const date = new Date(trimmed)
        if (!isNaN(date.getTime())) return date
    }
    return null
}

export async function bulkImportPurchaseOrders(
    headerRows: BulkImportPORow[],
    itemRows: BulkImportPOItemRow[],
): Promise<BulkImportPOResult> {
    const result: BulkImportPOResult = { imported: 0, errors: [] }

    // ── Auth + actor (sekali untuk seluruh batch)
    let actorUser: { id: string; role: string; email?: string | null }
    try {
        const u = await getAuthzUser()
        assertRole(u, PURCHASING_ROLES)
        actorUser = u as typeof actorUser
    } catch (e: unknown) {
        const reason = e instanceof Error ? e.message : "Tidak terautentikasi"
        for (let i = 0; i < headerRows.length; i++) {
            result.errors.push({ row: i + 2, reason })
        }
        return result
    }

    if (!Array.isArray(headerRows) || headerRows.length === 0) return result

    // ── Group items by reference (case-insensitive trim)
    const itemsByRef = new Map<string, BulkImportPOItemRow[]>()
    for (const item of itemRows ?? []) {
        const ref = item.reference?.trim()
        if (!ref) continue
        const key = ref.toLowerCase()
        if (!itemsByRef.has(key)) itemsByRef.set(key, [])
        itemsByRef.get(key)!.push(item)
    }

    for (let i = 0; i < headerRows.length; i++) {
        const row = headerRows[i]
        // Row index in the report (header at row 1, data starts at row 2)
        const rowNum = i + 2

        try {
            const reference = row.reference?.trim()
            if (!reference) {
                result.errors.push({ row: rowNum, reason: "Reference wajib diisi" })
                continue
            }

            // ── Supplier lookup via code (case-insensitive — schema stores
            // codes uppercase by convention).
            const supplierCode = row.supplierCode?.trim().toUpperCase()
            if (!supplierCode) {
                result.errors.push({ row: rowNum, reason: "Kode Pemasok wajib diisi" })
                continue
            }
            const supplier = await prisma.supplier.findUnique({
                where: { code: supplierCode },
                select: { id: true, isActive: true },
            })
            if (!supplier) {
                result.errors.push({
                    row: rowNum,
                    reason: `Pemasok dengan kode "${row.supplierCode}" tidak ditemukan`,
                })
                continue
            }
            if (!supplier.isActive) {
                result.errors.push({
                    row: rowNum,
                    reason: `Pemasok "${row.supplierCode}" sedang nonaktif — aktifkan dulu sebelum import.`,
                })
                continue
            }

            // ── Dates (default orderDate = today; expectedDate optional)
            const orderDate = parsePODate(row.orderDate) ?? new Date()
            const expectedDate = parsePODate(row.expectedDate)
            if (row.expectedDate && !expectedDate) {
                result.errors.push({
                    row: rowNum,
                    reason: `Tgl Diharapkan "${row.expectedDate}" tidak valid (gunakan DD/MM/YYYY)`,
                })
                continue
            }
            if (row.orderDate && !parsePODate(row.orderDate)) {
                result.errors.push({
                    row: rowNum,
                    reason: `Tanggal Pesanan "${row.orderDate}" tidak valid (gunakan DD/MM/YYYY)`,
                })
                continue
            }

            // ── Items lookup
            const itemsForPO = itemsByRef.get(reference.toLowerCase()) ?? []
            if (itemsForPO.length === 0) {
                result.errors.push({
                    row: rowNum,
                    reason: `PO "${reference}" tidak punya item di Sheet 'PO Items' (minimal 1)`,
                })
                continue
            }

            // Lookup all referenced products in one query
            const productCodes = Array.from(
                new Set(
                    itemsForPO
                        .map((it) => it.productCode?.trim().toUpperCase())
                        .filter((c): c is string => Boolean(c)),
                ),
            )
            const products = productCodes.length
                ? await prisma.product.findMany({
                      where: { code: { in: productCodes } },
                      select: { id: true, code: true },
                  })
                : []
            const productMap = new Map(products.map((p) => [p.code.toUpperCase(), p]))

            type POItemCreate = {
                productId: string
                quantity: number
                unitPrice: number
                totalPrice: number
            }
            const itemsToCreate: POItemCreate[] = []
            let itemError: string | null = null
            let subtotal = 0

            for (const it of itemsForPO) {
                const code = it.productCode?.trim().toUpperCase()
                if (!code) {
                    itemError = `Item PO "${reference}": Kode Produk wajib diisi`
                    break
                }
                const product = productMap.get(code)
                if (!product) {
                    itemError = `Item PO "${reference}": Produk dengan kode "${code}" tidak ditemukan`
                    break
                }
                const qty = Number(it.quantity)
                if (!Number.isFinite(qty) || qty <= 0) {
                    itemError = `Item PO "${reference}" produk "${code}": Qty wajib > 0`
                    break
                }
                const price = Number(it.unitPrice)
                if (!Number.isFinite(price) || price <= 0) {
                    itemError = `Item PO "${reference}" produk "${code}": Harga Satuan wajib > 0`
                    break
                }
                const lineTotal = Math.round(qty) * price
                subtotal += lineTotal
                itemsToCreate.push({
                    productId: product.id,
                    quantity: Math.round(qty),
                    unitPrice: price,
                    totalPrice: lineTotal,
                })
            }

            if (itemError) {
                result.errors.push({ row: rowNum, reason: itemError })
                continue
            }

            // ── Create PO + items + event dalam single transaction (per-PO atomicity).
            // PPN 11% (TAX_RATES.PPN) — defaults to EXCLUSIVE tax mode (DPP + PPN).
            await withPrismaAuth(async (tx) => {
                const now = new Date()
                const year = now.getFullYear()
                const month = String(now.getMonth() + 1).padStart(2, "0")
                const prefix = `PO-${year}${month}`
                const number = await getNextDocNumber(tx, prefix, 4)

                const taxAmount = Math.round(subtotal * TAX_RATES.PPN)
                const netAmount = subtotal + taxAmount

                const created = await tx.purchaseOrder.create({
                    data: {
                        number,
                        supplierId: supplier.id,
                        orderDate,
                        expectedDate,
                        status: "PO_DRAFT",
                        createdBy: actorUser.id,
                        totalAmount: subtotal,
                        taxAmount,
                        netAmount,
                        // taxMode defaults to EXCLUSIVE per schema.
                        items: { create: itemsToCreate },
                    },
                    select: { id: true },
                })

                await createPurchaseOrderEvent(tx as any, {
                    purchaseOrderId: created.id,
                    status: "PO_DRAFT",
                    changedBy: actorUser.id,
                    action: "BULK_IMPORT",
                    notes: row.notes?.trim() || undefined,
                    metadata: { source: "XLSX_IMPORT", reference },
                })
            })

            result.imported++
        } catch (e: unknown) {
            const reason = e instanceof Error ? e.message : "Unknown error"
            result.errors.push({ row: rowNum, reason })
        }
    }

    if (result.imported > 0) {
        revalidateProcurementPaths()
    }

    return result
}
