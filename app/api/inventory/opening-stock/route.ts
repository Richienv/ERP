import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { SYS_ACCOUNTS, ensureSystemAccounts } from "@/lib/gl-accounts"

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

        // Validate all items
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
        }

        // Ensure system GL accounts exist before posting
        await ensureSystemAccounts()

        // Find GL accounts for journal entry
        // DR: Inventory Asset, CR: Retained Earnings (opening balance equity)
        const [inventoryAssetAccount, openingBalanceEquityAccount] = await Promise.all([
            prisma.gLAccount.findFirst({
                where: { code: SYS_ACCOUNTS.INVENTORY_ASSET, type: "ASSET" },
            }),
            prisma.gLAccount.findFirst({
                where: { code: SYS_ACCOUNTS.RETAINED_EARNINGS, type: "EQUITY" },
            }),
        ])

        // Process all items in a transaction
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

                // 2. Upsert StockLevel
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

                // 3. Create GL Journal Entry (only if both accounts exist and totalValue > 0)
                if (inventoryAssetAccount && openingBalanceEquityAccount && totalValue > 0) {
                    await tx.journalEntry.create({
                        data: {
                            date: new Date(),
                            description: `Saldo awal stok — ${item.productId.slice(0, 8)}`,
                            reference: `INIT-${invTx.id.slice(0, 8).toUpperCase()}`,
                            status: "POSTED",
                            inventoryTransactionId: invTx.id,
                            lines: {
                                create: [
                                    {
                                        accountId: inventoryAssetAccount.id,
                                        description: "Persediaan — saldo awal",
                                        debit: totalValue,
                                        credit: 0,
                                    },
                                    {
                                        accountId: openingBalanceEquityAccount.id,
                                        description: "Ekuitas saldo awal",
                                        debit: 0,
                                        credit: totalValue,
                                    },
                                ],
                            },
                        },
                    })

                    // Update GL Account balances
                    await tx.gLAccount.update({
                        where: { id: inventoryAssetAccount.id },
                        data: { balance: { increment: totalValue } },
                    })
                    await tx.gLAccount.update({
                        where: { id: openingBalanceEquityAccount.id },
                        data: { balance: { increment: totalValue } },
                    })
                }

                created.push(invTx)
            }

            return created
        })

        return NextResponse.json({
            success: true,
            count: results.length,
            message: `${results.length} saldo awal stok berhasil disimpan`,
            hasJournal: !!(inventoryAssetAccount && openingBalanceEquityAccount),
        })
    } catch (error) {
        console.error("Error creating opening stock:", error)
        return NextResponse.json({ success: false, error: "Gagal menyimpan saldo awal" }, { status: 500 })
    }
}
