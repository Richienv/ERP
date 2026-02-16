"use client"

import { useEffect, useState, useMemo } from "react"
import {
    FolderOpen,
    FolderPlus,
    Layers,
    Loader2,
    Plus,
    Search,
    ArrowRight,
    Package,
    ChevronRight,
    X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { createCategory, getNextCategoryCode, getProductsByCategory, getProductsNotInCategory, assignProductToCategory, removeProductFromCategory } from "@/app/actions/inventory"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { NB } from "@/lib/dialog-styles"

interface CategoryWithChildren {
    id: string
    name: string
    code: string
    description: string | null
    parentId: string | null
    children: Array<{
        id: string
        name: string
        code: string
        description: string | null
        parentId: string | null
        _count: { products: number }
        children?: Array<{
            id: string
            name: string
            code: string
            description: string | null
            _count: { products: number }
        }>
    }>
    _count: { products: number }
}

interface CategoriesClientProps {
    categories: CategoryWithChildren[]
    allCategories: { id: string, name: string }[] // For dropdown
}

export function CategoriesClient({ categories, allCategories }: CategoriesClientProps) {
    const [selectedCategory, setSelectedCategory] = useState<any>(null)
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [search, setSearch] = useState("")
    const router = useRouter()

    const uiCategories = useMemo(() => {
        return categories.filter(c => !c.parentId).map(cat => ({
            ...cat,
            itemCount: cat._count.products,
            subs: cat.children.map((child: any) => ({
                id: child.id,
                code: child.code,
                name: child.name,
                description: child.description,
                count: child._count?.products || 0,
                children: child.children || []
            })),
        }))
    }, [categories])

    const filteredCategories = useMemo(() => {
        if (!search.trim()) return uiCategories
        const q = search.toLowerCase()
        return uiCategories.filter(c =>
            c.name.toLowerCase().includes(q) ||
            c.code.toLowerCase().includes(q) ||
            c.subs.some((s: any) => s.name.toLowerCase().includes(q))
        )
    }, [uiCategories, search])

    // Stats
    const totalRoot = uiCategories.length
    const totalSubs = uiCategories.reduce((sum, c) => sum + c.subs.length, 0)
    const totalProducts = uiCategories.reduce((sum, c) => {
        const subProducts = c.subs.reduce((s: number, sub: any) => s + (sub.count || 0), 0)
        return sum + c.itemCount + subProducts
    }, 0)

    return (
        <div className="p-4 md:p-8 pt-6 w-full space-y-4">

            {/* ═══════════════════════════════════════════ */}
            {/* COMMAND HEADER                              */}
            {/* ═══════════════════════════════════════════ */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900">
                <div className="px-6 py-4 flex items-center justify-between border-l-[6px] border-l-emerald-400">
                    <div className="flex items-center gap-3">
                        <Layers className="h-5 w-5 text-emerald-500" />
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                                Kategori Produk
                            </h1>
                            <p className="text-zinc-400 text-xs font-medium mt-0.5">
                                Struktur dan klasifikasi pohon inventori
                            </p>
                        </div>
                    </div>
                    <Button
                        onClick={() => setIsCreateOpen(true)}
                        className="bg-black text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-black uppercase text-xs tracking-wider px-6 h-9"
                    >
                        <Plus className="mr-2 h-4 w-4" /> Kategori Baru
                    </Button>
                </div>
            </div>

            {/* ═══════════════════════════════════════════ */}
            {/* KPI PULSE STRIP                            */}
            {/* ═══════════════════════════════════════════ */}
            <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <div className="grid grid-cols-3">
                    {/* Root Categories */}
                    <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <FolderOpen className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Kategori Root</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-zinc-900 dark:text-white">
                            {totalRoot}
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                            <span className="text-[10px] font-bold text-emerald-600">Klasifikasi utama</span>
                        </div>
                    </div>

                    {/* Subcategories */}
                    <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-blue-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <Layers className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Sub-Kategori</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-blue-600">
                            {totalSubs}
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                            <span className="text-[10px] font-bold text-blue-600">Node anak</span>
                        </div>
                    </div>

                    {/* Total Products */}
                    <div className="relative p-4 md:p-5">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-violet-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <Package className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total Produk</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-violet-600">
                            {totalProducts}
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                            <span className="text-[10px] font-bold text-violet-600">Terkait kategori</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════ */}
            {/* SEARCH BAR                                 */}
            {/* ═══════════════════════════════════════════ */}
            <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <div className="px-4 py-3 flex items-center gap-3">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Cari kategori atau sub-kategori..."
                            className="pl-9 border-2 border-black font-bold h-10 placeholder:text-zinc-400 rounded-none"
                        />
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                        {filteredCategories.length} dari {uiCategories.length} kategori
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════ */}
            {/* CATEGORY GRID                              */}
            {/* ═══════════════════════════════════════════ */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCategories.map((cat) => (
                    <CategoryCard key={cat.id} category={cat} onClick={() => setSelectedCategory(cat)} />
                ))}

                {/* Create Trigger Card */}
                <button
                    onClick={() => setIsCreateOpen(true)}
                    className="group relative flex flex-col items-center justify-center border-2 border-dashed border-zinc-300 hover:border-black p-8 transition-all h-full min-h-[280px] bg-zinc-50 hover:bg-white hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                >
                    <div className="h-14 w-14 bg-white border-2 border-zinc-200 group-hover:border-black flex items-center justify-center mb-4 group-hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all">
                        <Plus className="h-7 w-7 text-zinc-400 group-hover:text-black" />
                    </div>
                    <h3 className="text-sm font-black text-zinc-400 group-hover:text-black uppercase tracking-wider">
                        Buat Kategori Root
                    </h3>
                    <p className="text-[10px] text-zinc-400 font-medium text-center mt-2 max-w-[200px]">
                        Tambahkan klasifikasi utama baru untuk gudang
                    </p>
                </button>
            </div>

            {/* DIALOGS */}
            <CreateCategoryDialog
                open={isCreateOpen}
                onOpenChange={setIsCreateOpen}
                parents={allCategories}
                onSuccess={() => {
                    router.refresh()
                    setIsCreateOpen(false)
                }}
            />
            {selectedCategory && (
                <CategoryDetailDialog
                    category={selectedCategory}
                    open={!!selectedCategory}
                    onOpenChange={(open: boolean) => !open && setSelectedCategory(null)}
                />
            )}

        </div>
    )
}

/* ═══════════════════════════════════════════════════════════════ */
/* CATEGORY CARD                                                 */
/* ═══════════════════════════════════════════════════════════════ */

const ACCENT_COLORS = [
    { top: "bg-emerald-400", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    { top: "bg-blue-400", badge: "bg-blue-50 text-blue-700 border-blue-200" },
    { top: "bg-violet-400", badge: "bg-violet-50 text-violet-700 border-violet-200" },
    { top: "bg-amber-400", badge: "bg-amber-50 text-amber-700 border-amber-200" },
    { top: "bg-rose-400", badge: "bg-rose-50 text-rose-700 border-rose-200" },
    { top: "bg-cyan-400", badge: "bg-cyan-50 text-cyan-700 border-cyan-200" },
]

function CategoryCard({ category, onClick }: { category: any, onClick: () => void }) {
    // Deterministic color based on category code
    const colorIdx = category.code ? category.code.charCodeAt(category.code.length - 1) % ACCENT_COLORS.length : 0
    const accent = ACCENT_COLORS[colorIdx]

    return (
        <div
            onClick={onClick}
            className="group relative border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all bg-white overflow-hidden flex flex-col cursor-pointer"
        >
            {/* Top accent line */}
            <div className={`h-1.5 w-full ${accent.top}`} />

            {/* Header */}
            <div className="px-4 pt-4 pb-3">
                <div className="flex justify-between items-start">
                    <div className="space-y-2">
                        <span className="inline-block border-2 border-black bg-zinc-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider font-mono">
                            {category.code}
                        </span>
                        <h3 className="text-xl font-black uppercase leading-none tracking-tight text-zinc-900">
                            {category.name}
                        </h3>
                    </div>
                    <div className="h-10 w-10 bg-black text-white flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)]">
                        <FolderOpen className="h-5 w-5" />
                    </div>
                </div>
            </div>

            {/* Stats Row */}
            <div className="mx-4 border-t-2 border-b-2 border-black grid grid-cols-2">
                <div className="p-3 border-r-2 border-black">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-0.5">Total Produk</p>
                    <p className="text-lg font-black tracking-tighter">{category.itemCount.toLocaleString()}</p>
                </div>
                <div className="p-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-0.5">Sub-Kategori</p>
                    <p className="text-lg font-black tracking-tighter">{category.subs?.length || 0}</p>
                </div>
            </div>

            {/* Subcategories List */}
            <div className="px-4 py-3 flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-1.5 mb-2">
                    <Layers className="h-3 w-3" /> Sub-Kategori
                </p>
                <div className="space-y-1.5">
                    {category.subs && category.subs.length > 0 ? category.subs.slice(0, 4).map((sub: any) => (
                        <div key={sub.id || sub.name} className="flex items-center justify-between text-sm p-2 bg-zinc-50 border-2 border-zinc-200 group-hover:border-black/20 transition-colors">
                            <div className="flex items-center gap-2">
                                <ChevronRight className="h-3 w-3 text-zinc-400" />
                                <span className="font-bold text-zinc-700 text-xs">{sub.name}</span>
                            </div>
                            <span className={`text-[10px] font-black border px-1.5 py-0.5 ${accent.badge}`}>
                                {sub.count}
                            </span>
                        </div>
                    )) : (
                        <p className="text-[10px] text-zinc-400 font-bold uppercase">Belum ada sub-kategori</p>
                    )}
                    {category.subs && category.subs.length > 4 && (
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">
                            +{category.subs.length - 4} lainnya
                        </p>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="border-t-2 border-black bg-zinc-50 px-4 py-2.5">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-zinc-400 group-hover:text-black transition-colors">
                    <span>Kelola Pohon</span>
                    <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
            </div>
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════════ */
/* CREATE CATEGORY DIALOG (already NB-styled)                    */
/* ═══════════════════════════════════════════════════════════════ */

interface CreateCategoryDialogProps {
    open: boolean
    onOpenChange: (v: boolean) => void
    parents: { id: string, name: string }[]
    onSuccess: () => void
}

function CreateCategoryDialog({ open, onOpenChange, parents, onSuccess }: CreateCategoryDialogProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState("")
    const [code, setCode] = useState("")
    const [name, setName] = useState("")
    const [parentId, setParentId] = useState("root")
    const [description, setDescription] = useState("")

    useEffect(() => {
        if (open) {
            getNextCategoryCode().then(setCode)
            setName("")
            setParentId("root")
            setDescription("")
            setError("")
        }
    }, [open])

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setIsLoading(true)
        setError("")

        const result = await createCategory({
            name,
            code,
            description,
            parentId: parentId === "root" ? undefined : parentId,
        })

        if (result.success) {
            toast.success("Kategori berhasil dibuat")
            onSuccess()
        } else {
            setError(result.error as string)
            toast.error(result.error as string)
        }
        setIsLoading(false)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={NB.contentNarrow}>
                <DialogHeader className={NB.header}>
                    <DialogTitle className={NB.title}>
                        <FolderPlus className="h-5 w-5" /> Buat Kategori Baru
                    </DialogTitle>
                    <p className={NB.subtitle}>Tambah kategori root atau sub-kategori ke pohon inventori.</p>
                </DialogHeader>

                <ScrollArea className={NB.scroll}>
                    <form onSubmit={handleSubmit}>
                        <div className="p-5 space-y-4">
                            <div className={NB.section}>
                                <div className={`${NB.sectionHead} border-l-4 border-l-emerald-400 bg-emerald-50`}>
                                    <Layers className="h-4 w-4" />
                                    <span className={NB.sectionTitle}>Detail Kategori</span>
                                </div>
                                <div className={NB.sectionBody}>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className={NB.label}>Kode Kategori <span className={NB.labelRequired}>*</span></label>
                                            <Input
                                                value={code}
                                                onChange={(e) => setCode(e.target.value)}
                                                placeholder="CAT-001"
                                                className={NB.inputMono}
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className={NB.label}>Nama Kategori <span className={NB.labelRequired}>*</span></label>
                                            <Input
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                placeholder="e.g. Raw Material"
                                                className={NB.input}
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className={NB.label}>Kategori Induk</label>
                                        <Select value={parentId} onValueChange={setParentId}>
                                            <SelectTrigger className={NB.select}>
                                                <SelectValue placeholder="Pilih Induk (Opsional)" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="root">Tanpa Induk (Root)</SelectItem>
                                                {parents.map(p => (
                                                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div>
                                        <label className={NB.label}>Deskripsi</label>
                                        <Textarea
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            placeholder="Jelaskan item apa yang masuk kategori ini..."
                                            className={NB.textarea + " min-h-[80px]"}
                                        />
                                    </div>

                                    {error && <p className={NB.error}>{error}</p>}
                                </div>
                            </div>

                            <div className={NB.footer}>
                                <Button type="button" variant="outline" className={NB.cancelBtn} onClick={() => onOpenChange(false)}>
                                    Batal
                                </Button>
                                <Button type="submit" disabled={isLoading} className={NB.submitBtn}>
                                    {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan...</> : "Buat Kategori"}
                                </Button>
                            </div>
                        </div>
                    </form>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}

/* ═══════════════════════════════════════════════════════════════ */
/* CATEGORY DETAIL DIALOG (already NB-styled)                    */
/* ═══════════════════════════════════════════════════════════════ */

function CategoryDetailDialog({ category, open, onOpenChange }: { category: any, open: boolean, onOpenChange: (v: boolean) => void }) {
    const [products, setProducts] = useState<Array<{ id: string; code: string; name: string; unit: string; sellingPrice: number; totalStock: number }>>([])
    const [loadingProducts, setLoadingProducts] = useState(false)
    const [showAddRow, setShowAddRow] = useState(false)
    const [availableProducts, setAvailableProducts] = useState<Array<{ id: string; code: string; name: string }>>([])
    const [selectedProductId, setSelectedProductId] = useState("")
    const [adding, setAdding] = useState(false)
    const router = useRouter()

    const loadProducts = async () => {
        setLoadingProducts(true)
        const data = await getProductsByCategory(category.id)
        setProducts(data)
        setLoadingProducts(false)
    }

    useEffect(() => {
        if (open && category?.id) {
            loadProducts()
            setShowAddRow(false)
            setSelectedProductId("")
        }
    }, [open, category?.id])

    const handleOpenAddRow = async () => {
        setShowAddRow(true)
        const available = await getProductsNotInCategory(category.id)
        setAvailableProducts(available)
    }

    const handleAddProduct = async () => {
        if (!selectedProductId) {
            toast.error("Pilih produk terlebih dahulu")
            return
        }
        setAdding(true)
        const result = await assignProductToCategory(selectedProductId, category.id)
        if (result.success) {
            toast.success("Produk berhasil ditambahkan ke kategori")
            setSelectedProductId("")
            setShowAddRow(false)
            await loadProducts()
            router.refresh()
        } else {
            toast.error(result.error || "Gagal menambahkan produk")
        }
        setAdding(false)
    }

    const handleRemoveProduct = async (productId: string) => {
        const result = await removeProductFromCategory(productId)
        if (result.success) {
            toast.success("Produk dihapus dari kategori")
            await loadProducts()
            router.refresh()
        } else {
            toast.error(result.error || "Gagal menghapus produk")
        }
    }

    const formatCurrency = (v: number) =>
        new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(v)

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={NB.contentWide}>
                <DialogHeader className={NB.header}>
                    <DialogTitle className={NB.title}>
                        <FolderOpen className="h-5 w-5" /> {category.name}
                    </DialogTitle>
                    <p className={NB.subtitle}>
                        <span className="font-mono">{category.code}</span> — {category.description || "Tidak ada deskripsi."}
                    </p>
                </DialogHeader>

                <ScrollArea className={NB.scroll}>
                    <div className="p-5 space-y-4">
                        {/* Stats */}
                        <div className={NB.section}>
                            <div className={`${NB.sectionHead} border-l-4 border-l-emerald-400 bg-emerald-50`}>
                                <Layers className="h-4 w-4" />
                                <span className={NB.sectionTitle}>Statistik</span>
                            </div>
                            <div className={NB.sectionBody}>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="border-2 border-black p-3">
                                        <p className="text-[10px] font-black uppercase text-zinc-500">Total Produk</p>
                                        <p className="text-2xl font-black">{products.length}</p>
                                    </div>
                                    <div className="border-2 border-black p-3">
                                        <p className="text-[10px] font-black uppercase text-zinc-500">Sub-Kategori</p>
                                        <p className="text-2xl font-black">{category.subs?.length || 0}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Produk dalam Kategori */}
                        <div className={NB.section}>
                            <div className={`${NB.sectionHead} border-l-4 border-l-violet-400 bg-violet-50 flex items-center justify-between`}>
                                <div className="flex items-center gap-2">
                                    <Package className="h-4 w-4" />
                                    <span className={NB.sectionTitle}>Produk dalam Kategori</span>
                                </div>
                                {!showAddRow && (
                                    <button
                                        type="button"
                                        onClick={handleOpenAddRow}
                                        className="flex items-center gap-1 bg-black text-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all font-black uppercase text-[9px] tracking-wider px-2.5 h-6"
                                    >
                                        <Plus className="h-3 w-3" /> Tambah
                                    </button>
                                )}
                            </div>

                            {/* Add product row */}
                            {showAddRow && (
                                <div className="px-4 py-3 bg-violet-50 border-b-2 border-black">
                                    <div className="flex gap-2 items-center">
                                        <select
                                            className="flex-1 border-2 border-black bg-white text-xs font-bold h-9 px-2 rounded-none"
                                            value={selectedProductId}
                                            onChange={(e) => setSelectedProductId(e.target.value)}
                                        >
                                            <option value="">Pilih produk...</option>
                                            {availableProducts.map((p) => (
                                                <option key={p.id} value={p.id}>
                                                    [{p.code}] {p.name}
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            onClick={handleAddProduct}
                                            disabled={adding}
                                            className="flex items-center gap-1 bg-black text-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all font-black uppercase text-[9px] tracking-wider px-3 h-9 shrink-0"
                                        >
                                            {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                                            {adding ? "..." : "Tambah"}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setShowAddRow(false); setSelectedProductId("") }}
                                            className="border-2 border-black bg-white hover:bg-zinc-100 h-9 w-9 flex items-center justify-center shrink-0"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {loadingProducts ? (
                                <div className="p-4 text-center">
                                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-zinc-400 mb-1" />
                                    <p className="text-[10px] font-bold text-zinc-400 uppercase">Memuat produk...</p>
                                </div>
                            ) : products.length > 0 ? (
                                <div className={NB.tableWrap}>
                                    <table className="w-full">
                                        <thead className={NB.tableHead}>
                                            <tr>
                                                <th className={`${NB.tableHeadCell} text-left`}>Kode</th>
                                                <th className={`${NB.tableHeadCell} text-left`}>Nama Produk</th>
                                                <th className={`${NB.tableHeadCell} text-center`}>Unit</th>
                                                <th className={`${NB.tableHeadCell} text-right`}>Harga Jual</th>
                                                <th className={`${NB.tableHeadCell} text-right`}>Stok</th>
                                                <th className={`${NB.tableHeadCell} w-10`}></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {products.map((p) => (
                                                <tr key={p.id} className={NB.tableRow}>
                                                    <td className={NB.tableCell}>
                                                        <span className="text-[11px] font-mono font-bold">{p.code}</span>
                                                    </td>
                                                    <td className={NB.tableCell}>
                                                        <span className="text-xs font-bold">{p.name}</span>
                                                    </td>
                                                    <td className={`${NB.tableCell} text-center`}>
                                                        <span className="text-[10px] font-black uppercase text-zinc-500">{p.unit}</span>
                                                    </td>
                                                    <td className={`${NB.tableCell} text-right`}>
                                                        <span className="text-xs font-mono font-bold">{formatCurrency(p.sellingPrice)}</span>
                                                    </td>
                                                    <td className={`${NB.tableCell} text-right`}>
                                                        <span className={`text-xs font-black ${p.totalStock <= 0 ? 'text-red-500' : ''}`}>
                                                            {p.totalStock.toLocaleString()}
                                                        </span>
                                                    </td>
                                                    <td className={NB.tableCell}>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveProduct(p.id)}
                                                            className="text-red-400 hover:text-red-600"
                                                            title="Hapus dari kategori"
                                                        >
                                                            <X className="h-3.5 w-3.5" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="p-4 text-center">
                                    <Package className="h-6 w-6 mx-auto text-zinc-200 mb-1" />
                                    <p className="text-[10px] font-bold text-zinc-400 uppercase">Belum ada produk di kategori ini</p>
                                </div>
                            )}
                        </div>

                        {/* Sub-Kategori */}
                        {category.subs && category.subs.length > 0 && (
                            <div className={NB.section}>
                                <div className={`${NB.sectionHead} border-l-4 border-l-emerald-400 bg-emerald-50`}>
                                    <Layers className="h-4 w-4" />
                                    <span className={NB.sectionTitle}>Sub-Kategori</span>
                                </div>
                                <div className="divide-y-2 divide-black">
                                    {category.subs.map((sub: any) => (
                                        <div key={sub.id || sub.name} className="px-4 py-3">
                                            <div className="flex items-center justify-between gap-2">
                                                <div>
                                                    <p className="text-sm font-black uppercase">{sub.name}</p>
                                                    <p className="text-[11px] text-zinc-500 font-mono">{sub.code || "NO-CODE"}</p>
                                                </div>
                                                <Badge variant="outline" className="border-2 border-black text-[10px] font-black">
                                                    {sub.count || 0} produk
                                                </Badge>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className={NB.footer}>
                            <Button variant="outline" className={NB.cancelBtn} onClick={() => onOpenChange(false)}>
                                Tutup
                            </Button>
                        </div>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}
