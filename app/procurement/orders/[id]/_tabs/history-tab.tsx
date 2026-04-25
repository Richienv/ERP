"use client"
import { AuditTrailTimeline, type AuditAction, type AuditEvent } from "@/components/integra/audit-trail-timeline"

// Map raw event.action / event.metadata.to → AuditTrailTimeline AuditAction enum.
// Statuses are ProcurementStatus values; actions are free-text from server actions.
const STATUS_TO_AUDIT: Record<string, AuditAction> = {
    PO_DRAFT: "PO_CREATED",
    PENDING_APPROVAL: "PO_UPDATED",
    APPROVED: "PO_APPROVED",
    REJECTED: "PO_REJECTED",
    CANCELLED: "PO_CANCELLED",
    ORDERED: "PO_ORDERED",
    VENDOR_CONFIRMED: "PO_ORDERED",
    SHIPPED: "PO_SHIPPED",
    PARTIAL_RECEIVED: "PO_RECEIVED",
    RECEIVED: "PO_RECEIVED",
    COMPLETED: "PO_COMPLETED",
}

const ACTION_TO_AUDIT: Record<string, AuditAction> = {
    CREATE: "PO_CREATED",
    UPDATE: "PO_UPDATED",
    APPROVE: "PO_APPROVED",
    REJECT: "PO_REJECTED",
    CANCEL: "PO_CANCELLED",
    ORDER: "PO_ORDERED",
    SUBMIT_APPROVAL: "PO_UPDATED",
    VENDOR_CONFIRM: "PO_ORDERED",
    SHIP: "PO_SHIPPED",
    RECEIVE: "PO_RECEIVED",
    COMPLETE: "PO_COMPLETED",
}

function deriveAction(event: { action?: string; status?: string; metadata?: Record<string, unknown> | null }): AuditAction {
    // 1. Try metadata.to (status transition target)
    const targetStatus = event.metadata?.to as string | undefined
    if (targetStatus && STATUS_TO_AUDIT[targetStatus]) return STATUS_TO_AUDIT[targetStatus]
    // 2. Try action string
    if (event.action && ACTION_TO_AUDIT[event.action]) return ACTION_TO_AUDIT[event.action]
    // 3. Fall back to status field
    if (event.status && STATUS_TO_AUDIT[event.status]) return STATUS_TO_AUDIT[event.status]
    // 4. Default
    return "PO_UPDATED"
}

const STATUS_LABEL_ID: Record<string, string> = {
    PO_DRAFT: "Draft",
    PENDING_APPROVAL: "Menunggu Approval",
    APPROVED: "Disetujui",
    REJECTED: "Ditolak",
    CANCELLED: "Dibatalkan",
    ORDERED: "Dipesan",
    VENDOR_CONFIRMED: "Dikonfirmasi Vendor",
    SHIPPED: "Dikirim",
    PARTIAL_RECEIVED: "Diterima Sebagian",
    RECEIVED: "Diterima",
    COMPLETED: "Selesai",
}

function deriveDescription(event: { action?: string; status?: string; notes?: string | null; metadata?: Record<string, unknown> | null }): string {
    if (event.notes) return event.notes
    const target = event.metadata?.to as string | undefined
    if (target) return `Status diubah menjadi ${STATUS_LABEL_ID[target] ?? target}`
    if (event.status) return `Status: ${STATUS_LABEL_ID[event.status] ?? event.status}`
    return `Aktivitas: ${event.action ?? "Update"}`
}

type RawEvent = {
    id: string
    createdAt: string | Date
    status?: string
    action?: string
    notes?: string | null
    metadata?: Record<string, unknown> | null
    changedBy?: string | null
}

export function HistoryTab({ data }: { data: { events?: RawEvent[] } }) {
    const events: AuditEvent[] = (data.events ?? []).map((e) => ({
        id: e.id,
        timestamp: new Date(e.createdAt),
        actor: {
            // changedBy is a Supabase Auth UUID — no name lookup yet.
            // Show "Sistem" for seed/system events, short user ID for real users.
            name: e.metadata?.source === "SEED"
                ? "Sistem"
                : e.changedBy
                    ? `User ${String(e.changedBy).slice(0, 8)}`
                    : "Sistem",
            role: undefined,
        },
        action: deriveAction(e),
        description: deriveDescription(e),
        meta: e.metadata ?? undefined,
    }))

    return <AuditTrailTimeline events={events} />
}
