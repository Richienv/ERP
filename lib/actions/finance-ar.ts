'use server'

import { withPrismaAuth } from "@/lib/db"
import { postJournalEntry } from "./finance-gl"
import { SYS_ACCOUNTS, ensureSystemAccounts, getCashAccountCode } from "@/lib/gl-accounts-server"
import { assertPeriodOpen } from "@/lib/period-helpers"
import { type PPhTypeValue } from "@/lib/pph-helpers"
import { toNum } from "@/lib/utils"
import * as dueDateUtils from "@/lib/due-date-utils"
import { TAX_RATES } from "@/lib/tax-rates"

// ==========================================
// BAD DEBT WRITE-OFF
// ==========================================

/**
 * Provision for bad debt (Allowance method Step 1).
 * Creates a journal entry that provisions for expected losses:
 *   DR Bad Debt Expense (6500), CR Allowance for Doubtful Debts (1210)
 *
 * This hits P&L immediately but does NOT affect the invoice or AR balance yet.
 */
export async function provisionBadDebt(data: {
    amount: number
    reason?: string
    date?: Date
}) {
    try {
        return await withPrismaAuth(async (prisma) => {
            if (data.amount <= 0) throw new Error("Jumlah provisi harus lebih dari 0")

            await ensureSystemAccounts()

            const provisionDate = data.date ?? new Date()
            const glResult = await postJournalEntry({
                description: `Provisi Piutang Tak Tertagih: ${data.reason || 'Cadangan kerugian piutang'}`,
                date: provisionDate,
                reference: `PROV-BD-${Date.now()}`,
                sourceDocumentType: 'BAD_DEBT_PROVISION',
                lines: [
                    { accountCode: SYS_ACCOUNTS.BAD_DEBT_EXPENSE, debit: data.amount, credit: 0 },
                    { accountCode: SYS_ACCOUNTS.ALLOWANCE_DOUBTFUL, debit: 0, credit: data.amount },
                ]
            }, prisma)

            if (!glResult?.success) {
                throw new Error(`Jurnal provisi gagal: ${(glResult as any)?.error || 'Unknown GL error'}`)
            }

            return { success: true, journalEntryId: (glResult as any)?.journalEntryId }
        })
    } catch (error: any) {
        console.error("Provision Bad Debt Error:", error)
        return { success: false, error: error.message }
    }
}

/**
 * Write off bad debt for an invoice.
 *
 * DIRECT method:
 *   DR Bad Debt Expense (6500), CR AR (1200)
 *   — Hits P&L directly. Use when there's no prior provision.
 *
 * ALLOWANCE method:
 *   DR Allowance for Doubtful Debts (1210), CR AR (1200)
 *   — Uses previously provisioned allowance. Does NOT hit P&L again.
 *   — Call provisionBadDebt() first to set up the allowance.
 *
 * Supports partial write-off: amount can be less than balanceDue.
 * When amount >= balanceDue, invoice status becomes VOID.
 */
export async function writeOffBadDebt(data: {
    invoiceId: string
    method: 'DIRECT' | 'ALLOWANCE'
    amount: number
    reason?: string
    date?: Date
}) {
    try {
        return await withPrismaAuth(async (prisma) => {
            // 1. Validate invoice
            const invoice = await prisma.invoice.findUnique({
                where: { id: data.invoiceId }
            })

            if (!invoice) throw new Error("Invoice tidak ditemukan")
            if (invoice.type !== 'INV_OUT') throw new Error("Hanya invoice pelanggan (AR) yang dapat dihapusbukukan")
            if (!['ISSUED', 'PARTIAL', 'OVERDUE'].includes(invoice.status)) {
                throw new Error(`Invoice status '${invoice.status}' tidak dapat dihapusbukukan`)
            }

            const balanceDue = toNum(invoice.balanceDue)
            if (data.amount <= 0) throw new Error("Jumlah write-off harus lebih dari 0")
            if (data.amount > balanceDue) throw new Error(`Jumlah write-off (${data.amount}) melebihi saldo piutang (${balanceDue})`)

            // 2. Determine debit account based on method
            const debitAccountCode = data.method === 'DIRECT'
                ? SYS_ACCOUNTS.BAD_DEBT_EXPENSE   // 6500 — hits P&L
                : SYS_ACCOUNTS.ALLOWANCE_DOUBTFUL  // 1210 — uses prior provision

            // 3. Post journal entry
            await ensureSystemAccounts()

            const description = data.method === 'DIRECT'
                ? `Hapus Buku Piutang (Langsung) - ${invoice.number}: ${data.reason || 'Piutang tak tertagih'}`
                : `Hapus Buku Piutang (Cadangan) - ${invoice.number}: ${data.reason || 'Piutang tak tertagih'}`

            const writeOffDate = data.date ?? new Date()
            const glResult = await postJournalEntry({
                description,
                date: writeOffDate,
                reference: `WO-${invoice.number}`,
                invoiceId: data.invoiceId,
                sourceDocumentType: 'BAD_DEBT_WRITEOFF',
                lines: [
                    { accountCode: debitAccountCode, debit: data.amount, credit: 0 },
                    { accountCode: SYS_ACCOUNTS.AR, debit: 0, credit: data.amount },
                ]
            }, prisma)

            if (!glResult?.success) {
                throw new Error(`Jurnal hapus buku gagal: ${(glResult as any)?.error || 'Unknown GL error'}`)
            }

            // 4. Update invoice balance
            const newBalance = balanceDue - data.amount
            const newStatus = newBalance <= 0 ? 'VOID' : invoice.status

            await prisma.invoice.update({
                where: { id: data.invoiceId },
                data: {
                    balanceDue: newBalance,
                    status: newStatus,
                }
            })

            return {
                success: true,
                invoiceId: data.invoiceId,
                method: data.method,
                amountWrittenOff: data.amount,
                newBalance,
                newStatus,
            }
        })
    } catch (error: any) {
        console.error("Write Off Bad Debt Error:", error)
        return { success: false, error: error.message }
    }
}

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

            // Period lock: fail fast before mutation
            await assertPeriodOpen(new Date())

            // 2. Calculate Credit Amount
            const creditSubtotal = data.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
            const creditTax = creditSubtotal * TAX_RATES.PPN
            const creditTotal = creditSubtotal + creditTax

            // 3. Generate Credit Note Number
            // NOTE: InvoiceType only has INV_OUT / INV_IN — there is no CREDIT_NOTE member,
            // so counting by type threw at runtime. Credit notes are stored as INV_OUT rows
            // with a CN- number prefix (see step 4), so we count by that prefix instead.
            const noteDate = new Date()
            const year = noteDate.getFullYear()
            const count = await prisma.invoice.count({
                where: { number: { startsWith: `CN-${year}-` } }
            })
            const number = `CN-${year}-${String(count + 1).padStart(4, '0')}`

            // 4. Create Credit Note — relation connect for Prisma 6
            const creditNote = await prisma.invoice.create({
                data: {
                    number,
                    type: 'INV_OUT', // Credit notes are AR-side (INV_OUT with negative amounts)
                    ...(originalInvoice.customerId ? { customer: { connect: { id: originalInvoice.customerId } } } : {}),
                    status: 'ISSUED',
                    issueDate: noteDate,
                    dueDate: noteDate,
                    subtotal: -creditSubtotal,
                    taxAmount: -creditTax,
                    totalAmount: -creditTotal,
                    balanceDue: -creditTotal,
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
            const newBalance = toNum(originalInvoice.balanceDue) - creditTotal
            await prisma.invoice.update({
                where: { id: originalInvoice.id },
                data: {
                    balanceDue: newBalance,
                    status: newBalance <= 0 ? 'PAID' : 'PARTIAL'
                }
            })

            // 6. Post Journal Entry
            await ensureSystemAccounts()
            await postJournalEntry({
                description: `Credit Note for ${originalInvoice.number}: ${data.reason}`,
                date: noteDate,
                reference: creditNote.id,
                lines: [
                    {
                        accountCode: SYS_ACCOUNTS.AR, // Piutang Usaha (AR)
                        debit: creditTotal,
                        credit: 0
                    },
                    {
                        accountCode: SYS_ACCOUNTS.REVENUE, // Pendapatan Penjualan (Revenue reversal)
                        debit: 0,
                        credit: creditSubtotal
                    },
                    {
                        accountCode: SYS_ACCOUNTS.PPN_KELUARAN, // PPN Keluaran (Output VAT)
                        debit: 0,
                        credit: creditTax
                    }
                ]
            }, prisma)

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

            // Period lock: fail fast before mutation
            await assertPeriodOpen(new Date())

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
            const newBalance = toNum(invoice.balanceDue) + data.amount
            await prisma.invoice.update({
                where: { id: data.invoiceId },
                data: {
                    balanceDue: newBalance,
                    status: newBalance <= 0 ? 'PAID' : 'PARTIAL'
                }
            })

            // 3. Post Journal Entry
            const creditAccount = getCashAccountCode(data.method)

            await ensureSystemAccounts()
            await postJournalEntry({
                description: `Refund to customer: ${data.reason}`,
                date: new Date(),
                reference: refund.id,
                lines: [
                    {
                        accountCode: SYS_ACCOUNTS.AR, // Piutang Usaha (AR)
                        debit: data.amount,
                        credit: 0
                    },
                    {
                        accountCode: creditAccount,
                        debit: 0,
                        credit: data.amount
                    }
                ]
            }, prisma)

            return { success: true, refundId: refund.id }
        })
    } catch (error: any) {
        console.error("Process Refund Error:", error)
        return { success: false, error: error.message }
    }
}

// ==========================================
// PAYMENT VOUCHERS / GIRO / BANK STATEMENT — NOT IMPLEMENTED (no database schema)
// ==========================================
//
// The five functions below were written against columns and a model that do not
// exist in prisma/schema.prisma:
//
//   Payment  — has NO `type`, `status`, `dueDate`, `bankAccount`, `clearedDate`,
//              `isReconciled` columns and NO `voucherItems` relation.
//   model BankStatement — does not exist at all (verified: no `bankStatement` on
//              PrismaClient, no migration).
//
// Every one of them therefore threw at runtime ("Unknown argument" from Prisma,
// or "Cannot read properties of undefined" for prisma.bankStatement). Nothing in
// the app imports them — the working bank-reconciliation implementation lives in
// lib/actions/finance-reconciliation.ts (BankReconciliation / BankReconciliationItem
// models) and is what app/finance/reconciliation/page.tsx actually calls.
//
// The exports are kept so the API surface is stable, but each entry point now
// fails loudly instead of pretending to post money.
//
// TODO(schema): payment vouchers + GIRO clearing need Payment.type/status/dueDate/
// clearedDate + a PaymentVoucherItem model before this can be restored. Bank
// statement import should be routed to finance-reconciliation.ts rather than
// reviving a second, parallel BankStatement model.

const PAYMENT_VOUCHER_NOT_IMPLEMENTED =
    'Fitur Payment Voucher / GIRO belum tersedia — kolom Payment (type, status, dueDate, ' +
    'clearedDate) dan model item voucher belum ada di database schema.'

const BANK_STATEMENT_NOT_IMPLEMENTED =
    'Fitur import rekening koran di modul ini belum tersedia — model BankStatement tidak ada. ' +
    'Gunakan rekonsiliasi bank di lib/actions/finance-reconciliation.ts.'

export async function createPaymentVoucher(_data: {
    supplierId: string
    billIds: string[]
    amount: number
    method: 'CASH' | 'TRANSFER' | 'CHECK' | 'GIRO'
    bankAccount?: string
    dueDate?: Date
    reference?: string
    notes?: string
}): Promise<{ success: boolean; voucherNumber?: string; error?: string }> {
    console.error('[createPaymentVoucher]', PAYMENT_VOUCHER_NOT_IMPLEMENTED)
    return { success: false, error: PAYMENT_VOUCHER_NOT_IMPLEMENTED }
}

export async function processGIROClearing(
    _voucherId: string,
    _isCleared: boolean,
    _rejectionReason?: string
): Promise<{ success: boolean; status?: string; reason?: string; error?: string }> {
    console.error('[processGIROClearing]', PAYMENT_VOUCHER_NOT_IMPLEMENTED)
    return { success: false, error: PAYMENT_VOUCHER_NOT_IMPLEMENTED }
}

// ==========================================
// BANK RECONCILIATION (superseded by lib/actions/finance-reconciliation.ts)
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

export async function importBankStatement(
    _bankAccountId: string,
    _lines: Omit<BankStatementLine, 'id' | 'isReconciled'>[]
): Promise<{ success: boolean; count?: number; error?: string }> {
    console.error('[importBankStatement]', BANK_STATEMENT_NOT_IMPLEMENTED)
    return { success: false, error: BANK_STATEMENT_NOT_IMPLEMENTED }
}

export async function getUnreconciledBankLines(
    _bankAccountId: string
): Promise<{ success: boolean; error?: string; bankLines: BankStatementLine[]; payments: [] }> {
    console.error('[getUnreconciledBankLines]', BANK_STATEMENT_NOT_IMPLEMENTED)
    return { success: false, error: BANK_STATEMENT_NOT_IMPLEMENTED, bankLines: [], payments: [] }
}

export async function reconcileBankLine(_data: {
    bankLineId: string
    paymentId?: string
    invoiceId?: string
    isAutoMatched?: boolean
}): Promise<{ success: boolean; error?: string }> {
    console.error('[reconcileBankLine]', BANK_STATEMENT_NOT_IMPLEMENTED)
    return { success: false, error: BANK_STATEMENT_NOT_IMPLEMENTED }
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
    allocated?: boolean
    invoiceId?: string | null
    invoiceNumber?: string | null
    invoiceStatus?: string | null
}

export interface OpenInvoice {
    id: string
    number: string
    customer: { id: string; name: string } | null
    amount: number
    balanceDue: number
    dueDate: Date
    isOverdue: boolean
    status: string
}

type ARRegistryQueryInput = {
    paymentsQ?: string | null
    invoicesQ?: string | null
    customerId?: string | null
    paymentPage?: number | null
    invoicePage?: number | null
    pageSize?: number | null
}

export interface RecentAllocatedPayment {
    id: string
    number: string
    amount: number
    method: string
    reference: string | null
    date: Date
    createdAt: Date
    customerName: string | null
    invoice: { id: string; number: string; status: string } | null
}

export interface ARPaymentRegistryResult {
    unallocated: UnallocatedPayment[]
    openInvoices: OpenInvoice[]
    recentPayments: RecentAllocatedPayment[]
    allCustomers: { id: string; name: string; code: string | null }[]
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

            const [payments, invoices, paymentsTotal, invoicesTotal, recentPayments, allCustomers] = await Promise.all([
                prisma.payment.findMany({
                    where: paymentWhere,
                    include: {
                        customer: { select: { id: true, name: true } },
                        invoice: { select: { id: true, number: true, status: true } },
                    },
                    orderBy: { date: 'desc' },
                    skip: (query.paymentPage - 1) * query.pageSize,
                    take: query.pageSize,
                }),
                prisma.invoice.findMany({
                    where: invoiceWhere,
                    include: {
                        customer: { select: { id: true, name: true } },
                        dcNoteSettlements: {
                            select: { amount: true },
                            where: { note: { status: { notIn: ['VOID', 'CANCELLED'] } } },
                        },
                    },
                    orderBy: { dueDate: 'asc' },
                    skip: (query.invoicePage - 1) * query.pageSize,
                    take: query.pageSize,
                }),
                prisma.payment.count({ where: paymentWhere }),
                prisma.invoice.count({ where: invoiceWhere }),
                prisma.payment.findMany({
                    where: {
                        invoiceId: { not: null },
                        customerId: { not: null },
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 20,
                    select: {
                        id: true, number: true, amount: true, method: true, reference: true, date: true, createdAt: true,
                        customer: { select: { id: true, name: true } },
                        invoice: { select: { id: true, number: true, status: true } },
                    },
                }),
                prisma.customer.findMany({
                    where: { isActive: true },
                    select: { id: true, name: true, code: true },
                    orderBy: { name: 'asc' },
                }),
            ])

            const now = new Date()
            return {
                unallocated: payments.map((p) => ({
                    id: p.id,
                    number: p.number,
                    from: p.customer?.name || 'Unknown Customer',
                    customerId: p.customerId,
                    amount: toNum(p.amount),
                    date: p.date,
                    method: p.method,
                    reference: p.reference,
                    allocated: p.invoiceId != null,
                    invoiceId: p.invoiceId,
                    invoiceNumber: p.invoice?.number ?? null,
                    invoiceStatus: p.invoice?.status ?? null,
                })),
                openInvoices: invoices.map((inv) => {
                    const cnReduction = (inv.dcNoteSettlements || []).reduce(
                        (sum: number, s: { amount: any }) => sum + Number(s.amount), 0
                    )
                    return {
                        id: inv.id,
                        number: inv.number,
                        customer: inv.customer ? { id: inv.customer.id, name: inv.customer.name } : null,
                        amount: toNum(inv.totalAmount),
                        balanceDue: toNum(inv.balanceDue),
                        cnReduction,
                        dueDate: inv.dueDate,
                        isOverdue: dueDateUtils.isOverdue(inv.dueDate),
                        isDueToday: dueDateUtils.isDueToday(inv.dueDate),
                        status: inv.status,
                    }
                }),
                recentPayments: recentPayments.map((p) => ({
                    id: p.id,
                    number: p.number,
                    amount: toNum(p.amount),
                    method: p.method,
                    reference: p.reference,
                    date: p.date,
                    createdAt: p.createdAt,
                    customerName: p.customer?.name ?? null,
                    invoice: p.invoice ? { id: p.invoice.id, number: p.invoice.number, status: p.invoice.status } : null,
                })),
                allCustomers,
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
        console.error("[getARPaymentRegistry] failed:", error)
        throw error
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
                amount: toNum(p.amount),
                date: p.date,
                method: p.method,
                reference: p.reference
            }))
        })
    } catch (error) {
        console.error("[getUnallocatedPayments] failed:", error)
        throw error
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
                amount: toNum(inv.totalAmount),
                balanceDue: toNum(inv.balanceDue),
                dueDate: inv.dueDate,
                isOverdue: dueDateUtils.isOverdue(inv.dueDate),
                isDueToday: dueDateUtils.isDueToday(inv.dueDate),
                status: inv.status,
            }))
        })
    } catch (error) {
        console.error("[getOpenInvoices] failed:", error)
        throw error
    }
}


/**
 * Record a new customer payment (AR receipt)
 */
export async function recordARPayment(data: {
    customerId: string
    amount: number
    date?: Date
    method?: 'CASH' | 'TRANSFER' | 'CHECK' | 'GIRO' | 'CREDIT_CARD' | 'OTHER'
    reference?: string
    notes?: string
    invoiceId?: string // Optional: directly link to invoice
    withheldByCustomer?: {
        type: PPhTypeValue
        rate: number
        baseAmount: number
        buktiPotongNo?: string
    }
    bankChargeAmount?: number // Optional: bank charges deducted from received amount
    bankAccountCode?: string // COA code for the bank/cash account to debit
}) {
    try {
        return await withPrismaAuth(async (prisma) => {
            // Period lock: fail fast before mutation
            await assertPeriodOpen(data.date || new Date())

            // Generate payment number
            const year = new Date().getFullYear()
            const count = await prisma.payment.count({
                where: { number: { startsWith: `PAY-${year}` } }
            })
            const paymentNumber = `PAY-${year}-${String(count + 1).padStart(4, '0')}`

            // Use selected COA account directly — no method→account mapping
            const cashCode = data.bankAccountCode || SYS_ACCOUNTS.BANK_BCA

            // Auto-derive method for Payment record from account name
            const cashAcct = await prisma.gLAccount.findFirst({ where: { code: cashCode }, select: { name: true } })
            const derivedMethod = data.method || (cashAcct && /kas|cash|petty/i.test(cashAcct.name) ? 'CASH' : 'TRANSFER')

            const payment = await prisma.payment.create({
                data: {
                    number: paymentNumber,
                    customerId: data.customerId,
                    amount: data.amount,
                    date: data.date || new Date(),
                    method: derivedMethod,
                    reference: data.reference,
                    notes: data.notes,
                    invoiceId: data.invoiceId || null
                }
            })

            await ensureSystemAccounts()

            if (data.invoiceId) {
                // Payment linked to invoice — reduce AR balance
                const invoice = await prisma.invoice.findUnique({
                    where: { id: data.invoiceId },
                    include: { customer: { select: { name: true } } }
                })

                if (invoice) {
                    const customer = invoice.customer
                    const pphAmount = data.withheldByCustomer
                        ? Math.round((data.withheldByCustomer.rate / 100) * data.withheldByCustomer.baseAmount)
                        : 0
                    const totalSettled = data.amount + pphAmount

                    const newBalance = toNum(invoice.balanceDue) - totalSettled
                    await prisma.invoice.update({
                        where: { id: data.invoiceId },
                        data: {
                            balanceDue: newBalance,
                            status: newBalance <= 0 ? 'PAID' : 'PARTIAL'
                        }
                    })

                    // Post GL Entry: DR Cash/Bank, DR PPh Dibayar Dimuka (if withheld), DR Bank Charges (if any), CR Piutang Usaha (AR)
                    const bankCharge = data.bankChargeAmount && data.bankChargeAmount > 0 ? data.bankChargeAmount : 0
                    const bankDebitAmount = data.amount - bankCharge

                    const arLines: { accountCode: string; debit: number; credit: number; description?: string }[] = [
                        { accountCode: cashCode, debit: bankDebitAmount, credit: 0, description: `Terima dari ${customer?.name || 'Customer'}` },
                    ]

                    if (bankCharge > 0) {
                        arLines.push({
                            accountCode: SYS_ACCOUNTS.BANK_CHARGES, debit: bankCharge, credit: 0, description: `Biaya bank - ${invoice.number}`
                        })
                    }

                    if (data.withheldByCustomer && pphAmount > 0) {
                        arLines.push({
                            accountCode: SYS_ACCOUNTS.PPH_PREPAID,
                            debit: pphAmount,
                            credit: 0,
                            description: `PPh Dibayar Dimuka - ${invoice.number}`,
                        })
                    }

                    arLines.push({
                        accountCode: SYS_ACCOUNTS.AR, debit: 0, credit: totalSettled, description: `Pelunasan ${invoice.number}`
                    })

                    const glResult = await postJournalEntry({
                        description: `Penerimaan ${paymentNumber} untuk ${invoice.number}${bankCharge > 0 ? ` (biaya bank: ${bankCharge})` : ''}`,
                        date: data.date || new Date(),
                        reference: paymentNumber,
                        invoiceId: data.invoiceId,
                        lines: arLines,
                    }, prisma)
                    if (!glResult?.success) {
                        // Atomic: GL gagal → lempar error agar withPrismaAuth rollback payment + invoice update
                        throw new Error(`Jurnal gagal — pembayaran dibatalkan: ${(glResult as any)?.error || 'Unknown GL error'}`)
                    }

                    // Create WithholdingTax record if customer withheld PPh
                    if (data.withheldByCustomer && pphAmount > 0) {
                        await prisma.withholdingTax.create({
                            data: {
                                paymentId: payment.id,
                                invoiceId: data.invoiceId || null,
                                type: data.withheldByCustomer.type,
                                direction: 'IN',
                                rate: data.withheldByCustomer.rate,
                                baseAmount: data.withheldByCustomer.baseAmount,
                                amount: pphAmount,
                                buktiPotongNo: data.withheldByCustomer.buktiPotongNo || null,
                                buktiPotongDate: data.withheldByCustomer.buktiPotongNo ? new Date() : null,
                            },
                        })
                    }
                }
            } else {
                // Advance payment (Uang Muka / DP) — no invoice yet
                // Per PSAK 72: DR Cash/Bank, CR Pendapatan Diterima Dimuka (Unearned Revenue)
                // Revenue is NOT recognized until goods/services delivered
                const advGlResult = await postJournalEntry({
                    description: `Uang Muka dari Customer - ${paymentNumber}`,
                    date: data.date || new Date(),
                    reference: paymentNumber,
                    lines: [
                        { accountCode: cashCode, debit: data.amount, credit: 0 },
                        { accountCode: SYS_ACCOUNTS.DEFERRED_REV, debit: 0, credit: data.amount } // Pendapatan Diterima Dimuka
                    ]
                }, prisma)
                if (!advGlResult?.success) {
                    // Atomic: GL gagal → lempar error agar withPrismaAuth rollback payment
                    throw new Error(`Jurnal gagal — pembayaran dibatalkan: ${(advGlResult as any)?.error || 'Unknown GL error'}`)
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

            // Period lock: fail fast before mutation
            await assertPeriodOpen(new Date())

            const paymentAmount = toNum(payment.amount)
            const newBalance = toNum(invoice.balanceDue) - paymentAmount

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
            await ensureSystemAccounts()
            const matchGlResult = await postJournalEntry({
                description: `Payment ${payment.number} matched to Invoice ${invoice.number}`,
                date: payment.date,
                reference: payment.number,
                lines: [
                    { accountCode: getCashAccountCode(payment.method), debit: paymentAmount, credit: 0 }, // Kas/Bank
                    { accountCode: SYS_ACCOUNTS.AR, debit: 0, credit: paymentAmount }  // Piutang Usaha (AR)
                ]
            }, prisma)
            if (!matchGlResult?.success) {
                // Atomic: GL gagal → lempar error agar withPrismaAuth rollback match
                throw new Error(`Jurnal gagal — pembayaran dibatalkan: ${(matchGlResult as any)?.error || 'Unknown GL error'}`)
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
                return payments.reduce((sum, p) => sum + toNum(p.amount), 0)
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
        console.error("[getARPaymentStats] failed:", error)
        throw error
    }
}


/**
 * Fetch cash/bank GL accounts for AR payment receipt dropdown.
 * Returns leaf accounts only (excludes parent/header accounts like 1000).
 * Splits into bank (name contains "Bank") and cash (Kas/Petty Cash) for conditional display.
 */
export async function getCashBankAccountsForPayment(): Promise<{
    bankAccounts: { code: string; name: string }[]
    cashAccounts: { code: string; name: string }[]
}> {
    try {
        return await withPrismaAuth(async (prisma) => {
            const accounts = await prisma.gLAccount.findMany({
                where: {
                    type: "ASSET",
                    subType: "ASSET_CASH",
                    // Only leaf accounts that can receive journal postings
                    children: { none: {} },
                },
                orderBy: { code: "asc" },
                select: { code: true, name: true },
            })

            const bankAccounts: { code: string; name: string }[] = []
            const cashAccounts: { code: string; name: string }[] = []

            for (const acc of accounts) {
                const lowerName = acc.name.toLowerCase()
                if (lowerName.includes("bank")) {
                    bankAccounts.push(acc)
                } else if (lowerName.includes("kas") || lowerName.includes("cash") || lowerName.includes("petty")) {
                    cashAccounts.push(acc)
                }
            }

            return { bankAccounts, cashAccounts }
        })
    } catch (error) {
        console.error("[getCashBankAccountsForPayment] failed:", error)
        throw error
    }
}
