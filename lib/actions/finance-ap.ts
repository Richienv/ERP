'use server'

import { InvoiceStatus } from "@prisma/client"
import { withPrismaAuth } from "@/lib/db"
import { postJournalEntry } from "./finance-gl"

// ==========================================
// VENDOR BILLS (AP - From Purchase Orders)
// ==========================================

export interface VendorBill {
    id: string
    number: string
    vendor: {
        id: string;
        name: string;
        bankName?: string;
        bankAccountNumber?: string;
        bankAccountName?: string;
    } | null
    purchaseOrderNumber?: string
    date: Date
    dueDate: Date
    amount: number
    balanceDue: number
    status: string
    isOverdue: boolean
}

type VendorBillQueryInput = {
    q?: string | null
    status?: string | null
    page?: number | null
    pageSize?: number | null
}

export interface VendorBillRegistryResult {
    rows: VendorBill[]
    meta: {
        page: number
        pageSize: number
        total: number
        totalPages: number
    }
    query: {
        q: string | null
        status: string | null
    }
}

const normalizeVendorBillQuery = (input?: VendorBillQueryInput) => {
    const trimmedQ = (input?.q || "").trim()
    const trimmedStatus = (input?.status || "").trim().toUpperCase()
    const pageRaw = Number(input?.page)
    const pageSizeRaw = Number(input?.pageSize)
    return {
        q: trimmedQ.length > 0 ? trimmedQ : null,
        status: trimmedStatus.length > 0 ? trimmedStatus : null,
        page: Number.isFinite(pageRaw) ? Math.max(1, Math.trunc(pageRaw)) : 1,
        pageSize: Number.isFinite(pageSizeRaw) ? Math.min(50, Math.max(6, Math.trunc(pageSizeRaw))) : 12,
    }
}

/**
 * Get all pending vendor bills (AP invoices)
 */
export async function getVendorBills(): Promise<VendorBill[]> {
    try {
        return await withPrismaAuth(async (prisma) => {
            const bills = await prisma.invoice.findMany({
                where: {
                    type: 'INV_IN', // Vendor bills
                    status: { in: ['DRAFT', 'ISSUED', 'PARTIAL', 'OVERDUE', 'DISPUTED'] }
                },
                include: {
                    supplier: {
                        select: {
                            id: true,
                            name: true,
                            bankName: true,
                            bankAccountNumber: true,
                            bankAccountName: true
                        }
                    }
                },
                orderBy: { dueDate: 'asc' },
                take: 100
            })

            const now = new Date()
            return bills.map((bill) => ({
                id: bill.id,
                number: bill.number,
                vendor: bill.supplier ? {
                    id: bill.supplier.id,
                    name: bill.supplier.name,
                    bankName: bill.supplier.bankName || undefined,
                    bankAccountNumber: bill.supplier.bankAccountNumber || undefined,
                    bankAccountName: bill.supplier.bankAccountName || undefined
                } : null,
                purchaseOrderNumber: (bill as any).purchaseOrderId || undefined,
                date: bill.issueDate,
                dueDate: bill.dueDate,
                amount: Number(bill.totalAmount),
                balanceDue: Number(bill.balanceDue),
                status: bill.status,
                isOverdue: bill.dueDate < now && bill.status !== 'PAID'
            }))
        })
    } catch (error) {
        console.error("Failed to fetch vendor bills:", error)
        return []
    }
}

export async function getVendorBillsRegistry(input?: VendorBillQueryInput): Promise<VendorBillRegistryResult> {
    const query = normalizeVendorBillQuery(input)

    try {
        return await withPrismaAuth(async (prisma) => {
            const where: any = {
                type: 'INV_IN',
                status: { in: ['DRAFT', 'ISSUED', 'PARTIAL', 'OVERDUE', 'DISPUTED'] }
            }

            if (query.status) where.status = query.status
            if (query.q) {
                where.OR = [
                    { number: { contains: query.q, mode: 'insensitive' } },
                    { supplier: { name: { contains: query.q, mode: 'insensitive' } } }
                ]
            }

            const [bills, total] = await Promise.all([
                prisma.invoice.findMany({
                    where,
                    include: {
                        supplier: {
                            select: {
                                id: true,
                                name: true,
                                bankName: true,
                                bankAccountNumber: true,
                                bankAccountName: true
                            }
                        }
                    },
                    orderBy: [{ dueDate: 'asc' }, { issueDate: 'desc' }],
                    skip: (query.page - 1) * query.pageSize,
                    take: query.pageSize
                }),
                prisma.invoice.count({ where })
            ])

            const now = new Date()
            const rows = bills.map((bill) => ({
                id: bill.id,
                number: bill.number,
                vendor: bill.supplier ? {
                    id: bill.supplier.id,
                    name: bill.supplier.name,
                    bankName: bill.supplier.bankName || undefined,
                    bankAccountNumber: bill.supplier.bankAccountNumber || undefined,
                    bankAccountName: bill.supplier.bankAccountName || undefined
                } : null,
                purchaseOrderNumber: (bill as any).purchaseOrderId || undefined,
                date: bill.issueDate,
                dueDate: bill.dueDate,
                amount: Number(bill.totalAmount),
                balanceDue: Number(bill.balanceDue),
                status: bill.status,
                isOverdue: bill.dueDate < now && bill.status !== 'PAID'
            }))

            return {
                rows,
                meta: {
                    page: query.page,
                    pageSize: query.pageSize,
                    total,
                    totalPages: Math.max(1, Math.ceil(total / query.pageSize))
                },
                query: {
                    q: query.q,
                    status: query.status,
                }
            }
        })
    } catch (error) {
        console.error("Failed to fetch vendor bills registry:", error)
        return {
            rows: [],
            meta: { page: 1, pageSize: query.pageSize, total: 0, totalPages: 1 },
            query: { q: query.q, status: query.status }
        }
    }
}

/**
 * Approve a vendor bill and post to GL
 */
export async function approveVendorBill(billId: string) {
    try {
        return await withPrismaAuth(async (prisma) => {
            // 1. Get Bill Details
            const bill = await prisma.invoice.findUnique({
                where: { id: billId },
                include: {
                    supplier: true,
                    items: {
                        include: { product: true }
                    }
                }
            })

            if (!bill) throw new Error("Bill not found")
            if (bill.status !== 'DRAFT') throw new Error("Bill already processed")

            // 2. Update Status to ISSUED (Approved)
            await prisma.invoice.update({
                where: { id: billId },
                data: { status: 'ISSUED' } // Ready for payment
            })

            // 3. Post to General Ledger (Accrual Basis)
            // Debit: Expense / Asset
            // Credit: Accounts Payable (Liability)

            // Prepare GL Lines
            const glLines: any[] = []
            let totalAmount = 0

            // Credit AP (Liability increases)
            // Using standard AP code '2000' (from seed/setup)
            const apAccount = await prisma.gLAccount.findFirst({ where: { code: '2000' } })
            if (!apAccount) throw new Error("AP Account (2000) not configured")

            // Determine Debit Accounts (Expenses/Assets)
            for (const item of bill.items) {
                const amount = Number(item.amount)
                totalAmount += amount

                // Attempt to find expense account from product, else default
                const debitAccountCode = '6000' // Default Expense
                // If we had product.expenseAccount relation, we'd use it here.
                // For now, let's look for a suitable account based on context or default.

                // TODO: enhance with product-specific accounts in future
                const expenseAccount = await prisma.gLAccount.findFirst({ where: { code: debitAccountCode } })

                if (expenseAccount) {
                    glLines.push({
                        accountCode: debitAccountCode,
                        debit: amount,
                        credit: 0,
                        description: `${item.description} (Qty: ${item.quantity})`
                    })
                } else {
                    // Fallback if 6000 doesn't exist, try getting any Expense account
                    const anyExpense = await prisma.gLAccount.findFirst({ where: { type: 'EXPENSE' } })
                    if (anyExpense) {
                        glLines.push({
                            accountCode: anyExpense.code,
                            debit: amount,
                            credit: 0,
                            description: `${item.description}`
                        })
                    } else {
                        // Absolute fallback (should not happen in prod)
                        console.warn("No Expense account found for bill item")
                    }
                }
            }

            // Add Tax if applicable (Input VAT - Asset)
            if (Number(bill.taxAmount) > 0) {
                const vatInAccount = await prisma.gLAccount.findFirst({ where: { code: '1330' } }) // PPN Masukan
                if (vatInAccount) {
                    glLines.push({
                        accountCode: '1330',
                        debit: Number(bill.taxAmount),
                        credit: 0,
                        description: `PPN Masukan - Bill ${bill.number}`
                    })
                    totalAmount += Number(bill.taxAmount)
                }
            }

            // Add AP Credit Line
            glLines.push({
                accountCode: '2100', // Hutang Usaha
                debit: 0,
                credit: totalAmount, // Should match bill total
                description: `Hutang - ${bill.supplier?.name}`
            })

            // Post Journal Entry
            await postJournalEntry({
                description: `Bill Approval #${bill.number} - ${bill.supplier?.name}`,
                date: new Date(),
                reference: bill.number,
                lines: glLines
            })

            return { success: true }
        })
    } catch (error: any) {
        console.error("Failed to approve bill:", error)
        return { success: false, error: error.message }
    }
}

// ==========================================
// VENDOR PAYMENTS (AP Payments)
// ==========================================

export interface VendorPayment {
    id: string
    number: string
    vendor: { id: string; name: string } | null
    date: Date
    amount: number
    method: string
    reference?: string
    billNumber?: string
    notes?: string
}

/**
 * Get vendor payment history
 */
export async function getVendorPayments(): Promise<VendorPayment[]> {
    try {
        return await withPrismaAuth(async (prisma) => {
            const payments = await prisma.payment.findMany({
                where: {
                    OR: [
                        { supplierId: { not: null } },
                        { notes: { contains: '"source":"PAYROLL_DISBURSEMENT"' } }
                    ]
                },
                include: {
                    supplier: { select: { id: true, name: true } },
                    invoice: { select: { number: true } }
                },
                orderBy: { date: 'desc' },
                take: 50
            })

            return payments.map((p) => ({
                id: p.id,
                number: p.number,
                vendor: p.supplier
                    ? { id: p.supplier.id, name: p.supplier.name }
                    : (p.notes?.includes('"source":"PAYROLL_DISBURSEMENT"')
                        ? { id: "PAYROLL", name: "Payroll Disbursement Batch" }
                        : null),
                date: p.date,
                amount: Number(p.amount),
                method: p.method,
                reference: p.reference || undefined,
                billNumber: p.invoice?.number,
                notes: p.notes || undefined,
            }))
        })
    } catch (error) {
        console.error("Failed to fetch vendor payments:", error)
        return []
    }
}

/**
 * Record a vendor payment (pay a bill)
 */
export async function recordVendorPayment(data: {
    supplierId: string
    billId?: string
    amount: number
    method?: 'CASH' | 'TRANSFER' | 'CHECK'
    reference?: string
    notes?: string
}) {
    try {
        return await withPrismaAuth(async (prisma) => {
            if (!data.supplierId) {
                throw new Error("Supplier is required")
            }
            if (!data.amount || Number(data.amount) <= 0) {
                throw new Error("Amount must be greater than 0")
            }
            if (data.method === 'CHECK' && !data.reference) {
                throw new Error("Check number/reference is required for CHECK payments")
            }

            // Generate payment number
            const year = new Date().getFullYear()
            const count = await prisma.payment.count({
                where: { number: { startsWith: `VPAY-${year}` } }
            })
            const paymentNumber = `VPAY-${year}-${String(count + 1).padStart(4, '0')}`

            const payment = await prisma.payment.create({
                data: {
                    number: paymentNumber,
                    supplierId: data.supplierId,
                    invoiceId: data.billId,
                    amount: data.amount,
                    date: new Date(),
                    method: data.method || 'TRANSFER',
                    reference: data.reference,
                    notes: data.notes
                }
            })

            // If linked to bill, update bill balance
            if (data.billId) {
                const bill = await prisma.invoice.findUnique({
                    where: { id: data.billId }
                })
                if (bill) {
                    const newBalance = Number(bill.balanceDue) - data.amount
                    await prisma.invoice.update({
                        where: { id: data.billId },
                        data: {
                            balanceDue: Math.max(0, newBalance),
                            status: newBalance <= 0 ? 'PAID' : 'PARTIAL'
                        }
                    })
                }
            }

            // Post GL entry: DR AP, CR Cash
            await postJournalEntry({
                description: `Vendor Payment ${paymentNumber}`,
                date: new Date(),
                reference: paymentNumber,
                lines: [
                    { accountCode: '2100', debit: data.amount, credit: 0, description: 'Hutang Usaha' },
                    { accountCode: '1000', debit: 0, credit: data.amount, description: 'Kas Besar' }
                ]
            })

            return { success: true, paymentId: payment.id, paymentNumber }
        })
    } catch (error: any) {
        console.error("Failed to record vendor payment:", error)
        return { success: false, error: error.message }
    }
}

// ==========================================
// MULTI-BILL VENDOR PAYMENT (AP Multi-Pay)
// ==========================================

export interface BillAllocation {
    billId: string
    amount: number
}

/**
 * Record a payment that covers multiple bills (partial or full).
 * Each allocation updates the corresponding bill's balanceDue & status.
 * A single GL entry is posted: DR Accounts Payable, CR Bank/Cash.
 */
export async function recordMultiBillPayment(data: {
    supplierId: string
    allocations: BillAllocation[]
    method?: 'CASH' | 'TRANSFER' | 'CHECK'
    reference?: string
    notes?: string
    bankAccountCode?: string // GL code for bank/cash account (default 1010)
}) {
    try {
        return await withPrismaAuth(async (prisma) => {
            if (!data.supplierId) {
                throw new Error("Supplier wajib dipilih")
            }
            if (!data.allocations || data.allocations.length === 0) {
                throw new Error("Minimal satu tagihan harus dialokasikan")
            }

            const totalAmount = data.allocations.reduce((sum, a) => sum + a.amount, 0)
            if (totalAmount <= 0) {
                throw new Error("Total pembayaran harus lebih dari 0")
            }

            // Validate all allocations
            for (const alloc of data.allocations) {
                if (!alloc.billId) throw new Error("Bill ID wajib diisi")
                if (alloc.amount <= 0) throw new Error("Jumlah alokasi harus lebih dari 0")
            }

            if (data.method === 'CHECK' && !data.reference) {
                throw new Error("Nomor cek/referensi wajib diisi untuk metode CHECK")
            }

            // Generate payment number
            const year = new Date().getFullYear()
            const count = await prisma.payment.count({
                where: { number: { startsWith: `VPAY-${year}` } }
            })
            const paymentNumber = `VPAY-${year}-${String(count + 1).padStart(4, '0')}`

            // For multi-bill, we create one payment per bill allocation
            // so that payment history is properly linked to each bill
            const paymentIds: string[] = []

            for (const alloc of data.allocations) {
                const bill = await prisma.invoice.findUnique({
                    where: { id: alloc.billId },
                    include: { supplier: { select: { name: true } } }
                })
                if (!bill) throw new Error(`Tagihan ${alloc.billId} tidak ditemukan`)
                if (bill.supplierId !== data.supplierId) {
                    throw new Error(`Tagihan ${bill.number} bukan milik vendor yang dipilih`)
                }

                const currentBalance = Number(bill.balanceDue)
                if (alloc.amount > currentBalance + 0.01) {
                    throw new Error(`Alokasi untuk ${bill.number} (${alloc.amount}) melebihi sisa tagihan (${currentBalance})`)
                }

                // Allocate suffix for multi-bill payments
                const suffix = data.allocations.length > 1
                    ? `-${String(paymentIds.length + 1).padStart(2, '0')}`
                    : ''
                const allocPaymentNumber = `${paymentNumber}${suffix}`

                const payment = await prisma.payment.create({
                    data: {
                        number: allocPaymentNumber,
                        supplierId: data.supplierId,
                        invoiceId: alloc.billId,
                        amount: alloc.amount,
                        date: new Date(),
                        method: data.method || 'TRANSFER',
                        reference: data.reference,
                        notes: data.notes
                    }
                })
                paymentIds.push(payment.id)

                // Update bill balance & status
                const newBalance = Math.max(0, currentBalance - alloc.amount)
                let newStatus: InvoiceStatus
                if (newBalance <= 0.01) {
                    newStatus = 'PAID' as InvoiceStatus
                } else {
                    newStatus = 'PARTIAL' as InvoiceStatus
                }

                await prisma.invoice.update({
                    where: { id: alloc.billId },
                    data: {
                        balanceDue: Math.max(0, newBalance),
                        status: newStatus
                    }
                })
            }

            // Post single GL entry for total amount: DR AP, CR Bank/Cash
            const bankCode = data.bankAccountCode || '1010'
            await postJournalEntry({
                description: `Pembayaran Vendor Multi-Bill ${paymentNumber}`,
                date: new Date(),
                reference: paymentNumber,
                lines: [
                    { accountCode: '2100', debit: totalAmount, credit: 0, description: 'Pelunasan Hutang Usaha' },
                    { accountCode: bankCode, debit: 0, credit: totalAmount, description: `Pembayaran via ${data.method || 'TRANSFER'}` }
                ]
            })

            return { success: true, paymentNumber, paymentIds, totalAmount }
        })
    } catch (error: any) {
        console.error("Failed to record multi-bill payment:", error)
        return { success: false, error: error.message }
    }
}

/**
 * Get AP balance per vendor (total outstanding)
 */
export async function getVendorAPBalances(): Promise<Array<{
    vendorId: string
    vendorName: string
    totalOutstanding: number
    billCount: number
}>> {
    try {
        return await withPrismaAuth(async (prisma) => {
            const results = await prisma.invoice.groupBy({
                by: ['supplierId'],
                where: {
                    type: 'INV_IN',
                    status: { in: ['ISSUED', 'PARTIAL', 'OVERDUE', 'DISPUTED'] },
                    supplierId: { not: null }
                },
                _sum: { balanceDue: true },
                _count: true
            })

            // Get supplier names
            const supplierIds = results
                .map(r => r.supplierId)
                .filter((id): id is string => id !== null)

            const suppliers = await prisma.supplier.findMany({
                where: { id: { in: supplierIds } },
                select: { id: true, name: true }
            })
            const supplierMap = new Map(suppliers.map(s => [s.id, s.name]))

            return results
                .filter(r => r.supplierId !== null)
                .map(r => ({
                    vendorId: r.supplierId!,
                    vendorName: supplierMap.get(r.supplierId!) || 'Unknown',
                    totalOutstanding: Number(r._sum.balanceDue || 0),
                    billCount: r._count
                }))
                .sort((a, b) => b.totalOutstanding - a.totalOutstanding)
        })
    } catch (error) {
        console.error("Failed to fetch vendor AP balances:", error)
        return []
    }
}

// ==========================================
// FINANCE STATS FOR DASHBOARD
// ==========================================

/**
 * Get AP (Accounts Payable) stats
 */
export async function getAPStats() {
    try {
        return await withPrismaAuth(async (prisma) => {
            const now = new Date()

            // Total payables
            const payables = await prisma.invoice.aggregate({
                where: {
                    type: 'INV_IN',
                    status: { in: ['ISSUED', 'PARTIAL', 'OVERDUE', 'DISPUTED'] }
                },
                _sum: { balanceDue: true },
                _count: true
            })

            // Overdue payables
            const overdue = await prisma.invoice.aggregate({
                where: {
                    type: 'INV_IN',
                    status: { in: ['ISSUED', 'PARTIAL', 'OVERDUE', 'DISPUTED'] },
                    dueDate: { lt: now }
                },
                _sum: { balanceDue: true },
                _count: true
            })

            // This month payments
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
            const monthPayments = await prisma.payment.aggregate({
                where: {
                    supplierId: { not: null },
                    date: { gte: monthStart }
                },
                _sum: { amount: true }
            })

            return {
                totalPayables: Number(payables._sum.balanceDue || 0),
                payablesCount: payables._count,
                overduePayables: Number(overdue._sum.balanceDue || 0),
                overdueCount: overdue._count,
                monthPayments: Number(monthPayments._sum.amount || 0)
            }
        })
    } catch (error) {
        console.error("Failed to fetch AP stats:", error)
        return {
            totalPayables: 0,
            payablesCount: 0,
            overduePayables: 0,
            overdueCount: 0,
            monthPayments: 0
        }
    }
}



// ==========================================
// BILL ACTIONS (Dispute & Pay)
// ==========================================

/**
 * Dispute a vendor bill
 */
export async function disputeBill(billId: string, reason: string) {
    try {
        return await withPrismaAuth(async (prisma) => {
            await prisma.invoice.update({
                where: { id: billId },
                data: {
                    status: 'DISPUTED' as InvoiceStatus,
                    notes: `Dispute Reason: ${reason}\n` + (await prisma.invoice.findUnique({ where: { id: billId }, select: { notes: true } }))?.notes || ''
                }
            })
            return { success: true }
        })
    } catch (error: any) {
        console.error("Failed to dispute bill:", error)
        return { success: false, error: error.message }
    }
}

/**
 * Approve and Pay a vendor bill immediately
 */
export async function approveAndPayBill(
    billId: string,
    paymentDetails: {
        amount: number,
        bankName?: string,
        bankAccountNumber?: string,
        bankAccountName?: string,
        notes?: string
    }
) {
    try {
        return await withPrismaAuth(async (prisma) => {
            // 1. Get Bill
            const bill = await prisma.invoice.findUnique({
                where: { id: billId },
                include: { supplier: true, items: { include: { product: true } } }
            })
            if (!bill) throw new Error("Bill not found")

            // 2. Update Supplier Bank Details if provided
            if (bill.supplierId && paymentDetails.bankAccountNumber) {
                await prisma.supplier.update({
                    where: { id: bill.supplierId },
                    data: {
                        bankName: paymentDetails.bankName,
                        bankAccountNumber: paymentDetails.bankAccountNumber,
                        bankAccountName: paymentDetails.bankAccountName
                    }
                })
            }

            // 3. Approve (Start GL Transaction: Debit Expense, Credit AP)
            // If already ISSUED (Approved), skip this step?

            if (bill.status === 'DRAFT' || bill.status === 'DISPUTED' as InvoiceStatus) { // DRAFT or DISPUTED
                // Update Status
                await prisma.invoice.update({ where: { id: billId }, data: { status: 'ISSUED' } })

                // Post AP Journal (Expense vs AP)
                const glLines: any[] = []
                let totalAmount = 0

                // Add Expense Lines
                for (const item of bill.items) {
                    const amount = Number(item.amount)
                    totalAmount += amount
                    glLines.push({
                        accountCode: '5000', // HPP
                        debit: amount,
                        credit: 0,
                        description: `${item.description}`
                    })
                }

                // Add Tax
                if (Number(bill.taxAmount) > 0) {
                    glLines.push({
                        accountCode: '1330', // PPN Masukan
                        debit: Number(bill.taxAmount),
                        credit: 0,
                        description: `PPN Masukan - Bill ${bill.number}`
                    })
                    totalAmount += Number(bill.taxAmount)
                }

                // Add AP Credit
                glLines.push({
                    accountCode: '2100', // Hutang Usaha
                    debit: 0,
                    credit: totalAmount,
                    description: `Hutang - ${bill.supplier?.name}`
                })

                await postJournalEntry({
                    description: `Bill Approval (Instant Pay) #${bill.number} - ${bill.supplier?.name}`,
                    date: new Date(),
                    reference: bill.number,
                    lines: glLines
                })
            }

            // 4. Pay (Debit AP, Credit Cash/Bank)
            const paymentNumber = `PAY-${Date.now()}` // Simple gen

            // Create Payment Record
            const _payment = await prisma.payment.create({
                data: {
                    number: paymentNumber,
                    amount: paymentDetails.amount,
                    method: 'TRANSFER',
                    date: new Date(),
                    invoiceId: billId,
                    supplierId: bill.supplierId,
                    reference: `REF-${bill.number}`,
                    notes: `Paid to ${paymentDetails.bankName} - ${paymentDetails.bankAccountNumber}`
                }
            })

            // Update Invoice to PAID
            await prisma.invoice.update({
                where: { id: billId },
                data: { status: 'PAID', balanceDue: 0 }
            })

            // Post Cash Journal (Credit Bank 1100, Debit AP 2000)
            await postJournalEntry({
                description: `Payment to ${bill.supplier?.name} for ${bill.number}`,
                date: new Date(),
                reference: paymentNumber,
                lines: [
                    { accountCode: '2100', debit: paymentDetails.amount, credit: 0, description: `Pelunasan Hutang` }, // Debit AP (Hutang Usaha)
                    { accountCode: '1010', debit: 0, credit: paymentDetails.amount, description: `Transfer Bank` } // Credit Bank
                ]
            })

            return { success: true }
        })
    } catch (error: any) {
        console.error("Failed to approve and pay bill:", error)
        return { success: false, error: error.message }
    }
}
