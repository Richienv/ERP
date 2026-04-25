"use client"
import { StatusPill } from "@/components/integra"
import { LinkedDocsPanel } from "@/components/integra/linked-docs-panel"
import { fmtIDR, fmtDateShort } from "@/lib/integra-tokens"
import { buildLinkedDocs } from "../_helpers/build-linked-docs"

function statusKind(s: string): "ok" | "warn" | "err" | "info" | "neutral" {
    const m: Record<string, "ok" | "warn" | "err" | "info" | "neutral"> = {
        DRAFT: "neutral", PO_DRAFT: "neutral", CANCELLED: "neutral",
        PENDING: "warn", PENDING_APPROVAL: "warn",
        APPROVED: "ok", RECEIVED: "ok", COMPLETED: "ok",
        REJECTED: "err",
        ORDERED: "info", VENDOR_CONFIRMED: "info", SHIPPED: "info",
    }
    return m[s] ?? "neutral"
}

function statusLabel(s: string): string {
    const m: Record<string, string> = {
        DRAFT: "Draft", PO_DRAFT: "Draft", CANCELLED: "Dibatalkan",
        PENDING: "Pending", PENDING_APPROVAL: "Menunggu Approval",
        APPROVED: "Disetujui", RECEIVED: "Diterima", COMPLETED: "Selesai",
        REJECTED: "Ditolak",
        ORDERED: "Dipesan", VENDOR_CONFIRMED: "Konfirmasi Vendor", SHIPPED: "Dikirim",
    }
    return m[s] ?? s
}

export function HeaderTab({ data }: { data: any }) {
    const trail = buildLinkedDocs(data)
    const hasRelated = trail.length > 1

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

            {/* Left column: Pesanan */}
            <section>
                <h3 className="text-[11px] font-medium uppercase tracking-wider text-[var(--integra-muted)] mb-3">Informasi Pesanan</h3>
                <dl className="space-y-2">
                    <Row label="Nomor PO">
                        <span className="font-mono text-[12.5px] text-[var(--integra-ink)]">{data.number}</span>
                        {data.revision > 0 && <span className="ml-2 text-[10.5px] text-[var(--integra-muted)]">Rev. {data.revision}</span>}
                    </Row>
                    <Row label="Status">
                        <StatusPill kind={statusKind(data.status)}>{statusLabel(data.status)}</StatusPill>
                    </Row>
                    <Row label="Tanggal Buat">
                        <span className="font-mono text-[12.5px]">{data.orderDate ? fmtDateShort(new Date(data.orderDate)) : "—"}</span>
                    </Row>
                    <Row label="Tgl Diharapkan">
                        <span className="font-mono text-[12.5px]">{data.expectedDate ? fmtDateShort(new Date(data.expectedDate)) : "—"}</span>
                    </Row>
                    <Row label="Tgl Approval">
                        <span className="font-mono text-[12.5px]">{data.approvedAt ? fmtDateShort(new Date(data.approvedAt)) : "—"}</span>
                    </Row>
                    <Row label="Jumlah Item">
                        <span className="font-mono text-[12.5px]">{data.items?.length ?? 0}</span>
                    </Row>
                </dl>
            </section>

            {/* Right column: Pemasok */}
            <section>
                <h3 className="text-[11px] font-medium uppercase tracking-wider text-[var(--integra-muted)] mb-3">Pemasok</h3>
                {data.supplier ? (
                    <dl className="space-y-2">
                        <Row label="Nama">
                            <span className="text-[12.5px] text-[var(--integra-ink)]">{data.supplier.name}</span>
                        </Row>
                        <Row label="Kode">
                            <span className="font-mono text-[12.5px]">{data.supplier.code ?? "—"}</span>
                        </Row>
                        <Row label="Email">
                            <span className="text-[12.5px]">{data.supplier.email ?? "—"}</span>
                        </Row>
                        <Row label="Telepon">
                            <span className="font-mono text-[12.5px]">{data.supplier.phone ?? "—"}</span>
                        </Row>
                        <Row label="NPWP">
                            <span className="font-mono text-[12.5px]">{data.supplier.taxId ?? "—"}</span>
                        </Row>
                        <Row label="Pembayaran">
                            <span className="text-[12.5px]">{data.supplier.paymentTerm ?? "—"}</span>
                        </Row>
                        <Row label="Alamat">
                            <span className="text-[12.5px] text-[var(--integra-ink-soft)]">{data.supplier.address ?? "—"}</span>
                        </Row>
                    </dl>
                ) : (
                    <p className="text-[12.5px] text-[var(--integra-muted)]">Pemasok tidak ditemukan</p>
                )}
            </section>

            {/* Bottom: Nilai */}
            <section className="col-span-2 pt-4 border-t border-[var(--integra-hairline)]">
                <h3 className="text-[11px] font-medium uppercase tracking-wider text-[var(--integra-muted)] mb-3">Nilai</h3>
                <div className="grid grid-cols-3 gap-6">
                    <Row label="Subtotal">
                        <span className="font-mono text-[14px] text-[var(--integra-ink)]">{fmtIDR(data.netAmount ?? 0)}</span>
                    </Row>
                    <Row label="PPN (11%)">
                        <span className="font-mono text-[14px] text-[var(--integra-ink)]">{fmtIDR(data.taxAmount ?? 0)}</span>
                    </Row>
                    <Row label="Total">
                        <span className="font-mono text-[16px] font-medium text-[var(--integra-ink)]">{fmtIDR(data.totalAmount ?? 0)}</span>
                    </Row>
                </div>
            </section>

            {/* Notes */}
            {data.notes && (
                <section className="col-span-2 pt-4 border-t border-[var(--integra-hairline)]">
                    <h3 className="text-[11px] font-medium uppercase tracking-wider text-[var(--integra-muted)] mb-2">Catatan</h3>
                    <p className="text-[12.5px] text-[var(--integra-ink-soft)] whitespace-pre-wrap">{data.notes}</p>
                </section>
            )}

            {/* Delivery address */}
            {data.deliveryAddress && (
                <section className="col-span-2 pt-4 border-t border-[var(--integra-hairline)]">
                    <h3 className="text-[11px] font-medium uppercase tracking-wider text-[var(--integra-muted)] mb-2">Alamat Pengiriman</h3>
                    <p className="text-[12.5px] text-[var(--integra-ink-soft)] whitespace-pre-wrap">{data.deliveryAddress}</p>
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
