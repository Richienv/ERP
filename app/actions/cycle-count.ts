"use server"

import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

async function requireAuth() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new Error("Unauthorized")
    return user
}

export async function getCycleCountSessions() {
    await requireAuth()

    const sessions = await prisma.stockAudit.findMany({
        include: {
            warehouse: { select: { id: true, name: true, code: true } },
            items: {
                include: {
                    product: { select: { id: true, name: true, code: true, unit: true } },
                },
            },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
    })

    return sessions.map((s) => ({
        id: s.id,
        warehouseId: s.warehouseId,
        warehouseName: s.warehouse.name,
        warehouseCode: s.warehouse.code,
        scheduledDate: s.scheduledDate.toISOString(),
        status: s.status,
        notes: s.notes,
        itemCount: s.items.length,
        countedCount: s.items.filter((i) => i.actualQty !== null).length,
        matchCount: s.items.filter((i) => i.actualQty !== null && i.actualQty === i.expectedQty).length,
        varianceCount: s.items.filter((i) => i.actualQty !== null && i.actualQty !== i.expectedQty).length,
        items: s.items.map((i) => ({
            id: i.id,
            productId: i.productId,
            productName: i.product.name,
            productCode: i.product.code,
            unit: i.product.unit || "PCS",
            expectedQty: i.expectedQty,
            actualQty: i.actualQty,
        })),
        createdAt: s.createdAt.toISOString(),
    }))
}

export async function createCycleCountSession(data: {
    warehouseId: string
    scheduledDate: string
    notes?: string
}): Promise<{ success: boolean; sessionId?: string; error?: string }> {
    try {
        const user = await requireAuth()

        const stockLevels = await prisma.stockLevel.findMany({
            where: {
                warehouseId: data.warehouseId,
                locationId: null,
            },
            include: {
                product: { select: { id: true, isActive: true } },
            },
        })

        const activeItems = stockLevels.filter((sl) => sl.product.isActive)

        if (activeItems.length === 0) {
            return { success: false, error: "Tidak ada produk aktif di gudang ini." }
        }

        const session = await prisma.stockAudit.create({
            data: {
                warehouseId: data.warehouseId,
                scheduledDate: new Date(data.scheduledDate),
                auditorId: user.id,
                status: "SCHEDULED",
                notes: data.notes ?? null,
                items: {
                    create: activeItems.map((sl) => ({
                        productId: sl.productId,
                        expectedQty: sl.quantity,
                    })),
                },
            },
        })

        return { success: true, sessionId: session.id }
    } catch (error) {
        console.error("[createCycleCountSession]", error)
        return { success: false, error: "Gagal membuat sesi stok opname." }
    }
}

export async function submitCycleCountItems(data: {
    sessionId: string
    counts: { itemId: string; actualQty: number }[]
}): Promise<{ success: boolean; error?: string }> {
    try {
        await requireAuth()

        await prisma.$transaction(async (tx) => {
            for (const count of data.counts) {
                await tx.stockAuditItem.update({
                    where: { id: count.itemId },
                    data: { actualQty: count.actualQty },
                })
            }

            const session = await tx.stockAudit.findUnique({
                where: { id: data.sessionId },
                include: { items: true },
            })

            if (session) {
                const allCounted = session.items.every((i) => i.actualQty !== null)
                if (allCounted && session.status === "SCHEDULED") {
                    await tx.stockAudit.update({
                        where: { id: data.sessionId },
                        data: { status: "IN_PROGRESS" },
                    })
                }
            }
        })

        return { success: true }
    } catch (error) {
        console.error("[submitCycleCountItems]", error)
        return { success: false, error: "Gagal menyimpan hasil hitungan." }
    }
}

export async function finalizeCycleCount(sessionId: string): Promise<{
    success: boolean
    adjustments?: number
    error?: string
}> {
    try {
        const user = await requireAuth()

        let adjustmentCount = 0

        await prisma.$transaction(async (tx) => {
            const session = await tx.stockAudit.findUnique({
                where: { id: sessionId },
                include: {
                    items: {
                        include: {
                            product: { select: { costPrice: true } },
                        },
                    },
                },
            })

            if (!session) throw new Error("Sesi tidak ditemukan")
            if (session.status === "COMPLETED") throw new Error("Sesi sudah selesai")

            const uncounted = session.items.filter((i) => i.actualQty === null)
            if (uncounted.length > 0) {
                throw new Error(`Masih ada ${uncounted.length} produk yang belum dihitung.`)
            }

            for (const item of session.items) {
                const variance = item.actualQty! - item.expectedQty
                if (variance === 0) continue

                adjustmentCount++

                await tx.stockLevel.updateMany({
                    where: {
                        productId: item.productId,
                        warehouseId: session.warehouseId,
                        locationId: null,
                    },
                    data: {
                        quantity: item.actualQty!,
                        availableQty: { increment: variance },
                    },
                })

                await tx.inventoryTransaction.create({
                    data: {
                        productId: item.productId,
                        warehouseId: session.warehouseId,
                        type: "ADJUSTMENT",
                        quantity: variance,
                        unitCost: item.product.costPrice,
                        referenceId: session.id,
                        performedBy: user.id,
                        notes: `Stok Opname: selisih ${variance > 0 ? "+" : ""}${variance}`,
                    },
                })
            }

            await tx.stockAudit.update({
                where: { id: sessionId },
                data: { status: "COMPLETED" },
            })
        })

        return { success: true, adjustments: adjustmentCount }
    } catch (error) {
        const msg = error instanceof Error ? error.message : "Gagal finalisasi"
        console.error("[finalizeCycleCount]", error)
        return { success: false, error: msg }
    }
}
