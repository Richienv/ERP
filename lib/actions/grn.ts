"use server"

import { prisma, safeQuery, withRetry, withPrismaAuth } from "@/lib/db"

import { ProcurementStatus } from "@prisma/client"
import { assertRole, getAuthzUser } from "@/lib/authz"
import { assertPOTransition, allowedNextStatuses } from "@/lib/po-state-machine"
import { postInventoryGLEntry } from "@/lib/actions/inventory-gl"
import { revalidatePath } from "next/cache"
import { fireTrigger } from "@/lib/documents/triggers"
import {
    FALLBACK_PENDING_POS,
    FALLBACK_GRNS,
    FALLBACK_WAREHOUSES,
    FALLBACK_EMPLOYEES
} from "@/lib/db-fallbacks"
import type { GRNFilter, BulkGRNResult } from "@/lib/types/grn-filters"

export type { GRNFilter, BulkGRNResult } from "@/lib/types/grn-filters"

const prismaAny = prisma as any

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

async function getEmployeeForUserEmail(email?: string | null) {
    if (!email) return null
    const employee = await (prisma as any).employee.findFirst({
        where: { email },
        select: { id: true, firstName: true, lastName: true }
    })
    return employee || null
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

export async function getPendingPOsForReceiving() {
    await getAuthzUser()

    const { data: orders } = await safeQuery<any[]>(
        () => withRetry(() => prismaAny.purchaseOrder.findMany({
            where: {
                status: {
                    in: ['APPROVED', 'ORDERED', 'VENDOR_CONFIRMED', 'SHIPPED', 'PARTIAL_RECEIVED'] as any
                }
            },
            orderBy: { orderDate: 'desc' },
            take: 200,
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
}

// ==========================================
// GET ALL GRNs
// ==========================================

export async function getAllGRNs(filter?: GRNFilter) {
    try {
        await getAuthzUser()

        // Build a Prisma where clause from the filter. Empty/undefined filter
        // returns everything (preserves the previous behaviour).
        const where: any = {}
        if (filter?.status?.length) {
            where.status = { in: filter.status as any }
        }
        if (filter?.dateStart || filter?.dateEnd) {
            where.receivedDate = {}
            if (filter.dateStart) where.receivedDate.gte = new Date(filter.dateStart)
            if (filter.dateEnd) {
                // Make end-date inclusive (end of day in UTC — good enough for daily filter UI)
                const end = new Date(filter.dateEnd)
                end.setHours(23, 59, 59, 999)
                where.receivedDate.lte = end
            }
        }
        // Vendor + PO ref + search filters all live on the related PurchaseOrder
        // (and its supplier). Build a nested AND so we can combine multiple
        // related-record predicates safely.
        const poWhereAnd: any[] = []
        if (filter?.vendorIds?.length) {
            poWhereAnd.push({ supplierId: { in: filter.vendorIds } })
        }
        if (filter?.poRef) {
            poWhereAnd.push({ number: { contains: filter.poRef, mode: "insensitive" } })
        }
        if (filter?.search) {
            // Search across GRN number OR PO number OR supplier name.
            where.OR = [
                { number: { contains: filter.search, mode: "insensitive" } },
                { purchaseOrder: { number: { contains: filter.search, mode: "insensitive" } } },
                { purchaseOrder: { supplier: { name: { contains: filter.search, mode: "insensitive" } } } },
            ]
        }
        if (poWhereAnd.length > 0) {
            where.purchaseOrder = { AND: poWhereAnd }
        }

        const grns = await prismaAny.goodsReceivedNote.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: 200,
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

        return grns.map((grn: any) => {
            const totalQuantityReceived = grn.items.reduce(
                (sum: number, i: any) => sum + (i.quantityReceived || 0),
                0,
            )
            return {
                id: grn.id,
                number: grn.number,
                purchaseOrderId: grn.purchaseOrderId,
                poNumber: grn.purchaseOrder.number,
                vendorId: grn.purchaseOrder.supplier.id,
                vendorName: grn.purchaseOrder.supplier.name,
                warehouseId: grn.warehouseId,
                warehouseName: grn.warehouse.name,
                receivedById: grn.receivedById,
                receivedBy: grn.receivedBy
                    ? `${grn.receivedBy.firstName} ${grn.receivedBy.lastName || ''}`.trim()
                    : 'Unknown',
                receivedDate: grn.receivedDate,
                status: grn.status,
                notes: grn.notes,
                itemCount: grn.items.length,
                totalQuantityReceived,
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
            }
        })
    } catch (error) {
        console.error("Error fetching GRNs:", error)
        return []
    }
}

// ==========================================
// GET GRN BY ID
// ==========================================

export async function getGRNById(id: string) {
    try {
        await getAuthzUser()

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
            receivedBy: grn.receivedBy
                ? `${grn.receivedBy.firstName} ${grn.receivedBy.lastName || ''}`.trim()
                : 'Unknown',
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

        const employee = await getEmployeeForUserEmail(user.email)
        const receivedById = employee?.id || null

        // Create GRN with items in a transaction (withPrismaAuth already wraps in $transaction)
        const grn = await withPrismaAuth(async (prisma) => {
            const prismaAny = prisma as any

            // Generate GRN number INSIDE transaction. Uses DocumentCounter
            // upsert so two concurrent acceptGRNs cannot collide on the same
            // sequence value (the old count+1 pattern would race).
            const { getNextDocNumber } = await import("@/lib/document-numbering")
            const now = new Date()
            const year = now.getFullYear()
            const month = String(now.getMonth() + 1).padStart(2, '0')
            const prefix = `SJM-${year}${month}`
            const number = await getNextDocNumber(prismaAny, prefix, 4)

            const po = await prismaAny.purchaseOrder.findUnique({
                where: { id: data.purchaseOrderId },
                include: {
                    items: {
                        include: {
                            product: true,
                            grnItems: true
                        }
                    }
                }
            })
            if (!po) throw new Error("Purchase Order not found")

            // Auto-transition APPROVED → ORDERED (factories often receive same day as approval)
            if (po.status === 'APPROVED') {
                assertPOTransition('APPROVED' as ProcurementStatus, 'ORDERED' as ProcurementStatus)
                await prismaAny.purchaseOrder.update({
                    where: { id: po.id },
                    data: {
                        previousStatus: po.status,
                        status: 'ORDERED',
                        sentToVendorAt: new Date(),
                    }
                })
                await createPurchaseOrderEvent(prisma as any, {
                    purchaseOrderId: po.id,
                    status: 'ORDERED' as ProcurementStatus,
                    changedBy: user.id,
                    action: 'AUTO_ORDERED_VIA_GRN',
                    notes: 'PO otomatis ditandai sebagai Ordered saat penerimaan barang',
                })
                po.status = 'ORDERED'
            }

            if (!["ORDERED", "VENDOR_CONFIRMED", "SHIPPED", "PARTIAL_RECEIVED"].includes(po.status)) {
                throw new Error("Purchase Order is not eligible for receiving")
            }

            // Validate quantities against PO remaining
            for (const item of data.items) {
                if (!item.quantityReceived || item.quantityReceived <= 0) continue

                const poItem = po.items.find((pi: any) => pi.id === item.poItemId)
                if (!poItem) {
                    throw new Error(`Item PO tidak ditemukan: ${item.poItemId}`)
                }

                // Calculate already received from existing GRNs
                const alreadyReceived = poItem.grnItems?.reduce(
                    (sum: number, gi: any) => sum + Number(gi.quantityReceived || 0), 0
                ) || 0
                const remaining = Number(poItem.quantity) - alreadyReceived

                if (item.quantityReceived > remaining) {
                    throw new Error(
                        `Kuantitas melebihi sisa PO untuk ${poItem.product?.name || 'item'}. Sisa: ${remaining}, Diminta: ${item.quantityReceived}`
                    )
                }
            }

            // 1. Create GRN
            const newGrn = await prismaAny.goodsReceivedNote.create({
                data: {
                    number,
                    purchaseOrderId: data.purchaseOrderId,
                    warehouseId: data.warehouseId,
                    receivedById: receivedById || undefined,
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
        console.log("[acceptGRN] START grnId=", grnId, "overrideReason=", overrideReason ? `"${overrideReason}" (${overrideReason.length} chars)` : "undefined", "user=", user.id)

        const result = await withPrismaAuth(async (prisma) => {
            const prismaAny = prisma as any

            // 1. Get GRN with items + product cost data (read-only, for data access)
            const grn = await prismaAny.goodsReceivedNote.findUnique({
                where: { id: grnId },
                include: {
                    items: {
                        include: { product: { select: { name: true, costPrice: true } } }
                    },
                    purchaseOrder: {
                        include: { items: true }
                    }
                }
            })

            if (!grn) throw new Error("GRN not found")
            console.log("[acceptGRN] GRN found:", grn.number, "status=", grn.status, "PO status=", grn.purchaseOrder?.status, "items=", grn.items.length)

            // SoD Check: If user approved the PO, they need to provide a reason to receive it
            // This runs BEFORE the atomic status transition so a soft rejection doesn't corrupt state
            const approvingEvent = await prismaAny.purchaseOrderEvent.findFirst({
                where: {
                    purchaseOrderId: grn.purchaseOrderId,
                    action: "APPROVE",
                    changedBy: user.id,
                },
                select: { id: true }
            })

            if (approvingEvent) {
                const reason = (overrideReason || "").trim()
                console.log("[acceptGRN] SoD detected. Override reason length=", reason.length)
                if (reason.length < 10) {
                    return {
                        success: false,
                        sodViolation: true,
                        error: "SoD Alert: You approved this PO. Provide reason to override (min 10 chars).",
                    }
                }

                await createPurchaseOrderEvent(prisma as any, {
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
                console.log("[acceptGRN] SoD override event created OK")
            }

            // 2. Atomic status transition — only succeeds if still DRAFT (prevents double-accept race)
            const acceptEmployee = await getEmployeeForUserEmail(user.email)
            const acceptedById = acceptEmployee?.id || null
            const updated = await prismaAny.goodsReceivedNote.updateMany({
                where: { id: grnId, status: 'DRAFT' },
                data: {
                    status: 'ACCEPTED',
                    acceptedBy: acceptedById || user.id,
                    acceptedAt: new Date(),
                }
            })
            if (updated.count === 0) {
                throw new Error('GRN sudah diproses atau tidak ditemukan. Refresh halaman.')
            }
            console.log("[acceptGRN] GRN status → ACCEPTED")

            // 3. Update PO item received quantities — atomic over-receive guard.
            // updateMany with WHERE constraint ensures two concurrent GRN
            // acceptances cannot BOTH pass the check (prior fresh-read +
            // in-memory + update pattern was racy).
            for (const grnItem of grn.items) {
                const poItem = await prisma.purchaseOrderItem.findUnique({
                    where: { id: grnItem.poItemId },
                    select: { quantity: true, receivedQty: true },
                })
                if (!poItem) continue

                const maxAdditional = poItem.quantity - poItem.receivedQty
                const updated = await prisma.purchaseOrderItem.updateMany({
                    where: {
                        id: grnItem.poItemId,
                        // Re-check at write time using the SAME ceiling: only
                        // succeeds if no other tx has incremented in between.
                        receivedQty: { lte: poItem.quantity - grnItem.quantityAccepted },
                    },
                    data: {
                        receivedQty: { increment: grnItem.quantityAccepted },
                    },
                })

                if (updated.count === 0) {
                    throw new Error(
                        `Jumlah penerimaan melebihi pesanan pada PO item ${grnItem.poItemId}. ` +
                        `Maks bisa ditambah: ${maxAdditional}, mau ditambah: ${grnItem.quantityAccepted}. ` +
                        `Mungkin GRN lain barusan diterima — refresh lalu coba lagi.`
                    )
                }
                console.log("[acceptGRN] PO item", grnItem.poItemId, "+=", grnItem.quantityAccepted)

                // 4. Create inventory transaction for each accepted item
                if (grnItem.quantityAccepted > 0) {
                    const unitCost = Number(grnItem.unitCost)
                    const totalValue = unitCost * grnItem.quantityAccepted

                    const invTx = await prisma.inventoryTransaction.create({
                        data: {
                            productId: grnItem.productId,
                            warehouseId: grn.warehouseId,
                            type: 'PO_RECEIVE',
                            quantity: grnItem.quantityAccepted,
                            unitCost: grnItem.unitCost,
                            totalValue,
                            purchaseOrderId: grn.purchaseOrderId,
                            referenceId: grn.number,
                            notes: `Received via ${grn.number}`
                        }
                    })
                    console.log("[acceptGRN] Inventory TX created:", invTx.id, "qty=", grnItem.quantityAccepted, "value=", totalValue)

                    // 5. Update stock levels (findFirst + create/update to avoid Prisma null-in-composite-key issue)
                    const existingStock = await prisma.stockLevel.findFirst({
                        where: {
                            productId: grnItem.productId,
                            warehouseId: grn.warehouseId,
                            locationId: null,
                        }
                    })

                    if (existingStock) {
                        await prisma.stockLevel.update({
                            where: { id: existingStock.id },
                            data: {
                                quantity: { increment: grnItem.quantityAccepted },
                                availableQty: { increment: grnItem.quantityAccepted },
                            }
                        })
                        console.log("[acceptGRN] Stock updated:", existingStock.id, "+", grnItem.quantityAccepted)
                    } else {
                        await prisma.stockLevel.create({
                            data: {
                                productId: grnItem.productId,
                                warehouseId: grn.warehouseId,
                                quantity: grnItem.quantityAccepted,
                                availableQty: grnItem.quantityAccepted,
                                reservedQty: 0,
                            }
                        })
                        console.log("[acceptGRN] Stock created for product=", grnItem.productId)
                    }

                    // 6. Post GL entry: DR Inventory Asset (1300) / CR GR/IR Clearing (2150)
                    // BLOCKING: if GL posting fails, the surrounding $transaction
                    // rolls back the GRN status update + stock writes too. Better
                    // to fail loudly than to leave Inventory Asset out of sync
                    // with stock on the books.
                    const productName = grnItem.product?.name || grnItem.productId.slice(0, 8)
                    await postInventoryGLEntry(prisma, {
                        transactionId: invTx.id,
                        type: 'PO_RECEIVE',
                        productName,
                        quantity: grnItem.quantityAccepted,
                        unitCost,
                        totalValue,
                        reference: grn.number,
                        transactionDate: grn.receivedAt ?? grn.createdAt,
                    })
                    console.log("[acceptGRN] GL entry posted OK")
                }
            }

            // 7. Check if PO is fully received — auto-transition PO status (best-effort, non-blocking)
            try {
                const po = await prisma.purchaseOrder.findUnique({
                    where: { id: grn.purchaseOrderId },
                    include: { items: true }
                })

                if (po) {
                    const allItemsReceived = po.items.every((item: any) => item.receivedQty >= item.quantity)
                    const someItemsReceived = po.items.some((item: any) => item.receivedQty > 0)
                    console.log("[acceptGRN] PO status=", po.status, "allReceived=", allItemsReceived, "someReceived=", someItemsReceived)

                    const safeTransitionPO = async (
                        currentStatus: ProcurementStatus,
                        nextStatus: ProcurementStatus,
                        action: string,
                        metadata?: any
                    ) => {
                        const allowed = allowedNextStatuses[currentStatus] || []
                        if (!allowed.includes(nextStatus)) {
                            console.warn(`[acceptGRN] PO transition skipped: ${currentStatus} → ${nextStatus} not allowed`)
                            return false
                        }
                        await prisma.purchaseOrder.update({
                            where: { id: po.id },
                            data: {
                                previousStatus: currentStatus,
                                status: nextStatus,
                            }
                        })
                        await createPurchaseOrderEvent(prisma as any, {
                            purchaseOrderId: po.id,
                            status: nextStatus,
                            changedBy: user.id,
                            action,
                            metadata,
                        })
                        console.log("[acceptGRN] PO transitioned:", currentStatus, "→", nextStatus)
                        return true
                    }

                    if (allItemsReceived) {
                        if (po.status !== 'RECEIVED' && po.status !== 'COMPLETED') {
                            const ok = await safeTransitionPO(po.status as any, 'RECEIVED', 'RECEIVE_FULL', {
                                source: 'GRN_ACCEPT',
                                grnId,
                                sodOverride: overrideReason
                            })
                            if (ok) po.status = 'RECEIVED'
                        }
                        if (po.status === 'RECEIVED') {
                            await safeTransitionPO('RECEIVED', 'COMPLETED', 'AUTO_COMPLETE', {
                                source: 'GRN_ACCEPT',
                                grnId,
                                sodOverride: overrideReason
                            })
                        }
                    } else if (someItemsReceived) {
                        if (po.status !== 'PARTIAL_RECEIVED') {
                            await safeTransitionPO(po.status as any, 'PARTIAL_RECEIVED' as any, 'RECEIVE_PARTIAL', {
                                source: 'GRN_ACCEPT',
                                grnId,
                                sodOverride: overrideReason
                            })
                        }
                    }
                }
            } catch (poErr: any) {
                // PO transition failure should NOT roll back the GRN acceptance,
                // but it MUST be surfaced — write a dedicated event so the UI
                // and audit log can flag the PO as out-of-sync.
                console.error("[acceptGRN] PO transition failed (non-blocking):", poErr.message)
                try {
                    await createPurchaseOrderEvent(prisma as any, {
                        purchaseOrderId: grn.purchaseOrderId,
                        status: 'RECEIVED' as any,
                        changedBy: user.id,
                        action: 'PO_TRANSITION_FAILED',
                        notes: poErr.message,
                        metadata: { source: 'GRN_ACCEPT', grnId, error: poErr.message },
                    })
                } catch (logErr) {
                    console.error("[acceptGRN] Could not even log PO_TRANSITION_FAILED:", logErr)
                }
            }

            console.log("[acceptGRN] SUCCESS — returning { success: true }")
            return { success: true }
        })

        // Fire-and-forget: recalculate vendor rating after successful GRN acceptance
        if (result.success) {
            recalculateVendorRating(grnId).catch((err) =>
                console.error("[acceptGRN] Vendor rating recalc failed (non-blocking):", err)
            )

            // Fire-and-forget: capture immutable PDF snapshot of accepted GRN.
            void fireTrigger('GRN_ACCEPTED', grnId, user.id)

            // Revalidate all affected pages
            revalidatePath("/inventory")
            revalidatePath("/inventory/products")
            revalidatePath("/inventory/stock")
            revalidatePath("/inventory/movements")
            revalidatePath("/inventory/audit")
            revalidatePath("/inventory/cycle-counts")
            revalidatePath("/inventory/adjustments")
            revalidatePath("/procurement")
            revalidatePath("/finance")
        }

        return result
    } catch (error: any) {
        console.error("[acceptGRN] CAUGHT ERROR:", error.message, error.stack?.slice(0, 300))
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
            // Atomic status transition — only succeeds if still DRAFT (prevents double-reject race)
            const rejectEmployee = await getEmployeeForUserEmail(user.email)
            const rejectedById = rejectEmployee?.id || null
            const updated = await (prisma as any).goodsReceivedNote.updateMany({
                where: { id: grnId, status: 'DRAFT' },
                data: {
                    status: 'REJECTED',
                    notes: reason,
                    rejectedBy: rejectedById || user.id,
                    rejectedAt: new Date(),
                    rejectionReason: reason,
                }
            })
            if (updated.count === 0) {
                // Check why it failed — already processed or not found
                const existing = await (prisma as any).goodsReceivedNote.findUnique({
                    where: { id: grnId },
                    select: { status: true }
                })
                if (!existing) throw new Error("GRN not found")
                if (existing.status === 'ACCEPTED') throw new Error("GRN sudah diterima, tidak bisa ditolak.")
                if (existing.status === 'REJECTED') throw new Error("GRN sudah ditolak sebelumnya.")
                throw new Error("GRN tidak dalam status yang bisa ditolak. Refresh halaman.")
            }
        })

        revalidatePath("/procurement")
        revalidatePath("/inventory")

        return { success: true }
    } catch (error: any) {
        console.error("Error rejecting GRN:", error)
        return { success: false, error: error.message }
    }
}

// ==========================================
// GET WAREHOUSES FOR DROPDOWN
// ==========================================

export async function getWarehousesForGRN() {
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
}

// ==========================================
// GET EMPLOYEES FOR DROPDOWN
// ==========================================

export async function getEmployeesForGRN() {
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
}

// ==========================================
// AUTO-RECALCULATE VENDOR RATING
// ==========================================

/**
 * Recalculates a vendor's rating and onTimeRate based on actual PO/GRN data.
 * Called after GRN acceptance. Non-blocking — failures are logged but don't
 * affect the GRN acceptance result.
 */
async function recalculateVendorRating(grnId: string) {
    // 1. Find the supplier from this GRN's PO
    const grn = await prismaAny.goodsReceivedNote.findUnique({
        where: { id: grnId },
        select: {
            purchaseOrder: {
                select: { supplierId: true },
            },
        },
    })

    const supplierId = grn?.purchaseOrder?.supplierId
    if (!supplierId) return

    // 2. Get completed POs for on-time calculation
    const completedPOs = await prisma.purchaseOrder.findMany({
        where: {
            supplierId,
            status: 'COMPLETED',
        },
        select: {
            orderDate: true,
            expectedDate: true,
            updatedAt: true,
        },
        take: 100,
        orderBy: { updatedAt: 'desc' },
    })

    let onTimeCount = 0
    for (const po of completedPOs) {
        if (po.expectedDate && po.updatedAt.getTime() <= po.expectedDate.getTime()) {
            onTimeCount++
        }
    }

    const onTimeRate = completedPOs.length > 0
        ? Math.round((onTimeCount / completedPOs.length) * 100)
        : 0

    // 3. Get defect rate from GRN items
    const grnStats = await prismaAny.gRNItem.aggregate({
        where: {
            grn: {
                purchaseOrder: { supplierId },
            },
        },
        _sum: { quantityReceived: true, quantityRejected: true },
    })

    const totalReceived = Number(grnStats._sum.quantityReceived || 0)
    const totalRejected = Number(grnStats._sum.quantityRejected || 0)
    const defectRate = totalReceived > 0 ? (totalRejected / totalReceived) * 100 : 0

    // 4. Calculate composite rating (1-5 scale)
    // Weight: 60% on-time delivery, 40% quality (inverse defect rate)
    const qualityScore = Math.max(0, 100 - defectRate)
    const compositeScore = (onTimeRate * 0.6) + (qualityScore * 0.4)
    const rating = Math.min(5, Math.max(0, Math.round(compositeScore / 20)))

    // 5. Update supplier
    await prisma.supplier.update({
        where: { id: supplierId },
        data: {
            rating,
            onTimeRate,
            qualityScore: Math.round(qualityScore * 100) / 100,
        },
    })
}

// ==========================================
// BULK ACTIONS — per-id transaction (partial success aware)
// ==========================================

/**
 * Bulk-accept GRNs. Each id runs through the existing single-id `acceptGRN()`
 * which handles SoD, GL posting, stock updates and PO transition. Failures
 * are collected per-id rather than aborting the whole batch — matches the
 * `bulkApprovePurchaseOrders` semantics in `lib/actions/procurement.ts`.
 *
 * NOTE: callers that want SoD override per-id will need to call `acceptGRN`
 * individually with a reason. The bulk variant is intended for happy-path
 * batch acceptance where no SoD violation exists.
 */
export async function bulkAcceptGRNs(ids: string[]): Promise<BulkGRNResult> {
    const result: BulkGRNResult = { succeeded: [], failed: [] }
    if (!Array.isArray(ids) || ids.length === 0) return result

    try {
        const user = await getAuthzUser()
        assertRole(user, RECEIVING_ROLES)
    } catch (e) {
        const reason = e instanceof Error ? e.message : "Unauthorized"
        for (const id of ids) result.failed.push({ id, reason })
        return result
    }

    for (const id of ids) {
        try {
            const res = await acceptGRN(id)
            if (res.success) {
                result.succeeded.push(id)
            } else {
                const reason = "error" in res ? res.error : undefined
                const sodFlag = "sodViolation" in res && res.sodViolation
                result.failed.push({
                    id,
                    reason: reason ?? (sodFlag ? "SoD violation — terima manual" : "Unknown error"),
                })
            }
        } catch (e: unknown) {
            const reason = e instanceof Error ? e.message : "Unknown error"
            result.failed.push({ id, reason })
        }
    }

    if (result.succeeded.length > 0) {
        revalidatePath("/procurement/receiving")
        revalidatePath("/procurement")
        revalidatePath("/inventory")
    }

    return result
}

/**
 * Bulk-reject GRNs. Per-id transaction — same partial-success semantics
 * as `bulkAcceptGRNs`. Defaults to a generic rejection reason when none
 * is supplied.
 */
export async function bulkRejectGRNs(
    ids: string[],
    reason?: string,
): Promise<BulkGRNResult> {
    const result: BulkGRNResult = { succeeded: [], failed: [] }
    if (!Array.isArray(ids) || ids.length === 0) return result

    const rejectionReason = reason?.trim() || "Ditolak via bulk action"

    try {
        const user = await getAuthzUser()
        assertRole(user, RECEIVING_ROLES)
    } catch (e) {
        const failReason = e instanceof Error ? e.message : "Unauthorized"
        for (const id of ids) result.failed.push({ id, reason: failReason })
        return result
    }

    for (const id of ids) {
        try {
            const res = await rejectGRN(id, rejectionReason)
            if (res.success) {
                result.succeeded.push(id)
            } else {
                result.failed.push({ id, reason: res.error ?? "Unknown error" })
            }
        } catch (e: unknown) {
            const failReason = e instanceof Error ? e.message : "Unknown error"
            result.failed.push({ id, reason: failReason })
        }
    }

    if (result.succeeded.length > 0) {
        revalidatePath("/procurement/receiving")
        revalidatePath("/procurement")
    }

    return result
}

// ==========================================
// BULK IMPORT GRNs (XLSX) — backlog migration
// ==========================================
//
// Khusus GRN: tiap baris harus reference No PO yang SUDAH ADA di sistem.
// Kontrak (mirror bulkImportPurchaseOrders di lib/actions/procurement.ts):
//   - 2 sheet di Excel: 'GRN Header' + 'GRN Items', dilink via Reference (bukan No GRN —
//     nomor GRN otomatis di-generate via getNextDocNumber dgn prefix SJM-YYYYMM).
//   - Setiap GRN harus punya minimal 1 item di Sheet 'GRN Items'.
//   - Setiap item: Kode Produk wajib + harus ada di PO yg di-reference, Qty Diterima > 0.
//
// Strategi: satu transaction per GRN — kalau item gagal, hanya GRN itu yg
// di-skip; GRN lain tetap berhasil (sesuai pattern bulkImportPurchaseOrders).
//
// Status default = DRAFT. User harus terima manual via UI agar stok bertambah
// dan jurnal terbentuk (acceptGRN posts inventory GL + updates PO receivedQty).

export interface BulkImportGRNRow {
    /** Identifier user-defined untuk hubungkan header dengan items. */
    reference?: string
    /** Nomor PO yang SUDAH ADA di sistem (mis. PO-202604-0001). */
    poNumber?: string
    /** Format DD/MM/YYYY atau YYYY-MM-DD. */
    receivedDate?: string
    /** Opsional — kode gudang dari master Warehouse (mis. GD-001). */
    warehouseCode?: string
    notes?: string
}

export interface BulkImportGRNItemRow {
    /** Harus match dengan reference di BulkImportGRNRow. */
    reference?: string
    productCode?: string
    receivedQty?: number
    /** "Ya" / "Tidak" — Ya berarti seluruh qty diterima (accepted = received).
     *  Tidak berarti hanya qty yang ditulis yang accepted (sisa anggap rejected/missing). */
    matchedOrder?: string
    notes?: string
}

export interface BulkImportGRNResult {
    imported: number
    errors: { row: number; reason: string }[]
}

function parseGRNDate(value: string | undefined | null): Date | null {
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

export async function bulkImportGRNs(
    headerRows: BulkImportGRNRow[],
    itemRows: BulkImportGRNItemRow[],
): Promise<BulkImportGRNResult> {
    const result: BulkImportGRNResult = { imported: 0, errors: [] }

    // ── Auth + actor (sekali untuk seluruh batch)
    let actorUser: { id: string; role: string; email?: string | null }
    try {
        const u = await getAuthzUser()
        assertRole(u, RECEIVING_ROLES)
        actorUser = u as typeof actorUser
    } catch (e: unknown) {
        const reason = e instanceof Error ? e.message : "Tidak terautentikasi"
        for (let i = 0; i < headerRows.length; i++) {
            result.errors.push({ row: i + 2, reason })
        }
        return result
    }

    if (!Array.isArray(headerRows) || headerRows.length === 0) return result

    // Resolve receivedById once (non-fatal if employee record missing)
    const employee = await getEmployeeForUserEmail(actorUser.email)
    const receivedById = employee?.id || null

    // ── Group items by reference (case-insensitive trim)
    const itemsByRef = new Map<string, BulkImportGRNItemRow[]>()
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

            const poNumber = row.poNumber?.trim()
            if (!poNumber) {
                result.errors.push({
                    row: rowNum,
                    reason: "No PO wajib diisi (untuk link ke PO yang sudah ada)",
                })
                continue
            }

            // ── PO lookup (must exist + be in receivable status)
            const po = await prisma.purchaseOrder.findUnique({
                where: { number: poNumber },
                include: {
                    items: { include: { product: true, grnItems: true } },
                },
            })
            if (!po) {
                result.errors.push({
                    row: rowNum,
                    reason: `PO "${poNumber}" tidak ditemukan di sistem`,
                })
                continue
            }
            // Allow any status that's valid for receiving OR has been completed
            // (backlog migration — old POs may already be COMPLETED in legacy system)
            const ALLOWED_PO_STATUSES = [
                "ORDERED",
                "VENDOR_CONFIRMED",
                "SHIPPED",
                "PARTIAL_RECEIVED",
                "RECEIVED",
                "COMPLETED",
                "APPROVED",
            ]
            if (!ALLOWED_PO_STATUSES.includes(po.status)) {
                result.errors.push({
                    row: rowNum,
                    reason: `PO "${poNumber}" status ${po.status} tidak bisa diterima (perlu min APPROVED/ORDERED)`,
                })
                continue
            }

            // ── Date (default = today)
            const receivedDate = parseGRNDate(row.receivedDate) ?? new Date()
            if (row.receivedDate && !parseGRNDate(row.receivedDate)) {
                result.errors.push({
                    row: rowNum,
                    reason: `Tanggal Terima "${row.receivedDate}" tidak valid (gunakan DD/MM/YYYY)`,
                })
                continue
            }

            // ── Warehouse: optional via code lookup, fallback to first PO item's
            // associated stockLevel warehouse, else first active warehouse.
            let warehouseId: string | null = null
            if (row.warehouseCode?.trim()) {
                const wh = await prisma.warehouse.findUnique({
                    where: { code: row.warehouseCode.trim().toUpperCase() },
                    select: { id: true, isActive: true },
                })
                if (!wh) {
                    result.errors.push({
                        row: rowNum,
                        reason: `Gudang dengan kode "${row.warehouseCode}" tidak ditemukan`,
                    })
                    continue
                }
                if (!wh.isActive) {
                    result.errors.push({
                        row: rowNum,
                        reason: `Gudang "${row.warehouseCode}" sedang nonaktif`,
                    })
                    continue
                }
                warehouseId = wh.id
            } else {
                // Fallback: pick first active warehouse (most SMEs have just one)
                const fallbackWh = await prisma.warehouse.findFirst({
                    where: { isActive: true },
                    orderBy: { createdAt: "asc" },
                    select: { id: true },
                })
                if (!fallbackWh) {
                    result.errors.push({
                        row: rowNum,
                        reason: "Tidak ada gudang aktif di sistem — buat dulu di Inventory > Gudang",
                    })
                    continue
                }
                warehouseId = fallbackWh.id
            }

            // ── Items lookup
            const itemsForGRN = itemsByRef.get(reference.toLowerCase()) ?? []
            if (itemsForGRN.length === 0) {
                result.errors.push({
                    row: rowNum,
                    reason: `GRN "${reference}" tidak punya item di Sheet 'GRN Items' (minimal 1)`,
                })
                continue
            }

            // Lookup all referenced products in one query
            const productCodes = Array.from(
                new Set(
                    itemsForGRN
                        .map((it) => it.productCode?.trim().toUpperCase())
                        .filter((c): c is string => Boolean(c)),
                ),
            )
            const products = productCodes.length
                ? await prisma.product.findMany({
                      where: { code: { in: productCodes } },
                      select: { id: true, code: true, name: true },
                  })
                : []
            const productMap = new Map(products.map((p) => [p.code.toUpperCase(), p]))

            type GRNItemCreate = {
                poItemId: string
                productId: string
                quantityOrdered: number
                quantityReceived: number
                quantityAccepted: number
                quantityRejected: number
                unitCost: number
                inspectionNotes: string | null
            }
            const itemsToCreate: GRNItemCreate[] = []
            let itemError: string | null = null

            for (const it of itemsForGRN) {
                const code = it.productCode?.trim().toUpperCase()
                if (!code) {
                    itemError = `Item GRN "${reference}": Kode Produk wajib diisi`
                    break
                }
                const product = productMap.get(code)
                if (!product) {
                    itemError = `Item GRN "${reference}": Produk dengan kode "${code}" tidak ditemukan`
                    break
                }
                const qty = Number(it.receivedQty)
                if (!Number.isFinite(qty) || qty <= 0) {
                    itemError = `Item GRN "${reference}" produk "${code}": Qty Diterima wajib > 0`
                    break
                }

                // Find matching PO item by productId
                const poItem = po.items.find((pi: any) => pi.productId === product.id)
                if (!poItem) {
                    itemError = `Item GRN "${reference}" produk "${code}": tidak ada di PO ${poNumber}`
                    break
                }

                // Sesuai Pesanan: "Ya" → semua qty terima = accepted; "Tidak" → semua tetap accepted
                // tapi tandai sisa qty PO sebagai missing (handled by partial-receive PO transition).
                // Default = "Ya".
                const matched = (it.matchedOrder ?? "Ya").trim().toLowerCase()
                const isMatched = matched === "ya" || matched === "y" || matched === "yes" || matched === ""

                const qtyInt = Math.round(qty)
                itemsToCreate.push({
                    poItemId: poItem.id,
                    productId: product.id,
                    quantityOrdered: poItem.quantity,
                    quantityReceived: qtyInt,
                    quantityAccepted: isMatched ? qtyInt : qtyInt, // both cases: accepted = received
                    quantityRejected: 0,
                    unitCost: Number(poItem.unitPrice),
                    inspectionNotes: it.notes?.trim() || null,
                })
            }

            if (itemError) {
                result.errors.push({ row: rowNum, reason: itemError })
                continue
            }

            // ── Create GRN + items dalam single transaction (per-GRN atomicity).
            // Status default = DRAFT — user harus terima manual via UI agar stok
            // bertambah & jurnal inventory terbentuk (acceptGRN handles GL).
            await withPrismaAuth(async (tx) => {
                const { getNextDocNumber } = await import("@/lib/document-numbering")
                const txAny = tx as any

                const now = new Date()
                const year = now.getFullYear()
                const month = String(now.getMonth() + 1).padStart(2, "0")
                const prefix = `SJM-${year}${month}`
                const number = await getNextDocNumber(txAny, prefix, 4)

                await txAny.goodsReceivedNote.create({
                    data: {
                        number,
                        purchaseOrderId: po.id,
                        warehouseId: warehouseId!,
                        receivedById: receivedById || undefined,
                        receivedDate,
                        status: "DRAFT",
                        notes: row.notes?.trim() || null,
                        items: { create: itemsToCreate },
                    },
                })
            })

            result.imported++
        } catch (e: unknown) {
            const reason = e instanceof Error ? e.message : "Unknown error"
            result.errors.push({ row: rowNum, reason })
        }
    }

    if (result.imported > 0) {
        revalidatePath("/procurement/receiving")
        revalidatePath("/procurement")
        revalidatePath("/inventory")
    }

    return result
}
