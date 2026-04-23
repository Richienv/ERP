import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: productId } = await params

    // 1. BOM items where this product is used as material
    const bomItems = await prisma.productionBOMItem.findMany({
      where: { materialId: productId },
      include: {
        bom: {
          include: {
            product: { select: { id: true, name: true, code: true } },
          },
        },
      },
    })

    const bomUsages = bomItems.map((item: typeof bomItems[number]) => ({
      id: item.id,
      bomId: item.bomId,
      bomVersion: item.bom.version,
      bomIsActive: item.bom.isActive,
      productId: item.bom.product.id,
      productName: item.bom.product.name,
      productCode: item.bom.product.code,
      quantityPerUnit: Number(item.quantityPerUnit),
      wastePct: Number(item.wastePct),
      unit: item.unit,
    }))

    // 2. Active work orders using BOMs that contain this material
    const activeBomIds = bomItems.map((item: typeof bomItems[number]) => item.bomId)

    const activeWorkOrders = activeBomIds.length > 0
      ? await prisma.workOrder.findMany({
          where: {
            productionBomId: { in: activeBomIds },
            status: { in: ["PLANNED", "IN_PROGRESS"] },
          },
          include: {
            product: { select: { id: true, name: true, code: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        })
      : []

    // Map BOM ID → BOM item for this material (to compute required qty)
    const bomItemByBomId = new Map(
      bomItems.map((item: typeof bomItems[number]) => [item.bomId, item] as const)
    )

    const workOrderData = activeWorkOrders.map((wo: typeof activeWorkOrders[number]) => {
      const bomItem = wo.productionBomId
        ? bomItemByBomId.get(wo.productionBomId)
        : null
      const qtyPerUnit = bomItem ? Number(bomItem.quantityPerUnit) : 0
      const wastePct = bomItem ? Number(bomItem.wastePct) : 0
      const requiredQty = Math.ceil(
        wo.plannedQty * qtyPerUnit * (1 + wastePct / 100)
      )

      return {
        id: wo.id,
        number: wo.number,
        productName: wo.product.name,
        productCode: wo.product.code,
        plannedQty: wo.plannedQty,
        actualQty: wo.actualQty,
        requiredQty,
        status: wo.status,
        startDate: wo.startDate,
        dueDate: wo.dueDate,
      }
    })

    // 3. Stock levels across warehouses
    const stockLevels = await prisma.stockLevel.findMany({
      where: { productId },
      include: {
        warehouse: { select: { id: true, name: true } },
      },
    })

    const totalStock = stockLevels.reduce(
      (sum: number, sl: typeof stockLevels[number]) => sum + Number(sl.quantity), 0
    )
    const totalReserved = stockLevels.reduce(
      (sum: number, sl: typeof stockLevels[number]) => sum + Number(sl.reservedQty), 0
    )
    const totalAvailable = totalStock - totalReserved

    // 4. On-order quantity from active POs
    const poItems = await prisma.purchaseOrderItem.findMany({
      where: {
        productId,
        purchaseOrder: {
          status: { in: ["ORDERED", "SHIPPED", "PARTIAL_RECEIVED", "VENDOR_CONFIRMED"] },
        },
      },
      select: {
        quantity: true,
        receivedQty: true,
      },
    })

    const onOrder = poItems.reduce(
      (sum: number, item: typeof poItems[number]) => sum + (item.quantity - item.receivedQty), 0
    )

    // 5. Active demand from work orders
    const activeDemand = workOrderData.reduce(
      (sum: number, wo: typeof workOrderData[number]) => sum + wo.requiredQty, 0
    )

    // 6. Calculate net available
    const netAvailable = totalAvailable + onOrder - activeDemand

    // 7. Determine supply status
    let supplyStatus: "Cukup" | "Segera Pesan" | "Kurang"
    let supplyColor: "green" | "yellow" | "red"

    if (netAvailable > 0) {
      supplyStatus = "Cukup"
      supplyColor = "green"
    } else if (onOrder > 0) {
      supplyStatus = "Segera Pesan"
      supplyColor = "yellow"
    } else {
      supplyStatus = "Kurang"
      supplyColor = "red"
    }

    return NextResponse.json({
      bomUsages,
      activeWorkOrders: workOrderData,
      stockSummary: {
        totalStock,
        totalReserved,
        totalAvailable,
        onOrder,
        activeDemand,
        netAvailable,
      },
      supplyStatus: {
        label: supplyStatus,
        color: supplyColor,
      },
    })
  } catch (error) {
    console.error("[manufacturing-usage] Error:", error)
    return NextResponse.json(
      { error: "Gagal memuat data manufaktur" },
      { status: 500 }
    )
  }
}
