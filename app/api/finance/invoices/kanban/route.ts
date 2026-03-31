import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const url = new URL(request.url)
        const q = url.searchParams.get("q") || null
        const type = url.searchParams.get("type") || "ALL"
        const limit = 200

        const where: Record<string, unknown> = { type: { in: ["INV_OUT", "INV_IN"] } }
        if (type !== "ALL") where.type = type
        if (q) {
            where.OR = [
                { number: { contains: q, mode: "insensitive" } },
                { customer: { name: { contains: q, mode: "insensitive" } } },
                { supplier: { name: { contains: q, mode: "insensitive" } } },
            ]
        }

        const invoices = await prisma.invoice.findMany({
            where, take: limit, orderBy: { issueDate: "desc" },
            include: {
                customer: { select: { name: true } },
                supplier: { select: { name: true } },
            },
        })

        const now = new Date()
        const draft: unknown[] = []
        const sent: unknown[] = []
        const overdue: unknown[] = []
        const paid: unknown[] = []

        for (const inv of invoices) {
            const item = {
                id: inv.id, number: inv.number, type: inv.type,
                customerName: inv.customer?.name || inv.supplier?.name || "-",
                totalAmount: Number(inv.totalAmount), balanceDue: Number(inv.balanceDue),
                issueDate: inv.issueDate, dueDate: inv.dueDate, status: inv.status,
                daysOverdue: inv.dueDate && inv.dueDate < now
                    ? Math.floor((now.getTime() - inv.dueDate.getTime()) / 86400000)
                    : 0,
            }
            if (inv.status === "DRAFT") draft.push(item)
            else if (inv.status === "PAID" || inv.status === "VOID") paid.push(item)
            else if (inv.status === "OVERDUE" || (inv.dueDate && inv.dueDate < now)) overdue.push(item)
            else sent.push(item)
        }

        return NextResponse.json({ draft, sent, overdue, paid })
    } catch (error) {
        console.error("[API] finance/invoices/kanban error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
