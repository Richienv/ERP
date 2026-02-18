"use client"

import { useState, useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Loader2, FileText, User, Building2, Package, Hash, Calendar, ShieldCheck, Receipt, AlertTriangle } from "lucide-react"
import { getPODetails } from "@/app/actions/purchase-order"
import { updatePurchaseOrderVendor, submitPOForApproval } from "@/lib/actions/procurement"
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
    const queryClient = useQueryClient()

    useEffect(() => {
        if (isOpen && poId) {
            fetchDetails(poId)
        } else {
            setPoData(null)
            setSelectedVendor("")
        }
    }, [isOpen, poId])

    const fetchDetails = async (id: string) => {
        setLoading(true)
        try {
            const data = await getPODetails(id)
            if (data) {
                setPoData(data)
                setSelectedVendor(data.supplierId || "")
            }
        } catch (error) {
            toast.error("Gagal memuat detail PO")
            onClose()
        } finally {
            setLoading(false)
        }
    }

    const handleConfirm = async () => {
        if (!poId || !selectedVendor) {
            toast.error("Pilih vendor terlebih dahulu")
            return
        }

        setProcessing(true)
        try {
            if (poData.supplierId !== selectedVendor) {
                const updateRes = await updatePurchaseOrderVendor(poId, selectedVendor)
                if (!updateRes.success) throw new Error(updateRes.error)
                toast.success("Vendor diperbarui")
            }

            const submitRes = await submitPOForApproval(poId)
            if (!submitRes.success) throw new Error(submitRes.error || "Gagal finalisasi PO")

            window.open(`/api/documents/purchase-order/${poData.id}?disposition=inline`, '_blank')
            toast.success("PO Difinalisasi & PDF Dibuat")
            onClose()
            queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.procurementDashboard.all })
        } catch (error: any) {
            toast.error(error.message || "Gagal finalisasi PO")
        } finally {
            setProcessing(false)
        }
    }

    if (!isOpen) return null

    const subtotal = poData?.subtotal || poData?.items?.reduce((acc: number, item: any) => acc + item.totalPrice, 0) || 0
    const tax = poData?.taxAmount || (subtotal * 0.11)
    const total = poData?.netAmount || (subtotal + tax)

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl p-0 border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-none overflow-hidden gap-0 bg-white">
                {/* Header */}
                <DialogHeader className="border-b-2 border-black px-6 py-4">
                    <DialogTitle className="text-lg font-black uppercase tracking-wider flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Finalisasi Pesanan Pembelian
                    </DialogTitle>
                    <p className="text-xs text-zinc-500 font-medium mt-0.5">
                        Tinjau detail, tetapkan vendor, dan buat dokumen PDF resmi.
                    </p>
                </DialogHeader>

                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="h-8 w-8 animate-spin text-zinc-300" />
                    </div>
                ) : poData ? (
                    <div className="p-6 space-y-5">
                        {/* Row 1: PO Info Strip — horizontal cards */}
                        <div className="grid grid-cols-4 gap-3">
                            <div className="border-2 border-black p-3">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <Hash className="h-3 w-3 text-zinc-400" />
                                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">No. PO</span>
                                </div>
                                <span className="text-sm font-black font-mono">{poData.number}</span>
                            </div>
                            <div className="border-2 border-black p-3">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <Calendar className="h-3 w-3 text-zinc-400" />
                                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Tanggal</span>
                                </div>
                                <span className="text-sm font-bold">{new Date(poData.orderDate).toLocaleDateString('id-ID')}</span>
                            </div>
                            <div className="border-2 border-black p-3">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <User className="h-3 w-3 text-zinc-400" />
                                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Pemohon</span>
                                </div>
                                <span className="text-sm font-bold">{poData.requester || 'System'}</span>
                            </div>
                            <div className="border-2 border-black p-3">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <ShieldCheck className="h-3 w-3 text-zinc-400" />
                                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Disetujui</span>
                                </div>
                                <span className="text-sm font-bold">{poData.approver || '-'}</span>
                            </div>
                        </div>

                        {/* Row 2: Vendor + Tax side by side */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="border-2 border-black p-4">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-1.5 mb-2">
                                    <Building2 className="h-3.5 w-3.5" /> Vendor
                                </label>
                                <Select value={selectedVendor} onValueChange={setSelectedVendor} disabled={processing}>
                                    <SelectTrigger className="w-full font-bold h-10 border-2 border-black">
                                        <SelectValue placeholder="Pilih Vendor" />
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
                                    <p className="text-[10px] text-red-500 font-bold mt-1.5 flex items-center gap-1">
                                        <AlertTriangle className="h-3 w-3" /> Wajib memilih vendor
                                    </p>
                                )}
                            </div>
                            <div className="border-2 border-black p-4">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-1.5 mb-2">
                                    <Receipt className="h-3.5 w-3.5" /> Pajak
                                </label>
                                <div className="border-2 border-black bg-zinc-50 px-3 py-2 font-bold text-sm">
                                    PPN 11%
                                </div>
                            </div>
                        </div>

                        {/* Row 3: Items Table + Totals */}
                        <div className="border-2 border-black">
                            <div className="bg-zinc-100 border-b-2 border-black">
                                <div className="grid grid-cols-12 gap-0 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                    <div className="col-span-5 px-4 py-2.5 border-r border-zinc-300">Item</div>
                                    <div className="col-span-2 px-4 py-2.5 text-right border-r border-zinc-300">Qty</div>
                                    <div className="col-span-2 px-4 py-2.5 text-right border-r border-zinc-300">Harga Satuan</div>
                                    <div className="col-span-3 px-4 py-2.5 text-right">Total</div>
                                </div>
                            </div>
                            {poData.items.map((item: any, idx: number) => (
                                <div key={idx} className={`grid grid-cols-12 gap-0 ${idx < poData.items.length - 1 ? 'border-b border-zinc-200' : ''}`}>
                                    <div className="col-span-5 px-4 py-3 flex items-center gap-2">
                                        <Package className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                                        <div>
                                            <span className="font-bold text-sm">{item.productName}</span>
                                            <span className="text-[10px] text-zinc-400 font-mono ml-2">{item.productCode}</span>
                                        </div>
                                    </div>
                                    <div className="col-span-2 px-4 py-3 text-right font-mono font-bold text-sm self-center">
                                        {item.quantity} <span className="text-[10px] text-zinc-400">{item.unit}</span>
                                    </div>
                                    <div className="col-span-2 px-4 py-3 text-right font-mono text-sm text-zinc-600 self-center">
                                        {formatIDR(item.unitPrice)}
                                    </div>
                                    <div className="col-span-3 px-4 py-3 text-right font-black text-sm self-center">
                                        {formatIDR(item.totalPrice)}
                                    </div>
                                </div>
                            ))}
                            {/* Totals row inside table */}
                            <div className="border-t-2 border-black bg-zinc-50">
                                <div className="grid grid-cols-12 gap-0">
                                    <div className="col-span-9 px-4 py-2 text-right text-xs text-zinc-500 font-bold uppercase">Subtotal</div>
                                    <div className="col-span-3 px-4 py-2 text-right font-mono text-sm">{formatIDR(subtotal)}</div>
                                </div>
                                <div className="grid grid-cols-12 gap-0 border-t border-zinc-200">
                                    <div className="col-span-9 px-4 py-2 text-right text-xs text-zinc-500 font-bold uppercase">PPN 11%</div>
                                    <div className="col-span-3 px-4 py-2 text-right font-mono text-sm">{formatIDR(tax)}</div>
                                </div>
                                <div className="grid grid-cols-12 gap-0 border-t-2 border-black">
                                    <div className="col-span-9 px-4 py-3 text-right text-sm font-black uppercase">Grand Total</div>
                                    <div className="col-span-3 px-4 py-3 text-right font-black text-base">{formatIDR(total)}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="py-16 text-center text-red-500 font-bold">Gagal memuat data</div>
                )}

                {/* Footer */}
                <div className="border-t-2 border-black px-6 py-4 flex items-center justify-end gap-3 bg-white">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={processing}
                        className="border-2 border-black font-black uppercase text-xs tracking-wider px-6 hover:bg-zinc-100"
                    >
                        Batal
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={!poData || processing || !selectedVendor}
                        className="bg-white text-black border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-black uppercase text-xs tracking-wider px-6 disabled:opacity-40"
                    >
                        {processing ? (
                            <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Memproses...</>
                        ) : (
                            <><FileText className="h-4 w-4 mr-2" /> Konfirmasi & Buat PDF</>
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
