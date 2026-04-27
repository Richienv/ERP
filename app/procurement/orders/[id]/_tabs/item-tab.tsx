"use client"
import { DataTable, EmptyState, type ColumnDef } from "@/components/integra"
import { fmtIDR } from "@/lib/integra-tokens"

type Item = {
    id: string
    quantity: number
    receivedQty: number
    unitPrice: number
    totalPrice: number
    product: { id: string; code: string; name: string; unit: string } | null
}

export function ItemTab({ data }: { data: any }) {
    const items: Item[] = data.items ?? []
    if (items.length === 0) {
        return (
            <EmptyState
                title="Belum ada item"
                description="PO ini belum memiliki line item"
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
                    <span className="text-[12px] text-[var(--integra-muted)]">
                        {items.length} item
                    </span>
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
            key: "received",
            header: "Diterima",
            type: "num",
            render: (r) => {
                const received = r.receivedQty ?? 0
                const ratio = r.quantity > 0 ? (received / r.quantity) * 100 : 0
                const color =
                    ratio >= 100
                        ? "text-[var(--integra-green-ok)]"
                        : ratio > 0
                            ? "text-[var(--integra-amber)]"
                            : "text-[var(--integra-muted)]"
                return (
                    <span className={`${color} ${isTotalsRow(r) ? "font-bold" : ""}`}>
                        {received} ({ratio.toFixed(0)}%)
                    </span>
                )
            },
        },
        {
            key: "unitPrice",
            header: "Harga Satuan",
            type: "num",
            render: (r) =>
                isTotalsRow(r) ? (
                    <span className="text-[var(--integra-muted)]">—</span>
                ) : (
                    fmtIDR(r.unitPrice)
                ),
        },
        {
            key: "total",
            header: "Total (Rp)",
            type: "num",
            render: (r) => (
                <span className={`font-mono ${isTotalsRow(r) ? "font-bold" : ""}`}>
                    {fmtIDR(r.totalPrice)}
                </span>
            ),
        },
    ]

    const totals: Item = {
        id: "_totals",
        product: null,
        quantity: items.reduce((s, i) => s + (i.quantity ?? 0), 0),
        receivedQty: items.reduce((s, i) => s + (i.receivedQty ?? 0), 0),
        unitPrice: 0,
        totalPrice: items.reduce((s, i) => s + (i.totalPrice ?? 0), 0),
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
