"use client"
import { DataTable, EmptyState, StatusPill, type ColumnDef } from "@/components/integra"
import { fmtIDR } from "@/lib/integra-tokens"

type Item = {
    id: string
    quantity: number
    unitPrice: number
    totalPrice: number
    status: string
    targetDate: string | Date | null
    notes: string | null
    product: {
        id: string
        code: string
        name: string
        unit: string
        costPrice?: number
    } | null
    preferredSupplier?: {
        id: string
        name: string
    } | null
}

function itemStatusKind(s: string): "ok" | "warn" | "err" | "info" | "neutral" {
    const m: Record<string, "ok" | "warn" | "err" | "info" | "neutral"> = {
        PENDING: "warn",
        APPROVED: "ok",
        REJECTED: "err",
        PO_CREATED: "info",
    }
    return m[s] ?? "neutral"
}

function itemStatusLabel(s: string): string {
    const m: Record<string, string> = {
        PENDING: "Menunggu",
        APPROVED: "Disetujui",
        REJECTED: "Ditolak",
        PO_CREATED: "Dikonversi",
    }
    return m[s] ?? s
}

export function ItemTab({ data }: { data: any }) {
    const items: Item[] = data.items ?? []
    if (items.length === 0) {
        return (
            <EmptyState
                title="Belum ada item"
                description="PR ini belum memiliki line item"
            />
        )
    }

    const isTotalsRow = (r: Item) => r.id === "_totals"

    const cols: ColumnDef<Item>[] = [
        {
            key: "no",
            header: "#",
            type: "muted",
            render: (r) =>
                isTotalsRow(r) ? (
                    <span className="font-bold uppercase tracking-wider text-[10px] text-[var(--integra-ink)]">
                        Total
                    </span>
                ) : (
                    <span className="font-mono text-[10.5px]">{items.indexOf(r) + 1}</span>
                ),
            width: "60px",
        },
        {
            key: "code",
            header: "SKU",
            type: "code",
            render: (r) =>
                isTotalsRow(r) ? (
                    <span className="text-[var(--integra-muted)]">—</span>
                ) : (
                    <span className="font-mono text-[11.5px]">{r.product?.code ?? "—"}</span>
                ),
            width: "110px",
        },
        {
            key: "name",
            header: "Produk",
            type: "primary",
            render: (r) =>
                isTotalsRow(r) ? (
                    <span className="text-[12px] text-[var(--integra-muted)]">{items.length} item</span>
                ) : (
                    r.product?.name ?? "—"
                ),
        },
        {
            key: "qty",
            header: "Qty",
            type: "num",
            render: (r) => {
                const unit = isTotalsRow(r) ? "" : r.product?.unit ?? ""
                return (
                    <span className={isTotalsRow(r) ? "font-bold" : ""}>
                        {r.quantity}
                        {unit ? ` ${unit}` : ""}
                    </span>
                )
            },
        },
        {
            key: "unitPrice",
            header: "Estimasi Harga",
            type: "num",
            render: (r) =>
                isTotalsRow(r) ? (
                    <span className="text-[var(--integra-muted)]">—</span>
                ) : r.unitPrice ? (
                    fmtIDR(r.unitPrice)
                ) : (
                    <span className="text-[var(--integra-muted)]">—</span>
                ),
        },
        {
            key: "total",
            header: "Subtotal Estimasi (Rp)",
            type: "num",
            render: (r) => (
                <span className={`font-mono ${isTotalsRow(r) ? "font-bold" : ""}`}>
                    {fmtIDR(r.totalPrice)}
                </span>
            ),
        },
        {
            key: "supplier",
            header: "Vendor Preferensi",
            render: (r) =>
                isTotalsRow(r) ? (
                    <span className="text-[var(--integra-muted)]">—</span>
                ) : r.preferredSupplier ? (
                    <span className="text-[12px]">{r.preferredSupplier.name}</span>
                ) : (
                    <span className="text-[var(--integra-muted)]">—</span>
                ),
        },
        {
            key: "status",
            header: "Status",
            render: (r) =>
                isTotalsRow(r) ? null : (
                    <StatusPill kind={itemStatusKind(r.status)}>{itemStatusLabel(r.status)}</StatusPill>
                ),
        },
    ]

    const totals: Item = {
        id: "_totals",
        product: null,
        quantity: items.reduce((s, i) => s + (i.quantity ?? 0), 0),
        unitPrice: 0,
        totalPrice: items.reduce((s, i) => s + (i.totalPrice ?? 0), 0),
        status: "",
        targetDate: null,
        notes: null,
    }

    return (
        <DataTable<Item>
            columns={cols}
            rows={items}
            rowKey={(r) => r.id}
            totals={totals}
        />
    )
}
