import { NextRequest, NextResponse } from "next/server"
import { getProcurementStats } from "@/lib/actions/procurement"
import { prisma } from "@/lib/prisma"
import { ProcurementStatus, PRStatus } from "@prisma/client"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
    try {
        const sp = request.nextUrl.searchParams

        const readParam = (key: string) => sp.get(key) || undefined
        const readInt = (key: string) => {
            const val = Number(sp.get(key))
            return Number.isFinite(val) ? Math.trunc(val) : undefined
        }

        const stats = await getProcurementStats({
            registryQuery: {
                purchaseOrders: {
                    status: readParam("po_status"),
                    page: readInt("po_page"),
                    pageSize: readInt("po_size"),
                },
                purchaseRequests: {
                    status: readParam("pr_status"),
                    page: readInt("pr_page"),
                    pageSize: readInt("pr_size"),
                },
                receiving: {
                    status: readParam("grn_status"),
                    page: readInt("grn_page"),
                    pageSize: readInt("grn_size"),
                },
            },
        })

        // Fetch pending items for inline approval
        let pendingItemsForApproval: any[] = []
        try {
            const pendingPOsRaw = await prisma.purchaseOrder.findMany({
                where: { status: ProcurementStatus.PENDING_APPROVAL },
                select: {
                    id: true, number: true, totalAmount: true, netAmount: true,
                    supplier: { select: { name: true } },
                    items: { select: { product: { select: { name: true, code: true } }, quantity: true } },
                },
                orderBy: { createdAt: "desc" },
                take: 10,
            })
            const pendingPRsRaw = await prisma.purchaseRequest.findMany({
                where: { status: PRStatus.PENDING },
                select: {
                    id: true, number: true, department: true, priority: true,
                    requester: { select: { firstName: true, lastName: true } },
                    items: { select: { product: { select: { name: true, code: true } }, quantity: true } },
                },
                orderBy: { createdAt: "desc" },
                take: 10,
            })
            pendingItemsForApproval = [
                ...pendingPOsRaw.map((po) => ({
                    id: po.id, type: "PO" as const, number: po.number || "—",
                    label: po.supplier?.name || "Unknown",
                    amount: Number(po.netAmount || po.totalAmount) || 0,
                    itemCount: po.items.length,
                    items: po.items.map((i) => ({ productName: i.product?.name || "Unknown", productCode: i.product?.code || "—", quantity: Number(i.quantity) || 0 })),
                })),
                ...pendingPRsRaw.map((pr) => ({
                    id: pr.id, type: "PR" as const, number: pr.number || "—",
                    label: `${pr.requester?.firstName || ""} ${pr.requester?.lastName || ""}`.trim() || "Unknown",
                    amount: 0, department: pr.department || undefined, priority: pr.priority || undefined,
                    itemCount: pr.items.length,
                    items: pr.items.map((i) => ({ productName: i.product?.name || "Unknown", productCode: i.product?.code || "—", quantity: Number(i.quantity) || 0 })),
                })),
            ]
        } catch (e) {
            console.error("[ProcurementAPI] Failed to fetch pending items:", e)
        }

        return NextResponse.json({ ...stats, pendingItemsForApproval })
    } catch (error) {
        console.error("Procurement dashboard API error:", error)
        return NextResponse.json({
            spend: { current: 0, previous: 0, growth: 0 },
            needsApproval: 0,
            urgentNeeds: 0,
            vendorHealth: { rating: 0, onTime: 0 },
            incomingCount: 0,
            recentActivity: [],
            purchaseOrders: { recent: [], summary: { draft: 0, pendingApproval: 0, approved: 0, inProgress: 0 } },
            purchaseRequests: { recent: [], summary: { draft: 0, pending: 0, approved: 0, poCreated: 0 } },
            receiving: { recent: [], summary: { draft: 0, inspecting: 0, partialAccepted: 0, accepted: 0 } },
            registryMeta: {
                purchaseOrders: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
                purchaseRequests: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
                receiving: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
            },
            pendingItemsForApproval: [],
        })
    }
}
