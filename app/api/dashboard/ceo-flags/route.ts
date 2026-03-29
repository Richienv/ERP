import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const count = await prisma.ceoFlag.count({ where: { status: "PENDING" } })

        return NextResponse.json({ count })
    } catch (e) {
        // Table may not exist yet if migration hasn't been run
        console.error("[API] dashboard/ceo-flags:", e)
        return NextResponse.json({ count: 0 })
    }
}
