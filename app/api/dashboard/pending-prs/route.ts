import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const prs = await prisma.purchaseRequest.findMany({
            where: { status: "PENDING" },
            include: {
                requester: { select: { firstName: true, lastName: true } },
                items: {
                    select: {
                        id: true,
                        quantity: true,
                        status: true,
                        product: {
                            select: {
                                name: true,
                                unit: true,
                                costPrice: true,
                            },
                        },
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        })

        return NextResponse.json({
            prs: prs.map((pr) => {
                const reqName = pr.requester
                    ? [pr.requester.firstName, pr.requester.lastName].filter(Boolean).join(" ")
                    : "Tidak Diketahui"

                const mappedItems = pr.items.map((item) => ({
                    id: item.id,
                    productName: item.product?.name ?? "Produk tidak diketahui",
                    quantity: item.quantity,
                    unit: item.product?.unit ?? "pcs",
                    estimatedPrice: Number(item.product?.costPrice ?? 0),
                }))

                const estimatedTotal = mappedItems.reduce(
                    (sum: number, item) => sum + item.quantity * item.estimatedPrice,
                    0
                )

                return {
                    id: pr.id,
                    number: pr.number,
                    requesterName: reqName,
                    department: pr.department,
                    priority: pr.priority,
                    notes: pr.notes,
                    itemCount: pr.items.length,
                    items: mappedItems,
                    estimatedTotal,
                    createdAt: pr.createdAt,
                }
            }),
        })
    } catch (error) {
        console.error("[API] pending-prs error:", error)
        return NextResponse.json({ prs: [] }, { status: 500 })
    }
}
