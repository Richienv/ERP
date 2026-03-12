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
                                group: { select: { id: true, name: true } },
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
                        workOrders: {
                            select: { actualQty: true, status: true },
                        },
                    },
                    orderBy: { sequence: 'asc' },
                },
            },
        })

        if (!bom) {
            return NextResponse.json({ success: false, error: 'Production BOM not found' }, { status: 404 })
        }

        // Aggregate completedQty from linked WorkOrders per step (actualQty = produced qty)
        const bomAny = bom as any
        const enrichedSteps = bomAny.steps.map((step: any) => {
            const woCompletedQty = step.workOrders?.reduce(
                (sum: number, wo: any) => sum + (wo.actualQty ?? 0), 0
            ) ?? step.completedQty
            const { workOrders: _wo, ...stepWithoutWO } = step
            return { ...stepWithoutWO, completedQty: woCompletedQty }
        })

        return NextResponse.json({ success: true, data: { ...bom, steps: enrichedSteps } })
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

        // Fetch OLD state for change detection (before writing)
        const oldBom = await prisma.productionBOM.findUnique({
            where: { id },
            select: {
                totalProductionQty: true,
                notes: true,
                items: {
                    select: {
                        materialId: true,
                        quantityPerUnit: true,
                        wastePct: true,
                        material: { select: { name: true } },
                    },
                },
                steps: {
                    select: {
                        stationId: true,
                        sequence: true,
                        durationMinutes: true,
                        useSubkon: true,
                        operatorName: true,
                        laborMonthlySalary: true,
                        parentStepIds: true,
                        station: { select: { name: true, code: true } },
                        allocations: {
                            select: {
                                stationId: true,
                                quantity: true,
                                pricePerPcs: true,
                                station: { select: { name: true, subcontractor: { select: { name: true } } } },
                            },
                        },
                    },
                    orderBy: { sequence: 'asc' },
                },
            },
        })

        // Fetch current material prices for snapshotCostPrice (drift detection)
        const materialIds = items ? items.map((i: any) => i.materialId).filter(Boolean) : []
        const materialPrices = materialIds.length > 0
            ? await prisma.product.findMany({ where: { id: { in: materialIds } }, select: { id: true, costPrice: true } })
            : []
        const priceMap = new Map(materialPrices.map((m) => [m.id, m.costPrice]))

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
                            snapshotCostPrice: priceMap.get(item.materialId) ?? null,
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

        // --- CHANGE DETECTION: compare old vs new state ---
        const changes: string[] = []
        const details: Record<string, any> = {}

        if (oldBom) {
            // Target qty changed
            if (totalProductionQty !== undefined && totalProductionQty !== oldBom.totalProductionQty) {
                changes.push(`Target: ${oldBom.totalProductionQty} → ${totalProductionQty} pcs`)
                details.targetQty = { from: oldBom.totalProductionQty, to: totalProductionQty }
            }

            // Material changes
            if (items) {
                const oldMatIds = new Set(oldBom.items.map(i => i.materialId))
                const newMatIds = new Set(items.map((i: any) => i.materialId))
                const added = items.filter((i: any) => !oldMatIds.has(i.materialId))
                const removed = oldBom.items.filter(i => !newMatIds.has(i.materialId))

                // Qty/waste changes on existing materials
                const matChanges: string[] = []
                for (const newItem of items as any[]) {
                    const oldItem = oldBom.items.find(i => i.materialId === newItem.materialId)
                    if (!oldItem) continue
                    if (Number(newItem.quantityPerUnit) !== Number(oldItem.quantityPerUnit)) {
                        const name = oldItem.material?.name || newItem.materialId
                        matChanges.push(`${name}: qty ${oldItem.quantityPerUnit} → ${newItem.quantityPerUnit}`)
                    }
                    if (Number(newItem.wastePct || 0) !== Number(oldItem.wastePct || 0)) {
                        const name = oldItem.material?.name || newItem.materialId
                        matChanges.push(`${name}: waste ${oldItem.wastePct}% → ${newItem.wastePct || 0}%`)
                    }
                }

                if (added.length > 0) changes.push(`+${added.length} material baru`)
                if (removed.length > 0) changes.push(`-${removed.length} material dihapus (${removed.map(r => r.material?.name).filter(Boolean).join(', ')})`)
                if (matChanges.length > 0) changes.push(...matChanges)

                if (added.length || removed.length || matChanges.length) {
                    details.materials = { added: added.length, removed: removed.length, modified: matChanges.length }
                }
            }

            // Step/process changes
            if (steps) {
                const oldStationIds = new Set(oldBom.steps.map(s => s.stationId))
                const newStationIds = new Set(steps.map((s: any) => s.stationId))

                const addedSteps = steps.filter((s: any) => !oldStationIds.has(s.stationId))
                const removedSteps = oldBom.steps.filter(s => !newStationIds.has(s.stationId))

                if (addedSteps.length > 0) changes.push(`+${addedSteps.length} proses baru`)
                if (removedSteps.length > 0) changes.push(`-${removedSteps.length} proses dihapus (${removedSteps.map(s => s.station?.name).filter(Boolean).join(', ')})`)

                // Detect changes on existing steps
                for (const newStep of steps as any[]) {
                    const oldStep = oldBom.steps.find(s => s.stationId === newStep.stationId)
                    if (!oldStep) continue
                    const stepName = oldStep.station?.name || `Step ${oldStep.sequence}`

                    // Duration changed
                    if (Number(newStep.durationMinutes || 0) !== Number(oldStep.durationMinutes || 0)) {
                        changes.push(`${stepName}: durasi ${oldStep.durationMinutes || 0} → ${newStep.durationMinutes || 0} menit`)
                    }

                    // Subkon toggle
                    const oldSubkon = oldStep.useSubkon ?? false
                    const newSubkon = newStep.useSubkon ?? false
                    if (oldSubkon !== newSubkon) {
                        changes.push(`${stepName}: ${newSubkon ? 'In-House → Subkon' : 'Subkon → In-House'}`)
                    }

                    // Operator changed
                    if ((newStep.operatorName || null) !== (oldStep.operatorName || null)) {
                        changes.push(`${stepName}: operator ${oldStep.operatorName || '—'} → ${newStep.operatorName || '—'}`)
                    }

                    // Salary changed
                    if (Number(newStep.laborMonthlySalary || 0) !== Number(oldStep.laborMonthlySalary || 0)) {
                        changes.push(`${stepName}: gaji ${(oldStep.laborMonthlySalary || 0).toLocaleString('id-ID')} → ${(newStep.laborMonthlySalary || 0).toLocaleString('id-ID')}`)
                    }

                    // Allocation changes (subkon CV / in-house distribution)
                    const oldAllocKeys = (oldStep.allocations || []).map((a: any) => `${a.stationId}:${a.quantity}:${a.pricePerPcs}`).sort().join('|')
                    const newAllocKeys = (newStep.allocations || []).map((a: any) => `${a.stationId}:${a.quantity}:${a.pricePerPcs}`).sort().join('|')
                    if (oldAllocKeys !== newAllocKeys) {
                        const oldNames = (oldStep.allocations || []).map((a: any) => a.station?.subcontractor?.name || a.station?.name).filter(Boolean)
                        const newNames = (newStep.allocations || []).map((a: any) => a.stationId)
                        changes.push(`${stepName}: alokasi diubah${oldNames.length > 0 ? ` (${oldNames.join(', ')})` : ''}`)
                    }
                }

                // Flow/connection changes
                const oldFlows = oldBom.steps.map(s => `${s.stationId}:${(s.parentStepIds || []).sort().join(',')}`).sort().join('|')
                const newFlows = steps.map((s: any) => `${s.stationId}:${(s.parentStepIds || []).sort().join(',')}`).sort().join('|')
                if (oldFlows !== newFlows) {
                    changes.push('Urutan/flow proses diubah')
                }

                if (addedSteps.length || removedSteps.length) {
                    details.steps = { added: addedSteps.length, removed: removedSteps.length }
                }
            }

            // Notes changed
            if (notes !== undefined && notes !== oldBom.notes) {
                changes.push('Catatan diubah')
            }
        }

        // Build summary
        const summary = changes.length > 0
            ? changes.join(' • ')
            : `Menyimpan BOM: ${steps?.length || 0} proses, ${items?.length || 0} material, target ${totalProductionQty || 0} pcs`

        // Log edit history (outside transaction — non-blocking)
        prisma.bOMEditLog.create({
            data: {
                bomId: id,
                action: "SAVE",
                summary,
                details: changes.length > 0 ? { changes, ...details } : undefined,
                userId: user.id,
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
