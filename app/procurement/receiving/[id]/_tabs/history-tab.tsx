"use client"
import { AuditTrailTimeline, type AuditAction, type AuditEvent } from "@/components/integra/audit-trail-timeline"

/**
 * GRN history tab. The current schema does NOT have a dedicated `grnEvent`
 * table — we synthesise a minimal timeline from the GRN's status fields:
 * created → received → accepted/rejected. When a real audit table lands
 * later, swap this for a real query like the PO history-tab.
 */
export function HistoryTab({ data }: { data: any }) {
    const events: AuditEvent[] = []

    if (data.createdAt) {
        events.push({
            id: `${data.id}-created`,
            timestamp: new Date(data.createdAt),
            actor: { name: data.receivedBy?.name ?? "Sistem" },
            action: "PO_CREATED" as AuditAction,
            description: `GRN ${data.number} dibuat sebagai DRAFT`,
        })
    }

    if (data.receivedDate && new Date(data.receivedDate).getTime() !== new Date(data.createdAt).getTime()) {
        events.push({
            id: `${data.id}-received`,
            timestamp: new Date(data.receivedDate),
            actor: { name: data.receivedBy?.name ?? "Sistem" },
            action: "PO_RECEIVED" as AuditAction,
            description: `Barang diterima di gudang ${data.warehouse?.name ?? "—"}`,
        })
    }

    if (data.acceptedAt) {
        events.push({
            id: `${data.id}-accepted`,
            timestamp: new Date(data.acceptedAt),
            actor: {
                name: data.acceptedByActor?.name ?? data.acceptedByActor?.email?.split("@")[0] ?? "Sistem",
                role: data.acceptedByActor?.role ?? undefined,
            },
            action: "PO_APPROVED" as AuditAction,
            description: `GRN diterima — stok bertambah, GL inventory di-update`,
        })
    }

    if (data.rejectedAt) {
        events.push({
            id: `${data.id}-rejected`,
            timestamp: new Date(data.rejectedAt),
            actor: {
                name: data.rejectedByActor?.name ?? data.rejectedByActor?.email?.split("@")[0] ?? "Sistem",
                role: data.rejectedByActor?.role ?? undefined,
            },
            action: "PO_REJECTED" as AuditAction,
            description: data.rejectionReason
                ? `GRN ditolak: ${data.rejectionReason}`
                : "GRN ditolak",
        })
    }

    // Sort newest-first
    events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

    return <AuditTrailTimeline events={events} />
}
