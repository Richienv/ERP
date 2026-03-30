"use client"

import { useState, useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { Button } from "@/components/ui/button"
import { Loader2, FileText, Building2, Package, Hash, Calendar, User, ShieldCheck, AlertTriangle } from "lucide-react"
import {
    NBDialog,
    NBDialogHeader,
    NBDialogBody,
    NBSection,
    NBSelect,
} from "@/components/ui/nb-dialog"
import { getPODetails } from "@/app/actions/purchase-order"
import { updatePurchaseOrderVendor, submitPOForApproval } from "@/lib/actions/procurement"
import { formatIDR } from "@/lib/utils"
import { toast } from "sonner"

interface InitialOrder {
    id: string
    dbId: string
    vendorId?: string
    vendor: string
    date: string
    total: number
    status: string
    items: number
    requester?: string
    approver?: string
}

interface POFinalizeDialogProps {
    poId: string | null
    isOpen: boolean
    onClose: () => void
    vendors: { id: string, name: string }[]
    initialOrder?: InitialOrder | null
}

export function POFinalizeDialog({ poId, isOpen, onClose, vendors, initialOrder }: POFinalizeDialogProps) {
    const [loadingItems, setLoadingItems] = useState(false)
    const [processing, setProcessing] = useState(false)
    const [poData, setPoData] = useState<any>(null)
    const [selectedVendor, setSelectedVendor] = useState<string>("")
    const queryClient = useQueryClient()

    useEffect(() => {
        if (isOpen && poId) {
            // Pre-fill vendor select immediately from initialOrder
            if (initialOrder?.vendorId) {
                setSelectedVendor(initialOrder.vendorId)
            }
            fetchDetails(poId)
        } else {
            setPoData(null)
            setSelectedVendor("")
        }
    }, [isOpen, poId])

    const fetchDetails = async (id: string) => {
        setLoadingItems(true)
        try {
            const data = await getPODetails(id)
            if (data) {
                setPoData(data)
                if (!selectedVendor) setSelectedVendor(data.supplierId || "")
            }
        } catch {
            toast.error("Gagal memuat detail PO")
            onClose()
        } finally {
            setLoadingItems(false)
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

    // Use fetched data when available, fall back to initialOrder for instant display
    const displayNumber = poData?.number || initialOrder?.id || '-'
    const displayDate = poData?.orderDate
        ? new Date(poData.orderDate).toLocaleDateString('id-ID')
        : initialOrder?.date || '-'
    const displayRequester = poData?.requester || (initialOrder as any)?.requester || 'System'
    const displayApprover = poData?.approver || (initialOrder as any)?.approver || '-'

    const subtotal = poData?.subtotal ?? poData?.items?.reduce((acc: number, item: any) => acc + item.totalPrice, 0) ?? 0
    const tax = poData?.taxAmount ?? Math.round(subtotal * 0.11)
    const total = poData?.netAmount ?? (subtotal + tax)

    const hasHeaderData = !!poData || !!initialOrder

    return (
        <NBDialog open={isOpen} onOpenChange={onClose} size="wide">
            <NBDialogHeader
                icon={FileText}
                title="Finalisasi Pesanan Pembelian"
                subtitle="Tinjau detail, tetapkan vendor, dan buat dokumen PDF resmi."
            />

            {!hasHeaderData ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-zinc-300" />
                </div>
            ) : (
                <NBDialogBody>
                    {/* Row 1: PO Info Strip */}
                    <NBSection icon={Hash} title="Informasi PO">
                        <div className="grid grid-cols-4 gap-3">
                            <div className="border border-zinc-200 dark:border-zinc-700 p-3">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <Hash className="h-3 w-3 text-zinc-400" />
                                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">No. PO</span>
                                </div>
                                <span className="text-sm font-black font-mono">{displayNumber}</span>
                            </div>
                            <div className="border border-zinc-200 dark:border-zinc-700 p-3">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <Calendar className="h-3 w-3 text-zinc-400" />
                                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Tanggal</span>
                                </div>
                                <span className="text-sm font-bold">{displayDate}</span>
                            </div>
                            <div className="border border-zinc-200 dark:border-zinc-700 p-3">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <User className="h-3 w-3 text-zinc-400" />
                                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Pemohon</span>
                                </div>
                                <span className="text-sm font-bold">{displayRequester}</span>
                            </div>
                            <div className="border border-zinc-200 dark:border-zinc-700 p-3">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <ShieldCheck className="h-3 w-3 text-zinc-400" />
                                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Disetujui</span>
                                </div>
                                <span className="text-sm font-bold">{displayApprover}</span>
                            </div>
                        </div>
                    </NBSection>

                    {/* Row 2: Vendor + Tax */}
                    <NBSection icon={Building2} title="Vendor & Pajak">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <NBSelect
                                    label="Vendor"
                                    required
                                    value={selectedVendor}
                                    onValueChange={setSelectedVendor}
                                    placeholder="Pilih Vendor"
                                    options={(vendors || []).map(v => ({
                                        value: v.id,
                                        label: v.name,
                                    }))}
                                    disabled={processing}
                                />
                                {!selectedVendor && (
                                    <p className="text-[10px] text-red-500 font-bold mt-1.5 flex items-center gap-1">
                                        <AlertTriangle className="h-3 w-3" /> Wajib memilih vendor
                                    </p>
                                )}
                            </div>
                            <div>
                                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1 block">
                                    Pajak
                                </label>
                                <div className="border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2 font-bold text-sm h-8 flex items-center">
                                    PPN 11%
                                </div>
                            </div>
                        </div>
                    </NBSection>

                    {/* Row 3: Items Table + Totals */}
                    <NBSection icon={Package} title="Item Pesanan">
                        {loadingItems && !poData ? (
                            <div className="border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                                <div className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700">
                                    <div className="grid grid-cols-12 gap-0 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                        <div className="col-span-5 px-4 py-2.5 border-r border-zinc-200 dark:border-zinc-700">Item</div>
                                        <div className="col-span-2 px-4 py-2.5 text-right border-r border-zinc-200 dark:border-zinc-700">Qty</div>
                                        <div className="col-span-2 px-4 py-2.5 text-right border-r border-zinc-200 dark:border-zinc-700">Harga Satuan</div>
                                        <div className="col-span-3 px-4 py-2.5 text-right">Total</div>
                                    </div>
                                </div>
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="grid grid-cols-12 gap-0 border-b border-zinc-200 dark:border-zinc-700 last:border-b-0">
                                        <div className="col-span-5 px-4 py-3"><div className="h-4 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse w-3/4" /></div>
                                        <div className="col-span-2 px-4 py-3"><div className="h-4 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse w-1/2 ml-auto" /></div>
                                        <div className="col-span-2 px-4 py-3"><div className="h-4 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse w-2/3 ml-auto" /></div>
                                        <div className="col-span-3 px-4 py-3"><div className="h-4 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse w-3/4 ml-auto" /></div>
                                    </div>
                                ))}
                            </div>
                        ) : poData?.items ? (
                            <div className="border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                                <div className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700">
                                    <div className="grid grid-cols-12 gap-0 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                        <div className="col-span-5 px-4 py-2.5 border-r border-zinc-200 dark:border-zinc-700">Item</div>
                                        <div className="col-span-2 px-4 py-2.5 text-right border-r border-zinc-200 dark:border-zinc-700">Qty</div>
                                        <div className="col-span-2 px-4 py-2.5 text-right border-r border-zinc-200 dark:border-zinc-700">Harga Satuan</div>
                                        <div className="col-span-3 px-4 py-2.5 text-right">Total</div>
                                    </div>
                                </div>
                                {(poData.items || []).map((item: any, idx: number) => (
                                    <div key={idx} className={`grid grid-cols-12 gap-0 ${idx < poData.items.length - 1 ? 'border-b border-zinc-200 dark:border-zinc-700' : ''}`}>
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
                                {/* Totals */}
                                <div className="border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
                                    <div className="grid grid-cols-12 gap-0">
                                        <div className="col-span-9 px-4 py-2 text-right text-xs text-zinc-500 font-bold uppercase">Subtotal</div>
                                        <div className="col-span-3 px-4 py-2 text-right font-mono text-sm">{formatIDR(subtotal)}</div>
                                    </div>
                                    <div className="grid grid-cols-12 gap-0 border-t border-zinc-200 dark:border-zinc-700">
                                        <div className="col-span-9 px-4 py-2 text-right text-xs text-zinc-500 font-bold uppercase">PPN 11%</div>
                                        <div className="col-span-3 px-4 py-2 text-right font-mono text-sm">{formatIDR(tax)}</div>
                                    </div>
                                    <div className="grid grid-cols-12 gap-0 border-t-2 border-black dark:border-white">
                                        <div className="col-span-9 px-4 py-3 text-right text-sm font-black uppercase">Grand Total</div>
                                        <div className="col-span-3 px-4 py-3 text-right font-black text-base">{formatIDR(total)}</div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="py-8 text-center text-red-500 font-bold text-sm">Gagal memuat item</div>
                        )}
                    </NBSection>
                </NBDialogBody>
            )}

            {/* Custom footer with Konfirmasi & Buat PDF button */}
            <div className="border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-2.5 flex items-center justify-end gap-2">
                <Button
                    variant="outline"
                    onClick={onClose}
                    disabled={processing}
                    className="border border-zinc-300 dark:border-zinc-600 text-zinc-500 font-bold uppercase text-[10px] tracking-wider px-4 h-8 rounded-none disabled:opacity-50"
                >
                    Batal
                </Button>
                <Button
                    onClick={handleConfirm}
                    disabled={!poData || processing || !selectedVendor}
                    className="bg-black text-white border border-black hover:bg-zinc-800 font-black uppercase text-[10px] tracking-wider px-5 h-8 rounded-none gap-1.5 disabled:opacity-50 transition-colors"
                >
                    {processing ? (
                        <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Memproses...</>
                    ) : (
                        <><FileText className="h-3.5 w-3.5" /> Konfirmasi & Buat PDF</>
                    )}
                </Button>
            </div>
        </NBDialog>
    )
}
