import { prisma } from "@/lib/db"

export type StockHealth = {
    inventoryValue: number
    lowStock: number
    firstLowStockId: string | null
}

type StockHealthRow = {
    value: unknown
    low_stock: unknown
    first_low_id: unknown
}

/**
 * One SQL pass: inventory value + low-stock count by product.
 * Replaces stockLevel.findMany() + JS reduce on the inbox and sidebar.
 */
export async function queryStockHealth(): Promise<StockHealth> {
    try {
        const rows = await prisma.$queryRaw<StockHealthRow[]>`
            SELECT
                COALESCE(SUM(qty * cost), 0) AS value,
                COUNT(*) FILTER (
                    WHERE active
                      AND min_stock > 0
                      AND qty <= min_stock
                ) AS low_stock,
                MIN(id) FILTER (
                    WHERE active
                      AND min_stock > 0
                      AND qty <= min_stock
                ) AS first_low_id
            FROM (
                SELECT
                    p.id,
                    p."isActive" AS active,
                    p."minStock" AS min_stock,
                    p."costPrice" AS cost,
                    COALESCE(SUM(sl.quantity), 0) AS qty
                FROM products p
                LEFT JOIN stock_levels sl ON sl."productId" = p.id
                GROUP BY p.id, p."isActive", p."minStock", p."costPrice"
            ) t
        `
        const row = rows[0]
        return {
            inventoryValue: Number(row?.value ?? 0) || 0,
            lowStock: Number(row?.low_stock ?? 0) || 0,
            firstLowStockId: row?.first_low_id ? String(row.first_low_id) : null,
        }
    } catch (error) {
        if (process.env.VITEST !== "true") {
            console.warn("[stock-aggregates] SQL failed, falling back to Prisma scan:", error)
        }
        return fallbackStockHealth()
    }
}

async function fallbackStockHealth(): Promise<StockHealth> {
    const stockLevels = await prisma.stockLevel.findMany({
        select: {
            quantity: true,
            product: { select: { id: true, costPrice: true, minStock: true, isActive: true } },
        },
    })
    const byProduct = new Map<string, { qty: number; cost: number; min: number; active: boolean }>()
    for (const row of stockLevels) {
        const id = row.product?.id
        if (!id) continue
        const existing = byProduct.get(id) ?? {
            qty: 0,
            cost: Number(row.product?.costPrice || 0),
            min: Number(row.product?.minStock || 0),
            active: row.product?.isActive !== false,
        }
        existing.qty += Number(row.quantity || 0)
        byProduct.set(id, existing)
    }
    let inventoryValue = 0
    let lowStock = 0
    let firstLowStockId: string | null = null
    for (const [id, row] of byProduct) {
        inventoryValue += row.qty * row.cost
        if (row.active && row.min > 0 && row.qty <= row.min) {
            lowStock += 1
            if (!firstLowStockId || id < firstLowStockId) firstLowStockId = id
        }
    }
    return { inventoryValue, lowStock, firstLowStockId }
}
