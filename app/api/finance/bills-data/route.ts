import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const [bills, totalCount] = await Promise.all([
            prisma.invoice.findMany({
                where: { type: "INV_IN" },
                include: {
                    supplier: { select: { id: true, name: true, bankName: true, bankAccountNumber: true, bankAccountName: true } },
                },
                orderBy: [{ dueDate: "asc" }, { issueDate: "desc" }],
                take: 20,
            }),
            prisma.invoice.count({ where: { type: "INV_IN" } }),
        ])

        const now = new Date()
        const mapped = bills.map(b => ({
            id: b.id, number: b.number, status: b.status,
            totalAmount: Number(b.totalAmount || 0),
            balanceDue: Number(b.balanceDue || 0),
            taxAmount: Number(b.taxAmount || 0),
            issueDate: b.issueDate, dueDate: b.dueDate,
            supplier: b.supplier,
            isOverdue: b.dueDate ? b.dueDate < now : false,
        }))

        return NextResponse.json({ bills: mapped, total: totalCount, page: 1, pageSize: 20 })
    } catch (error) {
        console.error("[API] finance/bills-data error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
