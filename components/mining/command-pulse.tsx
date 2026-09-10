"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, CheckCircle2, ChevronRight, Sparkles } from "lucide-react"
import { getMiningCommandPulse, type CommandAction, type MiningCommandPulse } from "@/lib/actions/mining-command"
import { queryKeys } from "@/lib/query-keys"
import { formatIDR } from "@/lib/utils"
import { NB } from "@/lib/dialog-styles"

const TONE: Record<CommandAction["tone"], { bar: string; chip: string }> = {
    critical: { bar: "border-l-red-500", chip: "bg-red-50 text-red-700 border-red-200" },
    warn: { bar: "border-l-amber-500", chip: "bg-amber-50 text-amber-800 border-amber-200" },
    go: { bar: "border-l-emerald-500", chip: "bg-emerald-50 text-emerald-700 border-emerald-200" },
}

export function useMiningCommandPulse() {
    return useQuery({
        queryKey: queryKeys.miningCommand.pulse(),
        queryFn: () => getMiningCommandPulse(),
        staleTime: 30_000,
    })
}

export function CommandPulse({
    title = "Langkah berikutnya",
    subtitle = "Satu klik ke pekerjaan yang benar-benar menggerakkan buku",
    module,
    compact = false,
}: {
    title?: string
    subtitle?: string
    module?: CommandAction["module"]
    compact?: boolean
}) {
    const { data, isLoading } = useMiningCommandPulse()
    const actions = (data?.actions ?? []).filter((action) => !module || action.module === module)

    if (isLoading && !data) {
        return (
            <div className={`${NB.pageCard} p-4`}>
                <div className="h-4 w-40 bg-zinc-200 animate-pulse" />
            </div>
        )
    }

    if (!data) return null

    return (
        <div className={NB.pageCard}>
            <div className={NB.pageAccent} />
            <div className="px-4 py-3 flex items-start justify-between gap-4 border-b border-zinc-200">
                <div>
                    <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-orange-500" />
                        <h2 className="text-sm font-black uppercase tracking-wider">{title}</h2>
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-0.5">{subtitle}</p>
                </div>
                <IntegrityBadge pulse={data} />
            </div>
            {actions.length === 0 ? (
                <div className="px-4 py-6 flex items-center gap-2 text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">Tidak ada antrian kritis</span>
                </div>
            ) : (
                <div className={`divide-y divide-zinc-100 ${compact ? "" : "md:grid md:grid-cols-2 md:divide-y-0 md:divide-x"}`}>
                    {actions.slice(0, compact ? 4 : 6).map((action) => (
                        <Link
                            key={action.id}
                            href={action.href}
                            className={`flex items-center justify-between gap-3 px-4 py-3 hover:bg-orange-50/60 border-l-4 ${TONE[action.tone].bar}`}
                        >
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 border ${TONE[action.tone].chip}`}>
                                        {action.module}
                                    </span>
                                    <span className="text-sm font-bold truncate">{action.title}</span>
                                </div>
                                <p className="text-[11px] text-zinc-500 mt-0.5 truncate">{action.detail}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                {action.amount ? (
                                    <span className="text-xs font-mono font-black">{formatIDR(action.amount)}</span>
                                ) : action.count != null ? (
                                    <span className="text-lg font-black">{action.count}</span>
                                ) : null}
                                <ChevronRight className="h-4 w-4 text-zinc-400" />
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    )
}

function IntegrityBadge({ pulse }: { pulse: MiningCommandPulse }) {
    const healthy = pulse.integrity.booksHealthy && !pulse.integrity.unpostedPayroll
    return (
        <div className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2 py-1 border ${
            healthy ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"
        }`}>
            {healthy ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
            {healthy ? "Buku sehat" : "Ada yang harus ditutup"}
        </div>
    )
}

const MONEY_LOOP: Array<{
    key: keyof MiningCommandPulse["snapshot"]
    label: string
    href: string
    hint: string
}> = [
    { key: "inventoryValue", label: "Spare part", href: "/inventory", hint: "Nilai gudang" },
    { key: "apOpen", label: "Bill vendor", href: "/finance/bills", hint: "Utang terbuka" },
    { key: "cash", label: "Kas / Bayar", href: "/finance/vendor-payments", hint: "Uang di bank" },
    { key: "arOpen", label: "Invoice", href: "/finance/invoices", hint: "Piutang pelanggan" },
    { key: "payrollCompanyCost", label: "Gaji + BPJS", href: "/hcm/payroll", hint: "Beban perusahaan" },
    { key: "fleetAssetValue", label: "Armada NBV", href: "/fleet", hint: "Aset tetap" },
]

/** Finance wow — satu jalur uang tambang, bukan menu terpisah. */
export function MiningMoneyLoop() {
    const { data } = useMiningCommandPulse()
    if (!data) return null

    return (
        <div className={NB.pageCard}>
            <div className={NB.pageAccent} />
            <div className="px-4 py-3 border-b border-zinc-200">
                <h2 className="text-sm font-black uppercase tracking-wider">Siklus uang tambang</h2>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                    Spare part masuk → bill → bayar → invoice pelanggan → gaji → armada jadi aset. Semua ke GL.
                </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-6 divide-x divide-y md:divide-y-0 divide-zinc-200">
                {MONEY_LOOP.map((step, index) => (
                    <Link
                        key={step.key}
                        href={step.href}
                        className="px-3 py-3 hover:bg-orange-50/70 min-w-0"
                    >
                        <div className="text-[9px] font-black uppercase tracking-widest text-orange-600">
                            {String(index + 1).padStart(2, "0")} · {step.label}
                        </div>
                        <div className="text-sm font-black font-mono mt-1 truncate">
                            {formatIDR(data.snapshot[step.key])}
                        </div>
                        <div className="text-[10px] text-zinc-500 mt-0.5">{step.hint}</div>
                    </Link>
                ))}
            </div>
        </div>
    )
}

export function MiningSnapshotStrip({
    highlight,
}: {
    highlight?: Array<keyof MiningCommandPulse["snapshot"]>
}) {
    const { data } = useMiningCommandPulse()
    if (!data) return null
    const cells: Array<{ key: keyof MiningCommandPulse["snapshot"]; label: string; money?: boolean }> = [
        { key: "cash", label: "Kas", money: true },
        { key: "arOpen", label: "Piutang", money: true },
        { key: "apOpen", label: "Utang", money: true },
        { key: "inventoryValue", label: "Nilai spare part", money: true },
        { key: "fleetAssetValue", label: "NBV armada", money: true },
        { key: "fleetWithoutAsset", label: "Armada tanpa aset" },
        { key: "payrollCompanyCost", label: "Biaya gaji + BPJS", money: true },
    ]
    const shown = highlight
        ? cells.filter((c) => highlight.includes(c.key))
        : cells

    return (
        <div className={`${NB.pageCard} ${NB.kpiStrip}`}>
            {shown.map((cell) => (
                <div key={cell.key} className={NB.kpiCell}>
                    <span className={NB.kpiLabel}>{cell.label}</span>
                    <span className={cell.money ? NB.kpiAmount : NB.kpiCount}>
                        {cell.money ? formatIDR(data.snapshot[cell.key]) : data.snapshot[cell.key]}
                    </span>
                </div>
            ))}
        </div>
    )
}
