import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

// POST /api/manufacturing/production-bom/[id]/generate-spk
export async function POST(
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
        const body = await request.json().catch(() => ({}))
        const { priority = 'NORMAL', dueDate, startDate: requestStartDate } = body

        const bom = await prisma.productionBOM.findUnique({
            where: { id },
            include: {
                product: { select: { id: true, code: true, name: true, unit: true } },
                steps: {
                    include: {
                        station: { select: { id: true, name: true, stationType: true, operationType: true } },
                        materials: {
                            include: { bomItem: { include: { material: { select: { id: true, name: true } } } } },
                        },
                        allocations: {
                            include: { station: { select: { id: true, name: true, operationType: true } } },
                        },
                    },
                    orderBy: { sequence: 'asc' },
                },
            },
        })

        if (!bom) {
            return NextResponse.json({ success: false, error: 'Production BOM not found' }, { status: 404 })
        }

        if (bom.totalProductionQty <= 0) {
            return NextResponse.json({ success: false, error: 'Total produksi harus > 0' }, { status: 400 })
        }

        if (bom.steps.length === 0) {
            return NextResponse.json({ success: false, error: 'BOM belum memiliki langkah proses' }, { status: 400 })
        }

        // Validate: production steps (non-QC, non-PACKING) must have materials
        const NON_MATERIAL_TYPES = ['QC', 'PACKING']
        const emptySteps = bom.steps.filter((s) =>
            s.materials.length === 0 && !NON_MATERIAL_TYPES.includes(s.station.stationType ?? '')
        )
        if (emptySteps.length > 0) {
            return NextResponse.json({
                success: false,
                error: `Step ${emptySteps.map((s) => s.sequence).join(', ')} belum ada material`,
            }, { status: 400 })
        }

        // Validate: all steps must have duration set
        const noDuration = bom.steps.filter(s => !s.durationMinutes || Number(s.durationMinutes) <= 0)
        if (noDuration.length > 0) {
            return NextResponse.json({
                success: false,
                error: `Step ${noDuration.map(s => s.sequence).join(', ')} belum ada durasi (wajib diisi)`,
            }, { status: 400 })
        }

        // Validate: steps with allocations must have totals matching totalProductionQty
        for (const step of bom.steps) {
            if (step.allocations.length > 0) {
                const totalAlloc = step.allocations.reduce((sum, a) => sum + a.quantity, 0)
                const isSubkon = step.useSubkon ?? step.station.operationType === 'SUBCONTRACTOR'
                const typeLabel = isSubkon ? 'subkon' : 'in-house'
                if (totalAlloc !== bom.totalProductionQty) {
                    return NextResponse.json({
                        success: false,
                        error: `Alokasi ${typeLabel} step ${step.sequence} (${step.station.name}): ${totalAlloc}/${bom.totalProductionQty} pcs — harus sama dengan target produksi`,
                    }, { status: 400 })
                }
            }
        }

        // Guard: prevent duplicate SPK generation
        const existingWOs = await prisma.workOrder.count({
            where: { productionBomId: id },
        })
        if (existingWOs > 0) {
            return NextResponse.json({
                success: false,
                error: `BOM ini sudah memiliki ${existingWOs} SPK/Work Order. Hapus SPK yang ada sebelum generate ulang.`,
            }, { status: 409 })
        }

        // Generate work orders in transaction
        const createdWOs = await prisma.$transaction(async (tx) => {
            const today = new Date()
            const prefix = `SPK-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`

            const lastWO = await tx.workOrder.findFirst({
                where: { number: { startsWith: prefix } },
                orderBy: { number: 'desc' },
            })

            let sequence = 1
            if (lastWO) {
                const lastSeq = parseInt(lastWO.number.split('-').pop() || '0')
                sequence = lastSeq + 1
            }

            const results: any[] = []
            // DAG-based dependency: map stepId → workOrderIds
            const stepToWOIds = new Map<string, string[]>()
            // DAG-based scheduling: map stepId → end time in minutes from base start
            const stepEndMinutes = new Map<string, number>()
            const baseStart = requestStartDate ? new Date(requestStartDate) : new Date()

            for (const step of bom.steps) {
                const currentStepWOIds: string[] = []

                // Find parent WO IDs from DAG edges (parentStepIds)
                const parentWOIds: string[] = []
                for (const parentId of ((step as any).parentStepIds || [])) {
                    const parentWOs = stepToWOIds.get(parentId) || []
                    parentWOIds.push(...parentWOs)
                }
                // H4: Pick first parent WO (schema supports single dependency only)
                const dependsOnId = parentWOIds.length > 0 ? parentWOIds[0] : null

                // F-007: DAG-aware scheduling — start after ALL parent steps complete (critical path)
                const stepDuration = (Number(step.durationMinutes) || 0) * bom.totalProductionQty
                const parentIds: string[] = (step as any).parentStepIds || []
                let startOffsetMinutes = 0
                if (parentIds.length > 0) {
                    // Start after the LATEST parent finishes (critical path)
                    startOffsetMinutes = Math.max(...parentIds.map(pid => stepEndMinutes.get(pid) || 0))
                }
                stepEndMinutes.set(step.id, startOffsetMinutes + stepDuration)

                const woStartDate = new Date(baseStart.getTime() + startOffsetMinutes * 60 * 1000)
                const woEndDate = new Date(woStartDate.getTime() + stepDuration * 60 * 1000)

                // N-004: Both subkon AND in-house steps with allocations generate per-allocation WOs
                const hasAllocations = step.allocations.length > 0
                if (hasAllocations) {
                    for (const alloc of step.allocations) {
                        const woNumber = `${prefix}-${String(sequence).padStart(4, '0')}`
                        const allocStationName = alloc.station?.name || step.station.name
                        const wo = await tx.workOrder.create({
                            data: {
                                number: woNumber,
                                productId: bom.productId,
                                productionBomId: bom.id,
                                productionBomStepId: step.id,
                                priority,
                                plannedQty: alloc.quantity,
                                startDate: woStartDate,
                                dueDate: dueDate ? new Date(dueDate) : woEndDate,
                                status: 'PLANNED',
                                dependsOnWorkOrderId: dependsOnId,
                            },
                        })
                        currentStepWOIds.push(wo.id)
                        results.push({
                            ...wo,
                            stepSequence: step.sequence,
                            stationName: step.station.name,
                            allocStationName,
                            allocQty: alloc.quantity,
                        })
                        sequence++
                    }
                } else {
                    const woNumber = `${prefix}-${String(sequence).padStart(4, '0')}`
                    const wo = await tx.workOrder.create({
                        data: {
                            number: woNumber,
                            productId: bom.productId,
                            productionBomId: bom.id,
                            productionBomStepId: step.id,
                            priority,
                            plannedQty: bom.totalProductionQty,
                            startDate: woStartDate,
                            dueDate: dueDate ? new Date(dueDate) : woEndDate,
                            status: 'PLANNED',
                            dependsOnWorkOrderId: dependsOnId,
                        },
                    })
                    currentStepWOIds.push(wo.id)
                    results.push({ ...wo, stepSequence: step.sequence, stationName: step.station.name })
                    sequence++
                }

                stepToWOIds.set(step.id, currentStepWOIds)
            }

            return results
        })

        return NextResponse.json({
            success: true,
            message: `Berhasil membuat ${createdWOs.length} SPK`,
            data: createdWOs.map((wo) => ({
                id: wo.id,
                number: wo.number,
                plannedQty: wo.plannedQty,
                stepSequence: wo.stepSequence,
                stationName: wo.stationName,
                allocStationName: wo.allocStationName || null,
                status: wo.status,
            })),
        }, { status: 201 })
    } catch (error: any) {
        console.error('Error generating SPK:', error)
        return NextResponse.json({ success: false, error: error?.message || 'Gagal membuat SPK' }, { status: 500 })
    }
}
