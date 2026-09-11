"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Check, X, Lock, ArrowRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { NB } from "@/lib/dialog-styles"
import { formatIDR } from "@/lib/utils"
import { queryKeys } from "@/lib/query-keys"
import { getMonthEndChecklist } from "@/lib/actions/finance-close"
import {
    assembleMonthEndChecklist,
    monthEndTitle,
    type MonthEndChecklistRow,
} from "@/__tests__/month-end-checklist-logic"

export type MonthEndPeriodOption = {
    id: string
    year: number
    month: number
    name: string
    isClosed: boolean
}

type MonthEndChecklistProps = {
    year: number
    month: number
    period: MonthEndPeriodOption | null
    periods: MonthEndPeriodOption[]
    onSelectPeriod: (period: MonthEndPeriodOption) => void
    onClosePeriod: (period: MonthEndPeriodOption) => void
    closePending?: boolean
}

export function MonthEndChecklist({
    year,
    month,
    period,
    periods,
    onSelectPeriod,
    onClosePeriod,
    closePending = false,
}: MonthEndChecklistProps) {
    const { data, isLoading, isError } = useQuery({
        queryKey: [...queryKeys.monthEndClose.checklist(year, month), period?.isClosed ?? false],
        queryFn: () => getMonthEndChecklist({ year, month }),
    })

    const view = data ? assembleMonthEndChecklist(data) : null
    const titleName = data?.periodName ?? period?.name ?? `${month}/${year}`
    const closed = data?.isClosed ?? period?.isClosed ?? false
    const monthsInYear = periods
        .filter((p) => p.year === year)
        .sort((a, b) => a.month - b.month)

    return (
        <div className={NB.pageCard}>
            <div className={NB.pageAccent} />

            <div className={`px-5 py-3.5 flex items-center justify-between gap-3 ${NB.pageRowBorder}`}>
                <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 flex items-center justify-center ${closed ? "bg-zinc-500" : "bg-orange-500"}`}>
                        <Lock className="h-4 w-4 text-white" />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-base font-black uppercase tracking-wider text-zinc-900 dark:text-white truncate">
                            {monthEndTitle(titleName, closed)}
                        </h2>
                        <p className="text-zinc-400 text-[11px] font-medium">
                            Cockpit tutup buku bulanan — item merah harus hijau sebelum kunci
                        </p>
                    </div>
                </div>
                <ClosePeriodButton
                    canClose={!!view?.canClose && !!period && !closed}
                    pending={closePending}
                    hint={view?.blockerHint || (period ? "" : "Pilih periode yang akan ditutup")}
                    onClick={() => {
                        if (period) onClosePeriod(period)
                    }}
                />
            </div>

            {monthsInYear.length > 0 && (
                <div className={`${NB.filterBar} ${NB.pageRowBorder}`}>
                    <div className="flex items-center gap-0 flex-wrap">
                        {monthsInYear.map((p, idx) => (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => onSelectPeriod(p)}
                                className={`h-9 px-3 text-[10px] font-black uppercase tracking-widest transition-all border ${
                                    idx < monthsInYear.length - 1 ? "border-r-0" : ""
                                } rounded-none ${
                                    p.month === month
                                        ? "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white"
                                        : "bg-white dark:bg-zinc-900 text-zinc-400 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                }`}
                            >
                                {p.name.replace(/\s+\d{4}$/, "")}
                            </button>
                        ))}
                    </div>
                    {view && (
                        <span className="hidden md:inline text-[11px] font-medium text-zinc-400">
                            <span className="font-mono font-bold text-zinc-600 dark:text-zinc-300">
                                {view.readyCount}/{view.totalCount}
                            </span>{" "}
                            siap
                        </span>
                    )}
                </div>
            )}

            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {isLoading && (
                    <div className="px-5 py-8 flex items-center justify-center gap-2 text-zinc-400 text-[11px] font-bold uppercase tracking-wider">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Memuat ceklist tutup buku
                    </div>
                )}

                {isError && (
                    <div className="px-5 py-6 text-[12px] font-medium text-red-600">
                        Gagal memuat ceklist tutup buku. Coba muat ulang halaman.
                    </div>
                )}

                {view && !view.canClose && view.blockerHint && (
                    <div className="px-5 py-2.5 bg-red-50/80 dark:bg-red-950/20 text-[11px] font-bold text-red-700 dark:text-red-400">
                        {view.blockerHint}
                    </div>
                )}

                {view?.rows.map((row) => (
                    <ChecklistRow key={row.id} row={row} />
                ))}
            </div>
        </div>
    )
}

function ClosePeriodButton({
    canClose,
    pending,
    hint,
    onClick,
}: {
    canClose: boolean
    pending: boolean
    hint: string
    onClick: () => void
}) {
    const button = (
        <Button
            type="button"
            disabled={!canClose || pending}
            onClick={onClick}
            className={`${NB.toolbarBtnPrimary} ml-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-orange-500`}
        >
            {pending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
                <Lock className="h-3.5 w-3.5 mr-1.5" />
            )}
            Tutup Periode
        </Button>
    )

    if (canClose) return button

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span className="inline-flex" title={hint}>
                    {button}
                </span>
            </TooltipTrigger>
            {hint ? (
                <TooltipContent className="rounded-none border-2 border-black bg-black text-white text-[11px] font-bold max-w-xs">
                    {hint}
                </TooltipContent>
            ) : null}
        </Tooltip>
    )
}

function ChecklistRow({ row }: { row: MonthEndChecklistRow }) {
    return (
        <div className="px-5 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
                <span
                    className={`w-6 h-6 shrink-0 flex items-center justify-center border ${
                        row.ok
                            ? "bg-emerald-50 border-emerald-400 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                            : "bg-red-50 border-red-400 text-red-600 dark:bg-red-950/30 dark:text-red-400"
                    }`}
                >
                    {row.ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                </span>
                <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-wider text-zinc-900 dark:text-white">
                        {row.label}
                    </p>
                    <p className={`text-[11px] font-medium truncate ${row.ok ? "text-zinc-500" : "text-red-600 dark:text-red-400"}`}>
                        {row.detail}
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
                {typeof row.count === "number" && row.count > 0 && (
                    <span className="font-mono text-sm font-black text-zinc-900 dark:text-white">{row.count}</span>
                )}
                {typeof row.amount === "number" && row.amount > 0 && (
                    <span className="font-mono text-xs font-bold text-zinc-500">{formatIDR(row.amount)}</span>
                )}
                {!row.ok && (
                    <Link
                        href={row.href}
                        className="inline-flex items-center h-7 px-2 text-[9px] font-black uppercase tracking-wider border border-orange-400 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:bg-orange-950/20 dark:text-orange-400"
                    >
                        Perbaiki <ArrowRight className="h-3 w-3 ml-1" />
                    </Link>
                )}
            </div>
        </div>
    )
}
