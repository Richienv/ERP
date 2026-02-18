import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
    try {
        const [invoices, paidAgg, unpaidAgg, overdueAgg, totalAgg] = await Promise.all([
            prisma.invoice.findMany({
                where: { type: "INV_OUT" },
                orderBy: { issueDate: "desc" },
                take: 20,
                include: { customer: { select: { name: true } } },
            }),
            prisma.invoice.aggregate({
                _sum: { totalAmount: true },
                _count: { _all: true },
                where: { type: "INV_OUT", status: "PAID" },
            }),
            prisma.invoice.aggregate({
                _sum: { totalAmount: true },
                _count: { _all: true },
                where: { type: "INV_OUT", status: { in: ["ISSUED", "PARTIAL", "DRAFT"] } },
            }),
            prisma.invoice.aggregate({
                _sum: { totalAmount: true },
                _count: { _all: true },
                where: { type: "INV_OUT", status: "OVERDUE" },
            }),
            prisma.invoice.aggregate({
                _sum: { totalAmount: true },
                where: { type: "INV_OUT", status: { notIn: ["CANCELLED", "VOID"] } },
            }),
        ])

        const toNumber = (value: unknown, fallback = 0) => {
            const parsed = Number(value)
            return Number.isFinite(parsed) ? parsed : fallback
        }

        return NextResponse.json({
            success: true,
            invoices: invoices.map((inv) => ({
                id: inv.id,
                number: inv.number,
                customerName: inv.customer?.name || "—",
                totalAmount: toNumber(inv.totalAmount),
                status: inv.status,
                issueDate: inv.issueDate,
            })),
            stats: {
                totalRevenue: toNumber(totalAgg._sum.totalAmount),
                paidAmount: toNumber(paidAgg._sum.totalAmount),
                paidCount: paidAgg._count._all,
                unpaidAmount: toNumber(unpaidAgg._sum.totalAmount),
                unpaidCount: unpaidAgg._count._all,
                overdueAmount: toNumber(overdueAgg._sum.totalAmount),
                overdueCount: overdueAgg._count._all,
            },
        })
    } catch (error) {
        console.error("Sales dashboard API error:", error)
        return NextResponse.json({ success: false, invoices: [], stats: {} }, { status: 500 })
    }
}
