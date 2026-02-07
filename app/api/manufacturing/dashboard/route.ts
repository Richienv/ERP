import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/manufacturing/dashboard - Fetch manufacturing dashboard metrics
export async function GET(request: NextRequest) {
    try {
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
        const startOfWeek = new Date(today)
        startOfWeek.setDate(today.getDate() - today.getDay() + 1)

        // Parallel fetch all data
        const [
            machines,
            workOrdersTotal,
            workOrdersInProgress,
            workOrdersCompleted,
            workOrdersThisMonth,
            qualityInspections,
            recentInspections,
        ] = await Promise.all([
            // Machines/Work Centers
            prisma.machine.findMany({
                where: { isActive: true },
                select: {
                    id: true,
                    name: true,
                    status: true,
                    healthScore: true,
                    capacityPerHour: true,
                },
            }),
            // Total work orders count
            prisma.workOrder.count(),
            // In-progress work orders
            prisma.workOrder.count({ where: { status: 'IN_PROGRESS' } }),
            // Completed this month
            prisma.workOrder.count({
                where: {
                    status: 'COMPLETED',
                    updatedAt: { gte: startOfMonth },
                },
            }),
            // Work orders this month with details
            prisma.workOrder.findMany({
                where: {
                    createdAt: { gte: startOfMonth },
                },
                include: {
                    product: {
                        select: { name: true },
                    },
                },
                orderBy: { createdAt: 'desc' },
                take: 10,
            }),
            // Quality metrics this month
            prisma.qualityInspection.groupBy({
                by: ['status'],
                where: {
                    inspectionDate: { gte: startOfMonth },
                },
                _count: true,
            }),
            // Recent inspections
            prisma.qualityInspection.findMany({
                include: {
                    material: { select: { name: true } },
                    inspector: { select: { firstName: true, lastName: true } },
                },
                orderBy: { inspectionDate: 'desc' },
                take: 5,
            }),
        ])

        // Calculate machine metrics
        const machineMetrics = {
            total: machines.length,
            running: machines.filter(m => m.status === 'RUNNING').length,
            idle: machines.filter(m => m.status === 'IDLE').length,
            maintenance: machines.filter(m => m.status === 'MAINTENANCE').length,
            breakdown: machines.filter(m => m.status === 'BREAKDOWN').length,
            avgHealth: machines.length > 0
                ? Math.round(machines.reduce((sum, m) => sum + m.healthScore, 0) / machines.length)
                : 0,
            totalCapacity: machines.reduce((sum, m) => sum + ((m.capacityPerHour || 0) * 8), 0),
        }

        // Calculate quality metrics
        const passCount = qualityInspections.find(q => q.status === 'PASS')?._count || 0
        const failCount = qualityInspections.find(q => q.status === 'FAIL')?._count || 0
        const totalInspections = passCount + failCount
        const passRate = totalInspections > 0 ? Math.round((passCount / totalInspections) * 100) : 100

        // Calculate production metrics
        const productionThisMonth = workOrdersThisMonth.reduce((sum, wo) => sum + wo.actualQty, 0)
        const plannedThisMonth = workOrdersThisMonth.reduce((sum, wo) => sum + wo.plannedQty, 0)
        const productionEfficiency = plannedThisMonth > 0
            ? Math.round((productionThisMonth / plannedThisMonth) * 100)
            : 0

        // OEE Calculation (simplified)
        // OEE = Availability × Performance × Quality
        const availability = machineMetrics.total > 0
            ? (machineMetrics.running + machineMetrics.idle) / machineMetrics.total
            : 0
        const performance = productionEfficiency / 100
        const quality = passRate / 100
        const oee = Math.round(availability * performance * quality * 100)

        // Critical alerts
        const alerts = []
        if (machineMetrics.breakdown > 0) {
            alerts.push({
                type: 'error',
                title: 'Machine Breakdown',
                message: `${machineMetrics.breakdown} machine(s) currently down`,
            })
        }
        if (passRate < 95) {
            alerts.push({
                type: 'warning',
                title: 'Quality Alert',
                message: `Pass rate at ${passRate}%, below 95% target`,
            })
        }
        if (machineMetrics.avgHealth < 70) {
            alerts.push({
                type: 'warning',
                title: 'Maintenance Required',
                message: `Average machine health at ${machineMetrics.avgHealth}%`,
            })
        }

        return NextResponse.json({
            success: true,
            data: {
                // Production Health
                productionHealth: {
                    oee,
                    availability: Math.round(availability * 100),
                    performance: Math.round(performance * 100),
                    quality: passRate,
                },
                // Work Order Summary
                workOrders: {
                    total: workOrdersTotal,
                    inProgress: workOrdersInProgress,
                    completedThisMonth: workOrdersCompleted,
                    productionThisMonth,
                    plannedThisMonth,
                },
                // Machine Status
                machines: machineMetrics,
                // Quality
                quality: {
                    passRate,
                    totalInspections,
                    passCount,
                    failCount,
                    recentInspections: recentInspections.map(i => ({
                        id: i.id,
                        batchNumber: i.batchNumber,
                        material: i.material.name,
                        inspector: `${i.inspector.firstName} ${i.inspector.lastName || ''}`.trim(),
                        status: i.status,
                        score: i.score,
                        date: i.inspectionDate,
                    })),
                },
                // Recent Orders
                recentOrders: workOrdersThisMonth.map(wo => ({
                    id: wo.id,
                    number: wo.number,
                    product: wo.product.name,
                    plannedQty: wo.plannedQty,
                    actualQty: wo.actualQty,
                    status: wo.status,
                    progress: wo.plannedQty > 0 ? Math.round((wo.actualQty / wo.plannedQty) * 100) : 0,
                })),
                // Alerts
                alerts,
            },
        })
    } catch (error) {
        console.error('Error fetching dashboard data:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to fetch dashboard data' },
            { status: 500 }
        )
    }
}
