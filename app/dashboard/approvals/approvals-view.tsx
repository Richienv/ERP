"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, XCircle, FileText, Loader2, ArrowLeft, Eye } from "lucide-react"
import Link from "next/link"
import { formatIDR } from "@/lib/utils"
import { approvePurchaseOrder, rejectPurchaseOrder } from "@/lib/actions/procurement"
import { toast } from "sonner"

interface PendingPO {
    id: string
    number: string
    orderDate: Date
    supplier: {
        name: string
        email: string
        phone: string
        address: string
    }
    totalAmount: number
    taxAmount: number
    netAmount: number
    items: Array<{
        id: string
        productName: string
        productCode: string
        quantity: number
        unitPrice: number
        totalPrice: number
    }>
    requester: string
    approver: string
}

interface ApprovalsViewProps {
    pendingPOs: PendingPO[]
}

export function ApprovalsView({ pendingPOs }: ApprovalsViewProps) {
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
                toast.success(`PO ${po.number} approved & signed`)
                setSelectedPO(null)
                router.refresh()
            } else {
                toast.error(result.error || "Failed to approve")
            }
        } catch (error) {
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
        } catch (error) {
            toast.error("Error rejecting PO")
        } finally {
            setProcessing(false)
        }
    }

    return (
        <div className="p-8 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-black">Purchase Order Approvals</h1>
                        <p className="text-muted-foreground mt-1">Review and approve pending purchase orders</p>
                    </div>
                </div>
                <Badge variant="outline" className="text-lg font-black px-4 py-2">
                    {pendingPOs.length} Pending
                </Badge>
            </div>

            {/* PO List */}
            {pendingPOs.length === 0 ? (
                <Card className="border-2 border-dashed border-zinc-300">
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <CheckCircle className="h-16 w-16 text-emerald-500 mb-4" />
                        <h3 className="text-xl font-bold mb-2">All Clear!</h3>
                        <p className="text-muted-foreground">No purchase orders awaiting your approval.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {pendingPOs.map((po) => (
                        <Card key={po.id} className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all">
                            <CardHeader className="border-b-2 border-black bg-amber-50">
                                <CardTitle className="flex items-center justify-between">
                                    <div>
                                        <div className="text-xs font-black uppercase text-zinc-500 mb-1">Purchase Order</div>
                                        <div className="text-xl font-black font-mono">{po.number}</div>
                                    </div>
                                    <Badge className="bg-amber-500 hover:bg-amber-600 font-black uppercase text-xs">
                                        Pending
                                    </Badge>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-4">
                                {/* Supplier Info */}
                                <div>
                                    <div className="text-[10px] font-bold uppercase text-zinc-500 mb-1">Vendor</div>
                                    <div className="font-bold">{po.supplier.name}</div>
                                    {po.supplier.email && (
                                        <div className="text-xs text-zinc-500">{po.supplier.email}</div>
                                    )}
                                </div>

                                {/* Amount */}
                                <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-200">
                                    <div className="flex justify-between items-end">
                                        <div>
                                            <div className="text-[10px] font-bold uppercase text-zinc-500 mb-1">Total Amount</div>
                                            <div className="text-2xl font-black">{formatIDR(po.netAmount)}</div>
                                        </div>
                                        <div className="text-xs text-zinc-500">
                                            {po.items.length} items
                                        </div>
                                    </div>
                                </div>

                                {/* Workflow Info */}
                                <div className="grid grid-cols-2 gap-3 text-xs">
                                    <div>
                                        <div className="text-[10px] font-bold uppercase text-zinc-500 mb-1">Requested By</div>
                                        <div className="font-bold">{po.requester}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-bold uppercase text-zinc-500 mb-1">Date</div>
                                        <div className="font-bold">{new Date(po.orderDate).toLocaleDateString()}</div>
                                    </div>
                                </div>

                                <Separator />

                                {/* Actions */}
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        className="flex-1 border-2 border-black"
                                        onClick={() => {
                                            setSelectedPO(po)
                                            setRejectMode(false)
                                        }}
                                    >
                                        <Eye className="h-4 w-4 mr-2" />
                                        Review
                                    </Button>
                                    <Button
                                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                                        onClick={() => handleApprove(po)}
                                        disabled={processing}
                                    >
                                        {processing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                                        Approve & Sign
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Review Dialog */}
            <Dialog open={!!selectedPO} onOpenChange={() => { setSelectedPO(null); setRejectMode(false); setRejectReason("") }}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-blue-600" />
                            Purchase Order Review
                        </DialogTitle>
                        <DialogDescription>
                            Review details before approving or rejecting
                        </DialogDescription>
                    </DialogHeader>

                    {selectedPO && (
                        <div className="space-y-4">
                            {/* PO Header */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-zinc-50 p-4 rounded-lg border border-zinc-200">
                                <div>
                                    <div className="text-[10px] font-bold uppercase text-zinc-500">PO Number</div>
                                    <div className="font-mono font-bold">{selectedPO.number}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] font-bold uppercase text-zinc-500">Date</div>
                                    <div className="font-medium">{new Date(selectedPO.orderDate).toLocaleDateString()}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] font-bold uppercase text-zinc-500">Requester</div>
                                    <div className="font-medium">{selectedPO.requester}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] font-bold uppercase text-zinc-500">Total</div>
                                    <div className="font-black">{formatIDR(selectedPO.netAmount)}</div>
                                </div>
                            </div>

                            {/* Vendor */}
                            <div>
                                <div className="text-sm font-black uppercase mb-2">Vendor</div>
                                <div className="border border-zinc-200 rounded-lg p-3">
                                    <div className="font-bold">{selectedPO.supplier.name}</div>
                                    <div className="text-sm text-zinc-600 mt-1">{selectedPO.supplier.address}</div>
                                    <div className="flex gap-4 mt-2 text-xs text-zinc-500">
                                        {selectedPO.supplier.email && <span>{selectedPO.supplier.email}</span>}
                                        {selectedPO.supplier.phone && <span>{selectedPO.supplier.phone}</span>}
                                    </div>
                                </div>
                            </div>

                            {/* Items */}
                            <div>
                                <div className="text-sm font-black uppercase mb-2">Items</div>
                                <div className="border border-zinc-200 rounded-lg overflow-hidden">
                                    <div className="max-h-60 overflow-y-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-zinc-100 sticky top-0">
                                                <tr>
                                                    <th className="px-3 py-2 text-left text-xs font-bold">Product</th>
                                                    <th className="px-3 py-2 text-right text-xs font-bold">Qty</th>
                                                    <th className="px-3 py-2 text-right text-xs font-bold">Unit Price</th>
                                                    <th className="px-3 py-2 text-right text-xs font-bold">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedPO.items.map((item) => (
                                                    <tr key={item.id} className="border-b border-zinc-100 last:border-0">
                                                        <td className="px-3 py-2">
                                                            <div className="font-medium">{item.productName}</div>
                                                            <div className="text-[10px] text-zinc-400 font-mono">{item.productCode}</div>
                                                        </td>
                                                        <td className="px-3 py-2 text-right font-mono">{item.quantity}</td>
                                                        <td className="px-3 py-2 text-right font-mono">{formatIDR(item.unitPrice)}</td>
                                                        <td className="px-3 py-2 text-right font-bold">{formatIDR(item.totalPrice)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            {/* Totals */}
                            <div className="flex justify-end">
                                <div className="w-64 space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span>Subtotal</span>
                                        <span>{formatIDR(selectedPO.totalAmount)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span>Tax (11%)</span>
                                        <span>{formatIDR(selectedPO.taxAmount)}</span>
                                    </div>
                                    <Separator />
                                    <div className="flex justify-between text-lg font-black">
                                        <span>Total</span>
                                        <span>{formatIDR(selectedPO.netAmount)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* PDF Preview Link */}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                <a
                                    href={`/api/documents/purchase-order/${selectedPO.id}?disposition=inline`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-2 text-blue-700 hover:text-blue-900 font-bold text-sm"
                                >
                                    <FileText className="h-4 w-4" />
                                    View PDF Document
                                </a>
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
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-black"
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
                                    className="font-black"
                                >
                                    {processing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
                                    Confirm Rejection
                                </Button>
                            </>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
