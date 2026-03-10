import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
        }

        const url = request.nextUrl
        const limit = Math.min(Number(url.searchParams.get("limit")) || 500, 1000)

        const where: any = { status: "POSTED" }

        // Server-side date filtering
        const dateFrom = url.searchParams.get("dateFrom")
        const dateTo = url.searchParams.get("dateTo")
        if (dateFrom || dateTo) {
            where.date = {}
            if (dateFrom) where.date.gte = new Date(dateFrom)
            if (dateTo) {
                const end = new Date(dateTo)
                end.setHours(23, 59, 59, 999)
                where.date.lte = end
            }
        }

        // Server-side account filtering
        const accountCodes = url.searchParams.get("accounts")
        if (accountCodes) {
            const codes = accountCodes.split(",").map(c => c.trim()).filter(Boolean)
            if (codes.length > 0) {
                where.lines = { some: { account: { code: { in: codes } } } }
            }
        }

        // Server-side search (description or reference)
        const search = url.searchParams.get("search")
        if (search && search.trim()) {
            const term = search.trim()
            where.OR = [
                { description: { contains: term, mode: "insensitive" } },
                { reference: { contains: term, mode: "insensitive" } },
            ]
        }

        const [entries, accounts] = await Promise.all([
            prisma.journalEntry.findMany({
                where,
                include: {
                    lines: {
                        include: {
                            account: { select: { id: true, code: true, name: true, type: true } },
                        },
                    },
                    invoice: { select: { id: true, number: true, type: true } },
                    payment: { select: { id: true, number: true, method: true, supplierId: true, customerId: true } },
                },
                orderBy: { date: "desc" },
                take: limit,
            }),
            prisma.gLAccount.findMany({
                orderBy: { code: "asc" },
                select: { id: true, code: true, name: true, type: true, balance: true },
            }),
        ])

        return NextResponse.json({
            success: true,
            entries: entries.map((e) => ({
                id: e.id,
                date: e.date,
                description: e.description,
                reference: e.reference,
                invoiceId: e.invoice?.id || null,
                invoiceNumber: e.invoice?.number || null,
                invoiceType: e.invoice?.type || null,
                paymentId: e.payment?.id || null,
                paymentNumber: e.payment?.number || null,
                paymentMethod: e.payment?.method || null,
                paymentSupplierId: e.payment?.supplierId || null,
                paymentCustomerId: e.payment?.customerId || null,
                lines: e.lines.map((l) => ({
                    id: l.id,
                    accountCode: l.account.code,
                    accountName: l.account.name,
                    accountType: l.account.type,
                    description: l.description,
                    debit: Number(l.debit),
                    credit: Number(l.credit),
                })),
            })),
            accounts: accounts.map((a) => ({
                id: a.id,
                code: a.code,
                name: a.name,
                type: a.type,
                balance: Number(a.balance),
            })),
        })
    } catch (error: any) {
        console.error("Finance transactions API error:", error)
        return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 })
    }
}
