import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const now = new Date()

        const [unallocated, openInvoices, unallocatedCount, invoiceCount, recentPayments, customers, todayPayments] = await Promise.all([
            prisma.payment.findMany({
                where: { invoiceId: null, customerId: { not: null } },
                include: { customer: { select: { id: true, name: true } } },
                orderBy: { date: "desc" }, take: 20,
            }),
            prisma.invoice.findMany({
                where: { type: "INV_OUT", status: { in: ["ISSUED", "PARTIAL", "OVERDUE"] }, balanceDue: { gt: 0 } },
                include: { customer: { select: { id: true, name: true } } },
                orderBy: { dueDate: "asc" }, take: 20,
            }),
            prisma.payment.count({ where: { invoiceId: null, customerId: { not: null } } }),
            prisma.invoice.count({ where: { type: "INV_OUT", status: { in: ["ISSUED", "PARTIAL", "OVERDUE"] }, balanceDue: { gt: 0 } } }),
            prisma.payment.findMany({
                where: { invoiceId: { not: null }, customerId: { not: null } },
                orderBy: { createdAt: "desc" }, take: 20,
                select: {
                    id: true, number: true, amount: true, method: true, reference: true, date: true, createdAt: true,
                    customer: { select: { id: true, name: true } },
                    invoice: { select: { id: true, number: true, status: true } },
                },
            }),
            prisma.customer.findMany({
                where: { isActive: true },
                select: { id: true, name: true, code: true },
                orderBy: { name: "asc" },
            }),
            prisma.payment.findMany({
                where: { date: { gte: today }, customerId: { not: null } },
                select: { amount: true },
            }),
        ])

        return NextResponse.json({
            registry: {
                unallocatedPayments: unallocated.map(p => ({ ...p, amount: Number(p.amount || 0) })),
                openInvoices: openInvoices.map(i => ({
                    ...i,
                    totalAmount: Number(i.totalAmount || 0),
                    balanceDue: Number(i.balanceDue || 0),
                    isOverdue: i.dueDate ? i.dueDate < now : false,
                })),
                recentPayments: recentPayments.map(p => ({ ...p, amount: Number(p.amount || 0) })),
                customers,
                paymentPagination: { total: unallocatedCount, page: 1, pageSize: 20 },
                invoicePagination: { total: invoiceCount, page: 1, pageSize: 20 },
            },
            stats: {
                unallocatedTotal: unallocated.reduce((s, p) => s + Number(p.amount || 0), 0),
                unallocatedCount,
                openInvoiceTotal: openInvoices.reduce((s, i) => s + Number(i.balanceDue || 0), 0),
                openInvoiceCount: invoiceCount,
                todayTotal: todayPayments.reduce((s, p) => s + Number(p.amount || 0), 0),
                todayCount: todayPayments.length,
            },
        })
    } catch (error) {
        console.error("[API] finance/ar-payments error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
