"use server"

import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"
import { SYS_ACCOUNTS } from "@/lib/gl-accounts"
import { getThreeWayMatchExceptionCount } from "@/lib/actions/finance-match"

async function requireAuth() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new Error("Unauthorized")
    return user
}

export type CommandActionModule = "finance" | "procurement" | "inventory" | "fleet" | "hcm"

export type CommandAction = {
    id: string
    module: CommandActionModule
    title: string
    detail: string
    /** Deep link ke layar kerja yang benar — bukan halaman indeks kalau bisa spesifik. */
    href: string
    tone: "critical" | "warn" | "go"
    count?: number
    amount?: number
    /** Label tombol utama per baris inbox, contoh "Setujui" / "Bayar". */
    cta: string
    /** Siapa yang harus mengerjakan — biar owner tahu harus lempar ke siapa. */
    owner: string
    /** Batas waktu ringkas, contoh "Hari ini" / "≤ 7 hari". */
    due?: string
    /** Efek ke buku besar kalau dikerjakan (nama akun, bukan kode). */
    impact?: string
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
    /** Ringkasan antrian untuk header Kotak Masuk Operasi. */
    queue: {
        total: number
        segera: number
        mingguIni: number
        terjadwal: number
        /** Total rupiah yang tertahan di antrian (tidak semua baris punya nilai). */
        amountHeld: number
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
        overdueArAgg,
        billsDueSoon,
        draftBillsAgg,
        draftInvoicesAgg,
        stockLevels,
        fleetAssets,
        fleetBare,
        fleetBareFirst,
        complianceFleet,
        complianceFleetList,
        openPeriod,
        payrollTask,
        pendingPR,
        pendingPOAgg,
        pendingPOFirst,
        acceptedGrnWithoutBill,
        pendingLeave,
        matchExceptions,
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
        prisma.invoice.aggregate({
            where: {
                type: "INV_OUT",
                status: { in: ["ISSUED", "PARTIAL", "OVERDUE"] },
                dueDate: { lt: now },
            },
            _sum: { balanceDue: true },
            _count: { _all: true },
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
        prisma.invoice.aggregate({
            where: { type: "INV_IN", status: "DRAFT" },
            _sum: { totalAmount: true },
            _count: { _all: true },
        }),
        prisma.invoice.aggregate({
            where: { type: "INV_OUT", status: "DRAFT" },
            _sum: { totalAmount: true },
            _count: { _all: true },
        }),
        prisma.stockLevel.findMany({
            select: {
                quantity: true,
                product: { select: { id: true, costPrice: true, minStock: true, isActive: true } },
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
        prisma.vehicle.findFirst({
            where: { isActive: true, ownerCustomerId: null, fixedAssetId: null },
            select: { id: true, plateNumber: true, brand: true, model: true },
            orderBy: { createdAt: "asc" },
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
        prisma.vehicle.findMany({
            where: {
                isActive: true,
                OR: [
                    { stnkExpiry: { lte: in30Days } },
                    { kirExpiry: { lte: in30Days } },
                    { insuranceExpiry: { lte: in30Days } },
                ],
            },
            select: {
                id: true,
                plateNumber: true,
                stnkExpiry: true,
                kirExpiry: true,
                insuranceExpiry: true,
            },
            take: 25,
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
        prisma.purchaseOrder.aggregate({
            where: { status: "PENDING_APPROVAL" },
            _sum: { totalAmount: true },
            _count: { _all: true },
        }),
        prisma.purchaseOrder.findFirst({
            where: { status: "PENDING_APPROVAL" },
            select: { id: true, number: true },
            orderBy: { createdAt: "asc" },
        }),
        prisma.goodsReceivedNote.count({
            where: {
                status: "ACCEPTED",
                purchaseOrder: {
                    invoices: { none: { type: "INV_IN", status: { notIn: ["CANCELLED", "VOID"] } } },
                },
            },
        }),
        prisma.leaveRequest.count({ where: { status: "PENDING" } }),
        getThreeWayMatchExceptionCount(),
    ])

    const cash = cashAccounts.reduce((sum, a) => sum + toNum(a.balance), 0)
    const arOpen = toNum(arAgg._sum.balanceDue)
    const apOpen = toNum(apAgg._sum.balanceDue)
    const inventoryValue = stockLevels.reduce((sum, row) => {
        return sum + toNum(row.quantity) * toNum(row.product?.costPrice)
    }, 0)
    const lowStockRows = stockLevels.filter((row) => {
        const min = Number(row.product?.minStock || 0)
        return row.product?.isActive !== false && min > 0 && toNum(row.quantity) <= min
    })
    const lowStock = lowStockRows.length
    const firstLowStockId = lowStockRows[0]?.product?.id
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
    const overdueAr = overdueArAgg._count._all
    const overdueArAmount = toNum(overdueArAgg._sum.balanceDue)
    const draftBills = draftBillsAgg._count._all
    const draftBillsAmount = toNum(draftBillsAgg._sum.totalAmount)
    const draftInvoices = draftInvoicesAgg._count._all
    const draftInvoicesAmount = toNum(draftInvoicesAgg._sum.totalAmount)
    const pendingPO = pendingPOAgg._count._all
    const pendingPOAmount = toNum(pendingPOAgg._sum.totalAmount)

    const soonestDocExpiry = complianceFleetList.reduce<{ plate: string; days: number } | null>((soonest, unit) => {
        const dates = [unit.stnkExpiry, unit.kirExpiry, unit.insuranceExpiry]
            .filter((d): d is Date => d instanceof Date || (d != null && !Number.isNaN(new Date(d as unknown as string).getTime())))
            .map((d) => new Date(d).getTime())
        if (dates.length === 0) return soonest
        const days = Math.ceil((Math.min(...dates) - now.getTime()) / 86400_000)
        if (!soonest || days < soonest.days) return { plate: unit.plateNumber, days }
        return soonest
    }, null)
    const soonestDocUnit = soonestDocExpiry
        ? complianceFleetList.find((unit) => unit.plateNumber === soonestDocExpiry.plate)
        : undefined

    const actions: CommandAction[] = []

    if (overdueAr > 0) {
        actions.push({
            id: "ar-overdue",
            module: "finance",
            title: "Tagih piutang yang sudah jatuh tempo",
            detail: `${overdueAr} invoice pelanggan lewat tanggal bayar — uang ini sudah jadi hak KRI`,
            href: "/finance/receivables",
            tone: "critical",
            count: overdueAr,
            amount: overdueArAmount,
            cta: "Tagih sekarang",
            owner: "Finance — Piutang",
            due: "Hari ini",
            impact: "Menurunkan Piutang Usaha saat pelanggan bayar",
        })
    }
    if (billsDueSoon.length > 0) {
        actions.push({
            id: "ap-due",
            module: "finance",
            title: "Bayar tagihan vendor minggu ini",
            detail: `${billsDueSoon.length} bill vendor jatuh tempo ≤ 7 hari — hindari stop kirim solar & spare part`,
            href: "/finance/vendor-payments",
            tone: "warn",
            count: billsDueSoon.length,
            amount: billsDueAmount,
            cta: "Bayar",
            owner: "Finance — Kas",
            due: "≤ 7 hari",
            impact: "Menurunkan Utang Usaha dan Kas/Bank",
        })
    }
    if (draftInvoices > 0) {
        actions.push({
            id: "inv-draft",
            module: "finance",
            title: "Kirim invoice yang masih draft",
            detail: `${draftInvoices} invoice pelanggan belum terkirim — pendapatan belum diakui di jurnal`,
            href: "/finance/invoices",
            tone: "go",
            count: draftInvoices,
            amount: draftInvoicesAmount,
            cta: "Kirim invoice",
            owner: "Finance — Piutang",
            due: "Bulan ini",
            impact: "Mengakui Pendapatan + PPN Keluaran",
        })
    }
    if (draftBills > 0) {
        actions.push({
            id: "bill-draft",
            module: "finance",
            title: "Setujui bill vendor yang masih draft",
            detail: `${draftBills} tagihan siap disetujui — beban & utang belum masuk buku sebelum ini`,
            href: "/finance/bills?status=DRAFT",
            tone: "go",
            count: draftBills,
            amount: draftBillsAmount,
            cta: "Setujui",
            owner: "Finance — Utang",
            due: "Bulan ini",
            impact: "Menaikkan Beban/HPP + PPN Masukan dan Utang Usaha",
        })
    }
    if (matchExceptions.count > 0) {
        actions.push({
            id: "bill-mismatch",
            module: "finance",
            title: "Cek selisih 3-way tagihan vs barang masuk",
            detail: `${matchExceptions.count} draft bill qty-nya lebih besar dari yang diterima — jangan Setujui sebelum dicek`,
            href: "/finance/bills?status=DRAFT",
            tone: "warn",
            count: matchExceptions.count,
            amount: matchExceptions.amount,
            cta: "Cek selisih",
            owner: "Finance — Utang",
            due: "Hari ini",
            impact: "Qty tagihan > qty diterima — jangan Setujui sebelum dicek",
        })
    }
    if (acceptedGrnWithoutBill > 0) {
        actions.push({
            id: "grn-bill",
            module: "procurement",
            title: "Buat bill dari barang yang sudah diterima",
            detail: `${acceptedGrnWithoutBill} barang masuk (GRN) belum ada tagihan vendor — biaya belum tercatat`,
            href: "/finance/bills",
            tone: "warn",
            count: acceptedGrnWithoutBill,
            cta: "Buat bill",
            owner: "Pengadaan",
            due: "≤ 7 hari",
            impact: "Mencocokkan stok masuk dengan Utang Usaha",
        })
    }
    if (pendingPR > 0) {
        actions.push({
            id: "pr-approve",
            module: "procurement",
            title: "Setujui permintaan beli dari site",
            detail: `${pendingPR} permintaan (PR) menunggu keputusan owner`,
            href: "/procurement/requests",
            tone: "warn",
            count: pendingPR,
            cta: "Setujui",
            owner: "Pengadaan",
            due: "≤ 7 hari",
            impact: "Belum menyentuh jurnal — baru komitmen belanja",
        })
    }
    if (pendingPO > 0) {
        actions.push({
            id: "po-approve",
            module: "procurement",
            title: "Setujui purchase order ke vendor",
            detail: pendingPOFirst
                ? `${pendingPO} PO menunggu approval, mulai dari ${pendingPOFirst.number}`
                : `${pendingPO} PO menunggu approval`,
            href: "/procurement",
            tone: "warn",
            count: pendingPO,
            amount: pendingPOAmount,
            cta: "Setujui PO",
            owner: "Pengadaan",
            due: "≤ 7 hari",
            impact: "Belum menyentuh jurnal — jurnal jalan saat barang diterima",
        })
    }
    if (typeof lowStock === "number" && lowStock > 0) {
        actions.push({
            id: "low-stock",
            module: "inventory",
            title: "Restock spare part di bawah stok minimum",
            detail: `${lowStock} item menipis — unit bisa berhenti kalau part habis`,
            href: firstLowStockId ? `/inventory/alerts?buat=${firstLowStockId}` : "/inventory/alerts",
            tone: "warn",
            count: lowStock,
            cta: "Lihat & buat PR",
            owner: "Logistik gudang",
            due: "≤ 7 hari",
            impact: "Menjaga Persediaan agar produksi tidak berhenti",
        })
    }
    if (fleetBare > 0) {
        actions.push({
            id: "fleet-asset",
            module: "fleet",
            title: "Kapitalisasi unit armada jadi aset tetap",
            detail: fleetBareFirst
                ? `${fleetBare} unit milik perusahaan belum masuk register aset, mulai dari ${fleetBareFirst.plateNumber} (${fleetBareFirst.brand} ${fleetBareFirst.model})`
                : `${fleetBare} unit milik perusahaan belum masuk register aset`,
            href: fleetBareFirst ? `/fleet/${fleetBareFirst.id}` : "/fleet",
            tone: "go",
            count: fleetBare,
            cta: "Kapitalisasi",
            owner: "Finance — Aset",
            due: "Bulan ini",
            impact: "Memindahkan nilai unit ke Aset Tetap dan memulai penyusutan",
        })
    }
    if (complianceFleet > 0) {
        actions.push({
            id: "fleet-docs",
            module: "fleet",
            title: "Perpanjang STNK / KIR / asuransi unit",
            detail: soonestDocExpiry
                ? `${complianceFleet} unit dokumennya habis ≤ 30 hari — paling dekat ${soonestDocExpiry.plate} (${soonestDocExpiry.days <= 0 ? "sudah lewat" : `${soonestDocExpiry.days} hari lagi`})`
                : `${complianceFleet} unit dokumennya habis ≤ 30 hari`,
            href: soonestDocUnit ? `/fleet/${soonestDocUnit.id}` : "/fleet",
            tone: "critical",
            count: complianceFleet,
            cta: "Urus dokumen",
            owner: "Logistik armada",
            due: soonestDocExpiry && soonestDocExpiry.days <= 0 ? "Terlambat" : "≤ 30 hari",
            impact: "Unit tanpa dokumen sah tidak boleh jalan ke site",
        })
    }
    if (unpostedPayroll) {
        actions.push({
            id: "payroll-post",
            module: "hcm",
            title: "Posting jurnal gaji & BPJS",
            detail: `Payroll ${period} belum masuk buku besar — laba bulan ini masih terlihat lebih besar dari kenyataan`,
            href: "/hcm/payroll",
            tone: "critical",
            amount: payrollCompanyCost,
            cta: "Posting jurnal",
            owner: "Finance — Payroll",
            due: "Sebelum tutup bulan",
            impact: "Mengakui Beban Gaji + BPJS perusahaan",
        })
    }
    if (pendingLeave > 0) {
        actions.push({
            id: "leave",
            module: "hcm",
            title: "Putuskan pengajuan cuti karyawan",
            detail: `${pendingLeave} pengajuan cuti menunggu — jadwal shift site ikut tertahan`,
            href: "/hcm/attendance",
            tone: "warn",
            count: pendingLeave,
            cta: "Review cuti",
            owner: "HRD",
            due: "≤ 7 hari",
            impact: "Tidak menyentuh jurnal — memengaruhi jadwal kerja",
        })
    }

    const priority: Record<CommandAction["tone"], number> = { critical: 0, warn: 1, go: 2 }
    actions.sort((a, b) => {
        const byTone = priority[a.tone] - priority[b.tone]
        if (byTone !== 0) return byTone
        const byAmount = (b.amount ?? 0) - (a.amount ?? 0)
        if (byAmount !== 0) return byAmount
        return (b.count ?? 0) - (a.count ?? 0)
    })

    const queued = actions.slice(0, 10)

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
        queue: {
            total: actions.length,
            segera: actions.filter((a) => a.tone === "critical").length,
            mingguIni: actions.filter((a) => a.tone === "warn").length,
            terjadwal: actions.filter((a) => a.tone === "go").length,
            amountHeld: actions.reduce((sum, a) => sum + (a.amount ?? 0), 0),
        },
        actions: queued,
    }
}
