"use client"

import Link from "next/link"
import { DataTable, EmptyState, Panel, StatusPill, type ColumnDef } from "@/components/integra"
import { fmtIDR, fmtDateShort } from "@/lib/integra-tokens"
import type { VendorDetailPayload } from "@/hooks/use-vendor-detail"

type BillRow = VendorDetailPayload["invoices"][number]
type PaymentRow = VendorDetailPayload["payments"][number]
type PillKind = "ok" | "warn" | "err" | "info" | "neutral"

function billStatusKind(s: string): PillKind {
    const m: Record<string, PillKind> = {
        DRAFT: "neutral",
        ISSUED: "info",
        PARTIAL: "warn",
        PAID: "ok",
        OVERDUE: "err",
        CANCELLED: "neutral",
        VOID: "neutral",
        DISPUTED: "err",
    }
    return m[s] ?? "neutral"
}

function billStatusLabel(s: string): string {
    const m: Record<string, string> = {
        DRAFT: "Draft",
        ISSUED: "Diterbitkan",
        PARTIAL: "Cicilan",
        PAID: "Lunas",
        OVERDUE: "Terlambat",
        CANCELLED: "Dibatalkan",
        VOID: "Void",
        DISPUTED: "Dispute",
    }
    return m[s] ?? s
}

// Payment.glPostingStatus enum: PENDING | POSTED | FAILED (lihat schema.prisma).
// Label-label lain (DRAFT/APPROVED/COMPLETED/CANCELLED) diretain untuk
// kompatibilitas — tidak terjadi error kalau muncul varian status lama.
function paymentStatusKind(s: string): PillKind {
    const m: Record<string, PillKind> = {
        DRAFT: "neutral",
        PENDING: "warn",
        POSTED: "ok",
        APPROVED: "info",
        COMPLETED: "ok",
        CANCELLED: "neutral",
        FAILED: "err",
    }
    return m[s] ?? "neutral"
}

function paymentStatusLabel(s: string): string {
    const m: Record<string, string> = {
        DRAFT: "Draf",
        PENDING: "Menunggu",
        POSTED: "Disetujui",
        APPROVED: "Disetujui",
        COMPLETED: "Selesai",
        CANCELLED: "Dibatalkan",
        FAILED: "Gagal",
    }
    return m[s] ?? s
}

export function PembayaranTab({ data }: { data: VendorDetailPayload }) {
    const bills = data.invoices ?? []
    const payments = data.payments ?? []
    const m = data.metrics

    const billCols: ColumnDef<BillRow>[] = [
        {
            key: "no",
            header: "No. Tagihan",
            type: "code",
            render: (r) => (
                <Link
                    href={`/finance/invoices/${r.id}`}
                    className="font-mono text-[11.5px] text-[var(--integra-liren-blue)] hover:underline"
                    title={`Buka detail tagihan ${r.number}`}
                >
                    {r.number}
                </Link>
            ),
            width: "150px",
        },
        {
            key: "tgl",
            header: "Tgl Terbit",
            render: (r) => (
                <span className="font-mono text-[11.5px] text-[var(--integra-muted)]">
                    {fmtDateShort(new Date(r.issueDate))}
                </span>
            ),
        },
        {
            key: "due",
            header: "Jatuh Tempo",
            render: (r) => (
                <span className="font-mono text-[11.5px] text-[var(--integra-muted)]">
                    {fmtDateShort(new Date(r.dueDate))}
                </span>
            ),
        },
        {
            key: "total",
            header: "Total (Rp)",
            type: "num",
            render: (r) => fmtIDR(r.totalAmount),
        },
        {
            key: "outstanding",
            header: "Sisa (Rp)",
            type: "num",
            render: (r) => (
                <span
                    className={
                        r.balanceDue > 0
                            ? "font-mono text-[var(--integra-amber)]"
                            : "font-mono text-[var(--integra-muted)]"
                    }
                >
                    {fmtIDR(r.balanceDue)}
                </span>
            ),
        },
        {
            key: "status",
            header: "Status",
            render: (r) => (
                <StatusPill kind={billStatusKind(r.status)}>{billStatusLabel(r.status)}</StatusPill>
            ),
        },
    ]

    const paymentCols: ColumnDef<PaymentRow>[] = [
        {
            key: "no",
            header: "No. Pembayaran",
            type: "code",
            render: (r) => (
                <span className="font-mono text-[11.5px] text-[var(--integra-ink)]">
                    {r.number}
                </span>
            ),
            width: "150px",
        },
        {
            key: "date",
            header: "Tanggal",
            render: (r) => (
                <span className="font-mono text-[11.5px] text-[var(--integra-muted)]">
                    {fmtDateShort(new Date(r.date))}
                </span>
            ),
        },
        {
            key: "method",
            header: "Metode",
            render: (r) => (
                <span className="text-[12px]">
                    {r.method ?? "—"}
                </span>
            ),
        },
        {
            key: "amount",
            header: "Jumlah (Rp)",
            type: "num",
            render: (r) => fmtIDR(r.amount),
        },
        {
            key: "status",
            header: "Status",
            render: (r) => (
                <StatusPill kind={paymentStatusKind(r.status)}>
                    {paymentStatusLabel(r.status)}
                </StatusPill>
            ),
        },
    ]

    return (
        <div className="space-y-5">
            {/* Summary KPIs */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-[var(--integra-canvas-pure)] border border-[var(--integra-hairline)] rounded-[3px] px-3.5 py-3">
                    <p className="text-[10.5px] font-semibold tracking-[0.12em] uppercase text-[var(--integra-muted)]">
                        Outstanding AP
                    </p>
                    <p
                        className={`font-mono text-[22px] mt-1 ${
                            m.outstandingAp > 0
                                ? "text-[var(--integra-amber)]"
                                : "text-[var(--integra-green-ok)]"
                        }`}
                    >
                        Rp {fmtIDR(m.outstandingAp)}
                    </p>
                    <p className="text-[11px] text-[var(--integra-muted)] mt-1">
                        Total tagihan belum dibayar
                    </p>
                </div>
                <div className="bg-[var(--integra-canvas-pure)] border border-[var(--integra-hairline)] rounded-[3px] px-3.5 py-3">
                    <p className="text-[10.5px] font-semibold tracking-[0.12em] uppercase text-[var(--integra-muted)]">
                        Belanja YTD
                    </p>
                    <p className="font-mono text-[22px] mt-1 text-[var(--integra-ink)]">
                        Rp {fmtIDR(m.ytdPurchases)}
                    </p>
                    <p className="text-[11px] text-[var(--integra-muted)] mt-1">
                        Tahun berjalan
                    </p>
                </div>
                <div className="bg-[var(--integra-canvas-pure)] border border-[var(--integra-hairline)] rounded-[3px] px-3.5 py-3">
                    <p className="text-[10.5px] font-semibold tracking-[0.12em] uppercase text-[var(--integra-muted)]">
                        Total Belanja
                    </p>
                    <p className="font-mono text-[22px] mt-1 text-[var(--integra-ink)]">
                        Rp {fmtIDR(m.totalSpend)}
                    </p>
                    <p className="text-[11px] text-[var(--integra-muted)] mt-1">
                        Akumulasi semua periode
                    </p>
                </div>
            </div>

            {/* Bills */}
            <Panel
                title="Tagihan Vendor (AP)"
                meta={`${bills.length} terakhir`}
                bodyClassName="p-0"
            >
                {bills.length === 0 ? (
                    <EmptyState
                        title="Belum ada tagihan"
                        description="Vendor ini belum memiliki tagihan terdaftar di sistem keuangan."
                    />
                ) : (
                    <DataTable<BillRow>
                        columns={billCols}
                        rows={bills}
                        rowKey={(r) => r.id}
                    />
                )}
            </Panel>

            {/* Payments */}
            <Panel
                title="Riwayat Pembayaran"
                meta={`${payments.length} pembayaran terakhir`}
                bodyClassName="p-0"
            >
                {payments.length === 0 ? (
                    <EmptyState
                        title="Belum ada pembayaran"
                        description="Belum ada catatan pembayaran ke vendor ini di sistem keuangan."
                    />
                ) : (
                    <DataTable<PaymentRow>
                        columns={paymentCols}
                        rows={payments}
                        rowKey={(r) => r.id}
                    />
                )}
            </Panel>
        </div>
    )
}
