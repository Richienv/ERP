"use client"

import { Panel } from "@/components/integra"
import { fmtIDR, fmtIDRJt } from "@/lib/integra-tokens"
import type { VendorDetailPayload } from "@/hooks/use-vendor-detail"

function ratingStars(n: number): string {
    if (!n || n <= 0) return "—"
    const safe = Math.max(0, Math.min(5, Math.round(n)))
    return "★".repeat(safe) + "☆".repeat(5 - safe)
}

function otdColor(otd: number, hasOrders: boolean): string {
    if (!hasOrders) return "text-[var(--integra-muted)]"
    if (otd >= 95) return "text-[var(--integra-green-ok)]"
    if (otd >= 85) return "text-[var(--integra-green-ok)]"
    if (otd >= 75) return "text-[var(--integra-amber)]"
    return "text-[var(--integra-red)]"
}

function performaLabel(otd: number, hasOrders: boolean): { text: string; color: string } {
    if (!hasOrders) return { text: "Belum ada data", color: "text-[var(--integra-muted)]" }
    if (otd >= 95) return { text: "Strategis", color: "text-[var(--integra-green-ok)]" }
    if (otd >= 85) return { text: "Baik", color: "text-[var(--integra-green-ok)]" }
    if (otd >= 75) return { text: "Perlu Review", color: "text-[var(--integra-amber)]" }
    return { text: "Bermasalah", color: "text-[var(--integra-red)]" }
}

export function PerformaTab({ data }: { data: VendorDetailPayload }) {
    const m = data.metrics
    const hasOrders = m.poTotalCount > 0
    const perf = performaLabel(m.otdPct, hasOrders)

    return (
        <div className="space-y-5">
            {/* KPI grid */}
            <div className="grid grid-cols-4 gap-3">
                <KPICard
                    label="Total PO"
                    value={String(m.poTotalCount)}
                    sub="Semua periode"
                />
                <KPICard
                    label="Total Belanja"
                    value={`Rp ${fmtIDRJt(m.totalSpend)}`}
                    sub="Akumulasi nilai PO"
                />
                <KPICard
                    label="Rata-rata PO"
                    value={`Rp ${fmtIDRJt(m.avgPoValue)}`}
                    sub="Per pesanan"
                />
                <KPICard
                    label="Belanja YTD"
                    value={`Rp ${fmtIDRJt(m.ytdPurchases)}`}
                    sub="Tahun berjalan"
                />
            </div>

            {/* Performance metrics */}
            <Panel title="Indikator Kinerja" meta="Berdasarkan riwayat PO">
                <div className="grid grid-cols-2 gap-x-12 gap-y-5">
                    {/* OTD */}
                    <div>
                        <p className="text-[10.5px] uppercase tracking-wider text-[var(--integra-muted)] mb-1">
                            On-Time Delivery (OTD)
                        </p>
                        <div className="flex items-baseline gap-3">
                            <span
                                className={`font-mono text-[28px] font-medium tracking-tight ${otdColor(m.otdPct, hasOrders)}`}
                            >
                                {hasOrders ? `${m.otdPct.toFixed(1)}%` : "—"}
                            </span>
                            <span className={`text-[12.5px] ${perf.color}`}>{perf.text}</span>
                        </div>
                        <div className="mt-2 h-1.5 bg-[#F1EFE8] rounded-[2px] overflow-hidden">
                            <div
                                className={`h-full transition-all ${
                                    m.otdPct >= 85
                                        ? "bg-[var(--integra-green-ok)]"
                                        : m.otdPct >= 75
                                          ? "bg-[var(--integra-amber)]"
                                          : "bg-[var(--integra-red)]"
                                }`}
                                style={{ width: `${Math.min(100, Math.max(0, m.otdPct))}%` }}
                            />
                        </div>
                        <p className="text-[10.5px] text-[var(--integra-muted)] mt-1">
                            {m.completedCount} dari {m.poTotalCount - m.cancelledCount} PO selesai
                            tepat
                        </p>
                    </div>

                    {/* Rejection rate */}
                    <div>
                        <p className="text-[10.5px] uppercase tracking-wider text-[var(--integra-muted)] mb-1">
                            Tingkat Penolakan / Pembatalan
                        </p>
                        <div className="flex items-baseline gap-3">
                            <span
                                className={`font-mono text-[28px] font-medium tracking-tight ${
                                    m.rejectionRate <= 5
                                        ? "text-[var(--integra-green-ok)]"
                                        : m.rejectionRate <= 15
                                          ? "text-[var(--integra-amber)]"
                                          : "text-[var(--integra-red)]"
                                }`}
                            >
                                {hasOrders ? `${m.rejectionRate.toFixed(1)}%` : "—"}
                            </span>
                            <span className="text-[12.5px] text-[var(--integra-muted)]">
                                {m.cancelledCount} PO dibatalkan
                            </span>
                        </div>
                        <div className="mt-2 h-1.5 bg-[#F1EFE8] rounded-[2px] overflow-hidden">
                            <div
                                className={`h-full transition-all ${
                                    m.rejectionRate <= 5
                                        ? "bg-[var(--integra-green-ok)]"
                                        : m.rejectionRate <= 15
                                          ? "bg-[var(--integra-amber)]"
                                          : "bg-[var(--integra-red)]"
                                }`}
                                style={{
                                    width: `${Math.min(100, Math.max(0, m.rejectionRate))}%`,
                                }}
                            />
                        </div>
                        <p className="text-[10.5px] text-[var(--integra-muted)] mt-1">
                            Target idealnya &lt; 5% dari total PO
                        </p>
                    </div>

                    {/* Rating manual */}
                    <div>
                        <p className="text-[10.5px] uppercase tracking-wider text-[var(--integra-muted)] mb-1">
                            Rating Manual (1-5 ★)
                        </p>
                        <div className="flex items-baseline gap-3">
                            <span className="text-[28px] text-[var(--integra-amber)] tracking-tight">
                                {ratingStars(data.rating)}
                            </span>
                            <span className="text-[12.5px] text-[var(--integra-muted)] font-mono">
                                {data.rating > 0 ? `${data.rating}/5` : "Belum dinilai"}
                            </span>
                        </div>
                        <p className="text-[10.5px] text-[var(--integra-muted)] mt-1">
                            Penilaian dari tim procurement
                        </p>
                    </div>

                    {/* Quality / Responsiveness */}
                    <div>
                        <p className="text-[10.5px] uppercase tracking-wider text-[var(--integra-muted)] mb-1">
                            Kualitas & Responsivitas
                        </p>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-[11px] text-[var(--integra-muted)]">
                                    Kualitas
                                </p>
                                <p className="font-mono text-[18px] text-[var(--integra-ink)]">
                                    {data.qualityScore != null
                                        ? `${data.qualityScore.toFixed(1)}`
                                        : "—"}
                                </p>
                            </div>
                            <div>
                                <p className="text-[11px] text-[var(--integra-muted)]">
                                    Respons
                                </p>
                                <p className="font-mono text-[18px] text-[var(--integra-ink)]">
                                    {data.responsiveness != null
                                        ? `${data.responsiveness.toFixed(1)}`
                                        : "—"}
                                </p>
                            </div>
                        </div>
                        <p className="text-[10.5px] text-[var(--integra-muted)] mt-1">
                            Skor 0-100, diisi manual oleh QC
                        </p>
                    </div>
                </div>
            </Panel>

            {/* Trend placeholder */}
            <Panel title="Tren 12 Bulan" meta="Belanja & OTD per bulan">
                <div className="h-[180px] flex items-center justify-center text-[12px] text-[var(--integra-muted)] border border-dashed border-[var(--integra-hairline)] rounded-[3px]">
                    Grafik tren kinerja vendor 12 bulan terakhir akan tersedia di rilis berikutnya
                </div>
            </Panel>

            {/* Outstanding */}
            <Panel title="Saldo Hutang" meta="Outstanding Account Payable">
                <div className="flex items-baseline gap-3">
                    <span
                        className={`font-mono text-[28px] font-medium tracking-tight ${
                            m.outstandingAp > 0
                                ? "text-[var(--integra-amber)]"
                                : "text-[var(--integra-green-ok)]"
                        }`}
                    >
                        Rp {fmtIDR(m.outstandingAp)}
                    </span>
                    <span className="text-[12.5px] text-[var(--integra-muted)]">
                        {m.outstandingAp > 0
                            ? "Total tagihan vendor yang belum dibayar"
                            : "Tidak ada hutang outstanding"}
                    </span>
                </div>
            </Panel>
        </div>
    )
}

function KPICard({
    label,
    value,
    sub,
}: {
    label: string
    value: string
    sub?: string
}) {
    return (
        <div className="bg-[var(--integra-canvas-pure)] border border-[var(--integra-hairline)] rounded-[3px] px-3.5 py-3 min-h-[92px] flex flex-col justify-between">
            <p className="text-[10.5px] font-semibold tracking-[0.12em] uppercase text-[var(--integra-muted)]">
                {label}
            </p>
            <div>
                <p className="font-mono text-[20px] font-medium tracking-[-0.025em] text-[var(--integra-ink)]">
                    {value}
                </p>
                {sub ? (
                    <p className="text-[11px] text-[var(--integra-muted)] mt-1">{sub}</p>
                ) : null}
            </div>
        </div>
    )
}
