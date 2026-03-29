import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const [transactions, latestBalance] = await Promise.all([
            prisma.pettyCashTransaction.findMany({
                orderBy: { date: "desc" }, take: 200,
                include: {
                    bankAccount: { select: { code: true, name: true } },
                    expenseAccount: { select: { code: true, name: true } },
                },
            }),
            prisma.pettyCashTransaction.findFirst({
                orderBy: { date: "desc" },
                select: { balanceAfter: true },
            }),
        ])

        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        let totalTopup = 0
        let totalDisbursement = 0
        for (const t of transactions) {
            if (t.date >= startOfMonth) {
                if (t.type === "TOPUP") totalTopup += Number(t.amount || 0)
                else totalDisbursement += Number(t.amount || 0)
            }
        }

        const mapped = transactions.map(t => ({
            ...t,
            amount: Number(t.amount || 0),
            balanceAfter: Number(t.balanceAfter || 0),
        }))

        return NextResponse.json({
            transactions: mapped,
            currentBalance: Number(latestBalance?.balanceAfter || 0),
            totalTopup,
            totalDisbursement,
        })
    } catch (error) {
        console.error("[API] finance/petty-cash-data error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
