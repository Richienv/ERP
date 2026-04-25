import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    try {
        const po = await prisma.purchaseOrder.findUnique({
            where: { id },
            include: {
                supplier: true,
                items: {
                    include: {
                        product: { select: { id: true, code: true, name: true, unit: true } },
                    },
                },
                events: {
                    orderBy: { createdAt: "asc" },
                },
                purchaseRequests: {
                    take: 5,
                    include: {
                        requester: { select: { id: true, firstName: true, lastName: true, email: true } },
                        approver: { select: { id: true, firstName: true, lastName: true, email: true } },
                    },
                },
                goodsReceivedNotes: {
                    select: { id: true, number: true, status: true, receivedDate: true },
                },
                invoices: {
                    select: {
                        id: true,
                        number: true,
                        status: true,
                        totalAmount: true,
                        dueDate: true,
                        type: true,
                    },
                },
            },
        })

        if (!po) {
            return NextResponse.json({ error: "PO tidak ditemukan" }, { status: 404 })
        }

        // Decimal-safe: convert all Decimal fields to number for JSON serialization
        const safe = {
            ...po,
            totalAmount: Number(po.totalAmount ?? 0),
            netAmount: Number(po.netAmount ?? 0),
            taxAmount: Number(po.taxAmount ?? 0),
            landedCostTotal: po.landedCostTotal != null ? Number(po.landedCostTotal) : null,
            items: po.items.map((i) => ({
                ...i,
                quantity: Number(i.quantity ?? 0),
                receivedQty: Number(i.receivedQty ?? 0),
                returnedQty: Number(i.returnedQty ?? 0),
                unitPrice: Number(i.unitPrice ?? 0),
                totalPrice: Number(i.totalPrice ?? 0),
            })),
            invoices: (po.invoices ?? []).map((b) => ({
                ...b,
                totalAmount: Number(b.totalAmount ?? 0),
            })),
            grns: (po.goodsReceivedNotes ?? []).map((g) => ({ ...g })),
            // Alias for backward compatibility / clarity in UI:
            bills: (po.invoices ?? []).map((b) => ({
                ...b,
                totalAmount: Number(b.totalAmount ?? 0),
            })),
        }

        return NextResponse.json(safe)
    } catch (e: unknown) {
        console.error("[PO Detail API]", e)
        const msg = e instanceof Error ? e.message : "Internal error"
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
