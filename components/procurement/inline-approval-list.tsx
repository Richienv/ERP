"use client"

import { useState } from "react"
import { CheckCircle, XCircle, FileText, Loader2, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { formatIDR } from "@/lib/utils"
import { approvePurchaseOrder, rejectPurchaseOrder, approvePurchaseRequest, rejectPurchaseRequest } from "@/lib/actions/procurement"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

interface PendingItem {
    id: string
    type: 'PO' | 'PR'
    number: string
    label: string
    amount: number
    department?: string
    priority?: string
    itemCount: number
    items: Array<{ productName: string; productCode: string; quantity: number }>
}

interface InlineApprovalListProps {
    pendingItems: PendingItem[]
}

export function InlineApprovalList({ pendingItems }: InlineApprovalListProps) {
    const [processing, setProcessing] = useState<string | null>(null)
    const [removedIds, setRemovedIds] = useState<Set<string>>(new Set())
    const [rejectTarget, setRejectTarget] = useState<PendingItem | null>(null)
    const [rejectReason, setRejectReason] = useState("")
    const [detailTarget, setDetailTarget] = useState<PendingItem | null>(null)
    const router = useRouter()

    // Optimistically filter out removed items
    const visibleItems = pendingItems.filter(item => !removedIds.has(item.id))

    const handleApprove = async (item: PendingItem) => {
        setProcessing(item.id)
        try {
            const result = item.type === 'PO'
                ? await approvePurchaseOrder(item.id)
                : await approvePurchaseRequest(item.id)
            if (result.success) {
                // Optimistically remove from list immediately
                setRemovedIds(prev => new Set(prev).add(item.id))
                toast.success(`${item.type} ${item.number} disetujui`)
                router.refresh()
            } else {
                toast.error(result.error || "Gagal menyetujui")
            }
        } catch {
            toast.error(`Error saat menyetujui ${item.type}`)
        } finally {
            setProcessing(null)
        }
    }

    const handleReject = async () => {
        if (!rejectTarget || !rejectReason.trim()) {
            toast.error("Berikan alasan penolakan")
            return
        }
        setProcessing(rejectTarget.id)
        try {
            const result = rejectTarget.type === 'PO'
                ? await rejectPurchaseOrder(rejectTarget.id, rejectReason)
                : await rejectPurchaseRequest(rejectTarget.id, rejectReason)
            if (result.success) {
                // Optimistically remove from list immediately
                setRemovedIds(prev => new Set(prev).add(rejectTarget.id))
                toast.success(`${rejectTarget.type} ${rejectTarget.number} ditolak`)
                setRejectTarget(null)
                setRejectReason("")
                router.refresh()
            } else {
                toast.error(result.error || "Gagal menolak")
            }
        } catch {
            toast.error(`Error saat menolak ${rejectTarget.type}`)
        } finally {
            setProcessing(null)
        }
    }

    if (visibleItems.length === 0) {
        return (
            <div className="py-10 text-center text-zinc-400 text-xs font-bold uppercase tracking-widest flex flex-col items-center gap-2">
                <CheckCircle className="h-6 w-6 text-emerald-400" />
                Tidak ada yang perlu disetujui
            </div>
        )
    }

    return (
        <>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {visibleItems.map((item, idx) => (
                    <div
                        key={`${item.type}-${item.id}`}
                        className={`px-5 py-3 flex items-center gap-4 ${idx % 2 === 0 ? '' : 'bg-zinc-50/50 dark:bg-zinc-800/10'}`}
                    >
                        {/* Type badge */}
                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 border rounded-sm flex-shrink-0 ${
                            item.type === 'PO'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-purple-50 text-purple-700 border-purple-200'
                        }`}>
                            {item.type}
                        </span>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold font-mono text-zinc-900 dark:text-zinc-100">{item.number}</span>
                                {item.priority && item.priority !== 'NORMAL' && (
                                    <span className="text-[9px] font-black uppercase px-1.5 py-0.5 border rounded-sm bg-red-50 text-red-600 border-red-200">
                                        {item.priority}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[11px] text-zinc-500 font-medium truncate">{item.label}</span>
                                <span className="text-[10px] text-zinc-300">&bull;</span>
                                <span className="text-[10px] text-zinc-400">{item.itemCount} item</span>
                                {item.department && (
                                    <>
                                        <span className="text-[10px] text-zinc-300">&bull;</span>
                                        <span className="text-[10px] text-zinc-400">{item.department}</span>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Amount */}
                        {item.amount > 0 && (
                            <span className="text-sm font-black text-zinc-900 dark:text-zinc-100 flex-shrink-0 font-mono">
                                {formatIDR(item.amount)}
                            </span>
                        )}

                        {/* Action buttons — compact inline */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                                onClick={() => handleApprove(item)}
                                disabled={processing === item.id}
                                title="Approve"
                                className="h-8 w-8 flex items-center justify-center border-2 border-emerald-300 text-emerald-500 hover:bg-emerald-50 hover:border-emerald-500 hover:text-emerald-700 transition-colors rounded-sm disabled:opacity-40"
                            >
                                {processing === item.id
                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    : <CheckCircle className="h-3.5 w-3.5" />
                                }
                            </button>
                            <button
                                onClick={() => setRejectTarget(item)}
                                disabled={processing === item.id}
                                title="Reject"
                                className="h-8 w-8 flex items-center justify-center border-2 border-red-300 text-red-400 hover:bg-red-50 hover:border-red-500 hover:text-red-600 transition-colors rounded-sm disabled:opacity-40"
                            >
                                <XCircle className="h-3.5 w-3.5" />
                            </button>
                            <button
                                onClick={() => setDetailTarget(item)}
                                title="Lihat Detail"
                                className="h-8 w-8 flex items-center justify-center border-2 border-zinc-200 text-zinc-400 hover:bg-zinc-50 hover:border-zinc-400 hover:text-zinc-600 transition-colors rounded-sm"
                            >
                                <Eye className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Reject Dialog */}
            <Dialog open={!!rejectTarget} onOpenChange={() => { setRejectTarget(null); setRejectReason("") }}>
                <DialogContent className="max-w-md border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-0 overflow-hidden bg-white">
                    <DialogHeader className="p-6 pb-2 border-b border-black/10 bg-zinc-50">
                        <DialogTitle className="text-lg font-black uppercase flex items-center gap-2">
                            <XCircle className="h-5 w-5 text-red-500" /> Tolak {rejectTarget?.type} {rejectTarget?.number}
                        </DialogTitle>
                        <DialogDescription className="font-medium text-black/60">
                            Berikan alasan penolakan.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="p-6 space-y-4">
                        <div className="bg-zinc-50 border-2 border-zinc-200 p-3">
                            <p className="font-bold text-sm">{rejectTarget?.label}</p>
                            <p className="text-xs text-zinc-500 mt-0.5">
                                {rejectTarget?.itemCount} item
                                {rejectTarget && rejectTarget.amount > 0 ? ` — ${formatIDR(rejectTarget.amount)}` : ''}
                            </p>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Alasan Penolakan *</label>
                            <Textarea
                                placeholder="Tulis alasan penolakan..."
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                className="min-h-[80px] border-2 border-black resize-none"
                            />
                        </div>
                    </div>
                    <DialogFooter className="p-6 pt-2 border-t border-black/10 bg-zinc-50 flex gap-2">
                        <Button
                            variant="outline"
                            className="border-2 border-zinc-300 font-bold uppercase text-xs"
                            onClick={() => { setRejectTarget(null); setRejectReason("") }}
                        >
                            Batal
                        </Button>
                        <Button
                            onClick={handleReject}
                            disabled={!!processing || !rejectReason.trim()}
                            className="bg-red-500 hover:bg-red-600 border-2 border-red-600 text-white font-black uppercase text-xs shadow-[3px_3px_0px_0px_rgba(0,0,0,0.2)] active:shadow-none active:translate-y-[1px] transition-all"
                        >
                            {processing ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <XCircle className="h-3 w-3 mr-1" />}
                            Konfirmasi Tolak
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Detail Dialog */}
            <Dialog open={!!detailTarget} onOpenChange={() => setDetailTarget(null)}>
                <DialogContent className="max-w-lg border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-0 overflow-hidden bg-white">
                    <DialogHeader className="p-6 pb-2 border-b border-black/10 bg-zinc-50">
                        <DialogTitle className="text-lg font-black uppercase flex items-center gap-2">
                            <FileText className="h-5 w-5" /> Detail {detailTarget?.type} {detailTarget?.number}
                        </DialogTitle>
                        <DialogDescription className="font-medium text-black/60">
                            {detailTarget?.type === 'PO' ? 'Pesanan Pembelian' : 'Permintaan Pembelian'}
                        </DialogDescription>
                    </DialogHeader>
                    {detailTarget && (
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-zinc-50 border-2 border-zinc-200 p-3">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-0.5">
                                        {detailTarget.type === 'PO' ? 'Vendor' : 'Pemohon'}
                                    </p>
                                    <p className="text-sm font-bold text-zinc-900">{detailTarget.label}</p>
                                </div>
                                {detailTarget.amount > 0 && (
                                    <div className="bg-zinc-50 border-2 border-zinc-200 p-3">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-0.5">Total</p>
                                        <p className="text-sm font-black text-zinc-900">{formatIDR(detailTarget.amount)}</p>
                                    </div>
                                )}
                                {detailTarget.department && (
                                    <div className="bg-zinc-50 border-2 border-zinc-200 p-3">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-0.5">Departemen</p>
                                        <p className="text-sm font-bold text-zinc-900">{detailTarget.department}</p>
                                    </div>
                                )}
                            </div>

                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Item ({detailTarget.itemCount})</p>
                                <div className="border-2 border-zinc-200 overflow-hidden max-h-48 overflow-y-auto">
                                    {detailTarget.items.map((item, idx) => (
                                        <div key={idx} className={`px-3 py-2 flex justify-between items-center text-xs ${idx % 2 === 0 ? 'bg-white' : 'bg-zinc-50/50'}`}>
                                            <div className="min-w-0">
                                                <p className="font-medium text-zinc-900">{item.productName}</p>
                                                <p className="text-[10px] text-zinc-400 font-mono">{item.productCode}</p>
                                            </div>
                                            <span className="font-bold text-zinc-700 flex-shrink-0 ml-3">{item.quantity} pcs</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-2 pt-1">
                                <Button
                                    onClick={() => { handleApprove(detailTarget); setDetailTarget(null) }}
                                    disabled={!!processing}
                                    className="flex-1 h-10 bg-emerald-500 hover:bg-emerald-600 border-2 border-emerald-600 text-white font-black uppercase text-xs shadow-[3px_3px_0px_0px_rgba(0,0,0,0.2)] active:shadow-none active:translate-y-[1px] transition-all"
                                >
                                    <CheckCircle className="h-3.5 w-3.5 mr-1.5" /> Approve
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => { setDetailTarget(null); setRejectTarget(detailTarget) }}
                                    className="flex-1 h-10 border-2 border-red-300 text-red-600 hover:bg-red-50 hover:border-red-500 font-black uppercase text-xs"
                                >
                                    <XCircle className="h-3.5 w-3.5 mr-1.5" /> Reject
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    )
}
