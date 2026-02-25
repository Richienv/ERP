import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

function resolveMaterialUnitCost(material: any): number {
    const directCost = Number(material.costPrice || 0)
    if (directCost > 0) return directCost
    const preferred = material.supplierItems?.find((s: any) => s.isPreferred)?.price
    if (preferred != null) return Number(preferred || 0)
    return Number(material.supplierItems?.[0]?.price || 0)
}

// GET /api/manufacturing/production-bom
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        }
        const { searchParams } = new URL(request.url)
        const search = searchParams.get('search') || ''
        const activeOnly = searchParams.get('activeOnly') !== 'false'

        // Fetch new ProductionBOMs
        const boms = await prisma.productionBOM.findMany({
            where: {
                ...(activeOnly ? { isActive: true } : {}),
                ...(search ? {
                    product: {
                        OR: [
                            { name: { contains: search, mode: 'insensitive' as any } },
                            { code: { contains: search, mode: 'insensitive' as any } },
                        ],
                    },
                } : {}),
            },
            include: {
                product: { select: { id: true, code: true, name: true, unit: true, sellingPrice: true } },
                items: {
                    include: {
                        material: {
                            select: { id: true, code: true, name: true, unit: true, costPrice: true, supplierItems: { select: { price: true, isPreferred: true } } },
                        },
                    },
                },
                steps: {
                    include: {
                        station: { select: { id: true, code: true, name: true, stationType: true, operationType: true, costPerUnit: true } },
                    },
                    orderBy: { sequence: 'asc' },
                },
            },
            orderBy: { updatedAt: 'desc' },
        })

        const enrichedNew = boms.map((bom) => {
            const totalMaterialCost = bom.items.reduce((sum, item) => {
                const unitCost = resolveMaterialUnitCost(item.material)
                const qty = Number(item.quantityPerUnit)
                const waste = Number(item.wastePct || 0)
                return sum + unitCost * qty * (1 + waste / 100)
            }, 0)

            const totalLaborCost = bom.steps.reduce((sum, step) => {
                return sum + Number(step.station.costPerUnit || 0)
            }, 0)

            return {
                ...bom,
                _source: 'production' as const,
                totalMaterialCost,
                totalLaborCost,
                totalCostPerUnit: totalMaterialCost + totalLaborCost,
                materialCount: bom.items.length,
                stepCount: bom.steps.length,
            }
        })

        // Also fetch legacy BOMs that haven't been migrated yet
        const migratedProductIds = boms.map((b) => b.productId)
        const legacyBoms = await prisma.billOfMaterials.findMany({
            where: {
                ...(activeOnly ? { isActive: true } : {}),
                // Exclude products that already have a ProductionBOM
                ...(migratedProductIds.length > 0 ? { productId: { notIn: migratedProductIds } } : {}),
                ...(search ? {
                    product: {
                        OR: [
                            { name: { contains: search, mode: 'insensitive' as any } },
                            { code: { contains: search, mode: 'insensitive' as any } },
                        ],
                    },
                } : {}),
            },
            include: {
                product: { select: { id: true, code: true, name: true, unit: true, sellingPrice: true } },
                items: {
                    include: {
                        material: {
                            select: { id: true, code: true, name: true, unit: true, costPrice: true, supplierItems: { select: { price: true, isPreferred: true } } },
                        },
                    },
                },
            },
            orderBy: { updatedAt: 'desc' },
        })

        const enrichedLegacy = legacyBoms.map((bom) => {
            const totalMaterialCost = bom.items.reduce((sum, item) => {
                const unitCost = resolveMaterialUnitCost(item.material)
                const qty = Number(item.quantity)
                const waste = Number(item.wastePct || 0)
                return sum + unitCost * qty * (1 + waste / 100)
            }, 0)

            return {
                id: bom.id,
                productId: bom.productId,
                product: bom.product,
                version: bom.version,
                isActive: bom.isActive,
                totalProductionQty: 0,
                notes: null,
                items: bom.items,
                steps: [],
                createdAt: bom.createdAt,
                updatedAt: bom.updatedAt,
                _source: 'legacy' as const,
                _legacyId: bom.id,
                totalMaterialCost,
                totalLaborCost: 0,
                totalCostPerUnit: totalMaterialCost,
                materialCount: bom.items.length,
                stepCount: 0,
            }
        })

        // Merge: new production BOMs first, then legacy ones
        const all = [...enrichedNew, ...enrichedLegacy]

        return NextResponse.json({ success: true, data: all })
    } catch (error) {
        console.error('Error fetching production BOMs:', error)
        return NextResponse.json({ success: false, error: 'Failed to fetch production BOMs' }, { status: 500 })
    }
}

// POST /api/manufacturing/production-bom
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        }

        let body: any
        try {
            body = await request.json()
        } catch {
            return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
        }

        const { productId, version = 'v1', totalProductionQty = 0, notes, migrateFromLegacyId, materials } = body

        if (!productId) {
            return NextResponse.json({ success: false, error: 'productId is required' }, { status: 400 })
        }

        // If migrating from legacy BOM, copy items over
        if (migrateFromLegacyId) {
            const legacyBom = await prisma.billOfMaterials.findUnique({
                where: { id: migrateFromLegacyId },
                include: { items: true },
            })

            if (!legacyBom) {
                return NextResponse.json({ success: false, error: 'Legacy BOM not found' }, { status: 404 })
            }

            // Check if already migrated
            const existing = await prisma.productionBOM.findFirst({
                where: { productId: legacyBom.productId },
                select: { id: true },
            })
            if (existing) {
                return NextResponse.json({ success: true, data: existing }, { status: 200 })
            }

            const bom = await prisma.$transaction(async (tx) => {
                const created = await tx.productionBOM.create({
                    data: {
                        productId: legacyBom.productId,
                        version: legacyBom.version || 'v1',
                        totalProductionQty: Math.round(Number(totalProductionQty) || 0),
                        notes: notes || null,
                    },
                })

                // Copy items
                for (const item of legacyBom.items) {
                    await tx.productionBOMItem.create({
                        data: {
                            bomId: created.id,
                            materialId: item.materialId,
                            quantityPerUnit: item.quantity,
                            unit: item.unit,
                            wastePct: item.wastePct,
                        },
                    })
                }

                return tx.productionBOM.findUnique({
                    where: { id: created.id },
                    include: {
                        product: { select: { id: true, code: true, name: true, unit: true } },
                        items: { include: { material: { select: { id: true, code: true, name: true } } } },
                    },
                })
            })

            return NextResponse.json({ success: true, data: bom }, { status: 201 })
        }

        // Standard create (with optional initial materials)
        const bom = await prisma.$transaction(async (tx) => {
            const created = await tx.productionBOM.create({
                data: {
                    productId,
                    version: version || 'v1',
                    totalProductionQty: Math.round(Number(totalProductionQty) || 0),
                    notes: notes || null,
                },
            })

            // Create initial BOM items if materials provided
            if (Array.isArray(materials) && materials.length > 0) {
                for (const mat of materials) {
                    await tx.productionBOMItem.create({
                        data: {
                            bomId: created.id,
                            materialId: mat.materialId,
                            quantityPerUnit: Number(mat.quantityPerUnit) || 1,
                            unit: mat.unit || null,
                            wastePct: Number(mat.wastePct) || 0,
                        },
                    })
                }
            }

            return tx.productionBOM.findUnique({
                where: { id: created.id },
                include: {
                    product: { select: { id: true, code: true, name: true, unit: true } },
                    items: { include: { material: { select: { id: true, code: true, name: true, unit: true } } } },
                },
            })
        })

        return NextResponse.json({ success: true, data: bom }, { status: 201 })
    } catch (error: any) {
        if (error?.code === 'P2002') {
            return NextResponse.json({ success: false, error: 'BOM with this product + version already exists' }, { status: 409 })
        }
        console.error('Error creating production BOM:', error)
        const msg = error?.message || 'Failed to create production BOM'
        return NextResponse.json({ success: false, error: msg }, { status: 500 })
    }
}
