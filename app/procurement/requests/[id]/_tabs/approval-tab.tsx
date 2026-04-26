"use client"
import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Check, X } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { queryKeys } from "@/lib/query-keys"
import { fmtIDR } from "@/lib/integra-tokens"

type StepStatus = "done" | "current" | "pending"

type Step = {
    label: string
    actor: string
    status: StepStatus
    note?: string
}

/**
 * Simpler 2-step approval workflow specific to Purchase Requests.
 * PR doesn't carry the CEO threshold gating that PO has — it only needs
 * the requester (creator) and the manager-level approver.
 */
function PRApprovalSteps({
    creatorName,
    approverName,
    status,
}: {
    creatorName: string
    approverName?: string | null
    status: string
}) {
    const isApproved = status === "APPROVED" || status === "PO_CREATED"
    const isPending = status === "PENDING"
    const isRejected = status === "REJECTED" || status === "CANCELLED"

    const reviewLabel = isRejected ? "Ditolak" : "Approver Review"
    const reviewActor = isRejected
        ? approverName ?? "Approver"
        : approverName ?? "Menunggu approver"

    const steps: Step[] = [
        { label: "Dibuat", actor: creatorName, status: "done" },
        {
            label: reviewLabel,
            actor: reviewActor,
            status: isApproved ? "done" : isPending ? "current" : isRejected ? "done" : "pending",
        },
    ]

    return (
        <ol aria-label="Alur approval PR" className="flex items-start gap-2 list-none p-0 m-0">
            {steps.map((s, i) => (
                <div key={s.label} className="contents">
                    <li
                        data-step-status={s.status}
                        className="flex flex-col items-center min-w-[120px]"
                    >
                        <span
                            aria-hidden
                            className={cn(
                                "w-6 h-6 rounded-full grid place-items-center text-[10px] font-mono mb-1.5",
                                s.status === "done" && !isRejected && "bg-[var(--integra-green-ok)] text-white",
                                s.status === "done" && isRejected && i > 0 && "bg-[var(--integra-red)] text-white",
                                s.status === "done" && isRejected && i === 0 && "bg-[var(--integra-green-ok)] text-white",
                                s.status === "current" && "border-2 border-[var(--integra-liren-blue)] text-[var(--integra-liren-blue)]",
                                s.status === "pending" && "border border-[var(--integra-hairline-strong)] text-[var(--integra-muted)]",
                            )}
                        >
                            {i + 1}
                        </span>
                        <div className="text-[11.5px] font-medium text-center text-[var(--integra-ink)]">
                            {s.label}
                        </div>
                        <div className="text-[10.5px] text-[var(--integra-muted)] text-center">
                            {s.actor}
                        </div>
                    </li>
                    {i < steps.length - 1 && (
                        <div
                            aria-hidden
                            className={cn(
                                "flex-1 h-px mt-3",
                                s.status === "done"
                                    ? isRejected
                                        ? "bg-[var(--integra-red)]"
                                        : "bg-[var(--integra-green-ok)]"
                                    : "bg-[var(--integra-hairline-strong)]",
                            )}
                        />
                    )}
                </div>
            ))}
        </ol>
    )
}

export function ApprovalTab({ data }: { data: any }) {
    const queryClient = useQueryClient()
    const [busy, setBusy] = useState(false)

    const isPending = data.status === "PENDING"
    const canActOnApproval = isPending // role check enforced server-side

    const creatorName = data.requester
        ? `${data.requester.firstName ?? ""} ${data.requester.lastName ?? ""}`.trim() || "Unknown"
        : "Unknown"
    const approverName = data.approver
        ? `${data.approver.firstName ?? ""} ${data.approver.lastName ?? ""}`.trim()
        : undefined

    async function handleAction(action: "approve" | "reject") {
        const verb = action === "approve" ? "Setujui" : "Tolak"
        if (!confirm(`${verb} PR ${data.number}?`)) return

        setBusy(true)
        try {
            const res = await fetch("/api/procurement/requests/bulk", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: [data.id], action }),
            })
            if (!res.ok) throw new Error(`Gagal ${verb.toLowerCase()}`)
            const result = await res.json()
            if (result.failed?.length > 0) {
                toast.error(`Gagal: ${result.failed[0]?.reason ?? "Unknown error"}`)
                return
            }
            toast.success(`PR ${data.number} ${action === "approve" ? "disetujui" : "ditolak"}`)
            queryClient.invalidateQueries({ queryKey: ["purchase-request", data.id] })
            queryClient.invalidateQueries({ queryKey: queryKeys.purchaseRequests.all })
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Unknown error"
            toast.error(msg)
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="space-y-8">
            {/* Workflow stepper */}
            <section>
                <h3 className="text-[11px] font-medium uppercase tracking-wider text-[var(--integra-muted)] mb-4">
                    Alur Approval
                </h3>
                <PRApprovalSteps
                    creatorName={creatorName}
                    approverName={approverName}
                    status={data.status}
                />
                <p className="text-[11px] text-[var(--integra-muted)] mt-3 italic">
                    PR memerlukan persetujuan satu manager / approver yang memiliki cakupan departemen yang sama dengan pemohon.
                </p>
            </section>

            {/* Action buttons */}
            {canActOnApproval && (
                <section className="border-t border-[var(--integra-hairline)] pt-6">
                    <h3 className="text-[11px] font-medium uppercase tracking-wider text-[var(--integra-muted)] mb-3">
                        Aksi
                    </h3>
                    <p className="text-[12.5px] text-[var(--integra-ink-soft)] mb-4">
                        PR ini menunggu persetujuan kamu. Nilai estimasi:{" "}
                        <strong className="font-mono">{fmtIDR(Number(data.estimatedTotal ?? 0))}</strong>
                    </p>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => handleAction("approve")}
                            disabled={busy}
                            className="h-8 px-4 bg-[var(--integra-ink)] text-[var(--integra-canvas)] text-[12px] rounded-[3px] flex items-center gap-2 disabled:opacity-50"
                        >
                            <Check className="size-3.5" />
                            Setujui
                        </button>
                        <button
                            type="button"
                            onClick={() => handleAction("reject")}
                            disabled={busy}
                            className="h-8 px-4 bg-[var(--integra-red)] text-white text-[12px] rounded-[3px] flex items-center gap-2 disabled:opacity-50"
                        >
                            <X className="size-3.5" />
                            Tolak
                        </button>
                    </div>
                </section>
            )}

            {/* Status info */}
            {!canActOnApproval && (
                <section className="border-t border-[var(--integra-hairline)] pt-6">
                    <p className="text-[12.5px] text-[var(--integra-muted)]">
                        {data.status === "APPROVED"
                            ? "PR ini sudah disetujui. Menunggu konversi ke PO oleh staf Purchasing."
                            : data.status === "PO_CREATED"
                                ? "PR ini sudah dikonversi ke Purchase Order."
                                : data.status === "REJECTED"
                                    ? "PR ini sudah ditolak. Tidak ada aksi approval yang tersedia."
                                    : data.status === "CANCELLED"
                                        ? "PR ini sudah dibatalkan."
                                        : "PR ini belum siap untuk approval."}
                    </p>
                </section>
            )}

            {/* Approver info */}
            {approverName && (
                <section className="border-t border-[var(--integra-hairline)] pt-6">
                    <h3 className="text-[11px] font-medium uppercase tracking-wider text-[var(--integra-muted)] mb-2">
                        Detail Approval
                    </h3>
                    <dl className="grid grid-cols-[120px_1fr] gap-2 text-[12.5px]">
                        <dt className="text-[var(--integra-muted)]">Diproses oleh</dt>
                        <dd>{approverName}</dd>
                        {data.approver?.position && (
                            <>
                                <dt className="text-[var(--integra-muted)]">Posisi</dt>
                                <dd>{data.approver.position}</dd>
                            </>
                        )}
                        {data.approver?.department && (
                            <>
                                <dt className="text-[var(--integra-muted)]">Departemen</dt>
                                <dd>{data.approver.department}</dd>
                            </>
                        )}
                    </dl>
                </section>
            )}
        </div>
    )
}
