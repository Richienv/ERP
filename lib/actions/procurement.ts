"use server"

import { withPrismaAuth, prisma } from "@/lib/db"
import { supabase } from "@/lib/supabase"
import { revalidateTag, revalidatePath, unstable_cache } from "next/cache"
import { ProcurementStatus } from "@prisma/client"
import { recordPendingBillFromPO } from "@/lib/actions/finance"
import { FALLBACK_PURCHASE_ORDERS, FALLBACK_VENDORS } from "@/lib/db-fallbacks"
import { assertRole, getAuthzUser } from "@/lib/authz"
import { assertPOTransition } from "@/lib/po-state-machine"

const revalidateTagSafe = (tag: string) => (revalidateTag as any)(tag, 'default')

const PURCHASING_ROLES = ["ROLE_PURCHASING", "ROLE_ADMIN", "ROLE_CEO", "ROLE_DIRECTOR"]
const APPROVER_ROLES = ["ROLE_CEO", "ROLE_DIRECTOR"]
const PR_APPROVER_ROLES = ["ROLE_MANAGER", "ROLE_CEO", "ROLE_DIRECTOR"]

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

async function getEmployeeIdForUserEmail(email?: string | null) {
    if (!email) return null
    return await withPrismaAuth(async (prismaClient) => {
        const employee = await (prismaClient as any).employee.findFirst({
            where: { email }
        })
        return employee?.id || null
    })
}

export const getVendors = unstable_cache(
    async () => {
        try {
            const vendors = await prisma.supplier.findMany({
                where: { isActive: true },
                orderBy: { name: 'asc' },
                include: {
                    _count: {
                        select: { purchaseOrders: true }
                    }
                }
            })

            if (!vendors) return []

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
                totalSpend: "0", // Fallback for now as calculation might be heavy
                activeOrders: v._count.purchaseOrders,
                color: "bg-zinc-500",
                logo: v.name?.substring(0, 2).toUpperCase() || "??"
            }))
        } catch (error) {
            console.error("Prisma Error fetching vendors:", error)
            return FALLBACK_VENDORS
        }
    },
    ['procurement-vendors'],
    { revalidate: 3600, tags: ['procurement', 'vendors'] }
)

// ==========================================
// DASHBOARD STATS
// ==========================================

export const getProcurementStats = unstable_cache(
    async () => {
        try {
            const now = new Date()
            const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1)
            const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
            const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)

            const activeSpendStatuses: ProcurementStatus[] = ['ORDERED', 'VENDOR_CONFIRMED', 'SHIPPED', 'RECEIVED', 'COMPLETED']

            const [
                currentMonthPOs,
                previousMonthPOs,
                pendingPOs,
                pendingPRs,
                incomingCount,
                vendors,
                recentPOs,
                recentPRsRaw,
                recentGRNsRaw,
                productsWithStock,
                poStatusRows,
                prStatusRows,
                grnStatusRows,
            ] = await Promise.all([
                prisma.purchaseOrder.findMany({
                    where: {
                        status: { in: activeSpendStatuses },
                        createdAt: {
                            gte: startOfCurrentMonth,
                            lt: startOfNextMonth,
                        }
                    },
                    select: { totalAmount: true }
                }),
                prisma.purchaseOrder.findMany({
                    where: {
                        status: { in: activeSpendStatuses },
                        createdAt: {
                            gte: startOfPreviousMonth,
                            lt: startOfCurrentMonth,
                        }
                    },
                    select: { totalAmount: true }
                }),
                prisma.purchaseOrder.count({ where: { status: 'PENDING_APPROVAL' } }),
                prisma.purchaseRequest.count({ where: { status: 'PENDING' } }),
                prisma.purchaseOrder.count({ where: { status: { in: ['ORDERED', 'VENDOR_CONFIRMED', 'SHIPPED', 'PARTIAL_RECEIVED'] } } }),
                prisma.supplier.findMany({ where: { isActive: true }, select: { rating: true, onTimeRate: true } }),
                prisma.purchaseOrder.findMany({
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                    include: {
                        supplier: { select: { name: true } }
                    }
                }),
                prisma.purchaseRequest.findMany({
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                    select: {
                        id: true,
                        number: true,
                        status: true,
                        requesterId: true,
                        createdAt: true,
                        priority: true
                    }
                }),
                prisma.goodsReceivedNote.findMany({
                    orderBy: { receivedDate: 'desc' },
                    take: 5,
                    select: {
                        id: true,
                        number: true,
                        status: true,
                        receivedDate: true,
                        purchaseOrder: { select: { number: true } },
                        warehouse: { select: { name: true } }
                    }
                }),
                prisma.product.findMany({
                    where: { isActive: true },
                    select: {
                        id: true,
                        minStock: true,
                        stockLevels: { select: { quantity: true } }
                    }
                }),
                prisma.purchaseOrder.groupBy({
                    by: ['status'],
                    _count: { _all: true }
                }),
                prisma.purchaseRequest.groupBy({
                    by: ['status'],
                    _count: { _all: true }
                }),
                prisma.goodsReceivedNote.groupBy({
                    by: ['status'],
                    _count: { _all: true }
                })
            ])

            const currentSpend = currentMonthPOs.reduce((sum, po) => sum + Number(po.totalAmount || 0), 0)
            const previousSpend = previousMonthPOs.reduce((sum, po) => sum + Number(po.totalAmount || 0), 0)
            const growth = previousSpend > 0 ? ((currentSpend - previousSpend) / previousSpend) * 100 : 0

            const avgRating = vendors.length > 0 ? vendors.reduce((sum, v) => sum + (v.rating || 0), 0) / vendors.length : 0
            const avgOnTime = vendors.length > 0 ? vendors.reduce((sum, v) => sum + (v.onTimeRate || 0), 0) / vendors.length : 0

            const urgentNeeds = productsWithStock.filter((p) => {
                const totalQty = p.stockLevels.reduce((sum, sl) => sum + sl.quantity, 0)
                return totalQty <= (p.minStock || 0)
            }).length

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
                }
            }
        }
    },
    ['procurement-stats-v2'],
    { revalidate: 180, tags: ['procurement', 'stats', 'dashboard'] }
)

// ==========================================
// PURCHASE REQUEST ACTIONS
// ==========================================

export async function getPurchaseRequests() {
    try {
        return await withPrismaAuth(async (prisma) => {
            const requests = await prisma.purchaseRequest.findMany({
                include: {
                    requester: {
                        select: { firstName: true, lastName: true, department: true }
                    },
                    items: {
                        include: {
                            product: {
                                select: { name: true, unit: true }
                            }
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            })

            return requests.map((req: any) => ({
                id: req.id,
                number: req.number,
                requester: `${req.requester?.firstName || ''} ${req.requester?.lastName || ''}`.trim(),
                department: req.department || req.requester?.department,
                status: req.status,
                priority: req.priority,
                notes: req.notes,
                date: new Date(req.createdAt),
                itemCount: req.items?.length || 0,
                items: req.items?.map((i: any) => ({
                    id: i.id,
                    productName: i.product?.name,
                    quantity: i.quantity,
                    unit: i.product?.unit,
                    status: i.status
                })) || []
            }))
        })
    } catch (error) {
        console.error("Error fetching requests:", error)
        return []
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
        const date = new Date()
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
        const number = `PR-${year}${month}-${random}`

        const { data: pr, error } = await supabase
            .from('purchase_requests')
            .insert({
                number,
                requesterId: data.requesterId,
                department: data.department || "General",
                priority: data.priority || "NORMAL",
                notes: data.notes,
                status: "PENDING",
                requestDate: new Date().toISOString()
            })
            .select()
            .single()

        if (error) throw error

        if (data.items.length > 0) {
            const { error: itemsError } = await supabase
                .from('purchase_request_items')
                .insert(data.items.map(item => ({
                    purchaseRequestId: pr.id,
                    productId: item.productId,
                    quantity: item.quantity,
                    targetDate: item.targetDate ? item.targetDate.toISOString() : null,
                    notes: item.notes,
                    status: "PENDING"
                })))

            if (itemsError) throw itemsError
        }

        revalidateTagSafe('procurement')
        revalidateTagSafe('requests')
        revalidatePath('/procurement')
        return { success: true, prId: pr.id }
    } catch (e: any) {
        console.error("Failed to create PR", e)
        return { success: false, error: e.message }
    }
}

export async function approvePurchaseRequest(id: string, _approverId?: string) {
    try {
        const user = await getAuthzUser()
        assertRole(user, PR_APPROVER_ROLES)

        const employeeId = await getEmployeeIdForUserEmail(user.email)

        await withPrismaAuth(async (prisma) => {
            await prisma.purchaseRequest.update({
                where: { id },
                data: {
                    status: 'APPROVED',
                    approverId: employeeId,
                    items: {
                        updateMany: {
                            where: { status: 'PENDING' },
                            data: { status: 'APPROVED' }
                        }
                    }
                }
            })
        })
        revalidateTagSafe('procurement')
        return { success: true }
    } catch (error) {
        console.error("Error approving PR:", error)
        return { success: false, error: (error as any)?.message || "Failed to approve" }
    }
}

export async function rejectPurchaseRequest(id: string, reason: string) {
    try {
        const user = await getAuthzUser()
        assertRole(user, PR_APPROVER_ROLES)

        await withPrismaAuth(async (prisma) => {
            await prisma.purchaseRequest.update({
                where: { id },
                data: {
                    status: 'REJECTED',
                    notes: reason,
                    items: {
                        updateMany: {
                            where: { status: 'PENDING' },
                            data: { status: 'REJECTED' }
                        }
                    }
                }
            })
        })
        revalidateTagSafe('procurement')
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

        return await withPrismaAuth(async (prisma) => {
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

            for (const item of pr.items) {
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

            const createdPOs = []

            // 3. Create POs
            for (const [supplierId, data] of poMap.entries()) {
                const date = new Date()
                const year = date.getFullYear()
                const month = String(date.getMonth() + 1).padStart(2, '0')
                const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
                // Format: PO-YYYYMM-XXXX-SID
                const poNumber = `PO-${year}${month}${random}-${supplierId.substring(0, 4)}`

                const subtotal = data.items.reduce((sum: number, i: any) => sum + i.totalPrice, 0)
                const taxAmount = subtotal * 0.11
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
                            create: data.items.map((i: any) => ({
                                productId: i.productId,
                                quantity: i.quantity,
                                unitPrice: i.unitPrice,
                                totalPrice: i.totalPrice
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

                await prisma.purchaseRequestItem.updateMany({
                    where: { id: { in: data.items.map((i: any) => i.prItemId) } },
                    data: { status: 'PO_CREATED' }
                })

                createdPOs.push(po.id)
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

            return { success: true, poIds: createdPOs }
        })

        revalidateTagSafe('procurement')
        revalidateTagSafe('purchase-orders')
        revalidateTagSafe('receiving')
        revalidatePath('/procurement')
        return { success: true, poIds: [] }

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

        revalidateTagSafe('purchase-orders')
        revalidatePath('/procurement')
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
            const current = await prisma.purchaseOrder.findUnique({ where: { id: poId } })
            if (!current) throw new Error("Purchase Order not found")

            assertPOTransition(current.status as any, "APPROVED")

            const updated = await prisma.purchaseOrder.update({
                where: { id: poId },
                data: {
                    previousStatus: current.status as any,
                    status: 'APPROVED',
                    approvedBy: user.id,
                },
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

        revalidatePath('/procurement')
        revalidatePath('/dashboard')
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

        revalidatePath('/procurement')
        revalidatePath('/dashboard')
        return { success: true }
    } catch (error) {
        return { success: false, error: (error as any)?.message || "Rejection failed" }
    }
}

export async function markAsOrdered(poId: string) {
    try {
        const user = await getAuthzUser()
        assertRole(user, PURCHASING_ROLES)

        await withPrismaAuth(async (prisma) => {
            await prisma.$transaction(async (tx) => {
                const current = await tx.purchaseOrder.findUnique({ where: { id: poId } })
                if (!current) throw new Error("Purchase Order not found")

                assertPOTransition(current.status as any, "ORDERED")

                await tx.purchaseOrder.update({
                    where: { id: poId },
                    data: {
                        previousStatus: current.status as any,
                        status: 'ORDERED',
                        sentToVendorAt: new Date()
                    }
                })

                await createPurchaseOrderEvent(tx as any, {
                    purchaseOrderId: poId,
                    status: "ORDERED",
                    changedBy: user.id,
                    action: "MARK_ORDERED",
                    metadata: { source: "MANUAL_ENTRY" },
                })
            })
        })

        revalidatePath('/procurement')
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
            await prisma.$transaction(async (tx) => {
                const current = await tx.purchaseOrder.findUnique({ where: { id: poId } })
                if (!current) throw new Error("Purchase Order not found")

                assertPOTransition(current.status as any, "VENDOR_CONFIRMED")

                await tx.purchaseOrder.update({
                    where: { id: poId },
                    data: {
                        previousStatus: current.status as any,
                        status: "VENDOR_CONFIRMED",
                    }
                })

                await createPurchaseOrderEvent(tx as any, {
                    purchaseOrderId: poId,
                    status: "VENDOR_CONFIRMED",
                    changedBy: user.id,
                    action: "VENDOR_CONFIRM",
                    notes,
                    metadata: { source: "MANUAL_ENTRY" },
                })
            })
        })

        revalidateTagSafe('purchase-orders')
        revalidatePath('/procurement')
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
            await prisma.$transaction(async (tx) => {
                const current = await tx.purchaseOrder.findUnique({ where: { id: poId } })
                if (!current) throw new Error("Purchase Order not found")

                assertPOTransition(current.status as any, "SHIPPED")

                await tx.purchaseOrder.update({
                    where: { id: poId },
                    data: {
                        previousStatus: current.status as any,
                        status: "SHIPPED",
                    }
                })

                await createPurchaseOrderEvent(tx as any, {
                    purchaseOrderId: poId,
                    status: "SHIPPED",
                    changedBy: user.id,
                    action: "MARK_SHIPPED",
                    metadata: { source: "MANUAL_ENTRY", trackingNumber },
                })
            })
        })

        revalidateTagSafe('purchase-orders')
        revalidatePath('/procurement')
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
            await prisma.$transaction(async (tx) => {
                const po = await tx.purchaseOrder.findUnique({
                    where: { id },
                    include: { supplier: true, items: true }
                })

                if (!po) throw new Error("Purchase Order not found")

                assertPOTransition(po.status as any, "COMPLETED")

                await tx.purchaseOrder.update({
                    where: { id },
                    data: {
                        previousStatus: po.status as any,
                        status: 'COMPLETED',
                        paymentStatus: 'UNPAID'
                    }
                })

                await createPurchaseOrderEvent(tx as any, {
                    purchaseOrderId: id,
                    status: "COMPLETED",
                    changedBy: user.id,
                    action: "COMPLETE",
                    metadata: { source: "SYSTEM" },
                })
            })
        })

        revalidateTagSafe('procurement')
        return { success: true }

    } catch (error: any) {
        console.error("Confirm PO Error:", error)
        return { success: false, error: error.message }
    }
}

// Alias for backward compatibility
export const createPOFromPR = convertPRToPO

export async function getAllPurchaseOrders() {
    try {
        const orders = await prisma.purchaseOrder.findMany({
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
                id: po.number,
                dbId: po.id,
                vendor: po.supplier?.name || 'Unknown',
                vendorEmail: po.supplier?.email || '',
                vendorPhone: po.supplier?.phone || '',
                date: new Date(po.orderDate).toLocaleDateString('id-ID'),
                total: Number(po.totalAmount),
                status: po.status,
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

        revalidatePath('/procurement/orders')
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
            const taxAmount = taxMode === "PPN" ? subtotal * 0.11 : 0
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

        revalidateTagSafe('purchase-orders')
        revalidateTagSafe('procurement')
        revalidatePath('/procurement/orders')
        revalidatePath('/procurement')
        return { success: true }
    } catch (error) {
        return { success: false, error: (error as any)?.message || "Update failed" }
    }
}

export async function getPendingApprovalPOs() {
    try {
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
