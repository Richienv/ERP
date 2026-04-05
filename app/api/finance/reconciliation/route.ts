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

        // Fetch GL-based bank accounts (legacy, for backward compat)
        const glAccounts = await prisma.gLAccount.findMany({
            where: {
                type: "ASSET",
                name: { contains: "bank", mode: "insensitive" },
            },
            select: { id: true, code: true, name: true, balance: true },
            orderBy: { code: "asc" },
        })

        // Fetch BankAccount records (new model)
        let bankAccountRecords: Array<{
            id: string
            code: string
            bankName: string
            accountNumber: string
            accountHolder: string
            branch: string | null
            currency: string
            coaAccountId: string | null
            openingBalance: number
            description: string | null
            isActive: boolean
            coaBalance: number
        }> = []

        try {
            const records = await prisma.bankAccount.findMany({
                where: { isActive: true },
                include: {
                    coaAccount: { select: { id: true, code: true, name: true, balance: true } },
                },
                orderBy: { code: "asc" },
            })
            bankAccountRecords = records.map((a) => ({
                id: a.id,
                code: a.code,
                bankName: a.bankName,
                accountNumber: a.accountNumber,
                accountHolder: a.accountHolder,
                branch: a.branch,
                currency: a.currency,
                coaAccountId: a.coaAccountId,
                openingBalance: Number(a.openingBalance),
                description: a.description,
                isActive: a.isActive,
                coaBalance: a.coaAccount ? Number(a.coaAccount.balance) : 0,
            }))
        } catch (bankErr) {
            console.warn("[GET /api/finance/reconciliation] bankAccount query failed:", bankErr)
        }

        // Fetch reconciliations
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
            bankAccountId: string | null
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
                    bankAccountId: (r as Record<string, unknown>).bankAccountId as string | null ?? null,
                }
            })
        } catch (recErr) {
            console.warn("[GET /api/finance/reconciliation] bankReconciliation query failed:", recErr)
        }

        // Build bankAccounts for backward compat (merge GL-based + BankAccount COA links)
        const seen = new Set<string>()
        const bankAccounts = glAccounts
            .filter((a) => {
                if (seen.has(a.id)) return false
                seen.add(a.id)
                return true
            })
            .map((a) => ({ ...a, balance: Number(a.balance) }))

        // Also fetch COA accounts for the bank account form dropdown
        let coaAccounts: Array<{ id: string; code: string; name: string }> = []
        try {
            const coa = await prisma.gLAccount.findMany({
                where: { type: "ASSET" },
                select: { id: true, code: true, name: true },
                orderBy: { code: "asc" },
            })
            coaAccounts = coa
        } catch {
            // ignore
        }

        // Fetch active currencies from Currency table
        let currencies: Array<{ code: string; name: string; symbol: string }> = []
        try {
            const curr = await prisma.currency.findMany({
                where: { isActive: { not: false } },
                select: { code: true, name: true, symbol: true },
                orderBy: { code: "asc" },
            })
            currencies = curr
        } catch {
            // Currency table may not exist yet
        }

        return NextResponse.json({
            reconciliations,
            bankAccounts,
            bankAccountRecords,
            coaAccounts,
            currencies,
        })
    } catch (error) {
        console.error("[GET /api/finance/reconciliation]", error)
        return NextResponse.json({ reconciliations: [], bankAccounts: [], bankAccountRecords: [], coaAccounts: [] })
    }
}
