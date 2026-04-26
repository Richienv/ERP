import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

const prismaAny = prisma as any

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    try {
        const grn = await prismaAny.goodsReceivedNote.findUnique({
            where: { id },
            include: {
                purchaseOrder: {
                    include: {
                        supplier: true,
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
                },
                warehouse: true,
                receivedBy: {
                    select: { id: true, firstName: true, lastName: true, email: true, department: true },
                },
                items: {
                    include: {
                        product: { select: { id: true, code: true, name: true, unit: true } },
                        poItem: {
                            select: {
                                id: true,
                                quantity: true,
                                unitPrice: true,
                                totalPrice: true,
                                receivedQty: true,
                            },
                        },
                    },
                },
            },
        })

        if (!grn) {
            return NextResponse.json({ error: "GRN tidak ditemukan" }, { status: 404 })
        }

        // Resolve actor names for acceptedBy / rejectedBy (Supabase Auth UUIDs).
        const actorIds = Array.from(
            new Set(
                [grn.acceptedBy, grn.rejectedBy].filter(
                    (x): x is string => typeof x === "string" && x.length > 0,
                ),
            ),
        )
        const users = actorIds.length
            ? await prisma.user.findMany({
                where: { id: { in: actorIds } },
                select: { id: true, name: true, email: true, role: true },
            })
            : []
        const userMap = new Map(users.map((u) => [u.id, u]))

        const totalQuantityOrdered = grn.items.reduce(
            (s: number, i: any) => s + (i.quantityOrdered ?? 0),
            0,
        )
        const totalQuantityReceived = grn.items.reduce(
            (s: number, i: any) => s + (i.quantityReceived ?? 0),
            0,
        )
        const totalAccepted = grn.items.reduce(
            (s: number, i: any) => s + (i.quantityAccepted ?? 0),
            0,
        )
        const totalRejected = grn.items.reduce(
            (s: number, i: any) => s + (i.quantityRejected ?? 0),
            0,
        )
        const totalValue = grn.items.reduce(
            (s: number, i: any) => s + Number(i.unitCost ?? 0) * Number(i.quantityAccepted ?? 0),
            0,
        )

        const safe = {
            id: grn.id,
            number: grn.number,
            purchaseOrderId: grn.purchaseOrderId,
            warehouseId: grn.warehouseId,
            receivedDate: grn.receivedDate,
            receivedById: grn.receivedById,
            status: grn.status,
            notes: grn.notes,
            acceptedBy: grn.acceptedBy,
            acceptedAt: grn.acceptedAt,
            rejectedBy: grn.rejectedBy,
            rejectedAt: grn.rejectedAt,
            rejectionReason: grn.rejectionReason,
            createdAt: grn.createdAt,
            updatedAt: grn.updatedAt,
            warehouse: grn.warehouse
                ? {
                      id: grn.warehouse.id,
                      name: grn.warehouse.name,
                      code: grn.warehouse.code,
                  }
                : null,
            receivedBy: grn.receivedBy
                ? {
                      id: grn.receivedBy.id,
                      name: `${grn.receivedBy.firstName} ${grn.receivedBy.lastName ?? ""}`.trim(),
                      email: grn.receivedBy.email ?? null,
                      department: grn.receivedBy.department ?? null,
                  }
                : null,
            acceptedByActor: grn.acceptedBy ? userMap.get(grn.acceptedBy) ?? null : null,
            rejectedByActor: grn.rejectedBy ? userMap.get(grn.rejectedBy) ?? null : null,
            purchaseOrder: grn.purchaseOrder
                ? {
                      id: grn.purchaseOrder.id,
                      number: grn.purchaseOrder.number,
                      status: grn.purchaseOrder.status,
                      orderDate: grn.purchaseOrder.orderDate,
                      expectedDate: grn.purchaseOrder.expectedDate,
                      totalAmount: Number(grn.purchaseOrder.totalAmount ?? 0),
                      supplier: grn.purchaseOrder.supplier
                          ? {
                                id: grn.purchaseOrder.supplier.id,
                                code: grn.purchaseOrder.supplier.code,
                                name: grn.purchaseOrder.supplier.name,
                                email: grn.purchaseOrder.supplier.email ?? null,
                                phone: grn.purchaseOrder.supplier.phone ?? null,
                                address: grn.purchaseOrder.supplier.address ?? null,
                                taxId: grn.purchaseOrder.supplier.taxId ?? null,
                                contactName: grn.purchaseOrder.supplier.contactName ?? null,
                            }
                          : null,
                  }
                : null,
            // Decimal-safe items conversion
            items: grn.items.map((i: any) => ({
                id: i.id,
                poItemId: i.poItemId,
                productId: i.productId,
                product: i.product
                    ? {
                          id: i.product.id,
                          code: i.product.code,
                          name: i.product.name,
                          unit: i.product.unit,
                      }
                    : null,
                quantityOrdered: Number(i.quantityOrdered ?? 0),
                quantityReceived: Number(i.quantityReceived ?? 0),
                quantityAccepted: Number(i.quantityAccepted ?? 0),
                quantityRejected: Number(i.quantityRejected ?? 0),
                unitCost: Number(i.unitCost ?? 0),
                inspectionNotes: i.inspectionNotes,
                poItem: i.poItem
                    ? {
                          id: i.poItem.id,
                          quantity: Number(i.poItem.quantity ?? 0),
                          unitPrice: Number(i.poItem.unitPrice ?? 0),
                          totalPrice: Number(i.poItem.totalPrice ?? 0),
                          receivedQty: Number(i.poItem.receivedQty ?? 0),
                      }
                    : null,
            })),
            // Linked downstream bills (via the originating PO)
            bills: (grn.purchaseOrder?.invoices ?? []).map((b: any) => ({
                id: b.id,
                number: b.number,
                status: b.status,
                totalAmount: Number(b.totalAmount ?? 0),
                dueDate: b.dueDate,
                type: b.type,
            })),
            totals: {
                items: grn.items.length,
                quantityOrdered: totalQuantityOrdered,
                quantityReceived: totalQuantityReceived,
                quantityAccepted: totalAccepted,
                quantityRejected: totalRejected,
                value: totalValue,
            },
        }

        return NextResponse.json(safe)
    } catch (e: unknown) {
        console.error("[GRN Detail API]", e)
        const msg = e instanceof Error ? e.message : "Internal error"
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
