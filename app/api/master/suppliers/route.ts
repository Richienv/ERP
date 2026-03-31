import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const data = await prisma.supplier.findMany({
            orderBy: { name: "asc" },
            select: { id: true, name: true, code: true },
        })
        return NextResponse.json(data)
    } catch (error) {
        console.error("[API] master/suppliers", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
