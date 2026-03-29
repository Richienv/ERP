import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const pos = await prisma.purchaseOrder.findMany({
            where: { status: "PENDING_APPROVAL" },
            include: {
                supplier: { select: { name: true, email: true, phone: true, address: true } },
                items: { include: { product: { select: { name: true, code: true } } } },
                purchaseRequests: {
                    take: 1,
                    include: {
                        requester: { select: { firstName: true, lastName: true } },
                        approver: { select: { firstName: true, lastName: true } },
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        })

        const mapped = pos.map(po => {
            const pr = po.purchaseRequests[0]
            return {
                id: po.id,
                number: po.number,
                orderDate: po.orderDate,
                supplier: {
                    name: po.supplier?.name || "Unknown",
                    email: po.supplier?.email || "",
                    phone: po.supplier?.phone || "",
                    address: po.supplier?.address || "",
                },
                totalAmount: Number(po.totalAmount || 0),
                taxAmount: Number(po.taxAmount || 0),
                netAmount: Number(po.netAmount || 0),
                items: po.items.map(item => ({
                    id: item.id,
                    productName: item.product.name,
                    productCode: item.product.code,
                    quantity: item.quantity,
                    unitPrice: Number(item.unitPrice),
                    totalPrice: Number(item.totalPrice),
                })),
                requester: pr?.requester ? `${pr.requester.firstName} ${pr.requester.lastName}` : "System",
                approver: pr?.approver ? `${pr.approver.firstName} ${pr.approver.lastName}` : "-",
            }
        })

        return NextResponse.json({ pendingPOs: mapped })
    } catch (error) {
        console.error("[API] dashboard/approvals error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
