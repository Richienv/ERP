import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/manufacturing/work-orders/[id] - Get single work order
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        const workOrder = await prisma.workOrder.findUnique({
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
        })

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

        const updateData: any = {}

        if (body.status !== undefined) updateData.status = body.status
        if (body.actualQty !== undefined) updateData.actualQty = parseInt(body.actualQty)
        if (body.plannedQty !== undefined) updateData.plannedQty = parseInt(body.plannedQty)
        if (body.startDate !== undefined) updateData.startDate = body.startDate ? new Date(body.startDate) : null
        if (body.dueDate !== undefined) updateData.dueDate = body.dueDate ? new Date(body.dueDate) : null

        const workOrder = await prisma.workOrder.update({
            where: { id },
            data: updateData,
            include: {
                product: true,
            },
        })

        return NextResponse.json({
            success: true,
            data: workOrder,
            message: 'Work order updated successfully',
        })
    } catch (error) {
        console.error('Error updating work order:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to update work order' },
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
