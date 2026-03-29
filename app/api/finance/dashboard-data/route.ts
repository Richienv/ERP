import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

        const [cashflowEntries, recentEntries, overdueCount, pendingBillCount] = await Promise.all([
            prisma.journalEntry.findMany({
                where: { date: { gte: sevenDaysAgo } },
                include: { lines: { include: { account: { select: { code: true, type: true } } } } },
            }),
            prisma.journalEntry.findMany({
                orderBy: { date: "desc" }, take: 5,
                include: { lines: { take: 2, include: { account: { select: { name: true, code: true, type: true } } } } },
            }),
            prisma.invoice.count({ where: { status: "OVERDUE", type: "INV_OUT" } }),
            prisma.invoice.count({ where: { status: { in: ["DRAFT", "ISSUED"] }, type: "INV_IN" } }),
        ])

        // Build 7-day cash flow
        const days: Record<string, { inflow: number; outflow: number }> = {}
        for (let i = 6; i >= 0; i--) {
            const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
            days[d.toISOString().slice(0, 10)] = { inflow: 0, outflow: 0 }
        }
        for (const entry of cashflowEntries) {
            const dateKey = entry.date.toISOString().slice(0, 10)
            if (!days[dateKey]) continue
            for (const line of entry.lines) {
                if (!line.account.code.startsWith("10")) continue
                days[dateKey].inflow += Number(line.debit || 0)
                days[dateKey].outflow += Number(line.credit || 0)
            }
        }

        const recentTransactions = recentEntries.map(e => {
            const firstLine = e.lines[0]
            const isIncoming = firstLine?.account.type === "ASSET" && Number(firstLine.debit || 0) > 0
            return {
                id: e.id, date: e.date, reference: e.reference, description: e.description,
                amount: Number(firstLine?.debit || firstLine?.credit || 0),
                direction: isIncoming ? "incoming" : "outgoing",
                accountName: firstLine?.account.name,
            }
        })

        return NextResponse.json({
            cashflow: Object.entries(days).map(([date, v]) => ({ date, ...v })),
            recentTransactions,
            actionItems: { overdueInvoices: overdueCount, pendingBills: pendingBillCount },
        })
    } catch (error) {
        console.error("[API] finance/dashboard-data error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
