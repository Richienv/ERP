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

                let hasMissingPrice = false
                const mappedItems = pr.items.map((item) => {
                    const rawCost = item.product?.costPrice
                    const cost =
                        rawCost === null || rawCost === undefined ? null : Number(rawCost)
                    const hasValidCost = cost !== null && Number.isFinite(cost) && cost > 0
                    if (!hasValidCost) hasMissingPrice = true
                    return {
                        id: item.id,
                        productName: item.product?.name ?? "Produk tidak diketahui",
                        quantity: Number(item.quantity),
                        unit: item.product?.unit ?? "pcs",
                        estimatedPrice: hasValidCost ? (cost as number) : 0,
                    }
                })

                // Item tanpa costPrice akan mendistorsi total — tampilkan null
                // ke UI supaya bisa dirender "—" + warning, alih-alih angka
                // setengah jadi yang menyesatkan keputusan approval.
                const estimatedTotal = hasMissingPrice
                    ? null
                    : mappedItems.reduce(
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
                    hasMissingPrice,
                    createdAt: pr.createdAt,
                }
            }),
        })
    } catch (error) {
        console.error("[API] pending-prs error:", error)
        return NextResponse.json({ prs: [] }, { status: 500 })
    }
}
