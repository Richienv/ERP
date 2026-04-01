"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Eye, EyeOff } from "lucide-react"
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
    ArrowRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { NB } from "@/lib/dialog-styles"
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
import { TrialBalancePanel } from "@/components/finance/reports/trial-balance-panel"
import { ReconciliationPreviewDialog } from "@/components/finance/reports/reconciliation-preview-dialog"
import { getTrialBalance, getAccountDrillDown, type DrillDownRow } from "@/lib/actions/finance-gl"
import type { TrialBalanceData } from "@/lib/actions/finance-gl"
import { useWithholdingTaxes, usePPhSummary } from "@/hooks/use-withholding-taxes"
import { markWithholdingDeposited } from "@/lib/actions/finance-pph"
import { getDepositDeadline, getFilingDeadline } from "@/lib/pph-helpers"
import { useQueryClient } from "@tanstack/react-query"

type ReportType = "pnl" | "bs" | "cf" | "tb" | "equity_changes" | "ar_aging" | "ap_aging" | "inventory_turnover" | "tax_report" | "pph_report" | "budget_vs_actual"

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
            { key: "pph_report", label: "Laporan PPh (Potong/Pungut)", icon: <FileText className="h-3.5 w-3.5" /> },
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

const SOURCE_BADGE: Record<string, { label: string; cls: string }> = {
    INVOICE_AR: { label: "FAKTUR", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
    INVOICE_AP: { label: "TAGIHAN", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
    PAYMENT: { label: "BAYAR", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
    JOURNAL: { label: "JURNAL", cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" },
    PETTY_CASH: { label: "PETTY", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
    OPENING: { label: "SALDO AWAL", cls: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
}

function DrillDownPanel({ rows, loading, formatIDR: fmt, accountFilter, startDate, endDate }: { rows: DrillDownRow[]; loading: boolean; formatIDR: (n: number) => string; accountFilter?: string; startDate?: Date; endDate?: Date }) {
    if (loading) {
        return (
            <div className="px-8 py-4 flex items-center gap-2 text-xs text-zinc-400 bg-zinc-50/50 dark:bg-zinc-800/30">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Memuat transaksi...
            </div>
        )
    }
    if (rows.length === 0) {
        return (
            <div className="px-8 py-3 text-xs text-zinc-400 italic bg-zinc-50/50 dark:bg-zinc-800/30">
                Tidak ada transaksi untuk periode ini
            </div>
        )
    }

    // Build link to transactions page with account filter + date range
    const txLinkParts = [`/finance/transactions?account=${accountFilter || ''}`]
    if (startDate) txLinkParts.push(`from=${startDate.toISOString().slice(0, 10)}`)
    if (endDate) txLinkParts.push(`to=${endDate.toISOString().slice(0, 10)}`)
    const txLink = txLinkParts.join('&')

    return (
        <div className="bg-zinc-50/50 dark:bg-zinc-800/20 border-t border-zinc-200 dark:border-zinc-700">
            <table className="w-full">
                <thead>
                    <tr className="text-[9px] font-black uppercase tracking-widest text-zinc-400">
                        <th className="px-3 py-1.5 text-left pl-10">Tanggal</th>
                        <th className="px-3 py-1.5 text-left">Tipe</th>
                        <th className="px-3 py-1.5 text-left">Referensi</th>
                        <th className="px-3 py-1.5 text-left">Deskripsi</th>
                        <th className="px-3 py-1.5 text-left">Pihak</th>
                        <th className="px-3 py-1.5 text-left">Akun</th>
                        <th className="px-3 py-1.5 text-right">Debit</th>
                        <th className="px-3 py-1.5 text-right">Kredit</th>
                        <th className="px-3 py-1.5 w-8" />
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, idx) => {
                        const badge = SOURCE_BADGE[row.sourceType] || SOURCE_BADGE.JOURNAL
                        return (
                            <motion.tr
                                key={row.id}
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.03 }}
                                className="border-t border-zinc-100 dark:border-zinc-800 hover:bg-orange-50/40 dark:hover:bg-orange-950/10 group transition-colors text-xs"
                            >
                                <td className="px-3 py-1.5 pl-10 font-mono text-zinc-500 whitespace-nowrap">{row.date}</td>
                                <td className="px-3 py-1.5">
                                    <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 whitespace-nowrap ${badge.cls}`}>{badge.label}</span>
                                </td>
                                <td className="px-3 py-1.5 font-bold text-zinc-700 dark:text-zinc-300">{row.reference || '\u2014'}</td>
                                <td className="px-3 py-1.5 text-zinc-500 max-w-[200px] truncate">{row.description}</td>
                                <td className="px-3 py-1.5 font-medium text-zinc-600 dark:text-zinc-400">{row.counterparty || '\u2014'}</td>
                                <td className="px-3 py-1.5 font-mono text-[10px] text-zinc-400">{row.accountCode}</td>
                                <td className="px-3 py-1.5 text-right font-mono text-emerald-600 tabular-nums">
                                    {row.debit > 0 ? fmt(row.debit) : ''}
                                </td>
                                <td className="px-3 py-1.5 text-right font-mono text-red-500 tabular-nums">
                                    {row.credit > 0 ? fmt(row.credit) : ''}
                                </td>
                                <td className="px-3 py-1.5">
                                    <Link
                                        href={row.sourceUrl}
                                        className="opacity-0 group-hover:opacity-100 text-orange-500 hover:text-orange-700 transition-all"
                                        title="Lihat sumber"
                                    >
                                        <ArrowRight className="h-3.5 w-3.5" />
                                    </Link>
                                </td>
                            </motion.tr>
                        )
                    })}
                </tbody>
            </table>
            {accountFilter && (
                <div className="px-10 py-2 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/40">
                    <Link
                        href={txLink}
                        className="text-xs text-orange-600 hover:text-orange-800 hover:underline font-bold"
                    >
                        Lihat semua transaksi &rarr;
                    </Link>
                </div>
            )}
        </div>
    )
}

export default function FinancialReportsPage() {
    const router = useRouter()
    const [reportType, setReportType] = useState<ReportType>("pnl")
    const [dateDialogOpen, setDateDialogOpen] = useState(false)
    const [exportDialogOpen, setExportDialogOpen] = useState(false)
    const [exportFormat, setExportFormat] = useState<"CSV" | "XLS">("CSV")
    const [showAmounts, setShowAmounts] = useState(false)
    const [bsExpanded, setBsExpanded] = useState<{ currentAssets: boolean; fixedAssets: boolean; currentLiabilities: boolean; longTermLiabilities: boolean; capital: boolean }>({
        currentAssets: false, fixedAssets: false, currentLiabilities: false, longTermLiabilities: false, capital: false,
    })

    const currentYear = new Date().getFullYear()
    const [startDate, setStartDate] = useState(new Date(currentYear, 0, 1))
    const [endDate, setEndDate] = useState(new Date())
    const [draftStartDate, setDraftStartDate] = useState(new Date(currentYear, 0, 1).toISOString().slice(0, 10))
    const [draftEndDate, setDraftEndDate] = useState(new Date().toISOString().slice(0, 10))

    const [expandedAR, setExpandedAR] = useState<Set<string>>(new Set())
    const [expandedAP, setExpandedAP] = useState<Set<string>>(new Set())

    // Drill-down state for P&L and Balance Sheet
    const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set())
    const [drillDownCache, setDrillDownCache] = useState<Map<string, DrillDownRow[]>>(new Map())
    const [drillDownLoading, setDrillDownLoading] = useState<string | null>(null)

    async function toggleDrillDown(accountKey: string, accountFilter: string, useFullHistory = false) {
        if (expandedAccounts.has(accountKey)) {
            setExpandedAccounts(prev => { const next = new Set(prev); next.delete(accountKey); return next })
            return
        }
        if (drillDownCache.has(accountKey)) {
            setExpandedAccounts(prev => new Set(prev).add(accountKey))
            return
        }
        setDrillDownLoading(accountKey)
        try {
            const start = useFullHistory ? new Date(2020, 0, 1) : startDate
            const end = endDate
            const rows = await getAccountDrillDown(accountFilter, start, end)
            setDrillDownCache(prev => new Map(prev).set(accountKey, rows))
            setExpandedAccounts(prev => new Set(prev).add(accountKey))
        } catch {
            toast.error("Gagal memuat detail transaksi")
        } finally {
            setDrillDownLoading(null)
        }
    }

    const [diagnosticTBData, setDiagnosticTBData] = useState<TrialBalanceData | null>(null)
    const [reconDialogOpen, setReconDialogOpen] = useState(false)
    const [tbLoading, setTbLoading] = useState(false)

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

    // PPh Report — uses its own query (not part of consolidated report)
    const queryClient = useQueryClient()
    const currentMonth = new Date()
    const pphPeriod = {
        startDate: new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).toISOString(),
        endDate: new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).toISOString(),
    }
    const { data: pphListResult, isLoading: pphListLoading } = useWithholdingTaxes(
        reportType === "pph_report" ? { startDate: pphPeriod.startDate, endDate: pphPeriod.endDate } : undefined
    )
    const { data: pphSummaryResult, isLoading: pphSummaryLoading } = usePPhSummary(
        reportType === "pph_report" ? pphPeriod : undefined
    )
    const pphRecords = pphListResult?.success ? pphListResult.data : []
    const pphSummary = pphSummaryResult?.success ? pphSummaryResult.data : null
    const [pphSelectedIds, setPphSelectedIds] = useState<Set<string>>(new Set())
    const [pphDepositDialogOpen, setPphDepositDialogOpen] = useState(false)
    const [pphDepositDate, setPphDepositDate] = useState(new Date().toISOString().slice(0, 10))
    const [pphDepositRef, setPphDepositRef] = useState("")
    const [pphDepositing, setPphDepositing] = useState(false)

    const pphDeadlines = {
        deposit: getDepositDeadline(currentMonth),
        filing: getFilingDeadline(currentMonth),
    }

    const togglePphSelect = (id: string) => {
        setPphSelectedIds(prev => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }

    const togglePphSelectAll = () => {
        const undepositedIds = (pphRecords || []).filter((r: any) => !r.deposited).map((r: any) => r.id)
        if (pphSelectedIds.size === undepositedIds.length && undepositedIds.length > 0) {
            setPphSelectedIds(new Set())
        } else {
            setPphSelectedIds(new Set(undepositedIds))
        }
    }

    async function handlePphDeposit() {
        if (pphSelectedIds.size === 0) { toast.error("Pilih PPh yang akan disetor"); return }
        if (!pphDepositRef.trim()) { toast.error("Masukkan nomor NTPN / referensi setor"); return }
        setPphDepositing(true)
        try {
            const result = await markWithholdingDeposited({
                ids: Array.from(pphSelectedIds),
                depositDate: pphDepositDate,
                depositRef: pphDepositRef.trim(),
            })
            if (result.success) {
                toast.success(`${result.count} PPh berhasil ditandai disetor (${formatIDR(result.totalAmount || 0)})`)
                setPphSelectedIds(new Set())
                setPphDepositDialogOpen(false)
                setPphDepositRef("")
                queryClient.invalidateQueries({ queryKey: ["finance", "pph"] })
            } else {
                toast.error(result.error || "Gagal menyetor PPh")
            }
        } catch (err: any) {
            toast.error(err.message || "Terjadi kesalahan")
        } finally {
            setPphDepositing(false)
        }
    }

    const loadTrialBalance = async () => {
        setTbLoading(true)
        try {
            const data = await getTrialBalance()
            setDiagnosticTBData(data)
        } catch (e) {
            console.error('Failed to load trial balance:', e)
        } finally {
            setTbLoading(false)
        }
    }

    useEffect(() => {
        if (reportType === 'bs' && balanceSheetData?.balanceCheck && !balanceSheetData.balanceCheck.isBalanced && !diagnosticTBData) {
            loadTrialBalance()
        }
    }, [reportType, balanceSheetData, diagnosticTBData])

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
                ["PELANGGAN", "BELUM JATUH TEMPO (Rp)", "1-30 HARI (Rp)", "31-60 HARI (Rp)", "61-90 HARI (Rp)", "90+ HARI (Rp)", "TOTAL (Rp)"],
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
                ["PEMASOK", "BELUM JATUH TEMPO (Rp)", "1-30 HARI (Rp)", "31-60 HARI (Rp)", "61-90 HARI (Rp)", "90+ HARI (Rp)", "TOTAL (Rp)"],
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

    /* ─── Animation variants ─── */
    const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.07 } } } as const
    const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 320, damping: 26 } } }

    const reportKpis = [
        { label: "Pendapatan", value: kpiLoading ? null : formatIDR(kpi?.revenue || 0), color: "blue" },
        { label: "Laba Bersih", value: kpiLoading ? null : formatIDR(kpi?.netIncome || 0), color: (kpi?.netIncome || 0) >= 0 ? "emerald" : "red" },
        { label: "Piutang (AR)", value: kpiLoading ? null : formatIDR(kpi?.arOutstanding || 0), color: "orange" },
        { label: "Hutang (AP)", value: kpiLoading ? null : formatIDR(kpi?.apOutstanding || 0), color: "red" },
    ]
    const dotColors: Record<string, string> = { blue: "bg-blue-500", emerald: "bg-emerald-500", orange: "bg-orange-500", red: "bg-red-500" }
    const textColors: Record<string, string> = { blue: "text-zinc-900 dark:text-white", emerald: "text-emerald-600 dark:text-emerald-400", orange: "text-orange-600 dark:text-orange-400", red: "text-red-600 dark:text-red-400" }

    return (
        <motion.div className="mf-page" variants={stagger} initial="hidden" animate="show">

            {/* ─── Unified Page Header ─── */}
            <motion.div variants={fadeUp} className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900">
                {/* Blue gradient accent bar */}
                <div className="h-1 bg-gradient-to-r from-blue-500 via-indigo-400 to-blue-500" />

                {/* Row 1: Title + Actions */}
                <div className="px-5 py-3.5 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-blue-500 flex items-center justify-center">
                            <BarChart3 className="h-4.5 w-4.5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-base font-black uppercase tracking-wider text-zinc-900 dark:text-white">
                                Laporan Keuangan
                            </h1>
                            <p className="text-zinc-400 text-[11px] font-medium">
                                {startDate.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })} — {endDate.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-0">
                        <Dialog open={dateDialogOpen} onOpenChange={setDateDialogOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="border border-zinc-300 dark:border-zinc-700 border-r-0 text-zinc-500 dark:text-zinc-400 text-[10px] font-bold uppercase tracking-wider h-9 px-3.5 rounded-none hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors">
                                    <CalendarIcon className="h-3.5 w-3.5 mr-1.5" /> Periode
                                </Button>
                            </DialogTrigger>
                            <DialogContent className={NB.contentNarrow}>
                                <DialogHeader className={NB.header}>
                                    <DialogTitle className={NB.title}>
                                        <CalendarIcon className="h-4 w-4" /> Pilih Rentang Tanggal
                                    </DialogTitle>
                                    <p className={NB.subtitle}>Atur periode laporan keuangan</p>
                                </DialogHeader>
                                <div className="px-6 py-5 space-y-4">
                                    <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
                                        <div>
                                            <label className={NB.label}>Dari</label>
                                            <Input type="date" value={draftStartDate} onChange={(e) => setDraftStartDate(e.target.value)} className={NB.inputMono} />
                                        </div>
                                        <ArrowRight className="h-4 w-4 text-zinc-400 mb-2.5" />
                                        <div>
                                            <label className={NB.label}>Sampai</label>
                                            <Input type="date" value={draftEndDate} onChange={(e) => setDraftEndDate(e.target.value)} className={NB.inputMono} />
                                        </div>
                                    </div>
                                    <div className={NB.footer}>
                                        <Button variant="outline" onClick={() => setDateDialogOpen(false)} className={NB.cancelBtn}>Batal</Button>
                                        <Button onClick={applyDateRange} className={NB.submitBtn}>Terapkan</Button>
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>
                        <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
                            <DialogTrigger asChild>
                                <Button className="bg-blue-500 text-white border border-blue-600 hover:bg-blue-600 font-bold uppercase text-[10px] tracking-wider px-4 h-9 rounded-none transition-colors ml-2">
                                    <Download className="h-3.5 w-3.5 mr-1.5" /> Export
                                </Button>
                            </DialogTrigger>
                            <DialogContent className={NB.contentNarrow}>
                                <DialogHeader className={NB.header}>
                                    <DialogTitle className={NB.title}>
                                        <Download className="h-4 w-4" /> Export Laporan
                                    </DialogTitle>
                                    <p className={NB.subtitle}>Unduh laporan dalam format pilihan</p>
                                </DialogHeader>
                                <div className="px-6 py-5 space-y-4">
                                    <div>
                                        <label className={NB.label}>Format</label>
                                        <div className="grid grid-cols-2 gap-3 mt-1">
                                            <button type="button" onClick={() => setExportFormat("CSV")} className={`p-3 border-2 text-center transition-all ${
                                                exportFormat === "CSV" ? "border-black bg-zinc-900 text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                                                    : "border-zinc-200 bg-white hover:border-zinc-400 hover:bg-zinc-50"
                                            }`}>
                                                <span className="text-[9px] font-black uppercase tracking-widest">CSV</span>
                                            </button>
                                            <button type="button" onClick={() => setExportFormat("XLS")} className={`p-3 border-2 text-center transition-all ${
                                                exportFormat === "XLS" ? "border-black bg-zinc-900 text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                                                    : "border-zinc-200 bg-white hover:border-zinc-400 hover:bg-zinc-50"
                                            }`}>
                                                <span className="text-[9px] font-black uppercase tracking-widest">XLS</span>
                                            </button>
                                        </div>
                                    </div>
                                    <div className={NB.footer}>
                                        <Button variant="outline" onClick={() => setExportDialogOpen(false)} className={NB.cancelBtn}>Batal</Button>
                                        <Button onClick={exportReportPack} className={NB.submitBtn}>Download</Button>
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>

                {/* Row 2: KPI Summary Strip */}
                <div className="flex items-center border-b border-zinc-200 dark:border-zinc-800 divide-x divide-zinc-200 dark:divide-zinc-800">
                    {reportKpis.map((kpi_item) => (
                        <div key={kpi_item.label} className="flex-1 px-4 py-3 flex items-center justify-between gap-3 cursor-default">
                            <div className="flex items-center gap-1.5">
                                <span className={`w-2 h-2 ${dotColors[kpi_item.color] || "bg-zinc-400"}`} />
                                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{kpi_item.label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {kpi_item.value === null ? (
                                    <span className="inline-block h-5 w-20 bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
                                ) : (
                                    <AnimatePresence mode="wait">
                                        {showAmounts ? (
                                            <motion.span
                                                key={kpi_item.value}
                                                initial={{ opacity: 0, scale: 0.8 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                transition={{ type: "spring" as const, stiffness: 400, damping: 20 }}
                                                className={`text-lg font-black ${textColors[kpi_item.color] || "text-zinc-900 dark:text-white"}`}
                                            >
                                                {kpi_item.value}
                                            </motion.span>
                                        ) : (
                                            <motion.span
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                className="text-lg font-black text-zinc-300 dark:text-zinc-600"
                                            >
                                                ••••
                                            </motion.span>
                                        )}
                                    </AnimatePresence>
                                )}
                                <button
                                    onClick={() => setShowAmounts(!showAmounts)}
                                    className="p-0.5 text-zinc-300 hover:text-zinc-500 dark:text-zinc-600 dark:hover:text-zinc-400 transition-colors"
                                    title={showAmounts ? "Sembunyikan nominal" : "Tampilkan nominal"}
                                >
                                    {showAmounts ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </motion.div>

            {/* ─── SIDEBAR + REPORT CONTENT LAYOUT ─── */}
            <motion.div variants={fadeUp} className="flex gap-4">
                {/* Sidebar Navigation */}
                <div className="hidden md:block w-[220px] shrink-0">
                    <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden sticky top-24">
                        <div className="px-3 py-2.5 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-800/30">
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
                                                    ? "bg-blue-500 text-white"
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

                {/* Mobile Report Selector */}
                <div className="md:hidden w-full">
                    <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden mb-4">
                        <div className="px-4 py-3 flex items-center gap-3 overflow-x-auto">
                            <div className="flex border border-zinc-300 dark:border-zinc-700 flex-wrap">
                                {sidebarGroups.flatMap(g => g.items).map((t) => (
                                    <button
                                        key={t.key}
                                        onClick={() => setReportType(t.key)}
                                        className={`px-3 py-2 text-[9px] font-bold uppercase tracking-widest transition-all border-r border-zinc-300 dark:border-zinc-700 last:border-r-0 flex items-center gap-1.5 whitespace-nowrap ${
                                            reportType === t.key ? "bg-blue-500 text-white" : "bg-white dark:bg-zinc-900 text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
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
                                            <TableRow
                                                className="font-black bg-zinc-50 dark:bg-zinc-800 cursor-pointer hover:bg-orange-50/50 dark:hover:bg-orange-950/10 transition-colors"
                                                onClick={() => toggleDrillDown('pnl-revenue', 'REVENUE')}
                                            >
                                                <TableCell className="w-[60%]">
                                                    <span className="flex items-center gap-2">
                                                        <ChevronRight className={`h-3.5 w-3.5 text-zinc-400 transition-transform ${expandedAccounts.has('pnl-revenue') ? 'rotate-90' : ''}`} />
                                                        Pendapatan (Revenue)
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right font-mono">{formatIDR(pnlData.revenue)}</TableCell>
                                            </TableRow>
                                            {expandedAccounts.has('pnl-revenue') && (
                                                <TableRow><TableCell colSpan={2} className="p-0">
                                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                                                        <DrillDownPanel rows={drillDownCache.get('pnl-revenue') || []} loading={drillDownLoading === 'pnl-revenue'} formatIDR={formatIDR} accountFilter="REVENUE" startDate={startDate} endDate={endDate} />
                                                    </motion.div>
                                                </TableCell></TableRow>
                                            )}
                                            <TableRow
                                                className="cursor-pointer hover:bg-orange-50/50 dark:hover:bg-orange-950/10 transition-colors"
                                                onClick={() => toggleDrillDown('pnl-cogs', '5000')}
                                            >
                                                <TableCell className="pl-8">
                                                    <span className="flex items-center gap-2">
                                                        <ChevronRight className={`h-3 w-3 text-zinc-400 transition-transform ${expandedAccounts.has('pnl-cogs') ? 'rotate-90' : ''}`} />
                                                        Harga Pokok Penjualan (HPP)
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-red-600">({formatIDR(pnlData.costOfGoodsSold)})</TableCell>
                                            </TableRow>
                                            {expandedAccounts.has('pnl-cogs') && (
                                                <TableRow><TableCell colSpan={2} className="p-0">
                                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}>
                                                        <DrillDownPanel rows={drillDownCache.get('pnl-cogs') || []} loading={drillDownLoading === 'pnl-cogs'} formatIDR={formatIDR} accountFilter="5000" startDate={startDate} endDate={endDate} />
                                                    </motion.div>
                                                </TableCell></TableRow>
                                            )}
                                            <TableRow className="font-bold bg-blue-50 dark:bg-blue-900/20">
                                                <TableCell>Laba Kotor</TableCell>
                                                <TableCell className="text-right font-mono text-blue-600">{formatIDR(pnlData.grossProfit)}</TableCell>
                                            </TableRow>
                                            <TableRow className="font-black bg-zinc-50 dark:bg-zinc-800">
                                                <TableCell>Beban Operasional</TableCell>
                                                <TableCell className="text-right font-mono text-red-600">({formatIDR(pnlData.totalOperatingExpenses)})</TableCell>
                                            </TableRow>
                                            {pnlData.operatingExpenses?.map((exp: any, idx: number) => (
                                                <React.Fragment key={idx}>
                                                    <TableRow
                                                        className="cursor-pointer hover:bg-orange-50/50 dark:hover:bg-orange-950/10 transition-colors"
                                                        onClick={() => toggleDrillDown(`pnl-opex-${idx}`, exp.code || 'EXPENSE')}
                                                    >
                                                        <TableCell className="pl-12 text-sm text-zinc-500">
                                                            <span className="flex items-center gap-2">
                                                                <ChevronRight className={`h-3 w-3 text-zinc-400 transition-transform ${expandedAccounts.has(`pnl-opex-${idx}`) ? 'rotate-90' : ''}`} />
                                                                {exp.category}
                                                                {exp.code && <span className="font-mono text-[10px] text-zinc-300">{exp.code}</span>}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="text-right font-mono text-sm text-red-600">({formatIDR(exp.amount)})</TableCell>
                                                    </TableRow>
                                                    {expandedAccounts.has(`pnl-opex-${idx}`) && (
                                                        <TableRow><TableCell colSpan={2} className="p-0">
                                                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}>
                                                                <DrillDownPanel rows={drillDownCache.get(`pnl-opex-${idx}`) || []} loading={drillDownLoading === `pnl-opex-${idx}`} formatIDR={formatIDR} accountFilter={exp.code || 'EXPENSE'} startDate={startDate} endDate={endDate} />
                                                            </motion.div>
                                                        </TableCell></TableRow>
                                                    )}
                                                </React.Fragment>
                                            ))}
                                            <TableRow className="font-bold bg-indigo-50 dark:bg-indigo-900/20">
                                                <TableCell>Laba Operasional</TableCell>
                                                <TableCell className="text-right font-mono text-indigo-600">{formatIDR(pnlData.operatingIncome)}</TableCell>
                                            </TableRow>
                                            {(pnlData.otherIncome > 0) && (
                                                <>
                                                <TableRow
                                                    className="cursor-pointer hover:bg-orange-50/50 dark:hover:bg-orange-950/10 transition-colors"
                                                    onClick={() => toggleDrillDown('pnl-other-income', '7000-8999')}
                                                >
                                                    <TableCell className="pl-8">
                                                        <span className="flex items-center gap-2">
                                                            <ChevronRight className={`h-3 w-3 text-zinc-400 transition-transform ${expandedAccounts.has('pnl-other-income') ? 'rotate-90' : ''}`} />
                                                            Pendapatan Lain-lain
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono text-emerald-600">{formatIDR(pnlData.otherIncome)}</TableCell>
                                                </TableRow>
                                                {expandedAccounts.has('pnl-other-income') && (
                                                    <TableRow><TableCell colSpan={2} className="p-0">
                                                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}>
                                                            <DrillDownPanel rows={drillDownCache.get('pnl-other-income') || []} loading={drillDownLoading === 'pnl-other-income'} formatIDR={formatIDR} accountFilter="7000" startDate={startDate} endDate={endDate} />
                                                        </motion.div>
                                                    </TableCell></TableRow>
                                                )}
                                                </>
                                            )}
                                            {(pnlData.otherExpenses > 0) && (
                                                <>
                                                <TableRow
                                                    className="cursor-pointer hover:bg-orange-50/50 dark:hover:bg-orange-950/10 transition-colors"
                                                    onClick={() => toggleDrillDown('pnl-other-expense', '8000-9999')}
                                                >
                                                    <TableCell className="pl-8">
                                                        <span className="flex items-center gap-2">
                                                            <ChevronRight className={`h-3 w-3 text-zinc-400 transition-transform ${expandedAccounts.has('pnl-other-expense') ? 'rotate-90' : ''}`} />
                                                            Biaya Lain-lain
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono text-red-600">({formatIDR(pnlData.otherExpenses)})</TableCell>
                                                </TableRow>
                                                {expandedAccounts.has('pnl-other-expense') && (
                                                    <TableRow><TableCell colSpan={2} className="p-0">
                                                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}>
                                                            <DrillDownPanel rows={drillDownCache.get('pnl-other-expense') || []} loading={drillDownLoading === 'pnl-other-expense'} formatIDR={formatIDR} accountFilter="8000" startDate={startDate} endDate={endDate} />
                                                        </motion.div>
                                                    </TableCell></TableRow>
                                                )}
                                                </>
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
                                const fixedAssets = balanceSheetData.assets?.fixedAssets || []
                                const otherAssets = balanceSheetData.assets?.otherAssets || []
                                const currentLiabilities = balanceSheetData.liabilities?.currentLiabilities || []
                                const longTermLiabilities = balanceSheetData.liabilities?.longTermLiabilities || []
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
                                                    <React.Fragment key={asset.code || idx}>
                                                        <TableRow
                                                            className="cursor-pointer hover:bg-orange-50/50 dark:hover:bg-orange-950/10 transition-colors"
                                                            onClick={() => toggleDrillDown(`bs-${asset.code}`, asset.code, true)}
                                                        >
                                                            <TableCell className="pl-10 text-sm">
                                                                <span className="flex items-center gap-2">
                                                                    <ChevronRight className={`h-3 w-3 text-zinc-400 transition-transform ${expandedAccounts.has(`bs-${asset.code}`) ? 'rotate-90' : ''}`} />
                                                                    <span className="font-mono text-[10px] text-zinc-400">{asset.code}</span>
                                                                    <span className="text-zinc-500">{asset.name}</span>
                                                                </span>
                                                            </TableCell>
                                                            <TableCell className="text-right font-mono text-sm">{formatIDR(asset.amount)}</TableCell>
                                                        </TableRow>
                                                        {expandedAccounts.has(`bs-${asset.code}`) && (
                                                            <TableRow><TableCell colSpan={2} className="p-0">
                                                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}>
                                                                    <DrillDownPanel rows={drillDownCache.get(`bs-${asset.code}`) || []} loading={drillDownLoading === `bs-${asset.code}`} formatIDR={formatIDR} accountFilter={asset.code} />
                                                                </motion.div>
                                                            </TableCell></TableRow>
                                                        )}
                                                    </React.Fragment>
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
                                                {/* Aset Tetap — expandable */}
                                                <TableRow
                                                    className="bg-zinc-50 dark:bg-zinc-800 font-bold cursor-pointer hover:bg-zinc-100/50 transition-colors"
                                                    onClick={() => setBsExpanded(prev => ({ ...prev, fixedAssets: !prev.fixedAssets }))}
                                                >
                                                    <TableCell className="flex items-center gap-1">
                                                        {bsExpanded.fixedAssets ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                                        Aset Tetap
                                                        {fixedAssets.length > 0 && (
                                                            <span className="text-[9px] font-medium text-zinc-400 ml-1">({fixedAssets.length} akun)</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono">{formatIDR(balanceSheetData.assets?.totalFixedAssets)}</TableCell>
                                                </TableRow>
                                                {bsExpanded.fixedAssets && fixedAssets.map((asset: any, idx: number) => (
                                                    <React.Fragment key={asset.code || idx}>
                                                        <TableRow
                                                            className="cursor-pointer hover:bg-orange-50/50 dark:hover:bg-orange-950/10 transition-colors"
                                                            onClick={() => toggleDrillDown(`bs-${asset.code}`, asset.code, true)}
                                                        >
                                                            <TableCell className="pl-10 text-sm">
                                                                <span className="flex items-center gap-2">
                                                                    <ChevronRight className={`h-3 w-3 text-zinc-400 transition-transform ${expandedAccounts.has(`bs-${asset.code}`) ? 'rotate-90' : ''}`} />
                                                                    <span className="font-mono text-[10px] text-zinc-400">{asset.code}</span>
                                                                    <span className="text-zinc-500">{asset.name}</span>
                                                                </span>
                                                            </TableCell>
                                                            <TableCell className="text-right font-mono text-sm">{formatIDR(asset.amount)}</TableCell>
                                                        </TableRow>
                                                        {expandedAccounts.has(`bs-${asset.code}`) && (
                                                            <TableRow><TableCell colSpan={2} className="p-0">
                                                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}>
                                                                    <DrillDownPanel rows={drillDownCache.get(`bs-${asset.code}`) || []} loading={drillDownLoading === `bs-${asset.code}`} formatIDR={formatIDR} accountFilter={asset.code} />
                                                                </motion.div>
                                                            </TableCell></TableRow>
                                                        )}
                                                    </React.Fragment>
                                                ))}
                                                {/* Aset Lainnya — if any */}
                                                {otherAssets.length > 0 && (
                                                    <>
                                                        <TableRow className="bg-zinc-50 dark:bg-zinc-800 font-bold">
                                                            <TableCell>Aset Lainnya</TableCell>
                                                            <TableCell className="text-right font-mono">{formatIDR(balanceSheetData.assets?.totalOtherAssets)}</TableCell>
                                                        </TableRow>
                                                        {otherAssets.map((asset: any, idx: number) => (
                                                            <React.Fragment key={asset.code || idx}>
                                                                <TableRow
                                                                    className="cursor-pointer hover:bg-orange-50/50 dark:hover:bg-orange-950/10 transition-colors"
                                                                    onClick={() => toggleDrillDown(`bs-${asset.code}`, asset.code, true)}
                                                                >
                                                                    <TableCell className="pl-10 text-sm">
                                                                        <span className="flex items-center gap-2">
                                                                            <ChevronRight className={`h-3 w-3 text-zinc-400 transition-transform ${expandedAccounts.has(`bs-${asset.code}`) ? 'rotate-90' : ''}`} />
                                                                            <span className="font-mono text-[10px] text-zinc-400">{asset.code}</span>
                                                                            <span className="text-zinc-500">{asset.name}</span>
                                                                        </span>
                                                                    </TableCell>
                                                                    <TableCell className="text-right font-mono text-sm">{formatIDR(asset.amount)}</TableCell>
                                                                </TableRow>
                                                                {expandedAccounts.has(`bs-${asset.code}`) && (
                                                                    <TableRow><TableCell colSpan={2} className="p-0">
                                                                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}>
                                                                            <DrillDownPanel rows={drillDownCache.get(`bs-${asset.code}`) || []} loading={drillDownLoading === `bs-${asset.code}`} formatIDR={formatIDR} accountFilter={asset.code} />
                                                                        </motion.div>
                                                                    </TableCell></TableRow>
                                                                )}
                                                            </React.Fragment>
                                                        ))}
                                                    </>
                                                )}
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
                                                        <React.Fragment key={liab.code || idx}>
                                                            <TableRow
                                                                className="cursor-pointer hover:bg-orange-50/50 dark:hover:bg-orange-950/10 transition-colors"
                                                                onClick={() => toggleDrillDown(`bs-${liab.code}`, liab.code, true)}
                                                            >
                                                                <TableCell className="pl-10 text-sm">
                                                                    <span className="flex items-center gap-2">
                                                                        <ChevronRight className={`h-3 w-3 text-zinc-400 transition-transform ${expandedAccounts.has(`bs-${liab.code}`) ? 'rotate-90' : ''}`} />
                                                                        <span className="font-mono text-[10px] text-zinc-400">{liab.code}</span>
                                                                        <span className="text-zinc-500">{liab.name}</span>
                                                                    </span>
                                                                </TableCell>
                                                                <TableCell className="text-right font-mono text-sm">{formatIDR(liab.amount)}</TableCell>
                                                            </TableRow>
                                                            {expandedAccounts.has(`bs-${liab.code}`) && (
                                                                <TableRow><TableCell colSpan={2} className="p-0">
                                                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}>
                                                                        <DrillDownPanel rows={drillDownCache.get(`bs-${liab.code}`) || []} loading={drillDownLoading === `bs-${liab.code}`} formatIDR={formatIDR} accountFilter={liab.code} />
                                                                    </motion.div>
                                                                </TableCell></TableRow>
                                                            )}
                                                        </React.Fragment>
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
                                                    {/* Kewajiban Jangka Panjang — if any */}
                                                    {longTermLiabilities.length > 0 && (
                                                        <>
                                                            <TableRow
                                                                className="bg-red-50/30 dark:bg-red-900/5 font-bold cursor-pointer hover:bg-red-100/50 transition-colors"
                                                                onClick={() => setBsExpanded(prev => ({ ...prev, longTermLiabilities: !prev.longTermLiabilities }))}
                                                            >
                                                                <TableCell className="flex items-center gap-1">
                                                                    {bsExpanded.longTermLiabilities ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                                                    Kewajiban Jangka Panjang
                                                                    <span className="text-[9px] font-medium text-zinc-400 ml-1">({longTermLiabilities.length} akun)</span>
                                                                </TableCell>
                                                                <TableCell className="text-right font-mono">{formatIDR(balanceSheetData.liabilities?.totalLongTermLiabilities)}</TableCell>
                                                            </TableRow>
                                                            {bsExpanded.longTermLiabilities && longTermLiabilities.map((liab: any, idx: number) => (
                                                                <React.Fragment key={liab.code || idx}>
                                                                    <TableRow
                                                                        className="cursor-pointer hover:bg-orange-50/50 dark:hover:bg-orange-950/10 transition-colors"
                                                                        onClick={() => toggleDrillDown(`bs-${liab.code}`, liab.code, true)}
                                                                    >
                                                                        <TableCell className="pl-10 text-sm">
                                                                            <span className="flex items-center gap-2">
                                                                                <ChevronRight className={`h-3 w-3 text-zinc-400 transition-transform ${expandedAccounts.has(`bs-${liab.code}`) ? 'rotate-90' : ''}`} />
                                                                                <span className="font-mono text-[10px] text-zinc-400">{liab.code}</span>
                                                                                <span className="text-zinc-500">{liab.name}</span>
                                                                            </span>
                                                                        </TableCell>
                                                                        <TableCell className="text-right font-mono text-sm">{formatIDR(liab.amount)}</TableCell>
                                                                    </TableRow>
                                                                    {expandedAccounts.has(`bs-${liab.code}`) && (
                                                                        <TableRow><TableCell colSpan={2} className="p-0">
                                                                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}>
                                                                                <DrillDownPanel rows={drillDownCache.get(`bs-${liab.code}`) || []} loading={drillDownLoading === `bs-${liab.code}`} formatIDR={formatIDR} accountFilter={liab.code} />
                                                                            </motion.div>
                                                                        </TableCell></TableRow>
                                                                    )}
                                                                </React.Fragment>
                                                            ))}
                                                        </>
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
                                                        <React.Fragment key={cap.code || idx}>
                                                            <TableRow
                                                                className="cursor-pointer hover:bg-orange-50/50 dark:hover:bg-orange-950/10 transition-colors"
                                                                onClick={() => toggleDrillDown(`bs-${cap.code}`, cap.code, true)}
                                                            >
                                                                <TableCell className="text-sm">
                                                                    <span className="flex items-center gap-2">
                                                                        <ChevronRight className={`h-3 w-3 text-zinc-400 transition-transform ${expandedAccounts.has(`bs-${cap.code}`) ? 'rotate-90' : ''}`} />
                                                                        <span className="font-mono text-[10px] text-zinc-400">{cap.code}</span>
                                                                        <span className="text-zinc-500">{cap.name}</span>
                                                                    </span>
                                                                </TableCell>
                                                                <TableCell className="text-right font-mono text-sm">{formatIDR(cap.amount)}</TableCell>
                                                            </TableRow>
                                                            {expandedAccounts.has(`bs-${cap.code}`) && (
                                                                <TableRow><TableCell colSpan={2} className="p-0">
                                                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}>
                                                                        <DrillDownPanel rows={drillDownCache.get(`bs-${cap.code}`) || []} loading={drillDownLoading === `bs-${cap.code}`} formatIDR={formatIDR} accountFilter={cap.code} />
                                                                    </motion.div>
                                                                </TableCell></TableRow>
                                                            )}
                                                        </React.Fragment>
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

                                {/* Trial Balance Diagnostic Panel */}
                                <div className="mt-4">
                                    {diagnosticTBData ? (
                                        <TrialBalancePanel
                                            data={diagnosticTBData}
                                            onReconcile={() => setReconDialogOpen(true)}
                                        />
                                    ) : (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="border-2 border-black text-xs"
                                            onClick={loadTrialBalance}
                                            disabled={tbLoading}
                                        >
                                            {tbLoading ? "Memuat..." : "Lihat Neraca Saldo (Trial Balance)"}
                                        </Button>
                                    )}
                                </div>

                                <ReconciliationPreviewDialog
                                    open={reconDialogOpen}
                                    onOpenChange={setReconDialogOpen}
                                    onComplete={() => {
                                        loadTrialBalance()
                                        setDiagnosticTBData(null)
                                    }}
                                />
                                </div>
                                )
                            })()}

                            {/* Cash Flow */}
                            {/* Cash Flow — drill-down skipped: CF line items only have description+amount, no GL account codes to drill into */}
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
                                                            <React.Fragment key={idx}>
                                                                <TableRow
                                                                    className="cursor-pointer hover:bg-orange-50/50 dark:hover:bg-orange-950/10 transition-colors"
                                                                    onClick={() => toggleDrillDown(`eq-${acc.accountCode}`, acc.accountCode)}
                                                                >
                                                                    <TableCell className="text-sm font-bold">
                                                                        <span className="flex items-center gap-2">
                                                                            <ChevronRight className={`h-3 w-3 text-zinc-400 transition-transform ${expandedAccounts.has(`eq-${acc.accountCode}`) ? 'rotate-90' : ''}`} />
                                                                            <span className="font-mono text-zinc-400 mr-2">{acc.accountCode}</span>
                                                                            {acc.accountName}
                                                                        </span>
                                                                    </TableCell>
                                                                    <TableCell className="text-right font-mono text-sm">{formatIDR(acc.openingBalance)}</TableCell>
                                                                    <TableCell className="text-right font-mono text-sm text-emerald-600">{acc.additions > 0 ? formatIDR(acc.additions) : "-"}</TableCell>
                                                                    <TableCell className="text-right font-mono text-sm text-red-600">{acc.deductions > 0 ? `(${formatIDR(acc.deductions)})` : "-"}</TableCell>
                                                                    <TableCell className="text-right font-mono text-sm font-bold">{formatIDR(acc.closingBalance)}</TableCell>
                                                                </TableRow>
                                                                {expandedAccounts.has(`eq-${acc.accountCode}`) && (
                                                                    <TableRow>
                                                                        <TableCell colSpan={5} className="p-0">
                                                                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} transition={{ duration: 0.2 }}>
                                                                                <DrillDownPanel rows={drillDownCache.get(`eq-${acc.accountCode}`) || []} loading={drillDownLoading === `eq-${acc.accountCode}`} formatIDR={formatIDR} accountFilter={acc.accountCode} startDate={startDate} endDate={endDate} />
                                                                            </motion.div>
                                                                        </TableCell>
                                                                    </TableRow>
                                                                )}
                                                            </React.Fragment>
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
                                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Belum Jatuh Tempo</TableHead>
                                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">1-30 Hari</TableHead>
                                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">31-60 Hari</TableHead>
                                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">61-90 Hari</TableHead>
                                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">90+ Hari</TableHead>
                                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Total</TableHead>
                                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-center w-[60px]">Aksi</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {arAgingData.byCustomer.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={8} className="text-center py-8 text-zinc-400 text-xs font-bold uppercase tracking-widest">
                                                            Tidak ada piutang terbuka
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    arAgingData.byCustomer.map((cust: any, idx: number) => {
                                                        const isExpanded = expandedAR.has(cust.customerId)
                                                        return (
                                                            <React.Fragment key={idx}>
                                                                <TableRow
                                                                    className="cursor-pointer hover:bg-orange-50/50 dark:hover:bg-orange-950/10 transition-colors"
                                                                    onClick={() => router.push(`/finance/transactions?account=1200&search=${encodeURIComponent(cust.customerName)}`)}
                                                                >
                                                                    <TableCell className="font-bold text-sm">
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); toggleAR(cust.customerId) }}
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
                                                                    <TableCell className="text-center">
                                                                        <span className="inline-flex items-center justify-center h-6 w-6 text-orange-500 hover:text-orange-700 hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors rounded-none" title="Lihat transaksi piutang">
                                                                            <ArrowRight className="h-3.5 w-3.5" />
                                                                        </span>
                                                                    </TableCell>
                                                                </TableRow>
                                                                {isExpanded && cust.invoices?.map((inv: any, j: number) => {
                                                                    const b = inv.bucket || 'current'
                                                                    const bal = inv.balanceDue || 0
                                                                    const dueLbl = new Date(inv.dueDate).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })
                                                                    return (
                                                                    <TableRow key={`inv-${j}`} className="bg-orange-50/50 dark:bg-orange-900/10">
                                                                        <TableCell className="pl-8 text-xs">
                                                                            <Link
                                                                                href={`/finance/invoices?highlight=${inv.id}`}
                                                                                className="text-orange-600 hover:underline font-mono font-bold"
                                                                            >
                                                                                {inv.invoiceNumber}
                                                                            </Link>
                                                                            <span className="text-[9px] text-zinc-400 ml-1.5">jt. {dueLbl}</span>
                                                                        </TableCell>
                                                                        <TableCell className="text-right text-[10px] font-mono">{b === 'current' ? formatIDR(bal) : "-"}</TableCell>
                                                                        <TableCell className="text-right text-[10px] font-mono">{b === '1-30' ? formatIDR(bal) : "-"}</TableCell>
                                                                        <TableCell className="text-right text-[10px] font-mono">{b === '31-60' ? formatIDR(bal) : "-"}</TableCell>
                                                                        <TableCell className="text-right text-[10px] font-mono">{b === '61-90' ? formatIDR(bal) : "-"}</TableCell>
                                                                        <TableCell className="text-right text-[10px] font-mono text-red-600">{b === '90+' ? formatIDR(bal) : "-"}</TableCell>
                                                                        <TableCell className="text-right text-[10px] font-mono font-bold">{formatIDR(bal)}</TableCell>
                                                                        <TableCell className="text-center">
                                                                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-sm ${
                                                                                inv.status === 'OVERDUE' ? 'bg-red-100 text-red-700' :
                                                                                inv.status === 'PARTIAL' ? 'bg-amber-100 text-amber-700' :
                                                                                'bg-blue-100 text-blue-700'
                                                                            }`}>{inv.status}</span>
                                                                        </TableCell>
                                                                    </TableRow>
                                                                    )
                                                                })}
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
                                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Belum Jatuh Tempo</TableHead>
                                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">1-30 Hari</TableHead>
                                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">31-60 Hari</TableHead>
                                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">61-90 Hari</TableHead>
                                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">90+ Hari</TableHead>
                                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Total</TableHead>
                                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-center w-[60px]">Aksi</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {apAgingData.bySupplier.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={8} className="text-center py-8 text-zinc-400 text-xs font-bold uppercase tracking-widest">
                                                            Tidak ada hutang terbuka
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    apAgingData.bySupplier.map((supp: any, idx: number) => {
                                                        const isExpanded = expandedAP.has(supp.supplierId)
                                                        return (
                                                            <React.Fragment key={idx}>
                                                                <TableRow
                                                                    className="cursor-pointer hover:bg-orange-50/50 dark:hover:bg-orange-950/10 transition-colors"
                                                                    onClick={() => router.push(`/finance/transactions?account=2000&search=${encodeURIComponent(supp.supplierName)}`)}
                                                                >
                                                                    <TableCell className="font-bold text-sm">
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); toggleAP(supp.supplierId) }}
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
                                                                    <TableCell className="text-center">
                                                                        <span className="inline-flex items-center justify-center h-6 w-6 text-orange-500 hover:text-orange-700 hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors rounded-none" title="Lihat transaksi hutang">
                                                                            <ArrowRight className="h-3.5 w-3.5" />
                                                                        </span>
                                                                    </TableCell>
                                                                </TableRow>
                                                                {isExpanded && supp.bills?.map((bill: any, j: number) => {
                                                                    const b = bill.bucket || 'current'
                                                                    const bal = bill.balanceDue || 0
                                                                    const dueLbl = new Date(bill.dueDate).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })
                                                                    return (
                                                                    <TableRow key={`bill-${j}`} className="bg-red-50/50 dark:bg-red-900/10">
                                                                        <TableCell className="pl-8 text-xs">
                                                                            <Link
                                                                                href={`/finance/bills?highlight=${bill.id}`}
                                                                                className="text-red-600 hover:underline font-mono font-bold"
                                                                            >
                                                                                {bill.billNumber}
                                                                            </Link>
                                                                            <span className="text-[9px] text-zinc-400 ml-1.5">jt. {dueLbl}</span>
                                                                        </TableCell>
                                                                        <TableCell className="text-right text-[10px] font-mono">{b === 'current' ? formatIDR(bal) : "-"}</TableCell>
                                                                        <TableCell className="text-right text-[10px] font-mono">{b === '1-30' ? formatIDR(bal) : "-"}</TableCell>
                                                                        <TableCell className="text-right text-[10px] font-mono">{b === '31-60' ? formatIDR(bal) : "-"}</TableCell>
                                                                        <TableCell className="text-right text-[10px] font-mono">{b === '61-90' ? formatIDR(bal) : "-"}</TableCell>
                                                                        <TableCell className="text-right text-[10px] font-mono text-red-600">{b === '90+' ? formatIDR(bal) : "-"}</TableCell>
                                                                        <TableCell className="text-right text-[10px] font-mono font-bold">{formatIDR(bal)}</TableCell>
                                                                        <TableCell className="text-center">
                                                                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-sm ${
                                                                                bill.status === 'OVERDUE' ? 'bg-red-100 text-red-700' :
                                                                                bill.status === 'PARTIAL' ? 'bg-amber-100 text-amber-700' :
                                                                                'bg-blue-100 text-blue-700'
                                                                            }`}>{bill.status}</span>
                                                                        </TableCell>
                                                                    </TableRow>
                                                                    )
                                                                })}
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
                                                                    <TableRow key={idx} className="hover:bg-orange-50/50 dark:hover:bg-orange-950/10 transition-colors">
                                                                        <TableCell className="font-mono text-sm">
                                                                            {item.id ? (
                                                                                <Link href={`/finance/invoices?highlight=${item.id}`} className="text-orange-500 hover:text-orange-700 hover:underline font-bold">
                                                                                    {item.number}
                                                                                </Link>
                                                                            ) : item.number}
                                                                        </TableCell>
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
                                                                    <TableRow key={idx} className="hover:bg-orange-50/50 dark:hover:bg-orange-950/10 transition-colors">
                                                                        <TableCell className="font-mono text-sm">
                                                                            {item.id ? (
                                                                                <Link href={`/finance/bills?highlight=${item.id}`} className="text-orange-500 hover:text-orange-700 hover:underline font-bold">
                                                                                    {item.number}
                                                                                </Link>
                                                                            ) : item.number}
                                                                        </TableCell>
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

                            {/* PPh (Potong/Pungut) Report */}
                            {reportType === "pph_report" && (
                                <div className="space-y-4">
                                    {/* KPI Strip */}
                                    <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                                        <div className="h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500" />
                                        <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <FileText className="h-4 w-4 text-emerald-600" />
                                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Laporan PPh (Potong / Pungut)</span>
                                            </div>
                                            <span className="text-[10px] font-bold text-zinc-400">
                                                {currentMonth.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}
                                            </span>
                                        </div>
                                        <div className="flex items-center divide-x divide-zinc-200 dark:divide-zinc-800">
                                            {[
                                                { label: "PPh 23", value: pphSummary?.pph23?.total ?? 0, color: "blue" },
                                                { label: "PPh 4(2)", value: pphSummary?.pph4_2?.total ?? 0, color: "indigo" },
                                                { label: "Belum Disetor", value: (pphSummary?.pph23?.outstanding ?? 0) + (pphSummary?.pph4_2?.outstanding ?? 0) + (pphSummary?.pph21?.outstanding ?? 0), color: "amber" },
                                                { label: "Total Semua", value: (pphSummary?.pph23?.total ?? 0) + (pphSummary?.pph4_2?.total ?? 0) + (pphSummary?.pph21?.total ?? 0), color: "emerald" },
                                            ].map((kpiItem) => (
                                                <div key={kpiItem.label} className="flex-1 px-4 py-3 flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className={`w-2 h-2 ${kpiItem.color === "blue" ? "bg-blue-500" : kpiItem.color === "indigo" ? "bg-indigo-500" : kpiItem.color === "amber" ? "bg-amber-500" : "bg-emerald-500"}`} />
                                                        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{kpiItem.label}</span>
                                                    </div>
                                                    {pphSummaryLoading ? (
                                                        <span className="inline-block h-5 w-20 bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
                                                    ) : (
                                                        <span className={`text-lg font-black ${kpiItem.color === "amber" && kpiItem.value > 0 ? "text-amber-600" : "text-zinc-900 dark:text-white"}`}>
                                                            {formatIDR(kpiItem.value)}
                                                        </span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Deadline Info */}
                                    <div className="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-300 dark:border-amber-700 px-4 py-2.5 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-amber-700">Batas Waktu</span>
                                        </div>
                                        <div className="flex items-center gap-4 text-[11px] font-bold text-amber-700">
                                            <span>Batas setor: {pphDeadlines.deposit.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</span>
                                            <span className="text-amber-400">|</span>
                                            <span>Batas lapor: {pphDeadlines.filing.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</span>
                                        </div>
                                    </div>

                                    {/* Action bar + Deposit dialog */}
                                    {pphSelectedIds.size > 0 && (
                                        <div className="bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-300 dark:border-emerald-700 px-4 py-2.5 flex items-center justify-between">
                                            <span className="text-[11px] font-bold text-emerald-700">
                                                {pphSelectedIds.size} PPh dipilih
                                            </span>
                                            <Dialog open={pphDepositDialogOpen} onOpenChange={setPphDepositDialogOpen}>
                                                <DialogTrigger asChild>
                                                    <Button className="bg-emerald-500 text-white border border-emerald-600 hover:bg-emerald-600 font-bold uppercase text-[10px] tracking-wider px-4 h-8 rounded-none transition-colors">
                                                        <Check className="h-3.5 w-3.5 mr-1.5" /> Tandai Sudah Disetor
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent className={NB.contentNarrow}>
                                                    <DialogHeader className={NB.header}>
                                                        <DialogTitle className={NB.title}>
                                                            <Check className="h-4 w-4" /> Setor PPh
                                                        </DialogTitle>
                                                        <p className={NB.subtitle}>{pphSelectedIds.size} item PPh akan ditandai sudah disetor</p>
                                                    </DialogHeader>
                                                    <div className="px-6 py-5 space-y-4">
                                                        <div>
                                                            <label className={NB.label}>Tanggal Setor</label>
                                                            <Input type="date" value={pphDepositDate} onChange={(e) => setPphDepositDate(e.target.value)} className={NB.inputMono} />
                                                        </div>
                                                        <div>
                                                            <label className={NB.label}>Nomor NTPN / Referensi</label>
                                                            <Input value={pphDepositRef} onChange={(e) => setPphDepositRef(e.target.value)} placeholder="NTPN..." className={NB.input} />
                                                        </div>
                                                        <div className={NB.footer}>
                                                            <Button variant="outline" onClick={() => setPphDepositDialogOpen(false)} className={NB.cancelBtn}>Batal</Button>
                                                            <Button onClick={handlePphDeposit} disabled={pphDepositing} className={NB.submitBtnGreen}>
                                                                {pphDepositing ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Menyetor...</> : "Setor & Posting GL"}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </DialogContent>
                                            </Dialog>
                                        </div>
                                    )}

                                    {/* PPh Records Table */}
                                    <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                                        <div className="px-4 py-3 border-b-2 border-black bg-zinc-50 dark:bg-zinc-800 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <FileText className="h-4 w-4 text-zinc-500" />
                                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Daftar Pemotongan PPh</span>
                                            </div>
                                            <span className="text-[10px] font-black text-zinc-400">
                                                {(pphRecords || []).length} Record
                                            </span>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="bg-zinc-50 dark:bg-zinc-800">
                                                        <TableHead className="w-10">
                                                            <input
                                                                type="checkbox"
                                                                checked={
                                                                    (pphRecords || []).filter((r: any) => !r.deposited).length > 0 &&
                                                                    pphSelectedIds.size === (pphRecords || []).filter((r: any) => !r.deposited).length
                                                                }
                                                                onChange={togglePphSelectAll}
                                                                className="h-4 w-4 rounded-none border-2 border-zinc-300 accent-emerald-500"
                                                            />
                                                        </TableHead>
                                                        <TableHead className="text-[10px] font-black uppercase tracking-widest">Tanggal</TableHead>
                                                        <TableHead className="text-[10px] font-black uppercase tracking-widest">Jenis</TableHead>
                                                        <TableHead className="text-[10px] font-black uppercase tracking-widest">Vendor / Customer</TableHead>
                                                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">DPP</TableHead>
                                                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Tarif</TableHead>
                                                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Jumlah PPh</TableHead>
                                                        <TableHead className="text-[10px] font-black uppercase tracking-widest">Bukti Potong</TableHead>
                                                        <TableHead className="text-[10px] font-black uppercase tracking-widest">Status</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {pphListLoading ? (
                                                        <TableRow>
                                                            <TableCell colSpan={9} className="text-center py-8">
                                                                <div className="flex items-center justify-center gap-2 text-zinc-400">
                                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                                    <span className="text-xs font-bold uppercase tracking-widest">Memuat data PPh...</span>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ) : !pphRecords || pphRecords.length === 0 ? (
                                                        <TableRow>
                                                            <TableCell colSpan={9} className="text-center py-8 text-zinc-400 text-xs font-bold uppercase tracking-widest">
                                                                Tidak ada data pemotongan PPh
                                                            </TableCell>
                                                        </TableRow>
                                                    ) : (
                                                        (pphRecords as any[]).map((record: any) => {
                                                            const partyName = record.invoice?.supplier?.name || record.invoice?.customer?.name || "\u2014"
                                                            const typeLabel = record.type === "PPH_23" ? "PPh 23" : record.type === "PPH_4_2" ? "PPh 4(2)" : "PPh 21"
                                                            const typeBg = record.type === "PPH_23" ? "bg-blue-100 text-blue-700" : record.type === "PPH_4_2" ? "bg-indigo-100 text-indigo-700" : "bg-purple-100 text-purple-700"
                                                            const txDate = record.payment?.date ? new Date(record.payment.date) : new Date(record.createdAt)
                                                            return (
                                                                <TableRow key={record.id} className="hover:bg-orange-50/50 dark:hover:bg-orange-950/10 transition-colors">
                                                                    <TableCell>
                                                                        {!record.deposited && (
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={pphSelectedIds.has(record.id)}
                                                                                onChange={() => togglePphSelect(record.id)}
                                                                                className="h-4 w-4 rounded-none border-2 border-zinc-300 accent-emerald-500"
                                                                            />
                                                                        )}
                                                                    </TableCell>
                                                                    <TableCell className="font-mono text-sm">{txDate.toLocaleDateString("id-ID")}</TableCell>
                                                                    <TableCell>
                                                                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 ${typeBg}`}>{typeLabel}</span>
                                                                    </TableCell>
                                                                    <TableCell className="text-sm">{partyName}</TableCell>
                                                                    <TableCell className="text-right font-mono text-sm">{formatIDR(Number(record.baseAmount))}</TableCell>
                                                                    <TableCell className="text-right font-mono text-sm">{Number(record.rate)}%</TableCell>
                                                                    <TableCell className="text-right font-mono text-sm font-bold">{formatIDR(Number(record.amount))}</TableCell>
                                                                    <TableCell className="font-mono text-sm">{record.buktiPotongNo || "\u2014"}</TableCell>
                                                                    <TableCell>
                                                                        {record.deposited ? (
                                                                            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 bg-emerald-100 text-emerald-700">Sudah Disetor</span>
                                                                        ) : (
                                                                            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 bg-amber-100 text-amber-700">Belum Disetor</span>
                                                                        )}
                                                                    </TableCell>
                                                                </TableRow>
                                                            )
                                                        })
                                                    )}
                                                    {pphRecords && pphRecords.length > 0 && (
                                                        <TableRow className="font-black bg-zinc-100 dark:bg-zinc-800 border-t-2 border-black">
                                                            <TableCell colSpan={6} className="text-sm">TOTAL</TableCell>
                                                            <TableCell className="text-right font-mono text-sm">
                                                                {formatIDR((pphRecords as any[]).reduce((sum: number, r: any) => sum + Number(r.amount), 0))}
                                                            </TableCell>
                                                            <TableCell colSpan={2} />
                                                        </TableRow>
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>
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
                                                            const bKey = `bva-${item.accountCode}`
                                                            return (
                                                                <React.Fragment key={idx}>
                                                                    <TableRow
                                                                        className={`cursor-pointer hover:bg-orange-50/50 dark:hover:bg-orange-950/10 transition-colors ${isNegativeVariance ? "bg-red-50/50 dark:bg-red-900/10" : ""}`}
                                                                        onClick={() => toggleDrillDown(bKey, item.accountCode)}
                                                                    >
                                                                        <TableCell className="font-mono font-bold text-sm">
                                                                            <span className="flex items-center gap-1.5">
                                                                                <ChevronRight className={`h-3 w-3 text-zinc-400 transition-transform ${expandedAccounts.has(bKey) ? 'rotate-90' : ''}`} />
                                                                                {item.accountCode}
                                                                            </span>
                                                                        </TableCell>
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
                                                                    {expandedAccounts.has(bKey) && (
                                                                        <TableRow><TableCell colSpan={6} className="p-0">
                                                                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}>
                                                                                <DrillDownPanel rows={drillDownCache.get(bKey) || []} loading={drillDownLoading === bKey} formatIDR={formatIDR} accountFilter={item.accountCode} startDate={startDate} endDate={endDate} />
                                                                            </motion.div>
                                                                        </TableCell></TableRow>
                                                                    )}
                                                                </React.Fragment>
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

                            {/* Fallback: no data for active report (skip pph_report — it uses its own query) */}
                            {data && reportType !== "pph_report" && !(data.reports as any)?.[reportType] && (
                                <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] p-12 text-center">
                                    <BarChart3 className="h-8 w-8 mx-auto text-zinc-300 mb-2" />
                                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Data laporan tidak tersedia</p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </motion.div>
        </motion.div>
    )
}
