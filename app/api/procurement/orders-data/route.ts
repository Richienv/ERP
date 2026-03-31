import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const [orders, vendorsRaw, products] = await Promise.all([
            prisma.purchaseOrder.findMany({
                orderBy: { createdAt: "desc" },
                include: {
                    supplier: { select: { name: true, email: true, phone: true } },
                    items: { select: { id: true, quantity: true } },
                    purchaseRequests: {
                        take: 1,
                        include: {
                            requester: { select: { firstName: true, lastName: true } },
                            approver: { select: { firstName: true, lastName: true } },
                        },
                    },
                },
            }),
            prisma.supplier.findMany({
                where: { isActive: true },
                orderBy: { name: "asc" },
                select: { id: true, name: true, email: true, phone: true },
            }),
            prisma.product.findMany({
                where: { isActive: true },
                orderBy: { name: "asc" },
                include: { supplierItems: { select: { price: true, supplierId: true } } },
            }),
        ])

        const mappedOrders = orders.map(po => {
            const pr = po.purchaseRequests[0]
            return {
                id: po.revision > 0 ? `${po.number} Rev.${po.revision}` : po.number,
                dbId: po.id,
                vendor: po.supplier?.name || "Unknown",
                vendorEmail: po.supplier?.email || "",
                vendorPhone: po.supplier?.phone || "",
                date: new Date(po.orderDate).toLocaleDateString("id-ID"),
                total: Number(po.totalAmount),
                status: po.status,
                revision: po.revision,
                items: po.items?.reduce((sum, item) => sum + Number(item.quantity || 0), 0) || 0,
                eta: po.expectedDate ? new Date(po.expectedDate).toLocaleDateString("id-ID") : "-",
                requester: pr?.requester ? `${pr.requester.firstName} ${pr.requester.lastName}` : "System",
                approver: pr?.approver ? `${pr.approver.firstName} ${pr.approver.lastName}` : "-",
            }
        })

        const mappedProducts = products.map(p => ({
            id: p.id,
            name: p.name,
            code: p.code,
            unit: p.unit,
            defaultPrice: p.supplierItems?.[0]?.price ? Number(p.supplierItems[0].price) : Number(p.costPrice),
        }))

        return NextResponse.json({
            orders: mappedOrders,
            vendors: vendorsRaw,
            products: mappedProducts,
        })
    } catch (error) {
        console.error("[API] procurement/orders-data error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
