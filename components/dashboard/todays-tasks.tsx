"use client"

import Link from "next/link"
import {
    IconAlertTriangle,
    IconPackage,
    IconUsers,
    IconShoppingCart,
    IconChecklist,
    IconCircleCheck,
    IconClipboardList,
    IconArrowRight,
} from "@tabler/icons-react"
import { useSidebarActions } from "@/hooks/use-sidebar-actions"

interface TaskItem {
    id: string
    icon: React.ReactNode
    label: string
    count: number
    href: string
    priority: "urgent" | "warning" | "info"
}

const priorityOrder = { urgent: 0, warning: 1, info: 2 }

export function TodaysTasks() {
    const { data: counts, isLoading } = useSidebarActions()

    if (isLoading) {
        return (
            <div className="border-2 border-black bg-white dark:bg-zinc-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4">
                <div className="flex items-center gap-2 mb-3">
                    <div className="h-5 w-5 bg-zinc-200 dark:bg-zinc-700 rounded" />
                    <div className="h-5 w-32 bg-zinc-200 dark:bg-zinc-700 rounded" />
                </div>
                <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-10 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
                    ))}
                </div>
            </div>
        )
    }

    const tasks: TaskItem[] = []

    if (counts) {
        if (counts.lowStockProducts > 0) {
            tasks.push({
                id: "low-stock",
                icon: <IconAlertTriangle className="w-4 h-4 text-red-500" />,
                label: `${counts.lowStockProducts} produk stok rendah`,
                count: counts.lowStockProducts,
                href: "/inventory/alerts",
                priority: "urgent",
            })
        }
        if (counts.pendingApprovals > 0) {
            tasks.push({
                id: "pending-approvals",
                icon: <IconChecklist className="w-4 h-4 text-orange-500" />,
                label: `${counts.pendingApprovals} PO menunggu approval`,
                count: counts.pendingApprovals,
                href: "/procurement/orders",
                priority: "warning",
            })
        }
        if (counts.pendingPurchaseRequests > 0) {
            tasks.push({
                id: "pending-pr",
                icon: <IconShoppingCart className="w-4 h-4 text-orange-500" />,
                label: `${counts.pendingPurchaseRequests} purchase request menunggu`,
                count: counts.pendingPurchaseRequests,
                href: "/procurement/requests",
                priority: "warning",
            })
        }
        if (counts.vendorsIncomplete > 0) {
            tasks.push({
                id: "vendors-incomplete",
                icon: <IconUsers className="w-4 h-4 text-amber-500" />,
                label: `${counts.vendorsIncomplete} vendor data belum lengkap`,
                count: counts.vendorsIncomplete,
                href: "/procurement/vendors",
                priority: "info",
            })
        }
        if (counts.productsIncomplete > 0) {
            tasks.push({
                id: "products-incomplete",
                icon: <IconPackage className="w-4 h-4 text-amber-500" />,
                label: `${counts.productsIncomplete} produk data belum lengkap`,
                count: counts.productsIncomplete,
                href: "/inventory/products",
                priority: "info",
            })
        }
        if (counts.customersIncomplete > 0) {
            tasks.push({
                id: "customers-incomplete",
                icon: <IconUsers className="w-4 h-4 text-amber-500" />,
                label: `${counts.customersIncomplete} pelanggan data belum lengkap`,
                count: counts.customersIncomplete,
                href: "/sales/customers",
                priority: "info",
            })
        }
    }

    // Sort by priority: urgent first, then warning, then info
    tasks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

    const priorityColors = {
        urgent: "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800",
        warning: "bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800",
        info: "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800",
    }

    const badgeColors = {
        urgent: "bg-red-500",
        warning: "bg-orange-500",
        info: "bg-amber-500",
    }

    return (
        <div className="border-2 border-black bg-white dark:bg-zinc-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b-2 border-black">
                <IconClipboardList className="w-5 h-5 text-zinc-900 dark:text-zinc-100" />
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    Tugas Hari Ini
                </h3>
                {tasks.length > 0 && (
                    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-zinc-900 dark:bg-zinc-100 px-1.5 text-[10px] font-bold text-white dark:text-zinc-900 tabular-nums">
                        {tasks.length}
                    </span>
                )}
            </div>

            {/* Task list */}
            <div className="p-2">
                {tasks.length === 0 ? (
                    <div className="py-6 text-center">
                        <IconCircleCheck className="w-8 h-8 text-green-400 mx-auto mb-2" />
                        <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                            Semua beres!
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Tidak ada tugas mendesak hari ini
                        </p>
                    </div>
                ) : (
                    <div className="space-y-1.5">
                        {tasks.map((task) => (
                            <Link
                                key={task.id}
                                href={task.href}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded border transition-all hover:translate-x-0.5 hover:shadow-sm ${priorityColors[task.priority]}`}
                            >
                                <div className="shrink-0">{task.icon}</div>
                                <span className="flex-1 text-sm text-zinc-800 dark:text-zinc-200 font-medium">
                                    {task.label}
                                </span>
                                <span
                                    className={`shrink-0 flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white tabular-nums ${badgeColors[task.priority]}`}
                                >
                                    {task.count}
                                </span>
                                <IconArrowRight className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
