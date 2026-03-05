import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

// GET /api/manufacturing/process-stations/[id]
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

        const station = await prisma.processStation.findUnique({
            where: { id },
            include: {
                subcontractor: { select: { id: true, name: true } },
                machine: { select: { id: true, code: true, name: true } },
                group: { select: { id: true, code: true, name: true } },
                childStations: {
                    include: {
                        subcontractor: { select: { id: true, name: true } },
                    },
                },
            },
        })

        if (!station) {
            return NextResponse.json({ success: false, error: 'Station not found' }, { status: 404 })
        }

        return NextResponse.json({ success: true, data: station })
    } catch (error: any) {
        console.error('Error fetching process station:', error)
        return NextResponse.json({ success: false, error: error?.message || 'Failed to fetch station' }, { status: 500 })
    }
}

// PATCH /api/manufacturing/process-stations/[id]
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

        const station = await prisma.processStation.update({
            where: { id },
            data: {
                ...(body.code !== undefined && { code: body.code }),
                ...(body.name !== undefined && { name: body.name }),
                ...(body.stationType !== undefined && { stationType: body.stationType }),
                ...(body.operationType !== undefined && { operationType: body.operationType }),
                ...(body.subcontractorId !== undefined && (body.subcontractorId
                    ? { subcontractor: { connect: { id: body.subcontractorId } } }
                    : { subcontractor: { disconnect: true } })),
                ...(body.machineId !== undefined && (body.machineId
                    ? { machine: { connect: { id: body.machineId } } }
                    : { machine: { disconnect: true } })),
                ...(body.costPerUnit !== undefined && { costPerUnit: body.costPerUnit }),
                ...(body.description !== undefined && { description: body.description }),
                ...(body.isActive !== undefined && { isActive: body.isActive }),
                ...(body.parentStationId !== undefined && (body.parentStationId
                    ? { parentStation: { connect: { id: body.parentStationId } } }
                    : { parentStation: { disconnect: true } })),
                ...(body.groupId !== undefined && (body.groupId
                    ? { group: { connect: { id: body.groupId } } }
                    : { group: { disconnect: true } })),
            },
            include: {
                subcontractor: { select: { id: true, name: true } },
                machine: { select: { id: true, code: true, name: true } },
                group: { select: { id: true, code: true, name: true } },
            },
        })

        return NextResponse.json({ success: true, data: station })
    } catch (error: any) {
        if (error?.code === 'P2002') {
            return NextResponse.json({ success: false, error: 'Station code already exists' }, { status: 409 })
        }
        console.error('Error updating process station:', error)
        return NextResponse.json({ success: false, error: error?.message || 'Failed to update station' }, { status: 500 })
    }
}

// DELETE /api/manufacturing/process-stations/[id]
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

        // Check if station is used in any BOM steps
        const usedInSteps = await prisma.productionBOMStep.count({ where: { stationId: id } })
        if (usedInSteps > 0) {
            return NextResponse.json(
                { success: false, error: `Station is used in ${usedInSteps} BOM step(s). Deactivate instead.` },
                { status: 400 }
            )
        }

        await prisma.processStation.delete({ where: { id } })
        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Error deleting process station:', error)
        return NextResponse.json({ success: false, error: error?.message || 'Failed to delete station' }, { status: 500 })
    }
}
