import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/manufacturing/machines - Fetch all machines/work centers
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const search = searchParams.get('search') || undefined
        const status = searchParams.get('status') || undefined

        // Build where clause
        const whereClause: any = {}

        if (search) {
            whereClause.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } },
            ]
        }

        if (status) {
            whereClause.status = status
        }

        const machines = await prisma.machine.findMany({
            where: whereClause,
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
                        startTime: true,
                        endTime: true,
                        performedBy: true,
                    },
                    orderBy: { startTime: 'desc' },
                    take: 1,
                },
            },
            orderBy: { name: 'asc' },
        })

        // Calculate summary stats
        const totalMachines = machines.length
        const activeMachines = machines.filter(m => m.status === 'RUNNING').length
        const downMachines = machines.filter(m => m.status === 'BREAKDOWN' || m.status === 'MAINTENANCE').length
        const avgEfficiency = machines.length > 0
            ? Math.round(machines.reduce((sum, m) => sum + m.healthScore, 0) / machines.length)
            : 0

        return NextResponse.json({
            success: true,
            data: machines,
            summary: {
                total: totalMachines,
                active: activeMachines,
                down: downMachines,
                avgEfficiency,
            },
        })
    } catch (error) {
        console.error('Error fetching machines:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to fetch machines' },
            { status: 500 }
        )
    }
}

// POST /api/manufacturing/machines - Create new machine
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()

        const {
            code,
            name,
            brand,
            model,
            serialNumber,
            groupId,
            status,
            healthScore,
            capacityPerHour,
            standardHoursPerDay,
            overheadTimePerHour,
            overheadMaterialCostPerHour,
            lastMaintenance,
            nextMaintenance,
            isActive,
        } = body

        if (!code || !name) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields: code, name' },
                { status: 400 }
            )
        }

        // Check if machine code already exists
        const existingMachine = await prisma.machine.findUnique({
            where: { code },
            select: { id: true },
        })

        if (existingMachine) {
            return NextResponse.json(
                { success: false, error: 'Machine code already exists' },
                { status: 409 }
            )
        }

        const machine = await prisma.machine.create({
            data: {
                code,
                name,
                brand: brand || null,
                model: model || null,
                serialNumber: serialNumber || null,
                groupId: groupId || null,
                capacityPerHour: capacityPerHour ? parseInt(capacityPerHour) : null,
                standardHoursPerDay: standardHoursPerDay ? parseInt(standardHoursPerDay) : undefined,
                overheadTimePerHour: overheadTimePerHour !== undefined ? Number(overheadTimePerHour) : undefined,
                overheadMaterialCostPerHour: overheadMaterialCostPerHour !== undefined ? Number(overheadMaterialCostPerHour) : undefined,
                status: status || 'IDLE',
                healthScore: healthScore !== undefined ? Number(healthScore) : 100,
                lastMaintenance: lastMaintenance ? new Date(lastMaintenance) : null,
                nextMaintenance: nextMaintenance ? new Date(nextMaintenance) : null,
                isActive: isActive !== undefined ? Boolean(isActive) : true,
            },
        })

        return NextResponse.json({
            success: true,
            data: machine,
            message: 'Machine created successfully',
        }, { status: 201 })
    } catch (error) {
        console.error('Error creating machine:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to create machine' },
            { status: 500 }
        )
    }
}
