import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

interface MaterialRow {
    materialId: string
    materialCode: string
    materialName: string
    unit: string
    requiredQty: number
    inStock: number
    onOrder: number
    shortfall: number
    status: "Cukup" | "Perlu Pesan" | "Kurang"
    workOrderNumbers: string[]
}

export async function GET() {
    try {
        // 1. Get all active work orders (PLANNED or IN_PROGRESS) with their ProductionBOM items
        const workOrders = await prisma.workOrder.findMany({
            where: {
                status: { in: ["PLANNED", "IN_PROGRESS"] },
                productionBomId: { not: null },
            },
            select: {
                id: true,
                number: true,
                plannedQty: true,
                productionBom: {
                    select: {
                        items: {
                            select: {
                                materialId: true,
                                quantityPerUnit: true,
                                wastePct: true,
                                unit: true,
                                material: {
                                    select: {
                                        id: true,
                                        code: true,
                                        name: true,
                                        unit: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        })

        // 2. Aggregate material requirements across all work orders
        const materialMap = new Map<
            string,
            {
                materialId: string
                materialCode: string
                materialName: string
                unit: string
                requiredQty: number
                workOrderNumbers: string[]
            }
        >()

        for (const wo of workOrders) {
            if (!wo.productionBom?.items) continue
            for (const item of wo.productionBom.items) {
                const qtyPerUnit = Number(item.quantityPerUnit)
                const wastePct = Number(item.wastePct)
                const required = Math.ceil(qtyPerUnit * wo.plannedQty * (1 + wastePct / 100))

                const existing = materialMap.get(item.materialId)
                if (existing) {
                    existing.requiredQty += required
                    if (!existing.workOrderNumbers.includes(wo.number)) {
                        existing.workOrderNumbers.push(wo.number)
                    }
                } else {
                    materialMap.set(item.materialId, {
                        materialId: item.materialId,
                        materialCode: item.material.code,
                        materialName: item.material.name,
                        unit: item.unit || item.material.unit,
                        requiredQty: required,
                        workOrderNumbers: [wo.number],
                    })
                }
            }
        }

        const materialIds = Array.from(materialMap.keys())

        if (materialIds.length === 0) {
            return NextResponse.json({
                success: true,
                data: {
                    kpi: {
                        totalMaterials: 0,
                        materialsInStock: 0,
                        materialsOnOrder: 0,
                        shortfallCount: 0,
                    },
                    rows: [],
                },
            })
        }

        // 3. Get stock levels (SUM availableQty across all warehouses per material)
        const stockLevels = await prisma.stockLevel.groupBy({
            by: ["productId"],
            where: { productId: { in: materialIds } },
            _sum: { availableQty: true },
        })

        const stockMap = new Map<string, number>()
        for (const sl of stockLevels) {
            stockMap.set(sl.productId, sl._sum.availableQty ?? 0)
        }

        // 4. Get on-order quantities from active POs (ORDERED, SHIPPED, PARTIAL_RECEIVED)
        const poItems = await prisma.purchaseOrderItem.findMany({
            where: {
                productId: { in: materialIds },
                purchaseOrder: {
                    status: { in: ["ORDERED", "SHIPPED", "PARTIAL_RECEIVED", "VENDOR_CONFIRMED"] },
                },
            },
            select: {
                productId: true,
                quantity: true,
                receivedQty: true,
            },
        })

        const onOrderMap = new Map<string, number>()
        for (const poi of poItems) {
            const remaining = poi.quantity - poi.receivedQty
            if (remaining > 0) {
                onOrderMap.set(poi.productId, (onOrderMap.get(poi.productId) ?? 0) + remaining)
            }
        }

        // 5. Build result rows
        const rows: MaterialRow[] = []
        let materialsInStock = 0
        let materialsOnOrder = 0
        let shortfallCount = 0

        for (const [, mat] of materialMap) {
            const inStock = stockMap.get(mat.materialId) ?? 0
            const onOrder = onOrderMap.get(mat.materialId) ?? 0
            const shortfall = Math.max(0, mat.requiredQty - inStock - onOrder)

            let status: MaterialRow["status"]
            if (shortfall === 0 && inStock >= mat.requiredQty) {
                status = "Cukup"
                materialsInStock++
            } else if (shortfall === 0) {
                status = "Perlu Pesan"
                materialsOnOrder++
            } else {
                status = "Kurang"
                shortfallCount++
            }

            rows.push({
                materialId: mat.materialId,
                materialCode: mat.materialCode,
                materialName: mat.materialName,
                unit: mat.unit,
                requiredQty: mat.requiredQty,
                inStock,
                onOrder,
                shortfall,
                status,
                workOrderNumbers: mat.workOrderNumbers,
            })
        }

        // Sort: Kurang first, then Perlu Pesan, then Cukup
        const statusOrder = { Kurang: 0, "Perlu Pesan": 1, Cukup: 2 }
        rows.sort((a, b) => statusOrder[a.status] - statusOrder[b.status])

        return NextResponse.json({
            success: true,
            data: {
                kpi: {
                    totalMaterials: rows.length,
                    materialsInStock,
                    materialsOnOrder,
                    shortfallCount,
                },
                rows,
            },
        })
    } catch (error) {
        console.error("[material-demand] Error:", error)
        return NextResponse.json(
            { success: false, error: "Gagal memuat data kebutuhan material" },
            { status: 500 }
        )
    }
}
