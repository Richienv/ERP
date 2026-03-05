'use server'

import { InvoiceStatus, InvoiceType } from "@prisma/client"
import { withPrismaAuth, prisma } from "@/lib/db"
import { postJournalEntry } from "./finance-gl"

export interface InvoiceKanbanItem {
    id: string
    number: string
    partyName: string
    amount: number
    balanceDue: number
    issueDate: Date
    dueDate: Date
    status: InvoiceStatus
    type: InvoiceType
    daysOverdue?: number
}

export interface InvoiceKanbanData {
    draft: InvoiceKanbanItem[]
    sent: InvoiceKanbanItem[]
    overdue: InvoiceKanbanItem[]
    paid: InvoiceKanbanItem[]
}

type InvoiceKanbanQueryInput = {
    q?: string | null
    type?: InvoiceType | 'ALL' | null
    limit?: number | null
}

export async function getInvoiceKanbanData(input?: InvoiceKanbanQueryInput): Promise<InvoiceKanbanData> {
    return withPrismaAuth(async (prisma) => {
        const normalizedQ = (input?.q || "").trim()
        const normalizedType = (input?.type || "ALL") as InvoiceType | 'ALL'
        const normalizedLimitRaw = Number(input?.limit)
        const normalizedLimit = Number.isFinite(normalizedLimitRaw) ? Math.min(500, Math.max(50, Math.trunc(normalizedLimitRaw))) : 300

        const where: any = { type: { in: ['INV_OUT', 'INV_IN'] } }
        if (normalizedType !== 'ALL') where.type = normalizedType
        if (normalizedQ) {
            where.OR = [
                { number: { contains: normalizedQ, mode: 'insensitive' } },
                { customer: { name: { contains: normalizedQ, mode: 'insensitive' } } },
                { supplier: { name: { contains: normalizedQ, mode: 'insensitive' } } },
            ]
        }

        const invoices = await prisma.invoice.findMany({
            where,
            include: {
                customer: { select: { name: true } },
                supplier: { select: { name: true } },
            },
            orderBy: { issueDate: 'desc' },
            take: normalizedLimit,
        })

        const now = new Date()
        const data: InvoiceKanbanData = { draft: [], sent: [], overdue: [], paid: [] }

        for (const inv of invoices) {
            const partyName = inv.customer?.name || inv.supplier?.name || 'Unknown'
            const amount = Number(inv.totalAmount || 0)
            const dueDate = inv.dueDate
            const issueDate = inv.issueDate

            const balanceDue = Number(inv.balanceDue ?? amount)

            const base: InvoiceKanbanItem = {
                id: inv.id,
                number: inv.number,
                partyName,
                amount,
                balanceDue,
                issueDate,
                dueDate,
                status: inv.status,
                type: inv.type,
            }

            if (inv.status === 'DRAFT') {
                data.draft.push(base)
                continue
            }

            if (inv.status === 'PAID') {
                data.paid.push(base)
                continue
            }

            const isOverdue = inv.status === 'OVERDUE' || dueDate < now
            if (isOverdue) {
                const daysOver = Math.max(0, Math.ceil((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)))
                data.overdue.push({ ...base, daysOverdue: daysOver })
            } else {
                data.sent.push(base)
            }
        }

        return data
    })
}

export async function getInvoiceCustomers(): Promise<Array<{ id: string; name: string; type: 'CUSTOMER' | 'SUPPLIER' }>> {
    return withPrismaAuth(async (prisma) => {
        const [customers, suppliers] = await Promise.all([
            prisma.customer.findMany({
                select: { id: true, name: true },
                where: { isActive: true },
                orderBy: { name: 'asc' },
                take: 100,
            }),
            prisma.supplier.findMany({
                select: { id: true, name: true },
                where: { isActive: true },
                orderBy: { name: 'asc' },
                take: 100,
            })
        ])

        return [
            ...customers.map(c => ({ ...c, type: 'CUSTOMER' as const })),
            ...suppliers.map(s => ({ ...s, type: 'SUPPLIER' as const }))
        ]
    })
}

// ==========================================
// INVOICE CREATION
// ==========================================

/**
 * Create a new customer invoice (normal manual creation)
 */
export async function createCustomerInvoice(data: {
    customerId: string // Can be Customer ID or Supplier ID
    amount: number
    issueDate?: Date
    dueDate?: Date
    notes?: string
    includeTax?: boolean  // PPN 11%
    // Manual Items
    items?: Array<{
        description: string
        quantity: number
        unitPrice: number
        productCode?: string
        productId?: string
    }>
    type?: 'CUSTOMER' | 'SUPPLIER'
}) {
    try {
        return await withPrismaAuth(async (prisma) => {
            // Determine Type
            let invoiceType: 'INV_OUT' | 'INV_IN' = 'INV_OUT'

            // Check if ID belongs to customer or supplier if type not explicit
            if (!data.type) {
                const isCustomer = await prisma.customer.findUnique({ where: { id: data.customerId } })
                invoiceType = isCustomer ? 'INV_OUT' : 'INV_IN'
            } else {
                invoiceType = data.type === 'CUSTOMER' ? 'INV_OUT' : 'INV_IN'
            }

            // Generate invoice number prefix
            const prefix = invoiceType === 'INV_OUT' ? 'INV' : 'BILL'
            const year = new Date().getFullYear()

            const count = await prisma.invoice.count({
                where: {
                    type: invoiceType,
                    number: { startsWith: `${prefix}-${year}` }
                }
            })
            const invoiceNumber = `${prefix}-${year}-${String(count + 1).padStart(4, '0')}`

            // Calculate due date (default NET 30)
            const issueDate = data.issueDate || new Date()
            const dueDate = data.dueDate || new Date(issueDate.getTime() + 30 * 24 * 60 * 60 * 1000)

            // Prepare Items
            const invoiceItems = data.items && data.items.length > 0 ? data.items.map(item => ({
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                amount: item.quantity * item.unitPrice,
            })) : [{
                description: data.notes || 'Manual Entry',
                quantity: 1,
                unitPrice: data.amount,
                amount: data.amount
            }]

            // Calculate subtotal and tax
            const subtotal = invoiceItems.reduce((sum, item) => sum + Number(item.amount), 0)
            const taxAmount = data.includeTax ? Math.round(subtotal * 0.11) : 0
            const totalAmount = subtotal + taxAmount

            // Create invoice
            const invoice = await prisma.invoice.create({
                data: {
                    number: invoiceNumber,
                    type: invoiceType,
                    customerId: invoiceType === 'INV_OUT' ? data.customerId : null,
                    supplierId: invoiceType === 'INV_IN' ? data.customerId : null,
                    issueDate: issueDate,
                    dueDate: dueDate,
                    subtotal: subtotal,
                    taxAmount: taxAmount,
                    totalAmount: totalAmount,
                    balanceDue: totalAmount,
                    status: 'DRAFT',
                    items: {
                        create: invoiceItems
                    }
                }
            })

            return {
                success: true,
                invoiceId: invoice.id,
                invoiceNumber: invoice.number
            }
        })
    } catch (error: any) {
        console.error("Failed to create invoice:", error)
        return { success: false, error: error.message || "Failed to create invoice" }
    }
}

/**
 * Update a DRAFT invoice (items, amounts, dates, tax)
 * Only DRAFT invoices can be edited. ISSUED/SENT invoices are locked.
 */
export async function updateDraftInvoice(data: {
    invoiceId: string
    customerId?: string
    items?: Array<{ description: string; quantity: number; unitPrice: number }>
    includeTax?: boolean
    discountAmount?: number
    issueDate?: Date
    dueDate?: Date
}) {
    try {
        return await withPrismaAuth(async (prisma) => {
            const invoice = await prisma.invoice.findUnique({
                where: { id: data.invoiceId },
                select: { id: true, status: true, type: true }
            })
            if (!invoice) return { success: false, error: "Invoice tidak ditemukan" }
            if (invoice.status !== 'DRAFT') return { success: false, error: "Hanya invoice DRAFT yang bisa diedit" }

            const discount = data.discountAmount ?? 0

            // Recalculate amounts from items
            if (data.items && data.items.length > 0) {
                // Delete existing items, recreate
                await prisma.invoiceItem.deleteMany({ where: { invoiceId: data.invoiceId } })
                const invoiceItems = data.items.map(item => ({
                    invoiceId: data.invoiceId,
                    description: item.description,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    amount: item.quantity * item.unitPrice,
                }))
                await prisma.invoiceItem.createMany({ data: invoiceItems })

                const subtotal = invoiceItems.reduce((sum, item) => sum + Number(item.amount), 0)
                const taxableAmount = subtotal - discount
                const taxAmount = data.includeTax ? Math.round(taxableAmount * 0.11) : 0
                const totalAmount = taxableAmount + taxAmount

                const updateData: any = { subtotal, taxAmount, discountAmount: discount, totalAmount, balanceDue: totalAmount }
                if (data.customerId) {
                    if (invoice.type === 'INV_OUT') updateData.customerId = data.customerId
                    else updateData.supplierId = data.customerId
                }
                if (data.issueDate) updateData.issueDate = data.issueDate
                if (data.dueDate) updateData.dueDate = data.dueDate

                await prisma.invoice.update({ where: { id: data.invoiceId }, data: updateData })
            } else {
                // Just update dates/customer/tax/discount
                const updateData: any = {}
                if (data.customerId) {
                    if (invoice.type === 'INV_OUT') updateData.customerId = data.customerId
                    else updateData.supplierId = data.customerId
                }
                if (data.issueDate) updateData.issueDate = data.issueDate
                if (data.dueDate) updateData.dueDate = data.dueDate
                if (data.includeTax !== undefined || data.discountAmount !== undefined) {
                    const existing = await prisma.invoice.findUnique({
                        where: { id: data.invoiceId },
                        select: { subtotal: true, discountAmount: true }
                    })
                    const subtotal = Number(existing?.subtotal || 0)
                    const disc = data.discountAmount ?? Number(existing?.discountAmount || 0)
                    const taxableAmount = subtotal - disc
                    const taxAmount = (data.includeTax ?? true) ? Math.round(taxableAmount * 0.11) : 0
                    updateData.taxAmount = taxAmount
                    updateData.discountAmount = disc
                    updateData.totalAmount = taxableAmount + taxAmount
                    updateData.balanceDue = taxableAmount + taxAmount
                }
                if (Object.keys(updateData).length > 0) {
                    await prisma.invoice.update({ where: { id: data.invoiceId }, data: updateData })
                }
            }

            return { success: true }
        })
    } catch (error: any) {
        console.error("Failed to update draft invoice:", error)
        return { success: false, error: error.message || "Gagal mengupdate invoice" }
    }
}

/**
 * Get full invoice details (for editing or viewing)
 */
export async function getInvoiceDetail(invoiceId: string) {
    try {
        return await withPrismaAuth(async (prisma) => {
            const invoice = await prisma.invoice.findUnique({
                where: { id: invoiceId },
                include: {
                    items: true,
                    customer: { select: { id: true, name: true } },
                    supplier: { select: { id: true, name: true } },
                    payments: { select: { id: true, number: true, amount: true, date: true, method: true } },
                }
            })
            if (!invoice) return { success: false, error: "Invoice tidak ditemukan" }
            return { success: true, data: invoice }
        })
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

/**
 * Get account transactions (GL journal entries) for the Account Transactions Report.
 * Returns journal entries with their lines, grouped chronologically.
 */
export async function getAccountTransactions(params?: {
    accountCode?: string
    dateFrom?: Date
    dateTo?: Date
    limit?: number
}) {
    try {
        return await withPrismaAuth(async (prisma) => {
            const where: any = { status: 'POSTED' }
            if (params?.dateFrom || params?.dateTo) {
                where.date = {}
                if (params?.dateFrom) where.date.gte = params.dateFrom
                if (params?.dateTo) where.date.lte = params.dateTo
            }

            // If filtering by account, only get entries that have lines for that account
            if (params?.accountCode) {
                const account = await prisma.gLAccount.findUnique({ where: { code: params.accountCode } })
                if (account) {
                    where.lines = { some: { accountId: account.id } }
                }
            }

            const entries = await prisma.journalEntry.findMany({
                where,
                include: {
                    lines: {
                        include: {
                            account: { select: { id: true, code: true, name: true, type: true } }
                        }
                    },
                    invoice: { select: { id: true, number: true, type: true } },
                    payment: { select: { id: true, number: true, method: true } },
                },
                orderBy: { date: 'desc' },
                take: params?.limit || 200,
            })

            // Also get account list for the filter dropdown
            const accounts = await prisma.gLAccount.findMany({
                orderBy: { code: 'asc' },
                select: { id: true, code: true, name: true, type: true, balance: true }
            })

            return {
                success: true,
                entries: entries.map(e => ({
                    id: e.id,
                    date: e.date,
                    description: e.description,
                    reference: e.reference,
                    invoiceNumber: e.invoice?.number || null,
                    invoiceType: e.invoice?.type || null,
                    paymentNumber: e.payment?.number || null,
                    paymentMethod: e.payment?.method || null,
                    lines: e.lines.map(l => ({
                        id: l.id,
                        accountCode: l.account.code,
                        accountName: l.account.name,
                        accountType: l.account.type,
                        description: l.description,
                        debit: Number(l.debit),
                        credit: Number(l.credit),
                    }))
                })),
                accounts: accounts.map(a => ({
                    id: a.id,
                    code: a.code,
                    name: a.name,
                    type: a.type,
                    balance: Number(a.balance),
                }))
            }
        })
    } catch (error: any) {
        console.error("Failed to fetch account transactions:", error)
        return { success: false, error: error.message, entries: [], accounts: [] }
    }
}

// ==========================================
// PROCUREMENT INTEGRATION
// ==========================================

export async function recordPendingBillFromPO(
    po: any,
    options?: { forceCreate?: boolean; requireConfirmationOnDuplicate?: boolean }
) {
    try {
        console.log("Creating/Updating Finance Bill for PO:", po.number)

        return await withPrismaAuth(async (prisma) => {
            // Check if Bill already exists for this PO
            const existingBill = await prisma.invoice.findFirst({
                where: {
                    type: 'INV_IN',
                    OR: [{ orderId: po.id }, { purchaseOrderId: po.id }],
                    status: { notIn: ['CANCELLED', 'VOID'] }
                },
                orderBy: { createdAt: 'desc' }
            })

            if (existingBill) {
                console.log("Bill already exists:", existingBill.number)
                if (!options?.forceCreate) {
                    if (options?.requireConfirmationOnDuplicate) {
                        return {
                            success: false,
                            code: 'INVOICE_ALREADY_EXISTS',
                            requiresConfirmation: true,
                            existingInvoiceId: existingBill.id,
                            existingInvoiceNumber: existingBill.number,
                            existingInvoiceStatus: existingBill.status,
                            error: `Bill ${existingBill.number} already exists for this PO`
                        } as const
                    }

                    return {
                        success: true,
                        billId: existingBill.id,
                        billNumber: existingBill.number,
                        alreadyExists: true,
                        existingStatus: existingBill.status
                    } as const
                }
            }

            const billBaseNumber = `BILL-${po.number}`
            const duplicateCount = await prisma.invoice.count({
                where: {
                    type: 'INV_IN',
                    number: { startsWith: billBaseNumber }
                }
            })
            const billNumber = duplicateCount > 0
                ? `${billBaseNumber}-${String(duplicateCount + 1).padStart(2, '0')}`
                : billBaseNumber

            // Create new Bill (Invoice Type IN)
            const bill = await prisma.invoice.create({
                data: {
                    number: billNumber,
                    type: 'INV_IN',
                    supplierId: po.supplierId,
                    orderId: po.id,
                    purchaseOrderId: po.id,
                    status: 'DRAFT',
                    issueDate: new Date(),
                    dueDate: new Date(new Date().setDate(new Date().getDate() + 30)),
                    subtotal: po.totalAmount || 0,     // pre-tax subtotal
                    taxAmount: po.taxAmount || 0,
                    totalAmount: po.netAmount || 0,    // grand total (subtotal + tax)
                    balanceDue: po.netAmount || 0,     // what's actually owed
                    items: {
                        create: po.items.map((item: any) => ({
                            description: item.product?.name || 'Unknown Item',
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            amount: item.totalPrice,
                            productId: item.productId
                        }))
                    }
                }
            })

            console.log("Bill Created:", bill.number)
            return { success: true, billId: bill.id, billNumber: bill.number, alreadyExists: false } as const
        })
    } catch (error) {
        console.error("Failed to record pending bill:", error)
        return { success: false, error: "Finance Sync Failed" }
    }
}

// ==========================================
// SALES INTEGRATION
// ==========================================

export async function createInvoiceFromSalesOrder(
    salesOrderId: string,
    options?: { forceCreate?: boolean }
) {
    try {
        console.log("Creating Customer Invoice for Sales Order:", salesOrderId)

        const result = await withPrismaAuth(async (prisma) => {
            // Get Sales Order with all details
            const salesOrder = await prisma.salesOrder.findUnique({
                where: { id: salesOrderId },
                include: {
                    customer: true,
                    items: {
                        include: {
                            product: true
                        }
                    }
                }
            })

            if (!salesOrder) {
                throw new Error("Sales Order not found")
            }

            if (!salesOrder.customerId) {
                throw new Error("Sales Order has no customer")
            }

            // Check if Invoice already exists for this Sales Order
            const existingInvoice = await prisma.invoice.findFirst({
                where: {
                    salesOrderId: salesOrder.id,
                    type: 'INV_OUT',
                    status: { notIn: ['CANCELLED', 'VOID'] }
                },
                orderBy: { createdAt: 'desc' }
            })

            if (existingInvoice && !options?.forceCreate) {
                console.log("Invoice already exists:", existingInvoice.number)
                return {
                    success: false as const,
                    code: 'INVOICE_ALREADY_EXISTS',
                    requiresConfirmation: true as const,
                    existingInvoiceId: existingInvoice.id,
                    existingInvoiceNumber: existingInvoice.number,
                    existingInvoiceStatus: existingInvoice.status,
                    error: `Invoice ${existingInvoice.number} already exists for this Sales Order`
                }
            }

            // Generate Invoice Number
            const year = new Date().getFullYear()
            const count = await prisma.invoice.count({
                where: {
                    type: 'INV_OUT',
                    number: { startsWith: `INV-${year}` }
                }
            })
            const invoiceNumber = `INV-${year}-${String(count + 1).padStart(4, '0')}`

            // Determine due date based on payment terms (default: NET_30 = 30 days)
            const paymentTermDays = salesOrder.paymentTerm === 'NET_30' ? 30 :
                salesOrder.paymentTerm === 'NET_15' ? 15 :
                    salesOrder.paymentTerm === 'NET_60' ? 60 : 30
            const dueDate = new Date()
            dueDate.setDate(dueDate.getDate() + paymentTermDays)

            // Create Customer Invoice (Invoice Type OUT)
            const invoice = await prisma.invoice.create({
                data: {
                    number: invoiceNumber,
                    type: 'INV_OUT',
                    customerId: salesOrder.customerId,
                    salesOrderId: salesOrder.id,
                    status: 'DRAFT',
                    issueDate: new Date(),
                    dueDate: dueDate,
                    subtotal: salesOrder.subtotal,
                    taxAmount: salesOrder.taxAmount,
                    discountAmount: salesOrder.discountAmount || 0,
                    totalAmount: salesOrder.total,
                    balanceDue: salesOrder.total,
                    items: {
                        create: salesOrder.items.map((item) => ({
                            description: item.product?.name || item.description || 'Unknown Item',
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            amount: item.lineTotal,
                            productId: item.productId
                        }))
                    }
                }
            })

            console.log("Customer Invoice Created:", invoice.number)

            return {
                success: true as const,
                invoiceId: invoice.id,
                invoiceNumber: invoice.number
            }
        })

        return result
    } catch (error) {
        console.error("Failed to create invoice from sales order:", error)
        return {
            success: false as const,
            error: (error as any)?.message || "Invoice creation failed"
        }
    }
}

/**
 * Get Sales Orders that are ready for invoicing (CONFIRMED or IN_PROGRESS status)
 */
export async function getPendingSalesOrders() {
    return withPrismaAuth(async (prisma) => {
        const orders = await prisma.salesOrder.findMany({
            where: {
                status: { in: ['CONFIRMED', 'IN_PROGRESS', 'DELIVERED', 'COMPLETED'] },
                invoices: {
                    none: {
                        type: 'INV_OUT',
                        status: { notIn: ['CANCELLED', 'VOID'] }
                    }
                }
            },
            include: {
                customer: { select: { id: true, name: true } }
            },
            orderBy: { orderDate: 'desc' },
            take: 100
        })

        return orders.map(o => ({
            id: o.id,
            number: o.number,
            customerName: (o as any).customer?.name || 'Unknown',
            amount: Number(o.total),
            date: o.orderDate
        }))
    })
}

/**
 * Get Purchase Orders that are ready for billing (ARRIVED status)
 */
export async function getPendingPurchaseOrders() {
    return withPrismaAuth(async (prisma) => {
        const [orders, existingBills] = await Promise.all([
            prisma.purchaseOrder.findMany({
                where: {
                    status: { in: ['RECEIVED', 'ORDERED', 'APPROVED'] }, // Allow APPROVED for early billing
                },
                include: {
                    supplier: { select: { id: true, name: true } }
                },
                orderBy: { orderDate: 'desc' },
                take: 100
            }),
            prisma.invoice.findMany({
                where: {
                    type: 'INV_IN',
                    status: { notIn: ['CANCELLED', 'VOID'] },
                    OR: [{ purchaseOrderId: { not: null } }, { orderId: { not: null } }]
                },
                select: { purchaseOrderId: true, orderId: true }
            })
        ])

        const poIdsWithBill = new Set<string>()
        for (const bill of existingBills) {
            if (bill.purchaseOrderId) poIdsWithBill.add(bill.purchaseOrderId)
            if (bill.orderId) poIdsWithBill.add(bill.orderId)
        }

        const pendingOrders = orders.filter((order) => !poIdsWithBill.has(order.id))

        return pendingOrders.map(o => ({
            id: o.id,
            number: o.number,
            vendorName: (o as any).supplier?.name || 'Unknown',
            amount: Number(o.totalAmount),
            date: o.orderDate
        }))
    })
}

/**
 * Create a Bill (INV_IN) from a Purchase Order ID
 */
export async function createBillFromPOId(
    poId: string,
    options?: { forceCreate?: boolean }
) {
    try {
        return await withPrismaAuth(async (prisma) => {
            const po = await prisma.purchaseOrder.findUnique({
                where: { id: poId },
                include: {
                    items: {
                        include: {
                            product: true
                        }
                    }
                }
            })

            if (!po) throw new Error("Purchase Order not found")
            return await recordPendingBillFromPO(po, {
                forceCreate: options?.forceCreate,
                requireConfirmationOnDuplicate: true
            })
        })
    } catch (error: any) {
        console.error("Failed to create bill from PO:", error)
        return { success: false, error: error.message }
    }
}

export async function moveInvoiceToSent(invoiceId: string, message?: string, method?: 'WHATSAPP' | 'EMAIL') {
    try {
        const txResult = await withPrismaAuth(async (prisma) => {
            const now = new Date()
            const existing = await prisma.invoice.findUnique({
                where: { id: invoiceId },
                select: {
                    id: true, number: true, dueDate: true,
                    totalAmount: true, subtotal: true, taxAmount: true,
                    type: true, status: true,
                    customer: { select: { name: true } },
                    supplier: { select: { name: true } },
                }
            })

            if (!existing) throw new Error("Invoice not found")
            if (existing.status !== 'DRAFT') throw new Error("Hanya invoice DRAFT yang bisa dikirim")

            const fallbackDueDate = new Date(now)
            fallbackDueDate.setDate(fallbackDueDate.getDate() + 30)
            const dueDate = existing.dueDate || fallbackDueDate
            const nextStatus = dueDate < now ? 'OVERDUE' : 'ISSUED'

            await prisma.invoice.update({
                where: { id: invoiceId },
                data: {
                    status: nextStatus,
                    issueDate: now,
                    dueDate,
                }
            })

            return {
                number: existing.number,
                type: existing.type,
                totalAmount: Number(existing.totalAmount || 0),
                subtotal: Number(existing.subtotal || existing.totalAmount || 0),
                taxAmount: Number(existing.taxAmount || 0),
                customerName: existing.customer?.name,
                supplierName: existing.supplier?.name,
                nextStatus,
                dueDate,
                issueDate: now,
            }
        })

        // Post GL entry for AR/AP recognition (outside withPrismaAuth to avoid nested transaction)
        // Idempotency: check if journal entry already exists for this invoice
        try {
            const existingJE = await prisma.journalEntry.findFirst({
                where: {
                    OR: [
                        { invoiceId: invoiceId },
                        { reference: txResult.number },
                    ]
                },
                select: { id: true }
            })

            if (!existingJE) {
                if (txResult.type === 'INV_OUT') {
                    // AR Invoice: DR 1100 Piutang Usaha, CR 4000 Pendapatan + CR 2110 PPN Keluaran
                    const lines: { accountCode: string; debit: number; credit: number; description: string }[] = [
                        { accountCode: '1100', debit: txResult.totalAmount, credit: 0, description: `Piutang - ${txResult.customerName || 'Customer'}` },
                    ]
                    if (txResult.taxAmount > 0) {
                        lines.push({ accountCode: '4000', debit: 0, credit: txResult.subtotal, description: `Pendapatan - ${txResult.number}` })
                        lines.push({ accountCode: '2110', debit: 0, credit: txResult.taxAmount, description: `PPN Keluaran - ${txResult.number}` })
                    } else {
                        lines.push({ accountCode: '4000', debit: 0, credit: txResult.totalAmount, description: `Pendapatan - ${txResult.number}` })
                    }
                    await postJournalEntry({
                        description: `Faktur Penjualan ${txResult.number} - ${txResult.customerName || 'Customer'}`,
                        date: txResult.issueDate,
                        reference: txResult.number,
                        invoiceId: invoiceId,
                        lines,
                    })
                } else {
                    // AP Bill: DR 5000 HPP + DR 1330 PPN Masukan, CR 2100 Hutang Usaha
                    const lines: { accountCode: string; debit: number; credit: number; description: string }[] = []
                    if (txResult.taxAmount > 0) {
                        lines.push({ accountCode: '5000', debit: txResult.subtotal, credit: 0, description: `HPP - ${txResult.number}` })
                        lines.push({ accountCode: '1330', debit: txResult.taxAmount, credit: 0, description: `PPN Masukan - ${txResult.number}` })
                    } else {
                        lines.push({ accountCode: '5000', debit: txResult.totalAmount, credit: 0, description: `HPP - ${txResult.number}` })
                    }
                    lines.push({ accountCode: '2100', debit: 0, credit: txResult.totalAmount, description: `Hutang - ${txResult.supplierName || 'Supplier'}` })
                    await postJournalEntry({
                        description: `Tagihan Pembelian ${txResult.number} - ${txResult.supplierName || 'Supplier'}`,
                        date: txResult.issueDate,
                        reference: txResult.number,
                        invoiceId: invoiceId,
                        lines,
                    })
                }
            }
        } catch (glError: any) {
            console.error("GL posting failed:", glError)
            // Revert invoice to DRAFT so user knows GL posting failed
            try {
                await prisma.invoice.update({
                    where: { id: invoiceId },
                    data: { status: 'DRAFT', issueDate: null },
                })
            } catch { /* revert best-effort */ }
            return {
                success: false,
                error: `Invoice gagal diposting ke jurnal: ${glError?.message || 'Akun GL tidak ditemukan'}. Status dikembalikan ke DRAFT.`,
            }
        }

        return { success: true, dueDate: txResult.dueDate, status: txResult.nextStatus }
    } catch (error: any) {
        console.error("Failed to move invoice to sent:", error)
        return { success: false, error: error?.message || "Failed to update invoice status" }
    }
}

export async function recordInvoicePayment(data: {
    invoiceId: string
    paymentMethod: 'CASH' | 'TRANSFER' | 'CHECK' | 'CREDIT_CARD' | 'OTHER'
    amount: number
    paymentDate: Date
    reference?: string
    notes?: string
}) {
    try {
        // Step 1: Create payment + update invoice in a single transaction
        const txResult = await withPrismaAuth(async (prisma) => {
            const invoice = await prisma.invoice.findUnique({
                where: { id: data.invoiceId },
                include: { customer: true, supplier: true }
            })

            if (!invoice) throw new Error("Invoice not found")

            const payment = await prisma.payment.create({
                data: {
                    number: `PAY-${Date.now()}`,
                    date: data.paymentDate,
                    amount: data.amount,
                    method: data.paymentMethod === 'CREDIT_CARD' || data.paymentMethod === 'OTHER' ? 'TRANSFER' : data.paymentMethod,
                    reference: data.reference,
                    notes: data.notes,
                    invoiceId: invoice.id,
                    customerId: invoice.customerId,
                    supplierId: invoice.supplierId
                }
            })

            const newBalance = Number(invoice.balanceDue) - data.amount
            const newStatus = newBalance <= 0 ? 'PAID' : 'PARTIAL'

            await prisma.invoice.update({
                where: { id: invoice.id },
                data: { status: newStatus, balanceDue: newBalance }
            })

            return {
                paymentNumber: payment.number,
                invoiceNumber: invoice.number,
                invoiceType: invoice.type,
                customerName: invoice.customer?.name,
                supplierName: invoice.supplier?.name,
            }
        })

        // Step 2: Post journal entry OUTSIDE the main transaction to avoid nested tx deadlock
        // Standard account codes per erp_accounting_scenarios.json:
        // 1000 = Kas Besar, 1010 = Bank, 1100 = Piutang Usaha, 2100 = Hutang Usaha
        const cashAccountCode = data.paymentMethod === 'CASH' ? '1000' : '1010'

        try {
            if (txResult.invoiceType === 'INV_OUT') {
                // AR Payment: DR Kas/Bank, CR 1100 Piutang Usaha
                await postJournalEntry({
                    description: `Penerimaan Pembayaran ${txResult.invoiceNumber} - ${txResult.customerName || 'Customer'}`,
                    date: data.paymentDate,
                    reference: `${txResult.paymentNumber} — ${txResult.invoiceNumber}`,
                    invoiceId: data.invoiceId,
                    lines: [
                        { accountCode: cashAccountCode, debit: data.amount, credit: 0, description: `Terima dari ${txResult.customerName}` },
                        { accountCode: '1100', debit: 0, credit: data.amount, description: `Pelunasan ${txResult.invoiceNumber}` }
                    ]
                })
            } else {
                // AP Payment: DR 2100 Hutang Usaha, CR Kas/Bank
                await postJournalEntry({
                    description: `Pembayaran Tagihan ${txResult.invoiceNumber} - ${txResult.supplierName || 'Supplier'}`,
                    date: data.paymentDate,
                    reference: `${txResult.paymentNumber} — ${txResult.invoiceNumber}`,
                    invoiceId: data.invoiceId,
                    lines: [
                        { accountCode: '2100', debit: data.amount, credit: 0, description: `Pelunasan ${txResult.supplierName}` },
                        { accountCode: cashAccountCode, debit: 0, credit: data.amount, description: `Bayar ${txResult.invoiceNumber}` }
                    ]
                })
            }
        } catch (glError: any) {
            console.warn("Journal entry failed (GL accounts may not exist):", glError)
            return {
                success: true,
                glWarning: `Pembayaran berhasil dicatat, tetapi jurnal GL gagal diposting: ${glError?.message || 'Akun GL tidak ditemukan'}. Hubungi bagian akuntansi.`,
            }
        }

        return { success: true }
    } catch (error) {
        console.error("Failed to record payment:", error)
        return { success: false, error: "Failed to record payment" }
    }
}
