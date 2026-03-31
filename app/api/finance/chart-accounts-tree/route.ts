import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const [accounts, balances] = await Promise.all([
            prisma.gLAccount.findMany({ orderBy: { code: "asc" } }),
            prisma.journalLine.groupBy({
                by: ["accountId"],
                _sum: { debit: true, credit: true },
            }),
        ])

        const balanceMap = new Map(
            balances.map(b => [b.accountId, Number(b._sum.debit || 0) - Number(b._sum.credit || 0)])
        )

        const mapped = accounts.map(a => ({
            id: a.id, code: a.code, name: a.name, type: a.type,
            parentId: a.parentId,
            balance: Number(a.balance || 0),
            calculatedBalance: balanceMap.get(a.id) || 0,
        }))

        return NextResponse.json(mapped)
    } catch (error) {
        console.error("[API] finance/chart-accounts-tree error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
