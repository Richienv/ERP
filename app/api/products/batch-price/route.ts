import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"

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

        // Perform all updates in a single transaction
        const changeLog: Array<{
            productId: string
            productCode: string
            productName: string
            oldCostPrice: number
            newCostPrice: number
            oldSellingPrice: number | null
            newSellingPrice: number | null
            changedBy: string
            changedAt: string
        }> = []

        await prisma.$transaction(
            validUpdates.map((update) => {
                const existing = existingMap.get(update.productId)!
                const data: Record<string, number> = {}

                if (update.newCostPrice !== null && update.newCostPrice !== undefined) {
                    data.costPrice = update.newCostPrice
                }
                if (update.newSellingPrice !== null && update.newSellingPrice !== undefined) {
                    data.sellingPrice = update.newSellingPrice
                }

                changeLog.push({
                    productId: update.productId,
                    productCode: existing.code,
                    productName: existing.name,
                    oldCostPrice: Number(existing.costPrice),
                    newCostPrice: update.newCostPrice ?? Number(existing.costPrice),
                    oldSellingPrice: existing.sellingPrice !== null ? Number(existing.sellingPrice) : null,
                    newSellingPrice: update.newSellingPrice ?? (existing.sellingPrice !== null ? Number(existing.sellingPrice) : null),
                    changedBy: user.email ?? user.id,
                    changedAt: new Date().toISOString(),
                })

                return prisma.product.update({
                    where: { id: update.productId },
                    data,
                })
            })
        )

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
