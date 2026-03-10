"use client"

import React, { useState } from "react"
import {
    Calendar as CalendarIcon,
    Download,
    TrendingUp,
    FileText,
    TrendingDown,
    Wallet,
    Building,
    BarChart3,
    Scale,
    Users,
    Truck,
    AlertTriangle,
    Check,
    Package,
    Receipt,
    PiggyBank,
    ChevronRight,
    ChevronDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import Link from "next/link"
import { formatIDR } from "@/lib/utils"
import { toast } from "sonner"
import * as XLSX from "xlsx"
import { useFinanceReportsAll } from "@/hooks/use-finance-reports"
import { Loader2 } from "lucide-react"

type ReportType = "pnl" | "bs" | "cf" | "tb" | "equity_changes" | "ar_aging" | "ap_aging" | "inventory_turnover" | "tax_report" | "budget_vs_actual"

interface SidebarGroup {
    label: string
    color: string
    items: { key: ReportType; label: string; icon: React.ReactNode }[]
}

const sidebarGroups: SidebarGroup[] = [
    {
        label: "Laporan Utama",
        color: "blue",
        items: [
            { key: "pnl", label: "Laba Rugi", icon: <TrendingUp className="h-3.5 w-3.5" /> },
            { key: "bs", label: "Neraca", icon: <Building className="h-3.5 w-3.5" /> },
            { key: "cf", label: "Arus Kas", icon: <Wallet className="h-3.5 w-3.5" /> },
        ],
    },
    {
        label: "Neraca & Saldo",
        color: "indigo",
        items: [
            { key: "tb", label: "Neraca Saldo", icon: <Scale className="h-3.5 w-3.5" /> },
            { key: "equity_changes", label: "Perubahan Ekuitas", icon: <TrendingDown className="h-3.5 w-3.5" /> },
        ],
    },
    {
        label: "Piutang & Hutang",
        color: "orange",
        items: [
            { key: "ar_aging", label: "AR Aging", icon: <Users className="h-3.5 w-3.5" /> },
            { key: "ap_aging", label: "AP Aging", icon: <Truck className="h-3.5 w-3.5" /> },
        ],
    },
    {
        label: "Operasional",
        color: "emerald",
        items: [
            { key: "inventory_turnover", label: "Perputaran Persediaan", icon: <Package className="h-3.5 w-3.5" /> },
            { key: "tax_report", label: "Laporan Pajak (PPN)", icon: <Receipt className="h-3.5 w-3.5" /> },
        ],
    },
    {
        label: "Anggaran",
        color: "violet",
        items: [
            { key: "budget_vs_actual", label: "Anggaran vs Realisasi", icon: <PiggyBank className="h-3.5 w-3.5" /> },
        ],
    },
]

export default function FinancialReportsPage() {
    const [reportType, setReportType] = useState<ReportType>("pnl")
    const [dateDialogOpen, setDateDialogOpen] = useState(false)
    const [exportDialogOpen, setExportDialogOpen] = useState(false)
    const [exportFormat, setExportFormat] = useState<"CSV" | "XLS">("CSV")
    const [bsExpanded, setBsExpanded] = useState<{ currentAssets: boolean; currentLiabilities: boolean; capital: boolean }>({
        currentAssets: false, currentLiabilities: false, capital: false,
    })

    const currentYear = new Date().getFullYear()
    const [startDate, setStartDate] = useState(new Date(currentYear, 0, 1))
    const [endDate, setEndDate] = useState(new Date())
    const [draftStartDate, setDraftStartDate] = useState(new Date(currentYear, 0, 1).toISOString().slice(0, 10))
    const [draftEndDate, setDraftEndDate] = useState(new Date().toISOString().slice(0, 10))

    const [expandedAR, setExpandedAR] = useState<Set<string>>(new Set())
    const [expandedAP, setExpandedAP] = useState<Set<string>>(new Set())

    const toggleAR = (id: string) => setExpandedAR(prev => {
        const next = new Set(prev)
        next.has(id) ? next.delete(id) : next.add(id)
        return next
    })
    const toggleAP = (id: string) => setExpandedAP(prev => {
        const next = new Set(prev)
        next.has(id) ? next.delete(id) : next.add(id)
        return next
    })

    // All reports + KPI in one consolidated API call
    const { data, isLoading, isError, error } = useFinanceReportsAll(startDate, endDate)
    const kpi = data?.kpi
    const kpiLoading = isLoading
    const reportLoading = isLoading

    // Extract typed data from the consolidated response — tab switching is instant
    const pnlData = data?.reports?.pnl ?? null
    const balanceSheetData = data?.reports?.bs ?? null
    const cashFlowData = data?.reports?.cf ?? null
    const trialBalanceData = data?.reports?.tb ?? null
    const arAgingData = data?.reports?.ar_aging ?? null
    const apAgingData = data?.reports?.ap_aging ?? null
    const equityData = data?.reports?.equity_changes ?? null
    const inventoryTurnoverData = data?.reports?.inventory_turnover ?? null
    const taxData = data?.reports?.tax_report ?? null
    const budgetVsActualData = data?.reports?.budget_vs_actual ?? null

    function applyDateRange() {
        const nextStart = new Date(draftStartDate)
        const nextEnd = new Date(draftEndDate)
        if (Number.isNaN(nextStart.getTime()) || Number.isNaN(nextEnd.getTime()) || nextStart > nextEnd) {
            toast.error("Rentang tanggal tidak valid")
            return
        }
        setStartDate(nextStart)
        setEndDate(nextEnd)
        setDateDialogOpen(false)
        toast.success("Rentang tanggal diperbarui")
    }

    // Build styled worksheet using aoa_to_sheet for full control
    function buildExportSheet(): { ws: XLSX.WorkSheet; sheetName: string } | null {
        const idr = '"Rp "#,##0'
        const periodLabel = `Periode: ${startDate.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })} - ${endDate.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`

        if (reportType === "pnl" && pnlData) {
            const aoa: any[][] = [
                ["LAPORAN LABA RUGI", ""],
                [periodLabel, ""],
                ["", ""],
                ["KETERANGAN", "JUMLAH (Rp)"],
                ["Pendapatan (Revenue)", Number(pnlData.revenue ?? 0)],
                ["  Harga Pokok Penjualan (HPP)", -Number(pnlData.costOfGoodsSold || 0)],
                ["LABA KOTOR", Number(pnlData.grossProfit || 0)],
                ["", ""],
                ["Beban Operasional", -Number(pnlData.totalOperatingExpenses || 0)],
                ...((pnlData.operatingExpenses || []) as any[]).map((exp: any) => ([
                    `    ${exp.category}`, -Number(exp.amount || 0),
                ])),
                ["", ""],
                ["LABA OPERASIONAL", Number(pnlData.operatingIncome || 0)],
                ["  Pajak Penghasilan (PPn 22%)", -Number(pnlData.taxExpense || 0)],
                ["", ""],
                ["LABA BERSIH", Number(pnlData.netIncome || 0)],
            ]
            const ws = XLSX.utils.aoa_to_sheet(aoa)
            ws["!cols"] = [{ wch: 40 }, { wch: 25 }]
            // Set number format on amount cells (column B, starting from row 5)
            for (let r = 4; r < aoa.length; r++) {
                const cell = ws[XLSX.utils.encode_cell({ r, c: 1 })]
                if (cell && typeof cell.v === "number") cell.z = idr
            }
            return { ws, sheetName: "Laba Rugi" }
        }

        if (reportType === "bs" && balanceSheetData) {
            const bs = balanceSheetData
            const aoa: any[][] = [
                ["NERACA (BALANCE SHEET)", ""],
                [periodLabel, ""],
                ["", ""],
                ["KETERANGAN", "JUMLAH (Rp)"],
                ["", ""],
                ["ASET", ""],
                ...(bs.assets?.currentAssets || []).map((a: any) => ([`  ${a.name}`, Number(a.balance || 0)])),
                ["Total Aset Lancar", Number(bs.assets?.totalCurrentAssets || 0)],
                ["", ""],
                ...(bs.assets?.fixedAssets || []).map((a: any) => ([`  ${a.name}`, Number(a.balance || 0)])),
                ["Total Aset Tetap", Number(bs.assets?.totalFixedAssets || 0)],
                ["TOTAL ASET", Number(bs.assets?.totalAssets || 0)],
                ["", ""],
                ["KEWAJIBAN", ""],
                ...(bs.liabilities?.items || []).map((l: any) => ([`  ${l.name}`, Number(l.balance || 0)])),
                ["TOTAL KEWAJIBAN", Number(bs.liabilities?.totalLiabilities || 0)],
                ["", ""],
                ["EKUITAS", ""],
                ...(bs.equity?.items || []).map((e: any) => ([`  ${e.name}`, Number(e.balance || 0)])),
                ["  Laba Ditahan (Tahun Sebelumnya)", Number(bs.equity?.retainedEarnings || 0)],
                ["  Laba Tahun Berjalan", Number(bs.equity?.currentYearNetIncome || 0)],
                ["TOTAL EKUITAS", Number(bs.equity?.totalEquity || 0)],
                ["", ""],
                ["TOTAL KEWAJIBAN + EKUITAS", Number(bs.totalLiabilitiesAndEquity || 0)],
            ]
            const ws = XLSX.utils.aoa_to_sheet(aoa)
            ws["!cols"] = [{ wch: 40 }, { wch: 25 }]
            for (let r = 4; r < aoa.length; r++) {
                const cell = ws[XLSX.utils.encode_cell({ r, c: 1 })]
                if (cell && typeof cell.v === "number") cell.z = idr
            }
            return { ws, sheetName: "Neraca" }
        }

        if (reportType === "cf" && cashFlowData) {
            const cf = cashFlowData
            const aoa: any[][] = [
                ["LAPORAN ARUS KAS", ""],
                [periodLabel, ""],
                ["", ""],
                ["KETERANGAN", "JUMLAH (Rp)"],
                ["", ""],
                ["AKTIVITAS OPERASI", ""],
                ["  Laba Bersih", Number(cf.operatingActivities?.netIncome || 0)],
                ...((cf.operatingActivities?.changesInWorkingCapital || []) as any[]).map((item: any) => ([
                    `  ${item.description}`, Number(item.amount || 0),
                ])),
                ["Arus Kas Bersih dari Operasi", Number(cf.operatingActivities?.netCashFromOperating || 0)],
                ["", ""],
                ["AKTIVITAS INVESTASI", ""],
                ...((cf.investingActivities?.items || []) as any[]).map((item: any) => ([
                    `  ${item.description}`, Number(item.amount || 0),
                ])),
                ["Arus Kas Bersih dari Investasi", Number(cf.investingActivities?.netCashFromInvesting || 0)],
                ["", ""],
                ["AKTIVITAS PENDANAAN", ""],
                ...((cf.financingActivities?.items || []) as any[]).map((item: any) => ([
                    `  ${item.description}`, Number(item.amount || 0),
                ])),
                ["Arus Kas Bersih dari Pendanaan", Number(cf.financingActivities?.netCashFromFinancing || 0)],
                ["", ""],
                ["KENAIKAN BERSIH KAS", Number(cf.netIncreaseInCash || 0)],
                ["Saldo Kas Awal", Number(cf.beginningCash || 0)],
                ["Saldo Kas Akhir", Number(cf.endingCash || 0)],
            ]
            const ws = XLSX.utils.aoa_to_sheet(aoa)
            ws["!cols"] = [{ wch: 40 }, { wch: 25 }]
            for (let r = 4; r < aoa.length; r++) {
                const cell = ws[XLSX.utils.encode_cell({ r, c: 1 })]
                if (cell && typeof cell.v === "number") cell.z = idr
            }
            return { ws, sheetName: "Arus Kas" }
        }

        if (reportType === "tb" && trialBalanceData) {
            const aoa: any[][] = [
                ["NERACA SALDO (TRIAL BALANCE)", "", "", "", ""],
                [periodLabel, "", "", "", ""],
                ["", "", "", "", ""],
                ["KODE", "NAMA AKUN", "TIPE", "DEBIT (Rp)", "KREDIT (Rp)"],
                ...trialBalanceData.rows.map((r: any) => ([
                    r.accountCode, r.accountName, r.accountType, r.debit || 0, r.credit || 0,
                ])),
                ["", "", "", "", ""],
                ["", "", "TOTAL", trialBalanceData.totals.totalDebits, trialBalanceData.totals.totalCredits],
            ]
            const ws = XLSX.utils.aoa_to_sheet(aoa)
            ws["!cols"] = [{ wch: 12 }, { wch: 35 }, { wch: 12 }, { wch: 22 }, { wch: 22 }]
            for (let r = 4; r < aoa.length; r++) {
                for (const c of [3, 4]) {
                    const cell = ws[XLSX.utils.encode_cell({ r, c })]
                    if (cell && typeof cell.v === "number") cell.z = idr
                }
            }
            return { ws, sheetName: "Neraca Saldo" }
        }

        if (reportType === "ar_aging" && arAgingData) {
            const aoa: any[][] = [
                ["AGING PIUTANG (AR)", "", "", "", "", ""],
                [periodLabel, "", "", "", "", ""],
                ["", "", "", "", "", ""],
                ["PELANGGAN", "CURRENT (Rp)", "1-30 HARI (Rp)", "31-60 HARI (Rp)", "61-90 HARI (Rp)", "90+ HARI (Rp)", "TOTAL (Rp)"],
                ...arAgingData.byCustomer.map((c: any) => ([
                    c.customerName, c.current || 0, c.d1_30 || 0, c.d31_60 || 0, c.d61_90 || 0, c.d90_plus || 0, c.total || 0,
                ])),
                ["", "", "", "", "", "", ""],
                ["TOTAL",
                    arAgingData.summary.current || 0, arAgingData.summary.d1_30 || 0,
                    arAgingData.summary.d31_60 || 0, arAgingData.summary.d61_90 || 0,
                    arAgingData.summary.d90_plus || 0, arAgingData.summary.totalOutstanding || 0],
            ]
            const ws = XLSX.utils.aoa_to_sheet(aoa)
            ws["!cols"] = [{ wch: 30 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 22 }]
            for (let r = 4; r < aoa.length; r++) {
                for (let c = 1; c <= 6; c++) {
                    const cell = ws[XLSX.utils.encode_cell({ r, c })]
                    if (cell && typeof cell.v === "number") cell.z = idr
                }
            }
            return { ws, sheetName: "AR Aging" }
        }

        if (reportType === "ap_aging" && apAgingData) {
            const aoa: any[][] = [
                ["AGING HUTANG (AP)", "", "", "", "", ""],
                [periodLabel, "", "", "", "", ""],
                ["", "", "", "", "", ""],
                ["PEMASOK", "CURRENT (Rp)", "1-30 HARI (Rp)", "31-60 HARI (Rp)", "61-90 HARI (Rp)", "90+ HARI (Rp)", "TOTAL (Rp)"],
                ...apAgingData.bySupplier.map((s: any) => ([
                    s.supplierName, s.current || 0, s.d1_30 || 0, s.d31_60 || 0, s.d61_90 || 0, s.d90_plus || 0, s.total || 0,
                ])),
                ["", "", "", "", "", "", ""],
                ["TOTAL",
                    apAgingData.summary.current || 0, apAgingData.summary.d1_30 || 0,
                    apAgingData.summary.d31_60 || 0, apAgingData.summary.d61_90 || 0,
                    apAgingData.summary.d90_plus || 0, apAgingData.summary.totalOutstanding || 0],
            ]
            const ws = XLSX.utils.aoa_to_sheet(aoa)
            ws["!cols"] = [{ wch: 30 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 22 }]
            for (let r = 4; r < aoa.length; r++) {
                for (let c = 1; c <= 6; c++) {
                    const cell = ws[XLSX.utils.encode_cell({ r, c })]
                    if (cell && typeof cell.v === "number") cell.z = idr
                }
            }
            return { ws, sheetName: "AP Aging" }
        }

        if (reportType === "equity_changes" && equityData) {
            const aoa: any[][] = [
                ["PERUBAHAN EKUITAS", "", "", "", ""],
                [periodLabel, "", "", "", ""],
                ["", "", "", "", ""],
                ["AKUN", "SALDO AWAL (Rp)", "PENAMBAHAN (Rp)", "PENGURANGAN (Rp)", "SALDO AKHIR (Rp)"],
                ...equityData.accounts.map((a: any) => ([
                    a.accountName, Number(a.openingBalance || 0), Number(a.additions || 0), Number(a.deductions || 0), Number(a.closingBalance || 0),
                ])),
            ]
            const ws = XLSX.utils.aoa_to_sheet(aoa)
            ws["!cols"] = [{ wch: 30 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 22 }]
            for (let r = 4; r < aoa.length; r++) {
                for (let c = 1; c <= 4; c++) {
                    const cell = ws[XLSX.utils.encode_cell({ r, c })]
                    if (cell && typeof cell.v === "number") cell.z = idr
                }
            }
            return { ws, sheetName: "Perubahan Ekuitas" }
        }

        if (reportType === "inventory_turnover" && inventoryTurnoverData) {
            const aoa: any[][] = [
                ["PERPUTARAN PERSEDIAAN", "", "", "", "", "", "", ""],
                [periodLabel, "", "", "", "", "", "", ""],
                ["", "", "", "", "", "", "", ""],
                ["KODE", "PRODUK", "STOK AWAL", "MASUK", "KELUAR", "STOK AKHIR", "RASIO TURNOVER", "HARI DI GUDANG", "NILAI (Rp)"],
                ...inventoryTurnoverData.items.map((i: any) => ([
                    i.productCode, i.productName, i.beginningStock || 0, i.totalIn || 0, i.totalOut || 0,
                    i.currentStock || 0, Number(i.turnoverRatio || 0).toFixed(2), i.daysOnHand || 0, Number(i.inventoryValue || 0),
                ])),
            ]
            const ws = XLSX.utils.aoa_to_sheet(aoa)
            ws["!cols"] = [{ wch: 12 }, { wch: 30 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 22 }]
            for (let r = 4; r < aoa.length; r++) {
                const cell = ws[XLSX.utils.encode_cell({ r, c: 8 })]
                if (cell && typeof cell.v === "number") cell.z = idr
            }
            return { ws, sheetName: "Perputaran Persediaan" }
        }

        if (reportType === "tax_report" && taxData) {
            const aoa: any[][] = [
                ["LAPORAN PAJAK (PPN)", "", "", "", "", "", ""],
                [periodLabel, "", "", "", "", "", ""],
                ["", "", "", "", "", "", ""],
                ["JENIS", "NO. FAKTUR", "TANGGAL", "NAMA", "DPP (Rp)", "PPN (Rp)", "TOTAL (Rp)"],
            ]
            taxData.ppnKeluaran?.items?.forEach((i: any) => {
                aoa.push(["PPN Keluaran", i.number, i.date, i.partyName, Number(i.dpp || 0), Number(i.ppn || 0), Number(i.total || 0)])
            })
            taxData.ppnMasukan?.items?.forEach((i: any) => {
                aoa.push(["PPN Masukan", i.number, i.date, i.partyName, Number(i.dpp || 0), Number(i.ppn || 0), Number(i.total || 0)])
            })
            const ws = XLSX.utils.aoa_to_sheet(aoa)
            ws["!cols"] = [{ wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 30 }, { wch: 20 }, { wch: 18 }, { wch: 22 }]
            for (let r = 4; r < aoa.length; r++) {
                for (let c = 4; c <= 6; c++) {
                    const cell = ws[XLSX.utils.encode_cell({ r, c })]
                    if (cell && typeof cell.v === "number") cell.z = idr
                }
            }
            return { ws, sheetName: "Pajak PPN" }
        }

        if (reportType === "budget_vs_actual" && budgetVsActualData) {
            const aoa: any[][] = [
                ["ANGGARAN VS REALISASI", "", "", "", "", ""],
                [periodLabel, "", "", "", "", ""],
                ["", "", "", "", "", ""],
                ["KODE AKUN", "NAMA AKUN", "ANGGARAN (Rp)", "REALISASI (Rp)", "SELISIH (Rp)", "SELISIH (%)"],
                ...budgetVsActualData.items.map((i: any) => ([
                    i.accountCode, i.accountName, Number(i.budgetAmount || 0), Number(i.actualAmount || 0), Number(i.variance || 0), `${Number(i.variancePct || 0).toFixed(1)}%`,
                ])),
            ]
            const ws = XLSX.utils.aoa_to_sheet(aoa)
            ws["!cols"] = [{ wch: 14 }, { wch: 30 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 14 }]
            for (let r = 4; r < aoa.length; r++) {
                for (let c = 2; c <= 4; c++) {
                    const cell = ws[XLSX.utils.encode_cell({ r, c })]
                    if (cell && typeof cell.v === "number") cell.z = idr
                }
            }
            return { ws, sheetName: "Anggaran vs Realisasi" }
        }

        return null
    }

    function exportReportPack() {
        const result = buildExportSheet()
        if (!result) { toast.error("Data laporan tidak tersedia"); return }
        const { ws, sheetName } = result
        const stamp = new Date().toISOString().slice(0, 10)

        if (exportFormat === "CSV") {
            const csv = XLSX.utils.sheet_to_csv(ws)
            const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
            const url = URL.createObjectURL(blob)
            const a = document.createElement("a"); a.href = url; a.download = `laporan-${reportType}-${stamp}.csv`; a.click()
            URL.revokeObjectURL(url)
        } else {
            const wb = XLSX.utils.book_new()
            XLSX.utils.book_append_sheet(wb, ws, sheetName)
            XLSX.writeFile(wb, `laporan-${reportType}-${stamp}.xlsx`, { bookType: "xlsx" })
        }
        setExportDialogOpen(false)
        toast.success(`Export ${exportFormat} berhasil`)
    }

    const reportLabel = sidebarGroups.flatMap(g => g.items).find(i => i.key === reportType)?.label ?? ""

    return (
        <div className="mf-page">

            {/* COMMAND HEADER */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900">
                <div className="px-6 py-4 flex items-center justify-between border-l-[6px] border-l-blue-400">
                    <div className="flex items-center gap-3">
                        <BarChart3 className="h-5 w-5 text-blue-500" />
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                                Laporan Keuangan
                            </h1>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="inline-flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold px-2.5 py-0.5 rounded-sm">
                                    <CalendarIcon className="h-3 w-3" />
                                    Fiscal {currentYear}
                                </span>
                                <span className="text-zinc-900 dark:text-zinc-100 text-[11px] font-bold tracking-wide">
                                    {startDate.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })} — {endDate.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Dialog open={dateDialogOpen} onOpenChange={setDateDialogOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="border-2 border-black text-[10px] font-black uppercase tracking-widest h-9 px-4 rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none">
                                    <CalendarIcon className="mr-2 h-3.5 w-3.5" /> Periode
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Pilih Rentang Tanggal</DialogTitle>
                                    <DialogDescription>Atur periode laporan keuangan.</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-3">
                                    <div className="space-y-1.5">
                                        <Label>Tanggal Mulai</Label>
                                        <Input type="date" value={draftStartDate} onChange={(e) => setDraftStartDate(e.target.value)} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Tanggal Akhir</Label>
                                        <Input type="date" value={draftEndDate} onChange={(e) => setDraftEndDate(e.target.value)} />
                                    </div>
                                    <Button onClick={applyDateRange} className="w-full">Terapkan</Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                        <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
                            <DialogTrigger asChild>
                                <Button className="bg-emerald-600 text-white hover:bg-emerald-700 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-[1px] active:shadow-none transition-all text-[10px] font-black uppercase tracking-widest h-9 px-4">
                                    <Download className="mr-2 h-3.5 w-3.5" /> Export
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Export Laporan</DialogTitle>
                                    <DialogDescription>Unduh laporan dalam format CSV atau XLS.</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-3">
                                    <div className="space-y-1.5">
                                        <Label>Format</Label>
                                        <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as "CSV" | "XLS")}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="CSV">CSV</SelectItem>
                                                <SelectItem value="XLS">XLS</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <Button onClick={exportReportPack} className="w-full">Download</Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
            </div>

            {/* KPI PULSE STRIP */}
            <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <div className="grid grid-cols-2 md:grid-cols-4">
                    <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800 border-b-2 md:border-b-0">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-blue-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Pendapatan</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-zinc-900 dark:text-white">{kpiLoading ? <span className="inline-block h-8 w-28 bg-zinc-200 dark:bg-zinc-700 animate-pulse rounded" /> : formatIDR(kpi?.revenue || 0)}</div>
                        <div className="text-[10px] font-bold text-blue-600 mt-1">Total pendapatan periode ini</div>
                    </div>
                    <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800 border-b-2 md:border-b-0">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <FileText className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Laba Bersih</span>
                        </div>
                        <div className={`text-2xl md:text-3xl font-black tracking-tighter ${(kpi?.netIncome || 0) >= 0 ? "text-emerald-600" : "text-red-600"}`}>{kpiLoading ? <span className="inline-block h-8 w-28 bg-zinc-200 dark:bg-zinc-700 animate-pulse rounded" /> : formatIDR(kpi?.netIncome || 0)}</div>
                        <div className="text-[10px] font-bold text-emerald-600 mt-1">Setelah pajak</div>
                    </div>
                    <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-orange-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <Users className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Piutang Usaha</span>
                        </div>
                        {kpiLoading ? <span className="inline-block h-8 w-28 bg-zinc-200 dark:bg-zinc-700 animate-pulse rounded" /> : (
                            <>
                                <div className="text-2xl md:text-3xl font-black tracking-tighter text-orange-600">{formatIDR(kpi?.arOutstanding || 0)}</div>
                                {/* Collection progress bar */}
                                {(() => {
                                    const invoiced = kpi?.invoicedRevenue || 0
                                    const paid = kpi?.invoicedPaid || 0
                                    const collectPct = invoiced > 0 ? Math.round((paid / invoiced) * 100) : 0
                                    return invoiced > 0 ? (
                                        <div className="mt-2 space-y-1">
                                            <div className="flex items-center justify-between text-[9px] font-bold">
                                                <span className="text-zinc-400">Penagihan</span>
                                                <span className={collectPct >= 50 ? "text-emerald-600" : "text-orange-600"}>{collectPct}%</span>
                                            </div>
                                            <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                                <div className={`h-full rounded-full transition-all ${collectPct >= 50 ? "bg-emerald-500" : "bg-orange-400"}`} style={{ width: `${Math.min(collectPct, 100)}%` }} />
                                            </div>
                                            <div className="flex items-center justify-between text-[9px]">
                                                <span className="text-emerald-600 font-bold">Terbayar {formatIDR(paid)}</span>
                                                <span className="text-zinc-400">dari {formatIDR(invoiced)}</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-[10px] font-bold text-orange-600 mt-1">Belum tertagih periode ini</div>
                                    )
                                })()}
                            </>
                        )}
                    </div>
                    <div className="relative p-4 md:p-5">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-red-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <Truck className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Hutang Usaha</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-red-600">{kpiLoading ? <span className="inline-block h-8 w-28 bg-zinc-200 dark:bg-zinc-700 animate-pulse rounded" /> : formatIDR(kpi?.apOutstanding || 0)}</div>
                        <div className="text-[10px] font-bold text-red-600 mt-1">Belum dibayar periode ini</div>
                    </div>
                </div>
            </div>

            {/* SIDEBAR + REPORT CONTENT LAYOUT */}
            <div className="flex gap-4">
                {/* Sidebar Navigation */}
                <div className="hidden md:block w-[220px] shrink-0">
                    <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden sticky top-24">
                        <div className="px-3 py-2.5 border-b-2 border-black bg-zinc-50 dark:bg-zinc-800">
                            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Pilih Laporan</span>
                        </div>
                        <div className="py-1">
                            {sidebarGroups.map((group) => (
                                <div key={group.label}>
                                    <div className="px-3 pt-3 pb-1">
                                        <span className="text-[8px] font-black uppercase tracking-[0.15em] text-zinc-400">{group.label}</span>
                                    </div>
                                    {group.items.map((item) => (
                                        <button
                                            key={item.key}
                                            onClick={() => setReportType(item.key)}
                                            className={`w-full text-left px-3 py-2 flex items-center gap-2 text-[11px] font-bold transition-all ${
                                                reportType === item.key
                                                    ? "bg-black text-white"
                                                    : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
                                            }`}
                                        >
                                            {item.icon}
                                            <span className="truncate">{item.label}</span>
                                            {reportType === item.key && <ChevronRight className="h-3 w-3 ml-auto shrink-0" />}
                                        </button>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Mobile Report Selector (visible on small screens) */}
                <div className="md:hidden w-full">
                    <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden mb-4">
                        <div className="px-4 py-3 flex items-center gap-3 overflow-x-auto">
                            <div className="flex border-2 border-black flex-wrap">
                                {sidebarGroups.flatMap(g => g.items).map((t) => (
                                    <button
                                        key={t.key}
                                        onClick={() => setReportType(t.key)}
                                        className={`px-3 py-2 text-[9px] font-black uppercase tracking-widest transition-all border-r border-black last:border-r-0 flex items-center gap-1.5 whitespace-nowrap ${
                                            reportType === t.key ? "bg-black text-white" : "bg-white text-zinc-400 hover:bg-zinc-50"
                                        }`}
                                    >
                                        {t.icon}
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 min-w-0">
                    {reportLoading ? (
                        <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                            <div className="px-4 py-3 border-b-2 border-black bg-zinc-50 dark:bg-zinc-800 flex items-center gap-2">
                                <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                    Memuat {reportLabel}
                                </span>
                            </div>
                            <div className="p-6 space-y-4">
                                {/* Progress message */}
                                <div className="flex items-center justify-center gap-3 py-4">
                                    <div className="relative">
                                        <div className="h-10 w-10 rounded-full border-[3px] border-zinc-200 dark:border-zinc-700" />
                                        <div className="absolute inset-0 h-10 w-10 rounded-full border-[3px] border-blue-500 border-t-transparent animate-spin" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Mengambil data dari database...</p>
                                        <p className="text-xs text-zinc-400 mt-0.5">Menyiapkan laporan {reportLabel}</p>
                                    </div>
                                </div>
                                {/* Skeleton rows */}
                                <div className="space-y-3">
                                    {[100, 85, 92, 78, 88, 70].map((w, i) => (
                                        <div key={i} className="flex items-center gap-4">
                                            <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse" style={{ width: `${w * 0.4}%`, animationDelay: `${i * 100}ms` }} />
                                            <div className="ml-auto h-4 w-24 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse" style={{ animationDelay: `${i * 100 + 50}ms` }} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : isError ? (
                        <div className="bg-white dark:bg-zinc-900 border-2 border-red-500 shadow-[3px_3px_0px_0px_rgba(239,68,68,1)] p-12 text-center space-y-3">
                            <AlertTriangle className="h-8 w-8 text-red-500 mx-auto" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-red-500">Gagal memuat laporan</p>
                            <p className="text-xs text-zinc-500">{error instanceof Error ? error.message : 'Terjadi kesalahan saat memuat data. Silakan coba lagi.'}</p>
                            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>Coba Lagi</Button>
                        </div>
                    ) : (
                        <>
                            {/* P&L */}
                            {reportType === "pnl" && pnlData && (
                                <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                                    <div className="px-4 py-3 border-b-2 border-black bg-zinc-50 dark:bg-zinc-800 flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-zinc-500" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Laporan Laba Rugi</span>
                                    </div>
                                    <Table>
                                        <TableBody>
                                            <TableRow className="font-black bg-zinc-50 dark:bg-zinc-800">
                                                <TableCell className="w-[60%]">Pendapatan (Revenue)</TableCell>
                                                <TableCell className="text-right font-mono">{formatIDR(pnlData.revenue)}</TableCell>
                                            </TableRow>
                                            <TableRow>
                                                <TableCell className="pl-8">Harga Pokok Penjualan (HPP)</TableCell>
                                                <TableCell className="text-right font-mono text-red-600">({formatIDR(pnlData.costOfGoodsSold)})</TableCell>
                                            </TableRow>
                                            <TableRow className="font-bold bg-blue-50 dark:bg-blue-900/20">
                                                <TableCell>Laba Kotor</TableCell>
                                                <TableCell className="text-right font-mono text-blue-600">{formatIDR(pnlData.grossProfit)}</TableCell>
                                            </TableRow>
                                            <TableRow className="font-black bg-zinc-50 dark:bg-zinc-800">
                                                <TableCell>Beban Operasional</TableCell>
                                                <TableCell className="text-right font-mono text-red-600">({formatIDR(pnlData.totalOperatingExpenses)})</TableCell>
                                            </TableRow>
                                            {pnlData.operatingExpenses?.map((exp: any, idx: number) => (
                                                <TableRow key={idx}>
                                                    <TableCell className="pl-12 text-sm text-zinc-500">{exp.category}</TableCell>
                                                    <TableCell className="text-right font-mono text-sm text-red-600">({formatIDR(exp.amount)})</TableCell>
                                                </TableRow>
                                            ))}
                                            <TableRow className="font-bold bg-indigo-50 dark:bg-indigo-900/20">
                                                <TableCell>Laba Operasional</TableCell>
                                                <TableCell className="text-right font-mono text-indigo-600">{formatIDR(pnlData.operatingIncome)}</TableCell>
                                            </TableRow>
                                            {(pnlData.otherIncome > 0) && (
                                                <TableRow>
                                                    <TableCell className="pl-8">Pendapatan Lain-lain</TableCell>
                                                    <TableCell className="text-right font-mono text-emerald-600">{formatIDR(pnlData.otherIncome)}</TableCell>
                                                </TableRow>
                                            )}
                                            {(pnlData.otherExpenses > 0) && (
                                                <TableRow>
                                                    <TableCell className="pl-8">Biaya Lain-lain</TableCell>
                                                    <TableCell className="text-right font-mono text-red-600">({formatIDR(pnlData.otherExpenses)})</TableCell>
                                                </TableRow>
                                            )}
                                            {(pnlData.otherIncome > 0 || pnlData.otherExpenses > 0) && (
                                                <TableRow className="font-bold bg-zinc-50 dark:bg-zinc-800">
                                                    <TableCell>Laba Sebelum Pajak</TableCell>
                                                    <TableCell className="text-right font-mono">{formatIDR(pnlData.netIncomeBeforeTax)}</TableCell>
                                                </TableRow>
                                            )}
                                            <TableRow>
                                                <TableCell className="pl-8">Pajak Penghasilan (PPh 22%)</TableCell>
                                                <TableCell className="text-right font-mono text-red-600">({formatIDR(pnlData.taxExpense)})</TableCell>
                                            </TableRow>
                                            <TableRow className="font-black bg-emerald-50 dark:bg-emerald-900/20 border-t-2 border-black">
                                                <TableCell className="text-lg">LABA BERSIH</TableCell>
                                                <TableCell className={`text-right font-mono text-lg ${pnlData.netIncome >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                                                    {formatIDR(pnlData.netIncome)}
                                                </TableCell>
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                </div>
                            )}

                            {/* Balance Sheet */}
                            {reportType === "bs" && balanceSheetData && (() => {
                                const currentAssets = balanceSheetData.assets?.currentAssets || []
                                const currentLiabilities = balanceSheetData.liabilities?.currentLiabilities || []
                                const capitalItems = balanceSheetData.equity?.capital || []
                                const PREVIEW_COUNT = 3
                                return (
                                <div className="space-y-4">
                                {/* Balance Check Banner */}
                                {(() => {
                                    const diff = Math.abs((balanceSheetData.assets?.totalAssets || 0) - (balanceSheetData.totalLiabilitiesAndEquity || 0))
                                    const isBalanced = diff < 1
                                    return (
                                        <div className={`border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] px-4 py-3 flex items-center justify-between ${isBalanced ? "bg-emerald-50 dark:bg-emerald-900/20" : "bg-red-50 dark:bg-red-900/20"}`}>
                                            <div className="flex items-center gap-2">
                                                {isBalanced ? (
                                                    <Check className="h-4 w-4 text-emerald-600" />
                                                ) : (
                                                    <AlertTriangle className="h-4 w-4 text-red-600" />
                                                )}
                                                <span className={`text-[10px] font-black uppercase tracking-widest ${isBalanced ? "text-emerald-700" : "text-red-700"}`}>
                                                    {isBalanced ? "Neraca Seimbang" : `Neraca Tidak Seimbang (Selisih: ${formatIDR(diff)})`}
                                                </span>
                                            </div>
                                            <span className="text-[10px] font-black text-zinc-400">
                                                Per {new Date(balanceSheetData.asOfDate).toLocaleDateString("id-ID")}
                                            </span>
                                        </div>
                                    )
                                })()}
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                                        <div className="px-4 py-3 border-b-2 border-black bg-emerald-50 dark:bg-emerald-900/20 flex items-center gap-2">
                                            <TrendingUp className="h-4 w-4 text-emerald-600" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Aset</span>
                                        </div>
                                        <Table>
                                            <TableBody>
                                                <TableRow
                                                    className="bg-emerald-50/50 dark:bg-emerald-900/10 font-bold cursor-pointer hover:bg-emerald-100/50 transition-colors"
                                                    onClick={() => setBsExpanded(prev => ({ ...prev, currentAssets: !prev.currentAssets }))}
                                                >
                                                    <TableCell className="flex items-center gap-1">
                                                        {bsExpanded.currentAssets ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                                        Aset Lancar
                                                        {currentAssets.length > PREVIEW_COUNT && (
                                                            <span className="text-[9px] font-medium text-zinc-400 ml-1">({currentAssets.length} akun)</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono">{formatIDR(balanceSheetData.assets?.totalCurrentAssets)}</TableCell>
                                                </TableRow>
                                                {(bsExpanded.currentAssets ? currentAssets : currentAssets.slice(0, PREVIEW_COUNT)).map((asset: any, idx: number) => (
                                                    <TableRow key={idx}>
                                                        <TableCell className="pl-10 text-sm text-zinc-500">{asset.name}</TableCell>
                                                        <TableCell className="text-right font-mono text-sm">{formatIDR(asset.amount)}</TableCell>
                                                    </TableRow>
                                                ))}
                                                {!bsExpanded.currentAssets && currentAssets.length > PREVIEW_COUNT && (
                                                    <TableRow>
                                                        <TableCell
                                                            colSpan={2}
                                                            className="text-center text-[10px] font-bold text-emerald-600 cursor-pointer hover:bg-emerald-50 py-1.5"
                                                            onClick={() => setBsExpanded(prev => ({ ...prev, currentAssets: true }))}
                                                        >
                                                            + {currentAssets.length - PREVIEW_COUNT} akun lainnya
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                                <TableRow className="bg-zinc-50 dark:bg-zinc-800 font-bold">
                                                    <TableCell>Aset Tetap</TableCell>
                                                    <TableCell className="text-right font-mono">{formatIDR(balanceSheetData.assets?.totalFixedAssets)}</TableCell>
                                                </TableRow>
                                                <TableRow className="font-black bg-emerald-100 dark:bg-emerald-900/30 border-t-2 border-black">
                                                    <TableCell>TOTAL ASET</TableCell>
                                                    <TableCell className="text-right font-mono text-emerald-700">{formatIDR(balanceSheetData.assets?.totalAssets)}</TableCell>
                                                </TableRow>
                                            </TableBody>
                                        </Table>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                                            <div className="px-4 py-3 border-b-2 border-black bg-red-50 dark:bg-red-900/20 flex items-center gap-2">
                                                <TrendingDown className="h-4 w-4 text-red-600" />
                                                <span className="text-[10px] font-black uppercase tracking-widest text-red-700">Kewajiban</span>
                                            </div>
                                            <Table>
                                                <TableBody>
                                                    <TableRow
                                                        className="bg-red-50/50 dark:bg-red-900/10 font-bold cursor-pointer hover:bg-red-100/50 transition-colors"
                                                        onClick={() => setBsExpanded(prev => ({ ...prev, currentLiabilities: !prev.currentLiabilities }))}
                                                    >
                                                        <TableCell className="flex items-center gap-1">
                                                            {bsExpanded.currentLiabilities ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                                            Kewajiban Lancar
                                                            {currentLiabilities.length > PREVIEW_COUNT && (
                                                                <span className="text-[9px] font-medium text-zinc-400 ml-1">({currentLiabilities.length} akun)</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-right font-mono">{formatIDR(balanceSheetData.liabilities?.totalCurrentLiabilities)}</TableCell>
                                                    </TableRow>
                                                    {(bsExpanded.currentLiabilities ? currentLiabilities : currentLiabilities.slice(0, PREVIEW_COUNT)).map((liab: any, idx: number) => (
                                                        <TableRow key={idx}>
                                                            <TableCell className="pl-10 text-sm text-zinc-500">{liab.name}</TableCell>
                                                            <TableCell className="text-right font-mono text-sm">{formatIDR(liab.amount)}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                    {!bsExpanded.currentLiabilities && currentLiabilities.length > PREVIEW_COUNT && (
                                                        <TableRow>
                                                            <TableCell
                                                                colSpan={2}
                                                                className="text-center text-[10px] font-bold text-red-600 cursor-pointer hover:bg-red-50 py-1.5"
                                                                onClick={() => setBsExpanded(prev => ({ ...prev, currentLiabilities: true }))}
                                                            >
                                                                + {currentLiabilities.length - PREVIEW_COUNT} akun lainnya
                                                            </TableCell>
                                                        </TableRow>
                                                    )}
                                                    <TableRow className="font-black bg-red-100 dark:bg-red-900/30 border-t-2 border-black">
                                                        <TableCell>TOTAL KEWAJIBAN</TableCell>
                                                        <TableCell className="text-right font-mono text-red-700">{formatIDR(balanceSheetData.liabilities?.totalLiabilities)}</TableCell>
                                                    </TableRow>
                                                </TableBody>
                                            </Table>
                                        </div>

                                        <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                                            <div className="px-4 py-3 border-b-2 border-black bg-blue-50 dark:bg-blue-900/20 flex items-center gap-2">
                                                <Building className="h-4 w-4 text-blue-600" />
                                                <span className="text-[10px] font-black uppercase tracking-widest text-blue-700">Ekuitas</span>
                                            </div>
                                            <Table>
                                                <TableBody>
                                                    {(bsExpanded.capital ? capitalItems : capitalItems.slice(0, PREVIEW_COUNT)).map((cap: any, idx: number) => (
                                                        <TableRow key={idx}>
                                                            <TableCell className="text-sm text-zinc-500">{cap.name}</TableCell>
                                                            <TableCell className="text-right font-mono text-sm">{formatIDR(cap.amount)}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                    {!bsExpanded.capital && capitalItems.length > PREVIEW_COUNT && (
                                                        <TableRow>
                                                            <TableCell
                                                                colSpan={2}
                                                                className="text-center text-[10px] font-bold text-blue-600 cursor-pointer hover:bg-blue-50 py-1.5"
                                                                onClick={() => setBsExpanded(prev => ({ ...prev, capital: true }))}
                                                            >
                                                                + {capitalItems.length - PREVIEW_COUNT} akun lainnya
                                                            </TableCell>
                                                        </TableRow>
                                                    )}
                                                    <TableRow>
                                                        <TableCell className="text-sm text-zinc-500">Laba Ditahan (Tahun Sebelumnya)</TableCell>
                                                        <TableCell className="text-right font-mono text-sm">{formatIDR(balanceSheetData.equity?.retainedEarnings)}</TableCell>
                                                    </TableRow>
                                                    <TableRow>
                                                        <TableCell className="text-sm text-blue-600">Laba Tahun Berjalan</TableCell>
                                                        <TableCell className="text-right font-mono text-sm text-blue-600">{formatIDR(balanceSheetData.equity?.currentYearNetIncome || 0)}</TableCell>
                                                    </TableRow>
                                                    <TableRow className="font-black bg-blue-100 dark:bg-blue-900/30 border-t-2 border-black">
                                                        <TableCell>TOTAL EKUITAS</TableCell>
                                                        <TableCell className="text-right font-mono text-blue-700">{formatIDR(balanceSheetData.equity?.totalEquity)}</TableCell>
                                                    </TableRow>
                                                </TableBody>
                                            </Table>
                                        </div>

                                        {/* Total Kewajiban + Ekuitas — for easy balance check */}
                                        <div className="border-2 border-black bg-zinc-900 dark:bg-zinc-100 px-4 py-3 flex items-center justify-between">
                                            <span className="font-black text-sm text-white dark:text-black uppercase tracking-wide">Total Kewajiban + Ekuitas</span>
                                            <span className={`font-mono font-black text-lg ${
                                                Math.abs((balanceSheetData.assets?.totalAssets || 0) - (balanceSheetData.totalLiabilitiesAndEquity || 0)) < 1
                                                    ? "text-emerald-400 dark:text-emerald-600"
                                                    : "text-red-400 dark:text-red-600"
                                            }`}>
                                                {formatIDR(balanceSheetData.totalLiabilitiesAndEquity)}
                                            </span>
                                        </div>

                                        {/* Balance check diagnostic */}
                                        {balanceSheetData?.balanceCheck && !balanceSheetData.balanceCheck.isBalanced && (
                                            <div className="border-2 border-red-300 bg-red-50 p-3 flex items-center gap-2">
                                                <AlertTriangle className="h-4 w-4 text-red-500" />
                                                <span className="text-xs font-bold text-red-700 uppercase tracking-wide">
                                                    Neraca tidak seimbang — selisih {formatIDR(Math.abs(balanceSheetData.balanceCheck.difference))}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                </div>
                                )
                            })()}

                            {/* Cash Flow */}
                            {reportType === "cf" && cashFlowData && (
                                <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                                    <div className="px-4 py-3 border-b-2 border-black bg-zinc-50 dark:bg-zinc-800 flex items-center gap-2">
                                        <Wallet className="h-4 w-4 text-zinc-500" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Laporan Arus Kas</span>
                                    </div>
                                    <Table>
                                        <TableBody>
                                            <TableRow className="bg-emerald-50/50 dark:bg-emerald-900/10 font-bold">
                                                <TableCell colSpan={2}>Aktivitas Operasi</TableCell>
                                            </TableRow>
                                            <TableRow>
                                                <TableCell className="pl-8">Laba Bersih</TableCell>
                                                <TableCell className="text-right font-mono">{formatIDR(cashFlowData.operatingActivities?.netIncome)}</TableCell>
                                            </TableRow>
                                            {cashFlowData.operatingActivities?.changesInWorkingCapital?.map((adj: any, idx: number) => (
                                                <TableRow key={idx}>
                                                    <TableCell className="pl-8 text-sm text-zinc-500">{adj.description}</TableCell>
                                                    <TableCell className={`text-right font-mono text-sm ${adj.amount >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatIDR(adj.amount)}</TableCell>
                                                </TableRow>
                                            ))}
                                            <TableRow className="font-bold bg-zinc-50 dark:bg-zinc-800">
                                                <TableCell>Arus Kas Bersih dari Operasi</TableCell>
                                                <TableCell className={`text-right font-mono ${cashFlowData.operatingActivities?.netCashFromOperating >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatIDR(cashFlowData.operatingActivities?.netCashFromOperating)}</TableCell>
                                            </TableRow>

                                            <TableRow className="bg-zinc-50 dark:bg-zinc-800 font-bold">
                                                <TableCell colSpan={2}>Aktivitas Investasi</TableCell>
                                            </TableRow>
                                            {cashFlowData.investingActivities?.items?.map((item: any, idx: number) => (
                                                <TableRow key={idx}>
                                                    <TableCell className="pl-8 text-sm text-zinc-500">{item.description}</TableCell>
                                                    <TableCell className={`text-right font-mono text-sm ${item.amount >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatIDR(item.amount)}</TableCell>
                                                </TableRow>
                                            ))}
                                            <TableRow className="font-bold bg-zinc-50 dark:bg-zinc-800">
                                                <TableCell>Arus Kas Bersih dari Investasi</TableCell>
                                                <TableCell className={`text-right font-mono ${cashFlowData.investingActivities?.netCashFromInvesting >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatIDR(cashFlowData.investingActivities?.netCashFromInvesting)}</TableCell>
                                            </TableRow>

                                            <TableRow className="bg-zinc-50 dark:bg-zinc-800 font-bold">
                                                <TableCell colSpan={2}>Aktivitas Pendanaan</TableCell>
                                            </TableRow>
                                            {cashFlowData.financingActivities?.items?.map((item: any, idx: number) => (
                                                <TableRow key={idx}>
                                                    <TableCell className="pl-8 text-sm text-zinc-500">{item.description}</TableCell>
                                                    <TableCell className={`text-right font-mono text-sm ${item.amount >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatIDR(item.amount)}</TableCell>
                                                </TableRow>
                                            ))}
                                            <TableRow className="font-bold bg-zinc-50 dark:bg-zinc-800">
                                                <TableCell>Arus Kas Bersih dari Pendanaan</TableCell>
                                                <TableCell className={`text-right font-mono ${cashFlowData.financingActivities?.netCashFromFinancing >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatIDR(cashFlowData.financingActivities?.netCashFromFinancing)}</TableCell>
                                            </TableRow>

                                            <TableRow className="font-black bg-emerald-50 dark:bg-emerald-900/20 border-t-2 border-black">
                                                <TableCell className="text-lg">KENAIKAN BERSIH KAS</TableCell>
                                                <TableCell className={`text-right font-mono text-lg ${cashFlowData.netIncreaseInCash >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatIDR(cashFlowData.netIncreaseInCash)}</TableCell>
                                            </TableRow>
                                            <TableRow>
                                                <TableCell>Saldo Kas Akhir</TableCell>
                                                <TableCell className="text-right font-mono text-emerald-700 font-bold">{formatIDR(cashFlowData.endingCash)}</TableCell>
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                </div>
                            )}

                            {/* Trial Balance */}
                            {reportType === "tb" && trialBalanceData && (
                                <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                                    <div className="px-4 py-3 border-b-2 border-black bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Scale className="h-4 w-4 text-indigo-600" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-700">Neraca Saldo</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {trialBalanceData.totals.isBalanced ? (
                                                <span className="flex items-center gap-1 text-[10px] font-black uppercase text-emerald-600">
                                                    <Check className="h-3.5 w-3.5" /> Seimbang
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-[10px] font-black uppercase text-red-600">
                                                    <AlertTriangle className="h-3.5 w-3.5" /> Tidak Balance ({formatIDR(trialBalanceData.totals.difference)})
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-zinc-50 dark:bg-zinc-800">
                                                <TableHead className="text-[10px] font-black uppercase tracking-widest w-[100px]">Kode</TableHead>
                                                <TableHead className="text-[10px] font-black uppercase tracking-widest">Nama Akun</TableHead>
                                                <TableHead className="text-[10px] font-black uppercase tracking-widest w-[80px]">Tipe</TableHead>
                                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Debit</TableHead>
                                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Kredit</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {trialBalanceData.rows.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="text-center py-8 text-zinc-400 text-xs font-bold uppercase tracking-widest">
                                                        Tidak ada transaksi dalam periode ini
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                (() => {
                                                    const typeLabels: Record<string, string> = {
                                                        ASSET: "Aset", LIABILITY: "Kewajiban", EQUITY: "Ekuitas",
                                                        REVENUE: "Pendapatan", EXPENSE: "Beban",
                                                    }
                                                    const typeColors: Record<string, string> = {
                                                        ASSET: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 border-emerald-300",
                                                        LIABILITY: "bg-red-100 dark:bg-red-900/30 text-red-700 border-red-300",
                                                        EQUITY: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 border-blue-300",
                                                        REVENUE: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 border-indigo-300",
                                                        EXPENSE: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 border-amber-300",
                                                    }
                                                    const badgeColors: Record<string, string> = {
                                                        ASSET: "bg-emerald-50 border-emerald-200 text-emerald-600",
                                                        LIABILITY: "bg-red-50 border-red-200 text-red-600",
                                                        EQUITY: "bg-blue-50 border-blue-200 text-blue-600",
                                                        REVENUE: "bg-indigo-50 border-indigo-200 text-indigo-600",
                                                        EXPENSE: "bg-amber-50 border-amber-200 text-amber-600",
                                                    }
                                                    let lastType = ""
                                                    return trialBalanceData.rows.map((row: any, idx: number) => {
                                                        const showHeader = row.accountType !== lastType
                                                        lastType = row.accountType
                                                        return (
                                                            <React.Fragment key={idx}>
                                                                {showHeader && (
                                                                    <TableRow className={`${typeColors[row.accountType] || "bg-zinc-100"} border-t-2 border-black`}>
                                                                        <TableCell colSpan={5} className="text-[10px] font-black uppercase tracking-widest py-2">
                                                                            {typeLabels[row.accountType] || row.accountType}
                                                                        </TableCell>
                                                                    </TableRow>
                                                                )}
                                                                <TableRow>
                                                                    <TableCell className="font-mono font-bold text-sm pl-6">{row.accountCode}</TableCell>
                                                                    <TableCell className="text-sm">{row.accountName}</TableCell>
                                                                    <TableCell>
                                                                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 border rounded-sm ${badgeColors[row.accountType] || "bg-zinc-50 border-zinc-200 text-zinc-600"}`}>{row.accountType}</span>
                                                                    </TableCell>
                                                                    <TableCell className="text-right font-mono text-sm">
                                                                        {row.debit > 0 ? formatIDR(row.debit) : "-"}
                                                                    </TableCell>
                                                                    <TableCell className="text-right font-mono text-sm">
                                                                        {row.credit > 0 ? formatIDR(row.credit) : "-"}
                                                                    </TableCell>
                                                                </TableRow>
                                                            </React.Fragment>
                                                        )
                                                    })
                                                })()
                                            )}
                                            <TableRow className="font-black bg-indigo-50 dark:bg-indigo-900/20 border-t-2 border-black">
                                                <TableCell colSpan={3} className="text-sm">TOTAL</TableCell>
                                                <TableCell className="text-right font-mono text-sm">{formatIDR(trialBalanceData.totals.totalDebits)}</TableCell>
                                                <TableCell className="text-right font-mono text-sm">{formatIDR(trialBalanceData.totals.totalCredits)}</TableCell>
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                </div>
                            )}

                            {/* Equity Changes */}
                            {reportType === "equity_changes" && (
                                <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                                    <div className="px-4 py-3 border-b-2 border-black bg-violet-50 dark:bg-violet-900/20 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <TrendingDown className="h-4 w-4 text-violet-600" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-violet-700">Laporan Perubahan Ekuitas</span>
                                        </div>
                                        {equityData && (
                                            <span className="text-[10px] font-black text-zinc-400">
                                                {equityData.accounts?.length ?? 0} akun
                                            </span>
                                        )}
                                    </div>
                                    {!equityData ? (
                                        <div className="p-12 text-center">
                                            <BarChart3 className="h-8 w-8 mx-auto text-zinc-300 mb-2" />
                                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Data tidak tersedia</p>
                                        </div>
                                    ) : (
                                        <>
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="bg-zinc-50 dark:bg-zinc-800">
                                                        <TableHead className="text-[10px] font-black uppercase tracking-widest">Akun</TableHead>
                                                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Saldo Awal</TableHead>
                                                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Penambahan</TableHead>
                                                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Pengurangan</TableHead>
                                                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Saldo Akhir</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {equityData.accounts.length === 0 ? (
                                                        <TableRow>
                                                            <TableCell colSpan={5} className="text-center py-8 text-zinc-400 text-xs font-bold uppercase tracking-widest">
                                                                Tidak ada akun ekuitas
                                                            </TableCell>
                                                        </TableRow>
                                                    ) : (
                                                        equityData.accounts.map((acc: any, idx: number) => (
                                                            <TableRow key={idx}>
                                                                <TableCell className="text-sm font-bold">
                                                                    <span className="font-mono text-zinc-400 mr-2">{acc.accountCode}</span>
                                                                    {acc.accountName}
                                                                </TableCell>
                                                                <TableCell className="text-right font-mono text-sm">{formatIDR(acc.openingBalance)}</TableCell>
                                                                <TableCell className="text-right font-mono text-sm text-emerald-600">{acc.additions > 0 ? formatIDR(acc.additions) : "-"}</TableCell>
                                                                <TableCell className="text-right font-mono text-sm text-red-600">{acc.deductions > 0 ? `(${formatIDR(acc.deductions)})` : "-"}</TableCell>
                                                                <TableCell className="text-right font-mono text-sm font-bold">{formatIDR(acc.closingBalance)}</TableCell>
                                                            </TableRow>
                                                        ))
                                                    )}
                                                    {/* Net Income row */}
                                                    <TableRow className="bg-blue-50 dark:bg-blue-900/20">
                                                        <TableCell className="text-sm font-bold">Laba Bersih Periode</TableCell>
                                                        <TableCell className="text-right font-mono text-sm">-</TableCell>
                                                        <TableCell className="text-right font-mono text-sm text-emerald-600">
                                                            {equityData.netIncome >= 0 ? formatIDR(equityData.netIncome) : "-"}
                                                        </TableCell>
                                                        <TableCell className="text-right font-mono text-sm text-red-600">
                                                            {equityData.netIncome < 0 ? `(${formatIDR(Math.abs(equityData.netIncome))})` : "-"}
                                                        </TableCell>
                                                        <TableCell className="text-right font-mono text-sm font-bold">
                                                            {formatIDR(equityData.netIncome)}
                                                        </TableCell>
                                                    </TableRow>
                                                    {/* Total row */}
                                                    <TableRow className="font-black bg-violet-100 dark:bg-violet-900/30 border-t-2 border-black">
                                                        <TableCell className="text-sm">TOTAL EKUITAS</TableCell>
                                                        <TableCell className="text-right font-mono text-sm">{formatIDR(equityData.totalOpeningEquity)}</TableCell>
                                                        <TableCell className="text-right font-mono text-sm" colSpan={2}>
                                                            Perubahan: {formatIDR(equityData.totalChange)}
                                                        </TableCell>
                                                        <TableCell className="text-right font-mono text-sm text-violet-700">{formatIDR(equityData.totalClosingEquity)}</TableCell>
                                                    </TableRow>
                                                </TableBody>
                                            </Table>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* AR Aging */}
                            {reportType === "ar_aging" && arAgingData && (
                                <div className="space-y-4">
                                    <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                                        <div className="px-4 py-3 border-b-2 border-black bg-orange-50 dark:bg-orange-900/20 flex items-center gap-2">
                                            <Users className="h-4 w-4 text-orange-600" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-orange-700">Aging Piutang (AR) — Ringkasan</span>
                                            <span className="ml-auto bg-orange-500 text-white text-[10px] font-black px-2 py-0.5 rounded-sm">
                                                {arAgingData.summary.invoiceCount} Invoice
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-6 divide-x divide-zinc-100 dark:divide-zinc-800">
                                            {[
                                                { label: "Belum Jatuh Tempo", value: arAgingData.summary.current, color: "emerald" },
                                                { label: "1-30 Hari", value: arAgingData.summary.d1_30, color: "blue" },
                                                { label: "31-60 Hari", value: arAgingData.summary.d31_60, color: "amber" },
                                                { label: "61-90 Hari", value: arAgingData.summary.d61_90, color: "orange" },
                                                { label: "90+ Hari", value: arAgingData.summary.d90_plus, color: "red" },
                                                { label: "Total", value: arAgingData.summary.totalOutstanding, color: "zinc" },
                                            ].map((b, i) => (
                                                <div key={i} className="p-4 text-center">
                                                    <div className={`text-[10px] font-black uppercase tracking-widest text-${b.color}-600 mb-1`}>{b.label}</div>
                                                    <div className={`text-lg font-black font-mono tracking-tighter ${b.value > 0 ? `text-${b.color}-700` : "text-zinc-300"}`}>
                                                        {b.value > 0 ? formatIDR(b.value) : "Rp 0"}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                                        <div className="px-4 py-3 border-b-2 border-black bg-zinc-50 dark:bg-zinc-800 flex items-center gap-2">
                                            <FileText className="h-4 w-4 text-zinc-500" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Per Pelanggan</span>
                                        </div>
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-zinc-50 dark:bg-zinc-800">
                                                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Pelanggan</TableHead>
                                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Current</TableHead>
                                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">1-30</TableHead>
                                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">31-60</TableHead>
                                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">61-90</TableHead>
                                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">90+</TableHead>
                                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Total</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {arAgingData.byCustomer.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={7} className="text-center py-8 text-zinc-400 text-xs font-bold uppercase tracking-widest">
                                                            Tidak ada piutang terbuka
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    arAgingData.byCustomer.map((cust: any, idx: number) => {
                                                        const isExpanded = expandedAR.has(cust.customerId)
                                                        return (
                                                            <React.Fragment key={idx}>
                                                                <TableRow className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                                                                    <TableCell className="font-bold text-sm">
                                                                        <button
                                                                            onClick={() => toggleAR(cust.customerId)}
                                                                            className="flex items-center gap-1.5 hover:text-orange-600 transition-colors"
                                                                        >
                                                                            {isExpanded
                                                                                ? <ChevronDown className="h-3.5 w-3.5 text-orange-500" />
                                                                                : <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />}
                                                                            {cust.customerName}
                                                                            <span className="text-[9px] font-mono text-zinc-400 ml-1">({cust.invoiceCount})</span>
                                                                        </button>
                                                                    </TableCell>
                                                                    <TableCell className="text-right font-mono text-sm">{cust.current > 0 ? formatIDR(cust.current) : "-"}</TableCell>
                                                                    <TableCell className="text-right font-mono text-sm">{cust.d1_30 > 0 ? formatIDR(cust.d1_30) : "-"}</TableCell>
                                                                    <TableCell className="text-right font-mono text-sm">{cust.d31_60 > 0 ? formatIDR(cust.d31_60) : "-"}</TableCell>
                                                                    <TableCell className="text-right font-mono text-sm">{cust.d61_90 > 0 ? formatIDR(cust.d61_90) : "-"}</TableCell>
                                                                    <TableCell className="text-right font-mono text-sm text-red-600">{cust.d90_plus > 0 ? formatIDR(cust.d90_plus) : "-"}</TableCell>
                                                                    <TableCell className="text-right font-mono text-sm font-black">{formatIDR(cust.total)}</TableCell>
                                                                </TableRow>
                                                                {isExpanded && cust.invoices?.map((inv: any, j: number) => (
                                                                    <TableRow key={`inv-${j}`} className="bg-orange-50/50 dark:bg-orange-900/10">
                                                                        <TableCell className="pl-8 text-xs">
                                                                            <Link
                                                                                href={`/finance/invoices?highlight=${inv.id}`}
                                                                                className="text-orange-600 hover:underline font-mono font-bold"
                                                                            >
                                                                                {inv.invoiceNumber}
                                                                            </Link>
                                                                        </TableCell>
                                                                        <TableCell className="text-right text-[10px] font-mono text-zinc-500">
                                                                            {new Date(inv.issueDate).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                                                                        </TableCell>
                                                                        <TableCell className="text-right text-[10px] font-mono text-zinc-500">
                                                                            {new Date(inv.dueDate).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                                                                        </TableCell>
                                                                        <TableCell className="text-right text-[10px] font-mono">{formatIDR(inv.totalAmount)}</TableCell>
                                                                        <TableCell className="text-right text-[10px] font-mono text-emerald-600">{formatIDR(inv.paidAmount)}</TableCell>
                                                                        <TableCell className="text-right text-[10px] font-mono text-orange-600 font-bold">{formatIDR(inv.balanceDue)}</TableCell>
                                                                        <TableCell className="text-right">
                                                                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-sm ${
                                                                                inv.status === 'OVERDUE' ? 'bg-red-100 text-red-700' :
                                                                                inv.status === 'PARTIAL' ? 'bg-amber-100 text-amber-700' :
                                                                                'bg-blue-100 text-blue-700'
                                                                            }`}>{inv.status}</span>
                                                                        </TableCell>
                                                                    </TableRow>
                                                                ))}
                                                            </React.Fragment>
                                                        )
                                                    })
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            )}

                            {/* AP Aging */}
                            {reportType === "ap_aging" && apAgingData && (
                                <div className="space-y-4">
                                    <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                                        <div className="px-4 py-3 border-b-2 border-black bg-red-50 dark:bg-red-900/20 flex items-center gap-2">
                                            <Truck className="h-4 w-4 text-red-600" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-red-700">Aging Hutang (AP) — Ringkasan</span>
                                            <span className="ml-auto bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-sm">
                                                {apAgingData.summary.billCount} Bill
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-6 divide-x divide-zinc-100 dark:divide-zinc-800">
                                            {[
                                                { label: "Belum Jatuh Tempo", value: apAgingData.summary.current, color: "emerald" },
                                                { label: "1-30 Hari", value: apAgingData.summary.d1_30, color: "blue" },
                                                { label: "31-60 Hari", value: apAgingData.summary.d31_60, color: "amber" },
                                                { label: "61-90 Hari", value: apAgingData.summary.d61_90, color: "orange" },
                                                { label: "90+ Hari", value: apAgingData.summary.d90_plus, color: "red" },
                                                { label: "Total", value: apAgingData.summary.totalOutstanding, color: "zinc" },
                                            ].map((b, i) => (
                                                <div key={i} className="p-4 text-center">
                                                    <div className={`text-[10px] font-black uppercase tracking-widest text-${b.color}-600 mb-1`}>{b.label}</div>
                                                    <div className={`text-lg font-black font-mono tracking-tighter ${b.value > 0 ? `text-${b.color}-700` : "text-zinc-300"}`}>
                                                        {b.value > 0 ? formatIDR(b.value) : "Rp 0"}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                                        <div className="px-4 py-3 border-b-2 border-black bg-zinc-50 dark:bg-zinc-800 flex items-center gap-2">
                                            <FileText className="h-4 w-4 text-zinc-500" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Per Pemasok</span>
                                        </div>
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-zinc-50 dark:bg-zinc-800">
                                                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Pemasok</TableHead>
                                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Current</TableHead>
                                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">1-30</TableHead>
                                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">31-60</TableHead>
                                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">61-90</TableHead>
                                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">90+</TableHead>
                                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Total</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {apAgingData.bySupplier.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={7} className="text-center py-8 text-zinc-400 text-xs font-bold uppercase tracking-widest">
                                                            Tidak ada hutang terbuka
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    apAgingData.bySupplier.map((supp: any, idx: number) => {
                                                        const isExpanded = expandedAP.has(supp.supplierId)
                                                        return (
                                                            <React.Fragment key={idx}>
                                                                <TableRow className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                                                                    <TableCell className="font-bold text-sm">
                                                                        <button
                                                                            onClick={() => toggleAP(supp.supplierId)}
                                                                            className="flex items-center gap-1.5 hover:text-red-600 transition-colors"
                                                                        >
                                                                            {isExpanded
                                                                                ? <ChevronDown className="h-3.5 w-3.5 text-red-500" />
                                                                                : <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />}
                                                                            {supp.supplierName}
                                                                            <span className="text-[9px] font-mono text-zinc-400 ml-1">({supp.billCount})</span>
                                                                        </button>
                                                                    </TableCell>
                                                                    <TableCell className="text-right font-mono text-sm">{supp.current > 0 ? formatIDR(supp.current) : "-"}</TableCell>
                                                                    <TableCell className="text-right font-mono text-sm">{supp.d1_30 > 0 ? formatIDR(supp.d1_30) : "-"}</TableCell>
                                                                    <TableCell className="text-right font-mono text-sm">{supp.d31_60 > 0 ? formatIDR(supp.d31_60) : "-"}</TableCell>
                                                                    <TableCell className="text-right font-mono text-sm">{supp.d61_90 > 0 ? formatIDR(supp.d61_90) : "-"}</TableCell>
                                                                    <TableCell className="text-right font-mono text-sm text-red-600">{supp.d90_plus > 0 ? formatIDR(supp.d90_plus) : "-"}</TableCell>
                                                                    <TableCell className="text-right font-mono text-sm font-black">{formatIDR(supp.total)}</TableCell>
                                                                </TableRow>
                                                                {isExpanded && supp.bills?.map((bill: any, j: number) => (
                                                                    <TableRow key={`bill-${j}`} className="bg-red-50/50 dark:bg-red-900/10">
                                                                        <TableCell className="pl-8 text-xs">
                                                                            <Link
                                                                                href={`/finance/bills?highlight=${bill.id}`}
                                                                                className="text-red-600 hover:underline font-mono font-bold"
                                                                            >
                                                                                {bill.billNumber}
                                                                            </Link>
                                                                        </TableCell>
                                                                        <TableCell className="text-right text-[10px] font-mono text-zinc-500">
                                                                            {new Date(bill.issueDate).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                                                                        </TableCell>
                                                                        <TableCell className="text-right text-[10px] font-mono text-zinc-500">
                                                                            {new Date(bill.dueDate).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                                                                        </TableCell>
                                                                        <TableCell className="text-right text-[10px] font-mono">{formatIDR(bill.totalAmount)}</TableCell>
                                                                        <TableCell className="text-right text-[10px] font-mono text-emerald-600">{formatIDR(bill.paidAmount)}</TableCell>
                                                                        <TableCell className="text-right text-[10px] font-mono text-red-600 font-bold">{formatIDR(bill.balanceDue)}</TableCell>
                                                                        <TableCell className="text-right">
                                                                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-sm ${
                                                                                bill.status === 'OVERDUE' ? 'bg-red-100 text-red-700' :
                                                                                bill.status === 'PARTIAL' ? 'bg-amber-100 text-amber-700' :
                                                                                'bg-blue-100 text-blue-700'
                                                                            }`}>{bill.status}</span>
                                                                        </TableCell>
                                                                    </TableRow>
                                                                ))}
                                                            </React.Fragment>
                                                        )
                                                    })
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            )}

                            {/* Inventory Turnover */}
                            {reportType === "inventory_turnover" && (
                                <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                                    <div className="px-4 py-3 border-b-2 border-black bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Package className="h-4 w-4 text-emerald-600" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Perputaran Persediaan</span>
                                        </div>
                                        {inventoryTurnoverData && (
                                            <div className="flex items-center gap-3">
                                                <span className="text-[10px] font-black text-zinc-400">
                                                    {inventoryTurnoverData.summary.totalProducts} produk
                                                </span>
                                                {inventoryTurnoverData.summary.slowMovingCount > 0 && (
                                                    <span className="text-[10px] font-black text-red-600 flex items-center gap-1">
                                                        <AlertTriangle className="h-3 w-3" />
                                                        {inventoryTurnoverData.summary.slowMovingCount} slow-moving
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    {!inventoryTurnoverData ? (
                                        <div className="p-12 text-center">
                                            <BarChart3 className="h-8 w-8 mx-auto text-zinc-300 mb-2" />
                                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Data tidak tersedia</p>
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="bg-zinc-50 dark:bg-zinc-800">
                                                        <TableHead className="text-[10px] font-black uppercase tracking-widest w-[80px]">Kode</TableHead>
                                                        <TableHead className="text-[10px] font-black uppercase tracking-widest">Produk</TableHead>
                                                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Stok Awal</TableHead>
                                                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Masuk</TableHead>
                                                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Keluar</TableHead>
                                                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Stok Akhir</TableHead>
                                                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Rasio Turnover</TableHead>
                                                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Hari di Gudang</TableHead>
                                                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Nilai</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {inventoryTurnoverData.items.length === 0 ? (
                                                        <TableRow>
                                                            <TableCell colSpan={9} className="text-center py-8 text-zinc-400 text-xs font-bold uppercase tracking-widest">
                                                                Tidak ada data persediaan
                                                            </TableCell>
                                                        </TableRow>
                                                    ) : (
                                                        inventoryTurnoverData.items.map((item: any, idx: number) => (
                                                            <TableRow key={idx} className={item.isSlowMoving ? "bg-red-50/50 dark:bg-red-900/10" : ""}>
                                                                <TableCell className="font-mono font-bold text-sm">{item.productCode}</TableCell>
                                                                <TableCell className="text-sm">
                                                                    {item.productName}
                                                                    {item.isSlowMoving && (
                                                                        <span className="ml-2 text-[8px] font-black uppercase bg-red-100 text-red-600 px-1.5 py-0.5 border border-red-200 rounded-sm">
                                                                            Slow
                                                                        </span>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell className="text-right font-mono text-sm">{item.beginningStock}</TableCell>
                                                                <TableCell className="text-right font-mono text-sm text-emerald-600">{item.totalIn > 0 ? `+${item.totalIn}` : "-"}</TableCell>
                                                                <TableCell className="text-right font-mono text-sm text-red-600">{item.totalOut > 0 ? `-${item.totalOut}` : "-"}</TableCell>
                                                                <TableCell className="text-right font-mono text-sm font-bold">{item.currentStock}</TableCell>
                                                                <TableCell className={`text-right font-mono text-sm font-bold ${item.turnoverRatio < 1 ? "text-red-600" : item.turnoverRatio > 3 ? "text-emerald-600" : "text-zinc-700"}`}>
                                                                    {item.turnoverRatio}x
                                                                </TableCell>
                                                                <TableCell className={`text-right font-mono text-sm ${item.daysOnHand > 90 ? "text-red-600 font-bold" : "text-zinc-600"}`}>
                                                                    {item.daysOnHand >= 999 ? "N/A" : `${item.daysOnHand} hari`}
                                                                </TableCell>
                                                                <TableCell className="text-right font-mono text-sm">{formatIDR(item.inventoryValue)}</TableCell>
                                                            </TableRow>
                                                        ))
                                                    )}
                                                    <TableRow className="font-black bg-zinc-100 dark:bg-zinc-800 border-t-2 border-black">
                                                        <TableCell colSpan={6} className="text-sm">TOTAL</TableCell>
                                                        <TableCell className="text-right font-mono text-sm">
                                                            Avg: {inventoryTurnoverData.summary.averageTurnoverRatio}x
                                                        </TableCell>
                                                        <TableCell className="text-right font-mono text-sm">
                                                            {inventoryTurnoverData.summary.slowMovingCount} slow
                                                        </TableCell>
                                                        <TableCell className="text-right font-mono text-sm font-black">
                                                            {formatIDR(inventoryTurnoverData.summary.totalInventoryValue)}
                                                        </TableCell>
                                                    </TableRow>
                                                </TableBody>
                                            </Table>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Tax Report (PPN) */}
                            {reportType === "tax_report" && (
                                <div className="space-y-4">
                                    {!taxData ? (
                                        <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] p-12 text-center">
                                            <BarChart3 className="h-8 w-8 mx-auto text-zinc-300 mb-2" />
                                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Data tidak tersedia</p>
                                        </div>
                                    ) : (
                                        <>
                                            {/* PPN Keluaran */}
                                            <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                                                <div className="px-4 py-3 border-b-2 border-black bg-blue-50 dark:bg-blue-900/20 flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <Receipt className="h-4 w-4 text-blue-600" />
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-blue-700">PPN Keluaran (Penjualan)</span>
                                                    </div>
                                                    <span className="text-[10px] font-black text-blue-600">
                                                        {taxData.ppnKeluaran?.invoiceCount ?? 0} Faktur &bull; {formatIDR(taxData.ppnKeluaran?.total ?? 0)}
                                                    </span>
                                                </div>
                                                <div className="overflow-x-auto">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow className="bg-zinc-50 dark:bg-zinc-800">
                                                                <TableHead className="text-[10px] font-black uppercase tracking-widest">No. Faktur</TableHead>
                                                                <TableHead className="text-[10px] font-black uppercase tracking-widest">Tanggal</TableHead>
                                                                <TableHead className="text-[10px] font-black uppercase tracking-widest">Nama</TableHead>
                                                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">DPP</TableHead>
                                                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">PPN</TableHead>
                                                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Total</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {(!taxData.ppnKeluaran?.items || taxData.ppnKeluaran.items.length === 0) ? (
                                                                <TableRow>
                                                                    <TableCell colSpan={6} className="text-center py-6 text-zinc-400 text-xs font-bold uppercase tracking-widest">
                                                                        Tidak ada faktur keluaran
                                                                    </TableCell>
                                                                </TableRow>
                                                            ) : (
                                                                taxData.ppnKeluaran.items.map((item: any, idx: number) => (
                                                                    <TableRow key={idx}>
                                                                        <TableCell className="font-mono text-sm">{item.number}</TableCell>
                                                                        <TableCell className="text-sm">{new Date(item.date).toLocaleDateString("id-ID")}</TableCell>
                                                                        <TableCell className="text-sm">{item.partyName}</TableCell>
                                                                        <TableCell className="text-right font-mono text-sm">{formatIDR(item.dpp)}</TableCell>
                                                                        <TableCell className="text-right font-mono text-sm">{formatIDR(item.ppn)}</TableCell>
                                                                        <TableCell className="text-right font-mono text-sm font-bold">{formatIDR(item.total)}</TableCell>
                                                                    </TableRow>
                                                                ))
                                                            )}
                                                            <TableRow className="font-black bg-blue-50 dark:bg-blue-900/20 border-t-2 border-black">
                                                                <TableCell colSpan={4} className="text-sm">TOTAL PPN KELUARAN</TableCell>
                                                                <TableCell className="text-right font-mono text-sm text-blue-700">{formatIDR(taxData.ppnKeluaran?.total ?? 0)}</TableCell>
                                                                <TableCell />
                                                            </TableRow>
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </div>

                                            {/* PPN Masukan */}
                                            <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                                                <div className="px-4 py-3 border-b-2 border-black bg-amber-50 dark:bg-amber-900/20 flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <Receipt className="h-4 w-4 text-amber-600" />
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-700">PPN Masukan (Pembelian)</span>
                                                    </div>
                                                    <span className="text-[10px] font-black text-amber-600">
                                                        {taxData.ppnMasukan?.invoiceCount ?? 0} Faktur &bull; {formatIDR(taxData.ppnMasukan?.total ?? 0)}
                                                    </span>
                                                </div>
                                                <div className="overflow-x-auto">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow className="bg-zinc-50 dark:bg-zinc-800">
                                                                <TableHead className="text-[10px] font-black uppercase tracking-widest">No. Faktur</TableHead>
                                                                <TableHead className="text-[10px] font-black uppercase tracking-widest">Tanggal</TableHead>
                                                                <TableHead className="text-[10px] font-black uppercase tracking-widest">Nama</TableHead>
                                                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">DPP</TableHead>
                                                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">PPN</TableHead>
                                                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Total</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {(!taxData.ppnMasukan?.items || taxData.ppnMasukan.items.length === 0) ? (
                                                                <TableRow>
                                                                    <TableCell colSpan={6} className="text-center py-6 text-zinc-400 text-xs font-bold uppercase tracking-widest">
                                                                        Tidak ada faktur masukan
                                                                    </TableCell>
                                                                </TableRow>
                                                            ) : (
                                                                taxData.ppnMasukan.items.map((item: any, idx: number) => (
                                                                    <TableRow key={idx}>
                                                                        <TableCell className="font-mono text-sm">{item.number}</TableCell>
                                                                        <TableCell className="text-sm">{new Date(item.date).toLocaleDateString("id-ID")}</TableCell>
                                                                        <TableCell className="text-sm">{item.partyName}</TableCell>
                                                                        <TableCell className="text-right font-mono text-sm">{formatIDR(item.dpp)}</TableCell>
                                                                        <TableCell className="text-right font-mono text-sm">{formatIDR(item.ppn)}</TableCell>
                                                                        <TableCell className="text-right font-mono text-sm font-bold">{formatIDR(item.total)}</TableCell>
                                                                    </TableRow>
                                                                ))
                                                            )}
                                                            <TableRow className="font-black bg-amber-50 dark:bg-amber-900/20 border-t-2 border-black">
                                                                <TableCell colSpan={4} className="text-sm">TOTAL PPN MASUKAN</TableCell>
                                                                <TableCell className="text-right font-mono text-sm text-amber-700">{formatIDR(taxData.ppnMasukan?.total ?? 0)}</TableCell>
                                                                <TableCell />
                                                            </TableRow>
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </div>

                                            {/* PPN Summary */}
                                            <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                                                <div className="px-4 py-3 border-b-2 border-black bg-zinc-50 dark:bg-zinc-800 flex items-center gap-2">
                                                    <Receipt className="h-4 w-4 text-zinc-500" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Ringkasan PPN</span>
                                                </div>
                                                <Table>
                                                    <TableBody>
                                                        <TableRow>
                                                            <TableCell className="font-bold">PPN Keluaran</TableCell>
                                                            <TableCell className="text-right font-mono font-bold text-blue-600">{formatIDR(taxData.ppnKeluaran?.total ?? 0)}</TableCell>
                                                        </TableRow>
                                                        <TableRow>
                                                            <TableCell className="font-bold">PPN Masukan</TableCell>
                                                            <TableCell className="text-right font-mono font-bold text-amber-600">({formatIDR(taxData.ppnMasukan?.total ?? 0)})</TableCell>
                                                        </TableRow>
                                                        <TableRow className={`font-black border-t-2 border-black ${taxData.status === 'KURANG_BAYAR' ? "bg-red-50 dark:bg-red-900/20" : "bg-emerald-50 dark:bg-emerald-900/20"}`}>
                                                            <TableCell className="text-lg">
                                                                {taxData.status === 'KURANG_BAYAR' ? 'PPN KURANG BAYAR' : 'PPN LEBIH BAYAR'}
                                                            </TableCell>
                                                            <TableCell className={`text-right font-mono text-lg ${taxData.status === 'KURANG_BAYAR' ? "text-red-600" : "text-emerald-600"}`}>
                                                                {formatIDR(Math.abs(taxData.netPPN ?? 0))}
                                                            </TableCell>
                                                        </TableRow>
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* Budget vs Actual */}
                            {reportType === "budget_vs_actual" && (
                                <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                                    <div className="px-4 py-3 border-b-2 border-black bg-violet-50 dark:bg-violet-900/20 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <PiggyBank className="h-4 w-4 text-violet-600" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-violet-700">Anggaran vs Realisasi</span>
                                        </div>
                                        {budgetVsActualData && (
                                            <span className="text-[10px] font-black text-zinc-400">
                                                {budgetVsActualData.budgetName} ({budgetVsActualData.budgetYear})
                                            </span>
                                        )}
                                    </div>
                                    {!budgetVsActualData ? (
                                        <div className="p-12 text-center">
                                            <PiggyBank className="h-8 w-8 mx-auto text-zinc-300 mb-2" />
                                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Belum ada anggaran aktif</p>
                                            <p className="text-xs text-zinc-400 mt-1">Buat anggaran terlebih dahulu untuk melihat perbandingan</p>
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="bg-zinc-50 dark:bg-zinc-800">
                                                        <TableHead className="text-[10px] font-black uppercase tracking-widest w-[80px]">Kode Akun</TableHead>
                                                        <TableHead className="text-[10px] font-black uppercase tracking-widest">Nama Akun</TableHead>
                                                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Anggaran</TableHead>
                                                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Realisasi</TableHead>
                                                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Selisih</TableHead>
                                                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">% Selisih</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {budgetVsActualData.items.length === 0 ? (
                                                        <TableRow>
                                                            <TableCell colSpan={6} className="text-center py-8 text-zinc-400 text-xs font-bold uppercase tracking-widest">
                                                                Tidak ada data anggaran
                                                            </TableCell>
                                                        </TableRow>
                                                    ) : (
                                                        budgetVsActualData.items.map((item: any, idx: number) => {
                                                            const isNegativeVariance = item.variance < 0
                                                            return (
                                                                <TableRow key={idx} className={isNegativeVariance ? "bg-red-50/50 dark:bg-red-900/10" : ""}>
                                                                    <TableCell className="font-mono font-bold text-sm">{item.accountCode}</TableCell>
                                                                    <TableCell className="text-sm">{item.accountName}</TableCell>
                                                                    <TableCell className="text-right font-mono text-sm">{formatIDR(item.budgetAmount)}</TableCell>
                                                                    <TableCell className="text-right font-mono text-sm">{formatIDR(item.actualAmount)}</TableCell>
                                                                    <TableCell className={`text-right font-mono text-sm font-bold ${isNegativeVariance ? "text-red-600" : "text-emerald-600"}`}>
                                                                        {isNegativeVariance ? `(${formatIDR(Math.abs(item.variance))})` : formatIDR(item.variance)}
                                                                    </TableCell>
                                                                    <TableCell className={`text-right font-mono text-sm font-bold ${isNegativeVariance ? "text-red-600" : "text-emerald-600"}`}>
                                                                        {isNegativeVariance ? "-" : ""}{Math.abs(item.variancePct).toFixed(1)}%
                                                                    </TableCell>
                                                                </TableRow>
                                                            )
                                                        })
                                                    )}
                                                    <TableRow className="font-black bg-zinc-100 dark:bg-zinc-800 border-t-2 border-black">
                                                        <TableCell colSpan={2} className="text-sm">TOTAL</TableCell>
                                                        <TableCell className="text-right font-mono text-sm">{formatIDR(budgetVsActualData.summary.totalBudget)}</TableCell>
                                                        <TableCell className="text-right font-mono text-sm">{formatIDR(budgetVsActualData.summary.totalActual)}</TableCell>
                                                        <TableCell className={`text-right font-mono text-sm ${budgetVsActualData.summary.totalVariance < 0 ? "text-red-600" : "text-emerald-600"}`}>
                                                            {budgetVsActualData.summary.totalVariance < 0
                                                                ? `(${formatIDR(Math.abs(budgetVsActualData.summary.totalVariance))})`
                                                                : formatIDR(budgetVsActualData.summary.totalVariance)
                                                            }
                                                        </TableCell>
                                                        <TableCell className={`text-right font-mono text-sm ${budgetVsActualData.summary.totalVariancePct < 0 ? "text-red-600" : "text-emerald-600"}`}>
                                                            {budgetVsActualData.summary.totalVariancePct < 0 ? "-" : ""}{Math.abs(budgetVsActualData.summary.totalVariancePct).toFixed(1)}%
                                                        </TableCell>
                                                    </TableRow>
                                                </TableBody>
                                            </Table>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Fallback: no data for active report */}
                            {data && !(data.reports as any)?.[reportType] && (
                                <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] p-12 text-center">
                                    <BarChart3 className="h-8 w-8 mx-auto text-zinc-300 mb-2" />
                                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Data laporan tidak tersedia</p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
