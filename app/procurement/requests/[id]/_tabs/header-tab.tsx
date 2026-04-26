"use client"
import { EmptyState, StatusPill } from "@/components/integra"
import { LinkedDocsPanel } from "@/components/integra/linked-docs-panel"
import { fmtIDR, fmtDateShort } from "@/lib/integra-tokens"
import { buildLinkedDocs } from "../_helpers/build-linked-docs"

function statusKind(s: string): "ok" | "warn" | "err" | "info" | "neutral" {
    const m: Record<string, "ok" | "warn" | "err" | "info" | "neutral"> = {
        DRAFT: "neutral",
        PENDING: "warn",
        APPROVED: "ok",
        PO_CREATED: "info",
        REJECTED: "err",
        CANCELLED: "err",
    }
    return m[s] ?? "neutral"
}

function statusLabel(s: string): string {
    const m: Record<string, string> = {
        DRAFT: "Draft",
        PENDING: "Menunggu",
        APPROVED: "Disetujui",
        PO_CREATED: "Dikonversi PO",
        REJECTED: "Ditolak",
        CANCELLED: "Dibatalkan",
    }
    return m[s] ?? s
}

function priorityKind(p: string): "ok" | "warn" | "err" | "info" | "neutral" {
    const k = p?.toUpperCase()
    if (k === "URGENT") return "err"
    if (k === "HIGH") return "warn"
    if (k === "MEDIUM") return "info"
    return "neutral"
}

function priorityLabel(p: string): string {
    const m: Record<string, string> = {
        LOW: "Rendah",
        NORMAL: "Normal",
        MEDIUM: "Sedang",
        HIGH: "Tinggi",
        URGENT: "Mendesak",
    }
    return m[p?.toUpperCase()] ?? p
}

export function HeaderTab({ data }: { data: any }) {
    const trail = buildLinkedDocs(data)
    const hasRelated = trail.length > 1

    const requesterName = data.requester
        ? `${data.requester.firstName ?? ""} ${data.requester.lastName ?? ""}`.trim()
        : "—"
    const approverName = data.approver
        ? `${data.approver.firstName ?? ""} ${data.approver.lastName ?? ""}`.trim()
        : null

    return (
        <div className="grid grid-cols-2 gap-x-12 gap-y-6">
            {/* Linked docs trail */}
            {hasRelated && (
                <section className="col-span-2 pb-6 border-b border-[var(--integra-hairline)]">
                    <h3 className="text-[11px] font-medium uppercase tracking-wider text-[var(--integra-muted)] mb-3">
                        Alur Dokumen
                    </h3>
                    <LinkedDocsPanel trail={trail} />
                </section>
            )}

            {/* Left: Permintaan */}
            <section>
                <h3 className="text-[11px] font-medium uppercase tracking-wider text-[var(--integra-muted)] mb-3">
                    Informasi Permintaan
                </h3>
                <dl className="space-y-2">
                    <Row label="Nomor PR">
                        <span className="font-mono text-[12.5px] text-[var(--integra-ink)]">{data.number}</span>
                    </Row>
                    <Row label="Status">
                        <StatusPill kind={statusKind(data.status)}>{statusLabel(data.status)}</StatusPill>
                    </Row>
                    <Row label="Prioritas">
                        <StatusPill kind={priorityKind(data.priority)}>{priorityLabel(data.priority)}</StatusPill>
                    </Row>
                    <Row label="Tanggal Buat">
                        <span className="font-mono text-[12.5px]">
                            {data.createdAt ? fmtDateShort(new Date(data.createdAt)) : "—"}
                        </span>
                    </Row>
                    <Row label="Tgl Permintaan">
                        <span className="font-mono text-[12.5px]">
                            {data.requestDate ? fmtDateShort(new Date(data.requestDate)) : "—"}
                        </span>
                    </Row>
                    <Row label="Departemen">
                        <span className="text-[12.5px]">{data.department || "—"}</span>
                    </Row>
                    <Row label="Jumlah Item">
                        <span className="font-mono text-[12.5px]">{data.items?.length ?? 0}</span>
                    </Row>
                </dl>
            </section>

            {/* Right: Pemohon & Approver */}
            <section>
                <h3 className="text-[11px] font-medium uppercase tracking-wider text-[var(--integra-muted)] mb-3">
                    Pemohon & Approver
                </h3>
                {data.requester ? (
                    <dl className="space-y-2">
                        <Row label="Pemohon">
                            <span className="text-[12.5px] text-[var(--integra-ink)]">{requesterName}</span>
                        </Row>
                        <Row label="Email">
                            <span className="text-[12.5px]">{data.requester.email ?? "—"}</span>
                        </Row>
                        <Row label="Posisi">
                            <span className="text-[12.5px]">{data.requester.position ?? "—"}</span>
                        </Row>
                        <Row label="Departemen">
                            <span className="text-[12.5px]">{data.requester.department ?? "—"}</span>
                        </Row>
                        <Row label="Approver">
                            {approverName ? (
                                <span className="text-[12.5px] text-[var(--integra-ink)]">{approverName}</span>
                            ) : (
                                <span className="text-[var(--integra-muted)] text-[12.5px]">Belum di-approve</span>
                            )}
                        </Row>
                        {data.approver?.email && (
                            <Row label="Email Approver">
                                <span className="text-[12.5px]">{data.approver.email}</span>
                            </Row>
                        )}
                    </dl>
                ) : (
                    <EmptyState
                        title="Pemohon tidak ditemukan"
                        description="Data pemohon untuk PR ini belum tersedia."
                    />
                )}
            </section>

            {/* Bottom: Nilai estimasi */}
            <section className="col-span-2 pt-4 border-t border-[var(--integra-hairline)]">
                <h3 className="text-[11px] font-medium uppercase tracking-wider text-[var(--integra-muted)] mb-3">
                    Nilai Estimasi
                </h3>
                <p className="text-[11px] text-[var(--integra-muted)] mb-3 italic">
                    Estimasi dihitung dari harga pokok produk × kuantitas. Harga final ditentukan pada saat PO diterbitkan.
                </p>
                <Row label="Total Estimasi">
                    <span className="font-mono text-[16px] font-medium text-[var(--integra-ink)]">
                        {fmtIDR(data.estimatedTotal ?? 0)}
                    </span>
                </Row>
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
        <div className="grid grid-cols-[140px_1fr] items-baseline gap-3">
            <dt className="text-[11.5px] text-[var(--integra-muted)]">{label}</dt>
            <dd className="text-[12.5px]">{children}</dd>
        </div>
    )
}
