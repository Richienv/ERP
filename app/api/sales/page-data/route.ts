import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const now = new Date()
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

        const [
            monthlyRevenue,
            orderStats,
            quotationStats,
            leadStats,
            openAR,
            recentOrders,
            recentQuotations,
            recentInvoices,
        ] = await Promise.all([
            prisma.invoice.aggregate({
                _sum: { totalAmount: true },
                where: {
                    type: "INV_OUT",
                    status: { notIn: ["CANCELLED", "VOID"] },
                    issueDate: { gte: monthStart },
                },
            }),
            prisma.salesOrder.groupBy({
                by: ["status"],
                _count: { _all: true },
                _sum: { total: true },
            }),
            prisma.quotation.groupBy({
                by: ["status"],
                _count: { _all: true },
                _sum: { total: true },
            }),
            prisma.lead.groupBy({
                by: ["status"],
                _count: { _all: true },
                _sum: { estimatedValue: true },
            }),
            prisma.invoice.aggregate({
                _sum: { balanceDue: true },
                where: {
                    type: "INV_OUT",
                    status: { in: ["ISSUED", "PARTIAL", "OVERDUE"] },
                },
            }),
            prisma.salesOrder.findMany({
                take: 5,
                orderBy: { orderDate: "desc" },
                include: { customer: { select: { name: true } } },
            }),
            prisma.quotation.findMany({
                take: 4,
                orderBy: { quotationDate: "desc" },
                include: { customer: { select: { name: true } } },
            }),
            prisma.invoice.findMany({
                take: 5,
                where: { type: "INV_OUT" },
                orderBy: { issueDate: "desc" },
                include: { customer: { select: { name: true } } },
            }),
        ])

        return NextResponse.json({
            data: {
                monthlyRevenue,
                orderStats,
                quotationStats,
                leadStats,
                openAR,
                recentOrders: recentOrders.map((o) => ({
                    ...o,
                    total: Number(o.total) || 0,
                })),
                recentQuotations: recentQuotations.map((q) => ({
                    ...q,
                    total: Number(q.total) || 0,
                })),
                recentInvoices: recentInvoices.map((i) => ({
                    ...i,
                    totalAmount: Number(i.totalAmount) || 0,
                    balanceDue: Number(i.balanceDue) || 0,
                })),
            },
        })
    } catch (err: any) {
        console.error("[api/sales/page-data] Error:", err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
