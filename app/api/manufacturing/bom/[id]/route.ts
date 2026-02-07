import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/manufacturing/bom/[id] - Get single BOM with full details
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        const bom = await prisma.billOfMaterials.findUnique({
            where: { id },
            include: {
                product: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        unit: true,
                        costPrice: true,
                        sellingPrice: true,
                    },
                },
                items: {
                    include: {
                        material: {
                            include: {
                                stockLevels: {
                                    select: {
                                        quantity: true,
                                        warehouseId: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        })

        if (!bom) {
            return NextResponse.json(
                { success: false, error: 'Bill of Materials not found' },
                { status: 404 }
            )
        }

        // Enhance with stock availability and costs
        const enhancedItems = bom.items.map(item => {
            const totalStock = item.material.stockLevels.reduce((sum, sl) => sum + sl.quantity, 0)
            const qty = Number(item.quantity)
            const cost = Number(item.material.costPrice)
            const waste = Number(item.wastePct) / 100
            const lineCost = qty * cost * (1 + waste)

            return {
                id: item.id,
                materialId: item.materialId,
                materialCode: item.material.code,
                materialName: item.material.name,
                unit: item.unit || item.material.unit,
                quantity: qty,
                wastePct: Number(item.wastePct),
                unitCost: cost,
                lineCost: Math.round(lineCost),
                stockAvailable: totalStock,
                stockStatus: totalStock >= qty ? 'available' : totalStock > 0 ? 'partial' : 'unavailable',
            }
        })

        const totalMaterialCost = enhancedItems.reduce((sum, item) => sum + item.lineCost, 0)

        return NextResponse.json({
            success: true,
            data: {
                id: bom.id,
                productId: bom.productId,
                product: bom.product,
                version: bom.version,
                isActive: bom.isActive,
                items: enhancedItems,
                totalMaterialCost,
                itemCount: enhancedItems.length,
                createdAt: bom.createdAt,
                updatedAt: bom.updatedAt,
            },
        })
    } catch (error) {
        console.error('Error fetching BOM:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to fetch Bill of Materials' },
            { status: 500 }
        )
    }
}

// PATCH /api/manufacturing/bom/[id] - Update BOM
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await request.json()

        const updateData: any = {}

        if (body.version !== undefined) updateData.version = body.version
        if (body.isActive !== undefined) updateData.isActive = body.isActive

        const bom = await prisma.billOfMaterials.update({
            where: { id },
            data: updateData,
            include: {
                product: true,
                items: {
                    include: {
                        material: true,
                    },
                },
            },
        })

        return NextResponse.json({
            success: true,
            data: bom,
            message: 'Bill of Materials updated successfully',
        })
    } catch (error) {
        console.error('Error updating BOM:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to update Bill of Materials' },
            { status: 500 }
        )
    }
}

// DELETE /api/manufacturing/bom/[id] - Delete BOM
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        // Delete items first (cascade should handle this, but being explicit)
        await prisma.bOMItem.deleteMany({
            where: { bomId: id },
        })

        await prisma.billOfMaterials.delete({
            where: { id },
        })

        return NextResponse.json({
            success: true,
            message: 'Bill of Materials deleted successfully',
        })
    } catch (error) {
        console.error('Error deleting BOM:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to delete Bill of Materials' },
            { status: 500 }
        )
    }
}
