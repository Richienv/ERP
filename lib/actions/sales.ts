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
        }, { maxWait: 5000, timeout: 8000, maxRetries: 0 })
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
            revalidatePath('/sales')
            revalidatePath('/finance/invoices')
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
            revalidatePath('/sales')
            revalidatePath('/finance/invoices')
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
            revalidatePath('/sales')
            revalidatePath('/finance/invoices')
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
// QUOTATION → SALES ORDER CONVERSION
// ==========================================

export async function convertQuotationToSalesOrder(quotationId: string): Promise<{
    success: boolean
    orderId?: string
    orderNumber?: string
    error?: string
}> {
    try {
        const result = await withPrismaAuth(async (prisma) => {
            const quotation = await prisma.quotation.findUniqueOrThrow({
                where: { id: quotationId },
                include: { items: true, customer: true },
            })

            if (quotation.status !== 'ACCEPTED') {
                throw new Error('Hanya quotation dengan status ACCEPTED yang bisa dikonversi')
            }

            // Generate SO number
            const count = await prisma.salesOrder.count()
            const year = new Date().getFullYear()
            const number = `SO-${year}-${String(count + 1).padStart(4, '0')}`

            const salesOrder = await prisma.salesOrder.create({
                data: {
                    number,
                    customerId: quotation.customerId,
                    orderDate: new Date(),
                    subtotal: quotation.subtotal,
                    taxAmount: quotation.taxAmount,
                    discountAmount: quotation.discountAmount,
                    total: quotation.total,
                    status: 'CONFIRMED',
                    quotationId: quotation.id,
                    items: {
                        create: quotation.items.map((item) => ({
                            productId: item.productId,
                            description: item.description,
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            discount: item.discount,
                            taxRate: item.taxRate,
                            lineTotal: item.lineTotal,
                        })),
                    },
                },
            })

            // Update quotation status to CONVERTED
            await prisma.quotation.update({
                where: { id: quotationId },
                data: { status: 'CONVERTED' },
            })

            return { orderId: salesOrder.id, orderNumber: salesOrder.number }
        })

        revalidatePath('/sales/quotations')
        revalidatePath('/sales/orders')
        return { success: true, orderId: result.orderId, orderNumber: result.orderNumber }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal mengkonversi quotation ke Sales Order'
        console.error("[convertQuotationToSalesOrder] Error:", error)
        return { success: false, error: msg }
    }
}

// ==========================================
// PRICELIST ACTIONS
// ==========================================

export async function getAllPriceLists() {
    try {
        return await withPrismaAuth(async (prisma) => {
            const priceLists = await prisma.priceList.findMany({
                include: {
                    _count: {
                        select: {
                            customers: true,
                            priceItems: true,
                        }
                    },
                    priceItems: {
                        take: 3,
                        where: { isActive: true },
                        include: {
                            product: {
                                select: { name: true, code: true, unit: true, sellingPrice: true }
                            }
                        },
                        orderBy: { createdAt: 'desc' }
                    }
                },
                orderBy: { createdAt: 'desc' }
            })

            return priceLists.map(pl => ({
                id: pl.id,
                code: pl.code,
                name: pl.name,
                description: pl.description,
                currency: pl.currency,
                isActive: pl.isActive,
                itemCount: pl._count.priceItems,
                customerCount: pl._count.customers,
                previewItems: pl.priceItems.map(pi => ({
                    productName: pi.product.name,
                    productCode: pi.product.code,
                    price: Number(pi.price),
                    unit: pi.product.unit,
                })),
                createdAt: pl.createdAt.toISOString(),
                updatedAt: pl.updatedAt.toISOString(),
            }))
        })
    } catch (error) {
        console.error("Error fetching pricelists:", error)
        return []
    }
}

export async function getPriceListById(id: string) {
    try {
        return await withPrismaAuth(async (prisma) => {
            const pl = await prisma.priceList.findUnique({
                where: { id },
                include: {
                    priceItems: {
                        where: { isActive: true },
                        include: {
                            product: {
                                select: {
                                    id: true,
                                    name: true,
                                    code: true,
                                    unit: true,
                                    sellingPrice: true,
                                    description: true,
                                    category: { select: { name: true } }
                                }
                            }
                        },
                        orderBy: { product: { name: 'asc' } }
                    },
                    customers: {
                        select: { id: true, name: true, code: true },
                        take: 10,
                    },
                    _count: {
                        select: { customers: true, priceItems: true }
                    }
                }
            })

            if (!pl) return null

            return {
                id: pl.id,
                code: pl.code,
                name: pl.name,
                description: pl.description,
                currency: pl.currency,
                isActive: pl.isActive,
                itemCount: pl._count.priceItems,
                customerCount: pl._count.customers,
                items: pl.priceItems.map(pi => ({
                    id: pi.id,
                    productId: pi.productId,
                    productCode: pi.product.code,
                    productName: pi.product.name,
                    productDescription: pi.product.description,
                    category: pi.product.category?.name || '-',
                    unit: pi.product.unit,
                    basePrice: Number(pi.product.sellingPrice),
                    listPrice: Number(pi.price),
                    minQty: pi.minQty,
                    validFrom: pi.validFrom?.toISOString() || null,
                    validTo: pi.validTo?.toISOString() || null,
                })),
                customers: pl.customers,
                createdAt: pl.createdAt.toISOString(),
                updatedAt: pl.updatedAt.toISOString(),
            }
        })
    } catch (error) {
        console.error("Error fetching pricelist:", error)
        return null
    }
}

export async function createPriceList(data: {
    code: string
    name: string
    description?: string
    currency?: string
}) {
    try {
        const result = await withPrismaAuth(async (prisma) => {
            const priceList = await prisma.priceList.create({
                data: {
                    code: data.code,
                    name: data.name,
                    description: data.description || null,
                    currency: data.currency || 'IDR',
                    isActive: true,
                }
            })
            return { success: true as const, data: priceList }
        })

        revalidatePath('/sales/pricelists')
        return result
    } catch (error: any) {
        console.error("Error creating pricelist:", error)
        if (error.code === 'P2002') {
            return { success: false as const, error: "Kode daftar harga sudah digunakan" }
        }
        return { success: false as const, error: "Gagal membuat daftar harga" }
    }
}

export async function updatePriceList(id: string, data: {
    name?: string
    description?: string
    currency?: string
    isActive?: boolean
}) {
    try {
        await withPrismaAuth(async (prisma) => {
            await prisma.priceList.update({
                where: { id },
                data,
            })
        })

        revalidatePath('/sales/pricelists')
        return { success: true as const }
    } catch (error) {
        console.error("Error updating pricelist:", error)
        return { success: false as const, error: "Gagal mengupdate daftar harga" }
    }
}

export async function deletePriceList(id: string) {
    try {
        await withPrismaAuth(async (prisma) => {
            await prisma.priceList.delete({ where: { id } })
        })

        revalidatePath('/sales/pricelists')
        return { success: true as const }
    } catch (error) {
        console.error("Error deleting pricelist:", error)
        return { success: false as const, error: "Gagal menghapus daftar harga" }
    }
}

export async function addPriceListItem(data: {
    priceListId: string
    productId: string
    price: number
    minQty?: number
    validFrom?: string
    validTo?: string
}) {
    try {
        await withPrismaAuth(async (prisma) => {
            await prisma.priceListItem.create({
                data: {
                    priceListId: data.priceListId,
                    productId: data.productId,
                    price: data.price,
                    minQty: data.minQty || 1,
                    validFrom: data.validFrom ? new Date(data.validFrom) : null,
                    validTo: data.validTo ? new Date(data.validTo) : null,
                    isActive: true,
                }
            })
        })

        revalidatePath('/sales/pricelists')
        return { success: true as const }
    } catch (error: any) {
        console.error("Error adding price item:", error)
        if (error.code === 'P2002') {
            return { success: false as const, error: "Produk sudah ada di daftar harga ini" }
        }
        return { success: false as const, error: "Gagal menambahkan item" }
    }
}

export async function removePriceListItem(id: string) {
    try {
        await withPrismaAuth(async (prisma) => {
            await prisma.priceListItem.delete({ where: { id } })
        })

        revalidatePath('/sales/pricelists')
        return { success: true as const }
    } catch (error) {
        console.error("Error removing price item:", error)
        return { success: false as const, error: "Gagal menghapus item" }
    }
}

export async function getProductsForPriceList() {
    try {
        return await withPrismaAuth(async (prisma) => {
            const products = await prisma.product.findMany({
                where: { isActive: true },
                select: {
                    id: true,
                    code: true,
                    name: true,
                    unit: true,
                    sellingPrice: true,
                    category: { select: { name: true } },
                },
                orderBy: { name: 'asc' }
            })

            return products.map(p => ({
                id: p.id,
                code: p.code,
                name: p.name,
                unit: p.unit,
                sellingPrice: Number(p.sellingPrice),
                category: p.category?.name || '-',
            }))
        })
    } catch (error) {
        console.error("Error fetching products:", error)
        return []
    }
}

// ==========================================
// QUOTATION VERSIONING
// ==========================================

export interface QuotationVersionEntry {
    id: string
    number: string
    version: number
    status: string
    total: number
    quotationDate: string
    isCurrent: boolean
}

/**
 * Create a new revision of an existing quotation.
 * Copies all items to a new quotation with incremented version.
 */
export async function createQuotationRevision(
    quotationId: string
): Promise<{ success: boolean; newQuotationId?: string; error?: string }> {
    try {
        const newId = await withPrismaAuth(async (prisma) => {
            const original = await prisma.quotation.findUniqueOrThrow({
                where: { id: quotationId },
                include: { items: true },
            })

            // Find the root quotation (for versioning chain)
            const rootId = original.parentQuotationId ?? original.id

            // Count existing versions
            const versionCount = await prisma.quotation.count({
                where: {
                    OR: [
                        { id: rootId },
                        { parentQuotationId: rootId },
                    ],
                },
            })

            // Generate new number
            const baseNumber = original.number.replace(/-v\d+$/, '')
            const newVersion = versionCount + 1
            const newNumber = `${baseNumber}-v${newVersion}`

            // Create revision
            const revision = await prisma.quotation.create({
                data: {
                    number: newNumber,
                    customerId: original.customerId,
                    customerRef: original.customerRef,
                    quotationDate: new Date(),
                    validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // +14 days
                    paymentTerm: original.paymentTerm,
                    deliveryTerm: original.deliveryTerm,
                    subtotal: original.subtotal,
                    taxAmount: original.taxAmount,
                    discountAmount: original.discountAmount,
                    total: original.total,
                    status: 'DRAFT',
                    version: newVersion,
                    parentQuotationId: rootId,
                    notes: original.notes,
                    internalNotes: `Revisi dari ${original.number}`,
                    items: {
                        create: original.items.map((item) => ({
                            productId: item.productId,
                            description: item.description,
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            discount: item.discount,
                            taxRate: item.taxRate,
                            lineTotal: item.lineTotal,
                        })),
                    },
                },
            })

            return revision.id
        })

        revalidatePath('/sales/quotations')
        return { success: true, newQuotationId: newId }
    } catch (error) {
        console.error("[createQuotationRevision] Error:", error)
        return { success: false, error: 'Gagal membuat revisi quotation' }
    }
}

/**
 * Get version history for a quotation (all versions in the chain).
 */
export async function getQuotationVersionHistory(
    quotationId: string
): Promise<QuotationVersionEntry[]> {
    try {
        return await withPrismaAuth(async (prisma) => {
            const current = await prisma.quotation.findUniqueOrThrow({
                where: { id: quotationId },
                select: { id: true, parentQuotationId: true },
            })

            const rootId = current.parentQuotationId ?? current.id

            const versions = await prisma.quotation.findMany({
                where: {
                    OR: [
                        { id: rootId },
                        { parentQuotationId: rootId },
                    ],
                },
                select: {
                    id: true,
                    number: true,
                    version: true,
                    status: true,
                    total: true,
                    quotationDate: true,
                },
                orderBy: { version: 'asc' },
            })

            return versions.map((v) => ({
                id: v.id,
                number: v.number,
                version: v.version,
                status: v.status,
                total: Number(v.total),
                quotationDate: v.quotationDate.toISOString(),
                isCurrent: v.id === quotationId,
            }))
        })
    } catch (error) {
        console.error("[getQuotationVersionHistory] Error:", error)
        return []
    }
}

// ==========================================
// SO FULFILLMENT TRACKING
// ==========================================

export interface SOFulfillmentData {
    orderId: string
    orderNumber: string
    customerName: string
    status: string
    items: {
        id: string
        productName: string
        productCode: string
        color: string | null
        size: string | null
        qtyOrdered: number
        qtyDelivered: number
        qtyInvoiced: number
        fulfillmentPct: number
    }[]
    overallFulfillmentPct: number
}

export async function getSOFulfillment(salesOrderId: string): Promise<SOFulfillmentData | null> {
    try {
        return await withPrismaAuth(async (prisma) => {
            const so = await prisma.salesOrder.findUnique({
                where: { id: salesOrderId },
                include: {
                    customer: { select: { name: true } },
                    items: {
                        include: {
                            product: { select: { name: true, code: true } },
                        },
                        orderBy: { createdAt: 'asc' },
                    },
                },
            })

            if (!so) return null

            const items = so.items.map((item) => {
                const ordered = Number(item.quantity)
                const delivered = Number(item.qtyDelivered)
                return {
                    id: item.id,
                    productName: item.product.name,
                    productCode: item.product.code,
                    color: item.color,
                    size: item.size,
                    qtyOrdered: ordered,
                    qtyDelivered: delivered,
                    qtyInvoiced: Number(item.qtyInvoiced),
                    fulfillmentPct: ordered > 0 ? Math.round((delivered / ordered) * 100) : 0,
                }
            })

            const totalOrdered = items.reduce((s, i) => s + i.qtyOrdered, 0)
            const totalDelivered = items.reduce((s, i) => s + i.qtyDelivered, 0)

            return {
                orderId: so.id,
                orderNumber: so.number,
                customerName: so.customer.name,
                status: so.status,
                items,
                overallFulfillmentPct: totalOrdered > 0
                    ? Math.round((totalDelivered / totalOrdered) * 100)
                    : 0,
            }
        })
    } catch (error) {
        console.error("[getSOFulfillment] Error:", error)
        return null
    }
}

export async function recordPartialShipment(
    salesOrderItemId: string,
    qtyShipped: number
): Promise<{ success: boolean; error?: string }> {
    try {
        await withPrismaAuth(async (prisma) => {
            const item = await prisma.salesOrderItem.findUniqueOrThrow({
                where: { id: salesOrderItemId },
                select: { quantity: true, qtyDelivered: true, salesOrderId: true },
            })

            const ordered = Number(item.quantity)
            const alreadyDelivered = Number(item.qtyDelivered)
            const newDelivered = alreadyDelivered + qtyShipped

            if (newDelivered > ordered) {
                throw new Error(`Qty kirim (${newDelivered}) melebihi qty order (${ordered})`)
            }

            await prisma.salesOrderItem.update({
                where: { id: salesOrderItemId },
                data: { qtyDelivered: newDelivered },
            })

            // Check if all items are fully delivered → update SO status
            const allItems = await prisma.salesOrderItem.findMany({
                where: { salesOrderId: item.salesOrderId },
                select: { quantity: true, qtyDelivered: true },
            })

            const allFulfilled = allItems.every(
                (i) => Number(i.qtyDelivered) >= Number(i.quantity)
            )

            if (allFulfilled) {
                await prisma.salesOrder.update({
                    where: { id: item.salesOrderId },
                    data: { status: 'DELIVERED' },
                })
            } else {
                // Ensure status is IN_PROGRESS if partially shipped
                const so = await prisma.salesOrder.findUnique({
                    where: { id: item.salesOrderId },
                    select: { status: true },
                })
                if (so?.status === 'CONFIRMED') {
                    await prisma.salesOrder.update({
                        where: { id: item.salesOrderId },
                        data: { status: 'IN_PROGRESS' },
                    })
                }
            }
        })

        revalidatePath('/sales/orders')
        return { success: true }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal mencatat pengiriman'
        console.error("[recordPartialShipment] Error:", error)
        return { success: false, error: msg }
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
