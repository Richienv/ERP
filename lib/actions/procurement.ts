"use server"

import { prisma } from "@/lib/prisma"

export async function getProcurementStats() {
    try {
        // 1. Open PO Value (Status: OPEN or PARTIAL)
        const openPOs = await prisma.purchaseOrder.aggregate({
            _sum: {
                totalAmount: true
            },
            where: {
                status: {
                    in: ["OPEN", "PARTIAL"]
                }
            }
        })

        // 2. Pending Approvals (Status: DRAFT)
        const pendingCount = await prisma.purchaseOrder.count({
            where: {
                status: "DRAFT"
            }
        })

        // 3. Incoming Goods (Status: OPEN or PARTIAL or RECEIVED)
        const incomingCount = await prisma.purchaseOrder.count({
            where: {
                status: {
                    in: ["OPEN", "PARTIAL"]
                }
            }
        })

        // 4. Recent Activity (Last 5 POs)
        const recentActivity = await prisma.purchaseOrder.findMany({
            take: 5,
            orderBy: {
                createdAt: "desc"
            },
            include: {
                supplier: {
                    select: {
                        name: true
                    }
                }
            }
        })

        return {
            openPOValue: Number(openPOs._sum.totalAmount || 0),
            pendingCount,
            incomingCount,
            recentActivity
        }

    } catch (error) {
        console.error("Error fetching procurement stats:", error)
        return {
            openPOValue: 0,
            pendingCount: 0,
            incomingCount: 0,
            recentActivity: []
        }
    }
}

export async function getAllPurchaseOrders() {
    try {
        const orders = await prisma.purchaseOrder.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                supplier: true,
                items: true
            }
        })

        return orders.map(po => ({
            id: po.number, // Display ID
            dbId: po.id,   // Actual UUID
            vendor: po.supplier.name,
            date: po.orderDate.toLocaleDateString('id-ID'),
            total: Number(po.totalAmount),
            status: po.status,
            items: po.items.length,
            eta: po.expectedDate ? po.expectedDate.toLocaleDateString('id-ID') : '-'
        }))
    } catch (error) {
        console.error("Failed to fetch purchase orders:", error)
        return []
    }
}
