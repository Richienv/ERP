import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

/**
 * GET /api/procurement/requests/[id]
 *
 * Returns a single Purchase Request with full relations for the detail page:
 * requester, approver, items (with product + preferredSupplier), and the
 * PO it was converted to (if any). Decimal fields are converted to numbers
 * for JSON serialization.
 */
export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params
    try {
        const pr = await prisma.purchaseRequest.findUnique({
            where: { id },
            include: {
                requester: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        department: true,
                        position: true,
                    },
                },
                approver: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        department: true,
                        position: true,
                    },
                },
                items: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                code: true,
                                name: true,
                                unit: true,
                                costPrice: true,
                            },
                        },
                        preferredSupplier: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                phone: true,
                            },
                        },
                    },
                },
                purchaseOrder: {
                    select: {
                        id: true,
                        number: true,
                        status: true,
                        totalAmount: true,
                    },
                },
            },
        })

        if (!pr) {
            return NextResponse.json(
                { error: "PR tidak ditemukan" },
                { status: 404 },
            )
        }

        // Convert Decimal fields to plain numbers; pre-compute estimated totals
        // from product.costPrice (PR has no committed unit price until PO is
        // generated, so this is a planning estimate only).
        const items = pr.items.map((i) => {
            const unitPrice = Number(i.product?.costPrice ?? 0)
            const qty = Number(i.quantity ?? 0)
            return {
                ...i,
                quantity: qty,
                unitPrice,
                totalPrice: unitPrice * qty,
                product: i.product
                    ? {
                          ...i.product,
                          costPrice: Number(i.product.costPrice ?? 0),
                      }
                    : null,
            }
        })

        const estimatedTotal = items.reduce((s, i) => s + i.totalPrice, 0)

        const safe = {
            ...pr,
            items,
            estimatedTotal,
            purchaseOrder: pr.purchaseOrder
                ? {
                      ...pr.purchaseOrder,
                      totalAmount: Number(pr.purchaseOrder.totalAmount ?? 0),
                  }
                : null,
        }

        return NextResponse.json(safe)
    } catch (e: unknown) {
        console.error("[PR Detail API]", e)
        const msg = e instanceof Error ? e.message : "Internal error"
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
