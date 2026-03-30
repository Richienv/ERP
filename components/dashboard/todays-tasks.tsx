"use client"

import { useState, useCallback, useRef } from "react"
import {
    IconAlertTriangle,
    IconPackage,
    IconUsers,
    IconShoppingCart,
    IconChecklist,
    IconCircleCheck,
    IconClipboardList,
    IconArrowRight,
    IconFileInvoice,
    IconX,
} from "@tabler/icons-react"
import { AnimatePresence, motion } from "framer-motion"
import { useSidebarActions } from "@/hooks/use-sidebar-actions"
import { TaskActionDialog, type TaskType } from "@/components/dashboard/task-action-dialog"

interface TaskItem {
    id: TaskType
    icon: React.ReactNode
    label: string
    count: number
    priority: "urgent" | "warning" | "info"
}

const priorityOrder = { urgent: 0, warning: 1, info: 2 }

export function TodaysTasks() {
    const { data: counts, isLoading } = useSidebarActions()
    const [activeTask, setActiveTask] = useState<TaskType | null>(null)
    const [completedTypes, setCompletedTypes] = useState<Set<TaskType>>(new Set())
    const [dismissedTypes, setDismissedTypes] = useState<Set<TaskType>>(new Set())
    const completedSnapshotsRef = useRef<Map<TaskType, TaskItem>>(new Map())
    const dismissTimersRef = useRef<Map<TaskType, ReturnType<typeof setTimeout>>>(new Map())

    const handleTaskActioned = useCallback((taskType: TaskType) => {
        setCompletedTypes(prev => new Set(prev).add(taskType))

        // Auto-dismiss completed task after 4 seconds
        const existing = dismissTimersRef.current.get(taskType)
        if (existing) clearTimeout(existing)
        const timer = setTimeout(() => {
            setDismissedTypes(prev => new Set(prev).add(taskType))
            dismissTimersRef.current.delete(taskType)
        }, 4000)
        dismissTimersRef.current.set(taskType, timer)
    }, [])

    const handleDismiss = useCallback((taskType: TaskType) => {
        const timer = dismissTimersRef.current.get(taskType)
        if (timer) clearTimeout(timer)
        dismissTimersRef.current.delete(taskType)
        setDismissedTypes(prev => new Set(prev).add(taskType))
    }, [])

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
                priority: "urgent",
            })
        }
        if (counts.pendingApprovals > 0) {
            tasks.push({
                id: "pending-approvals",
                icon: <IconChecklist className="w-4 h-4 text-orange-500" />,
                label: `${counts.pendingApprovals} PO menunggu approval`,
                count: counts.pendingApprovals,
                priority: "warning",
            })
        }
        if (counts.pendingPurchaseRequests > 0) {
            tasks.push({
                id: "pending-pr",
                icon: <IconShoppingCart className="w-4 h-4 text-orange-500" />,
                label: `${counts.pendingPurchaseRequests} purchase request menunggu`,
                count: counts.pendingPurchaseRequests,
                priority: "warning",
            })
        }
        if (counts.vendorsIncomplete > 0) {
            tasks.push({
                id: "vendors-incomplete",
                icon: <IconUsers className="w-4 h-4 text-amber-500" />,
                label: `${counts.vendorsIncomplete} vendor data belum lengkap`,
                count: counts.vendorsIncomplete,
                priority: "info",
            })
        }
        if (counts.productsIncomplete > 0) {
            tasks.push({
                id: "products-incomplete",
                icon: <IconPackage className="w-4 h-4 text-amber-500" />,
                label: `${counts.productsIncomplete} produk data belum lengkap`,
                count: counts.productsIncomplete,
                priority: "info",
            })
        }
        if (counts.customersIncomplete > 0) {
            tasks.push({
                id: "customers-incomplete",
                icon: <IconUsers className="w-4 h-4 text-amber-500" />,
                label: `${counts.customersIncomplete} pelanggan data belum lengkap`,
                count: counts.customersIncomplete,
                priority: "info",
            })
        }
        if (counts.pendingInvoices > 0) {
            tasks.push({
                id: "pending-invoices",
                icon: <IconFileInvoice className="w-4 h-4 text-orange-500" />,
                label: `${counts.pendingInvoices} invoice menunggu persetujuan`,
                count: counts.pendingInvoices,
                priority: "warning",
            })
        }
    }

    // Sort by priority: urgent first, then warning, then info
    tasks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

    // Snapshot fresh tasks so completed ghost entries can be preserved
    for (const task of tasks) {
        completedSnapshotsRef.current.set(task.id, { ...task })
    }

    // Re-add completed tasks whose count dropped to 0 after refetch
    for (const type of completedTypes) {
        if (!dismissedTypes.has(type) && !tasks.find(t => t.id === type)) {
            const snapshot = completedSnapshotsRef.current.get(type)
            if (snapshot) {
                tasks.push({ ...snapshot, count: 0 })
            }
        }
    }

    tasks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

    const visibleTasks = tasks.filter(t => !dismissedTypes.has(t.id))
    const activeTaskCount = visibleTasks.filter(t => !completedTypes.has(t.id)).length

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
                {activeTaskCount > 0 ? (
                    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-zinc-900 dark:bg-zinc-100 px-1.5 text-[10px] font-bold text-white dark:text-zinc-900 tabular-nums">
                        {activeTaskCount}
                    </span>
                ) : visibleTasks.length > 0 ? (
                    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-green-600 px-1.5 text-[10px] font-bold text-white tabular-nums">
                        ✓
                    </span>
                ) : null}
            </div>

            {/* Task list */}
            <div className="p-2">
                {visibleTasks.length === 0 ? (
                    <div className="py-6 text-center">
                        <IconCircleCheck className="w-8 h-8 text-green-400 mx-auto mb-2" />
                        <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                            {completedTypes.size > 0 ? "Semua tugas selesai!" : "Semua beres!"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Tidak ada tugas mendesak hari ini
                        </p>
                    </div>
                ) : (
                    <div className="space-y-1.5">
                        <AnimatePresence mode="popLayout">
                            {visibleTasks.map((task) => {
                                const isCompleted = completedTypes.has(task.id)
                                return (
                                    <motion.div
                                        key={task.id}
                                        layout
                                        initial={{ opacity: 1 }}
                                        exit={{
                                            opacity: 0,
                                            height: 0,
                                            marginBottom: 0,
                                            overflow: "hidden",
                                        }}
                                        transition={{ duration: 0.3, ease: "easeOut" }}
                                    >
                                        {isCompleted ? (
                                            <div className="w-full flex items-center gap-3 px-3 py-2.5 rounded border border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/30 opacity-60 transition-all">
                                                <IconCircleCheck className="w-4 h-4 text-green-500 shrink-0" />
                                                <span className="flex-1 text-sm text-zinc-400 dark:text-zinc-500 font-medium line-through">
                                                    {task.label}
                                                </span>
                                                <span className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase tracking-wider shrink-0">
                                                    Selesai
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDismiss(task.id)}
                                                    className="w-5 h-5 flex items-center justify-center rounded hover:bg-green-200/50 dark:hover:bg-green-800/50 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors shrink-0"
                                                    title="Hapus dari daftar"
                                                >
                                                    <IconX className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => setActiveTask(task.id)}
                                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded border transition-all hover:translate-x-0.5 hover:shadow-sm cursor-pointer text-left ${priorityColors[task.priority]}`}
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
                                            </button>
                                        )}
                                    </motion.div>
                                )
                            })}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            {/* Popup dialogs */}
            <TaskActionDialog
                taskType={activeTask}
                open={activeTask !== null}
                onClose={() => setActiveTask(null)}
                onTaskActioned={handleTaskActioned}
            />
        </div>
    )
}
