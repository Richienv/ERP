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
                group: { select: { id: true, code: true, name: true } },
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

        // ── MODE: create-subkon (Subcontractor + ProcessStation in one go) ──
        if (body.mode === 'create-subkon') {
            const { companyName, stationType, costPerUnit, contactPerson, phone,
                    capacityUnitsPerDay, maxCapacityPerMonth, leadTimeDays, description } = body

            if (!companyName || !stationType) {
                return NextResponse.json(
                    { success: false, error: 'companyName and stationType are required' },
                    { status: 400 }
                )
            }

            // Generate unique station code from company name
            const prefix = companyName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 6).toUpperCase()
            const suffix = Date.now().toString(36).slice(-4).toUpperCase()
            const code = `SUB-${prefix}-${suffix}`

            const station = await prisma.$transaction(async (tx) => {
                // Create the Subcontractor company
                const subcontractor = await tx.subcontractor.create({
                    data: {
                        name: companyName,
                        contactPerson: contactPerson || null,
                        phone: phone || null,
                        capacityUnitsPerDay: capacityUnitsPerDay || null,
                        maxCapacityPerMonth: maxCapacityPerMonth || null,
                        leadTimeDays: leadTimeDays || null,
                    },
                })

                // Create the ProcessStation linked to the Subcontractor
                return tx.processStation.create({
                    data: {
                        code,
                        name: `${companyName} (${stationType})`,
                        stationType,
                        operationType: 'SUBCONTRACTOR',
                        subcontractor: { connect: { id: subcontractor.id } },
                        costPerUnit: costPerUnit || 0,
                        description: description || null,
                    },
                    include: {
                        subcontractor: {
                            select: {
                                id: true, name: true, phone: true,
                                capacityUnitsPerDay: true, maxCapacityPerMonth: true,
                                leadTimeDays: true, rating: true, onTimeRate: true, qualityScore: true,
                            },
                        },
                    },
                })
            })

            return NextResponse.json({ success: true, data: station }, { status: 201 })
        }

        // ── MODE: generic station creation (original) ──
        const { code, name, stationType, operationType, subcontractorId, machineId, costPerUnit, description, parentStationId, groupId } = body

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
                ...(subcontractorId ? { subcontractor: { connect: { id: subcontractorId } } } : {}),
                ...(machineId ? { machine: { connect: { id: machineId } } } : {}),
                costPerUnit: costPerUnit || 0,
                description: description || null,
                ...(parentStationId ? { parentStation: { connect: { id: parentStationId } } } : {}),
                ...(groupId ? { group: { connect: { id: groupId } } } : {}),
            },
            include: {
                subcontractor: { select: { id: true, name: true } },
                machine: { select: { id: true, code: true, name: true } },
                group: { select: { id: true, code: true, name: true } },
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
