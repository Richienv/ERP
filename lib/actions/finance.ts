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

        const [
            ar,
            overdueInvoices,
            ap,
            upcomingPayables,
            cashAccounts,
            expenseLines,
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
                    account: { type: 'EXPENSE' },
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
