"use client"

import { useState, useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { createFixedAsset, createFixedAssetCategory } from "@/lib/actions/finance-fixed-assets"
import { useFixedAssetCategories, useSuppliersForFA, useGLAccountsForFA } from "@/hooks/use-fixed-assets"
import { SelectItem } from "@/components/ui/select"
import { toast } from "sonner"
import { Building, Hash, Calendar, DollarSign, MapPin, Plus, Tag } from "lucide-react"
import {
    NBDialog,
    NBDialogHeader,
    NBDialogBody,
    NBDialogFooter,
    NBSection,
    NBInput,
    NBSelect,
    NBTextarea,
    NBCurrencyInput,
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
    const [catDialogOpen, setCatDialogOpen] = useState(false)

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
        fundingSource: "OPENING_BALANCE" as "OPENING_BALANCE" | "BANK" | "CASH" | "CREDIT",
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
        if (form.fundingSource === "CREDIT" && !form.supplierId) {
            toast.error("Sumber dana Kredit Supplier memerlukan pilihan supplier")
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
                fundingSource: form.fundingSource,
            })
            if (result.success) {
                toast.success("Aset tetap berhasil didaftarkan")
                queryClient.invalidateQueries({ queryKey: queryKeys.fixedAssets.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.chartAccounts.all })
                onOpenChange(false)
                setForm({ name: "", categoryId: "", purchaseDate: "", capitalizationDate: "", supplierId: "", purchaseCost: "", residualValue: "0", usefulLifeMonths: "", depreciationMethod: "STRAIGHT_LINE", depreciationFrequency: "MONTHLY", depreciationStartDate: "", location: "", department: "", serialNumber: "", notes: "", fundingSource: "OPENING_BALANCE" })
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
                        <div className="relative">
                            <NBSelect
                                label="Kategori"
                                required
                                value={form.categoryId}
                                onValueChange={v => setForm(p => ({ ...p, categoryId: v }))}
                                placeholder={categories.length === 0 ? "Belum ada kategori — klik + Buat" : "Pilih kategori"}
                            >
                                {categories.map((c: any) => (
                                    <SelectItem key={c.id} value={c.id}>{c.name} ({c.code})</SelectItem>
                                ))}
                            </NBSelect>
                            <button
                                type="button"
                                onClick={() => setCatDialogOpen(true)}
                                className="absolute top-0 right-0 text-[10px] font-bold uppercase tracking-wider text-orange-600 hover:text-orange-700 flex items-center gap-0.5"
                            >
                                <Plus className="h-3 w-3" />
                                Buat Baru
                            </button>
                        </div>
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
                    <div className="grid grid-cols-1 gap-4">
                        <NBSelect
                            label="Sumber Dana (Jurnal COA)"
                            value={form.fundingSource}
                            onValueChange={(v: any) => setForm(p => ({ ...p, fundingSource: v }))}
                            options={[
                                { value: "OPENING_BALANCE", label: "Saldo Awal (sudah dimiliki) → CR 3900" },
                                { value: "BANK", label: "Transfer Bank → CR 1110 Bank BCA" },
                                { value: "CASH", label: "Kas → CR 1050 Kas Kecil" },
                                { value: "CREDIT", label: "Kredit Supplier → CR 2000 Hutang Usaha" },
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

            <CreateCategoryDialog
                open={catDialogOpen}
                onOpenChange={setCatDialogOpen}
                onCreated={(newId) => {
                    setForm(p => ({ ...p, categoryId: newId }))
                }}
            />
        </NBDialog>
    )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Inline Create Category Dialog
// Menghubungkan kategori ke COA yang dipilih user — setiap posting
// jurnal untuk aset di kategori ini akan memakai akun COA tersebut.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface CreateCategoryDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onCreated: (categoryId: string) => void
}

function CreateCategoryDialog({ open, onOpenChange, onCreated }: CreateCategoryDialogProps) {
    const queryClient = useQueryClient()
    const { data: glData } = useGLAccountsForFA()
    const [saving, setSaving] = useState(false)

    const [cat, setCat] = useState({
        name: "",
        code: "",
        defaultUsefulLife: "60",
        defaultResidualPct: "0",
        defaultMethod: "STRAIGHT_LINE" as "STRAIGHT_LINE" | "DECLINING_BALANCE" | "UNITS_OF_PRODUCTION",
        assetAccountId: "",
        accDepAccountId: "",
        depExpAccountId: "",
    })

    const accounts = glData?.accounts || []
    const assetAccounts = accounts.filter((a: any) => a.type === "ASSET")
    const expenseAccounts = accounts.filter((a: any) => a.type === "EXPENSE")

    const handleSubmit = async () => {
        if (!cat.name || !cat.code || !cat.assetAccountId || !cat.accDepAccountId || !cat.depExpAccountId) {
            toast.error("Lengkapi semua field wajib termasuk pilihan COA")
            return
        }
        setSaving(true)
        try {
            const result = await createFixedAssetCategory({
                name: cat.name,
                code: cat.code,
                defaultMethod: cat.defaultMethod,
                defaultUsefulLife: Number(cat.defaultUsefulLife) || 60,
                defaultResidualPct: Number(cat.defaultResidualPct) || 0,
                assetAccountId: cat.assetAccountId,
                accDepAccountId: cat.accDepAccountId,
                depExpAccountId: cat.depExpAccountId,
            })
            if (result.success && "category" in result && result.category) {
                toast.success("Kategori dibuat & terhubung ke COA")
                await queryClient.invalidateQueries({ queryKey: queryKeys.fixedAssetCategories.all })
                onCreated(result.category.id)
                onOpenChange(false)
                setCat({
                    name: "",
                    code: "",
                    defaultUsefulLife: "60",
                    defaultResidualPct: "0",
                    defaultMethod: "STRAIGHT_LINE",
                    assetAccountId: "",
                    accDepAccountId: "",
                    depExpAccountId: "",
                })
            } else {
                toast.error((result as any).error || "Gagal membuat kategori")
            }
        } catch {
            toast.error("Terjadi kesalahan")
        } finally {
            setSaving(false)
        }
    }

    return (
        <NBDialog open={open} onOpenChange={onOpenChange} size="default">
            <NBDialogHeader
                icon={Tag}
                title="Buat Kategori Aset Tetap"
                subtitle="Hubungkan kategori ke akun COA agar jurnal penyusutan otomatis mengalir ke akun yang benar"
            />

            <NBDialogBody>
                <NBSection icon={Hash} title="Identitas Kategori">
                    <div className="grid grid-cols-2 gap-4">
                        <NBInput
                            label="Nama Kategori"
                            required
                            placeholder="Mesin Jahit"
                            value={cat.name}
                            onChange={v => setCat(p => ({ ...p, name: v }))}
                        />
                        <NBInput
                            label="Kode"
                            required
                            placeholder="FA-JAHIT"
                            value={cat.code}
                            onChange={v => setCat(p => ({ ...p, code: v.toUpperCase() }))}
                        />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <NBInput
                            label="Masa Manfaat (bulan)"
                            type="number"
                            placeholder="60"
                            value={cat.defaultUsefulLife}
                            onChange={v => setCat(p => ({ ...p, defaultUsefulLife: v }))}
                        />
                        <NBInput
                            label="% Nilai Residu"
                            type="number"
                            placeholder="0"
                            value={cat.defaultResidualPct}
                            onChange={v => setCat(p => ({ ...p, defaultResidualPct: v }))}
                        />
                        <NBSelect
                            label="Metode Penyusutan"
                            value={cat.defaultMethod}
                            onValueChange={(v: any) => setCat(p => ({ ...p, defaultMethod: v }))}
                            options={[
                                { value: "STRAIGHT_LINE", label: "Garis Lurus" },
                                { value: "DECLINING_BALANCE", label: "Saldo Menurun" },
                                { value: "UNITS_OF_PRODUCTION", label: "Unit Produksi" },
                            ]}
                        />
                    </div>
                </NBSection>

                <NBSection icon={DollarSign} title="Hubungan ke Chart of Accounts (COA)">
                    <NBSelect
                        label="Akun Aset Tetap (Debit saat registrasi)"
                        required
                        value={cat.assetAccountId}
                        onValueChange={v => setCat(p => ({ ...p, assetAccountId: v }))}
                        placeholder={assetAccounts.length === 0 ? "Tidak ada akun ASSET — seed COA dulu" : "Pilih akun aset dari COA"}
                    >
                        {assetAccounts.map((a: any) => (
                            <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>
                        ))}
                    </NBSelect>
                    <NBSelect
                        label="Akun Akumulasi Penyusutan (Credit saat penyusutan)"
                        required
                        value={cat.accDepAccountId}
                        onValueChange={v => setCat(p => ({ ...p, accDepAccountId: v }))}
                        placeholder="Pilih akun akumulasi penyusutan"
                    >
                        {assetAccounts.map((a: any) => (
                            <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>
                        ))}
                    </NBSelect>
                    <NBSelect
                        label="Akun Beban Penyusutan (Debit saat penyusutan)"
                        required
                        value={cat.depExpAccountId}
                        onValueChange={v => setCat(p => ({ ...p, depExpAccountId: v }))}
                        placeholder={expenseAccounts.length === 0 ? "Tidak ada akun EXPENSE — seed COA dulu" : "Pilih akun beban penyusutan"}
                    >
                        {expenseAccounts.map((a: any) => (
                            <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>
                        ))}
                    </NBSelect>
                    <p className="text-[10px] text-zinc-500 leading-relaxed">
                        Pilihan COA di atas akan dipakai oleh semua aset di kategori ini saat posting jurnal registrasi &amp; penyusutan.
                        Setiap perubahan nilai aset akan tampil pada buku besar akun yang dipilih.
                    </p>
                </NBSection>
            </NBDialogBody>

            <NBDialogFooter
                onCancel={() => onOpenChange(false)}
                onSubmit={handleSubmit}
                submitting={saving}
                submitLabel="Simpan Kategori"
            />
        </NBDialog>
    )
}
