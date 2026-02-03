"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, XCircle, Package, Loader2, Calendar, User, Warehouse } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { acceptGRN, rejectGRN } from "@/lib/actions/grn"

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
    const router = useRouter()

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
        setLoading(true)
        try {
            const result = await acceptGRN(grn.id)
            if (result.success) {
                toast.success("GRN berhasil diterima dan stok diperbarui")
                onClose()
                router.refresh()
            } else {
                toast.error('error' in result ? result.error : "Gagal menerima GRN")
            }
        } catch (error) {
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
                toast.success("GRN ditolak")
                setRejectMode(false)
                onClose()
                router.refresh()
            } else {
                toast.error(result.error || "Gagal menolak GRN")
            }
        } catch (error) {
            toast.error("Terjadi kesalahan")
        } finally {
            setLoading(false)
        }
    }

    const canProcess = grn.status === 'DRAFT'

    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent className="sm:max-w-lg overflow-y-auto">
                <SheetHeader>
                    <SheetTitle className="font-black uppercase flex items-center gap-2">
                        <Package className="h-5 w-5 text-emerald-600" />
                        {grn.number}
                    </SheetTitle>
                    <SheetDescription>
                        PO: <span className="font-bold text-blue-600">{grn.poNumber}</span>
                    </SheetDescription>
                </SheetHeader>

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
                                placeholder="Mengapa GRN ini ditolak?"
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
                </div>

                {canProcess && !rejectMode && (
                    <SheetFooter className="flex-col gap-2">
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
                            Tolak GRN
                        </Button>
                    </SheetFooter>
                )}

                {!canProcess && (
                    <SheetFooter>
                        <Button variant="secondary" onClick={onClose} className="w-full">
                            Tutup
                        </Button>
                    </SheetFooter>
                )}
            </SheetContent>
        </Sheet>
    )
}
