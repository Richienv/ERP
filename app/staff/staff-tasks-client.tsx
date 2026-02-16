"use client"

import { useState, useTransition, useMemo } from "react"
import { useRouter } from "next/navigation"
import { TaskCard } from "@/components/staff/task-card"
import type { StaffTaskDTO } from "@/lib/actions/tasks"
import { startTask, completeTask, reportTaskIssue } from "@/lib/actions/tasks"
import { toast } from "sonner"
import {
    Factory,
    ClipboardCheck,
    Truck,
    Wrench,
} from "lucide-react"

const SHIFT_LABELS: Record<string, string> = {
    MORNING: "Shift Pagi",
    AFTERNOON: "Shift Siang",
    NIGHT: "Shift Malam",
}

const TAB_CONFIG = [
    { key: "production", label: "Produksi", icon: Factory, color: "bg-indigo-100 text-indigo-900 border-indigo-400" },
    { key: "quality", label: "Kualitas", icon: ClipboardCheck, color: "bg-teal-100 text-teal-900 border-teal-400" },
    { key: "warehouse", label: "Gudang", icon: Truck, color: "bg-amber-100 text-amber-900 border-amber-400" },
    { key: "maintenance", label: "Teknisi", icon: Wrench, color: "bg-red-100 text-red-900 border-red-400" },
] as const

interface StaffTasksClientProps {
    tasks: StaffTaskDTO[]
    employee: {
        id: string
        name: string
        department: string
        position: string
        shiftType: string | null
    }
}

export function StaffTasksClient({ tasks: initialTasks, employee }: StaffTasksClientProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [activeTab, setActiveTab] = useState<string>("production")

    const filteredTasks = useMemo(() => {
        return initialTasks.filter((t) => t.type === activeTab)
    }, [initialTasks, activeTab])

    const tabCounts = useMemo(() => {
        const counts: Record<string, number> = {}
        for (const tab of TAB_CONFIG) {
            counts[tab.key] = initialTasks.filter((t) => t.type === tab.key && t.status !== "completed").length
        }
        return counts
    }, [initialTasks])

    const handleStart = async (id: string) => {
        const result = await startTask(id)
        if (result.success) {
            toast.success("Tugas dimulai")
            startTransition(() => router.refresh())
        } else {
            toast.error(result.error || "Gagal memulai tugas")
        }
    }

    const handleComplete = async (id: string) => {
        const result = await completeTask(id)
        if (result.success) {
            toast.success("Tugas selesai")
            startTransition(() => router.refresh())
        } else {
            toast.error(result.error || "Gagal menyelesaikan tugas")
        }
    }

    const handleReport = async (id: string, issueData?: { category: string; location: string; description: string }) => {
        const result = await reportTaskIssue(id, issueData || {
            category: "other",
            location: "",
            description: "Kendala dilaporkan oleh staf",
        })
        if (result.success) {
            toast.success("Kendala dilaporkan")
            startTransition(() => router.refresh())
        } else {
            toast.error(result.error || "Gagal melaporkan kendala")
        }
    }

    const today = new Date().toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
    })

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-xl font-black uppercase tracking-wider">
                    Halo, {employee.name}
                </h1>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                    {SHIFT_LABELS[employee.shiftType || ""] || employee.position} — {today}
                </p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1">
                {TAB_CONFIG.map((tab) => {
                    const Icon = tab.icon
                    const isActive = activeTab === tab.key
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-1.5 px-4 py-2.5 border-2 border-black text-[10px] font-black uppercase tracking-wider transition-all shrink-0 ${
                                isActive
                                    ? `${tab.color} shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`
                                    : "bg-white hover:bg-zinc-50"
                            }`}
                        >
                            <Icon className="h-3.5 w-3.5" />
                            {tab.label}
                            {tabCounts[tab.key] > 0 && (
                                <span className={`ml-1 px-1.5 py-0.5 text-[8px] font-black border border-black ${
                                    isActive ? "bg-white text-black" : "bg-black text-white"
                                }`}>
                                    {tabCounts[tab.key]}
                                </span>
                            )}
                        </button>
                    )
                })}
            </div>

            {/* Task Grid */}
            {filteredTasks.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredTasks.map((task) => (
                        <TaskCard
                            key={task.id}
                            task={task}
                            onStart={handleStart}
                            onComplete={handleComplete}
                            onReport={handleReport}
                        />
                    ))}
                </div>
            ) : (
                <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-8 text-center">
                    <ClipboardCheck className="h-8 w-8 mx-auto text-zinc-200 mb-2" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                        Tidak ada tugas aktif untuk kategori ini
                    </span>
                </div>
            )}
        </div>
    )
}
