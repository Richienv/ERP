"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { Scale, FileText } from "lucide-react"
import { NB } from "@/lib/dialog-styles"
import { formatIDR } from "@/lib/utils"
import { getOpeningBalanceSummary } from "@/lib/actions/finance-gl"
import { OpeningBalancesGL } from "@/components/finance/opening-balances-gl"
import { OpeningBalancesAPAR } from "@/components/finance/opening-balances-apar"

/* ─── Animation variants ─── */
const stagger = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.07 } },
}
const fadeUp = {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 320, damping: 26 } },
}

export default function OpeningBalancesPage() {
    const searchParams = useSearchParams()
    const initialTab = searchParams.get("tab") || "gl"
    const [activeTab, setActiveTab] = useState(initialTab)
    const [summary, setSummary] = useState<Awaited<ReturnType<typeof getOpeningBalanceSummary>> | null>(null)

    useEffect(() => {
        getOpeningBalanceSummary().then(setSummary)
    }, [activeTab])

    return (
        <motion.div
            className="mf-page"
            variants={stagger}
            initial="hidden"
            animate="show"
        >
            {/* ─── Unified Page Header ─── */}
            <motion.div variants={fadeUp} className={NB.pageCard}>
                <div className={NB.pageAccent} />

                {/* Row 1: Title */}
                <div className={`px-5 py-3.5 flex items-center justify-between ${NB.pageRowBorder}`}>
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-orange-500 flex items-center justify-center">
                            <Scale className="h-4.5 w-4.5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-base font-black uppercase tracking-wider text-zinc-900 dark:text-white">
                                Saldo Awal
                            </h1>
                            <p className="text-zinc-400 text-[11px] font-medium">
                                Input saldo awal GL, hutang vendor (AP), dan piutang pelanggan (AR) untuk migrasi data
                            </p>
                        </div>
                    </div>
                </div>

                {/* Row 2: KPI strip — dynamic */}
                <div className={`flex items-center divide-x divide-zinc-200 dark:divide-zinc-800 ${NB.pageRowBorder}`}>
                    <div className="flex-1 px-4 py-3 flex items-center justify-between gap-3 cursor-default">
                        <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 ${summary?.glPosted ? "bg-emerald-500" : "bg-amber-500"}`} />
                            <span className={NB.kpiLabel}>Saldo GL</span>
                        </div>
                        <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                            {summary?.glPosted ? `${summary.glAccountCount} akun` : "Belum diposting"}
                        </span>
                    </div>
                    <div className="flex-1 px-4 py-3 flex items-center justify-between gap-3 cursor-default">
                        <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 ${summary && summary.apCount > 0 ? "bg-red-500" : "bg-zinc-300"}`} />
                            <span className={NB.kpiLabel}>Hutang (AP)</span>
                        </div>
                        <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                            {summary && summary.apCount > 0 ? `${summary.apCount} bill — ${formatIDR(summary.apTotal)}` : "Belum ada"}
                        </span>
                    </div>
                    <div className="flex-1 px-4 py-3 flex items-center justify-between gap-3 cursor-default">
                        <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 ${summary && summary.arCount > 0 ? "bg-blue-500" : "bg-zinc-300"}`} />
                            <span className={NB.kpiLabel}>Piutang (AR)</span>
                        </div>
                        <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                            {summary && summary.arCount > 0 ? `${summary.arCount} invoice — ${formatIDR(summary.arTotal)}` : "Belum ada"}
                        </span>
                    </div>
                </div>

                {/* Row 3: Tab bar (inside the card) */}
                <div className={NB.filterBar}>
                    <div className="flex items-center gap-0">
                        <button
                            onClick={() => setActiveTab("gl")}
                            className={`flex items-center gap-1.5 h-9 px-4 border text-[10px] font-bold uppercase tracking-wider rounded-none transition-all ${
                                activeTab === "gl"
                                    ? "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white"
                                    : "border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 border-r-0"
                            }`}
                        >
                            <Scale className="h-3.5 w-3.5" />
                            Saldo GL
                        </button>
                        <button
                            onClick={() => setActiveTab("apar")}
                            className={`flex items-center gap-1.5 h-9 px-4 border text-[10px] font-bold uppercase tracking-wider rounded-none transition-all ${
                                activeTab === "apar"
                                    ? "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white"
                                    : "border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                            }`}
                        >
                            <FileText className="h-3.5 w-3.5" />
                            Saldo AP/AR
                        </button>
                    </div>
                    <span className="hidden md:inline text-[11px] font-medium text-zinc-400">
                        {activeTab === "gl" ? "Jurnal saldo awal buku besar" : "Invoice saldo awal hutang/piutang"}
                    </span>
                </div>
            </motion.div>

            {/* ─── Tab Content ─── */}
            <motion.div variants={fadeUp}>
                {activeTab === "gl" ? <OpeningBalancesGL /> : <OpeningBalancesAPAR />}
            </motion.div>
        </motion.div>
    )
}
