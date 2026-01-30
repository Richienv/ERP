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

// 4. INVOICE ACTIONS
import { postJournalEntry } from "@/lib/actions/finance"

// Create Invoice (Draft)
export async function createInvoice(data: { customerId: string, items: { description: string, quantity: number, price: number }[], dueDate: Date }) {
    try {
        const count = await prisma.invoice.count({ where: { type: 'INV_OUT' } })
        const year = new Date().getFullYear()
        const number = `INV-${year}-${String(count + 1).padStart(4, '0')}`

        const subtotal = data.items.reduce((acc, item) => acc + (item.quantity * item.price), 0)
        const taxAmount = subtotal * 0.11 // PPN 11%
        const totalAmount = subtotal + taxAmount

        const invoice = await prisma.invoice.create({
            data: {
                number,
                customerId: data.customerId,
                type: 'INV_OUT',
                status: 'DRAFT',
                issueDate: new Date(),
                dueDate: data.dueDate,
                subtotal,
                taxAmount,
                discountAmount: 0,
                totalAmount,
                balanceDue: totalAmount,
                items: {
                    create: data.items.map(item => ({
                        description: item.description,
                        quantity: item.quantity,
                        unitPrice: item.price,
                        amount: item.quantity * item.price
                    }))
                }
            }
        })

        try {
            revalidateTag('dashboard-sales-stats')
        } catch (e) {
            console.log('Skipping revalidation (Script context)')
        }
        return { success: true, invoiceId: invoice.id }

    } catch (error: any) {
        console.error("Create Invoice Error:", error)
        return { success: false, error: error.message }
    }
}

// Approve Invoice -> Post to GL
export async function approveInvoice(id: string) {
    try {
        const invoice = await prisma.invoice.findUnique({
            where: { id },
            include: { customer: true }
        })

        if (!invoice) throw new Error("Invoice not found")
        if (invoice.status !== 'DRAFT') throw new Error("Invoice already processed")

        // 1. Update Status
        await prisma.invoice.update({
            where: { id },
            data: { status: 'ISSUED' }
        })

        // 2. Post Journal Entry
        // Debit: Piutang Usaha (1200)
        // Credit: Pendapatan Penjualan (4000)
        // Credit: Utang Pajak PPN (2110) - If we track tax separately
        // For simplicity, let's just do AR vs Revenue for now, OR split if we have tax account.
        // We have '2110' Utang Pajak. Let's do it right: 
        // Debit AR (Total)
        // Credit Revenue (Subtotal)
        // Credit Tax Payable (Tax)

        await postJournalEntry({
            description: `Invoice ${invoice.number} - ${invoice.customer?.name}`,
            date: new Date(),
            reference: invoice.number,
            lines: [
                {
                    accountCode: '1200', // Piutang Usaha
                    debit: Number(invoice.totalAmount),
                    credit: 0
                },
                {
                    accountCode: '4000', // Pendapatan
                    debit: 0,
                    credit: Number(invoice.subtotal)
                },
                {
                    accountCode: '2110', // Utang Pajak
                    debit: 0,
                    credit: Number(invoice.taxAmount)
                }
            ]
        })

        try {
            revalidateTag('dashboard-sales-stats')
        } catch (e) {
            console.log('Skipping revalidation (Script context)')
        }
        return { success: true }

    } catch (error: any) {
        console.error("Approve Invoice Error:", error)
        return { success: false, error: error.message }
    }
}

// Record Payment -> Post to GL
export async function recordPayment(invoiceId: string, amount: number, method: string = 'TRANSFER') {
    try {
        const invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId },
            include: { customer: true }
        })

        if (!invoice) throw new Error("Invoice not found")

        // 1. Create Payment Record
        const count = await prisma.payment.count()
        const number = `PAY-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`

        const payment = await prisma.payment.create({
            data: {
                number,
                amount,
                method: method as any,
                invoiceId: invoice.id,
                customerId: invoice.customerId,
                date: new Date(),
                reference: `REF-${new Date().getTime()}`,
            }
        })

        // 2. Update Invoice Balance
        const newBalance = Number(invoice.balanceDue) - amount
        let newStatus = invoice.status
        if (newBalance <= 0) newStatus = 'PAID'
        else newStatus = 'PARTIAL'

        await prisma.invoice.update({
            where: { id: invoiceId },
            data: {
                balanceDue: newBalance,
                status: newStatus
            }
        })

        // 3. Post Journal Entry
        // Debit: Bank BCA (1110) - Assuming all transfer to BCA for now
        // Credit: Piutang Usaha (1200)

        // Find Bank Account based on method?
        // Let's default to Bank BCA (1110) for TRANSFER, Cash (1101) for CASH
        let debitAccount = '1110' // BCA
        if (method === 'CASH') debitAccount = '1101' // Kas Besar

        await postJournalEntry({
            description: `Payment for ${invoice.number} (${method})`,
            date: new Date(),
            reference: payment.reference || "PAY",
            lines: [
                {
                    accountCode: debitAccount,
                    debit: amount,
                    credit: 0
                },
                {
                    accountCode: '1200', // Piutang Usaha
                    credit: amount,
                    debit: 0
                }
            ]
        })

        try {
            revalidateTag('dashboard-sales-stats')
        } catch (e) {
            console.log('Skipping revalidation (Script context)')
        }
        return { success: true }

    } catch (error: any) {
        console.error("Payment Error:", error)
        return { success: false, error: error.message }
    }
}
