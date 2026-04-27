"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import {
    NBDialog,
    NBDialogHeader,
    NBSection,
    NBInput,
    NBCurrencyInput,
    NBTextarea,
} from "@/components/ui/nb-dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { ComboboxWithCreate, type ComboboxOption } from "@/components/ui/combobox-with-create"
import { Plus, Package, DollarSign, BarChart3, Save, Loader2, Tag, Barcode, Factory, ShoppingCart, Boxes, Layers, Copy, Check, AlertTriangle, Info } from "lucide-react"
import { createProduct } from "@/app/actions/inventory"
import { createProductSchema, type CreateProductInput } from "@/lib/validations"
import {
    generateBarcode,
    CODE_CATEGORIES,
    CODE_PRODUCT_TYPES,
    CATEGORY_TO_PRODUCT_TYPE,
    buildStructuredCode,
} from "@/lib/inventory-utils"
import { createUnit, createBrand, createColor } from "@/lib/actions/master-data"
import { useBrands, useColors, useUnits, useInvalidateMasterData } from "@/hooks/use-master-data"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { NB } from "@/lib/dialog-styles"
import { cn } from "@/lib/utils"

// ─── Constants ───

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

const MARGIN_PRESETS = [20, 30, 50, 100]

// Category name pattern → unit code (verified against INDONESIAN_UNITS)
const CATEGORY_UNIT_MAP: Record<string, string> = {
    kain: "m", fabric: "m",
    aksesoris: "pcs", accessories: "pcs",
    benang: "roll", thread: "roll",
    packaging: "pcs",
    garmen: "pcs", garment: "pcs",
}

// Category name pattern → description template
const CATEGORY_DESC_TEMPLATES: Record<string, string> = {
    kain: "Jenis kain: ___. Komposisi: ___. Lebar: ___ cm. Gramasi: ___ gsm.",
    fabric: "Jenis kain: ___. Komposisi: ___. Lebar: ___ cm. Gramasi: ___ gsm.",
    aksesoris: "Ukuran: ___. Material: ___. Warna: ___.",
    accessories: "Ukuran: ___. Material: ___. Warna: ___.",
    benang: "Jenis benang: ___. Nomor: ___. Komposisi: ___.",
    thread: "Jenis benang: ___. Nomor: ___. Komposisi: ___.",
    packaging: "Jenis: ___. Ukuran: ___. Material: ___.",
    garmen: "Jenis: ___. Bahan: ___. Ukuran: ___.",
    garment: "Jenis: ___. Bahan: ___. Ukuran: ___.",
}

const INITIAL_AUTO_TAGS = { unit: false, desc: false, reorder: false, maxStock: false, sellPrice: false }
const INITIAL_MANUALLY_SET = { unit: false, desc: false, reorder: false, maxStock: false, sellPrice: false }

export function ProductCreateDialog({ autoOpen, onAutoOpenConsumed, hideTrigger }: { autoOpen?: boolean; onAutoOpenConsumed?: () => void; hideTrigger?: boolean } = {}) {
    const [open, setOpen] = useState(false)

    useEffect(() => {
        if (autoOpen && !open) {
            setOpen(true)
            onAutoOpenConsumed?.()
        }
    }, [autoOpen]) // eslint-disable-line react-hooks/exhaustive-deps
    const [isSubmitting, setIsSubmitting] = useState(false)
    const queryClient = useQueryClient()

    // Smart defaults state
    const [marginPreset, setMarginPreset] = useState<number | null>(null)
    const [autoTags, setAutoTags] = useState(INITIAL_AUTO_TAGS)
    const [copiedBarcode, setCopiedBarcode] = useState(false)
    const manuallySet = useRef({ ...INITIAL_MANUALLY_SET })

    // DB-backed master data
    const { data: dbBrands = [], isLoading: brandsLoading } = useBrands()
    const { data: dbColors = [], isLoading: colorsLoading } = useColors()
    const { data: dbUnits = [], isLoading: unitsLoading } = useUnits()
    const { invalidateBrands, invalidateColors, invalidateUnits } = useInvalidateMasterData()

    // Map DB data to combobox options
    const brandOptions: ComboboxOption[] = useMemo(() =>
        dbBrands.map((b: { code: string; name: string }) => ({ value: b.code, label: b.name, subtitle: b.code })), [dbBrands])
    const colorOptions: ComboboxOption[] = useMemo(() =>
        dbColors.map((c: { code: string; name: string }) => ({ value: c.code, label: c.name, subtitle: c.code })), [dbColors])
    const unitOptions: ComboboxOption[] = useMemo(() =>
        dbUnits.map((u: { code: string; name: string }) => ({ value: u.code, label: u.name, subtitle: u.code })), [dbUnits])

    const form = useForm<CreateProductInput>({
        resolver: zodResolver(createProductSchema),
        defaultValues: {
            code: "", name: "", description: "",
            productType: "TRADING",
            codeCategory: "TRD",
            codeType: "OTR",
            codeBrand: "XX",
            codeColor: "NAT",
            unit: "pcs", costPrice: 0, sellingPrice: null,
            minStock: 0, maxStock: 0, reorderLevel: 0, barcode: "",
        },
    })

    // ─── Watch values ───
    const watchCat = form.watch("codeCategory") || "TRD"
    const watchType = form.watch("codeType") || "OTR"
    const watchBrand = form.watch("codeBrand") || "XX"
    const watchColor = form.watch("codeColor") || "NAT"
    const watchCost = form.watch("costPrice") ?? 0
    const watchSell = form.watch("sellingPrice") ?? 0
    const watchMinStock = form.watch("minStock") ?? 0
    const watchMaxStock = form.watch("maxStock") ?? 0
    const watchReorder = form.watch("reorderLevel") ?? 0
    const watchName = form.watch("name") || ""

    // ─── Code builder logic ───
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

    // ─── Computed values ───
    const margin = watchCost > 0 ? ((watchSell - watchCost) / watchCost) * 100 : 0

    // Duplicate name check (best-effort from cache)
    const duplicateWarning = useMemo(() => {
        if (watchName.length < 3) return null
        const cached = queryClient.getQueryData<{ products: Array<{ name: string }> }>(queryKeys.products.list())
        if (!cached?.products) return null
        const nameLower = watchName.toLowerCase()
        const match = cached.products.find((p: any) => {
            const pLower = (p.name || "").toLowerCase()
            return pLower === nameLower || (nameLower.length >= 5 && (pLower.includes(nameLower) || nameLower.includes(pLower)))
        })
        return match?.name ?? null
    }, [watchName]) // eslint-disable-line react-hooks/exhaustive-deps

    // ─── Reset helper ───
    const resetAutoFill = () => {
        setMarginPreset(null)
        setAutoTags({ ...INITIAL_AUTO_TAGS })
        setCopiedBarcode(false)
        manuallySet.current = { ...INITIAL_MANUALLY_SET }
    }

    // ─── Effect: Margin preset + HPP → selling price ───
    useEffect(() => {
        if (marginPreset !== null && watchCost > 0) {
            const suggested = Math.ceil(watchCost * (1 + marginPreset / 100))
            form.setValue("sellingPrice", suggested)
            setAutoTags(prev => ({ ...prev, sellPrice: true }))
        }
    }, [watchCost, marginPreset]) // eslint-disable-line react-hooks/exhaustive-deps

    // ─── Effect: MinStock → reorder + maxStock auto-suggest ───
    useEffect(() => {
        if (watchMinStock > 0) {
            if (!manuallySet.current.reorder) {
                form.setValue("reorderLevel", Math.ceil(watchMinStock * 1.5))
                setAutoTags(prev => ({ ...prev, reorder: true }))
            }
            if (!manuallySet.current.maxStock) {
                form.setValue("maxStock", watchMinStock * 3)
                setAutoTags(prev => ({ ...prev, maxStock: true }))
            }
        }
    }, [watchMinStock]) // eslint-disable-line react-hooks/exhaustive-deps

    // ─── Handlers ───

    const handleSubmit = async (data: CreateProductInput) => {
        setIsSubmitting(true)
        try {
            const result = await createProduct(data)
            if (result.success) {
                toast.success("Produk berhasil dibuat", {
                    description: `Kode: ${result.data?.code || previewCode}`,
                })
                form.reset()
                resetAutoFill()
                setOpen(false)
                queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.inventoryDashboard.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.sidebarActions.all })
            } else {
                toast.error((result as any).error || "Gagal membuat produk")
            }
        } catch {
            toast.error("Terjadi kesalahan saat menyimpan produk")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleMarginClick = (pct: number) => {
        if (marginPreset === pct) {
            setMarginPreset(null)
            setAutoTags(prev => ({ ...prev, sellPrice: false }))
        } else {
            setMarginPreset(pct)
            manuallySet.current.sellPrice = false
        }
    }

    const handleCopyBarcode = async () => {
        try {
            await navigator.clipboard.writeText(previewBarcode)
            setCopiedBarcode(true)
            setTimeout(() => setCopiedBarcode(false), 2000)
        } catch {
            toast.error("Gagal menyalin barcode")
        }
    }

    // Create handlers for inline creation
    const handleCreateBrand = async (name: string) => {
        try {
            const code = name.substring(0, 2).toUpperCase()
            const brand = await createBrand(code, name)
            await invalidateBrands()
            toast.success(`Brand "${name}" berhasil dibuat`)
            return brand.code
        } catch {
            toast.error("Gagal membuat brand")
            return ""
        }
    }

    const handleCreateColor = async (name: string) => {
        try {
            const code = name.substring(0, 3).toUpperCase()
            const color = await createColor(code, name)
            await invalidateColors()
            toast.success(`Warna "${name}" berhasil dibuat`)
            return color.code
        } catch {
            toast.error("Gagal membuat warna")
            return ""
        }
    }

    const handleCreateUnit = async (name: string) => {
        try {
            const code = name.toLowerCase().replace(/\s+/g, '')
            const unit = await createUnit(code, name)
            await invalidateUnits()
            toast.success(`Satuan "${name}" berhasil dibuat`)
            return unit.code
        } catch {
            toast.error("Gagal membuat satuan")
            return ""
        }
    }

    return (
        <>
            {!hideTrigger && (
                <Button
                    onClick={() => setOpen(true)}
                    className={NB.triggerBtn}
                >
                    <Plus className="mr-2 h-4 w-4" /> Produk Baru
                </Button>
            )}

            <NBDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { form.reset(); resetAutoFill() } }}>
                <NBDialogHeader
                    icon={Plus}
                    title="Tambah Produk Baru"
                    subtitle="Kode otomatis: [Kategori]-[Tipe]-[Brand]-[Warna]-[Seq]"
                />

                <div className="overflow-y-auto max-h-[72vh]">
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="p-4 space-y-4">

                        {/* ====== CODE BUILDER (special card, not a section) ====== */}
                        <div className="border border-zinc-200">
                            <div className="bg-zinc-100 px-3 py-1.5 border-b border-zinc-200 flex items-center gap-2">
                                <Tag className="h-3.5 w-3.5 text-zinc-400" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Kode Produk Terstruktur</span>
                            </div>

                            <div className="p-3 space-y-3">
                                <div className="grid grid-cols-4 gap-3">
                                    {/* Segment 1: Category */}
                                    <div>
                                        <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1 block">Kategori</label>
                                        <Select
                                            value={watchCat}
                                            onValueChange={v => {
                                                form.setValue("codeCategory", v as any)
                                                form.setValue("productType", CATEGORY_TO_PRODUCT_TYPE[v] as any)
                                            }}
                                        >
                                            <SelectTrigger className="border border-zinc-300 font-mono font-black text-xs h-8 w-full rounded-none">
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

                                    {/* Segment 2: Product Type */}
                                    <div>
                                        <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1 block">Tipe Produk</label>
                                        <Select
                                            value={currentTypeValid ? watchType : (availableTypes[0]?.code || "")}
                                            onValueChange={v => form.setValue("codeType", v)}
                                        >
                                            <SelectTrigger className="border border-zinc-300 font-mono font-black text-xs h-8 w-full rounded-none">
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

                                    {/* Segment 3: Brand */}
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

                                    {/* Segment 4: Color */}
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

                                {/* Live Code Preview + Barcode */}
                                <div className="bg-zinc-50 border border-zinc-200 p-3 flex items-center justify-between">
                                    <div>
                                        <div className="flex items-center gap-1.5 mb-0.5">
                                            <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">Preview Kode</span>
                                            <span className="text-[8px] font-bold text-orange-400 uppercase tracking-widest border border-orange-200 bg-orange-50 px-1 py-px">otomatis</span>
                                        </div>
                                        <span className="font-mono font-black text-base tracking-wider">{previewCode}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 block mb-0.5">Barcode</span>
                                        <div className="flex items-center gap-1.5">
                                            <Barcode className="h-3.5 w-3.5 text-zinc-400" />
                                            <span className="font-mono font-bold text-[11px] text-zinc-600">{previewBarcode}</span>
                                            <button
                                                type="button"
                                                onClick={handleCopyBarcode}
                                                className="p-0.5 hover:bg-zinc-200 transition-colors"
                                                title="Salin barcode"
                                            >
                                                {copiedBarcode
                                                    ? <Check className="h-3 w-3 text-emerald-500" />
                                                    : <Copy className="h-3 w-3 text-zinc-400" />
                                                }
                                            </button>
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

                        {/* ====== INFORMASI DASAR ====== */}
                        <NBSection icon={Package} title="Informasi Dasar">
                            <NBInput
                                label="Nama Produk"
                                required
                                value={watchName}
                                onChange={v => form.setValue("name", v)}
                                placeholder="Kaos Polos Cotton Combed 30s"
                            />
                            {form.formState.errors.name && (
                                <p className={NB.error}>{form.formState.errors.name.message}</p>
                            )}
                            {duplicateWarning && (
                                <p className="flex items-center gap-1 text-[10px] font-bold text-amber-600 mt-0.5">
                                    <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                                    Produk serupa sudah ada: {duplicateWarning}
                                </p>
                            )}

                            <div>
                                <NBTextarea
                                    label="Deskripsi"
                                    value={form.watch("description") || ""}
                                    onChange={v => {
                                        form.setValue("description", v)
                                        manuallySet.current.desc = true
                                        setAutoTags(prev => ({ ...prev, desc: false }))
                                    }}
                                    placeholder="Deskripsi produk (opsional)"
                                    rows={2}
                                />
                                {autoTags.desc && (
                                    <p className="flex items-center gap-1 text-[9px] text-orange-400 font-bold mt-0.5">
                                        <span className="border border-orange-200 bg-orange-50 px-1 py-px text-[8px] uppercase tracking-widest">otomatis</span>
                                        template berdasarkan kategori — isi bagian ___ sesuai produk
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className={NB.label}>
                                    Satuan <span className={NB.labelRequired}>*</span>
                                    {autoTags.unit && (
                                        <span className="ml-1.5 text-[8px] font-bold text-orange-400 uppercase tracking-widest border border-orange-200 bg-orange-50 px-1 py-px inline-block">otomatis</span>
                                    )}
                                </label>
                                <ComboboxWithCreate
                                    options={unitOptions}
                                    value={form.watch("unit") || "pcs"}
                                    onChange={v => {
                                        form.setValue("unit", v)
                                        manuallySet.current.unit = true
                                        setAutoTags(prev => ({ ...prev, unit: false }))
                                    }}
                                    placeholder="Pilih satuan..."
                                    searchPlaceholder="Cari satuan..."
                                    emptyMessage="Satuan tidak ditemukan."
                                    createLabel="+ Buat Satuan Baru"
                                    onCreate={handleCreateUnit}
                                    isLoading={unitsLoading}
                                />
                            </div>
                        </NBSection>

                        {/* ====== INFORMASI HARGA ====== */}
                        <NBSection icon={DollarSign} title="Informasi Harga">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <NBCurrencyInput
                                        label="HPP (Harga Pokok)"
                                        value={String(watchCost || "")}
                                        onChange={v => form.setValue("costPrice", Number(v) || 0)}
                                    />
                                </div>
                                <div>
                                    <NBCurrencyInput
                                        label="Harga Jual (opsional)"
                                        value={watchSell === null || watchSell === undefined ? "" : String(watchSell || "")}
                                        onChange={v => {
                                            const raw = String(v ?? "").trim()
                                            if (raw === "") {
                                                form.setValue("sellingPrice", null)
                                            } else {
                                                const parsed = Number(raw)
                                                form.setValue("sellingPrice", Number.isNaN(parsed) ? null : parsed)
                                            }
                                            manuallySet.current.sellPrice = true
                                            setMarginPreset(null)
                                            setAutoTags(prev => ({ ...prev, sellPrice: false }))
                                        }}
                                    />
                                    <p className="text-[9px] text-zinc-400 mt-0.5">
                                        Kosongkan jika belum ditentukan — produk tidak bisa dijual sampai harga diatur.
                                    </p>
                                    {autoTags.sellPrice && marginPreset !== null && (
                                        <p className="flex items-center gap-1 text-[9px] text-orange-400 font-bold mt-0.5">
                                            <span className="border border-orange-200 bg-orange-50 px-1 py-px text-[8px] uppercase tracking-widest">otomatis</span>
                                            margin {marginPreset}% dari HPP
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Margin preset selector — visible when HPP > 0 */}
                            {watchCost > 0 && (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mr-0.5">Margin:</span>
                                    {MARGIN_PRESETS.map(pct => (
                                        <button
                                            key={pct}
                                            type="button"
                                            onClick={() => handleMarginClick(pct)}
                                            className={cn(
                                                "px-2 py-0.5 text-[10px] font-bold border transition-colors",
                                                marginPreset === pct
                                                    ? "bg-emerald-50 border-emerald-400 text-emerald-700"
                                                    : "bg-white border-zinc-200 text-zinc-500 hover:border-zinc-400"
                                            )}
                                        >
                                            {pct}%
                                        </button>
                                    ))}
                                    {marginPreset !== null && (
                                        <span className="text-[10px] font-mono font-bold text-emerald-600 ml-1">
                                            = Rp {Math.ceil(watchCost * (1 + marginPreset / 100)).toLocaleString('id-ID')}
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* Margin result banner */}
                            {watchCost > 0 && watchSell > 0 && (
                                <div className={cn(
                                    "p-2.5 flex items-center justify-between border",
                                    watchSell >= watchCost
                                        ? "bg-emerald-50 border-emerald-200"
                                        : "bg-red-50 border-red-200"
                                )}>
                                    {watchSell >= watchCost ? (
                                        <>
                                            <span className="text-xs font-bold text-emerald-700">Margin Keuntungan</span>
                                            <span className="font-black text-sm text-emerald-700">
                                                {margin.toFixed(1)}% &middot; Rp {(watchSell - watchCost).toLocaleString('id-ID')}/unit
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="flex items-center gap-1 text-xs font-bold text-red-700">
                                                <AlertTriangle className="h-3 w-3" />
                                                Harga jual di bawah HPP (rugi)
                                            </span>
                                            <span className="font-black text-sm text-red-600">
                                                {margin.toFixed(1)}% &middot; Rp {(watchSell - watchCost).toLocaleString('id-ID')}/unit
                                            </span>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* Smart hints */}
                            {watchCost === 0 && (
                                <p className="flex items-center gap-1 text-[10px] text-zinc-400 font-medium">
                                    <Info className="h-3 w-3 flex-shrink-0" />
                                    HPP belum diisi — akan diupdate dari Purchase Order
                                </p>
                            )}
                            {watchCost > 0 && watchSell === 0 && (
                                <p className="flex items-center gap-1 text-[10px] text-amber-500 font-bold">
                                    <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                                    Harga jual belum diisi
                                </p>
                            )}
                        </NBSection>

                        {/* ====== MANAJEMEN STOK ====== */}
                        <NBSection icon={BarChart3} title="Manajemen Stok">
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <NBInput
                                        label="Stok Minimum"
                                        type="number"
                                        value={watchMinStock > 0 ? String(watchMinStock) : ""}
                                        onChange={v => form.setValue("minStock", Number(v) || 0)}
                                        placeholder="0"
                                    />
                                </div>
                                <div>
                                    <NBInput
                                        label="Stok Maksimum"
                                        type="number"
                                        value={watchMaxStock > 0 ? String(watchMaxStock) : ""}
                                        onChange={v => {
                                            form.setValue("maxStock", Number(v) || 0)
                                            manuallySet.current.maxStock = true
                                            setAutoTags(prev => ({ ...prev, maxStock: false }))
                                        }}
                                        placeholder="0"
                                    />
                                    {autoTags.maxStock && (
                                        <p className="flex items-center justify-between text-[9px] mt-0.5">
                                            <span className="text-zinc-400 font-medium">3x stok minimum</span>
                                            <span className="border border-orange-200 bg-orange-50 px-1 py-px text-[8px] font-bold text-orange-400 uppercase tracking-widest">otomatis</span>
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <NBInput
                                        label="Reorder Point"
                                        type="number"
                                        value={watchReorder > 0 ? String(watchReorder) : ""}
                                        onChange={v => {
                                            form.setValue("reorderLevel", Number(v) || 0)
                                            manuallySet.current.reorder = true
                                            setAutoTags(prev => ({ ...prev, reorder: false }))
                                        }}
                                        placeholder="0"
                                    />
                                    {autoTags.reorder && (
                                        <p className="flex items-center justify-between text-[9px] mt-0.5">
                                            <span className="text-zinc-400 font-medium">1.5x stok minimum</span>
                                            <span className="border border-orange-200 bg-orange-50 px-1 py-px text-[8px] font-bold text-orange-400 uppercase tracking-widest">otomatis</span>
                                        </p>
                                    )}
                                </div>
                            </div>

                            {watchMinStock === 0 && watchReorder === 0 && (
                                <p className="flex items-center gap-1 text-[10px] text-zinc-400 font-medium">
                                    <Info className="h-3 w-3 flex-shrink-0" />
                                    Tidak ada peringatan stok rendah
                                </p>
                            )}
                        </NBSection>

                        {/* ====== FOOTER ====== */}
                        <div className="flex items-center justify-between pt-1">
                            <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 border text-[10px] font-black uppercase tracking-wider ${catStyle.bg} ${catStyle.border} ${catStyle.text}`}>
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
                                    className={NB.cancelBtn}
                                >
                                    Batal
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className={NB.submitBtn}
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
                </div>
            </NBDialog>
        </>
    )
}
