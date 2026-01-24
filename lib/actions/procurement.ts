"use server"

import { prisma } from "@/lib/prisma"
import { revalidateTag, unstable_cache } from "next/cache"

export async function getProcurementStats() {
    try {
        // 1. Open PO Value (Status: OPEN or PARTIAL)
        const openPOs = await prisma.purchaseOrder.aggregate({
            _sum: {
                totalAmount: true
            },
            where: {
                status: {
                    in: ["OPEN", "PARTIAL"]
                }
            }
        })

        // 2. Pending Approvals (Status: DRAFT)
        const pendingCount = await prisma.purchaseOrder.count({
            where: {
                status: "DRAFT"
            }
        })

        // Includes Tasks as "Pending Request"
        const purchaseRequestsCount = await prisma.employeeTask.count({
            where: {
                type: 'PURCHASE_REQUEST',
                status: 'PENDING'
            }
        })

        // 3. Incoming Goods (Status: OPEN or PARTIAL or RECEIVED)
        const incomingCount = await prisma.purchaseOrder.count({
            where: {
                status: {
                    in: ["OPEN", "PARTIAL"]
                }
            }
        })

        // 4. Recent Activity (Last 5 POs)
        const recentActivity = await prisma.purchaseOrder.findMany({
            take: 5,
            orderBy: {
                createdAt: "desc"
            },
            include: {
                supplier: {
                    select: {
                        name: true
                    }
                }
            }
        })

        return {
            openPOValue: Number(openPOs._sum.totalAmount || 0),
            pendingCount: pendingCount + purchaseRequestsCount, // Combine Draft POs + PRs
            incomingCount,
            recentActivity
        }

    } catch (error) {
        console.error("Error fetching procurement stats:", error)
        return {
            openPOValue: 0,
            pendingCount: 0,
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
            const requests = await prisma.employeeTask.findMany({
                where: {
                    type: 'PURCHASE_REQUEST'
                    // Removed status filter to allow showing Accepted (COMPLETED) requests
                },
                orderBy: { createdAt: 'desc' },
                include: {
                    employee: true // Correct relation name
                }
            })

            return requests.map(req => ({
                id: req.id,
                title: req.title,
                relatedId: req.relatedId,
                requester: `${req.employee.firstName} ${req.employee.lastName || ''}`.trim() || "Unknown Staff",
                status: req.status,
                priority: req.priority,
                notes: req.notes || req.title, // Use notes field if available
                date: req.createdAt
            }))

        } catch (error) {
            console.error("Error fetching requests:", error)
            return []
        }
    },
    ['procurement-requests'],
    { revalidate: 60, tags: ['procurement'] }
)

export async function rejectPurchaseRequest(taskId: string, reason: string) {
    try {
        await prisma.employeeTask.update({
            where: { id: taskId },
            data: {
                status: 'REJECTED',
                notes: reason
            }
        })

        revalidateTag('procurement')
        return { success: true }
    } catch (error) {
        console.error("Error rejecting request:", error)
        return { success: false, error: "Failed to reject request" }
    }
}

export async function previewPOFromRequest(taskId: string, productId: string, quantity: number) {
    try {
        const product = await prisma.product.findUnique({
            where: { id: productId },
            include: {
                supplierItems: {
                    where: { isPreferred: true },
                    include: { supplier: true }
                }
            }
        })

        if (!product) throw new Error("Product not found")

        const supplierItem = product.supplierItems[0]
        const unitCost = supplierItem?.price || product.costPrice || 0
        const supplierName = supplierItem?.supplier.name || "Unknown Vendor"
        const leadTime = supplierItem?.leadTime || 7

        return {
            success: true,
            data: {
                productName: product.name,
                quantity,
                unit: product.unit,
                unitCost: Number(unitCost),
                totalCost: Number(unitCost) * quantity,
                supplierName,
                leadTime,
                estimatedArrival: new Date(Date.now() + leadTime * 24 * 60 * 60 * 1000).toLocaleDateString('id-ID')
            }
        }
    } catch (error) {
        console.error("Error previewing PO:", error)
        return { success: false, error: "Failed to load preview" }
    }
}

export async function createPOFromRequest(taskId: string, productId: string, quantity: number, notes: string) {
    try {
        // 1. Get Product & Preferred Supplier
        const product = await prisma.product.findUnique({
            where: { id: productId },
            include: {
                supplierItems: {
                    where: { isPreferred: true },
                    include: { supplier: true }
                }
            }
        })

        if (!product) throw new Error("Product not found")

        // Find preferred supplier or first available
        const supplierItem = product.supplierItems[0]
        if (!supplierItem) throw new Error("No supplier found for this product")

        const unitCost = supplierItem.price || product.costPrice || 0;

        // 2. Create PO (Draft)
        const po = await prisma.purchaseOrder.create({
            data: {
                number: `PO-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
                supplierId: supplierItem.supplierId,
                status: 'OPEN',
                totalAmount: Number(unitCost) * quantity,
                // notes field removed as it doesn't exist on PurchaseOrder
                orderDate: new Date(),
                expectedDate: new Date(Date.now() + (supplierItem.leadTime || 7) * 24 * 60 * 60 * 1000),
                items: {
                    create: {
                        productId: product.id,
                        quantity: quantity,
                        unitPrice: unitCost,
                        totalPrice: Number(unitCost) * quantity
                    }
                }
            }
        })

        // 3. Mark Task as Completed
        await prisma.employeeTask.update({
            where: { id: taskId },
            data: {
                status: 'COMPLETED'
            }
        })

        revalidateTag('procurement')
        revalidateTag('inventory')

        return { success: true, poId: po.id }

    } catch (error) {
        console.error("Error creating PO from Request:", error)
        return { success: false, error: "Failed to create PO" }
    }
}
