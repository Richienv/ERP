export const dynamic = 'force-dynamic'

import Link from "next/link"
import { FinanceMetricCard } from "@/components/finance/finance-metric-card"
import { ActionItemsWidget } from "@/components/finance/action-items-widget"
import { CashFlowChart } from "@/components/finance/cash-flow-chart"
import { AccountingModuleActions } from "@/components/finance/accounting-module-actions"
import { DollarSign, Wallet, CreditCard, Activity, ArrowUpRight, FileText, PiggyBank, Scale } from "lucide-react"
import { getFinancialMetrics, getFinanceDashboardData } from "@/lib/actions/finance"
import { formatCompactNumber, formatIDR } from "@/lib/utils"

export default async function FinanceDashboardPage() {
    const [metrics, dashboardData] = await Promise.all([
        getFinancialMetrics(),
        getFinanceDashboardData(),
    ])

    return (
        <div className="p-6 md:p-8 space-y-8 bg-zinc-50/50 dark:bg-black min-h-screen">

            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-serif font-bold text-zinc-900 dark:text-zinc-50">Keuangan & Akuntansi</h1>
                    <p className="text-muted-foreground mt-1">Gambaran umum posisi keuangan, arus kas, dan tugas akuntansi.</p>
                </div>
                <div className="flex gap-3">
                    <Link href="/finance/reports" className="px-4 py-2 bg-white dark:bg-zinc-900 border border-border/50 rounded-xl text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-sm inline-flex items-center">
                        Laporan Cepat
                    </Link>
                    <Link href="/finance/journal" className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-2">
                        <Scale size={16} /> Entri Jurnal Baru
                    </Link>
                </div>
            </div>

            <AccountingModuleActions />

            {/* KPI Cards Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <FinanceMetricCard
                    title="Posisi Kas (Cash on Hand)"
                    value={`Rp ${formatCompactNumber(metrics.cashBalance)}`}
                    trend="+12% vs bln lalu"
                    trendUp={true}
                    icon={Wallet}
                    color="emerald"
                />
                <FinanceMetricCard
                    title="Piutang Usaha (AR)"
                    value={`Rp ${formatCompactNumber(metrics.receivables)}`}
                    trend="+5% vs bln lalu"
                    trendUp={false} // increasing AR might be bad or neutral, keeping consistent
                    description="From Unpaid Invoices"
                    icon={FileText}
                    color="blue"
                />
                <FinanceMetricCard
                    title="Utang Usaha (AP)"
                    value={`Rp ${formatCompactNumber(metrics.payables)}`}
                    trend="-2% vs bln lalu"
                    trendUp={true} // decreasing AP is good
                    description="From Unpaid Bills"
                    icon={CreditCard}
                    color="rose"
                />
                <FinanceMetricCard
                    title="Laba Bersih (YTD)"
                    value={`${metrics.netMargin}%`}
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
                    <CashFlowChart data={dashboardData.cashFlow} />

                    {/* Recent Transactions / Quick Ledger View could go here */}
                    <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-serif text-lg font-medium">Transaksi Terakhir</h3>
                            <Link href="/finance/journal" className="text-sm text-primary hover:underline">Lihat Jurnal Umum</Link>
                        </div>
                        <div className="space-y-4">
                            {dashboardData.recentTransactions.length === 0 ? (
                                <div className="p-4 rounded-xl bg-muted/30 border border-dashed border-border/60 text-sm text-muted-foreground">
                                    Belum ada transaksi terbaru.
                                </div>
                            ) : dashboardData.recentTransactions.map((item) => (
                                <Link key={item.id} href={item.href} className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-transparent hover:border-border/50 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                            <DollarSign size={18} />
                                        </div>
                                        <div>
                                            <p className="font-medium text-foreground">{item.title}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {item.subtitle} • {new Date(item.date).toLocaleDateString('id-ID')}
                                            </p>
                                        </div>
                                    </div>
                                    <span className={`font-mono font-medium ${item.direction === 'in' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {item.direction === 'in' ? '+' : '-'} {formatIDR(item.amount)}
                                    </span>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Column: Action Items & Shortcuts (1/3 width) */}
                <div className="space-y-8">
                    <ActionItemsWidget actions={dashboardData.actionItems} />

                    {/* Quick Shortcuts */}
                    <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
                        <h3 className="font-serif text-lg font-medium mb-4">Akses Cepat</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <Link href="/finance/invoices" className="p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-left flex flex-col gap-2 group">
                                <FileText className="w-5 h-5 text-blue-500 group-hover:scale-110 transition-transform" />
                                <span className="text-xs font-medium">Buat Invoice</span>
                            </Link>
                            <Link href="/finance/bills" className="p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-left flex flex-col gap-2 group">
                                <CreditCard className="w-5 h-5 text-rose-500 group-hover:scale-110 transition-transform" />
                                <span className="text-xs font-medium">Catat Bill</span>
                            </Link>
                            <Link href="/finance/reports" className="p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-left flex flex-col gap-2 group">
                                <Activity className="w-5 h-5 text-amber-500 group-hover:scale-110 transition-transform" />
                                <span className="text-xs font-medium">Rekonsiliasi</span>
                            </Link>
                            <Link href="/finance/vendor-payments" className="p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-left flex flex-col gap-2 group">
                                <ArrowUpRight className="w-5 h-5 text-emerald-500 group-hover:scale-110 transition-transform" />
                                <span className="text-xs font-medium">Transfer Kas</span>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
