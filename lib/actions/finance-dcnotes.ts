'use server'

import { withPrismaAuth, prisma as basePrisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"
import type { DCNoteType, DCNoteStatus } from "@prisma/client"
import { SYS_ACCOUNTS, ensureSystemAccounts } from "@/lib/gl-accounts-server"
import { assertPeriodOpen } from "@/lib/period-helpers"

// ==========================================
// AUTH HELPER (reads don't need withPrismaAuth)
// ==========================================

async function requireAuth() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new Error("Unauthorized")
    return user
}

// ==========================================
// READ OPERATIONS
// ==========================================

/**
 * Get all DC Notes with optional filters
 */
export async function getDCNotes(filters?: {
    type?: DCNoteType
    status?: DCNoteStatus
    customerId?: string
    supplierId?: string
}) {
    try {
        await requireAuth()

        const where: Record<string, unknown> = {}
        if (filters?.type) where.type = filters.type
        if (filters?.status) where.status = filters.status
        if (filters?.customerId) where.customerId = filters.customerId
        if (filters?.supplierId) where.supplierId = filters.supplierId

        const notes = await basePrisma.debitCreditNote.findMany({
            where,
            include: {
                customer: { select: { name: true } },
                supplier: { select: { name: true } },
                items: true,
                originalInvoice: { select: { number: true } },
            },
            orderBy: { issueDate: 'desc' },
        })

        return notes.map(note => ({
            ...note,
            subtotal: Number(note.subtotal),
            ppnAmount: Number(note.ppnAmount),
            totalAmount: Number(note.totalAmount),
            settledAmount: Number(note.settledAmount),
            items: note.items.map(item => ({
                ...item,
                quantity: Number(item.quantity),
                unitPrice: Number(item.unitPrice),
                amount: Number(item.amount),
                ppnAmount: Number(item.ppnAmount),
                totalAmount: Number(item.totalAmount),
            })),
        }))
    } catch (error: unknown) {
        console.error("Failed to fetch DC Notes:", error)
        return []
    }
}

/**
 * Get a single DC Note by ID with full details
 */
export async function getDCNoteById(id: string) {
    try {
        await requireAuth()

        const note = await basePrisma.debitCreditNote.findUnique({
            where: { id },
            include: {
                customer: { select: { id: true, name: true } },
                supplier: { select: { id: true, name: true } },
                items: {
                    include: {
                        product: { select: { id: true, name: true, code: true } },
                    },
                },
                settlements: {
                    include: {
                        invoice: { select: { id: true, number: true } },
                    },
                },
                originalInvoice: { select: { id: true, number: true } },
                journalEntry: {
                    include: {
                        lines: {
                            include: {
                                account: { select: { id: true, code: true, name: true, type: true } },
                            },
                        },
                    },
                },
            },
        })

        if (!note) return null

        return {
            id: note.id,
            number: note.number,
            type: note.type,
            status: note.status,
            reasonCode: note.reasonCode,
            customerId: note.customerId,
            supplierId: note.supplierId,
            originalInvoiceId: note.originalInvoiceId,
            originalReference: note.originalReference,
            issueDate: note.issueDate,
            postingDate: note.postingDate,
            notes: note.notes,
            description: note.description,
            journalEntryId: note.journalEntryId,
            createdAt: note.createdAt,
            updatedAt: note.updatedAt,
            subtotal: Number(note.subtotal),
            ppnAmount: Number(note.ppnAmount),
            totalAmount: Number(note.totalAmount),
            settledAmount: Number(note.settledAmount),
            customer: note.customer,
            supplier: note.supplier,
            originalInvoice: note.originalInvoice,
            items: note.items.map(item => ({
                id: item.id,
                noteId: item.noteId,
                productId: item.productId,
                description: item.description,
                createdAt: item.createdAt,
                product: item.product,
                quantity: Number(item.quantity),
                unitPrice: Number(item.unitPrice),
                amount: Number(item.amount),
                ppnAmount: Number(item.ppnAmount),
                totalAmount: Number(item.totalAmount),
            })),
            settlements: note.settlements.map(s => ({
                id: s.id,
                noteId: s.noteId,
                invoiceId: s.invoiceId,
                createdAt: s.createdAt,
                invoice: s.invoice,
                amount: Number(s.amount),
            })),
            journalEntry: note.journalEntry ? {
                id: note.journalEntry.id,
                date: note.journalEntry.date,
                description: note.journalEntry.description,
                reference: note.journalEntry.reference,
                status: note.journalEntry.status,
                lines: note.journalEntry.lines.map(l => ({
                    id: l.id,
                    entryId: l.entryId,
                    accountId: l.accountId,
                    description: l.description,
                    account: l.account,
                    debit: Number(l.debit),
                    credit: Number(l.credit),
                })),
            } : null,
        }
    } catch (error: unknown) {
        console.error("Failed to fetch DC Note:", error)
        return null
    }
}

/**
 * Get form data for creating a DC Note (customers, suppliers, products, GL accounts, invoices)
 */
export async function getDCNoteFormData(filters?: { customerId?: string; supplierId?: string }) {
    try {
        await requireAuth()

        const [
            customers,
            suppliers,
            products,
            revenueAccounts,
            arAccounts,
            apAccounts,
            expenseAccounts,
            ppnKeluaranAccounts,
            ppnMasukanAccounts,
            outstandingCustomerInvoices,
            outstandingSupplierBills,
        ] = await Promise.all([
            basePrisma.customer.findMany({
                where: { isActive: true },
                select: { id: true, name: true },
                orderBy: { name: 'asc' },
            }),
            basePrisma.supplier.findMany({
                select: { id: true, name: true },
                orderBy: { name: 'asc' },
            }),
            basePrisma.product.findMany({
                select: { id: true, name: true, code: true },
                orderBy: { name: 'asc' },
                take: 500,
            }),
            basePrisma.gLAccount.findMany({
                where: { type: 'REVENUE' },
                select: { id: true, code: true, name: true },
                orderBy: { code: 'asc' },
            }),
            basePrisma.gLAccount.findMany({
                where: {
                    type: 'ASSET',
                    OR: [
                        { name: { contains: 'piutang', mode: 'insensitive' } },
                        { code: SYS_ACCOUNTS.AR },
                    ],
                },
                select: { id: true, code: true, name: true },
                orderBy: { code: 'asc' },
            }),
            basePrisma.gLAccount.findMany({
                where: {
                    type: 'LIABILITY',
                    OR: [
                        { name: { contains: 'utang usaha', mode: 'insensitive' } },
                        { code: SYS_ACCOUNTS.AP },
                    ],
                },
                select: { id: true, code: true, name: true },
                orderBy: { code: 'asc' },
            }),
            basePrisma.gLAccount.findMany({
                where: { type: 'EXPENSE' },
                select: { id: true, code: true, name: true },
                orderBy: { code: 'asc' },
            }),
            basePrisma.gLAccount.findMany({
                where: { code: SYS_ACCOUNTS.PPN_KELUARAN },
                select: { id: true, code: true, name: true },
                orderBy: { code: 'asc' },
            }),
            basePrisma.gLAccount.findMany({
                where: { code: SYS_ACCOUNTS.PPN_MASUKAN },
                select: { id: true, code: true, name: true },
                orderBy: { code: 'asc' },
            }),
            basePrisma.invoice.findMany({
                where: {
                    type: 'INV_OUT',
                    balanceDue: { gt: 0 },
                    status: { notIn: ['CANCELLED', 'VOID', 'DRAFT'] },
                    ...(filters?.customerId ? { customerId: filters.customerId } : {}),
                },
                select: {
                    id: true,
                    number: true,
                    totalAmount: true,
                    balanceDue: true,
                    customerId: true,
                    customer: { select: { name: true } },
                },
                orderBy: { issueDate: 'desc' },
            }),
            basePrisma.invoice.findMany({
                where: {
                    type: 'INV_IN',
                    balanceDue: { gt: 0 },
                    status: { notIn: ['CANCELLED', 'VOID', 'DRAFT'] },
                    ...(filters?.supplierId ? { supplierId: filters.supplierId } : {}),
                },
                select: {
                    id: true,
                    number: true,
                    totalAmount: true,
                    balanceDue: true,
                    supplierId: true,
                    supplier: { select: { name: true } },
                },
                orderBy: { issueDate: 'desc' },
            }),
        ])

        return {
            customers,
            suppliers,
            products,
            revenueAccounts,
            arAccounts,
            apAccounts,
            expenseAccounts,
            ppnKeluaranAccounts,
            ppnMasukanAccounts,
            outstandingCustomerInvoices: outstandingCustomerInvoices.map(inv => ({
                ...inv,
                totalAmount: Number(inv.totalAmount),
                balanceDue: Number(inv.balanceDue),
            })),
            outstandingSupplierBills: outstandingSupplierBills.map(inv => ({
                ...inv,
                totalAmount: Number(inv.totalAmount),
                balanceDue: Number(inv.balanceDue),
            })),
        }
    } catch (error: unknown) {
        console.error("Failed to fetch DC Note form data:", error)
        return {
            customers: [],
            suppliers: [],
            products: [],
            revenueAccounts: [],
            arAccounts: [],
            apAccounts: [],
            expenseAccounts: [],
            ppnKeluaranAccounts: [],
            ppnMasukanAccounts: [],
            outstandingCustomerInvoices: [],
            outstandingSupplierBills: [],
        }
    }
}

// ==========================================
// WRITE OPERATIONS
// ==========================================

/**
 * Create a new Debit/Credit Note
 */
export async function createDCNote(input: {
    type: DCNoteType
    reasonCode: string
    customerId?: string
    supplierId?: string
    originalInvoiceId?: string
    originalReference?: string
    issueDate: Date
    notes?: string
    description?: string
    accountId?: string // User-selected GL account UUID (Revenue/Expense)
    items: {
        productId?: string
        description: string
        quantity: number
        unitPrice: number
        includePPN: boolean
    }[]
}) {
    try {
        // Fiscal period check
        await assertPeriodOpen(input.issueDate)

        return await withPrismaAuth(async (prisma) => {
            // Validate party based on type
            const isSalesType = input.type === 'SALES_CN' || input.type === 'SALES_DN'
            const isPurchaseType = input.type === 'PURCHASE_DN' || input.type === 'PURCHASE_CN'

            if (isSalesType && !input.customerId) {
                return { success: false as const, error: "Customer wajib dipilih untuk nota penjualan" }
            }
            if (isPurchaseType && !input.supplierId) {
                return { success: false as const, error: "Supplier wajib dipilih untuk nota pembelian" }
            }

            if (!input.items || input.items.length === 0) {
                return { success: false as const, error: "Minimal satu item diperlukan" }
            }

            if (!input.accountId) {
                return { success: false as const, error: "Pilih akun COA (pendapatan/beban) terlebih dahulu" }
            }

            // Look up GL account code from accountId (user-selected COA)
            let glAccountCode: string | null = null
            if (input.accountId) {
                const glAccount = await prisma.gLAccount.findUnique({
                    where: { id: input.accountId },
                    select: { code: true },
                })
                if (glAccount) glAccountCode = glAccount.code
                else return { success: false as const, error: "Akun COA tidak ditemukan" }
            }

            // Generate number based on type
            const prefixMap: Record<string, string> = {
                SALES_CN: 'CN-S',
                SALES_DN: 'DN-S',
                PURCHASE_DN: 'DN-P',
                PURCHASE_CN: 'CN-P',
            }
            const prefix = prefixMap[input.type]

            const existingCount = await prisma.debitCreditNote.count({
                where: { number: { startsWith: prefix } },
            })
            const noteNumber = `${prefix}-${String(existingCount + 1).padStart(5, '0')}`

            // Calculate item amounts
            const itemsData = input.items.map(item => {
                const amount = item.quantity * item.unitPrice
                const ppnAmount = item.includePPN ? Math.round(amount * 0.11) : 0
                const totalAmount = amount + ppnAmount
                return {
                    productId: item.productId || null,
                    description: item.description,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    amount,
                    ppnAmount,
                    totalAmount,
                }
            })

            // Calculate header totals
            const subtotal = itemsData.reduce((sum, item) => sum + item.amount, 0)
            const ppnAmount = itemsData.reduce((sum, item) => sum + item.ppnAmount, 0)
            const totalAmount = subtotal + ppnAmount

            // Create note + items
            const note = await prisma.debitCreditNote.create({
                data: {
                    number: noteNumber,
                    type: input.type,
                    status: 'DRAFT',
                    reasonCode: input.reasonCode as any,
                    customerId: isSalesType ? input.customerId : null,
                    supplierId: isPurchaseType ? input.supplierId : null,
                    originalInvoiceId: input.originalInvoiceId && input.originalInvoiceId !== "none" ? input.originalInvoiceId : null,
                    originalReference: input.originalReference || null,
                    issueDate: input.issueDate,
                    notes: input.notes || null,
                    description: input.description || null,
                    glAccountCode,
                    subtotal,
                    ppnAmount,
                    totalAmount,
                    items: {
                        create: itemsData,
                    },
                },
            })

            return { success: true as const, id: note.id, number: note.number }
        })
    } catch (error: unknown) {
        const msg = (error as Error).message || "Gagal membuat nota"
        console.error("Failed to create DC Note:", msg, error)
        return { success: false as const, error: `Gagal membuat nota: ${msg}` }
    }
}

/**
 * Combined create + post in a single server call (avoids double round-trip)
 */
export async function createAndPostDCNote(input: Parameters<typeof createDCNote>[0]) {
    const createResult = await createDCNote(input)
    if (!createResult.success) return createResult

    const postResult = await postDCNote(createResult.id!)
    if (!postResult.success) {
        return { success: false as const, error: `Nota ${createResult.number} tersimpan, tapi gagal diposting: ${postResult.error}`, id: createResult.id, number: createResult.number }
    }

    return { success: true as const, id: createResult.id, number: createResult.number, posted: true }
}

/**
 * Post a DC Note — creates journal entry and updates GL balances
 */
export async function postDCNote(id: string) {
    try {
        return await withPrismaAuth(async (prisma) => {
            const note = await prisma.debitCreditNote.findUnique({
                where: { id },
                include: { items: true },
            })

            if (!note) return { success: false as const, error: "Nota tidak ditemukan" }

            // Fiscal period check based on note's issue date
            await assertPeriodOpen(note.issueDate)
            if (note.status !== 'DRAFT') return { success: false as const, error: "Hanya nota DRAFT yang bisa diposting" }

            const subtotal = Number(note.subtotal)
            const ppnAmount = Number(note.ppnAmount)
            const totalAmount = Number(note.totalAmount)

            // Resolve user-selected COA (stored on note) or fall back to system default
            await ensureSystemAccounts()
            const userSelectedCode = note.glAccountCode
            const isSalesNoteType = note.type === 'SALES_CN' || note.type === 'SALES_DN'
            const defaultCode = isSalesNoteType ? SYS_ACCOUNTS.REVENUE : SYS_ACCOUNTS.EXPENSE_DEFAULT
            const coaCode = userSelectedCode || defaultCode

            const [coaAccount, arAccount, apAccount, ppnKeluaranAccount, ppnMasukanAccount] = await Promise.all([
                prisma.gLAccount.findFirst({ where: { code: coaCode } }),
                prisma.gLAccount.findFirst({ where: { code: SYS_ACCOUNTS.AR } }),
                prisma.gLAccount.findFirst({ where: { code: SYS_ACCOUNTS.AP } }),
                prisma.gLAccount.findFirst({ where: { code: SYS_ACCOUNTS.PPN_KELUARAN } }),
                prisma.gLAccount.findFirst({ where: { code: SYS_ACCOUNTS.PPN_MASUKAN } }),
            ])

            if (!coaAccount) return { success: false as const, error: `Akun COA (${coaCode}) tidak ditemukan` }

            // Build journal lines — uses user-selected COA instead of hardcoded defaults
            const journalLines: { accountId: string; debit: number; credit: number; description: string }[] = []

            if (note.type === 'SALES_CN') {
                if (!arAccount) return { success: false as const, error: "Akun Piutang tidak ditemukan" }
                journalLines.push({ accountId: coaAccount.id, debit: subtotal, credit: 0, description: `Retur/potongan penjualan - ${note.number}` })
                if (ppnAmount > 0 && ppnKeluaranAccount) journalLines.push({ accountId: ppnKeluaranAccount.id, debit: ppnAmount, credit: 0, description: `PPN Keluaran retur - ${note.number}` })
                journalLines.push({ accountId: arAccount.id, debit: 0, credit: totalAmount, description: `Pengurangan piutang - ${note.number}` })
            } else if (note.type === 'SALES_DN') {
                if (!arAccount) return { success: false as const, error: "Akun Piutang tidak ditemukan" }
                journalLines.push({ accountId: arAccount.id, debit: totalAmount, credit: 0, description: `Tambahan piutang - ${note.number}` })
                journalLines.push({ accountId: coaAccount.id, debit: 0, credit: subtotal, description: `Tambahan pendapatan - ${note.number}` })
                if (ppnAmount > 0 && ppnKeluaranAccount) journalLines.push({ accountId: ppnKeluaranAccount.id, debit: 0, credit: ppnAmount, description: `PPN Keluaran tambahan - ${note.number}` })
            } else if (note.type === 'PURCHASE_DN') {
                if (!apAccount) return { success: false as const, error: "Akun Hutang tidak ditemukan" }
                journalLines.push({ accountId: apAccount.id, debit: totalAmount, credit: 0, description: `Pengurangan hutang - ${note.number}` })
                journalLines.push({ accountId: coaAccount.id, debit: 0, credit: subtotal, description: `Retur pembelian - ${note.number}` })
                if (ppnAmount > 0 && ppnMasukanAccount) journalLines.push({ accountId: ppnMasukanAccount.id, debit: 0, credit: ppnAmount, description: `PPN Masukan retur - ${note.number}` })
            } else if (note.type === 'PURCHASE_CN') {
                if (!apAccount) return { success: false as const, error: "Akun Hutang tidak ditemukan" }
                journalLines.push({ accountId: coaAccount.id, debit: subtotal, credit: 0, description: `Kredit pembelian - ${note.number}` })
                if (ppnAmount > 0 && ppnMasukanAccount) journalLines.push({ accountId: ppnMasukanAccount.id, debit: ppnAmount, credit: 0, description: `PPN Masukan kredit - ${note.number}` })
                journalLines.push({ accountId: apAccount.id, debit: 0, credit: totalAmount, description: `Pengurangan hutang - ${note.number}` })
            }

            // Validate journal is balanced
            const totalDebit = journalLines.reduce((sum, l) => sum + l.debit, 0)
            const totalCredit = journalLines.reduce((sum, l) => sum + l.credit, 0)
            if (Math.abs(totalDebit - totalCredit) > 0.01) {
                return { success: false as const, error: `Jurnal tidak seimbang: Debit ${totalDebit} != Kredit ${totalCredit}` }
            }

            // Create journal entry + update GL balances + update note status
            const journalEntry = await prisma.journalEntry.create({
                data: {
                    date: new Date(),
                    description: `${note.type === 'SALES_CN' ? 'Nota Kredit Penjualan' : note.type === 'SALES_DN' ? 'Nota Debit Penjualan' : note.type === 'PURCHASE_DN' ? 'Nota Debit Pembelian' : 'Nota Kredit Pembelian'} ${note.number}`,
                    reference: note.number,
                    status: 'POSTED',
                    lines: {
                        create: journalLines,
                    },
                },
            })

            // Update GL account balances — batch fetch account types then update in parallel
            const uniqueAccountIds = [...new Set(journalLines.map(l => l.accountId))]
            const accounts = await prisma.gLAccount.findMany({
                where: { id: { in: uniqueAccountIds } },
                select: { id: true, type: true },
            })
            const accountTypeMap = new Map(accounts.map(a => [a.id, a.type]))

            await Promise.all(journalLines.map(line => {
                const accountType = accountTypeMap.get(line.accountId)
                if (!accountType) return Promise.resolve()

                const balanceChange = (accountType === 'ASSET' || accountType === 'EXPENSE')
                    ? line.debit - line.credit
                    : line.credit - line.debit

                return prisma.gLAccount.update({
                    where: { id: line.accountId },
                    data: { balance: { increment: balanceChange } },
                })
            }))

            // Update note status
            await prisma.debitCreditNote.update({
                where: { id },
                data: {
                    status: 'POSTED',
                    postingDate: new Date(),
                    journalEntryId: journalEntry.id,
                },
            })

            // Auto-settle against linked invoice when posting
            if (note.originalInvoiceId) {
                const linkedInvoice = await prisma.invoice.findUnique({
                    where: { id: note.originalInvoiceId },
                    select: { id: true, balanceDue: true, status: true },
                })
                if (linkedInvoice && Number(linkedInvoice.balanceDue) > 0) {
                    const settlementAmount = Math.min(totalAmount, Number(linkedInvoice.balanceDue))

                    await prisma.debitCreditNoteSettlement.create({
                        data: { noteId: id, invoiceId: note.originalInvoiceId, amount: settlementAmount },
                    })

                    const newBalance = Number(linkedInvoice.balanceDue) - settlementAmount
                    await prisma.invoice.update({
                        where: { id: note.originalInvoiceId },
                        data: {
                            balanceDue: Math.max(0, newBalance),
                            status: newBalance <= 0.01 ? 'PAID' : linkedInvoice.status,
                        },
                    })

                    const newNoteStatus = settlementAmount >= totalAmount - 0.01 ? 'APPLIED' : 'PARTIAL'
                    await prisma.debitCreditNote.update({
                        where: { id },
                        data: { settledAmount: settlementAmount, status: newNoteStatus },
                    })
                }
            }

            return { success: true as const }
        })
    } catch (error: unknown) {
        console.error("Failed to post DC Note:", error)
        return { success: false as const, error: (error as Error).message || "Gagal memposting nota" }
    }
}

/**
 * Settle a DC Note against one or more invoices
 */
export async function settleDCNote(noteId: string, settlements: { invoiceId: string; amount: number }[]) {
    try {
        // Fiscal period check
        await assertPeriodOpen(new Date())

        return await withPrismaAuth(async (prisma) => {
            const note = await prisma.debitCreditNote.findUnique({
                where: { id: noteId },
                include: { settlements: true },
            })

            if (!note) return { success: false as const, error: "Nota tidak ditemukan" }
            if (note.status !== 'POSTED' && note.status !== 'PARTIAL') {
                return { success: false as const, error: "Nota harus berstatus POSTED atau PARTIAL untuk diselesaikan" }
            }

            const currentSettled = Number(note.settledAmount)
            const totalNewSettlement = settlements.reduce((sum, s) => sum + s.amount, 0)
            const noteTotal = Number(note.totalAmount)

            if (currentSettled + totalNewSettlement > noteTotal + 0.01) {
                return { success: false as const, error: `Total settlement (${currentSettled + totalNewSettlement}) melebihi total nota (${noteTotal})` }
            }

            // Create settlements and update invoices
            for (const settlement of settlements) {
                if (settlement.amount <= 0) continue

                // Validate invoice exists and has sufficient balance
                const invoice = await prisma.invoice.findUnique({
                    where: { id: settlement.invoiceId },
                    select: { id: true, balanceDue: true, status: true },
                })
                if (!invoice) {
                    return { success: false as const, error: `Invoice ${settlement.invoiceId} tidak ditemukan` }
                }

                // Create settlement record
                await prisma.debitCreditNoteSettlement.create({
                    data: {
                        noteId,
                        invoiceId: settlement.invoiceId,
                        amount: settlement.amount,
                    },
                })

                // Update invoice balance
                const newBalance = Number(invoice.balanceDue) - settlement.amount
                const newStatus = newBalance <= 0.01 ? 'PAID' : invoice.status
                await prisma.invoice.update({
                    where: { id: settlement.invoiceId },
                    data: {
                        balanceDue: Math.max(0, newBalance),
                        status: newStatus as any,
                    },
                })
            }

            // Update note settled amount and status
            const newSettledAmount = currentSettled + totalNewSettlement
            const newStatus = newSettledAmount >= noteTotal - 0.01 ? 'APPLIED' : 'PARTIAL'

            await prisma.debitCreditNote.update({
                where: { id: noteId },
                data: {
                    settledAmount: newSettledAmount,
                    status: newStatus,
                },
            })

            return { success: true as const }
        })
    } catch (error: unknown) {
        console.error("Failed to settle DC Note:", error)
        return { success: false as const, error: (error as Error).message || "Gagal menyelesaikan nota" }
    }
}

/**
 * Void a DC Note — reverse all settlements and journal entries
 */
export async function voidDCNote(id: string) {
    try {
        // Fiscal period check
        await assertPeriodOpen(new Date())

        return await withPrismaAuth(async (prisma) => {
            const note = await prisma.debitCreditNote.findUnique({
                where: { id },
                include: {
                    settlements: true,
                    journalEntry: {
                        include: {
                            lines: {
                                include: {
                                    account: { select: { id: true, type: true } },
                                },
                            },
                        },
                    },
                },
            })

            if (!note) return { success: false as const, error: "Nota tidak ditemukan" }
            if (note.status === 'VOID') return { success: false as const, error: "Nota sudah dibatalkan" }

            // 1. Reverse settlements — add amounts back to invoice balanceDue
            if (note.settlements.length > 0) {
                for (const settlement of note.settlements) {
                    await prisma.invoice.update({
                        where: { id: settlement.invoiceId },
                        data: {
                            balanceDue: { increment: Number(settlement.amount) },
                            // Reset invoice status if it was PAID — set back to ISSUED
                            status: 'ISSUED',
                        },
                    })
                }
                // Delete all settlement records
                await prisma.debitCreditNoteSettlement.deleteMany({
                    where: { noteId: id },
                })
            }

            // 2. Reverse journal entry — create reversal entry, reverse GL balances
            if (note.journalEntry) {
                const originalLines = note.journalEntry.lines

                // Create reversal journal entry (swap debits and credits)
                await prisma.journalEntry.create({
                    data: {
                        date: new Date(),
                        description: `Pembatalan: ${note.journalEntry.description}`,
                        reference: `VOID-${note.number}`,
                        status: 'POSTED',
                        lines: {
                            create: originalLines.map(line => ({
                                accountId: line.accountId,
                                debit: Number(line.credit),   // Swap
                                credit: Number(line.debit),   // Swap
                                description: `Pembatalan - ${line.description || ''}`,
                            })),
                        },
                    },
                })

                // Reverse GL account balances
                for (const line of originalLines) {
                    const accountType = line.account.type
                    // The original posting applied: ASSET/EXPENSE: debit-credit, LIABILITY/REVENUE/EQUITY: credit-debit
                    // To reverse, we apply the opposite
                    let reverseChange = 0
                    if (accountType === 'ASSET' || accountType === 'EXPENSE') {
                        reverseChange = Number(line.credit) - Number(line.debit) // opposite of original
                    } else {
                        reverseChange = Number(line.debit) - Number(line.credit) // opposite of original
                    }

                    await prisma.gLAccount.update({
                        where: { id: line.accountId },
                        data: { balance: { increment: reverseChange } },
                    })
                }

                // Void the original journal entry
                await prisma.journalEntry.update({
                    where: { id: note.journalEntry.id },
                    data: { status: 'VOID' },
                })
            }

            // 3. Update note status to VOID
            await prisma.debitCreditNote.update({
                where: { id },
                data: {
                    status: 'VOID',
                    settledAmount: 0,
                },
            })

            return { success: true as const }
        })
    } catch (error: unknown) {
        console.error("Failed to void DC Note:", error)
        return { success: false as const, error: (error as Error).message || "Gagal membatalkan nota" }
    }
}
