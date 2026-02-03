"use server"

import { prisma, safeQuery, withRetry } from "@/lib/db"
import { revalidateTag, revalidatePath, unstable_cache } from "next/cache"
import { ProcurementStatus, PRStatus, PRItemStatus } from "@prisma/client"
import { recordPendingBillFromPO } from "@/lib/actions/finance"
import { FALLBACK_PURCHASE_ORDERS, FALLBACK_VENDORS } from "@/lib/db-fallbacks"

const revalidateTagSafe = (tag: string) => (revalidateTag as any)(tag, 'default')

// ==========================================
// DASHBOARD STATS
// ==========================================

export const getProcurementStats = unstable_cache(
    async () => {
        try {
            const now = new Date()
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

            // Active Statuses for Spend Calculation (Ordered/Received)
            const activeStatuses: ProcurementStatus[] = ['ORDERED', 'VENDOR_CONFIRMED', 'SHIPPED', 'RECEIVED', 'COMPLETED']

            // Enterprise: Parallel queries for better performance
            const [
                currentMonthSpend,
                pendingPOs,
                pendingPRs,
                incomingCount,
                vendors,
                recentActivity
            ] = await Promise.all([
                prisma.purchaseOrder.aggregate({
                    _sum: { totalAmount: true },
                    where: {
                        status: { in: activeStatuses },
                        createdAt: { gte: startOfMonth }
                    }
                }),
                prisma.purchaseOrder.count({ where: { status: 'PENDING_APPROVAL' } }),
                prisma.purchaseRequest.count({ where: { status: 'PENDING' } }),
                prisma.purchaseOrder.count({
                    where: { status: { in: ['ORDERED', 'VENDOR_CONFIRMED', 'SHIPPED'] } }
                }),
                prisma.supplier.findMany({ select: { rating: true, onTimeRate: true } }),
                prisma.purchaseOrder.findMany({
                    take: 5,
                    orderBy: { createdAt: "desc" },
                    include: { supplier: { select: { name: true } } }
                })
            ])

            const currentSpend = Number(currentMonthSpend._sum.totalAmount || 0)
            const avgRating = vendors.length > 0 ? vendors.reduce((sum, v) => sum + v.rating, 0) / vendors.length : 0
            const avgOnTime = vendors.length > 0 ? vendors.reduce((sum, v) => sum + v.onTimeRate, 0) / vendors.length : 0

            return {
                spend: { current: currentSpend, growth: 0 },
                needsApproval: pendingPOs + pendingPRs,
                urgentNeeds: 0,
                vendorHealth: { rating: avgRating, onTime: avgOnTime },
                incomingCount,
                recentActivity
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
            const requests = await prisma.purchaseRequest.findMany({
                orderBy: { createdAt: 'desc' },
                include: {
                    requester: true,
                    items: {
                        include: { product: true }
                    }
                }
            })

            return requests.map(req => ({
                id: req.id,
                number: req.number,
                requester: `${req.requester.firstName} ${req.requester.lastName || ''}`.trim(),
                department: req.department || req.requester.department,
                status: req.status, // PRStatus
                priority: req.priority,
                notes: req.notes,
                date: req.createdAt,
                itemCount: req.items.length,
                items: req.items.map(i => ({
                    id: i.id,
                    productName: i.product.name,
                    quantity: i.quantity,
                    unit: i.product.unit,
                    status: i.status
                }))
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

        const pr = await prisma.purchaseRequest.create({
            data: {
                number,
                requesterId: data.requesterId,
                department: data.department || "General",
                priority: data.priority || "NORMAL",
                notes: data.notes,
                status: "PENDING",
                items: {
                    create: data.items.map(item => ({
                        productId: item.productId,
                        quantity: item.quantity,
                        targetDate: item.targetDate,
                        notes: item.notes,
                        status: "PENDING"
                    }))
                }
            }
        })

        revalidateTagSafe('procurement')
        revalidateTagSafe('requests')
        revalidatePath('/procurement')
        return { success: true, prId: pr.id }
    } catch (e: any) {
        console.error("Failed to create PR", e)
        return { success: false, error: e.message }
    }
}

export async function approvePurchaseRequest(id: string, approverId: string) {
    try {
        await prisma.purchaseRequest.update({
            where: { id },
            data: {
                status: 'APPROVED',
                approverId,
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
        return { success: false, error: "Failed to approve" }
    }
}

export async function rejectPurchaseRequest(id: string, reason: string) {
    try {
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
        return { success: false, error: "Failed to reject" }
    }
}

// ==========================================
// PO CREATION & LIFECYCLE
// ==========================================

export async function convertPRToPO(prId: string, itemIds: string[], creatorId: string) {
    try {
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
                    createdBy: creatorId,
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
        await prisma.purchaseOrder.update({
            where: { id: poId },
            data: { status: 'PENDING_APPROVAL' }
        })
        revalidateTagSafe('purchase-orders')
        revalidatePath('/procurement')
        return { success: true }
    } catch (error) {
        return { success: false, error: "Submit failed" }
    }
}

export async function approvePurchaseOrder(poId: string, approverId: string) {
    try {
        const po = await prisma.purchaseOrder.update({
            where: { id: poId },
            data: {
                status: 'APPROVED',
                approvedBy: approverId
            },
            include: { supplier: true, items: { include: { product: true } } }
        })

        // TRIGGER FINANCE (Bill Creation)
        await recordPendingBillFromPO(po)

        revalidatePath('/procurement')
        return { success: true }
    } catch (error) {
        console.error("Approval Error:", error)
        return { success: false, error: "Approval failed" }
    }
}

export async function rejectPurchaseOrder(poId: string, reason: string) {
    try {
        await prisma.purchaseOrder.update({
            where: { id: poId },
            data: {
                status: 'REJECTED',
                rejectionReason: reason
            }
        })
        revalidatePath('/procurement')
        return { success: true }
    } catch (error) {
        return { success: false, error: "Rejection failed" }
    }
}

export async function markAsOrdered(poId: string) {
    try {
        await prisma.purchaseOrder.update({
            where: { id: poId },
            data: {
                status: 'ORDERED',
                sentToVendorAt: new Date()
            }
        })
        revalidatePath('/procurement')
        return { success: true }
    } catch (error) {
        return { success: false, error: "Update failed" }
    }
}

export async function confirmPurchaseOrder(id: string) {
    // Legacy mapping: COMPLETED means Received & Closed.
    // In new lifecycle, it probably goes ORDERED -> RECEIVED -> COMPLETED
    try {
        const po = await prisma.purchaseOrder.findUnique({
            where: { id },
            include: { supplier: true, items: true }
        })

        if (!po) throw new Error("Purchase Order not found")

        await prisma.purchaseOrder.update({
            where: { id },
            data: {
                status: 'COMPLETED', // Or RECEIVED
                paymentStatus: 'UNPAID' // Ready for payment logic if needed
            }
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

// ==========================================
// VENDOR ACTIONS
// ==========================================

export const getVendors = unstable_cache(
    async () => {
        const { data: vendors } = await safeQuery(
            () => withRetry(() => prisma.supplier.findMany({
                orderBy: { name: 'asc' },
                include: {
                    _count: {
                        select: { purchaseOrders: true }
                    }
                }
            })),
            FALLBACK_VENDORS
        )

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
            activeOrders: v._count?.purchaseOrders || 0,
            color: "bg-zinc-500",
            logo: v.name?.substring(0, 2).toUpperCase() || "??"
        }))
    },
    ['vendors-list'],
    { revalidate: 300, tags: ['procurement', 'vendors'] }
)

export async function createVendor(data: {
    name: string,
    code: string,
    contactName?: string,
    email?: string,
    phone?: string,
    address?: string
}) {
    try {
        await prisma.supplier.create({
            data: { ...data, rating: 0, onTimeRate: 100 }
        })
        revalidateTagSafe('vendors')
        return { success: true }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

// Alias for backward compatibility
export const createPOFromPR = convertPRToPO

export const getAllPurchaseOrders = unstable_cache(
    async () => {
        const { data: orders } = await safeQuery(
            () => withRetry(() => prisma.purchaseOrder.findMany({
                orderBy: { createdAt: 'desc' },
                include: {
                    supplier: true,
                    items: true
                }
            })),
            FALLBACK_PURCHASE_ORDERS
        )

        return orders.map((po: any) => ({
            id: po.number,
            dbId: po.id,
            vendor: po.supplier.name,
            date: po.orderDate.toLocaleDateString('id-ID'),
            total: Number(po.totalAmount),
            status: po.status,
            items: po.items.length,
            eta: po.expectedDate ? po.expectedDate.toLocaleDateString('id-ID') : '-'
        }))
    },
    ['purchase-orders-list'],
    { revalidate: 300, tags: ['procurement', 'purchase-orders'] }
)
