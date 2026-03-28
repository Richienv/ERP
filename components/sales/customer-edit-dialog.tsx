"use client"

import { useState, useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { Loader2, Pencil, User, Phone, FileText, CreditCard } from "lucide-react"
import { toast } from "sonner"
import { usePaymentTerms } from "@/hooks/use-payment-terms"
import { useCurrencies } from "@/hooks/use-currencies"

import {
    NBDialog,
    NBDialogHeader,
    NBDialogBody,
    NBDialogFooter,
    NBSection,
    NBInput,
    NBSelect,
    NBCurrencyInput,
} from "@/components/ui/nb-dialog"

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
    const { data: paymentTermOptions = [] } = usePaymentTerms()
    const { data: currencies = [] } = useCurrencies()
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

    const currencyOptions = [
        { value: "IDR", label: "IDR — Rupiah Indonesia" },
        ...currencies.filter(c => c.code !== "IDR").map(c => ({ value: c.code, label: `${c.code} — ${c.name}` })),
    ]

    return (
        <NBDialog open={open} onOpenChange={onOpenChange}>
            <NBDialogHeader
                icon={Pencil}
                title="Edit Data Pelanggan"
                subtitle="Perbarui informasi pelanggan"
            />

            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
                    <span className="ml-3 text-sm font-bold text-zinc-500">Memuat data...</span>
                </div>
            ) : (
                <NBDialogBody>
                    <NBSection icon={User} title="Data Utama">
                        <div className="grid gap-3 md:grid-cols-2">
                            <NBInput
                                label="Nama Pelanggan"
                                required
                                value={form.name}
                                onChange={(v) => setForm(p => ({ ...p, name: v }))}
                            />
                            <NBInput
                                label="Nama Legal"
                                value={form.legalName}
                                onChange={(v) => setForm(p => ({ ...p, legalName: v }))}
                            />
                            <NBSelect
                                label="Tipe Pelanggan"
                                value={form.customerType}
                                onValueChange={(v) => setForm(p => ({ ...p, customerType: v }))}
                                options={[
                                    { value: "COMPANY", label: "Perusahaan" },
                                    { value: "INDIVIDUAL", label: "Perorangan" },
                                    { value: "GOVERNMENT", label: "Pemerintah" },
                                ]}
                            />
                            <NBSelect
                                label="Mata Uang"
                                value={form.currency}
                                onValueChange={(v) => setForm(p => ({ ...p, currency: v }))}
                                options={currencyOptions}
                            />
                        </div>
                    </NBSection>

                    <NBSection icon={Phone} title="Informasi Kontak">
                        <div className="grid gap-3 md:grid-cols-2">
                            <NBInput
                                label="Telepon"
                                value={form.phone}
                                onChange={(v) => setForm(p => ({ ...p, phone: v }))}
                            />
                            <NBInput
                                label="Email"
                                value={form.email}
                                onChange={(v) => setForm(p => ({ ...p, email: v }))}
                            />
                            <NBInput
                                label="Website"
                                value={form.website}
                                onChange={(v) => setForm(p => ({ ...p, website: v }))}
                                className="md:col-span-2"
                            />
                        </div>
                    </NBSection>

                    <NBSection icon={FileText} title="Informasi Pajak">
                        <div className="grid gap-3 md:grid-cols-2">
                            <NBInput
                                label="NPWP"
                                value={form.npwp}
                                onChange={(v) => setForm(p => ({ ...p, npwp: v }))}
                            />
                            <NBInput
                                label="NIK"
                                value={form.nik}
                                onChange={(v) => setForm(p => ({ ...p, nik: v }))}
                            />
                            <NBSelect
                                label="Status Pajak"
                                value={form.taxStatus}
                                onValueChange={(v) => setForm(p => ({ ...p, taxStatus: v }))}
                                options={[
                                    { value: "PKP", label: "PKP (Pengusaha Kena Pajak)" },
                                    { value: "NON_PKP", label: "Non-PKP" },
                                    { value: "EXEMPT", label: "Exempt" },
                                ]}
                            />
                        </div>
                    </NBSection>

                    <NBSection icon={CreditCard} title="Manajemen Kredit">
                        <div className="grid gap-3 md:grid-cols-2">
                            <NBCurrencyInput
                                label="Limit Kredit"
                                value={String(form.creditLimit)}
                                onChange={(v) => setForm(p => ({ ...p, creditLimit: Number(v) || 0 }))}
                            />
                            <NBInput
                                label="Tenor Kredit (Hari)"
                                type="number"
                                value={String(form.creditTerm)}
                                onChange={(v) => setForm(p => ({ ...p, creditTerm: Number(v) || 0 }))}
                            />
                            <NBSelect
                                label="Term Pembayaran"
                                value={form.paymentTerm}
                                onValueChange={(v) => setForm(p => ({ ...p, paymentTerm: v }))}
                                options={paymentTermOptions.map(t => ({ value: t.code, label: t.name }))}
                            />
                            <NBSelect
                                label="Status Kredit"
                                value={form.creditStatus}
                                onValueChange={(v) => setForm(p => ({ ...p, creditStatus: v }))}
                                options={[
                                    { value: "GOOD", label: "Baik" },
                                    { value: "WATCH", label: "Pantau" },
                                    { value: "HOLD", label: "Hold" },
                                    { value: "BLOCKED", label: "Blocked" },
                                ]}
                            />
                        </div>
                    </NBSection>
                </NBDialogBody>
            )}

            <NBDialogFooter
                onCancel={() => onOpenChange(false)}
                onSubmit={handleSave}
                submitting={saving}
                submitLabel="Simpan Perubahan"
                disabled={loading}
            />
        </NBDialog>
    )
}
