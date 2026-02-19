"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ComboboxWithCreate } from "@/components/ui/combobox-with-create"
import { Plus, Package, Tag, Barcode, AlertTriangle, Loader2, Boxes, DollarSign } from "lucide-react"
import {
    CODE_CATEGORIES,
    CODE_PRODUCT_TYPES,
    buildStructuredCode,
    generateBarcode,
    CATEGORY_TO_PRODUCT_TYPE,
} from "@/lib/inventory-utils"
import { createProduct } from "@/app/actions/inventory"
import { createUnit, createBrand, createColor, createSupplier } from "@/lib/actions/master-data"
import { useBrands, useColors, useUnits, useSuppliers, useInvalidateMasterData } from "@/hooks/use-master-data"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { NB } from "@/lib/dialog-styles"

export function MaterialInputForm() {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const queryClient = useQueryClient()

    // DB-backed master data
    const { data: dbBrands = [], isLoading: brandsLoading } = useBrands()
    const { data: dbColors = [], isLoading: colorsLoading } = useColors()
    const { data: dbUnits = [], isLoading: unitsLoading } = useUnits()
    const { data: dbSuppliers = [] } = useSuppliers()
    const { invalidateBrands, invalidateColors, invalidateUnits, invalidateSuppliers } = useInvalidateMasterData()

    const brandOptions = useMemo(() =>
        dbBrands.map((b: { code: string; name: string }) => ({ value: b.code, label: b.name, subtitle: b.code })), [dbBrands])
    const colorOptions = useMemo(() =>
        dbColors.map((c: { code: string; name: string }) => ({ value: c.code, label: c.name, subtitle: c.code })), [dbColors])
    const unitOptions = useMemo(() =>
        dbUnits.map((u: { code: string; name: string }) => ({ value: u.code, label: u.name, subtitle: u.code })), [dbUnits])
    const supplierOptions = useMemo(() =>
        dbSuppliers.map((s: { id: string; name: string; code: string | null }) => ({ value: s.id, label: s.name, subtitle: s.code || '' })), [dbSuppliers])

    // Form state
    const [name, setName] = useState("")
    const [unit, setUnit] = useState("")
    const [costPrice, setCostPrice] = useState("")
    const [initialStock, setInitialStock] = useState("")
    const [minStock, setMinStock] = useState("10")
    const [supplierId, setSupplierId] = useState("")
    const [notes, setNotes] = useState("")

    // Code builder state
    const [codeCat, setCodeCat] = useState("RAW")
    const [codeType, setCodeType] = useState("YRN")
    const [codeBrand, setCodeBrand] = useState("XX")
    const [codeColor, setCodeColor] = useState("NAT")

    const availableTypes = useMemo(() => CODE_PRODUCT_TYPES[codeCat] || [], [codeCat])
    const currentTypeValid = availableTypes.some(t => t.code === codeType)
    const effectiveType = currentTypeValid ? codeType : (availableTypes[0]?.code || "OTR")

    const previewCode = buildStructuredCode(codeCat, effectiveType, codeBrand, codeColor, 1)
    const previewBarcode = generateBarcode(previewCode.replace(/-001$/, '-XXX'))

    const handleReset = () => {
        setName(""); setUnit(""); setCostPrice(""); setInitialStock("")
        setMinStock("10"); setSupplierId(""); setNotes("")
        setCodeCat("RAW"); setCodeType("YRN"); setCodeBrand("XX"); setCodeColor("NAT")
    }

    const handleSubmit = async () => {
        if (!name.trim()) return
        setLoading(true)
        try {
            const result = await createProduct({
                name,
                code: "",
                description: notes,
                categoryId: "",
                productType: CATEGORY_TO_PRODUCT_TYPE[codeCat] as any || "RAW_MATERIAL",
                codeCategory: codeCat as any,
                codeType: effectiveType,
                codeBrand,
                codeColor,
                unit: unit || "pcs",
                costPrice: Number(costPrice) || 0,
                sellingPrice: 0,
                minStock: Number(minStock) || 10,
                maxStock: 0,
                reorderLevel: Number(minStock) || 10,
                barcode: "",
            })
            if (result.success) {
                toast.success("Material berhasil ditambahkan", {
                    description: `Kode: ${result.data?.code || previewCode}`,
                })
                handleReset()
                setOpen(false)
                queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.inventoryDashboard.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.categories.all })
            } else {
                toast.error((result as any).error || "Gagal menyimpan material")
            }
        } catch {
            toast.error("Terjadi kesalahan saat menyimpan")
        } finally {
            setLoading(false)
        }
    }

    const handleCreateBrand = async (n: string) => {
        const brand = await createBrand(n.substring(0, 2).toUpperCase(), n)
        await invalidateBrands()
        toast.success(`Brand "${n}" berhasil dibuat`)
        return brand.code
    }

    const handleCreateColor = async (n: string) => {
        const color = await createColor(n.substring(0, 3).toUpperCase(), n)
        await invalidateColors()
        toast.success(`Warna "${n}" berhasil dibuat`)
        return color.code
    }

    const handleCreateUnit = async (n: string) => {
        const u = await createUnit(n.toLowerCase().replace(/\s+/g, ''), n)
        await invalidateUnits()
        toast.success(`Satuan "${n}" berhasil dibuat`)
        return u.code
    }

    const handleCreateSupplier = async (n: string) => {
        const code = "SUP-" + n.substring(0, 3).toUpperCase() + "-" + Date.now().toString().slice(-4)
        const supplier = await createSupplier(code, n)
        await invalidateSuppliers()
        queryClient.invalidateQueries({ queryKey: queryKeys.vendors.all })
        toast.success(`Supplier "${n}" berhasil dibuat`)
        return supplier.id
    }

    return (
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) handleReset() }}>
            <DialogTrigger asChild>
                <Button className="h-10 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-emerald-500 text-white font-black hover:bg-emerald-600 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] transition-all px-6 rounded-none uppercase text-xs tracking-wider">
                    <Plus className="mr-2 h-4 w-4" /> Tambah Material
                </Button>
            </DialogTrigger>
            <DialogContent className={NB.content}>
                <DialogHeader className={NB.header}>
                    <DialogTitle className={NB.title}>
                        <Package className="h-5 w-5" /> Input Material Baru
                    </DialogTitle>
                    <p className={NB.subtitle}>Masukkan data material inventory baru secara manual.</p>
                </DialogHeader>

                <ScrollArea className={NB.scroll}>
                    <div className="p-5 space-y-4">

                        {/* ====== CODE BUILDER ====== */}
                        <div className={NB.section}>
                            <div className="bg-zinc-900 text-white px-4 py-2 border-b-2 border-black flex items-center gap-2">
                                <Tag className="h-4 w-4" />
                                <span className="text-xs font-black uppercase tracking-widest">Kode Material Terstruktur</span>
                            </div>

                            <div className="p-4 space-y-3">
                                <div className="grid grid-cols-4 gap-3">
                                    {/* Segment 1: Category */}
                                    <div>
                                        <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1 block">Kategori</label>
                                        <Select
                                            value={codeCat}
                                            onValueChange={(v) => {
                                                setCodeCat(v)
                                                const types = CODE_PRODUCT_TYPES[v] || []
                                                if (types.length > 0 && !types.some(t => t.code === codeType)) {
                                                    setCodeType(types[0].code)
                                                }
                                            }}
                                        >
                                            <SelectTrigger className="border-2 border-black font-mono font-black text-xs h-9 w-full rounded-none">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {CODE_CATEGORIES.map(c => (
                                                    <SelectItem key={c.code} value={c.code}>
                                                        <span className="font-mono font-bold">{c.code}</span>
                                                        <span className="text-zinc-400 ml-1.5 text-[10px]">{c.label}</span>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Segment 2: Type */}
                                    <div>
                                        <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1 block">Tipe</label>
                                        <Select
                                            value={currentTypeValid ? codeType : (availableTypes[0]?.code || "")}
                                            onValueChange={setCodeType}
                                        >
                                            <SelectTrigger className="border-2 border-black font-mono font-black text-xs h-9 w-full rounded-none">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {availableTypes.map(t => (
                                                    <SelectItem key={t.code} value={t.code}>
                                                        <span className="font-mono font-bold">{t.code}</span>
                                                        <span className="text-zinc-400 ml-1.5 text-[10px]">{t.label}</span>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Segment 3: Brand — DB-backed */}
                                    <div>
                                        <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1 block">Brand</label>
                                        <ComboboxWithCreate
                                            options={brandOptions}
                                            value={codeBrand}
                                            onChange={setCodeBrand}
                                            placeholder="Pilih brand..."
                                            searchPlaceholder="Cari brand..."
                                            emptyMessage="Brand tidak ditemukan."
                                            createLabel="+ Buat Brand Baru"
                                            onCreate={handleCreateBrand}
                                            isLoading={brandsLoading}
                                        />
                                    </div>

                                    {/* Segment 4: Color — DB-backed */}
                                    <div>
                                        <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1 block">Warna</label>
                                        <ComboboxWithCreate
                                            options={colorOptions}
                                            value={codeColor}
                                            onChange={setCodeColor}
                                            placeholder="Pilih warna..."
                                            searchPlaceholder="Cari warna..."
                                            emptyMessage="Warna tidak ditemukan."
                                            createLabel="+ Buat Warna Baru"
                                            onCreate={handleCreateColor}
                                            isLoading={colorsLoading}
                                        />
                                    </div>
                                </div>

                                {/* Live Code Preview */}
                                <div className="bg-zinc-50 border-2 border-black p-3 flex items-center justify-between">
                                    <div>
                                        <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 block mb-0.5">Preview Kode</span>
                                        <span className="font-mono font-black text-base tracking-wider">{previewCode}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 block mb-0.5">Barcode</span>
                                        <div className="flex items-center gap-1.5">
                                            <Barcode className="h-3.5 w-3.5 text-zinc-400" />
                                            <span className="font-mono font-bold text-[11px] text-zinc-600">{previewBarcode}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ====== BASIC INFO ====== */}
                        <div className={NB.section}>
                            <div className={`${NB.sectionHead} border-l-4 border-l-emerald-400 bg-emerald-50`}>
                                <Package className="h-4 w-4" />
                                <span className={NB.sectionTitle}>Informasi Dasar</span>
                            </div>
                            <div className={NB.sectionBody}>
                                <div>
                                    <label className={NB.label}>Nama Material <span className={NB.labelRequired}>*</span></label>
                                    <Input
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Contoh: Benang Katun Putih Grade A"
                                        className={NB.input}
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className={NB.label}>Satuan (Unit) <span className={NB.labelRequired}>*</span></label>
                                        <ComboboxWithCreate
                                            options={unitOptions}
                                            value={unit}
                                            onChange={setUnit}
                                            placeholder="Pilih satuan..."
                                            searchPlaceholder="Cari satuan..."
                                            emptyMessage="Satuan tidak ditemukan."
                                            createLabel="+ Buat Satuan Baru"
                                            onCreate={handleCreateUnit}
                                            isLoading={unitsLoading}
                                        />
                                    </div>
                                    <div>
                                        <label className={NB.label}>Supplier Utama</label>
                                        <ComboboxWithCreate
                                            options={supplierOptions}
                                            value={supplierId}
                                            onChange={setSupplierId}
                                            placeholder="Pilih supplier..."
                                            searchPlaceholder="Cari supplier..."
                                            emptyMessage="Supplier tidak ditemukan."
                                            createLabel="+ Tambah Supplier Baru"
                                            onCreate={handleCreateSupplier}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ====== STOCK & PRICING ====== */}
                        <div className="grid grid-cols-2 gap-4">
                            {/* Stock */}
                            <div className={NB.section}>
                                <div className={`${NB.sectionHead} border-l-4 border-l-blue-400 bg-blue-50`}>
                                    <Boxes className="h-4 w-4" />
                                    <span className={NB.sectionTitle}>Stok</span>
                                </div>
                                <div className={NB.sectionBody}>
                                    <div>
                                        <label className={NB.label}>Stok Awal</label>
                                        <Input
                                            type="number"
                                            value={initialStock}
                                            onChange={(e) => setInitialStock(e.target.value)}
                                            placeholder="0"
                                            className={NB.inputMono}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-wider text-red-500 mb-1 block">
                                            <AlertTriangle className="h-3 w-3 inline mr-1" />Min. Stock Alert
                                        </label>
                                        <Input
                                            type="number"
                                            value={minStock}
                                            onChange={(e) => setMinStock(e.target.value)}
                                            placeholder="10"
                                            className="border-2 border-red-300 bg-red-50 font-mono font-bold h-10 rounded-none text-red-600 placeholder:text-red-300"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Pricing */}
                            <div className={NB.section}>
                                <div className={`${NB.sectionHead} border-l-4 border-l-amber-400 bg-amber-50`}>
                                    <DollarSign className="h-4 w-4" />
                                    <span className={NB.sectionTitle}>Harga & Modal</span>
                                </div>
                                <div className={NB.sectionBody}>
                                    <div>
                                        <label className={NB.label}>Harga Beli (Satuan)</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-zinc-400">Rp</span>
                                            <Input
                                                type="number"
                                                value={costPrice}
                                                onChange={(e) => setCostPrice(e.target.value)}
                                                placeholder="0"
                                                className={NB.inputMono + " pl-8"}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ====== NOTES ====== */}
                        <div>
                            <label className={NB.label}>Catatan Tambahan</label>
                            <Textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Detail tambahan..."
                                className={NB.textarea}
                            />
                        </div>

                        {/* ====== FOOTER ====== */}
                        <div className={NB.footer}>
                            <Button type="button" variant="outline" className={NB.cancelBtn} onClick={() => setOpen(false)}>
                                Batal
                            </Button>
                            <Button onClick={handleSubmit} disabled={loading || !name.trim()} className={NB.submitBtn}>
                                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan...</> : "Simpan Material"}
                            </Button>
                        </div>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}
