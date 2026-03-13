import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
        }

        // Fetch only bank accounts (name contains "bank")
        const accounts = await prisma.gLAccount.findMany({
            where: {
                type: "ASSET",
                name: { contains: "bank", mode: "insensitive" },
            },
            select: { id: true, code: true, name: true, balance: true },
            orderBy: { code: "asc" },
        })

        // Fetch reconciliations separately — table may not exist yet after migration
        let reconciliations: Array<{
            id: string
            glAccountCode: string
            glAccountName: string
            statementDate: string
            periodStart: string
            periodEnd: string
            status: string
            itemCount: number
            matchedCount: number
            unmatchedCount: number
            totalBankAmount: number
            createdAt: string
        }> = []

        try {
            const recs = await prisma.bankReconciliation.findMany({
                include: {
                    glAccount: { select: { code: true, name: true } },
                    items: { select: { matchStatus: true, bankAmount: true } },
                },
                orderBy: { statementDate: "desc" },
                take: 50,
            })

            reconciliations = recs.map((r) => {
                const matchedCount = r.items.filter((i) => i.matchStatus === "MATCHED").length
                const unmatchedCount = r.items.filter((i) => i.matchStatus === "UNMATCHED").length
                const totalBank = r.items.reduce((s, i) => s + Number(i.bankAmount), 0)

                return {
                    id: r.id,
                    glAccountCode: r.glAccount.code,
                    glAccountName: r.glAccount.name,
                    statementDate: r.statementDate.toISOString(),
                    periodStart: r.periodStart.toISOString(),
                    periodEnd: r.periodEnd.toISOString(),
                    status: r.status,
                    itemCount: r.items.length,
                    matchedCount,
                    unmatchedCount,
                    totalBankAmount: totalBank,
                    createdAt: r.statementDate.toISOString(),
                }
            })
        } catch (recErr) {
            console.warn("[GET /api/finance/reconciliation] bankReconciliation query failed:", recErr)
        }

        // Dedupe bank accounts
        const seen = new Set<string>()
        const bankAccounts = accounts
            .filter((a) => {
                if (seen.has(a.id)) return false
                seen.add(a.id)
                return true
            })
            .map((a) => ({ ...a, balance: Number(a.balance) }))

        return NextResponse.json({ reconciliations, bankAccounts })
    } catch (error) {
        console.error("[GET /api/finance/reconciliation]", error)
        return NextResponse.json({ reconciliations: [], bankAccounts: [] })
    }
}
