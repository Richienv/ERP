
"use client"

import { useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { formatIDR } from "@/lib/utils"
import { rejectPurchaseOrder, submitPOForApproval, approvePurchaseOrder, markAsOrdered } from "@/lib/actions/procurement"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

interface PODetailsSheetProps {
    order: any
    isOpen: boolean
    onClose: () => void
    userRole: string
}

export function PODetailsSheet({ order, isOpen, onClose, userRole }: PODetailsSheetProps) {
    const [rejectMode, setRejectMode] = useState(false)
    const [rejectReason, setRejectReason] = useState("")
    const [processing, setProcessing] = useState(false)
    const router = useRouter()

    if (!order) return null

    const isDirector = userRole.includes('CEO') || userRole.includes('DIRECTOR')
    const isPurchasing = userRole.includes('PURCHASING') || userRole.includes('ADMIN') || isDirector // Fallback

    // Permissions
    const canSubmit = isPurchasing && order.status === 'PO_DRAFT'
    const canApprove = isDirector && order.status === 'PENDING_APPROVAL'
    const canReject = isDirector && ['PENDING_APPROVAL', 'APPROVED'].includes(order.status)
    const canOrder = isPurchasing && order.status === 'APPROVED'

    const handleAction = async (action: 'submit' | 'approve' | 'order' | 'reject') => {
        setProcessing(true)
        try {
            let res
            if (action === 'submit') res = await submitPOForApproval(order.dbId)
            else if (action === 'approve') res = await approvePurchaseOrder(order.dbId, "current-user-id")
            else if (action === 'order') res = await markAsOrdered(order.dbId)
            else if (action === 'reject') res = await rejectPurchaseOrder(order.dbId, rejectReason)

            if (res?.success) {
                toast.success(`Order ${action}ed successfully`)
                onClose()
                router.refresh()
            } else {
                toast.error("Action failed")
            }
        } catch (e) {
            toast.error("Error performing action")
        } finally {
            setProcessing(false)
            setRejectMode(false)
        }
    }

    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent className="overflow-y-auto sm:max-w-md">
                <SheetHeader>
                    <SheetTitle>PO Details: {order.id}</SheetTitle>
                    <SheetDescription>
                        Vendor: <span className="font-bold text-black">{order.vendor}</span>
                    </SheetDescription>
                </SheetHeader>

                <div className="py-6 space-y-6">
                    {/* Status Badge */}
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-zinc-500 font-bold uppercase">Status</span>
                        <Badge variant="outline" className="text-sm font-bold">{order.status}</Badge>
                    </div>

                    <Separator />

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <div className="text-[10px] uppercase font-bold text-zinc-500">Total Amount</div>
                            <div className="text-xl font-black">{formatIDR(order.total)}</div>
                        </div>
                        <div>
                            <div className="text-[10px] uppercase font-bold text-zinc-500">Items</div>
                            <div className="text-xl font-mono">{order.items} Items</div>
                        </div>
                    </div>

                    <Separator />

                    {/* Reject UI */}
                    {rejectMode && (
                        <div className="bg-red-50 p-4 rounded-lg border border-red-200 animate-in fade-in slide-in-from-bottom-2">
                            <label className="text-xs font-bold text-red-700 uppercase mb-1 block">Reason for Rejection</label>
                            <Textarea
                                placeholder="Why is this order being rejected?"
                                className="bg-white"
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                            />
                            <div className="flex gap-2 mt-2 justify-end">
                                <Button size="sm" variant="ghost" onClick={() => setRejectMode(false)}>Cancel</Button>
                                <Button size="sm" variant="destructive" onClick={() => handleAction('reject')} disabled={processing}>Confirm Rejection</Button>
                            </div>
                        </div>
                    )}
                </div>

                <SheetFooter className="flex-col gap-2">
                    {/* Action Buttons */}
                    {!rejectMode && (
                        <>
                            {canSubmit && (
                                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold" onClick={() => handleAction('submit')} disabled={processing}>
                                    Submit for Approval
                                </Button>
                            )}
                            {canApprove && (
                                <Button className="w-full bg-black text-white hover:bg-zinc-800 font-bold" onClick={() => handleAction('approve')} disabled={processing}>
                                    Approve Order
                                </Button>
                            )}
                            {canOrder && (
                                <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold" onClick={() => handleAction('order')} disabled={processing}>
                                    Mark as Ordered (Send to Vendor)
                                </Button>
                            )}
                            {canReject && (
                                <Button variant="destructive" className="w-full" onClick={() => setRejectMode(true)} disabled={processing}>
                                    Reject Order
                                </Button>
                            )}
                        </>
                    )}

                    <Button variant="secondary" className="w-full mt-2" onClick={onClose} disabled={processing}>Close</Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    )
}
