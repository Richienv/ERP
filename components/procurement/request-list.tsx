"use client"

import { useState } from "react"
import { Search, CheckCircle2, XCircle, MessageSquare, AlertTriangle, Package, Loader2, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { createPOFromRequest, rejectPurchaseRequest, previewPOFromRequest } from "@/lib/actions/procurement"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { formatIDR } from "@/lib/utils"

interface PurchaseRequest {
    id: string
    title: string
    relatedId: string | null
    requester: string
    status: string
    priority: string
    notes: string | null
    date: Date
}

interface POPreviewData {
    productName: string
    quantity: number
    unit: string
    unitCost: number
    totalCost: number
    supplierName: string
    leadTime: number
    estimatedArrival: string
}

export function RequestList({ data }: { data: PurchaseRequest[] }) {
    const [search, setSearch] = useState("")
    const [processing, setProcessing] = useState<string | null>(null)
    const [rejectOpen, setRejectOpen] = useState(false)
    const [createOpen, setCreateOpen] = useState(false)
    const [selectedReq, setSelectedReq] = useState<PurchaseRequest | null>(null)
    const [rejectReason, setRejectReason] = useState("")
    const [previewData, setPreviewData] = useState<POPreviewData | null>(null)

    const router = useRouter()

    const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected'>('pending')

    // Calculate counts for badges
    const pendingCount = data.filter(r => r.status === 'PENDING').length
    const approvedCount = data.filter(r => r.status === 'COMPLETED').length
    const rejectedCount = data.filter(r => r.status === 'REJECTED').length

    const filtered = data.filter(r => {
        const matchesSearch = r.title.toLowerCase().includes(search.toLowerCase()) || r.requester.toLowerCase().includes(search.toLowerCase())
        if (!matchesSearch) return false

        if (filter === 'pending') return r.status === 'PENDING'
        if (filter === 'approved') return r.status === 'COMPLETED'
        if (filter === 'rejected') return r.status === 'REJECTED'
        return true
    })

    // --- REJECT FLOW ---
    const handleRejectClick = (req: PurchaseRequest) => {
        setSelectedReq(req)
        setRejectReason("")
        setRejectOpen(true)
    }

    const confirmReject = async () => {
        if (!selectedReq) return
        if (!rejectReason.trim()) {
            toast.error("Please provide a reason for rejection")
            return
        }

        setProcessing(selectedReq.id)
        try {
            const result = await rejectPurchaseRequest(selectedReq.id, rejectReason)
            if (result.success) {
                toast.success("Request Rejected")
                setRejectOpen(false)
                router.refresh()
            } else {
                toast.error("Failed to reject request")
            }
        } catch (e) {
            toast.error("Error rejecting request")
        } finally {
            setProcessing(null)
        }
    }

    // --- APPROVE FLOW (PREVIEW) ---
    const handleApproveClick = async (req: PurchaseRequest) => {
        if (!req.relatedId) {
            toast.error("Cannot create PO: No product linked")
            return
        }

        setSelectedReq(req)
        setProcessing(req.id) // Show loading on button while fetching preview

        try {
            // Default qty 50 if not parsed. Ideally parse from notes via AI or rules later.
            // For now, let's look for number in title? Nah, default 50.
            const quantity = 50

            const result = await previewPOFromRequest(req.id, req.relatedId, quantity)

            if (result.success && result.data) {
                setPreviewData(result.data)
                setCreateOpen(true)
            } else {
                toast.error(result.error || "Failed to load preview")
            }
        } catch (e) {
            toast.error("Error loading preview")
        } finally {
            setProcessing(null)
        }
    }

    const confirmCreatePO = async () => {
        if (!selectedReq || !selectedReq.relatedId || !previewData) return

        setProcessing("creating") // Global processing state for dialog
        try {
            const result = await createPOFromRequest(
                selectedReq.id,
                selectedReq.relatedId,
                previewData.quantity,
                selectedReq.notes || ""
            )

            if (result.success) {
                toast.success("PO Created Successfully")
                setCreateOpen(false)
                router.refresh()
            } else {
                toast.error(result.error)
            }
        } catch (e) {
            toast.error("Failed to create PO")
        } finally {
            setProcessing(null)
        }
    }

    return (
        <div className="space-y-6">
            {/* Toolbar */}
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-2 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-xl">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search requester, item..."
                        className="pl-9 border-black focus-visible:ring-black font-medium"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                {/* Filter Tabs */}
                <div className="flex bg-zinc-100 p-1 rounded-lg border border-zinc-200">
                    <button
                        onClick={() => setFilter('pending')}
                        className={`px-3 py-1.5 text-xs font-bold uppercase rounded-md transition-all flex items-center gap-1.5 ${filter === 'pending' ? 'bg-amber-100 text-amber-900 border border-amber-200 shadow-sm' : 'text-zinc-500 hover:text-amber-600'}`}
                    >
                        Pending
                        <span className="bg-amber-600 text-white text-[9px] px-1 rounded-full h-4 flex items-center justify-center">
                            {pendingCount}
                        </span>
                    </button>
                    <button
                        onClick={() => setFilter('approved')}
                        className={`px-3 py-1.5 text-xs font-bold uppercase rounded-md transition-all flex items-center gap-1.5 ${filter === 'approved' ? 'bg-emerald-100 text-emerald-900 border border-emerald-200 shadow-sm' : 'text-zinc-500 hover:text-emerald-600'}`}
                    >
                        Approved
                        <span className="bg-emerald-600 text-white text-[9px] px-1 rounded-full h-4 flex items-center justify-center">
                            {approvedCount}
                        </span>
                    </button>
                    <button
                        onClick={() => setFilter('rejected')}
                        className={`px-3 py-1.5 text-xs font-bold uppercase rounded-md transition-all flex items-center gap-1.5 ${filter === 'rejected' ? 'bg-red-100 text-red-900 border border-red-200 shadow-sm' : 'text-zinc-500 hover:text-red-600'}`}
                    >
                        Rejected
                        <span className="bg-red-600 text-white text-[9px] px-1 rounded-full h-4 flex items-center justify-center">
                            {rejectedCount}
                        </span>
                    </button>
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filtered.map((req) => (
                    <Card key={req.id} className="group border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[3px] hover:translate-y-[3px] transition-all bg-white rounded-xl overflow-hidden">
                        <CardHeader className="flex-row items-start justify-between pb-2">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-12 w-12 border border-black">
                                    <AvatarFallback className="bg-black text-white font-bold">
                                        {req.requester.substring(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <div>
                                    <h3 className="text-lg font-black uppercase leading-none truncate max-w-[200px]">{req.requester}</h3>
                                    <p className="text-sm font-medium text-muted-foreground">Purchasing Request</p>
                                </div>
                            </div>
                            <Badge variant={req.priority === 'HIGH' ? 'destructive' : 'outline'} className={`uppercase font-bold text-[10px] ${req.priority !== 'HIGH' && 'border-black text-black'}`}>
                                {req.priority} Priority
                            </Badge>
                        </CardHeader>

                        <CardContent className="space-y-4">
                            <div className="bg-zinc-50 p-3 rounded-lg border border-dashed border-zinc-300">
                                <p className="text-xs font-bold uppercase text-muted-foreground mb-1">Requesting</p>
                                <p className="text-lg font-bold leading-tight">{req.title.replace('Purchase Request: ', '')}</p>
                                <div className="text-xs font-mono text-zinc-500 mt-1 flex items-center gap-1">
                                    <Package className="h-3 w-3" />
                                    {new Date(req.date).toLocaleDateString()} • {new Date(req.date).toLocaleTimeString()}
                                </div>
                            </div>

                            {req.notes && (
                                <div className="flex gap-2 text-sm text-black/70 bg-amber-50 p-2 rounded border border-amber-100 items-start">
                                    <MessageSquare className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
                                    <span className="italic line-clamp-2">"{req.notes}"</span>
                                </div>
                            )}
                        </CardContent>

                        <CardFooter className="pt-4 border-t border-black bg-zinc-50 flex gap-2">
                            <Button
                                onClick={() => handleRejectClick(req)}
                                variant="outline"
                                className="flex-1 border-black font-bold uppercase hover:bg-red-50 hover:text-red-600 hover:border-red-600 shadow-sm"
                            >
                                <XCircle className="mr-2 h-4 w-4" /> Reject
                            </Button>
                            <Button
                                onClick={() => handleApproveClick(req)}
                                disabled={processing === req.id}
                                className="flex-1 bg-black text-white hover:bg-zinc-800 border border-black font-bold uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all"
                            >
                                {processing === req.id ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                )}
                                Create PO
                            </Button>
                        </CardFooter>
                    </Card>
                ))}

                {filtered.length === 0 && (
                    <div className="col-span-full text-center p-12 border-2 border-dashed border-zinc-200 rounded-xl">
                        <p className="text-muted-foreground font-bold">No pending requests found.</p>
                    </div>
                )}
            </div>

            {/* REJECT DIALOG */}
            <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="font-black uppercase text-red-600 flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5" /> Reject Request
                        </DialogTitle>
                        <DialogDescription>
                            Please provide a reason for rejecting this request. This will be visible to the requester.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="bg-zinc-50 p-3 rounded-lg border">
                            <p className="text-sm font-medium">Request: <span className="font-bold">{selectedReq?.title}</span></p>
                            <p className="text-xs text-muted-foreground">From: {selectedReq?.requester}</p>
                        </div>
                        <Textarea
                            placeholder="Reason for rejection (e.g., Out of budget, Duplicate request)..."
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            className="border-black focus-visible:ring-black min-h-[100px]"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
                        <Button
                            variant="destructive"
                            onClick={confirmReject}
                            disabled={!!processing || !rejectReason.trim()}
                        >
                            {processing === selectedReq?.id ? "Rejecting..." : "Confirm Rejection"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* CREATE PO PREVIEW DIALOG */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="font-black uppercase flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Create Purchase Order
                        </DialogTitle>
                        <DialogDescription>
                            Review the details before generating the PO.
                        </DialogDescription>
                    </DialogHeader>

                    {previewData && (
                        <div className="space-y-4 py-4">
                            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl space-y-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-xs font-bold text-emerald-800 uppercase">Product</p>
                                        <p className="font-bold text-lg">{previewData.productName}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-bold text-emerald-800 uppercase">Quantity</p>
                                        <p className="font-bold text-lg">{previewData.quantity} <span className="text-sm text-emerald-700">{previewData.unit}</span></p>
                                    </div>
                                </div>
                                <div className="h-px bg-emerald-200/50" />
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-emerald-800">Unit Cost</span>
                                    <span className="font-mono font-bold">{formatIDR(previewData.unitCost)}</span>
                                </div>
                                <div className="flex justify-between items-center text-lg font-bold text-emerald-900">
                                    <span>Total Est.</span>
                                    <span>{formatIDR(previewData.totalCost)}</span>
                                </div>
                            </div>

                            <div className="space-y-3 text-sm px-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Supplier</span>
                                    <span className="font-bold">{previewData.supplierName}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Est. Lead Time</span>
                                    <span className="font-bold">{previewData.leadTime} Days</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Est. Arrival</span>
                                    <span className="font-bold">{previewData.estimatedArrival}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                        <Button
                            className="bg-black text-white hover:bg-zinc-800"
                            onClick={confirmCreatePO}
                            disabled={processing === "creating"}
                        >
                            {processing === "creating" ? "Creating..." : "Confirm & Create PO"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
