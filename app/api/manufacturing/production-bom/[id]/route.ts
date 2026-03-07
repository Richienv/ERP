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
                                iconName: true, colorTheme: true,
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

// PATCH /api/manufacturing/production-bom/[id] — fast save of canvas state
// Optimized: uses createMany batches, no heavy re-read inside transaction
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

        // C1 fix: normalize sequences to 1..N to prevent collisions
        if (steps) {
            for (let i = 0; i < steps.length; i++) {
                steps[i].sequence = i + 1
            }
        }

        const idMapping = await prisma.$transaction(async (tx) => {
            // 1. Update BOM metadata
            await tx.productionBOM.update({
                where: { id },
                data: {
                    ...(version !== undefined && { version }),
                    ...(isActive !== undefined && { isActive }),
                    ...(totalProductionQty !== undefined && { totalProductionQty }),
                    ...(notes !== undefined && { notes }),
                },
            })

            // 2. Bulk-delete old child records in parallel
            const existingStepIds = (await tx.productionBOMStep.findMany({
                where: { bomId: id }, select: { id: true },
            })).map((s) => s.id)

            await Promise.all([
                existingStepIds.length > 0
                    ? Promise.all([
                        tx.productionBOMStepMaterial.deleteMany({ where: { stepId: { in: existingStepIds } } }),
                        tx.productionBOMAllocation.deleteMany({ where: { stepId: { in: existingStepIds } } }),
                    ])
                    : Promise.resolve(),
            ])

            if (items) {
                await tx.productionBOMItem.deleteMany({ where: { bomId: id } })
                if (items.length > 0) {
                    await tx.productionBOMItem.createMany({
                        data: items.map((item: any) => ({
                            bomId: id,
                            materialId: item.materialId,
                            quantityPerUnit: item.quantityPerUnit,
                            unit: item.unit || null,
                            wastePct: item.wastePct || 0,
                            notes: item.notes || null,
                        })),
                    })
                }
            }

            // Result maps for C2: client can update local state with real DB IDs
            const stepIdMap: Record<string, string> = {}
            const itemIdMap: Record<string, string> = {}

            // Build materialId → new bomItemId mapping
            const currentItems = await tx.productionBOMItem.findMany({ where: { bomId: id } })
            const materialIdToBomItemId = new Map<string, string>()
            for (const ci of currentItems) {
                materialIdToBomItemId.set(ci.materialId, ci.id)
            }

            // C2: build item ID mapping (old client materialId → new bomItemId)
            if (items) {
                for (const clientItem of items) {
                    const newId = materialIdToBomItemId.get(clientItem.materialId)
                    if (newId && clientItem.id) {
                        itemIdMap[clientItem.id] = newId
                    }
                }
            }

            if (steps) {
                // Nullify WorkOrder references to old steps before deleting (FK constraint)
                if (existingStepIds.length > 0) {
                    await tx.workOrder.updateMany({
                        where: { productionBomStepId: { in: existingStepIds } },
                        data: { productionBomStepId: null },
                    })
                }
                await tx.productionBOMStep.deleteMany({ where: { bomId: id } })

                if (steps.length > 0) {
                    // Create steps one-by-one to get individual IDs back (createMany doesn't return IDs)
                    // Use sequential create for reliable ID mapping
                    for (let i = 0; i < steps.length; i++) {
                        const step = steps[i]
                        const created = await tx.productionBOMStep.create({
                            data: {
                                bomId: id,
                                stationId: step.stationId,
                                sequence: step.sequence,
                                durationMinutes: step.durationMinutes || null,
                                notes: step.notes || null,
                                laborMonthlySalary: step.laborMonthlySalary ?? null,
                                estimatedTimePerUnit: step.estimatedTimePerUnit ?? null,
                                actualTimeTotal: step.actualTimeTotal ?? null,
                                completedQty: step.completedQty ?? 0,
                                startOffsetMinutes: step.startOffsetMinutes ?? 0,
                                useSubkon: step.useSubkon ?? null,
                                subkonProcessType: step.subkonProcessType || null,
                                operatorName: step.operatorName || null,
                                startedAt: step.startedAt ? new Date(step.startedAt) : null,
                                completedAt: step.completedAt ? new Date(step.completedAt) : null,
                                positionX: step.positionX ?? null,
                                positionY: step.positionY ?? null,
                            },
                            select: { id: true },
                        })
                        if (step.id) {
                            stepIdMap[step.id] = created.id
                        }
                    }
                }

                // Build old→new step ID map from stepIdMap
                const oldToNewStepId = new Map(Object.entries(stepIdMap))

                // Batch-create step materials and allocations
                const stepMaterialRows: { stepId: string; bomItemId: string }[] = []
                const allocationRows: { stepId: string; stationId: string; quantity: number; pricePerPcs: number | null; notes: string | null }[] = []

                for (const step of steps) {
                    const newStepId = oldToNewStepId.get(step.id)
                    if (!newStepId) continue

                    // Collect step materials — always use materialProductIds (product IDs)
                    if (step.materialProductIds?.length > 0) {
                        for (const productId of step.materialProductIds) {
                            const bomItemId = materialIdToBomItemId.get(productId)
                            if (bomItemId) stepMaterialRows.push({ stepId: newStepId, bomItemId })
                        }
                    }

                    // Collect allocations
                    if (step.allocations?.length > 0) {
                        for (const alloc of step.allocations) {
                            allocationRows.push({
                                stepId: newStepId,
                                stationId: alloc.stationId,
                                quantity: alloc.quantity,
                                pricePerPcs: alloc.pricePerPcs ?? null,
                                notes: alloc.notes || null,
                            })
                        }
                    }
                }

                // Batch insert step materials + allocations in parallel
                await Promise.all([
                    stepMaterialRows.length > 0
                        ? tx.productionBOMStepMaterial.createMany({ data: stepMaterialRows })
                        : Promise.resolve(),
                    allocationRows.length > 0
                        ? tx.productionBOMAllocation.createMany({ data: allocationRows })
                        : Promise.resolve(),
                ])

                // Update parentStepIds with mapped new IDs
                const parentUpdates = steps
                    .filter((s: any) => s.parentStepIds?.length > 0)
                    .map((step: any) => {
                        const newStepId = oldToNewStepId.get(step.id)
                        if (!newStepId) return null
                        const mappedParentIds = step.parentStepIds
                            .map((oldId: string) => oldToNewStepId.get(oldId))
                            .filter(Boolean) as string[]
                        if (mappedParentIds.length === 0) return null
                        return tx.productionBOMStep.update({
                            where: { id: newStepId },
                            data: { parentStepIds: mappedParentIds },
                        })
                    })
                    .filter(Boolean)

                if (parentUpdates.length > 0) {
                    await Promise.all(parentUpdates)
                }
            }

            // Sync completedQty to linked work orders (B-008 fix)
            // Re-link work orders to new step IDs and sync progress
            if (steps) {
                const workOrders = await tx.workOrder.findMany({
                    where: { productionBomId: id },
                    select: { id: true, productionBomStepId: true, status: true, plannedQty: true },
                })

                // Build a map of new step IDs → step data for quick lookup
                const newStepIds = Object.values(stepIdMap) as string[]
                const newSteps = await tx.productionBOMStep.findMany({
                    where: { id: { in: newStepIds } },
                    select: { id: true, sequence: true, completedQty: true },
                    orderBy: { sequence: 'asc' },
                })
                const newStepMap = new Map(newSteps.map(s => [s.id, s]))

                for (const wo of workOrders) {
                    // Find the new step ID that corresponds to this WO's old step
                    let newStepId: string | null = null

                    // Direct mapping: if WO's old stepId is a key in stepIdMap
                    if (wo.productionBomStepId && stepIdMap[wo.productionBomStepId]) {
                        newStepId = stepIdMap[wo.productionBomStepId]
                    }
                    // If WO's stepId is already a new ID (wasn't remapped)
                    if (!newStepId && wo.productionBomStepId && newStepMap.has(wo.productionBomStepId)) {
                        newStepId = wo.productionBomStepId
                    }

                    if (!newStepId) continue // WO's step was deleted — skip

                    const step = newStepMap.get(newStepId)
                    if (!step) continue

                    const completedQty = step.completedQty || 0
                    const newStatus = completedQty >= wo.plannedQty ? 'COMPLETED'
                        : completedQty > 0 ? 'IN_PROGRESS'
                        : wo.status

                    await tx.workOrder.update({
                        where: { id: wo.id },
                        data: {
                            productionBomStepId: newStepId,
                            actualQty: completedQty,
                            ...(newStatus !== wo.status && { status: newStatus }),
                            ...(completedQty > 0 && wo.status === 'PLANNED' && { startDate: new Date() }),
                        },
                    })
                }
            }

            return { stepIdMap, itemIdMap }
        }, { timeout: 15000 })

        // Log edit history (outside transaction — non-blocking)
        prisma.bOMEditLog.create({
            data: {
                bomId: id,
                action: "SAVE",
                summary: `Menyimpan BOM: ${steps?.length || 0} proses, ${items?.length || 0} material, target ${body.totalProductionQty || 0} pcs`,
            }
        }).catch(() => {})

        return NextResponse.json({ success: true, idMapping })
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

        // H6: Collect attachment storage paths before cascade delete wipes the records
        const attachments = await prisma.productionBOMAttachment.findMany({
            where: { step: { bomId: id } },
            select: { fileUrl: true },
        })

        // C3: Nullify WorkOrder references before delete (no cascade on WO → BOM)
        await prisma.workOrder.updateMany({
            where: { productionBomId: id },
            data: { productionBomId: null, productionBomStepId: null },
        })

        await prisma.productionBOM.delete({ where: { id } })

        // H6: Clean up storage blobs (non-blocking, after DB delete succeeds)
        if (attachments.length > 0) {
            const paths = attachments
                .map((a) => {
                    try {
                        const urlPath = new URL(a.fileUrl).pathname
                        return urlPath.split('/documents/')[1]
                    } catch { return null }
                })
                .filter(Boolean) as string[]
            if (paths.length > 0) {
                supabase.storage.from('documents').remove(paths).catch(() => {})
            }
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Error deleting production BOM:', error)
        return NextResponse.json({ success: false, error: error?.message || 'Failed to delete production BOM' }, { status: 500 })
    }
}
