import { prisma } from "@/lib/db"
import { jsonFail, jsonOk } from "@/lib/http/api-response"
import { requireApiUser } from "@/lib/http/require-api-user"
import { isModuleEnabled } from "@/lib/sidebar-feature-flags"

export const dynamic = "force-dynamic"

export async function GET() {
    const user = await requireApiUser()
    if (!user) return jsonFail(401, "Unauthorized", "UNAUTHORIZED")

    try {
        const [recentPOs, recentCustomers, productsRaw, recentPayments, topRevenueSources, activeWorkOrders] = await Promise.all([
            prisma.purchaseOrder.findMany({
                where: { status: { notIn: ["CANCELLED"] } },
                select: {
                    id: true, number: true, status: true,
                    totalAmount: true,
                    supplier: { select: { name: true } },
                },
                orderBy: { createdAt: "desc" },
                take: 3,
            }),
            prisma.customer.findMany({
                where: { isActive: true },
                select: {
                    id: true, name: true, createdAt: true,
                    customerType: true,
                    _count: { select: { Invoice: true } },
                },
                orderBy: { createdAt: "desc" },
                take: 3,
            }),
            prisma.product.findMany({
                where: { isActive: true },
                select: {
                    id: true, name: true, code: true, minStock: true,
                    stockLevels: { select: { quantity: true } },
                },
                take: 5,
            }),
            prisma.payment.findMany({
                select: {
                    id: true, amount: true, date: true, method: true,
                    invoice: {
                        select: {
                            type: true, number: true,
                            customer: { select: { name: true } },
                            supplier: { select: { name: true } },
                        },
                    },
                },
                orderBy: { date: "desc" },
                take: 5,
            }),
            prisma.invoice.findMany({
                where: { type: "INV_OUT", status: "PAID" },
                select: {
                    id: true, number: true, totalAmount: true,
                    customer: { select: { name: true } },
                },
                orderBy: { totalAmount: "desc" },
                take: 3,
            }),
            isModuleEnabled("manufacturing")
                ? prisma.workOrder.findMany({
                    where: { status: { in: ["PLANNED", "IN_PROGRESS"] } },
                    select: {
                        id: true, number: true, status: true,
                        product: { select: { name: true } },
                        plannedQty: true, actualQty: true,
                    },
                    orderBy: { createdAt: "desc" },
                    take: 3,
                })
                : Promise.resolve([]),
        ])

        const products = productsRaw.map((p) => ({
            id: p.id,
            name: p.name,
            code: p.code,
            minStock: p.minStock,
            totalStock: p.stockLevels.reduce((sum, sl) => sum + Number(sl.quantity ?? 0), 0),
        })).sort((a, b) => a.totalStock - b.totalStock)

        return jsonOk({
            recentPOs: recentPOs.map((po) => ({
                id: po.id,
                number: po.number,
                status: String(po.status),
                totalAmount: Number(po.totalAmount ?? 0),
                supplier: po.supplier?.name ?? "—",
            })),
            recentCustomers: recentCustomers.map((c) => ({
                id: c.id,
                name: c.name,
                customerType: String(c.customerType),
                createdAt: c.createdAt?.toISOString?.() ?? new Date().toISOString(),
                invoiceCount: c._count?.Invoice ?? 0,
            })),
            products,
            recentPayments: recentPayments.map((p) => ({
                id: p.id,
                amount: Number(p.amount ?? 0),
                date: p.date?.toISOString?.() ?? new Date().toISOString(),
                method: String(p.method ?? "TRANSFER"),
                type: p.invoice?.type === "INV_OUT" ? "INCOMING" : "OUTGOING",
                counterparty: p.invoice?.customer?.name ?? p.invoice?.supplier?.name ?? "—",
                invoiceNumber: p.invoice?.number ?? null,
            })),
            topRevenueSources: topRevenueSources.map((inv) => ({
                id: inv.id,
                number: inv.number,
                totalAmount: Number(inv.totalAmount ?? 0),
                customer: inv.customer?.name ?? "—",
            })),
            activeWorkOrders: activeWorkOrders.map((wo) => ({
                id: wo.id,
                number: wo.number,
                status: String(wo.status),
                product: wo.product?.name ?? "—",
                plannedQty: wo.plannedQty ?? 0,
                actualQty: wo.actualQty ?? 0,
            })),
        }, { cache: "DASHBOARD" })
    } catch (error) {
        console.error("[API] dashboard/details:", error)
        return jsonFail(500, "Gagal memuat detail dasbor", "INTERNAL")
    }
}
