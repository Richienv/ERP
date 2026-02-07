import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/manufacturing/groups/[id] - Get single group with machines
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        const group = await prisma.workCenterGroup.findUnique({
            where: { id },
            include: {
                machines: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        brand: true,
                        model: true,
                        status: true,
                        healthScore: true,
                        capacityPerHour: true,
                        lastMaintenance: true,
                        nextMaintenance: true,
                        isActive: true,
                    },
                    orderBy: { name: 'asc' },
                },
            },
        })

        if (!group) {
            return NextResponse.json(
                { success: false, error: 'Work center group not found' },
                { status: 404 }
            )
        }

        return NextResponse.json({
            success: true,
            data: {
                ...group,
                machineCount: group.machines.length,
                activeMachines: group.machines.filter(m => m.status === 'RUNNING').length,
                avgHealth: group.machines.length > 0
                    ? Math.round(group.machines.reduce((sum, m) => sum + m.healthScore, 0) / group.machines.length)
                    : 0,
            },
        })
    } catch (error) {
        console.error('Error fetching work center group:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to fetch work center group' },
            { status: 500 }
        )
    }
}

// PATCH /api/manufacturing/groups/[id] - Update group
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await request.json()

        const updateData: any = {}

        if (body.code !== undefined) updateData.code = body.code
        if (body.name !== undefined) updateData.name = body.name
        if (body.description !== undefined) updateData.description = body.description
        if (body.isActive !== undefined) updateData.isActive = body.isActive

        const group = await prisma.workCenterGroup.update({
            where: { id },
            data: updateData,
            include: {
                _count: {
                    select: { machines: true },
                },
            },
        })

        return NextResponse.json({
            success: true,
            data: group,
            message: 'Work center group updated successfully',
        })
    } catch (error) {
        console.error('Error updating work center group:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to update work center group' },
            { status: 500 }
        )
    }
}

// DELETE /api/manufacturing/groups/[id] - Delete group
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        // First unlink all machines from this group
        await prisma.machine.updateMany({
            where: { groupId: id },
            data: { groupId: null },
        })

        await prisma.workCenterGroup.delete({
            where: { id },
        })

        return NextResponse.json({
            success: true,
            message: 'Work center group deleted successfully',
        })
    } catch (error) {
        console.error('Error deleting work center group:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to delete work center group' },
            { status: 500 }
        )
    }
}
