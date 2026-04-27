"use client"

import Link from "next/link"
import { DataTable, EmptyState, StatusPill, type ColumnDef } from "@/components/integra"
import { INT, fmtIDR, fmtDateShort } from "@/lib/integra-tokens"
import type { VendorDetailPayload } from "@/hooks/use-vendor-detail"

type PoRow = VendorDetailPayload["purchaseOrders"][number]
type PillKind = "ok" | "warn" | "err" | "info" | "neutral"

function statusKind(s: string): PillKind {
    const m: Record<string, PillKind> = {
        PO_DRAFT: "neutral",
        DRAFT: "neutral",
        CANCELLED: "err",
        REJECTED: "err",
        PENDING_APPROVAL: "warn",
        PARTIAL_RECEIVED: "ok",
        APPROVED: "ok",
        RECEIVED: "ok",
        COMPLETED: "ok",
        ORDERED: "info",
        VENDOR_CONFIRMED: "info",
        SHIPPED: "info",
    }
    return m[s] ?? "neutral"
}

function statusLabel(s: string): string {
    const m: Record<string, string> = {
        PO_DRAFT: "Draft",
        DRAFT: "Draft",
        CANCELLED: "Dibatalkan",
        REJECTED: "Ditolak",
        PENDING_APPROVAL: "Menunggu Approval",
        PARTIAL_RECEIVED: "Diterima Sebagian",
        APPROVED: "Disetujui",
        RECEIVED: "Diterima",
        COMPLETED: "Selesai",
        ORDERED: "Dipesan",
        VENDOR_CONFIRMED: "Konfirmasi Vendor",
        SHIPPED: "Dikirim",
    }
    return m[s] ?? s
}

export function RiwayatPoTab({ data }: { data: VendorDetailPayload }) {
    const rows = data.purchaseOrders ?? []

    if (rows.length === 0) {
        return (
            <EmptyState
                title="Belum ada Pesanan Pembelian"
                description="Vendor ini belum pernah menerima PO dari sistem. Buat PR/PO baru untuk memulai transaksi."
            />
        )
    }

    const cols: ColumnDef<PoRow>[] = [
        {
            key: "no",
            header: "No. PO",
            type: "code",
            render: (r) => (
                <Link
                    href={`/procurement/orders/${r.id}`}
                    className="font-mono text-[12px] text-[var(--integra-liren-blue)] hover:underline"
                >
                    {r.number}
                </Link>
            ),
            width: "150px",
        },
        {
            key: "tgl",
            header: "Tanggal",
            render: (r) => (
                <span className="font-mono text-[11.5px] text-[var(--integra-muted)]">
                    {r.orderDate ? fmtDateShort(new Date(r.orderDate)) : "—"}
                </span>
            ),
        },
        {
            key: "eta",
            header: "Tgl. Diharapkan",
            render: (r) => (
                <span className="font-mono text-[11.5px] text-[var(--integra-muted)]">
                    {r.expectedDate ? fmtDateShort(new Date(r.expectedDate)) : "—"}
                </span>
            ),
        },
        {
            key: "items",
            header: "Item",
            type: "num",
            render: (r) => r.itemCount,
        },
        {
            key: "status",
            header: "Status",
            render: (r) => (
                <StatusPill kind={statusKind(r.status)}>{statusLabel(r.status)}</StatusPill>
            ),
        },
        {
            key: "total",
            header: "Total (Rp)",
            type: "num",
            render: (r) => fmtIDR(r.totalAmount),
        },
        {
            key: "aksi",
            header: "Aksi",
            render: (r) => (
                <Link
                    href={`/procurement/orders/${r.id}`}
                    className={INT.pillOutline + " hover:border-[var(--integra-ink)]"}
                >
                    Lihat
                </Link>
            ),
        },
    ]

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className="text-[11.5px] text-[var(--integra-muted)]">
                    Menampilkan {rows.length} PO terakhir. Total semua PO:{" "}
                    <span className="font-mono text-[var(--integra-ink)]">
                        {data.metrics.poTotalCount}
                    </span>
                </div>
                <Link
                    href={`/procurement/orders?vendorIds=${data.id}`}
                    className="text-[11.5px] text-[var(--integra-liren-blue)] hover:underline"
                >
                    Lihat semua PO vendor →
                </Link>
            </div>
            <DataTable<PoRow>
                columns={cols}
                rows={rows}
                rowKey={(r) => r.id}
            />
        </div>
    )
}
