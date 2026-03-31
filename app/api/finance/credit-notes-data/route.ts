import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const notes = await prisma.debitCreditNote.findMany({
            include: {
                customer: { select: { name: true } },
                supplier: { select: { name: true } },
                items: true,
                originalInvoice: { select: { number: true } },
            },
            orderBy: { issueDate: "desc" },
        })

        const mapped = notes.map(n => ({
            ...n,
            subtotal: Number(n.subtotal || 0),
            ppnAmount: Number(n.ppnAmount || 0),
            totalAmount: Number(n.totalAmount || 0),
            settledAmount: Number(n.settledAmount || 0),
            items: n.items.map(i => ({
                ...i,
                quantity: Number(i.quantity || 0),
                unitPrice: Number(i.unitPrice || 0),
                amount: Number(i.amount || 0),
                ppnAmount: Number(i.ppnAmount || 0),
                totalAmount: Number(i.totalAmount || 0),
            })),
        }))

        return NextResponse.json(mapped)
    } catch (error) {
        console.error("[API] finance/credit-notes-data error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
