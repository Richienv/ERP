"use server"

import { prisma } from "@/lib/db"
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
    const employee = await (prisma as any).employee.findFirst({
        where: { email }
    })
    return employee?.id || null
}

export const getVendors = unstable_cache(
    async () => {
        try {
            const { data: vendors, error } = await supabase
                .from('suppliers')
                .select('*, purchase_orders(count)')
                .eq('isActive', true)
                .order('name', { ascending: true })

            if (error) {
                console.error("Supabase Error fetching vendors:", error)
                return FALLBACK_VENDORS
            }

            if (!vendors) return []

            return vendors.map((v: any) => ({
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
                totalSpend: "0",
                activeOrders: v.purchase_orders?.[0]?.count || 0,
                color: "bg-zinc-500",
                logo: v.name?.substring(0, 2).toUpperCase() || "??"
            }))
        } catch (error) {
            console.error("Error fetching vendors:", error)
            return FALLBACK_VENDORS
        }
    },
    ['vendors-list-procurement'],
    { revalidate: 300, tags: ['procurement', 'vendors'] }
)

// ==========================================
// DASHBOARD STATS
// ==========================================

export const getProcurementStats = unstable_cache(
    async () => {
        try {
            const now = new Date()
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
            const startOfMonthIso = startOfMonth.toISOString()

            // Active Statuses for Spend Calculation (Ordered/Received)
            const activeStatuses: ProcurementStatus[] = ['ORDERED', 'VENDOR_CONFIRMED', 'SHIPPED', 'RECEIVED', 'COMPLETED']

            // Parallel queries using Supabase
            const [
                spendResult,
                pendingPOsResult,
                pendingPRsResult,
                incomingResult,
                vendorsResult,
                recentActivityResult
            ] = await Promise.all([
                // 1. Current Month Spend (Fetch totalAmount)
                supabase.from('purchase_orders')
                    .select('totalAmount')
                    .in('status', activeStatuses)
                    .gte('createdAt', startOfMonthIso),
                
                // 2. Pending POs Count
                supabase.from('purchase_orders')
                    .select('id', { count: 'exact', head: true })
                    .eq('status', 'PENDING_APPROVAL'),

                // 3. Pending PRs Count
                supabase.from('purchase_requests')
                    .select('id', { count: 'exact', head: true })
                    .eq('status', 'PENDING'),

                // 4. Incoming Count
                supabase.from('purchase_orders')
                    .select('id', { count: 'exact', head: true })
                    .in('status', ['ORDERED', 'VENDOR_CONFIRMED', 'SHIPPED']),

                // 5. Vendors (for Health stats)
                supabase.from('suppliers')
                    .select('rating, onTimeRate'),

                // 6. Recent Activity
                supabase.from('purchase_orders')
                    .select('*, supplier:suppliers(name)')
                    .order('createdAt', { ascending: false })
                    .limit(5)
            ])

            // Calculations
            const currentSpend = spendResult.data?.reduce((sum, po: any) => sum + (Number(po.totalAmount) || 0), 0) || 0
            const pendingPOs = pendingPOsResult.count || 0
            const pendingPRs = pendingPRsResult.count || 0
            const incomingCount = incomingResult.count || 0
            
            const vendors = vendorsResult.data || []
            const avgRating = vendors.length > 0 ? vendors.reduce((sum, v) => sum + (v.rating || 0), 0) / vendors.length : 0
            const avgOnTime = vendors.length > 0 ? vendors.reduce((sum, v) => sum + (v.onTimeRate || 0), 0) / vendors.length : 0

            return {
                spend: { current: currentSpend, growth: 0 },
                needsApproval: pendingPOs + pendingPRs,
                urgentNeeds: 0,
                vendorHealth: { rating: avgRating, onTime: avgOnTime },
                incomingCount,
                recentActivity: recentActivityResult.data || []
            }

        } catch (error) {
            console.error("Error fetching procurement stats:", error)
            return { spend: { current: 0, growth: 0 }, needsApproval: 0, urgentNeeds: 0, vendorHealth: { rating: 0, onTime: 0 }, incomingCount: 0, recentActivity: [] }
        }
    },
    ['procurement-stats'],
    { revalidate: 180, tags: ['procurement', 'stats', 'dashboard'] }
)

// ==========================================
// PURCHASE REQUEST ACTIONS
// ==========================================

export const getPurchaseRequests = unstable_cache(
    async () => {
        try {
            const { data: requests, error } = await supabase
                .from('purchase_requests')
                .select(`
                    *,
                    requester:employees!requesterId(firstName, lastName, department),
                    items:purchase_request_items(
                        id, quantity, status,
                        product:products(name, unit)
                    )
                `)
                .order('createdAt', { ascending: false })

            if (error) {
                console.error("Supabase Error fetching requests:", error)
                return []
            }

            if (!requests) return []

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

        } catch (error) {
            console.error("Error fetching requests:", error)
            return []
        }
    },
    ['procurement-requests'],
    { revalidate: 300, tags: ['procurement', 'requests'] }
)

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

        // 2. Group by Supplier (Preferred or First available)
        const poMap = new Map<string, { supplierId: string, items: any[] }>()

        for (const item of pr.items) {
            const preferredSupplier = item.product.supplierItems.find(s => s.isPreferred) || item.product.supplierItems[0]

            // If no supplier, we might need a fallback default supplier logic or skip
            if (!preferredSupplier) {
                console.warn(`No supplier found for product ${item.product.name}`)
                continue
            }

            const supplierId = preferredSupplier.supplierId
            if (!poMap.has(supplierId)) {
                poMap.set(supplierId, { supplierId, items: [] })
            }

            poMap.get(supplierId)!.items.push({
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: preferredSupplier.price,
                totalPrice: Number(preferredSupplier.price) * item.quantity,
                prItemId: item.id
            })
        }

        const createdPOs = []

        // 3. Create POs
        for (const [supplierId, data] of poMap.entries()) {
            const time = new Date().getTime()
            const poNumber = `PO-${time}-${supplierId.substring(0, 4)}` // Simplified Unique Number

            const totalAmount = data.items.reduce((sum: number, i: any) => sum + i.totalPrice, 0)

            const po = await prisma.purchaseOrder.create({
                data: {
                    number: poNumber,
                    supplierId,
                    status: 'PO_DRAFT',
                    createdBy: user.id,
                    totalAmount,
                    // Link Items
                    items: {
                        create: data.items.map((i: any) => ({
                            productId: i.productId,
                            quantity: i.quantity,
                            unitPrice: i.unitPrice,
                            totalPrice: i.totalPrice
                        }))
                    },
                    // Link PR
                    purchaseRequests: {
                        connect: { id: prId }
                    }
                }
            })

            await createPurchaseOrderEvent(prisma as any, {
                purchaseOrderId: po.id,
                status: "PO_DRAFT",
                changedBy: user.id,
                action: "CREATE_DRAFT",
                metadata: { source: "SYSTEM" },
            })

            // Update PR Items
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
                data: { status: 'PO_CREATED' } // Using PO_CREATED as "Converted"
            })
        }

        revalidateTagSafe('procurement')
        revalidateTagSafe('purchase-orders')
        revalidateTagSafe('receiving')
        revalidatePath('/procurement')
        return { success: true, poIds: createdPOs }

    } catch (error: any) {
        console.error("Error converting PR to PO:", error)
        return { success: false, error: error.message }
    }
}

export async function submitPOForApproval(poId: string) {
    try {
        const user = await getAuthzUser()
        assertRole(user, PURCHASING_ROLES)

        await prisma.$transaction(async (tx) => {
            const current = await tx.purchaseOrder.findUnique({ where: { id: poId } })
            if (!current) throw new Error("Purchase Order not found")

            assertPOTransition(current.status as any, "PENDING_APPROVAL")

            await tx.purchaseOrder.update({
                where: { id: poId },
                data: {
                    previousStatus: current.status as any,
                    status: 'PENDING_APPROVAL',
                }
            })

            await createPurchaseOrderEvent(tx as any, {
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

        const po = await prisma.$transaction(async (tx) => {
            const current = await tx.purchaseOrder.findUnique({ where: { id: poId } })
            if (!current) throw new Error("Purchase Order not found")

            assertPOTransition(current.status as any, "APPROVED")

            const updated = await tx.purchaseOrder.update({
                where: { id: poId },
                data: {
                    previousStatus: current.status as any,
                    status: 'APPROVED',
                    approvedBy: user.id,
                },
                include: { supplier: true, items: { include: { product: true } } }
            })

            await createPurchaseOrderEvent(tx as any, {
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

        await prisma.$transaction(async (tx) => {
            const current = await tx.purchaseOrder.findUnique({ where: { id: poId } })
            if (!current) throw new Error("Purchase Order not found")

            assertPOTransition(current.status as any, "REJECTED")

            await tx.purchaseOrder.update({
                where: { id: poId },
                data: {
                    previousStatus: current.status as any,
                    status: 'REJECTED',
                    rejectionReason: reason,
                }
            })

            await createPurchaseOrderEvent(tx as any, {
                purchaseOrderId: poId,
                status: "REJECTED",
                changedBy: user.id,
                action: "REJECT",
                notes: reason,
                metadata: { source: "MANUAL_ENTRY" },
            })
        })

        revalidatePath('/procurement')
        return { success: true }
    } catch (error) {
        return { success: false, error: (error as any)?.message || "Rejection failed" }
    }
}

export async function markAsOrdered(poId: string) {
    try {
        const user = await getAuthzUser()
        assertRole(user, PURCHASING_ROLES)

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

        revalidateTagSafe('purchase-orders')
        revalidatePath('/procurement')
        return { success: true }
    } catch (error) {
        return { success: false, error: (error as any)?.message || "Update failed" }
    }
}

export async function confirmPurchaseOrder(id: string) {
    // Legacy mapping: COMPLETED means Received & Closed.
    // In new lifecycle, it probably goes ORDERED -> RECEIVED -> COMPLETED
    try {
        const user = await getAuthzUser()
        assertRole(user, PURCHASING_ROLES)

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

        // Note: Finance Bill was likely created on Approval. 
        // We might trigger Receipt Journal here (Accrual).
        // For now, simplify.

        revalidateTagSafe('procurement')
        return { success: true }

    } catch (error: any) {
        console.error("Confirm PO Error:", error)
        return { success: false, error: error.message }
    }
}

// Alias for backward compatibility
export const createPOFromPR = convertPRToPO

export const getAllPurchaseOrders = unstable_cache(
    async () => {
        try {
            const { data: orders, error } = await supabase
                .from('purchase_orders')
                .select(`
                    *,
                    supplier:suppliers(name),
                    items:purchase_order_items(id)
                `)
                .order('createdAt', { ascending: false })

            if (error) {
                console.error("Supabase Error fetching purchase orders:", error)
                return FALLBACK_PURCHASE_ORDERS
            }

            if (!orders) return []

            return orders.map((po: any) => ({
                id: po.number,
                dbId: po.id,
                vendor: po.supplier?.name || 'Unknown',
                date: new Date(po.orderDate).toLocaleDateString('id-ID'),
                total: Number(po.totalAmount),
                status: po.status,
                items: po.items?.length || 0,
                eta: po.expectedDate ? new Date(po.expectedDate).toLocaleDateString('id-ID') : '-'
            }))
        } catch (error) {
            console.error("Error fetching purchase orders:", error)
            return FALLBACK_PURCHASE_ORDERS
        }
    },
    ['purchase-orders-list'],
    { revalidate: 300, tags: ['procurement', 'purchase-orders'] }
)
