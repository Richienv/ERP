"use client"

import { useState } from "react"
import { CheckCircle2, XCircle, Package, Loader2, Calendar, User, Warehouse, Printer } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import {
    NBDialog,
    NBDialogHeader,
    NBDialogBody,
    NBSection,
    NBTextarea,
} from "@/components/ui/nb-dialog"
import { Badge } from "@/components/ui/badge"
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
        <NBDialog open={isOpen} onOpenChange={onClose} size="wide">
            <NBDialogHeader
                icon={Package}
                title={grn.number}
                subtitle={`PO: ${grn.poNumber}`}
            />

            <NBDialogBody>
                    {/* Status + Print row */}
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Status</span>
                            <Badge variant="outline" className={`font-bold uppercase text-xs ${getStatusStyle(grn.status)}`}>
                                {grn.status}
                            </Badge>
                        </div>
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

                    {/* Info Grid */}
                    <NBSection icon={User} title="Informasi Penerimaan">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="flex items-start gap-2">
                                <User className="h-4 w-4 text-zinc-400 mt-0.5" />
                                <div>
                                    <div className="text-[10px] uppercase text-zinc-500 font-bold">Vendor</div>
                                    <div className="font-bold">{grn.vendorName}</div>
                                </div>
                            </div>
                            <div className="flex items-start gap-2">
                                <Warehouse className="h-4 w-4 text-zinc-400 mt-0.5" />
                                <div>
                                    <div className="text-[10px] uppercase text-zinc-500 font-bold">Gudang</div>
                                    <div className="font-bold">{grn.warehouseName}</div>
                                </div>
                            </div>
                            <div className="flex items-start gap-2">
                                <Calendar className="h-4 w-4 text-zinc-400 mt-0.5" />
                                <div>
                                    <div className="text-[10px] uppercase text-zinc-500 font-bold">Tanggal</div>
                                    <div className="font-medium">{new Date(grn.receivedDate).toLocaleDateString('id-ID')}</div>
                                </div>
                            </div>
                            <div className="flex items-start gap-2">
                                <User className="h-4 w-4 text-zinc-400 mt-0.5" />
                                <div>
                                    <div className="text-[10px] uppercase text-zinc-500 font-bold">Penerima</div>
                                    <div className="font-medium">{grn.receivedBy}</div>
                                </div>
                            </div>
                        </div>
                    </NBSection>

                    {/* Summary KPI */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="border border-zinc-200 dark:border-zinc-700 p-3 text-center">
                            <div className="text-2xl font-black">{grn.itemCount}</div>
                            <div className="text-[10px] uppercase text-zinc-500 font-bold">Items</div>
                        </div>
                        <div className="border border-emerald-200 bg-emerald-50/50 p-3 text-center">
                            <div className="text-2xl font-black text-emerald-600">{grn.totalAccepted}</div>
                            <div className="text-[10px] uppercase text-emerald-600 font-bold">Diterima</div>
                        </div>
                        <div className="border border-red-200 bg-red-50/50 p-3 text-center">
                            <div className="text-2xl font-black text-red-600">{grn.totalRejected}</div>
                            <div className="text-[10px] uppercase text-red-600 font-bold">Ditolak</div>
                        </div>
                    </div>

                    {/* Items List */}
                    <NBSection icon={Package} title="Detail Items">
                        <div className="space-y-2">
                            {grn.items.map((item) => (
                                <div key={item.id} className="bg-zinc-50 dark:bg-zinc-800/50 p-3 border border-zinc-200 dark:border-zinc-700">
                                    <div className="flex justify-between items-start mb-1">
                                        <div>
                                            <div className="font-bold text-sm">{item.productName}</div>
                                            <div className="text-xs text-zinc-500">{item.productCode}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-mono text-sm">
                                                <span className="text-emerald-600 font-bold">{item.quantityAccepted}</span>
                                                {item.quantityRejected > 0 && (
                                                    <span className="text-red-500 ml-1">(-{item.quantityRejected})</span>
                                                )}
                                            </div>
                                            <div className="text-[10px] text-zinc-500">
                                                dari {item.quantityReceived} diterima
                                            </div>
                                        </div>
                                    </div>
                                    {item.inspectionNotes && (
                                        <div className="text-xs text-zinc-500 bg-white dark:bg-zinc-900 p-2 border border-zinc-200 dark:border-zinc-700 mt-2">
                                            {item.inspectionNotes}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </NBSection>

                    {/* Notes */}
                    {grn.notes && (
                        <NBSection icon={Package} title="Catatan" optional>
                            <p className="text-sm text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 p-3 border border-zinc-200 dark:border-zinc-700">
                                {grn.notes}
                            </p>
                        </NBSection>
                    )}

                    {/* Reject Mode */}
                    {rejectMode && (
                        <div className="bg-red-50 dark:bg-red-950/20 p-4 border border-red-200 dark:border-red-800 animate-in fade-in">
                            <NBTextarea
                                label="Alasan Penolakan"
                                required
                                placeholder="Mengapa Surat Jalan ini ditolak?"
                                value={rejectReason}
                                onChange={setRejectReason}
                            />
                            <div className="flex gap-2 mt-3 justify-end">
                                <Button size="sm" variant="ghost" onClick={() => setRejectMode(false)} className="rounded-none text-[10px] font-bold uppercase tracking-wider">
                                    Batal
                                </Button>
                                <Button size="sm" variant="destructive" onClick={handleReject} disabled={loading} className="rounded-none text-[10px] font-bold uppercase tracking-wider">
                                    {loading && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                                    Konfirmasi Tolak
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* SoD Warning & Override */}
                    {sodMode && (
                        <div className="bg-amber-50 dark:bg-amber-950/20 p-4 border border-amber-200 dark:border-amber-800 animate-in fade-in">
                            <div className="flex items-start gap-3 mb-3">
                                <div className="p-2 bg-amber-100 dark:bg-amber-900/50">
                                    <User className="h-4 w-4 text-amber-600" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-amber-800 dark:text-amber-300">Peringatan Segregation of Duties</h4>
                                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                                        Anda adalah approver untuk PO ini. Menerima barang sendiri berpotensi melanggar kebijakan audit.
                                        Mohon berikan alasan untuk melanjutkan.
                                    </p>
                                </div>
                            </div>
                            <NBTextarea
                                label="Alasan Override"
                                required
                                placeholder="Saya melakukan penerimaan karena..."
                                value={sodReason}
                                onChange={setSodReason}
                            />
                            <div className="flex gap-2 mt-3 justify-end">
                                <Button size="sm" variant="ghost" onClick={() => { setSodMode(false); setSodReason(""); }} className="rounded-none text-[10px] font-bold uppercase tracking-wider">
                                    Batal
                                </Button>
                                <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white rounded-none text-[10px] font-bold uppercase tracking-wider" onClick={handleAccept} disabled={loading}>
                                    {loading && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                                    Konfirmasi & Terima
                                </Button>
                            </div>
                        </div>
                    )}
            </NBDialogBody>

            {/* Custom footer — action buttons, not standard cancel/submit */}
            {canProcess && !rejectMode && !sodMode && (
                <div className="border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-2.5 flex flex-col gap-2">
                    <Button
                        onClick={handleAccept}
                        disabled={loading}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-wider h-9 rounded-none"
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
                        className="w-full font-bold uppercase text-[10px] tracking-wider h-9 rounded-none"
                    >
                        <XCircle className="h-4 w-4 mr-2" />
                        Tolak Surat Jalan
                    </Button>
                </div>
            )}

            {!canProcess && (
                <div className="border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-2.5">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        className="w-full border border-zinc-300 dark:border-zinc-600 text-zinc-500 font-bold uppercase text-[10px] tracking-wider h-9 rounded-none"
                    >
                        Tutup
                    </Button>
                </div>
            )}
        </NBDialog>
    )
}
