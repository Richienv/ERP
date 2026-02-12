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

// GET /api/manufacturing/bom - Fetch all Bill of Materials
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const search = searchParams.get('search') || undefined
        const productId = searchParams.get('productId') || undefined
        const activeOnly = searchParams.get('activeOnly') !== 'false'

        // Build where clause
        const whereClause: any = {}

        if (activeOnly) {
            whereClause.isActive = true
        }

        if (productId) {
            whereClause.productId = productId
        }

        if (search) {
            whereClause.product = {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { code: { contains: search, mode: 'insensitive' } },
                ],
            }
        }

        const boms = await prisma.billOfMaterials.findMany({
            where: whereClause,
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
                            select: {
                                id: true,
                                code: true,
                                name: true,
                                unit: true,
                                costPrice: true,
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
            orderBy: { updatedAt: 'desc' },
        })

        // Calculate total cost for each BOM
        const bomsWithCost = boms.map(bom => {
            const normalizedItems = bom.items.map((item) => {
                const unitCost = resolveMaterialUnitCost(item.material)
                return {
                    ...item,
                    material: {
                        ...item.material,
                        costPrice: unitCost,
                    },
                }
            })

            const totalMaterialCost = normalizedItems.reduce((sum, item) => {
                const qty = Number(item.quantity)
                const cost = Number(item.material.costPrice || 0)
                const waste = Number(item.wastePct) / 100
                return sum + (qty * cost * (1 + waste))
            }, 0)

            return {
                ...bom,
                items: normalizedItems,
                totalMaterialCost: Math.round(totalMaterialCost),
                itemCount: normalizedItems.length,
            }
        })

        return NextResponse.json({
            success: true,
            data: bomsWithCost,
        })
    } catch (error) {
        console.error('Error fetching BOMs:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to fetch Bill of Materials' },
            { status: 500 }
        )
    }
}

// POST /api/manufacturing/bom - Create new BOM
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()

        const { productId, version, items } = body

        if (!productId) {
            return NextResponse.json(
                { success: false, error: 'Missing required field: productId' },
                { status: 400 }
            )
        }

        // Check if BOM already exists for this product+version
        const existingBOM = await prisma.billOfMaterials.findUnique({
            where: {
                productId_version: {
                    productId,
                    version: version || 'v1',
                },
            },
        })

        if (existingBOM) {
            return NextResponse.json(
                { success: false, error: 'BOM already exists for this product and version' },
                { status: 409 }
            )
        }

        // Create BOM with items
        const bom = await prisma.billOfMaterials.create({
            data: {
                productId,
                version: version || 'v1',
                isActive: true,
                items: items && items.length > 0 ? {
                    create: items.map((item: any) => ({
                        materialId: item.materialId,
                        quantity: parseFloat(item.quantity),
                        unit: item.unit || null,
                        wastePct: parseFloat(item.wastePct || 0),
                    })),
                } : undefined,
            },
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
            message: 'Bill of Materials created successfully',
        }, { status: 201 })
    } catch (error) {
        console.error('Error creating BOM:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to create Bill of Materials' },
            { status: 500 }
        )
    }
}
