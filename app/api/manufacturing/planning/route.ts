import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/manufacturing/planning - Fetch planning data (work orders, capacity, forecasts)
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const weeks = parseInt(searchParams.get('weeks') || '4')

        // Get date range
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const startOfWeek = new Date(today)
        startOfWeek.setDate(today.getDate() - today.getDay() + 1) // Monday

        const endDate = new Date(startOfWeek)
        endDate.setDate(startOfWeek.getDate() + (weeks * 7))

        // Fetch work orders in the planning window
        const workOrders = await prisma.workOrder.findMany({
            where: {
                OR: [
                    { status: 'PLANNED' },
                    { status: 'IN_PROGRESS' },
                    {
                        dueDate: {
                            gte: startOfWeek,
                            lte: endDate,
                        },
                    },
                ],
            },
            include: {
                product: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        unit: true,
                    },
                },
            },
            orderBy: { dueDate: 'asc' },
        })

        // Fetch machines for capacity data
        const machines = await prisma.machine.findMany({
            where: { isActive: true },
            select: {
                id: true,
                name: true,
                status: true,
                capacityPerHour: true,
                healthScore: true,
            },
        })

        // Calculate weekly schedule
        const weeklySchedule: any[] = []
        for (let w = 0; w < weeks; w++) {
            const weekStart = new Date(startOfWeek)
            weekStart.setDate(startOfWeek.getDate() + (w * 7))
            const weekEnd = new Date(weekStart)
            weekEnd.setDate(weekStart.getDate() + 6)

            const weekOrders = workOrders.filter(wo => {
                if (!wo.dueDate) return false
                const due = new Date(wo.dueDate)
                return due >= weekStart && due <= weekEnd
            })

            const totalPlanned = weekOrders.reduce((sum, wo) => sum + wo.plannedQty, 0)
            const totalCompleted = weekOrders.reduce((sum, wo) => sum + wo.actualQty, 0)

            // Estimate capacity (simple: sum of machine capacities * 8 hours * 5 days)
            const activeMachines = machines.filter(m => m.status !== 'BREAKDOWN' && m.status !== 'OFFLINE')
            const weeklyCapacity = activeMachines.reduce((sum, m) =>
                sum + ((m.capacityPerHour || 10) * 8 * 5), 0)

            const utilizationPct = weeklyCapacity > 0
                ? Math.round((totalPlanned / weeklyCapacity) * 100)
                : 0

            weeklySchedule.push({
                weekNumber: w + 1,
                weekStart: weekStart.toISOString().split('T')[0],
                weekEnd: weekEnd.toISOString().split('T')[0],
                label: `Week ${w + 1}`,
                orders: weekOrders.length,
                plannedQty: totalPlanned,
                completedQty: totalCompleted,
                capacity: weeklyCapacity,
                utilizationPct: Math.min(utilizationPct, 150), // Cap at 150% for display
                status: utilizationPct > 100 ? 'overload' : utilizationPct > 80 ? 'high' : 'normal',
            })
        }

        // Calculate summary metrics
        const totalPlanned = workOrders.filter(wo => wo.status === 'PLANNED').length
        const inProgress = workOrders.filter(wo => wo.status === 'IN_PROGRESS').length
        const totalCapacity = machines.reduce((sum, m) => sum + ((m.capacityPerHour || 10) * 8), 0)
        const avgUtilization = weeklySchedule.length > 0
            ? Math.round(weeklySchedule.reduce((sum, w) => sum + w.utilizationPct, 0) / weeklySchedule.length)
            : 0

        // Material readiness check (simplified - would need BOM integration for full check)
        const materialStatus = {
            ready: Math.floor(workOrders.length * 0.7), // Placeholder
            partial: Math.floor(workOrders.length * 0.2),
            notReady: Math.floor(workOrders.length * 0.1),
        }

        return NextResponse.json({
            success: true,
            data: {
                weeklySchedule,
                workOrders: workOrders.map(wo => ({
                    id: wo.id,
                    number: wo.number,
                    product: wo.product,
                    plannedQty: wo.plannedQty,
                    actualQty: wo.actualQty,
                    progress: wo.plannedQty > 0 ? Math.round((wo.actualQty / wo.plannedQty) * 100) : 0,
                    status: wo.status,
                    startDate: wo.startDate,
                    dueDate: wo.dueDate,
                })),
                machines: machines.map(m => ({
                    id: m.id,
                    name: m.name,
                    status: m.status,
                    capacityPerHour: m.capacityPerHour || 10,
                    healthScore: m.healthScore,
                })),
            },
            summary: {
                totalPlanned,
                inProgress,
                totalCapacity,
                avgUtilization,
                materialStatus,
                machineCount: machines.length,
                activeMachines: machines.filter(m => m.status === 'RUNNING').length,
            },
        })
    } catch (error) {
        console.error('Error fetching planning data:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to fetch planning data' },
            { status: 500 }
        )
    }
}
