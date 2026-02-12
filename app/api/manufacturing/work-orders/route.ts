import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/manufacturing/work-orders - Fetch all work orders
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const search = searchParams.get('search') || undefined
        const status = searchParams.get('status') || undefined
        const orderType = (searchParams.get('orderType') || '').toUpperCase()
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '20')

        // Build where clause
        const whereClause: any = { AND: [] }

        if (search) {
            whereClause.AND.push({
                OR: [
                    { number: { contains: search, mode: 'insensitive' } },
                    { product: { name: { contains: search, mode: 'insensitive' } } },
                ]
            })
        }

        if (status) {
            whereClause.AND.push({ status })
        }

        if (orderType === 'MO') {
            whereClause.AND.push({ number: { startsWith: 'MO-' } })
        } else if (orderType === 'SPK') {
            whereClause.AND.push({
                OR: [
                    { number: { startsWith: 'SPK-' } },
                    // Backward compatibility for older records
                    { number: { startsWith: 'WO-' } },
                ]
            })
        }

        if (whereClause.AND.length === 0) {
            delete whereClause.AND
        }

        const offset = (page - 1) * limit

        const [workOrders, totalCount, statusRows] = await Promise.all([
            prisma.workOrder.findMany({
                where: whereClause,
                include: {
                    product: {
                        select: {
                            id: true,
                            code: true,
                            name: true,
                            unit: true,
                        },
                    },
                    tasks: {
                        include: {
                            employee: {
                                select: {
                                    id: true,
                                    firstName: true,
                                    lastName: true,
                                },
                            },
                        },
                    },
                    inspections: {
                        orderBy: { inspectionDate: 'desc' },
                        take: 1,
                    },
                    _count: {
                        select: {
                            transactions: true,
                            inspections: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip: offset,
                take: limit,
            }),
            prisma.workOrder.count({ where: whereClause }),
            prisma.workOrder.groupBy({
                by: ['status'],
                where: whereClause,
                _count: { _all: true },
            }),
        ])

        // Enhance with progress calculation
        const enhancedOrders = workOrders.map(wo => {
            const progress = wo.plannedQty > 0
                ? Math.min(100, Math.round((wo.actualQty / wo.plannedQty) * 100))
                : 0

            return {
                ...wo,
                progress,
                workers: wo.tasks.map(t => t.employee ?
                    `${t.employee.firstName}${t.employee.lastName ? ' ' + t.employee.lastName : ''}` :
                    'Unassigned'
                ),
            }
        })

        // Calculate summary stats
        const statusCounts = {
            planned: 0,
            inProgress: 0,
            completed: 0,
            onHold: 0,
        }
        for (const row of statusRows) {
            const count = row._count._all || 0
            if (row.status === 'PLANNED') statusCounts.planned = count
            if (row.status === 'IN_PROGRESS') statusCounts.inProgress = count
            if (row.status === 'COMPLETED') statusCounts.completed = count
            if (row.status === 'ON_HOLD') statusCounts.onHold = count
        }

        return NextResponse.json({
            success: true,
            data: enhancedOrders,
            summary: statusCounts,
            pagination: {
                page,
                limit,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limit),
            },
        })
    } catch (error) {
        console.error('Error fetching work orders:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to fetch work orders' },
            { status: 500 }
        )
    }
}

// POST /api/manufacturing/work-orders - Create new work order
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()

        const { productId, plannedQty, startDate, dueDate, priority, machineId, orderType } = body

        if (!productId || !plannedQty) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields: productId, plannedQty' },
                { status: 400 }
            )
        }

        const numericQty = parseInt(plannedQty)
        if (!Number.isFinite(numericQty) || numericQty <= 0) {
            return NextResponse.json(
                { success: false, error: 'plannedQty must be a positive number' },
                { status: 400 }
            )
        }

        const validPriorities = ['CRITICAL', 'HIGH', 'NORMAL', 'LOW']
        const woPriority = validPriorities.includes(priority) ? priority : 'NORMAL'

        if (machineId) {
            const machine = await prisma.machine.findUnique({
                where: { id: machineId },
                select: { id: true, isActive: true },
            })
            if (!machine || !machine.isActive) {
                return NextResponse.json(
                    { success: false, error: 'Selected machine is invalid or inactive' },
                    { status: 400 }
                )
            }
        }

        const resolvedOrderType = String(orderType || 'SPK').toUpperCase() === 'MO' ? 'MO' : 'SPK'
        const prefix = resolvedOrderType === 'MO' ? 'MO' : 'SPK'

        // Generate work order number by type prefix
        const lastWO = await prisma.workOrder.findFirst({
            where: {
                number: {
                    startsWith: `${prefix}-`,
                },
            },
            orderBy: { createdAt: 'desc' },
            select: { number: true },
        })

        let nextNumber = 1
        if (lastWO?.number) {
            const match = lastWO.number.match(/(?:MO|SPK|WO)-(\d+)/)
            if (match) {
                nextNumber = parseInt(match[1]) + 1
            }
        }
        const woNumber = `${prefix}-${String(nextNumber).padStart(5, '0')}`

        const workOrder = await prisma.workOrder.create({
            data: {
                number: woNumber,
                productId,
                plannedQty: numericQty,
                actualQty: 0,
                startDate: startDate ? new Date(startDate) : null,
                dueDate: dueDate ? new Date(dueDate) : null,
                priority: woPriority,
                machineId: machineId || null,
                status: 'PLANNED',
            },
            include: {
                product: true,
            },
        })

        return NextResponse.json({
            success: true,
            data: workOrder,
            message: 'Work order created successfully',
        }, { status: 201 })
    } catch (error) {
        console.error('Error creating work order:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to create work order' },
            { status: 500 }
        )
    }
}
