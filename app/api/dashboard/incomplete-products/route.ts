import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const products = await prisma.product.findMany({
            where: {
                isActive: true,
                OR: [
                    { costPrice: 0 },
                    { categoryId: null },
                ],
            },
            select: {
                id: true,
                name: true,
                code: true,
                costPrice: true,
                categoryId: true,
            },
            orderBy: { createdAt: "desc" },
            take: 50,
        })

        return NextResponse.json({
            products: products.map((p) => {
                const missingFields: string[] = []
                if (Number(p.costPrice) === 0) missingFields.push("costPrice")
                if (!p.categoryId) missingFields.push("category")
                return {
                    id: p.id,
                    name: p.name,
                    code: p.code,
                    missingFields,
                }
            }),
        })
    } catch (error) {
        console.error("[API] incomplete-products error:", error)
        return NextResponse.json({ products: [] }, { status: 500 })
    }
}
