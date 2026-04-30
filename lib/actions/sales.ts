'use server'

import { withPrismaAuth, prisma as basePrisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"
import { postInventoryGLEntry } from "@/lib/actions/inventory-gl"
import { revalidatePath } from "next/cache"
import { ensureCustomerCategories } from "@/lib/customer-category-defaults"

import { InvoiceStatus, SalesOrderStatus } from "@prisma/client"

export interface SalesStats {
    totalRevenue: number
    totalOrders: number
    activeOrders: number
    recentOrders: any[]
}

export async function getSalesStats(): Promise<SalesStats> {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) throw new Error("Unauthorized")

        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        startOfMonth.setHours(0, 0, 0, 0)

        const [revenueAgg, activeOrdersCount, totalOrdersCount, recentOrders] = await Promise.all([
            // 1. Total Revenue (This Month) - Based on Invoices to match GL
            basePrisma.invoice.aggregate({
                _sum: { totalAmount: true },
                where: {
                    type: 'INV_OUT',
                    issueDate: { gte: startOfMonth },
                    status: { notIn: [InvoiceStatus.CANCELLED, InvoiceStatus.VOID] }
                }
            }),
            // 2. Active Orders (Sales Orders that are confirmed but not completed)
            basePrisma.salesOrder.count({
                where: {
                    status: { in: [SalesOrderStatus.CONFIRMED, SalesOrderStatus.IN_PROGRESS, SalesOrderStatus.DELIVERED] }
                }
            }),
            // 3. Total Orders (This Month)
            basePrisma.salesOrder.count({
                where: {
                    orderDate: { gte: startOfMonth }
                }
            }),
            // 4. Recent Orders
            basePrisma.salesOrder.findMany({
                take: 5,
                orderBy: { orderDate: 'desc' },
                include: {
                    customer: { select: { name: true } }
                }
            }),
        ])

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
    } catch {
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
            const customer = await prisma.customer.findFirst()
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
        return { success: true }
    } catch {
        return { success: false, error: "Failed to update status" }
    }
}

// 4. INVOICE ACTIONS
import { postJournalEntry } from "@/lib/actions/finance"
import { SYS_ACCOUNTS, ensureSystemAccounts } from "@/lib/gl-accounts-server"
import { assertPeriodOpen } from "@/lib/period-helpers"

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

            // Period lock: fail fast before mutation
            await assertPeriodOpen(new Date())

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

        await ensureSystemAccounts()
        await postJournalEntry({
            description: `Invoice ${invoice.number} issued to ${invoice.customer?.name || 'Customer'}`,
            date: new Date(),
            reference: id,
            lines: [
                {
                    accountCode: SYS_ACCOUNTS.AR, // Piutang Usaha (AR)
                    debit: totalAmount,
                    credit: 0
                },
                {
                    accountCode: SYS_ACCOUNTS.PPN_KELUARAN, // PPN Keluaran
                    debit: 0,
                    credit: taxAmount
                },
                {
                    accountCode: SYS_ACCOUNTS.REVENUE, // Pendapatan Penjualan
                    debit: 0,
                    credit: subtotal
                }
            ]
        })

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

            // Period lock: fail fast before mutation
            await assertPeriodOpen(new Date())

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

        await ensureSystemAccounts()
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
                    accountCode: SYS_ACCOUNTS.AR, // Piutang Usaha (AR)
                    credit: amount,
                    debit: 0
                }
            ]
        })

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
                    currencyCode: quotation.currencyCode || "IDR",
                    exchangeRate: quotation.exchangeRate || 1,
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

            // Auto-reserve stock for confirmed SO items
            for (const item of quotation.items) {
                const stockLevel = await prisma.stockLevel.findFirst({
                    where: {
                        productId: item.productId,
                        availableQty: { gt: 0 },
                        locationId: null,
                    },
                    orderBy: { availableQty: 'desc' },
                })

                if (stockLevel) {
                    const reserveQty = Math.min(Number(item.quantity), Number(stockLevel.availableQty))
                    if (reserveQty > 0) {
                        await prisma.stockLevel.update({
                            where: { id: stockLevel.id },
                            data: {
                                reservedQty: { increment: reserveQty },
                                availableQty: { decrement: reserveQty },
                            },
                        })
                    }
                }
            }

            return { orderId: salesOrder.id, orderNumber: salesOrder.number }
        })

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
                    basePrice: pi.product.sellingPrice === null || pi.product.sellingPrice === undefined ? 0 : Number(pi.product.sellingPrice),
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
                sellingPrice: p.sellingPrice === null || p.sellingPrice === undefined ? null : Number(p.sellingPrice),
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
            // prisma is already a transaction client from withPrismaAuth
                const item = await prisma.salesOrderItem.findUniqueOrThrow({
                    where: { id: salesOrderItemId },
                    select: {
                        quantity: true, qtyDelivered: true, salesOrderId: true, productId: true,
                        product: { select: { name: true, costPrice: true } },
                    },
                })

                const ordered = Number(item.quantity)
                const alreadyDelivered = Number(item.qtyDelivered)

                // Pre-flight validation against current DB state. The atomic
                // {increment} below is what actually prevents the lost-update,
                // but this check rejects obvious over-shipment with a friendly
                // Bahasa error before we touch stock / GL.
                if (alreadyDelivered + qtyShipped > ordered) {
                    const remaining = ordered - alreadyDelivered
                    throw new Error(`Pengiriman melebihi sisa pesanan. Sisa: ${remaining}`)
                }

                // Find stock and deduct atomically within same transaction
                const stockLevel = await prisma.stockLevel.findFirst({
                    where: { productId: item.productId, quantity: { gte: qtyShipped } },
                    select: { id: true, warehouseId: true, quantity: true, reservedQty: true },
                })

                if (!stockLevel) {
                    throw new Error("Stok tidak mencukupi untuk pengiriman")
                }

                // Release from reservation first (SO creation reserved stock),
                // only decrement availableQty for the unreserved portion
                const releaseFromReserved = Math.min(qtyShipped, Number(stockLevel.reservedQty))
                const releaseFromAvailable = qtyShipped - releaseFromReserved

                const updated = await prisma.stockLevel.updateMany({
                    where: { id: stockLevel.id, quantity: { gte: qtyShipped } },
                    data: {
                        quantity: { decrement: qtyShipped },
                        reservedQty: { decrement: releaseFromReserved },
                        availableQty: { decrement: releaseFromAvailable },
                    },
                })

                if (updated.count === 0) {
                    throw new Error("Stok tidak mencukupi untuk pengiriman")
                }

                const salesOrder = await prisma.salesOrder.findUniqueOrThrow({
                    where: { id: item.salesOrderId },
                    select: { id: true, number: true },
                })

                const unitCost = item.product?.costPrice ? Number(item.product.costPrice) : 0
                const totalValue = unitCost * qtyShipped

                const invTx = await prisma.inventoryTransaction.create({
                    data: {
                        productId: item.productId,
                        warehouseId: stockLevel.warehouseId,
                        type: 'SO_SHIPMENT',
                        quantity: -qtyShipped,
                        unitCost: unitCost > 0 ? unitCost : undefined,
                        totalValue: totalValue > 0 ? totalValue : undefined,
                        referenceId: salesOrder.id,
                        salesOrderId: salesOrder.id,
                        notes: `Pengiriman SO ${salesOrder.number} - ${qtyShipped} unit`,
                    },
                })

                // Post GL entry: DR COGS (5100) / CR Inventory Asset (1300)
                if (totalValue > 0) {
                    const productName = item.product?.name || item.productId.slice(0, 8)
                    await postInventoryGLEntry(prisma, {
                        transactionId: invTx.id,
                        type: 'SO_SHIPMENT',
                        productName,
                        quantity: qtyShipped,
                        unitCost,
                        totalValue,
                        reference: `SO ${salesOrder.number}`,
                    })
                }

                // Atomic increment via SQL: UPDATE ... SET qtyDelivered = qtyDelivered + $delta.
                // This closes the lost-update race where two concurrent partial
                // shipments read the same alreadyDelivered snapshot and both
                // wrote oldValue+qtyShipped, double-counting one delivery.
                await prisma.salesOrderItem.update({
                    where: { id: salesOrderItemId },
                    data: { qtyDelivered: { increment: qtyShipped } },
                })

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

                    // Auto-create AR invoice when SO fully delivered
                    try {
                        const { createInvoiceFromSalesOrder: autoCreateInvoice } = await import("@/lib/actions/finance-invoices")
                        const invResult: any = await autoCreateInvoice(item.salesOrderId)
                        if (invResult.success) {
                            console.log(`[Auto-AR] Invoice ${invResult.invoiceNumber || 'created'} for SO ${item.salesOrderId}`)
                        } else {
                            console.warn(`[Auto-AR] Could not create invoice:`, invResult.error)
                        }
                    } catch (invErr) {
                        console.warn("[Auto-AR] Invoice creation failed (shipment still recorded):", invErr)
                    }
                } else {
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

        revalidatePath("/inventory")
        revalidatePath("/inventory/stock")
        revalidatePath("/inventory/movements")
        revalidatePath("/sales/orders")

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

// ==============================================================================
// Cancel Sales Order
// ==============================================================================

// ==========================================
// SALES RETURN (Retur Penjualan)
// ==========================================

export interface SalesReturnItem {
    salesOrderItemId: string
    productId: string
    quantity: number
    unitPrice: number
    reason: string
}

export interface CreateSalesReturnInput {
    salesOrderId: string
    invoiceId?: string
    items: SalesReturnItem[]
    notes?: string
}

/**
 * Process a sales return: restore stock, create credit note, post GL entry.
 * GL: DR Sales Returns (4010), CR Accounts Receivable (1100)
 */
export async function createSalesReturn(
    input: CreateSalesReturnInput
): Promise<{ success: boolean; creditNoteId?: string; creditNoteNumber?: string; error?: string }> {
    try {
        // Period lock: fail fast before mutation
        await assertPeriodOpen(new Date())

        const result = await withPrismaAuth(async (prisma) => {
            // prisma is already a transaction client from withPrismaAuth
                // 1. Load Sales Order with items
                const so = await prisma.salesOrder.findUniqueOrThrow({
                    where: { id: input.salesOrderId },
                    include: {
                        customer: { select: { id: true, name: true } },
                        items: {
                            include: { product: { select: { id: true, name: true, code: true } } },
                        },
                        invoices: {
                            where: {
                                type: 'INV_OUT',
                                status: { notIn: ['CANCELLED', 'VOID'] },
                            },
                            orderBy: { createdAt: 'desc' },
                            take: 1,
                        },
                    },
                })

                // Determine which invoice to link
                const invoiceId = input.invoiceId || so.invoices[0]?.id || null

                // 2. Validate return quantities
                for (const returnItem of input.items) {
                    const soItem = so.items.find(i => i.id === returnItem.salesOrderItemId)
                    if (!soItem) {
                        throw new Error(`Item pesanan tidak ditemukan: ${returnItem.salesOrderItemId}`)
                    }
                    if (returnItem.quantity <= 0) {
                        throw new Error(`Qty retur harus > 0 untuk ${soItem.product.name}`)
                    }
                    const maxReturnable = Number(soItem.qtyDelivered)
                    if (returnItem.quantity > maxReturnable) {
                        throw new Error(
                            `Qty retur (${returnItem.quantity}) melebihi qty terkirim (${maxReturnable}) untuk ${soItem.product.name}`
                        )
                    }
                }

                // 3. Calculate totals
                let subtotal = 0
                for (const item of input.items) {
                    subtotal += item.quantity * item.unitPrice
                }
                const ppnAmount = Math.round(subtotal * 0.11)
                const totalAmount = subtotal + ppnAmount

                // 4. Generate credit note number
                const cnCount = await prisma.debitCreditNote.count({ where: { type: 'SALES_CN' } })
                const year = new Date().getFullYear()
                const cnNumber = `CN-${year}-${String(cnCount + 1).padStart(4, '0')}`

                // 5. Determine reason code from first item
                const reasonMap: Record<string, 'RET_DEFECT' | 'RET_WRONG' | 'RET_QUALITY' | 'RET_EXCESS' | 'RET_EXPIRED'> = {
                    'cacat': 'RET_DEFECT',
                    'rusak': 'RET_DEFECT',
                    'salah': 'RET_WRONG',
                    'tidak_sesuai': 'RET_WRONG',
                    'kualitas': 'RET_QUALITY',
                    'kelebihan': 'RET_EXCESS',
                    'kadaluarsa': 'RET_EXPIRED',
                }
                const firstReason = input.items[0]?.reason?.toLowerCase() || ''
                const reasonCode = reasonMap[firstReason] || 'RET_DEFECT'

                // 6. Create DebitCreditNote (Credit Note)
                const creditNote = await prisma.debitCreditNote.create({
                    data: {
                        number: cnNumber,
                        type: 'SALES_CN',
                        status: 'POSTED',
                        reasonCode,
                        customerId: so.customer.id,
                        originalInvoiceId: invoiceId,
                        originalReference: so.number,
                        subtotal,
                        ppnAmount,
                        totalAmount,
                        issueDate: new Date(),
                        postingDate: new Date(),
                        notes: input.notes || `Retur penjualan dari ${so.number}`,
                        description: `Retur penjualan - ${so.customer.name} - ${so.number}`,
                        items: {
                            create: input.items.map((item) => {
                                const soItem = so.items.find(i => i.id === item.salesOrderItemId)!
                                const lineAmount = item.quantity * item.unitPrice
                                const linePpn = Math.round(lineAmount * 0.11)
                                return {
                                    productId: item.productId,
                                    description: `Retur: ${soItem.product.name} (${soItem.product.code}) - ${item.reason}`,
                                    quantity: item.quantity,
                                    unitPrice: item.unitPrice,
                                    amount: lineAmount,
                                    ppnAmount: linePpn,
                                    totalAmount: lineAmount + linePpn,
                                }
                            }),
                        },
                    },
                })

                // 7. Create RETURN_IN inventory transactions + update stock
                for (const item of input.items) {
                    const soItem = so.items.find(i => i.id === item.salesOrderItemId)!

                    // Find a warehouse with existing stock level for this product
                    const stockLevel = await prisma.stockLevel.findFirst({
                        where: { productId: item.productId },
                        select: { id: true, warehouseId: true },
                    })

                    // Use existing warehouse or find any warehouse
                    let warehouseId: string
                    if (stockLevel) {
                        warehouseId = stockLevel.warehouseId
                    } else {
                        const warehouse = await prisma.warehouse.findFirst({ select: { id: true } })
                        if (!warehouse) throw new Error("Tidak ada gudang tersedia")
                        warehouseId = warehouse.id
                    }

                    // Create inventory transaction (positive qty for RETURN_IN)
                    await prisma.inventoryTransaction.create({
                        data: {
                            productId: item.productId,
                            warehouseId,
                            type: 'RETURN_IN',
                            quantity: item.quantity,
                            unitCost: item.unitPrice,
                            totalValue: item.quantity * item.unitPrice,
                            salesOrderId: so.id,
                            referenceId: creditNote.id,
                            notes: `Retur dari ${so.number} - ${soItem.product.name}: ${item.reason}`,
                        },
                    })

                    // Update stock level
                    if (stockLevel) {
                        await prisma.stockLevel.update({
                            where: { id: stockLevel.id },
                            data: {
                                quantity: { increment: item.quantity },
                                availableQty: { increment: item.quantity },
                            },
                        })
                    } else {
                        await prisma.stockLevel.create({
                            data: {
                                productId: item.productId,
                                warehouseId,
                                quantity: item.quantity,
                                availableQty: item.quantity,
                                reservedQty: 0,
                            },
                        })
                    }

                    // Update SO item qtyDelivered (reduce by returned qty)
                    const currentDelivered = Number(soItem.qtyDelivered)
                    const newDelivered = Math.max(0, currentDelivered - item.quantity)
                    await prisma.salesOrderItem.update({
                        where: { id: item.salesOrderItemId },
                        data: { qtyDelivered: newDelivered },
                    })
                }

                // 8. Update invoice balance if linked
                if (invoiceId) {
                    await prisma.invoice.update({
                        where: { id: invoiceId },
                        data: {
                            balanceDue: { decrement: totalAmount },
                        },
                    })

                    // Create settlement record
                    await prisma.debitCreditNoteSettlement.create({
                        data: {
                            noteId: creditNote.id,
                            invoiceId,
                            amount: totalAmount,
                        },
                    })

                    // Update credit note settled amount
                    await prisma.debitCreditNote.update({
                        where: { id: creditNote.id },
                        data: { settledAmount: totalAmount, status: 'APPLIED' },
                    })
                }

                return {
                    creditNoteId: creditNote.id,
                    creditNoteNumber: creditNote.number,
                }
        })

        // 9. Post GL entry outside transaction
        // DR Sales Returns (contra-revenue 4010), CR Accounts Receivable (1100)
        const subtotal = input.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
        const ppn = Math.round(subtotal * 0.11)
        const total = subtotal + ppn

        await ensureSystemAccounts()
        await postJournalEntry({
            description: `Retur Penjualan ${result.creditNoteNumber}`,
            date: new Date(),
            reference: result.creditNoteId,
            lines: [
                {
                    accountCode: '4010', // Retur Penjualan (contra-revenue)
                    debit: subtotal,
                    credit: 0,
                    description: 'Retur Penjualan',
                },
                {
                    accountCode: SYS_ACCOUNTS.PPN_KELUARAN, // PPN Keluaran
                    debit: ppn,
                    credit: 0,
                    description: 'Koreksi PPN Keluaran',
                },
                {
                    accountCode: SYS_ACCOUNTS.AR, // Piutang Usaha (AR)
                    debit: 0,
                    credit: total,
                    description: 'Pengurangan Piutang',
                },
            ],
        })

        return {
            success: true,
            creditNoteId: result.creditNoteId,
            creditNoteNumber: result.creditNoteNumber,
        }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal memproses retur penjualan'
        console.error("[createSalesReturn] Error:", error)
        return { success: false, error: msg }
    }
}

/**
 * Fetch sales order data for the return dialog (items with delivered qty > 0)
 */
export async function getSalesOrderForReturn(salesOrderId: string) {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) throw new Error("Unauthorized")

        const so = await basePrisma.salesOrder.findUnique({
            where: { id: salesOrderId },
            include: {
                customer: { select: { id: true, name: true, code: true } },
                items: {
                    include: {
                        product: { select: { id: true, name: true, code: true, unit: true } },
                    },
                },
                invoices: {
                    where: {
                        type: 'INV_OUT',
                        status: { notIn: ['CANCELLED', 'VOID'] },
                    },
                    select: { id: true, number: true, totalAmount: true, balanceDue: true, status: true },
                    orderBy: { createdAt: 'desc' },
                },
            },
        })

        if (!so) return null

        return {
            id: so.id,
            number: so.number,
            customer: so.customer,
            status: so.status,
            items: so.items
                .filter(i => Number(i.qtyDelivered) > 0)
                .map(i => ({
                    id: i.id,
                    productId: i.product.id,
                    productName: i.product.name,
                    productCode: i.product.code,
                    unit: i.product.unit,
                    qtyOrdered: Number(i.quantity),
                    qtyDelivered: Number(i.qtyDelivered),
                    unitPrice: Number(i.unitPrice),
                    color: i.color,
                    size: i.size,
                })),
            invoices: so.invoices.map(inv => ({
                id: inv.id,
                number: inv.number,
                totalAmount: Number(inv.totalAmount),
                balanceDue: Number(inv.balanceDue),
                status: inv.status,
            })),
        }
    } catch (error) {
        console.error("[getSalesOrderForReturn] Error:", error)
        return null
    }
}

// ==============================================================================
// Cancel Sales Order
// ==============================================================================

export async function cancelSalesOrder(
    salesOrderId: string,
    reason?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        return await withPrismaAuth(async (prisma) => {
            // prisma is already a transaction client from withPrismaAuth
                const so = await prisma.salesOrder.findUnique({
                    where: { id: salesOrderId },
                    select: { id: true, number: true, status: true },
                })
                if (!so) return { success: false, error: "Sales Order tidak ditemukan" }

                const cancellable: string[] = ['DRAFT', 'CONFIRMED']
                if (!cancellable.includes(so.status)) {
                    return {
                        success: false,
                        error: `Sales Order ${so.number} status "${so.status}" tidak dapat dibatalkan. Hanya DRAFT atau CONFIRMED yang bisa dibatalkan.`,
                    }
                }

                await prisma.salesOrder.update({
                    where: { id: salesOrderId },
                    data: {
                        status: 'CANCELLED',
                        notes: reason ? `[DIBATALKAN] ${reason}` : '[DIBATALKAN]',
                    },
                })

                // Release any reserved stock
                const soItems = await prisma.salesOrderItem.findMany({
                    where: { salesOrderId: salesOrderId },
                    select: { productId: true, quantity: true },
                })

                for (const item of soItems) {
                    const stockLevels = await prisma.stockLevel.findMany({
                        where: {
                            productId: item.productId,
                            reservedQty: { gt: 0 },
                            locationId: null,
                        },
                    })

                    let remainingToRelease = Number(item.quantity)
                    for (const sl of stockLevels) {
                        if (remainingToRelease <= 0) break
                        const releaseQty = Math.min(remainingToRelease, Number(sl.reservedQty))
                        await prisma.stockLevel.update({
                            where: { id: sl.id },
                            data: {
                                reservedQty: { decrement: releaseQty },
                                availableQty: { increment: releaseQty },
                            },
                        })
                        remainingToRelease -= releaseQty
                    }
                }

                return { success: true }
        })
    } catch (error: any) {
        console.error("[cancelSalesOrder] Error:", error)
        return { success: false, error: error.message || "Gagal membatalkan pesanan" }
    }
}

// ─── Auto-generate next customer code ───

export async function getNextCustomerCode(): Promise<string> {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new Error("Unauthorized")

    const year = new Date().getFullYear()
    const prefix = `CUST-${year}-`

    const latest = await basePrisma.customer.findFirst({
        where: { code: { startsWith: prefix } },
        orderBy: { code: "desc" },
        select: { code: true },
    })

    let nextNum = 1
    if (latest?.code) {
        const numPart = latest.code.replace(prefix, "")
        nextNum = (parseInt(numPart, 10) || 0) + 1
    }

    return `${prefix}${String(nextNum).padStart(4, "0")}`
}

// ─── Fetch customer categories from DB ───

export async function getCustomerCategories() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new Error("Unauthorized")

    return ensureCustomerCategories(basePrisma)
}
