"use server"

import { prisma, withPrismaAuth } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { getNextDocNumber } from "@/lib/document-numbering"

async function requireAuth() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new Error("Unauthorized")
    return user
}

export async function detectWorkOrderShortages(workOrderId: string) {
    await requireAuth()

    const wo = await prisma.workOrder.findUnique({
        where: { id: workOrderId },
        include: {
            productionBom: {
                include: {
                    items: {
                        include: {
                            material: { select: { id: true, name: true, code: true } },
                        },
                    },
                },
            },
        },
    })

    if (!wo || !wo.productionBom) return []

    const materialIds = wo.productionBom.items.map((item) => item.materialId)

    // Get stock levels
    const stockLevels = await prisma.stockLevel.groupBy({
        by: ["productId"],
        where: { productId: { in: materialIds } },
        _sum: { availableQty: true },
    })
    const stockMap = new Map(stockLevels.map((s) => [s.productId, s._sum.availableQty ?? 0]))

    // Get on-order quantities — only count POs actually committed to vendor
    // (DRAFT/PENDING_APPROVAL/APPROVED may never be sent and shouldn't suppress
    // genuine material shortages).
    const poItems = await prisma.purchaseOrderItem.findMany({
        where: {
            productId: { in: materialIds },
            purchaseOrder: {
                status: { in: ["ORDERED", "VENDOR_CONFIRMED", "SHIPPED", "PARTIAL_RECEIVED"] },
            },
        },
        select: { productId: true, quantity: true, receivedQty: true },
    })
    const onOrderMap = new Map<string, number>()
    for (const poi of poItems) {
        const remaining = Number(poi.quantity) - Number(poi.receivedQty ?? 0)
        onOrderMap.set(poi.productId, (onOrderMap.get(poi.productId) ?? 0) + remaining)
    }

    // Get preferred suppliers
    const supplierProducts = await prisma.supplierProduct.findMany({
        where: { productId: { in: materialIds } },
        include: { supplier: { select: { id: true, name: true } } },
        orderBy: { price: "asc" },
    })
    const supplierMap = new Map<string, { id: string; name: string }[]>()
    for (const sp of supplierProducts) {
        const list = supplierMap.get(sp.productId) ?? []
        list.push({ id: sp.supplier.id, name: sp.supplier.name })
        supplierMap.set(sp.productId, list)
    }

    const shortages = wo.productionBom.items.map((item) => {
        const requiredQty = Math.ceil(Number(item.quantityPerUnit) * wo.plannedQty * (1 + Number(item.wastePct) / 100))
        const availableQty = stockMap.get(item.materialId) ?? 0
        const onOrderQty = onOrderMap.get(item.materialId) ?? 0
        const shortfall = Math.max(0, requiredQty - availableQty - onOrderQty)
        const suppliers = supplierMap.get(item.materialId) ?? []

        return {
            materialId: item.materialId,
            materialCode: item.material.code,
            materialName: item.material.name,
            unit: item.unit ?? "",
            requiredQty,
            availableQty,
            onOrderQty,
            shortfall,
            suppliers,
            preferredSupplierId: suppliers[0]?.id ?? null,
        }
    }).filter((item) => item.shortfall > 0)

    return shortages
}

export async function createPRFromWorkOrder(
    workOrderId: string,
    items: Array<{ materialId: string; qty: number; supplierId?: string }>
) {
    const user = await requireAuth()

    // H14 — duplicate-prevention. Calling twice for the same WO would create
    // two PRs with the same materials. Refuse if an open PR already exists.
    const existingPR = await prisma.purchaseRequest.findFirst({
        where: {
            notes: { contains: workOrderId },
            status: { in: ["PENDING", "APPROVED"] },
        },
        select: { id: true, number: true },
    })
    if (existingPR) {
        throw new Error(
            `PR untuk Work Order ini sudah ada (${existingPR.number}, status PENDING/APPROVED). ` +
            `Selesaikan atau cancel PR yang lama terlebih dahulu.`
        )
    }

    // M11 deferred — WorkOrder model has no createdBy/owner field, so we
    // fall back to the current user as requester. When WorkOrder.createdBy
    // is added (TODO), look it up here so auto-PR shows the production lead
    // not the supervisor who clicked "request shortage".
    const wo = await prisma.workOrder.findUnique({
        where: { id: workOrderId },
        select: { number: true },
    })
    if (!wo) throw new Error("Work Order tidak ditemukan")

    const requesterEmployee = await prisma.employee.findFirst({
        where: { email: user.email },
        select: { id: true },
    })
    if (!requesterEmployee) throw new Error("Employee record tidak ditemukan")

    // H15 — pakai withPrismaAuth bukan raw prisma.$transaction.
    // withPrismaAuth runs the auth-context check that every other procurement
    // write enforces.
    const now = new Date()
    const prefix = `PR-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`

    const pr = await withPrismaAuth(async (tx) => {
        const prNumber = await getNextDocNumber(tx, prefix, 4)
        return await tx.purchaseRequest.create({
            data: {
                number: prNumber,
                status: "PENDING",
                requestDate: now,
                notes: `Auto-generated from Work Order ${wo.number ?? workOrderId} [WO:${workOrderId}]`,
                requesterId: requesterEmployee.id,
                items: {
                    create: items.map((item) => ({
                        productId: item.materialId,
                        quantity: item.qty,
                        preferredSupplierId: item.supplierId || null,
                    })),
                },
            },
        })
    })

    revalidatePath("/procurement/requests")
    revalidatePath("/manufacturing/material-demand")

    return { id: pr.id, number: pr.number, itemCount: items.length }
}
