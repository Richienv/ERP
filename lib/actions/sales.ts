'use server'

import { prisma } from "@/lib/prisma"
import { formatIDR } from "@/lib/utils"

export interface SalesStats {
    totalRevenue: number
    totalOrders: number
    activeOrders: number
    recentOrders: any[]
}

import { revalidateTag, revalidatePath, unstable_cache } from "next/cache"

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
            // where: { status: 'ACTIVE' }, // Status field doesn't exist yet
            orderBy: { name: 'asc' }
        })
    } catch (error) {
        return []
    }
}

// 1. GET ALL QUOTATIONS
export async function getQuotations(filters?: { status?: string, search?: string }) {
    try {
        const whereInput: any = {}

        if (filters?.status && filters.status !== 'all') {
            whereInput.status = filters.status.toUpperCase() // Ensure Upper match Enum
        }

        if (filters?.search) {
            whereInput.OR = [
                { number: { contains: filters.search, mode: 'insensitive' } },
                { customer: { name: { contains: filters.search, mode: 'insensitive' } } }
            ]
        }

        const quotations = await prisma.quotation.findMany({
            where: whereInput,
            include: {
                customer: {
                    include: {
                        salesPerson: true // Fetch via Customer
                    }
                },
                _count: {
                    select: { items: true }
                }
            },
            orderBy: { quotationDate: 'desc' }
        })

        return quotations.map(q => ({
            id: q.id,
            number: q.number,
            customerId: q.customerId,
            customerName: q.customer?.name || "Unknown Customer",
            customerRef: null,
            quotationDate: q.quotationDate.toISOString(),
            validUntil: q.validUntil.toISOString(),
            status: q.status,
            subtotal: Number(q.subtotal),
            taxAmount: Number(q.taxAmount),
            discountAmount: 0,
            total: Number(q.total), // Correct field: total
            itemCount: q._count.items,
            salesPerson: q.customer?.salesPerson?.name || "Unassigned", // Map from Customer
            notes: q.notes
        }))

    } catch (error) {
        console.error("Error fetching quotations:", error)
        return []
    }
}

// 2. CREATE NEW QUOTATION
export async function createQuotation(data: any) {
    try {
        console.log("Creating Quotation:", data)

        // Customer Logic (Mock: Find first or create if not exists - Simplified for now)
        let customer = await prisma.customer.findFirst()
        if (!customer) throw new Error("No customers found. Please seed.")

        // Generate Number
        const count = await prisma.quotation.count()
        const number = `QT-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`

        const quote = await prisma.quotation.create({
            data: {
                number: number,
                customerId: customer.id,
                status: 'DRAFT',
                quotationDate: new Date(),
                validUntil: new Date(new Date().setDate(new Date().getDate() + 14)), // 2 weeks validity
                subtotal: 0,
                taxAmount: 0,
                total: 0, // Correct field
                notes: data.notes || "Draft Quotation"
            }
        })

        revalidateTag('dashboard-sales-stats')
        revalidatePath('/sales/quotations')
        return { success: true, message: "Quotation created", id: quote.id }

    } catch (error) {
        console.error("Error creating quotation:", error)
        return { success: false, error: "Failed to create quotation" }
    }
}

// 3. UPDATE STATUS (Kanban Drag & Drop)
export async function updateQuotationStatus(id: string, newStatus: string) {
    try {
        await prisma.quotation.update({
            where: { id },
            data: { status: newStatus as any }
        })
        revalidateTag('dashboard-sales-stats')
        return { success: true }
    } catch (error) {
        return { success: false, error: "Failed to update status" }
    }
}
