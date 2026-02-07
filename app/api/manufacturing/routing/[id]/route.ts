import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/manufacturing/routing/[id] - Get single routing with steps
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        const routing = await prisma.routing.findUnique({
            where: { id },
            include: {
                steps: {
                    include: {
                        machine: {
                            select: {
                                id: true,
                                code: true,
                                name: true,
                                capacityPerHour: true,
                            },
                        },
                        material: {
                            select: {
                                id: true,
                                code: true,
                                name: true,
                                unit: true,
                                costPrice: true,
                            },
                        },
                    },
                    orderBy: { sequence: 'asc' },
                },
            },
        })

        if (!routing) {
            return NextResponse.json(
                { success: false, error: 'Routing not found' },
                { status: 404 }
            )
        }

        const totalDuration = routing.steps.reduce((sum, s) => sum + s.durationMinutes, 0)
        const totalMaterialCost = routing.steps.reduce((sum, s) => {
            if (s.material && s.materialQty) {
                return sum + (Number(s.materialQty) * Number(s.material.costPrice))
            }
            return sum
        }, 0)

        return NextResponse.json({
            success: true,
            data: {
                id: routing.id,
                code: routing.code,
                name: routing.name,
                description: routing.description,
                isActive: routing.isActive,
                stepCount: routing.steps.length,
                totalDuration,
                totalDurationFormatted: `${Math.floor(totalDuration / 60)}h ${totalDuration % 60}m`,
                totalMaterialCost: Math.round(totalMaterialCost),
                steps: routing.steps.map(s => ({
                    id: s.id,
                    sequence: s.sequence,
                    name: s.name,
                    description: s.description,
                    durationMinutes: s.durationMinutes,
                    machine: s.machine,
                    material: s.material
                        ? {
                            ...s.material,
                            costPrice: Number(s.material.costPrice),
                            quantity: Number(s.materialQty),
                            unit: s.materialUnit || s.material.unit,
                            lineCost: Math.round(Number(s.materialQty) * Number(s.material.costPrice)),
                        }
                        : null,
                })),
                createdAt: routing.createdAt,
                updatedAt: routing.updatedAt,
            },
        })
    } catch (error) {
        console.error('Error fetching routing:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to fetch routing' },
            { status: 500 }
        )
    }
}

// PATCH /api/manufacturing/routing/[id] - Update routing
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

        const routing = await prisma.routing.update({
            where: { id },
            data: updateData,
            include: {
                steps: {
                    orderBy: { sequence: 'asc' },
                },
            },
        })

        return NextResponse.json({
            success: true,
            data: routing,
            message: 'Routing updated successfully',
        })
    } catch (error) {
        console.error('Error updating routing:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to update routing' },
            { status: 500 }
        )
    }
}

// DELETE /api/manufacturing/routing/[id] - Delete routing (cascades to steps)
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        await prisma.routing.delete({
            where: { id },
        })

        return NextResponse.json({
            success: true,
            message: 'Routing deleted successfully',
        })
    } catch (error) {
        console.error('Error deleting routing:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to delete routing' },
            { status: 500 }
        )
    }
}
