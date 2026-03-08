import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

const WO_STATE_TRANSITIONS: Record<string, string[]> = {
    PLANNED: ['IN_PROGRESS', 'ON_HOLD', 'CANCELLED'],
    IN_PROGRESS: ['ON_HOLD', 'CANCELLED', 'COMPLETED'],
    ON_HOLD: ['IN_PROGRESS', 'CANCELLED'],
    COMPLETED: [],
    CANCELLED: [],
}

function assertWorkOrderTransition(current: string, target: string) {
    const allowed = WO_STATE_TRANSITIONS[current] || []
    if (!allowed.includes(target)) {
        throw new Error(`Invalid transition: ${current} -> ${target}`)
    }
}

function ledgerBalanceDelta(accountType: string, debit: number, credit: number) {
    if (accountType === 'ASSET' || accountType === 'EXPENSE') {
        return debit - credit
    }
    return credit - debit
}

async function postJournalWithBalanceUpdate(
    tx: Prisma.TransactionClient,
    data: {
        description: string
        reference: string
        lines: Array<{ accountCode: string; debit: number; credit: number; description?: string }>
    }
) {
    const totalDebit = data.lines.reduce((s, line) => s + line.debit, 0)
    const totalCredit = data.lines.reduce((s, line) => s + line.credit, 0)
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
        throw new Error('Unbalanced journal entry')
    }

    const accountCodes = Array.from(new Set(data.lines.map((line) => line.accountCode)))
    const accounts = await tx.gLAccount.findMany({
        where: { code: { in: accountCodes } },
    })
    const accountMap = new Map(accounts.map((account) => [account.code, account]))

    for (const code of accountCodes) {
        if (!accountMap.has(code)) {
            throw new Error(`GL account not configured: ${code}`)
        }
    }

    await tx.journalEntry.create({
        data: {
            date: new Date(),
            description: data.description,
            reference: data.reference,
            status: 'POSTED',
            lines: {
                create: data.lines.map((line) => {
                    const account = accountMap.get(line.accountCode)!
                    return {
                        accountId: account.id,
                        debit: line.debit,
                        credit: line.credit,
                        description: line.description || data.description,
                    }
                }),
            },
        },
    })

    for (const line of data.lines) {
        const account = accountMap.get(line.accountCode)!
        const delta = ledgerBalanceDelta(account.type, line.debit, line.credit)
        await tx.gLAccount.update({
            where: { id: account.id },
            data: { balance: { increment: delta } },
        })
    }
}

async function executeProductionPosting(
    tx: Prisma.TransactionClient,
    params: {
        workOrderId: string
        quantityProduced: number
        warehouseId: string
        performedBy?: string
        note?: string
    }
) {
    const workOrder = await tx.workOrder.findUnique({
        where: { id: params.workOrderId },
        include: {
            product: {
                include: {
                    BillOfMaterials: {
                        where: { isActive: true },
                        include: {
                            items: {
                                include: { material: true },
                            },
                        },
                        take: 1,
                    },
                },
            },
        },
    })

    if (!workOrder) {
        throw new Error('Work order not found')
    }

    const bom = workOrder.product.BillOfMaterials[0]
    if (!bom || bom.items.length === 0) {
        throw new Error(`No active BOM found for product ${workOrder.product.code}`)
    }

    if (params.quantityProduced <= 0) {
        throw new Error('Produced quantity must be greater than 0')
    }

    let totalMaterialCost = 0

    for (const item of bom.items) {
        const perUnit = Number(item.quantity)
        const waste = Number(item.wastePct || 0) / 100
        const requiredQty = Math.ceil(perUnit * params.quantityProduced * (1 + waste))
        if (requiredQty <= 0) continue

        const sourceLevel = await tx.stockLevel.findFirst({
            where: {
                productId: item.materialId,
                warehouseId: params.warehouseId,
            },
        })

        if (!sourceLevel || sourceLevel.quantity < requiredQty) {
            throw new Error(`Insufficient stock for ${item.material.code}. Need ${requiredQty}, available ${sourceLevel?.quantity || 0}`)
        }

        await tx.stockLevel.update({
            where: { id: sourceLevel.id },
            data: {
                quantity: { decrement: requiredQty },
                availableQty: { decrement: requiredQty },
            },
        })

        const unitCost = Number(item.material.costPrice || 0)
        totalMaterialCost += unitCost * requiredQty

        await tx.inventoryTransaction.create({
            data: {
                productId: item.materialId,
                warehouseId: params.warehouseId,
                workOrderId: workOrder.id,
                type: 'PRODUCTION_OUT',
                quantity: -requiredQty,
                unitCost: unitCost,
                totalValue: unitCost * requiredQty,
                performedBy: params.performedBy,
                notes: params.note || `WO ${workOrder.number} material consumption`,
            },
        })
    }

    const finishedLevel = await tx.stockLevel.findFirst({
        where: { productId: workOrder.productId, warehouseId: params.warehouseId },
    })

    if (finishedLevel) {
        await tx.stockLevel.update({
            where: { id: finishedLevel.id },
            data: {
                quantity: { increment: params.quantityProduced },
                availableQty: { increment: params.quantityProduced },
            },
        })
    } else {
        await tx.stockLevel.create({
            data: {
                productId: workOrder.productId,
                warehouseId: params.warehouseId,
                quantity: params.quantityProduced,
                availableQty: params.quantityProduced,
            },
        })
    }

    const fgUnitCost = params.quantityProduced > 0 ? totalMaterialCost / params.quantityProduced : 0
    await tx.inventoryTransaction.create({
        data: {
            productId: workOrder.productId,
            warehouseId: params.warehouseId,
            workOrderId: workOrder.id,
            type: 'PRODUCTION_IN',
            quantity: params.quantityProduced,
            unitCost: fgUnitCost,
            totalValue: totalMaterialCost,
            performedBy: params.performedBy,
            notes: params.note || `WO ${workOrder.number} finished goods receipt`,
        },
    })

    if (totalMaterialCost > 0) {
        await postJournalWithBalanceUpdate(tx, {
            description: `WO ${workOrder.number} - Material to WIP`,
            reference: workOrder.number,
            lines: [
                { accountCode: '1320', debit: totalMaterialCost, credit: 0, description: 'WIP increase' },
                { accountCode: '1310', debit: 0, credit: totalMaterialCost, description: 'Raw material decrease' },
            ],
        })

        await postJournalWithBalanceUpdate(tx, {
            description: `WO ${workOrder.number} - WIP to Finished Goods`,
            reference: workOrder.number,
            lines: [
                { accountCode: '1300', debit: totalMaterialCost, credit: 0, description: 'Finished goods increase' },
                { accountCode: '1320', debit: 0, credit: totalMaterialCost, description: 'WIP release' },
            ],
        })
    }

    return { workOrder, totalMaterialCost }
}

async function executeProductionReturn(
    tx: Prisma.TransactionClient,
    params: {
        workOrderId: string
        returnQty: number
        warehouseId: string
        reason: string
        performedBy?: string
    }
) {
    const workOrder = await tx.workOrder.findUnique({
        where: { id: params.workOrderId },
        include: {
            product: {
                include: {
                    BillOfMaterials: {
                        where: { isActive: true },
                        include: {
                            items: {
                                include: { material: true },
                            },
                        },
                        take: 1,
                    },
                },
            },
        },
    })

    if (!workOrder) {
        throw new Error('Work order not found')
    }

    if (workOrder.actualQty < params.returnQty) {
        throw new Error(
            `Qty retur (${params.returnQty}) melebihi qty aktual (${workOrder.actualQty})`
        )
    }

    const bom = workOrder.product.BillOfMaterials[0]
    if (!bom || bom.items.length === 0) {
        throw new Error(`No active BOM found for product ${workOrder.product.code}`)
    }

    // 1. Decrease finished goods stock
    const fgLevel = await tx.stockLevel.findFirst({
        where: { productId: workOrder.productId, warehouseId: params.warehouseId },
    })

    if (!fgLevel || fgLevel.quantity < params.returnQty) {
        throw new Error(
            `Stok barang jadi tidak cukup untuk retur. Tersedia: ${fgLevel?.quantity || 0}, dibutuhkan: ${params.returnQty}`
        )
    }

    await tx.stockLevel.update({
        where: { id: fgLevel.id },
        data: {
            quantity: { decrement: params.returnQty },
            availableQty: { decrement: params.returnQty },
        },
    })

    const fgUnitCost = Number(workOrder.product.costPrice || 0)
    const fgTotalValue = fgUnitCost * params.returnQty

    // InventoryTransaction: PRODUCTION_RETURN (finished goods decrease)
    await tx.inventoryTransaction.create({
        data: {
            productId: workOrder.productId,
            warehouseId: params.warehouseId,
            workOrderId: workOrder.id,
            type: 'PRODUCTION_RETURN',
            quantity: -params.returnQty,
            unitCost: fgUnitCost,
            totalValue: fgTotalValue,
            performedBy: params.performedBy,
            notes: `Retur produksi WO ${workOrder.number}: ${params.reason}`,
        },
    })

    // 2. Increase raw materials stock (reverse BOM consumption)
    let totalMaterialCost = 0

    for (const item of bom.items) {
        const perUnit = Number(item.quantity)
        const waste = Number(item.wastePct || 0) / 100
        const returnMaterialQty = Math.ceil(perUnit * params.returnQty * (1 + waste))
        if (returnMaterialQty <= 0) continue

        const materialLevel = await tx.stockLevel.findFirst({
            where: { productId: item.materialId, warehouseId: params.warehouseId },
        })

        const unitCost = Number(item.material.costPrice || 0)
        totalMaterialCost += unitCost * returnMaterialQty

        if (materialLevel) {
            await tx.stockLevel.update({
                where: { id: materialLevel.id },
                data: {
                    quantity: { increment: returnMaterialQty },
                    availableQty: { increment: returnMaterialQty },
                },
            })
        } else {
            await tx.stockLevel.create({
                data: {
                    productId: item.materialId,
                    warehouseId: params.warehouseId,
                    quantity: returnMaterialQty,
                    availableQty: returnMaterialQty,
                },
            })
        }

        // InventoryTransaction: MATERIAL_RETURN (raw material increase)
        await tx.inventoryTransaction.create({
            data: {
                productId: item.materialId,
                warehouseId: params.warehouseId,
                workOrderId: workOrder.id,
                type: 'MATERIAL_RETURN',
                quantity: returnMaterialQty,
                unitCost: unitCost,
                totalValue: unitCost * returnMaterialQty,
                performedBy: params.performedBy,
                notes: `Retur material WO ${workOrder.number}: ${params.reason}`,
            },
        })
    }

    // 3. GL reversal: DR Raw Materials (1310), CR Finished Goods (1300)
    if (totalMaterialCost > 0) {
        await postJournalWithBalanceUpdate(tx, {
            description: `WO ${workOrder.number} - Retur Produksi: ${params.reason}`,
            reference: workOrder.number,
            lines: [
                { accountCode: '1310', debit: totalMaterialCost, credit: 0, description: 'Retur bahan baku masuk' },
                { accountCode: '1300', debit: 0, credit: totalMaterialCost, description: 'Barang jadi dikurangi' },
            ],
        })
    }

    // 4. Adjust work order completed qty
    const newActualQty = workOrder.actualQty - params.returnQty
    const newStatus = newActualQty <= 0 ? 'IN_PROGRESS' : workOrder.status

    return await tx.workOrder.update({
        where: { id: workOrder.id },
        data: {
            actualQty: newActualQty,
            status: newStatus === 'COMPLETED' ? 'IN_PROGRESS' : newStatus,
        },
        include: { product: true },
    })
}

// --- Stock Reservation Helpers ---
// Reserve BOM materials when a Work Order starts production (IN_PROGRESS).
async function reserveStockForWorkOrder(workOrderId: string) {
    const wo = await prisma.workOrder.findUnique({
        where: { id: workOrderId },
        include: {
            productionBom: {
                include: { items: true },
            },
            product: {
                include: {
                    BillOfMaterials: {
                        where: { isActive: true },
                        include: { items: true },
                        take: 1,
                    },
                },
            },
        },
    })
    if (!wo) return

    // Use ProductionBOM if available, fallback to legacy BOM
    const bomItems = wo.productionBom?.items ?? wo.product.BillOfMaterials[0]?.items ?? []
    if (bomItems.length === 0) return

    const defaultWarehouse = await prisma.warehouse.findFirst({
        where: { isActive: true },
        select: { id: true },
        orderBy: { createdAt: "asc" },
    })
    if (!defaultWarehouse) return

    for (const item of bomItems) {
        const perUnit = Number("quantityPerUnit" in item ? item.quantityPerUnit : (item as any).quantity)
        const waste = Number("wastePct" in item ? item.wastePct : 0) / 100
        const requiredQty = Math.ceil(perUnit * wo.plannedQty * (1 + waste))
        if (requiredQty <= 0) continue

        const stockLevel = await prisma.stockLevel.findFirst({
            where: { productId: item.materialId, warehouseId: defaultWarehouse.id },
        })

        const reserveQty = Math.min(requiredQty, stockLevel?.availableQty ?? 0)
        if (reserveQty <= 0) continue

        if (stockLevel) {
            await prisma.stockLevel.update({
                where: { id: stockLevel.id },
                data: {
                    availableQty: { decrement: reserveQty },
                    reservedQty: { increment: reserveQty },
                },
            })
        }

        await prisma.stockReservation.upsert({
            where: {
                workOrderId_productId_warehouseId: {
                    workOrderId,
                    productId: item.materialId,
                    warehouseId: defaultWarehouse.id,
                },
            },
            create: {
                workOrderId,
                productId: item.materialId,
                warehouseId: defaultWarehouse.id,
                reservedQty: reserveQty,
                status: "ACTIVE",
            },
            update: {
                reservedQty: reserveQty,
                status: "ACTIVE",
            },
        })
    }

    console.log(`[StockReservation] Reserved materials for WO ${wo.number}`)
}

// Release all active reservations when a Work Order is cancelled.
async function releaseReservationsForWorkOrder(workOrderId: string) {
    const reservations = await prisma.stockReservation.findMany({
        where: { workOrderId, status: "ACTIVE" },
    })

    for (const reservation of reservations) {
        const releaseQty = reservation.reservedQty - reservation.consumedQty
        if (releaseQty <= 0) continue

        const stockLevel = await prisma.stockLevel.findFirst({
            where: { productId: reservation.productId, warehouseId: reservation.warehouseId },
        })

        if (stockLevel) {
            await prisma.stockLevel.update({
                where: { id: stockLevel.id },
                data: {
                    availableQty: { increment: releaseQty },
                    reservedQty: { decrement: releaseQty },
                },
            })
        }

        await prisma.stockReservation.update({
            where: { id: reservation.id },
            data: { releasedQty: releaseQty, status: "RELEASED" },
        })
    }

    if (reservations.length > 0) {
        console.log(`[StockReservation] Released ${reservations.length} reservation(s) for WO ${workOrderId}`)
    }
}

// GET /api/manufacturing/work-orders/[id] - Get single work order
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        const [workOrder, warehouses] = await Promise.all([
            prisma.workOrder.findUnique({
            where: { id },
            include: {
                product: {
                    include: {
                        BillOfMaterials: {
                            where: { isActive: true },
                            include: {
                                items: {
                                    include: {
                                        material: true,
                                    },
                                },
                            },
                        },
                    },
                },
                tasks: {
                    include: {
                        employee: true,
                    },
                },
                inspections: {
                    include: {
                        inspector: true,
                        defects: true,
                    },
                    orderBy: { inspectionDate: 'desc' },
                },
                transactions: {
                    orderBy: { createdAt: 'desc' },
                    take: 20,
                },
            },
        }),
            prisma.warehouse.findMany({
                where: { isActive: true },
                select: { id: true, code: true, name: true },
                orderBy: { name: 'asc' },
            })
        ])

        if (!workOrder) {
            return NextResponse.json(
                { success: false, error: 'Work order not found' },
                { status: 404 }
            )
        }

        // Calculate material requirements from BOM
        const bom = workOrder.product.BillOfMaterials[0]
        let materialRequirements: any[] = []

        if (bom) {
            materialRequirements = bom.items.map(item => ({
                materialId: item.materialId,
                materialName: item.material.name,
                materialCode: item.material.code,
                unit: item.unit || item.material.unit,
                quantityPerUnit: Number(item.quantity),
                totalRequired: Number(item.quantity) * workOrder.plannedQty,
                wastePct: Number(item.wastePct),
            }))
        }

        // Calculate progress
        const progress = workOrder.plannedQty > 0
            ? Math.min(100, Math.round((workOrder.actualQty / workOrder.plannedQty) * 100))
            : 0

        return NextResponse.json({
            success: true,
            data: {
                ...workOrder,
                progress,
                materialRequirements,
                warehouseOptions: warehouses,
            },
        })
    } catch (error) {
        console.error('Error fetching work order:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to fetch work order' },
            { status: 500 }
        )
    }
}

// PATCH /api/manufacturing/work-orders/[id] - Update work order
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await request.json()

        const action = body.action as string | undefined

        let previousStatus: string | null = null

        const workOrder = await prisma.$transaction(async (tx) => {
            const existing = await tx.workOrder.findUnique({
                where: { id },
                include: { product: true },
            })
            if (!existing) throw new Error('Work order not found')
            previousStatus = existing.status

            if (action === 'REPORT_PRODUCTION') {
                if (existing.status !== 'IN_PROGRESS') {
                    throw new Error('Production can only be reported while work order is IN_PROGRESS')
                }

                const qtyProduced = Number(body.quantityProduced || 0)
                if (!Number.isFinite(qtyProduced) || qtyProduced <= 0) {
                    throw new Error('quantityProduced must be greater than 0')
                }

                const warehouseId = body.warehouseId || (await tx.warehouse.findFirst({
                    where: { isActive: true },
                    select: { id: true },
                    orderBy: { createdAt: 'asc' },
                }))?.id

                if (!warehouseId) {
                    throw new Error('No active warehouse available for production posting')
                }

                const nextActualQty = existing.actualQty + qtyProduced
                if (nextActualQty > existing.plannedQty) {
                    throw new Error(`Produced quantity exceeds planned quantity. Planned: ${existing.plannedQty}, current actual: ${existing.actualQty}`)
                }

                await executeProductionPosting(tx, {
                    workOrderId: existing.id,
                    quantityProduced: qtyProduced,
                    warehouseId,
                    performedBy: body.performedBy,
                    note: body.note,
                })

                const nextStatus = nextActualQty >= existing.plannedQty ? 'COMPLETED' : 'IN_PROGRESS'
                return await tx.workOrder.update({
                    where: { id: existing.id },
                    data: {
                        actualQty: nextActualQty,
                        status: nextStatus,
                        startDate: existing.startDate || new Date(),
                    },
                    include: { product: true },
                })
            }

            if (action === 'PRODUCTION_RETURN') {
                if (existing.actualQty <= 0) {
                    throw new Error('Tidak ada qty produksi yang bisa diretur')
                }

                const returnQty = Number(body.returnQty || 0)
                if (!Number.isFinite(returnQty) || returnQty <= 0) {
                    throw new Error('Qty retur harus lebih dari 0')
                }

                if (returnQty > existing.actualQty) {
                    throw new Error(
                        `Qty retur (${returnQty}) melebihi qty aktual (${existing.actualQty})`
                    )
                }

                const warehouseId = body.warehouseId || (await tx.warehouse.findFirst({
                    where: { isActive: true },
                    select: { id: true },
                    orderBy: { createdAt: 'asc' },
                }))?.id

                if (!warehouseId) {
                    throw new Error('Tidak ada gudang aktif untuk proses retur')
                }

                const reason = body.reason || 'Batch defective'

                return await executeProductionReturn(tx, {
                    workOrderId: existing.id,
                    returnQty,
                    warehouseId,
                    reason,
                    performedBy: body.performedBy,
                })
            }

            const targetStatus = body.toStatus || body.status
            if (targetStatus) {
                assertWorkOrderTransition(existing.status, targetStatus)

                // Completing by transition auto-posts remaining quantity to keep inventory/finance in sync.
                if (targetStatus === 'COMPLETED') {
                    const remainingQty = existing.plannedQty - existing.actualQty
                    if (remainingQty <= 0) {
                        return await tx.workOrder.update({
                            where: { id: existing.id },
                            data: { status: 'COMPLETED' },
                            include: { product: true },
                        })
                    }

                    const warehouseId = body.warehouseId || (await tx.warehouse.findFirst({
                        where: { isActive: true },
                        select: { id: true },
                        orderBy: { createdAt: 'asc' },
                    }))?.id
                    if (!warehouseId) {
                        throw new Error('No active warehouse available for completion posting')
                    }

                    await executeProductionPosting(tx, {
                        workOrderId: existing.id,
                        quantityProduced: remainingQty,
                        warehouseId,
                        performedBy: body.performedBy,
                        note: body.note,
                    })

                    return await tx.workOrder.update({
                        where: { id: existing.id },
                        data: {
                            status: 'COMPLETED',
                            actualQty: existing.plannedQty,
                            startDate: existing.startDate || new Date(),
                        },
                        include: { product: true },
                    })
                }

                const statusUpdate: any = { status: targetStatus }
                if (targetStatus === 'IN_PROGRESS' && !existing.startDate) {
                    statusUpdate.startDate = new Date()
                }

                return await tx.workOrder.update({
                    where: { id: existing.id },
                    data: statusUpdate,
                    include: { product: true },
                })
            }

            // Fallback: generic field update with protection for status
            const updateData: any = {}
            if (body.actualQty !== undefined) updateData.actualQty = parseInt(body.actualQty)
            if (body.plannedQty !== undefined) updateData.plannedQty = parseInt(body.plannedQty)
            if (body.startDate !== undefined) updateData.startDate = body.startDate ? new Date(body.startDate) : null
            if (body.dueDate !== undefined) updateData.dueDate = body.dueDate ? new Date(body.dueDate) : null
            if (body.machineId !== undefined) updateData.machineId = body.machineId || null

            return await tx.workOrder.update({
                where: { id: existing.id },
                data: updateData,
                include: { product: true },
            })
        })

        // --- Stock Reservation Logic (post-transaction, non-blocking) ---
        const newStatus = workOrder.status
        if (previousStatus && newStatus !== previousStatus) {
            try {
                if (newStatus === 'IN_PROGRESS' && previousStatus !== 'IN_PROGRESS') {
                    await reserveStockForWorkOrder(id)
                } else if (newStatus === 'CANCELLED') {
                    await releaseReservationsForWorkOrder(id)
                }
            } catch (reservationError) {
                console.error('[StockReservation] Non-blocking error:', reservationError)
            }
        }

        return NextResponse.json({
            success: true,
            data: workOrder,
            message: action === 'REPORT_PRODUCTION'
                ? 'Production report posted with inventory and finance entries'
                : action === 'PRODUCTION_RETURN'
                ? 'Retur produksi berhasil. Stok & jurnal telah diperbarui.'
                : 'Work order updated successfully',
        })
    } catch (error) {
        console.error('Error updating work order:', error)
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Failed to update work order' },
            { status: 500 }
        )
    }
}

// DELETE /api/manufacturing/work-orders/[id] - Delete work order
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        // Check if work order has transactions
        const wo = await prisma.workOrder.findUnique({
            where: { id },
            include: {
                _count: {
                    select: { transactions: true },
                },
            },
        })

        if (wo?._count.transactions && wo._count.transactions > 0) {
            return NextResponse.json(
                { success: false, error: 'Cannot delete work order with inventory transactions' },
                { status: 400 }
            )
        }

        await prisma.workOrder.delete({
            where: { id },
        })

        return NextResponse.json({
            success: true,
            message: 'Work order deleted successfully',
        })
    } catch (error) {
        console.error('Error deleting work order:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to delete work order' },
            { status: 500 }
        )
    }
}
