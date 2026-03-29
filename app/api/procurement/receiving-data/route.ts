import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const [rawOrders, grns, warehouses, employees] = await Promise.all([
            prisma.purchaseOrder.findMany({
                where: { status: { in: ["APPROVED", "ORDERED", "VENDOR_CONFIRMED", "SHIPPED", "PARTIAL_RECEIVED"] } },
                orderBy: { orderDate: "desc" },
                include: {
                    supplier: true,
                    items: { include: { product: true, grnItems: true } },
                },
            }),
            prisma.goodsReceivedNote.findMany({
                orderBy: { createdAt: "desc" },
                include: {
                    purchaseOrder: { include: { supplier: true } },
                    warehouse: true,
                    receivedBy: true,
                    items: { include: { product: true } },
                },
            }),
            prisma.warehouse.findMany({
                where: { isActive: true },
                orderBy: { name: "asc" },
                select: { id: true, name: true, code: true },
            }),
            prisma.employee.findMany({
                where: { status: "ACTIVE" },
                orderBy: { firstName: "asc" },
                select: { id: true, firstName: true, lastName: true, department: true },
            }),
        ])

        // Map pending POs with remaining quantities
        const pendingPOs = rawOrders.map(po => {
            const itemsWithRemaining = po.items.map(item => {
                const totalReceived = item.grnItems.reduce((sum: number, grn: { quantityAccepted: number }) => sum + grn.quantityAccepted, 0)
                return {
                    id: item.id,
                    productId: item.productId,
                    productName: item.product.name,
                    productCode: item.product.code,
                    unit: item.product.unit,
                    orderedQty: item.quantity,
                    receivedQty: totalReceived,
                    remainingQty: item.quantity - totalReceived,
                    unitPrice: Number(item.unitPrice),
                }
            })
            return {
                id: po.id,
                number: po.number,
                vendorName: po.supplier.name,
                vendorId: po.supplier.id,
                orderDate: po.orderDate,
                expectedDate: po.expectedDate,
                status: po.status,
                totalAmount: Number(po.totalAmount),
                items: itemsWithRemaining,
                hasRemainingItems: itemsWithRemaining.some(i => i.remainingQty > 0),
            }
        }).filter(po => po.hasRemainingItems)

        // Map GRNs
        const mappedGrns = grns.map(grn => ({
            id: grn.id,
            number: grn.number,
            poNumber: grn.purchaseOrder.number,
            vendorName: grn.purchaseOrder.supplier.name,
            warehouseName: grn.warehouse.name,
            receivedBy: `${grn.receivedBy.firstName} ${grn.receivedBy.lastName || ""}`.trim(),
            receivedDate: grn.receivedDate,
            status: grn.status,
            notes: grn.notes,
            itemCount: grn.items.length,
            totalAccepted: grn.items.reduce((sum: number, i: { quantityAccepted: number }) => sum + i.quantityAccepted, 0),
            totalRejected: grn.items.reduce((sum: number, i: { quantityRejected: number }) => sum + i.quantityRejected, 0),
            items: grn.items.map(item => ({
                id: item.id,
                productName: item.product.name,
                productCode: item.product.code,
                quantityOrdered: item.quantityOrdered,
                quantityReceived: item.quantityReceived,
                quantityAccepted: item.quantityAccepted,
                quantityRejected: item.quantityRejected,
                unitCost: Number(item.unitCost),
                inspectionNotes: item.inspectionNotes,
            })),
        }))

        const mappedEmployees = employees.map(e => ({
            id: e.id,
            name: `${e.firstName} ${e.lastName || ""}`.trim(),
            department: e.department,
        }))

        return NextResponse.json({
            pendingPOs,
            grns: mappedGrns,
            warehouses,
            employees: mappedEmployees,
        })
    } catch (error) {
        console.error("[API] procurement/receiving-data error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
