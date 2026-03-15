"use server"

import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

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

    // Get on-order quantities from active POs
    const poItems = await prisma.purchaseOrderItem.findMany({
        where: {
            productId: { in: materialIds },
            purchaseOrder: {
                status: { in: ["ORDERED", "VENDOR_CONFIRMED", "SHIPPED", "PARTIAL_RECEIVED", "APPROVED", "PENDING_APPROVAL"] },
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

    const wo = await prisma.workOrder.findUnique({
        where: { id: workOrderId },
        select: { number: true },
    })

    // Generate PR number
    const now = new Date()
    const prefix = `PR-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`
    const lastPR = await prisma.purchaseRequest.findFirst({
        where: { number: { startsWith: prefix } },
        orderBy: { number: "desc" },
    })
    const seq = lastPR ? parseInt(lastPR.number.slice(-4)) + 1 : 1
    const prNumber = `${prefix}-${String(seq).padStart(4, "0")}`

    // Find employee record for the user
    const employee = await prisma.employee.findFirst({
        where: { email: user.email },
        select: { id: true },
    })
    if (!employee) throw new Error("Employee record not found")

    const pr = await prisma.$transaction(async (tx) => {
        const created = await tx.purchaseRequest.create({
            data: {
                number: prNumber,
                status: "PENDING",
                requestDate: now,
                notes: `Auto-generated from Work Order ${wo?.number ?? workOrderId}`,
                requesterId: employee.id,
                items: {
                    create: items.map((item) => ({
                        productId: item.materialId,
                        quantity: item.qty,
                        preferredSupplierId: item.supplierId || null,
                    })),
                },
            },
        })
        return created
    })

    revalidatePath("/procurement/requests")
    revalidatePath("/manufacturing/material-demand")

    return { id: pr.id, number: pr.number, itemCount: items.length }
}
