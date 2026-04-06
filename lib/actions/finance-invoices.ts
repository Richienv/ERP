'use server'

import { InvoiceStatus, InvoiceType } from "@prisma/client"
import { withPrismaAuth, prisma } from "@/lib/db"
import { postJournalEntry } from "./finance-gl"
import { SYS_ACCOUNTS, ensureSystemAccounts, getCashAccountCode } from "@/lib/gl-accounts-server"
import {
    getRequiredInvoicePostingSystemAccountCodes,
    INVOICE_POSTING_ACCOUNT_DEFS,
    type RequiredSystemAccountDef,
} from "@/lib/invoice-posting-accounts"
import {
    getRequiredInvoicePaymentPostingSystemAccountCodes,
    INVOICE_PAYMENT_ACCOUNT_DEFS,
} from "@/lib/invoice-payment-posting-accounts"
import { assertPeriodOpen } from "@/lib/period-helpers"
import { getPPhLiabilityAccount, type PPhTypeValue } from "@/lib/pph-helpers"
import { legacyTermToDays, calculateDueDate } from "@/lib/payment-term-helpers"
import { getExchangeRate, convertToIDR } from "@/lib/currency-helpers"
import { TAX_RATES } from "@/lib/tax-rates"
import { toNum } from "@/lib/utils"

export interface InvoiceKanbanItem {
    id: string
    number: string
    partyName: string
    amount: number
    balanceDue: number
    cnReduction?: number
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
async function ensureInvoicePostingAccounts(input: {
    type: InvoiceType
    taxAmount: number
    goodsReceivedViaPO: boolean
}) {
    const requiredCodes = getRequiredInvoicePostingSystemAccountCodes(input)
    const existingAccounts = await prisma.gLAccount.findMany({
        where: { code: { in: requiredCodes } },
        select: { code: true },
    })

    const existingCodes = new Set(existingAccounts.map((account) => account.code))
    const missingDefs = requiredCodes
        .filter((code) => !existingCodes.has(code))
        .map((code) => INVOICE_POSTING_ACCOUNT_DEFS[code])
        .filter((def): def is RequiredSystemAccountDef => Boolean(def))

    if (missingDefs.length === 0) return

    await prisma.gLAccount.createMany({
        data: missingDefs.map((def) => ({
            code: def.code,
            name: def.name,
            type: def.type,
            balance: 0,
        })),
        skipDuplicates: true,
    })
}

async function ensureInvoicePaymentPostingAccounts(
    prismaClient: {
        gLAccount: {
            findMany: (args: {
                where: { code: { in: string[] } }
                select: { code: true }
            }) => Promise<Array<{ code: string }>>
            createMany: (args: {
                data: Array<{ code: string; name: string; type: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE"; balance: number }>
                skipDuplicates: boolean
            }) => Promise<unknown>
        }
    },
    input: {
        type: InvoiceType
        paymentMethod: 'CASH' | 'TRANSFER' | 'CHECK' | 'GIRO' | 'CREDIT_CARD' | 'OTHER'
        withholdingType?: PPhTypeValue
        withholdingAmount?: number
    }
) {
    const requiredCodes = getRequiredInvoicePaymentPostingSystemAccountCodes(input)
    const existingAccounts = await prismaClient.gLAccount.findMany({
        where: { code: { in: requiredCodes } },
        select: { code: true },
    })

    const existingCodes = new Set(existingAccounts.map((account) => account.code))
    const missingDefs = requiredCodes
        .filter((code) => !existingCodes.has(code))
        .map((code) => INVOICE_PAYMENT_ACCOUNT_DEFS[code])
        .filter((def): def is RequiredSystemAccountDef => Boolean(def))

    if (missingDefs.length === 0) return

    await prismaClient.gLAccount.createMany({
        data: missingDefs.map((def) => ({
            code: def.code,
            name: def.name,
            type: def.type,
            balance: 0,
        })),
        skipDuplicates: true,
    })
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
                dcNoteSettlements: {
                    select: { amount: true },
                    where: {
                        note: { status: { notIn: ['VOID', 'CANCELLED'] } }
                    }
                },
            },
            orderBy: { issueDate: 'desc' },
            take: normalizedLimit,
        })

        const now = new Date()
        const data: InvoiceKanbanData = { draft: [], sent: [], overdue: [], paid: [] }

        for (const inv of invoices) {
            const partyName = inv.customer?.name || inv.supplier?.name || 'Unknown'
            const amount = toNum(inv.totalAmount)
            const dueDate = inv.dueDate
            const issueDate = inv.issueDate

            const balanceDue = toNum(inv.balanceDue) || amount
            const cnReduction = (inv.dcNoteSettlements || []).reduce(
                (sum: number, s: any) => sum + Number(s.amount), 0
            )

            const base: InvoiceKanbanItem = {
                id: inv.id,
                number: inv.number,
                partyName,
                amount,
                balanceDue,
                cnReduction,
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

            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
            const isOverdue = inv.status === 'OVERDUE' || dueDate < todayStart
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
// CREDIT LIMIT CHECK
// ==========================================

/**
 * Check if creating/issuing an invoice would exceed the customer's credit limit.
 * Returns { ok: true } if within limit, or { ok: false, message: string } if exceeded.
 * Skips check for suppliers (INV_IN) and customers with creditLimit = 0 (unlimited).
 */
async function checkCreditLimit(
    prismaClient: typeof prisma,
    customerId: string,
    newInvoiceAmount: number,
    excludeInvoiceId?: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
    const customer = await prismaClient.customer.findUnique({
        where: { id: customerId },
        select: { name: true, creditLimit: true, creditStatus: true },
    })
    if (!customer) return { ok: true } // Not a customer (maybe supplier) — skip

    const creditLimit = Number(customer.creditLimit)
    if (creditLimit <= 0) return { ok: true } // No limit set — unlimited

    // Block if customer credit status is HOLD or BLOCKED
    if (customer.creditStatus === 'HOLD' || customer.creditStatus === 'BLOCKED') {
        return {
            ok: false,
            message: `Customer "${customer.name}" berstatus ${customer.creditStatus === 'HOLD' ? 'DITAHAN' : 'DIBLOKIR'}. Tidak dapat membuat invoice baru.`,
        }
    }

    // Sum all outstanding AR invoices (ISSUED, PARTIAL, OVERDUE)
    const outstandingResult = await prismaClient.invoice.aggregate({
        where: {
            customerId,
            type: 'INV_OUT',
            status: { in: ['ISSUED', 'PARTIAL', 'OVERDUE'] },
            ...(excludeInvoiceId ? { id: { not: excludeInvoiceId } } : {}),
        },
        _sum: { balanceDue: true },
    })
    const outstanding = Number(outstandingResult._sum.balanceDue || 0)

    if (outstanding + newInvoiceAmount > creditLimit) {
        const fmt = (n: number) => `Rp ${n.toLocaleString('id-ID')}`
        return {
            ok: false,
            message: `Melebihi limit kredit "${customer.name}". Outstanding: ${fmt(outstanding)}, Invoice baru: ${fmt(newInvoiceAmount)}, Total: ${fmt(outstanding + newInvoiceAmount)}, Limit: ${fmt(creditLimit)}`,
        }
    }

    return { ok: true }
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
    accountId?: string // User-selected GL account UUID (looked up → glAccountCode on invoice)
}) {
    try {
        // Server-side validation: COA account is mandatory for manual invoices
        if (!data.accountId) {
            return { success: false, error: "Pilih akun pendapatan/beban (COA) terlebih dahulu" }
        }

        // Fiscal period check
        const issueDate = data.issueDate || new Date()
        await assertPeriodOpen(issueDate)

        // Due date must not be before issue date
        if (data.dueDate && data.dueDate < issueDate) {
            return { success: false, error: "Jatuh tempo tidak boleh sebelum tanggal terbit" }
        }

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

            // Look up GL account code from accountId (user-selected COA)
            let glAccountCode: string | null = null
            if (data.accountId) {
                const glAccount = await prisma.gLAccount.findUnique({
                    where: { id: data.accountId },
                    select: { code: true },
                })
                if (glAccount) glAccountCode = glAccount.code
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
            const subtotal = invoiceItems.reduce((sum, item) => sum + toNum(item.amount), 0)
            const taxAmount = data.includeTax ? Math.round(subtotal * TAX_RATES.PPN) : 0
            const totalAmount = subtotal + taxAmount

            // Credit limit check — uses totalAmount (including PPN) consistently
            if (invoiceType === 'INV_OUT') {
                const creditCheck = await checkCreditLimit(prisma, data.customerId, totalAmount)
                if (!creditCheck.ok) {
                    return { success: false, error: creditCheck.message }
                }
            }

            // Create invoice — use relation connect (Prisma 6 rejects scalar FK mixed with nested creates)
            const invoice = await prisma.invoice.create({
                data: {
                    number: invoiceNumber,
                    type: invoiceType,
                    ...(invoiceType === 'INV_OUT' ? { customer: { connect: { id: data.customerId } } } : {}),
                    ...(invoiceType === 'INV_IN' ? { supplier: { connect: { id: data.customerId } } } : {}),
                    issueDate: issueDate,
                    dueDate: dueDate,
                    subtotal: subtotal,
                    taxAmount: taxAmount,
                    totalAmount: totalAmount,
                    balanceDue: totalAmount,
                    glAccountCode,
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
        // Due date validation
        if (data.dueDate && data.issueDate && data.dueDate < data.issueDate) {
            return { success: false, error: "Jatuh tempo tidak boleh sebelum tanggal terbit" }
        }

        // Fiscal period check if issue date is changing
        if (data.issueDate) await assertPeriodOpen(data.issueDate)

        return await withPrismaAuth(async (prisma) => {
            const invoice = await prisma.invoice.findUnique({
                where: { id: data.invoiceId },
                select: { id: true, status: true, type: true, issueDate: true }
            })
            if (!invoice) return { success: false, error: "Invoice tidak ditemukan" }
            if (invoice.status !== 'DRAFT') return { success: false, error: "Hanya invoice DRAFT yang bisa diedit" }

            // Also check due date against existing issue date if only due date is changing
            if (data.dueDate && !data.issueDate && invoice.issueDate && data.dueDate < invoice.issueDate) {
                return { success: false, error: "Jatuh tempo tidak boleh sebelum tanggal terbit" }
            }

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

                const subtotal = invoiceItems.reduce((sum, item) => sum + toNum(item.amount), 0)
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
                    journalEntries: {
                        where: { status: 'POSTED' },
                        include: {
                            lines: {
                                include: { account: { select: { code: true, name: true } } },
                            },
                        },
                        orderBy: { date: 'asc' },
                    },
                    // CN/DN settlements applied to this invoice
                    dcNoteSettlements: {
                        include: {
                            note: {
                                select: {
                                    id: true,
                                    number: true,
                                    type: true,
                                    status: true,
                                    totalAmount: true,
                                    issueDate: true,
                                    description: true,
                                },
                            },
                        },
                    },
                }
            })
            if (!invoice) return { success: false, error: "Invoice tidak ditemukan" }
            // Convert Prisma Decimal fields to plain numbers for client serialization
            return {
                success: true,
                data: {
                    ...invoice,
                    subtotal: toNum(invoice.subtotal),
                    taxAmount: toNum(invoice.taxAmount),
                    discountAmount: toNum(invoice.discountAmount),
                    totalAmount: toNum(invoice.totalAmount),
                    balanceDue: toNum(invoice.balanceDue),
                    exchangeRate: toNum(invoice.exchangeRate) || 1,
                    amountInIDR: toNum(invoice.amountInIDR),
                    items: invoice.items.map((item: any) => ({
                        ...item,
                        quantity: toNum(item.quantity),
                        unitPrice: toNum(item.unitPrice),
                        discount: toNum(item.discount),
                        taxRate: toNum(item.taxRate),
                        taxAmount: toNum(item.taxAmount),
                        lineTotal: toNum(item.lineTotal),
                    })),
                    payments: invoice.payments.map((p: any) => ({
                        ...p,
                        amount: toNum(p.amount),
                    })),
                    journalEntries: (invoice.journalEntries || []).map((je: any) => ({
                        id: je.id,
                        date: je.date,
                        description: je.description,
                        reference: je.reference,
                        lines: (je.lines || []).map((line: any) => ({
                            accountCode: line.account?.code || '',
                            accountName: line.account?.name || '',
                            debit: toNum(line.debit),
                            credit: toNum(line.credit),
                        })),
                    })),
                    // CN/DN settlements applied to this invoice
                    dcNoteSettlements: (invoice.dcNoteSettlements || []).map((s: any) => ({
                        id: s.id,
                        amount: toNum(s.amount),
                        noteId: s.note?.id || null,
                        noteNumber: s.note?.number || null,
                        noteType: s.note?.type || null,
                        noteStatus: s.note?.status || null,
                        noteTotalAmount: s.note ? toNum(s.note.totalAmount) : 0,
                        noteIssueDate: s.note?.issueDate || null,
                        noteDescription: s.note?.description || null,
                    })),
                },
            }
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
                        debit: toNum(l.debit),
                        credit: toNum(l.credit),
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
        // Fiscal period check
        await assertPeriodOpen(new Date())

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

            // Create new Bill (Invoice Type IN) — relation connect for Prisma 6
            const bill = await prisma.invoice.create({
                data: {
                    number: billNumber,
                    type: 'INV_IN',
                    ...(po.supplierId ? { supplier: { connect: { id: po.supplierId } } } : {}),
                    purchaseOrder: { connect: { id: po.id } },
                    status: 'DRAFT',
                    issueDate: new Date(),
                    dueDate: new Date(new Date().setDate(new Date().getDate() + 30)),
                    subtotal: toNum(po.totalAmount),     // pre-tax subtotal
                    taxAmount: toNum(po.taxAmount),
                    totalAmount: toNum(po.netAmount),    // grand total (subtotal + tax)
                    balanceDue: toNum(po.netAmount),     // what's actually owed
                    items: {
                        create: po.items.map((item: any) => ({
                            description: item.product?.name || 'Unknown Item',
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            amount: item.totalPrice,
                            ...(item.productId ? { product: { connect: { id: item.productId } } } : {}),
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
        // Fiscal period check — invoice created with today's date
        await assertPeriodOpen(new Date())

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

            // Credit limit check — uses salesOrder.total (PPN-inclusive grand total)
            const creditCheck = await checkCreditLimit(prisma, salesOrder.customerId, Number(salesOrder.total))
            if (!creditCheck.ok) {
                return { success: false as const, error: creditCheck.message }
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
            const paymentTermDays = legacyTermToDays(salesOrder.paymentTerm)
            const dueDate = calculateDueDate(new Date(), paymentTermDays)

            // Create Customer Invoice (Invoice Type OUT) — relation connect for Prisma 6
            const invoice = await prisma.invoice.create({
                data: {
                    number: invoiceNumber,
                    type: 'INV_OUT',
                    ...(salesOrder.customerId ? { customer: { connect: { id: salesOrder.customerId } } } : {}),
                    salesOrder: { connect: { id: salesOrder.id } },
                    status: 'DRAFT',
                    issueDate: new Date(),
                    dueDate: dueDate,
                    subtotal: salesOrder.subtotal,
                    taxAmount: salesOrder.taxAmount,
                    discountAmount: salesOrder.discountAmount || 0,
                    totalAmount: salesOrder.total,
                    balanceDue: salesOrder.total,
                    currencyCode: salesOrder.currencyCode || "IDR",
                    exchangeRate: salesOrder.exchangeRate || 1,
                    amountInIDR: 0, // computed at posting time (moveInvoiceToSent)
                    items: {
                        create: salesOrder.items.map((item) => ({
                            description: item.product?.name || item.description || 'Unknown Item',
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            amount: item.lineTotal,
                            ...(item.productId ? { product: { connect: { id: item.productId } } } : {}),
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
            amount: toNum(o.total),
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
            amount: toNum(o.totalAmount),
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

export async function moveInvoiceToSent(invoiceId: string, _message?: string, _method?: 'WHATSAPP' | 'EMAIL') {
    try {
        // Period lock: fail fast before mutation
        await assertPeriodOpen(new Date())

        // Credit limit soft-check at send time (non-blocking).
        // The hard block is enforced at invoice CREATE — this is a safety-net warning
        // for legacy invoices that may have been created before the create-time check existed.
        const preCheck = await prisma.invoice.findUnique({
            where: { id: invoiceId },
            select: { type: true, customerId: true, totalAmount: true, id: true },
        })
        if (preCheck?.type === 'INV_OUT' && preCheck.customerId) {
            const creditCheck = await checkCreditLimit(prisma, preCheck.customerId, toNum(preCheck.totalAmount), preCheck.id)
            if (!creditCheck.ok) {
                console.warn('[moveInvoiceToSent] Credit limit exceeded at send time (non-blocking):', creditCheck.message)
            }
        }

        const txResult = await withPrismaAuth(async (prisma) => {
            const now = new Date()
            const existing = await prisma.invoice.findUnique({
                where: { id: invoiceId },
                select: {
                    id: true, number: true, dueDate: true,
                    totalAmount: true, subtotal: true, taxAmount: true,
                    type: true, status: true, currencyCode: true,
                    purchaseOrderId: true, glAccountCode: true,
                    customer: { select: { name: true } },
                    supplier: { select: { name: true } },
                }
            })

            if (!existing) throw new Error("Invoice not found")
            if (existing.status !== 'DRAFT') throw new Error(`Invoice ${existing.number} sudah berstatus ${existing.status}. Refresh halaman untuk melihat status terbaru.`)

            const fallbackDueDate = new Date(now)
            fallbackDueDate.setDate(fallbackDueDate.getDate() + 30)
            const dueDate = existing.dueDate || fallbackDueDate
            const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
            const nextStatus = dueDate < todayMidnight ? 'OVERDUE' : 'ISSUED'

            await prisma.invoice.update({
                where: { id: invoiceId },
                data: {
                    status: nextStatus,
                    issueDate: now,
                    dueDate,
                }
            })

            // For PO-linked bills, check if goods were received via GRN (for GR/IR clearing)
            let goodsReceivedViaPO = false
            if (existing.type === 'INV_IN' && existing.purchaseOrderId) {
                const grnCount = await prisma.goodsReceivedNote.count({
                    where: {
                        purchaseOrderId: existing.purchaseOrderId,
                        status: 'ACCEPTED',
                    }
                })
                goodsReceivedViaPO = grnCount > 0
            }

            return {
                number: existing.number,
                type: existing.type,
                totalAmount: toNum(existing.totalAmount),
                subtotal: toNum(existing.subtotal) || toNum(existing.totalAmount),
                taxAmount: toNum(existing.taxAmount),
                currencyCode: existing.currencyCode || "IDR",
                customerName: existing.customer?.name,
                supplierName: existing.supplier?.name,
                purchaseOrderId: existing.purchaseOrderId,
                glAccountCode: existing.glAccountCode,
                goodsReceivedViaPO,
                nextStatus,
                dueDate,
                issueDate: now,
            }
        })

        // Multi-currency: convert to IDR if foreign currency
        const currencyCode = txResult.currencyCode || "IDR"
        let amountInIDR = txResult.totalAmount
        let taxInIDR = txResult.taxAmount
        let subtotalInIDR = txResult.subtotal

        if (currencyCode !== "IDR") {
            try {
                const rate = await getExchangeRate(currencyCode, txResult.issueDate)
                amountInIDR = convertToIDR(txResult.totalAmount, rate)
                taxInIDR = convertToIDR(txResult.taxAmount, rate)
                subtotalInIDR = convertToIDR(txResult.subtotal, rate)

                // Store the rate and IDR amount on the invoice
                await prisma.invoice.update({
                    where: { id: invoiceId },
                    data: { exchangeRate: rate, amountInIDR }
                })
            } catch (error: any) {
                // Revert invoice to DRAFT if rate not available
                await prisma.invoice.update({
                    where: { id: invoiceId },
                    data: { status: 'DRAFT', issueDate: null }
                }).catch(() => {})
                return { success: false, error: error.message }
            }
        } else {
            // IDR: amountInIDR = totalAmount
            await prisma.invoice.update({
                where: { id: invoiceId },
                data: { amountInIDR: txResult.totalAmount }
            }).catch(() => {})
        }

        // Post GL entry for AR/AP recognition (outside withPrismaAuth to avoid nested transaction)
        // Idempotency: check if journal entry already exists for this invoice
        try {
            try {
                await ensureInvoicePostingAccounts({
                    type: txResult.type,
                    taxAmount: txResult.taxAmount,
                    goodsReceivedViaPO: txResult.goodsReceivedViaPO,
                })
            } catch (accountEnsureError) {
                console.warn("[moveInvoiceToSent] Fast invoice account ensure failed, falling back to full ensureSystemAccounts()", accountEnsureError)
                await ensureSystemAccounts()
            }
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
                // GL always in IDR — use converted amounts for foreign currency invoices
                const glCurrencyNote = currencyCode !== "IDR" ? ` [${currencyCode}→IDR]` : ""
                let glResult: any

                if (txResult.type === 'INV_OUT') {
                    // AR Invoice: DR Piutang Usaha, CR Pendapatan + CR PPN Keluaran
                    // Use user-selected revenue account (glAccountCode) if set, else default 4000
                    const revenueAccount = txResult.glAccountCode || SYS_ACCOUNTS.REVENUE
                    const lines: { accountCode: string; debit: number; credit: number; description: string }[] = [
                        { accountCode: SYS_ACCOUNTS.AR, debit: amountInIDR, credit: 0, description: `Piutang - ${txResult.customerName || 'Customer'}${glCurrencyNote}` },
                    ]
                    if (taxInIDR > 0) {
                        lines.push({ accountCode: revenueAccount, debit: 0, credit: subtotalInIDR, description: `Pendapatan - ${txResult.number}${glCurrencyNote}` })
                        lines.push({ accountCode: SYS_ACCOUNTS.PPN_KELUARAN, debit: 0, credit: taxInIDR, description: `PPN Keluaran - ${txResult.number}${glCurrencyNote}` })
                    } else {
                        lines.push({ accountCode: revenueAccount, debit: 0, credit: amountInIDR, description: `Pendapatan - ${txResult.number}${glCurrencyNote}` })
                    }
                    glResult = await postJournalEntry({
                        description: `Faktur Penjualan ${txResult.number} - ${txResult.customerName || 'Customer'}${glCurrencyNote}`,
                        date: txResult.issueDate,
                        reference: txResult.number,
                        invoiceId: invoiceId,
                        lines,
                    })
                } else {
                    // AP Bill: DR [expense account] + DR PPN Masukan, CR Hutang Usaha (AP)
                    // For PO-linked bills with received goods: DR GR/IR Clearing (2150) instead of Expense
                    //   → This clears the GR/IR suspense created when GRN was accepted (DR Inventory, CR GR/IR)
                    //   → Net effect: GR/IR Clearing balance returns to zero after both GRN + bill
                    // For non-PO bills (direct expense purchase): use user-selected expense account or default 6900
                    const debitAccount = txResult.goodsReceivedViaPO
                        ? SYS_ACCOUNTS.GR_IR_CLEARING
                        : (txResult.glAccountCode || SYS_ACCOUNTS.EXPENSE_DEFAULT)
                    const debitLabel = txResult.goodsReceivedViaPO
                        ? `GR/IR Clearing - ${txResult.number}`
                        : `Beban - ${txResult.number}`

                    const lines: { accountCode: string; debit: number; credit: number; description: string }[] = []
                    if (taxInIDR > 0) {
                        lines.push({ accountCode: debitAccount, debit: subtotalInIDR, credit: 0, description: `${debitLabel}${glCurrencyNote}` })
                        lines.push({ accountCode: SYS_ACCOUNTS.PPN_MASUKAN, debit: taxInIDR, credit: 0, description: `PPN Masukan - ${txResult.number}${glCurrencyNote}` })
                    } else {
                        lines.push({ accountCode: debitAccount, debit: amountInIDR, credit: 0, description: `${debitLabel}${glCurrencyNote}` })
                    }
                    lines.push({ accountCode: SYS_ACCOUNTS.AP, debit: 0, credit: amountInIDR, description: `Hutang - ${txResult.supplierName || 'Supplier'}${glCurrencyNote}` })
                    glResult = await postJournalEntry({
                        description: `Tagihan Pembelian ${txResult.number} - ${txResult.supplierName || 'Supplier'}`,
                        date: txResult.issueDate,
                        reference: txResult.number,
                        invoiceId: invoiceId,
                        lines,
                    })
                }

                // CRITICAL: Check GL result — if posting failed, throw to trigger revert
                if (!glResult?.success) {
                    throw new Error(`GL posting failed: ${glResult?.error || 'Unknown error'}`)
                }
            }

            // --- COGS Recognition for Sales Invoices with Stock Items ---
            // BLOCKING: If COGS posting fails, the outer catch reverts invoice to DRAFT.
            // Revenue and COGS must always be recognized together, or not at all.
            if (txResult.type === 'INV_OUT') {
                const invoiceItems = await prisma.invoiceItem.findMany({
                    where: { invoiceId },
                    select: {
                        quantity: true,
                        product: {
                            select: {
                                id: true,
                                name: true,
                                costPrice: true,
                                productType: true,
                                cogsAccountId: true,
                                inventoryAccountId: true,
                                cogsAccount: { select: { code: true } },
                                inventoryAccount: { select: { code: true } },
                            }
                        }
                    }
                })

                const cogsLines: { accountCode: string; debit: number; credit: number; description: string }[] = []
                for (const item of invoiceItems) {
                    if (!item.product) continue // service/text line — skip
                    const cost = Number(item.product.costPrice || 0)
                    if (cost <= 0) continue // no cost — skip (services, zero-cost items)
                    const qty = Number(item.quantity || 0)
                    if (qty <= 0) continue
                    const cogsAmount = qty * cost

                    const cogsCode = item.product.cogsAccount?.code || SYS_ACCOUNTS.COGS
                    const invCode = item.product.inventoryAccount?.code || SYS_ACCOUNTS.INVENTORY_ASSET

                    cogsLines.push({
                        accountCode: cogsCode,
                        debit: cogsAmount,
                        credit: 0,
                        description: `HPP - ${item.product.name} (${qty} x ${cost})`,
                    })
                    cogsLines.push({
                        accountCode: invCode,
                        debit: 0,
                        credit: cogsAmount,
                        description: `Persediaan keluar - ${item.product.name}`,
                    })
                }

                if (cogsLines.length > 0) {
                    const cogsResult = await postJournalEntry({
                        description: `HPP Penjualan ${txResult.number} - ${txResult.customerName || 'Customer'}`,
                        date: txResult.issueDate,
                        reference: `COGS-${txResult.number}`,
                        invoiceId: invoiceId,
                        sourceDocumentType: 'COGS_RECOGNITION',
                        lines: cogsLines,
                    })
                    if (!cogsResult?.success) {
                        throw new Error(`COGS posting gagal: ${cogsResult?.error || 'Unknown error'}`)
                    }
                }
            }
        } catch (glError: any) {
            console.error("GL posting failed:", glError)
            // Revert invoice to DRAFT so user knows GL posting failed
            try {
                await prisma.invoice.update({
                    where: { id: invoiceId },
                    data: { status: 'DRAFT' },
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
    paymentMethod: 'CASH' | 'TRANSFER' | 'CHECK' | 'GIRO' | 'CREDIT_CARD' | 'OTHER'
    amount: number
    paymentDate: Date
    reference?: string
    notes?: string
    withholding?: {
        type: PPhTypeValue
        rate: number
        baseAmount: number
        buktiPotongNo?: string
    }
}) {
    try {
        const paymentDate = new Date(data.paymentDate)
        if (Number.isNaN(paymentDate.getTime())) {
            throw new Error("Tanggal pembayaran tidak valid")
        }
        if (!data.amount || Number(data.amount) <= 0) {
            throw new Error("Jumlah pembayaran harus lebih dari 0")
        }
        if (data.paymentMethod === 'CHECK' && !data.reference?.trim()) {
            throw new Error("Nomor cek / referensi wajib diisi untuk metode CHECK")
        }

        // Period lock: fail fast before mutation
        await assertPeriodOpen(paymentDate)

        // Calculate PPh withholding amount (if any)
        const pphAmount = data.withholding
            ? Math.round((data.withholding.rate / 100) * data.withholding.baseAmount)
            : 0

        return await withPrismaAuth(async (prisma) => {
            const invoice = await prisma.invoice.findUnique({
                where: { id: data.invoiceId },
                include: { customer: true, supplier: true }
            })

            if (!invoice) throw new Error("Invoice not found")
            if (invoice.status === 'DRAFT') {
                throw new Error("Invoice draft belum bisa dicatat pembayarannya")
            }

            const currentBalance = toNum(invoice.balanceDue)
            if (data.amount > currentBalance + 0.01) {
                throw new Error("Jumlah pembayaran tidak boleh melebihi sisa tagihan")
            }

            await ensureInvoicePaymentPostingAccounts(prisma, {
                type: invoice.type,
                paymentMethod: data.paymentMethod,
                withholdingType: data.withholding?.type,
                withholdingAmount: pphAmount,
            })

            const year = paymentDate.getFullYear()
            const prefix = invoice.type === 'INV_OUT' ? 'PAY' : 'VPAY'
            const count = await prisma.payment.count({
                where: { number: { startsWith: `${prefix}-${year}` } }
            })
            const paymentNumber = `${prefix}-${year}-${String(count + 1).padStart(4, '0')}`

            const payment = await prisma.payment.create({
                data: {
                    number: paymentNumber,
                    date: paymentDate,
                    amount: data.amount,
                    method: data.paymentMethod === 'CREDIT_CARD' || data.paymentMethod === 'OTHER' ? 'TRANSFER' : data.paymentMethod,
                    reference: data.reference,
                    notes: data.notes,
                    invoiceId: invoice.id,
                    customerId: invoice.customerId,
                    supplierId: invoice.supplierId,
                    glPostingStatus: 'PENDING',
                    whtAmount: pphAmount > 0 ? pphAmount : null,
                    whtRate: data.withholding ? data.withholding.rate / 100 : null,
                }
            })

            // For INV_OUT with withholding: total settled = cash received + PPh withheld by customer
            const settledAmount = invoice.type === 'INV_OUT'
                ? data.amount + pphAmount
                : data.amount
            const rawNewBalance = currentBalance - settledAmount
            const newBalance = Math.max(0, rawNewBalance)
            const newStatus = rawNewBalance <= 0.01 ? 'PAID' : 'PARTIAL'

            await prisma.invoice.update({
                where: { id: invoice.id },
                data: { status: newStatus, balanceDue: newBalance }
            })

            const cashAccountCode = getCashAccountCode(data.paymentMethod)
            let glResult: any

            if (invoice.type === 'INV_OUT') {
                // AR Payment: DR Kas/Bank, DR PPh Dibayar Dimuka (if withheld), CR Piutang Usaha
                const totalSettled = data.amount + pphAmount
                const arLines: { accountCode: string; debit: number; credit: number; description?: string }[] = [
                    { accountCode: cashAccountCode, debit: data.amount, credit: 0, description: `Terima dari ${invoice.customer?.name || 'Customer'}` },
                    { accountCode: SYS_ACCOUNTS.AR, debit: 0, credit: totalSettled, description: `Pelunasan ${invoice.number}` },
                ]

                if (data.withholding && pphAmount > 0) {
                    arLines.push({
                        accountCode: SYS_ACCOUNTS.PPH_PREPAID,
                        debit: pphAmount,
                        credit: 0,
                        description: `PPh Dibayar Dimuka - ${invoice.number}`,
                    })
                }

                glResult = await postJournalEntry({
                    description: `Penerimaan Pembayaran ${invoice.number} - ${invoice.customer?.name || 'Customer'}`,
                    date: paymentDate,
                    reference: `${payment.number} — ${invoice.number}`,
                    invoiceId: data.invoiceId,
                    paymentId: payment.id,
                    lines: arLines,
                }, prisma)
            } else {
                // AP Payment: DR Hutang Usaha, CR Kas/Bank, CR Utang PPh (if withheld)
                const apLines: { accountCode: string; debit: number; credit: number; description?: string }[] = [
                    { accountCode: SYS_ACCOUNTS.AP, debit: data.amount, credit: 0, description: `Pelunasan ${invoice.supplier?.name || 'Supplier'}` },
                ]

                if (data.withholding && pphAmount > 0) {
                    apLines.push(
                        { accountCode: cashAccountCode, debit: 0, credit: data.amount - pphAmount, description: `Bayar ${invoice.number}` },
                        { accountCode: getPPhLiabilityAccount(data.withholding.type), debit: 0, credit: pphAmount, description: `Utang PPh - ${invoice.number}` },
                    )
                } else {
                    apLines.push(
                        { accountCode: cashAccountCode, debit: 0, credit: data.amount, description: `Bayar ${invoice.number}` },
                    )
                }

                glResult = await postJournalEntry({
                    description: `Pembayaran Tagihan ${invoice.number} - ${invoice.supplier?.name || 'Supplier'}`,
                    date: paymentDate,
                    reference: `${payment.number} — ${invoice.number}`,
                    invoiceId: data.invoiceId,
                    paymentId: payment.id,
                    lines: apLines,
                }, prisma)
            }

            if (!glResult?.success) {
                throw new Error(`Jurnal gagal — pembayaran dibatalkan: ${glResult?.error || 'Unknown GL error'}`)
            }

            // Create WithholdingTax record if applicable
            if (data.withholding && pphAmount > 0) {
                await prisma.withholdingTax.create({
                    data: {
                        paymentId: payment.id,
                        invoiceId: invoice.id,
                        type: data.withholding.type,
                        direction: invoice.type === 'INV_OUT' ? 'IN' : 'OUT',
                        rate: data.withholding.rate,
                        baseAmount: data.withholding.baseAmount,
                        amount: pphAmount,
                        buktiPotongNo: data.withholding.buktiPotongNo || null,
                        buktiPotongDate: data.withholding.buktiPotongNo ? new Date() : null,
                    },
                })
            }

            await prisma.payment.update({
                where: { id: payment.id },
                data: { glPostingStatus: 'POSTED' },
            })

            return { success: true, paymentId: payment.id, paymentNumber: payment.number }
        })
    } catch (error: any) {
        console.error("Failed to record payment:", error)
        return { success: false, error: error?.message || "Failed to record payment" }
    }
}

// ==========================================
// PURCHASE REQUEST INTEGRATION
// ==========================================

/**
 * Create a Bill (INV_IN) from a Purchase Request ID.
 * Uses product.costPrice as the unit price since PR items don't have prices.
 * Finds preferred supplier via SupplierProduct or leaves supplierId null.
 */
export async function createBillFromPR(
    prId: string,
    options?: { forceCreate?: boolean; includeTax?: boolean }
) {
    try {
        // Fiscal period check
        await assertPeriodOpen(new Date())

        return await withPrismaAuth(async (prisma) => {
            // Fetch PR with items and product details
            const pr = await prisma.purchaseRequest.findUnique({
                where: { id: prId },
                include: {
                    items: {
                        include: {
                            product: {
                                select: {
                                    id: true,
                                    name: true,
                                    costPrice: true,
                                    unit: true,
                                }
                            }
                        }
                    },
                    requester: { select: { firstName: true, lastName: true } },
                }
            })

            if (!pr) {
                return { success: false, error: "Purchase Request tidak ditemukan" }
            }

            if (!pr.items || pr.items.length === 0) {
                return { success: false, error: "Purchase Request tidak memiliki item" }
            }

            // Check for existing invoice linked to this PR (prevent duplicates)
            const existingBill = await prisma.invoice.findFirst({
                where: {
                    purchaseRequestId: pr.id,
                    type: 'INV_IN',
                    status: { notIn: ['CANCELLED', 'VOID'] }
                },
                orderBy: { createdAt: 'desc' }
            })

            if (existingBill && !options?.forceCreate) {
                return {
                    success: false,
                    code: 'INVOICE_ALREADY_EXISTS' as const,
                    requiresConfirmation: true,
                    existingInvoiceId: existingBill.id,
                    existingInvoiceNumber: existingBill.number,
                    existingInvoiceStatus: existingBill.status,
                    error: `Bill ${existingBill.number} sudah ada untuk PR ini`
                }
            }

            // Try to find a preferred supplier from SupplierProduct for the first item
            let supplierId: string | null = null
            const productIds = pr.items.map(i => i.productId)
            const preferredSupplier = await prisma.supplierProduct.findFirst({
                where: {
                    productId: { in: productIds },
                    isPreferred: true,
                },
                select: { supplierId: true }
            })
            if (preferredSupplier) {
                supplierId = preferredSupplier.supplierId
            } else {
                // Fallback: any supplier linked to these products
                const anySupplier = await prisma.supplierProduct.findFirst({
                    where: { productId: { in: productIds } },
                    select: { supplierId: true }
                })
                if (anySupplier) {
                    supplierId = anySupplier.supplierId
                }
            }

            // Generate bill number: BILL-{year}-{sequence}
            const year = new Date().getFullYear()
            const count = await prisma.invoice.count({
                where: {
                    type: 'INV_IN',
                    number: { startsWith: `BILL-${year}` }
                }
            })
            const billNumber = `BILL-${year}-${String(count + 1).padStart(4, '0')}`

            // Calculate totals from PR items using product.costPrice
            const invoiceItems = pr.items.map(item => {
                const unitPrice = Number(item.product.costPrice) || 0
                const quantity = item.quantity
                const amount = quantity * unitPrice
                return {
                    description: item.product.name || 'Unknown Item',
                    quantity,
                    unitPrice,
                    amount,
                    productId: item.productId,
                }
            })

            const subtotal = invoiceItems.reduce((sum, item) => sum + item.amount, 0)
            const includeTax = options?.includeTax ?? false
            const taxAmount = includeTax ? Math.round(subtotal * 0.11) : 0
            const totalAmount = subtotal + taxAmount

            // Due date: NET 30
            const issueDate = new Date()
            const dueDate = new Date(issueDate.getTime() + 30 * 24 * 60 * 60 * 1000)

            // Create Bill (Invoice Type INV_IN) — relation connect for Prisma 6
            const bill = await prisma.invoice.create({
                data: {
                    number: billNumber,
                    type: 'INV_IN',
                    ...(supplierId ? { supplier: { connect: { id: supplierId } } } : {}),
                    purchaseRequest: { connect: { id: pr.id } },
                    status: 'DRAFT',
                    issueDate,
                    dueDate,
                    subtotal,
                    taxAmount,
                    totalAmount,
                    balanceDue: totalAmount,
                    items: {
                        create: invoiceItems.map(item => ({
                            description: item.description,
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            amount: item.amount,
                            ...(item.productId ? { product: { connect: { id: item.productId } } } : {}),
                        }))
                    }
                }
            })

            console.log(`Bill ${bill.number} created from PR ${pr.number}`)
            return {
                success: true,
                invoiceId: bill.id,
                invoiceNumber: bill.number,
            }
        })
    } catch (error: any) {
        console.error("Failed to create bill from PR:", error)
        return { success: false, error: error.message || "Gagal membuat bill dari Purchase Request" }
    }
}

/**
 * Permanently delete a DRAFT invoice/bill.
 * Only DRAFT invoices can be deleted. Cascades to InvoiceItems.
 */
export async function deleteDraftInvoice(invoiceId: string) {
    try {
        const result = await withPrismaAuth(async (prisma) => {
            const existing = await prisma.invoice.findUnique({
                where: { id: invoiceId },
                select: { id: true, number: true, status: true },
            })

            if (!existing) throw new Error("Invoice tidak ditemukan")
            if (existing.status !== 'DRAFT') {
                throw new Error(`Invoice ${existing.number} berstatus ${existing.status}, hanya DRAFT yang bisa dihapus.`)
            }

            await prisma.invoiceItem.deleteMany({ where: { invoiceId } })
            await prisma.invoice.delete({ where: { id: invoiceId } })

            return { number: existing.number }
        })

        return { success: true as const, invoiceNumber: result.number }
    } catch (error: any) {
        console.error("Failed to delete invoice:", error)
        return { success: false as const, error: error.message || "Gagal menghapus invoice" }
    }
}

/**
 * Cancel a DRAFT invoice/bill — sets status to CANCELLED.
 * Only DRAFT invoices can be cancelled via this action.
 */
export async function cancelInvoice(invoiceId: string, reason?: string) {
    try {
        const result = await withPrismaAuth(async (prisma) => {
            const existing = await prisma.invoice.findUnique({
                where: { id: invoiceId },
                select: { id: true, number: true, status: true },
            })

            if (!existing) throw new Error("Invoice tidak ditemukan")
            if (existing.status !== 'DRAFT') {
                throw new Error(`Invoice ${existing.number} berstatus ${existing.status}, hanya DRAFT yang bisa dibatalkan.`)
            }

            await prisma.invoice.update({
                where: { id: invoiceId },
                data: {
                    status: 'CANCELLED',
                },
            })

            return { number: existing.number }
        })

        return { success: true, invoiceNumber: result.number }
    } catch (error: any) {
        console.error("Failed to cancel invoice:", error)
        return { success: false, error: error.message || "Gagal membatalkan invoice" }
    }
}
