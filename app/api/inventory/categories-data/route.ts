import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const [allCategories, categories] = await Promise.all([
            prisma.category.findMany({
                where: { isActive: true },
                include: {
                    children: {
                        include: { _count: { select: { products: true } } },
                        where: { isActive: true },
                    },
                    _count: { select: { products: true } },
                },
                orderBy: { name: "asc" },
            }),
            prisma.category.findMany({
                where: { isActive: true },
                select: { id: true, name: true, code: true },
                orderBy: { name: "asc" },
            }),
        ])

        return NextResponse.json({ categories, allCategories })
    } catch (e) {
        console.error("[API] categories-data:", e)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
