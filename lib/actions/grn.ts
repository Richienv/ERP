"use server"

import { prisma, safeQuery, withRetry } from "@/lib/db"
import { revalidateTag, revalidatePath, unstable_cache } from "next/cache"
import { ProcurementStatus } from "@prisma/client"
import { 
    FALLBACK_PENDING_POS, 
    FALLBACK_GRNS, 
    FALLBACK_WAREHOUSES, 
    FALLBACK_EMPLOYEES 
} from "@/lib/db-fallbacks"

const prismaAny = prisma as any
const revalidateTagSafe = (tag: string) => (revalidateTag as any)(tag, 'default')

// ==========================================
// GRN TYPES
// ==========================================

interface GRNItemInput {
    poItemId: string
    productId: string
    quantityOrdered: number
    quantityReceived: number
    quantityAccepted?: number
    quantityRejected?: number
    unitCost: number
    inspectionNotes?: string
}

interface CreateGRNInput {
    purchaseOrderId: string
    warehouseId: string
    receivedById: string
    notes?: string
    items: GRNItemInput[]
}

// ==========================================
// GET PENDING POs FOR RECEIVING
// ==========================================

export const getPendingPOsForReceiving = unstable_cache(
    async () => {
        const { data: orders } = await safeQuery<any[]>(
            () => withRetry(() => prismaAny.purchaseOrder.findMany({
                where: {
                    status: {
                        in: ['ORDERED', 'VENDOR_CONFIRMED', 'SHIPPED', 'PARTIAL_RECEIVED'] as any
                    }
                },
                orderBy: { orderDate: 'desc' },
                include: {
                    supplier: true,
                    items: {
                        include: {
                            product: true,
                            grnItems: true
                        }
                    }
                }
            })),
            FALLBACK_PENDING_POS
        )

        try {
            return orders.map((po: any) => {
                // Calculate remaining qty for each item
                const itemsWithRemaining = po.items.map((item: any) => {
                    const totalReceived = item.grnItems.reduce((sum: number, grn: any) => sum + grn.quantityAccepted, 0)
                    const remainingQty = item.quantity - totalReceived
                    return {
                        id: item.id,
                        productId: item.productId,
                        productName: item.product.name,
                        productCode: item.product.code,
                        unit: item.product.unit,
                        orderedQty: item.quantity,
                        receivedQty: totalReceived,
                        remainingQty,
                        unitPrice: Number(item.unitPrice)
                    }
                })

                const hasRemainingItems = itemsWithRemaining.some((i: any) => i.remainingQty > 0)

                return {
                    id: po.id,
                    number: po.number,
                    vendorName: po.supplier.name,
                    vendorId: po.supplier.id,
                    orderDate: po.orderDate,
                    expectedDate: po.expectedDate,
                    status: po.status,
                    totalAmount: Number(po.totalAmount),
                    items: itemsWithRemaining,
                    hasRemainingItems
                }
            }).filter((po: any) => po.hasRemainingItems) // Only show POs with items to receive
        } catch (error) {
            console.error("Error fetching pending POs:", error)
            return []
        }
    },
    ['pending-pos-receiving'],
    { revalidate: 120, tags: ['purchase-orders', 'receiving'] }
)

// ==========================================
// GET ALL GRNs
// ==========================================

export const getAllGRNs = unstable_cache(
    async () => {
        try {
            const grns = await prismaAny.goodsReceivedNote.findMany({
                orderBy: { createdAt: 'desc' },
                include: {
                    purchaseOrder: {
                        include: { supplier: true }
                    },
                    warehouse: true,
                    receivedBy: true,
                    items: {
                        include: { product: true }
                    }
                }
            })

            return grns.map((grn: any) => ({
                id: grn.id,
                number: grn.number,
                poNumber: grn.purchaseOrder.number,
                vendorName: grn.purchaseOrder.supplier.name,
                warehouseName: grn.warehouse.name,
                receivedBy: `${grn.receivedBy.firstName} ${grn.receivedBy.lastName || ''}`.trim(),
                receivedDate: grn.receivedDate,
                status: grn.status,
                notes: grn.notes,
                itemCount: grn.items.length,
                totalAccepted: grn.items.reduce((sum: number, i: any) => sum + i.quantityAccepted, 0),
                totalRejected: grn.items.reduce((sum: number, i: any) => sum + i.quantityRejected, 0),
                items: grn.items.map((item: any) => ({
                    id: item.id,
                    productName: item.product.name,
                    productCode: item.product.code,
                    quantityOrdered: item.quantityOrdered,
                    quantityReceived: item.quantityReceived,
                    quantityAccepted: item.quantityAccepted,
                    quantityRejected: item.quantityRejected,
                    unitCost: Number(item.unitCost),
                    inspectionNotes: item.inspectionNotes
                }))
            }))
        } catch (error) {
            console.error("Error fetching GRNs:", error)
            return []
        }
    },
    ['grn-list'],
    { revalidate: 300, tags: ['grn', 'receiving'] }
)

// ==========================================
// GET GRN BY ID
// ==========================================

export async function getGRNById(id: string) {
    try {
        const grn = await prismaAny.goodsReceivedNote.findUnique({
            where: { id },
            include: {
                purchaseOrder: {
                    include: { supplier: true }
                },
                warehouse: true,
                receivedBy: true,
                items: {
                    include: { 
                        product: true,
                        poItem: true
                    }
                }
            }
        })

        if (!grn) return null

        return {
            id: grn.id,
            number: grn.number,
            purchaseOrderId: grn.purchaseOrderId,
            poNumber: grn.purchaseOrder.number,
            vendorName: grn.purchaseOrder.supplier.name,
            warehouseId: grn.warehouseId,
            warehouseName: grn.warehouse.name,
            receivedById: grn.receivedById,
            receivedBy: `${grn.receivedBy.firstName} ${grn.receivedBy.lastName || ''}`.trim(),
            receivedDate: grn.receivedDate,
            status: grn.status,
            notes: grn.notes,
            items: grn.items.map((item: any) => ({
                id: item.id,
                poItemId: item.poItemId,
                productId: item.productId,
                productName: item.product.name,
                productCode: item.product.code,
                unit: item.product.unit,
                quantityOrdered: item.quantityOrdered,
                quantityReceived: item.quantityReceived,
                quantityAccepted: item.quantityAccepted,
                quantityRejected: item.quantityRejected,
                unitCost: Number(item.unitCost),
                inspectionNotes: item.inspectionNotes
            }))
        }
    } catch (error) {
        console.error("Error fetching GRN:", error)
        return null
    }
}

// ==========================================
// CREATE GRN
// ==========================================

export async function createGRN(data: CreateGRNInput) {
    try {
        // Generate GRN number
        const date = new Date()
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
        const number = `GRN-${year}${month}-${random}`

        // Create GRN with items in a transaction
        const grn = await prisma.$transaction(async (tx) => {
            const txAny = tx as any
            // 1. Create GRN
            const newGrn = await txAny.goodsReceivedNote.create({
                data: {
                    number,
                    purchaseOrderId: data.purchaseOrderId,
                    warehouseId: data.warehouseId,
                    receivedById: data.receivedById,
                    notes: data.notes,
                    status: 'DRAFT',
                    items: {
                        create: data.items.map((item: any) => ({
                            poItemId: item.poItemId,
                            productId: item.productId,
                            quantityOrdered: item.quantityOrdered,
                            quantityReceived: item.quantityReceived,
                            quantityAccepted: item.quantityAccepted || item.quantityReceived,
                            quantityRejected: item.quantityRejected || 0,
                            unitCost: item.unitCost,
                            inspectionNotes: item.inspectionNotes
                        }))
                    }
                }
            })

            return newGrn
        })

        revalidateTagSafe('procurement')
        revalidateTagSafe('grn')
        revalidateTagSafe('receiving')
        revalidateTagSafe('purchase-orders')
        revalidatePath('/procurement/receiving')

        return { success: true, grnId: grn.id, grnNumber: grn.number }
    } catch (error: any) {
        console.error("Error creating GRN:", error)
        return { success: false, error: error.message }
    }
}

// ==========================================
// ACCEPT GRN (Finalize & Update Inventory)
// ==========================================

export async function acceptGRN(grnId: string) {
    try {
        const result = await prisma.$transaction(async (tx) => {
            const txAny = tx as any
            // 1. Get GRN with items
            const grn = await txAny.goodsReceivedNote.findUnique({
                where: { id: grnId },
                include: {
                    items: true,
                    purchaseOrder: {
                        include: { items: true }
                    }
                }
            })

            if (!grn) throw new Error("GRN not found")
            if (grn.status === 'ACCEPTED') throw new Error("GRN already accepted")

            // 2. Update GRN status
            await txAny.goodsReceivedNote.update({
                where: { id: grnId },
                data: { status: 'ACCEPTED' }
            })

            // 3. Update PO item received quantities
            for (const grnItem of grn.items) {
                await tx.purchaseOrderItem.update({
                    where: { id: grnItem.poItemId },
                    data: {
                        receivedQty: {
                            increment: grnItem.quantityAccepted
                        }
                    }
                })

                // 4. Create inventory transaction for each accepted item
                if (grnItem.quantityAccepted > 0) {
                    await tx.inventoryTransaction.create({
                        data: {
                            productId: grnItem.productId,
                            warehouseId: grn.warehouseId,
                            type: 'PO_RECEIVE',
                            quantity: grnItem.quantityAccepted,
                            unitCost: grnItem.unitCost,
                            totalValue: Number(grnItem.unitCost) * grnItem.quantityAccepted,
                            purchaseOrderId: grn.purchaseOrderId,
                            referenceId: grn.number,
                            notes: `Received via ${grn.number}`
                        }
                    })

                    // 5. Update stock levels
                    await tx.stockLevel.upsert({
                        where: {
                            productId_warehouseId_locationId: {
                                productId: grnItem.productId,
                                warehouseId: grn.warehouseId,
                                locationId: null as any
                            }
                        },
                        create: {
                            productId: grnItem.productId,
                            warehouseId: grn.warehouseId,
                            quantity: grnItem.quantityAccepted,
                            availableQty: grnItem.quantityAccepted,
                            reservedQty: 0
                        },
                        update: {
                            quantity: { increment: grnItem.quantityAccepted },
                            availableQty: { increment: grnItem.quantityAccepted }
                        }
                    })
                }
            }

            // 6. Check if PO is fully received
            const po = await tx.purchaseOrder.findUnique({
                where: { id: grn.purchaseOrderId },
                include: { items: true }
            })

            if (po) {
                const allItemsReceived = po.items.every(item => item.receivedQty >= item.quantity)
                const someItemsReceived = po.items.some(item => item.receivedQty > 0)

                let newStatus: ProcurementStatus = po.status
                if (allItemsReceived) {
                    newStatus = 'RECEIVED'
                } else if (someItemsReceived) {
                    newStatus = 'PARTIAL_RECEIVED' as any
                }

                if (newStatus !== po.status) {
                    await tx.purchaseOrder.update({
                        where: { id: po.id },
                        data: { status: newStatus }
                    })
                }
            }

            return { success: true }
        })

        revalidateTagSafe('procurement')
        revalidateTagSafe('grn')
        revalidateTagSafe('receiving')
        revalidateTagSafe('purchase-orders')
        revalidateTagSafe('inventory')
        revalidatePath('/procurement/receiving')
        revalidatePath('/procurement/orders')
        revalidatePath('/inventory')

        return result
    } catch (error: any) {
        console.error("Error accepting GRN:", error)
        return { success: false, error: error.message }
    }
}

// ==========================================
// REJECT GRN
// ==========================================

export async function rejectGRN(grnId: string, reason: string) {
    try {
        await prismaAny.goodsReceivedNote.update({
            where: { id: grnId },
            data: {
                status: 'REJECTED',
                notes: reason
            }
        })

        revalidateTagSafe('grn')
        revalidateTagSafe('receiving')
        revalidatePath('/procurement/receiving')

        return { success: true }
    } catch (error: any) {
        console.error("Error rejecting GRN:", error)
        return { success: false, error: error.message }
    }
}

// ==========================================
// GET WAREHOUSES FOR DROPDOWN
// ==========================================

export const getWarehousesForGRN = unstable_cache(
    async () => {
        try {
            const warehouses = await prisma.warehouse.findMany({
                where: { isActive: true },
                orderBy: { name: 'asc' },
                select: {
                    id: true,
                    name: true,
                    code: true
                }
            })
            return warehouses
        } catch (error) {
            console.error("Error fetching warehouses:", error)
            return []
        }
    },
    ['warehouses-grn'],
    { revalidate: 600, tags: ['warehouse', 'receiving'] }
)

// ==========================================
// GET EMPLOYEES FOR DROPDOWN
// ==========================================

export const getEmployeesForGRN = unstable_cache(
    async () => {
        try {
            const employees = await prisma.employee.findMany({
                where: { status: 'ACTIVE' },
                orderBy: { firstName: 'asc' },
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    department: true
                }
            })
            return employees.map(e => ({
                id: e.id,
                name: `${e.firstName} ${e.lastName || ''}`.trim(),
                department: e.department
            }))
        } catch (error) {
            console.error("Error fetching employees:", error)
            return []
        }
    },
    ['employees-grn'],
    { revalidate: 600, tags: ['employee', 'receiving'] }
)
