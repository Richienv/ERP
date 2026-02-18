import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/manufacturing/machines/[id] - Get single machine
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        const machine = await prisma.machine.findUnique({
            where: { id },
            select: {
                id: true,
                code: true,
                name: true,
                brand: true,
                model: true,
                serialNumber: true,
                groupId: true,
                status: true,
                healthScore: true,
                lastMaintenance: true,
                nextMaintenance: true,
                capacityPerHour: true,
                standardHoursPerDay: true,
                overheadTimePerHour: true,
                overheadMaterialCostPerHour: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
                logs: {
                    select: {
                        id: true,
                        type: true,
                        description: true,
                        cost: true,
                        startTime: true,
                        endTime: true,
                        performedBy: true,
                        createdAt: true,
                    },
                    orderBy: { startTime: 'desc' },
                    take: 10,
                },
            },
        })

        if (!machine) {
            return NextResponse.json(
                { success: false, error: 'Machine not found' },
                { status: 404 }
            )
        }

        return NextResponse.json({
            success: true,
            data: machine,
        })
    } catch (error) {
        console.error('Error fetching machine:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to fetch machine' },
            { status: 500 }
        )
    }
}

// PATCH /api/manufacturing/machines/[id] - Update machine
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
        if (body.brand !== undefined) updateData.brand = body.brand || null
        if (body.model !== undefined) updateData.model = body.model || null
        if (body.serialNumber !== undefined) updateData.serialNumber = body.serialNumber || null
        if (body.groupId !== undefined) updateData.groupId = body.groupId || null
        if (body.status !== undefined) updateData.status = body.status
        if (body.healthScore !== undefined) updateData.healthScore = Number(body.healthScore)
        if (body.capacityPerHour !== undefined) {
            updateData.capacityPerHour = body.capacityPerHour === null || body.capacityPerHour === '' ? null : Number(body.capacityPerHour)
        }
        if (body.standardHoursPerDay !== undefined) updateData.standardHoursPerDay = Number(body.standardHoursPerDay)
        if (body.overheadTimePerHour !== undefined) updateData.overheadTimePerHour = Number(body.overheadTimePerHour)
        if (body.overheadMaterialCostPerHour !== undefined) updateData.overheadMaterialCostPerHour = Number(body.overheadMaterialCostPerHour)
        if (body.lastMaintenance !== undefined) {
            updateData.lastMaintenance = body.lastMaintenance ? new Date(body.lastMaintenance) : null
        }
        if (body.nextMaintenance !== undefined) {
            updateData.nextMaintenance = body.nextMaintenance ? new Date(body.nextMaintenance) : null
        }
        if (body.isActive !== undefined) updateData.isActive = Boolean(body.isActive)

        const machine = await prisma.machine.update({
            where: { id },
            data: updateData,
        })

        return NextResponse.json({
            success: true,
            data: machine,
            message: 'Machine updated successfully',
        })
    } catch (error) {
        console.error('Error updating machine:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to update machine' },
            { status: 500 }
        )
    }
}

// DELETE /api/manufacturing/machines/[id] - Delete machine
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        await prisma.machine.delete({
            where: { id },
        })

        return NextResponse.json({
            success: true,
            message: 'Machine deleted successfully',
        })
    } catch (error) {
        console.error('Error deleting machine:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to delete machine' },
            { status: 500 }
        )
    }
}
