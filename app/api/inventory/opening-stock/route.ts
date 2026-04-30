import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { SYS_ACCOUNTS, ensureSystemAccounts } from "@/lib/gl-accounts-server"
import { postJournalEntry } from "@/lib/actions/finance-gl"

/**
 * GET /api/inventory/opening-stock
 * Returns products, warehouses, and existing opening stock transactions.
 */
export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const [products, warehouses, existingTransactions] = await Promise.all([
            prisma.product.findMany({
                where: { isActive: true },
                select: { id: true, code: true, name: true, unit: true, costPrice: true },
                orderBy: { name: "asc" },
            }),
            prisma.warehouse.findMany({
                where: { isActive: true },
                select: { id: true, code: true, name: true },
                orderBy: { name: "asc" },
            }),
            prisma.inventoryTransaction.findMany({
                where: { type: "INITIAL" },
                select: {
                    id: true,
                    productId: true,
                    warehouseId: true,
                    quantity: true,
                    unitCost: true,
                    totalValue: true,
                    createdAt: true,
                    product: { select: { code: true, name: true, unit: true } },
                    warehouse: { select: { code: true, name: true } },
                },
                orderBy: { createdAt: "desc" },
            }),
        ])

        return NextResponse.json({
            success: true,
            products: products.map(p => ({
                ...p,
                costPrice: Number(p.costPrice),
            })),
            warehouses,
            existingTransactions: existingTransactions.map(t => ({
                ...t,
                unitCost: t.unitCost ? Number(t.unitCost) : 0,
                totalValue: t.totalValue ? Number(t.totalValue) : 0,
            })),
        })
    } catch (error) {
        console.error("Error fetching opening stock data:", error)
        return NextResponse.json({ success: false, error: "Failed to fetch data" }, { status: 500 })
    }
}

/**
 * POST /api/inventory/opening-stock
 * Bulk create opening stock entries.
 * Body: { items: [{ productId, warehouseId, quantity, unitCost }] }
 *
 * For each item:
 * 1. Creates InventoryTransaction with type INITIAL
 * 2. Upserts StockLevel
 * 3. Creates GL journal entry: DR Inventory Asset, CR Opening Balance Equity
 */
export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const body = await req.json()
        const items: {
            productId: string
            warehouseId: string
            quantity: number
            unitCost: number
        }[] = body.items

        if (!items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ error: "Minimal 1 item diperlukan" }, { status: 400 })
        }

        // Validate all items.
        // MAX_QTY/MAX_UNIT_COST cap each input at 1e9 — already absurdly large
        // for any real factory — so totalValue (qty * unitCost) is bounded by
        // 1e18, well under Decimal(20,2) max (~10^18). Without these bounds,
        // Prisma would error mid-loop on overflow and leave partial state.
        const MAX_QTY = 1e9
        const MAX_UNIT_COST = 1e9
        for (let i = 0; i < items.length; i++) {
            const item = items[i]
            if (!item.productId || !item.warehouseId) {
                return NextResponse.json({ error: `Baris ${i + 1}: Produk dan gudang wajib diisi` }, { status: 400 })
            }
            if (!item.quantity || item.quantity <= 0) {
                return NextResponse.json({ error: `Baris ${i + 1}: Kuantitas harus lebih dari 0` }, { status: 400 })
            }
            if (item.unitCost < 0) {
                return NextResponse.json({ error: `Baris ${i + 1}: Harga satuan tidak boleh negatif` }, { status: 400 })
            }
            if (item.quantity > MAX_QTY) {
                return NextResponse.json({ error: `Baris ${i + 1}: Kuantitas terlalu besar (max ${MAX_QTY.toLocaleString('id-ID')})` }, { status: 400 })
            }
            if (item.unitCost > MAX_UNIT_COST) {
                return NextResponse.json({ error: `Baris ${i + 1}: Harga satuan terlalu besar (max ${MAX_UNIT_COST.toLocaleString('id-ID')})` }, { status: 400 })
            }
        }

        // Ensure system GL accounts exist before posting (idempotent upsert).
        await ensureSystemAccounts()

        // Process all items atomically: stock + GL together. Fail closed —
        // throw on any GL error so we never end up with stock incremented
        // without an opening-balance journal entry (M12 audit fix).
        const now = new Date()
        const results = await prisma.$transaction(async (tx) => {
            const created = []

            for (const item of items) {
                const totalValue = item.quantity * item.unitCost

                // 1. Create InventoryTransaction
                const invTx = await tx.inventoryTransaction.create({
                    data: {
                        productId: item.productId,
                        warehouseId: item.warehouseId,
                        type: "INITIAL",
                        quantity: item.quantity,
                        unitCost: item.unitCost,
                        totalValue: totalValue,
                        performedBy: user.id,
                        notes: "Saldo awal stok",
                    },
                })

                // 2. Upsert StockLevel (relies on the partial unique index
                //    from migration 20260423140000_stock_level_partial_unique
                //    to be race-safe on locationId=NULL).
                const existing = await tx.stockLevel.findFirst({
                    where: {
                        productId: item.productId,
                        warehouseId: item.warehouseId,
                        locationId: null,
                    },
                })

                if (existing) {
                    await tx.stockLevel.update({
                        where: { id: existing.id },
                        data: {
                            quantity: { increment: item.quantity },
                            availableQty: { increment: item.quantity },
                        },
                    })
                } else {
                    await tx.stockLevel.create({
                        data: {
                            productId: item.productId,
                            warehouseId: item.warehouseId,
                            quantity: item.quantity,
                            reservedQty: 0,
                            availableQty: item.quantity,
                        },
                    })
                }

                // 3. GL Journal: DR Persediaan, CR Saldo Awal Ekuitas.
                //    Use OPENING_EQUITY (3900) — semantically correct for
                //    opening balances. RETAINED_EARNINGS (3100) is for accumulated
                //    P&L from prior years, NOT initial setup.
                if (totalValue > 0) {
                    const glResult = await postJournalEntry({
                        description: `Saldo awal stok — ${item.productId.slice(0, 8)}`,
                        date: now,
                        reference: `INIT-${invTx.id.slice(0, 8).toUpperCase()}`,
                        inventoryTransactionId: invTx.id,
                        sourceDocumentType: 'OPENING_STOCK',
                        lines: [
                            { accountCode: SYS_ACCOUNTS.INVENTORY_ASSET, debit: totalValue, credit: 0, description: "Persediaan — saldo awal" },
                            { accountCode: SYS_ACCOUNTS.OPENING_EQUITY, debit: 0, credit: totalValue, description: "Ekuitas saldo awal" },
                        ],
                    }, tx)
                    if (!glResult?.success) {
                        throw new Error(`Gagal posting jurnal saldo awal: ${(glResult as any)?.error || 'Unknown'}`)
                    }
                }

                created.push(invTx)
            }

            return created
        })

        return NextResponse.json({
            success: true,
            count: results.length,
            message: `${results.length} saldo awal stok berhasil disimpan`,
        })
    } catch (error) {
        console.error("Error creating opening stock:", error)
        return NextResponse.json({ success: false, error: "Gagal menyimpan saldo awal" }, { status: 500 })
    }
}
