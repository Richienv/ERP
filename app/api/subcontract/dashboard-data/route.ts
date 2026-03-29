import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

        const [
            totalActive,
            totalSubcontractors,
            overdueOrdersRaw,
            recentOrdersRaw,
            statusGroupRaw,
            materialAtVendorRaw,
            completedThisMonth,
        ] = await Promise.all([
            prisma.subcontractOrder.count({
                where: {
                    status: { in: ['SC_SENT', 'SC_IN_PROGRESS', 'SC_PARTIAL_COMPLETE'] },
                },
            }),
            prisma.subcontractor.count({ where: { isActive: true } }),
            prisma.subcontractOrder.findMany({
                where: {
                    status: { in: ['SC_SENT', 'SC_IN_PROGRESS', 'SC_PARTIAL_COMPLETE'] },
                    expectedReturnDate: { lt: now },
                },
                include: {
                    subcontractor: { select: { name: true } },
                    workOrder: { select: { id: true } },
                    items: { select: { issuedQty: true, returnedQty: true, defectQty: true, wastageQty: true } },
                },
                orderBy: { expectedReturnDate: 'asc' },
            }),
            prisma.subcontractOrder.findMany({
                include: {
                    subcontractor: { select: { name: true } },
                    workOrder: { select: { id: true } },
                    items: { select: { issuedQty: true, returnedQty: true } },
                },
                orderBy: { createdAt: 'desc' },
                take: 10,
            }),
            prisma.subcontractOrder.groupBy({
                by: ['status'],
                _count: true,
            }),
            prisma.subcontractOrder.findMany({
                where: {
                    status: { in: ['SC_SENT', 'SC_IN_PROGRESS', 'SC_PARTIAL_COMPLETE'] },
                },
                include: {
                    subcontractor: { select: { name: true } },
                    items: {
                        include: { product: { select: { name: true } } },
                    },
                },
            }),
            prisma.subcontractOrder.findMany({
                where: {
                    status: 'SC_COMPLETED',
                    updatedAt: { gte: startOfMonth },
                },
                include: {
                    items: { select: { issuedQty: true, returnedQty: true, defectQty: true } },
                },
            }),
        ])

        // Compute materialAtVendor
        const materialAtVendor: { subcontractorName: string; productName: string; qty: number }[] = []
        for (const order of materialAtVendorRaw) {
            for (const item of order.items) {
                const remaining = item.issuedQty - item.returnedQty - item.defectQty - item.wastageQty
                if (remaining > 0) {
                    materialAtVendor.push({
                        subcontractorName: order.subcontractor.name,
                        productName: item.product.name,
                        qty: remaining,
                    })
                }
            }
        }

        // Compute yield rate
        let totalIssued = 0
        let totalReturned = 0
        for (const order of materialAtVendorRaw) {
            for (const item of order.items) {
                totalIssued += item.issuedQty
                totalReturned += item.returnedQty
            }
        }
        for (const order of completedThisMonth) {
            for (const item of order.items) {
                totalIssued += item.issuedQty
                totalReturned += item.returnedQty
            }
        }

        // Compute on-time delivery
        let onTimeCount = 0
        for (const o of completedThisMonth) {
            if (o.expectedReturnDate && o.updatedAt <= o.expectedReturnDate) {
                onTimeCount++
            }
        }

        // Compute total cost this month (estimated from rates)
        let totalCostThisMonth = 0
        try {
            const monthOrders = await prisma.subcontractOrder.findMany({
                where: { issuedDate: { gte: startOfMonth } },
                include: { items: { select: { issuedQty: true } } },
            })
            for (const order of monthOrders) {
                const rate = await prisma.subcontractorRate.findFirst({
                    where: {
                        subcontractorId: order.subcontractorId,
                        operation: order.operation,
                    },
                    orderBy: { validFrom: 'desc' },
                })
                if (rate) {
                    const qty = order.items.reduce((s, i) => s + i.issuedQty, 0)
                    totalCostThisMonth += qty * Number(rate.ratePerUnit)
                }
            }
        } catch {
            // Cost calculation is non-critical
        }

        const mapOrder = (o: typeof recentOrdersRaw[number]) => ({
            id: o.id,
            number: o.number,
            subcontractorName: o.subcontractor.name,
            operation: o.operation,
            status: o.status,
            issuedDate: o.issuedDate.toISOString(),
            expectedReturnDate: o.expectedReturnDate?.toISOString() || null,
            workOrderNumber: o.workOrder ? o.workOrder.id : null,
            itemCount: o.items.length,
            totalIssuedQty: o.items.reduce((s, i) => s + i.issuedQty, 0),
            totalReturnedQty: o.items.reduce((s, i) => s + i.returnedQty, 0),
        })

        return NextResponse.json({
            totalActive,
            totalSubcontractors,
            overdueCount: overdueOrdersRaw.length,
            totalCostThisMonth,
            yieldRate: totalIssued > 0 ? Math.round((totalReturned / totalIssued) * 100) : 0,
            onTimeDeliveryPercent: completedThisMonth.length > 0
                ? Math.round((onTimeCount / completedThisMonth.length) * 100)
                : 0,
            statusDistribution: statusGroupRaw.map((g) => ({
                status: g.status,
                count: g._count,
            })),
            materialAtVendor,
            overdueOrders: overdueOrdersRaw.map(mapOrder),
            recentOrders: recentOrdersRaw.map(mapOrder),
        })
    } catch (e) {
        console.error("[API] subcontract/dashboard-data:", e)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
