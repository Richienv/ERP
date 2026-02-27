import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

// GET /api/manufacturing/production-bom/[id]
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        }
        const { id } = await params

        const bom = await prisma.productionBOM.findUnique({
            where: { id },
            include: {
                product: {
                    select: { id: true, code: true, name: true, unit: true, sellingPrice: true, costPrice: true },
                },
                items: {
                    include: {
                        material: {
                            select: {
                                id: true, code: true, name: true, unit: true, costPrice: true,
                                supplierItems: { select: { price: true, isPreferred: true } },
                            },
                        },
                        stepMaterials: { select: { stepId: true } },
                    },
                },
                steps: {
                    include: {
                        station: {
                            select: {
                                id: true, code: true, name: true, stationType: true,
                                operationType: true, costPerUnit: true,
                                subcontractor: { select: { id: true, name: true } },
                            },
                        },
                        materials: {
                            include: {
                                bomItem: {
                                    include: {
                                        material: { select: { id: true, code: true, name: true, unit: true, costPrice: true } },
                                    },
                                },
                            },
                        },
                        allocations: {
                            include: {
                                station: {
                                    select: { id: true, code: true, name: true, operationType: true, subcontractor: { select: { name: true } } },
                                },
                            },
                        },
                        attachments: true,
                    },
                    orderBy: { sequence: 'asc' },
                },
            },
        })

        if (!bom) {
            return NextResponse.json({ success: false, error: 'Production BOM not found' }, { status: 404 })
        }

        return NextResponse.json({ success: true, data: bom })
    } catch (error: any) {
        console.error('Error fetching production BOM:', error)
        return NextResponse.json({ success: false, error: error?.message || 'Failed to fetch production BOM' }, { status: 500 })
    }
}

// PATCH /api/manufacturing/production-bom/[id] — full save of canvas state
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        }
        const { id } = await params
        const body = await request.json()
        const { version, isActive, totalProductionQty, notes, items, steps } = body

        const result = await prisma.$transaction(async (tx) => {
            // Update BOM metadata
            await tx.productionBOM.update({
                where: { id },
                data: {
                    ...(version !== undefined && { version }),
                    ...(isActive !== undefined && { isActive }),
                    ...(totalProductionQty !== undefined && { totalProductionQty }),
                    ...(notes !== undefined && { notes }),
                },
            })

            // If items provided, replace all items
            if (items) {
                // Delete step materials first (they reference bom items)
                const existingSteps = await tx.productionBOMStep.findMany({ where: { bomId: id }, select: { id: true } })
                const stepIds = existingSteps.map((s) => s.id)
                if (stepIds.length > 0) {
                    await tx.productionBOMStepMaterial.deleteMany({ where: { stepId: { in: stepIds } } })
                }

                await tx.productionBOMItem.deleteMany({ where: { bomId: id } })

                const createdItems: any[] = []
                for (const item of items) {
                    const created = await tx.productionBOMItem.create({
                        data: {
                            bomId: id,
                            materialId: item.materialId,
                            quantityPerUnit: item.quantityPerUnit,
                            unit: item.unit || null,
                            wastePct: item.wastePct || 0,
                            notes: item.notes || null,
                        },
                    })
                    createdItems.push(created)
                }
            }

            // If steps provided, replace all steps
            if (steps) {
                const existingSteps = await tx.productionBOMStep.findMany({ where: { bomId: id }, select: { id: true } })
                const stepIds = existingSteps.map((s) => s.id)
                if (stepIds.length > 0) {
                    await tx.productionBOMStepMaterial.deleteMany({ where: { stepId: { in: stepIds } } })
                    await tx.productionBOMAllocation.deleteMany({ where: { stepId: { in: stepIds } } })
                    // Keep attachments — they are managed separately via upload/delete APIs
                    // Move attachments to new steps if possible, otherwise orphan them
                }
                await tx.productionBOMStep.deleteMany({ where: { bomId: id } })

                // Get freshly created items — map materialId → new bomItemId
                const currentItems = await tx.productionBOMItem.findMany({ where: { bomId: id } })
                const materialIdToBomItemId = new Map<string, string>()
                for (const ci of currentItems) {
                    materialIdToBomItemId.set(ci.materialId, ci.id)
                }

                // Track old client step ID → new DB step ID for parentStepIds mapping
                const oldToNewStepId = new Map<string, string>()

                for (const step of steps) {
                    const createdStep = await tx.productionBOMStep.create({
                        data: {
                            bomId: id,
                            stationId: step.stationId,
                            sequence: step.sequence,
                            durationMinutes: step.durationMinutes || null,
                            notes: step.notes || null,
                            estimatedTimePerUnit: step.estimatedTimePerUnit ?? null,
                            actualTimeTotal: step.actualTimeTotal ?? null,
                            completedQty: step.completedQty ?? 0,
                            startOffsetMinutes: step.startOffsetMinutes ?? 0,
                            startedAt: step.startedAt ? new Date(step.startedAt) : null,
                            completedAt: step.completedAt ? new Date(step.completedAt) : null,
                        },
                    })

                    // Map old → new step ID
                    if (step.id) {
                        oldToNewStepId.set(step.id, createdStep.id)
                    }

                    // Create step materials
                    if (step.materialProductIds && step.materialProductIds.length > 0) {
                        for (const productId of step.materialProductIds) {
                            const bomItemId = materialIdToBomItemId.get(productId)
                            if (bomItemId) {
                                await tx.productionBOMStepMaterial.create({
                                    data: { stepId: createdStep.id, bomItemId },
                                })
                            }
                        }
                    } else if (step.materialIds && step.materialIds.length > 0) {
                        const validIds = new Set(currentItems.map((ci) => ci.id))
                        for (const bomItemId of step.materialIds) {
                            if (validIds.has(bomItemId)) {
                                await tx.productionBOMStepMaterial.create({
                                    data: { stepId: createdStep.id, bomItemId },
                                })
                            }
                        }
                    }

                    // Create allocations
                    if (step.allocations && step.allocations.length > 0) {
                        for (const alloc of step.allocations) {
                            await tx.productionBOMAllocation.create({
                                data: {
                                    stepId: createdStep.id,
                                    stationId: alloc.stationId,
                                    quantity: alloc.quantity,
                                    notes: alloc.notes || null,
                                },
                            })
                        }
                    }
                }

                // Second pass: update parentStepIds with mapped new IDs
                for (const step of steps) {
                    if (step.parentStepIds && step.parentStepIds.length > 0) {
                        const newStepId = oldToNewStepId.get(step.id)
                        if (newStepId) {
                            const mappedParentIds = step.parentStepIds
                                .map((oldId: string) => oldToNewStepId.get(oldId))
                                .filter(Boolean) as string[]
                            if (mappedParentIds.length > 0) {
                                await tx.productionBOMStep.update({
                                    where: { id: newStepId },
                                    data: { parentStepIds: mappedParentIds },
                                })
                            }
                        }
                    }
                }
            }

            // Return updated BOM (same shape as GET)
            return tx.productionBOM.findUnique({
                where: { id },
                include: {
                    product: { select: { id: true, code: true, name: true, unit: true, sellingPrice: true, costPrice: true } },
                    items: {
                        include: {
                            material: {
                                select: { id: true, code: true, name: true, unit: true, costPrice: true },
                            },
                            stepMaterials: { select: { stepId: true } },
                        },
                    },
                    steps: {
                        include: {
                            station: {
                                select: {
                                    id: true, code: true, name: true, stationType: true,
                                    operationType: true, costPerUnit: true,
                                    subcontractor: { select: { id: true, name: true } },
                                },
                            },
                            materials: {
                                include: {
                                    bomItem: {
                                        include: {
                                            material: { select: { id: true, code: true, name: true, unit: true, costPrice: true } },
                                        },
                                    },
                                },
                            },
                            allocations: {
                                include: {
                                    station: {
                                        select: { id: true, code: true, name: true, operationType: true, subcontractor: { select: { name: true } } },
                                    },
                                },
                            },
                            attachments: true,
                        },
                        orderBy: { sequence: 'asc' },
                    },
                },
            })
        })

        // Log edit history
        try {
            const stepCount = steps?.length || 0
            const itemCount = items?.length || 0
            await prisma.bOMEditLog.create({
                data: {
                    bomId: id,
                    action: "SAVE",
                    summary: `Menyimpan BOM: ${stepCount} proses, ${itemCount} material, target ${body.totalProductionQty || 0} pcs`,
                }
            })
        } catch {
            // Don't fail the save if logging fails
        }

        return NextResponse.json({ success: true, data: result })
    } catch (error: any) {
        console.error('Error updating production BOM:', error)
        return NextResponse.json({ success: false, error: error?.message || 'Failed to update production BOM' }, { status: 500 })
    }
}

// DELETE /api/manufacturing/production-bom/[id]
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        }
        const { id } = await params

        await prisma.productionBOM.delete({ where: { id } })
        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Error deleting production BOM:', error)
        return NextResponse.json({ success: false, error: error?.message || 'Failed to delete production BOM' }, { status: 500 })
    }
}
