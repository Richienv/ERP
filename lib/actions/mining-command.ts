"use server"

import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"
import { SYS_ACCOUNTS } from "@/lib/gl-accounts"

async function requireAuth() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new Error("Unauthorized")
    return user
}

export type CommandAction = {
    id: string
    module: "finance" | "procurement" | "inventory" | "fleet" | "hcm"
    title: string
    detail: string
    href: string
    tone: "critical" | "warn" | "go"
    count?: number
    amount?: number
}

export type MiningCommandPulse = {
    generatedAt: string
    integrity: {
        booksHealthy: boolean
        openPeriodLabel: string | null
        unpostedPayroll: boolean
        unreconciledHint: number
    }
    snapshot: {
        cash: number
        arOpen: number
        apOpen: number
        inventoryValue: number
        fleetAssetValue: number
        fleetWithoutAsset: number
        payrollCompanyCost: number
    }
    actions: CommandAction[]
}

function toNum(value: unknown): number {
    if (value == null) return 0
    if (typeof value === "number") return value
    if (typeof value === "object" && value !== null && "toNumber" in value && typeof (value as { toNumber: () => number }).toNumber === "function") {
        return (value as { toNumber: () => number }).toNumber()
    }
    return Number(value) || 0
}

/**
 * Satu query-set untuk "next action" KRI mining — dipakai Finance (wow)
 * dan pulsa di Fleet / Inventory / Procurement / HCM.
 */
export async function getMiningCommandPulse(): Promise<MiningCommandPulse> {
    await requireAuth()

    const now = new Date()
    const in7Days = new Date(now.getTime() + 7 * 86400_000)
    const in30Days = new Date(now.getTime() + 30 * 86400_000)
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

    const [
        cashAccounts,
        arAgg,
        apAgg,
        overdueAr,
        billsDueSoon,
        draftBills,
        draftInvoices,
        stockLevels,
        fleetAssets,
        fleetBare,
        complianceFleet,
        openPeriod,
        payrollTask,
        pendingPR,
        pendingPO,
        acceptedGrnWithoutBill,
        pendingLeave,
    ] = await Promise.all([
        prisma.gLAccount.findMany({
            where: {
                code: {
                    in: [
                        SYS_ACCOUNTS.CASH,
                        SYS_ACCOUNTS.PETTY_CASH,
                        SYS_ACCOUNTS.BANK_BCA,
                        SYS_ACCOUNTS.BANK_MANDIRI,
                    ],
                },
            },
            select: { balance: true },
        }),
        prisma.invoice.aggregate({
            where: { type: "INV_OUT", status: { in: ["ISSUED", "PARTIAL", "OVERDUE"] } },
            _sum: { balanceDue: true },
            _count: { _all: true },
        }),
        prisma.invoice.aggregate({
            where: { type: "INV_IN", status: { in: ["ISSUED", "PARTIAL", "OVERDUE"] } },
            _sum: { balanceDue: true },
            _count: { _all: true },
        }),
        prisma.invoice.count({
            where: {
                type: "INV_OUT",
                status: { in: ["ISSUED", "PARTIAL", "OVERDUE"] },
                dueDate: { lt: now },
            },
        }),
        prisma.invoice.findMany({
            where: {
                type: "INV_IN",
                status: { in: ["ISSUED", "PARTIAL", "OVERDUE"] },
                dueDate: { lte: in7Days },
            },
            select: { id: true, number: true, balanceDue: true, dueDate: true },
            take: 8,
            orderBy: { dueDate: "asc" },
        }),
        prisma.invoice.count({
            where: { type: "INV_IN", status: "DRAFT" },
        }),
        prisma.invoice.count({
            where: { type: "INV_OUT", status: "DRAFT" },
        }),
        prisma.stockLevel.findMany({
            select: {
                quantity: true,
                product: { select: { costPrice: true, minStock: true, isActive: true } },
            },
            take: 2000,
        }),
        prisma.fixedAsset.aggregate({
            where: { status: { in: ["ACTIVE", "FULLY_DEPRECIATED"] }, vehicle: { isNot: null } },
            _sum: { netBookValue: true },
            _count: { _all: true },
        }),
        prisma.vehicle.count({
            where: { isActive: true, ownerCustomerId: null, fixedAssetId: null },
        }),
        prisma.vehicle.count({
            where: {
                isActive: true,
                OR: [
                    { stnkExpiry: { lte: in30Days } },
                    { kirExpiry: { lte: in30Days } },
                    { insuranceExpiry: { lte: in30Days } },
                ],
            },
        }),
        prisma.fiscalPeriod.findFirst({
            where: { isClosed: false, year: now.getFullYear(), month: now.getMonth() + 1 },
            select: { year: true, month: true, isClosed: true },
        }),
        prisma.employeeTask.findFirst({
            where: { relatedId: `PAYROLL-${period}`, notes: { startsWith: "PAYROLL_RUN::" } },
            orderBy: { updatedAt: "desc" },
            select: { notes: true },
        }),
        prisma.purchaseRequest.count({ where: { status: "PENDING" } }),
        prisma.purchaseOrder.count({ where: { status: "PENDING_APPROVAL" } }),
        prisma.goodsReceivedNote.count({
            where: {
                status: "ACCEPTED",
                purchaseOrder: {
                    invoices: { none: { type: "INV_IN", status: { notIn: ["CANCELLED", "VOID"] } } },
                },
            },
        }),
        prisma.leaveRequest.count({ where: { status: "PENDING" } }),
    ])

    const cash = cashAccounts.reduce((sum, a) => sum + toNum(a.balance), 0)
    const arOpen = toNum(arAgg._sum.balanceDue)
    const apOpen = toNum(apAgg._sum.balanceDue)
    const inventoryValue = stockLevels.reduce((sum, row) => {
        return sum + toNum(row.quantity) * toNum(row.product?.costPrice)
    }, 0)
    const lowStock = stockLevels.filter((row) => {
        const min = Number(row.product?.minStock || 0)
        return row.product?.isActive !== false && min > 0 && toNum(row.quantity) <= min
    }).length
    const fleetAssetValue = toNum(fleetAssets._sum.netBookValue)

    let payrollCompanyCost = 0
    let unpostedPayroll = false
    if (payrollTask?.notes) {
        try {
            const json = payrollTask.notes.replace(/^PAYROLL_RUN::/, "")
            const payload = JSON.parse(json) as {
                status?: string
                postedJournalReference?: string
                summary?: { gross?: number; employerBpjs?: number; companyCost?: number }
            }
            unpostedPayroll = payload.status !== "POSTED" && !payload.postedJournalReference
            payrollCompanyCost = Number(payload.summary?.companyCost || 0)
            if (!payrollCompanyCost) {
                payrollCompanyCost = Number(payload.summary?.gross || 0) + Number(payload.summary?.employerBpjs || 0)
            }
        } catch {
            unpostedPayroll = true
        }
    }

    const billsDueAmount = billsDueSoon.reduce((sum, b) => sum + toNum(b.balanceDue), 0)

    const actions: CommandAction[] = []

    if (overdueAr > 0) {
        actions.push({
            id: "ar-overdue",
            module: "finance",
            title: "Tagih piutang jatuh tempo",
            detail: `${overdueAr} invoice pelanggan lewat jatuh tempo`,
            href: "/finance/receivables",
            tone: "critical",
            count: overdueAr,
            amount: arOpen,
        })
    }
    if (billsDueSoon.length > 0) {
        actions.push({
            id: "ap-due",
            module: "finance",
            title: "Bayar tagihan 7 hari",
            detail: `${billsDueSoon.length} bill vendor jatuh tempo minggu ini`,
            href: "/finance/vendor-payments",
            tone: "warn",
            count: billsDueSoon.length,
            amount: billsDueAmount,
        })
    }
    if (draftInvoices > 0) {
        actions.push({
            id: "inv-draft",
            module: "finance",
            title: "Kirim invoice draft",
            detail: `${draftInvoices} invoice pelanggan masih draft — belum masuk jurnal`,
            href: "/finance/invoices",
            tone: "go",
            count: draftInvoices,
        })
    }
    if (draftBills > 0) {
        actions.push({
            id: "bill-draft",
            module: "finance",
            title: "Setujui bill vendor",
            detail: `${draftBills} tagihan draft siap di-post ke utang usaha`,
            href: "/finance/bills",
            tone: "go",
            count: draftBills,
        })
    }
    if (acceptedGrnWithoutBill > 0) {
        actions.push({
            id: "grn-bill",
            module: "procurement",
            title: "Buat bill dari barang masuk",
            detail: `${acceptedGrnWithoutBill} GRN diterima tanpa tagihan vendor`,
            href: "/finance/bills",
            tone: "warn",
            count: acceptedGrnWithoutBill,
        })
    }
    if (pendingPR > 0) {
        actions.push({
            id: "pr-approve",
            module: "procurement",
            title: "Setujui permintaan beli",
            detail: `${pendingPR} PR menunggu approval`,
            href: "/procurement/requests",
            tone: "warn",
            count: pendingPR,
        })
    }
    if (pendingPO > 0) {
        actions.push({
            id: "po-approve",
            module: "procurement",
            title: "Setujui purchase order",
            detail: `${pendingPO} PO menunggu approval`,
            href: "/procurement/orders",
            tone: "warn",
            count: pendingPO,
        })
    }
    if (typeof lowStock === "number" && lowStock > 0) {
        actions.push({
            id: "low-stock",
            module: "inventory",
            title: "Restock spare part",
            detail: `${lowStock} item di bawah stok minimum`,
            href: "/inventory/alerts",
            tone: "warn",
            count: lowStock,
        })
    }
    if (fleetBare > 0) {
        actions.push({
            id: "fleet-asset",
            module: "fleet",
            title: "Kapitalisasi armada",
            detail: `${fleetBare} unit milik perusahaan belum jadi aset tetap`,
            href: "/fleet",
            tone: "go",
            count: fleetBare,
        })
    }
    if (complianceFleet > 0) {
        actions.push({
            id: "fleet-docs",
            module: "fleet",
            title: "Perpanjang STNK / KIR",
            detail: `${complianceFleet} unit dokumen habis ≤ 30 hari`,
            href: "/fleet",
            tone: "critical",
            count: complianceFleet,
        })
    }
    if (unpostedPayroll) {
        actions.push({
            id: "payroll-post",
            module: "hcm",
            title: "Posting jurnal gaji",
            detail: `Payroll ${period} belum masuk GL (termasuk BPJS perusahaan)`,
            href: "/hcm/payroll",
            tone: "critical",
            amount: payrollCompanyCost,
        })
    }
    if (pendingLeave > 0) {
        actions.push({
            id: "leave",
            module: "hcm",
            title: "Approve cuti",
            detail: `${pendingLeave} pengajuan cuti menunggu`,
            href: "/hcm/attendance",
            tone: "warn",
            count: pendingLeave,
        })
    }

    const priority: Record<CommandAction["tone"], number> = { critical: 0, warn: 1, go: 2 }
    actions.sort((a, b) => priority[a.tone] - priority[b.tone])

    return {
        generatedAt: now.toISOString(),
        integrity: {
            booksHealthy: actions.filter((a) => a.tone === "critical").length === 0,
            openPeriodLabel: openPeriod
                ? `${openPeriod.month}/${openPeriod.year}`
                : `${now.getMonth() + 1}/${now.getFullYear()}`,
            unpostedPayroll,
            unreconciledHint: draftBills + draftInvoices,
        },
        snapshot: {
            cash,
            arOpen,
            apOpen,
            inventoryValue,
            fleetAssetValue,
            fleetWithoutAsset: fleetBare,
            payrollCompanyCost,
        },
        actions: actions.slice(0, 8),
    }
}
