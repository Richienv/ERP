import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Types
interface MachineResponse {
    id: string
    code: string
    name: string
    brand?: string | null
    model?: string | null
    status: string
    healthScore: number
    lastMaintenance?: Date | null
    nextMaintenance?: Date | null
    capacityPerHour?: number | null
    isActive: boolean
}

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
            include: {
                logs: {
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

        const { code, name, brand, model, serialNumber, capacityPerHour } = body

        if (!code || !name) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields: code, name' },
                { status: 400 }
            )
        }

        // Check if machine code already exists
        const existingMachine = await prisma.machine.findUnique({
            where: { code },
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
                capacityPerHour: capacityPerHour ? parseInt(capacityPerHour) : null,
                status: 'IDLE',
                healthScore: 100,
                isActive: true,
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
