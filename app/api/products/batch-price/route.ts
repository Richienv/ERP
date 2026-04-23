import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { postInventoryGLEntry } from "@/lib/actions/inventory-gl"

interface PriceUpdate {
    productId: string
    newCostPrice?: number | null
    newSellingPrice?: number | null
}

interface BatchPriceRequest {
    updates: PriceUpdate[]
}

// POST /api/products/batch-price — Batch update product prices
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient()
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const body: BatchPriceRequest = await request.json()

        if (!body.updates || !Array.isArray(body.updates) || body.updates.length === 0) {
            return NextResponse.json(
                { success: false, error: "Tidak ada perubahan harga yang dikirim" },
                { status: 400 }
            )
        }

        // Validate all product IDs exist and collect old prices
        const productIds = body.updates.map((u) => u.productId)
        const existingProducts = await prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, code: true, name: true, costPrice: true, sellingPrice: true },
        })

        const existingMap = new Map(existingProducts.map((p) => [p.id, p]))
        const missingIds = productIds.filter((id) => !existingMap.has(id))
        if (missingIds.length > 0) {
            return NextResponse.json(
                { success: false, error: `Produk tidak ditemukan: ${missingIds.join(", ")}` },
                { status: 404 }
            )
        }

        // Filter to only updates where price actually changed
        const validUpdates = body.updates.filter((u) => {
            return u.newCostPrice !== null && u.newCostPrice !== undefined
                || u.newSellingPrice !== null && u.newSellingPrice !== undefined
        })

        if (validUpdates.length === 0) {
            return NextResponse.json(
                { success: false, error: "Tidak ada perubahan harga yang valid" },
                { status: 400 }
            )
        }

        // Perform all updates + inventory revaluation in a single interactive
        // transaction. For every product whose costPrice changes AND has stock
        // on hand, post a GL entry so Inventory Asset on the balance sheet
        // tracks the new valuation. Without this, costPrice silently mutates
        // while the ledger keeps the old value — Inventory Asset drifts.
        const changeLog: Array<{
            productId: string
            productCode: string
            productName: string
            oldCostPrice: number
            newCostPrice: number
            oldSellingPrice: number | null
            newSellingPrice: number | null
            totalStockQty: number
            revaluationDelta: number
            changedBy: string
            changedAt: string
        }> = []

        await prisma.$transaction(async (tx) => {
            for (const update of validUpdates) {
                const existing = existingMap.get(update.productId)!
                const data: Record<string, number> = {}

                const oldCost = Number(existing.costPrice)
                const newCost = update.newCostPrice ?? oldCost

                if (update.newCostPrice !== null && update.newCostPrice !== undefined) {
                    data.costPrice = update.newCostPrice
                }
                if (update.newSellingPrice !== null && update.newSellingPrice !== undefined) {
                    data.sellingPrice = update.newSellingPrice
                }

                await tx.product.update({
                    where: { id: update.productId },
                    data,
                })

                // Compute revaluation only when costPrice actually changes
                let totalStockQty = 0
                let revaluationDelta = 0
                if (newCost !== oldCost) {
                    const stockAgg = await tx.stockLevel.aggregate({
                        where: { productId: update.productId },
                        _sum: { quantity: true },
                    })
                    totalStockQty = Number(stockAgg._sum.quantity ?? 0)

                    if (totalStockQty > 0) {
                        revaluationDelta = (newCost - oldCost) * totalStockQty

                        // Audit trail: record revaluation as an InventoryTransaction
                        // (qty: 0, totalValue: |delta|) so it shows in movements.
                        const invTx = await tx.inventoryTransaction.create({
                            data: {
                                productId: update.productId,
                                warehouseId: (await tx.stockLevel.findFirst({
                                    where: { productId: update.productId, quantity: { gt: 0 } },
                                    select: { warehouseId: true },
                                }))?.warehouseId ?? "",
                                type: "ADJUSTMENT",
                                quantity: 0,
                                unitCost: newCost,
                                totalValue: Math.abs(revaluationDelta),
                                performedBy: user.id,
                                notes: `Revaluasi harga: ${oldCost} → ${newCost} × ${totalStockQty} unit = ${revaluationDelta >= 0 ? '+' : ''}${revaluationDelta}`,
                            },
                        })

                        await postInventoryGLEntry(tx, {
                            transactionId: invTx.id,
                            type: revaluationDelta > 0 ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
                            productName: existing.name,
                            quantity: totalStockQty,
                            unitCost: newCost,
                            totalValue: Math.abs(revaluationDelta),
                            reference: `REVAL-${existing.code}`,
                            transactionDate: invTx.createdAt,
                        })
                    }
                }

                changeLog.push({
                    productId: update.productId,
                    productCode: existing.code,
                    productName: existing.name,
                    oldCostPrice: oldCost,
                    newCostPrice: newCost,
                    oldSellingPrice: existing.sellingPrice !== null ? Number(existing.sellingPrice) : null,
                    newSellingPrice: update.newSellingPrice ?? (existing.sellingPrice !== null ? Number(existing.sellingPrice) : null),
                    totalStockQty,
                    revaluationDelta,
                    changedBy: user.email ?? user.id,
                    changedAt: new Date().toISOString(),
                })
            }
        })

        return NextResponse.json({
            success: true,
            message: `${validUpdates.length} produk berhasil diupdate`,
            updated: validUpdates.length,
            changeLog,
        })
    } catch (error) {
        console.error("Error batch updating prices:", error)
        return NextResponse.json(
            { success: false, error: "Gagal update harga massal" },
            { status: 500 }
        )
    }
}
