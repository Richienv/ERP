"use server"

import { withPrismaAuth } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

async function requireAuth() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new Error("Unauthorized")
    return user
}

// ==========================================
// Types
// ==========================================

export interface RevisionHistoryEntry {
    revision: number
    changedAt: string
    changedBy: string
    changedByEmail: string
    reason: string
    snapshot: {
        items: {
            productId: string
            productName: string
            productCode: string
            quantity: number
            unitPrice: number
            lineTotal: number
        }[]
        subtotal: number
        taxAmount: number
        total: number
        paymentTerm: string
        deliveryTerm: string | null
        notes: string | null
    }
}

export interface AmendSalesOrderInput {
    salesOrderId: string
    reason: string
    items: {
        productId: string
        quantity: number
        unitPrice: number
        discount?: number
        taxRate?: number
        description?: string
    }[]
    paymentTerm?: string
    deliveryTerm?: string
    notes?: string
    requestedDate?: string
}

export interface AmendPurchaseOrderInput {
    purchaseOrderId: string
    reason: string
    items: {
        productId: string
        quantity: number
        unitPrice: number
    }[]
    expectedDate?: string
}

// ==========================================
// SALES ORDER AMENDMENT
// ==========================================

export async function amendSalesOrder(input: AmendSalesOrderInput): Promise<{
    success: boolean
    newRevision?: number
    error?: string
}> {
    try {
        const user = await requireAuth()

        const result = await withPrismaAuth(async (prisma) => {
            // prisma is already a transaction client from withPrismaAuth
            const so = await prisma.salesOrder.findUnique({
                where: { id: input.salesOrderId },
                include: {
                    items: {
                        include: {
                            product: { select: { name: true, code: true } },
                        },
                    },
                },
            })

            if (!so) throw new Error("Sales Order tidak ditemukan")

            // Only allow amendment on certain statuses
            const amendable = ["DRAFT", "CONFIRMED"]
            if (!amendable.includes(so.status)) {
                throw new Error(
                    `Sales Order status "${so.status}" tidak dapat diamandemen. Hanya DRAFT atau CONFIRMED.`
                )
            }

            if (!input.reason?.trim()) {
                throw new Error("Alasan revisi wajib diisi")
            }

            if (!input.items || input.items.length === 0) {
                throw new Error("Minimal satu item wajib diisi")
            }

            // Build snapshot of current state before amendment
            const currentSnapshot = {
                items: so.items.map((item) => ({
                    productId: item.productId,
                    productName: item.product.name,
                    productCode: item.product.code,
                    quantity: Number(item.quantity),
                    unitPrice: Number(item.unitPrice),
                    lineTotal: Number(item.lineTotal),
                })),
                subtotal: Number(so.subtotal),
                taxAmount: Number(so.taxAmount),
                total: Number(so.total),
                paymentTerm: so.paymentTerm,
                deliveryTerm: so.deliveryTerm,
                notes: so.notes,
            }

            const newRevision = so.revision + 1

            // Append to revision history
            const existingHistory: RevisionHistoryEntry[] = Array.isArray(so.revisionHistory)
                ? (so.revisionHistory as unknown as RevisionHistoryEntry[])
                : []

            const newEntry: RevisionHistoryEntry = {
                revision: so.revision,
                changedAt: new Date().toISOString(),
                changedBy: user.id,
                changedByEmail: user.email || "unknown",
                reason: input.reason.trim(),
                snapshot: currentSnapshot,
            }

            const updatedHistory = [...existingHistory, newEntry]

            // Validate products
            const productIds = input.items.map((i) => i.productId)
            const products = await prisma.product.findMany({
                where: { id: { in: productIds } },
                select: { id: true, name: true, sellingPrice: true },
            })
            const productMap = new Map(products.map((p) => [p.id, p]))

            // Calculate new totals
            const newItems = input.items.map((item) => {
                const product = productMap.get(item.productId)
                if (!product) throw new Error(`Produk tidak ditemukan: ${item.productId}`)

                const qty = Math.max(0.001, item.quantity)
                const price = item.unitPrice
                const discount = Math.max(0, Math.min(100, item.discount || 0))
                const taxRate = item.taxRate ?? 11

                const lineSubtotal = qty * price
                const discountAmount = lineSubtotal * (discount / 100)
                const afterDiscount = lineSubtotal - discountAmount
                const taxAmount = afterDiscount * (taxRate / 100)
                const lineTotal = afterDiscount + taxAmount

                return {
                    productId: item.productId,
                    description: item.description || product.name,
                    quantity: qty,
                    unitPrice: price,
                    discount,
                    taxRate,
                    lineTotal,
                }
            })

            const subtotal = newItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
            const discountAmount = newItems.reduce((s, i) => {
                const sub = i.quantity * i.unitPrice
                return s + sub * (i.discount / 100)
            }, 0)
            const taxAmount = newItems.reduce((s, i) => {
                const sub = i.quantity * i.unitPrice
                const afterDisc = sub - sub * (i.discount / 100)
                return s + afterDisc * (i.taxRate / 100)
            }, 0)
            const total = newItems.reduce((s, i) => s + i.lineTotal, 0)

            // Delete old items and create new ones
            await prisma.salesOrderItem.deleteMany({
                where: { salesOrderId: so.id },
            })

            // Update the SO
            await prisma.salesOrder.update({
                where: { id: so.id },
                data: {
                    revision: newRevision,
                    revisionHistory: updatedHistory as any,
                    subtotal,
                    taxAmount,
                    discountAmount,
                    total,
                    paymentTerm: (input.paymentTerm as any) || so.paymentTerm,
                    deliveryTerm: input.deliveryTerm ?? so.deliveryTerm,
                    notes: input.notes ?? so.notes,
                    requestedDate: input.requestedDate ? new Date(input.requestedDate) : so.requestedDate,
                    items: {
                        create: newItems.map((item) => ({
                            productId: item.productId,
                            description: item.description,
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            discount: item.discount,
                            taxRate: item.taxRate,
                            lineTotal: item.lineTotal,
                        })),
                    },
                },
            })

            return { newRevision }
        })

        return { success: true, newRevision: result.newRevision }
    } catch (error) {
        const msg = error instanceof Error ? error.message : "Gagal mengamandemen Sales Order"
        console.error("[amendSalesOrder] Error:", error)
        return { success: false, error: msg }
    }
}

// ==========================================
// PURCHASE ORDER AMENDMENT
// ==========================================

export async function amendPurchaseOrder(input: AmendPurchaseOrderInput): Promise<{
    success: boolean
    newRevision?: number
    error?: string
}> {
    try {
        const user = await requireAuth()

        const result = await withPrismaAuth(async (prisma) => {
            // prisma is already a transaction client from withPrismaAuth
            const po = await prisma.purchaseOrder.findUnique({
                where: { id: input.purchaseOrderId },
                include: {
                    items: {
                        include: {
                            product: { select: { name: true, code: true } },
                        },
                    },
                },
            })

            if (!po) throw new Error("Purchase Order tidak ditemukan")

            const amendable = ["PO_DRAFT", "PENDING_APPROVAL"]
            if (!amendable.includes(po.status)) {
                throw new Error(
                    `PO status "${po.status}" tidak dapat diamandemen. Hanya PO_DRAFT atau PENDING_APPROVAL.`
                )
            }

            if (!input.reason?.trim()) {
                throw new Error("Alasan revisi wajib diisi")
            }

            if (!input.items || input.items.length === 0) {
                throw new Error("Minimal satu item wajib diisi")
            }

            // Build snapshot
            const currentSnapshot = {
                items: po.items.map((item) => ({
                    productId: item.productId,
                    productName: item.product.name,
                    productCode: item.product.code,
                    quantity: item.quantity,
                    unitPrice: Number(item.unitPrice),
                    lineTotal: Number(item.totalPrice),
                })),
                subtotal: Number(po.totalAmount),
                taxAmount: Number(po.taxAmount),
                total: Number(po.netAmount),
                paymentTerm: "",
                deliveryTerm: null as string | null,
                notes: null as string | null,
            }

            const newRevision = po.revision + 1

            const existingHistory: RevisionHistoryEntry[] = Array.isArray(po.revisionHistory)
                ? (po.revisionHistory as unknown as RevisionHistoryEntry[])
                : []

            const newEntry: RevisionHistoryEntry = {
                revision: po.revision,
                changedAt: new Date().toISOString(),
                changedBy: user.id,
                changedByEmail: user.email || "unknown",
                reason: input.reason.trim(),
                snapshot: currentSnapshot,
            }

            const updatedHistory = [...existingHistory, newEntry]

            // Validate products
            const productIds = input.items.map((i) => i.productId)
            const products = await prisma.product.findMany({
                where: { id: { in: productIds } },
                select: { id: true, name: true },
            })
            const productMap = new Map(products.map((p) => [p.id, p]))

            const newItems = input.items.map((item) => {
                const product = productMap.get(item.productId)
                if (!product) throw new Error(`Produk tidak ditemukan: ${item.productId}`)

                return {
                    productId: item.productId,
                    quantity: Math.max(1, Math.round(item.quantity)),
                    unitPrice: item.unitPrice,
                    totalPrice: Math.max(1, Math.round(item.quantity)) * item.unitPrice,
                }
            })

            const totalAmount = newItems.reduce((s, i) => s + i.totalPrice, 0)
            const taxAmount = totalAmount * 0.11
            const netAmount = totalAmount + taxAmount

            // Delete old items
            await prisma.purchaseOrderItem.deleteMany({
                where: { purchaseOrderId: po.id },
            })

            // Update PO
            await prisma.purchaseOrder.update({
                where: { id: po.id },
                data: {
                    revision: newRevision,
                    revisionHistory: updatedHistory as any,
                    totalAmount,
                    taxAmount,
                    netAmount,
                    expectedDate: input.expectedDate ? new Date(input.expectedDate) : po.expectedDate,
                    items: {
                        create: newItems.map((item) => ({
                            productId: item.productId,
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            totalPrice: item.totalPrice,
                        })),
                    },
                },
            })

            // Log event
            await prisma.purchaseOrderEvent.create({
                data: {
                    purchaseOrderId: po.id,
                    status: po.status,
                    changedBy: user.id,
                    action: "AMENDMENT",
                    notes: `Rev ${newRevision}: ${input.reason.trim()}`,
                    metadata: { revision: newRevision },
                },
            })

            return { newRevision }
        })

        return { success: true, newRevision: result.newRevision }
    } catch (error) {
        const msg = error instanceof Error ? error.message : "Gagal mengamandemen Purchase Order"
        console.error("[amendPurchaseOrder] Error:", error)
        return { success: false, error: msg }
    }
}

// ==========================================
// GET REVISION HISTORY
// ==========================================

export async function getSalesOrderRevisionHistory(
    salesOrderId: string
): Promise<{ revision: number; history: RevisionHistoryEntry[] }> {
    try {
        const user = await requireAuth()

        const so = await (await import("@/lib/prisma")).prisma.salesOrder.findUnique({
            where: { id: salesOrderId },
            select: { revision: true, revisionHistory: true },
        })

        if (!so) return { revision: 0, history: [] }

        const history: RevisionHistoryEntry[] = Array.isArray(so.revisionHistory)
            ? (so.revisionHistory as unknown as RevisionHistoryEntry[])
            : []

        return { revision: so.revision, history }
    } catch (error) {
        console.error("[getSalesOrderRevisionHistory] Error:", error)
        return { revision: 0, history: [] }
    }
}

export async function getPurchaseOrderRevisionHistory(
    purchaseOrderId: string
): Promise<{ revision: number; history: RevisionHistoryEntry[] }> {
    try {
        const user = await requireAuth()

        const po = await (await import("@/lib/prisma")).prisma.purchaseOrder.findUnique({
            where: { id: purchaseOrderId },
            select: { revision: true, revisionHistory: true },
        })

        if (!po) return { revision: 0, history: [] }

        const history: RevisionHistoryEntry[] = Array.isArray(po.revisionHistory)
            ? (po.revisionHistory as unknown as RevisionHistoryEntry[])
            : []

        return { revision: po.revision, history }
    } catch (error) {
        console.error("[getPurchaseOrderRevisionHistory] Error:", error)
        return { revision: 0, history: [] }
    }
}
