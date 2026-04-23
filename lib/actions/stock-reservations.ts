"use server"

import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { postInventoryGLEntry } from "@/lib/actions/inventory-gl"
import { calculateBOMRequirements } from "@/lib/reservation-helpers"

// ---------------------------------------------------------------------------
// Auth helper (read-only pattern — no withPrismaAuth needed for queries)
// ---------------------------------------------------------------------------

async function requireAuth() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) throw new Error("Unauthorized")
  return user
}

// ---------------------------------------------------------------------------
// Types for return values
// ---------------------------------------------------------------------------

export type ReservationResult = {
  materialId: string
  materialName: string
  requiredQty: number
  reservedQty: number
  shortfall: number
  reservationId: string
  /** FULL = required fully reserved, PARTIAL = some shortfall, NONE = no
   * stock available. Callers MUST inspect this — silent partial reservation
   * was a documented bug (production starting against insufficient material). */
  status: "FULL" | "PARTIAL" | "NONE"
}

// ---------------------------------------------------------------------------
// 1. Reserve stock for a work order based on its Production BOM
// ---------------------------------------------------------------------------

export async function reserveStockForWorkOrder(
  workOrderId: string,
  warehouseId: string
): Promise<ReservationResult[]> {
  const user = await requireAuth()

  return prisma.$transaction(async (tx) => {
    // Load work order with production BOM items
    const workOrder = await tx.workOrder.findUnique({
      where: { id: workOrderId },
      include: {
        productionBom: {
          include: {
            items: {
              include: {
                material: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    })

    if (!workOrder) {
      throw new Error("Work Order tidak ditemukan")
    }
    if (!workOrder.productionBom) {
      throw new Error(
        "Work Order belum memiliki Production BOM. Buat BOM terlebih dahulu."
      )
    }
    if (workOrder.status !== "PLANNED" && workOrder.status !== "IN_PROGRESS") {
      throw new Error(
        `Reservasi hanya bisa dilakukan untuk WO berstatus PLANNED atau IN_PROGRESS (saat ini: ${workOrder.status})`
      )
    }

    const bomItems = workOrder.productionBom.items
    if (bomItems.length === 0) {
      throw new Error("Production BOM tidak memiliki material")
    }

    // Calculate required quantities per material
    const requirements = calculateBOMRequirements(
      bomItems.map((item) => ({
        materialId: item.materialId,
        quantityPerUnit: Number(item.quantityPerUnit),
        wastePct: Number(item.wastePct),
        unit: item.unit ?? "",
      })),
      workOrder.plannedQty
    )

    const results: ReservationResult[] = []

    for (const req of requirements) {
      // Find the BOM item to get material name
      const bomItem = bomItems.find((bi) => bi.materialId === req.materialId)!

      // Read existing reservation for this (WO, product, warehouse) so we can
      // compute the *delta* — re-reserving must not double-decrement
      // availableQty.
      const existingReservation = await tx.stockReservation.findUnique({
        where: {
          workOrderId_productId_warehouseId: {
            workOrderId,
            productId: req.materialId,
            warehouseId,
          },
        },
      })
      const oldReservedQty = existingReservation?.reservedQty ?? 0

      // Get current stock level for this product+warehouse
      const stockLevel = await tx.stockLevel.findFirst({
        where: {
          productId: req.materialId,
          warehouseId,
          locationId: null, // Main warehouse level (not bin-specific)
        },
      })

      const availableQty = stockLevel?.availableQty ?? 0
      // True free = currently available + amount already reserved by THIS WO
      // (we can re-allocate our own slice without "borrowing" from others).
      const trueFreeQty = availableQty + oldReservedQty
      const reservedQty = Math.min(req.requiredQty, trueFreeQty)
      const shortfall = Math.max(0, req.requiredQty - reservedQty)
      const delta = reservedQty - oldReservedQty

      // Upsert reservation (unique on workOrderId+productId+warehouseId)
      const reservation = await tx.stockReservation.upsert({
        where: {
          workOrderId_productId_warehouseId: {
            workOrderId,
            productId: req.materialId,
            warehouseId,
          },
        },
        create: {
          workOrderId,
          productId: req.materialId,
          warehouseId,
          reservedQty,
          status: "ACTIVE",
        },
        update: {
          reservedQty,
          status: "ACTIVE",
        },
      })

      // Apply only the delta — positive = reserve more, negative = release some.
      if (delta !== 0 && stockLevel) {
        await tx.stockLevel.update({
          where: { id: stockLevel.id },
          data: {
            availableQty: { decrement: delta },
            reservedQty: { increment: delta },
          },
        })
      }

      const status: ReservationResult["status"] =
        reservedQty === 0 ? "NONE" : shortfall === 0 ? "FULL" : "PARTIAL"

      results.push({
        materialId: req.materialId,
        materialName: bomItem.material.name,
        requiredQty: req.requiredQty,
        reservedQty,
        shortfall,
        reservationId: reservation.id,
        status,
      })
    }

    return results
  })
}

// ---------------------------------------------------------------------------
// 2. Consume reservation — record material usage during production
// ---------------------------------------------------------------------------

export async function consumeReservation(
  reservationId: string,
  qty: number
): Promise<{ success: boolean; message: string }> {
  const user = await requireAuth()

  if (qty <= 0) {
    throw new Error("Jumlah konsumsi harus lebih dari 0")
  }

  await prisma.$transaction(async (tx) => {
    const reservation = await tx.stockReservation.findUnique({
      where: { id: reservationId },
      include: {
        workOrder: { select: { id: true, number: true } },
        product: { select: { id: true, name: true, costPrice: true } },
      },
    })

    if (!reservation) {
      throw new Error("Reservasi tidak ditemukan")
    }
    if (reservation.status !== "ACTIVE") {
      throw new Error(
        `Reservasi berstatus ${reservation.status}, hanya reservasi ACTIVE yang bisa dikonsumsi`
      )
    }

    const remaining = reservation.reservedQty - reservation.consumedQty
    if (qty > remaining) {
      throw new Error(
        `Jumlah konsumsi (${qty}) melebihi sisa reservasi (${remaining})`
      )
    }

    const newConsumedQty = reservation.consumedQty + qty
    const isFullyConsumed = newConsumedQty >= reservation.reservedQty

    // Update reservation
    await tx.stockReservation.update({
      where: { id: reservationId },
      data: {
        consumedQty: newConsumedQty,
        status: isFullyConsumed ? "CONSUMED" : "ACTIVE",
      },
    })

    // Update stock level: decrease physical quantity and reserved tracking
    // Note: availableQty stays the same because it was already decremented during reservation
    const stockLevel = await tx.stockLevel.findFirst({
      where: {
        productId: reservation.productId,
        warehouseId: reservation.warehouseId,
        locationId: null,
      },
    })

    if (!stockLevel) {
      throw new Error(
        `StockLevel tidak ditemukan untuk product ${reservation.product.name} di gudang reservasi — konsumsi dibatalkan`
      )
    }

    await tx.stockLevel.update({
      where: { id: stockLevel.id },
      data: {
        quantity: { decrement: qty },
        reservedQty: { decrement: qty },
      },
    })

    // Create inventory transaction for audit trail (with cost data)
    const unitCost = reservation.product.costPrice ? Number(reservation.product.costPrice) : 0
    const totalValue = unitCost * qty

    const invTx = await tx.inventoryTransaction.create({
      data: {
        productId: reservation.productId,
        warehouseId: reservation.warehouseId,
        type: "PRODUCTION_OUT",
        quantity: -qty, // Negative for outbound
        unitCost: unitCost > 0 ? unitCost : undefined,
        totalValue: totalValue > 0 ? totalValue : undefined,
        workOrderId: reservation.workOrderId,
        referenceId: reservationId,
        performedBy: user.id,
        notes: `Konsumsi material untuk WO ${reservation.workOrder.number}: ${reservation.product.name} x${qty}`,
      },
    })

    // Post GL entry: DR WIP (1320) / CR Raw Materials (1310)
    if (totalValue > 0) {
      await postInventoryGLEntry(tx, {
        transactionId: invTx.id,
        type: 'PRODUCTION_OUT',
        productName: reservation.product.name,
        quantity: qty,
        unitCost,
        totalValue,
        reference: `WO ${reservation.workOrder.number}`,
        transactionDate: invTx.createdAt,
      })
    }
  })

  revalidatePath("/inventory")
  revalidatePath("/inventory/stock")
  revalidatePath("/inventory/movements")
  revalidatePath("/manufacturing/orders")

  return { success: true, message: `Berhasil mengkonsumsi ${qty} unit material` }
}

// ---------------------------------------------------------------------------
// 3. Release reservation — return unreserved stock back to available pool
// ---------------------------------------------------------------------------

export async function releaseReservation(
  reservationId: string
): Promise<{ success: boolean; releasedQty: number; message: string }> {
  const user = await requireAuth()

  let releasedQty = 0

  await prisma.$transaction(async (tx) => {
    const reservation = await tx.stockReservation.findUnique({
      where: { id: reservationId },
      include: {
        workOrder: { select: { number: true } },
        product: { select: { name: true } },
      },
    })

    if (!reservation) {
      throw new Error("Reservasi tidak ditemukan")
    }
    if (reservation.status !== "ACTIVE") {
      throw new Error(
        `Reservasi berstatus ${reservation.status}, hanya reservasi ACTIVE yang bisa dirilis`
      )
    }

    const remainingQty = reservation.reservedQty - reservation.consumedQty - reservation.releasedQty

    if (remainingQty <= 0) {
      throw new Error("Tidak ada sisa reservasi untuk dirilis")
    }

    releasedQty = remainingQty

    // Update reservation status
    await tx.stockReservation.update({
      where: { id: reservationId },
      data: {
        releasedQty: reservation.releasedQty + remainingQty,
        status: "RELEASED",
      },
    })

    // Return stock to available pool
    const stockLevel = await tx.stockLevel.findFirst({
      where: {
        productId: reservation.productId,
        warehouseId: reservation.warehouseId,
        locationId: null,
      },
    })

    if (!stockLevel) {
      throw new Error(
        `StockLevel tidak ditemukan untuk product ${reservation.product.name} di gudang reservasi — release dibatalkan`
      )
    }

    await tx.stockLevel.update({
      where: { id: stockLevel.id },
      data: {
        availableQty: { increment: remainingQty },
        reservedQty: { decrement: remainingQty },
      },
    })
  })

  revalidatePath("/inventory")
  revalidatePath("/inventory/stock")
  revalidatePath("/inventory/movements")
  revalidatePath("/manufacturing/orders")

  return {
    success: true,
    releasedQty,
    message: `Berhasil merilis ${releasedQty} unit kembali ke stok tersedia`,
  }
}

// ---------------------------------------------------------------------------
// 4. Get all reservations for a work order
// ---------------------------------------------------------------------------

export async function getReservationsForWorkOrder(workOrderId: string) {
  await requireAuth()

  const reservations = await prisma.stockReservation.findMany({
    where: { workOrderId },
    include: {
      product: {
        select: {
          id: true,
          code: true,
          name: true,
          unit: true,
        },
      },
      warehouse: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  })

  return reservations.map((r) => ({
    id: r.id,
    productId: r.productId,
    productCode: r.product.code,
    productName: r.product.name,
    unit: r.product.unit,
    warehouseId: r.warehouseId,
    warehouseCode: r.warehouse.code,
    warehouseName: r.warehouse.name,
    reservedQty: r.reservedQty,
    consumedQty: r.consumedQty,
    releasedQty: r.releasedQty,
    remainingQty: r.reservedQty - r.consumedQty - r.releasedQty,
    status: r.status,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }))
}

// ---------------------------------------------------------------------------
// 5. Get all ACTIVE reservations for a product, grouped by work order
// ---------------------------------------------------------------------------

export async function getReservationsForProduct(productId: string) {
  await requireAuth()

  const reservations = await prisma.stockReservation.findMany({
    where: {
      productId,
      status: "ACTIVE",
    },
    include: {
      workOrder: {
        select: {
          id: true,
          number: true,
          status: true,
          plannedQty: true,
          dueDate: true,
          product: {
            select: { name: true },
          },
        },
      },
      warehouse: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  })

  // Group by work order
  const grouped = new Map<
    string,
    {
      workOrderId: string
      workOrderNumber: string
      workOrderStatus: string
      finishedGoodName: string
      plannedQty: number
      dueDate: Date | null
      reservations: Array<{
        id: string
        warehouseCode: string
        warehouseName: string
        reservedQty: number
        consumedQty: number
        remainingQty: number
      }>
    }
  >()

  for (const r of reservations) {
    const key = r.workOrderId
    if (!grouped.has(key)) {
      grouped.set(key, {
        workOrderId: r.workOrder.id,
        workOrderNumber: r.workOrder.number,
        workOrderStatus: r.workOrder.status,
        finishedGoodName: r.workOrder.product.name,
        plannedQty: r.workOrder.plannedQty,
        dueDate: r.workOrder.dueDate,
        reservations: [],
      })
    }
    grouped.get(key)!.reservations.push({
      id: r.id,
      warehouseCode: r.warehouse.code,
      warehouseName: r.warehouse.name,
      reservedQty: r.reservedQty,
      consumedQty: r.consumedQty,
      remainingQty: r.reservedQty - r.consumedQty - r.releasedQty,
    })
  }

  return Array.from(grouped.values())
}
