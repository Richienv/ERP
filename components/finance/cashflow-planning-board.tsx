"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { formatCurrency } from "@/lib/utils"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { NB } from "@/lib/dialog-styles"
import {
    IconChevronLeft,
    IconChevronRight,
    IconChevronDown,
    IconPlus,
    IconCamera,
    IconWallet,
    IconScale,
    IconEdit,
    IconRefresh,
    IconGauge,
    IconBuildingBank,
    IconCalendarWeek,
    IconHistory,
    IconPencil,
} from "@tabler/icons-react"
import { saveCashflowSnapshot, overrideStartingBalance } from "@/lib/actions/finance-cashflow"
import type { CashflowPlanData, CashflowItem, CashflowForecastData, UpcomingObligationsData, UpcomingObligationItem } from "@/lib/actions/finance-cashflow"
import { CreateCashflowItemDialog } from "./create-cashflow-item-dialog"

// ─── Constants ──────────────────────────────────────────────────────────────

const MONTH_NAMES = [
    "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
]

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
    AR_INVOICE:        { bg: "bg-emerald-50",  border: "border-l-emerald-500", text: "text-emerald-700" },
    AP_BILL:           { bg: "bg-red-50",      border: "border-l-red-500",     text: "text-red-700" },
    PO_DIRECT:         { bg: "bg-indigo-50",   border: "border-l-indigo-500",  text: "text-indigo-700" },
    PAYROLL:           { bg: "bg-orange-50",   border: "border-l-orange-500",  text: "text-orange-700" },
    BPJS:              { bg: "bg-amber-50",    border: "border-l-amber-500",   text: "text-amber-700" },
    PETTY_CASH:        { bg: "bg-slate-50",    border: "border-l-slate-500",   text: "text-slate-700" },
    RECURRING_JOURNAL: { bg: "bg-purple-50",   border: "border-l-purple-500",  text: "text-purple-700" },
    BUDGET_ALLOCATION: { bg: "bg-blue-50",     border: "border-l-blue-500",    text: "text-blue-700" },
    MANUAL:            { bg: "bg-zinc-50",     border: "border-l-zinc-500",    text: "text-zinc-700" },
    RECURRING_EXPENSE: { bg: "bg-rose-50",     border: "border-l-rose-500",    text: "text-rose-700" },
    RECURRING_INCOME:  { bg: "bg-teal-50",     border: "border-l-teal-500",    text: "text-teal-700" },
    FUNDING_CAPITAL:   { bg: "bg-cyan-50",     border: "border-l-cyan-500",    text: "text-cyan-700" },
    EQUITY_WITHDRAWAL: { bg: "bg-pink-50",     border: "border-l-pink-500",    text: "text-pink-700" },
    LOAN_DISBURSEMENT: { bg: "bg-sky-50",      border: "border-l-sky-500",     text: "text-sky-700" },
    LOAN_REPAYMENT:    { bg: "bg-fuchsia-50",  border: "border-l-fuchsia-500", text: "text-fuchsia-700" },
}

const CATEGORY_LABELS: Record<string, string> = {
    AR_INVOICE: "Piutang",
    AP_BILL: "Hutang",
    PO_DIRECT: "PO Langsung",
    PAYROLL: "Gaji",
    BPJS: "BPJS",
    PETTY_CASH: "Peti Kas",
    RECURRING_JOURNAL: "Jurnal Berulang",
    BUDGET_ALLOCATION: "Anggaran",
    MANUAL: "Manual",
    RECURRING_EXPENSE: "Beban Berulang",
    RECURRING_INCOME: "Pendapatan Berulang",
    FUNDING_CAPITAL: "Modal Masuk",
    EQUITY_WITHDRAWAL: "Penarikan Ekuitas",
    LOAN_DISBURSEMENT: "Pencairan Pinjaman",
    LOAN_REPAYMENT: "Cicilan Pinjaman",
}

const DEFAULT_CAT = { bg: "bg-zinc-50", border: "border-l-zinc-400", text: "text-zinc-600" }

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCompact(amount: number): string {
    if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1)}M`
    if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}jt`
    if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}rb`
    return String(Math.round(amount))
}

function shortBankName(glAccountName?: string, glAccountCode?: string): string | null {
    if (!glAccountCode?.startsWith("10")) return null
    if (!glAccountName) return glAccountCode
    const name = glAccountName.replace(/^(Bank|Rek\.?|Rekening)\s+/i, "").trim()
    return name.length > 10 ? name.substring(0, 9) + "…" : name
}

interface WeekDef {
    label: string
    shortLabel: string
    start: number
    end: number
    isCurrent: boolean
}

function getWeeks(month: number, year: number): WeekDef[] {
    const lastDay = new Date(year, month, 0).getDate()
    const today = new Date()
    const isCurrentMonth = today.getMonth() + 1 === month && today.getFullYear() === year
    const currentDay = isCurrentMonth ? today.getDate() : -1

    const weeks: WeekDef[] = [
        { label: `Minggu 1 (1-7)`, shortLabel: "Mgg 1", start: 1, end: 7, isCurrent: currentDay >= 1 && currentDay <= 7 },
        { label: `Minggu 2 (8-14)`, shortLabel: "Mgg 2", start: 8, end: 14, isCurrent: currentDay >= 8 && currentDay <= 14 },
        { label: `Minggu 3 (15-21)`, shortLabel: "Mgg 3", start: 15, end: 21, isCurrent: currentDay >= 15 && currentDay <= 21 },
        { label: `Minggu 4 (22-${lastDay})`, shortLabel: "Mgg 4", start: 22, end: lastDay, isCurrent: currentDay >= 22 && currentDay <= lastDay },
    ]
    return weeks
}

function getItemsForWeek(items: CashflowItem[], weekStart: number, weekEnd: number): CashflowItem[] {
    return items.filter(item => {
        const day = parseInt(item.date.split("-")[2], 10)
        return day >= weekStart && day <= weekEnd
    })
}

function calcWeekTotals(items: CashflowItem[]) {
    const inItems = items.filter(i => i.direction === "IN")
    const outItems = items.filter(i => i.direction === "OUT")
    const totalIn = inItems.reduce((s, i) => s + i.amount, 0)
    const totalOut = outItems.reduce((s, i) => s + i.amount, 0)
    return { totalIn, totalOut, net: totalIn - totalOut, inItems, outItems }
}

// ─── Component Props ────────────────────────────────────────────────────────

interface CashflowPlanningBoardProps {
    data: CashflowPlanData
    month: number
    year: number
    onMonthChange: (month: number) => void
    onYearChange: (year: number) => void
    accuracyTrend?: { month: number; year: number; label: string; accuracyScore: number | null }[]
    forecast?: CashflowForecastData
    upcoming?: UpcomingObligationsData
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function CashflowPlanningBoard({
    data,
    month,
    year,
    onMonthChange,
    onYearChange,
    accuracyTrend,
    forecast,
    upcoming,
}: CashflowPlanningBoardProps) {
    const queryClient = useQueryClient()
    const [viewMode, setViewMode] = useState<"planning" | "riil">("planning")
    const [savingSnapshot, setSavingSnapshot] = useState(false)
    const [itemDialogOpen, setItemDialogOpen] = useState(false)
    const [editItem, setEditItem] = useState<CashflowItem | null>(null)
    const [glAccounts, setGlAccounts] = useState<{ id: string; code: string; name: string }[]>([])
    const [overrideDialogOpen, setOverrideDialogOpen] = useState(false)
    const [overrideAmount, setOverrideAmount] = useState("")
    const [savingOverride, setSavingOverride] = useState(false)
    const [bankFilter, setBankFilter] = useState<string>("all")
    const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
    const [showAccuracy, setShowAccuracy] = useState(false)

    useEffect(() => {
        fetch("/api/finance/transactions")
            .then(r => r.json())
            .then(d => {
                if (d.accounts) {
                    setGlAccounts(d.accounts.map((a: any) => ({ id: a.id, code: a.code, name: a.name })))
                }
            })
            .catch(() => {})
    }, [])

    // ─── Navigation ──────────────────────────────────────────────
    function handlePrevMonth() {
        if (month === 1) { onMonthChange(12); onYearChange(year - 1) }
        else onMonthChange(month - 1)
    }
    function handleNextMonth() {
        if (month === 12) { onMonthChange(1); onYearChange(year + 1) }
        else onMonthChange(month + 1)
    }

    // ─── Actions ─────────────────────────────────────────────────
    async function handleSaveSnapshot() {
        setSavingSnapshot(true)
        try {
            await saveCashflowSnapshot(month, year)
            await queryClient.invalidateQueries({ queryKey: queryKeys.cashflowPlan.all })
            toast.success(`Snapshot ${MONTH_NAMES[month]} ${year} tersimpan`)
        } catch { toast.error("Gagal menyimpan snapshot") }
        finally { setSavingSnapshot(false) }
    }

    async function handleSaveOverride() {
        const amt = parseFloat(overrideAmount)
        if (isNaN(amt) || amt < 0) { toast.error("Jumlah tidak valid"); return }
        setSavingOverride(true)
        try {
            await overrideStartingBalance(month, year, amt)
            await queryClient.invalidateQueries({ queryKey: queryKeys.cashflowPlan.all })
            toast.success("Saldo awal berhasil diubah")
            setOverrideDialogOpen(false)
        } catch { toast.error("Gagal mengubah saldo awal") }
        finally { setSavingOverride(false) }
    }

    async function handleResetOverride() {
        setSavingOverride(true)
        try {
            await overrideStartingBalance(month, year, null)
            await queryClient.invalidateQueries({ queryKey: queryKeys.cashflowPlan.all })
            toast.success("Saldo awal direset ke GL")
            setOverrideDialogOpen(false)
        } catch { toast.error("Gagal mereset saldo awal") }
        finally { setSavingOverride(false) }
    }

    // ─── Data Preparation ────────────────────────────────────────
    const bankAccounts = glAccounts.filter(a => a.code.startsWith("10"))
    const autoItems = data.autoItems ?? []
    const manualItems = data.manualItems ?? []
    const actualItems = data.actualItems ?? []

    const allPlanItems = [...autoItems, ...manualItems]
    const activeItems = viewMode === "planning" ? allPlanItems : actualItems
    const bankFiltered = bankFilter === "all"
        ? activeItems
        : activeItems.filter(item => item.glAccountCode === bankFilter)
    const filteredItems = categoryFilter
        ? bankFiltered.filter(item => {
            if (categoryFilter === "PAYROLL_BPJS") return item.category === "PAYROLL" || item.category === "BPJS"
            if (categoryFilter === "OTHER") return !["AR_INVOICE", "AP_BILL", "PO_DIRECT", "PAYROLL", "BPJS", "LOAN_REPAYMENT"].includes(item.category)
            return item.category === categoryFilter
        })
        : bankFiltered

    const weeks = getWeeks(month, year)

    // ─── Obligations Summary ─────────────────────────────────────
    const obligationGroups = [
        {
            key: "AR_INVOICE",
            label: "Piutang (AR)",
            sublabel: "Uang yang akan masuk",
            direction: "IN" as const,
            color: "border-l-emerald-500 bg-emerald-50",
            textColor: "text-emerald-700",
            amountColor: "text-emerald-600",
            icon: "↓",
            categories: ["AR_INVOICE"],
        },
        {
            key: "AP_BILL",
            label: "Hutang (AP)",
            sublabel: "Tagihan jatuh tempo",
            direction: "OUT" as const,
            color: "border-l-red-500 bg-red-50",
            textColor: "text-red-700",
            amountColor: "text-red-600",
            icon: "↑",
            categories: ["AP_BILL"],
        },
        {
            key: "PO_DIRECT",
            label: "PO Belum Bayar",
            sublabel: "Purchase order aktif",
            direction: "OUT" as const,
            color: "border-l-indigo-500 bg-indigo-50",
            textColor: "text-indigo-700",
            amountColor: "text-indigo-600",
            icon: "↑",
            categories: ["PO_DIRECT"],
        },
        {
            key: "PAYROLL_BPJS",
            label: "Gaji & BPJS",
            sublabel: "Kewajiban karyawan",
            direction: "OUT" as const,
            color: "border-l-orange-500 bg-orange-50",
            textColor: "text-orange-700",
            amountColor: "text-orange-600",
            icon: "↑",
            categories: ["PAYROLL", "BPJS"],
        },
        {
            key: "LOAN_REPAYMENT",
            label: "Cicilan Pinjaman",
            sublabel: "Pembayaran hutang bank",
            direction: "OUT" as const,
            color: "border-l-fuchsia-500 bg-fuchsia-50",
            textColor: "text-fuchsia-700",
            amountColor: "text-fuchsia-600",
            icon: "↑",
            categories: ["LOAN_REPAYMENT"],
        },
        {
            key: "OTHER",
            label: "Lainnya",
            sublabel: "Modal, jurnal, manual, dll",
            direction: null,
            color: "border-l-zinc-500 bg-zinc-50",
            textColor: "text-zinc-700",
            amountColor: "text-zinc-600",
            icon: "↕",
            categories: [] as string[], // computed separately
        },
    ]

    const obligationData = obligationGroups.map(group => {
        const items = group.key === "OTHER"
            ? allPlanItems.filter(i => !["AR_INVOICE", "AP_BILL", "PO_DIRECT", "PAYROLL", "BPJS", "LOAN_REPAYMENT"].includes(i.category))
            : allPlanItems.filter(i => group.categories.includes(i.category))
        const total = items.reduce((s, i) => s + i.amount, 0)
        return { ...group, total, count: items.length }
    }).filter(g => g.count > 0)

    // Per-bank summary
    const perBankData = bankAccounts.map((bank) => {
        const bankItems = allPlanItems.filter(i => i.glAccountCode === bank.code)
        const inAmt = bankItems.filter(i => i.direction === "IN").reduce((s, i) => s + i.amount, 0)
        const outAmt = bankItems.filter(i => i.direction === "OUT").reduce((s, i) => s + i.amount, 0)
        return { code: bank.code, name: bank.name, totalIn: inAmt, totalOut: outAmt, net: inAmt - outAmt, count: bankItems.length }
    }).filter(b => b.count > 0)

    // Cash runway calculation
    const weeklyBurn = data.summary.totalOut / 4
    const runwayWeeks = weeklyBurn > 0 ? Math.floor(data.effectiveStartingBalance / weeklyBurn) : 99
    const runwayLabel = runwayWeeks >= 12
        ? "Aman > 3 bulan"
        : runwayWeeks >= 4
            ? `Cukup ~${runwayWeeks} minggu`
            : runwayWeeks >= 1
                ? `Kritis! Sisa ${runwayWeeks} minggu`
                : "Darurat! Saldo tidak cukup"
    const runwayColor = runwayWeeks >= 8 ? "text-emerald-600" : runwayWeeks >= 4 ? "text-amber-600" : "text-red-600"
    const runwayBarPct = Math.min(100, Math.max(5, (runwayWeeks / 12) * 100))
    const runwayBarColor = runwayWeeks >= 8 ? "bg-emerald-500" : runwayWeeks >= 4 ? "bg-amber-500" : "bg-red-500"

    return (
        <div className="space-y-6">
            {/* ═══ SECTION 1: TOP STRIP ═══════════════════════════════════ */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900">
                {/* Orange accent bar */}
                <div className="h-1 bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500" />

                {/* Header row */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-orange-500 flex items-center justify-center">
                            <IconWallet size={20} stroke={2} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-base font-black uppercase tracking-wider text-zinc-900 dark:text-white">
                                Perencanaan Arus Kas
                            </h1>
                            <p className="text-zinc-400 text-[11px] font-medium">
                                {MONTH_NAMES[month]} {year} — Cashflow Planning
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-0 flex-wrap">
                        {/* Month navigator — joined */}
                        <Button variant="outline" size="sm" onClick={handlePrevMonth} className="border border-zinc-300 dark:border-zinc-700 border-r-0 text-zinc-500 h-9 px-3 rounded-none hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                            <IconChevronLeft size={16} />
                        </Button>
                        <span className="border border-zinc-300 dark:border-zinc-700 border-r-0 h-9 px-5 flex items-center font-black text-xs uppercase tracking-wider min-w-[160px] justify-center bg-white dark:bg-zinc-900">
                            {MONTH_NAMES[month]} {year}
                        </span>
                        <Button variant="outline" size="sm" onClick={handleNextMonth} className="border border-zinc-300 dark:border-zinc-700 border-r-0 text-zinc-500 h-9 px-3 rounded-none hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                            <IconChevronRight size={16} />
                        </Button>

                        {/* View mode toggle — joined */}
                        <button
                            onClick={() => setViewMode("planning")}
                            className={`h-9 px-3.5 text-[10px] font-bold uppercase tracking-wider border border-zinc-300 dark:border-zinc-700 border-r-0 rounded-none transition-colors ${
                                viewMode === "planning" ? "bg-black text-white border-black" : "bg-white dark:bg-zinc-900 text-zinc-400 hover:bg-zinc-50"
                            }`}
                        >
                            Planning
                        </button>
                        <button
                            onClick={() => setViewMode("riil")}
                            className={`h-9 px-3.5 text-[10px] font-bold uppercase tracking-wider border border-zinc-300 dark:border-zinc-700 rounded-none transition-colors ${
                                viewMode === "riil" ? "bg-black text-white border-black" : "bg-white dark:bg-zinc-900 text-zinc-400 hover:bg-zinc-50"
                            }`}
                        >
                            Riil
                        </button>

                        <Button
                            variant="outline" size="sm" onClick={handleSaveSnapshot} disabled={savingSnapshot}
                            className="border border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 text-[10px] font-bold uppercase tracking-wider h-9 px-3.5 rounded-none hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-700 transition-colors ml-2"
                        >
                            <IconCamera size={14} className="mr-1.5" /> {savingSnapshot ? "..." : "Snapshot"}
                        </Button>

                        <Button
                            onClick={() => { setEditItem(null); setItemDialogOpen(true) }}
                            className="bg-orange-500 text-white border border-orange-600 hover:bg-orange-600 font-bold uppercase text-[10px] tracking-wider px-4 h-9 rounded-none transition-colors ml-2"
                        >
                            <IconPlus size={14} className="mr-1.5" /> Tambah
                        </Button>
                    </div>
                </div>

                {/* Cash position + runway + bank pills */}
                <div className="flex flex-col lg:flex-row gap-0 divide-y lg:divide-y-0 lg:divide-x divide-zinc-200 dark:divide-zinc-800">
                    {/* Total Cash Position */}
                    <div
                        className="p-5 flex-shrink-0 lg:w-[320px] overflow-hidden cursor-pointer hover:bg-zinc-50 transition-colors"
                        onClick={() => { setOverrideAmount(String(data.effectiveStartingBalance)); setOverrideDialogOpen(true) }}
                    >
                        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-zinc-500 mb-1">
                            <IconWallet size={16} />
                            Posisi Kas
                            {data.startingBalanceOverride !== null && (
                                <Badge variant="outline" className="text-[10px] font-bold border-amber-400 text-amber-600 px-1.5 py-0 ml-1">Override</Badge>
                            )}
                        </div>
                        <div className="min-w-0 overflow-hidden">
                            <div className="text-2xl font-black tabular-nums truncate">
                                {formatCurrency(data.effectiveStartingBalance)}
                            </div>
                        </div>
                        <div className="text-xs text-zinc-400 mt-0.5">Saldo awal {MONTH_NAMES[month]}</div>
                    </div>

                    {/* Cash Runway */}
                    <div className="p-5 flex-shrink-0 lg:w-[240px]">
                        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-zinc-500 mb-1">
                            <IconGauge size={16} />
                            Cash Runway
                        </div>
                        <div className={`text-lg font-black ${runwayColor}`}>
                            {runwayLabel}
                        </div>
                        <div className="mt-2 h-2 bg-zinc-100 border border-zinc-200 overflow-hidden w-full">
                            <div className={`h-full ${runwayBarColor} transition-all`} style={{ width: `${runwayBarPct}%` }} />
                        </div>
                    </div>

                    {/* Bank Account Pills */}
                    <div className="p-5 flex-1">
                        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-zinc-500 mb-2">
                            <IconBuildingBank size={16} />
                            Rekening
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => setBankFilter("all")}
                                className={`px-3 py-1.5 text-xs font-bold border-2 transition-all ${
                                    bankFilter === "all"
                                        ? "border-black bg-black text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                                        : "border-zinc-300 bg-white text-zinc-500 hover:border-black"
                                }`}
                            >
                                Semua
                            </button>
                            {perBankData.map(bank => (
                                <button
                                    key={bank.code}
                                    onClick={() => setBankFilter(bankFilter === bank.code ? "all" : bank.code)}
                                    className={`px-3 py-1.5 text-xs font-bold border-2 transition-all ${
                                        bankFilter === bank.code
                                            ? "border-black bg-black text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                                            : "border-zinc-300 bg-white text-zinc-600 hover:border-black"
                                    }`}
                                >
                                    {bank.name.replace(/^(Bank|Rek\.?|Rekening)\s+/i, "")}
                                    <span className={`ml-1.5 ${bank.net >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                                        {bank.net >= 0 ? "+" : ""}{formatCompact(bank.net)}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══ SECTION 1.5: OBLIGATIONS SUMMARY ═════════════════════ */}
            {obligationData.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                    {obligationData.map(group => {
                        const isActive = categoryFilter === group.key
                        return (
                            <button
                                key={group.key}
                                onClick={() => setCategoryFilter(isActive ? null : group.key)}
                                className={`border-2 border-black border-l-4 ${group.color} p-4 text-left transition-all shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] ${
                                    isActive
                                        ? "ring-2 ring-black ring-offset-2 scale-[1.02]"
                                        : "hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px]"
                                }`}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span className={`text-xs font-black uppercase tracking-wider ${group.textColor}`}>
                                        {group.label}
                                    </span>
                                    <span className="text-lg leading-none">{group.icon}</span>
                                </div>
                                <div className={`text-xl font-black tabular-nums ${group.amountColor}`}>
                                    {formatCompact(group.total)}
                                </div>
                                <div className="flex items-center justify-between mt-1">
                                    <span className="text-[11px] text-zinc-500">{group.sublabel}</span>
                                    <span className="text-[11px] font-bold text-zinc-400">{group.count} item</span>
                                </div>
                                {isActive && (
                                    <div className="mt-2 text-[10px] font-black uppercase tracking-wider text-black bg-white border border-black px-2 py-0.5 text-center">
                                        Filter Aktif — klik untuk reset
                                    </div>
                                )}
                            </button>
                        )
                    })}
                </div>
            )}

            {/* Category filter indicator */}
            {categoryFilter && (
                <div className="flex items-center gap-2 px-1">
                    <span className="text-xs font-bold text-zinc-500">
                        Menampilkan: <span className="text-black">{obligationData.find(g => g.key === categoryFilter)?.label ?? categoryFilter}</span>
                    </span>
                    <button
                        onClick={() => setCategoryFilter(null)}
                        className="text-xs font-black text-red-600 hover:underline"
                    >
                        Reset Filter
                    </button>
                </div>
            )}

            {/* ═══ SECTION 2: WEEKLY SWIM-LANE BOARD ═════════════════════ */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {weeks.map((week, weekIdx) => {
                    const weekItems = getItemsForWeek(filteredItems, week.start, week.end)
                    const { totalIn, totalOut, net, inItems, outItems } = calcWeekTotals(weekItems)

                    // Running balance up to this week
                    let runningBal = data.effectiveStartingBalance
                    for (let w = 0; w <= weekIdx; w++) {
                        const wItems = getItemsForWeek(filteredItems, weeks[w].start, weeks[w].end)
                        const wTotals = calcWeekTotals(wItems)
                        runningBal += wTotals.net
                    }

                    return (
                        <div
                            key={week.label}
                            className={`border-2 border-black bg-white dark:bg-zinc-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col transition-all duration-200 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-x-[1px] hover:-translate-y-[1px] ${
                                week.isCurrent ? "ring-2 ring-emerald-400 ring-offset-2" : ""
                            }`}
                        >
                            {/* Top accent bar */}
                            <div className={`h-[3px] ${week.isCurrent ? "bg-emerald-400" : "bg-zinc-300 dark:bg-zinc-600"}`} />

                            {/* Week header */}
                            <div className={`px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between ${
                                week.isCurrent ? "bg-emerald-50 dark:bg-emerald-950/20" : ""
                            }`}>
                                <div className="flex items-center gap-2.5">
                                    <div className={`w-7 h-7 flex items-center justify-center text-xs font-black ${
                                        week.isCurrent
                                            ? "bg-emerald-500 text-white"
                                            : "bg-zinc-900 dark:bg-white text-white dark:text-black"
                                    }`}>
                                        {weekIdx + 1}
                                    </div>
                                    <div>
                                        <div className={`text-sm font-black uppercase tracking-wider ${week.isCurrent ? "text-emerald-700 dark:text-emerald-400" : "text-zinc-800 dark:text-zinc-200"}`}>
                                            {week.shortLabel}
                                        </div>
                                        <div className={`text-[11px] font-medium ${week.isCurrent ? "text-emerald-600 dark:text-emerald-500" : "text-zinc-400"}`}>
                                            {week.start}–{week.end} {MONTH_NAMES[month]}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {week.isCurrent && (
                                        <span className="text-[9px] font-black bg-emerald-500 text-white px-2 py-0.5 uppercase tracking-widest">
                                            Minggu Ini
                                        </span>
                                    )}
                                    {weekItems.length > 0 && (
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 border ${
                                            week.isCurrent
                                                ? "border-emerald-300 dark:border-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                                                : "border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                                        }`}>
                                            {weekItems.length}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Kas Masuk / Keluar zones */}
                            <div className="flex-1 min-h-[120px]">
                                {inItems.length > 0 && (
                                    <div className="p-3 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-4 h-[2px] bg-emerald-500" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                                                Kas Masuk
                                            </span>
                                            <span className="text-[10px] font-bold text-emerald-500 ml-auto tabular-nums">
                                                +{formatCompact(totalIn)}
                                            </span>
                                        </div>
                                        {inItems.slice(0, 5).map(item => (
                                            <SwimLaneCard
                                                key={item.id}
                                                item={item}
                                                viewMode={viewMode}
                                                onEdit={item.isManual ? () => { setEditItem(item); setItemDialogOpen(true) } : undefined}
                                            />
                                        ))}
                                        {inItems.length > 5 && (
                                            <div className="text-[10px] text-zinc-400 font-bold pl-6 border-l-2 border-zinc-200 dark:border-zinc-700 ml-0.5">
                                                +{inItems.length - 5} lagi
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Diamond divider */}
                                {inItems.length > 0 && outItems.length > 0 && (
                                    <div className="mx-3 flex items-center gap-2 py-1">
                                        <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700" />
                                        <div className="w-1.5 h-1.5 bg-zinc-300 dark:bg-zinc-600 rotate-45" />
                                        <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700" />
                                    </div>
                                )}

                                {/* Kas Keluar zone */}
                                {outItems.length > 0 && (
                                    <div className="p-3 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-4 h-[2px] bg-red-500" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-red-600 dark:text-red-400">
                                                Kas Keluar
                                            </span>
                                            <span className="text-[10px] font-bold text-red-500 ml-auto tabular-nums">
                                                -{formatCompact(totalOut)}
                                            </span>
                                        </div>
                                        {outItems.slice(0, 5).map(item => (
                                            <SwimLaneCard
                                                key={item.id}
                                                item={item}
                                                viewMode={viewMode}
                                                onEdit={item.isManual ? () => { setEditItem(item); setItemDialogOpen(true) } : undefined}
                                            />
                                        ))}
                                        {outItems.length > 5 && (
                                            <div className="text-[10px] text-zinc-400 font-bold pl-6 border-l-2 border-zinc-200 dark:border-zinc-700 ml-0.5">
                                                +{outItems.length - 5} lagi
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Empty state — diagonal stripes */}
                                {weekItems.length === 0 && (
                                    <div className="flex items-center justify-center h-full p-6 relative">
                                        <div
                                            className="absolute inset-0 opacity-[0.025] dark:opacity-[0.04]"
                                            style={{ backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 10px, currentColor 10px, currentColor 11px)" }}
                                        />
                                        <div className="text-center relative">
                                            <div className="w-8 h-8 mx-auto mb-2 border-2 border-zinc-200 dark:border-zinc-700 flex items-center justify-center">
                                                <IconScale size={14} className="text-zinc-300 dark:text-zinc-600" />
                                            </div>
                                            <div className="text-zinc-400 text-[11px] font-bold">Belum ada item</div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Week footer — totals + running balance */}
                            <div className="border-t-2 border-black bg-zinc-50 dark:bg-zinc-800/50 p-3 space-y-2.5">
                                {/* Three-column totals */}
                                <div className="grid grid-cols-3 gap-1">
                                    <div className="text-center">
                                        <div className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-0.5">Masuk</div>
                                        <div className="text-sm font-black text-emerald-600 tabular-nums">+{formatCompact(totalIn)}</div>
                                    </div>
                                    <div className="text-center border-x border-zinc-200 dark:border-zinc-700">
                                        <div className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-0.5">Keluar</div>
                                        <div className="text-sm font-black text-red-600 tabular-nums">-{formatCompact(totalOut)}</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-0.5">Net</div>
                                        <div className={`text-sm font-black tabular-nums ${net >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                                            {net >= 0 ? "+" : ""}{formatCompact(net)}
                                        </div>
                                    </div>
                                </div>
                                {/* Saldo row */}
                                <div className="flex items-center justify-between pt-2 border-t border-zinc-200 dark:border-zinc-700">
                                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Saldo</span>
                                    <span className={`text-base font-black tabular-nums ${runningBal < 0 ? "text-red-600" : "text-zinc-900 dark:text-white"}`}>
                                        {formatCurrency(runningBal)}
                                    </span>
                                </div>
                                {/* Balance bar */}
                                <div className="h-2 bg-zinc-200 dark:bg-zinc-700 overflow-hidden border border-zinc-300 dark:border-zinc-600">
                                    <div
                                        className={`h-full transition-all duration-500 ${runningBal < 0 ? "bg-red-500" : runningBal < data.effectiveStartingBalance * 0.3 ? "bg-amber-500" : "bg-emerald-500"}`}
                                        style={{ width: `${Math.min(100, Math.max(3, (runningBal / Math.max(data.effectiveStartingBalance, 1)) * 100))}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* ═══ UNIFIED SUMMARY & INSIGHTS CARD ════════════════════ */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900">
                {/* Orange accent bar */}
                <div className="h-1 bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500" />

                {/* Row 1: KPI Summary Strip */}
                <div className="flex items-center divide-x divide-zinc-200 dark:divide-zinc-800 border-b border-zinc-200 dark:border-zinc-800">
                    {[
                        { label: "Saldo Awal", value: data.effectiveStartingBalance, color: "" },
                        { label: "Total Masuk", value: data.summary.totalIn, color: "text-emerald-600", prefix: "+" },
                        { label: "Total Keluar", value: data.summary.totalOut, color: "text-red-600", prefix: "-" },
                        { label: "Net", value: data.summary.netFlow, color: data.summary.netFlow >= 0 ? "text-emerald-600" : "text-red-600", prefix: data.summary.netFlow >= 0 ? "+" : "" },
                        { label: "Saldo Akhir", value: data.summary.estimatedEndBalance, color: data.summary.estimatedEndBalance < 0 ? "text-red-600" : "text-emerald-700", highlight: data.summary.estimatedEndBalance < 0 },
                    ].map((cell) => (
                        <div key={cell.label} className="flex-1 px-4 py-3 flex items-center justify-between gap-2 cursor-default">
                            <div className="flex items-center gap-1.5">
                                <span className={`w-2 h-2 ${
                                    cell.label === "Saldo Awal" ? "bg-zinc-400" :
                                    cell.label === "Total Masuk" ? "bg-emerald-500" :
                                    cell.label === "Total Keluar" ? "bg-red-500" :
                                    cell.label === "Net" ? (data.summary.netFlow >= 0 ? "bg-emerald-500" : "bg-red-500") :
                                    "bg-orange-500"
                                }`} />
                                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{cell.label}</span>
                            </div>
                            <span className={`text-lg font-black tabular-nums ${cell.color || "text-zinc-900 dark:text-white"}`}>
                                {cell.prefix || ""}{formatCurrency(cell.value)}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Row 2: Last Month + Snapshot in one row */}
                {(data.lastMonthSummary || data.snapshot) && (
                    <div className="flex items-stretch divide-x divide-zinc-200 dark:divide-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/30">
                        {data.lastMonthSummary && (
                            <div className="flex-1 px-5 py-2.5 flex items-center gap-4">
                                <IconHistory size={16} className="text-blue-500 flex-shrink-0" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Bulan Lalu</span>
                                <div className="flex items-center gap-3 ml-auto text-xs font-bold">
                                    <span className="text-emerald-600">+{formatCompact(data.lastMonthSummary.totalIn)}</span>
                                    <span className="text-red-600">-{formatCompact(data.lastMonthSummary.totalOut)}</span>
                                    <span className={data.lastMonthSummary.netFlow >= 0 ? "text-emerald-700" : "text-red-700"}>
                                        Net {data.lastMonthSummary.netFlow >= 0 ? "+" : ""}{formatCompact(data.lastMonthSummary.netFlow)}
                                    </span>
                                    <span className="text-zinc-400">{data.lastMonthSummary.itemCount} tx</span>
                                </div>
                            </div>
                        )}
                        {data.snapshot && (
                            <div className="flex-1 px-5 py-2.5 flex items-center gap-4">
                                <IconCamera size={16} className="text-amber-500 flex-shrink-0" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Snapshot</span>
                                <div className="flex items-center gap-3 ml-auto text-xs font-bold">
                                    <span className="text-zinc-600">{new Date(data.snapshot.snapshotDate).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}</span>
                                    <span className="text-emerald-600">+{formatCompact(data.snapshot.totalPlannedIn)}</span>
                                    <span className="text-red-600">-{formatCompact(data.snapshot.totalPlannedOut)}</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ═══ UPCOMING OBLIGATIONS ═══════════════════════════════════ */}
            <UpcomingObligationsSection upcoming={upcoming} />

            {/* ═══ ACCURACY + FORECAST UNIFIED CARD ═══════════════════════ */}
            {(data.snapshot || (forecast && (forecast.months ?? []).length > 0)) && (
                <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900">
                    {/* Orange accent bar */}
                    <div className="h-1 bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500" />

                    {/* Header with tab navigation */}
                    <div className="bg-zinc-900 dark:bg-zinc-950 px-5 py-0 flex items-stretch justify-between">
                        <div className="flex items-stretch gap-0">
                            {data.snapshot && (
                                <button
                                    onClick={() => setShowAccuracy(!showAccuracy)}
                                    className={`relative text-[10px] font-black uppercase tracking-widest px-4 py-3 transition-all flex items-center gap-1.5 ${
                                        showAccuracy
                                            ? "text-white"
                                            : "text-zinc-500 hover:text-zinc-300"
                                    }`}
                                >
                                    <IconScale size={14} />
                                    Akurasi
                                    {(() => {
                                        const plannedNet = data.snapshot!.totalPlannedIn - data.snapshot!.totalPlannedOut
                                        const aIn = actualItems.filter(i => i.direction === "IN").reduce((s, i) => s + i.amount, 0)
                                        const aOut = actualItems.filter(i => i.direction === "OUT").reduce((s, i) => s + i.amount, 0)
                                        const pct = plannedNet !== 0 ? ((aIn - aOut - plannedNet) / plannedNet) * 100 : null
                                        const acc = pct !== null ? Math.max(0, 100 - Math.abs(pct)) : null
                                        if (acc === null) return null
                                        return (
                                            <span className={`ml-0.5 text-[10px] font-black px-1.5 py-0.5 ${
                                                acc >= 80 ? "bg-emerald-500/20 text-emerald-400" : acc >= 60 ? "bg-amber-500/20 text-amber-400" : "bg-red-500/20 text-red-400"
                                            }`}>
                                                {acc.toFixed(0)}%
                                            </span>
                                        )
                                    })()}
                                    {/* Active indicator bar */}
                                    {showAccuracy && <div className="absolute bottom-0 left-2 right-2 h-[3px] bg-orange-500" />}
                                </button>
                            )}
                            {forecast && (forecast.months ?? []).length > 0 && (
                                <button
                                    onClick={() => setShowAccuracy(false)}
                                    className={`relative text-[10px] font-black uppercase tracking-widest px-4 py-3 transition-all flex items-center gap-1.5 ${
                                        !showAccuracy
                                            ? "text-white"
                                            : "text-zinc-500 hover:text-zinc-300"
                                    }`}
                                >
                                    <IconCalendarWeek size={14} />
                                    Proyeksi 6 Bulan
                                    {/* Active indicator bar */}
                                    {!showAccuracy && <div className="absolute bottom-0 left-2 right-2 h-[3px] bg-orange-500" />}
                                </button>
                            )}
                        </div>
                        {/* Month range label */}
                        {!showAccuracy && forecast && (forecast.months ?? []).length > 0 && (
                            <div className="flex items-center text-[10px] font-bold text-zinc-500 tracking-wider">
                                {(forecast.months ?? [])[0]?.label} — {(forecast.months ?? [])[(forecast.months ?? []).length - 1]?.label}
                            </div>
                        )}
                    </div>

                    {/* Accuracy content */}
                    {showAccuracy && data.snapshot && (
                        <AccuracySection
                            snapshot={data.snapshot}
                            actualItems={actualItems}
                            accuracyTrend={accuracyTrend}
                        />
                    )}

                    {/* Forecast content */}
                    {!showAccuracy && forecast && (forecast.months ?? []).length > 0 && (() => {
                        const maxAmount = Math.max(
                            ...(forecast.months ?? []).map(m => Math.max(m.totalIn, m.totalOut, Math.abs(m.runningBalance))),
                            1
                        )
                        return (
                            <div className="overflow-x-auto">
                                {/* Column headers */}
                                <div className="hidden md:grid grid-cols-[1.2fr_1fr_1fr_1fr_1.2fr] gap-0 px-5 py-2.5 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700">
                                    {[
                                        { h: "Bulan", dot: "bg-zinc-400" },
                                        { h: "Kas Masuk", dot: "bg-emerald-500" },
                                        { h: "Kas Keluar", dot: "bg-red-500" },
                                        { h: "Net", dot: "bg-orange-500" },
                                        { h: "Saldo", dot: "bg-zinc-900 dark:bg-white" },
                                    ].map(({ h, dot }) => (
                                        <div key={h} className="flex items-center gap-1.5">
                                            <span className={`w-1.5 h-1.5 ${dot}`} />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{h}</span>
                                        </div>
                                    ))}
                                </div>
                                {/* Data rows */}
                                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                    {(forecast.months ?? []).map((m, idx) => {
                                        const isFirst = idx === 0
                                        const barInPct = maxAmount > 0 ? (m.totalIn / maxAmount) * 100 : 0
                                        const barOutPct = maxAmount > 0 ? (m.totalOut / maxAmount) * 100 : 0
                                        return (
                                            <div
                                                key={`${m.month}-${m.year}`}
                                                className={`group grid grid-cols-[1.2fr_1fr_1fr_1fr_1.2fr] gap-0 px-5 py-0 items-stretch transition-all ${
                                                    isFirst
                                                        ? "bg-orange-50/40 dark:bg-orange-950/10 border-l-[3px] border-l-orange-400"
                                                        : idx % 2 === 0
                                                            ? "bg-white dark:bg-zinc-900 border-l-[3px] border-l-transparent"
                                                            : "bg-zinc-50/60 dark:bg-zinc-800/20 border-l-[3px] border-l-transparent"
                                                } hover:bg-orange-50/60 dark:hover:bg-orange-950/15 hover:border-l-orange-300`}
                                            >
                                                {/* Month */}
                                                <div className="py-3.5 flex items-center gap-2">
                                                    <span className={`text-sm font-black ${isFirst ? "text-orange-700 dark:text-orange-400" : "text-zinc-700 dark:text-zinc-300"}`}>
                                                        {m.label}
                                                    </span>
                                                    {isFirst && (
                                                        <span className="text-[9px] font-black bg-orange-500 text-white px-1.5 py-0.5 uppercase tracking-widest">
                                                            Now
                                                        </span>
                                                    )}
                                                </div>
                                                {/* Kas Masuk — with mini bar */}
                                                <div className="py-3.5 flex flex-col justify-center gap-1">
                                                    <span className="font-mono text-sm font-bold text-emerald-600 tabular-nums">{formatCurrency(m.totalIn)}</span>
                                                    <div className="h-1 bg-zinc-100 dark:bg-zinc-800 overflow-hidden w-full max-w-[120px]">
                                                        <div className="h-full bg-emerald-400 transition-all duration-500" style={{ width: `${Math.max(2, barInPct)}%` }} />
                                                    </div>
                                                </div>
                                                {/* Kas Keluar — with mini bar */}
                                                <div className="py-3.5 flex flex-col justify-center gap-1">
                                                    <span className="font-mono text-sm font-bold text-red-600 tabular-nums">{formatCurrency(m.totalOut)}</span>
                                                    <div className="h-1 bg-zinc-100 dark:bg-zinc-800 overflow-hidden w-full max-w-[120px]">
                                                        <div className="h-full bg-red-400 transition-all duration-500" style={{ width: `${Math.max(2, barOutPct)}%` }} />
                                                    </div>
                                                </div>
                                                {/* Net */}
                                                <div className="py-3.5 flex items-center">
                                                    <span className={`font-mono text-sm font-black tabular-nums ${m.netFlow >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                                                        {m.netFlow >= 0 ? "+" : ""}{formatCurrency(m.netFlow)}
                                                    </span>
                                                </div>
                                                {/* Saldo — emphasized */}
                                                <div className="py-3.5 flex items-center justify-between">
                                                    <span className={`font-mono text-sm font-black tabular-nums ${
                                                        m.runningBalance < 0 ? "text-red-600" : "text-zinc-900 dark:text-white"
                                                    }`}>
                                                        {formatCurrency(m.runningBalance)}
                                                    </span>
                                                    {m.runningBalance < 0 && (
                                                        <span className="text-[9px] font-black bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 px-1 py-0.5">
                                                            DEFISIT
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })()}
                </div>
            )}

            {/* ═══ DIALOGS ═══════════════════════════════════════════════ */}
            <CreateCashflowItemDialog
                open={itemDialogOpen}
                onOpenChange={setItemDialogOpen}
                editItem={editItem}
                glAccounts={glAccounts}
                month={month}
                year={year}
            />

            <Dialog open={overrideDialogOpen} onOpenChange={setOverrideDialogOpen}>
                <DialogContent className={NB.contentNarrow}>
                    <DialogHeader className={NB.header}>
                        <DialogTitle className={NB.title}>
                            <IconEdit size={18} /> Override Saldo Awal
                        </DialogTitle>
                        <p className={NB.subtitle}>Ubah saldo awal bulan ini secara manual</p>
                    </DialogHeader>
                    <div className="p-6 space-y-4">
                        <div>
                            <label className={NB.label}>Saldo GL Saat Ini</label>
                            <div className="text-sm font-black text-zinc-600">{formatCurrency(data.startingBalance)}</div>
                        </div>
                        {data.startingBalanceOverride !== null && (
                            <div>
                                <label className={NB.label}>Override Aktif</label>
                                <div className="text-sm font-black text-amber-600">{formatCurrency(data.startingBalanceOverride)}</div>
                            </div>
                        )}
                        <div>
                            <label className={NB.label}>Jumlah Baru <span className={NB.labelRequired}>*</span></label>
                            <Input type="number" className={NB.input} placeholder="0" value={overrideAmount} onChange={e => setOverrideAmount(e.target.value)} />
                        </div>
                        <div className="flex gap-2 pt-2">
                            <Button onClick={handleSaveOverride} disabled={savingOverride}
                                className="flex-1 border-2 border-black font-black uppercase text-xs shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-emerald-400 hover:bg-emerald-500 text-black h-10">
                                {savingOverride ? "Menyimpan..." : "Simpan Override"}
                            </Button>
                            {data.startingBalanceOverride !== null && (
                                <Button variant="outline" onClick={handleResetOverride} disabled={savingOverride}
                                    className="border-2 border-black font-black uppercase text-xs shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] h-10">
                                    <IconRefresh size={14} className="mr-1" /> Reset ke GL
                                </Button>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}

// ─── Swim Lane Card ─────────────────────────────────────────────────────────

function SwimLaneCard({
    item,
    viewMode,
    onEdit,
}: {
    item: CashflowItem
    viewMode: "planning" | "riil"
    onEdit?: () => void
}) {
    const cat = CATEGORY_COLORS[item.category] ?? DEFAULT_CAT
    const label = CATEGORY_LABELS[item.category] ?? item.category
    const bank = shortBankName(item.glAccountName, item.glAccountCode)
    const isEstimate = viewMode === "planning" && !item.isManual
    const isClickable = !!onEdit
    const isIn = item.direction === "IN"

    return (
        <div
            className={`group/card border-l-4 ${cat.border} px-3 py-2.5 transition-all duration-200 ${
                isEstimate
                    ? `border border-dashed border-zinc-300 dark:border-zinc-600 bg-white/60 dark:bg-zinc-800/30`
                    : `border border-zinc-200 dark:border-zinc-700 ${cat.bg} dark:bg-zinc-800/40`
            } ${isClickable
                ? "cursor-pointer hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,0.1)] hover:-translate-x-[0.5px] hover:-translate-y-[0.5px] hover:border-zinc-400 dark:hover:border-zinc-500 active:translate-x-0 active:translate-y-0 active:shadow-none"
                : ""
            }`}
            onClick={onEdit}
            title={`${item.description}\n${formatCurrency(item.amount)}${item.glAccountName ? `\nRek: ${item.glAccountName}` : ""}`}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <div className={`text-sm font-black tabular-nums ${isIn ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                        {isIn ? "+" : "-"}{formatCompact(item.amount)}
                    </div>
                    <div className="text-xs text-zinc-600 dark:text-zinc-400 truncate mt-0.5" title={item.description}>
                        {item.description}
                    </div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className={`text-[10px] font-bold ${cat.text} uppercase tracking-wider`}>
                        {label}
                    </span>
                    {bank && (
                        <span className="text-[10px] font-medium text-zinc-400">
                            {bank}
                        </span>
                    )}
                </div>
            </div>
            {isClickable && (
                <div className="flex items-center gap-1 mt-1.5 text-[10px] text-zinc-300 dark:text-zinc-600 group-hover/card:text-zinc-500 dark:group-hover/card:text-zinc-400 transition-colors">
                    <IconPencil size={10} /> Edit
                </div>
            )}
        </div>
    )
}

// ─── Accuracy Section ───────────────────────────────────────────────────────

function AccuracySection({
    snapshot,
    actualItems,
    accuracyTrend,
}: {
    snapshot: { totalPlannedIn: number; totalPlannedOut: number; plannedEndBalance: number; snapshotDate: string }
    actualItems: CashflowItem[]
    accuracyTrend?: { month: number; year: number; label: string; accuracyScore: number | null }[]
}) {
    const actualIn = actualItems.filter(i => i.direction === "IN").reduce((s, i) => s + i.amount, 0)
    const actualOut = actualItems.filter(i => i.direction === "OUT").reduce((s, i) => s + i.amount, 0)

    function variancePct(actual: number, planned: number) {
        if (planned === 0) return null
        return ((actual - planned) / planned) * 100
    }

    function accuracyLabel(pct: number | null) {
        if (pct === null) return { label: "—", color: "text-zinc-400" }
        const abs = Math.abs(pct)
        if (abs <= 10) return { label: "Akurat", color: "bg-emerald-100 text-emerald-800 border-emerald-300" }
        if (abs <= 20) return { label: "Cukup", color: "bg-amber-100 text-amber-800 border-amber-300" }
        return { label: "Meleset", color: "bg-red-100 text-red-800 border-red-300" }
    }

    const plannedNet = snapshot.totalPlannedIn - snapshot.totalPlannedOut
    const actualNet = actualIn - actualOut
    const netPct = variancePct(actualNet, plannedNet)

    return (
        <div>
            <div className="overflow-x-auto">
                <div className="hidden md:grid grid-cols-[120px_1fr_1fr_1fr_100px_80px] gap-2 px-5 py-2.5 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700">
                    {["", "Pemasukan", "Pengeluaran", "Nett", "Varians", "Status"].map((h) => (
                        <span key={h || "empty"} className={`text-[10px] font-black uppercase tracking-widest ${h === "Pemasukan" ? "text-emerald-600" : h === "Pengeluaran" ? "text-red-600" : "text-zinc-400"}`}>{h}</span>
                    ))}
                </div>
                <table className="w-full text-sm">
                    <tbody>
                        <tr className="border-b border-zinc-200">
                            <td className="px-5 py-3 font-black">Rencana</td>
                            <td className="px-5 py-3 text-right font-bold">{formatCurrency(snapshot.totalPlannedIn)}</td>
                            <td className="px-5 py-3 text-right font-bold">{formatCurrency(snapshot.totalPlannedOut)}</td>
                            <td className="px-5 py-3 text-right font-black">{formatCurrency(plannedNet)}</td>
                            <td /><td />
                        </tr>
                        <tr className="border-b border-zinc-200">
                            <td className="px-5 py-3 font-black">Aktual</td>
                            <td className="px-5 py-3 text-right font-bold">{formatCurrency(actualIn)}</td>
                            <td className="px-5 py-3 text-right font-bold">{formatCurrency(actualOut)}</td>
                            <td className="px-5 py-3 text-right font-black">{formatCurrency(actualNet)}</td>
                            <td /><td />
                        </tr>
                        <tr className="border-t-2 border-black bg-zinc-50">
                            <td className="px-5 py-3 font-black">Selisih</td>
                            <td className={`px-5 py-3 text-right font-black ${actualIn - snapshot.totalPlannedIn >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                                {actualIn - snapshot.totalPlannedIn >= 0 ? "+" : ""}{formatCurrency(actualIn - snapshot.totalPlannedIn)}
                            </td>
                            <td className={`px-5 py-3 text-right font-black ${actualOut - snapshot.totalPlannedOut <= 0 ? "text-emerald-600" : "text-red-600"}`}>
                                {actualOut - snapshot.totalPlannedOut >= 0 ? "+" : ""}{formatCurrency(actualOut - snapshot.totalPlannedOut)}
                            </td>
                            <td className={`px-5 py-3 text-right font-black ${actualNet - plannedNet >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                                {actualNet - plannedNet >= 0 ? "+" : ""}{formatCurrency(actualNet - plannedNet)}
                            </td>
                            <td className="px-5 py-3 text-right font-black">
                                {netPct !== null ? (
                                    <span className={Math.abs(netPct) <= 10 ? "text-emerald-600" : Math.abs(netPct) <= 20 ? "text-amber-600" : "text-red-600"}>
                                        {netPct > 0 ? "+" : ""}{netPct.toFixed(1)}%
                                    </span>
                                ) : "—"}
                            </td>
                            <td className="px-5 py-3 text-center">
                                {(() => {
                                    const { label, color } = accuracyLabel(netPct)
                                    return <span className={`text-xs font-bold px-2 py-0.5 border ${color}`}>{label}</span>
                                })()}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Accuracy trend */}
            {accuracyTrend && accuracyTrend.length > 0 && (
                <div className="border-t-2 border-black px-5 py-4">
                    <div className="text-xs font-black uppercase tracking-wider text-zinc-500 mb-3">
                        Tren Akurasi 3 Bulan Terakhir
                    </div>
                    <div className="flex items-end gap-4">
                        {accuracyTrend.map(m => {
                            const score = m.accuracyScore
                            const color = score === null ? "bg-zinc-200" : score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-amber-500" : "bg-red-500"
                            return (
                                <div key={`${m.month}-${m.year}`} className="flex flex-col items-center gap-1.5">
                                    <div className={`w-10 ${color} border border-black`} style={{ height: score !== null ? `${Math.max(10, score * 0.5)}px` : "10px" }} />
                                    <span className="text-xs font-bold text-zinc-500">{m.label}</span>
                                    <span className="text-xs font-black">{score !== null ? `${score}%` : "—"}</span>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}

// ─── Upcoming Obligations Section ───────────────────────────────────────────

const SOURCE_TYPE_LABELS: Record<string, string> = {
    AR: "Piutang",
    AP: "Hutang",
    PO: "Purchase Order",
    PAYROLL: "Gaji",
    BPJS: "BPJS",
    LOAN: "Cicilan",
    MANUAL: "Manual",
}

const SOURCE_TYPE_COLORS: Record<string, string> = {
    AR: "bg-emerald-100 text-emerald-800 border-emerald-300",
    AP: "bg-red-100 text-red-800 border-red-300",
    PO: "bg-indigo-100 text-indigo-800 border-indigo-300",
    PAYROLL: "bg-orange-100 text-orange-800 border-orange-300",
    BPJS: "bg-amber-100 text-amber-800 border-amber-300",
    LOAN: "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300",
    MANUAL: "bg-zinc-100 text-zinc-800 border-zinc-300",
}

function groupByWeek(items: UpcomingObligationItem[]): { weekLabel: string; weekStart: string; items: UpcomingObligationItem[]; totalIn: number; totalOut: number }[] {
    const groups = new Map<string, { weekLabel: string; weekStart: string; items: UpcomingObligationItem[] }>()

    for (const item of items) {
        const d = new Date(item.date)
        // Get Monday of that week
        const day = d.getDay()
        const diff = d.getDate() - day + (day === 0 ? -6 : 1)
        const monday = new Date(d)
        monday.setDate(diff)
        const key = monday.toISOString().split("T")[0]

        const endOfWeek = new Date(monday)
        endOfWeek.setDate(endOfWeek.getDate() + 6)

        const weekLabel = `${monday.getDate()} ${MONTH_NAMES_SHORT[monday.getMonth()]} — ${endOfWeek.getDate()} ${MONTH_NAMES_SHORT[endOfWeek.getMonth()]} ${endOfWeek.getFullYear()}`

        if (!groups.has(key)) {
            groups.set(key, { weekLabel, weekStart: key, items: [] })
        }
        groups.get(key)!.items.push(item)
    }

    return Array.from(groups.values())
        .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
        .map(g => ({
            ...g,
            totalIn: g.items.filter(i => i.direction === "IN").reduce((s, i) => s + i.amount, 0),
            totalOut: g.items.filter(i => i.direction === "OUT").reduce((s, i) => s + i.amount, 0),
        }))
}

const MONTH_NAMES_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]

function UpcomingObligationsSection({ upcoming }: { upcoming?: UpcomingObligationsData }) {
    const items = upcoming?.items ?? []
    const weekGroups = groupByWeek(items)
    const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set())
    const didInit = useRef(false)

    // Auto-expand first 2 weeks on initial data load
    useEffect(() => {
        if (!didInit.current && weekGroups.length > 0) {
            setExpandedWeeks(new Set(weekGroups.slice(0, 2).map(g => g.weekStart)))
            didInit.current = true
        }
    }, [weekGroups])

    function toggleWeek(weekStart: string) {
        setExpandedWeeks(prev => {
            const next = new Set(prev)
            if (next.has(weekStart)) next.delete(weekStart)
            else next.add(weekStart)
            return next
        })
    }

    function isExpanded(weekStart: string) {
        return expandedWeeks.has(weekStart)
    }

    return (
        <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900">
            {/* Orange accent bar */}
            <div className="h-1 bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500" />

            {/* Header row */}
            <div className="px-5 py-3 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-orange-500 flex items-center justify-center">
                        <IconCalendarWeek size={16} className="text-white" />
                    </div>
                    <div>
                        <span className="text-sm font-black uppercase tracking-wider text-zinc-900 dark:text-white">
                            Kewajiban Mendatang
                        </span>
                        <p className="text-zinc-400 text-[10px] font-medium">{upcoming?.periodLabel ?? "90 hari ke depan"} — {upcoming?.summary.itemCount ?? 0} item</p>
                    </div>
                </div>
            </div>

            {/* KPI strip */}
            <div className="flex items-center divide-x divide-zinc-200 dark:divide-zinc-800 border-b border-zinc-200 dark:border-zinc-800">
                {[
                    { label: "Akan Diterima", value: upcoming?.summary.totalIn ?? 0, color: "text-emerald-600", dot: "bg-emerald-500", prefix: "+" },
                    { label: "Harus Dibayar", value: upcoming?.summary.totalOut ?? 0, color: "text-red-600", dot: "bg-red-500", prefix: "-" },
                    { label: "Net", value: upcoming?.summary.net ?? 0, color: (upcoming?.summary.net ?? 0) >= 0 ? "text-emerald-600" : "text-red-600", dot: (upcoming?.summary.net ?? 0) >= 0 ? "bg-emerald-500" : "bg-red-500", prefix: (upcoming?.summary.net ?? 0) >= 0 ? "+" : "" },
                ].map(kpi => (
                    <div key={kpi.label} className="flex-1 px-4 py-3 flex items-center justify-between gap-2 cursor-default">
                        <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 ${kpi.dot}`} />
                            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{kpi.label}</span>
                        </div>
                        <span className={`text-lg font-black tabular-nums ${kpi.color}`}>
                            {kpi.prefix}{formatCurrency(kpi.value)}
                        </span>
                    </div>
                ))}
            </div>

            {/* Weekly grouped items */}
            <div>
                {weekGroups.length === 0 && (
                    <div className="px-5 py-10 text-center">
                        <div className="text-zinc-300 font-black uppercase text-base tracking-wider">Belum ada kewajiban mendatang</div>
                        <div className="text-zinc-400 text-sm mt-2 max-w-md mx-auto">
                            Data akan muncul otomatis ketika ada Invoice (AR/AP), Purchase Order, data karyawan aktif (gaji & BPJS), atau cicilan pinjaman dalam 90 hari ke depan.
                        </div>
                    </div>
                )}
                {weekGroups.map(group => {
                    const expanded = isExpanded(group.weekStart)
                    const today = new Date().toISOString().split("T")[0]
                    const isCurrentWeek = group.items.some(i => {
                        const d = new Date(i.date)
                        const now = new Date()
                        const diffDays = Math.floor((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                        return diffDays >= -7 && diffDays <= 7
                    })

                    return (
                        <div key={group.weekStart} className="border-b border-zinc-200 last:border-b-0">
                            {/* Week header — clickable */}
                            <button
                                onClick={() => toggleWeek(group.weekStart)}
                                className={`w-full px-5 py-3 flex items-center justify-between text-left transition-all duration-200 group border-l-[3px] ${
                                    expanded
                                        ? "bg-orange-50/60 dark:bg-orange-950/10 border-l-orange-400"
                                        : isCurrentWeek
                                            ? "bg-emerald-50/50 hover:bg-emerald-50 border-l-emerald-400"
                                            : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50 border-l-transparent"
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-6 h-6 flex items-center justify-center transition-all duration-200 ${
                                        expanded
                                            ? "bg-orange-500 text-white"
                                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 group-hover:bg-zinc-200 dark:group-hover:bg-zinc-700"
                                    }`}>
                                        <IconChevronDown
                                            size={14}
                                            className={`transition-transform duration-300 ${expanded ? "" : "-rotate-90"}`}
                                        />
                                    </div>
                                    <span className="text-sm font-black">{group.weekLabel}</span>
                                    {isCurrentWeek && (
                                        <span className="text-[10px] font-black bg-emerald-500 text-white px-2 py-0.5 uppercase tracking-wider">
                                            Minggu Ini
                                        </span>
                                    )}
                                    <span className={`text-[10px] font-bold px-2 py-0.5 border transition-colors ${
                                        expanded ? "border-orange-300 bg-orange-100 text-orange-700 dark:border-orange-600 dark:bg-orange-900/30 dark:text-orange-400" : "border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-400"
                                    }`}>
                                        {group.items.length} item
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 text-sm font-bold">
                                    {group.totalIn > 0 && (
                                        <span className="text-emerald-600 flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                                            +{formatCompact(group.totalIn)}
                                        </span>
                                    )}
                                    {group.totalOut > 0 && (
                                        <span className="text-red-600 flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                                            -{formatCompact(group.totalOut)}
                                        </span>
                                    )}
                                    {(() => {
                                        const net = group.totalIn - group.totalOut
                                        return (
                                            <span className={`text-xs font-black px-1.5 py-0.5 border ${
                                                net >= 0
                                                    ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"
                                                    : "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400"
                                            }`}>
                                                {net >= 0 ? "+" : ""}{formatCompact(net)}
                                            </span>
                                        )
                                    })()}
                                </div>
                            </button>

                            {/* Expanded items — smooth CSS grid transition */}
                            <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                                <div className="overflow-hidden">
                                    <div className={`border-t border-zinc-100 transition-opacity duration-200 ${expanded ? "opacity-100" : "opacity-0"}`}>
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-zinc-50 dark:bg-zinc-800/50">
                                                    <th className="text-left px-5 py-2 text-[10px] font-black text-zinc-400 uppercase tracking-widest w-[90px]">Tanggal</th>
                                                    <th className="text-left px-3 py-2 text-[10px] font-black text-zinc-400 uppercase tracking-widest w-[90px]">Tipe</th>
                                                    <th className="text-left px-3 py-2 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Deskripsi</th>
                                                    <th className="text-right px-5 py-2 text-[10px] font-black text-zinc-400 uppercase tracking-widest w-[150px]">Jumlah</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {group.items.map((item, itemIdx) => {
                                                    const dateStr = item.date.split("-")
                                                    const displayDate = `${dateStr[2]}/${dateStr[1]}/${dateStr[0].slice(2)}`
                                                    const typeColor = SOURCE_TYPE_COLORS[item.sourceType] || SOURCE_TYPE_COLORS.MANUAL
                                                    const typeLabel = SOURCE_TYPE_LABELS[item.sourceType] || item.sourceType
                                                    const isPastDue = item.date < today

                                                    return (
                                                        <tr
                                                            key={item.id}
                                                            className={`border-b border-zinc-100 dark:border-zinc-800 transition-colors hover:bg-orange-50/40 dark:hover:bg-orange-950/10 ${
                                                                isPastDue ? "bg-red-50/40 dark:bg-red-950/10" : itemIdx % 2 === 1 ? "bg-zinc-50/40 dark:bg-zinc-800/20" : ""
                                                            }`}
                                                        >
                                                            <td className="px-5 py-2.5 font-bold text-zinc-500 dark:text-zinc-400 tabular-nums">
                                                                {displayDate}
                                                                {isPastDue && (
                                                                    <span className="text-[9px] text-red-500 font-black ml-1.5 bg-red-100 dark:bg-red-900/30 px-1 py-0.5 border border-red-200 dark:border-red-800">TELAT</span>
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-2">
                                                                <span className={`text-[10px] font-bold px-2 py-0.5 border ${typeColor}`}>
                                                                    {typeLabel}
                                                                </span>
                                                            </td>
                                                            <td className="px-3 py-2.5 max-w-[350px]">
                                                                {item.sourceUrl ? (
                                                                    <Link href={item.sourceUrl} className="hover:underline text-blue-700 dark:text-blue-400 font-medium truncate block" title={item.description}>
                                                                        {item.description}
                                                                    </Link>
                                                                ) : (
                                                                    <span className="truncate block text-zinc-700 dark:text-zinc-300" title={item.description}>{item.description}</span>
                                                                )}
                                                            </td>
                                                            <td className={`px-5 py-2.5 text-right font-black tabular-nums ${item.direction === "IN" ? "text-emerald-600" : "text-red-600"}`}>
                                                                {item.direction === "IN" ? "+" : "-"}{formatCurrency(item.amount)}
                                                            </td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
