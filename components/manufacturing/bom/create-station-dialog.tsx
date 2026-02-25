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
import { Loader2, Cog } from "lucide-react"

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

const formSchema = z.object({
    code: z.string().min(1, "Kode wajib diisi"),
    name: z.string().min(1, "Nama wajib diisi"),
    stationType: z.string().min(1, "Tipe stasiun wajib dipilih"),
    operationType: z.string().min(1, "Tipe operasi wajib dipilih"),
    subcontractorId: z.string().optional(),
    costPerUnit: z.coerce.number().min(0).default(0),
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

    useEffect(() => {
        if (open && !externalSubcontractors) {
            fetch("/api/manufacturing/subcontract/registry")
                .then((r) => r.json())
                .then((data) => {
                    if (data.success && data.data) {
                        setSubcontractors(data.data.map((s: any) => ({ id: s.id, name: s.name })))
                    }
                })
                .catch(() => {})
        }
    }, [open, externalSubcontractors])

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema) as any,
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

    const operationType = form.watch("operationType")

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
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
                form.reset()
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
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <FormField control={form.control as any} name="code" render={({ field }) => (
                                        <FormItem>
                                            <label className={NB.label}>Kode <span className={NB.labelRequired}>*</span></label>
                                            <FormControl><Input {...field} placeholder="STN-CUT-01" className={NB.inputMono} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control as any} name="name" render={({ field }) => (
                                        <FormItem>
                                            <label className={NB.label}>Nama <span className={NB.labelRequired}>*</span></label>
                                            <FormControl><Input {...field} placeholder="Potong Utama" className={NB.input} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <FormField control={form.control as any} name="stationType" render={({ field }) => (
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
                                    <FormField control={form.control as any} name="operationType" render={({ field }) => (
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
                                    <FormField control={form.control as any} name="subcontractorId" render={({ field }) => (
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

                                <FormField control={form.control as any} name="costPerUnit" render={({ field }) => (
                                    <FormItem>
                                        <label className={NB.label}>Biaya per Unit (Rp)</label>
                                        <FormControl><Input type="number" {...field} className={NB.inputMono} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />

                                <FormField control={form.control as any} name="description" render={({ field }) => (
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
