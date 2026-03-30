"use client"

import { useState, useEffect, useCallback } from "react"
import { ClipboardList, Loader2, CheckCircle2, XCircle, Package } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
    NBDialog,
    NBDialogHeader,
    NBDialogBody,
    NBSection,
    NBInput,
} from "@/components/ui/nb-dialog"
import { Button } from "@/components/ui/button"
import { formatIDR } from "@/lib/utils"
import { queryKeys } from "@/lib/query-keys"
import type { SidebarActionCounts } from "@/hooks/use-sidebar-actions"
import { approvePurchaseRequest, rejectPurchaseRequest } from "@/lib/actions/procurement"

interface PRItem {
    id: string
    productName: string
    quantity: number
    unit: string
    estimatedPrice: number
}

interface PendingPR {
    id: string
    number: string
    requesterName: string
    department: string | null
    priority: string
    notes: string | null
    itemCount: number
    items: PRItem[]
    estimatedTotal: number
    createdAt: string
}

interface PRApprovalPopupProps {
    open: boolean
    onClose: () => void
    onAllActioned?: () => void
}

export function PRApprovalPopup({ open, onClose, onAllActioned }: PRApprovalPopupProps) {
    const [items, setItems] = useState<PendingPR[]>([])
    const [loading, setLoading] = useState(true)
    const [acting, setActing] = useState<string | null>(null)
    const [rejectingId, setRejectingId] = useState<string | null>(null)
    const [rejectReason, setRejectReason] = useState("")
    const queryClient = useQueryClient()

    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch("/api/dashboard/pending-prs")
            const json = await res.json()
            setItems(json.prs ?? [])
        } catch {
            setItems([])
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        if (open) {
            fetchData()
            setRejectingId(null)
            setRejectReason("")
        }
    }, [open, fetchData])

    const invalidateAll = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.procurementDashboard.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.sidebarActions.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.approvals.all })
    }, [queryClient])

    const handleApprove = useCallback(async (pr: PendingPR) => {
        setActing(pr.id)
        try {
            const result = await approvePurchaseRequest(pr.id)
            if (result.success) {
                toast.success(`PR ${pr.number} disetujui`)
                queryClient.setQueryData<SidebarActionCounts | null>(
                    queryKeys.sidebarActions.list(),
                    (old) => old ? { ...old, pendingPurchaseRequests: Math.max(0, old.pendingPurchaseRequests - 1) } : old
                )
                const remaining = items.filter((i) => i.id !== pr.id)
                setItems(remaining)
                invalidateAll()
                if (remaining.length === 0) {
                    onAllActioned?.()
                    onClose()
                }
            } else {
                toast.error(result.error || "Gagal menyetujui PR")
            }
        } catch (err: any) {
            toast.error(err.message || "Gagal menyetujui PR")
        } finally {
            setActing(null)
        }
    }, [items, invalidateAll, onClose, onAllActioned, queryClient])

    const handleReject = useCallback(async (pr: PendingPR) => {
        if (!rejectReason.trim()) {
            toast.error("Masukkan alasan penolakan")
            return
        }

        setActing(pr.id)
        try {
            const result = await rejectPurchaseRequest(pr.id, rejectReason.trim())
            if (result.success) {
                toast.success(`PR ${pr.number} ditolak`)
                queryClient.setQueryData<SidebarActionCounts | null>(
                    queryKeys.sidebarActions.list(),
                    (old) => old ? { ...old, pendingPurchaseRequests: Math.max(0, old.pendingPurchaseRequests - 1) } : old
                )
                const remaining = items.filter((i) => i.id !== pr.id)
                setItems(remaining)
                setRejectingId(null)
                setRejectReason("")
                invalidateAll()
                if (remaining.length === 0) {
                    onAllActioned?.()
                    onClose()
                }
            } else {
                toast.error(result.error || "Gagal menolak PR")
            }
        } catch (err: any) {
            toast.error(err.message || "Gagal menolak PR")
        } finally {
            setActing(null)
        }
    }, [items, rejectReason, invalidateAll, onClose, onAllActioned, queryClient])

    return (
        <NBDialog open={open} onOpenChange={(v) => !v && onClose()}>
            <NBDialogHeader icon={ClipboardList} title="Purchase Request Menunggu" subtitle={`${items.length} PR menunggu persetujuan`} />
            <NBDialogBody>
                {loading ? (
                    <div className="flex items-center justify-center py-10">
                        <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                    </div>
                ) : items.length === 0 ? (
                    <p className="text-sm text-zinc-500 text-center py-10">
                        Tidak ada Purchase Request yang menunggu.
                    </p>
                ) : (
                    items.map((pr) => (
                        <NBSection key={pr.id} icon={ClipboardList} title={pr.number}>
                            <div className="space-y-3">
                                {/* PR Info */}
                                <div className="flex items-start justify-between gap-3">
                                    <div className="space-y-0.5 min-w-0 flex-1">
                                        <p className="text-sm font-bold truncate">Pemohon: {pr.requesterName}</p>
                                        {pr.department && (
                                            <p className="text-xs text-zinc-500">Dept: {pr.department}</p>
                                        )}
                                        <p className="text-xs text-zinc-500">
                                            {pr.itemCount} item &middot; {new Date(pr.createdAt).toLocaleDateString("id-ID")}
                                        </p>
                                    </div>
                                    {pr.priority !== "NORMAL" && (
                                        <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 border shrink-0 ${
                                            pr.priority === "URGENT"
                                                ? "border-red-300 bg-red-50 text-red-700"
                                                : "border-amber-300 bg-amber-50 text-amber-700"
                                        }`}>
                                            {pr.priority}
                                        </span>
                                    )}
                                </div>

                                {/* Line Items */}
                                {pr.items.length > 0 && (
                                    <div className="border border-zinc-200 dark:border-zinc-700">
                                        <div className="bg-zinc-50 dark:bg-zinc-800/50 px-3 py-1 border-b border-zinc-200 dark:border-zinc-700">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Item</span>
                                        </div>
                                        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                            {pr.items.map((item) => (
                                                <div key={item.id} className="flex items-center justify-between px-3 py-1.5">
                                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                                        <Package className="h-3 w-3 text-zinc-400 shrink-0" />
                                                        <span className="text-xs truncate">{item.productName}</span>
                                                    </div>
                                                    <div className="text-right shrink-0 ml-3">
                                                        <span className="text-xs font-mono">
                                                            {item.quantity} {item.unit}
                                                        </span>
                                                        {item.estimatedPrice > 0 && (
                                                            <span className="text-xs text-zinc-400 ml-2">
                                                                @ {formatIDR(item.estimatedPrice)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Estimated Total */}
                                {pr.estimatedTotal > 0 && (
                                    <div className="flex justify-between items-center px-1">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Estimasi Total</span>
                                        <span className="text-sm font-mono font-bold text-emerald-700">{formatIDR(pr.estimatedTotal)}</span>
                                    </div>
                                )}

                                {/* Notes */}
                                {pr.notes && (
                                    <p className="text-xs text-zinc-500 italic px-1">Catatan: {pr.notes}</p>
                                )}

                                {/* Action Buttons */}
                                {rejectingId === pr.id ? (
                                    <div className="space-y-2">
                                        <NBInput
                                            label="Alasan Penolakan"
                                            required
                                            value={rejectReason}
                                            onChange={setRejectReason}
                                            placeholder="Masukkan alasan..."
                                        />
                                        <div className="flex gap-1.5">
                                            <Button
                                                size="sm"
                                                disabled={acting === pr.id || !rejectReason.trim()}
                                                onClick={() => handleReject(pr)}
                                                className="flex-1 h-7 px-3 rounded-none bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-wider"
                                            >
                                                {acting === pr.id ? (
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                    <XCircle className="h-3 w-3 mr-1" />
                                                )}
                                                Konfirmasi Tolak
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => { setRejectingId(null); setRejectReason("") }}
                                                className="h-7 px-3 rounded-none border-zinc-300 text-zinc-600 text-[10px] font-black uppercase tracking-wider"
                                            >
                                                Batal
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex gap-1.5">
                                        <Button
                                            size="sm"
                                            disabled={acting === pr.id}
                                            onClick={() => handleApprove(pr)}
                                            className="flex-1 h-7 px-3 rounded-none bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-wider"
                                        >
                                            {acting === pr.id ? (
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                            ) : (
                                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                            )}
                                            Setujui
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={acting === pr.id}
                                            onClick={() => setRejectingId(pr.id)}
                                            className="flex-1 h-7 px-3 rounded-none border-red-300 text-red-600 hover:bg-red-50 text-[10px] font-black uppercase tracking-wider"
                                        >
                                            <XCircle className="h-3 w-3 mr-1" />
                                            Tolak
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </NBSection>
                    ))
                )}
            </NBDialogBody>
        </NBDialog>
    )
}
