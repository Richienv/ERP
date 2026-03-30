import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const prs = await prisma.purchaseRequest.findMany({
            where: { status: "PENDING" },
            include: {
                requester: { select: { firstName: true, lastName: true } },
                items: { select: { id: true } },
            },
            orderBy: { createdAt: "desc" },
        })

        return NextResponse.json({
            prs: prs.map((pr) => {
                const reqName = pr.requester
                    ? [pr.requester.firstName, pr.requester.lastName].filter(Boolean).join(" ")
                    : "Tidak Diketahui"
                return {
                    id: pr.id,
                    number: pr.number,
                    requesterName: reqName,
                    itemCount: pr.items.length,
                    createdAt: pr.createdAt,
                }
            }),
        })
    } catch (error) {
        console.error("[API] pending-prs error:", error)
        return NextResponse.json({ prs: [] }, { status: 500 })
    }
}
