"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import dynamic from "next/dynamic"
import { motion } from "framer-motion"
import { NotaKreditTab } from "@/components/finance/nota-kredit-tab"
import { TabContentSkeleton } from "@/components/ui/page-skeleton"
import { NB } from "@/lib/dialog-styles"
import { Banknote } from "lucide-react"
import { getARAgingReport } from "@/lib/actions/finance"
import { PendingApprovalSection } from "@/components/finance/pending-approval-section"
import { queryKeys } from "@/lib/query-keys"
import { CACHE_TIERS } from "@/lib/cache-tiers"

const PaymentsTab = dynamic(() => import("@/app/finance/payments/page"), {
    ssr: false,
    loading: () => <TabContentSkeleton kpiCells={3} />,
})

const tabs = [
    { value: "penerimaan", label: "Penerimaan" },
    { value: "nota-kredit", label: "Nota Kredit" },
] as const

const fmt = (n: number) => { const v = Number(n); return Number.isFinite(v) ? new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v) : "Rp 0" }

export function ReceivablesPageClient() {
    const searchParams = useSearchParams()
    const initialTab = searchParams.get("tab") || "penerimaan"
    const [activeTab, setActiveTab] = useState(initialTab)

    const { data: aging, isLoading } = useQuery({
        queryKey: queryKeys.arAging.all,
        queryFn: () => getARAgingReport(),
        ...CACHE_TIERS.TRANSACTIONAL,
    })
    const b = aging?.summary || { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 }
    const total = b.current + b.d1_30 + b.d31_60 + b.d61_90 + b.d90_plus

    return (
        <motion.div
            className="mf-page"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
        >
            {/* ─── Unified Page Header ─── */}
            <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring" as const, stiffness: 320, damping: 26 }}
                className={NB.pageCard}
            >
                <div className={NB.pageAccent} />

                {/* Row 1: Title + Tab Navigation */}
                <div className="px-5 py-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-orange-500 flex items-center justify-center">
                            <Banknote className="h-4.5 w-4.5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-base font-black uppercase tracking-wider text-zinc-900 dark:text-white">
                                Piutang Usaha (AR)
                            </h1>
                            <p className="text-zinc-400 text-[11px] font-medium">
                                Kelola penerimaan pembayaran dan nota kredit pelanggan
                            </p>
                        </div>
                    </div>

                    {/* Tab buttons — joined toolbar style */}
                    <div className="flex items-center gap-0">
                        {tabs.map((tab, idx) => (
                            <button
                                key={tab.value}
                                onClick={() => setActiveTab(tab.value)}
                                className={`h-9 px-4 text-[10px] font-black uppercase tracking-widest transition-all border rounded-none ${
                                    idx < tabs.length - 1 ? "border-r-0" : ""
                                } ${
                                    activeTab === tab.value
                                        ? "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white"
                                        : "bg-white dark:bg-zinc-900 text-zinc-400 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-600 dark:hover:text-zinc-300"
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Row 2: AR Aging KPI Strip */}
                {aging && (
                    <div className="border-t border-zinc-200 dark:border-zinc-700">
                        <div className={NB.kpiStrip}>
                            {[
                                { label: "Total", value: total, color: "text-zinc-900 dark:text-white" },
                                { label: "Belum Jatuh Tempo", value: b.current, color: "text-emerald-600" },
                                { label: "1-30 Hari", value: b.d1_30, color: "text-amber-600" },
                                { label: "31-60 Hari", value: b.d31_60, color: "text-orange-600" },
                                { label: "61-90 Hari", value: b.d61_90, color: "text-red-500" },
                                { label: ">90 Hari", value: b.d90_plus, color: "text-red-700" },
                            ].map((cell) => (
                                <div key={cell.label} className={NB.kpiCell}>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{cell.label}</span>
                                    <span className={`text-sm font-black font-mono ${cell.color}`}>{fmt(cell.value)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </motion.div>

            {/* ─── Pending Approval ─── */}
            {aging?.pending && aging.pending.length > 0 && (
                <PendingApprovalSection items={aging.pending} type="AR" />
            )}

            {/* ─── Tab Content ─── */}
            <div className="[&>.mf-page]:p-0 [&>.mf-page]:pt-0 [&>.mf-page]:bg-transparent">
                {activeTab === "penerimaan" && <PaymentsTab />}
                {activeTab === "nota-kredit" && <NotaKreditTab />}
            </div>
        </motion.div>
    )
}
