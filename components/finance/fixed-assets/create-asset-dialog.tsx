"use client"

import { useState, useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { createFixedAsset } from "@/lib/actions/finance-fixed-assets"
import { useFixedAssetCategories, useGLAccountsForFA, useSuppliersForFA } from "@/hooks/use-fixed-assets"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { NB } from "@/lib/dialog-styles"
import { toast } from "sonner"
import { Loader2, Building, Hash, Calendar, DollarSign, MapPin } from "lucide-react"

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
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={NB.contentWide}>
                <DialogHeader className={NB.header}>
                    <DialogTitle className={NB.title}>
                        <Building className="h-5 w-5" /> Daftarkan Aset Tetap
                    </DialogTitle>
                    <p className={NB.subtitle}>Registrasi aset baru ke dalam daftar aset tetap perusahaan</p>
                </DialogHeader>

                <ScrollArea className={NB.scroll}>
                    <div className="p-6 space-y-0">
                        {/* INFORMASI DASAR */}
                        <section className={NB.section}>
                            <div className={NB.sectionHead}>
                                <Hash className="h-3.5 w-3.5" />
                                <span className={NB.sectionTitle}>Informasi Dasar</span>
                            </div>
                            <div className={NB.sectionBody}>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={NB.label}>Nama Aset <span className={NB.labelRequired}>*</span></label>
                                        <Input className={NB.input} placeholder="Mesin CNC Milling" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                                    </div>
                                    <div>
                                        <label className={NB.label}>Kategori <span className={NB.labelRequired}>*</span></label>
                                        <Select value={form.categoryId} onValueChange={v => setForm(p => ({ ...p, categoryId: v }))}>
                                            <SelectTrigger className={NB.select}><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                                            <SelectContent>
                                                {categories.map((c: any) => (
                                                    <SelectItem key={c.id} value={c.id}>{c.name} ({c.code})</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={NB.label}>Supplier</label>
                                        <Select value={form.supplierId} onValueChange={v => setForm(p => ({ ...p, supplierId: v }))}>
                                            <SelectTrigger className={NB.select}><SelectValue placeholder="Pilih supplier" /></SelectTrigger>
                                            <SelectContent>
                                                {suppliers.map((s: any) => (
                                                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <label className={NB.label}>Nomor Seri</label>
                                        <Input className={NB.inputMono} placeholder="SN-12345" value={form.serialNumber} onChange={e => setForm(p => ({ ...p, serialNumber: e.target.value }))} />
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* TANGGAL */}
                        <section className={NB.section}>
                            <div className={NB.sectionHead}>
                                <Calendar className="h-3.5 w-3.5" />
                                <span className={NB.sectionTitle}>Tanggal</span>
                            </div>
                            <div className={NB.sectionBody}>
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className={NB.label}>Tanggal Pembelian <span className={NB.labelRequired}>*</span></label>
                                        <Input type="date" className={NB.input} value={form.purchaseDate} onChange={e => setForm(p => ({ ...p, purchaseDate: e.target.value }))} />
                                    </div>
                                    <div>
                                        <label className={NB.label}>Tanggal Kapitalisasi</label>
                                        <Input type="date" className={NB.input} value={form.capitalizationDate} onChange={e => setForm(p => ({ ...p, capitalizationDate: e.target.value }))} />
                                    </div>
                                    <div>
                                        <label className={NB.label}>Mulai Penyusutan <span className={NB.labelRequired}>*</span></label>
                                        <Input type="date" className={NB.input} value={form.depreciationStartDate} onChange={e => setForm(p => ({ ...p, depreciationStartDate: e.target.value }))} />
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* NILAI & PENYUSUTAN */}
                        <section className={NB.section}>
                            <div className={NB.sectionHead}>
                                <DollarSign className="h-3.5 w-3.5" />
                                <span className={NB.sectionTitle}>Nilai & Penyusutan</span>
                            </div>
                            <div className={NB.sectionBody}>
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className={NB.label}>Harga Perolehan <span className={NB.labelRequired}>*</span></label>
                                        <Input type="number" className={NB.inputMono} placeholder="0" value={form.purchaseCost} onChange={e => setForm(p => ({ ...p, purchaseCost: e.target.value }))} />
                                    </div>
                                    <div>
                                        <label className={NB.label}>Nilai Residu</label>
                                        <Input type="number" className={NB.inputMono} placeholder="0" value={form.residualValue} onChange={e => setForm(p => ({ ...p, residualValue: e.target.value }))} />
                                    </div>
                                    <div>
                                        <label className={NB.label}>Masa Manfaat (bulan) <span className={NB.labelRequired}>*</span></label>
                                        <Input type="number" className={NB.inputMono} placeholder="60" value={form.usefulLifeMonths} onChange={e => setForm(p => ({ ...p, usefulLifeMonths: e.target.value }))} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={NB.label}>Metode Penyusutan</label>
                                        <Select value={form.depreciationMethod} onValueChange={(v: any) => setForm(p => ({ ...p, depreciationMethod: v }))}>
                                            <SelectTrigger className={NB.select}><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="STRAIGHT_LINE">Garis Lurus</SelectItem>
                                                <SelectItem value="DECLINING_BALANCE">Saldo Menurun</SelectItem>
                                                <SelectItem value="UNITS_OF_PRODUCTION">Unit Produksi</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <label className={NB.label}>Frekuensi Penyusutan</label>
                                        <Select value={form.depreciationFrequency} onValueChange={(v: any) => setForm(p => ({ ...p, depreciationFrequency: v }))}>
                                            <SelectTrigger className={NB.select}><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="MONTHLY">Bulanan</SelectItem>
                                                <SelectItem value="YEARLY">Tahunan</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* LOKASI */}
                        <section className={NB.section}>
                            <div className={NB.sectionHead}>
                                <MapPin className="h-3.5 w-3.5" />
                                <span className={NB.sectionTitle}>Lokasi & Keterangan</span>
                            </div>
                            <div className={NB.sectionBody}>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={NB.label}>Lokasi</label>
                                        <Input className={NB.input} placeholder="Gedung A - Lt. 2" value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} />
                                    </div>
                                    <div>
                                        <label className={NB.label}>Departemen</label>
                                        <Input className={NB.input} placeholder="Produksi" value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))} />
                                    </div>
                                </div>
                                <div>
                                    <label className={NB.label}>Catatan</label>
                                    <textarea className={`w-full ${NB.textarea}`} rows={2} placeholder="Catatan tambahan..." value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
                                </div>
                            </div>
                        </section>

                        {/* FOOTER */}
                        <div className="flex items-center justify-end gap-3 pt-4 px-1">
                            <Button type="button" onClick={() => onOpenChange(false)} className={NB.cancelBtn}>Batal</Button>
                            <Button type="button" onClick={handleSubmit} disabled={saving} className={NB.submitBtn}>
                                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Simpan Aset
                            </Button>
                        </div>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}
