import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/manufacturing/groups - Fetch all work center groups
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

        const groups = await prisma.workCenterGroup.findMany({
            where: whereClause,
            include: {
                machines: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        status: true,
                        healthScore: true,
                        isActive: true,
                    },
                },
                _count: {
                    select: {
                        machines: true,
                    },
                },
            },
            orderBy: { name: 'asc' },
        })

        // Calculate summary
        const totalGroups = groups.length
        const totalMachines = groups.reduce((sum, g) => sum + g._count.machines, 0)
        const activeMachines = groups.reduce((sum, g) =>
            sum + g.machines.filter(m => m.status === 'RUNNING').length, 0)

        return NextResponse.json({
            success: true,
            data: groups.map(g => ({
                id: g.id,
                code: g.code,
                name: g.name,
                description: g.description,
                isActive: g.isActive,
                machineCount: g._count.machines,
                machines: g.machines,
                activeMachines: g.machines.filter(m => m.status === 'RUNNING').length,
                avgHealth: g.machines.length > 0
                    ? Math.round(g.machines.reduce((sum, m) => sum + m.healthScore, 0) / g.machines.length)
                    : 0,
                createdAt: g.createdAt,
                updatedAt: g.updatedAt,
            })),
            summary: {
                totalGroups,
                totalMachines,
                activeMachines,
            },
        })
    } catch (error) {
        console.error('Error fetching work center groups:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to fetch work center groups' },
            { status: 500 }
        )
    }
}

// POST /api/manufacturing/groups - Create new work center group
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()

        if (!body.code || !body.name) {
            return NextResponse.json(
                { success: false, error: 'Code and name are required' },
                { status: 400 }
            )
        }

        const group = await prisma.workCenterGroup.create({
            data: {
                code: body.code,
                name: body.name,
                description: body.description,
                isActive: body.isActive ?? true,
            },
            include: {
                _count: {
                    select: { machines: true },
                },
            },
        })

        return NextResponse.json({
            success: true,
            data: group,
            message: 'Work center group created successfully',
        }, { status: 201 })
    } catch (error: any) {
        console.error('Error creating work center group:', error)
        if (error.code === 'P2002') {
            return NextResponse.json(
                { success: false, error: 'A group with this code already exists' },
                { status: 400 }
            )
        }
        return NextResponse.json(
            { success: false, error: 'Failed to create work center group' },
            { status: 500 }
        )
    }
}
