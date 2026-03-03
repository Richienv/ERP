"use client"

import { useState, useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
    Form, FormControl, FormField, FormItem, FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"
import { queryKeys } from "@/lib/query-keys"
import { NB } from "@/lib/dialog-styles"
import { Loader2, Cog, Truck, Package, Clock, Star } from "lucide-react"

const STATION_TYPES = [
    { value: "CUTTING", label: "Potong (Cutting)" },
    { value: "SEWING", label: "Jahit (Sewing)" },
    { value: "WASHING", label: "Cuci (Washing)" },
    { value: "PRINTING", label: "Sablon (Printing)" },
    { value: "EMBROIDERY", label: "Bordir (Embroidery)" },
    { value: "QC", label: "Quality Control" },
    { value: "PACKING", label: "Packing" },
    { value: "FINISHING", label: "Finishing" },
    { value: "OTHER", label: "Lainnya" },
]

const OPERATION_TYPES = [
    { value: "IN_HOUSE", label: "In-House" },
    { value: "SUBCONTRACTOR", label: "Subkontraktor" },
]

// Schema for generic station creation
const stationSchema = z.object({
    code: z.string().min(1, "Kode wajib diisi"),
    name: z.string().min(1, "Nama wajib diisi"),
    stationType: z.string().min(1, "Tipe stasiun wajib dipilih"),
    operationType: z.string().min(1, "Tipe operasi wajib dipilih"),
    subcontractorId: z.string().optional(),
    costPerUnit: z.coerce.number().min(0).default(0),
    description: z.string().optional(),
})

// Schema for subkon creation (creates Subcontractor + ProcessStation)
const subkonSchema = z.object({
    companyName: z.string().min(1, "Nama perusahaan wajib diisi"),
    contactPerson: z.string().optional(),
    phone: z.string().optional(),
    costPerUnit: z.coerce.number().min(0, "Biaya harus ≥ 0").default(0),
    capacityUnitsPerDay: z.coerce.number().min(0).optional(),
    maxCapacityPerMonth: z.coerce.number().min(0).optional(),
    leadTimeDays: z.coerce.number().min(0).optional(),
    description: z.string().optional(),
})

interface CreateStationDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onCreated?: (station: any) => void
    subcontractors?: { id: string; name: string }[]
    defaultStationType?: string
    defaultOperationType?: string
}

export function CreateStationDialog({ open, onOpenChange, onCreated, subcontractors: externalSubcontractors, defaultStationType, defaultOperationType }: CreateStationDialogProps) {
    const queryClient = useQueryClient()
    const [loading, setLoading] = useState(false)
    const [subcontractors, setSubcontractors] = useState<{ id: string; name: string }[]>(externalSubcontractors || [])

    const isSubkonMode = defaultOperationType === "SUBCONTRACTOR"

    useEffect(() => {
        if (open && !externalSubcontractors && !isSubkonMode) {
            fetch("/api/manufacturing/process-stations")
                .then((r) => r.json())
                .then((data) => {
                    if (data.success && data.data) {
                        // Extract unique subcontractors from stations that have one
                        const subs = new Map<string, string>()
                        for (const station of data.data) {
                            if (station.subcontractor?.id) {
                                subs.set(station.subcontractor.id, station.subcontractor.name)
                            }
                        }
                        setSubcontractors(Array.from(subs, ([id, name]) => ({ id, name })))
                    }
                })
                .catch(() => {})
        }
    }, [open, externalSubcontractors, isSubkonMode])

    // ── SUBKON MODE: streamlined form ──
    const subkonForm = useForm<z.infer<typeof subkonSchema>>({
        resolver: zodResolver(subkonSchema) as any,
        defaultValues: {
            companyName: "",
            contactPerson: "",
            phone: "",
            costPerUnit: 0,
            capacityUnitsPerDay: undefined,
            maxCapacityPerMonth: undefined,
            leadTimeDays: undefined,
            description: "",
        },
    })

    // ── GENERIC MODE: original form ──
    const stationForm = useForm<z.infer<typeof stationSchema>>({
        resolver: zodResolver(stationSchema) as any,
        defaultValues: {
            code: "",
            name: "",
            stationType: defaultStationType || "",
            operationType: defaultOperationType || "IN_HOUSE",
            subcontractorId: "",
            costPerUnit: 0,
            description: "",
        },
    })

    const operationType = stationForm.watch("operationType")

    const onSubkonSubmit = async (values: z.infer<typeof subkonSchema>) => {
        setLoading(true)
        try {
            const res = await fetch("/api/manufacturing/process-stations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    mode: "create-subkon",
                    stationType: defaultStationType || "OTHER",
                    companyName: values.companyName,
                    contactPerson: values.contactPerson || null,
                    phone: values.phone || null,
                    costPerUnit: values.costPerUnit,
                    capacityUnitsPerDay: values.capacityUnitsPerDay || null,
                    maxCapacityPerMonth: values.maxCapacityPerMonth || null,
                    leadTimeDays: values.leadTimeDays || null,
                    description: values.description || null,
                }),
            })
            const result = await res.json()

            if (result.success) {
                toast.success("Subkontraktor berhasil ditambahkan")
                queryClient.invalidateQueries({ queryKey: queryKeys.processStations.all })
                subkonForm.reset()
                onOpenChange(false)
                onCreated?.(result.data)
            } else {
                toast.error(result.error || "Gagal membuat subkontraktor")
            }
        } catch {
            toast.error("Terjadi kesalahan")
        } finally {
            setLoading(false)
        }
    }

    const onStationSubmit = async (values: z.infer<typeof stationSchema>) => {
        setLoading(true)
        try {
            const res = await fetch("/api/manufacturing/process-stations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
            })
            const result = await res.json()

            if (result.success) {
                toast.success("Stasiun proses berhasil dibuat")
                queryClient.invalidateQueries({ queryKey: queryKeys.processStations.all })
                stationForm.reset()
                onOpenChange(false)
                onCreated?.(result.data)
            } else {
                toast.error(result.error || "Gagal membuat stasiun")
            }
        } catch {
            toast.error("Terjadi kesalahan")
        } finally {
            setLoading(false)
        }
    }

    const stationTypeLabel = STATION_TYPES.find(t => t.value === defaultStationType)?.label || defaultStationType

    // ── SUBKON MODE DIALOG ──
    if (isSubkonMode) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className={NB.contentNarrow}>
                    <DialogHeader className={NB.header}>
                        <DialogTitle className={NB.title}>
                            <Truck className="h-5 w-5" /> Tambah Subkontraktor
                        </DialogTitle>
                        <p className={NB.subtitle}>
                            Daftarkan perusahaan subkon baru untuk proses {stationTypeLabel}
                        </p>
                    </DialogHeader>

                    <ScrollArea className={NB.scroll}>
                        <div className="p-5">
                            <Form {...subkonForm}>
                                <form onSubmit={subkonForm.handleSubmit(onSubkonSubmit as any)} className="space-y-4">
                                    {/* Company Name */}
                                    <FormField control={subkonForm.control as any} name="companyName" render={({ field }) => (
                                        <FormItem>
                                            <label className={NB.label}>Nama Perusahaan <span className={NB.labelRequired}>*</span></label>
                                            <FormControl><Input {...field} placeholder="CV. Jaya Konveksi" className={NB.input} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />

                                    {/* Contact + Phone */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <FormField control={subkonForm.control as any} name="contactPerson" render={({ field }) => (
                                            <FormItem>
                                                <label className={NB.label}>Kontak PIC</label>
                                                <FormControl><Input {...field} placeholder="Nama PIC" className={NB.input} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                        <FormField control={subkonForm.control as any} name="phone" render={({ field }) => (
                                            <FormItem>
                                                <label className={NB.label}>No. Telepon</label>
                                                <FormControl><Input {...field} placeholder="08xx-xxxx-xxxx" className={NB.input} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                    </div>

                                    {/* Cost per Unit */}
                                    <FormField control={subkonForm.control as any} name="costPerUnit" render={({ field }) => (
                                        <FormItem>
                                            <label className={NB.label}>Biaya per Unit (Rp) <span className={NB.labelRequired}>*</span></label>
                                            <FormControl><Input type="number" {...field} placeholder="0" className={NB.inputMono} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />

                                    {/* Capacity section */}
                                    <div className="border-t border-zinc-200 pt-3">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-3 flex items-center gap-1">
                                            <Package className="h-3 w-3" /> Kapasitas & Waktu
                                        </p>
                                        <div className="grid grid-cols-2 gap-3">
                                            <FormField control={subkonForm.control as any} name="capacityUnitsPerDay" render={({ field }) => (
                                                <FormItem>
                                                    <label className={NB.label}>Kapasitas / Hari (pcs)</label>
                                                    <FormControl><Input type="number" {...field} value={field.value ?? ""} placeholder="500" className={NB.inputMono} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                            <FormField control={subkonForm.control as any} name="maxCapacityPerMonth" render={({ field }) => (
                                                <FormItem>
                                                    <label className={NB.label}>Maks / Bulan (pcs)</label>
                                                    <FormControl><Input type="number" {...field} value={field.value ?? ""} placeholder="10000" className={NB.inputMono} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                        </div>
                                        <div className="mt-3">
                                            <FormField control={subkonForm.control as any} name="leadTimeDays" render={({ field }) => (
                                                <FormItem>
                                                    <label className={NB.label}><Clock className="h-3 w-3 inline mr-1" />Lead Time (hari)</label>
                                                    <FormControl><Input type="number" {...field} value={field.value ?? ""} placeholder="7" className={NB.inputMono} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                        </div>
                                    </div>

                                    {/* Description */}
                                    <FormField control={subkonForm.control as any} name="description" render={({ field }) => (
                                        <FormItem>
                                            <label className={NB.label}>Catatan</label>
                                            <FormControl><Textarea {...field} placeholder="Spesialisasi, alamat, dll..." className={NB.textarea} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />

                                    <div className={NB.footer}>
                                        <Button type="button" variant="outline" className={NB.cancelBtn} onClick={() => onOpenChange(false)}>Batal</Button>
                                        <Button type="submit" disabled={loading} className={NB.submitBtn}>
                                            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan...</> : "Simpan Subkontraktor"}
                                        </Button>
                                    </div>
                                </form>
                            </Form>
                        </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        )
    }

    // ── GENERIC STATION MODE DIALOG (original) ──
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={NB.contentNarrow}>
                <DialogHeader className={NB.header}>
                    <DialogTitle className={NB.title}>
                        <Cog className="h-5 w-5" /> Tambah Stasiun Proses
                    </DialogTitle>
                    <p className={NB.subtitle}>Buat stasiun produksi baru (potong, jahit, QC, dll)</p>
                </DialogHeader>

                <ScrollArea className={NB.scroll}>
                    <div className="p-5">
                        <Form {...stationForm}>
                            <form onSubmit={stationForm.handleSubmit(onStationSubmit as any)} className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <FormField control={stationForm.control as any} name="code" render={({ field }) => (
                                        <FormItem>
                                            <label className={NB.label}>Kode <span className={NB.labelRequired}>*</span></label>
                                            <FormControl><Input {...field} placeholder="STN-CUT-01" className={NB.inputMono} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={stationForm.control as any} name="name" render={({ field }) => (
                                        <FormItem>
                                            <label className={NB.label}>Nama <span className={NB.labelRequired}>*</span></label>
                                            <FormControl><Input {...field} placeholder="Potong Utama" className={NB.input} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <FormField control={stationForm.control as any} name="stationType" render={({ field }) => (
                                        <FormItem>
                                            <label className={NB.label}>Tipe Stasiun <span className={NB.labelRequired}>*</span></label>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger className={NB.select}><SelectValue placeholder="Pilih tipe" /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    {STATION_TYPES.map((t) => (
                                                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={stationForm.control as any} name="operationType" render={({ field }) => (
                                        <FormItem>
                                            <label className={NB.label}>Tipe Operasi <span className={NB.labelRequired}>*</span></label>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger className={NB.select}><SelectValue /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    {OPERATION_TYPES.map((t) => (
                                                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>

                                {operationType === "SUBCONTRACTOR" && subcontractors.length > 0 && (
                                    <FormField control={stationForm.control as any} name="subcontractorId" render={({ field }) => (
                                        <FormItem>
                                            <label className={NB.label}>Subkontraktor</label>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger className={NB.select}><SelectValue placeholder="Pilih subkontraktor" /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    {subcontractors.map((s) => (
                                                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                )}

                                <FormField control={stationForm.control as any} name="costPerUnit" render={({ field }) => (
                                    <FormItem>
                                        <label className={NB.label}>Biaya per Unit (Rp)</label>
                                        <FormControl><Input type="number" {...field} className={NB.inputMono} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />

                                <FormField control={stationForm.control as any} name="description" render={({ field }) => (
                                    <FormItem>
                                        <label className={NB.label}>Deskripsi</label>
                                        <FormControl><Textarea {...field} placeholder="Catatan opsional..." className={NB.textarea} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />

                                <div className={NB.footer}>
                                    <Button type="button" variant="outline" className={NB.cancelBtn} onClick={() => onOpenChange(false)}>Batal</Button>
                                    <Button type="submit" disabled={loading} className={NB.submitBtn}>
                                        {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan...</> : "Simpan Stasiun"}
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}
