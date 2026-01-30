"use server"

// Procurement Actions
import { prisma } from "@/lib/prisma"
import { revalidateTag, unstable_cache } from "next/cache"
import { PRStatus, PRItemStatus } from "@prisma/client"

export async function getProcurementStats() {
    try {
        // 1. Spend Velocity (Current Month vs Last Month)
        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)

        const currentMonthSpend = await prisma.purchaseOrder.aggregate({
            _sum: { totalAmount: true },
            where: {
                status: { in: ["OPEN", "PARTIAL", "COMPLETED", "RECEIVED"] },
                createdAt: { gte: startOfMonth }
            }
        })

        const lastMonthSpend = await prisma.purchaseOrder.aggregate({
            _sum: { totalAmount: true },
            where: {
                status: { in: ["OPEN", "PARTIAL", "COMPLETED", "RECEIVED"] },
                createdAt: { gte: startOfLastMonth, lte: endOfLastMonth }
            }
        })

        const currentSpend = Number(currentMonthSpend._sum.totalAmount || 0)
        const lastSpend = Number(lastMonthSpend._sum.totalAmount || 0)
        const spendGrowth = lastSpend > 0 ? ((currentSpend - lastSpend) / lastSpend) * 100 : 0

        // 2. Urgent Needs (Low Stock Items)
        const lowStockCount = await prisma.product.count({
            where: {
                isActive: true,
                stockLevels: {
                    some: {
                        quantity: { lt: 10 } // Simple threshold for now, ideally compare vs minStock
                    }
                }
            }
        })

        // 3. Needs Approval (For Manager)
        const pendingPRs = await prisma.purchaseRequest.count({
            where: { status: 'PENDING' }
        })

        // 4. Vendor Health
        const vendors = await prisma.supplier.findMany({ select: { rating: true, onTimeRate: true } })
        const avgRating = vendors.length > 0
            ? vendors.reduce((sum, v) => sum + v.rating, 0) / vendors.length
            : 0
        const avgOnTime = vendors.length > 0
            ? vendors.reduce((sum, v) => sum + v.onTimeRate, 0) / vendors.length
            : 0

        // 5. Incoming Goods (Open POs)
        const incomingCount = await prisma.purchaseOrder.count({
            where: { status: { in: ["OPEN", "PARTIAL"] } }
        })

        // 6. Recent Activity
        const recentActivity = await prisma.purchaseOrder.findMany({
            take: 5,
            orderBy: { createdAt: "desc" },
            include: { supplier: { select: { name: true } } }
        })

        return {
            spend: {
                current: currentSpend,
                growth: spendGrowth
            },
            needsApproval: pendingPRs,
            urgentNeeds: lowStockCount,
            vendorHealth: {
                rating: avgRating,
                onTime: avgOnTime
            },
            incomingCount,
            recentActivity
        }

    } catch (error) {
        console.error("Error fetching procurement stats:", error)
        return {
            spend: { current: 0, growth: 0 },
            needsApproval: 0,
            urgentNeeds: 0,
            vendorHealth: { rating: 0, onTime: 0 },
            incomingCount: 0,
            recentActivity: []
        }
    }
}

export async function getAllPurchaseOrders() {
    try {
        const orders = await prisma.purchaseOrder.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                supplier: true,
                items: true
            }
        })

        return orders.map(po => ({
            id: po.number, // Display ID
            dbId: po.id,   // Actual UUID
            vendor: po.supplier.name,
            date: po.orderDate.toLocaleDateString('id-ID'),
            total: Number(po.totalAmount),
            status: po.status,
            items: po.items.length,
            eta: po.expectedDate ? po.expectedDate.toLocaleDateString('id-ID') : '-'
        }))
    } catch (error) {
        console.error("Failed to fetch purchase orders:", error)
        return []
    }
}

// === NEW: Purchase Requests Actions ===

export const getPurchaseRequests = unstable_cache(
    async () => {
        try {
            const requests = await prisma.purchaseRequest.findMany({
                orderBy: { createdAt: 'desc' },
                include: {
                    requester: true,
                    items: {
                        include: {
                            product: true
                        }
                    }
                }
            })

            return requests.map(req => ({
                id: req.id, // UUID for actions
                number: req.number, // Display ID
                requester: `${req.requester.firstName} ${req.requester.lastName || ''}`.trim() || "Unknown Staff",
                department: req.department || req.requester.department,
                status: req.status,
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
    { revalidate: 60, tags: ['procurement'] }
)

export async function createPurchaseRequest(data: {
    requesterId: string,
    department?: string,
    priority?: string,
    notes?: string,
    items: { productId: string, quantity: number, targetDate?: Date, notes?: string }[]
}) {
    try {
        // Generate PR Number: PR-YYYYMM-XXXX
        const date = new Date()
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
        const number = `PR-${year}${month}-${random}`

        const pr = await prisma.purchaseRequest.create({
            data: {
                number,
                requesterId: data.requesterId,
                department: data.department || "General", // Fallback
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

        revalidateTag('procurement')
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
        revalidateTag('procurement')
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
                notes: reason, // Append or overwrite notes? Let's overwrite or handled by UI
                items: {
                    updateMany: {
                        where: { status: 'PENDING' },
                        data: { status: 'REJECTED' }
                    }
                }
            }
        })

        revalidateTag('procurement')
        return { success: true }
    } catch (error) {
        console.error("Error rejecting request:", error)
        return { success: false, error: "Failed to reject request" }
    }
}

// Adapted to work with PR Items
export async function createPOFromPR(prId: string, itemIds: string[], notes: string) {
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

        // Group by Supplier (Naive approach: 1 PO per Supplier)
        // For Phase 1, assume 1 Supplier for all or pick preferred.
        // We'll group items by their preferred supplier.

        const poMap = new Map<string, { supplierId: string, items: any[] }>()

        for (const item of pr.items) {
            const preferredSupplier = item.product.supplierItems.find(s => s.isPreferred) || item.product.supplierItems[0]
            if (!preferredSupplier) {
                // Skip or Error? Let's skip for now or throw
                // throw new Error(`No supplier for ${item.product.name}`)
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

        // Create POs
        for (const [supplierId, data] of poMap.entries()) {
            const year = new Date().getFullYear()
            const month = String(new Date().getMonth() + 1).padStart(2, '0')
            const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
            const poNumber = `PO-${year}${month}-${random}`

            const totalAmount = data.items.reduce((sum, i) => sum + i.totalPrice, 0)

            const po = await prisma.purchaseOrder.create({
                data: {
                    number: poNumber,
                    supplierId,
                    status: 'OPEN',
                    totalAmount,
                    orderDate: new Date(),
                    // estimated delivery...
                    items: {
                        create: data.items.map(i => ({
                            productId: i.productId,
                            quantity: i.quantity,
                            unitPrice: i.unitPrice,
                            totalPrice: i.totalPrice
                        }))
                    }
                }
            })

            // Update PR Items status
            await prisma.purchaseRequestItem.updateMany({
                where: { id: { in: data.items.map(i => i.prItemId) } },
                data: { status: 'PO_CREATED' }
            })

            createdPOs.push(po.id)
        }

        // Check if all PR items are handled to update PR status
        const remainingItems = await prisma.purchaseRequestItem.count({
            where: { purchaseRequestId: prId, status: { not: 'PO_CREATED' } }
        })

        if (remainingItems === 0) {
            await prisma.purchaseRequest.update({
                where: { id: prId },
                data: { status: 'PO_CREATED' }
            })
        }

        revalidateTag('procurement')
        revalidateTag('inventory')

        return { success: true, poIds: createdPOs }

    } catch (error: any) {
        console.error("Error creating PO from PR:", error)
        return { success: false, error: error.message || "Failed to create PO" }
    }
}

// === VENDOR ACTIONS ===

export const getVendors = unstable_cache(
    async () => {
        try {
            const vendors = await prisma.supplier.findMany({
                orderBy: { name: 'asc' },
                include: {
                    _count: {
                        select: { purchaseOrders: true }
                    }
                }
            })
            return vendors.map(v => ({
                id: v.id,
                name: v.name,
                category: v.code.startsWith('IMP') ? "Import" : "General", // Simple Mock Logic
                status: v.isActive ? "Active" : "Inactive",
                rating: v.rating,
                contact: v.contactName || "-",
                phone: v.phone || "-",
                email: v.email || "-",
                address: v.address || "-",
                totalSpend: "0",
                activeOrders: v._count.purchaseOrders,
                color: "bg-zinc-500",
                logo: v.name.substring(0, 2).toUpperCase()
            }))
        } catch (e) {
            console.error("Error fetching vendors", e)
            return []
        }
    },
    ['vendors-list'],
    { revalidate: 60, tags: ['procurement', 'vendors'] }
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
            data: {
                ...data,
                rating: 0,
                onTimeRate: 100
            }
        })
        revalidateTag('vendors')
        return { success: true }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

// === CONFIRM PO (RECEIVE & BILL) ===
import { postJournalEntry } from "@/lib/actions/finance"

export async function confirmPurchaseOrder(id: string) {
    try {
        const po = await prisma.purchaseOrder.findUnique({
            where: { id },
            include: { supplier: true, items: true }
        })

        if (!po) throw new Error("Purchase Order not found")
        if (po.status === 'COMPLETED') throw new Error("PO already completed")

        // 1. Update PO Status
        await prisma.purchaseOrder.update({
            where: { id },
            data: {
                status: 'COMPLETED',
                paymentStatus: 'UNPAID' // Ready for payment
            }
        })

        // 2. Post Journal Entry (Accrual Basis)
        // Debit: Persediaan (1300) - Start simple, assume all is inventory for now
        // Credit: Utang Usaha (2000)

        await postJournalEntry({
            description: `Bill for PO ${po.number} - ${po.supplier.name}`,
            date: new Date(),
            reference: po.number,
            lines: [
                {
                    accountCode: '1300', // Persediaan Barang
                    debit: Number(po.totalAmount),
                    credit: 0
                },
                {
                    accountCode: '2000', // Utang Usaha
                    debit: 0,
                    credit: Number(po.totalAmount)
                }
            ]
        })

        try {
            revalidateTag('procurement')
        } catch (e) { }

        return { success: true }

    } catch (error: any) {
        console.error("Confirm PO Error:", error)
        return { success: false, error: error.message }
    }
}
