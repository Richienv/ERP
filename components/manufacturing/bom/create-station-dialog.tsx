"use client"

import { useState, useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import {
    Form, FormControl, FormField, FormItem, FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { queryKeys } from "@/lib/query-keys"
import { Loader2, Cog, Truck, Package, Clock } from "lucide-react"
import { COLOR_THEMES, ICON_OPTIONS } from "./station-config"
import {
    NBDialog,
    NBDialogHeader,
    NBDialogBody,
    NBDialogFooter,
    NBSection,
} from "@/components/ui/nb-dialog"

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

const LABEL_CLASS = "text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-1 block"
const INPUT_CLASS = "h-8 text-sm rounded-none border border-zinc-300 font-medium"
const INPUT_MONO = "h-8 text-sm rounded-none border border-zinc-300 font-mono font-bold"
const SELECT_CLASS = "h-8 text-sm rounded-none border border-zinc-300"
const TEXTAREA_CLASS = "text-sm rounded-none border border-zinc-300 resize-none"

const stationSchema = z.object({
    code: z.string().min(1, "Kode wajib diisi"),
    name: z.string().min(1, "Nama wajib diisi"),
    stationType: z.string().min(1, "Tipe work center wajib dipilih"),
    operationType: z.string().min(1, "Tipe operasi wajib dipilih"),
    subcontractorId: z.string().optional(),
    costPerUnit: z.coerce.number().min(0).default(0),
    overheadPct: z.coerce.number().min(0).max(100).optional().nullable(),
    description: z.string().optional(),
    iconName: z.string().optional(),
    colorTheme: z.string().optional(),
})

const subkonSchema = z.object({
    companyName: z.string().min(1, "Nama perusahaan wajib diisi"),
    contactPerson: z.string().optional(),
    phone: z.string().optional(),
    costPerUnit: z.coerce.number().min(0, "Biaya harus ≥ 0").default(0),
    overheadPct: z.coerce.number().min(0).max(100).optional().nullable(),
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

    const subkonForm = useForm<z.infer<typeof subkonSchema>>({
        resolver: zodResolver(subkonSchema) as any,
        defaultValues: {
            companyName: "",
            contactPerson: "",
            phone: "",
            costPerUnit: 0,
            overheadPct: null,
            capacityUnitsPerDay: undefined,
            maxCapacityPerMonth: undefined,
            leadTimeDays: undefined,
            description: "",
        },
    })

    const stationForm = useForm<z.infer<typeof stationSchema>>({
        resolver: zodResolver(stationSchema) as any,
        defaultValues: {
            code: "",
            name: "",
            stationType: defaultStationType || "",
            operationType: defaultOperationType || "IN_HOUSE",
            subcontractorId: "",
            costPerUnit: 0,
            overheadPct: null,
            description: "",
            iconName: "Cog",
            colorTheme: "zinc",
        },
    })

    const operationType = stationForm.watch("operationType")
    const stationType = stationForm.watch("stationType")
    const selectedIcon = stationForm.watch("iconName")
    const selectedColor = stationForm.watch("colorTheme")

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
                    overheadPct: values.overheadPct ?? null,
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
                toast.success("Work center proses berhasil dibuat")
                queryClient.invalidateQueries({ queryKey: queryKeys.processStations.all })
                stationForm.reset()
                onOpenChange(false)
                onCreated?.(result.data)
            } else {
                toast.error(result.error || "Gagal membuat work center")
            }
        } catch {
            toast.error("Terjadi kesalahan")
        } finally {
            setLoading(false)
        }
    }

    const stationTypeLabel = STATION_TYPES.find(t => t.value === defaultStationType)?.label || defaultStationType

    // SUBKON MODE
    if (isSubkonMode) {
        return (
            <NBDialog open={open} onOpenChange={onOpenChange} size="narrow">
                <NBDialogHeader
                    icon={Truck}
                    title="Tambah Subkontraktor"
                    subtitle={`Daftarkan perusahaan subkon baru untuk proses ${stationTypeLabel}`}
                />

                <NBDialogBody>
                    <Form {...subkonForm}>
                        <form onSubmit={subkonForm.handleSubmit(onSubkonSubmit as any)} className="space-y-3" id="subkon-form">
                            <NBSection icon={Truck} title="Info Perusahaan">
                                <FormField control={subkonForm.control as any} name="companyName" render={({ field }) => (
                                    <FormItem>
                                        <label className={LABEL_CLASS}>Nama Perusahaan <span className="text-red-500">*</span></label>
                                        <FormControl><Input {...field} placeholder="CV. ..." className={INPUT_CLASS} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <div className="grid grid-cols-2 gap-3">
                                    <FormField control={subkonForm.control as any} name="contactPerson" render={({ field }) => (
                                        <FormItem>
                                            <label className={LABEL_CLASS}>Kontak PIC</label>
                                            <FormControl><Input {...field} placeholder="Nama..." className={INPUT_CLASS} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={subkonForm.control as any} name="phone" render={({ field }) => (
                                        <FormItem>
                                            <label className={LABEL_CLASS}>No. Telepon</label>
                                            <FormControl><Input {...field} placeholder="08..." className={INPUT_CLASS} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <FormField control={subkonForm.control as any} name="costPerUnit" render={({ field }) => (
                                        <FormItem>
                                            <label className={LABEL_CLASS}>Biaya per Unit (Rp) <span className="text-red-500">*</span></label>
                                            <FormControl><Input type="number" {...field} placeholder="0" className={INPUT_MONO} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={subkonForm.control as any} name="overheadPct" render={({ field }) => (
                                        <FormItem>
                                            <label className={LABEL_CLASS}>Overhead (%)</label>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    max="100"
                                                    placeholder="15"
                                                    className={`${INPUT_MONO} placeholder:text-zinc-300`}
                                                    value={field.value ?? ""}
                                                    onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                                                />
                                            </FormControl>
                                            <p className="text-xs text-muted-foreground">Persen overhead di atas biaya tenaga kerja</p>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>
                            </NBSection>

                            <NBSection icon={Package} title="Kapasitas & Waktu" optional>
                                <div className="grid grid-cols-2 gap-3">
                                    <FormField control={subkonForm.control as any} name="capacityUnitsPerDay" render={({ field }) => (
                                        <FormItem>
                                            <label className={LABEL_CLASS}>Kapasitas / Hari (pcs)</label>
                                            <FormControl><Input type="number" {...field} value={field.value ?? ""} placeholder="500" className={INPUT_MONO} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={subkonForm.control as any} name="maxCapacityPerMonth" render={({ field }) => (
                                        <FormItem>
                                            <label className={LABEL_CLASS}>Maks / Bulan (pcs)</label>
                                            <FormControl><Input type="number" {...field} value={field.value ?? ""} placeholder="10000" className={INPUT_MONO} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>
                                <FormField control={subkonForm.control as any} name="leadTimeDays" render={({ field }) => (
                                    <FormItem>
                                        <label className={LABEL_CLASS}><Clock className="h-3 w-3 inline mr-1" />Lead Time (hari)</label>
                                        <FormControl><Input type="number" {...field} value={field.value ?? ""} placeholder="7" className={INPUT_MONO} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </NBSection>

                            <FormField control={subkonForm.control as any} name="description" render={({ field }) => (
                                <FormItem>
                                    <label className={LABEL_CLASS}>Catatan</label>
                                    <FormControl><Textarea {...field} placeholder="Catatan..." className={TEXTAREA_CLASS} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </form>
                    </Form>
                </NBDialogBody>

                <NBDialogFooter
                    onCancel={() => onOpenChange(false)}
                    onSubmit={() => subkonForm.handleSubmit(onSubkonSubmit as any)()}
                    submitting={loading}
                    submitLabel="Simpan Subkontraktor"
                />
            </NBDialog>
        )
    }

    // GENERIC STATION MODE
    return (
        <NBDialog open={open} onOpenChange={onOpenChange} size="narrow">
            <NBDialogHeader
                icon={Cog}
                title="Tambah Work Center Proses"
                subtitle="Buat work center produksi baru (potong, jahit, QC, dll)"
            />

            <NBDialogBody>
                <Form {...stationForm}>
                    <form onSubmit={stationForm.handleSubmit(onStationSubmit as any)} className="space-y-3" id="station-form">
                        <NBSection icon={Cog} title="Identitas">
                            <div className="grid grid-cols-2 gap-3">
                                <FormField control={stationForm.control as any} name="code" render={({ field }) => (
                                    <FormItem>
                                        <label className={LABEL_CLASS}>Kode <span className="text-red-500">*</span></label>
                                        <FormControl><Input {...field} placeholder="STN-01" className={INPUT_MONO} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={stationForm.control as any} name="name" render={({ field }) => (
                                    <FormItem>
                                        <label className={LABEL_CLASS}>Nama <span className="text-red-500">*</span></label>
                                        <FormControl><Input {...field} placeholder="Nama..." className={INPUT_CLASS} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <FormField control={stationForm.control as any} name="stationType" render={({ field }) => (
                                    <FormItem>
                                        <label className={LABEL_CLASS}>Tipe Work Center <span className="text-red-500">*</span></label>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger className={SELECT_CLASS}><SelectValue placeholder="Pilih tipe" /></SelectTrigger></FormControl>
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
                                        <label className={LABEL_CLASS}>Tipe Operasi <span className="text-red-500">*</span></label>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger className={SELECT_CLASS}><SelectValue /></SelectTrigger></FormControl>
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
                                        <label className={LABEL_CLASS}>Subkontraktor</label>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger className={SELECT_CLASS}><SelectValue placeholder="Pilih subkontraktor" /></SelectTrigger></FormControl>
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

                            <div className="grid grid-cols-2 gap-3">
                                <FormField control={stationForm.control as any} name="costPerUnit" render={({ field }) => (
                                    <FormItem>
                                        <label className={LABEL_CLASS}>Biaya per Unit (Rp)</label>
                                        <FormControl><Input type="number" {...field} className={INPUT_MONO} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={stationForm.control as any} name="overheadPct" render={({ field }) => (
                                    <FormItem>
                                        <label className={LABEL_CLASS}>Overhead (%)</label>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                max="100"
                                                placeholder="15"
                                                className={`${INPUT_MONO} placeholder:text-zinc-300`}
                                                value={field.value ?? ""}
                                                onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                                            />
                                        </FormControl>
                                        <p className="text-xs text-muted-foreground">Persen overhead di atas biaya tenaga kerja</p>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>

                            <FormField control={stationForm.control as any} name="description" render={({ field }) => (
                                <FormItem>
                                    <label className={LABEL_CLASS}>Deskripsi</label>
                                    <FormControl><Textarea {...field} placeholder="Catatan..." className={TEXTAREA_CLASS} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </NBSection>

                        {/* Color & Icon pickers for OTHER type */}
                        {stationType === "OTHER" && (
                            <NBSection icon={Cog} title="Tampilan di Toolbar" optional>
                                {(() => {
                                    const theme = COLOR_THEMES[selectedColor || "zinc"] || COLOR_THEMES.zinc
                                    const PreviewIcon = ICON_OPTIONS.find(o => o.name === selectedIcon)?.icon || Cog
                                    return (
                                        <div className="flex items-center gap-2">
                                            <span className="text-[9px] text-zinc-400 font-bold">Preview:</span>
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 border text-[10px] font-bold ${theme.toolbar}`}>
                                                <PreviewIcon className="h-3 w-3" />
                                                {stationForm.watch("name") || "Nama Proses"}
                                            </span>
                                        </div>
                                    )
                                })()}

                                <div>
                                    <label className={LABEL_CLASS}>Warna</label>
                                    <div className="grid grid-cols-6 gap-1.5">
                                        {Object.entries(COLOR_THEMES).map(([key, theme]) => (
                                            <button
                                                key={key}
                                                type="button"
                                                onClick={() => stationForm.setValue("colorTheme", key)}
                                                className={`h-7 w-full border rounded-none transition-all ${theme.toolbar.split(" ").slice(0, 1).join(" ")} ${
                                                    selectedColor === key
                                                        ? "border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                                                        : "border-transparent hover:border-zinc-300"
                                                }`}
                                                title={key}
                                            />
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className={LABEL_CLASS}>Ikon</label>
                                    <div className="grid grid-cols-8 gap-1.5">
                                        {ICON_OPTIONS.map((opt) => {
                                            const Ic = opt.icon
                                            return (
                                                <button
                                                    key={opt.name}
                                                    type="button"
                                                    onClick={() => stationForm.setValue("iconName", opt.name)}
                                                    className={`h-8 w-full flex items-center justify-center border rounded-none transition-all ${
                                                        selectedIcon === opt.name
                                                            ? "border-black bg-zinc-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                                                            : "border-zinc-200 hover:border-black"
                                                    }`}
                                                    title={opt.label}
                                                >
                                                    <Ic className="h-4 w-4" />
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            </NBSection>
                        )}
                    </form>
                </Form>
            </NBDialogBody>

            <NBDialogFooter
                onCancel={() => onOpenChange(false)}
                onSubmit={() => stationForm.handleSubmit(onStationSubmit as any)()}
                submitting={loading}
                submitLabel="Simpan Work Center"
            />
        </NBDialog>
    )
}
