"use client"

import { useState } from "react"
import { useSpkOrders } from "@/hooks/use-spk-orders"
import { useMfgSchedule } from "@/hooks/use-mfg-schedule"
import { WorkOrdersClient } from "./work-orders-client"
import { SchedulePageClient } from "../schedule/schedule-page-client"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import { ClipboardList, CalendarDays } from "lucide-react"

type Tab = "spk" | "jadwal"

export default function WorkOrdersPage() {
    const [tab, setTab] = useState<Tab>("spk")
    const { data: spkData, isLoading: spkLoading } = useSpkOrders()
    const { data: scheduleData, isLoading: scheduleLoading } = useMfgSchedule()

    const isLoading = tab === "spk" ? spkLoading : scheduleLoading

    if (isLoading) {
        return <TablePageSkeleton accentColor="bg-rose-400" />
    }

    return (
        <div className="flex flex-col min-h-[calc(100svh-theme(spacing.16))]">
            {/* Tab bar */}
            <div className="border-b-2 border-black bg-white px-4 md:px-8 flex items-center gap-0 shrink-0">
                <button
                    onClick={() => setTab("spk")}
                    className={`flex items-center gap-2 px-5 py-3 text-xs font-black uppercase tracking-widest border-b-3 transition-colors ${
                        tab === "spk"
                            ? "border-black text-black"
                            : "border-transparent text-zinc-400 hover:text-zinc-600"
                    }`}
                >
                    <ClipboardList className="h-4 w-4" /> Perintah Kerja
                </button>
                <button
                    onClick={() => setTab("jadwal")}
                    className={`flex items-center gap-2 px-5 py-3 text-xs font-black uppercase tracking-widest border-b-3 transition-colors ${
                        tab === "jadwal"
                            ? "border-black text-black"
                            : "border-transparent text-zinc-400 hover:text-zinc-600"
                    }`}
                >
                    <CalendarDays className="h-4 w-4" /> Jadwal Produksi
                </button>
            </div>

            {/* Tab content */}
            {tab === "spk" && (
                <WorkOrdersClient initialOrders={spkData ?? []} />
            )}
            {tab === "jadwal" && scheduleData && (
                <div className="mf-page">
                    <SchedulePageClient
                        workOrders={scheduleData.workOrders}
                        machines={scheduleData.machines}
                        routings={scheduleData.routings}
                    />
                </div>
            )}
        </div>
    )
}
