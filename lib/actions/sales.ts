'use server'

import { withPrismaAuth } from "@/lib/db"
import { formatIDR } from "@/lib/utils"

import { InvoiceStatus, SalesOrderStatus } from "@prisma/client"

export interface SalesStats {
    totalRevenue: number
    totalOrders: number
    activeOrders: number
    recentOrders: any[]
}

import { revalidateTag, revalidatePath } from "next/cache"

const revalidateTagSafe = (tag: string) => (revalidateTag as any)(tag, 'default')

export async function getSalesStats(): Promise<SalesStats> {
    try {
        return await withPrismaAuth(async (prisma) => {
            const startOfMonth = new Date()
            startOfMonth.setDate(1)
            startOfMonth.setHours(0, 0, 0, 0)

            // 1. Total Revenue (This Month) - Based on Invoices to match GL
            const revenueAgg = await prisma.invoice.aggregate({
                _sum: { totalAmount: true },
                where: {
                    type: 'INV_OUT',
                    issueDate: { gte: startOfMonth },
                    status: { notIn: [InvoiceStatus.CANCELLED, InvoiceStatus.VOID] }
                }
            })

            // 2. Active Orders (Sales Orders that are confirmed but not completed)
            const activeOrdersCount = await prisma.salesOrder.count({
                where: {
                    status: { in: [SalesOrderStatus.CONFIRMED, SalesOrderStatus.IN_PROGRESS, SalesOrderStatus.DELIVERED] }
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
        })
    } catch (error) {
        console.error("Failed to fetch sales stats", error)
        return { totalRevenue: 0, totalOrders: 0, activeOrders: 0, recentOrders: [] }
    }
}

export async function getAllCustomers() {
    try {
        return await withPrismaAuth(async (prisma) => {
            return await prisma.customer.findMany({
                orderBy: { name: 'asc' }
            })
        })
    } catch (error) {
        return []
    }
}

// 1. GET ALL QUOTATIONS
export async function getQuotations(filters?: { status?: string, search?: string }) {
    try {
        return await withPrismaAuth(async (prisma) => {
            const whereInput: any = {}

            if (filters?.status && filters.status !== 'all') {
                whereInput.status = filters.status.toUpperCase()
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
                            salesPerson: true
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
                total: Number(q.total),
                itemCount: q._count.items,
                salesPerson: q.customer?.salesPerson?.name || "Unassigned",
                notes: q.notes
            }))
        })
    } catch (error) {
        console.error("Error fetching quotations:", error)
        return []
    }
}

// 2. CREATE NEW QUOTATION
export async function createQuotation(data: any) {
    try {
        console.log("Creating Quotation:", data)

        const result = await withPrismaAuth(async (prisma) => {
            // Customer Logic
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
                    validUntil: new Date(new Date().setDate(new Date().getDate() + 14)),
                    subtotal: 0,
                    taxAmount: 0,
                    total: 0,
                    notes: data.notes || "Draft Quotation"
                }
            })

            return { success: true, message: "Quotation created", id: quote.id }
        })

        revalidateTagSafe('dashboard-sales-stats')
        revalidatePath('/sales/quotations')
        return result
    } catch (error) {
        console.error("Error creating quotation:", error)
        return { success: false, error: "Failed to create quotation" }
    }
}

// 3. UPDATE STATUS (Kanban Drag & Drop)
export async function updateQuotationStatus(id: string, newStatus: string) {
    try {
        await withPrismaAuth(async (prisma) => {
            await prisma.quotation.update({
                where: { id },
                data: { status: newStatus as any }
            })
        })
        revalidateTagSafe('dashboard-sales-stats')
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
        const result = await withPrismaAuth(async (prisma) => {
            const count = await prisma.invoice.count({ where: { type: 'INV_OUT' } })
            const year = new Date().getFullYear()
            const number = `INV-${year}-${String(count + 1).padStart(4, '0')}`

            const subtotal = data.items.reduce((acc, item) => acc + (item.quantity * item.price), 0)
            const taxAmount = subtotal * 0.11
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

            return { success: true, invoiceId: invoice.id }
        })

        try {
            revalidateTagSafe('dashboard-sales-stats')
        } catch (e) {
            console.log('Skipping revalidation (Script context)')
        }
        return result
    } catch (error: any) {
        console.error("Create Invoice Error:", error)
        return { success: false, error: error.message }
    }
}

// Approve Invoice -> Post to GL
export async function approveInvoice(id: string) {
    try {
        const invoice = await withPrismaAuth(async (prisma) => {
            const inv = await prisma.invoice.findUnique({
                where: { id },
                include: { customer: true, items: true }
            })

            if (!inv) throw new Error("Invoice not found")
            if (inv.status !== 'DRAFT') throw new Error("Invoice already processed")

            await prisma.invoice.update({
                where: { id },
                data: { status: 'ISSUED' }
            })

            return inv
        })

        // Post Journal Entry for AR recognition
        const subtotal = Number(invoice.subtotal)
        const taxAmount = Number(invoice.taxAmount)
        const totalAmount = Number(invoice.totalAmount)

        await postJournalEntry({
            description: `Invoice ${invoice.number} issued to ${invoice.customer?.name || 'Customer'}`,
            date: new Date(),
            reference: id,
            lines: [
                {
                    accountCode: '1200', // Accounts Receivable (AR)
                    debit: totalAmount,
                    credit: 0
                },
                {
                    accountCode: '2200', // Tax Output (PPN Keluaran)
                    debit: 0,
                    credit: taxAmount
                },
                {
                    accountCode: '4101', // Revenue / Sales
                    debit: 0,
                    credit: subtotal
                }
            ]
        })

        try {
            revalidateTagSafe('dashboard-sales-stats')
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
        const result = await withPrismaAuth(async (prisma) => {
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

            return { invoice, payment }
        })

        // 3. Post Journal Entry (outside transaction)
        let debitAccount = '1110'
        if (method === 'CASH') debitAccount = '1101'

        await postJournalEntry({
            description: `Payment for ${result.invoice.number} (${method})`,
            date: new Date(),
            reference: result.payment.reference || "PAY",
            lines: [
                {
                    accountCode: debitAccount,
                    debit: amount,
                    credit: 0
                },
                {
                    accountCode: '1200',
                    credit: amount,
                    debit: 0
                }
            ]
        })

        try {
            revalidateTagSafe('dashboard-sales-stats')
        } catch (e) {
            console.log('Skipping revalidation (Script context)')
        }
        return { success: true }
    } catch (error: any) {
        console.error("Payment Error:", error)
        return { success: false, error: error.message }
    }
}

// ==========================================
// SALES ORDER → INVOICE INTEGRATION
// ==========================================

import { createInvoiceFromSalesOrder } from "@/lib/actions/finance"

/**
 * Generate customer invoice from a Sales Order
 * Triggers automatic revenue recognition via GL posting
 * Should be called when SO status = DELIVERED or manually triggered
 */
export async function generateInvoiceFromSalesOrder(salesOrderId: string) {
    try {
        console.log("Generating invoice for Sales Order:", salesOrderId)

        const result = await createInvoiceFromSalesOrder(salesOrderId)

        if (!result.success) {
            if ((result as any).code === 'INVOICE_ALREADY_EXISTS') {
                return {
                    success: true,
                    invoiceId: (result as any).existingInvoiceId,
                    invoiceNumber: (result as any).existingInvoiceNumber,
                    message: `Invoice ${(result as any).existingInvoiceNumber} already exists`
                }
            }
            return { success: false, error: result.error }
        }

        // Optionally update SO status to INVOICED
        await withPrismaAuth(async (prisma) => {
            await prisma.salesOrder.update({
                where: { id: salesOrderId },
                data: { status: 'INVOICED' }
            })
        })

        // Revalidate relevant caches
        revalidatePath('/finance/invoices')
        revalidatePath('/sales')

        return {
            success: true,
            invoiceId: result.invoiceId,
            invoiceNumber: result.invoiceNumber,
            message: `Invoice ${result.invoiceNumber} created successfully`
        }
    } catch (error: any) {
        console.error("Failed to generate invoice:", error)
        return { success: false, error: error.message || "Failed to generate invoice" }
    }
}
