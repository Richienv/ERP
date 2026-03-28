"use client"

import { useState, useMemo } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { Button } from "@/components/ui/button"
import { ComboboxWithCreate } from "@/components/ui/combobox-with-create"
import { CalendarClock } from "lucide-react"
import { toast } from "sonner"
import type { WorkOrderWithStage } from "@/lib/actions/manufacturing-garment"
import {
    NBDialog,
    NBDialogHeader,
    NBDialogBody,
    NBDialogFooter,
    NBSection,
    NBInput,
} from "@/components/ui/nb-dialog"

interface ScheduleWorkOrderDialogProps {
    workOrder: WorkOrderWithStage
    machines: { id: string; name: string; code: string; status: string }[]
    routings: { id: string; name: string; code: string }[]
    onSchedule: (workOrderId: string, data: {
        scheduledStart: string
        scheduledEnd: string
        machineId?: string
        routingId?: string
    }) => Promise<{ success: boolean; error?: string }>
    trigger?: React.ReactNode
}

export function ScheduleWorkOrderDialog({ workOrder, machines, routings, onSchedule, trigger }: ScheduleWorkOrderDialogProps) {
    const queryClient = useQueryClient()
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)

    const [scheduledStart, setScheduledStart] = useState(
        workOrder.scheduledStart ? workOrder.scheduledStart.slice(0, 16) : ""
    )
    const [scheduledEnd, setScheduledEnd] = useState(
        workOrder.scheduledEnd ? workOrder.scheduledEnd.slice(0, 16) : ""
    )
    const [machineId, setMachineId] = useState("")
    const [routingId, setRoutingId] = useState("")

    const machineOptions = useMemo(
        () => machines.map((m) => ({ value: m.id, label: `${m.name} (${m.status})`, subtitle: m.code })),
        [machines]
    )
    const routingOptions = useMemo(
        () => routings.map((r) => ({ value: r.id, label: r.name, subtitle: r.code })),
        [routings]
    )

    const handleSubmit = async () => {
        if (!scheduledStart || !scheduledEnd) {
            toast.error("Tanggal mulai dan selesai wajib diisi")
            return
        }

        if (new Date(scheduledEnd) <= new Date(scheduledStart)) {
            toast.error("Tanggal selesai harus setelah tanggal mulai")
            return
        }

        setLoading(true)
        const result = await onSchedule(workOrder.id, {
            scheduledStart: new Date(scheduledStart).toISOString(),
            scheduledEnd: new Date(scheduledEnd).toISOString(),
            ...(machineId && { machineId }),
            ...(routingId && { routingId }),
        })
        setLoading(false)

        if (result.success) {
            toast.success(`${workOrder.number} berhasil dijadwalkan`)
            queryClient.invalidateQueries({ queryKey: queryKeys.workOrders.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.mfgDashboard.all })
            setOpen(false)
        } else {
            toast.error(result.error || "Gagal menjadwalkan")
        }
    }

    return (
        <>
            {trigger ? (
                <span onClick={() => setOpen(true)}>{trigger}</span>
            ) : (
                <Button
                    className="bg-black text-white border border-black hover:bg-zinc-800 font-black uppercase text-[10px] tracking-wider px-4 h-8 rounded-none"
                    size="sm"
                    onClick={() => setOpen(true)}
                >
                    <CalendarClock className="mr-2 h-4 w-4" /> Jadwalkan
                </Button>
            )}

            <NBDialog open={open} onOpenChange={setOpen}>
                <NBDialogHeader
                    icon={CalendarClock}
                    title="Jadwalkan Work Order"
                    subtitle={`${workOrder.number} — ${workOrder.productName}`}
                />

                <NBDialogBody>
                    {/* Work Order Info */}
                    <NBSection icon={CalendarClock} title="Info Work Order">
                        <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-1 block">Nomor</span>
                                <span className="font-mono font-bold block">{workOrder.number}</span>
                            </div>
                            <div>
                                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-1 block">Qty</span>
                                <span className="font-bold block">{workOrder.plannedQty}</span>
                            </div>
                            <div>
                                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-1 block">Prioritas</span>
                                <span className={`inline-block px-2 py-0.5 text-[10px] font-black border border-zinc-300 ${
                                    workOrder.priority === 'CRITICAL' ? 'bg-red-100 text-red-700' :
                                    workOrder.priority === 'HIGH' ? 'bg-amber-100 text-amber-700' :
                                    'bg-zinc-100 text-zinc-700'
                                }`}>
                                    {workOrder.priority}
                                </span>
                            </div>
                        </div>
                    </NBSection>

                    {/* Schedule */}
                    <NBSection icon={CalendarClock} title="Jadwal">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-1 block">
                                    Mulai <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="datetime-local"
                                    value={scheduledStart}
                                    onChange={(e) => setScheduledStart(e.target.value)}
                                    className="w-full border border-zinc-300 h-8 text-sm rounded-none px-2 font-medium transition-colors focus:border-orange-400 focus:bg-orange-50/50 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-1 block">
                                    Selesai <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="datetime-local"
                                    value={scheduledEnd}
                                    onChange={(e) => setScheduledEnd(e.target.value)}
                                    className="w-full border border-zinc-300 h-8 text-sm rounded-none px-2 font-medium transition-colors focus:border-orange-400 focus:bg-orange-50/50 focus:outline-none"
                                />
                            </div>
                        </div>
                    </NBSection>

                    {/* Machine & Routing */}
                    <NBSection icon={CalendarClock} title="Mesin & Routing" optional>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-1 block">Mesin</label>
                                <ComboboxWithCreate
                                    options={machineOptions}
                                    value={machineId}
                                    onChange={setMachineId}
                                    placeholder="— Tidak ditentukan —"
                                    searchPlaceholder="Cari mesin..."
                                    emptyMessage="Mesin tidak ditemukan."
                                />
                            </div>
                            <div>
                                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-1 block">Routing</label>
                                <ComboboxWithCreate
                                    options={routingOptions}
                                    value={routingId}
                                    onChange={setRoutingId}
                                    placeholder="— Tidak ditentukan —"
                                    searchPlaceholder="Cari routing..."
                                    emptyMessage="Routing tidak ditemukan."
                                />
                            </div>
                        </div>
                    </NBSection>
                </NBDialogBody>

                <NBDialogFooter
                    onCancel={() => setOpen(false)}
                    onSubmit={handleSubmit}
                    submitting={loading}
                    submitLabel="Simpan Jadwal"
                />
            </NBDialog>
        </>
    )
}
