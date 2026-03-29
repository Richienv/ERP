import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const categories = await prisma.fixedAssetCategory.findMany({
            include: {
                assetAccount: { select: { id: true, code: true, name: true } },
                accDepAccount: { select: { id: true, code: true, name: true } },
                depExpAccount: { select: { id: true, code: true, name: true } },
                gainLossAccount: { select: { id: true, code: true, name: true } },
                _count: { select: { assets: true } },
            },
            orderBy: { code: "asc" },
        })

        return NextResponse.json({ success: true, categories })
    } catch (e) {
        console.error("[API] finance/fixed-assets/categories-data:", e)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
