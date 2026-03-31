import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const entries = await prisma.journalEntry.findMany({
            include: {
                lines: { include: { account: { select: { code: true, name: true } } } },
            },
            orderBy: { date: "desc" }, take: 50,
        })

        const mapped = entries.map(e => ({
            id: e.id, reference: e.reference, date: e.date,
            description: e.description, status: e.status,
            totalDebit: e.lines.reduce((s, l) => s + Number(l.debit || 0), 0),
            totalCredit: e.lines.reduce((s, l) => s + Number(l.credit || 0), 0),
            lines: e.lines.map(l => ({
                id: l.id, accountCode: l.account.code, accountName: l.account.name,
                debit: Number(l.debit || 0), credit: Number(l.credit || 0),
                description: l.description,
            })),
        }))

        return NextResponse.json(mapped)
    } catch (error) {
        console.error("[API] finance/journal-data error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
