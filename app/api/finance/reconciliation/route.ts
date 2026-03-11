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

        // Fetch reconciliations and bank accounts in parallel
        const [recs, accounts] = await Promise.all([
            prisma.bankReconciliation.findMany({
                include: {
                    glAccount: { select: { code: true, name: true } },
                    items: { select: { matchStatus: true, bankAmount: true } },
                },
                orderBy: { statementDate: "desc" },
                take: 50,
            }),
            prisma.gLAccount.findMany({
                where: {
                    type: "ASSET",
                    OR: [
                        { name: { contains: "bank", mode: "insensitive" } },
                        { name: { contains: "kas", mode: "insensitive" } },
                        { name: { contains: "cash", mode: "insensitive" } },
                        { code: { in: ["1000", "1010", "1020", "1100", "1110"] } },
                    ],
                },
                select: { id: true, code: true, name: true, balance: true },
                orderBy: { code: "asc" },
            }),
        ])

        const reconciliations = recs.map((r) => {
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
