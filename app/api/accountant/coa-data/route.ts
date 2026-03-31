import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const accounts = await prisma.gLAccount.findMany({
            orderBy: { code: "asc" },
        })

        return NextResponse.json({ success: true, data: accounts })
    } catch (e) {
        console.error("[API] accountant/coa-data:", e)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
