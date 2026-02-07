"use client"

import { useState } from "react"
import { Search, CheckCircle2, XCircle, MessageSquare, AlertTriangle, Package, Loader2, ArrowRight, FileText, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { approvePurchaseRequest, rejectPurchaseRequest, createPOFromPR } from "@/lib/actions/procurement"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

interface PurchaseRequest {
    id: string
    number: string
    requester: string
    department: string | null
    status: string
    priority: string
    notes: string | null
    date: Date
    itemCount: number
    items: {
        id: string
        productName: string
        quantity: number
        unit: string
        status: string
    }[]
}

export function RequestList({ data }: { data: PurchaseRequest[] }) {
    const [search, setSearch] = useState("")
    const [processing, setProcessing] = useState<string | null>(null)

    // Dialog States
    const [rejectOpen, setRejectOpen] = useState(false)
    const [approveOpen, setApproveOpen] = useState(false)
    const [poOpen, setPOOpen] = useState(false)
    const [selectedReq, setSelectedReq] = useState<PurchaseRequest | null>(null)
    const [rejectReason, setRejectReason] = useState("")

    const router = useRouter()

    const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'completed'>('pending')

    const pendingCount = data.filter(r => r.status === 'PENDING').length
    const approvedCount = data.filter(r => r.status === 'APPROVED').length
    const rejectedCount = data.filter(r => r.status === 'REJECTED').length
    const completedCount = data.filter(r => r.status === 'PO_CREATED').length

    const filtered = data.filter(r => {
        const matchesSearch = r.number.toLowerCase().includes(search.toLowerCase()) ||
            r.requester.toLowerCase().includes(search.toLowerCase()) ||
            r.items.some(i => i.productName.toLowerCase().includes(search.toLowerCase()))
        if (!matchesSearch) return false

        if (filter === 'pending') return r.status === 'PENDING'
        if (filter === 'approved') return r.status === 'APPROVED'
        if (filter === 'rejected') return r.status === 'REJECTED'
        if (filter === 'completed') return r.status === 'PO_CREATED'
        return true
    })

    // --- ACTIONS ---

    const handleAction = (req: PurchaseRequest, action: 'reject' | 'approve' | 'po') => {
        setSelectedReq(req)
        if (action === 'reject') {
            setRejectReason("")
            setRejectOpen(true)
        } else if (action === 'approve') {
            setApproveOpen(true)
        } else {
            setPOOpen(true)
        }
    }

    const confirmReject = async () => {
        if (!selectedReq) return
        if (!rejectReason.trim()) return toast.error("Reason required")

        setProcessing(selectedReq.id)
        try {
            const result = await rejectPurchaseRequest(selectedReq.id, rejectReason)
            if (result.success) {
                toast.success("Request Rejected")
                setRejectOpen(false)
                router.refresh()
            } else {
                toast.error("Failed to reject")
            }
        } catch (e) { toast.error("Error rejecting") }
        finally { setProcessing(null) }
    }

    const confirmApprove = async () => {
        if (!selectedReq) return
        // Mock Approver ID (Richie)
        // In real app, get session user ID
        const approverId = "mock-approver-id"

        setProcessing(selectedReq.id)
        try {
            const result = await approvePurchaseRequest(selectedReq.id, approverId)
            if (result.success) {
                toast.success("Request Approved")
                setApproveOpen(false)
                router.refresh()
            } else {
                toast.error("Failed to approve")
            }
        } catch (e) { toast.error("Error approving") }
        finally { setProcessing(null) }
    }

    const confirmCreatePO = async () => {
        if (!selectedReq) return

        setProcessing(selectedReq.id)
        try {
            // Create PO for ALL items in the PR
            const itemIds = selectedReq.items.map(i => i.id)
            const result = await createPOFromPR(selectedReq.id, itemIds, "Generated from PR")

            if (result.success) {
                const poIds = (result as any).poIds
                toast.success(`Created ${poIds?.length} Purchase Order(s)`)
                setPOOpen(false)
                router.refresh()
            } else {
                toast.error((result as any).error || "Failed to create PO")
            }
        } catch (e) { toast.error("Error creating PO") }
        finally { setProcessing(null) }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-2 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-xl">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search PR, requester, items..."
                        className="pl-9 border-black focus-visible:ring-black font-medium"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="flex bg-zinc-100 p-1 rounded-lg border border-zinc-200">
                    <button
                        onClick={() => setFilter('pending')}
                        className={`px-3 py-1.5 text-xs font-bold uppercase rounded-md transition-all flex items-center gap-1.5 ${filter === 'pending' ? 'bg-amber-100 text-amber-900 border border-amber-200 shadow-sm' : 'text-zinc-500 hover:text-amber-600'}`}
                    >
                        Pending
                        <span className="bg-amber-600 text-white text-[9px] px-1 rounded-full h-4 flex items-center justify-center">{pendingCount}</span>
                    </button>
                    <button
                        onClick={() => setFilter('approved')}
                        className={`px-3 py-1.5 text-xs font-bold uppercase rounded-md transition-all flex items-center gap-1.5 ${filter === 'approved' ? 'bg-emerald-100 text-emerald-900 border border-emerald-200 shadow-sm' : 'text-zinc-500 hover:text-emerald-600'}`}
                    >
                        Approved
                        <span className="bg-emerald-600 text-white text-[9px] px-1 rounded-full h-4 flex items-center justify-center">{approvedCount}</span>
                    </button>
                    <button
                        onClick={() => setFilter('rejected')}
                        className={`px-3 py-1.5 text-xs font-bold uppercase rounded-md transition-all flex items-center gap-1.5 ${filter === 'rejected' ? 'bg-red-100 text-red-900 border border-red-200 shadow-sm' : 'text-zinc-500 hover:text-red-600'}`}
                    >
                        Rejected
                        <span className="bg-red-600 text-white text-[9px] px-1 rounded-full h-4 flex items-center justify-center">{rejectedCount}</span>
                    </button>
                    <button
                        onClick={() => setFilter('completed')}
                        className={`px-3 py-1.5 text-xs font-bold uppercase rounded-md transition-all flex items-center gap-1.5 ${filter === 'completed' ? 'bg-blue-100 text-blue-900 border border-blue-200 shadow-sm' : 'text-zinc-500 hover:text-blue-600'}`}
                    >
                        Completed
                        <span className="bg-blue-600 text-white text-[9px] px-1 rounded-full h-4 flex items-center justify-center">{completedCount}</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filtered.map((req) => (
                    <Card key={req.id} className="group border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[3px] hover:translate-y-[3px] transition-all bg-white rounded-xl overflow-hidden">
                        <CardHeader className="flex-row items-start justify-between pb-2 bg-zinc-50/50 border-b border-black/5">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 bg-black text-white rounded-lg flex items-center justify-center font-black text-xs border border-black/20">
                                    PR
                                </div>
                                <div>
                                    <h3 className="text-lg font-black uppercase leading-none">{req.number}</h3>
                                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mt-1">
                                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(req.date).toLocaleDateString()}</span>
                                        <span>•</span>
                                        <span className="uppercase">{req.department || 'General'}</span>
                                    </div>
                                </div>
                            </div>
                            <Badge variant={req.priority === 'HIGH' ? 'destructive' : 'outline'} className={`uppercase font-bold text-[10px] ${req.priority !== 'HIGH' && 'border-black text-black'}`}>
                                {req.priority} Priority
                            </Badge>
                        </CardHeader>

                        <CardContent className="space-y-4 pt-4">
                            <div className="flex items-center gap-2 text-sm">
                                <Avatar className="h-6 w-6 border border-black/20">
                                    <AvatarFallback className="bg-zinc-100 text-[10px] font-bold">
                                        {req.requester.substring(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <span className="font-bold text-sm">Requested by {req.requester}</span>
                            </div>

                            <div className="bg-white p-3 rounded-lg border border-zinc-200 space-y-2">
                                <p className="text-xs font-bold uppercase text-muted-foreground mb-2 flex justify-between">
                                    <span>Items Requested</span>
                                    <span>{req.itemCount} Items</span>
                                </p>
                                {req.items.slice(0, 3).map(item => (
                                    <div key={item.id} className="flex justify-between text-sm items-center border-b border-dashed border-zinc-100 last:border-0 pb-1 last:pb-0">
                                        <span className="font-medium truncate max-w-[70%]">{item.productName}</span>
                                        <span className="font-mono text-xs bg-zinc-100 px-1.5 py-0.5 rounded">{item.quantity} {item.unit}</span>
                                    </div>
                                ))}
                                {req.itemCount > 3 && (
                                    <p className="text-xs text-center text-muted-foreground italic pt-1">...and {req.itemCount - 3} more</p>
                                )}
                            </div>

                            {req.notes && (
                                <div className="flex gap-2 text-xs text-black/70 bg-amber-50 p-2 rounded border border-amber-100 items-start">
                                    <MessageSquare className="h-3 w-3 mt-0.5 text-amber-600 shrink-0" />
                                    <span className="italic line-clamp-2">"{req.notes}"</span>
                                </div>
                            )}
                        </CardContent>

                        <CardFooter className="pt-4 border-t border-black bg-zinc-50 flex gap-2">
                            {filter === 'pending' && (
                                <>
                                    <Button
                                        onClick={() => handleAction(req, 'reject')}
                                        variant="outline"
                                        disabled={!!processing}
                                        className="flex-1 border-black font-bold uppercase hover:bg-red-50 hover:text-red-600 hover:border-red-600 shadow-sm"
                                    >
                                        <XCircle className="mr-2 h-4 w-4" /> Reject
                                    </Button>
                                    <Button
                                        onClick={() => handleAction(req, 'approve')}
                                        disabled={!!processing}
                                        className="flex-1 bg-black text-white hover:bg-zinc-800 border border-black font-bold uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all"
                                    >
                                        {processing === req.id ? <Loader2 className="animate-spin h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                                        Approve
                                    </Button>
                                </>
                            )}
                            {filter === 'approved' && (
                                <Button
                                    onClick={() => handleAction(req, 'po')}
                                    disabled={!!processing}
                                    className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700 border border-black font-bold uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all"
                                >
                                    {processing === req.id ? <Loader2 className="animate-spin h-4 w-4" /> : <Package className="mr-2 h-4 w-4" />}
                                    Convert to PO
                                </Button>
                            )}
                            {filter === 'rejected' && (
                                <div className="w-full text-center text-xs font-bold text-red-600 uppercase py-2 bg-red-50 rounded border border-red-100">
                                    Rejected
                                </div>
                            )}
                        </CardFooter>
                    </Card>
                ))}

                {filtered.length === 0 && (
                    <div className="col-span-full text-center p-12 border-2 border-dashed border-zinc-200 rounded-xl bg-zinc-50">
                        <p className="text-muted-foreground font-bold">No requests found in this tab.</p>
                    </div>
                )}
            </div>

            {/* REJECT DIALOG */}
            <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="text-red-600 uppercase font-black flex items-center gap-2"><XCircle className="h-5 w-5" /> Reject Request</DialogTitle>
                        <DialogDescription>Reason for rejection?</DialogDescription>
                    </DialogHeader>
                    <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Enter reason..." />
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setRejectOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={confirmReject}>Confirm Reject</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* APPROVE DIALOG */}
            <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="uppercase font-black flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" /> Approve Request</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to approve <b>{selectedReq?.number}</b>? This will allow Procurement to generate POs.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setApproveOpen(false)}>Cancel</Button>
                        <Button className="bg-black text-white" onClick={confirmApprove}>Confirm Approval</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* PO DIALOG */}
            <Dialog open={poOpen} onOpenChange={setPOOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="uppercase font-black flex items-center gap-2"><Package className="h-5 w-5 text-blue-600" /> Generate POs</DialogTitle>
                        <DialogDescription>
                            This will create Purchase Orders for <b>{selectedReq?.itemCount} items</b> in <b>{selectedReq?.number}</b>.
                            <br /><br />
                            <span className="text-xs text-muted-foreground bg-zinc-100 p-1 rounded">Note: Items without preferred suppliers will be skipped or require manual intervention.</span>
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setPOOpen(false)}>Cancel</Button>
                        <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={confirmCreatePO}>Generate POs</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
