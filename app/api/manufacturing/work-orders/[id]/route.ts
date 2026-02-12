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

        const workOrder = await prisma.$transaction(async (tx) => {
            const existing = await tx.workOrder.findUnique({
                where: { id },
                include: { product: true },
            })
            if (!existing) throw new Error('Work order not found')

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

        return NextResponse.json({
            success: true,
            data: workOrder,
            message: action === 'REPORT_PRODUCTION'
                ? 'Production report posted with inventory and finance entries'
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
