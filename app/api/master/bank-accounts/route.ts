import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { CASH_BANK_CODES, SYS_ACCOUNTS } from "@/lib/gl-accounts"
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
                code: { not: SYS_ACCOUNTS.PETTY_CASH },
                OR: [
                    { code: { in: [...CASH_BANK_CODES] } },
                    { code: { startsWith: "111" } },
                    { name: { contains: "Bank", mode: "insensitive" } },
                ],
            },
            orderBy: { code: "asc" },
            select: { code: true, name: true },
        })
        return NextResponse.json(data)
    } catch (error) {
        console.error("[API] master/bank-accounts", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
