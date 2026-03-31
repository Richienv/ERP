import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const assets = await prisma.fixedAsset.findMany({
            include: {
                category: { select: { name: true, code: true } },
                supplier: { select: { name: true } },
            },
            orderBy: [{ category: { code: "asc" } }, { assetCode: "asc" }],
        })

        return NextResponse.json({ success: true, assets })
    } catch (e) {
        console.error("[API] finance/fixed-assets/reports-data:", e)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
