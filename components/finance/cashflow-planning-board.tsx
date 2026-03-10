"use client"

import { useState, useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { formatCurrency } from "@/lib/utils"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { NB } from "@/lib/dialog-styles"
import {
    IconChevronLeft,
    IconChevronRight,
    IconPlus,
    IconCamera,
    IconWallet,
    IconArrowUpRight,
    IconArrowDownRight,
    IconCoin,
    IconScale,
    IconEdit,
    IconRefresh,
} from "@tabler/icons-react"
import { saveCashflowSnapshot, overrideStartingBalance } from "@/lib/actions/finance-cashflow"
import type { CashflowPlanData, CashflowItem } from "@/lib/actions/finance-cashflow"
import { CreateCashflowItemDialog } from "./create-cashflow-item-dialog"

// ─── Constants ──────────────────────────────────────────────────────────────

const MONTH_NAMES = [
    "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
]

const DAY_HEADERS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"]

const CATEGORY_COLORS: Record<string, string> = {
    AR_INVOICE: "bg-emerald-100 text-emerald-800 border-emerald-300",
    AP_BILL: "bg-red-100 text-red-800 border-red-300",
    PAYROLL: "bg-orange-100 text-orange-800 border-orange-300",
    BPJS: "bg-amber-100 text-amber-800 border-amber-300",
    PETTY_CASH: "bg-slate-100 text-slate-800 border-slate-300",
    RECURRING_JOURNAL: "bg-purple-100 text-purple-800 border-purple-300",
    BUDGET_ALLOCATION: "bg-blue-100 text-blue-800 border-blue-300",
    MANUAL: "bg-zinc-100 text-zinc-800 border-zinc-300",
    RECURRING_EXPENSE: "bg-rose-100 text-rose-800 border-rose-300",
    RECURRING_INCOME: "bg-teal-100 text-teal-800 border-teal-300",
}

const CATEGORY_LABELS: Record<string, string> = {
    AR_INVOICE: "Piutang",
    AP_BILL: "Hutang",
    PAYROLL: "Gaji",
    BPJS: "BPJS",
    PETTY_CASH: "Peti Kas",
    RECURRING_JOURNAL: "Jurnal Berulang",
    BUDGET_ALLOCATION: "Anggaran",
    MANUAL: "Manual",
    RECURRING_EXPENSE: "Beban Berulang",
    RECURRING_INCOME: "Pendapatan Berulang",
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getCalendarDays(month: number, year: number) {
    const firstDay = new Date(year, month - 1, 1)
    const lastDay = new Date(year, month, 0)
    const startPad = firstDay.getDay()
    const totalDays = lastDay.getDate()
    return { startPad, totalDays }
}

function getItemsForDate(items: CashflowItem[], day: number, month: number, year: number) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    return items.filter(item => item.date === dateStr)
}

function formatCompact(amount: number): string {
    if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1)}M`
    if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}jt`
    if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}rb`
    return String(amount)
}

// ─── Component ──────────────────────────────────────────────────────────────

interface CashflowPlanningBoardProps {
    data: CashflowPlanData
    month: number
    year: number
    onMonthChange: (month: number) => void
    onYearChange: (year: number) => void
}

export function CashflowPlanningBoard({
    data,
    month,
    year,
    onMonthChange,
    onYearChange,
}: CashflowPlanningBoardProps) {
    const queryClient = useQueryClient()
    const [savingSnapshot, setSavingSnapshot] = useState(false)
    const [activeTab, setActiveTab] = useState("planning")
    const [itemDialogOpen, setItemDialogOpen] = useState(false)
    const [editItem, setEditItem] = useState<CashflowItem | null>(null)
    const [glAccounts, setGlAccounts] = useState<{ id: string; code: string; name: string }[]>([])
    const [overrideDialogOpen, setOverrideDialogOpen] = useState(false)
    const [overrideAmount, setOverrideAmount] = useState("")
    const [savingOverride, setSavingOverride] = useState(false)

    useEffect(() => {
        fetch("/api/finance/transactions")
            .then(r => r.json())
            .then(d => {
                if (d.accounts) {
                    setGlAccounts(
                        d.accounts.map((a: any) => ({ id: a.id, code: a.code, name: a.name }))
                    )
                }
            })
            .catch(() => {})
    }, [])

    function handlePrevMonth() {
        if (month === 1) {
            onMonthChange(12)
            onYearChange(year - 1)
        } else {
            onMonthChange(month - 1)
        }
    }

    function handleNextMonth() {
        if (month === 12) {
            onMonthChange(1)
            onYearChange(year + 1)
        } else {
            onMonthChange(month + 1)
        }
    }

    async function handleSaveSnapshot() {
        setSavingSnapshot(true)
        try {
            await saveCashflowSnapshot(month, year)
            await queryClient.invalidateQueries({ queryKey: queryKeys.cashflowPlan.all })
            toast.success(`Snapshot ${MONTH_NAMES[month]} ${year} tersimpan`)
        } catch {
            toast.error("Gagal menyimpan snapshot")
        } finally {
            setSavingSnapshot(false)
        }
    }

    async function handleSaveOverride() {
        const amount = parseFloat(overrideAmount)
        if (isNaN(amount) || amount < 0) {
            toast.error("Jumlah tidak valid")
            return
        }
        setSavingOverride(true)
        try {
            await overrideStartingBalance(month, year, amount)
            await queryClient.invalidateQueries({ queryKey: queryKeys.cashflowPlan.all })
            toast.success("Saldo awal berhasil diubah")
            setOverrideDialogOpen(false)
        } catch {
            toast.error("Gagal mengubah saldo awal")
        } finally {
            setSavingOverride(false)
        }
    }

    async function handleResetOverride() {
        setSavingOverride(true)
        try {
            await overrideStartingBalance(month, year, null)
            await queryClient.invalidateQueries({ queryKey: queryKeys.cashflowPlan.all })
            toast.success("Saldo awal direset ke GL")
            setOverrideDialogOpen(false)
        } catch {
            toast.error("Gagal mereset saldo awal")
        } finally {
            setSavingOverride(false)
        }
    }

    const planItems = [...data.autoItems, ...data.manualItems]
    const { startPad, totalDays } = getCalendarDays(month, year)

    return (
        <div className="space-y-5">
            {/* ─── Header ─────────────────────────────────────────── */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center border-2 border-black bg-emerald-400 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                        <IconWallet size={22} stroke={2} />
                    </div>
                    <div>
                        <h1 className="text-xl font-black uppercase tracking-tight">
                            Perencanaan Arus Kas
                        </h1>
                        <p className="text-xs text-zinc-500 font-bold">
                            Estimasi pemasukan & pengeluaran bulanan
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex items-center border-2 border-black bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handlePrevMonth}
                            className="rounded-none border-r-2 border-black h-9 px-2"
                        >
                            <IconChevronLeft size={16} />
                        </Button>
                        <span className="px-4 font-black text-sm uppercase min-w-[160px] text-center">
                            {MONTH_NAMES[month]} {year}
                        </span>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleNextMonth}
                            className="rounded-none border-l-2 border-black h-9 px-2"
                        >
                            <IconChevronRight size={16} />
                        </Button>
                    </div>

                    <Button
                        onClick={() => {
                            setEditItem(null)
                            setItemDialogOpen(true)
                        }}
                        className="border-2 border-black font-black uppercase text-[10px] shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] h-9 bg-emerald-400 hover:bg-emerald-500 text-black"
                    >
                        <IconPlus size={14} className="mr-1" />
                        Tambah Item
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSaveSnapshot}
                        disabled={savingSnapshot}
                        className="border-2 border-black font-black uppercase text-[10px] shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] h-9"
                    >
                        <IconCamera size={14} className="mr-1" />
                        {savingSnapshot ? "Menyimpan..." : "Snapshot"}
                    </Button>
                </div>
            </div>

            {/* ─── KPI Strip ──────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KPICard
                    label="Saldo Awal"
                    value={data.effectiveStartingBalance}
                    icon={<IconWallet size={18} />}
                    accent="border-l-emerald-500"
                    badge={data.startingBalanceOverride !== null ? "Override" : undefined}
                    onClick={() => {
                        setOverrideAmount(String(data.effectiveStartingBalance))
                        setOverrideDialogOpen(true)
                    }}
                />
                <KPICard
                    label="Est. Pemasukan"
                    value={data.summary.totalIn}
                    icon={<IconArrowDownRight size={18} />}
                    accent="border-l-green-500"
                />
                <KPICard
                    label="Est. Pengeluaran"
                    value={data.summary.totalOut}
                    icon={<IconArrowUpRight size={18} />}
                    accent="border-l-red-500"
                />
                <KPICard
                    label="Est. Saldo Akhir"
                    value={data.summary.estimatedEndBalance}
                    icon={<IconScale size={18} />}
                    accent="border-l-blue-500"
                    highlight={data.summary.estimatedEndBalance < 0}
                />
            </div>

            {/* ─── Snapshot Info ───────────────────────────────────── */}
            {data.snapshot && (
                <div className="border-2 border-black bg-amber-50 px-4 py-2 text-xs font-bold flex items-center gap-2">
                    <IconCamera size={14} />
                    Snapshot terakhir: {new Date(data.snapshot.snapshotDate).toLocaleDateString("id-ID")}
                    <span className="text-zinc-500 ml-2">
                        Plan: {formatCurrency(data.snapshot.totalPlannedIn)} masuk,{" "}
                        {formatCurrency(data.snapshot.totalPlannedOut)} keluar
                    </span>
                </div>
            )}

            {/* ─── Tabs ───────────────────────────────────────────── */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white p-0 h-auto rounded-none">
                    <TabsTrigger
                        value="planning"
                        className="rounded-none border-r-2 border-black font-black uppercase text-xs px-6 py-2.5 data-[state=active]:bg-black data-[state=active]:text-white"
                    >
                        Planning
                    </TabsTrigger>
                    <TabsTrigger
                        value="riil"
                        className="rounded-none font-black uppercase text-xs px-6 py-2.5 data-[state=active]:bg-black data-[state=active]:text-white"
                    >
                        Riil
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="planning" className="mt-4">
                    <CalendarGrid
                        items={planItems}
                        month={month}
                        year={year}
                        startPad={startPad}
                        totalDays={totalDays}
                        startingBalance={data.effectiveStartingBalance}
                        onEditItem={(item) => {
                            setEditItem(item)
                            setItemDialogOpen(true)
                        }}
                    />
                </TabsContent>

                <TabsContent value="riil" className="mt-4">
                    <CalendarGrid
                        items={data.actualItems}
                        month={month}
                        year={year}
                        startPad={startPad}
                        totalDays={totalDays}
                        startingBalance={data.effectiveStartingBalance}
                    />
                </TabsContent>
            </Tabs>

            {/* ─── Running Balance Table ──────────────────────────── */}
            <RunningBalanceTable
                items={activeTab === "planning" ? planItems : data.actualItems}
                startingBalance={data.effectiveStartingBalance}
                month={month}
                year={year}
            />

            {/* ─── Variance Summary ────────────────────────────────── */}
            {data.snapshot && activeTab === "planning" && (
                <VarianceSummary
                    snapshot={data.snapshot}
                    actualItems={data.actualItems}
                />
            )}

            {/* ─── Create/Edit Item Dialog ─────────────────────────── */}
            <CreateCashflowItemDialog
                open={itemDialogOpen}
                onOpenChange={setItemDialogOpen}
                editItem={editItem}
                glAccounts={glAccounts}
                month={month}
                year={year}
            />

            {/* ─── Override Saldo Awal Dialog ──────────────────────── */}
            <Dialog open={overrideDialogOpen} onOpenChange={setOverrideDialogOpen}>
                <DialogContent className={NB.contentNarrow}>
                    <DialogHeader className={NB.header}>
                        <DialogTitle className={NB.title}>
                            <IconEdit size={18} />
                            Override Saldo Awal
                        </DialogTitle>
                        <p className={NB.subtitle}>
                            Ubah saldo awal bulan ini secara manual
                        </p>
                    </DialogHeader>

                    <div className="p-6 space-y-4">
                        <div>
                            <label className={NB.label}>Saldo GL Saat Ini</label>
                            <div className="text-sm font-black text-zinc-600">
                                {formatCurrency(data.startingBalance)}
                            </div>
                        </div>

                        {data.startingBalanceOverride !== null && (
                            <div>
                                <label className={NB.label}>Override Aktif</label>
                                <div className="text-sm font-black text-amber-600">
                                    {formatCurrency(data.startingBalanceOverride)}
                                </div>
                            </div>
                        )}

                        <div>
                            <label className={NB.label}>
                                Jumlah Baru <span className={NB.labelRequired}>*</span>
                            </label>
                            <Input
                                type="number"
                                className={NB.input}
                                placeholder="0"
                                value={overrideAmount}
                                onChange={e => setOverrideAmount(e.target.value)}
                            />
                        </div>

                        <div className="flex gap-2 pt-2">
                            <Button
                                onClick={handleSaveOverride}
                                disabled={savingOverride}
                                className="flex-1 border-2 border-black font-black uppercase text-xs shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-emerald-400 hover:bg-emerald-500 text-black h-10"
                            >
                                {savingOverride ? "Menyimpan..." : "Simpan Override"}
                            </Button>

                            {data.startingBalanceOverride !== null && (
                                <Button
                                    variant="outline"
                                    onClick={handleResetOverride}
                                    disabled={savingOverride}
                                    className="border-2 border-black font-black uppercase text-xs shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] h-10"
                                >
                                    <IconRefresh size={14} className="mr-1" />
                                    Reset ke GL
                                </Button>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}

// ─── KPI Card ───────────────────────────────────────────────────────────────

function KPICard({
    label,
    value,
    icon,
    accent,
    badge,
    highlight,
    onClick,
}: {
    label: string
    value: number
    icon: React.ReactNode
    accent: string
    badge?: string
    highlight?: boolean
    onClick?: () => void
}) {
    return (
        <div
            className={`border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] border-l-4 ${accent} p-4 ${onClick ? "cursor-pointer hover:ring-2 hover:ring-emerald-400 transition-shadow" : ""}`}
            onClick={onClick}
        >
            <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
                    {label}
                </span>
                <span className="text-zinc-400">{icon}</span>
            </div>
            <div className="flex items-center gap-2">
                <span
                    className={`text-lg font-black ${highlight ? "text-red-600" : ""}`}
                >
                    {formatCurrency(value)}
                </span>
                {badge && (
                    <Badge variant="outline" className="text-[9px] font-bold border-amber-400 text-amber-600 px-1.5 py-0">
                        {badge}
                    </Badge>
                )}
            </div>
        </div>
    )
}

// ─── Calendar Grid ──────────────────────────────────────────────────────────

function CalendarGrid({
    items,
    month,
    year,
    startPad,
    totalDays,
    startingBalance,
    onEditItem,
}: {
    items: CashflowItem[]
    month: number
    year: number
    startPad: number
    totalDays: number
    startingBalance: number
    onEditItem?: (item: CashflowItem) => void
}) {
    const today = new Date()
    const isCurrentMonth = today.getMonth() + 1 === month && today.getFullYear() === year
    const currentDay = today.getDate()

    return (
        <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white overflow-hidden">
            {/* Day headers */}
            <div className="grid grid-cols-7 bg-black">
                {DAY_HEADERS.map(day => (
                    <div
                        key={day}
                        className="text-center text-[10px] font-black uppercase tracking-wider text-white py-2"
                    >
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar cells */}
            <div className="grid grid-cols-7">
                {/* Padding cells */}
                {Array.from({ length: startPad }).map((_, i) => (
                    <div key={`pad-${i}`} className="border-r border-b border-zinc-200 bg-zinc-50 min-h-[100px]" />
                ))}

                {/* Day cells */}
                {Array.from({ length: totalDays }).map((_, i) => {
                    const day = i + 1
                    const dayItems = getItemsForDate(items, day, month, year)
                    const isToday = isCurrentMonth && day === currentDay
                    const totalIn = dayItems.filter(x => x.direction === "IN").reduce((s, x) => s + x.amount, 0)
                    const totalOut = dayItems.filter(x => x.direction === "OUT").reduce((s, x) => s + x.amount, 0)

                    return (
                        <div
                            key={day}
                            className={`border-r border-b border-zinc-200 min-h-[100px] p-1.5 ${
                                isToday ? "bg-emerald-50 ring-2 ring-inset ring-emerald-400" : ""
                            }`}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span
                                    className={`text-xs font-black ${
                                        isToday
                                            ? "bg-emerald-500 text-white w-6 h-6 flex items-center justify-center"
                                            : "text-zinc-600"
                                    }`}
                                >
                                    {day}
                                </span>
                                {dayItems.length > 0 && (
                                    <span className="text-[9px] font-bold text-zinc-400">
                                        {dayItems.length}
                                    </span>
                                )}
                            </div>

                            {/* Item pills */}
                            <div className="space-y-0.5">
                                {dayItems.slice(0, 3).map(item => (
                                    <ItemPill key={item.id} item={item} onEdit={onEditItem} />
                                ))}
                                {dayItems.length > 3 && (
                                    <span className="text-[9px] text-zinc-500 font-bold block">
                                        +{dayItems.length - 3} lainnya
                                    </span>
                                )}
                            </div>

                            {/* Day totals */}
                            {dayItems.length > 0 && (
                                <div className="mt-1 pt-1 border-t border-zinc-100 flex gap-1 flex-wrap">
                                    {totalIn > 0 && (
                                        <span className="text-[9px] font-bold text-emerald-600">
                                            +{formatCompact(totalIn)}
                                        </span>
                                    )}
                                    {totalOut > 0 && (
                                        <span className="text-[9px] font-bold text-red-600">
                                            -{formatCompact(totalOut)}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    )
                })}

                {/* Trailing padding */}
                {Array.from({ length: (7 - ((startPad + totalDays) % 7)) % 7 }).map((_, i) => (
                    <div key={`trail-${i}`} className="border-r border-b border-zinc-200 bg-zinc-50 min-h-[100px]" />
                ))}
            </div>
        </div>
    )
}

// ─── Item Pill ──────────────────────────────────────────────────────────────

function ItemPill({ item, onEdit }: { item: CashflowItem; onEdit?: (item: CashflowItem) => void }) {
    const colors = CATEGORY_COLORS[item.category] ?? CATEGORY_COLORS.MANUAL
    const label = CATEGORY_LABELS[item.category] ?? item.category
    const isClickable = item.isManual && onEdit

    return (
        <div
            className={`text-[9px] font-bold px-1.5 py-0.5 border truncate ${colors} ${isClickable ? "cursor-pointer hover:ring-1 hover:ring-black" : ""}`}
            title={`${item.description} — ${formatCurrency(item.amount)}`}
            onClick={isClickable ? () => onEdit(item) : undefined}
        >
            <span className="opacity-60">{label}</span>{" "}
            <span>{item.direction === "IN" ? "+" : "-"}{formatCompact(item.amount)}</span>
        </div>
    )
}

// ─── Running Balance Table ──────────────────────────────────────────────────

function RunningBalanceTable({
    items,
    startingBalance,
    month,
    year,
}: {
    items: CashflowItem[]
    startingBalance: number
    month: number
    year: number
}) {
    const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date))
    let runningBalance = startingBalance

    const rows = sorted.map(item => {
        if (item.direction === "IN") {
            runningBalance += item.amount
        } else {
            runningBalance -= item.amount
        }
        return { ...item, balance: runningBalance }
    })

    return (
        <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white overflow-hidden">
            <div className="bg-black text-white px-4 py-2.5 flex items-center gap-2">
                <IconCoin size={16} />
                <span className="text-xs font-black uppercase tracking-wider">
                    Running Balance — {MONTH_NAMES[month]} {year}
                </span>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="border-b-2 border-black bg-zinc-50">
                            <th className="text-left px-3 py-2 font-black uppercase text-[10px] tracking-wider text-zinc-500">
                                Tanggal
                            </th>
                            <th className="text-left px-3 py-2 font-black uppercase text-[10px] tracking-wider text-zinc-500">
                                Deskripsi
                            </th>
                            <th className="text-left px-3 py-2 font-black uppercase text-[10px] tracking-wider text-zinc-500">
                                Kategori
                            </th>
                            <th className="text-right px-3 py-2 font-black uppercase text-[10px] tracking-wider text-emerald-600">
                                Masuk
                            </th>
                            <th className="text-right px-3 py-2 font-black uppercase text-[10px] tracking-wider text-red-600">
                                Keluar
                            </th>
                            <th className="text-right px-3 py-2 font-black uppercase text-[10px] tracking-wider text-zinc-500">
                                Saldo
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* Starting balance row */}
                        <tr className="border-b border-zinc-200 bg-emerald-50">
                            <td className="px-3 py-2 font-bold">01/{String(month).padStart(2, "0")}</td>
                            <td className="px-3 py-2 font-bold" colSpan={2}>Saldo Awal</td>
                            <td className="px-3 py-2 text-right">—</td>
                            <td className="px-3 py-2 text-right">—</td>
                            <td className="px-3 py-2 text-right font-black">{formatCurrency(startingBalance)}</td>
                        </tr>
                        {rows.map(row => {
                            const dateStr = row.date.split("-")
                            const displayDate = `${dateStr[2]}/${dateStr[1]}`
                            const catLabel = CATEGORY_LABELS[row.category] ?? row.category
                            const catColor = CATEGORY_COLORS[row.category] ?? ""

                            return (
                                <tr key={row.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                                    <td className="px-3 py-2 font-bold text-zinc-600">{displayDate}</td>
                                    <td className="px-3 py-2 max-w-[300px] truncate" title={row.description}>
                                        {row.description}
                                    </td>
                                    <td className="px-3 py-1.5">
                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 border ${catColor}`}>
                                            {catLabel}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-right font-bold text-emerald-600">
                                        {row.direction === "IN" ? formatCurrency(row.amount) : "—"}
                                    </td>
                                    <td className="px-3 py-2 text-right font-bold text-red-600">
                                        {row.direction === "OUT" ? formatCurrency(row.amount) : "—"}
                                    </td>
                                    <td className={`px-3 py-2 text-right font-black ${row.balance < 0 ? "text-red-600" : ""}`}>
                                        {formatCurrency(row.balance)}
                                    </td>
                                </tr>
                            )
                        })}
                        {rows.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-3 py-8 text-center text-zinc-400 font-bold">
                                    Belum ada item untuk bulan ini
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

// ─── Variance Summary ────────────────────────────────────────────────────────

function VarianceSummary({
    snapshot,
    actualItems,
}: {
    snapshot: { totalPlannedIn: number; totalPlannedOut: number; plannedEndBalance: number; snapshotDate: string }
    actualItems: CashflowItem[]
}) {
    const actualIn = actualItems
        .filter(i => i.direction === "IN")
        .reduce((s, i) => s + i.amount, 0)
    const actualOut = actualItems
        .filter(i => i.direction === "OUT")
        .reduce((s, i) => s + i.amount, 0)

    const selisihIn = actualIn - snapshot.totalPlannedIn
    const selisihOut = actualOut - snapshot.totalPlannedOut

    return (
        <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white overflow-hidden">
            <div className="bg-black text-white px-4 py-2.5 flex items-center gap-2">
                <IconScale size={16} />
                <span className="text-xs font-black uppercase tracking-wider">
                    Variance: Rencana vs Realisasi
                </span>
                <span className="text-[10px] text-zinc-400 ml-auto">
                    Snapshot: {new Date(snapshot.snapshotDate).toLocaleDateString("id-ID")}
                </span>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="border-b-2 border-black bg-zinc-50">
                            <th className="text-left px-4 py-2 font-black uppercase text-[10px] tracking-wider text-zinc-500 w-[140px]" />
                            <th className="text-right px-4 py-2 font-black uppercase text-[10px] tracking-wider text-emerald-600">
                                Pemasukan
                            </th>
                            <th className="text-right px-4 py-2 font-black uppercase text-[10px] tracking-wider text-red-600">
                                Pengeluaran
                            </th>
                            <th className="text-right px-4 py-2 font-black uppercase text-[10px] tracking-wider text-zinc-500">
                                Nett
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="border-b border-zinc-200">
                            <td className="px-4 py-3 font-black text-xs">Rencana</td>
                            <td className="px-4 py-3 text-right font-bold">{formatCurrency(snapshot.totalPlannedIn)}</td>
                            <td className="px-4 py-3 text-right font-bold">{formatCurrency(snapshot.totalPlannedOut)}</td>
                            <td className="px-4 py-3 text-right font-black">
                                {formatCurrency(snapshot.totalPlannedIn - snapshot.totalPlannedOut)}
                            </td>
                        </tr>
                        <tr className="border-b border-zinc-200">
                            <td className="px-4 py-3 font-black text-xs">Aktual</td>
                            <td className="px-4 py-3 text-right font-bold">{formatCurrency(actualIn)}</td>
                            <td className="px-4 py-3 text-right font-bold">{formatCurrency(actualOut)}</td>
                            <td className="px-4 py-3 text-right font-black">
                                {formatCurrency(actualIn - actualOut)}
                            </td>
                        </tr>
                        <tr className="border-t-2 border-black bg-zinc-50">
                            <td className="px-4 py-3 font-black text-xs">Selisih</td>
                            <td className={`px-4 py-3 text-right font-black ${selisihIn >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                                {selisihIn >= 0 ? "+" : ""}{formatCurrency(selisihIn)}
                            </td>
                            <td className={`px-4 py-3 text-right font-black ${selisihOut <= 0 ? "text-emerald-600" : "text-red-600"}`}>
                                {selisihOut >= 0 ? "+" : ""}{formatCurrency(selisihOut)}
                            </td>
                            <td className={`px-4 py-3 text-right font-black ${(actualIn - actualOut) - (snapshot.totalPlannedIn - snapshot.totalPlannedOut) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                                {(actualIn - actualOut) - (snapshot.totalPlannedIn - snapshot.totalPlannedOut) >= 0 ? "+" : ""}
                                {formatCurrency((actualIn - actualOut) - (snapshot.totalPlannedIn - snapshot.totalPlannedOut))}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    )
}
