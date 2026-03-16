"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import dynamic from "next/dynamic"
import { motion } from "framer-motion"
import { NotaDebitTab } from "@/components/finance/nota-debit-tab"
import { TabContentSkeleton } from "@/components/ui/page-skeleton"
import { NB } from "@/lib/dialog-styles"
import { Receipt } from "lucide-react"

const BillsTab = dynamic(() => import("@/app/finance/bills/page"), {
    ssr: false,
    loading: () => <TabContentSkeleton kpiCells={3} />,
})
const VendorPaymentsTab = dynamic(() => import("@/app/finance/vendor-payments/page"), {
    ssr: false,
    loading: () => <TabContentSkeleton kpiCells={3} />,
})

const tabs = [
    { value: "tagihan", label: "Tagihan" },
    { value: "pembayaran", label: "Pembayaran" },
    { value: "nota-debit", label: "Nota Debit" },
] as const

export default function PayablesPage() {
    const searchParams = useSearchParams()
    const initialTab = searchParams.get("tab") || "tagihan"
    const [activeTab, setActiveTab] = useState(initialTab)

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
                            <Receipt className="h-4.5 w-4.5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-base font-black uppercase tracking-wider text-zinc-900 dark:text-white">
                                Hutang Usaha (AP)
                            </h1>
                            <p className="text-zinc-400 text-[11px] font-medium">
                                Kelola tagihan vendor, pembayaran, dan nota debit
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
            </motion.div>

            {/* ─── Tab Content ─── */}
            <div className="[&>.mf-page]:p-0 [&>.mf-page]:pt-0 [&>.mf-page]:bg-transparent">
                {activeTab === "tagihan" && <BillsTab />}
                {activeTab === "pembayaran" && <VendorPaymentsTab />}
                {activeTab === "nota-debit" && <NotaDebitTab />}
            </div>
        </motion.div>
    )
}
