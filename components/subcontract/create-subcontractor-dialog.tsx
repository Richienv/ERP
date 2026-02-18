"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { NB } from "@/lib/dialog-styles"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Factory } from "lucide-react"
import { toast } from "sonner"
import { createSubcontractor } from "@/lib/actions/subcontract"
import { queryKeys } from "@/lib/query-keys"

const CAPABILITIES = [
    { value: "CUT", label: "Potong" },
    { value: "SEW", label: "Jahit" },
    { value: "WASH", label: "Cuci" },
    { value: "PRINT", label: "Cetak" },
    { value: "EMBROIDERY", label: "Bordir" },
    { value: "FINISHING", label: "Finishing" },
]

interface CreateSubcontractorDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function CreateSubcontractorDialog({
    open,
    onOpenChange,
}: CreateSubcontractorDialogProps) {
    const [loading, setLoading] = useState(false)
    const queryClient = useQueryClient()
    const [form, setForm] = useState({
        name: "",
        npwp: "",
        address: "",
        capabilities: [] as string[],
        capacityUnitsPerDay: "",
        contactPerson: "",
        phone: "",
        email: "",
    })

    const toggleCapability = (cap: string) => {
        setForm((f) => ({
            ...f,
            capabilities: f.capabilities.includes(cap)
                ? f.capabilities.filter((c) => c !== cap)
                : [...f.capabilities, cap],
        }))
    }

    const handleSubmit = async () => {
        if (!form.name.trim()) {
            toast.error("Nama subkontraktor wajib diisi")
            return
        }
        if (form.capabilities.length === 0) {
            toast.error("Pilih minimal 1 kapabilitas")
            return
        }

        setLoading(true)
        const result = await createSubcontractor({
            name: form.name,
            npwp: form.npwp || undefined,
            address: form.address || undefined,
            capabilities: form.capabilities,
            capacityUnitsPerDay: form.capacityUnitsPerDay
                ? parseInt(form.capacityUnitsPerDay)
                : undefined,
            contactPerson: form.contactPerson || undefined,
            phone: form.phone || undefined,
            email: form.email || undefined,
        })
        setLoading(false)

        if (result.success) {
            toast.success("Subkontraktor berhasil ditambahkan")
            queryClient.invalidateQueries({ queryKey: queryKeys.subcontractRegistry.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.subcontractOrders.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.subcontractDashboard.all })
            onOpenChange(false)
            setForm({
                name: "",
                npwp: "",
                address: "",
                capabilities: [],
                capacityUnitsPerDay: "",
                contactPerson: "",
                phone: "",
                email: "",
            })
        } else {
            toast.error(result.error || "Gagal menambahkan subkontraktor")
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={NB.content}>
                <DialogHeader className={NB.header}>
                    <DialogTitle className={NB.title}>
                        <Factory className="h-5 w-5" />
                        Tambah Subkontraktor
                    </DialogTitle>
                    <p className={NB.subtitle}>Daftarkan mitra CMT baru</p>
                </DialogHeader>

                <ScrollArea className={NB.scroll}>
                    <div className="p-6 space-y-6">
                        {/* Basic info */}
                        <div className={NB.section}>
                            <div className={NB.sectionHead}>
                                <span className={NB.sectionTitle}>Informasi Dasar</span>
                            </div>
                            <div className={NB.sectionBody}>
                                <div>
                                    <label className={NB.label}>
                                        Nama <span className={NB.labelRequired}>*</span>
                                    </label>
                                    <Input
                                        className={NB.input}
                                        value={form.name}
                                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                        placeholder="CV. Textile Jaya"
                                    />
                                </div>
                                <div>
                                    <label className={NB.label}>NPWP</label>
                                    <Input
                                        className={NB.inputMono}
                                        value={form.npwp}
                                        onChange={(e) => setForm((f) => ({ ...f, npwp: e.target.value }))}
                                        placeholder="00.000.000.0-000.000"
                                    />
                                </div>
                                <div>
                                    <label className={NB.label}>Alamat</label>
                                    <Textarea
                                        className={NB.textarea}
                                        value={form.address}
                                        onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                                        placeholder="Jl. Industri Raya No. 1"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Capabilities */}
                        <div className={NB.section}>
                            <div className={NB.sectionHead}>
                                <span className={NB.sectionTitle}>
                                    Kapabilitas <span className={NB.labelRequired}>*</span>
                                </span>
                            </div>
                            <div className={NB.sectionBody}>
                                <div className="flex flex-wrap gap-2">
                                    {CAPABILITIES.map((cap) => {
                                        const selected = form.capabilities.includes(cap.value)
                                        return (
                                            <button
                                                key={cap.value}
                                                type="button"
                                                onClick={() => toggleCapability(cap.value)}
                                                className={`px-3 py-1.5 border-2 border-black text-xs font-black uppercase tracking-wider transition-all ${
                                                    selected
                                                        ? 'bg-black text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                                                        : 'bg-white text-black hover:bg-zinc-100'
                                                }`}
                                            >
                                                {cap.label}
                                            </button>
                                        )
                                    })}
                                </div>
                                <div>
                                    <label className={NB.label}>Kapasitas (unit/hari)</label>
                                    <Input
                                        className={NB.inputMono}
                                        type="number"
                                        value={form.capacityUnitsPerDay}
                                        onChange={(e) =>
                                            setForm((f) => ({ ...f, capacityUnitsPerDay: e.target.value }))
                                        }
                                        placeholder="500"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Contact */}
                        <div className={NB.section}>
                            <div className={NB.sectionHead}>
                                <span className={NB.sectionTitle}>Kontak</span>
                            </div>
                            <div className={NB.sectionBody}>
                                <div>
                                    <label className={NB.label}>Nama Kontak</label>
                                    <Input
                                        className={NB.input}
                                        value={form.contactPerson}
                                        onChange={(e) =>
                                            setForm((f) => ({ ...f, contactPerson: e.target.value }))
                                        }
                                        placeholder="Budi Santoso"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={NB.label}>Telepon</label>
                                        <Input
                                            className={NB.input}
                                            value={form.phone}
                                            onChange={(e) =>
                                                setForm((f) => ({ ...f, phone: e.target.value }))
                                            }
                                            placeholder="021-1234567"
                                        />
                                    </div>
                                    <div>
                                        <label className={NB.label}>Email</label>
                                        <Input
                                            className={NB.input}
                                            type="email"
                                            value={form.email}
                                            onChange={(e) =>
                                                setForm((f) => ({ ...f, email: e.target.value }))
                                            }
                                            placeholder="info@cmt.co.id"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className={NB.footer}>
                            <button
                                type="button"
                                onClick={() => onOpenChange(false)}
                                className={NB.cancelBtn}
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={loading}
                                className={NB.submitBtn}
                            >
                                {loading ? "Menyimpan..." : "Simpan"}
                            </button>
                        </div>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}
