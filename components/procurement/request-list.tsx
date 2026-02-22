"use client"

import { useState } from "react"
import { Search, CheckCircle2, XCircle, MessageSquare, Package, Loader2, Calendar, Clock, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { approveAndCreatePOFromPR, rejectPurchaseRequest, createPOFromPR } from "@/lib/actions/procurement"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

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

    const [rejectOpen, setRejectOpen] = useState(false)
    const [approveOpen, setApproveOpen] = useState(false)
    const [poOpen, setPOOpen] = useState(false)
    const [selectedReq, setSelectedReq] = useState<PurchaseRequest | null>(null)
    const [rejectReason, setRejectReason] = useState("")

    const queryClient = useQueryClient()

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
                queryClient.invalidateQueries({ queryKey: queryKeys.purchaseRequests.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.procurementDashboard.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.inventoryDashboard.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.sidebarActions.all })
            } else {
                toast.error("Failed to reject")
            }
        } catch { toast.error("Error rejecting") }
        finally { setProcessing(null) }
    }

    const confirmApprove = async () => {
        if (!selectedReq) return
        const approverId = "mock-approver-id"

        setProcessing(selectedReq.id)
        try {
            const result = await approveAndCreatePOFromPR(selectedReq.id, approverId)
            if (result.success) {
                if ((result as any).poCreated) {
                    const total = ((result as any).poIds || []).length
                    toast.success(`Request approved and ${total} PO generated`)
                } else {
                    toast.success((result as any).message || "Request approved")
                }
                setApproveOpen(false)
                queryClient.invalidateQueries({ queryKey: queryKeys.purchaseRequests.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.procurementDashboard.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.inventoryDashboard.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.sidebarActions.all })
            } else {
                toast.error((result as any).error || "Failed to approve")
            }
        } catch { toast.error("Error approving") }
        finally { setProcessing(null) }
    }

    const confirmCreatePO = async () => {
        if (!selectedReq) return

        setProcessing(selectedReq.id)
        try {
            const itemIds = selectedReq.items.map(i => i.id)
            const result = await createPOFromPR(selectedReq.id, itemIds, "Generated from PR")

            if (result.success) {
                const poIds = (result as any).poIds
                toast.success(`Created ${poIds?.length} Purchase Order(s)`)
                setPOOpen(false)
                queryClient.invalidateQueries({ queryKey: queryKeys.purchaseRequests.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.procurementDashboard.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.inventoryDashboard.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.sidebarActions.all })
            } else {
                toast.error((result as any).error || "Failed to create PO")
            }
        } catch { toast.error("Error creating PO") }
        finally { setProcessing(null) }
    }

    return (
        <div className="space-y-4">

            {/* ═══ KPI PULSE STRIP ═══ */}
            <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <div className="grid grid-cols-2 md:grid-cols-4">
                    <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800 border-b-2 md:border-b-0">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-amber-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <Clock className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Pending</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-amber-600">{pendingCount}</div>
                        <div className="text-[10px] font-bold text-amber-600 mt-1">Menunggu persetujuan</div>
                    </div>
                    <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800 border-b-2 md:border-b-0">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <CheckCircle2 className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Approved</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-emerald-600">{approvedCount}</div>
                        <div className="text-[10px] font-bold text-emerald-600 mt-1">Disetujui</div>
                    </div>
                    <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-red-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <XCircle className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Rejected</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-red-600">{rejectedCount}</div>
                        <div className="text-[10px] font-bold text-red-600 mt-1">Ditolak</div>
                    </div>
                    <div className="relative p-4 md:p-5">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-blue-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <Package className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Completed</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-blue-600">{completedCount}</div>
                        <div className="text-[10px] font-bold text-blue-600 mt-1">PO dibuat</div>
                    </div>
                </div>
            </div>

            {/* ═══ SEARCH & FILTER BAR ═══ */}
            <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <div className="px-4 py-3 flex items-center gap-3">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                        <Input
                            placeholder="Cari PR, requester, items..."
                            className="pl-9 border-2 border-black font-bold h-10 placeholder:text-zinc-400 rounded-none"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="flex border-2 border-black">
                        {([
                            { key: 'pending' as const, label: 'Pending', count: pendingCount },
                            { key: 'approved' as const, label: 'Approved', count: approvedCount },
                            { key: 'rejected' as const, label: 'Rejected', count: rejectedCount },
                            { key: 'completed' as const, label: 'Completed', count: completedCount },
                        ]).map((s) => (
                            <button
                                key={s.key}
                                onClick={() => setFilter(s.key)}
                                className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all border-r border-black last:border-r-0 flex items-center gap-1.5 ${
                                    filter === s.key
                                        ? "bg-black text-white"
                                        : "bg-white text-zinc-400 hover:bg-zinc-50"
                                }`}
                            >
                                {s.label}
                                <span className={`text-[9px] px-1 ${filter === s.key ? "bg-white/20" : "bg-zinc-200"} rounded-full`}>{s.count}</span>
                            </button>
                        ))}
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hidden md:block">
                        {filtered.length} permintaan
                    </div>
                </div>
            </div>

            {/* ═══ REQUEST CARDS GRID ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filtered.map((req) => (
                    <div key={req.id} className="group bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all overflow-hidden flex flex-col">
                        {/* Card Header */}
                        <div className="px-4 py-3 flex items-start justify-between bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-100 dark:border-zinc-700">
                            <div className="flex items-center gap-3">
                                <div className="h-9 w-9 bg-black text-white flex items-center justify-center font-black text-[10px] border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                    PR
                                </div>
                                <div>
                                    <h3 className="text-sm font-black uppercase leading-none">{req.number}</h3>
                                    <div className="flex items-center gap-2 text-[10px] font-medium text-zinc-400 mt-1">
                                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(req.date).toLocaleDateString()}</span>
                                        <span>&bull;</span>
                                        <span className="uppercase">{req.department || 'General'}</span>
                                    </div>
                                </div>
                            </div>
                            <Badge variant={req.priority === 'HIGH' ? 'destructive' : 'outline'} className={`uppercase font-black text-[9px] tracking-widest ${req.priority !== 'HIGH' && 'border-black text-black dark:text-white'}`}>
                                {req.priority}
                            </Badge>
                        </div>

                        {/* Card Body */}
                        <div className="px-4 py-3 space-y-3 flex-1">
                            <div className="flex items-center gap-2 text-xs">
                                <Avatar className="h-5 w-5 border border-black">
                                    <AvatarFallback className="bg-zinc-100 dark:bg-zinc-800 text-[9px] font-bold">
                                        {req.requester.substring(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <span className="font-bold text-xs">Requested by {req.requester}</span>
                            </div>

                            <div className="bg-zinc-50 dark:bg-zinc-800 p-3 border border-zinc-200 dark:border-zinc-700 space-y-1.5">
                                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 flex justify-between">
                                    <span>Items Requested</span>
                                    <span>{req.itemCount} Items</span>
                                </p>
                                {req.items.slice(0, 3).map(item => (
                                    <div key={item.id} className="flex justify-between text-xs items-center border-b border-dashed border-zinc-200 dark:border-zinc-700 last:border-0 pb-1 last:pb-0">
                                        <span className="font-medium truncate max-w-[70%]">{item.productName}</span>
                                        <span className="font-mono text-[10px] bg-zinc-100 dark:bg-zinc-700 px-1.5 py-0.5">{item.quantity} {item.unit}</span>
                                    </div>
                                ))}
                                {req.itemCount > 3 && (
                                    <p className="text-[10px] text-center text-zinc-400 pt-1">...dan {req.itemCount - 3} lainnya</p>
                                )}
                            </div>

                            {req.notes && (
                                <div className="flex gap-2 text-[10px] text-zinc-600 dark:text-zinc-400 bg-amber-50 dark:bg-amber-900/20 p-2 border border-amber-200 dark:border-amber-800 items-start">
                                    <MessageSquare className="h-3 w-3 mt-0.5 text-amber-600 shrink-0" />
                                    <span className="italic line-clamp-2">"{req.notes}"</span>
                                </div>
                            )}
                        </div>

                        {/* Card Footer */}
                        <div className="px-4 py-3 border-t-2 border-black bg-zinc-50 dark:bg-zinc-800 flex gap-2">
                            {filter === 'pending' && (
                                <>
                                    <Button
                                        onClick={() => handleAction(req, 'reject')}
                                        variant="outline"
                                        disabled={!!processing}
                                        className="flex-1 border-2 border-black font-black uppercase text-[10px] tracking-widest hover:bg-red-50 hover:text-red-600 hover:border-red-600 h-9"
                                    >
                                        <XCircle className="mr-1.5 h-3.5 w-3.5" /> Reject
                                    </Button>
                                    <Button
                                        onClick={() => handleAction(req, 'approve')}
                                        disabled={!!processing}
                                        className="flex-1 bg-black text-white hover:bg-zinc-800 border-2 border-black font-black uppercase text-[10px] tracking-widest shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all h-9"
                                    >
                                        {processing === req.id ? <Loader2 className="animate-spin h-3.5 w-3.5" /> : <><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Approve + PO</>}
                                    </Button>
                                </>
                            )}
                            {filter === 'approved' && (
                                <Button
                                    onClick={() => handleAction(req, 'po')}
                                    disabled={!!processing}
                                    className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700 border-2 border-black font-black uppercase text-[10px] tracking-widest shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all h-9"
                                >
                                    {processing === req.id ? <Loader2 className="animate-spin h-3.5 w-3.5" /> : <><Package className="mr-1.5 h-3.5 w-3.5" /> Convert to PO</>}
                                </Button>
                            )}
                            {filter === 'rejected' && (
                                <div className="w-full text-center text-[10px] font-black text-red-600 uppercase tracking-widest py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                                    Rejected
                                </div>
                            )}
                            {filter === 'completed' && (
                                <div className="w-full text-center text-[10px] font-black text-blue-600 uppercase tracking-widest py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                                    PO Created
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {filtered.length === 0 && (
                    <div className="col-span-full border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 p-12 text-center">
                        <AlertCircle className="h-8 w-8 mx-auto text-zinc-300 mb-2" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Tidak ada permintaan di tab ini</p>
                    </div>
                )}
            </div>

            {/* REJECT DIALOG */}
            <Dialog open={rejectOpen} onOpenChange={(open) => { if (!processing) setRejectOpen(open) }}>
                <DialogContent className="border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                    <DialogHeader>
                        <DialogTitle className="text-red-600 uppercase font-black flex items-center gap-2 text-sm tracking-widest"><XCircle className="h-5 w-5" /> Tolak Permintaan</DialogTitle>
                        <DialogDescription>Berikan alasan penolakan untuk <b>{selectedReq?.number}</b>.</DialogDescription>
                    </DialogHeader>
                    <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Tulis alasan penolakan..." className="border-2 border-black" />
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setRejectOpen(false)} disabled={!!processing}>Batal</Button>
                        <Button
                            variant="destructive"
                            onClick={confirmReject}
                            disabled={!!processing || !rejectReason.trim()}
                            className="border-2 border-black font-black uppercase text-xs tracking-widest"
                        >
                            {processing ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Memproses...</> : "Konfirmasi Tolak"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* APPROVE DIALOG */}
            <Dialog open={approveOpen} onOpenChange={(open) => { if (!processing) setApproveOpen(open) }}>
                <DialogContent className="border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                    {processing && selectedReq ? (
                        <div className="py-12 flex flex-col items-center gap-4">
                            <div className="relative">
                                <div className="h-16 w-16 border-4 border-black flex items-center justify-center bg-emerald-50">
                                    <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                                </div>
                            </div>
                            <div className="text-center space-y-1">
                                <p className="font-black uppercase text-sm tracking-widest">Memproses Persetujuan</p>
                                <p className="text-xs text-zinc-500 font-medium">{selectedReq.number} — Approve & buat PO...</p>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-bold">
                                <div className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                Menyetujui permintaan dan membuat Purchase Order
                            </div>
                        </div>
                    ) : (
                        <>
                            <DialogHeader>
                                <DialogTitle className="uppercase font-black flex items-center gap-2 text-sm tracking-widest"><CheckCircle2 className="h-5 w-5 text-emerald-600" /> Setujui & Buat PO</DialogTitle>
                                <DialogDescription>
                                    Setujui <b>{selectedReq?.number}</b> dan otomatis buat PO dari item yang disetujui.
                                </DialogDescription>
                            </DialogHeader>

                            {/* PR Summary */}
                            {selectedReq && (
                                <div className="space-y-3 py-2">
                                    <div className="bg-zinc-50 border-2 border-zinc-200 p-3">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <p className="font-black text-sm">{selectedReq.number}</p>
                                                <p className="text-[10px] text-zinc-500 font-medium mt-0.5">
                                                    {selectedReq.requester} &bull; {selectedReq.department || 'General'} &bull; {selectedReq.itemCount} item
                                                </p>
                                            </div>
                                            {selectedReq.priority === 'HIGH' && (
                                                <Badge variant="destructive" className="text-[9px] font-black uppercase">HIGH</Badge>
                                            )}
                                        </div>
                                    </div>
                                    <div className="max-h-32 overflow-y-auto border border-zinc-200">
                                        {selectedReq.items.map((item, idx) => (
                                            <div key={item.id} className={`px-3 py-2 flex justify-between text-xs ${idx % 2 === 0 ? 'bg-white' : 'bg-zinc-50/50'}`}>
                                                <span className="font-medium truncate">{item.productName}</span>
                                                <span className="font-mono text-[10px] bg-zinc-100 px-1.5 py-0.5 shrink-0 ml-2">{item.quantity} {item.unit}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <DialogFooter>
                                <Button variant="ghost" onClick={() => setApproveOpen(false)} className="font-bold">Batal</Button>
                                <Button
                                    className="bg-black text-white border-2 border-black font-black uppercase text-xs tracking-widest shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                                    onClick={confirmApprove}
                                >
                                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Setujui & Proses
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* PO DIALOG */}
            <Dialog open={poOpen} onOpenChange={(open) => { if (!processing) setPOOpen(open) }}>
                <DialogContent className="border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                    {processing && selectedReq ? (
                        <div className="py-12 flex flex-col items-center gap-4">
                            <div className="h-16 w-16 border-4 border-black flex items-center justify-center bg-blue-50">
                                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                            </div>
                            <div className="text-center space-y-1">
                                <p className="font-black uppercase text-sm tracking-widest">Membuat Purchase Order</p>
                                <p className="text-xs text-zinc-500 font-medium">{selectedReq.number} — {selectedReq.itemCount} item</p>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-bold">
                                <div className="h-1.5 w-1.5 bg-blue-500 rounded-full animate-pulse" />
                                Mengelompokkan item dan membuat PO per vendor
                            </div>
                        </div>
                    ) : (
                        <>
                            <DialogHeader>
                                <DialogTitle className="uppercase font-black flex items-center gap-2 text-sm tracking-widest"><Package className="h-5 w-5 text-blue-600" /> Buat Purchase Order</DialogTitle>
                                <DialogDescription>
                                    Buat PO untuk <b>{selectedReq?.itemCount} item</b> di <b>{selectedReq?.number}</b>.
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                                <Button variant="ghost" onClick={() => setPOOpen(false)}>Batal</Button>
                                <Button
                                    className="bg-blue-600 text-white hover:bg-blue-700 border-2 border-black font-black uppercase text-xs tracking-widest shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                                    onClick={confirmCreatePO}
                                >
                                    <Package className="h-3.5 w-3.5 mr-1.5" /> Buat PO
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
