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
        const { priority = 'NORMAL', dueDate } = body

        const bom = await prisma.productionBOM.findUnique({
            where: { id },
            include: {
                product: { select: { id: true, code: true, name: true, unit: true } },
                steps: {
                    include: {
                        station: { select: { id: true, name: true, operationType: true } },
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

        // Validate: all steps must have materials
        const emptySteps = bom.steps.filter((s) => s.materials.length === 0)
        if (emptySteps.length > 0) {
            return NextResponse.json({
                success: false,
                error: `Step ${emptySteps.map((s) => s.sequence).join(', ')} belum ada material`,
            }, { status: 400 })
        }

        // Validate: subcontractor steps must have allocations totaling totalProductionQty
        for (const step of bom.steps) {
            if (step.station.operationType === 'SUBCONTRACTOR') {
                const totalAlloc = step.allocations.reduce((sum, a) => sum + a.quantity, 0)
                if (totalAlloc !== bom.totalProductionQty) {
                    return NextResponse.json({
                        success: false,
                        error: `Alokasi step ${step.sequence} (${step.station.name}): ${totalAlloc}/${bom.totalProductionQty} pcs — harus sama dengan target produksi`,
                    }, { status: 400 })
                }
            }
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

            for (const step of bom.steps) {
                const currentStepWOIds: string[] = []

                // Find parent WO IDs from DAG edges (parentStepIds)
                const parentWOIds: string[] = []
                for (const parentId of ((step as any).parentStepIds || [])) {
                    const parentWOs = stepToWOIds.get(parentId) || []
                    parentWOIds.push(...parentWOs)
                }
                // Fallback for linear flow: if no parentStepIds, use previous step
                const dependsOnId = parentWOIds.length === 1 ? parentWOIds[0] : null

                if (step.station.operationType === 'SUBCONTRACTOR' && step.allocations.length > 0) {
                    for (const alloc of step.allocations) {
                        const woNumber = `${prefix}-${String(sequence).padStart(4, '0')}`
                        const wo = await tx.workOrder.create({
                            data: {
                                number: woNumber,
                                productId: bom.productId,
                                productionBomId: bom.id,
                                productionBomStepId: step.id,
                                priority,
                                plannedQty: alloc.quantity,
                                dueDate: dueDate ? new Date(dueDate) : null,
                                status: 'PLANNED',
                                dependsOnWorkOrderId: dependsOnId,
                            },
                        })
                        currentStepWOIds.push(wo.id)
                        results.push({ ...wo, stepSequence: step.sequence, stationName: step.station.name })
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
                            dueDate: dueDate ? new Date(dueDate) : null,
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
                status: wo.status,
            })),
        }, { status: 201 })
    } catch (error: any) {
        console.error('Error generating SPK:', error)
        return NextResponse.json({ success: false, error: error?.message || 'Gagal membuat SPK' }, { status: 500 })
    }
}
