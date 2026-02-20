"use client"

import { useState, useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { Loader2, Pencil } from "lucide-react"
import { toast } from "sonner"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { NB } from "@/lib/dialog-styles"

interface CustomerEditDialogProps {
    customerId: string
    open: boolean
    onOpenChange: (open: boolean) => void
}

const defaultForm = {
    name: "",
    legalName: "",
    customerType: "COMPANY",
    npwp: "",
    nik: "",
    taxStatus: "PKP",
    isTaxable: true,
    phone: "",
    email: "",
    website: "",
    creditLimit: 0,
    creditTerm: 30,
    paymentTerm: "NET_30",
    creditStatus: "GOOD",
    currency: "IDR",
    isActive: true,
    isProspect: false,
}

export function CustomerEditDialog({ customerId, open, onOpenChange }: CustomerEditDialogProps) {
    const queryClient = useQueryClient()
    const [saving, setSaving] = useState(false)
    const [loading, setLoading] = useState(false)
    const [form, setForm] = useState(defaultForm)

    useEffect(() => {
        if (!open || !customerId) return
        setLoading(true)
        fetch(`/api/sales/customers/${customerId}`)
            .then(res => res.json())
            .then(payload => {
                if (payload.success && payload.data) {
                    const c = payload.data
                    setForm({
                        name: c.name || "",
                        legalName: c.legalName || "",
                        customerType: c.customerType || "COMPANY",
                        npwp: c.npwp || "",
                        nik: c.nik || "",
                        taxStatus: c.taxStatus || "PKP",
                        isTaxable: c.isTaxable ?? true,
                        phone: c.phone || "",
                        email: c.email || "",
                        website: c.website || "",
                        creditLimit: c.creditLimit || 0,
                        creditTerm: c.creditTerm || 30,
                        paymentTerm: c.paymentTerm || "NET_30",
                        creditStatus: c.creditStatus || "GOOD",
                        currency: c.currency || "IDR",
                        isActive: c.isActive ?? true,
                        isProspect: c.isProspect ?? false,
                    })
                }
            })
            .catch(() => toast.error("Gagal memuat data pelanggan"))
            .finally(() => setLoading(false))
    }, [open, customerId])

    const handleSave = async () => {
        if (!form.name.trim()) {
            toast.error("Nama pelanggan wajib diisi")
            return
        }

        setSaving(true)
        try {
            const res = await fetch(`/api/sales/customers/${customerId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: form.name.trim(),
                    legalName: form.legalName.trim() || null,
                    customerType: form.customerType,
                    npwp: form.npwp.trim() || null,
                    nik: form.nik.trim() || null,
                    taxStatus: form.taxStatus,
                    isTaxable: form.isTaxable,
                    phone: form.phone.trim() || null,
                    email: form.email.trim() || null,
                    website: form.website.trim() || null,
                    creditLimit: Number(form.creditLimit) || 0,
                    creditTerm: Number(form.creditTerm) || 30,
                    paymentTerm: form.paymentTerm,
                    creditStatus: form.creditStatus,
                    currency: form.currency,
                    isActive: form.isActive,
                    isProspect: form.isProspect,
                }),
            })

            const payload = await res.json()
            if (!payload.success) throw new Error(payload.error)

            toast.success("Data pelanggan berhasil diperbarui!")
            queryClient.invalidateQueries({ queryKey: queryKeys.customers.all })
            onOpenChange(false)
        } catch (err: any) {
            toast.error(err?.message || "Gagal memperbarui data pelanggan")
        } finally {
            setSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={NB.content}>
                <DialogHeader className={NB.header}>
                    <DialogTitle className={NB.title}>
                        <Pencil className="h-5 w-5" />
                        Edit Data Pelanggan
                    </DialogTitle>
                    <p className={NB.subtitle}>Perbarui informasi pelanggan</p>
                </DialogHeader>

                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
                        <span className="ml-3 text-sm font-bold text-zinc-500">Memuat data...</span>
                    </div>
                ) : (
                    <ScrollArea className={NB.scroll}>
                        <div className="p-6 space-y-6">
                            {/* Data Utama */}
                            <div className={NB.section}>
                                <div className={NB.sectionHead}>
                                    <span className={NB.sectionTitle}>Data Utama</span>
                                </div>
                                <div className={`${NB.sectionBody} grid gap-4 md:grid-cols-2`}>
                                    <div>
                                        <label className={NB.label}>
                                            Nama Pelanggan <span className={NB.labelRequired}>*</span>
                                        </label>
                                        <Input
                                            className={NB.input}
                                            value={form.name}
                                            onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
                                        />
                                    </div>
                                    <div>
                                        <label className={NB.label}>Nama Legal</label>
                                        <Input
                                            className={NB.input}
                                            value={form.legalName}
                                            onChange={(e) => setForm(p => ({ ...p, legalName: e.target.value }))}
                                        />
                                    </div>
                                    <div>
                                        <label className={NB.label}>Tipe Pelanggan</label>
                                        <Select value={form.customerType} onValueChange={(v) => setForm(p => ({ ...p, customerType: v }))}>
                                            <SelectTrigger className={NB.select}><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="COMPANY">Perusahaan</SelectItem>
                                                <SelectItem value="INDIVIDUAL">Perorangan</SelectItem>
                                                <SelectItem value="GOVERNMENT">Pemerintah</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <label className={NB.label}>Mata Uang</label>
                                        <Select value={form.currency} onValueChange={(v) => setForm(p => ({ ...p, currency: v }))}>
                                            <SelectTrigger className={NB.select}><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="IDR">IDR — Rupiah Indonesia</SelectItem>
                                                <SelectItem value="USD">USD — US Dollar</SelectItem>
                                                <SelectItem value="EUR">EUR — Euro</SelectItem>
                                                <SelectItem value="SGD">SGD — Singapore Dollar</SelectItem>
                                                <SelectItem value="MYR">MYR — Malaysian Ringgit</SelectItem>
                                                <SelectItem value="JPY">JPY — Japanese Yen</SelectItem>
                                                <SelectItem value="CNY">CNY — Chinese Yuan</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>

                            {/* Kontak */}
                            <div className={NB.section}>
                                <div className={NB.sectionHead}>
                                    <span className={NB.sectionTitle}>Informasi Kontak</span>
                                </div>
                                <div className={`${NB.sectionBody} grid gap-4 md:grid-cols-2`}>
                                    <div>
                                        <label className={NB.label}>Telepon</label>
                                        <Input
                                            className={NB.input}
                                            value={form.phone}
                                            onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))}
                                        />
                                    </div>
                                    <div>
                                        <label className={NB.label}>Email</label>
                                        <Input
                                            type="email"
                                            className={NB.input}
                                            value={form.email}
                                            onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))}
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className={NB.label}>Website</label>
                                        <Input
                                            className={NB.input}
                                            value={form.website}
                                            onChange={(e) => setForm(p => ({ ...p, website: e.target.value }))}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Pajak */}
                            <div className={NB.section}>
                                <div className={NB.sectionHead}>
                                    <span className={NB.sectionTitle}>Informasi Pajak</span>
                                </div>
                                <div className={`${NB.sectionBody} grid gap-4 md:grid-cols-2`}>
                                    <div>
                                        <label className={NB.label}>NPWP</label>
                                        <Input
                                            className={NB.inputMono}
                                            value={form.npwp}
                                            onChange={(e) => setForm(p => ({ ...p, npwp: e.target.value }))}
                                        />
                                    </div>
                                    <div>
                                        <label className={NB.label}>NIK</label>
                                        <Input
                                            className={NB.inputMono}
                                            value={form.nik}
                                            onChange={(e) => setForm(p => ({ ...p, nik: e.target.value }))}
                                        />
                                    </div>
                                    <div>
                                        <label className={NB.label}>Status Pajak</label>
                                        <Select value={form.taxStatus} onValueChange={(v) => setForm(p => ({ ...p, taxStatus: v }))}>
                                            <SelectTrigger className={NB.select}><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="PKP">PKP (Pengusaha Kena Pajak)</SelectItem>
                                                <SelectItem value="NON_PKP">Non-PKP</SelectItem>
                                                <SelectItem value="EXEMPT">Exempt</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>

                            {/* Kredit */}
                            <div className={NB.section}>
                                <div className={NB.sectionHead}>
                                    <span className={NB.sectionTitle}>Manajemen Kredit</span>
                                </div>
                                <div className={`${NB.sectionBody} grid gap-4 md:grid-cols-2`}>
                                    <div>
                                        <label className={NB.label}>Limit Kredit (Rp)</label>
                                        <Input
                                            type="number"
                                            className={NB.inputMono}
                                            value={form.creditLimit}
                                            onChange={(e) => setForm(p => ({ ...p, creditLimit: Number(e.target.value) || 0 }))}
                                        />
                                    </div>
                                    <div>
                                        <label className={NB.label}>Tenor Kredit (Hari)</label>
                                        <Input
                                            type="number"
                                            className={NB.inputMono}
                                            value={form.creditTerm}
                                            onChange={(e) => setForm(p => ({ ...p, creditTerm: Number(e.target.value) || 0 }))}
                                        />
                                    </div>
                                    <div>
                                        <label className={NB.label}>Term Pembayaran</label>
                                        <Select value={form.paymentTerm} onValueChange={(v) => setForm(p => ({ ...p, paymentTerm: v }))}>
                                            <SelectTrigger className={NB.select}><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="CASH">Cash</SelectItem>
                                                <SelectItem value="COD">COD</SelectItem>
                                                <SelectItem value="NET_15">Net 15</SelectItem>
                                                <SelectItem value="NET_30">Net 30</SelectItem>
                                                <SelectItem value="NET_45">Net 45</SelectItem>
                                                <SelectItem value="NET_60">Net 60</SelectItem>
                                                <SelectItem value="NET_90">Net 90</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <label className={NB.label}>Status Kredit</label>
                                        <Select value={form.creditStatus} onValueChange={(v) => setForm(p => ({ ...p, creditStatus: v }))}>
                                            <SelectTrigger className={NB.select}><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="GOOD">Baik</SelectItem>
                                                <SelectItem value="WATCH">Pantau</SelectItem>
                                                <SelectItem value="HOLD">Hold</SelectItem>
                                                <SelectItem value="BLOCKED">Blocked</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </ScrollArea>
                )}

                <DialogFooter className="px-6 py-4 border-t-2 border-black bg-zinc-50">
                    <div className={NB.footer}>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={saving}
                            className={NB.cancelBtn}
                        >
                            Batal
                        </Button>
                        <Button
                            type="button"
                            onClick={handleSave}
                            disabled={saving || loading}
                            className={NB.submitBtn}
                        >
                            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Simpan Perubahan
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
