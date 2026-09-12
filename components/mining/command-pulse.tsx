"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, CheckCircle2, ChevronRight, Inbox, RefreshCw, Sparkles } from "lucide-react"
import { getMiningCommandPulse, type CommandAction, type CommandActionModule, type MiningCommandPulse } from "@/lib/actions/mining-command"
import { queryKeys } from "@/lib/query-keys"
import { formatIDR } from "@/lib/utils"
import { NB } from "@/lib/dialog-styles"
import { InlinePendingBar } from "@/components/ui/inline-pending"

const TONE: Record<CommandAction["tone"], { bar: string; chip: string }> = {
    critical: { bar: "border-l-red-500", chip: "bg-red-50 text-red-700 border-red-200" },
    warn: { bar: "border-l-amber-500", chip: "bg-amber-50 text-amber-800 border-amber-200" },
    go: { bar: "border-l-emerald-500", chip: "bg-emerald-50 text-emerald-700 border-emerald-200" },
}

/** Label tingkat urgensi yang dibaca owner tambang, bukan istilah teknis. */
export const SEVERITY_LABEL: Record<CommandAction["tone"], string> = {
    critical: "Segera",
    warn: "Minggu ini",
    go: "Terjadwal",
}

export const MODULE_LABEL: Record<CommandActionModule, string> = {
    finance: "Keuangan",
    procurement: "Pengadaan",
    inventory: "Gudang",
    fleet: "Armada",
    hcm: "SDM",
}

/** Nomor urut antrian gaya inbox: 01, 02, 03 … */
export function queueNumber(index: number) {
    return String(index + 1).padStart(2, "0")
}

export function useMiningCommandPulse() {
    return useQuery({
        queryKey: queryKeys.miningCommand.pulse(),
        queryFn: () => getMiningCommandPulse(),
        staleTime: 30_000,
    })
}

/** Satu baris antrian: nomor, urgensi, judul, nilai, dan satu tombol aksi. */
function InboxRow({ action, index }: { action: CommandAction; index: number }) {
    const tone = TONE[action.tone]
    return (
        <Link
            href={action.href}
            className={`group flex items-center gap-3 px-3 py-3 border-l-4 transition-colors hover:bg-orange-50/70 dark:hover:bg-orange-950/20 ${tone.bar}`}
        >
            <span className="w-7 shrink-0 text-center text-[11px] font-mono font-black text-zinc-400 group-hover:text-orange-500">
                {queueNumber(index)}
            </span>
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`text-xs font-black uppercase tracking-widest px-1.5 py-0.5 border ${tone.chip}`}>
                        {SEVERITY_LABEL[action.tone]}
                    </span>
                    <span className="text-xs font-black uppercase tracking-widest px-1.5 py-0.5 border border-zinc-200 dark:border-zinc-700 text-zinc-500">
                        {MODULE_LABEL[action.module]}
                    </span>
                    <span className="text-sm font-bold truncate">{action.title}</span>
                </div>
                <p className="text-[11px] text-zinc-500 mt-0.5 line-clamp-2">{action.detail}</p>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[10px] text-zinc-400">
                    <span className="font-bold uppercase tracking-wider">{action.owner}</span>
                    {action.due ? <span>· Batas: {action.due}</span> : null}
                    {action.impact ? <span className="hidden md:inline">· {action.impact}</span> : null}
                </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
                {action.amount ? (
                    <span className="text-xs font-mono font-black tabular-nums">{formatIDR(action.amount)}</span>
                ) : action.count != null ? (
                    <span className="text-lg font-black leading-none tabular-nums">{action.count}</span>
                ) : null}
                <span className="inline-flex items-center gap-1 border-2 border-black bg-orange-500 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-transform group-hover:translate-x-[1px] group-hover:translate-y-[1px] group-hover:shadow-none">
                    {action.cta}
                    <ChevronRight className="h-3 w-3" />
                </span>
            </div>
        </Link>
    )
}

function QueueClean({ compact = false }: { compact?: boolean }) {
    return (
        <div className={`flex flex-col items-center justify-center gap-1 text-center ${compact ? "px-4 py-6" : "px-4 py-10"}`}>
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            <span className="text-sm font-black uppercase tracking-widest text-emerald-700">Antrian bersih</span>
            <p className="max-w-sm text-[11px] text-zinc-500">
                Tidak ada pekerjaan yang menahan buku. Semua tagihan, armada, dan gaji sudah tercatat.
            </p>
        </div>
    )
}

function QueueError({ onRetry }: { onRetry: () => void }) {
    return (
        <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center">
            <AlertTriangle className="h-6 w-6 text-red-500" />
            <span className="text-sm font-black uppercase tracking-widest text-red-700">Antrian gagal dimuat</span>
            <p className="text-[11px] text-zinc-500">Koneksi ke data operasi terputus. Coba muat ulang.</p>
            <button
                type="button"
                onClick={onRetry}
                className={`${NB.toolbarBtnPrimary} ml-0 inline-flex items-center gap-1.5`}
            >
                <RefreshCw className="h-3 w-3" />
                Muat ulang
            </button>
        </div>
    )
}

function QueueSkeleton({ rows = 4 }: { rows?: number }) {
    return (
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-4">
                    <div className="h-3 w-6 animate-pulse bg-zinc-200 dark:bg-zinc-800" />
                    <div className="flex-1 space-y-2">
                        <div className="h-3 w-1/2 animate-pulse bg-zinc-200 dark:bg-zinc-800" />
                        <div className="h-2.5 w-3/4 animate-pulse bg-zinc-100 dark:bg-zinc-800/60" />
                    </div>
                    <div className="h-6 w-20 animate-pulse bg-zinc-200 dark:bg-zinc-800" />
                </div>
            ))}
        </div>
    )
}

/**
 * WOW utama dashboard owner: Kotak Masuk Operasi.
 * Semua pekerjaan yang menahan buku KRI jadi satu antrian bernomor,
 * satu tombol per baris, langsung mendarat di layar kerjanya.
 */
export function OperationsInbox({
    title = "Kotak Masuk Operasi",
    subtitle = "Antrian kerja hari ini — kerjakan dari nomor 01, semua langsung ke layar kerjanya",
    module,
    limit = 6,
}: {
    title?: string
    subtitle?: string
    module?: CommandActionModule
    limit?: number
}) {
    const { data, isLoading, isFetching, isError, refetch } = useMiningCommandPulse()
    const actions = (data?.actions ?? []).filter((action) => !module || action.module === module)
    const shown = actions.slice(0, limit)
    const overflow = actions.length - shown.length

    const segera = actions.filter((a) => a.tone === "critical").length
    const mingguIni = actions.filter((a) => a.tone === "warn").length
    const terjadwal = actions.filter((a) => a.tone === "go").length
    const amountHeld = actions.reduce((sum, a) => sum + (a.amount ?? 0), 0)

    return (
        <div className={`${NB.pageCard} relative`}>
            <div className={NB.pageAccent} />
            <InlinePendingBar active={!!(isFetching && data)} />

            {/* Row 1: identitas inbox + status buku */}
            <div className={`flex items-start justify-between gap-4 px-4 py-3 ${NB.pageRowBorder}`}>
                <div className="flex items-start gap-2.5 min-w-0">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center border-2 border-black bg-orange-500 text-white">
                        <Inbox className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h2 className="text-sm font-black uppercase tracking-wider">{title}</h2>
                            <span className="border border-zinc-300 px-1.5 py-0.5 text-xs font-black uppercase tracking-widest text-zinc-500 dark:border-zinc-700">
                                {data ? `${actions.length} tugas` : "memuat"}
                            </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-zinc-500">{subtitle}</p>
                    </div>
                </div>
                {data ? <IntegrityBadge pulse={data} /> : null}
            </div>

            {/* Row 2: KPI strip antrian */}
            <div className={`${NB.kpiStrip} ${NB.pageRowBorder}`}>
                <div className={NB.kpiCell}>
                    <span className={NB.kpiLabel}>Segera</span>
                    <span className={`${NB.kpiCount} ${segera > 0 ? "text-red-600 dark:text-red-500" : ""}`}>
                        {data ? segera : "—"}
                    </span>
                </div>
                <div className={NB.kpiCell}>
                    <span className={NB.kpiLabel}>Minggu ini</span>
                    <span className={NB.kpiCount}>{data ? mingguIni : "—"}</span>
                </div>
                <div className={NB.kpiCell}>
                    <span className={NB.kpiLabel}>Terjadwal</span>
                    <span className={NB.kpiCount}>{data ? terjadwal : "—"}</span>
                </div>
                <div className={`${NB.kpiCell} hidden md:flex`}>
                    <span className={NB.kpiLabel}>Nilai tertahan</span>
                    <span className={NB.kpiAmount}>{data ? formatIDR(amountHeld) : "—"}</span>
                </div>
            </div>

            {/* Row 3: antrian */}
            {isLoading && !data ? (
                <QueueSkeleton rows={3} />
            ) : isError && !data ? (
                <QueueError onRetry={() => void refetch()} />
            ) : shown.length === 0 ? (
                <QueueClean />
            ) : (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {shown.map((action, index) => (
                        <InboxRow key={action.id} action={action} index={index} />
                    ))}
                </div>
            )}

            {overflow > 0 ? (
                <div className={`${NB.filterBar} justify-center text-[10px] font-bold uppercase tracking-wider text-zinc-500`}>
                    +{overflow} tugas lain menunggu di modulnya
                </div>
            ) : null}
        </div>
    )
}

export function CommandPulse({
    title = "Langkah berikutnya",
    subtitle = "Satu klik ke pekerjaan yang benar-benar menggerakkan buku",
    module,
    compact = false,
}: {
    title?: string
    subtitle?: string
    module?: CommandActionModule
    compact?: boolean
}) {
    const { data, isLoading, isFetching, isError, refetch } = useMiningCommandPulse()
    const actions = (data?.actions ?? []).filter((action) => !module || action.module === module)

    if (isLoading && !data) {
        return (
            <div className={NB.pageCard}>
                <div className={NB.pageAccent} />
                <QueueSkeleton rows={2} />
            </div>
        )
    }

    if (isError && !data) {
        return (
            <div className={NB.pageCard}>
                <div className={NB.pageAccent} />
                <QueueError onRetry={() => void refetch()} />
            </div>
        )
    }

    if (!data) return null

    return (
        <div className={`${NB.pageCard} relative`}>
            <div className={NB.pageAccent} />
            <InlinePendingBar active={!!(isFetching && data)} />
            <div className={`flex items-start justify-between gap-4 px-4 py-3 ${NB.pageRowBorder}`}>
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
                <QueueClean compact />
            ) : (
                <div className={`divide-y divide-zinc-100 dark:divide-zinc-800 ${compact ? "" : "md:grid md:grid-cols-2 md:divide-y-0 md:divide-x"}`}>
                    {actions.slice(0, compact ? 4 : 6).map((action, index) => (
                        <InboxRow key={action.id} action={action} index={index} />
                    ))}
                </div>
            )}
        </div>
    )
}

function IntegrityBadge({ pulse }: { pulse: MiningCommandPulse }) {
    const healthy = pulse.integrity.booksHealthy && !pulse.integrity.unpostedPayroll
    return (
        <div className={`flex shrink-0 items-center gap-1.5 text-xs font-black uppercase tracking-widest px-2 py-1 border ${
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
                        <div className="text-xs font-black uppercase tracking-widest text-orange-600">
                            {queueNumber(index)} · {step.label}
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
