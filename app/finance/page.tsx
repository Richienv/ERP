"use client"

import { FinanceMetricCard } from "@/components/finance/finance-metric-card"
import { ActionItemsWidget } from "@/components/finance/action-items-widget"
import { CashFlowChart } from "@/components/finance/cash-flow-chart"
import { DollarSign, Wallet, CreditCard, Activity, ArrowUpRight, FileText, PiggyBank, Scale } from "lucide-react"

export default function FinanceDashboardPage() {
    return (
        <div className="p-6 md:p-8 space-y-8 bg-zinc-50/50 dark:bg-black min-h-screen">

            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-serif font-bold text-zinc-900 dark:text-zinc-50">Keuangan & Akuntansi</h1>
                    <p className="text-muted-foreground mt-1">Gambaran umum posisi keuangan, arus kas, dan tugas akuntansi.</p>
                </div>
                <div className="flex gap-3">
                    <button className="px-4 py-2 bg-white dark:bg-zinc-900 border border-border/50 rounded-xl text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-sm">
                        Laporan Cepat
                    </button>
                    <button className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-2">
                        <Scale size={16} /> Entri Jurnal Baru
                    </button>
                </div>
            </div>

            {/* KPI Cards Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <FinanceMetricCard
                    title="Posisi Kas (Cash on Hand)"
                    value="Rp 2.45M"
                    trend="+12% vs bln lalu"
                    trendUp={true}
                    icon={Wallet}
                    color="emerald"
                />
                <FinanceMetricCard
                    title="Piutang Usaha (AR)"
                    value="Rp 850jt"
                    trend="+5% vs bln lalu"
                    trendUp={false} // increasing AR might be bad or neutral, keeping consistent
                    description="12 Invoice Overdue"
                    icon={FileText}
                    color="blue"
                />
                <FinanceMetricCard
                    title="Utang Usaha (AP)"
                    value="Rp 340jt"
                    trend="-2% vs bln lalu"
                    trendUp={true} // decreasing AP is good
                    description="5 Bill Jatuh Tempo"
                    icon={CreditCard}
                    color="rose"
                />
                <FinanceMetricCard
                    title="Laba Bersih (YTD)"
                    value="Rp 1.2M"
                    trend="+18% vs thn lalu"
                    trendUp={true}
                    icon={PiggyBank}
                    color="amber"
                />
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Left Column: Cash Flow & Analysis (2/3 width) */}
                <div className="lg:col-span-2 space-y-8">
                    <CashFlowChart />

                    {/* Recent Transactions / Quick Ledger View could go here */}
                    <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-serif text-lg font-medium">Transaksi Terakhir</h3>
                            <button className="text-sm text-primary hover:underline">Lihat Jurnal Umum</button>
                        </div>
                        <div className="space-y-4">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-transparent hover:border-border/50 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                            <DollarSign size={18} />
                                        </div>
                                        <div>
                                            <p className="font-medium text-foreground">Pembayaran Invoice #INV-2024-001</p>
                                            <p className="text-xs text-muted-foreground">PT. Maju Mundur • BCA Corporate</p>
                                        </div>
                                    </div>
                                    <span className="font-mono font-medium text-emerald-600">+ Rp 145.000.000</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Column: Action Items & Shortcuts (1/3 width) */}
                <div className="space-y-8">
                    <ActionItemsWidget />

                    {/* Quick Shortcuts */}
                    <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
                        <h3 className="font-serif text-lg font-medium mb-4">Akses Cepat</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <button className="p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-left flex flex-col gap-2 group">
                                <FileText className="w-5 h-5 text-blue-500 group-hover:scale-110 transition-transform" />
                                <span className="text-xs font-medium">Buat Invoice</span>
                            </button>
                            <button className="p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-left flex flex-col gap-2 group">
                                <CreditCard className="w-5 h-5 text-rose-500 group-hover:scale-110 transition-transform" />
                                <span className="text-xs font-medium">Catat Bill</span>
                            </button>
                            <button className="p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-left flex flex-col gap-2 group">
                                <Activity className="w-5 h-5 text-amber-500 group-hover:scale-110 transition-transform" />
                                <span className="text-xs font-medium">Rekonsiliasi</span>
                            </button>
                            <button className="p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-left flex flex-col gap-2 group">
                                <ArrowUpRight className="w-5 h-5 text-emerald-500 group-hover:scale-110 transition-transform" />
                                <span className="text-xs font-medium">Transfer Kas</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
