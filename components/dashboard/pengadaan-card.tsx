"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Truck, CheckCircle, XCircle, FileText, Loader2 } from "lucide-react"
import Link from "next/link"
import { formatIDR } from "@/lib/utils"
import { approvePurchaseOrder, rejectPurchaseOrder } from "@/lib/actions/procurement"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

interface PendingPO {
    id: string
    number: string
    supplier: {
        name: string
        email: string | null
        phone: string | null
    }
    totalAmount: number
    netAmount: number
    itemCount: number
    items: Array<{
        productName: string
        productCode: string
        quantity: number
    }>
}

interface PengadaanCardProps {
    pendingApproval: PendingPO[]
    activeCount: number
    pendingRequestsCount: number
    poStatusSummary?: {
        draft: number
        requested: number
        approved: number
        active: number
        completed: number
        blocked: number
    }
    prStatusSummary?: {
        draft: number
        requested: number
        approved: number
        converted: number
        blocked: number
    }
    pendingRequests: Array<{
        id: string
        number: string
        requesterName: string
        itemCount: number
        status: string
    }>
    recentPOs: Array<{
        id: string
        number: string
        status: string
        supplierName: string
        itemQty: number
        totalAmount: number
        date: string
    }>
    recentPRs: Array<{
        id: string
        number: string
        status: string
        requesterName: string
        itemCount: number
        date: string
    }>
}

const statusBadgeClass = (status: string) => {
    if (['PENDING_APPROVAL', 'PENDING'].includes(status)) return 'bg-amber-100 text-amber-800 border-amber-200'
    if (['APPROVED', 'PO_CREATED', 'COMPLETED', 'RECEIVED'].includes(status)) return 'bg-emerald-100 text-emerald-800 border-emerald-200'
    if (['PO_DRAFT', 'DRAFT'].includes(status)) return 'bg-zinc-100 text-zinc-700 border-zinc-200'
    if (['REJECTED', 'CANCELLED'].includes(status)) return 'bg-red-100 text-red-700 border-red-200'
    return 'bg-blue-100 text-blue-700 border-blue-200'
}

export function PengadaanCard({
    pendingApproval,
    activeCount,
    pendingRequestsCount,
    pendingRequests,
    poStatusSummary,
    prStatusSummary,
    recentPOs,
    recentPRs
}: PengadaanCardProps) {
    const [selectedPO, setSelectedPO] = useState<PendingPO | null>(null)
    const [rejectMode, setRejectMode] = useState(false)
    const [rejectReason, setRejectReason] = useState("")
    const [processing, setProcessing] = useState(false)
    const router = useRouter()

    const handleApprove = async (po: PendingPO) => {
        setProcessing(true)
        try {
            const result = await approvePurchaseOrder(po.id)
            if (result.success) {
                toast.success(`PO ${po.number} approved`)
                setSelectedPO(null)
                router.refresh()
            } else {
                toast.error(result.error || "Failed to approve")
            }
        } catch {
            toast.error("Error approving PO")
        } finally {
            setProcessing(false)
        }
    }

    const handleReject = async () => {
        if (!selectedPO || !rejectReason.trim()) {
            toast.error("Please provide a rejection reason")
            return
        }

        setProcessing(true)
        try {
            const result = await rejectPurchaseOrder(selectedPO.id, rejectReason)
            if (result.success) {
                toast.success(`PO ${selectedPO.number} rejected`)
                setSelectedPO(null)
                setRejectMode(false)
                setRejectReason("")
                router.refresh()
            } else {
                toast.error(result.error || "Failed to reject")
            }
        } catch {
            toast.error("Error rejecting PO")
        } finally {
            setProcessing(false)
        }
    }

    return (
        <>
            <Card className="border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all bg-white h-full">
                <CardHeader className="pb-2 border-b-2 border-dashed border-zinc-200">
                    <CardTitle className="text-xs font-black uppercase tracking-widest text-zinc-500 flex items-center justify-between">
                        <span className="flex items-center gap-2"><Truck className="h-4 w-4 text-blue-600" /> Pengadaan</span>
                        {pendingApproval?.length > 0 ? (
                            <span className="text-[10px] bg-amber-100 text-amber-900 px-1 py-0.5 rounded font-black">
                                {pendingApproval.length} NEEDS APPROVAL
                            </span>
                        ) : (
                            <span className="text-[10px] bg-zinc-100 text-zinc-900 px-1 py-0.5 rounded font-black">ALL CLEAR</span>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                    <div className="text-3xl font-black tracking-tight">{activeCount} PO</div>
                    <p className="text-xs font-bold text-zinc-400 mt-1 mb-4">Active Orders</p>

                    <div className="mb-4 space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">PO Status Snapshot</p>
                        <div className="grid grid-cols-3 gap-2">
                            <div className="rounded border border-zinc-200 bg-zinc-50 p-2">
                                <p className="text-[9px] uppercase text-zinc-500">Draft</p>
                                <p className="text-sm font-black">{poStatusSummary?.draft || 0}</p>
                            </div>
                            <div className="rounded border border-amber-200 bg-amber-50 p-2">
                                <p className="text-[9px] uppercase text-amber-700">Requested</p>
                                <p className="text-sm font-black text-amber-900">{poStatusSummary?.requested || 0}</p>
                            </div>
                            <div className="rounded border border-emerald-200 bg-emerald-50 p-2">
                                <p className="text-[9px] uppercase text-emerald-700">Approved</p>
                                <p className="text-sm font-black text-emerald-900">{poStatusSummary?.approved || 0}</p>
                            </div>
                            <div className="rounded border border-blue-200 bg-blue-50 p-2">
                                <p className="text-[9px] uppercase text-blue-700">Active</p>
                                <p className="text-sm font-black text-blue-900">{poStatusSummary?.active || 0}</p>
                            </div>
                            <div className="rounded border border-emerald-200 bg-emerald-50 p-2">
                                <p className="text-[9px] uppercase text-emerald-700">Completed</p>
                                <p className="text-sm font-black text-emerald-900">{poStatusSummary?.completed || 0}</p>
                            </div>
                            <div className="rounded border border-red-200 bg-red-50 p-2">
                                <p className="text-[9px] uppercase text-red-700">Blocked</p>
                                <p className="text-sm font-black text-red-900">{poStatusSummary?.blocked || 0}</p>
                            </div>
                        </div>
                    </div>

                    <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-2.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700 mb-1">Permintaan Pembelian (PR)</p>
                        <div className="text-sm font-black text-blue-900">{pendingRequestsCount} pending request(s)</div>
                        {pendingRequests.length > 0 && (
                            <div className="mt-2 space-y-1">
                                {pendingRequests.slice(0, 2).map((pr) => (
                                    <div key={pr.id} className="flex items-center justify-between text-[10px] font-medium text-blue-800">
                                        <span className="font-mono">{pr.number}</span>
                                        <span>{pr.itemCount} item</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="mb-4 space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">PR Status Snapshot</p>
                        <div className="grid grid-cols-5 gap-2">
                            <div className="rounded border border-zinc-200 bg-zinc-50 p-2">
                                <p className="text-[9px] uppercase text-zinc-500">Draft</p>
                                <p className="text-sm font-black">{prStatusSummary?.draft || 0}</p>
                            </div>
                            <div className="rounded border border-amber-200 bg-amber-50 p-2">
                                <p className="text-[9px] uppercase text-amber-700">Requested</p>
                                <p className="text-sm font-black text-amber-900">{prStatusSummary?.requested || 0}</p>
                            </div>
                            <div className="rounded border border-emerald-200 bg-emerald-50 p-2">
                                <p className="text-[9px] uppercase text-emerald-700">Approved</p>
                                <p className="text-sm font-black text-emerald-900">{prStatusSummary?.approved || 0}</p>
                            </div>
                            <div className="rounded border border-blue-200 bg-blue-50 p-2">
                                <p className="text-[9px] uppercase text-blue-700">Converted</p>
                                <p className="text-sm font-black text-blue-900">{prStatusSummary?.converted || 0}</p>
                            </div>
                            <div className="rounded border border-red-200 bg-red-50 p-2">
                                <p className="text-[9px] uppercase text-red-700">Blocked</p>
                                <p className="text-sm font-black text-red-900">{prStatusSummary?.blocked || 0}</p>
                            </div>
                        </div>
                    </div>

                    <div className="mb-4">
                        <p className="text-[10px] font-bold text-zinc-500 mb-2 uppercase tracking-wider">PO Overview Table</p>
                        <div className="rounded-lg border border-zinc-200 overflow-hidden">
                            <table className="w-full text-[10px]">
                                <thead className="bg-zinc-100">
                                    <tr>
                                        <th className="px-2 py-1 text-left font-bold uppercase">PO</th>
                                        <th className="px-2 py-1 text-left font-bold uppercase">Vendor</th>
                                        <th className="px-2 py-1 text-left font-bold uppercase">Status</th>
                                        <th className="px-2 py-1 text-right font-bold uppercase">Qty</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentPOs.slice(0, 5).map((po) => (
                                        <tr key={po.id} className="border-t border-zinc-100">
                                            <td className="px-2 py-1.5 font-mono">{po.number}</td>
                                            <td className="px-2 py-1.5">{po.supplierName}</td>
                                            <td className="px-2 py-1.5">
                                                <span className={`inline-flex rounded border px-1.5 py-0.5 text-[9px] font-bold ${statusBadgeClass(po.status)}`}>{po.status}</span>
                                            </td>
                                            <td className="px-2 py-1.5 text-right font-bold">{po.itemQty}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="mb-4">
                        <p className="text-[10px] font-bold text-zinc-500 mb-2 uppercase tracking-wider">PR Overview Table</p>
                        <div className="rounded-lg border border-zinc-200 overflow-hidden">
                            <table className="w-full text-[10px]">
                                <thead className="bg-zinc-100">
                                    <tr>
                                        <th className="px-2 py-1 text-left font-bold uppercase">PR</th>
                                        <th className="px-2 py-1 text-left font-bold uppercase">Requester</th>
                                        <th className="px-2 py-1 text-left font-bold uppercase">Status</th>
                                        <th className="px-2 py-1 text-right font-bold uppercase">Items</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentPRs.slice(0, 5).map((pr) => (
                                        <tr key={pr.id} className="border-t border-zinc-100">
                                            <td className="px-2 py-1.5 font-mono">{pr.number}</td>
                                            <td className="px-2 py-1.5">{pr.requesterName}</td>
                                            <td className="px-2 py-1.5">
                                                <span className={`inline-flex rounded border px-1.5 py-0.5 text-[9px] font-bold ${statusBadgeClass(pr.status)}`}>{pr.status}</span>
                                            </td>
                                            <td className="px-2 py-1.5 text-right font-bold">{pr.itemCount}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="mb-4">
                        <p className="text-[10px] font-bold text-zinc-400 mb-2 uppercase tracking-wider">Pending Your Approval</p>
                        {pendingApproval?.length > 0 ? (
                            <div className="space-y-2">
                                {pendingApproval.slice(0, 3).map((po) => (
                                    <div
                                        key={po.id}
                                        className="bg-amber-50 border-2 border-amber-200 rounded-lg p-2.5 transition-colors"
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="font-mono text-[10px] font-bold text-amber-900">{po.number}</span>
                                            <span className="text-[10px] font-black text-amber-700">{formatIDR(po.netAmount)}</span>
                                        </div>
                                        <div className="text-[10px] font-medium text-amber-700">{po.supplier.name}</div>
                                        <div className="text-[9px] text-amber-600">{po.itemCount} items</div>
                                        {/* Inline Action Buttons */}
                                        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-amber-200">
                                            <button
                                                onClick={() => handleApprove(po)}
                                                disabled={processing}
                                                className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-emerald-600 text-white text-[9px] font-black uppercase tracking-wider
                                                           rounded hover:bg-emerald-700 active:scale-[0.97] transition-all disabled:opacity-50"
                                            >
                                                {processing ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                                                Approve
                                            </button>
                                            <button
                                                onClick={() => { setSelectedPO(po); setRejectMode(true) }}
                                                disabled={processing}
                                                className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-white text-red-600 text-[9px] font-black uppercase tracking-wider
                                                           rounded border border-red-300 hover:bg-red-50 active:scale-[0.97] transition-all disabled:opacity-50"
                                            >
                                                <XCircle className="h-3 w-3" />
                                                Reject
                                            </button>
                                            <button
                                                onClick={() => setSelectedPO(po)}
                                                className="flex items-center justify-center p-1 bg-zinc-100 text-zinc-500 rounded
                                                           hover:bg-zinc-200 transition-colors border border-zinc-200"
                                                title="View Detail"
                                            >
                                                <FileText className="h-3 w-3" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {pendingApproval.length > 3 && (
                                    <p className="text-[10px] text-zinc-500 font-bold">+ {pendingApproval.length - 3} more</p>
                                )}
                            </div>
                        ) : (
                            <p className="text-xs font-medium text-zinc-500">No pending approvals</p>
                        )}
                    </div>

                    <Link href="/dashboard/approvals">
                        <Button size="sm" variant="outline" className="w-full text-xs font-black uppercase tracking-wider h-8 border-2 border-black hover:bg-zinc-50">
                            View All Approvals
                        </Button>
                    </Link>
                </CardContent>
            </Card>

            {/* Approval Dialog */}
            <Dialog open={!!selectedPO} onOpenChange={() => { setSelectedPO(null); setRejectMode(false); setRejectReason("") }}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-blue-600" />
                            Purchase Order Approval
                        </DialogTitle>
                        <DialogDescription>
                            Review and approve or reject this purchase order
                        </DialogDescription>
                    </DialogHeader>

                    {selectedPO && (
                        <div className="space-y-4">
                            {/* PO Details */}
                            <div className="grid grid-cols-2 gap-4 bg-zinc-50 p-4 rounded-lg border border-zinc-200">
                                <div>
                                    <div className="text-[10px] font-bold uppercase text-zinc-500">PO Number</div>
                                    <div className="font-mono font-bold">{selectedPO.number}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] font-bold uppercase text-zinc-500">Vendor</div>
                                    <div className="font-bold">{selectedPO.supplier.name}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] font-bold uppercase text-zinc-500">Total Amount</div>
                                    <div className="font-black text-lg">{formatIDR(selectedPO.netAmount)}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] font-bold uppercase text-zinc-500">Items</div>
                                    <div className="font-bold">{selectedPO.itemCount} items</div>
                                </div>
                            </div>

                            {/* Items List */}
                            <div>
                                <div className="text-sm font-black uppercase mb-2">Items</div>
                                <div className="border border-zinc-200 rounded-lg overflow-hidden">
                                    <div className="max-h-40 overflow-y-auto">
                                        {selectedPO.items.map((item, idx) => (
                                            <div key={idx} className="px-3 py-2 border-b border-zinc-100 last:border-0 flex justify-between">
                                                <div>
                                                    <div className="font-medium text-sm">{item.productName}</div>
                                                    <div className="text-[10px] text-zinc-400 font-mono">{item.productCode}</div>
                                                </div>
                                                <div className="text-sm font-bold">{item.quantity} pcs</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            {/* Reject Form */}
                            {rejectMode && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-2">
                                    <label className="text-sm font-bold text-red-900">Rejection Reason</label>
                                    <Textarea
                                        placeholder="Please provide a clear reason for rejection..."
                                        value={rejectReason}
                                        onChange={(e) => setRejectReason(e.target.value)}
                                        className="min-h-[100px]"
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    <DialogFooter className="gap-2">
                        {!rejectMode ? (
                            <>
                                <Button
                                    variant="outline"
                                    onClick={() => setRejectMode(true)}
                                    disabled={processing}
                                    className="border-red-300 text-red-700 hover:bg-red-50"
                                >
                                    <XCircle className="h-4 w-4 mr-2" />
                                    Reject
                                </Button>
                                <Button
                                    onClick={() => selectedPO && handleApprove(selectedPO)}
                                    disabled={processing}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                >
                                    {processing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                                    Approve & Sign
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button variant="ghost" onClick={() => { setRejectMode(false); setRejectReason("") }} disabled={processing}>
                                    Cancel
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={handleReject}
                                    disabled={processing || !rejectReason.trim()}
                                >
                                    {processing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
                                    Confirm Rejection
                                </Button>
                            </>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
