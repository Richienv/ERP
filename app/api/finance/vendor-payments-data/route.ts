import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const payments = await prisma.payment.findMany({
            where: { supplierId: { not: null } },
            select: {
                id: true, number: true, date: true, method: true, reference: true,
                amount: true, glPostingStatus: true,
                supplier: { select: { id: true, name: true, bankName: true, bankAccountNumber: true, bankAccountName: true } },
                invoice: { select: { number: true } },
            },
            orderBy: { date: "desc" }, take: 50,
        })

        const mapped = payments.map(p => ({
            id: p.id, number: p.number, date: p.date,
            method: p.method, reference: p.reference,
            amount: Number(p.amount || 0),
            glPostingStatus: p.glPostingStatus,
            supplier: p.supplier,
            invoiceNumber: p.invoice?.number,
        }))

        return NextResponse.json(mapped)
    } catch (error) {
        console.error("[API] finance/vendor-payments-data error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
