"use client"

import { DashboardView } from "@/components/dashboard/dashboard-view"
import { GreetingBar } from "@/components/dashboard/greeting-bar"
import { ModuleCard, CardMetric, StatBlock, ProgressBar, SectionDivider } from "@/components/dashboard/module-card"
import { TodaysTasks } from "@/components/dashboard/todays-tasks"
import { CompactActivityFeed } from "@/components/dashboard/compact-activity-feed"
import { useExecutiveDashboard } from "@/hooks/use-executive-dashboard"
import { CardPageSkeleton } from "@/components/ui/page-skeleton"
import { formatCurrency } from "@/lib/utils"
import Link from "next/link"
import {
    IconShoppingCart,
    IconTruck,
    IconPackage,
    IconTool,
    IconUsers,
    IconCheck,
    IconX,
    IconAlertTriangle,
    IconPlayerPlay,
    IconSettings,
    IconAlertCircle,
    IconClock,
    IconArrowRight,
    IconReceipt,
    IconBuildingWarehouse,
    IconFileInvoice,
    IconCalendarDue,
    IconCoin,
    IconUserCheck,
    IconMoodSad,
    IconGauge,
    IconCircleCheck,
    IconCircleX,
    IconProgressCheck,
} from "@tabler/icons-react"

/** Only render a CardMetric if value is non-zero / non-"Rp 0" / non-"0" */
function NonZeroMetric({ label, value, alert, sub }: { label: string; value: string; alert?: boolean; sub?: string }) {
    // Hide if the display value is effectively zero
    if (value === "0" || value === "Rp 0" || value === "0%" || value === "Rp0") return null
    return <CardMetric label={label} value={value} alert={alert} sub={sub} />
}

/** Only render StatBlock if value is meaningful */
function NonZeroStat({ label, value, accent, icon }: { label: string; value: string; accent: string; icon?: React.ReactNode }) {
    if (value === "0" || value === "0%" || value === "Rp 0") return null
    return <StatBlock label={label} value={value} accent={accent} icon={icon} />
}

export default function DashboardPage() {
    const { data, isLoading } = useExecutiveDashboard()

    if (isLoading || !data) {
        return <CardPageSkeleton accentColor="bg-zinc-700" />
    }

    const { financials, operations, sales, hr, activity, tax: taxFromRoot } = data
    const tax = taxFromRoot ?? operations?.tax ?? { ppnOut: 0, ppnIn: 0, ppnNet: 0 }

    const pendingApprovals = (operations?.procurement?.pendingApproval?.length ?? 0) + (operations?.procurement?.pendingPRs ?? 0)
    const lowStockCount = operations?.materialStatus?.length ?? 0
    const overdueCount = financials?.overdueInvoices?.length ?? 0
    const pendingPOs = operations?.procurement?.pendingApproval ?? []
    const overdueInvoices = financials?.overdueInvoices ?? []
    const upcomingPayables = financials?.upcomingPayables ?? []
    const recentInvoices = financials?.recentInvoices ?? []
    const activityFeed = activity?.activityFeed ?? []
    const executiveAlerts = activity?.executiveAlerts ?? []
    const warehouses = operations?.inventoryValue?.warehouses ?? []
    const topEmployees = operations?.workforceStatus?.topEmployees ?? []
    const lateEmployees = hr?.lateEmployees ?? []
    const pendingLeaves = operations?.leaves ?? 0
    const poByStatus = operations?.procurement?.poByStatus ?? {}

    // Manufacturing
    const mfg = data?.manufacturing
    const woActive = mfg?.workOrders?.inProgress ?? operations?.prodMetrics?.activeWorkOrders ?? 0
    const woTotal = mfg?.workOrders?.total ?? 0
    const woCompletedMonth = mfg?.workOrders?.completedThisMonth ?? 0
    const productionActual = mfg?.workOrders?.productionThisMonth ?? operations?.prodMetrics?.totalProduction ?? 0
    const productionPlanned = mfg?.workOrders?.plannedThisMonth ?? 0
    const efficiency = mfg?.productionHealth?.performance ?? operations?.prodMetrics?.efficiency ?? 0
    const oee = mfg?.productionHealth?.oee ?? 0
    const qualityRate = mfg?.quality?.passRate ?? (operations?.qualityStatus?.passRate === -1 ? 0 : (operations?.qualityStatus?.passRate ?? 0))
    const machineTotal = mfg?.machines?.total ?? 0
    const machineRunning = mfg?.machines?.running ?? 0
    const machineIdle = mfg?.machines?.idle ?? 0
    const machineMaint = mfg?.machines?.maintenance ?? 0
    const machineBreakdown = mfg?.machines?.breakdown ?? 0
    const machineHealth = mfg?.machines?.avgHealth ?? 0
    const mfgRecentOrders = mfg?.recentOrders ?? []
    const mfgAlerts = mfg?.alerts ?? []
    const mfgRecentInspections = mfg?.quality?.recentInspections ?? []

    // Helpers
    const hasMfgData = woTotal > 0 || machineTotal > 0 || mfgRecentOrders.length > 0
    const totalPOs = operations?.procurement?.totalPOs ?? 0
    const totalPRs = operations?.procurement?.totalPRs ?? 0
    const hasProcData = totalPOs > 0 || totalPRs > 0 || pendingPOs.length > 0
    const totalStaff = operations?.workforceStatus?.totalStaff ?? 0
    const presentCount = operations?.workforceStatus?.presentCount ?? 0
    const lateCount = operations?.workforceStatus?.lateCount ?? 0
    const hasFinData = (financials?.cashBalance ?? 0) > 0 || recentInvoices.length > 0 || overdueCount > 0 || upcomingPayables.length > 0 || (tax?.ppnOut ?? 0) > 0

    const statusColors: Record<string, string> = {
        PAID: "text-emerald-600 bg-emerald-50",
        ISSUED: "text-blue-600 bg-blue-50",
        PARTIAL: "text-amber-600 bg-amber-50",
        OVERDUE: "text-red-600 bg-red-50",
        DRAFT: "text-zinc-500 bg-zinc-100",
    }

    // Filter poByStatus to only non-zero entries
    const nonZeroPoStatus = Object.entries(poByStatus).filter(([, count]) => Number(count) > 0)

    return (
        <DashboardView
            heroSlot={
                <GreetingBar
                    revenueMTD={sales?.totalRevenue ?? 0}
                    receivables={financials?.receivables ?? 0}
                    payables={financials?.payables ?? 0}
                    overdueCount={overdueCount}
                    pendingApprovals={pendingApprovals}
                />
            }
            alertSlot={
                executiveAlerts.length > 0 ? (
                    <div className="mt-3 border-2 border-red-400 bg-red-50 dark:bg-red-950/30 px-4 py-2.5 flex items-center gap-3 overflow-x-auto">
                        <IconAlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                        <div className="flex items-center gap-4 text-[11px] font-bold text-red-700 dark:text-red-300 whitespace-nowrap">
                            {(executiveAlerts as any[]).slice(0, 4).map((alert: any, i: number) => (
                                <span key={i} className="flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full shrink-0" />
                                    {alert.title || alert.message || String(alert)}
                                </span>
                            ))}
                        </div>
                    </div>
                ) : null
            }
            gridSlot={
                <div className="mt-4 space-y-3">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

                        {/* ═══ COLUMN 1: Penjualan + Inventori ═══ */}
                        <div className="space-y-3">

                            {/* PENJUALAN */}
                            <ModuleCard title="Penjualan" icon={IconShoppingCart} href="/sales/orders" accentColor="bg-cyan-600">
                                {/* Only show stats that have real data */}
                                {((sales?.activeOrders ?? 0) > 0 || (sales?.totalRevenue ?? 0) > 0) && (
                                    <div className="flex flex-wrap gap-4 py-1 justify-center">
                                        <NonZeroStat label="Pesanan Aktif" value={String(sales?.activeOrders ?? 0)} accent="text-cyan-600" />
                                        <NonZeroStat label="Revenue" value={formatCurrency(sales?.totalRevenue ?? 0)} accent="text-emerald-600" />
                                        {(operations?.salesFulfillment?.fulfillmentRate ?? 0) > 0 && (
                                            <StatBlock label="Fulfillment" value={`${operations.salesFulfillment.fulfillmentRate}%`} accent="text-blue-600" />
                                        )}
                                    </div>
                                )}

                                {(operations?.salesFulfillment?.totalOrders ?? 0) > 0 && (
                                    <ProgressBar
                                        value={operations?.salesFulfillment?.deliveredOrders ?? 0}
                                        max={operations?.salesFulfillment?.totalOrders ?? 1}
                                        color="bg-cyan-500"
                                        label="Fulfillment Rate"
                                    />
                                )}

                                {sales?.recentOrders?.length > 0 && (
                                    <>
                                        <SectionDivider label="Pesanan Terbaru" />
                                        <div className="space-y-1">
                                            {(sales.recentOrders as any[]).slice(0, 4).map((order: any) => (
                                                <Link key={order.id} href="/sales/orders" className="flex items-center justify-between text-[11px] hover:bg-zinc-50 dark:hover:bg-zinc-800 -mx-1 px-2 py-1.5 transition-colors group">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full shrink-0" />
                                                        <span className="text-zinc-600 dark:text-zinc-400 truncate">{order.customer}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-black text-zinc-900 dark:text-zinc-100 tabular-nums">{formatCurrency(order.amount)}</span>
                                                        <IconArrowRight className="w-3 h-3 text-zinc-300 group-hover:text-zinc-500 transition-colors" />
                                                    </div>
                                                </Link>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </ModuleCard>

                            {/* INVENTORI */}
                            <ModuleCard
                                title="Inventori"
                                icon={IconPackage}
                                href="/inventory"
                                accentColor="bg-violet-600"
                                badge={lowStockCount > 0 ? lowStockCount : undefined}
                                badgeColor="bg-red-500"
                            >
                                <div className="grid grid-cols-2 gap-x-4">
                                    <NonZeroMetric label="Nilai Stok" value={formatCurrency(operations?.inventoryValue?.value ?? 0)} />
                                    <CardMetric label="Total SKU" value={String(operations?.inventorySummary?.productCount ?? 0)} />
                                    <CardMetric label="Gudang Aktif" value={String(operations?.inventorySummary?.warehouseCount ?? 0)} />
                                    {lowStockCount > 0 && <CardMetric label="Stok Rendah" value={String(lowStockCount)} alert />}
                                </div>

                                {warehouses.length > 0 && (
                                    <>
                                        <SectionDivider label="Per Gudang" />
                                        <div className="space-y-1">
                                            {(warehouses as any[]).slice(0, 3).map((wh: any, i: number) => (
                                                <div key={i} className="flex items-center justify-between text-[11px] px-1 py-1">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <IconBuildingWarehouse className="w-3 h-3 text-violet-400 shrink-0" />
                                                        <span className="text-zinc-600 dark:text-zinc-400 truncate">{wh.name}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] text-zinc-400 tabular-nums">{wh.productCount} SKU</span>
                                                        {wh.value > 0 && <span className="font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">{formatCurrency(wh.value)}</span>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}

                                {lowStockCount > 0 && (
                                    <>
                                        <SectionDivider label="Perlu Restock" />
                                        <div className="space-y-1">
                                            {(operations.materialStatus as any[]).slice(0, 3).map((item: any, i: number) => (
                                                <div key={i} className="flex items-center gap-2 text-[11px] px-1 py-1">
                                                    <IconAlertTriangle className="w-3 h-3 text-red-500 shrink-0" />
                                                    <span className="text-zinc-600 dark:text-zinc-400 truncate flex-1">{item.name || item.product || `Item ${i + 1}`}</span>
                                                    <span className="font-bold text-red-600 tabular-nums">{item.current ?? item.qty ?? 0}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </ModuleCard>
                        </div>

                        {/* ═══ COLUMN 2: Pengadaan + Manufaktur ═══ */}
                        <div className="space-y-3">

                            {/* PENGADAAN */}
                            <ModuleCard
                                title="Pengadaan"
                                icon={IconTruck}
                                href="/procurement/orders"
                                accentColor="bg-amber-600"
                                badge={pendingPOs.length > 0 ? pendingPOs.length : undefined}
                                badgeColor="bg-orange-500"
                            >
                                {hasProcData && (
                                    <div className="grid grid-cols-2 gap-x-4">
                                        {totalPOs > 0 && <CardMetric label="Total PO" value={String(totalPOs)} sub={`${operations?.procurement?.activeCount ?? 0} aktif`} />}
                                        {(operations?.procurement?.totalPOValue ?? 0) > 0 && <CardMetric label="Nilai PO" value={formatCurrency(operations.procurement.totalPOValue)} />}
                                        {totalPRs > 0 && <CardMetric label="Total PR" value={String(totalPRs)} sub={`${operations?.procurement?.pendingPRs ?? 0} pending`} />}
                                        {(operations?.procurement?.totalPRValue ?? 0) > 0 && <CardMetric label="Nilai PR" value={formatCurrency(operations.procurement.totalPRValue)} />}
                                    </div>
                                )}

                                {nonZeroPoStatus.length > 0 && (
                                    <>
                                        <SectionDivider label="Status PO" />
                                        <div className="flex flex-wrap gap-1.5">
                                            {nonZeroPoStatus.slice(0, 5).map(([status, count]) => (
                                                <span key={status} className="inline-flex items-center gap-1 px-2 py-0.5 border border-zinc-200 dark:border-zinc-700 text-[10px] font-bold text-zinc-600 dark:text-zinc-400">
                                                    {String(status).replace(/_/g, " ")} <span className="font-black text-zinc-900 dark:text-zinc-100">{String(count)}</span>
                                                </span>
                                            ))}
                                        </div>
                                    </>
                                )}

                                {pendingPOs.length > 0 && (
                                    <>
                                        <SectionDivider label="Menunggu Persetujuan" />
                                        <div className="space-y-2">
                                            {pendingPOs.slice(0, 2).map((po: any) => (
                                                <div key={po.id} className="border-2 border-zinc-200 dark:border-zinc-700 p-2.5 space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <span className="text-[12px] font-black text-zinc-900 dark:text-zinc-100">{po.number}</span>
                                                            <p className="text-[10px] text-zinc-500 truncate">{po.supplier?.name} · {po.itemCount} item</p>
                                                        </div>
                                                        <span className="text-[13px] font-black tabular-nums text-zinc-900 dark:text-zinc-100">{formatCurrency(po.totalAmount)}</span>
                                                    </div>
                                                    <div className="flex gap-1.5">
                                                        <Link href="/procurement/orders" className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-emerald-600 border-2 border-black text-white text-[10px] font-black hover:bg-emerald-700 transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                                            <IconCheck className="w-3 h-3" /> Setujui
                                                        </Link>
                                                        <Link href="/procurement/orders" className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-white dark:bg-zinc-800 border-2 border-black text-red-600 text-[10px] font-black hover:bg-red-50 transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                                            <IconX className="w-3 h-3" /> Tolak
                                                        </Link>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </ModuleCard>

                            {/* MANUFAKTUR */}
                            <ModuleCard
                                title="Manufaktur"
                                icon={IconTool}
                                href="/manufacturing"
                                accentColor="bg-orange-600"
                                badge={machineBreakdown > 0 ? machineBreakdown : undefined}
                                badgeColor="bg-red-600"
                            >
                                {/* Hero stats — only show non-zero */}
                                {hasMfgData && (
                                    <div className="flex flex-wrap gap-4 py-1 justify-center">
                                        {oee > 0 && (
                                            <StatBlock
                                                label="OEE"
                                                value={`${oee}%`}
                                                accent={oee >= 75 ? "text-emerald-600" : oee >= 50 ? "text-amber-600" : "text-red-600"}
                                                icon={<IconGauge className="w-3.5 h-3.5 text-orange-500" />}
                                            />
                                        )}
                                        {woActive > 0 && <StatBlock label="WO Aktif" value={String(woActive)} accent="text-orange-600" />}
                                        {efficiency > 0 && <StatBlock label="Efisiensi" value={`${efficiency}%`} accent="text-blue-600" />}
                                        {qualityRate > 0 && <StatBlock label="Quality" value={`${qualityRate}%`} accent={qualityRate >= 90 ? "text-emerald-600" : "text-red-600"} />}
                                    </div>
                                )}

                                {/* Production progress — only if there's planned work */}
                                {productionPlanned > 0 && (
                                    <ProgressBar
                                        value={productionActual}
                                        max={productionPlanned}
                                        color={efficiency >= 80 ? "bg-emerald-500" : efficiency >= 50 ? "bg-amber-500" : "bg-red-500"}
                                        label={`Produksi Bulan Ini (${productionActual} / ${productionPlanned})`}
                                    />
                                )}

                                {/* Machine Status Grid — only if machines exist */}
                                {machineTotal > 0 && (
                                    <>
                                        <SectionDivider label="Status Mesin" />
                                        <div className="grid grid-cols-4 gap-1.5">
                                            <div className="flex flex-col items-center py-1.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                                                <span className="text-[13px] font-black text-emerald-600 tabular-nums">{machineRunning}</span>
                                                <span className="text-[8px] font-bold uppercase tracking-wider text-emerald-500">Running</span>
                                            </div>
                                            <div className="flex flex-col items-center py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                                                <span className="text-[13px] font-black text-zinc-600 tabular-nums">{machineIdle}</span>
                                                <span className="text-[8px] font-bold uppercase tracking-wider text-zinc-400">Idle</span>
                                            </div>
                                            <div className="flex flex-col items-center py-1.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                                                <span className="text-[13px] font-black text-amber-600 tabular-nums">{machineMaint}</span>
                                                <span className="text-[8px] font-bold uppercase tracking-wider text-amber-500">Maint.</span>
                                            </div>
                                            <div className={`flex flex-col items-center py-1.5 border ${machineBreakdown > 0 ? "bg-red-50 dark:bg-red-950/20 border-red-300 dark:border-red-800" : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"}`}>
                                                <span className={`text-[13px] font-black tabular-nums ${machineBreakdown > 0 ? "text-red-600 animate-pulse" : "text-zinc-400"}`}>{machineBreakdown}</span>
                                                <span className={`text-[8px] font-bold uppercase tracking-wider ${machineBreakdown > 0 ? "text-red-500" : "text-zinc-400"}`}>Down</span>
                                            </div>
                                        </div>
                                        {machineHealth > 0 && (
                                            <ProgressBar
                                                value={machineHealth}
                                                max={100}
                                                color={machineHealth >= 80 ? "bg-emerald-500" : machineHealth >= 60 ? "bg-amber-500" : "bg-red-500"}
                                                label="Kesehatan Mesin (avg)"
                                            />
                                        )}
                                    </>
                                )}

                                {/* WO Pipeline — only if WOs exist */}
                                {woTotal > 0 && (
                                    <>
                                        <SectionDivider label="Work Order Pipeline" />
                                        <div className="grid grid-cols-2 gap-x-4">
                                            <CardMetric label="Total WO" value={String(woTotal)} />
                                            {woCompletedMonth > 0 && <CardMetric label="Selesai (Bulan)" value={String(woCompletedMonth)} />}
                                        </div>
                                    </>
                                )}

                                {/* Recent WOs */}
                                {mfgRecentOrders.length > 0 && (
                                    <>
                                        <SectionDivider label="Work Order Terbaru" />
                                        <div className="space-y-1.5">
                                            {(mfgRecentOrders as any[]).slice(0, 4).map((wo: any) => (
                                                <Link key={wo.id} href="/manufacturing/orders" className="block hover:bg-zinc-50 dark:hover:bg-zinc-800 -mx-1 px-2 py-1.5 transition-colors">
                                                    <div className="flex items-center justify-between text-[11px]">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <IconProgressCheck className="w-3 h-3 text-orange-400 shrink-0" />
                                                            <span className="text-zinc-900 dark:text-zinc-100 font-bold truncate">{wo.number}</span>
                                                        </div>
                                                        <span className={`text-[9px] font-black px-1.5 py-0.5 ${
                                                            wo.status === "COMPLETED" ? "text-emerald-600 bg-emerald-50" :
                                                            wo.status === "IN_PROGRESS" ? "text-blue-600 bg-blue-50" :
                                                            "text-zinc-500 bg-zinc-100"
                                                        }`}>
                                                            {wo.status?.replace(/_/g, " ")}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between mt-0.5">
                                                        <span className="text-[10px] text-zinc-500 truncate">{wo.product}</span>
                                                        <span className="text-[10px] font-bold text-zinc-600 tabular-nums">{wo.actualQty}/{wo.plannedQty} ({wo.progress}%)</span>
                                                    </div>
                                                    {wo.plannedQty > 0 && (
                                                        <div className="mt-1 h-1.5 bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                                                            <div
                                                                className={`h-full transition-all ${wo.progress >= 100 ? "bg-emerald-500" : wo.progress >= 50 ? "bg-blue-500" : "bg-orange-500"}`}
                                                                style={{ width: `${Math.min(wo.progress ?? 0, 100)}%` }}
                                                            />
                                                        </div>
                                                    )}
                                                </Link>
                                            ))}
                                        </div>
                                    </>
                                )}

                                {/* Quality Inspections */}
                                {mfgRecentInspections.length > 0 && (
                                    <>
                                        <SectionDivider label="Inspeksi Terakhir" />
                                        <div className="space-y-1">
                                            {(mfgRecentInspections as any[]).slice(0, 3).map((insp: any, i: number) => (
                                                <div key={insp.id || i} className="flex items-center justify-between text-[11px] px-1 py-1">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        {insp.status === "PASS"
                                                            ? <IconCircleCheck className="w-3 h-3 text-emerald-500 shrink-0" />
                                                            : <IconCircleX className="w-3 h-3 text-red-500 shrink-0" />}
                                                        <span className="text-zinc-600 dark:text-zinc-400 truncate">{insp.material || insp.batchNumber}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {insp.inspector && <span className="text-[10px] text-zinc-400">{insp.inspector}</span>}
                                                        <span className={`font-black tabular-nums ${insp.status === "PASS" ? "text-emerald-600" : "text-red-600"}`}>
                                                            {insp.score ? `${Number(insp.score).toFixed(0)}%` : insp.status}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}

                                {/* Alerts */}
                                {mfgAlerts.length > 0 && (
                                    <>
                                        <SectionDivider label="Peringatan" />
                                        <div className="space-y-1">
                                            {(mfgAlerts as any[]).map((alert: any, i: number) => (
                                                <div key={i} className={`flex items-center gap-2 text-[11px] px-2 py-1.5 border ${
                                                    alert.type === "error" ? "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800" : "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800"
                                                }`}>
                                                    <IconAlertTriangle className={`w-3 h-3 shrink-0 ${alert.type === "error" ? "text-red-500" : "text-amber-500"}`} />
                                                    <span className={`font-semibold ${alert.type === "error" ? "text-red-700 dark:text-red-300" : "text-amber-700 dark:text-amber-300"}`}>
                                                        {alert.message}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </ModuleCard>
                        </div>

                        {/* ═══ COLUMN 3: Keuangan + SDM + Tugas ═══ */}
                        <div className="space-y-3">

                            {/* KEUANGAN — only if there's actual financial data */}
                            {hasFinData && (
                                <ModuleCard
                                    title="Keuangan"
                                    icon={IconCoin}
                                    href="/finance/invoices"
                                    accentColor="bg-emerald-600"
                                    badge={overdueCount > 0 ? overdueCount : undefined}
                                    badgeColor="bg-red-500"
                                >
                                    <div className="grid grid-cols-2 gap-x-4">
                                        <NonZeroMetric label="Kas" value={formatCurrency(financials?.cashBalance ?? 0)} />
                                        <NonZeroMetric label="Kas Masuk Bersih" value={formatCurrency(financials?.netCashIn ?? 0)} />
                                        <NonZeroMetric label="PPN Keluar" value={formatCurrency(tax?.ppnOut ?? 0)} />
                                        <NonZeroMetric label="PPN Masuk" value={formatCurrency(tax?.ppnIn ?? 0)} />
                                    </div>

                                    {recentInvoices.length > 0 && (
                                        <>
                                            <SectionDivider label="Invoice Terakhir" />
                                            <div className="space-y-1">
                                                {(recentInvoices as any[]).slice(0, 3).map((inv: any, i: number) => (
                                                    <Link key={inv.id || i} href="/finance/invoices" className="flex items-center justify-between text-[11px] hover:bg-zinc-50 dark:hover:bg-zinc-800 -mx-1 px-2 py-1.5 transition-colors">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <IconFileInvoice className="w-3 h-3 text-emerald-400 shrink-0" />
                                                            <span className="text-zinc-600 dark:text-zinc-400 truncate">{inv.customer || inv.number}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-[9px] font-black px-1.5 py-0.5 ${statusColors[inv.status] ?? "text-zinc-500 bg-zinc-100"}`}>
                                                                {inv.status}
                                                            </span>
                                                            <span className="font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">{formatCurrency(inv.total ?? 0)}</span>
                                                        </div>
                                                    </Link>
                                                ))}
                                            </div>
                                        </>
                                    )}

                                    {overdueCount > 0 && (
                                        <>
                                            <SectionDivider label="Invoice Overdue" />
                                            <div className="space-y-1">
                                                {overdueInvoices.slice(0, 3).map((inv: any, i: number) => (
                                                    <Link key={i} href="/finance/invoices" className="flex items-center justify-between text-[11px] hover:bg-red-50 dark:hover:bg-red-950/20 -mx-1 px-2 py-1.5 transition-colors">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <IconClock className="w-3 h-3 text-red-400 shrink-0" />
                                                            <span className="text-zinc-600 dark:text-zinc-400 truncate">{inv.customer || inv.number || `INV-${i + 1}`}</span>
                                                        </div>
                                                        <span className="font-black text-red-600 tabular-nums">{formatCurrency(inv.amount ?? 0)}</span>
                                                    </Link>
                                                ))}
                                            </div>
                                        </>
                                    )}

                                    {upcomingPayables.length > 0 && (
                                        <>
                                            <SectionDivider label="Tagihan Mendatang" />
                                            <div className="space-y-1">
                                                {(upcomingPayables as any[]).slice(0, 3).map((bill: any, i: number) => (
                                                    <div key={i} className="flex items-center justify-between text-[11px] px-1 py-1">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <IconCalendarDue className="w-3 h-3 text-amber-400 shrink-0" />
                                                            <span className="text-zinc-600 dark:text-zinc-400 truncate">{bill.supplier || bill.vendor || bill.number || `Bill-${i + 1}`}</span>
                                                        </div>
                                                        <span className="font-bold text-amber-600 tabular-nums">{formatCurrency(bill.amount ?? bill.total ?? 0)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </ModuleCard>
                            )}

                            {/* SDM — only show metrics that have data */}
                            {totalStaff > 0 && (
                                <ModuleCard
                                    title="SDM"
                                    icon={IconUsers}
                                    href="/hcm"
                                    accentColor="bg-blue-600"
                                    badge={lateCount > 0 ? lateCount : undefined}
                                    badgeColor="bg-amber-500"
                                >
                                    <div className="grid grid-cols-2 gap-x-4">
                                        <CardMetric label="Total Karyawan" value={String(totalStaff)} />
                                        {presentCount > 0 && <CardMetric label="Hadir" value={String(presentCount)} />}
                                        {lateCount > 0 && <CardMetric label="Terlambat" value={String(lateCount)} alert />}
                                        {(hr?.totalSalary ?? 0) > 0 && <CardMetric label="Gaji (Est.)" value={formatCurrency(hr.totalSalary)} />}
                                    </div>

                                    {presentCount > 0 && (
                                        <ProgressBar
                                            value={presentCount}
                                            max={totalStaff}
                                            color="bg-blue-500"
                                            label="Kehadiran Hari Ini"
                                        />
                                    )}

                                    {pendingLeaves > 0 && (
                                        <div className="mt-1.5 flex items-center gap-2 px-2 py-1.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-[11px]">
                                            <IconCalendarDue className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                            <span className="text-amber-700 dark:text-amber-300 font-semibold">{pendingLeaves} pengajuan cuti menunggu</span>
                                            <Link href="/hcm" className="ml-auto text-[10px] font-black text-amber-600 hover:text-amber-800">Review →</Link>
                                        </div>
                                    )}

                                    {topEmployees.length > 0 && (
                                        <>
                                            <SectionDivider label="Kehadiran Terbaik" />
                                            <div className="space-y-1">
                                                {(topEmployees as any[]).slice(0, 3).map((emp: any, i: number) => (
                                                    <div key={i} className="flex items-center justify-between text-[11px] px-1 py-1">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <IconUserCheck className="w-3 h-3 text-blue-400 shrink-0" />
                                                            <span className="text-zinc-600 dark:text-zinc-400 truncate">{emp.name}</span>
                                                        </div>
                                                        <span className="font-bold text-emerald-600 tabular-nums">{emp.attendance ?? emp.rate ?? "100%"}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}

                                    {lateEmployees.length > 0 && (
                                        <>
                                            <SectionDivider label="Terlambat Hari Ini" />
                                            <div className="space-y-1">
                                                {(lateEmployees as any[]).slice(0, 3).map((emp: any, i: number) => (
                                                    <div key={i} className="flex items-center justify-between text-[11px] px-1 py-1">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <IconMoodSad className="w-3 h-3 text-amber-500 shrink-0" />
                                                            <span className="text-zinc-600 dark:text-zinc-400 truncate">{emp.name}</span>
                                                        </div>
                                                        {(emp.lateBy || emp.time) && <span className="font-bold text-amber-600 text-[10px]">{emp.lateBy || emp.time}</span>}
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </ModuleCard>
                            )}

                            {/* TUGAS HARI INI */}
                            <div className="[&>div]:h-full [&>div]:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                <TodaysTasks />
                            </div>
                        </div>
                    </div>

                    {/* ═══ FULL-WIDTH: Activity Feed — only if there are activities ═══ */}
                    {activityFeed.length > 0 && (
                        <div className="[&>div]:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                            <CompactActivityFeed activities={activityFeed} />
                        </div>
                    )}
                </div>
            }
        />
    )
}
