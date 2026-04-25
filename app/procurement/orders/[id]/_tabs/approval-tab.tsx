"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { ApprovalWorkflowSteps, CEO_THRESHOLD, type POApprovalStatus } from "@/components/integra/approval-workflow-steps"
import { Check, X } from "lucide-react"
import { toast } from "sonner"
import { queryKeys } from "@/lib/query-keys"
import { fmtIDR } from "@/lib/integra-tokens"

export function ApprovalTab({ data }: { data: any }) {
    const router = useRouter()
    const queryClient = useQueryClient()
    const [busy, setBusy] = useState(false)

    // Derive status info
    const isPending = data.status === "PENDING_APPROVAL"
    const canActOnApproval = isPending // role check would go here in production

    // Find creator from purchaseRequests[0].requester or fallback
    const pr = data.purchaseRequests?.[0]
    const creatorName = pr?.requester ? `${pr.requester.firstName} ${pr.requester.lastName}` : "Unknown"
    const approverName = pr?.approver ? `${pr.approver.firstName} ${pr.approver.lastName}` : undefined

    const status = data.status as POApprovalStatus

    async function handleAction(action: "approve" | "reject") {
        const verb = action === "approve" ? "Setujui" : "Tolak"
        if (!confirm(`${verb} PO ${data.number} (${fmtIDR(Number(data.totalAmount))})?`)) return

        setBusy(true)
        try {
            const res = await fetch("/api/procurement/orders/bulk", {
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
            toast.success(`PO ${data.number} ${action === "approve" ? "disetujui" : "ditolak"}`)
            queryClient.invalidateQueries({ queryKey: ["purchase-order", data.id] })
            queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.all })
            router.refresh()
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
                <h3 className="text-[11px] font-medium uppercase tracking-wider text-[var(--integra-muted)] mb-4">Alur Approval</h3>
                <ApprovalWorkflowSteps
                    amount={Number(data.totalAmount)}
                    status={status}
                    creatorName={creatorName}
                    approverName={approverName}
                />
                {Number(data.totalAmount) > CEO_THRESHOLD && (
                    <p className="text-[11px] text-[var(--integra-muted)] mt-3 italic">
                        PO ini bernilai &gt;Rp {(CEO_THRESHOLD / 1_000_000).toFixed(0)} jt — membutuhkan approval CEO.
                    </p>
                )}
            </section>

            {/* Action buttons */}
            {canActOnApproval && (
                <section className="border-t border-[var(--integra-hairline)] pt-6">
                    <h3 className="text-[11px] font-medium uppercase tracking-wider text-[var(--integra-muted)] mb-3">Aksi</h3>
                    <p className="text-[12.5px] text-[var(--integra-ink-soft)] mb-4">
                        PO ini menunggu persetujuan kamu. Total nilai: <strong className="font-mono">{fmtIDR(Number(data.totalAmount))}</strong>
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => handleAction("approve")}
                            disabled={busy}
                            className="h-8 px-4 bg-[var(--integra-ink)] text-[var(--integra-canvas)] text-[12px] rounded-[3px] flex items-center gap-2 disabled:opacity-50"
                        >
                            <Check className="size-3.5" />
                            Setujui
                        </button>
                        <button
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
                        {data.status === "APPROVED" || data.status === "ORDERED" || data.status === "SHIPPED" || data.status === "RECEIVED" || data.status === "COMPLETED"
                            ? "PO ini sudah disetujui. Tidak ada aksi approval yang tersedia."
                            : data.status === "REJECTED"
                                ? "PO ini sudah ditolak. Tidak ada aksi approval yang tersedia."
                                : "PO ini belum siap untuk approval."
                        }
                    </p>
                </section>
            )}

            {/* Approver info */}
            {data.approvedAt && (
                <section className="border-t border-[var(--integra-hairline)] pt-6">
                    <h3 className="text-[11px] font-medium uppercase tracking-wider text-[var(--integra-muted)] mb-2">Detail Approval</h3>
                    <dl className="grid grid-cols-[120px_1fr] gap-2 text-[12.5px]">
                        <dt className="text-[var(--integra-muted)]">Disetujui pada</dt>
                        <dd className="font-mono">{new Date(data.approvedAt).toLocaleString("id-ID")}</dd>
                        {approverName && (
                            <>
                                <dt className="text-[var(--integra-muted)]">Disetujui oleh</dt>
                                <dd>{approverName}</dd>
                            </>
                        )}
                    </dl>
                </section>
            )}
        </div>
    )
}
