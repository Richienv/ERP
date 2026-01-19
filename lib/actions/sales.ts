'use server'

import { prisma } from "@/lib/prisma"
import { formatIDR } from "@/lib/utils"

export interface SalesStats {
    totalRevenue: number
    totalOrders: number
    activeOrders: number
    recentOrders: any[]
}

import { unstable_cache } from "next/cache"

export const getSalesStats = unstable_cache(
    async (): Promise<SalesStats> => {
        try {
            const startOfMonth = new Date()
            startOfMonth.setDate(1)
            startOfMonth.setHours(0, 0, 0, 0)

            // 1. Total Revenue (This Month) - Based on Invoices to match GL
            const revenueAgg = await prisma.invoice.aggregate({
                _sum: { totalAmount: true },
                where: {
                    type: 'INV_OUT',
                    issueDate: { gte: startOfMonth },
                    status: { not: 'CANCELLED' }
                }
            })

            // 2. Active Orders (Sales Orders that are confirmed but not completed)
            const activeOrdersCount = await prisma.salesOrder.count({
                where: {
                    status: { in: ['CONFIRMED', 'IN_PROGRESS', 'DELIVERED'] }
                }
            })

            // 3. Total Orders (This Month)
            const totalOrdersCount = await prisma.salesOrder.count({
                where: {
                    orderDate: { gte: startOfMonth }
                }
            })

            // 4. Recent Orders
            const recentOrders = await prisma.salesOrder.findMany({
                take: 5,
                orderBy: { orderDate: 'desc' },
                include: {
                    customer: { select: { name: true } }
                }
            })

            return {
                totalRevenue: revenueAgg._sum.totalAmount?.toNumber() || 0,
                totalOrders: totalOrdersCount,
                activeOrders: activeOrdersCount,
                recentOrders: recentOrders.map(o => ({
                    id: o.id,
                    customer: o.customer.name,
                    amount: o.total.toNumber(),
                    status: o.status,
                    date: o.orderDate
                }))
            }
        } catch (error) {
            console.error("Failed to fetch sales stats:", error)
            return { totalRevenue: 0, totalOrders: 0, activeOrders: 0, recentOrders: [] }
        }
    },
    ['dashboard-sales-stats'],
    { revalidate: 60, tags: ['dashboard'] }
)

export async function getAllCustomers() {
    try {
        return await prisma.customer.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' }
        })
    } catch (error) {
        return []
    }
}
