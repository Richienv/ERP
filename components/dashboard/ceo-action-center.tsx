"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    CheckCircle, XCircle, FileText, Loader2, AlertTriangle,
    ShieldAlert, Zap, ClipboardList, Plus, ArrowRight
} from "lucide-react"
import Link from "next/link"
import { formatIDR } from "@/lib/utils"
import { approvePurchaseOrder, rejectPurchaseOrder } from "@/lib/actions/procurement"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

interface PendingPO {
    id: string
    number: string
    supplier: { name: string; email: string | null; phone: string | null }
    totalAmount: number
    netAmount: number
    itemCount: number
    items: Array<{ productName: string; productCode: string; quantity: number }>
}

interface Alert {
    type: string
    title: string
    message: string
    impact?: string
    details?: string
    severity: string
    machine?: string
}

interface CeoActionCenterProps {
    pendingApproval: PendingPO[]
    activeCount: number
    alerts: Alert[]
    pendingLeaves: number
    totalPRs?: number
    pendingPRs?: number
    totalPOs?: number
    totalPOValue?: number
    poByStatus?: Record<string, number>
}

type Tab = "approvals" | "alerts" | "actions"

function formatCompact(value: number): string {
    if (value === 0) return "Rp 0"
    const abs = Math.abs(value)
    if (abs >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toFixed(1)}M`
    if (abs >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(1)}jt`
    if (abs >= 1_000) return `Rp ${(value / 1_000).toFixed(0)}rb`
    return `Rp ${value.toFixed(0)}`
}

export function CeoActionCenter({ pendingApproval, activeCount, alerts, pendingLeaves, totalPRs = 0, pendingPRs = 0, totalPOs = 0, totalPOValue = 0, poByStatus = {} }: CeoActionCenterProps) {
    const [activeTab, setActiveTab] = useState<Tab>("approvals")
    const [selectedPO, setSelectedPO] = useState<PendingPO | null>(null)
    const [rejectMode, setRejectMode] = useState(false)
    const [rejectReason, setRejectReason] = useState("")
    const [processing, setProcessing] = useState(false)
    const router = useRouter()

    const totalBadge = pendingApproval.length + alerts.length

    const handleApprove = async (po: PendingPO) => {
        setProcessing(true)
        try {
            const result = await approvePurchaseOrder(po.id)
            if (result.success) {
                toast.success(`PO ${po.number} disetujui`)
                setSelectedPO(null)
                router.refresh()
            } else {
                toast.error(result.error || "Gagal menyetujui")
            }
        } catch {
            toast.error("Error saat menyetujui PO")
        } finally {
            setProcessing(false)
        }
    }

    const handleReject = async () => {
        if (!selectedPO || !rejectReason.trim()) {
            toast.error("Berikan alasan penolakan")
            return
        }
        setProcessing(true)
        try {
            const result = await rejectPurchaseOrder(selectedPO.id, rejectReason)
            if (result.success) {
                toast.success(`PO ${selectedPO.number} ditolak`)
                setSelectedPO(null)
                setRejectMode(false)
                setRejectReason("")
                router.refresh()
            } else {
                toast.error(result.error || "Gagal menolak")
            }
        } catch {
            toast.error("Error saat menolak PO")
        } finally {
            setProcessing(false)
        }
    }

    const tabs: { key: Tab; label: string; count: number }[] = [
        { key: "approvals", label: "Persetujuan", count: pendingApproval.length },
        { key: "alerts", label: "Peringatan", count: alerts.length },
        { key: "actions", label: "Aksi Cepat", count: 0 },
    ]

    return (
        <>
            <div className="h-full flex flex-col bg-white dark:bg-zinc-900 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                {/* Header */}
                <div className="flex-none bg-amber-400 dark:bg-amber-500 px-4 py-3 border-b-2 border-black">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <ShieldAlert className="h-5 w-5 text-black" />
                            <h3 className="text-sm font-black uppercase tracking-widest text-black">Pusat Aksi</h3>
                        </div>
                        {totalBadge > 0 && (
                            <span className="bg-black text-white text-[10px] font-black px-2 py-0.5 min-w-[20px] text-center">
                                {totalBadge}
                            </span>
                        )}
                    </div>
                </div>

                {/* Tab Bar */}
                <div className="flex-none flex border-b-2 border-black">
                    {tabs.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex-1 px-2 py-2 text-[10px] font-black uppercase tracking-wider transition-all relative
                                ${activeTab === tab.key
                                    ? "bg-black text-white"
                                    : "bg-white dark:bg-zinc-900 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                }
                                ${tab.key !== "actions" ? "border-r-2 border-black" : ""}
                            `}
                        >
                            {tab.label}
                            {tab.count > 0 && (
                                <span className={`ml-1 inline-flex items-center justify-center px-1 min-w-[16px] h-4 text-[9px] font-black rounded-full
                                    ${activeTab === tab.key ? "bg-amber-400 text-black" : "bg-red-500 text-white"}
                                `}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <ScrollArea className="flex-1 min-h-0">
                    <div className="p-3">
                        {/* Approvals Tab */}
                        {activeTab === "approvals" && (
                            <div className="space-y-2">
                                {/* PR/PO Summary Strip */}
                                {(totalPRs > 0 || totalPOs > 0) && (
                                    <div className="grid grid-cols-3 gap-1.5 mb-3">
                                        <Link href="/procurement/requests" className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-2 text-center hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">
                                            <div className="text-lg font-black text-blue-900 dark:text-blue-300">{totalPRs}</div>
                                            <div className="text-[9px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">Total PR</div>
                                            {pendingPRs > 0 && <div className="text-[9px] font-bold text-amber-600 mt-0.5">{pendingPRs} pending</div>}
                                        </Link>
                                        <Link href="/procurement/orders" className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-2 text-center hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors">
                                            <div className="text-lg font-black text-emerald-900 dark:text-emerald-300">{totalPOs}</div>
                                            <div className="text-[9px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Total PO</div>
                                            <div className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">{activeCount} aktif</div>
                                        </Link>
                                        <div className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-2 text-center">
                                            <div className="text-sm font-black text-zinc-900 dark:text-zinc-100">{formatCompact(totalPOValue)}</div>
                                            <div className="text-[9px] font-black uppercase tracking-wider text-zinc-500">Nilai PO</div>
                                        </div>
                                    </div>
                                )}

                                {pendingApproval.length > 0 ? (
                                    pendingApproval.map((po) => (
                                        <button
                                            key={po.id}
                                            onClick={() => setSelectedPO(po)}
                                            className="w-full text-left bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-300 dark:border-amber-800 p-3
                                                       hover:translate-x-[1px] hover:translate-y-[1px] transition-all active:scale-[0.98]"
                                        >
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="font-mono text-[10px] font-black text-amber-900 dark:text-amber-300">{po.number}</span>
                                                <span className="text-xs font-black text-black dark:text-white">{formatIDR(po.netAmount)}</span>
                                            </div>
                                            <div className="text-xs font-bold text-amber-800 dark:text-amber-400">{po.supplier.name}</div>
                                            <div className="text-[10px] text-amber-600 dark:text-amber-500 mt-0.5">{po.itemCount} item</div>
                                        </button>
                                    ))
                                ) : (
                                    <div className="text-center py-4">
                                        <CheckCircle className="h-8 w-8 mx-auto text-emerald-400 mb-2" />
                                        <p className="text-xs font-black uppercase tracking-wide text-zinc-400">Semua Beres</p>
                                        <p className="text-[10px] text-zinc-400 mt-1">Tidak ada persetujuan yang menunggu</p>
                                    </div>
                                )}
                                <Link href="/dashboard/approvals">
                                    <div className="text-center py-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-black dark:hover:text-white transition-colors">
                                        Lihat Semua <ArrowRight className="h-3 w-3 inline ml-1" />
                                    </div>
                                </Link>
                            </div>
                        )}

                        {/* Alerts Tab */}
                        {activeTab === "alerts" && (
                            <div className="space-y-2">
                                {alerts.length > 0 ? (
                                    alerts.map((alert, i) => (
                                        <div
                                            key={i}
                                            className="border-2 border-black p-3 bg-white dark:bg-zinc-900"
                                        >
                                            <div className="flex items-start gap-2">
                                                <AlertTriangle className={`h-4 w-4 mt-0.5 flex-none ${
                                                    alert.severity === "critical" ? "text-red-500" : "text-amber-500"
                                                }`} />
                                                <div className="min-w-0">
                                                    <p className="text-xs font-black uppercase tracking-wide truncate">{alert.title}</p>
                                                    <p className="text-[10px] text-zinc-500 mt-0.5 line-clamp-2">{alert.message}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-8">
                                        <CheckCircle className="h-8 w-8 mx-auto text-emerald-400 mb-2" />
                                        <p className="text-xs font-black uppercase tracking-wide text-zinc-400">Aman</p>
                                        <p className="text-[10px] text-zinc-400 mt-1">Tidak ada peringatan aktif</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Quick Actions Tab */}
                        {activeTab === "actions" && (
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { label: "Buat PO", icon: ClipboardList, href: "/procurement/orders", color: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800" },
                                    { label: "Buat Invoice", icon: FileText, href: "/finance/invoices", color: "bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800" },
                                    { label: "Buat WO", icon: Zap, href: "/manufacturing/work-orders", color: "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800" },
                                    { label: "Laporan", icon: FileText, href: "/reports", color: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800" },
                                ].map((action) => (
                                    <Link key={action.label} href={action.href}>
                                        <div className={`border-2 ${action.color} p-3 text-center hover:translate-x-[1px] hover:translate-y-[1px] transition-all active:scale-[0.98]`}>
                                            <action.icon className="h-5 w-5 mx-auto mb-1.5 text-zinc-700 dark:text-zinc-300" />
                                            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300">{action.label}</span>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </div>

            {/* PO Approval Dialog */}
            <Dialog open={!!selectedPO} onOpenChange={() => { setSelectedPO(null); setRejectMode(false); setRejectReason("") }}>
                <DialogContent className="max-w-2xl border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-none p-0 overflow-hidden">
                    <DialogHeader className="bg-black text-white px-6 pt-6 pb-4">
                        <DialogTitle className="flex items-center gap-2 text-xl font-black uppercase tracking-tight text-white">
                            <FileText className="h-5 w-5" />
                            Persetujuan Purchase Order
                        </DialogTitle>
                        <DialogDescription className="text-zinc-400 font-medium text-xs uppercase tracking-wide">
                            Tinjau dan setujui atau tolak purchase order ini
                        </DialogDescription>
                    </DialogHeader>

                    {selectedPO && (
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4 bg-zinc-50 dark:bg-zinc-800 p-4 border-2 border-black">
                                <div>
                                    <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500">No. PO</div>
                                    <div className="font-mono font-bold">{selectedPO.number}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Vendor</div>
                                    <div className="font-bold">{selectedPO.supplier.name}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total</div>
                                    <div className="font-black text-lg">{formatIDR(selectedPO.netAmount)}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Item</div>
                                    <div className="font-bold">{selectedPO.itemCount} item</div>
                                </div>
                            </div>

                            {/* Items */}
                            <div>
                                <div className="bg-black text-white p-2 text-[10px] font-black uppercase tracking-widest">Detail Item</div>
                                <div className="border-2 border-t-0 border-black max-h-40 overflow-y-auto">
                                    {selectedPO.items.map((item, idx) => (
                                        <div key={idx} className={`px-3 py-2 flex justify-between ${idx % 2 === 0 ? "bg-white dark:bg-zinc-900" : "bg-zinc-50 dark:bg-zinc-800"}`}>
                                            <div>
                                                <div className="font-medium text-sm">{item.productName}</div>
                                                <div className="text-[10px] text-zinc-400 font-mono">{item.productCode}</div>
                                            </div>
                                            <div className="text-sm font-bold">{item.quantity} pcs</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {rejectMode && (
                                <div className="bg-red-50 dark:bg-red-950/30 border-2 border-red-300 dark:border-red-800 p-4 space-y-2">
                                    <label className="text-sm font-black text-red-900 dark:text-red-300 uppercase">Alasan Penolakan</label>
                                    <Textarea
                                        placeholder="Berikan alasan yang jelas..."
                                        value={rejectReason}
                                        onChange={(e) => setRejectReason(e.target.value)}
                                        className="min-h-[80px] border-2 border-black"
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    <DialogFooter className="px-6 py-4 border-t-2 border-black gap-2 bg-zinc-50 dark:bg-zinc-800">
                        {!rejectMode ? (
                            <>
                                <Button
                                    variant="outline"
                                    onClick={() => setRejectMode(true)}
                                    disabled={processing}
                                    className="border-2 border-red-500 text-red-700 hover:bg-red-50 font-black uppercase text-xs tracking-wide"
                                >
                                    <XCircle className="h-4 w-4 mr-2" />
                                    Tolak
                                </Button>
                                <Button
                                    onClick={() => selectedPO && handleApprove(selectedPO)}
                                    disabled={processing}
                                    className="bg-black text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-black uppercase text-xs tracking-wide active:scale-[0.98]"
                                >
                                    {processing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                                    Setujui
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button variant="ghost" onClick={() => { setRejectMode(false); setRejectReason("") }} disabled={processing} className="font-bold">
                                    Batal
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={handleReject}
                                    disabled={processing || !rejectReason.trim()}
                                    className="font-black uppercase text-xs tracking-wide"
                                >
                                    {processing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
                                    Konfirmasi Tolak
                                </Button>
                            </>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
