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
            include: {
                logs: {
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

        const machine = await prisma.machine.update({
            where: { id },
            data: {
                name: body.name,
                brand: body.brand,
                model: body.model,
                serialNumber: body.serialNumber,
                status: body.status,
                healthScore: body.healthScore,
                capacityPerHour: body.capacityPerHour,
                lastMaintenance: body.lastMaintenance ? new Date(body.lastMaintenance) : undefined,
                nextMaintenance: body.nextMaintenance ? new Date(body.nextMaintenance) : undefined,
                isActive: body.isActive,
            },
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
