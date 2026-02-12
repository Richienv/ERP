import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getAuthzUser } from '@/lib/authz'
import { isSuperRole, resolveEmployeeContext } from '@/lib/employee-context'

const QUALITY_KEYWORDS = ['quality', 'qc', 'qa', 'inspector', 'mutu']
const hasQualityKeyword = (value?: string | null) => {
    const normalized = (value || '').toLowerCase()
    return QUALITY_KEYWORDS.some((keyword) => normalized.includes(keyword))
}

const isQualityEmployee = (employee: { department?: string | null; position?: string | null }) =>
    hasQualityKeyword(employee.department) || hasQualityKeyword(employee.position)

async function assertAuthenticatedRequest() {
    const supabase = await createClient()
    const {
        data: { user },
        error,
    } = await supabase.auth.getUser()

    if (error || !user) throw new Error('Unauthorized')
}

// GET /api/manufacturing/quality - Fetch all quality inspections
export async function GET(request: NextRequest) {
    try {
        await assertAuthenticatedRequest()
        const { searchParams } = new URL(request.url)
        const search = searchParams.get('search') || undefined
        const status = searchParams.get('status') || undefined
        const workOrderId = searchParams.get('workOrderId') || undefined
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '20')

        // Build where clause
        const whereClause: any = {}

        if (search) {
            whereClause.OR = [
                { batchNumber: { contains: search, mode: 'insensitive' } },
                { material: { name: { contains: search, mode: 'insensitive' } } },
            ]
        }

        if (status) {
            whereClause.status = status
        }

        if (workOrderId) {
            whereClause.workOrderId = workOrderId
        }

        const offset = (page - 1) * limit

        const [inspections, totalCount, inspectors, materials, workOrders, pendingInspectionCount, pendingInspectionQueue] = await Promise.all([
            prisma.qualityInspection.findMany({
                where: whereClause,
                include: {
                    material: {
                        select: {
                            id: true,
                            code: true,
                            name: true,
                        },
                    },
                    inspector: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                        },
                    },
                    workOrder: {
                        select: {
                            id: true,
                            number: true,
                        },
                    },
                    defects: true,
                    _count: {
                        select: {
                            defects: true,
                        },
                    },
                },
                orderBy: { inspectionDate: 'desc' },
                skip: offset,
                take: limit,
            }),
            prisma.qualityInspection.count({ where: whereClause }),
            prisma.employee.findMany({
                where: {
                    status: 'ACTIVE',
                    OR: [
                        { department: { contains: 'quality', mode: 'insensitive' } },
                        { department: { contains: 'qc', mode: 'insensitive' } },
                        { department: { contains: 'qa', mode: 'insensitive' } },
                        { position: { contains: 'quality', mode: 'insensitive' } },
                        { position: { contains: 'inspector', mode: 'insensitive' } },
                        { position: { contains: 'qc', mode: 'insensitive' } },
                    ],
                },
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    department: true,
                    position: true,
                },
                orderBy: [
                    { firstName: 'asc' },
                    { lastName: 'asc' },
                ],
                take: 200,
            }),
            prisma.product.findMany({
                where: { isActive: true },
                select: {
                    id: true,
                    code: true,
                    name: true,
                },
                orderBy: { name: 'asc' },
                take: 500,
            }),
            prisma.workOrder.findMany({
                where: {
                    status: { in: ['PLANNED', 'IN_PROGRESS', 'ON_HOLD'] },
                },
                select: {
                    id: true,
                    number: true,
                },
                orderBy: { createdAt: 'desc' },
                take: 200,
            }),
            prisma.workOrder.count({
                where: {
                    status: { in: ['PLANNED', 'IN_PROGRESS', 'ON_HOLD'] },
                    inspections: { none: {} },
                },
            }),
            prisma.workOrder.findMany({
                where: {
                    status: { in: ['PLANNED', 'IN_PROGRESS', 'ON_HOLD'] },
                    inspections: { none: {} },
                },
                select: {
                    id: true,
                    number: true,
                    status: true,
                    priority: true,
                    plannedQty: true,
                    startDate: true,
                    dueDate: true,
                    createdAt: true,
                    product: {
                        select: {
                            id: true,
                            code: true,
                            name: true,
                        },
                    },
                    machine: {
                        select: {
                            id: true,
                            code: true,
                            name: true,
                        },
                    },
                },
                orderBy: [
                    { dueDate: 'asc' },
                    { createdAt: 'desc' },
                ],
                take: 100,
            }),
        ])

        // Enhance with formatted data
        const enhancedInspections = inspections.map(insp => ({
            ...insp,
            inspectorName: `${insp.inspector.firstName}${insp.inspector.lastName ? ' ' + insp.inspector.lastName : ''}`,
            defectCount: insp._count.defects,
            result: insp.status === 'PASS' ? 'Pass' : insp.status === 'FAIL' ? 'Fail' : 'Conditional',
        }))

        // Calculate summary metrics
        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)

        const todayInspections = inspections.filter(
            i => new Date(i.inspectionDate) >= todayStart
        )
        const passedToday = todayInspections.filter(i => i.status === 'PASS').length
        const passRate = todayInspections.length > 0
            ? Math.round((passedToday / todayInspections.length) * 100 * 10) / 10
            : 100

        const totalDefects = inspections.reduce((sum, i) => sum + i._count.defects, 0)

        return NextResponse.json({
            success: true,
            data: enhancedInspections,
            summary: {
                passRate,
                defectCount: totalDefects,
                pendingCount: pendingInspectionCount,
                todayCount: todayInspections.length,
            },
            pendingQueue: pendingInspectionQueue,
            options: {
                inspectors,
                materials,
                workOrders,
            },
            pagination: {
                page,
                limit,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limit),
            },
        })
    } catch (error) {
        console.error('Error fetching quality inspections:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to fetch quality inspections' },
            { status: 500 }
        )
    }
}

// POST /api/manufacturing/quality - Create new quality inspection
export async function POST(request: NextRequest) {
    try {
        await assertAuthenticatedRequest()
        const actorUser = await getAuthzUser()
        const body = await request.json()

        const { batchNumber, materialId, inspectorId, workOrderId, status, score, notes, defects } = body

        if (!batchNumber || !materialId || !inspectorId) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields: batchNumber, materialId, inspectorId' },
                { status: 400 }
            )
        }

        const [inspector, actorContext] = await Promise.all([
            prisma.employee.findUnique({
                where: { id: inspectorId },
                select: { id: true, status: true, department: true, position: true },
            }),
            resolveEmployeeContext(prisma as any, actorUser),
        ])

        if (!inspector || inspector.status !== 'ACTIVE' || !isQualityEmployee(inspector)) {
            return NextResponse.json(
                { success: false, error: 'Inspector tidak valid. Pilih employee QC/Quality yang aktif.' },
                { status: 400 }
            )
        }

        if (!actorContext && !isSuperRole(actorUser.role)) {
            return NextResponse.json(
                { success: false, error: 'Akun belum terhubung ke employee aktif.' },
                { status: 403 }
            )
        }

        const inspection = await prisma.qualityInspection.create({
            data: {
                batchNumber,
                materialId,
                inspectorId,
                workOrderId: workOrderId || null,
                status: status || 'PASS',
                score: parseFloat(score || 100),
                notes: notes || null,
                defects: defects && defects.length > 0 ? {
                    create: defects.map((d: any) => ({
                        type: d.type,
                        description: d.description,
                        actionTaken: d.actionTaken,
                    })),
                } : undefined,
            },
            include: {
                material: true,
                inspector: true,
                defects: true,
            },
        })

        return NextResponse.json({
            success: true,
            data: inspection,
            message: 'Quality inspection created successfully',
        }, { status: 201 })
    } catch (error) {
        console.error('Error creating quality inspection:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to create quality inspection' },
            { status: 500 }
        )
    }
}
