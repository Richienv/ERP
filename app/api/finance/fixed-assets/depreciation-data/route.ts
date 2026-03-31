import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const runs = await prisma.fixedAssetDeprecRun.findMany({
            include: { _count: { select: { entries: true } } },
            orderBy: { createdAt: "desc" },
        })

        return NextResponse.json({ success: true, runs })
    } catch (e) {
        console.error("[API] finance/fixed-assets/depreciation-data:", e)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
