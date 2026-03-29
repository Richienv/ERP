import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const data = await prisma.paymentTerm.findMany({
            where: { isActive: true },
            include: { lines: { orderBy: { sequence: "asc" } } },
            orderBy: { days: "asc" },
        })
        return NextResponse.json(data)
    } catch (error) {
        console.error("[API] master/payment-terms", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
