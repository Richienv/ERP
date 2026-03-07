import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

// GET /api/manufacturing/station-workload
// Returns all active BOM steps grouped by station for the workload timeline
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        }

        // Fetch all active BOMs with their steps and stations
        const boms = await prisma.productionBOM.findMany({
            where: { isActive: true },
            include: {
                product: { select: { id: true, code: true, name: true } },
                steps: {
                    include: {
                        station: {
                            select: {
                                id: true,
                                code: true,
                                name: true,
                                stationType: true,
                                operationType: true,
                                costPerUnit: true,
                                subcontractor: { select: { id: true, name: true } },
                            },
                        },
                        allocations: {
                            select: {
                                stationId: true,
                                quantity: true,
                                station: { select: { id: true, name: true, operationType: true } },
                            },
                        },
                    },
                    orderBy: { sequence: 'asc' },
                },
                workOrders: {
                    where: { status: { in: ['PLANNED', 'IN_PROGRESS'] } },
                    select: {
                        id: true,
                        number: true,
                        status: true,
                        plannedQty: true,
                        actualQty: true,
                        startDate: true,
                        dueDate: true,
                    },
                },
            },
        })

        // Fetch all stations for complete list (even those without current work)
        const allStations = await prisma.processStation.findMany({
            where: { isActive: true },
            select: {
                id: true,
                code: true,
                name: true,
                stationType: true,
                operationType: true,
                subcontractor: { select: { id: true, name: true } },
            },
            orderBy: [{ stationType: 'asc' }, { name: 'asc' }],
        })

        // Build response: steps enriched with BOM & product context
        const stepsWithContext = boms.flatMap(bom =>
            bom.steps.map(step => ({
                id: step.id,
                bomId: bom.id,
                productName: bom.product.name,
                productCode: bom.product.code,
                totalQty: bom.totalProductionQty,
                stationId: step.stationId,
                station: step.station,
                sequence: step.sequence,
                durationMinutes: step.durationMinutes,
                parentStepIds: step.parentStepIds,
                startOffsetMinutes: step.startOffsetMinutes,
                completedQty: step.completedQty,
                useSubkon: step.useSubkon,
                operatorName: step.operatorName,
                allocations: step.allocations,
                // Work order context
                activeWorkOrders: bom.workOrders.length,
                workOrderStatus: bom.workOrders.length > 0
                    ? bom.workOrders.some(wo => wo.status === 'IN_PROGRESS') ? 'IN_PROGRESS' : 'PLANNED'
                    : null,
            }))
        )

        // BOM list for filter dropdown
        const bomList = boms.map(bom => ({
            id: bom.id,
            productName: bom.product.name,
            productCode: bom.product.code,
            version: bom.version,
            totalQty: bom.totalProductionQty,
            stepCount: bom.steps.length,
            hasActiveWO: bom.workOrders.length > 0,
        }))

        return NextResponse.json({
            success: true,
            data: {
                steps: stepsWithContext,
                stations: allStations,
                boms: bomList,
                bomCount: boms.length,
                totalSteps: stepsWithContext.length,
            },
        })
    } catch (error: any) {
        console.error('Error fetching station workload:', error)
        return NextResponse.json(
            { success: false, error: error?.message || 'Failed to fetch station workload' },
            { status: 500 }
        )
    }
}
