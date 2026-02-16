"use client"

import { useState } from "react"
import { GanttSchedule } from "@/components/manufacturing/gantt-schedule"
import { ScheduleWorkOrderDialog } from "@/components/manufacturing/schedule-work-order-dialog"
import { scheduleWorkOrder, type WorkOrderWithStage } from "@/lib/actions/manufacturing-garment"

interface SchedulePageClientProps {
    workOrders: WorkOrderWithStage[]
    machines: { id: string; name: string; code: string; status: string }[]
    routings: { id: string; name: string; code: string }[]
}

export function SchedulePageClient({ workOrders, machines, routings }: SchedulePageClientProps) {
    const [selected, setSelected] = useState<WorkOrderWithStage | null>(null)

    return (
        <div className="space-y-4">
            <GanttSchedule
                workOrders={workOrders}
                onSelectWorkOrder={(wo) => setSelected(wo)}
            />

            {/* Schedule dialog for selected WO */}
            {selected && (
                <div className="flex items-center gap-3 border-2 border-black p-3 bg-zinc-50">
                    <div className="flex-1 min-w-0">
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Dipilih</span>
                        <div className="text-sm font-black font-mono">{selected.number}</div>
                        <div className="text-xs text-zinc-500">{selected.productName}</div>
                    </div>
                    <ScheduleWorkOrderDialog
                        workOrder={selected}
                        machines={machines}
                        routings={routings}
                        onSchedule={scheduleWorkOrder}
                    />
                </div>
            )}
        </div>
    )
}
