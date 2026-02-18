"use client"

import { useState, useMemo } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
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
import { ComboboxWithCreate, type ComboboxOption } from "@/components/ui/combobox-with-create"
import { Plus, Package, DollarSign, BarChart3, Save, Loader2, Tag, Barcode, Factory, ShoppingCart, Boxes, Layers } from "lucide-react"
import { createProduct } from "@/app/actions/inventory"
import { createProductSchema, type CreateProductInput } from "@/lib/validations"
import {
    generateBarcode,
    CODE_CATEGORIES,
    CODE_PRODUCT_TYPES,
    CATEGORY_TO_PRODUCT_TYPE,
    buildStructuredCode,
} from "@/lib/inventory-utils"
import { createUnit, createBrand, createColor, createCategory } from "@/lib/actions/master-data"
import { useBrands, useColors, useUnits, useMasterCategories, useInvalidateMasterData } from "@/hooks/use-master-data"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

const CATEGORY_STYLE: Record<string, { icon: typeof Factory; bg: string; border: string; text: string }> = {
    MFG: { icon: Factory, bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-700' },
    TRD: { icon: ShoppingCart, bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-700' },
    RAW: { icon: Boxes, bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-700' },
    WIP: { icon: Layers, bg: 'bg-violet-50', border: 'border-violet-300', text: 'text-violet-700' },
}

const WORKFLOW_HINTS: Record<string, { borderColor: string; bgColor: string; textColor: string; text: string }> = {
    MFG: { borderColor: 'border-l-blue-400', bgColor: 'bg-blue-50', textColor: 'text-blue-700', text: 'Stok masuk via Order Produksi (MO) — membutuhkan BOM. Block manual stock add.' },
    TRD: { borderColor: 'border-l-amber-400', bgColor: 'bg-amber-50', textColor: 'text-amber-700', text: 'Stok masuk via jalur Pengadaan (PR → PO → GRN). Block manual stock add.' },
    RAW: { borderColor: 'border-l-emerald-400', bgColor: 'bg-emerald-50', textColor: 'text-emerald-700', text: 'Stok masuk via Pengadaan. Dikonsumsi oleh BOM dalam proses produksi.' },
    WIP: { borderColor: 'border-l-violet-400', bgColor: 'bg-violet-50', textColor: 'text-violet-700', text: 'Intermediate — dibuat oleh proses produksi, dikonsumsi oleh proses berikutnya.' },
}

export function ProductCreateDialog() {
    const [open, setOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const queryClient = useQueryClient()

    // DB-backed master data
    const { data: dbBrands = [], isLoading: brandsLoading } = useBrands()
    const { data: dbColors = [], isLoading: colorsLoading } = useColors()
    const { data: dbUnits = [], isLoading: unitsLoading } = useUnits()
    const { data: dbCategories = [], isLoading: categoriesLoading } = useMasterCategories()
    const { invalidateBrands, invalidateColors, invalidateUnits, invalidateCategories } = useInvalidateMasterData()

    // Map DB data to combobox options
    const brandOptions: ComboboxOption[] = useMemo(() =>
        dbBrands.map((b: { code: string; name: string }) => ({ value: b.code, label: b.name, subtitle: b.code })), [dbBrands])
    const colorOptions: ComboboxOption[] = useMemo(() =>
        dbColors.map((c: { code: string; name: string }) => ({ value: c.code, label: c.name, subtitle: c.code })), [dbColors])
    const unitOptions: ComboboxOption[] = useMemo(() =>
        dbUnits.map((u: { code: string; name: string }) => ({ value: u.code, label: u.name, subtitle: u.code })), [dbUnits])
    const categoryOptions: ComboboxOption[] = useMemo(() =>
        dbCategories.map((c: { id: string; code: string; name: string }) => ({ value: c.id, label: c.name, subtitle: c.code })), [dbCategories])

    const form = useForm<CreateProductInput>({
        resolver: zodResolver(createProductSchema),
        defaultValues: {
            code: "", name: "", description: "", categoryId: "",
            productType: "TRADING",
            codeCategory: "TRD",
            codeType: "OTR",
            codeBrand: "XX",
            codeColor: "NAT",
            unit: "pcs", costPrice: 0, sellingPrice: 0,
            minStock: 0, maxStock: 0, reorderLevel: 0, barcode: "",
        },
    })

    const watchCat = form.watch("codeCategory") || "TRD"
    const watchType = form.watch("codeType") || "OTR"
    const watchBrand = form.watch("codeBrand") || "XX"
    const watchColor = form.watch("codeColor") || "NAT"

    const availableTypes = useMemo(() => CODE_PRODUCT_TYPES[watchCat] || [], [watchCat])

    const currentTypeValid = availableTypes.some(t => t.code === watchType)
    if (!currentTypeValid && availableTypes.length > 0) {
        queueMicrotask(() => form.setValue("codeType", availableTypes[0].code))
    }

    const effectiveType = currentTypeValid ? watchType : (availableTypes[0]?.code || "OTR")
    const previewCode = buildStructuredCode(watchCat, effectiveType, watchBrand, watchColor, 1)
    const previewBarcode = generateBarcode(previewCode.replace(/-001$/, '-XXX'))

    const catStyle = CATEGORY_STYLE[watchCat] || CATEGORY_STYLE.TRD
    const hint = WORKFLOW_HINTS[watchCat] || WORKFLOW_HINTS.TRD
    const CatIcon = catStyle.icon

    const handleSubmit = async (data: CreateProductInput) => {
        setIsSubmitting(true)
        try {
            const result = await createProduct(data)
            if (result.success) {
                toast.success("Produk berhasil dibuat", {
                    description: `Kode: ${result.data?.code || previewCode}`,
                })
                form.reset()
                setOpen(false)
                queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.inventoryDashboard.all })
            } else {
                toast.error((result as any).error || "Gagal membuat produk")
            }
        } catch {
            toast.error("Terjadi kesalahan saat menyimpan produk")
        } finally {
            setIsSubmitting(false)
        }
    }

    const watchCost = form.watch("costPrice") ?? 0
    const watchSell = form.watch("sellingPrice") ?? 0
    const margin = watchCost > 0 ? ((watchSell - watchCost) / watchCost) * 100 : 0

    // Create handlers for inline creation
    const handleCreateBrand = async (name: string) => {
        const code = name.substring(0, 2).toUpperCase()
        const brand = await createBrand(code, name)
        await invalidateBrands()
        toast.success(`Brand "${name}" berhasil dibuat`)
        return brand.code
    }

    const handleCreateColor = async (name: string) => {
        const code = name.substring(0, 3).toUpperCase()
        const color = await createColor(code, name)
        await invalidateColors()
        toast.success(`Warna "${name}" berhasil dibuat`)
        return color.code
    }

    const handleCreateUnit = async (name: string) => {
        const code = name.toLowerCase().replace(/\s+/g, '')
        const unit = await createUnit(code, name)
        await invalidateUnits()
        toast.success(`Satuan "${name}" berhasil dibuat`)
        return unit.code
    }

    const handleCreateCategory = async (name: string) => {
        const code = name.substring(0, 3).toUpperCase()
        const category = await createCategory(code, name)
        await invalidateCategories()
        toast.success(`Kategori "${name}" berhasil dibuat`)
        return category.id
    }

    return (
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) form.reset() }}>
            <DialogTrigger asChild>
                <Button className="bg-black text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-black uppercase text-xs tracking-wider">
                    <Plus className="mr-2 h-4 w-4" /> Produk Baru
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl p-0 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-none overflow-hidden gap-0">
                {/* Header */}
                <DialogHeader className="bg-black text-white px-6 py-4">
                    <DialogTitle className="text-lg font-black uppercase tracking-wider text-white flex items-center gap-2">
                        <Plus className="h-5 w-5" />
                        Tambah Produk Baru
                    </DialogTitle>
                    <p className="text-zinc-400 text-[11px] font-bold mt-0.5">
                        Kode otomatis: [Kategori]-[Tipe]-[Brand]-[Warna]-[Seq]
                    </p>
                </DialogHeader>

                <ScrollArea className="max-h-[72vh]">
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="p-5 space-y-5">

                        {/* ====== CODE BUILDER ====== */}
                        <div className="border-2 border-black">
                            <div className="bg-zinc-900 text-white px-4 py-2 border-b-2 border-black flex items-center gap-2">
                                <Tag className="h-4 w-4" />
                                <span className="text-xs font-black uppercase tracking-widest">Kode Produk Terstruktur</span>
                            </div>

                            <div className="p-4 space-y-3">
                                <div className="grid grid-cols-4 gap-3">
                                    {/* Segment 1: Category (fixed list — code builder categories) */}
                                    <div>
                                        <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1 block">Kategori</label>
                                        <Select
                                            value={watchCat}
                                            onValueChange={v => {
                                                form.setValue("codeCategory", v as any)
                                                form.setValue("productType", CATEGORY_TO_PRODUCT_TYPE[v] as any)
                                            }}
                                        >
                                            <SelectTrigger className="border-2 border-black font-mono font-black text-xs h-9 w-full">
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

                                    {/* Segment 2: Product Type (depends on category) */}
                                    <div>
                                        <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1 block">Tipe Produk</label>
                                        <Select
                                            value={currentTypeValid ? watchType : (availableTypes[0]?.code || "")}
                                            onValueChange={v => form.setValue("codeType", v)}
                                        >
                                            <SelectTrigger className="border-2 border-black font-mono font-black text-xs h-9 w-full">
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

                                    {/* Segment 3: Brand — DB-backed with create */}
                                    <div>
                                        <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1 block">Brand</label>
                                        <ComboboxWithCreate
                                            options={brandOptions}
                                            value={watchBrand}
                                            onChange={v => form.setValue("codeBrand", v)}
                                            placeholder="Pilih brand..."
                                            searchPlaceholder="Cari brand..."
                                            emptyMessage="Brand tidak ditemukan."
                                            createLabel="+ Buat Brand Baru"
                                            onCreate={handleCreateBrand}
                                            isLoading={brandsLoading}
                                        />
                                    </div>

                                    {/* Segment 4: Color — DB-backed with create */}
                                    <div>
                                        <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1 block">Warna</label>
                                        <ComboboxWithCreate
                                            options={colorOptions}
                                            value={watchColor}
                                            onChange={v => form.setValue("codeColor", v)}
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

                                {/* Workflow enforcement hint */}
                                <div className={`px-3 py-2 border-l-4 text-[10px] font-bold ${hint.borderColor} ${hint.bgColor} ${hint.textColor}`}>
                                    <div className="flex items-center gap-1.5">
                                        <CatIcon className="h-3.5 w-3.5 flex-shrink-0" />
                                        {hint.text}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ====== BASIC INFO ====== */}
                        <div className="border-2 border-black">
                            <div className="bg-zinc-100 px-4 py-2 border-b-2 border-black flex items-center gap-2">
                                <Package className="h-4 w-4" />
                                <span className="text-xs font-black uppercase tracking-widest">Informasi Dasar</span>
                            </div>
                            <div className="p-4 space-y-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1 block">
                                        Nama Produk <span className="text-red-500">*</span>
                                    </label>
                                    <Input
                                        placeholder="Contoh: Kaos Polos Cotton Combed 30s"
                                        {...form.register("name")}
                                        className="border-2 border-black font-bold h-10"
                                    />
                                    {form.formState.errors.name && (
                                        <p className="text-[10px] text-red-500 font-bold mt-0.5">{form.formState.errors.name.message}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1 block">Deskripsi</label>
                                    <Textarea
                                        placeholder="Deskripsi produk (opsional)"
                                        {...form.register("description")}
                                        className="border-2 border-black font-medium min-h-[60px]"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1 block">Kategori Inventori</label>
                                        <ComboboxWithCreate
                                            options={categoryOptions}
                                            value={form.watch("categoryId") || ""}
                                            onChange={v => form.setValue("categoryId", v)}
                                            placeholder="Pilih kategori..."
                                            searchPlaceholder="Cari kategori..."
                                            emptyMessage="Kategori tidak ditemukan."
                                            createLabel="+ Buat Kategori Baru"
                                            onCreate={handleCreateCategory}
                                            isLoading={categoriesLoading}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1 block">
                                            Satuan <span className="text-red-500">*</span>
                                        </label>
                                        <ComboboxWithCreate
                                            options={unitOptions}
                                            value={form.watch("unit") || "pcs"}
                                            onChange={v => form.setValue("unit", v)}
                                            placeholder="Pilih satuan..."
                                            searchPlaceholder="Cari satuan..."
                                            emptyMessage="Satuan tidak ditemukan."
                                            createLabel="+ Buat Satuan Baru"
                                            onCreate={handleCreateUnit}
                                            isLoading={unitsLoading}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ====== PRICING ====== */}
                        <div className="border-2 border-black">
                            <div className="bg-zinc-100 px-4 py-2 border-b-2 border-black flex items-center gap-2">
                                <DollarSign className="h-4 w-4" />
                                <span className="text-xs font-black uppercase tracking-widest">Informasi Harga</span>
                            </div>
                            <div className="p-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1 block">Harga Beli (Rp)</label>
                                        <Input
                                            type="number"
                                            placeholder="0"
                                            {...form.register("costPrice", { valueAsNumber: true })}
                                            className="border-2 border-black font-mono font-bold h-10"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1 block">Harga Jual (Rp)</label>
                                        <Input
                                            type="number"
                                            placeholder="0"
                                            {...form.register("sellingPrice", { valueAsNumber: true })}
                                            className="border-2 border-black font-mono font-bold h-10"
                                        />
                                    </div>
                                </div>
                                {watchCost > 0 && watchSell > 0 && (
                                    <div className="mt-3 bg-emerald-50 border-2 border-emerald-200 p-3 flex items-center justify-between">
                                        <span className="text-xs font-bold text-emerald-700">Margin Keuntungan</span>
                                        <span className={`font-black text-sm ${margin >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                                            {margin.toFixed(1)}% &middot; Rp {(watchSell - watchCost).toLocaleString('id-ID')}/unit
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ====== STOCK MANAGEMENT ====== */}
                        <div className="border-2 border-black">
                            <div className="bg-zinc-100 px-4 py-2 border-b-2 border-black flex items-center gap-2">
                                <BarChart3 className="h-4 w-4" />
                                <span className="text-xs font-black uppercase tracking-widest">Manajemen Stok</span>
                            </div>
                            <div className="p-4">
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1 block">Stok Minimum</label>
                                        <Input
                                            type="number"
                                            placeholder="0"
                                            {...form.register("minStock", { valueAsNumber: true })}
                                            className="border-2 border-black font-mono font-bold h-10"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1 block">Stok Maksimum</label>
                                        <Input
                                            type="number"
                                            placeholder="0"
                                            {...form.register("maxStock", { valueAsNumber: true })}
                                            className="border-2 border-black font-mono font-bold h-10"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1 block">Reorder Point</label>
                                        <Input
                                            type="number"
                                            placeholder="0"
                                            {...form.register("reorderLevel", { valueAsNumber: true })}
                                            className="border-2 border-black font-mono font-bold h-10"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ====== ACTIONS ====== */}
                        <div className="flex items-center justify-between pt-1">
                            <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 border-2 text-[10px] font-black uppercase tracking-wider ${catStyle.bg} ${catStyle.border} ${catStyle.text}`}>
                                    <CatIcon className="h-3 w-3" />
                                    {CODE_CATEGORIES.find(c => c.code === watchCat)?.label}
                                </span>
                                <span className="font-mono font-bold text-xs text-zinc-400">{previewCode}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setOpen(false)}
                                    className="border-2 border-black font-black uppercase text-xs tracking-wider px-6 h-9"
                                >
                                    Batal
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="bg-black text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-black uppercase text-xs tracking-wider px-8 h-9"
                                >
                                    {isSubmitting ? (
                                        <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Menyimpan...</>
                                    ) : (
                                        <><Save className="h-4 w-4 mr-2" /> Simpan Produk</>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </form>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}
