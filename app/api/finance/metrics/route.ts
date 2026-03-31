import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        const openStatuses: ("ISSUED" | "PARTIAL" | "OVERDUE")[] = ["ISSUED", "PARTIAL", "OVERDUE"]

        const [
            expenseAccounts, arTotal, arOverdue, apTotal, apUpcoming,
            cashAccounts, recentExpenseLines, monthRevenue, monthExpenses,
            totalCollected, totalPaid
        ] = await Promise.all([
            prisma.gLAccount.findMany({ where: { type: "EXPENSE" }, select: { id: true } }),
            prisma.invoice.aggregate({ _sum: { balanceDue: true }, where: { type: "INV_OUT", status: { in: openStatuses } } }),
            prisma.invoice.findMany({
                where: { type: "INV_OUT", status: { in: openStatuses }, dueDate: { lt: now } },
                include: { customer: { select: { name: true } } },
                orderBy: { dueDate: "asc" }, take: 3,
            }),
            prisma.invoice.aggregate({ _sum: { balanceDue: true }, where: { type: "INV_IN", status: { in: openStatuses } } }),
            prisma.invoice.findMany({
                where: { type: "INV_IN", status: { in: openStatuses }, dueDate: { gte: now } },
                include: { supplier: { select: { name: true } } },
                orderBy: { dueDate: "asc" }, take: 3,
            }),
            prisma.gLAccount.findMany({
                where: { type: "ASSET", code: { gte: "1000", lt: "1100" } },
                select: { balance: true, code: true },
            }),
            prisma.journalLine.findMany({
                where: { entry: { date: { gte: thirtyDaysAgo } } },
                select: { debit: true, accountId: true },
            }),
            prisma.invoice.aggregate({
                _sum: { totalAmount: true },
                where: { type: "INV_OUT", issueDate: { gte: startOfMonth }, status: { not: "CANCELLED" } },
            }),
            prisma.invoice.aggregate({
                _sum: { totalAmount: true },
                where: { type: "INV_IN", issueDate: { gte: startOfMonth }, status: { not: "CANCELLED" } },
            }),
            prisma.invoice.aggregate({ _sum: { totalAmount: true }, where: { type: "INV_OUT", status: "PAID" } }),
            prisma.invoice.aggregate({ _sum: { totalAmount: true }, where: { type: "INV_IN", status: "PAID" } }),
        ])

        // Transform
        const expenseIds = new Set(expenseAccounts.map(a => a.id))
        const burnRate = recentExpenseLines
            .filter(l => expenseIds.has(l.accountId))
            .reduce((sum, l) => sum + Number(l.debit || 0), 0)
        const cashBalance = cashAccounts.reduce((sum, a) => sum + Number(a.balance || 0), 0)

        return NextResponse.json({
            arOutstanding: Number(arTotal._sum.balanceDue || 0),
            arOverdueItems: arOverdue.map(i => ({
                id: i.id, number: i.number, amount: Number(i.balanceDue),
                dueDate: i.dueDate, customerName: i.customer?.name,
            })),
            apOutstanding: Number(apTotal._sum.balanceDue || 0),
            apUpcomingItems: apUpcoming.map(i => ({
                id: i.id, number: i.number, amount: Number(i.balanceDue),
                dueDate: i.dueDate, supplierName: i.supplier?.name,
            })),
            cashBalance,
            burnRate,
            monthRevenue: Number(monthRevenue._sum.totalAmount || 0),
            monthExpenses: Number(monthExpenses._sum.totalAmount || 0),
            totalCollected: Number(totalCollected._sum.totalAmount || 0),
            totalPaid: Number(totalPaid._sum.totalAmount || 0),
        })
    } catch (error) {
        console.error("[API] finance/metrics error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
