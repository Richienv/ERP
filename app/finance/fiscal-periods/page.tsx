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
import { Badge } from "@/components/ui/badge"
import {
    IconCalendar,
    IconLock,
    IconLockOpen,
    IconPlus,
    IconRefresh,
    IconBookDownload,
} from "@tabler/icons-react"
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

    if (isLoading) return <TablePageSkeleton accentColor="bg-emerald-400" />

    // Group periods by year
    const periodsByYear = (periods ?? []).reduce<Record<number, FiscalPeriod[]>>((acc, p) => {
        if (!acc[p.year]) acc[p.year] = []
        acc[p.year].push(p)
        return acc
    }, {})

    const years = Object.keys(periodsByYear)
        .map(Number)
        .sort((a, b) => b - a)

    function handleConfirmAction() {
        if (!confirmAction) return
        if (confirmAction.type === "close") {
            closeMutation.mutate(confirmAction.period.id)
        } else {
            reopenMutation.mutate(confirmAction.period.id)
        }
        setConfirmAction(null)
    }

    return (
        <div className="mf-page">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                        <IconCalendar className="h-7 w-7" />
                        Periode Fiskal
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Kelola periode akuntansi tahunan. Tutup periode untuk mencegah posting jurnal.
                    </p>
                </div>
            </div>

            {/* Generate Year Section */}
            <div className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4">
                <div className="flex items-center gap-2 mb-3">
                    <IconPlus className="h-5 w-5" />
                    <span className="text-xs font-black uppercase tracking-widest">
                        Buat Periode Tahun Baru
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <Input
                        type="number"
                        min={2020}
                        max={2099}
                        value={generateYear}
                        onChange={(e) => setGenerateYear(parseInt(e.target.value) || currentYear)}
                        className="border-2 border-black font-bold h-10 rounded-none w-32 placeholder:text-zinc-300"
                        placeholder="2026"
                    />
                    <Button
                        onClick={() => generateMutation.mutate(generateYear)}
                        disabled={generateMutation.isPending}
                        className="bg-black text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-black uppercase text-xs tracking-wider px-6 h-10 rounded-none"
                    >
                        {generateMutation.isPending ? (
                            <IconRefresh className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                            <IconPlus className="h-4 w-4 mr-2" />
                        )}
                        Generate 12 Bulan
                    </Button>
                </div>
            </div>

            {/* Filter */}
            <div className="flex items-center gap-3">
                <span className="text-xs font-black uppercase tracking-widest text-zinc-500">
                    Filter Tahun:
                </span>
                <Button
                    variant={filterYear === undefined ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilterYear(undefined)}
                    className={filterYear === undefined
                        ? "bg-black text-white border-2 border-black rounded-none font-bold text-xs"
                        : "border-2 border-black rounded-none font-bold text-xs"
                    }
                >
                    Semua
                </Button>
                {years.map((y) => (
                    <Button
                        key={y}
                        variant={filterYear === y ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFilterYear(y)}
                        className={filterYear === y
                            ? "bg-black text-white border-2 border-black rounded-none font-bold text-xs"
                            : "border-2 border-black rounded-none font-bold text-xs"
                        }
                    >
                        {y}
                    </Button>
                ))}

                <div className="ml-auto">
                    <Button
                        size="sm"
                        variant="outline"
                        className="border-2 border-black rounded-none font-bold text-xs"
                        onClick={() => setClosingYear(filterYear || currentYear)}
                    >
                        <IconBookDownload className="h-4 w-4 mr-1" />
                        Tutup Buku Tahun {filterYear || currentYear}
                    </Button>
                </div>
            </div>

            {/* Period Grid per Year */}
            {years.length === 0 && (
                <div className="border-2 border-dashed border-zinc-300 p-12 text-center">
                    <IconCalendar className="h-12 w-12 mx-auto text-zinc-300 mb-3" />
                    <p className="text-zinc-400 font-bold">Belum ada periode fiskal</p>
                    <p className="text-zinc-400 text-sm mt-1">
                        Masukkan tahun di atas lalu klik &quot;Generate 12 Bulan&quot;
                    </p>
                </div>
            )}

            {years.map((year) => {
                const yearPeriods = periodsByYear[year]
                const closedCount = yearPeriods.filter((p) => p.isClosed).length
                const openCount = yearPeriods.length - closedCount

                return (
                    <div key={year} className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-black">
                                Tahun Fiskal {year}
                            </h2>
                            <div className="flex items-center gap-2">
                                <Badge
                                    variant="outline"
                                    className="border-2 border-emerald-600 text-emerald-700 font-bold rounded-none"
                                >
                                    {openCount} Terbuka
                                </Badge>
                                <Badge
                                    variant="outline"
                                    className="border-2 border-zinc-400 text-zinc-500 font-bold rounded-none"
                                >
                                    {closedCount} Ditutup
                                </Badge>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6 gap-3">
                            {yearPeriods.map((period) => (
                                <div
                                    key={period.id}
                                    className={`border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 flex flex-col gap-2 ${
                                        period.isClosed ? "opacity-60" : ""
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="font-black text-sm">
                                            {period.name}
                                        </span>
                                        {period.isClosed ? (
                                            <IconLock className="h-4 w-4 text-zinc-400" />
                                        ) : (
                                            <IconLockOpen className="h-4 w-4 text-emerald-600" />
                                        )}
                                    </div>

                                    <div className="text-[10px] text-zinc-400 font-mono">
                                        {new Date(period.startDate).toLocaleDateString("id-ID")} —{" "}
                                        {new Date(period.endDate).toLocaleDateString("id-ID")}
                                    </div>

                                    <Badge
                                        className={`w-fit text-[10px] font-black uppercase rounded-none border-2 ${
                                            period.isClosed
                                                ? "border-zinc-400 bg-zinc-100 text-zinc-500"
                                                : "border-emerald-600 bg-emerald-50 text-emerald-700"
                                        }`}
                                    >
                                        {period.isClosed ? "Ditutup" : "Terbuka"}
                                    </Badge>

                                    {period.isClosed && period.closedBy && (
                                        <p className="text-[10px] text-zinc-400 truncate">
                                            Ditutup oleh: {period.closedBy}
                                        </p>
                                    )}

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            setConfirmAction({
                                                type: period.isClosed ? "reopen" : "close",
                                                period,
                                            })
                                        }
                                        disabled={closeMutation.isPending || reopenMutation.isPending}
                                        className={`mt-auto border-2 border-black rounded-none font-bold text-xs h-8 ${
                                            period.isClosed
                                                ? "hover:bg-emerald-50"
                                                : "hover:bg-red-50"
                                        }`}
                                    >
                                        {period.isClosed ? (
                                            <>
                                                <IconLockOpen className="h-3 w-3 mr-1" />
                                                Buka Kembali
                                            </>
                                        ) : (
                                            <>
                                                <IconLock className="h-3 w-3 mr-1" />
                                                Tutup Periode
                                            </>
                                        )}
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                )
            })}

            {/* Confirmation Dialog */}
            <AlertDialog
                open={!!confirmAction}
                onOpenChange={(open) => !open && setConfirmAction(null)}
            >
                <AlertDialogContent className="border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-none">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="font-black">
                            {confirmAction?.type === "close"
                                ? "Tutup Periode Fiskal?"
                                : "Buka Kembali Periode Fiskal?"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {confirmAction?.type === "close" ? (
                                <>
                                    Periode <strong>{confirmAction.period.name}</strong> akan
                                    ditutup. Jurnal baru tidak bisa diposting ke periode ini.
                                </>
                            ) : (
                                <>
                                    Periode <strong>{confirmAction?.period.name}</strong> akan
                                    dibuka kembali. Jurnal baru bisa diposting ke periode ini.
                                </>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="border-2 border-black rounded-none font-bold">
                            Batal
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmAction}
                            className={`border-2 border-black rounded-none font-bold ${
                                confirmAction?.type === "close"
                                    ? "bg-red-600 hover:bg-red-700 text-white"
                                    : "bg-emerald-600 hover:bg-emerald-700 text-white"
                            }`}
                        >
                            {confirmAction?.type === "close" ? "Ya, Tutup" : "Ya, Buka Kembali"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {closingYear !== null && (
                <ClosingYearDialog
                    open={closingYear !== null}
                    onOpenChange={(v) => { if (!v) setClosingYear(null) }}
                    fiscalYear={closingYear}
                    periods={(periods || [])
                        .filter((p) => p.year === closingYear)
                        .map((p) => ({
                            id: p.id,
                            month: p.month,
                            name: p.name,
                            isClosed: p.isClosed,
                        }))}
                    onComplete={() => { setClosingYear(null) }}
                />
            )}
        </div>
    )
}
