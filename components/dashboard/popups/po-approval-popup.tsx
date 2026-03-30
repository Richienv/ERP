"use client"

import { useState, useEffect, useCallback } from "react"
import { ShieldCheck, Package, Loader2, CheckCircle2, XCircle } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
    NBDialog,
    NBDialogHeader,
    NBDialogBody,
    NBSection,
} from "@/components/ui/nb-dialog"
import { Button } from "@/components/ui/button"
import { formatIDR } from "@/lib/utils"
import { queryKeys } from "@/lib/query-keys"
import type { SidebarActionCounts } from "@/hooks/use-sidebar-actions"
import { approvePurchaseOrder, rejectPurchaseOrder } from "@/lib/actions/procurement"

interface PendingPO {
    id: string
    number: string
    supplierName: string
    totalAmount: number
    itemCount: number
    orderDate: string
}

interface POApprovalPopupProps {
    open: boolean
    onClose: () => void
    onAllActioned?: () => void
}

export function POApprovalPopup({ open, onClose, onAllActioned }: POApprovalPopupProps) {
    const [items, setItems] = useState<PendingPO[]>([])
    const [loading, setLoading] = useState(true)
    const [acting, setActing] = useState<string | null>(null)
    const queryClient = useQueryClient()

    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch("/api/dashboard/pending-pos")
            const json = await res.json()
            setItems(json.pos ?? [])
        } catch {
            setItems([])
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        if (open) fetchData()
    }, [open, fetchData])

    const invalidateAll = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.procurementDashboard.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.sidebarActions.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.approvals.all })
    }, [queryClient])

    const handleApprove = useCallback(async (po: PendingPO) => {
        setActing(po.id)
        try {
            const result = await approvePurchaseOrder(po.id)
            if (result.success) {
                toast.success(`PO ${po.number} disetujui`)
                queryClient.setQueryData<SidebarActionCounts | null>(
                    queryKeys.sidebarActions.list(),
                    (old) => old ? { ...old, pendingApprovals: Math.max(0, old.pendingApprovals - 1) } : old
                )
                const remaining = items.filter((i) => i.id !== po.id)
                setItems(remaining)
                invalidateAll()
                if (remaining.length === 0) {
                    onAllActioned?.()
                    onClose()
                }
            } else {
                toast.error(result.error || "Gagal menyetujui PO")
            }
        } catch (err: any) {
            toast.error(err.message || "Gagal menyetujui PO")
        } finally {
            setActing(null)
        }
    }, [items, invalidateAll, onClose, onAllActioned, queryClient])

    const handleReject = useCallback(async (po: PendingPO) => {
        const reason = window.prompt(`Alasan penolakan PO ${po.number}:`)
        if (!reason) return

        setActing(po.id)
        try {
            const result = await rejectPurchaseOrder(po.id, reason)
            if (result.success) {
                toast.success(`PO ${po.number} ditolak`)
                queryClient.setQueryData<SidebarActionCounts | null>(
                    queryKeys.sidebarActions.list(),
                    (old) => old ? { ...old, pendingApprovals: Math.max(0, old.pendingApprovals - 1) } : old
                )
                const remaining = items.filter((i) => i.id !== po.id)
                setItems(remaining)
                invalidateAll()
                if (remaining.length === 0) {
                    onAllActioned?.()
                    onClose()
                }
            } else {
                toast.error(result.error || "Gagal menolak PO")
            }
        } catch (err: any) {
            toast.error(err.message || "Gagal menolak PO")
        } finally {
            setActing(null)
        }
    }, [items, invalidateAll, onClose, onAllActioned, queryClient])

    return (
        <NBDialog open={open} onOpenChange={(v) => !v && onClose()}>
            <NBDialogHeader icon={ShieldCheck} title="Persetujuan PO" subtitle={`${items.length} PO menunggu persetujuan`} />
            <NBDialogBody>
                {loading ? (
                    <div className="flex items-center justify-center py-10">
                        <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                    </div>
                ) : items.length === 0 ? (
                    <p className="text-sm text-zinc-500 text-center py-10">
                        Tidak ada PO yang menunggu persetujuan.
                    </p>
                ) : (
                    items.map((po) => (
                        <NBSection key={po.id} icon={Package} title={po.number}>
                            <div className="flex items-center justify-between gap-3">
                                <div className="space-y-0.5 min-w-0 flex-1">
                                    <p className="text-sm font-bold truncate">{po.supplierName}</p>
                                    <p className="text-xs text-zinc-500">
                                        {po.itemCount} item &middot; {new Date(po.orderDate).toLocaleDateString("id-ID")}
                                    </p>
                                    <p className="text-sm font-mono font-bold text-emerald-700">
                                        {formatIDR(po.totalAmount)}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <Button
                                        size="sm"
                                        disabled={acting === po.id}
                                        onClick={() => handleApprove(po)}
                                        className="h-7 px-3 rounded-none bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-wider"
                                    >
                                        {acting === po.id ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                            <CheckCircle2 className="h-3 w-3 mr-1" />
                                        )}
                                        Setujui
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={acting === po.id}
                                        onClick={() => handleReject(po)}
                                        className="h-7 px-3 rounded-none border-red-300 text-red-600 hover:bg-red-50 text-[10px] font-black uppercase tracking-wider"
                                    >
                                        <XCircle className="h-3 w-3 mr-1" />
                                        Tolak
                                    </Button>
                                </div>
                            </div>
                        </NBSection>
                    ))
                )}
            </NBDialogBody>
        </NBDialog>
    )
}
