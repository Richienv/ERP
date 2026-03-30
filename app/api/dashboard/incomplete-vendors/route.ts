import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const vendors = await prisma.supplier.findMany({
            where: {
                isActive: true,
                AND: [
                    {
                        OR: [
                            { phone: null },
                            { phone: "" },
                            { email: null },
                            { email: "" },
                            { address: null },
                            { address: "" },
                        ],
                    },
                ],
            },
            select: {
                id: true,
                name: true,
                code: true,
                phone: true,
                email: true,
                address: true,
            },
            orderBy: { createdAt: "desc" },
            take: 50,
        })

        return NextResponse.json({
            vendors: vendors.map((v) => {
                const missingFields: string[] = []
                if (!v.phone) missingFields.push("phone")
                if (!v.email) missingFields.push("email")
                if (!v.address) missingFields.push("address")
                return {
                    id: v.id,
                    name: v.name,
                    code: v.code,
                    missingFields,
                }
            }),
        })
    } catch (error) {
        console.error("[API] incomplete-vendors error:", error)
        return NextResponse.json({ vendors: [] }, { status: 500 })
    }
}
