import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const [expenses, expenseAccounts, revenueAccounts, cashAccounts] = await Promise.all([
            prisma.journalEntry.findMany({
                where: { description: { startsWith: "[EXPENSE]" } },
                include: { lines: { include: { account: { select: { id: true, code: true, name: true } } } } },
                orderBy: { date: "desc" }, take: 200,
            }),
            prisma.gLAccount.findMany({
                where: { type: "EXPENSE" },
                select: { id: true, code: true, name: true },
                orderBy: { code: "asc" },
            }),
            prisma.gLAccount.findMany({
                where: { type: "REVENUE" },
                select: { id: true, code: true, name: true },
                orderBy: { code: "asc" },
            }),
            prisma.gLAccount.findMany({
                where: {
                    type: "ASSET",
                    OR: [
                        { name: { contains: "kas", mode: "insensitive" } },
                        { name: { contains: "cash", mode: "insensitive" } },
                        { name: { contains: "bank", mode: "insensitive" } },
                        { code: { in: ["1000", "1010", "1020", "1100", "1110"] } },
                    ],
                },
                select: { id: true, code: true, name: true },
            }),
        ])

        const mapped = expenses.map(e => {
            const match = e.description?.match(/^\[EXPENSE\]\s*(.+?):\s*(.+)$/)
            const debitLine = e.lines.find(l => Number(l.debit || 0) > 0)
            const creditLine = e.lines.find(l => Number(l.credit || 0) > 0)
            return {
                id: e.id, date: e.date, reference: e.reference,
                category: match?.[1] || "Lain-lain",
                description: match?.[2] || e.description,
                amount: Number(debitLine?.debit || 0),
                expenseAccount: debitLine?.account,
                cashAccount: creditLine?.account,
                status: e.status,
            }
        })

        return NextResponse.json({ expenses: mapped, expenseAccounts, revenueAccounts, cashAccounts })
    } catch (error) {
        console.error("[API] finance/expenses-data error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
