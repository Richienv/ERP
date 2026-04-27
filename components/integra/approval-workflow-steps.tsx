"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * CEO approval threshold (Indonesian Rupiah).
 *
 * Purchase orders strictly greater than this amount require an additional
 * CEO approval step on top of the standard Manager review. Exported so
 * consumers (server actions, dialogs) can check the same threshold without
 * duplicating the magic number.
 */
export const CEO_THRESHOLD = 100_000_000

/**
 * Subset of ProcurementStatus values relevant to the approval flow.
 * Kept as a local union to avoid pulling Prisma's enum into a "use client"
 * component (which would break the boundary). Mirrors values in
 * lib/po-state-machine.ts.
 */
export type POApprovalStatus =
    | "PO_DRAFT"
    | "PENDING_APPROVAL"
    | "APPROVED"
    | "ORDERED"
    | "VENDOR_CONFIRMED"
    | "SHIPPED"
    | "PARTIAL_RECEIVED"
    | "RECEIVED"
    | "COMPLETED"
    | "REJECTED"
    | "CANCELLED"

type StepStatus = "done" | "current" | "pending" | "rejected" | "cancelled"

type Step = {
    label: string
    actor: string
    status: StepStatus
    note?: string
}

const POST_APPROVAL_STATUSES: POApprovalStatus[] = [
    "APPROVED",
    "ORDERED",
    "VENDOR_CONFIRMED",
    "SHIPPED",
    "PARTIAL_RECEIVED",
    "RECEIVED",
    "COMPLETED",
]

function isPostApproval(status: POApprovalStatus): boolean {
    return POST_APPROVAL_STATUSES.includes(status)
}

export function ApprovalWorkflowSteps({
    amount,
    status,
    creatorName,
    approverName,
    ceoName,
}: {
    amount: number
    status: POApprovalStatus
    creatorName: string
    approverName?: string
    ceoName?: string
}) {
    const needsCEO = amount > CEO_THRESHOLD
    const postApproval = isPostApproval(status)
    const isRejected = status === "REJECTED"
    const isCancelled = status === "CANCELLED"

    // Step pertama (Dibuat) selalu selesai. Untuk PO yang dibatalkan, kita
    // tetap mark step Dibuat sebagai done — tapi step di belakangnya
    // ditandai cancelled (bukan pending) supaya jelas bahwa flow
    // dihentikan, bukan masih menunggu.
    const steps: Step[] = [
        { label: "Dibuat", actor: creatorName, status: "done" },
        {
            label: "Manager Review",
            actor: isRejected ? (approverName ?? "Manajer") : approverName ?? "Menunggu",
            status: isRejected
                ? "rejected"
                : isCancelled
                    ? "cancelled"
                    : postApproval
                        ? "done"
                        : status === "PENDING_APPROVAL"
                            ? "current"
                            : "pending",
            note: isRejected ? "PO ditolak di sini" : undefined,
        },
    ]

    if (needsCEO) {
        const ceoStatus: StepStatus = isRejected
            ? "cancelled" // sudah di-reject di Manager step → CEO jadi tidak relevan
            : isCancelled
                ? "cancelled"
                : postApproval
                    ? "done"
                    : "pending"
        steps.push({
            label: "CEO Approval",
            actor: ceoName ?? (isRejected || isCancelled ? "—" : "Menunggu"),
            status: ceoStatus,
            note: `Wajib (>Rp ${(CEO_THRESHOLD / 1_000_000).toFixed(0)} jt)`,
        })
    }

    return (
        <ol
            aria-label="Alur approval"
            className="flex items-start gap-2 list-none p-0 m-0"
        >
            {steps.map((s, i) => (
                <React.Fragment key={s.label}>
                    <li
                        data-step-status={s.status}
                        className="flex flex-col items-center min-w-[100px]"
                    >
                        <span
                            aria-hidden="true"
                            className={cn(
                                "w-6 h-6 rounded-full grid place-items-center text-[10px] font-mono mb-1.5",
                                s.status === "done" && "bg-[var(--integra-green-ok)] text-white",
                                s.status === "current" &&
                                    "border-2 border-[var(--integra-liren-blue)] text-[var(--integra-liren-blue)]",
                                s.status === "pending" &&
                                    "border border-[var(--integra-hairline-strong)] text-[var(--integra-muted)]",
                                s.status === "rejected" &&
                                    "bg-[var(--integra-red)] text-white",
                                s.status === "cancelled" &&
                                    "bg-[#E8E5DA] text-[var(--integra-muted)] line-through",
                            )}
                        >
                            {s.status === "rejected" ? "✕" : i + 1}
                        </span>
                        <div
                            className={cn(
                                "text-[11.5px] font-medium text-center",
                                s.status === "cancelled"
                                    ? "text-[var(--integra-muted)] line-through"
                                    : "text-[var(--integra-ink)]",
                            )}
                        >
                            {s.label}
                        </div>
                        <div className="text-[10.5px] text-[var(--integra-muted)] text-center">
                            {s.actor}
                        </div>
                        {s.note && (
                            <div
                                className={cn(
                                    "text-[10px] italic mt-0.5 text-center",
                                    s.status === "rejected"
                                        ? "text-[var(--integra-red)]"
                                        : "text-[var(--integra-muted)]",
                                )}
                            >
                                {s.note}
                            </div>
                        )}
                    </li>
                    {i < steps.length - 1 && (
                        <div
                            aria-hidden="true"
                            className={cn(
                                "flex-1 h-px mt-3",
                                s.status === "done"
                                    ? "bg-[var(--integra-green-ok)]"
                                    : s.status === "rejected"
                                        ? "bg-[var(--integra-red)]"
                                        : s.status === "cancelled"
                                            ? "bg-[#E8E5DA]"
                                            : "bg-[var(--integra-hairline-strong)]",
                            )}
                        />
                    )}
                </React.Fragment>
            ))}
        </ol>
    )
}
