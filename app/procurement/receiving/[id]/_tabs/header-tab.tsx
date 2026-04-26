"use client"
import Link from "next/link"
import { EmptyState, StatusPill } from "@/components/integra"
import { LinkedDocsPanel } from "@/components/integra/linked-docs-panel"
import { fmtIDR, fmtDateShort, fmtDateTime } from "@/lib/integra-tokens"
import { buildLinkedDocs } from "../_helpers/build-linked-docs"

function statusKind(s: string): "ok" | "warn" | "err" | "info" | "neutral" {
    const m: Record<string, "ok" | "warn" | "err" | "info" | "neutral"> = {
        DRAFT: "neutral",
        INSPECTING: "warn",
        PARTIAL_ACCEPTED: "ok",
        ACCEPTED: "ok",
        REJECTED: "err",
    }
    return m[s] ?? "neutral"
}

function statusLabel(s: string): string {
    const m: Record<string, string> = {
        DRAFT: "Draft",
        INSPECTING: "Inspeksi",
        PARTIAL_ACCEPTED: "Diterima Sebagian",
        ACCEPTED: "Diterima",
        REJECTED: "Ditolak",
    }
    return m[s] ?? s
}

export function HeaderTab({ data }: { data: any }) {
    const trail = buildLinkedDocs(data)
    const hasRelated = trail.length > 1
    const totals = data.totals ?? { items: 0, quantityAccepted: 0, quantityRejected: 0, value: 0 }

    return (
        <div className="grid grid-cols-2 gap-x-12 gap-y-6">
            {/* Linked docs trail — only render if there are related documents */}
            {hasRelated && (
                <section className="col-span-2 pb-6 border-b border-[var(--integra-hairline)]">
                    <h3 className="text-[11px] font-medium uppercase tracking-wider text-[var(--integra-muted)] mb-3">
                        Alur Dokumen
                    </h3>
                    <LinkedDocsPanel trail={trail} />
                </section>
            )}

            {/* Left column: Penerimaan */}
            <section>
                <h3 className="text-[11px] font-medium uppercase tracking-wider text-[var(--integra-muted)] mb-3">
                    Informasi Penerimaan
                </h3>
                <dl className="space-y-2">
                    <Row label="Nomor GRN">
                        <span className="font-mono text-[12.5px] text-[var(--integra-ink)]">{data.number}</span>
                    </Row>
                    <Row label="Status">
                        <StatusPill kind={statusKind(data.status)}>{statusLabel(data.status)}</StatusPill>
                    </Row>
                    <Row label="Tgl Terima">
                        <span className="font-mono text-[12.5px]">
                            {data.receivedDate ? fmtDateShort(new Date(data.receivedDate)) : "—"}
                        </span>
                    </Row>
                    <Row label="Penerima">
                        <span className="text-[12.5px]">
                            {data.receivedBy?.name ?? "—"}
                            {data.receivedBy?.department && (
                                <span className="ml-1.5 text-[11px] text-[var(--integra-muted)]">
                                    · {data.receivedBy.department}
                                </span>
                            )}
                        </span>
                    </Row>
                    <Row label="Gudang">
                        <span className="text-[12.5px]">
                            {data.warehouse?.name ?? "—"}
                            {data.warehouse?.code && (
                                <span className="ml-1.5 font-mono text-[11px] text-[var(--integra-muted)]">
                                    ({data.warehouse.code})
                                </span>
                            )}
                        </span>
                    </Row>
                    <Row label="Jumlah Item">
                        <span className="font-mono text-[12.5px]">{totals.items}</span>
                    </Row>
                    {data.acceptedAt && (
                        <Row label="Disetujui">
                            <span className="font-mono text-[12.5px]">{fmtDateTime(new Date(data.acceptedAt))}</span>
                            {data.acceptedByActor?.name && (
                                <span className="ml-2 text-[11px] text-[var(--integra-muted)]">
                                    oleh {data.acceptedByActor.name}
                                </span>
                            )}
                        </Row>
                    )}
                    {data.rejectedAt && (
                        <Row label="Ditolak">
                            <span className="font-mono text-[12.5px]">{fmtDateTime(new Date(data.rejectedAt))}</span>
                            {data.rejectedByActor?.name && (
                                <span className="ml-2 text-[11px] text-[var(--integra-muted)]">
                                    oleh {data.rejectedByActor.name}
                                </span>
                            )}
                        </Row>
                    )}
                </dl>
            </section>

            {/* Right column: PO + Pemasok */}
            <section>
                <h3 className="text-[11px] font-medium uppercase tracking-wider text-[var(--integra-muted)] mb-3">
                    Pesanan & Pemasok
                </h3>
                {data.purchaseOrder ? (
                    <dl className="space-y-2">
                        <Row label="No. PO">
                            <Link
                                href={`/procurement/orders/${data.purchaseOrder.id}`}
                                className="font-mono text-[12.5px] text-[var(--integra-liren-blue)] hover:underline"
                            >
                                {data.purchaseOrder.number}
                            </Link>
                        </Row>
                        <Row label="Tgl PO">
                            <span className="font-mono text-[12.5px]">
                                {data.purchaseOrder.orderDate
                                    ? fmtDateShort(new Date(data.purchaseOrder.orderDate))
                                    : "—"}
                            </span>
                        </Row>
                        <Row label="Tgl Diharapkan">
                            <span className="font-mono text-[12.5px]">
                                {data.purchaseOrder.expectedDate
                                    ? fmtDateShort(new Date(data.purchaseOrder.expectedDate))
                                    : "—"}
                            </span>
                        </Row>
                        {data.purchaseOrder.supplier && (
                            <>
                                <Row label="Pemasok">
                                    <span className="text-[12.5px] text-[var(--integra-ink)]">
                                        {data.purchaseOrder.supplier.name}
                                    </span>
                                </Row>
                                <Row label="Kontak">
                                    <span className="text-[12.5px]">
                                        {data.purchaseOrder.supplier.contactName ?? "—"}
                                    </span>
                                </Row>
                                <Row label="Telepon">
                                    <span className="font-mono text-[12.5px]">
                                        {data.purchaseOrder.supplier.phone ?? "—"}
                                    </span>
                                </Row>
                                <Row label="NPWP">
                                    <span className="font-mono text-[12.5px]">
                                        {data.purchaseOrder.supplier.taxId ?? "—"}
                                    </span>
                                </Row>
                            </>
                        )}
                    </dl>
                ) : (
                    <EmptyState
                        title="Pesanan tidak ditemukan"
                        description="GRN ini tidak terhubung dengan PO manapun (data mungkin sudah dihapus)."
                    />
                )}
            </section>

            {/* Bottom: Ringkasan Kuantitas + Nilai */}
            <section className="col-span-2 pt-4 border-t border-[var(--integra-hairline)]">
                <h3 className="text-[11px] font-medium uppercase tracking-wider text-[var(--integra-muted)] mb-3">
                    Ringkasan
                </h3>
                <div className="grid grid-cols-4 gap-6">
                    <Row label="Qty Diterima">
                        <span className="font-mono text-[14px] text-[var(--integra-ink)]">
                            {totals.quantityReceived ?? 0}
                        </span>
                    </Row>
                    <Row label="Qty Diterima OK">
                        <span className="font-mono text-[14px] text-[var(--integra-green-ok)]">
                            {totals.quantityAccepted ?? 0}
                        </span>
                    </Row>
                    <Row label="Qty Ditolak">
                        <span
                            className={`font-mono text-[14px] ${
                                (totals.quantityRejected ?? 0) > 0
                                    ? "text-[var(--integra-red)]"
                                    : "text-[var(--integra-muted)]"
                            }`}
                        >
                            {totals.quantityRejected ?? 0}
                        </span>
                    </Row>
                    <Row label="Nilai Diterima">
                        <span className="font-mono text-[16px] font-medium text-[var(--integra-ink)]">
                            {fmtIDR(totals.value ?? 0)}
                        </span>
                    </Row>
                </div>
            </section>

            {/* Notes */}
            {data.notes && (
                <section className="col-span-2 pt-4 border-t border-[var(--integra-hairline)]">
                    <h3 className="text-[11px] font-medium uppercase tracking-wider text-[var(--integra-muted)] mb-2">
                        Catatan
                    </h3>
                    <p className="text-[12.5px] text-[var(--integra-ink-soft)] whitespace-pre-wrap">{data.notes}</p>
                </section>
            )}
        </div>
    )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="grid grid-cols-[120px_1fr] items-baseline gap-3">
            <dt className="text-[11.5px] text-[var(--integra-muted)]">{label}</dt>
            <dd className="text-[12.5px]">{children}</dd>
        </div>
    )
}
