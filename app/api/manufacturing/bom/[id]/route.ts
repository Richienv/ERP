import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function resolveMaterialUnitCost(material: {
    costPrice: any
    supplierItems?: Array<{ price: any; isPreferred: boolean }>
}) {
    const directCost = Number(material.costPrice || 0)
    if (directCost > 0) return directCost

    const preferredSupplierCost = material.supplierItems?.find((s) => s.isPreferred)?.price
    if (preferredSupplierCost !== undefined && preferredSupplierCost !== null) {
        return Number(preferredSupplierCost || 0)
    }

    const fallbackSupplierCost = material.supplierItems?.[0]?.price
    return Number(fallbackSupplierCost || 0)
}

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
                                supplierItems: {
                                    select: {
                                        price: true,
                                        isPreferred: true,
                                    },
                                    orderBy: {
                                        isPreferred: 'desc',
                                    },
                                    take: 3,
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
            const cost = resolveMaterialUnitCost(item.material)
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

        const bom = await prisma.$transaction(async (tx) => {
            const existing = await tx.billOfMaterials.findUnique({
                where: { id },
                select: { id: true, productId: true, version: true }
            })

            if (!existing) {
                throw new Error('Bill of Materials not found')
            }

            const updateData: any = {}
            if (body.version !== undefined) updateData.version = body.version
            if (body.isActive !== undefined) updateData.isActive = Boolean(body.isActive)

            if (body.version && body.version !== existing.version) {
                const duplicateVersion = await tx.billOfMaterials.findUnique({
                    where: {
                        productId_version: {
                            productId: existing.productId,
                            version: body.version
                        }
                    },
                    select: { id: true }
                })
                if (duplicateVersion) {
                    throw new Error('BOM version already exists for this product')
                }
            }

            if (Array.isArray(body.items)) {
                await tx.bOMItem.deleteMany({
                    where: { bomId: id }
                })

                const validItems = body.items
                    .filter((item: any) => item?.materialId && Number(item?.quantity) > 0)
                    .map((item: any) => ({
                        bomId: id,
                        materialId: item.materialId,
                        quantity: Number(item.quantity),
                        unit: item.unit || null,
                        wastePct: Number(item.wastePct || 0),
                    }))

                if (validItems.length > 0) {
                    await tx.bOMItem.createMany({
                        data: validItems
                    })
                }
            }

            return tx.billOfMaterials.update({
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
        })

        return NextResponse.json({
            success: true,
            data: bom,
            message: 'Bill of Materials updated successfully',
        })
    } catch (error) {
        console.error('Error updating BOM:', error)
        return NextResponse.json(
            { success: false, error: (error as any)?.message || 'Failed to update Bill of Materials' },
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
