'use server'

import { prisma } from "@/lib/prisma"

export interface FinancialMetrics {
    cashBalance: number
    receivables: number // Piutang
    payables: number    // Hutang
    netMargin: number   // %
    revenue: number
    burnRate: number
    overdueInvoices: any[] // List of overdue customer invoices
    upcomingPayables: any[] // List of supplier invoices due soon
    status: {
        cash: 'Healthy' | 'Low' | 'Critical'
        margin: 'Healthy' | 'Low' | 'Critical'
    }
}

export async function getFinancialMetrics(): Promise<FinancialMetrics> {
    try {
        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        startOfMonth.setHours(0, 0, 0, 0)

        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

        // Pre-fetch Expense Account IDs to avoid relation filter in aggregate
        const expenseAccounts = await prisma.gLAccount.findMany({
            where: { type: 'EXPENSE' },
            select: { id: true }
        })
        const expenseAccountIds = expenseAccounts.map(a => a.id)

        const [
            ar,
            overdueInvoices,
            ap,
            upcomingPayables,
            cashAccounts,
            expenseLines, // This will be the result of a simpler query
            revenue,
            expenses
        ] = await Promise.all([
            // 1. Receivables Sum
            prisma.invoice.aggregate({
                _sum: { balanceDue: true },
                where: {
                    type: 'INV_OUT',
                    status: { in: ['ISSUED', 'PARTIAL', 'OVERDUE'] }
                }
            }),
            // 2. Overdue Invoices List
            prisma.invoice.findMany({
                where: {
                    type: 'INV_OUT',
                    status: { in: ['ISSUED', 'PARTIAL', 'OVERDUE'] },
                    dueDate: { lt: new Date() }
                },
                take: 3,
                orderBy: { dueDate: 'asc' },
                include: { customer: { select: { name: true } } }
            }),
            // 3. Payables Sum
            prisma.invoice.aggregate({
                _sum: { balanceDue: true },
                where: {
                    type: 'INV_IN',
                    status: { in: ['ISSUED', 'PARTIAL', 'OVERDUE'] }
                }
            }),
            // 4. Upcoming Payables List
            prisma.invoice.findMany({
                where: {
                    type: 'INV_IN',
                    status: { in: ['ISSUED', 'PARTIAL', 'OVERDUE'] },
                    dueDate: { gte: new Date() }
                },
                take: 3,
                orderBy: { dueDate: 'asc' },
                include: { supplier: { select: { name: true } } }
            }),
            // 5. Cash Balance
            prisma.gLAccount.aggregate({
                _sum: { balance: true },
                where: {
                    type: 'ASSET',
                    code: { in: ['1000', '1010', '1020'] }
                }
            }),
            // 6. Burn Rate (Expenses last 30 days)
            prisma.journalLine.aggregate({
                _sum: { debit: true },
                where: {
                    accountId: { in: expenseAccountIds },
                    entry: { date: { gte: thirtyDaysAgo } }
                }
            }),
            // 7. Revenue (This Month)
            prisma.invoice.aggregate({
                _sum: { totalAmount: true },
                where: {
                    type: 'INV_OUT',
                    issueDate: { gte: startOfMonth },
                    status: { not: 'CANCELLED' }
                }
            }),
            // 8. Expenses (This Month)
            prisma.invoice.aggregate({
                _sum: { totalAmount: true },
                where: {
                    type: 'INV_IN',
                    issueDate: { gte: startOfMonth },
                    status: { not: 'CANCELLED' }
                }
            })
        ])

        const cashBal = cashAccounts._sum.balance?.toNumber() || 0
        const burnRate = (expenseLines._sum.debit?.toNumber() || 0) / 30
        const revVal = revenue._sum.totalAmount?.toNumber() || 0
        const expVal = expenses._sum.totalAmount?.toNumber() || 0
        const margin = revVal > 0 ? ((revVal - expVal) / revVal) * 100 : 0

        return {
            cashBalance: cashBal,
            receivables: ar._sum.balanceDue?.toNumber() || 0,
            payables: ap._sum.balanceDue?.toNumber() || 0,
            netMargin: Number(margin.toFixed(1)),
            revenue: revVal,
            burnRate: burnRate,
            overdueInvoices: overdueInvoices.map(inv => ({
                ...inv,
                subtotal: inv.subtotal?.toNumber() || 0,
                taxAmount: inv.taxAmount?.toNumber() || 0,
                discountAmount: (inv as any).discountAmount?.toNumber() || 0,
                totalAmount: inv.totalAmount?.toNumber() || 0,
                balanceDue: inv.balanceDue?.toNumber() || 0
            })),
            upcomingPayables: upcomingPayables.map(inv => ({
                ...inv,
                subtotal: inv.subtotal?.toNumber() || 0,
                taxAmount: inv.taxAmount?.toNumber() || 0,
                discountAmount: (inv as any).discountAmount?.toNumber() || 0,
                totalAmount: inv.totalAmount?.toNumber() || 0,
                balanceDue: inv.balanceDue?.toNumber() || 0
            })),
            status: {
                cash: cashBal > 100000000 ? 'Healthy' : 'Low',
                margin: margin > 10 ? 'Healthy' : 'Low'
            }
        }

    } catch (error) {
        console.error("Failed to fetch financial metrics:", error)
        return {
            cashBalance: 0,
            receivables: 0,
            payables: 0,
            netMargin: 0,
            revenue: 0,
            burnRate: 0,
            overdueInvoices: [],
            upcomingPayables: [],
            status: { cash: 'Critical', margin: 'Critical' }
        }
    }
}

export async function getGLAccounts() {
    try {
        const accounts = await prisma.gLAccount.findMany({
            orderBy: { code: 'asc' }
        })
        return { success: true, data: accounts }
    } catch (error) {
        console.error("Error fetching GL Accounts:", error)
        return { success: false, error: "Failed to fetch accounts" }
    }
}

// ==========================================
// JOURNAL ENTRY SYSTEM (CORE)
// ==========================================

export async function postJournalEntry(data: {
    description: string
    date: Date
    reference: string
    lines: {
        accountCode: string
        debit: number
        credit: number
        description?: string
    }[]
}) {
    try {
        // 1. Validate Balance (Debit must equal Credit)
        const totalDebit = data.lines.reduce((sum, line) => sum + line.debit, 0)
        const totalCredit = data.lines.reduce((sum, line) => sum + line.credit, 0)

        if (Math.abs(totalDebit - totalCredit) > 0.01) { // Floating point tolerance
            throw new Error(`Unbalanced Journal: Debit (${totalDebit}) != Credit (${totalCredit})`)
        }

        // 2. Fetch Account IDs
        const codes = data.lines.map(l => l.accountCode)
        const accounts = await prisma.gLAccount.findMany({
            where: { code: { in: codes } }
        })

        const accountMap = new Map(accounts.map(a => [a.code, a]))

        // 3. Create Entry & Lines Transactionally
        await prisma.$transaction(async (tx) => {
            // Create Header
            const entry = await tx.journalEntry.create({
                data: {
                    date: data.date,
                    description: data.description,
                    reference: data.reference,
                    status: 'POSTED',
                    lines: {
                        create: data.lines.map(line => {
                            const account = accountMap.get(line.accountCode)
                            if (!account) throw new Error(`Account code not found: ${line.accountCode}`)

                            return {
                                accountId: account.id,
                                debit: line.debit,
                                credit: line.credit,
                                description: line.description || data.description
                            }
                        })
                    }
                }
            })

            // Update Account Balances
            for (const line of data.lines) {
                const account = accountMap.get(line.accountCode)!
                let balanceChange = 0

                if (['ASSET', 'EXPENSE'].includes(account.type)) {
                    balanceChange = line.debit - line.credit
                } else {
                    balanceChange = line.credit - line.debit
                }

                await tx.gLAccount.update({
                    where: { id: account.id },
                    data: { balance: { increment: balanceChange } }
                })
            }
        })

        return { success: true }

        return { success: true }

    } catch (error: any) {
        console.error("Journal Posting Error:", error)
        return { success: false, error: error.message }
    }
}

// ==========================================
// PROCUREMENT INTEGRATION
// ==========================================

export async function recordPendingBillFromPO(po: any) {
    try {
        console.log("Creating/Updating Finance Bill for PO:", po.number)

        // Check if Bill already exists for this PO
        const existingBill = await prisma.invoice.findFirst({
            where: { orderId: po.id, type: 'INV_IN' }
        })

        if (existingBill) {
            console.log("Bill already exists:", existingBill.number)
            return { success: true, billId: existingBill.id }
        }

        // Create new Bill (Invoice Type IN)
        const bill = await prisma.invoice.create({
            data: {
                number: `BILL-${po.number}`, // Simple Bill Number
                type: 'INV_IN',
                supplierId: po.supplierId,
                orderId: po.id,
                status: 'DRAFT', // Needs explicit confirmation in Finance
                issueDate: new Date(),
                dueDate: new Date(new Date().setDate(new Date().getDate() + 30)), // Default 30 days

                // Copy financial connection
                subtotal: po.netAmount || 0, // Using netAmount as subtotal for now
                taxAmount: po.taxAmount || 0,
                totalAmount: po.totalAmount || 0,
                balanceDue: po.totalAmount || 0,

                // Copy Items
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
        return { success: true, billId: bill.id }

    } catch (error) {
        console.error("Failed to record pending bill:", error)
        // We do NOT throw here, so we don't block the PO approval flow.
        // But we should likely log an alert or return error structure.
        return { success: false, error: "Finance Sync Failed" }
    }
}
