import { prisma } from "@/lib/db"

export type StockHealth = {
    inventoryValue: number
    lowStock: number
    firstLowStockId: string | null
}

export type InventoryDashboardKpis = {
    totalProducts: number
    lowStock: number
    totalValue: number
    warehouseCount: number
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

type InventoryKpiRow = {
    value: unknown
    product_count: unknown
    low_stock: unknown
}

/**
 * Dashboard / stats KPI: value + product count + LOW_STOCK+CRITICAL
 * matching calculateProductStatus (zero stock = critical; NEW <24h excluded).
 */
export async function queryInventoryDashboardKpis(): Promise<InventoryDashboardKpis> {
    try {
        const [rows, warehouseCount] = await Promise.all([
            prisma.$queryRaw<InventoryKpiRow[]>`
                SELECT
                    COALESCE(SUM(qty * cost) FILTER (WHERE active), 0) AS value,
                    COUNT(*) FILTER (WHERE active) AS product_count,
                    COUNT(*) FILTER (
                        WHERE active AND (
                            qty = 0
                            OR (
                                created_at <= NOW() - INTERVAL '24 hours'
                                AND (
                                    qty <= min_stock
                                    OR qty < COALESCE(NULLIF(reorder, 0), min_stock, 0)
                                )
                            )
                        )
                    ) AS low_stock
                FROM (
                    SELECT
                        p."isActive" AS active,
                        p."minStock" AS min_stock,
                        p."reorderLevel" AS reorder,
                        p."costPrice" AS cost,
                        p."createdAt" AS created_at,
                        COALESCE(SUM(sl.quantity), 0) AS qty
                    FROM products p
                    LEFT JOIN stock_levels sl ON sl."productId" = p.id
                    GROUP BY p.id, p."isActive", p."minStock", p."reorderLevel", p."costPrice", p."createdAt"
                ) t
            `,
            prisma.warehouse.count(),
        ])
        const row = rows[0]
        return {
            totalProducts: Number(row?.product_count ?? 0) || 0,
            lowStock: Number(row?.low_stock ?? 0) || 0,
            totalValue: Number(row?.value ?? 0) || 0,
            warehouseCount,
        }
    } catch (error) {
        if (process.env.VITEST !== "true") {
            console.warn("[stock-aggregates] KPI SQL failed, falling back:", error)
        }
        const [health, totalProducts, warehouseCount] = await Promise.all([
            queryStockHealth(),
            prisma.product.count({ where: { isActive: true } }),
            prisma.warehouse.count(),
        ])
        return {
            totalProducts,
            lowStock: health.lowStock,
            totalValue: health.inventoryValue,
            warehouseCount,
        }
    }
}

export type WarehouseInventoryRow = {
    name: string
    code: string
    value: number
    itemCount: number
    productCount: number
}

type WarehouseSqlRow = {
    name: unknown
    code: unknown
    value: unknown
    item_count: unknown
    product_count: unknown
}

/** Per-warehouse inventory value without loading every stockLevel row. */
export async function queryWarehouseInventory(): Promise<{
    value: number
    itemCount: number
    warehouses: WarehouseInventoryRow[]
}> {
    try {
        const rows = await prisma.$queryRaw<WarehouseSqlRow[]>`
            SELECT
                w.name,
                w.code,
                COALESCE(SUM(
                    sl.quantity * COALESCE(NULLIF(p."costPrice", 0), p."sellingPrice", 0)
                ), 0) AS value,
                COALESCE(SUM(sl.quantity), 0) AS item_count,
                COUNT(DISTINCT p.id) AS product_count
            FROM warehouses w
            JOIN stock_levels sl ON sl."warehouseId" = w.id
            JOIN products p ON p.id = sl."productId"
            WHERE w."isActive" = true
              AND p."isActive" = true
              AND sl.quantity > 0
            GROUP BY w.id, w.name, w.code
            ORDER BY value DESC
        `
        const warehouses = rows.map((row) => ({
            name: String(row.name ?? ""),
            code: String(row.code ?? ""),
            value: Number(row.value ?? 0) || 0,
            itemCount: Number(row.item_count ?? 0) || 0,
            productCount: Number(row.product_count ?? 0) || 0,
        }))
        return {
            value: warehouses.reduce((sum, row) => sum + row.value, 0),
            itemCount: warehouses.reduce((sum, row) => sum + row.itemCount, 0),
            warehouses,
        }
    } catch (error) {
        if (process.env.VITEST !== "true") {
            console.warn("[stock-aggregates] warehouse SQL failed, falling back:", error)
        }
        const health = await queryStockHealth()
        return { value: health.inventoryValue, itemCount: 0, warehouses: [] }
    }
}
