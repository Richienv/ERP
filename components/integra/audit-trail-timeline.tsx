"use client"

import { EmptyState } from "@/components/integra"

export type AuditAction =
    | "PO_CREATED"
    | "PO_UPDATED"
    | "PO_APPROVED"
    | "PO_REJECTED"
    | "PO_CANCELLED"
    | "PO_ORDERED"
    | "PO_SHIPPED"
    | "PO_RECEIVED"
    | "PO_COMPLETED"

export type AuditEvent = {
    id: string
    timestamp: Date
    actor: { name: string; role?: string }
    action: AuditAction
    description: string
    meta?: Record<string, unknown>
}

type DotKind = "info" | "ok" | "warn" | "err"

const COLOR: Record<AuditAction, DotKind> = {
    PO_CREATED: "info",
    PO_UPDATED: "info",
    PO_ORDERED: "info",
    PO_SHIPPED: "info",
    PO_APPROVED: "ok",
    PO_RECEIVED: "ok",
    PO_COMPLETED: "ok",
    PO_REJECTED: "err",
    PO_CANCELLED: "err",
}

const COLOR_VAR: Record<DotKind, string> = {
    info: "var(--integra-liren-blue)",
    ok: "var(--integra-green-ok)",
    warn: "var(--integra-amber)",
    err: "var(--integra-red)",
}

export function AuditTrailTimeline({ events }: { events: AuditEvent[] }) {
    if (events.length === 0) {
        return (
            <EmptyState
                title="Belum ada riwayat"
                description="Aktivitas akan muncul di sini"
            />
        )
    }

    return (
        <ol aria-label="Riwayat aktivitas" className="space-y-3">
            {events.map((e, i) => {
                const kind: DotKind = COLOR[e.action] ?? "info"
                const isLast = i === events.length - 1
                return (
                    <li key={e.id} className="flex gap-3">
                        <div className="flex flex-col items-center pt-0.5 shrink-0">
                            <span
                                data-action-dot={kind}
                                aria-hidden="true"
                                className="w-2 h-2 rounded-full"
                                style={{ background: COLOR_VAR[kind] }}
                            />
                            {!isLast && (
                                <span
                                    aria-hidden="true"
                                    className="flex-1 w-px bg-[var(--integra-hairline)] mt-1"
                                    style={{ minHeight: "16px" }}
                                />
                            )}
                        </div>
                        <div className="flex-1 min-w-0 pb-3">
                            <div className="flex items-baseline gap-2 text-[11.5px] text-[var(--integra-muted)] font-mono">
                                <time dateTime={e.timestamp.toISOString()}>
                                    {new Intl.DateTimeFormat("id-ID", {
                                        day: "2-digit",
                                        month: "short",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                    }).format(e.timestamp)}
                                </time>
                            </div>
                            <div className="text-[12.5px] text-[var(--integra-ink)] mt-0.5">
                                {e.description}
                            </div>
                            <div className="text-[11px] text-[var(--integra-muted)]">
                                <span className="font-medium text-[var(--integra-ink-soft)]">
                                    {e.actor.name}
                                </span>
                                {e.actor.role && <span> · {e.actor.role}</span>}
                            </div>
                        </div>
                    </li>
                )
            })}
        </ol>
    )
}
