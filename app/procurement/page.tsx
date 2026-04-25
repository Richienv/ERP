"use client"

import { useCallback, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { IconFilter, IconDownload, IconPlus } from "@tabler/icons-react"

import { useProcurementDashboard } from "@/hooks/use-procurement-dashboard"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import {
    Panel, KPIRail, StatusPill, IntegraButton,
    PageHead, LiveDot, SegmentedButtons, DataTable, EmptyState,
    type ColumnDef, type KPIData,
} from "@/components/integra"
import { INT, fmtIDR, fmtIDRJt, fmtDateShort, fmtDateTime } from "@/lib/integra-tokens"

type Period = "1H" | "7H" | "30H" | "TTD" | "12B"
type PillKind = "ok" | "warn" | "err" | "info" | "neutral"

function statusKind(s: string): PillKind {
    const m: Record<string, PillKind> = {
        DRAFT: "neutral", PO_DRAFT: "neutral", CANCELLED: "neutral",
        PENDING: "warn", PENDING_APPROVAL: "warn", INSPECTING: "warn",
        PARTIAL_RECEIVED: "warn", PARTIAL_ACCEPTED: "warn",
        APPROVED: "ok", RECEIVED: "ok", ACCEPTED: "ok", COMPLETED: "ok",
        REJECTED: "err",
        PO_CREATED: "info", ORDERED: "info", VENDOR_CONFIRMED: "info", SHIPPED: "info",
    }
    return m[s] ?? "neutral"
}

function statusLabel(s: string): string {
    const m: Record<string, string> = {
        DRAFT: "Draft", PO_DRAFT: "Draft", CANCELLED: "Dibatalkan",
        PENDING: "Pending", PENDING_APPROVAL: "Menunggu Approval",
        INSPECTING: "Inspeksi", PARTIAL_RECEIVED: "Sebagian", PARTIAL_ACCEPTED: "Sebagian",
        APPROVED: "Disetujui", RECEIVED: "Diterima", ACCEPTED: "Diterima", COMPLETED: "Selesai",
        REJECTED: "Ditolak",
        PO_CREATED: "PO Dibuat", ORDERED: "Dipesan", VENDOR_CONFIRMED: "Konfirmasi", SHIPPED: "Dikirim",
    }
    return m[s] ?? s
}

function priorityKind(p: string): PillKind {
    const u = (p ?? "").toUpperCase()
    if (u === "HIGH" || u === "URGENT") return "warn"
    if (u === "MEDIUM" || u === "NORMAL") return "info"
    return "neutral"
}

function priorityLabel(p: string): string {
    const u = (p ?? "").toUpperCase()
    if (u === "HIGH") return "Tinggi"
    if (u === "URGENT") return "Urgent"
    if (u === "MEDIUM") return "Sedang"
    if (u === "NORMAL") return "Normal"
    if (u === "LOW") return "Rendah"
    return p ?? "—"
}

function activityDotColor(type: string): string {
    const t = (type ?? "").toLowerCase()
    if (t.includes("approv") || t.includes("complet") || t.includes("receiv")) return "var(--integra-green-ok)"
    if (t.includes("reject") || t.includes("cancel")) return "var(--integra-red)"
    if (t.includes("pending") || t.includes("inspect")) return "var(--integra-amber)"
    if (t.includes("po") || t.includes("order") || t.includes("ship")) return "var(--integra-liren-blue)"
    return "var(--integra-muted)"
}

function fmtActivityTime(d: any): string {
    try {
        const date = new Date(d)
        const isToday = date.toDateString() === new Date().toDateString()
        if (isToday) {
            return new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date)
        }
        return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "2-digit" }).format(date)
    } catch { return "—" }
}

function fiscalLabel(): string {
    const now = new Date()
    const fy = `FY${String(now.getFullYear()).slice(2)}`
    const month = now.getMonth()
    const q = month < 3 ? "Q1" : month < 6 ? "Q2" : month < 9 ? "Q3" : "Q4"
    return `${fy} ${q}`
}

export default function ProcurementPage() {
    const searchParams = useSearchParams()
    const [period, setPeriod] = useState<Period>("30H")
    const { data, isLoading } = useProcurementDashboard(searchParams.toString())

    const buildHref = useCallback((overrides: Record<string, string | null>) => {
        const next = new URLSearchParams(searchParams.toString())
        Object.entries(overrides).forEach(([key, value]) => {
            if (!value) next.delete(key)
            else next.set(key, value)
        })
        const qs = next.toString()
        return qs ? `/procurement?${qs}` : "/procurement"
    }, [searchParams])

    if (isLoading || !data) {
        return <TablePageSkeleton accentColor="bg-blue-400" />
    }

    const {
        spend,
        needsApproval,
        urgentNeeds,
        vendorHealth,
        incomingCount,
        recentActivity,
        purchaseOrders,
        purchaseRequests,
        receiving,
    } = data

    const growth = spend?.growth ?? 0
    const deltaKind: "up" | "down" | "flat" = growth > 0 ? "up" : growth < 0 ? "down" : "flat"

    const kpis: KPIData[] = [
        {
            label: "Belanja Bulan Ini",
            value: fmtIDR(spend?.current ?? 0),
            unit: "Rp",
            delta: growth / 100,
            deltaKind,
            foot: "vs bulan lalu",
        },
        {
            label: "Butuh Approval",
            value: String(needsApproval ?? 0),
            foot: "PR + PO menunggu",
        },
        {
            label: "Kebutuhan Urgent",
            value: String(urgentNeeds ?? 0),
            foot: "stok < safety",
        },
        {
            label: "Vendor On-Time",
            value: (vendorHealth?.onTime ?? 0).toFixed(0),
            unit: "%",
            foot: `rating ★ ${(vendorHealth?.rating ?? 0).toFixed(1)}`,
        },
        {
            label: "Inbound Hari Ini",
            value: String(incomingCount ?? 0),
            foot: "GRN dijadwalkan",
        },
    ]

    // ──── PO columns
    const poRows = purchaseOrders?.recent ?? []
    const poCols: ColumnDef<any>[] = [
        {
            key: "no",
            header: "No PO",
            type: "code",
            render: (r) => <span className="font-mono text-[11.5px] text-[var(--integra-ink)]">{r.number ?? "—"}</span>,
        },
        {
            key: "vendor",
            header: "Vendor",
            type: "primary",
            render: (r) => r.supplier?.name ?? r.supplier ?? "—",
        },
        {
            key: "status",
            header: "Status",
            render: (r) => <StatusPill kind={statusKind(r.status)}>{statusLabel(r.status)}</StatusPill>,
        },
        {
            key: "nilai",
            header: "Nilai (Rp jt)",
            type: "num",
            render: (r) => {
                const v = r.total ?? r.totalAmount ?? 0
                return v ? fmtIDRJt(v).replace(/\s?(jt|M|rb)$/, "") : "—"
            },
        },
        {
            key: "tgl",
            header: "Tanggal",
            type: "muted",
            render: (r) => {
                const d = r.date ?? r.createdAt
                return d
                    ? <span className="font-mono text-[11.5px] text-[var(--integra-muted)]">{fmtDateShort(new Date(d))}</span>
                    : "—"
            },
        },
    ]

    // ──── PR columns
    const prRows = purchaseRequests?.recent ?? []
    const prCols: ColumnDef<any>[] = [
        {
            key: "no",
            header: "No PR",
            type: "code",
            render: (r) => <span className="font-mono text-[11.5px] text-[var(--integra-ink)]">{r.number ?? "—"}</span>,
        },
        {
            key: "dept",
            header: "Departemen",
            render: (r) => r.department ?? r.requester?.firstName ?? r.requester ?? "—",
        },
        {
            key: "prio",
            header: "Prioritas",
            render: (r) => <StatusPill kind={priorityKind(r.priority)}>{priorityLabel(r.priority)}</StatusPill>,
        },
        {
            key: "status",
            header: "Status",
            render: (r) => <StatusPill kind={statusKind(r.status)}>{statusLabel(r.status)}</StatusPill>,
        },
        {
            key: "tgl",
            header: "Tanggal",
            type: "muted",
            render: (r) => {
                const d = r.date ?? r.createdAt
                return d
                    ? <span className="font-mono text-[11.5px] text-[var(--integra-muted)]">{fmtDateShort(new Date(d))}</span>
                    : "—"
            },
        },
    ]

    // ──── GRN columns
    const grnRows = receiving?.recent ?? []
    const grnCols: ColumnDef<any>[] = [
        {
            key: "no",
            header: "No GRN",
            type: "code",
            render: (r) => <span className="font-mono text-[11.5px] text-[var(--integra-ink)]">{r.number ?? "—"}</span>,
        },
        {
            key: "vendor",
            header: "Vendor",
            type: "primary",
            render: (r) => r.supplier?.name ?? r.supplier ?? "—",
        },
        {
            key: "status",
            header: "Status",
            render: (r) => <StatusPill kind={statusKind(r.status)}>{statusLabel(r.status)}</StatusPill>,
        },
        {
            key: "tgl",
            header: "Tgl Terima",
            type: "muted",
            render: (r) => {
                const d = r.date ?? r.receivedAt ?? r.createdAt
                return d
                    ? <span className="font-mono text-[11.5px] text-[var(--integra-muted)]">{fmtDateShort(new Date(d))}</span>
                    : "—"
            },
        },
    ]

    const poSummary = purchaseOrders?.summary ?? { draft: 0, pendingApproval: 0, approved: 0, inProgress: 0 }
    const pipelineCells: { label: string; value: number }[] = [
        { label: "Draf", value: poSummary.draft ?? 0 },
        { label: "Menunggu Approval", value: poSummary.pendingApproval ?? 0 },
        { label: "Disetujui", value: poSummary.approved ?? 0 },
        { label: "Sedang Berjalan", value: poSummary.inProgress ?? 0 },
    ]

    return (
        <>
            {/* Topbar */}
            <div className={INT.topbar}>
                <div className={INT.breadcrumb}>
                    <span>Beranda</span>
                    <span>/</span>
                    <span className={INT.breadcrumbCurrent}>Pengadaan</span>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <SegmentedButtons<Period>
                        options={[
                            { value: "1H", label: "1H" },
                            { value: "7H", label: "7H" },
                            { value: "30H", label: "30H" },
                            { value: "TTD", label: "TTD" },
                            { value: "12B", label: "12B" },
                        ]}
                        value={period}
                        onChange={setPeriod}
                    />
                    <IntegraButton variant="secondary" icon={<IconFilter className="w-3.5 h-3.5" />}>
                        Filter
                    </IntegraButton>
                    <IntegraButton variant="secondary" icon={<IconDownload className="w-3.5 h-3.5" />}>
                        Ekspor
                    </IntegraButton>
                    <IntegraButton variant="primary" icon={<IconPlus className="w-3.5 h-3.5" />} href="/procurement/orders">
                        Lihat Pesanan Pembelian
                    </IntegraButton>
                </div>
            </div>

            {/* Page content */}
            <div className="px-6 py-5 space-y-3">
                <PageHead
                    title="Dasbor Pengadaan"
                    subtitle="Monitor procurement pipeline · live data"
                    metaRight={
                        <div className="flex items-center gap-5 text-[12px] text-[var(--integra-muted)]">
                            <span className="flex items-center gap-2">
                                <LiveDot />
                                <span className="font-mono text-[11.5px] text-[var(--integra-ink)]">LIVE</span>
                            </span>
                            <span>
                                Sinkron <span className="font-mono text-[11.5px] text-[var(--integra-ink)]">{fmtDateTime(new Date())}</span>
                            </span>
                            <span>
                                Fiskal <span className="font-mono text-[11.5px] text-[var(--integra-ink)]">{fiscalLabel()}</span>
                            </span>
                        </div>
                    }
                />

                {/* KPI Rail */}
                <KPIRail items={kpis} />

                {/* Section: PO + Pipeline */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                        <Panel
                            title="Pesanan Pembelian"
                            meta={`${poRows.length} terbaru`}
                            actions={
                                <Link
                                    href={buildHref({ po_page: null })}
                                    className="text-[11.5px] text-[var(--integra-muted)] hover:text-[var(--integra-ink)]"
                                >
                                    Lihat semua →
                                </Link>
                            }
                            bodyClassName="p-0"
                        >
                            {poRows.length === 0 ? (
                                <EmptyState title="Belum ada PO" />
                            ) : (
                                <DataTable
                                    columns={poCols}
                                    rows={poRows}
                                    rowKey={(r: any) => r.id ?? r.number}
                                />
                            )}
                        </Panel>
                    </div>

                    <Panel title="Status Pipeline" meta="PO" bodyClassName="p-0">
                        <ul className="m-0 p-0 list-none">
                            {pipelineCells.map((c) => (
                                <li
                                    key={c.label}
                                    className="flex items-center justify-between px-3.5 py-2.5 border-b border-[var(--integra-hairline)] last:border-b-0"
                                >
                                    <span className="text-[12.5px] text-[var(--integra-muted)]">{c.label}</span>
                                    <span className="font-mono text-[18px] tracking-[-0.025em] text-[var(--integra-ink)]">
                                        {c.value}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </Panel>
                </div>

                {/* Section: PR + GRN + Activity */}
                <div className="grid grid-cols-3 gap-3">
                    <Panel
                        title="Permintaan (PR)"
                        meta={`${prRows.length} terbaru`}
                        actions={
                            <Link
                                href="/procurement/requests"
                                className="text-[11.5px] text-[var(--integra-muted)] hover:text-[var(--integra-ink)]"
                            >
                                Lihat semua →
                            </Link>
                        }
                        bodyClassName="p-0"
                    >
                        {prRows.length === 0 ? (
                            <EmptyState title="Belum ada permintaan" />
                        ) : (
                            <DataTable
                                columns={prCols}
                                rows={prRows}
                                rowKey={(r: any) => r.id ?? r.number}
                            />
                        )}
                    </Panel>

                    <Panel
                        title="Surat Jalan Masuk"
                        meta={`${grnRows.length} terbaru`}
                        actions={
                            <Link
                                href="/procurement/receiving"
                                className="text-[11.5px] text-[var(--integra-muted)] hover:text-[var(--integra-ink)]"
                            >
                                Lihat semua →
                            </Link>
                        }
                        bodyClassName="p-0"
                    >
                        {grnRows.length === 0 ? (
                            <EmptyState title="Belum ada penerimaan" />
                        ) : (
                            <DataTable
                                columns={grnCols}
                                rows={grnRows}
                                rowKey={(r: any) => r.id ?? r.number}
                            />
                        )}
                    </Panel>

                    <Panel title="Aktivitas Terkini" meta={`${(recentActivity ?? []).length} entri`} bodyClassName="p-0">
                        {(recentActivity ?? []).length === 0 ? (
                            <EmptyState title="Belum ada aktivitas" />
                        ) : (
                            <ul className="m-0 p-0 list-none">
                                {recentActivity.slice(0, 8).map((a: any, i: number) => (
                                    <li
                                        key={a.id ?? i}
                                        className="grid grid-cols-[12px_1fr_auto] items-baseline gap-2.5 px-3.5 py-2 border-b border-[var(--integra-hairline)] last:border-b-0"
                                    >
                                        <span
                                            className="w-1.5 h-1.5 rounded-full mt-1"
                                            style={{ background: activityDotColor(a.type ?? "") }}
                                        />
                                        <span className="text-[12.5px] text-[var(--integra-ink-soft)] truncate">
                                            {a.label ?? a.supplier?.name ?? a.message ?? "—"}
                                        </span>
                                        <span className="font-mono text-[10.5px] text-[var(--integra-muted)] text-right">
                                            {fmtActivityTime(a.timestamp ?? a.createdAt ?? new Date())}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Panel>
                </div>
            </div>
        </>
    )
}
