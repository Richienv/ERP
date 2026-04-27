import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getAuthzUser } from "@/lib/authz"

type ProcurementStatusValue =
    | "PO_DRAFT"
    | "PENDING_APPROVAL"
    | "APPROVED"
    | "ORDERED"
    | "VENDOR_CONFIRMED"
    | "SHIPPED"
    | "PARTIAL_RECEIVED"
    | "RECEIVED"
    | "COMPLETED"
    | "CANCELLED"
    | "REJECTED"

const DONE_STATUSES = new Set<ProcurementStatusValue>(["RECEIVED", "COMPLETED"])
const CANCELLED_STATUSES = new Set<ProcurementStatusValue>(["CANCELLED", "REJECTED"])

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    try {
        await getAuthzUser()
        const vendor = await prisma.supplier.findUnique({
            where: { id },
            include: {
                categories: true,
                purchaseOrders: {
                    take: 20,
                    orderBy: { orderDate: "desc" },
                    select: {
                        id: true,
                        number: true,
                        status: true,
                        orderDate: true,
                        expectedDate: true,
                        totalAmount: true,
                        netAmount: true,
                        taxAmount: true,
                        items: { select: { id: true } },
                    },
                },
                supplierItems: {
                    take: 20,
                    include: {
                        product: { select: { id: true, code: true, name: true, unit: true } },
                    },
                },
                Invoice: {
                    where: { type: "INV_IN" },
                    take: 20,
                    orderBy: { issueDate: "desc" },
                    select: {
                        id: true,
                        number: true,
                        status: true,
                        issueDate: true,
                        dueDate: true,
                        totalAmount: true,
                        balanceDue: true,
                    },
                },
                Payment: {
                    take: 20,
                    orderBy: { date: "desc" },
                    select: {
                        id: true,
                        number: true,
                        date: true,
                        amount: true,
                        glPostingStatus: true,
                        method: true,
                    },
                },
            },
        })

        if (!vendor) {
            return NextResponse.json({ error: "Vendor tidak ditemukan" }, { status: 404 })
        }

        // Aggregate purchase performance metrics across ALL POs (not just last 20).
        // Include latest GRN receivedDate per PO so we bisa hitung OTD beneran
        // (membandingkan tanggal terima vs tanggal yang diharapkan).
        const allPos = await prisma.purchaseOrder.findMany({
            where: { supplierId: id },
            select: {
                status: true,
                netAmount: true,
                expectedDate: true,
                orderDate: true,
                goodsReceivedNotes: {
                    select: { receivedDate: true },
                    orderBy: { receivedDate: "desc" },
                    take: 1,
                },
            },
        })

        const poTotalCount = allPos.length
        // Pakai netAmount (grand total post-PPN) supaya KPI vendor mencerminkan
        // belanja sesungguhnya — bukan DPP yang under-count ~10%.
        const totalSpend = allPos
            .filter((p) => !CANCELLED_STATUSES.has(p.status as ProcurementStatusValue))
            .reduce((s, p) => s + Number(p.netAmount ?? 0), 0)
        const avgPoValue = poTotalCount > 0 ? totalSpend / poTotalCount : 0

        // Completion rate: PO selesai / PO non-cancelled (BUKAN OTD beneran).
        const nonCancelled = allPos.filter(
            (p) => !CANCELLED_STATUSES.has(p.status as ProcurementStatusValue),
        )
        const completedCount = nonCancelled.filter((p) =>
            DONE_STATUSES.has(p.status as ProcurementStatusValue),
        ).length
        const completionPct = nonCancelled.length > 0 ? (completedCount / nonCancelled.length) * 100 : 0

        // OTD beneran: PO selesai dengan latest GRN <= expectedDate / total PO selesai.
        // Hanya hitung PO yang punya expectedDate dan minimal 1 GRN.
        const completedPos = nonCancelled.filter((p) =>
            DONE_STATUSES.has(p.status as ProcurementStatusValue),
        )
        const completedWithExpected = completedPos.filter(
            (p) => p.expectedDate && p.goodsReceivedNotes.length > 0,
        )
        const onTimePos = completedWithExpected.filter((p) => {
            const lastReceived = p.goodsReceivedNotes[0]?.receivedDate
            return lastReceived && new Date(lastReceived) <= new Date(p.expectedDate as Date)
        })
        const otdPct =
            completedWithExpected.length > 0
                ? (onTimePos.length / completedWithExpected.length) * 100
                : 0

        // Rejection rate: rejected/cancelled / total
        const cancelledCount = allPos.filter((p) =>
            CANCELLED_STATUSES.has(p.status as ProcurementStatusValue),
        ).length
        const rejectionRate = poTotalCount > 0 ? (cancelledCount / poTotalCount) * 100 : 0

        // YTD purchases (current calendar year) — pakai netAmount (grand total).
        const yearStart = new Date(new Date().getFullYear(), 0, 1)
        const ytdPurchases = allPos
            .filter((p) => p.orderDate && new Date(p.orderDate) >= yearStart)
            .reduce((s, p) => s + Number(p.netAmount ?? 0), 0)

        // Outstanding AP — agregasi dari SEMUA invoice INV_IN vendor yang belum
        // lunas (sebelumnya cuma top-20 — undercounted vendor besar).
        const outstandingApAgg = await prisma.invoice.aggregate({
            where: {
                supplierId: id,
                type: "INV_IN",
                status: { notIn: ["PAID", "CANCELLED", "VOID"] },
            },
            _sum: { balanceDue: true },
        })
        const outstandingAp = Number(outstandingApAgg._sum.balanceDue ?? 0)

        // Decimal-safe serialization
        const safe = {
            id: vendor.id,
            code: vendor.code,
            name: vendor.name,
            contactName: vendor.contactName,
            contactTitle: vendor.contactTitle,
            email: vendor.email,
            phone: vendor.phone,
            picPhone: vendor.picPhone,
            officePhone: vendor.officePhone,
            address: vendor.address,
            address2: vendor.address2,
            npwp: vendor.npwp ?? null,
            paymentTerm: vendor.paymentTerm,
            bankName: vendor.bankName,
            bankAccountNumber: vendor.bankAccountNumber,
            bankAccountName: vendor.bankAccountName,
            rating: Number(vendor.rating) || 0,
            onTimeRate: Number(vendor.onTimeRate) || 0,
            qualityScore: vendor.qualityScore != null ? Number(vendor.qualityScore) : null,
            responsiveness: vendor.responsiveness != null ? Number(vendor.responsiveness) : null,
            isActive: vendor.isActive,
            createdAt: vendor.createdAt,
            updatedAt: vendor.updatedAt,
            categories: vendor.categories.map((c) => ({ id: c.id, code: c.code, name: c.name })),
            purchaseOrders: vendor.purchaseOrders.map((po) => ({
                id: po.id,
                number: po.number,
                status: po.status,
                orderDate: po.orderDate,
                expectedDate: po.expectedDate,
                totalAmount: Number(po.totalAmount ?? 0),
                netAmount: Number(po.netAmount ?? 0),
                taxAmount: Number(po.taxAmount ?? 0),
                itemCount: po.items.length,
            })),
            supplierProducts: vendor.supplierItems.map((sp) => ({
                id: sp.id,
                price: Number(sp.price ?? 0),
                currency: sp.currency,
                leadTime: sp.leadTime,
                minOrderQty: sp.minOrderQty,
                skuCode: sp.skuCode,
                isPreferred: sp.isPreferred,
                product: sp.product
                    ? {
                          id: sp.product.id,
                          code: sp.product.code,
                          name: sp.product.name,
                          unit: sp.product.unit,
                      }
                    : null,
            })),
            invoices: (vendor.Invoice ?? []).map((b) => ({
                id: b.id,
                number: b.number,
                status: b.status,
                issueDate: b.issueDate,
                dueDate: b.dueDate,
                totalAmount: Number(b.totalAmount ?? 0),
                balanceDue: Number(b.balanceDue ?? 0),
            })),
            payments: (vendor.Payment ?? []).map((p) => ({
                id: p.id,
                number: p.number,
                date: p.date,
                amount: Number(p.amount ?? 0),
                status: p.glPostingStatus,
                method: p.method,
            })),
            metrics: {
                poTotalCount,
                totalSpend,
                avgPoValue,
                // OTD beneran (berdasarkan GRN receivedDate vs expectedDate).
                // Hanya menghitung PO yang sudah selesai DAN punya expectedDate +
                // GRN. Kalau tidak ada data, returns 0.
                otdPct,
                // Completion rate (rasio PO selesai vs PO non-cancelled). Nama
                // lama 'otdPct' menyesatkan — sekarang dipisah jadi 2 metrik
                // yang artinya beda.
                completionPct,
                completedCount,
                cancelledCount,
                rejectionRate,
                ytdPurchases,
                outstandingAp,
            },
        }

        return NextResponse.json(safe)
    } catch (e: unknown) {
        console.error("[Vendor Detail API]", e)
        const msg = e instanceof Error ? e.message : "Internal error"
        if (msg === "Unauthorized") {
            return NextResponse.json({ error: msg }, { status: 401 })
        }
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
