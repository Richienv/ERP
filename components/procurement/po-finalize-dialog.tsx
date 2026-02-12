"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Loader2, FileText, CheckCircle2, User, Building2 } from "lucide-react"
import { getPODetails } from "@/app/actions/purchase-order"
import { updatePurchaseOrderVendor, submitPOForApproval, updatePurchaseOrderTaxMode } from "@/lib/actions/procurement"
import { formatIDR } from "@/lib/utils"
import { toast } from "sonner"

interface POFinalizeDialogProps {
    poId: string | null
    isOpen: boolean
    onClose: () => void
    vendors: { id: string, name: string }[]
}

export function POFinalizeDialog({ poId, isOpen, onClose, vendors }: POFinalizeDialogProps) {
    const [loading, setLoading] = useState(false)
    const [processing, setProcessing] = useState(false)
    const [poData, setPoData] = useState<any>(null)
    const [selectedVendor, setSelectedVendor] = useState<string>("")
    const [taxMode, setTaxMode] = useState<"PPN" | "NON_PPN">("PPN")
    const router = useRouter()

    useEffect(() => {
        if (isOpen && poId) {
            fetchDetails(poId)
        } else {
            setPoData(null)
            setSelectedVendor("")
            setTaxMode("PPN")
        }
    }, [isOpen, poId])

    const fetchDetails = async (id: string) => {
        setLoading(true)
        try {
            const data = await getPODetails(id)
            if (data) {
                setPoData(data)
                // If vendor is assigned, use it. If it's a temp vendor (likely no ID in basic list), it might need attention
                // The data.supplierId comes from the DB.
                setSelectedVendor(data.supplierId || "")
                setTaxMode(Number(data.taxAmount || 0) > 0 ? "PPN" : "NON_PPN")
            }
        } catch {
            toast.error("Failed to load PO details")
            onClose()
        } finally {
            setLoading(false)
        }
    }

    const handleConfirm = async () => {
        if (!poId || !selectedVendor) {
            toast.error("Please select a vendor")
            return
        }

        setProcessing(true)
        try {
            // 1. Update Vendor if changed
            if (poData.supplierId !== selectedVendor) {
                const updateRes = await updatePurchaseOrderVendor(poId, selectedVendor)
                if (!updateRes.success) throw new Error(updateRes.error)
                toast.success("Vendor updated")
            }

            // 2. Persist tax mode/amount before submit
            const taxRes = await updatePurchaseOrderTaxMode(poId, taxMode)
            if (!taxRes.success) throw new Error(taxRes.error)

            // 3. Submit PO for Approval (advances status from DRAFT)
            const submitRes = await submitPOForApproval(poId)
            if (!submitRes.success) throw new Error(submitRes.error || "Failed to finalize PO")

            // 4. Generate PDF (Open in new tab)
            window.open(`/api/documents/purchase-order/${poData.id}?disposition=inline`, '_blank')

            toast.success("PO Finalized & PDF Generated")
            onClose()

            // 5. Refresh data without full page reload
            router.refresh()
        } catch (error: any) {
            toast.error(error.message || "Failed to finalize PO")
        } finally {
            setProcessing(false)
        }
    }

    if (!isOpen) return null

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl font-black uppercase">
                        <FileText className="h-6 w-6 text-blue-600" />
                        Finalize Purchase Order
                    </DialogTitle>
                    <DialogDescription>
                        Review details, assign vendor, and generate the official PDF.
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-zinc-300" />
                    </div>
                ) : poData ? (
                    <div className="space-y-6 py-4">
                        {/* Header Info */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-zinc-50 p-4 rounded-xl border border-zinc-200">
                            <div>
                                <div className="text-[10px] font-bold uppercase text-zinc-500">PO Number</div>
                                <div className="text-sm font-bold">{poData.number}</div>
                            </div>
                            <div>
                                <div className="text-[10px] font-bold uppercase text-zinc-500">Date</div>
                                <div className="font-medium">{new Date(poData.orderDate).toLocaleDateString()}</div>
                            </div>
                            <div>
                                <div className="text-[10px] font-bold uppercase text-zinc-500">Requester</div>
                                <div className="font-medium text-xs flex items-center gap-1">
                                    <User className="h-3 w-3" /> {poData.requester}
                                </div>
                            </div>
                            <div>
                                <div className="text-[10px] font-bold uppercase text-zinc-500">Approved By</div>
                                <div className="font-medium text-xs flex items-center gap-1">
                                    <CheckCircle2 className="h-3 w-3 text-emerald-600" /> {poData.approver}
                                </div>
                            </div>
                        </div>

                        {/* Vendor Selection */}
                        <div className="space-y-2">
                            <label className="text-sm font-black uppercase flex items-center gap-2">
                                <Building2 className="h-4 w-4" /> Vendor Assignment
                            </label>
                            <Select value={selectedVendor} onValueChange={setSelectedVendor} disabled={processing}>
                                <SelectTrigger className="w-full font-medium h-12 border-black">
                                    <SelectValue placeholder="Select Vendor" />
                                </SelectTrigger>
                                <SelectContent>
                                    {vendors.map(v => (
                                        <SelectItem key={v.id} value={v.id} className="font-medium">
                                            {v.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {!selectedVendor && (
                                <p className="text-xs text-red-500 font-bold">* You must assign a valid vendor before generating the PO.</p>
                            )}
                        </div>

                        {/* Tax Mode */}
                        <div className="space-y-2">
                            <label className="text-sm font-black uppercase">Tax</label>
                            <Select value={taxMode} onValueChange={(value) => setTaxMode(value as "PPN" | "NON_PPN")} disabled={processing}>
                                <SelectTrigger className="w-full font-medium h-12 border-black">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="PPN" className="font-medium">PPN 11%</SelectItem>
                                    <SelectItem value="NON_PPN" className="font-medium">Non-PPN</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Items Table */}
                        <div className="border border-zinc-200 rounded-lg overflow-x-auto">
                            <table className="w-full min-w-[760px] text-sm table-auto">
                                <thead className="bg-zinc-100 border-b border-zinc-200 text-xs uppercase font-bold text-zinc-500">
                                    <tr>
                                        <th className="px-4 py-3 text-left min-w-[300px]">Item Name</th>
                                        <th className="px-4 py-3 text-right min-w-[120px]">Qty</th>
                                        <th className="px-4 py-3 text-right min-w-[160px]">Unit Price</th>
                                        <th className="px-4 py-3 text-right min-w-[160px]">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100">
                                    {poData.items.map((item: any, idx: number) => (
                                        <tr key={idx}>
                                            <td className="px-4 py-3 font-medium break-words align-top">
                                                <span className="line-clamp-2">{item.productName}</span>
                                                <div className="text-[10px] text-zinc-400 font-mono">{item.productCode}</div>
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono whitespace-nowrap align-top">
                                                {item.quantity} <span className="text-[10px] text-zinc-400">{item.unit}</span>
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono text-zinc-600 whitespace-nowrap align-top">
                                                {formatIDR(item.unitPrice)}
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-zinc-900 whitespace-nowrap align-top">
                                                {formatIDR(item.totalPrice)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Totals */}
                        {(() => {
                            const subtotal = poData.subtotal || poData.items.reduce((acc: number, item: any) => acc + item.totalPrice, 0)
                            const tax = taxMode === "PPN" ? (subtotal * 0.11) : 0
                            const total = subtotal + tax

                            return (
                                <div className="flex justify-end">
                                    <div className="w-64 space-y-2">
                                        <div className="flex justify-between text-sm text-zinc-500">
                                            <span>Subtotal</span>
                                            <span>{formatIDR(subtotal)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm text-zinc-500">
                                            <span>{taxMode === "PPN" ? "Tax (11%)" : "Tax (0%)"}</span>
                                            <span>{formatIDR(tax)}</span>
                                        </div>
                                        <Separator />
                                        <div className="flex justify-between text-lg font-black text-black">
                                            <span>Total</span>
                                            <span>{formatIDR(total)}</span>
                                        </div>
                                    </div>
                                </div>
                            )
                        })()}
                    </div>
                ) : (
                    <div className="py-12 text-center text-red-500 font-bold">Failed to load data</div>
                )}

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="ghost" onClick={onClose} disabled={processing}>Cancel</Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={!poData || processing || !selectedVendor}
                        className="bg-black text-white hover:bg-zinc-800 font-bold uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-[2px] active:shadow-none transition-all"
                    >
                        {processing ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
                        Confirm & Generate PDF
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
