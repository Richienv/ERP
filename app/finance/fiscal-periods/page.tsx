"use client"

import { useState } from "react"
import {
    useFiscalPeriods,
    useGenerateFiscalYear,
    useCloseFiscalPeriod,
    useReopenFiscalPeriod,
    FiscalPeriod,
} from "@/hooks/use-fiscal-periods"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NB } from "@/lib/dialog-styles"
import {
    IconCalendar,
    IconLock,
    IconLockOpen,
    IconPlus,
    IconRefresh,
    IconBookDownload,
} from "@tabler/icons-react"
import { Calendar, Lock, LockOpen, X } from "lucide-react"
import { motion } from "framer-motion"
import { ClosingYearDialog } from "@/components/finance/closing-year-dialog"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"

const stagger = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.07 } },
}
const fadeUp = {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 320, damping: 26 } },
}

export default function FiscalPeriodsPage() {
    const currentYear = new Date().getFullYear()
    const [filterYear, setFilterYear] = useState<number | undefined>(undefined)
    const [generateYear, setGenerateYear] = useState<number>(currentYear)
    const [confirmAction, setConfirmAction] = useState<{
        type: "close" | "reopen"
        period: FiscalPeriod
    } | null>(null)
    const [closingYear, setClosingYear] = useState<number | null>(null)

    const { data: periods, isLoading } = useFiscalPeriods(filterYear)
    const generateMutation = useGenerateFiscalYear()
    const closeMutation = useCloseFiscalPeriod()
    const reopenMutation = useReopenFiscalPeriod()

    if (isLoading) return <TablePageSkeleton accentColor="bg-orange-400" />

    const periodsByYear = (periods ?? []).reduce<Record<number, FiscalPeriod[]>>((acc, p) => {
        if (!acc[p.year]) acc[p.year] = []
        acc[p.year].push(p)
        return acc
    }, {})

    const years = Object.keys(periodsByYear).map(Number).sort((a, b) => b - a)
    const allPeriods = periods ?? []
    const totalOpen = allPeriods.filter((p) => !p.isClosed).length
    const totalClosed = allPeriods.filter((p) => p.isClosed).length

    function handleConfirmAction() {
        if (!confirmAction) return
        if (confirmAction.type === "close") closeMutation.mutate(confirmAction.period.id)
        else reopenMutation.mutate(confirmAction.period.id)
        setConfirmAction(null)
    }

    return (
        <motion.div className="mf-page" variants={stagger} initial="hidden" animate="show">
            {/* ─── Unified Page Header ─── */}
            <motion.div variants={fadeUp} className={NB.pageCard}>
                <div className={NB.pageAccent} />

                {/* Row 1: Title + Actions */}
                <div className={`px-5 py-3.5 flex items-center justify-between ${NB.pageRowBorder}`}>
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-orange-500 flex items-center justify-center">
                            <Calendar className="h-4.5 w-4.5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-base font-black uppercase tracking-wider text-zinc-900 dark:text-white">
                                Periode Fiskal
                            </h1>
                            <p className="text-zinc-400 text-[11px] font-medium">
                                Kelola periode akuntansi tahunan
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-0">
                        <Button
                            variant="outline"
                            onClick={() => setClosingYear(filterYear || currentYear)}
                            className={NB.toolbarBtn + " " + NB.toolbarBtnJoin}
                        >
                            <IconBookDownload className="h-3.5 w-3.5 mr-1.5" /> Tutup Buku {filterYear || currentYear}
                        </Button>
                        <div className="flex items-center gap-0">
                            <Input
                                type="number"
                                min={2020}
                                max={2099}
                                value={generateYear}
                                onChange={(e) => setGenerateYear(parseInt(e.target.value) || currentYear)}
                                className={`${NB.filterInput} w-20 text-center font-mono font-bold ${
                                    generateYear ? NB.inputActive : NB.inputEmpty
                                }`}
                            />
                            <Button
                                onClick={() => generateMutation.mutate(generateYear)}
                                disabled={generateMutation.isPending}
                                className={NB.toolbarBtnPrimary}
                            >
                                {generateMutation.isPending ? (
                                    <IconRefresh className="h-3.5 w-3.5 animate-spin mr-1.5" />
                                ) : (
                                    <IconPlus className="h-3.5 w-3.5 mr-1.5" />
                                )}
                                Generate 12 Bulan
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Row 2: KPI Strip */}
                <div className={`${NB.kpiStrip} ${NB.pageRowBorder}`}>
                    {[
                        { label: "Total Periode", count: allPeriods.length, dot: "bg-orange-500" },
                        { label: "Terbuka", count: totalOpen, dot: "bg-emerald-500" },
                        { label: "Ditutup", count: totalClosed, dot: "bg-zinc-400" },
                        { label: "Tahun Fiskal", count: years.length, dot: "bg-blue-500" },
                    ].map((kpi) => (
                        <div key={kpi.label} className={NB.kpiCell}>
                            <div className="flex items-center gap-1.5">
                                <span className={`w-2 h-2 ${kpi.dot}`} />
                                <span className={NB.kpiLabel}>{kpi.label}</span>
                            </div>
                            <motion.span
                                key={kpi.count}
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                                className={NB.kpiCount}
                            >
                                {kpi.count}
                            </motion.span>
                        </div>
                    ))}
                </div>

                {/* Row 3: Filter Toolbar */}
                <div className={NB.filterBar}>
                    <div className="flex items-center gap-0">
                        <button
                            onClick={() => setFilterYear(undefined)}
                            className={`h-9 px-3 text-[10px] font-black uppercase tracking-widest transition-all border ${years.length > 0 ? "border-r-0" : ""} rounded-none ${
                                filterYear === undefined
                                    ? "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white"
                                    : "bg-white dark:bg-zinc-900 text-zinc-400 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                            }`}
                        >
                            Semua
                        </button>
                        {years.map((y, idx) => (
                            <button
                                key={y}
                                onClick={() => setFilterYear(y)}
                                className={`h-9 px-3 text-[10px] font-black uppercase tracking-widest transition-all border ${idx < years.length - 1 ? "border-r-0" : ""} rounded-none ${
                                    filterYear === y
                                        ? "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white"
                                        : "bg-white dark:bg-zinc-900 text-zinc-400 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                }`}
                            >
                                {y}
                            </button>
                        ))}
                    </div>
                    <span className="hidden md:inline text-[11px] font-medium text-zinc-400">
                        <span className="font-mono font-bold text-zinc-600 dark:text-zinc-300">{allPeriods.length}</span> periode
                    </span>
                </div>
            </motion.div>

            {/* ─── Period Grid per Year ─── */}
            {years.length === 0 ? (
                <motion.div
                    variants={fadeUp}
                    className={NB.pageCard}
                >
                    <div className="flex flex-col items-center justify-center py-16 text-zinc-400">
                        <div className="w-16 h-16 border-2 border-zinc-200 dark:border-zinc-700 flex items-center justify-center mb-4">
                            <Calendar className="h-7 w-7 text-zinc-200 dark:text-zinc-700" />
                        </div>
                        <span className="text-sm font-bold">Belum ada periode fiskal</span>
                        <span className="text-xs text-zinc-400 mt-1">Masukkan tahun lalu klik &quot;Generate 12 Bulan&quot;</span>
                    </div>
                </motion.div>
            ) : (
                years.map((year) => {
                    const yearPeriods = periodsByYear[year]
                    const closedCount = yearPeriods.filter((p) => p.isClosed).length
                    const openCount = yearPeriods.length - closedCount

                    return (
                        <motion.div key={year} variants={fadeUp} className="space-y-3">
                            <div className="flex items-center justify-between px-1">
                                <h2 className="text-sm font-black uppercase tracking-widest text-zinc-900 dark:text-white">
                                    Tahun Fiskal {year}
                                </h2>
                                <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400">
                                        {openCount} Terbuka
                                    </span>
                                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 border border-zinc-300 bg-zinc-50 dark:bg-zinc-800 text-zinc-500">
                                        {closedCount} Ditutup
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6 gap-0 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
                                {yearPeriods.map((period, idx) => (
                                    <div
                                        key={period.id}
                                        className={`p-4 flex flex-col gap-2 transition-colors ${
                                            period.isClosed
                                                ? "bg-zinc-50/50 dark:bg-zinc-800/30"
                                                : "hover:bg-orange-50/50 dark:hover:bg-orange-950/10"
                                        } ${idx < yearPeriods.length - 1 ? "border-r border-b border-zinc-200 dark:border-zinc-800" : "border-b border-zinc-200 dark:border-zinc-800"}`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="font-black text-sm text-zinc-900 dark:text-white">{period.name}</span>
                                            {period.isClosed ? (
                                                <Lock className="h-3.5 w-3.5 text-zinc-400" />
                                            ) : (
                                                <LockOpen className="h-3.5 w-3.5 text-emerald-600" />
                                            )}
                                        </div>

                                        <div className="text-[10px] text-zinc-400 font-mono">
                                            {new Date(period.startDate).toLocaleDateString("id-ID")} — {new Date(period.endDate).toLocaleDateString("id-ID")}
                                        </div>

                                        <span
                                            className={`w-fit text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 border ${
                                                period.isClosed
                                                    ? "border-zinc-300 bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                                                    : "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400"
                                            }`}
                                        >
                                            {period.isClosed ? "Ditutup" : "Terbuka"}
                                        </span>

                                        {period.isClosed && period.closedBy && (
                                            <p className="text-[9px] text-zinc-400 truncate">Oleh: {period.closedBy}</p>
                                        )}

                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setConfirmAction({ type: period.isClosed ? "reopen" : "close", period })}
                                            disabled={closeMutation.isPending || reopenMutation.isPending}
                                            className={`mt-auto h-7 text-[9px] font-black uppercase tracking-wider rounded-none border transition-colors ${
                                                period.isClosed
                                                    ? "border-emerald-300 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                                                    : "border-red-300 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
                                            }`}
                                        >
                                            {period.isClosed ? (
                                                <><LockOpen className="h-3 w-3 mr-1" /> Buka Kembali</>
                                            ) : (
                                                <><Lock className="h-3 w-3 mr-1" /> Tutup Periode</>
                                            )}
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )
                })
            )}

            {/* Confirmation Dialog */}
            <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
                <AlertDialogContent className={NB.content}>
                    <AlertDialogHeader className={NB.header}>
                        <AlertDialogTitle className={NB.title}>
                            {confirmAction?.type === "close" ? (
                                <><Lock className="h-5 w-5" /> Tutup Periode Fiskal?</>
                            ) : (
                                <><LockOpen className="h-5 w-5" /> Buka Kembali Periode?</>
                            )}
                        </AlertDialogTitle>
                    </AlertDialogHeader>
                    <div className="p-6">
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                            {confirmAction?.type === "close" ? (
                                <>Periode <strong>{confirmAction.period.name}</strong> akan ditutup. Jurnal baru tidak bisa diposting ke periode ini.</>
                            ) : (
                                <>Periode <strong>{confirmAction?.period.name}</strong> akan dibuka kembali. Jurnal baru bisa diposting ke periode ini.</>
                            )}
                        </p>
                    </div>
                    <div className="px-6 pb-6 flex items-center justify-end gap-3">
                        <AlertDialogCancel className={NB.cancelBtn}>Batal</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmAction}
                            className={confirmAction?.type === "close" ? NB.submitBtn : NB.submitBtnGreen}
                        >
                            {confirmAction?.type === "close" ? "Ya, Tutup" : "Ya, Buka Kembali"}
                        </AlertDialogAction>
                    </div>
                </AlertDialogContent>
            </AlertDialog>

            {closingYear !== null && (
                <ClosingYearDialog
                    open={closingYear !== null}
                    onOpenChange={(v) => { if (!v) setClosingYear(null) }}
                    fiscalYear={closingYear}
                    periods={(periods || [])
                        .filter((p) => p.year === closingYear)
                        .map((p) => ({ id: p.id, month: p.month, name: p.name, isClosed: p.isClosed }))}
                    onComplete={() => { setClosingYear(null) }}
                />
            )}
        </motion.div>
    )
}
