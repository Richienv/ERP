"use client"

import { useState, useEffect, useCallback } from "react"
import { FileText, Loader2, XCircle, Send } from "lucide-react"
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
import { moveInvoiceToSent, cancelInvoice } from "@/lib/actions/finance-invoices"

interface PendingInvoice {
    id: string
    number: string
    type: "INV_OUT" | "INV_IN"
    partyName: string
    totalAmount: number
    createdAt: string
    dueDate: string
}

interface InvoiceApprovalPopupProps {
    open: boolean
    onClose: () => void
    onAllActioned?: () => void
}

export function InvoiceApprovalPopup({ open, onClose, onAllActioned }: InvoiceApprovalPopupProps) {
    const [items, setItems] = useState<PendingInvoice[]>([])
    const [loading, setLoading] = useState(true)
    const [acting, setActing] = useState<string | null>(null)
    const queryClient = useQueryClient()

    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch("/api/dashboard/pending-invoices")
            const json = await res.json()
            setItems(json.invoices ?? [])
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
        queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.sidebarActions.all })
        queryClient.invalidateQueries({ queryKey: ["finance", "ar-aging"] })
        queryClient.invalidateQueries({ queryKey: ["finance", "ap-aging"] })
        queryClient.invalidateQueries({ queryKey: queryKeys.financeDashboard.all })
    }, [queryClient])

    const handleApprove = useCallback(async (inv: PendingInvoice) => {
        setActing(inv.id)
        try {
            const result = await moveInvoiceToSent(inv.id)
            if (result.success) {
                toast.success(`Invoice ${inv.number} dikirim`)
                queryClient.setQueryData<SidebarActionCounts | null>(
                    queryKeys.sidebarActions.list(),
                    (old) => old ? { ...old, pendingInvoices: Math.max(0, old.pendingInvoices - 1) } : old
                )
                const remaining = items.filter((i) => i.id !== inv.id)
                setItems(remaining)
                invalidateAll()
                if (remaining.length === 0) {
                    onAllActioned?.()
                    onClose()
                }
            } else {
                toast.error(result.error || "Gagal mengirim invoice")
            }
        } catch (err: any) {
            toast.error(err.message || "Gagal mengirim invoice")
        } finally {
            setActing(null)
        }
    }, [items, invalidateAll, onClose, onAllActioned, queryClient])

    const handleReject = useCallback(async (inv: PendingInvoice) => {
        const reason = window.prompt(`Alasan pembatalan Invoice ${inv.number}:`)
        if (!reason) return

        setActing(inv.id)
        try {
            const result = await cancelInvoice(inv.id, reason)
            if (result.success) {
                toast.success(`Invoice ${inv.number} dibatalkan`)
                queryClient.setQueryData<SidebarActionCounts | null>(
                    queryKeys.sidebarActions.list(),
                    (old) => old ? { ...old, pendingInvoices: Math.max(0, old.pendingInvoices - 1) } : old
                )
                const remaining = items.filter((i) => i.id !== inv.id)
                setItems(remaining)
                invalidateAll()
                if (remaining.length === 0) {
                    onAllActioned?.()
                    onClose()
                }
            } else {
                toast.error(result.error || "Gagal membatalkan invoice")
            }
        } catch (err: any) {
            toast.error(err.message || "Gagal membatalkan invoice")
        } finally {
            setActing(null)
        }
    }, [items, invalidateAll, onClose, onAllActioned, queryClient])

    return (
        <NBDialog open={open} onOpenChange={(v) => !v && onClose()}>
            <NBDialogHeader icon={FileText} title="Invoice Draft" subtitle={`${items.length} invoice menunggu pengiriman`} />
            <NBDialogBody>
                {loading ? (
                    <div className="flex items-center justify-center py-10">
                        <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                    </div>
                ) : items.length === 0 ? (
                    <p className="text-sm text-zinc-500 text-center py-10">
                        Tidak ada invoice draft.
                    </p>
                ) : (
                    items.map((inv) => (
                        <NBSection key={inv.id} icon={FileText} title={inv.number}>
                            <div className="flex items-center justify-between gap-3">
                                <div className="space-y-0.5 min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 border ${
                                            inv.type === "INV_OUT"
                                                ? "border-blue-300 bg-blue-50 text-blue-700"
                                                : "border-amber-300 bg-amber-50 text-amber-700"
                                        }`}>
                                            {inv.type === "INV_OUT" ? "PIUTANG" : "HUTANG"}
                                        </span>
                                        <p className="text-sm font-bold truncate">{inv.partyName}</p>
                                    </div>
                                    <p className="text-xs text-zinc-500">
                                        Jatuh tempo: {new Date(inv.dueDate).toLocaleDateString("id-ID")}
                                    </p>
                                    <p className="text-sm font-mono font-bold text-emerald-700">
                                        {formatIDR(inv.totalAmount)}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <Button
                                        size="sm"
                                        disabled={acting === inv.id}
                                        onClick={() => handleApprove(inv)}
                                        className="h-7 px-3 rounded-none bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-wider"
                                    >
                                        {acting === inv.id ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                            <Send className="h-3 w-3 mr-1" />
                                        )}
                                        Kirim
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={acting === inv.id}
                                        onClick={() => handleReject(inv)}
                                        className="h-7 px-3 rounded-none border-red-300 text-red-600 hover:bg-red-50 text-[10px] font-black uppercase tracking-wider"
                                    >
                                        <XCircle className="h-3 w-3 mr-1" />
                                        Batal
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
