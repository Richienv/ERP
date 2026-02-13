'use server'

import { withPrismaAuth } from "@/lib/db"
import { postJournalEntry } from "./finance-gl"

// ==========================================
// CREDIT NOTES & REFUNDS
// ==========================================

export async function createCreditNote(data: {
    originalInvoiceId: string
    reason: string
    items: {
        description: string
        quantity: number
        unitPrice: number
    }[]
}) {
    try {
        return await withPrismaAuth(async (prisma) => {
            // 1. Get Original Invoice
            const originalInvoice = await prisma.invoice.findUnique({
                where: { id: data.originalInvoiceId },
                include: { customer: true }
            })

            if (!originalInvoice) throw new Error("Original invoice not found")
            if (originalInvoice.type !== 'INV_OUT') throw new Error("Can only credit customer invoices")

            // 2. Calculate Credit Amount
            const creditSubtotal = data.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
            const creditTax = creditSubtotal * 0.11
            const creditTotal = creditSubtotal + creditTax

            // 3. Generate Credit Note Number
            const count = await prisma.invoice.count({ where: { type: 'CREDIT_NOTE' } })
            const year = new Date().getFullYear()
            const number = `CN-${year}-${String(count + 1).padStart(4, '0')}`

            // 4. Create Credit Note
            const creditNote = await prisma.invoice.create({
                data: {
                    number,
                    type: 'CREDIT_NOTE',
                    customerId: originalInvoice.customerId,
                    referenceId: originalInvoice.id,
                    status: 'ISSUED',
                    issueDate: new Date(),
                    dueDate: new Date(),
                    subtotal: -creditSubtotal,
                    taxAmount: -creditTax,
                    totalAmount: -creditTotal,
                    balanceDue: -creditTotal,
                    notes: data.reason,
                    items: {
                        create: data.items.map(item => ({
                            description: item.description,
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            amount: -(item.quantity * item.unitPrice)
                        }))
                    }
                }
            })

            // 5. Apply Credit to Original Invoice
            const newBalance = Number(originalInvoice.balanceDue) - creditTotal
            await prisma.invoice.update({
                where: { id: originalInvoice.id },
                data: {
                    balanceDue: newBalance,
                    status: newBalance <= 0 ? 'PAID' : 'PARTIAL'
                }
            })

            // 6. Post Journal Entry
            await postJournalEntry({
                description: `Credit Note for ${originalInvoice.number}: ${data.reason}`,
                date: new Date(),
                reference: creditNote.id,
                lines: [
                    {
                        accountCode: '1200', // AR Account
                        debit: creditTotal,
                        credit: 0
                    },
                    {
                        accountCode: '4101', // Revenue (negative)
                        debit: 0,
                        credit: creditSubtotal
                    },
                    {
                        accountCode: '2200', // Tax Payable
                        debit: 0,
                        credit: creditTax
                    }
                ]
            })

            return { success: true, creditNoteId: creditNote.id, number: creditNote.number }
        })
    } catch (error: any) {
        console.error("Create Credit Note Error:", error)
        return { success: false, error: error.message }
    }
}

export async function processRefund(data: {
    invoiceId: string
    amount: number
    method: 'CASH' | 'TRANSFER' | 'CHECK'
    reference?: string
    reason: string
}) {
    try {
        return await withPrismaAuth(async (prisma) => {
            const invoice = await prisma.invoice.findUnique({
                where: { id: data.invoiceId }
            })

            if (!invoice) throw new Error("Invoice not found")
            if (invoice.type !== 'INV_OUT') throw new Error("Can only refund customer payments")

            // 1. Create Refund Record
            const refund = await prisma.payment.create({
                data: {
                    number: `REF-${Date.now()}`,
                    amount: -data.amount,
                    method: data.method,
                    invoiceId: data.invoiceId,
                    customerId: invoice.customerId,
                    date: new Date(),
                    reference: data.reference || `REF-${data.invoiceId}`,
                    notes: data.reason
                }
            })

            // 2. Update Invoice Balance
            const newBalance = Number(invoice.balanceDue) + data.amount
            await prisma.invoice.update({
                where: { id: data.invoiceId },
                data: {
                    balanceDue: newBalance,
                    status: newBalance <= 0 ? 'PAID' : 'PARTIAL'
                }
            })

            // 3. Post Journal Entry
            let creditAccount = '1101' // Cash
            if (data.method === 'TRANSFER') creditAccount = '1102' // Bank

            await postJournalEntry({
                description: `Refund to customer: ${data.reason}`,
                date: new Date(),
                reference: refund.id,
                lines: [
                    {
                        accountCode: '1200', // AR
                        debit: data.amount,
                        credit: 0
                    },
                    {
                        accountCode: creditAccount,
                        debit: 0,
                        credit: data.amount
                    }
                ]
            })

            return { success: true, refundId: refund.id }
        })
    } catch (error: any) {
        console.error("Process Refund Error:", error)
        return { success: false, error: error.message }
    }
}

// ==========================================
// PAYMENT VOUCHERS (AP)
// ==========================================

export async function createPaymentVoucher(data: {
    supplierId: string
    billIds: string[]
    amount: number
    method: 'CASH' | 'TRANSFER' | 'CHECK' | 'GIRO'
    bankAccount?: string
    dueDate?: Date
    reference?: string
    notes?: string
}) {
    try {
        return await withPrismaAuth(async (prisma) => {
            // 1. Validate Bills
            const bills = await prisma.invoice.findMany({
                where: {
                    id: { in: data.billIds },
                    type: 'INV_IN',
                    status: { in: ['ISSUED', 'PARTIAL', 'OVERDUE'] }
                },
                include: { supplier: true }
            })

            if (bills.length !== data.billIds.length) {
                throw new Error("Some bills not found or already paid")
            }

            // 2. Generate PV Number
            const count = await prisma.payment.count({ where: { type: 'VOUCHER' } })
            const year = new Date().getFullYear()
            const number = `PV-${year}-${String(count + 1).padStart(4, '0')}`

            // 3. Create Payment Voucher
            const voucher = await prisma.payment.create({
                data: {
                    number,
                    type: 'VOUCHER',
                    amount: data.amount,
                    method: data.method,
                    supplierId: data.supplierId,
                    status: data.method === 'GIRO' ? 'PENDING' : 'APPROVED',
                    date: new Date(),
                    dueDate: data.dueDate,
                    reference: data.reference,
                    bankAccount: data.bankAccount,
                    notes: data.notes,
                    voucherItems: {
                        create: bills.map(bill => ({
                            invoiceId: bill.id,
                            amount: Math.min(data.amount / bills.length, Number(bill.balanceDue))
                        }))
                    }
                }
            })

            // 4. If not GIRO, immediately apply payment
            if (data.method !== 'GIRO') {
                for (const bill of bills) {
                    const paymentAmount = Math.min(data.amount / bills.length, Number(bill.balanceDue))
                    const newBalance = Number(bill.balanceDue) - paymentAmount

                    await prisma.invoice.update({
                        where: { id: bill.id },
                        data: {
                            balanceDue: newBalance,
                            status: newBalance <= 0 ? 'PAID' : 'PARTIAL'
                        }
                    })
                }
            }

            // Post to GL
            let creditAccount = '1101'
            if (data.method === 'TRANSFER') creditAccount = '1102'

            await postJournalEntry({
                description: `Payment Voucher ${number} for ${bills.length} bills`,
                date: new Date(),
                reference: voucher.id,
                lines: [
                    {
                        accountCode: '2101', // AP
                        debit: data.amount,
                        credit: 0
                    },
                    {
                        accountCode: creditAccount,
                        debit: 0,
                        credit: data.amount
                    }
                ]
            })

            return { success: true, voucherNumber: number }
        })
    } catch (error: any) {
        console.error("Failed to create voucher:", error)
        return { success: false, error: "Failed to create payment voucher" }
    }
}

// ==========================================
// GIRO CLEARING
// ==========================================

export async function processGIROClearing(voucherId: string, isCleared: boolean, rejectionReason?: string) {
    try {
        return await withPrismaAuth(async (prisma) => {
            const voucher = await prisma.payment.findUnique({
                where: { id: voucherId },
                include: { voucherItems: { include: { invoice: true } } }
            })

            if (!voucher) throw new Error("Voucher not found")
            if (voucher.method !== 'GIRO') throw new Error("Not a GIRO payment")
            if (voucher.status !== 'PENDING') throw new Error("GIRO already processed")

            if (isCleared) {
                // GIRO Cleared - apply payments
                for (const item of voucher.voucherItems) {
                    const newBalance = Number(item.invoice.balanceDue) - Number(item.amount)
                    await prisma.invoice.update({
                        where: { id: item.invoiceId },
                        data: {
                            balanceDue: newBalance,
                            status: newBalance <= 0 ? 'PAID' : 'PARTIAL'
                        }
                    })
                }

                await prisma.payment.update({
                    where: { id: voucherId },
                    data: { status: 'CLEARED', clearedDate: new Date() }
                })

                // Post to GL
                await postJournalEntry({
                    description: `GIRO ${voucher.number} cleared`,
                    date: new Date(),
                    reference: voucher.id,
                    lines: [
                        {
                            accountCode: '2101',
                            debit: voucher.amount,
                            credit: 0
                        },
                        {
                            accountCode: '1102',
                            debit: 0,
                            credit: voucher.amount
                        }
                    ]
                })

                return { success: true, status: 'CLEARED' }
            } else {
                // GIRO Rejected
                await prisma.payment.update({
                    where: { id: voucherId },
                    data: { status: 'REJECTED', notes: rejectionReason }
                })

                return { success: true, status: 'REJECTED', reason: rejectionReason }
            }
        })
    } catch (error: any) {
        console.error("GIRO Processing Error:", error)
        return { success: false, error: error.message }
    }
}

// ==========================================
// BANK RECONCILIATION
// ==========================================

export interface BankStatementLine {
    id: string
    date: string
    description: string
    reference?: string
    debit: number
    credit: number
    isReconciled: boolean
    matchedInvoiceId?: string
    matchedPaymentId?: string
}

export async function importBankStatement(bankAccountId: string, lines: Omit<BankStatementLine, 'id' | 'isReconciled'>[]) {
    try {
        return await withPrismaAuth(async (prisma) => {
            // Create bank statement lines
            const created = await prisma.bankStatement.createMany({
                data: lines.map(line => ({
                    bankAccountId,
                    date: new Date(line.date),
                    description: line.description,
                    reference: line.reference,
                    debit: line.debit,
                    credit: line.credit,
                    isReconciled: false
                }))
            })

            return { success: true, count: created.count }
        })
    } catch (error: any) {
        console.error("Import Bank Statement Error:", error)
        return { success: false, error: error.message }
    }
}

export async function getUnreconciledBankLines(bankAccountId: string) {
    try {
        return await withPrismaAuth(async (prisma) => {
            const lines = await prisma.bankStatement.findMany({
                where: {
                    bankAccountId,
                    isReconciled: false
                },
                orderBy: { date: 'asc' }
            })

            // Get unreconciled payments for matching
            const unreconciledPayments = await prisma.payment.findMany({
                where: {
                    isReconciled: false,
                    method: { in: ['TRANSFER', 'CHECK', 'GIRO'] }
                },
                include: {
                    invoice: true,
                    customer: true,
                    supplier: true
                }
            })

            return {
                success: true,
                bankLines: lines,
                payments: unreconciledPayments
            }
        })
    } catch (error: any) {
        console.error("Get Unreconciled Lines Error:", error)
        return { success: false, error: error.message, bankLines: [], payments: [] }
    }
}

export async function reconcileBankLine(data: {
    bankLineId: string
    paymentId?: string
    invoiceId?: string
    isAutoMatched?: boolean
}) {
    try {
        return await withPrismaAuth(async (prisma) => {
            const bankLine = await prisma.bankStatement.findUnique({
                where: { id: data.bankLineId }
            })

            if (!bankLine) throw new Error("Bank statement line not found")

            // Update bank line
            await prisma.bankStatement.update({
                where: { id: data.bankLineId },
                data: {
                    isReconciled: true,
                    matchedPaymentId: data.paymentId,
                    matchedInvoiceId: data.invoiceId,
                    reconciledAt: new Date()
                }
            })

            // Update payment if matched
            if (data.paymentId) {
                await prisma.payment.update({
                    where: { id: data.paymentId },
                    data: { isReconciled: true }
                })
            }

            return { success: true }
        })
    } catch (error: any) {
        console.error("Reconcile Bank Line Error:", error)
        return { success: false, error: error.message }
    }
}

// ==========================================
// AR PAYMENT MATCHING (Penerimaan AR)
// ==========================================

export interface UnallocatedPayment {
    id: string
    number: string
    from: string
    customerId: string | null
    amount: number
    date: Date
    method: string
    reference: string | null
}

export interface OpenInvoice {
    id: string
    number: string
    customer: { id: string; name: string } | null
    amount: number
    balanceDue: number
    dueDate: Date
    isOverdue: boolean
}

type ARRegistryQueryInput = {
    paymentsQ?: string | null
    invoicesQ?: string | null
    customerId?: string | null
    paymentPage?: number | null
    invoicePage?: number | null
    pageSize?: number | null
}

export interface ARPaymentRegistryResult {
    unallocated: UnallocatedPayment[]
    openInvoices: OpenInvoice[]
    meta: {
        payments: { page: number; pageSize: number; total: number; totalPages: number }
        invoices: { page: number; pageSize: number; total: number; totalPages: number }
    }
    query: {
        paymentsQ: string | null
        invoicesQ: string | null
        customerId: string | null
    }
}

const normalizeARRegistryQuery = (input?: ARRegistryQueryInput) => {
    const normalizeText = (value?: string | null) => {
        const trimmed = (value || "").trim()
        return trimmed.length > 0 ? trimmed : null
    }
    const clamp = (value: number | null | undefined, min: number, max: number, fallback: number) => {
        const parsed = Number(value)
        if (!Number.isFinite(parsed)) return fallback
        return Math.min(max, Math.max(min, Math.trunc(parsed)))
    }

    return {
        paymentsQ: normalizeText(input?.paymentsQ),
        invoicesQ: normalizeText(input?.invoicesQ),
        customerId: normalizeText(input?.customerId),
        paymentPage: clamp(input?.paymentPage, 1, 100000, 1),
        invoicePage: clamp(input?.invoicePage, 1, 100000, 1),
        pageSize: clamp(input?.pageSize, 8, 100, 20),
    }
}

export async function getARPaymentRegistry(input?: ARRegistryQueryInput): Promise<ARPaymentRegistryResult> {
    const query = normalizeARRegistryQuery(input)

    try {
        return await withPrismaAuth(async (prisma) => {
            const paymentWhere: any = {
                invoiceId: null,
                customerId: { not: null },
            }
            const invoiceWhere: any = {
                type: 'INV_OUT',
                status: { in: ['ISSUED', 'PARTIAL', 'OVERDUE'] },
                balanceDue: { gt: 0 },
            }

            if (query.customerId) {
                paymentWhere.customerId = query.customerId
                invoiceWhere.customerId = query.customerId
            }

            if (query.paymentsQ) {
                paymentWhere.OR = [
                    { number: { contains: query.paymentsQ, mode: 'insensitive' } },
                    { reference: { contains: query.paymentsQ, mode: 'insensitive' } },
                    { customer: { name: { contains: query.paymentsQ, mode: 'insensitive' } } },
                ]
            }

            if (query.invoicesQ) {
                invoiceWhere.OR = [
                    { number: { contains: query.invoicesQ, mode: 'insensitive' } },
                    { customer: { name: { contains: query.invoicesQ, mode: 'insensitive' } } },
                ]
            }

            const [payments, invoices, paymentsTotal, invoicesTotal] = await Promise.all([
                prisma.payment.findMany({
                    where: paymentWhere,
                    include: { customer: { select: { id: true, name: true } } },
                    orderBy: { date: 'desc' },
                    skip: (query.paymentPage - 1) * query.pageSize,
                    take: query.pageSize,
                }),
                prisma.invoice.findMany({
                    where: invoiceWhere,
                    include: { customer: { select: { id: true, name: true } } },
                    orderBy: { dueDate: 'asc' },
                    skip: (query.invoicePage - 1) * query.pageSize,
                    take: query.pageSize,
                }),
                prisma.payment.count({ where: paymentWhere }),
                prisma.invoice.count({ where: invoiceWhere }),
            ])

            const now = new Date()
            return {
                unallocated: payments.map((p) => ({
                    id: p.id,
                    number: p.number,
                    from: p.customer?.name || 'Unknown Customer',
                    customerId: p.customerId,
                    amount: Number(p.amount),
                    date: p.date,
                    method: p.method,
                    reference: p.reference
                })),
                openInvoices: invoices.map((inv) => ({
                    id: inv.id,
                    number: inv.number,
                    customer: inv.customer ? { id: inv.customer.id, name: inv.customer.name } : null,
                    amount: Number(inv.totalAmount),
                    balanceDue: Number(inv.balanceDue),
                    dueDate: inv.dueDate,
                    isOverdue: inv.dueDate < now
                })),
                meta: {
                    payments: {
                        page: query.paymentPage,
                        pageSize: query.pageSize,
                        total: paymentsTotal,
                        totalPages: Math.max(1, Math.ceil(paymentsTotal / query.pageSize)),
                    },
                    invoices: {
                        page: query.invoicePage,
                        pageSize: query.pageSize,
                        total: invoicesTotal,
                        totalPages: Math.max(1, Math.ceil(invoicesTotal / query.pageSize)),
                    },
                },
                query: {
                    paymentsQ: query.paymentsQ,
                    invoicesQ: query.invoicesQ,
                    customerId: query.customerId,
                },
            }
        })
    } catch (error) {
        console.error("Failed to fetch AR payment registry:", error)
        return {
            unallocated: [],
            openInvoices: [],
            meta: {
                payments: { page: 1, pageSize: query.pageSize, total: 0, totalPages: 1 },
                invoices: { page: 1, pageSize: query.pageSize, total: 0, totalPages: 1 },
            },
            query: {
                paymentsQ: query.paymentsQ,
                invoicesQ: query.invoicesQ,
                customerId: query.customerId,
            },
        }
    }
}

/**
 * Get all unallocated (unmatched) customer payments
 * These are payments received but not yet linked to specific invoices
 */
export async function getUnallocatedPayments(): Promise<UnallocatedPayment[]> {
    try {
        return await withPrismaAuth(async (prisma) => {
            const payments = await prisma.payment.findMany({
                where: {
                    invoiceId: null,
                    customerId: { not: null }
                },
                include: {
                    customer: { select: { id: true, name: true } }
                },
                orderBy: { date: 'desc' },
                take: 50
            })

            return payments.map((p) => ({
                id: p.id,
                number: p.number,
                from: p.customer?.name || 'Unknown Customer',
                customerId: p.customerId,
                amount: Number(p.amount),
                date: p.date,
                method: p.method,
                reference: p.reference
            }))
        })
    } catch (error) {
        console.error("Failed to fetch unallocated payments:", error)
        return []
    }
}

/**
 * Get all open (unpaid/partially paid) customer invoices
 */
export async function getOpenInvoices(): Promise<OpenInvoice[]> {
    try {
        return await withPrismaAuth(async (prisma) => {
            const invoices = await prisma.invoice.findMany({
                where: {
                    type: 'INV_OUT',
                    status: { in: ['ISSUED', 'PARTIAL', 'OVERDUE'] },
                    balanceDue: { gt: 0 }
                },
                include: {
                    customer: { select: { id: true, name: true } }
                },
                orderBy: { dueDate: 'asc' },
                take: 100
            })

            const now = new Date()
            return invoices.map((inv) => ({
                id: inv.id,
                number: inv.number,
                customer: inv.customer ? { id: inv.customer.id, name: inv.customer.name } : null,
                amount: Number(inv.totalAmount),
                balanceDue: Number(inv.balanceDue),
                dueDate: inv.dueDate,
                isOverdue: inv.dueDate < now
            }))
        })
    } catch (error) {
        console.error("Failed to fetch open invoices:", error)
        return []
    }
}


/**
 * Record a new customer payment (AR receipt)
 */
export async function recordARPayment(data: {
    customerId: string
    amount: number
    date?: Date
    method?: 'CASH' | 'TRANSFER' | 'CHECK' | 'CARD'
    reference?: string
    notes?: string
    invoiceId?: string // Optional: directly link to invoice
}) {
    try {
        return await withPrismaAuth(async (prisma) => {
            // Generate payment number
            const year = new Date().getFullYear()
            const count = await prisma.payment.count({
                where: { number: { startsWith: `PAY-${year}` } }
            })
            const paymentNumber = `PAY-${year}-${String(count + 1).padStart(4, '0')}`

            const payment = await prisma.payment.create({
                data: {
                    number: paymentNumber,
                    customerId: data.customerId,
                    amount: data.amount,
                    date: data.date || new Date(),
                    method: data.method || 'TRANSFER',
                    reference: data.reference,
                    notes: data.notes,
                    invoiceId: data.invoiceId || null
                }
            })

            // If linked to invoice, update invoice balance
            if (data.invoiceId) {
                const invoice = await prisma.invoice.findUnique({
                    where: { id: data.invoiceId }
                })

                if (invoice) {
                    const newBalance = Number(invoice.balanceDue) - data.amount
                    await prisma.invoice.update({
                        where: { id: data.invoiceId },
                        data: {
                            balanceDue: newBalance,
                            status: newBalance <= 0 ? 'PAID' : 'PARTIAL'
                        }
                    })

                    // Post GL Entry: DR Cash, CR AR
                    try {
                        await postJournalEntry({
                            description: `Payment ${paymentNumber} for Invoice ${invoice.number}`,
                            date: data.date || new Date(),
                            reference: paymentNumber,
                            lines: [
                                { accountCode: '1000', debit: data.amount, credit: 0 }, // Cash
                                { accountCode: '1200', debit: 0, credit: data.amount }  // AR
                            ]
                        })
                    } catch (glError) {
                        console.error("GL posting failed (payment recorded):", glError)
                    }
                }
            }

            return { success: true, paymentId: payment.id, paymentNumber: payment.number }
        })
    } catch (error: any) {
        console.error("Failed to record AR payment:", error)
        return { success: false, error: error.message || "Failed to record payment" }
    }
}

/**
 * Match an existing unallocated payment to an invoice
 */
export async function matchPaymentToInvoice(paymentId: string, invoiceId: string) {
    try {
        return await withPrismaAuth(async (prisma) => {
            // Get payment and invoice
            const [payment, invoice] = await Promise.all([
                prisma.payment.findUnique({ where: { id: paymentId } }),
                prisma.invoice.findUnique({ where: { id: invoiceId } })
            ])

            if (!payment) throw new Error("Payment not found")
            if (!invoice) throw new Error("Invoice not found")
            if (payment.invoiceId) throw new Error("Payment already allocated")

            const paymentAmount = Number(payment.amount)
            const newBalance = Number(invoice.balanceDue) - paymentAmount

            // Update payment
            await prisma.payment.update({
                where: { id: paymentId },
                data: { invoiceId: invoice.id }
            })

            // Update invoice
            await prisma.invoice.update({
                where: { id: invoiceId },
                data: {
                    balanceDue: newBalance,
                    status: newBalance <= 0 ? 'PAID' : 'PARTIAL'
                }
            })

            // Post GL Entry: DR Cash, CR AR
            try {
                await postJournalEntry({
                    description: `Payment ${payment.number} matched to Invoice ${invoice.number}`,
                    date: payment.date,
                    reference: payment.number,
                    lines: [
                        { accountCode: '1000', debit: paymentAmount, credit: 0 }, // Cash
                        { accountCode: '1200', debit: 0, credit: paymentAmount }  // AR
                    ]
                })
            } catch (glError) {
                console.error("GL posting failed (match recorded):", glError)
            }

            return { success: true, message: `Payment matched to invoice ${invoice.number}` }
        })
    } catch (error: any) {
        console.error("Failed to match payment:", error)
        return { success: false, error: error.message || "Failed to match payment" }
    }
}

/**
 * Get AR Payment summary stats
 */
export async function getARPaymentStats() {
    try {
        const [unallocated, openInvoices] = await Promise.all([
            getUnallocatedPayments(),
            getOpenInvoices()
        ])

        // Get today's payments using Prisma
        let todayTotal = 0
        try {
            const today = new Date()
            today.setHours(0, 0, 0, 0)

            const result = await withPrismaAuth(async (prisma) => {
                const payments = await prisma.payment.findMany({
                    where: {
                        date: { gte: today },
                        customerId: { not: null }
                    },
                    select: { amount: true }
                })
                return payments.reduce((sum, p) => sum + Number(p.amount), 0)
            })
            todayTotal = result
        } catch (e) {
            console.error("Failed to get today payments:", e)
        }

        const totalUnallocated = unallocated.reduce((sum, p) => sum + p.amount, 0)
        const totalOutstanding = openInvoices.reduce((sum, inv) => sum + inv.balanceDue, 0)

        return {
            unallocatedCount: unallocated.length,
            unallocatedAmount: totalUnallocated,
            openInvoicesCount: openInvoices.length,
            outstandingAmount: totalOutstanding,
            todayPayments: todayTotal
        }
    } catch (error) {
        console.error("Failed to fetch AR stats:", error)
        return {
            unallocatedCount: 0,
            unallocatedAmount: 0,
            openInvoicesCount: 0,
            outstandingAmount: 0,
            todayPayments: 0
        }
    }
}
