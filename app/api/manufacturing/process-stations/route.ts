import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

// GET /api/manufacturing/process-stations
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        }
        const { searchParams } = new URL(request.url)
        const activeOnly = searchParams.get('activeOnly') !== 'false'

        const stations = await prisma.processStation.findMany({
            where: activeOnly ? { isActive: true } : undefined,
            include: {
                subcontractor: {
                    select: {
                        id: true, name: true, phone: true,
                        capacityUnitsPerDay: true, maxCapacityPerMonth: true,
                        leadTimeDays: true, rating: true, onTimeRate: true, qualityScore: true,
                    },
                },
                machine: { select: { id: true, code: true, name: true } },
                childStations: {
                    include: {
                        subcontractor: {
                            select: {
                                id: true, name: true, phone: true,
                                maxCapacityPerMonth: true, leadTimeDays: true,
                                rating: true, onTimeRate: true, qualityScore: true,
                            },
                        },
                    },
                },
            },
            orderBy: [{ stationType: 'asc' }, { name: 'asc' }],
        })

        return NextResponse.json({ success: true, data: stations })
    } catch (error: any) {
        console.error('Error fetching process stations:', error)
        return NextResponse.json(
            { success: false, error: error?.message || 'Failed to fetch process stations' },
            { status: 500 }
        )
    }
}

// POST /api/manufacturing/process-stations
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        }
        const body = await request.json()
        const { code, name, stationType, operationType, subcontractorId, machineId, costPerUnit, description, parentStationId } = body

        if (!code || !name || !stationType || !operationType) {
            return NextResponse.json(
                { success: false, error: 'code, name, stationType, operationType are required' },
                { status: 400 }
            )
        }

        const station = await prisma.processStation.create({
            data: {
                code,
                name,
                stationType,
                operationType,
                subcontractorId: subcontractorId || null,
                machineId: machineId || null,
                costPerUnit: costPerUnit || 0,
                description: description || null,
                parentStationId: parentStationId || null,
            },
            include: {
                subcontractor: { select: { id: true, name: true } },
                machine: { select: { id: true, code: true, name: true } },
            },
        })

        return NextResponse.json({ success: true, data: station }, { status: 201 })
    } catch (error: any) {
        if (error?.code === 'P2002') {
            return NextResponse.json(
                { success: false, error: 'Station code already exists' },
                { status: 409 }
            )
        }
        console.error('Error creating process station:', error)
        return NextResponse.json(
            { success: false, error: error?.message || 'Failed to create process station' },
            { status: 500 }
        )
    }
}
