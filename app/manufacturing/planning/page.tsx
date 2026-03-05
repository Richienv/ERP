"use client"

import { useState } from "react"
import { useMfgPlanning } from "@/hooks/use-mfg-planning"
import { PlanningClient } from "./planning-client"
import { ProductionGantt } from "@/components/manufacturing/dashboard/production-gantt"
import { StationWorkloadTimeline } from "@/components/manufacturing/dashboard/station-workload-timeline"
import { CardPageSkeleton } from "@/components/ui/page-skeleton"
import { Calendar, BarChart3, Factory } from "lucide-react"

const emptyData = { weeklySchedule: [], workOrders: [], machines: [] }
const emptySummary = {
    totalPlanned: 0,
    inProgress: 0,
    totalCapacity: 0,
    avgUtilization: 0,
    materialStatus: { ready: 0, partial: 0, notReady: 0 },
    machineCount: 0,
    activeMachines: 0,
}

type TabKey = "mps" | "gantt" | "workload"

export default function PlanningPage() {
    const { data, isLoading } = useMfgPlanning()
    const [activeTab, setActiveTab] = useState<TabKey>("mps")

    if (isLoading && activeTab === "mps") {
        return <CardPageSkeleton accentColor="bg-amber-400" />
    }

    const tabs: { key: TabKey; label: string; icon: typeof Calendar }[] = [
        { key: "mps", label: "Perencanaan (MPS)", icon: Calendar },
        { key: "gantt", label: "Gantt Chart", icon: BarChart3 },
        { key: "workload", label: "Timeline Work Center", icon: Factory },
    ]

    return (
        <div className="mf-page">
            {/* Tab selector */}
            <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
                <div className="flex border-b-0">
                    {tabs.map((tab) => {
                        const Icon = tab.icon
                        const isActive = activeTab === tab.key
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex items-center gap-2 px-5 py-3 text-[11px] font-black uppercase tracking-widest transition-colors border-b-[3px] ${
                                    isActive
                                        ? "border-b-indigo-500 text-indigo-700 bg-indigo-50/50 dark:bg-indigo-950/20"
                                        : "border-b-transparent text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800/30"
                                }`}
                            >
                                <Icon className="h-4 w-4" />
                                {tab.label}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Tab content */}
            {activeTab === "mps" ? (
                <PlanningClient
                    initialData={data?.data ?? emptyData}
                    initialSummary={data?.summary ?? emptySummary}
                />
            ) : activeTab === "gantt" ? (
                <ProductionGantt />
            ) : (
                <StationWorkloadTimeline />
            )}
        </div>
    )
}
