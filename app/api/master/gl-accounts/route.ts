import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const data = await prisma.gLAccount.findMany({
            select: { id: true, code: true, name: true, type: true },
            orderBy: { code: "asc" },
        })

        return NextResponse.json(data)
    } catch (e) {
        console.error("[API] master/gl-accounts:", e)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
