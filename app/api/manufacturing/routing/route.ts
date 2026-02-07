import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/manufacturing/routing - Fetch all routings
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const search = searchParams.get('search')
        const includeInactive = searchParams.get('includeInactive') === 'true'

        const whereClause: any = {}

        if (!includeInactive) {
            whereClause.isActive = true
        }

        if (search) {
            whereClause.OR = [
                { code: { contains: search, mode: 'insensitive' } },
                { name: { contains: search, mode: 'insensitive' } },
            ]
        }

        const routings = await prisma.routing.findMany({
            where: whereClause,
            include: {
                steps: {
                    include: {
                        machine: {
                            select: {
                                id: true,
                                name: true,
                                code: true,
                            },
                        },
                        material: {
                            select: {
                                id: true,
                                name: true,
                                code: true,
                                unit: true,
                            },
                        },
                    },
                    orderBy: { sequence: 'asc' },
                },
                _count: {
                    select: {
                        steps: true,
                    },
                },
            },
            orderBy: { name: 'asc' },
        })

        // Calculate totals
        const enhancedRoutings = routings.map(r => {
            const totalDuration = r.steps.reduce((sum, s) => sum + s.durationMinutes, 0)
            return {
                id: r.id,
                code: r.code,
                name: r.name,
                description: r.description,
                isActive: r.isActive,
                stepCount: r._count.steps,
                totalDuration,
                totalDurationFormatted: `${Math.floor(totalDuration / 60)}h ${totalDuration % 60}m`,
                steps: r.steps.map(s => ({
                    id: s.id,
                    sequence: s.sequence,
                    name: s.name,
                    description: s.description,
                    durationMinutes: s.durationMinutes,
                    machine: s.machine,
                    material: s.material
                        ? {
                            ...s.material,
                            quantity: Number(s.materialQty),
                            unit: s.materialUnit || s.material.unit,
                        }
                        : null,
                })),
                createdAt: r.createdAt,
                updatedAt: r.updatedAt,
            }
        })

        return NextResponse.json({
            success: true,
            data: enhancedRoutings,
            summary: {
                total: routings.length,
                active: routings.filter(r => r.isActive).length,
            },
        })
    } catch (error) {
        console.error('Error fetching routings:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to fetch routings' },
            { status: 500 }
        )
    }
}

// POST /api/manufacturing/routing - Create new routing
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()

        if (!body.code || !body.name) {
            return NextResponse.json(
                { success: false, error: 'Code and name are required' },
                { status: 400 }
            )
        }

        const routing = await prisma.routing.create({
            data: {
                code: body.code,
                name: body.name,
                description: body.description,
                isActive: body.isActive ?? true,
                steps: body.steps?.length > 0
                    ? {
                        create: body.steps.map((step: any, index: number) => ({
                            sequence: step.sequence ?? index + 1,
                            name: step.name,
                            description: step.description,
                            durationMinutes: step.durationMinutes || 0,
                            machineId: step.machineId,
                            materialId: step.materialId,
                            materialQty: step.materialQty,
                            materialUnit: step.materialUnit,
                        })),
                    }
                    : undefined,
            },
            include: {
                steps: {
                    orderBy: { sequence: 'asc' },
                },
            },
        })

        return NextResponse.json({
            success: true,
            data: routing,
            message: 'Routing created successfully',
        }, { status: 201 })
    } catch (error: any) {
        console.error('Error creating routing:', error)
        if (error.code === 'P2002') {
            return NextResponse.json(
                { success: false, error: 'A routing with this code already exists' },
                { status: 400 }
            )
        }
        return NextResponse.json(
            { success: false, error: 'Failed to create routing' },
            { status: 500 }
        )
    }
}
