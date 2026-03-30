import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const invoices = await prisma.invoice.findMany({
            where: { status: "DRAFT" },
            include: {
                customer: { select: { name: true } },
                supplier: { select: { name: true } },
            },
            orderBy: { createdAt: "desc" },
        })

        return NextResponse.json({
            invoices: invoices.map((inv) => ({
                id: inv.id,
                number: inv.number,
                type: inv.type,
                partyName:
                    inv.type === "INV_OUT"
                        ? inv.customer?.name || "Tanpa Customer"
                        : inv.supplier?.name || "Tanpa Vendor",
                totalAmount: Number(inv.totalAmount),
                createdAt: inv.createdAt,
                dueDate: inv.dueDate,
            })),
        })
    } catch (error) {
        console.error("[API] pending-invoices error:", error)
        return NextResponse.json({ invoices: [] }, { status: 500 })
    }
}
