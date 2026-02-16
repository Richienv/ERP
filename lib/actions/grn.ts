"use server"

import { prisma, safeQuery, withRetry, withPrismaAuth } from "@/lib/db"
import { revalidateTag, revalidatePath, unstable_cache } from "next/cache"
import { ProcurementStatus } from "@prisma/client"
import { assertRole, getAuthzUser } from "@/lib/authz"
import { assertPOTransition } from "@/lib/po-state-machine"
import { 
    FALLBACK_PENDING_POS, 
    FALLBACK_GRNS, 
    FALLBACK_WAREHOUSES, 
    FALLBACK_EMPLOYEES 
} from "@/lib/db-fallbacks"

const prismaAny = prisma as any
const revalidateTagSafe = (tag: string) => (revalidateTag as any)(tag, 'default')

const RECEIVING_ROLES = ["ROLE_ADMIN", "ROLE_CEO", "ROLE_DIRECTOR", "ROLE_MANAGER", "ROLE_PURCHASING"]

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
                        in: ['APPROVED', 'ORDERED', 'VENDOR_CONFIRMED', 'SHIPPED', 'PARTIAL_RECEIVED'] as any
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
        const user = await getAuthzUser()
        assertRole(user, RECEIVING_ROLES)

        const receivedById = await getEmployeeIdForUserEmail(user.email)
        if (!receivedById) throw new Error("Employee record not found for current user")

        // Generate GRN number
        const date = new Date()
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
        const number = `GRN-${year}${month}-${random}`

        // Create GRN with items in a transaction
        const grn = await withPrismaAuth(async (prisma) => {
            return await prisma.$transaction(async (tx) => {
                const txAny = tx as any
                const po = await txAny.purchaseOrder.findUnique({ where: { id: data.purchaseOrderId } })
                if (!po) throw new Error("Purchase Order not found")
                if (!["ORDERED", "VENDOR_CONFIRMED", "SHIPPED", "PARTIAL_RECEIVED"].includes(po.status)) {
                    throw new Error("Purchase Order is not eligible for receiving")
                }

                // 1. Create GRN
                const newGrn = await txAny.goodsReceivedNote.create({
                    data: {
                        number,
                        purchaseOrderId: data.purchaseOrderId,
                        warehouseId: data.warehouseId,
                        receivedById,
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

export async function acceptGRN(grnId: string, overrideReason?: string) {
    try {
        const user = await getAuthzUser()
        assertRole(user, RECEIVING_ROLES)

        const result = await withPrismaAuth(async (prisma) => {
            return await prisma.$transaction(async (tx) => {
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
                if (grn.status !== 'DRAFT') throw new Error("GRN is not in a processable state")

                // SoD Check: If user approved the PO, they need to provide a reason to receive it
                const approvingEvent = await txAny.purchaseOrderEvent.findFirst({
                    where: {
                        purchaseOrderId: grn.purchaseOrderId,
                        action: "APPROVE",
                        changedBy: user.id,
                    },
                    select: { id: true }
                })

                if (approvingEvent) {
                    const reason = (overrideReason || "").trim()
                    if (reason.length < 10) {
                        return {
                            success: false,
                            sodViolation: true,
                            error: "SoD Alert: You approved this PO. Provide reason to override (min 10 chars).",
                        }
                    }

                    await createPurchaseOrderEvent(tx as any, {
                        purchaseOrderId: grn.purchaseOrderId,
                        status: grn.purchaseOrder.status as ProcurementStatus,
                        changedBy: user.id,
                        action: "SOD_OVERRIDE",
                        notes: reason,
                        metadata: {
                            violationType: "APPROVER_ACCEPTING_GRN",
                            overrideReason: reason,
                            source: "GRN_ACCEPT",
                            grnId,
                        },
                    })
                }

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

                    const transitionPO = async (
                        currentStatus: ProcurementStatus,
                        nextStatus: ProcurementStatus,
                        action: string,
                        metadata?: any
                    ) => {
                        assertPOTransition(currentStatus, nextStatus)
                        await tx.purchaseOrder.update({
                            where: { id: po.id },
                            data: {
                                previousStatus: currentStatus,
                                status: nextStatus,
                            }
                        })
                        await createPurchaseOrderEvent(tx as any, {
                            purchaseOrderId: po.id,
                            status: nextStatus,
                            changedBy: user.id,
                            action,
                            metadata,
                        })
                    }

                    if (allItemsReceived) {
                        if (po.status !== 'RECEIVED' && po.status !== 'COMPLETED') {
                            await transitionPO(po.status as any, 'RECEIVED', 'RECEIVE_FULL', { 
                                source: 'GRN_ACCEPT', 
                                grnId,
                                sodOverride: overrideReason 
                            })
                            po.status = 'RECEIVED'
                        }
                        if (po.status === 'RECEIVED') {
                            await transitionPO('RECEIVED', 'COMPLETED', 'AUTO_COMPLETE', { 
                                source: 'GRN_ACCEPT', 
                                grnId,
                                sodOverride: overrideReason 
                            })
                        }
                    } else if (someItemsReceived) {
                        if (po.status !== 'PARTIAL_RECEIVED') {
                            await transitionPO(po.status as any, 'PARTIAL_RECEIVED' as any, 'RECEIVE_PARTIAL', { 
                                source: 'GRN_ACCEPT', 
                                grnId,
                                sodOverride: overrideReason 
                            })
                        }
                    }
                }

                return { success: true }
            })
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
        const user = await getAuthzUser()
        assertRole(user, RECEIVING_ROLES)

        await withPrismaAuth(async (prisma) => {
            const existing = await (prisma as any).goodsReceivedNote.findUnique({ where: { id: grnId } })
            if (!existing) throw new Error("GRN not found")
            if (existing.status === 'ACCEPTED') throw new Error("GRN already accepted")
            if (existing.status !== 'DRAFT') throw new Error("GRN is not in a rejectable state")

            await (prisma as any).goodsReceivedNote.update({
                where: { id: grnId },
                data: {
                    status: 'REJECTED',
                    notes: reason
                }
            })
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
