import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST /api/sales/orders/[id]/create-work-orders - Auto-create work orders from sales order
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await request.json()
        const { priority = 'NORMAL', dueDate } = body

        // Fetch the sales order with items
        const salesOrder = await prisma.salesOrder.findUnique({
            where: { id },
            include: {
                items: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                code: true,
                                name: true,
                                unit: true,
                            },
                        },
                        workOrders: true, // Check if work orders already exist
                    },
                },
                customer: {
                    select: {
                        name: true,
                    },
                },
            },
        })

        if (!salesOrder) {
            return NextResponse.json(
                { success: false, error: 'Sales order not found' },
                { status: 404 }
            )
        }

        // Only allow work order creation for confirmed sales orders
        if (salesOrder.status !== 'CONFIRMED' && salesOrder.status !== 'PROCESSING') {
            return NextResponse.json(
                { success: false, error: `Cannot create work orders for ${salesOrder.status} orders. Order must be CONFIRMED or PROCESSING.` },
                { status: 400 }
            )
        }

        // Find items that don't have work orders yet
        const itemsNeedingWorkOrders = salesOrder.items.filter(item => item.workOrders.length === 0)

        if (itemsNeedingWorkOrders.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'All items already have work orders',
                data: [],
            })
        }

        // Generate work order number prefix
        const today = new Date()
        const prefix = `WO-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`

        // Get the last work order number for this prefix
        const lastWO = await prisma.workOrder.findFirst({
            where: {
                number: { startsWith: prefix },
            },
            orderBy: { number: 'desc' },
        })

        let sequence = 1
        if (lastWO) {
            const lastSeq = parseInt(lastWO.number.split('-').pop() || '0')
            sequence = lastSeq + 1
        }

        // Create work orders for each item
        const createdWorkOrders = []
        for (const item of itemsNeedingWorkOrders) {
            const workOrderNumber = `${prefix}-${String(sequence).padStart(4, '0')}`

            const workOrder = await prisma.workOrder.create({
                data: {
                    number: workOrderNumber,
                    productId: item.productId,
                    salesOrderId: id,
                    salesOrderItemId: item.id,
                    priority,
                    plannedQty: Math.ceil(Number(item.quantity)), // Round up for manufacturing
                    dueDate: dueDate ? new Date(dueDate) : salesOrder.requestedDate || null,
                    status: 'PLANNED',
                },
                include: {
                    product: {
                        select: {
                            code: true,
                            name: true,
                            unit: true,
                        },
                    },
                },
            })

            createdWorkOrders.push(workOrder)
            sequence++
        }

        // Update sales order status to PROCESSING if it was CONFIRMED
        if (salesOrder.status === 'CONFIRMED') {
            await prisma.salesOrder.update({
                where: { id },
                data: { status: 'PROCESSING' },
            })
        }

        return NextResponse.json({
            success: true,
            message: `Created ${createdWorkOrders.length} work order(s)`,
            data: createdWorkOrders.map(wo => ({
                id: wo.id,
                number: wo.number,
                product: wo.product,
                plannedQty: wo.plannedQty,
                priority: wo.priority,
                dueDate: wo.dueDate,
                status: wo.status,
            })),
        }, { status: 201 })
    } catch (error) {
        console.error('Error creating work orders from sales order:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to create work orders' },
            { status: 500 }
        )
    }
}

// GET /api/sales/orders/[id]/create-work-orders - Preview what work orders would be created
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        // Fetch the sales order with items
        const salesOrder = await prisma.salesOrder.findUnique({
            where: { id },
            include: {
                items: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                code: true,
                                name: true,
                                unit: true,
                            },
                        },
                        workOrders: {
                            select: {
                                id: true,
                                number: true,
                                status: true,
                                plannedQty: true,
                                actualQty: true,
                            },
                        },
                    },
                },
            },
        })

        if (!salesOrder) {
            return NextResponse.json(
                { success: false, error: 'Sales order not found' },
                { status: 404 }
            )
        }

        const itemsWithoutWorkOrders = salesOrder.items.filter(item => item.workOrders.length === 0)
        const itemsWithWorkOrders = salesOrder.items.filter(item => item.workOrders.length > 0)

        return NextResponse.json({
            success: true,
            data: {
                salesOrderNumber: salesOrder.number,
                status: salesOrder.status,
                canCreateWorkOrders: salesOrder.status === 'CONFIRMED' || salesOrder.status === 'PROCESSING',
                itemsNeedingWorkOrders: itemsWithoutWorkOrders.map(item => ({
                    id: item.id,
                    product: item.product,
                    quantity: Number(item.quantity),
                })),
                itemsWithWorkOrders: itemsWithWorkOrders.map(item => ({
                    id: item.id,
                    product: item.product,
                    quantity: Number(item.quantity),
                    workOrders: item.workOrders,
                })),
            },
        })
    } catch (error) {
        console.error('Error previewing work orders:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to fetch work order preview' },
            { status: 500 }
        )
    }
}
