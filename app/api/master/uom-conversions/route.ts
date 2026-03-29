import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const data = await prisma.uomConversion.findMany({
            include: {
                fromUnit: { select: { id: true, code: true, name: true } },
                toUnit: { select: { id: true, code: true, name: true } },
            },
            orderBy: { createdAt: "desc" },
        })
        return NextResponse.json(data)
    } catch (error) {
        console.error("[API] master/uom-conversions", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
