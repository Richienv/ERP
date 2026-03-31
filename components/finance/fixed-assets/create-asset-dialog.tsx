"use client"

import { useState, useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { createFixedAsset } from "@/lib/actions/finance-fixed-assets"
import { useFixedAssetCategories, useSuppliersForFA } from "@/hooks/use-fixed-assets"
import { SelectItem } from "@/components/ui/select"
import { toast } from "sonner"
import { Building, Hash, Calendar, DollarSign, MapPin } from "lucide-react"
import {
    NBDialog,
    NBDialogHeader,
    NBDialogBody,
    NBDialogFooter,
    NBSection,
    NBInput,
    NBCurrencyInput,
    NBSelect,
    NBTextarea,
} from "@/components/ui/nb-dialog"

interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function CreateAssetDialog({ open, onOpenChange }: Props) {
    const queryClient = useQueryClient()
    const { data: catData } = useFixedAssetCategories()
    const { data: suppData } = useSuppliersForFA()
    const [saving, setSaving] = useState(false)

    const [form, setForm] = useState({
        name: "",
        categoryId: "",
        purchaseDate: "",
        capitalizationDate: "",
        supplierId: "",
        purchaseCost: "",
        residualValue: "0",
        usefulLifeMonths: "",
        depreciationMethod: "STRAIGHT_LINE" as "STRAIGHT_LINE" | "DECLINING_BALANCE" | "UNITS_OF_PRODUCTION",
        depreciationFrequency: "MONTHLY" as "MONTHLY" | "YEARLY",
        depreciationStartDate: "",
        location: "",
        department: "",
        serialNumber: "",
        notes: "",
    })

    // Auto-populate defaults when category changes
    useEffect(() => {
        if (!form.categoryId || !catData?.categories) return
        const cat = catData.categories.find((c: any) => c.id === form.categoryId)
        if (cat) {
            setForm(prev => ({
                ...prev,
                depreciationMethod: cat.defaultMethod,
                usefulLifeMonths: String(cat.defaultUsefulLife),
                residualValue: prev.purchaseCost
                    ? String(Math.round(Number(prev.purchaseCost) * Number(cat.defaultResidualPct) / 100))
                    : "0",
            }))
        }
    }, [form.categoryId, catData])

    const handleSubmit = async () => {
        if (!form.name || !form.categoryId || !form.purchaseDate || !form.purchaseCost || !form.usefulLifeMonths || !form.depreciationStartDate) {
            toast.error("Lengkapi semua field wajib")
            return
        }
        setSaving(true)
        try {
            const result = await createFixedAsset({
                name: form.name,
                categoryId: form.categoryId,
                purchaseDate: form.purchaseDate,
                capitalizationDate: form.capitalizationDate || form.purchaseDate,
                supplierId: form.supplierId || undefined,
                purchaseCost: Number(form.purchaseCost),
                residualValue: Number(form.residualValue || 0),
                usefulLifeMonths: Number(form.usefulLifeMonths),
                depreciationMethod: form.depreciationMethod,
                depreciationFrequency: form.depreciationFrequency,
                depreciationStartDate: form.depreciationStartDate,
                location: form.location || undefined,
                department: form.department || undefined,
                serialNumber: form.serialNumber || undefined,
                notes: form.notes || undefined,
            })
            if (result.success) {
                toast.success("Aset tetap berhasil didaftarkan")
                queryClient.invalidateQueries({ queryKey: queryKeys.fixedAssets.all })
                onOpenChange(false)
                setForm({ name: "", categoryId: "", purchaseDate: "", capitalizationDate: "", supplierId: "", purchaseCost: "", residualValue: "0", usefulLifeMonths: "", depreciationMethod: "STRAIGHT_LINE", depreciationFrequency: "MONTHLY", depreciationStartDate: "", location: "", department: "", serialNumber: "", notes: "" })
            } else {
                toast.error(result.error || "Gagal membuat aset")
            }
        } catch {
            toast.error("Terjadi kesalahan")
        } finally {
            setSaving(false)
        }
    }

    const categories = catData?.categories || []
    const suppliers = suppData?.suppliers || []

    return (
        <NBDialog open={open} onOpenChange={onOpenChange} size="wide">
            <NBDialogHeader icon={Building} title="Daftarkan Aset Tetap" subtitle="Registrasi aset baru ke dalam daftar aset tetap perusahaan" />

            <NBDialogBody>
                {/* INFORMASI DASAR */}
                <NBSection icon={Hash} title="Informasi Dasar">
                    <div className="grid grid-cols-2 gap-4">
                        <NBInput
                            label="Nama Aset"
                            required
                            placeholder="Mesin CNC Milling"
                            value={form.name}
                            onChange={v => setForm(p => ({ ...p, name: v }))}
                        />
                        <NBSelect
                            label="Kategori"
                            required
                            value={form.categoryId}
                            onValueChange={v => setForm(p => ({ ...p, categoryId: v }))}
                            placeholder="Pilih kategori"
                        >
                            {categories.map((c: any) => (
                                <SelectItem key={c.id} value={c.id}>{c.name} ({c.code})</SelectItem>
                            ))}
                        </NBSelect>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <NBSelect
                            label="Supplier"
                            value={form.supplierId}
                            onValueChange={v => setForm(p => ({ ...p, supplierId: v }))}
                            placeholder="Pilih supplier"
                        >
                            {suppliers.map((s: any) => (
                                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                            ))}
                        </NBSelect>
                        <NBInput
                            label="Nomor Seri"
                            placeholder="SN-12345"
                            value={form.serialNumber}
                            onChange={v => setForm(p => ({ ...p, serialNumber: v }))}
                        />
                    </div>
                </NBSection>

                {/* TANGGAL */}
                <NBSection icon={Calendar} title="Tanggal">
                    <div className="grid grid-cols-3 gap-4">
                        <NBInput
                            label="Tanggal Pembelian"
                            required
                            type="date"
                            value={form.purchaseDate}
                            onChange={v => setForm(p => ({ ...p, purchaseDate: v }))}
                        />
                        <NBInput
                            label="Tanggal Kapitalisasi"
                            type="date"
                            value={form.capitalizationDate}
                            onChange={v => setForm(p => ({ ...p, capitalizationDate: v }))}
                        />
                        <NBInput
                            label="Mulai Penyusutan"
                            required
                            type="date"
                            value={form.depreciationStartDate}
                            onChange={v => setForm(p => ({ ...p, depreciationStartDate: v }))}
                        />
                    </div>
                </NBSection>

                {/* NILAI & PENYUSUTAN */}
                <NBSection icon={DollarSign} title="Nilai & Penyusutan">
                    <div className="grid grid-cols-3 gap-4">
                        <NBCurrencyInput
                            label="Harga Perolehan"
                            required
                            value={form.purchaseCost}
                            onChange={v => setForm(p => ({ ...p, purchaseCost: v }))}
                        />
                        <NBCurrencyInput
                            label="Nilai Residu"
                            value={form.residualValue}
                            onChange={v => setForm(p => ({ ...p, residualValue: v }))}
                        />
                        <NBInput
                            label="Masa Manfaat (bulan)"
                            required
                            type="number"
                            placeholder="60"
                            value={form.usefulLifeMonths}
                            onChange={v => setForm(p => ({ ...p, usefulLifeMonths: v }))}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <NBSelect
                            label="Metode Penyusutan"
                            value={form.depreciationMethod}
                            onValueChange={(v: any) => setForm(p => ({ ...p, depreciationMethod: v }))}
                            options={[
                                { value: "STRAIGHT_LINE", label: "Garis Lurus" },
                                { value: "DECLINING_BALANCE", label: "Saldo Menurun" },
                                { value: "UNITS_OF_PRODUCTION", label: "Unit Produksi" },
                            ]}
                        />
                        <NBSelect
                            label="Frekuensi Penyusutan"
                            value={form.depreciationFrequency}
                            onValueChange={(v: any) => setForm(p => ({ ...p, depreciationFrequency: v }))}
                            options={[
                                { value: "MONTHLY", label: "Bulanan" },
                                { value: "YEARLY", label: "Tahunan" },
                            ]}
                        />
                    </div>
                </NBSection>

                {/* LOKASI & KETERANGAN */}
                <NBSection icon={MapPin} title="Lokasi & Keterangan" optional>
                    <div className="grid grid-cols-2 gap-4">
                        <NBInput
                            label="Lokasi"
                            placeholder="Gedung A - Lt. 2"
                            value={form.location}
                            onChange={v => setForm(p => ({ ...p, location: v }))}
                        />
                        <NBInput
                            label="Departemen"
                            placeholder="Produksi"
                            value={form.department}
                            onChange={v => setForm(p => ({ ...p, department: v }))}
                        />
                    </div>
                    <NBTextarea
                        label="Catatan"
                        rows={2}
                        placeholder="Catatan tambahan..."
                        value={form.notes}
                        onChange={v => setForm(p => ({ ...p, notes: v }))}
                    />
                </NBSection>
            </NBDialogBody>

            <NBDialogFooter
                onCancel={() => onOpenChange(false)}
                onSubmit={handleSubmit}
                submitting={saving}
                submitLabel="Simpan Aset"
            />
        </NBDialog>
    )
}
