"use client"

import { useState } from "react"
import { CheckCircle2, XCircle, Package, Loader2, Calendar, User, Warehouse, Printer, AlertTriangle } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { NB } from "@/lib/dialog-styles"
import {
    NBDialog,
    NBDialogHeader,
    NBDialogBody,
    NBSection,
    NBTextarea,
} from "@/components/ui/nb-dialog"
import { toast } from "sonner"
import { acceptGRN, rejectGRN } from "@/lib/actions/grn"
import { queryKeys } from "@/lib/query-keys"
import { StatusBadge } from "@/components/module"

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

    const invalidateAll = () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.receiving.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.procurementDashboard.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.inventoryDashboard.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.stockMovements.all })
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
                invalidateAll()
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
                invalidateAll()
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
                {/* ── Status + Print row ── */}
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Status</span>
                        <StatusBadge
                            status={grn.status}
                            variant={grn.status === "ACCEPTED" ? "approved" : grn.status === "INSPECTING" ? "production" : undefined}
                        />
                    </div>
                    {(grn.status === 'DRAFT' || grn.status === 'ACCEPTED') && (
                        <button
                            type="button"
                            className={NB.toolbarBtn + " flex items-center gap-1.5"}
                            onClick={() => window.open(`/api/documents/surat-jalan-masuk/${grn.id}?disposition=inline`, '_blank')}
                        >
                            <Printer className="h-3.5 w-3.5" />
                            Cetak Surat Jalan
                        </button>
                    )}
                </div>

                {/* ── Info Grid ── */}
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

                {/* ── Summary KPI ── */}
                <div className="grid grid-cols-3 gap-0 border-2 border-black overflow-hidden">
                    <div className="p-3 text-center border-r-2 border-black">
                        <div className="text-2xl font-black">{grn.itemCount}</div>
                        <div className="text-[10px] uppercase text-zinc-500 font-bold">Items</div>
                    </div>
                    <div className="p-3 text-center bg-emerald-50/50 border-r-2 border-black">
                        <div className="text-2xl font-black text-emerald-600">{grn.totalAccepted}</div>
                        <div className="text-[10px] uppercase text-emerald-600 font-bold">Diterima</div>
                    </div>
                    <div className="p-3 text-center bg-red-50/50">
                        <div className="text-2xl font-black text-red-600">{grn.totalRejected}</div>
                        <div className="text-[10px] uppercase text-red-600 font-bold">Ditolak</div>
                    </div>
                </div>

                {/* ── Items List ── */}
                <NBSection icon={Package} title="Detail Items">
                    <div className="space-y-2">
                        {grn.items.map((item) => (
                            <div key={item.id} className="bg-zinc-50 dark:bg-zinc-800/50 p-3 border border-zinc-200 dark:border-zinc-700">
                                <div className="flex justify-between items-start mb-1">
                                    <div>
                                        <div className="font-bold text-sm">{item.productName}</div>
                                        <div className="text-xs text-zinc-500 font-mono">{item.productCode}</div>
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

                {/* ── Notes ── */}
                {grn.notes && (
                    <NBSection icon={Package} title="Catatan" optional>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 p-3 border border-zinc-200 dark:border-zinc-700">
                            {grn.notes}
                        </p>
                    </NBSection>
                )}

                {/* ── Reject Mode ── */}
                {rejectMode && (
                    <div className="bg-red-50 dark:bg-red-950/20 p-4 border-2 border-red-300 dark:border-red-800 animate-in fade-in">
                        <NBTextarea
                            label="Alasan Penolakan"
                            required
                            placeholder="Mengapa Surat Jalan ini ditolak?"
                            value={rejectReason}
                            onChange={setRejectReason}
                        />
                        <div className="flex gap-3 mt-3 justify-end">
                            <button
                                type="button"
                                onClick={() => setRejectMode(false)}
                                className={NB.cancelBtn}
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                onClick={handleReject}
                                disabled={loading}
                                className={"bg-red-600 text-white border-2 border-red-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] hover:bg-red-700 hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)] active:translate-y-[4px] active:shadow-none transition-all font-black uppercase text-xs tracking-wider px-6 h-10 rounded-none flex items-center gap-1.5 disabled:opacity-50"}
                            >
                                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                Konfirmasi Tolak
                            </button>
                        </div>
                    </div>
                )}

                {/* ── SoD Warning & Override ── */}
                {sodMode && (
                    <div className="bg-amber-50 dark:bg-amber-950/20 p-4 border-2 border-amber-300 dark:border-amber-800 animate-in fade-in">
                        <div className="flex items-start gap-3 mb-3">
                            <div className="p-2 bg-amber-100 dark:bg-amber-900/50 border border-amber-300">
                                <AlertTriangle className="h-4 w-4 text-amber-600" />
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
                        <div className="flex gap-3 mt-3 justify-end">
                            <button
                                type="button"
                                onClick={() => { setSodMode(false); setSodReason(""); }}
                                className={NB.cancelBtn}
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                onClick={handleAccept}
                                disabled={loading}
                                className={NB.submitBtnOrange + " flex items-center gap-1.5 disabled:opacity-50"}
                            >
                                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                Konfirmasi & Terima
                            </button>
                        </div>
                    </div>
                )}
            </NBDialogBody>

            {/* ── NB Footer — action buttons with full shadow/press animation ── */}
            {canProcess && !rejectMode && !sodMode && (
                <div className="border-t-2 border-black bg-zinc-50 dark:bg-zinc-800/50 px-5 py-3 flex flex-col gap-2">
                    <button
                        type="button"
                        onClick={handleAccept}
                        disabled={loading}
                        className={NB.submitBtnGreen + " w-full flex items-center justify-center gap-2 disabled:opacity-50"}
                    >
                        {loading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <CheckCircle2 className="h-4 w-4" />
                        )}
                        Terima & Update Stok
                    </button>
                    <button
                        type="button"
                        onClick={() => setRejectMode(true)}
                        disabled={loading}
                        className={"w-full bg-red-600 text-white border-2 border-red-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] hover:bg-red-700 hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)] active:translate-y-[4px] active:shadow-none transition-all font-black uppercase text-xs tracking-wider h-11 rounded-none flex items-center justify-center gap-2 disabled:opacity-50"}
                    >
                        <XCircle className="h-4 w-4" />
                        Tolak Surat Jalan
                    </button>
                </div>
            )}

            {!canProcess && (
                <div className="border-t-2 border-black bg-zinc-50 dark:bg-zinc-800/50 px-5 py-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className={NB.cancelBtn + " w-full"}
                    >
                        Tutup
                    </button>
                </div>
            )}
        </NBDialog>
    )
}
