"use client"
import { History, FileText, Check, X, ArrowRight } from "lucide-react"
import { fmtDateTime } from "@/lib/integra-tokens"

type DerivedEvent = {
    label: string
    description: string
    timestamp: Date
    kind: "info" | "ok" | "err"
}

const COLOR_VAR: Record<DerivedEvent["kind"], string> = {
    info: "var(--integra-liren-blue)",
    ok: "var(--integra-green-ok)",
    err: "var(--integra-red)",
}

/**
 * History tab for Purchase Requests.
 *
 * The PurchaseRequest model does NOT have a dedicated `purchaseRequestEvent`
 * audit table (unlike PurchaseOrder). For now we synthesise a derived
 * timeline from the columns we DO have: createdAt, updatedAt, approvedAt
 * (via approverId presence), convertedToPOId, plus the current status.
 *
 * Once a `purchaseRequestEvent` model is added to the schema, swap this
 * derivation out for a direct read of those events (mirroring how the PO
 * History tab consumes `purchaseOrderEvents`).
 */
function deriveEvents(data: any): DerivedEvent[] {
    const events: DerivedEvent[] = []

    if (data.createdAt) {
        const requesterName = data.requester
            ? `${data.requester.firstName ?? ""} ${data.requester.lastName ?? ""}`.trim()
            : "Pemohon"
        events.push({
            label: "PR Dibuat",
            description: `${requesterName} membuat permintaan ${data.number} untuk departemen ${data.department || "—"}.`,
            timestamp: new Date(data.createdAt),
            kind: "info",
        })
    }

    // If approver is set and status implies approval has happened
    if (data.approver && (data.status === "APPROVED" || data.status === "PO_CREATED")) {
        const approverName = `${data.approver.firstName ?? ""} ${data.approver.lastName ?? ""}`.trim()
        events.push({
            label: "PR Disetujui",
            description: `${approverName || "Approver"} menyetujui permintaan ini.`,
            // We don't have an explicit approvedAt timestamp on PR. Use updatedAt as the best proxy.
            timestamp: new Date(data.updatedAt ?? data.createdAt),
            kind: "ok",
        })
    }

    // If status is REJECTED, show rejection event
    if (data.status === "REJECTED") {
        const approverName = data.approver
            ? `${data.approver.firstName ?? ""} ${data.approver.lastName ?? ""}`.trim()
            : "Approver"
        events.push({
            label: "PR Ditolak",
            description: data.notes
                ? `${approverName} menolak permintaan. Alasan: ${data.notes}`
                : `${approverName} menolak permintaan ini.`,
            timestamp: new Date(data.updatedAt ?? data.createdAt),
            kind: "err",
        })
    }

    // If converted to PO
    if (data.purchaseOrder) {
        events.push({
            label: "Dikonversi ke PO",
            description: `PR ini telah dikonversi menjadi Purchase Order ${data.purchaseOrder.number}.`,
            timestamp: new Date(data.updatedAt ?? data.createdAt),
            kind: "info",
        })
    }

    // If cancelled
    if (data.status === "CANCELLED") {
        events.push({
            label: "PR Dibatalkan",
            description: `Permintaan ini sudah dibatalkan.`,
            timestamp: new Date(data.updatedAt ?? data.createdAt),
            kind: "err",
        })
    }

    return events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
}

function iconFor(label: string) {
    if (label.includes("Disetujui")) return <Check className="size-3" />
    if (label.includes("Ditolak") || label.includes("Dibatalkan")) return <X className="size-3" />
    if (label.includes("Konversi") || label.includes("Konversi")) return <ArrowRight className="size-3" />
    if (label.includes("Dibuat")) return <FileText className="size-3" />
    return <History className="size-3" />
}

export function HistoryTab({ data }: { data: any }) {
    const events = deriveEvents(data)

    if (events.length === 0) {
        return (
            <div className="text-center py-10 px-4">
                <h3 className="text-[13px] font-medium text-[var(--integra-ink)]">Belum ada riwayat</h3>
                <p className="text-[12px] text-[var(--integra-muted)] mt-1">Aktivitas akan muncul di sini.</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="rounded-[3px] border border-[var(--integra-hairline)] bg-[var(--integra-canvas)] px-3.5 py-2 text-[11px] text-[var(--integra-muted)]">
                <span className="font-medium text-[var(--integra-ink-soft)]">Catatan:</span> PR belum memiliki tabel audit khusus. Riwayat di bawah disusun otomatis dari status dan kolom timestamp PR. Detail audit lengkap akan tersedia setelah model{" "}
                <code className="font-mono text-[10.5px]">purchaseRequestEvent</code> ditambahkan ke skema.
            </div>

            <ol aria-label="Riwayat aktivitas" className="space-y-3">
                {events.map((e, i) => {
                    const isLast = i === events.length - 1
                    return (
                        <li key={`${e.label}-${i}`} className="flex gap-3">
                            <div className="flex flex-col items-center pt-0.5 shrink-0">
                                <span
                                    aria-hidden
                                    className="w-2 h-2 rounded-full"
                                    style={{ background: COLOR_VAR[e.kind] }}
                                />
                                {!isLast && (
                                    <span
                                        aria-hidden
                                        className="flex-1 w-px bg-[var(--integra-hairline)] mt-1"
                                        style={{ minHeight: "16px" }}
                                    />
                                )}
                            </div>
                            <div className="flex-1 min-w-0 pb-3">
                                <div className="flex items-baseline gap-2 text-[11.5px] text-[var(--integra-muted)] font-mono">
                                    <time dateTime={e.timestamp.toISOString()}>{fmtDateTime(e.timestamp)}</time>
                                </div>
                                <div className="flex items-center gap-2 text-[12.5px] font-medium text-[var(--integra-ink)] mt-0.5">
                                    <span className="inline-flex items-center gap-1">
                                        {iconFor(e.label)}
                                        {e.label}
                                    </span>
                                </div>
                                <p className="text-[12px] text-[var(--integra-ink-soft)] mt-0.5">{e.description}</p>
                            </div>
                        </li>
                    )
                })}
            </ol>
        </div>
    )
}
