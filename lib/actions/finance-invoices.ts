'use server'

import { InvoiceStatus, InvoiceType } from "@prisma/client"
import { withPrismaAuth } from "@/lib/db"
import { postJournalEntry } from "./finance-gl"

export interface InvoiceKanbanItem {
    id: string
    number: string
    partyName: string
    amount: number
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

            const base: InvoiceKanbanItem = {
                id: inv.id,
                number: inv.number,
                partyName,
                amount,
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
                // If productId is provided, use it, otherwise maybe look up by code?
                // For now, manual entry might not link to product table unless strictly required.
            })) : [{
                description: data.notes || 'Manual Entry',
                quantity: 1,
                unitPrice: data.amount,
                amount: data.amount
            }]

            // Recalculate total if items exist
            const totalAmount = invoiceItems.reduce((sum, item) => sum + Number(item.amount), 0)

            // Create invoice
            const invoice = await prisma.invoice.create({
                data: {
                    number: invoiceNumber,
                    type: invoiceType,
                    customerId: invoiceType === 'INV_OUT' ? data.customerId : null,
                    supplierId: invoiceType === 'INV_IN' ? data.customerId : null,
                    issueDate: issueDate,
                    dueDate: dueDate,
                    subtotal: totalAmount,
                    taxAmount: 0,
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
                    subtotal: po.netAmount || 0,
                    taxAmount: po.taxAmount || 0,
                    totalAmount: po.totalAmount || 0,
                    balanceDue: po.totalAmount || 0,
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

        return await withPrismaAuth(async (prisma) => {
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
                    status: 'ISSUED',
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

            // Auto-post to General Ledger (DR Accounts Receivable, CR Revenue)
            try {
                // Get GL account codes from database (or use predefined codes)
                const arAccount = await prisma.gLAccount.findFirst({
                    where: { code: '1200' } // Accounts Receivable
                })
                const revenueAccount = await prisma.gLAccount.findFirst({
                    where: { code: '4000' } // Sales Revenue
                })

                if (arAccount && revenueAccount) {
                    // Post journal entry
                    await postJournalEntry({
                        description: `Customer Invoice ${invoice.number} - ${salesOrder.customer?.name}`,
                        date: new Date(),
                        reference: invoice.number,
                        lines: [
                            {
                                accountCode: arAccount.code,
                                debit: Number(salesOrder.total),
                                credit: 0,
                                description: `AR - ${salesOrder.customer?.name}`
                            },
                            {
                                accountCode: revenueAccount.code,
                                debit: 0,
                                credit: Number(salesOrder.total),
                                description: `Sales Revenue - SO ${salesOrder.number}`
                            }
                        ]
                    })
                    console.log("GL Entry Posted for Invoice:", invoice.number)
                } else {
                    console.warn("GL Accounts not found - skipping auto-posting")
                }
            } catch (glError) {
                console.error("Failed to post GL entry (invoice still created):", glError)
            }

            return {
                success: true as const,
                invoiceId: invoice.id,
                invoiceNumber: invoice.number
            }
        })
    } catch (error) {
        console.error("Failed to create invoice from sales order:", error)
        return {
            success: false as const,
            error: (error as any)?.message || "Invoice creation failed"
        }
    }
}

/**
 * Get Sales Orders that are ready for invoicing (CONFIRMED status)
 */
export async function getPendingSalesOrders() {
    return withPrismaAuth(async (prisma) => {
        const orders = await prisma.salesOrder.findMany({
            where: {
                status: 'CONFIRMED',
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
        return await withPrismaAuth(async (prisma) => {
            const now = new Date()
            const existing = await prisma.invoice.findUnique({
                where: { id: invoiceId },
                select: { id: true, dueDate: true }
            })

            if (!existing) {
                throw new Error("Invoice not found")
            }

            const fallbackDueDate = new Date(now)
            fallbackDueDate.setDate(fallbackDueDate.getDate() + 30)
            const dueDate = existing.dueDate || fallbackDueDate
            const nextStatus = dueDate < now ? 'OVERDUE' : 'ISSUED'

            const invoice = await prisma.invoice.update({
                where: { id: invoiceId },
                data: {
                    status: nextStatus,
                    issueDate: now,
                    dueDate, // Preserve user-selected due date when available.
                }
            })

            // Log activity or "send" message (mock for now)
            console.log(`Sending Invoice ${invoice.number} via ${method}: ${message}`)

            return { success: true, dueDate, status: nextStatus }
        })
    } catch (error) {
        console.error("Failed to move invoice to sent:", error)
        return { success: false, error: "Failed to update invoice status" }
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
        return await withPrismaAuth(async (prisma) => {
            const invoice = await prisma.invoice.findUnique({
                where: { id: data.invoiceId },
                include: { customer: true, supplier: true }
            })

            if (!invoice) throw new Error("Invoice not found")

            // Create Payment Record
            const payment = await prisma.payment.create({
                data: {
                    number: `PAY-${Date.now()}`, // Simple ID generation
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

            // Update Invoice Status
            const newBalance = Number(invoice.balanceDue) - data.amount
            const newStatus = newBalance <= 0 ? 'PAID' : 'PARTIAL'

            await prisma.invoice.update({
                where: { id: invoice.id },
                data: {
                    status: newStatus,
                    balanceDue: newBalance,
                    // If fully paid, maybe set closing date?
                }
            })

            // Post Journal Entry (Cash Debit / AR Credit)
            // Determine Accounts
            const cashAccountCode = data.paymentMethod === 'CASH' ? '1000' : '1010' // Cash vs Bank
            const arAccountCode = '1200' // Accounts Receivable
            const apAccountCode = '2000' // Accounts Payable

            if (invoice.type === 'INV_OUT') {
                // Customer Payment: Debit Cash, Credit AR
                await postJournalEntry({
                    description: `Payment for Invoice ${invoice.number}`,
                    date: data.paymentDate,
                    reference: payment.number,
                    lines: [
                        { accountCode: cashAccountCode, debit: data.amount, credit: 0, description: `Receipt from ${invoice.customer?.name}` },
                        { accountCode: arAccountCode, debit: 0, credit: data.amount, description: `Payment for ${invoice.number}` }
                    ]
                })
            } else {
                // Vendor Payment: Debit AP, Credit Cash
                await postJournalEntry({
                    description: `Payment for Bill ${invoice.number}`,
                    date: data.paymentDate,
                    reference: payment.number,
                    lines: [
                        { accountCode: apAccountCode, debit: data.amount, credit: 0, description: `Payment for ${invoice.supplier?.name}` },
                        { accountCode: cashAccountCode, debit: 0, credit: data.amount, description: `Payment for ${invoice.number}` }
                    ]
                })
            }

            return { success: true }
        })
    } catch (error) {
        console.error("Failed to record payment:", error)
        return { success: false, error: "Failed to record payment" }
    }
}
