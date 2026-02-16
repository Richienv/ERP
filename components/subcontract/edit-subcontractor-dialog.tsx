"use client"

import { useState, useEffect } from "react"
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
import { updateSubcontractor } from "@/lib/actions/subcontract"
import type { SubcontractorSummary } from "@/lib/actions/subcontract"

const CAPABILITIES = [
    { value: "CUT", label: "Potong" },
    { value: "SEW", label: "Jahit" },
    { value: "WASH", label: "Cuci" },
    { value: "PRINT", label: "Cetak" },
    { value: "EMBROIDERY", label: "Bordir" },
    { value: "FINISHING", label: "Finishing" },
]

interface EditSubcontractorDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    subcontractor: SubcontractorSummary
}

export function EditSubcontractorDialog({
    open,
    onOpenChange,
    subcontractor,
}: EditSubcontractorDialogProps) {
    const [loading, setLoading] = useState(false)
    const [form, setForm] = useState({
        name: "",
        npwp: "",
        address: "",
        capabilities: [] as string[],
        capacityUnitsPerDay: "",
        contactPerson: "",
        phone: "",
        email: "",
        isActive: true,
    })

    useEffect(() => {
        if (open && subcontractor) {
            setForm({
                name: subcontractor.name,
                npwp: subcontractor.npwp || "",
                address: subcontractor.address || "",
                capabilities: [...subcontractor.capabilities],
                capacityUnitsPerDay: subcontractor.capacityUnitsPerDay?.toString() || "",
                contactPerson: subcontractor.contactPerson || "",
                phone: subcontractor.phone || "",
                email: subcontractor.email || "",
                isActive: subcontractor.isActive,
            })
        }
    }, [open, subcontractor])

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

        setLoading(true)
        const result = await updateSubcontractor(subcontractor.id, {
            name: form.name,
            npwp: form.npwp,
            address: form.address,
            capabilities: form.capabilities,
            capacityUnitsPerDay: form.capacityUnitsPerDay
                ? parseInt(form.capacityUnitsPerDay)
                : null,
            contactPerson: form.contactPerson,
            phone: form.phone,
            email: form.email,
            isActive: form.isActive,
        })
        setLoading(false)

        if (result.success) {
            toast.success("Data subkontraktor berhasil diperbarui")
            onOpenChange(false)
        } else {
            toast.error(result.error || "Gagal memperbarui data")
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={NB.content}>
                <DialogHeader className={NB.header}>
                    <DialogTitle className={NB.title}>
                        <Factory className="h-5 w-5" />
                        Edit Subkontraktor
                    </DialogTitle>
                    <p className={NB.subtitle}>Ubah data mitra CMT</p>
                </DialogHeader>

                <ScrollArea className={NB.scroll}>
                    <div className="p-6 space-y-6">
                        {/* Active toggle */}
                        <div className="flex items-center justify-between px-4 py-3 border-2 border-black bg-zinc-50">
                            <span className="text-[10px] font-black uppercase tracking-widest">
                                Status Mitra
                            </span>
                            <button
                                type="button"
                                onClick={() =>
                                    setForm((f) => ({ ...f, isActive: !f.isActive }))
                                }
                                className={`px-3 py-1 border-2 border-black text-[9px] font-black uppercase tracking-wider transition-all ${
                                    form.isActive
                                        ? "bg-emerald-500 text-white"
                                        : "bg-red-100 text-red-700"
                                }`}
                            >
                                {form.isActive ? "AKTIF" : "NONAKTIF"}
                            </button>
                        </div>

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
                                        onChange={(e) =>
                                            setForm((f) => ({ ...f, name: e.target.value }))
                                        }
                                    />
                                </div>
                                <div>
                                    <label className={NB.label}>NPWP</label>
                                    <Input
                                        className={NB.inputMono}
                                        value={form.npwp}
                                        onChange={(e) =>
                                            setForm((f) => ({ ...f, npwp: e.target.value }))
                                        }
                                    />
                                </div>
                                <div>
                                    <label className={NB.label}>Alamat</label>
                                    <Textarea
                                        className={NB.textarea}
                                        value={form.address}
                                        onChange={(e) =>
                                            setForm((f) => ({ ...f, address: e.target.value }))
                                        }
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Capabilities */}
                        <div className={NB.section}>
                            <div className={NB.sectionHead}>
                                <span className={NB.sectionTitle}>Kapabilitas</span>
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
                                                        ? "bg-black text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                                                        : "bg-white text-black hover:bg-zinc-100"
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
                                            setForm((f) => ({
                                                ...f,
                                                capacityUnitsPerDay: e.target.value,
                                            }))
                                        }
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
                                            setForm((f) => ({
                                                ...f,
                                                contactPerson: e.target.value,
                                            }))
                                        }
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={NB.label}>Telepon</label>
                                        <Input
                                            className={NB.input}
                                            value={form.phone}
                                            onChange={(e) =>
                                                setForm((f) => ({
                                                    ...f,
                                                    phone: e.target.value,
                                                }))
                                            }
                                        />
                                    </div>
                                    <div>
                                        <label className={NB.label}>Email</label>
                                        <Input
                                            className={NB.input}
                                            type="email"
                                            value={form.email}
                                            onChange={(e) =>
                                                setForm((f) => ({
                                                    ...f,
                                                    email: e.target.value,
                                                }))
                                            }
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
                                {loading ? "Menyimpan..." : "Simpan Perubahan"}
                            </button>
                        </div>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}
