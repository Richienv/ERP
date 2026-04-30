import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getAuthzUser } from "@/lib/authz"

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
        await getAuthzUser()
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
        // dari product.costPrice (PR belum punya unit price terkomit sampai PO
        // diterbitkan, jadi ini estimasi planning saja).
        //
        // Kalau ada item tanpa costPrice (atau cost <= 0) — mis. produk baru —
        // estimatedTotal di-null-kan supaya UI menampilkan "—" + warning,
        // bukan angka setengah jadi yang under-count nilai PR.
        let hasMissingPrice = false
        const items = pr.items.map((i) => {
            const rawCost = i.product?.costPrice
            const costNum = rawCost === null || rawCost === undefined ? null : Number(rawCost)
            const hasValidCost = costNum !== null && Number.isFinite(costNum) && costNum > 0
            if (!hasValidCost) hasMissingPrice = true
            const unitPrice = hasValidCost ? (costNum as number) : 0
            const qty = Number(i.quantity ?? 0)
            return {
                ...i,
                quantity: qty,
                unitPrice,
                totalPrice: hasValidCost ? unitPrice * qty : 0,
                product: i.product
                    ? {
                          ...i.product,
                          costPrice: Number(i.product.costPrice ?? 0),
                      }
                    : null,
            }
        })

        const estimatedTotal = hasMissingPrice
            ? null
            : items.reduce((s, i) => s + i.totalPrice, 0)

        const safe = {
            ...pr,
            items,
            estimatedTotal,
            hasMissingPrice,
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
        if (msg === "Unauthorized") {
            return NextResponse.json({ error: msg }, { status: 401 })
        }
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
