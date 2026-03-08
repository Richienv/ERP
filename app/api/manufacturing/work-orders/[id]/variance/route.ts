import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { calculateMaterialVariance } from "@/lib/material-variance"

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        const wo = await prisma.workOrder.findUnique({
            where: { id },
            select: {
                id: true,
                number: true,
                plannedQty: true,
                actualQty: true,
                productionBom: {
                    include: {
                        items: {
                            include: {
                                material: {
                                    select: { id: true, code: true, name: true, unit: true, costPrice: true },
                                },
                            },
                        },
                    },
                },
            },
        })

        if (!wo || !wo.productionBom) {
            return NextResponse.json({ success: false, error: "Work order or BOM not found" }, { status: 404 })
        }

        // Get actual consumption transactions
        const transactions = await prisma.inventoryTransaction.findMany({
            where: {
                workOrderId: id,
                type: "PRODUCTION_OUT",
            },
            select: {
                productId: true,
                quantity: true,
                unitCost: true,
                totalValue: true,
            },
        })

        const bomItems = wo.productionBom.items.map((item) => ({
            materialId: item.materialId,
            materialCode: item.material.code,
            materialName: item.material.name,
            unit: item.unit ?? item.material.unit,
            quantityPerUnit: Number(item.quantityPerUnit),
            wastePct: Number(item.wastePct),
            currentCostPrice: Number(item.material.costPrice),
        }))

        const txInputs = transactions.map((tx) => ({
            productId: tx.productId,
            quantity: tx.quantity,
            unitCost: Number(tx.unitCost),
            totalValue: Number(tx.totalValue),
        }))

        const result = calculateMaterialVariance(
            { id: wo.id, number: wo.number, plannedQty: wo.plannedQty, actualQty: wo.actualQty },
            bomItems,
            txInputs
        )

        return NextResponse.json({ success: true, data: result })
    } catch (error) {
        console.error("Material variance error:", error)
        return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 })
    }
}
