"use client"
import { Camera, ShieldCheck, AlertTriangle } from "lucide-react"
import { EmptyState, StatusPill } from "@/components/integra"
import { fmtDateTime } from "@/lib/integra-tokens"

type Item = {
    id: string
    quantityReceived: number
    quantityAccepted: number
    quantityRejected: number
    inspectionNotes: string | null
    product: { code: string; name: string; unit: string } | null
}

export function InspeksiTab({ data }: { data: any }) {
    const items: Item[] = data.items ?? []
    const totals = data.totals ?? {
        quantityReceived: 0,
        quantityAccepted: 0,
        quantityRejected: 0,
    }
    const defectItems = items.filter((i) => i.quantityRejected > 0)
    const passRate =
        totals.quantityReceived > 0
            ? (totals.quantityAccepted / totals.quantityReceived) * 100
            : 0

    const inspector = data.acceptedByActor?.name ?? data.receivedBy?.name ?? "—"
    const inspectedAt = data.acceptedAt ?? data.receivedDate

    return (
        <div className="space-y-6">
            {/* Inspection summary cards */}
            <section>
                <h3 className="text-[11px] font-medium uppercase tracking-wider text-[var(--integra-muted)] mb-3">
                    Hasil Inspeksi
                </h3>
                <div className="grid grid-cols-4 gap-3">
                    <SummaryCard
                        label="Item Lulus"
                        value={String(items.length - defectItems.length)}
                        sub={`dari ${items.length} item`}
                        kind="ok"
                    />
                    <SummaryCard
                        label="Item Cacat"
                        value={String(defectItems.length)}
                        sub={defectItems.length > 0 ? "perlu tindak lanjut" : "tidak ada"}
                        kind={defectItems.length > 0 ? "err" : "neutral"}
                    />
                    <SummaryCard
                        label="Qty Lulus"
                        value={String(totals.quantityAccepted)}
                        sub={`${passRate.toFixed(1).replace(".", ",")}% dari diterima`}
                        kind="ok"
                    />
                    <SummaryCard
                        label="Qty Tolak"
                        value={String(totals.quantityRejected)}
                        sub={
                            totals.quantityRejected > 0
                                ? "kembali ke vendor"
                                : "tidak ada"
                        }
                        kind={totals.quantityRejected > 0 ? "err" : "neutral"}
                    />
                </div>
            </section>

            {/* Inspector info */}
            <section className="border-t border-[var(--integra-hairline)] pt-6">
                <h3 className="text-[11px] font-medium uppercase tracking-wider text-[var(--integra-muted)] mb-3">
                    Petugas & Waktu
                </h3>
                <dl className="grid grid-cols-2 gap-x-12 gap-y-2 text-[12.5px]">
                    <Row label="Inspektor">{inspector}</Row>
                    <Row label="Tanggal Inspeksi">
                        <span className="font-mono">
                            {inspectedAt ? fmtDateTime(new Date(inspectedAt)) : "—"}
                        </span>
                    </Row>
                </dl>
            </section>

            {/* Defect details */}
            <section className="border-t border-[var(--integra-hairline)] pt-6">
                <h3 className="text-[11px] font-medium uppercase tracking-wider text-[var(--integra-muted)] mb-3">
                    Detail Cacat
                </h3>
                {defectItems.length === 0 ? (
                    <div className="border border-[var(--integra-hairline)] rounded-[3px] p-6 text-center bg-[var(--integra-canvas-pure)]">
                        <ShieldCheck className="size-6 text-[var(--integra-green-ok)] mx-auto mb-2" />
                        <p className="text-[12.5px] text-[var(--integra-ink-soft)]">
                            Semua item lulus inspeksi
                        </p>
                    </div>
                ) : (
                    <ul className="space-y-2 list-none m-0 p-0">
                        {defectItems.map((item) => (
                            <li
                                key={item.id}
                                className="border border-[var(--integra-hairline)] rounded-[3px] p-3 bg-[var(--integra-canvas-pure)]"
                            >
                                <div className="flex items-start gap-3">
                                    <AlertTriangle className="size-4 text-[var(--integra-red)] mt-0.5 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-mono text-[11px] text-[var(--integra-muted)]">
                                                {item.product?.code ?? "—"}
                                            </span>
                                            <span className="text-[12.5px] text-[var(--integra-ink)]">
                                                {item.product?.name ?? "—"}
                                            </span>
                                            <StatusPill kind="err">
                                                {item.quantityRejected} {item.product?.unit ?? "unit"} ditolak
                                            </StatusPill>
                                        </div>
                                        {item.inspectionNotes ? (
                                            <p className="text-[11.5px] text-[var(--integra-ink-soft)] mt-1.5 whitespace-pre-wrap">
                                                {item.inspectionNotes}
                                            </p>
                                        ) : (
                                            <p className="text-[11.5px] text-[var(--integra-muted)] mt-1.5">
                                                Tidak ada catatan inspeksi
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {/* Photos placeholder */}
            <section className="border-t border-[var(--integra-hairline)] pt-6">
                <h3 className="text-[11px] font-medium uppercase tracking-wider text-[var(--integra-muted)] mb-3">
                    Foto Inspeksi
                </h3>
                <div className="border border-dashed border-[var(--integra-hairline)] rounded-[3px] p-8 text-center">
                    <Camera className="size-6 text-[var(--integra-muted)] mx-auto mb-2 opacity-50" />
                    <p className="text-[12.5px] text-[var(--integra-ink-soft)] mb-1">
                        Belum ada foto inspeksi
                    </p>
                    <p className="text-[11px] text-[var(--integra-muted)]">
                        Fitur upload foto barang masuk akan tersedia di rilis berikutnya.
                    </p>
                </div>
            </section>
        </div>
    )
}

function SummaryCard({
    label,
    value,
    sub,
    kind,
}: {
    label: string
    value: string
    sub: string
    kind: "ok" | "err" | "neutral"
}) {
    const valueCls =
        kind === "ok"
            ? "text-[var(--integra-green-ok)]"
            : kind === "err"
                ? "text-[var(--integra-red)]"
                : "text-[var(--integra-ink)]"
    return (
        <div className="border border-[var(--integra-hairline)] rounded-[3px] p-3 bg-[var(--integra-canvas-pure)]">
            <div className="text-[10.5px] font-semibold tracking-[0.12em] uppercase text-[var(--integra-muted)]">
                {label}
            </div>
            <div className={`font-mono text-[20px] font-medium mt-1 ${valueCls}`}>{value}</div>
            <div className="text-[11px] text-[var(--integra-muted)] mt-0.5">{sub}</div>
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
