import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const requests = await prisma.purchaseRequest.findMany({
            include: {
                requester: { select: { firstName: true, lastName: true, department: true } },
                items: { include: { product: { select: { name: true, unit: true } } } },
            },
            orderBy: { createdAt: "desc" },
        })

        const mapped = requests.map(req => ({
            id: req.id,
            number: req.number,
            requester: `${req.requester?.firstName || ""} ${req.requester?.lastName || ""}`.trim(),
            department: req.department || req.requester?.department,
            status: req.status,
            priority: req.priority,
            notes: req.notes,
            date: req.createdAt,
            itemCount: req.items?.length || 0,
            items: req.items?.map(i => ({
                id: i.id,
                productName: i.product?.name,
                quantity: i.quantity,
                unit: i.product?.unit,
                status: i.status,
            })) || [],
        }))

        return NextResponse.json(mapped)
    } catch (error) {
        console.error("[API] procurement/requests-data error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
