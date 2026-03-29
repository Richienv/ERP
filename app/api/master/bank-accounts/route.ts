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
            where: {
                type: "ASSET",
                code: { not: "1050" },
                OR: [
                    { code: { startsWith: "1" } },
                    { name: { contains: "Bank", mode: "insensitive" } },
                    { name: { contains: "Kas", mode: "insensitive" } },
                ],
            },
            orderBy: { code: "asc" },
            select: { code: true, name: true },
        })
        // Filter to only bank-type accounts (10xx codes)
        const filtered = data.filter((a: { code: string }) => /^10\d{2}$/.test(a.code))
        return NextResponse.json(filtered)
    } catch (error) {
        console.error("[API] master/bank-accounts", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
