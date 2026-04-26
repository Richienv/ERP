"use client"
import { Check, X } from "lucide-react"
import { DataTable, EmptyState, type ColumnDef } from "@/components/integra"
import { fmtIDR } from "@/lib/integra-tokens"

type Item = {
    id: string
    quantityOrdered: number
    quantityReceived: number
    quantityAccepted: number
    quantityRejected: number
    unitCost: number
    inspectionNotes: string | null
    product: { id: string; code: string; name: string; unit: string } | null
    poItem?: { quantity: number } | null
}

export function ItemTab({ data }: { data: any }) {
    const items: Item[] = data.items ?? []
    if (items.length === 0) {
        return (
            <EmptyState
                title="Belum ada item"
                description="GRN ini belum memiliki line item yang tercatat."
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
            width: "120px",
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
            key: "qtyOrdered",
            header: "Qty Pesanan",
            type: "num",
            render: (r) => {
                const unit = isTotalsRow(r) ? "" : r.product?.unit ?? ""
                return (
                    <span className={isTotalsRow(r) ? "font-bold" : ""}>
                        {r.quantityOrdered}
                        {unit ? ` ${unit}` : ""}
                    </span>
                )
            },
        },
        {
            key: "qtyReceived",
            header: "Qty Diterima",
            type: "num",
            render: (r) => (
                <span className={isTotalsRow(r) ? "font-bold" : ""}>{r.quantityReceived}</span>
            ),
        },
        {
            key: "qtyAccepted",
            header: "Qty OK",
            type: "num",
            render: (r) => (
                <span
                    className={`text-[var(--integra-green-ok)] ${isTotalsRow(r) ? "font-bold" : ""}`}
                >
                    {r.quantityAccepted}
                </span>
            ),
        },
        {
            key: "qtyRejected",
            header: "Qty Tolak",
            type: "num",
            render: (r) => {
                const v = r.quantityRejected
                const cls = v > 0 ? "text-[var(--integra-red)]" : "text-[var(--integra-muted)]"
                return <span className={`${cls} ${isTotalsRow(r) ? "font-bold" : ""}`}>{v}</span>
            },
        },
        {
            key: "match",
            header: "Sesuai?",
            render: (r) => {
                if (isTotalsRow(r)) return <span className="text-[var(--integra-muted)]">—</span>
                const ordered = r.quantityOrdered
                const received = r.quantityReceived
                const matches = received === ordered && r.quantityRejected === 0
                if (matches) {
                    return (
                        <span className="inline-flex items-center gap-1 text-[11px] text-[var(--integra-green-ok)]">
                            <Check className="size-3" /> Sesuai
                        </span>
                    )
                }
                if (received < ordered) {
                    return (
                        <span className="inline-flex items-center gap-1 text-[11px] text-[var(--integra-amber)]">
                            Kurang {ordered - received}
                        </span>
                    )
                }
                if (r.quantityRejected > 0) {
                    return (
                        <span className="inline-flex items-center gap-1 text-[11px] text-[var(--integra-red)]">
                            <X className="size-3" /> Ada cacat
                        </span>
                    )
                }
                return (
                    <span className="inline-flex items-center gap-1 text-[11px] text-[var(--integra-amber)]">
                        Lebih {received - ordered}
                    </span>
                )
            },
            width: "120px",
        },
        {
            key: "unitCost",
            header: "Harga",
            type: "num",
            render: (r) =>
                isTotalsRow(r) ? (
                    <span className="text-[var(--integra-muted)]">—</span>
                ) : (
                    fmtIDR(r.unitCost)
                ),
        },
        {
            key: "totalValue",
            header: "Subtotal (Rp)",
            type: "num",
            render: (r) => (
                <span className={`font-mono ${isTotalsRow(r) ? "font-bold" : ""}`}>
                    {fmtIDR(r.unitCost * r.quantityAccepted)}
                </span>
            ),
        },
        {
            key: "notes",
            header: "Catatan",
            render: (r) =>
                isTotalsRow(r) ? (
                    <span className="text-[var(--integra-muted)]">—</span>
                ) : (
                    <span className="text-[11.5px] text-[var(--integra-ink-soft)]">
                        {r.inspectionNotes ?? "—"}
                    </span>
                ),
        },
    ]

    const totals: Item = {
        id: "_totals",
        product: null,
        quantityOrdered: items.reduce((s, i) => s + (i.quantityOrdered ?? 0), 0),
        quantityReceived: items.reduce((s, i) => s + (i.quantityReceived ?? 0), 0),
        quantityAccepted: items.reduce((s, i) => s + (i.quantityAccepted ?? 0), 0),
        quantityRejected: items.reduce((s, i) => s + (i.quantityRejected ?? 0), 0),
        unitCost: 0,
        inspectionNotes: null,
    }

    return <DataTable<Item> columns={cols} rows={items} rowKey={(r) => r.id} totals={totals} />
}
