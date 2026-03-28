"use client"

import { useState, useMemo, useTransition } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
    Search,
    Plus,
    Pencil,
    Database,
    FolderKanban,
    Warehouse,
    CheckCircle2,
    Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
    NBDialog,
    NBDialogHeader,
    NBDialogBody,
    NBDialogFooter,
    NBSection,
    NBInput,
    NBSelect,
    NBTextarea,
} from "@/components/ui/nb-dialog"
import { toast } from "sonner"
import { queryKeys } from "@/lib/query-keys"
import {
    createDocumentCategory,
    updateDocumentCategory,
    createDocumentWarehouse,
    updateDocumentWarehouse,
} from "@/app/actions/documents-system"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CategoryItem = {
    id: string
    code: string
    name: string
    description: string
    isActive: boolean
    parentId?: string | null
    parentName?: string | null
    itemCount: number
    updatedAt: string | Date
}

type WarehouseItem = {
    id: string
    code: string
    name: string
    address: string
    city: string
    province: string
    capacity: number
    isActive: boolean
    managerId?: string | null
    managerName?: string
    managerCode?: string
    updatedAt: string | Date
}

interface MasterViewProps {
    categories: CategoryItem[]
    warehouses: WarehouseItem[]
    managerOptions: {
        id: string
        employeeCode: string
        name: string
        department: string
        position: string
    }[]
    canManage: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatDateTime = (value: string | Date | undefined) => {
    if (!value) return "-"
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) return "-"
    return date.toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    })
}

// ---------------------------------------------------------------------------
// Category Form State
// ---------------------------------------------------------------------------

type CategoryForm = {
    code: string
    name: string
    description: string
    parentId: string | null
    isActive: boolean
}

const emptyCategoryForm: CategoryForm = {
    code: "",
    name: "",
    description: "",
    parentId: null,
    isActive: true,
}

// ---------------------------------------------------------------------------
// Warehouse Form State
// ---------------------------------------------------------------------------

type WarehouseForm = {
    code: string
    name: string
    address: string
    city: string
    province: string
    capacity: number
    managerId: string | null
    isActive: boolean
}

const emptyWarehouseForm: WarehouseForm = {
    code: "",
    name: "",
    address: "",
    city: "",
    province: "",
    capacity: 0,
    managerId: null,
    isActive: true,
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MasterView({
    categories,
    warehouses,
    managerOptions,
    canManage,
}: MasterViewProps) {
    const queryClient = useQueryClient()
    const [isPending, startTransition] = useTransition()

    // Category state
    const [catSearch, setCatSearch] = useState("")
    const [catDialogOpen, setCatDialogOpen] = useState(false)
    const [catEditId, setCatEditId] = useState<string | null>(null)
    const [catForm, setCatForm] = useState<CategoryForm>(emptyCategoryForm)

    // Warehouse state
    const [whSearch, setWhSearch] = useState("")
    const [whDialogOpen, setWhDialogOpen] = useState(false)
    const [whEditId, setWhEditId] = useState<string | null>(null)
    const [whForm, setWhForm] = useState<WarehouseForm>(emptyWarehouseForm)

    // -----------------------------------------------------------------------
    // Derived data
    // -----------------------------------------------------------------------

    const filteredCategories = useMemo(() => {
        if (!catSearch.trim()) return categories
        const q = catSearch.toLowerCase()
        return categories.filter(
            (c) =>
                c.code.toLowerCase().includes(q) ||
                c.name.toLowerCase().includes(q) ||
                c.description.toLowerCase().includes(q)
        )
    }, [categories, catSearch])

    const filteredWarehouses = useMemo(() => {
        if (!whSearch.trim()) return warehouses
        const q = whSearch.toLowerCase()
        return warehouses.filter(
            (w) =>
                w.code.toLowerCase().includes(q) ||
                w.name.toLowerCase().includes(q) ||
                w.city.toLowerCase().includes(q) ||
                w.province.toLowerCase().includes(q)
        )
    }, [warehouses, whSearch])

    const totalCategories = categories.length
    const activeCategories = categories.filter((c) => c.isActive).length
    const totalWarehouses = warehouses.length
    const activeWarehouses = warehouses.filter((w) => w.isActive).length

    // -----------------------------------------------------------------------
    // Category Dialog Handlers
    // -----------------------------------------------------------------------

    const openAddCategory = () => {
        setCatEditId(null)
        setCatForm(emptyCategoryForm)
        setCatDialogOpen(true)
    }

    const openEditCategory = (cat: CategoryItem) => {
        setCatEditId(cat.id)
        setCatForm({
            code: cat.code,
            name: cat.name,
            description: cat.description,
            parentId: cat.parentId || null,
            isActive: cat.isActive,
        })
        setCatDialogOpen(true)
    }

    const handleSaveCategory = () => {
        if (!catForm.code.trim() || !catForm.name.trim()) {
            toast.error("Kode dan nama kategori wajib diisi")
            return
        }

        startTransition(async () => {
            try {
                const payload = {
                    code: catForm.code.trim(),
                    name: catForm.name.trim(),
                    description: catForm.description.trim() || undefined,
                    parentId: catForm.parentId || null,
                    isActive: catForm.isActive,
                }

                const result = catEditId
                    ? await updateDocumentCategory(catEditId, payload)
                    : await createDocumentCategory(payload)

                if (result.success) {
                    toast.success(
                        catEditId
                            ? "Kategori berhasil diperbarui"
                            : "Kategori berhasil ditambahkan"
                    )
                    setCatDialogOpen(false)
                    queryClient.invalidateQueries({ queryKey: queryKeys.documents.all })
                    queryClient.invalidateQueries({ queryKey: queryKeys.categories.all })
                    queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.all })
                } else {
                    toast.error(result.error || "Gagal menyimpan kategori")
                }
            } catch (err: any) {
                toast.error(err?.message || "Terjadi kesalahan saat menyimpan kategori")
            }
        })
    }

    // -----------------------------------------------------------------------
    // Warehouse Dialog Handlers
    // -----------------------------------------------------------------------

    const openAddWarehouse = () => {
        setWhEditId(null)
        setWhForm(emptyWarehouseForm)
        setWhDialogOpen(true)
    }

    const openEditWarehouse = (wh: WarehouseItem) => {
        setWhEditId(wh.id)
        setWhForm({
            code: wh.code,
            name: wh.name,
            address: wh.address,
            city: wh.city,
            province: wh.province,
            capacity: wh.capacity,
            managerId: wh.managerId || null,
            isActive: wh.isActive,
        })
        setWhDialogOpen(true)
    }

    const handleSaveWarehouse = () => {
        if (!whForm.code.trim() || !whForm.name.trim()) {
            toast.error("Kode dan nama gudang wajib diisi")
            return
        }

        startTransition(async () => {
            try {
                const payload = {
                    code: whForm.code.trim(),
                    name: whForm.name.trim(),
                    address: whForm.address.trim() || undefined,
                    city: whForm.city.trim() || undefined,
                    province: whForm.province.trim() || undefined,
                    capacity: whForm.capacity || undefined,
                    managerId: whForm.managerId || null,
                    isActive: whForm.isActive,
                }

                const result = whEditId
                    ? await updateDocumentWarehouse(whEditId, payload)
                    : await createDocumentWarehouse(payload)

                if (result.success) {
                    toast.success(
                        whEditId
                            ? "Gudang berhasil diperbarui"
                            : "Gudang berhasil ditambahkan"
                    )
                    setWhDialogOpen(false)
                    queryClient.invalidateQueries({ queryKey: queryKeys.documents.all })
                    queryClient.invalidateQueries({ queryKey: queryKeys.categories.all })
                    queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.all })
                } else {
                    toast.error(result.error || "Gagal menyimpan gudang")
                }
            } catch (err: any) {
                toast.error(err?.message || "Terjadi kesalahan saat menyimpan gudang")
            }
        })
    }

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------

    return (
        <div className="mf-page">
            <div className="space-y-6">
                {/* ============================================================= */}
                {/* Command Header                                                */}
                {/* ============================================================= */}
                <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900">
                    <div className="px-6 py-4 flex items-center justify-between border-l-[6px] border-l-blue-400">
                        <div className="flex items-center gap-3">
                            <Database className="h-5 w-5 text-blue-500" />
                            <div>
                                <h1 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                                    Data Master
                                </h1>
                                <p className="text-zinc-400 text-xs font-medium mt-0.5">
                                    Kelola kategori produk & gudang operasional
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ============================================================= */}
                {/* KPI Pulse Strip                                               */}
                {/* ============================================================= */}
                <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                    <div className="grid grid-cols-2 md:grid-cols-4">
                        {/* Total Kategori */}
                        <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800 border-b-2 md:border-b-0">
                            <div className="absolute top-0 left-0 right-0 h-1 bg-blue-400" />
                            <div className="flex items-center gap-2 mb-2">
                                <FolderKanban className="h-4 w-4 text-zinc-400" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                    Total Kategori
                                </span>
                            </div>
                            <div className="text-2xl md:text-3xl font-black tracking-tighter text-blue-600">
                                {totalCategories}
                            </div>
                            <div className="text-[10px] font-bold text-blue-600 mt-1">
                                Kategori terdaftar
                            </div>
                        </div>

                        {/* Kategori Aktif */}
                        <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800 border-b-2 md:border-b-0">
                            <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-400" />
                            <div className="flex items-center gap-2 mb-2">
                                <CheckCircle2 className="h-4 w-4 text-zinc-400" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                    Kategori Aktif
                                </span>
                            </div>
                            <div className="text-2xl md:text-3xl font-black tracking-tighter text-emerald-600">
                                {activeCategories}
                            </div>
                            <div className="text-[10px] font-bold text-emerald-600 mt-1">
                                Siap digunakan
                            </div>
                        </div>

                        {/* Total Gudang */}
                        <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800">
                            <div className="absolute top-0 left-0 right-0 h-1 bg-amber-400" />
                            <div className="flex items-center gap-2 mb-2">
                                <Warehouse className="h-4 w-4 text-zinc-400" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                    Total Gudang
                                </span>
                            </div>
                            <div className="text-2xl md:text-3xl font-black tracking-tighter text-amber-600">
                                {totalWarehouses}
                            </div>
                            <div className="text-[10px] font-bold text-amber-600 mt-1">
                                Gudang terdaftar
                            </div>
                        </div>

                        {/* Gudang Aktif */}
                        <div className="relative p-4 md:p-5">
                            <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-400" />
                            <div className="flex items-center gap-2 mb-2">
                                <CheckCircle2 className="h-4 w-4 text-zinc-400" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                    Gudang Aktif
                                </span>
                            </div>
                            <div className="text-2xl md:text-3xl font-black tracking-tighter text-indigo-600">
                                {activeWarehouses}
                            </div>
                            <div className="text-[10px] font-bold text-indigo-600 mt-1">
                                Beroperasi
                            </div>
                        </div>
                    </div>
                </div>

                {/* ============================================================= */}
                {/* Section A: Kategori Produk                                    */}
                {/* ============================================================= */}

                {/* Search & Filter Bar */}
                <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                    <div className="px-4 py-3 flex items-center gap-3 border-l-[6px] border-l-blue-400">
                        <FolderKanban className="h-4 w-4 text-blue-500" />
                        <span className="text-xs font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-300">
                            Kategori Produk Master
                        </span>
                    </div>
                    <div className="px-4 py-3 flex items-center gap-3 border-t border-zinc-100 dark:border-zinc-800">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                            <Input
                                placeholder="Cari kode, nama, deskripsi..."
                                value={catSearch}
                                onChange={(e) => setCatSearch(e.target.value)}
                                className="pl-9 border-2 border-black font-bold h-10 placeholder:text-zinc-400 rounded-none"
                            />
                        </div>
                        <Button
                            disabled={!canManage}
                            onClick={openAddCategory}
                            className="border-2 border-black bg-black text-white font-black uppercase text-[10px] tracking-widest h-10 shadow-[3px_3px_0px_0px_rgba(0,0,0,0.3)] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
                        >
                            <Plus className="h-3.5 w-3.5 mr-1.5" /> Tambah Kategori
                        </Button>
                    </div>
                </div>

                {/* Category Table */}
                <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-zinc-50 dark:bg-zinc-800 border-b-2 border-black">
                                <tr>
                                    <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                        Kode
                                    </th>
                                    <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                        Nama
                                    </th>
                                    <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 hidden md:table-cell">
                                        Deskripsi
                                    </th>
                                    <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 hidden lg:table-cell">
                                        Parent
                                    </th>
                                    <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">
                                        Item
                                    </th>
                                    <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                        Status
                                    </th>
                                    <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 hidden lg:table-cell">
                                        Update
                                    </th>
                                    <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                        Aksi
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                {filteredCategories.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="p-12 text-center">
                                            <FolderKanban className="h-8 w-8 mx-auto text-zinc-300 mb-2" />
                                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                                                Tidak ada kategori ditemukan
                                            </p>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredCategories.map((cat) => (
                                        <tr
                                            key={cat.id}
                                            className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                                        >
                                            <td className="p-4 font-mono font-bold text-xs text-blue-600">
                                                {cat.code}
                                            </td>
                                            <td className="p-4 font-bold text-xs text-zinc-900 dark:text-white">
                                                {cat.name}
                                            </td>
                                            <td className="p-4 text-xs text-zinc-500 hidden md:table-cell max-w-[200px] truncate">
                                                {cat.description || "-"}
                                            </td>
                                            <td className="p-4 text-xs text-zinc-500 hidden lg:table-cell">
                                                {cat.parentName || "-"}
                                            </td>
                                            <td className="p-4 font-mono font-bold text-xs text-zinc-700 dark:text-zinc-300 text-right">
                                                {cat.itemCount}
                                            </td>
                                            <td className="p-4">
                                                {cat.isActive ? (
                                                    <span className="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest border rounded-sm bg-emerald-50 text-emerald-700 border-emerald-300">
                                                        Aktif
                                                    </span>
                                                ) : (
                                                    <span className="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest border rounded-sm bg-zinc-50 text-zinc-500 border-zinc-300">
                                                        Nonaktif
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4 text-[10px] text-zinc-400 hidden lg:table-cell whitespace-nowrap">
                                                {formatDateTime(cat.updatedAt)}
                                            </td>
                                            <td className="p-4">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={!canManage}
                                                    onClick={() => openEditCategory(cat)}
                                                    className="border-2 border-black font-black uppercase text-[9px] tracking-widest h-7 px-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
                                                >
                                                    <Pencil className="h-3 w-3 mr-1" />
                                                    Edit
                                                </Button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* ============================================================= */}
                {/* Section B: Master Gudang                                      */}
                {/* ============================================================= */}

                {/* Search & Filter Bar */}
                <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                    <div className="px-4 py-3 flex items-center gap-3 border-l-[6px] border-l-amber-400">
                        <Warehouse className="h-4 w-4 text-amber-500" />
                        <span className="text-xs font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-300">
                            Master Gudang & Lokasi
                        </span>
                    </div>
                    <div className="px-4 py-3 flex items-center gap-3 border-t border-zinc-100 dark:border-zinc-800">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                            <Input
                                placeholder="Cari kode, nama, kota, provinsi..."
                                value={whSearch}
                                onChange={(e) => setWhSearch(e.target.value)}
                                className="pl-9 border-2 border-black font-bold h-10 placeholder:text-zinc-400 rounded-none"
                            />
                        </div>
                        <Button
                            disabled={!canManage}
                            onClick={openAddWarehouse}
                            className="border-2 border-black bg-black text-white font-black uppercase text-[10px] tracking-widest h-10 shadow-[3px_3px_0px_0px_rgba(0,0,0,0.3)] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
                        >
                            <Plus className="h-3.5 w-3.5 mr-1.5" /> Tambah Gudang
                        </Button>
                    </div>
                </div>

                {/* Warehouse Table */}
                <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-zinc-50 dark:bg-zinc-800 border-b-2 border-black">
                                <tr>
                                    <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                        Kode
                                    </th>
                                    <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                        Nama
                                    </th>
                                    <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 hidden md:table-cell">
                                        Lokasi
                                    </th>
                                    <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right hidden lg:table-cell">
                                        Kapasitas
                                    </th>
                                    <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 hidden lg:table-cell">
                                        Manager
                                    </th>
                                    <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                        Status
                                    </th>
                                    <th className="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                        Aksi
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                {filteredWarehouses.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="p-12 text-center">
                                            <Warehouse className="h-8 w-8 mx-auto text-zinc-300 mb-2" />
                                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                                                Tidak ada gudang ditemukan
                                            </p>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredWarehouses.map((wh) => {
                                        const locationParts = [wh.city, wh.province].filter(Boolean)
                                        const locationLabel = locationParts.length > 0 ? locationParts.join(", ") : "-"

                                        return (
                                            <tr
                                                key={wh.id}
                                                className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                                            >
                                                <td className="p-4 font-mono font-bold text-xs text-blue-600">
                                                    {wh.code}
                                                </td>
                                                <td className="p-4 font-bold text-xs text-zinc-900 dark:text-white">
                                                    {wh.name}
                                                </td>
                                                <td className="p-4 text-xs text-zinc-500 hidden md:table-cell">
                                                    {locationLabel}
                                                </td>
                                                <td className="p-4 font-mono font-bold text-xs text-zinc-700 dark:text-zinc-300 text-right hidden lg:table-cell">
                                                    {wh.capacity > 0
                                                        ? wh.capacity.toLocaleString("id-ID")
                                                        : "-"}
                                                </td>
                                                <td className="p-4 hidden lg:table-cell">
                                                    {wh.managerName ? (
                                                        <div>
                                                            <div className="font-bold text-xs text-zinc-900 dark:text-white">
                                                                {wh.managerName}
                                                            </div>
                                                            {wh.managerCode && (
                                                                <div className="font-mono text-[10px] text-zinc-400">
                                                                    {wh.managerCode}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-zinc-400">-</span>
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    {wh.isActive ? (
                                                        <span className="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest border rounded-sm bg-emerald-50 text-emerald-700 border-emerald-300">
                                                            Aktif
                                                        </span>
                                                    ) : (
                                                        <span className="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest border rounded-sm bg-zinc-50 text-zinc-500 border-zinc-300">
                                                            Nonaktif
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={!canManage}
                                                        onClick={() => openEditWarehouse(wh)}
                                                        className="border-2 border-black font-black uppercase text-[9px] tracking-widest h-7 px-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
                                                    >
                                                        <Pencil className="h-3 w-3 mr-1" />
                                                        Edit
                                                    </Button>
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* ================================================================= */}
            {/* Category Dialog                                                   */}
            {/* ================================================================= */}
            <NBDialog open={catDialogOpen} onOpenChange={setCatDialogOpen} size="narrow">
                <NBDialogHeader
                    icon={FolderKanban}
                    title={catEditId ? "Edit Kategori" : "Tambah Kategori"}
                    subtitle={catEditId ? "Perbarui data kategori produk" : "Buat kategori produk baru untuk inventori"}
                />
                <NBDialogBody>
                    <NBSection icon={FolderKanban} title="Detail Kategori">
                        <NBInput
                            label="Kode Kategori"
                            required
                            value={catForm.code}
                            onChange={(v) => setCatForm((prev) => ({ ...prev, code: v }))}
                            placeholder="Contoh: KAT-001"
                        />
                        <NBInput
                            label="Nama Kategori"
                            required
                            value={catForm.name}
                            onChange={(v) => setCatForm((prev) => ({ ...prev, name: v }))}
                            placeholder="Contoh: Bahan Baku Kain"
                        />
                        <NBTextarea
                            label="Deskripsi"
                            value={catForm.description}
                            onChange={(v) => setCatForm((prev) => ({ ...prev, description: v }))}
                            placeholder="Deskripsi singkat kategori"
                            rows={2}
                        />
                        <NBSelect
                            label="Kategori Induk"
                            value={catForm.parentId || ""}
                            onValueChange={(val) => setCatForm((prev) => ({ ...prev, parentId: val || null }))}
                            placeholder="Pilih kategori induk"
                            emptyLabel="Tidak ada (root)"
                            options={categories
                                .filter((c) => c.id !== catEditId)
                                .map((c) => ({ value: c.id, label: `${c.code} - ${c.name}` }))}
                        />
                        <div className="flex items-center justify-between py-1">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                                Status Aktif
                            </label>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-zinc-500">
                                    {catForm.isActive ? "Aktif" : "Nonaktif"}
                                </span>
                                <Switch
                                    checked={catForm.isActive}
                                    onCheckedChange={(checked) =>
                                        setCatForm((prev) => ({ ...prev, isActive: checked }))
                                    }
                                />
                            </div>
                        </div>
                    </NBSection>
                </NBDialogBody>
                <NBDialogFooter
                    onCancel={() => setCatDialogOpen(false)}
                    onSubmit={handleSaveCategory}
                    submitting={isPending}
                    submitLabel="Simpan"
                />
            </NBDialog>

            {/* ================================================================= */}
            {/* Warehouse Dialog                                                  */}
            {/* ================================================================= */}
            <NBDialog open={whDialogOpen} onOpenChange={setWhDialogOpen} size="narrow">
                <NBDialogHeader
                    icon={Warehouse}
                    title={whEditId ? "Edit Gudang" : "Tambah Gudang"}
                    subtitle={whEditId ? "Perbarui data gudang operasional" : "Daftarkan gudang baru ke dalam sistem"}
                />
                <NBDialogBody>
                    <NBSection icon={Warehouse} title="Data Gudang">
                        <NBInput
                            label="Kode Gudang"
                            required
                            value={whForm.code}
                            onChange={(v) => setWhForm((prev) => ({ ...prev, code: v }))}
                            placeholder="Contoh: GDG-01"
                        />
                        <NBInput
                            label="Nama Gudang"
                            required
                            value={whForm.name}
                            onChange={(v) => setWhForm((prev) => ({ ...prev, name: v }))}
                            placeholder="Contoh: Gudang Utama Bandung"
                        />
                        <NBInput
                            label="Alamat"
                            value={whForm.address}
                            onChange={(v) => setWhForm((prev) => ({ ...prev, address: v }))}
                            placeholder="Jl. Industri No. 10"
                        />
                        <div className="grid grid-cols-2 gap-3">
                            <NBInput
                                label="Kota"
                                value={whForm.city}
                                onChange={(v) => setWhForm((prev) => ({ ...prev, city: v }))}
                                placeholder="Bandung"
                            />
                            <NBInput
                                label="Provinsi"
                                value={whForm.province}
                                onChange={(v) => setWhForm((prev) => ({ ...prev, province: v }))}
                                placeholder="Jawa Barat"
                            />
                        </div>
                        <NBInput
                            label="Kapasitas (unit)"
                            type="number"
                            value={String(whForm.capacity || "")}
                            onChange={(v) => setWhForm((prev) => ({ ...prev, capacity: parseInt(v, 10) || 0 }))}
                            placeholder="0"
                        />
                        <NBSelect
                            label="Penanggung Jawab (Manager)"
                            value={whForm.managerId || ""}
                            onValueChange={(val) => setWhForm((prev) => ({ ...prev, managerId: val || null }))}
                            placeholder="Pilih manager"
                            emptyLabel="Tidak ada"
                            options={managerOptions.map((mgr) => ({
                                value: mgr.id,
                                label: `${mgr.employeeCode} - ${mgr.name} (${mgr.department})`,
                            }))}
                        />
                        <div className="flex items-center justify-between py-1">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                                Status Aktif
                            </label>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-zinc-500">
                                    {whForm.isActive ? "Aktif" : "Nonaktif"}
                                </span>
                                <Switch
                                    checked={whForm.isActive}
                                    onCheckedChange={(checked) =>
                                        setWhForm((prev) => ({ ...prev, isActive: checked }))
                                    }
                                />
                            </div>
                        </div>
                    </NBSection>
                </NBDialogBody>
                <NBDialogFooter
                    onCancel={() => setWhDialogOpen(false)}
                    onSubmit={handleSaveWarehouse}
                    submitting={isPending}
                    submitLabel="Simpan"
                />
            </NBDialog>
        </div>
    )
}
