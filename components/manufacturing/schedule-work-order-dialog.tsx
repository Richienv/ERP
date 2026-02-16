"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { NB } from "@/lib/dialog-styles"
import { CalendarClock } from "lucide-react"
import { toast } from "sonner"
import type { WorkOrderWithStage } from "@/lib/actions/manufacturing-garment"

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
            setOpen(false)
        } else {
            toast.error(result.error || "Gagal menjadwalkan")
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger ?? (
                    <Button className={NB.triggerBtn} size="sm">
                        <CalendarClock className="mr-2 h-4 w-4" /> Jadwalkan
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className={NB.content}>
                <DialogHeader className={NB.header}>
                    <DialogTitle className={NB.title}>
                        <CalendarClock className="h-5 w-5" /> Jadwalkan Work Order
                    </DialogTitle>
                    <p className={NB.subtitle}>{workOrder.number} — {workOrder.productName}</p>
                </DialogHeader>

                <div className="p-6 space-y-4">
                    {/* Work Order Info */}
                    <div className={NB.section}>
                        <div className={NB.sectionHead}>
                            <span className={NB.sectionTitle}>Info Work Order</span>
                        </div>
                        <div className={NB.sectionBody}>
                            <div className="grid grid-cols-3 gap-4 text-sm">
                                <div>
                                    <span className={NB.label}>Nomor</span>
                                    <span className="font-mono font-bold block">{workOrder.number}</span>
                                </div>
                                <div>
                                    <span className={NB.label}>Qty</span>
                                    <span className="font-bold block">{workOrder.plannedQty}</span>
                                </div>
                                <div>
                                    <span className={NB.label}>Prioritas</span>
                                    <span className={`inline-block px-2 py-0.5 text-[10px] font-black border-2 border-black ${
                                        workOrder.priority === 'CRITICAL' ? 'bg-red-100 text-red-700' :
                                        workOrder.priority === 'HIGH' ? 'bg-amber-100 text-amber-700' :
                                        'bg-zinc-100 text-zinc-700'
                                    }`}>
                                        {workOrder.priority}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Schedule */}
                    <div className={NB.section}>
                        <div className={NB.sectionHead}>
                            <span className={NB.sectionTitle}>Jadwal</span>
                        </div>
                        <div className={NB.sectionBody}>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={NB.label}>Mulai <span className={NB.labelRequired}>*</span></label>
                                    <Input
                                        className={NB.input}
                                        type="datetime-local"
                                        value={scheduledStart}
                                        onChange={(e) => setScheduledStart(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className={NB.label}>Selesai <span className={NB.labelRequired}>*</span></label>
                                    <Input
                                        className={NB.input}
                                        type="datetime-local"
                                        value={scheduledEnd}
                                        onChange={(e) => setScheduledEnd(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Machine & Routing */}
                    <div className={NB.section}>
                        <div className={NB.sectionHead}>
                            <span className={NB.sectionTitle}>Mesin & Routing</span>
                        </div>
                        <div className={NB.sectionBody}>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={NB.label}>Mesin</label>
                                    <select className={NB.select} value={machineId} onChange={(e) => setMachineId(e.target.value)}>
                                        <option value="">— Tidak ditentukan —</option>
                                        {machines.map((m) => (
                                            <option key={m.id} value={m.id}>
                                                {m.code} — {m.name} ({m.status})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className={NB.label}>Routing</label>
                                    <select className={NB.select} value={routingId} onChange={(e) => setRoutingId(e.target.value)}>
                                        <option value="">— Tidak ditentukan —</option>
                                        {routings.map((r) => (
                                            <option key={r.id} value={r.id}>
                                                {r.code} — {r.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className={NB.footer}>
                        <Button variant="outline" onClick={() => setOpen(false)} className={NB.cancelBtn}>Batal</Button>
                        <Button onClick={handleSubmit} disabled={loading} className={NB.submitBtn}>
                            {loading ? "Menjadwalkan..." : "Simpan Jadwal"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
