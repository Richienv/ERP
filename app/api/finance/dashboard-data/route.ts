import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { CASH_BANK_CODES } from "@/lib/gl-accounts"
import { jsonFail } from "@/lib/http/api-response"
import { requireApiUser } from "@/lib/http/require-api-user"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const user = await requireApiUser()
        if (!user) return jsonFail(401, "Unauthorized", "UNAUTHORIZED")

        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        const cashCodes = new Set<string>(CASH_BANK_CODES)

        const [cashflowEntries, recentEntries, overdueCount, pendingBillCount] = await Promise.all([
            prisma.journalEntry.findMany({
                where: { date: { gte: sevenDaysAgo }, status: "POSTED" },
                include: { lines: { include: { account: { select: { code: true, type: true } } } } },
            }),
            prisma.journalEntry.findMany({
                where: { status: "POSTED" },
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
                if (!cashCodes.has(line.account.code)) continue
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
        }, {
            headers: { "Cache-Control": "private, max-age=0, s-maxage=30, stale-while-revalidate=30" },
        })
    } catch (error) {
        console.error("[API] finance/dashboard-data error:", error)
        return jsonFail(500, "Gagal memuat data dasbor keuangan", "INTERNAL")
    }
}
