"use client"

import { useState } from "react"
import {
    Banknote,
    Receipt,
    CreditCard,
    Wallet,
    FileText,
    ChevronUp,
    Plus,
    History,
    Truck,
    AlertTriangle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatIDR } from "@/lib/utils"
import { useVendorPayments } from "@/hooks/use-vendor-payments"
import { useBills } from "@/hooks/use-bills"

type APTab = "bills" | "payments"

export default function AccountsPayablePage() {
    const [activeTab, setActiveTab] = useState<APTab>("bills")
    const { data: vpData, isLoading: vpLoading } = useVendorPayments()
    const { data: billsData, isLoading: billsLoading } = useBills()

    const payments = vpData?.payments ?? []
    const bills = (billsData as any)?.rows ?? []

    const totalPayments = payments.length
    const totalBills = bills.length
    const totalPaid = payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0)
    const totalOutstanding = bills
        .filter((b: any) => ['ISSUED', 'PARTIAL', 'OVERDUE'].includes(b.status))
        .reduce((sum: number, b: any) => sum + (b.balanceDue || 0), 0)
    const overdueCount = bills.filter((b: any) => b.isOverdue).length

    const loading = vpLoading || billsLoading

    const tabs: { key: APTab; label: string; icon: React.ReactNode; count: number }[] = [
        { key: "bills", label: "Tagihan Vendor", icon: <Receipt className="h-3.5 w-3.5" />, count: totalBills },
        { key: "payments", label: "Pembayaran AP", icon: <Banknote className="h-3.5 w-3.5" />, count: totalPayments },
    ]

    return (
        <div className="mf-page">

            {/* ═══ HEADER ═══ */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900">
                <div className="px-6 py-4 flex items-center justify-between border-l-[6px] border-l-red-400">
                    <div className="flex items-center gap-3">
                        <Truck className="h-5 w-5 text-red-500" />
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                                Accounts Payable
                            </h1>
                            <p className="text-zinc-400 text-xs font-medium mt-0.5">
                                Kelola tagihan vendor & pembayaran hutang
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══ KPI STRIP ═══ */}
            <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <div className="grid grid-cols-2 md:grid-cols-4">
                    <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800 border-b-2 md:border-b-0">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-red-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <Receipt className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Outstanding</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-red-600">{loading ? "..." : formatIDR(totalOutstanding)}</div>
                        <div className="text-[10px] font-bold text-red-600 mt-1">Hutang belum dibayar</div>
                    </div>
                    <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800 border-b-2 md:border-b-0">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <Banknote className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total Dibayar</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-emerald-600">{loading ? "..." : formatIDR(totalPaid)}</div>
                        <div className="text-[10px] font-bold text-emerald-600 mt-1">{totalPayments} pembayaran</div>
                    </div>
                    <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-blue-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <FileText className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Tagihan</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-blue-600">{loading ? "..." : totalBills}</div>
                        <div className="text-[10px] font-bold text-blue-600 mt-1">Total tagihan vendor</div>
                    </div>
                    <div className="relative p-4 md:p-5">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-amber-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Overdue</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-amber-600">{loading ? "..." : overdueCount}</div>
                        <div className="text-[10px] font-bold text-amber-600 mt-1">Jatuh tempo</div>
                    </div>
                </div>
            </div>

            {/* ═══ TAB SELECTOR ═══ */}
            <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <div className="px-4 py-3 flex items-center gap-3">
                    <div className="flex border-2 border-black">
                        {tabs.map((t) => (
                            <button
                                key={t.key}
                                onClick={() => setActiveTab(t.key)}
                                className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all border-r border-black last:border-r-0 flex items-center gap-1.5 whitespace-nowrap ${activeTab === t.key ? "bg-black text-white" : "bg-white text-zinc-400 hover:bg-zinc-50"
                                    }`}
                            >
                                {t.icon}
                                {t.label}
                                <span className={`text-[9px] px-1.5 py-0.5 border rounded-sm ml-1 ${activeTab === t.key ? "bg-white/20 border-white/30" : "bg-zinc-100 border-zinc-200"
                                    }`}>{t.count}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ═══ CONTENT ═══ */}
            {activeTab === "bills" && (
                <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                    <div className="px-4 py-3 border-b-2 border-black bg-zinc-50 dark:bg-zinc-800 flex items-center gap-2">
                        <Receipt className="h-4 w-4 text-zinc-500" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Tagihan Vendor</span>
                        <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-zinc-400">{totalBills} records</span>
                    </div>

                    {loading ? (
                        <div className="p-12 text-center">
                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 animate-pulse">Memuat...</p>
                        </div>
                    ) : bills.length === 0 ? (
                        <div className="p-12 text-center">
                            <Receipt className="h-8 w-8 mx-auto text-zinc-300 mb-2" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Belum ada tagihan vendor</p>
                        </div>
                    ) : (
                        <>
                            <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2 border-b border-zinc-200 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                <div className="col-span-2">No. Bill</div>
                                <div className="col-span-3">Vendor</div>
                                <div className="col-span-2">Status</div>
                                <div className="col-span-2 text-right">Jumlah</div>
                                <div className="col-span-1 text-right">Sisa</div>
                                <div className="col-span-2 text-right">Jatuh Tempo</div>
                            </div>
                            {bills.map((bill: any) => (
                                <div key={bill.id} className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-zinc-100 hover:bg-zinc-50 transition-colors items-center">
                                    <div className="col-span-2">
                                        <span className="font-mono text-xs font-bold text-zinc-500">{bill.number}</span>
                                    </div>
                                    <div className="col-span-3">
                                        <p className="font-bold text-sm truncate">{bill.vendor?.name || "-"}</p>
                                    </div>
                                    <div className="col-span-2">
                                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 border rounded-sm ${bill.status === 'PAID' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' :
                                            bill.isOverdue ? 'bg-red-50 border-red-200 text-red-600' :
                                                bill.status === 'PARTIAL' ? 'bg-amber-50 border-amber-200 text-amber-600' :
                                                    'bg-blue-50 border-blue-200 text-blue-600'
                                            }`}>{bill.isOverdue ? 'OVERDUE' : bill.status}</span>
                                    </div>
                                    <div className="col-span-2 text-right">
                                        <span className="font-mono font-bold text-sm">{formatIDR(bill.amount)}</span>
                                    </div>
                                    <div className="col-span-1 text-right">
                                        <span className="font-mono text-sm text-red-600">{formatIDR(bill.balanceDue)}</span>
                                    </div>
                                    <div className="col-span-2 text-right">
                                        <span className={`text-xs ${bill.isOverdue ? 'text-red-600 font-bold' : 'text-zinc-500'}`}>
                                            {bill.dueDate ? new Date(bill.dueDate).toLocaleDateString("id-ID") : "-"}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            )}

            {activeTab === "payments" && (
                <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                    <div className="px-4 py-3 border-b-2 border-black bg-zinc-50 dark:bg-zinc-800 flex items-center gap-2">
                        <History className="h-4 w-4 text-zinc-500" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Riwayat Pembayaran AP</span>
                        <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-zinc-400">{totalPayments} records</span>
                    </div>

                    <div className="px-4 py-2 border-b border-zinc-200 bg-zinc-50/50">
                        <p className="text-[10px] font-bold text-zinc-400">
                            Untuk membuat pembayaran baru, gunakan halaman <a href="/finance/vendor-payments" className="text-blue-600 underline font-black">Pembayaran AP</a> (termasuk otorisasi tanda tangan)
                        </p>
                    </div>

                    {loading ? (
                        <div className="p-12 text-center">
                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 animate-pulse">Memuat...</p>
                        </div>
                    ) : payments.length === 0 ? (
                        <div className="p-12 text-center">
                            <Banknote className="h-8 w-8 mx-auto text-zinc-300 mb-2" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Belum ada riwayat pembayaran</p>
                        </div>
                    ) : (
                        <>
                            <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2 border-b border-zinc-200 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                <div className="col-span-2">No.</div>
                                <div className="col-span-3">Vendor</div>
                                <div className="col-span-1 text-center">Metode</div>
                                <div className="col-span-2">Referensi</div>
                                <div className="col-span-2">Tanggal</div>
                                <div className="col-span-2 text-right">Jumlah</div>
                            </div>
                            {payments.map((p: any) => (
                                <div key={p.id} className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-zinc-100 hover:bg-zinc-50 transition-colors items-center">
                                    <div className="col-span-2">
                                        <span className="font-mono text-xs font-bold text-zinc-500">{p.number}</span>
                                    </div>
                                    <div className="col-span-3">
                                        <p className="font-bold text-sm truncate">{p.vendor?.name || "-"}</p>
                                    </div>
                                    <div className="col-span-1 text-center">
                                        <span className="text-[9px] font-black uppercase px-2 py-0.5 border border-zinc-300 bg-zinc-50">{p.method}</span>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="font-mono text-xs text-zinc-500">{p.reference || "-"}</span>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="text-xs text-zinc-500">{new Date(p.date).toLocaleDateString("id-ID")}</span>
                                    </div>
                                    <div className="col-span-2 text-right">
                                        <span className="font-mono font-bold text-sm text-red-600">- {formatIDR(p.amount)}</span>
                                    </div>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            )}
        </div>
    )
}
