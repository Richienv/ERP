"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { updateCutPlanStatus } from "@/lib/actions/cutting"
import { cutPlanStatusLabels } from "@/lib/cut-plan-state-machine"
import type { CutPlanStatus } from "@prisma/client"

const STATUS_ACTION_STYLES: Partial<Record<CutPlanStatus, string>> = {
    FABRIC_ALLOCATED: "bg-blue-600 text-white border-blue-700 hover:bg-blue-700",
    IN_CUTTING: "bg-amber-500 text-white border-amber-600 hover:bg-amber-600",
    CP_COMPLETED: "bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700",
    CP_CANCELLED: "bg-red-500 text-white border-red-600 hover:bg-red-600",
    CP_DRAFT: "bg-zinc-200 text-zinc-700 border-zinc-400 hover:bg-zinc-300",
}

interface CutPlanStatusActionsProps {
    planId: string
    currentStatus: CutPlanStatus
    nextStatuses: CutPlanStatus[]
}

export function CutPlanStatusActions({
    planId,
    currentStatus,
    nextStatuses,
}: CutPlanStatusActionsProps) {
    const queryClient = useQueryClient()
    const [loading, setLoading] = useState<CutPlanStatus | null>(null)

    const handleTransition = async (newStatus: CutPlanStatus) => {
        setLoading(newStatus)
        try {
            const result = await updateCutPlanStatus(planId, newStatus)
            if (result.success) {
                toast.success(`Status diubah ke "${cutPlanStatusLabels[newStatus]}"`)
                queryClient.invalidateQueries({ queryKey: queryKeys.cutPlans.all })
            } else {
                toast.error(result.error || "Gagal mengubah status")
            }
        } catch {
            toast.error("Gagal mengubah status")
        } finally {
            setLoading(null)
        }
    }

    return (
        <div className="flex items-center gap-2">
            {nextStatuses.map((status) => (
                <button
                    key={status}
                    onClick={() => handleTransition(status)}
                    disabled={loading !== null}
                    className={`text-[9px] font-black uppercase tracking-wider px-3 py-1.5 border-2 transition-colors disabled:opacity-50 ${
                        STATUS_ACTION_STYLES[status] || "bg-zinc-100 border-zinc-300"
                    }`}
                >
                    {loading === status ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                        cutPlanStatusLabels[status]
                    )}
                </button>
            ))}
        </div>
    )
}
