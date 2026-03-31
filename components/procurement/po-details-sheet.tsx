"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, FileSearch, Truck, CheckCircle, XCircle, Send, ShieldCheck, Package } from "lucide-react"
import {
    NBDialog,
    NBDialogHeader,
    NBDialogBody,
    NBSection,
    NBTextarea,
    NBInput,
} from "@/components/ui/nb-dialog"
import { formatIDR } from "@/lib/utils"
import { RevisionHistoryTimeline, type RevisionEntry } from "@/components/shared/revision-history-timeline"
import { rejectPurchaseOrder, submitPOForApproval, approvePurchaseOrder, markAsOrdered, markAsVendorConfirmed, markAsShipped } from "@/lib/actions/procurement"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

interface PODetailsSheetProps {
    order: any
    isOpen: boolean
    onClose: () => void
    userRole: string
}

export function PODetailsSheet({ order, isOpen, onClose, userRole }: PODetailsSheetProps) {
    const [rejectMode, setRejectMode] = useState(false)
    const [rejectReason, setRejectReason] = useState("")
    const [vendorConfirmMode, setVendorConfirmMode] = useState(false)
    const [vendorConfirmNotes, setVendorConfirmNotes] = useState("")
    const [shipMode, setShipMode] = useState(false)
    const [trackingNumber, setTrackingNumber] = useState("")
    const [processing, setProcessing] = useState(false)
    const queryClient = useQueryClient()

    if (!order) return null

    const isDirector = userRole === 'ROLE_CEO' || userRole === 'ROLE_DIRECTOR'
    const isPurchasing = userRole === 'ROLE_PURCHASING' || userRole === 'ROLE_ADMIN' || isDirector

    // Permissions
    const canSubmit = isPurchasing && order.status === 'PO_DRAFT'
    const canApprove = isDirector && order.status === 'PENDING_APPROVAL'
    const canReject = isDirector && ['PENDING_APPROVAL', 'APPROVED'].includes(order.status)
    const canOrder = isPurchasing && order.status === 'APPROVED'
    const canVendorConfirm = isPurchasing && order.status === 'ORDERED'
    const canShip = isPurchasing && order.status === 'VENDOR_CONFIRMED'

    const handleAction = async (action: 'submit' | 'approve' | 'order' | 'vendor_confirm' | 'ship' | 'reject') => {
        // Optimistic: update PO status in list cache before mutation
        const prevOrders = queryClient.getQueryData(queryKeys.purchaseOrders.list())
        if (prevOrders) {
            queryClient.setQueryData(queryKeys.purchaseOrders.list(), (old: any) => {
                if (!old?.orders) return old
                return {
                    ...old,
                    orders: old.orders.map((o: any) =>
                        o.dbId === order.dbId ? { ...o, status: action.toUpperCase() } : o
                    ),
                }
            })
        }

        setProcessing(true)
        try {
            let res
            if (action === 'submit') res = await submitPOForApproval(order.dbId)
            else if (action === 'approve') res = await approvePurchaseOrder(order.dbId)
            else if (action === 'order') res = await markAsOrdered(order.dbId)
            else if (action === 'vendor_confirm') res = await markAsVendorConfirmed(order.dbId, vendorConfirmNotes)
            else if (action === 'ship') res = await markAsShipped(order.dbId, trackingNumber)
            else if (action === 'reject') res = await rejectPurchaseOrder(order.dbId, rejectReason)

            if (res?.success) {
                toast.success(`Order ${action}ed successfully`)
                onClose()
                queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.procurementDashboard.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.purchaseRequests.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.approvals.all })
                // Invalidate finance caches — PO approval/status changes affect vendor bills
                queryClient.invalidateQueries({ queryKey: queryKeys.bills.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.financeDashboard.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.vendorPayments.all })
            } else {
                if (prevOrders) queryClient.setQueryData(queryKeys.purchaseOrders.list(), prevOrders)
                toast.error("Action failed")
            }
        } catch {
            if (prevOrders) queryClient.setQueryData(queryKeys.purchaseOrders.list(), prevOrders)
            toast.error("Error performing action")
        } finally {
            setProcessing(false)
            setRejectMode(false)
            setVendorConfirmMode(false)
            setShipMode(false)
        }
    }

    const revisions = (Array.isArray(order.revisionHistory) ? order.revisionHistory : []) as RevisionEntry[]

    return (
        <NBDialog open={isOpen} onOpenChange={onClose} size="wide">
            <NBDialogHeader
                icon={FileSearch}
                title={`Detail PO: ${order.id}`}
                subtitle={`Vendor: ${order.vendor}`}
            />

            <NBDialogBody>
                {/* Status + Summary */}
                <NBSection icon={Package} title="Ringkasan">
                    <div className="flex justify-between items-center">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Status</span>
                        <Badge variant="outline" className="text-sm font-bold rounded-none border-black">
                            {order.status}
                        </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-1">
                        <div>
                            <div className="text-[10px] uppercase font-bold text-zinc-500">Total Amount</div>
                            <div className="text-xl font-black">{formatIDR(order.total)}</div>
                        </div>
                        <div>
                            <div className="text-[10px] uppercase font-bold text-zinc-500">Items</div>
                            <div className="text-xl font-mono">{order.items} Items</div>
                        </div>
                    </div>
                </NBSection>

                {/* Revision History */}
                {revisions.length > 0 && (
                    <NBSection icon={FileSearch} title="Riwayat Revisi">
                        <RevisionHistoryTimeline revisions={revisions} />
                    </NBSection>
                )}

                {/* Reject UI */}
                {rejectMode && (
                    <NBSection icon={XCircle} title="Alasan Penolakan">
                        <NBTextarea
                            label="Alasan"
                            required
                            value={rejectReason}
                            onChange={setRejectReason}
                            placeholder="Mengapa pesanan ini ditolak?"
                            rows={3}
                        />
                        <div className="flex gap-2 justify-end pt-1">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setRejectMode(false)}
                                className="rounded-none text-[10px] font-bold uppercase tracking-wider"
                            >
                                Batal
                            </Button>
                            <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleAction('reject')}
                                disabled={processing}
                                className="rounded-none text-[10px] font-bold uppercase tracking-wider gap-1.5"
                            >
                                {processing && <Loader2 className="h-3 w-3 animate-spin" />}
                                Konfirmasi Tolak
                            </Button>
                        </div>
                    </NBSection>
                )}

                {vendorConfirmMode && (
                    <NBSection icon={CheckCircle} title="Konfirmasi Vendor">
                        <NBTextarea
                            label="Catatan Konfirmasi"
                            value={vendorConfirmNotes}
                            onChange={setVendorConfirmNotes}
                            placeholder="Catat hasil konfirmasi vendor (email/telepon)"
                            rows={3}
                        />
                        <div className="flex gap-2 justify-end pt-1">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setVendorConfirmMode(false)}
                                className="rounded-none text-[10px] font-bold uppercase tracking-wider"
                            >
                                Batal
                            </Button>
                            <Button
                                size="sm"
                                onClick={() => handleAction('vendor_confirm')}
                                disabled={processing}
                                className="bg-blue-600 text-white hover:bg-blue-700 rounded-none text-[10px] font-bold uppercase tracking-wider gap-1.5"
                            >
                                {processing && <Loader2 className="h-3 w-3 animate-spin" />}
                                Konfirmasi Vendor
                            </Button>
                        </div>
                    </NBSection>
                )}

                {shipMode && (
                    <NBSection icon={Truck} title="Pengiriman">
                        <NBInput
                            label="Nomor Resi (opsional)"
                            value={trackingNumber}
                            onChange={setTrackingNumber}
                            placeholder="mis. JNE/SiCepat tracking number"
                        />
                        <div className="flex gap-2 justify-end pt-1">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setShipMode(false)}
                                className="rounded-none text-[10px] font-bold uppercase tracking-wider"
                            >
                                Batal
                            </Button>
                            <Button
                                size="sm"
                                onClick={() => handleAction('ship')}
                                disabled={processing}
                                className="bg-blue-600 text-white hover:bg-blue-700 rounded-none text-[10px] font-bold uppercase tracking-wider gap-1.5"
                            >
                                {processing && <Loader2 className="h-3 w-3 animate-spin" />}
                                Tandai Dikirim
                            </Button>
                        </div>
                    </NBSection>
                )}
            </NBDialogBody>

            {/* Custom footer with lifecycle action buttons */}
            <div className="border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-2.5 flex flex-col gap-2">
                {!rejectMode && !vendorConfirmMode && !shipMode && (
                    <div className="flex flex-wrap gap-2 justify-end">
                        {canSubmit && (
                            <Button
                                onClick={() => handleAction('submit')}
                                disabled={processing}
                                className="bg-blue-600 text-white hover:bg-blue-700 rounded-none text-[10px] font-black uppercase tracking-wider h-8 px-4 gap-1.5"
                            >
                                {processing && <Loader2 className="h-3 w-3 animate-spin" />}
                                <Send className="h-3.5 w-3.5" /> Submit for Approval
                            </Button>
                        )}
                        {canApprove && (
                            <Button
                                onClick={() => handleAction('approve')}
                                disabled={processing}
                                className="bg-black text-white hover:bg-zinc-800 rounded-none text-[10px] font-black uppercase tracking-wider h-8 px-4 gap-1.5"
                            >
                                {processing && <Loader2 className="h-3 w-3 animate-spin" />}
                                <ShieldCheck className="h-3.5 w-3.5" /> Approve Order
                            </Button>
                        )}
                        {canOrder && (
                            <Button
                                onClick={() => handleAction('order')}
                                disabled={processing}
                                className="bg-emerald-600 text-white hover:bg-emerald-700 rounded-none text-[10px] font-black uppercase tracking-wider h-8 px-4 gap-1.5"
                            >
                                {processing && <Loader2 className="h-3 w-3 animate-spin" />}
                                <Package className="h-3.5 w-3.5" /> Mark as Ordered
                            </Button>
                        )}
                        {canVendorConfirm && (
                            <Button
                                onClick={() => { setVendorConfirmNotes(''); setVendorConfirmMode(true) }}
                                disabled={processing}
                                className="bg-blue-600 text-white hover:bg-blue-700 rounded-none text-[10px] font-black uppercase tracking-wider h-8 px-4 gap-1.5"
                            >
                                <CheckCircle className="h-3.5 w-3.5" /> Vendor Confirmed
                            </Button>
                        )}
                        {canShip && (
                            <Button
                                onClick={() => { setTrackingNumber(''); setShipMode(true) }}
                                disabled={processing}
                                className="bg-blue-600 text-white hover:bg-blue-700 rounded-none text-[10px] font-black uppercase tracking-wider h-8 px-4 gap-1.5"
                            >
                                <Truck className="h-3.5 w-3.5" /> Mark as Shipped
                            </Button>
                        )}
                        {canReject && (
                            <Button
                                variant="destructive"
                                onClick={() => setRejectMode(true)}
                                disabled={processing}
                                className="rounded-none text-[10px] font-black uppercase tracking-wider h-8 px-4 gap-1.5"
                            >
                                <XCircle className="h-3.5 w-3.5" /> Reject Order
                            </Button>
                        )}
                    </div>
                )}
                <div className="flex justify-end">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={processing}
                        className="border border-zinc-300 dark:border-zinc-600 text-zinc-500 font-bold uppercase text-[10px] tracking-wider px-4 h-8 rounded-none disabled:opacity-50"
                    >
                        Tutup
                    </Button>
                </div>
            </div>
        </NBDialog>
    )
}
