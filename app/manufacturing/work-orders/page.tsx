"use client"

import { useState } from "react"
import { useSpkOrders } from "@/hooks/use-spk-orders"
import { useWorkOrders } from "@/hooks/use-work-orders"
import { useMfgSchedule } from "@/hooks/use-mfg-schedule"
import { WorkOrdersClient } from "./work-orders-client"
import { OrdersClient } from "../orders/orders-client"
import { SchedulePageClient } from "../schedule/schedule-page-client"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import { ClipboardList, CalendarDays, Factory } from "lucide-react"

type Tab = "spk" | "mo" | "jadwal"

export default function WorkOrdersPage() {
    const [tab, setTab] = useState<Tab>("spk")
    const { data: spkData, isLoading: spkLoading } = useSpkOrders()
    const { data: moData, isLoading: moLoading } = useWorkOrders()
    const { data: scheduleData, isLoading: scheduleLoading } = useMfgSchedule()

    const emptySummary = { planned: 0, inProgress: 0, completed: 0, onHold: 0 }

    const isLoading = tab === "spk" ? spkLoading : tab === "mo" ? moLoading : scheduleLoading

    if (isLoading) {
        return <TablePageSkeleton accentColor="bg-rose-400" />
    }

    const tabClass = (active: boolean) =>
        `flex items-center gap-2 px-5 py-3 text-xs font-black uppercase tracking-widest border-b-3 transition-colors ${
            active
                ? "border-black text-black"
                : "border-transparent text-zinc-400 hover:text-zinc-600"
        }`

    return (
        <div className="flex flex-col min-h-[calc(100svh-theme(spacing.16))]">
            {/* Tab bar */}
            <div className="border-b-2 border-black bg-white px-4 md:px-8 flex items-center gap-0 shrink-0">
                <button onClick={() => setTab("spk")} className={tabClass(tab === "spk")}>
                    <ClipboardList className="h-4 w-4" /> Perintah Kerja (SPK)
                </button>
                <button onClick={() => setTab("mo")} className={tabClass(tab === "mo")}>
                    <Factory className="h-4 w-4" /> Order Produksi (MO)
                </button>
                <button onClick={() => setTab("jadwal")} className={tabClass(tab === "jadwal")}>
                    <CalendarDays className="h-4 w-4" /> Jadwal Produksi
                </button>
            </div>

            {/* Tab content */}
            {tab === "spk" && (
                <WorkOrdersClient initialOrders={spkData ?? []} />
            )}
            {tab === "mo" && (
                <OrdersClient
                    initialOrders={moData?.orders ?? []}
                    initialSummary={moData?.summary ?? emptySummary}
                />
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
