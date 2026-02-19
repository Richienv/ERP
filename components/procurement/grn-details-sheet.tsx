"use client"

import { useState } from "react"
import { CheckCircle2, XCircle, Package, Loader2, Calendar, User, Warehouse, Printer } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { acceptGRN, rejectGRN } from "@/lib/actions/grn"
import { queryKeys } from "@/lib/query-keys"

interface GRNItem {
    id: string
    productName: string
    productCode: string
    quantityOrdered: number
    quantityReceived: number
    quantityAccepted: number
    quantityRejected: number
    unitCost: number
    inspectionNotes: string | null
}

interface GRN {
    id: string
    number: string
    poNumber: string
    vendorName: string
    warehouseName: string
    receivedBy: string
    receivedDate: Date
    status: string
    notes: string | null
    itemCount: number
    totalAccepted: number
    totalRejected: number
    items: GRNItem[]
}

interface Props {
    grn: GRN | null
    isOpen: boolean
    onClose: () => void
}

export function GRNDetailsSheet({ grn, isOpen, onClose }: Props) {
    const [loading, setLoading] = useState(false)
    const [rejectMode, setRejectMode] = useState(false)
    const [rejectReason, setRejectReason] = useState("")
    const [sodMode, setSodMode] = useState(false)
    const [sodReason, setSodReason] = useState("")
    const queryClient = useQueryClient()

    if (!grn) return null

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'ACCEPTED':
                return 'bg-emerald-100 text-emerald-700 border-emerald-200'
            case 'DRAFT':
                return 'bg-amber-100 text-amber-700 border-amber-200'
            case 'INSPECTING':
                return 'bg-blue-100 text-blue-700 border-blue-200'
            case 'REJECTED':
                return 'bg-red-100 text-red-700 border-red-200'
            default:
                return 'bg-zinc-100 text-zinc-600 border-zinc-200'
        }
    }

    const handleAccept = async () => {
        if (sodMode && sodReason.trim().length < 10) {
            toast.error("Masukkan alasan bypass SoD (min 10 karakter)")
            return
        }

        setLoading(true)
        try {
            const result = await acceptGRN(grn.id, sodMode ? sodReason : undefined)
            
            if (result.success) {
                toast.success("Surat Jalan Masuk diterima dan stok diperbarui")
                setSodMode(false)
                setSodReason("")
                onClose()
                queryClient.invalidateQueries({ queryKey: queryKeys.receiving.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.procurementDashboard.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.inventoryDashboard.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.stockMovements.all })
            } else if ('sodViolation' in result && result.sodViolation) {
                setSodMode(true)
                toast.warning(result.error || "Peringatan SoD: Konfirmasi diperlukan")
            } else {
                toast.error('error' in result ? result.error : "Gagal menerima Surat Jalan")
            }
        } catch {
            toast.error("Terjadi kesalahan")
        } finally {
            setLoading(false)
        }
    }

    const handleReject = async () => {
        if (!rejectReason.trim()) {
            toast.error("Masukkan alasan penolakan")
            return
        }

        setLoading(true)
        try {
            const result = await rejectGRN(grn.id, rejectReason)
            if (result.success) {
                toast.success("Surat Jalan Masuk ditolak")
                setRejectMode(false)
                onClose()
                queryClient.invalidateQueries({ queryKey: queryKeys.receiving.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.procurementDashboard.all })
            } else {
                toast.error(result.error || "Gagal menolak Surat Jalan")
            }
        } catch {
            toast.error("Terjadi kesalahan")
        } finally {
            setLoading(false)
        }
    }

    const canProcess = grn.status === 'DRAFT'

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-3xl border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <DialogTitle className="font-black uppercase flex items-center gap-2">
                            <Package className="h-5 w-5 text-emerald-600" />
                            {grn.number}
                        </DialogTitle>
                        {(grn.status === 'DRAFT' || grn.status === 'ACCEPTED') && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="border-2 border-black text-[10px] font-black uppercase tracking-widest h-8 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                                onClick={() => window.open(`/api/documents/surat-jalan-masuk/${grn.id}?disposition=inline`, '_blank')}
                            >
                                <Printer className="h-3.5 w-3.5 mr-1.5" />
                                Cetak Surat Jalan
                            </Button>
                        )}
                    </div>
                    <DialogDescription>
                        PO: <span className="font-bold text-blue-600">{grn.poNumber}</span>
                    </DialogDescription>
                </DialogHeader>

                <div className="py-6 space-y-6">
                    {/* Status Badge */}
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground font-bold uppercase">Status</span>
                        <Badge variant="outline" className={`font-bold uppercase text-xs ${getStatusStyle(grn.status)}`}>
                            {grn.status}
                        </Badge>
                    </div>

                    <Separator />

                    {/* Info Grid */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex items-start gap-2">
                            <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div>
                                <div className="text-[10px] uppercase text-muted-foreground font-bold">Vendor</div>
                                <div className="font-bold">{grn.vendorName}</div>
                            </div>
                        </div>
                        <div className="flex items-start gap-2">
                            <Warehouse className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div>
                                <div className="text-[10px] uppercase text-muted-foreground font-bold">Gudang</div>
                                <div className="font-bold">{grn.warehouseName}</div>
                            </div>
                        </div>
                        <div className="flex items-start gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div>
                                <div className="text-[10px] uppercase text-muted-foreground font-bold">Tanggal</div>
                                <div className="font-medium">{new Date(grn.receivedDate).toLocaleDateString('id-ID')}</div>
                            </div>
                        </div>
                        <div className="flex items-start gap-2">
                            <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div>
                                <div className="text-[10px] uppercase text-muted-foreground font-bold">Penerima</div>
                                <div className="font-medium">{grn.receivedBy}</div>
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Summary */}
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div className="bg-zinc-50 p-3 rounded-lg border">
                            <div className="text-2xl font-black">{grn.itemCount}</div>
                            <div className="text-[10px] uppercase text-muted-foreground font-bold">Items</div>
                        </div>
                        <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200">
                            <div className="text-2xl font-black text-emerald-600">{grn.totalAccepted}</div>
                            <div className="text-[10px] uppercase text-emerald-600 font-bold">Diterima</div>
                        </div>
                        <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                            <div className="text-2xl font-black text-red-600">{grn.totalRejected}</div>
                            <div className="text-[10px] uppercase text-red-600 font-bold">Ditolak</div>
                        </div>
                    </div>

                    <Separator />

                    {/* Items List */}
                    <div>
                        <h4 className="font-black uppercase text-xs text-muted-foreground mb-3">Detail Items</h4>
                        <div className="space-y-3">
                            {grn.items.map((item) => (
                                <div key={item.id} className="bg-zinc-50 p-3 rounded-lg border">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <div className="font-bold text-sm">{item.productName}</div>
                                            <div className="text-xs text-muted-foreground">{item.productCode}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-mono text-sm">
                                                <span className="text-emerald-600 font-bold">{item.quantityAccepted}</span>
                                                {item.quantityRejected > 0 && (
                                                    <span className="text-red-500 ml-1">(-{item.quantityRejected})</span>
                                                )}
                                            </div>
                                            <div className="text-[10px] text-muted-foreground">
                                                dari {item.quantityReceived} diterima
                                            </div>
                                        </div>
                                    </div>
                                    {item.inspectionNotes && (
                                        <div className="text-xs text-muted-foreground bg-white p-2 rounded border mt-2">
                                            {item.inspectionNotes}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Notes */}
                    {grn.notes && (
                        <>
                            <Separator />
                            <div>
                                <h4 className="font-black uppercase text-xs text-muted-foreground mb-2">Catatan</h4>
                                <p className="text-sm text-muted-foreground bg-zinc-50 p-3 rounded border">
                                    {grn.notes}
                                </p>
                            </div>
                        </>
                    )}

                    {/* Reject Mode */}
                    {rejectMode && (
                        <div className="bg-red-50 p-4 rounded-lg border border-red-200 animate-in fade-in">
                            <label className="text-xs font-bold text-red-700 uppercase mb-2 block">
                                Alasan Penolakan *
                            </label>
                            <Textarea
                                placeholder="Mengapa Surat Jalan ini ditolak?"
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                className="bg-white"
                            />
                            <div className="flex gap-2 mt-3 justify-end">
                                <Button size="sm" variant="ghost" onClick={() => setRejectMode(false)}>
                                    Batal
                                </Button>
                                <Button size="sm" variant="destructive" onClick={handleReject} disabled={loading}>
                                    {loading && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                                    Konfirmasi Tolak
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* SoD Warning & Override */}
                    {sodMode && (
                        <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 animate-in fade-in">
                            <div className="flex items-start gap-3 mb-3">
                                <div className="p-2 bg-amber-100 rounded-full">
                                    <User className="h-4 w-4 text-amber-600" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-amber-800">Peringatan Segregation of Duties</h4>
                                    <p className="text-xs text-amber-700 mt-1">
                                        Anda adalah approver untuk PO ini. Menerima barang sendiri berpotensi melanggar kebijakan audit.
                                        Mohon berikan alasan untuk melanjutkan.
                                    </p>
                                </div>
                            </div>
                            <label className="text-xs font-bold text-amber-700 uppercase mb-2 block">
                                Alasan Override *
                            </label>
                            <Textarea
                                placeholder="Saya melakukan penerimaan karena..."
                                value={sodReason}
                                onChange={(e) => setSodReason(e.target.value)}
                                className="bg-white border-amber-200 focus:ring-amber-200"
                            />
                            <div className="flex gap-2 mt-3 justify-end">
                                <Button size="sm" variant="ghost" onClick={() => { setSodMode(false); setSodReason(""); }}>
                                    Batal
                                </Button>
                                <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white" onClick={handleAccept} disabled={loading}>
                                    {loading && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                                    Konfirmasi & Terima
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {canProcess && !rejectMode && !sodMode && (
                    <DialogFooter className="flex-col gap-2">
                        <Button
                            onClick={handleAccept}
                            disabled={loading}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                        >
                            {loading ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                            )}
                            Terima & Update Stok
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => setRejectMode(true)}
                            disabled={loading}
                            className="w-full"
                        >
                            <XCircle className="h-4 w-4 mr-2" />
                            Tolak Surat Jalan
                        </Button>
                    </DialogFooter>
                )}

                {!canProcess && (
                    <DialogFooter>
                        <Button variant="secondary" onClick={onClose} className="w-full">
                            Tutup
                        </Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    )
}
