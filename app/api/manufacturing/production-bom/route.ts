import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

// GET /api/manufacturing/production-bom — optimized: lean list query
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

        const searchFilter = search ? {
            product: {
                OR: [
                    { name: { contains: search, mode: 'insensitive' as any } },
                    { code: { contains: search, mode: 'insensitive' as any } },
                ],
            },
        } : {}

        // Run both queries in parallel — lean selects (no supplierItems, no deep nesting)
        const [boms, legacyBoms] = await Promise.all([
            prisma.productionBOM.findMany({
                where: { ...(activeOnly ? { isActive: true } : {}), ...searchFilter },
                include: {
                    product: { select: { id: true, code: true, name: true, unit: true, sellingPrice: true } },
                    items: {
                        include: {
                            material: { select: { id: true, code: true, name: true, unit: true, costPrice: true } },
                        },
                    },
                    steps: {
                        select: {
                            id: true, sequence: true,
                            station: { select: { id: true, code: true, name: true, stationType: true, operationType: true, costPerUnit: true } },
                        },
                        orderBy: { sequence: 'asc' },
                    },
                    _count: { select: { items: true, steps: true } },
                },
                orderBy: { updatedAt: 'desc' },
            }),
            prisma.billOfMaterials.findMany({
                where: { ...(activeOnly ? { isActive: true } : {}), ...searchFilter },
                include: {
                    product: { select: { id: true, code: true, name: true, unit: true, sellingPrice: true } },
                    items: {
                        include: {
                            material: { select: { id: true, code: true, name: true, unit: true, costPrice: true } },
                        },
                    },
                    _count: { select: { items: true } },
                },
                orderBy: { updatedAt: 'desc' },
            }),
        ])

        // Filter out legacy BOMs whose products already have a ProductionBOM
        const migratedProductIds = new Set(boms.map((b) => b.productId))

        const enrichedNew = boms.map((bom) => {
            const totalMaterialCost = bom.items.reduce((sum, item) => {
                const unitCost = Number(item.material.costPrice || 0)
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
                materialCount: bom._count.items,
                stepCount: bom._count.steps,
            }
        })

        const enrichedLegacy = legacyBoms
            .filter((bom) => !migratedProductIds.has(bom.productId))
            .map((bom) => {
                const totalMaterialCost = bom.items.reduce((sum, item) => {
                    const unitCost = Number(item.material.costPrice || 0)
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
                    materialCount: bom._count.items,
                    stepCount: 0,
                }
            })

        return NextResponse.json({ success: true, data: [...enrichedNew, ...enrichedLegacy] })
    } catch (error: any) {
        console.error('Error fetching production BOMs:', error?.message || error)
        return NextResponse.json({ success: false, error: error?.message || 'Failed to fetch production BOMs' }, { status: 500 })
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

        const { productId, version = 'v1', totalProductionQty = 0, notes, migrateFromLegacyId, materials, cloneFromId } = body

        // Clone/duplicate an existing ProductionBOM
        if (cloneFromId) {
            const sourceBom = await prisma.productionBOM.findUnique({
                where: { id: cloneFromId },
                include: {
                    items: true,
                    steps: {
                        include: { materials: true, allocations: true },
                        orderBy: { sequence: 'asc' },
                    },
                },
            })

            if (!sourceBom) {
                return NextResponse.json({ success: false, error: 'Source BOM not found' }, { status: 404 })
            }

            // Determine next version
            const existingVersions = await prisma.productionBOM.findMany({
                where: { productId: sourceBom.productId },
                select: { version: true },
            })
            const maxVersion = existingVersions.reduce((max, v) => {
                const num = parseInt(v.version.replace('v', ''))
                return num > max ? num : max
            }, 0)
            const newVersion = `v${maxVersion + 1}`

            const newBom = await prisma.$transaction(async (tx) => {
                const bom = await tx.productionBOM.create({
                    data: {
                        productId: sourceBom.productId,
                        version: newVersion,
                        totalProductionQty: sourceBom.totalProductionQty,
                        notes: sourceBom.notes ? `Salinan dari ${sourceBom.version}: ${sourceBom.notes}` : `Salinan dari ${sourceBom.version}`,
                    },
                })

                // Copy items, build old→new ID map
                const itemIdMap = new Map<string, string>()
                for (const item of sourceBom.items) {
                    const newItem = await tx.productionBOMItem.create({
                        data: {
                            bomId: bom.id,
                            materialId: item.materialId,
                            quantityPerUnit: item.quantityPerUnit,
                            unit: item.unit,
                            wastePct: item.wastePct,
                            notes: item.notes,
                        },
                    })
                    itemIdMap.set(item.id, newItem.id)
                }

                // Copy steps, build old→new step ID map
                const stepIdMap = new Map<string, string>()
                for (const step of sourceBom.steps) {
                    const newStep = await tx.productionBOMStep.create({
                        data: {
                            bomId: bom.id,
                            stationId: step.stationId,
                            sequence: step.sequence,
                            durationMinutes: step.durationMinutes,
                            notes: step.notes,
                            parentStepIds: [], // will remap after all steps created
                            estimatedTimePerUnit: step.estimatedTimePerUnit,
                        },
                    })
                    stepIdMap.set(step.id, newStep.id)

                    // Copy step materials
                    for (const sm of step.materials) {
                        const newBomItemId = itemIdMap.get(sm.bomItemId)
                        if (newBomItemId) {
                            await tx.productionBOMStepMaterial.create({
                                data: { stepId: newStep.id, bomItemId: newBomItemId },
                            })
                        }
                    }

                    // Copy allocations
                    for (const alloc of step.allocations) {
                        await tx.productionBOMAllocation.create({
                            data: {
                                stepId: newStep.id,
                                stationId: alloc.stationId,
                                quantity: alloc.quantity,
                                notes: alloc.notes,
                            },
                        })
                    }
                }

                // Remap parentStepIds
                for (const step of sourceBom.steps) {
                    const newStepId = stepIdMap.get(step.id)
                    if (newStepId && step.parentStepIds.length > 0) {
                        const newParents = step.parentStepIds
                            .map((pid) => stepIdMap.get(pid))
                            .filter(Boolean) as string[]
                        await tx.productionBOMStep.update({
                            where: { id: newStepId },
                            data: { parentStepIds: newParents },
                        })
                    }
                }

                return bom
            })

            return NextResponse.json({ success: true, data: newBom }, { status: 201 })
        }

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
