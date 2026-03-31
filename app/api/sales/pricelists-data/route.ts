import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const priceLists = await prisma.priceList.findMany({
            include: {
                _count: {
                    select: {
                        customers: true,
                        priceItems: true,
                    },
                },
                priceItems: {
                    take: 3,
                    where: { isActive: true },
                    include: {
                        product: {
                            select: { name: true, code: true, unit: true, sellingPrice: true },
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                },
            },
            orderBy: { createdAt: 'desc' },
        })

        const initialPriceLists = priceLists.map((pl) => ({
            id: pl.id,
            code: pl.code,
            name: pl.name,
            description: pl.description,
            currency: pl.currency,
            isActive: pl.isActive,
            itemCount: pl._count.priceItems,
            customerCount: pl._count.customers,
            previewItems: pl.priceItems.map((pi) => ({
                productName: pi.product.name,
                productCode: pi.product.code,
                price: Number(pi.price),
                unit: pi.product.unit,
            })),
            createdAt: pl.createdAt.toISOString(),
            updatedAt: pl.updatedAt.toISOString(),
        }))

        return NextResponse.json({ initialPriceLists })
    } catch (e) {
        console.error("[API] sales/pricelists-data:", e)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
