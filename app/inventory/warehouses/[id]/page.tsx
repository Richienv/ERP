"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
    ArrowLeft,
    MapPin,
    Box,
    LayoutGrid,
    Package,
    Pencil,
    Layers,
    DollarSign,
    Trash2,
    Loader2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"

const WAREHOUSE_TYPE_CONFIG: Record<string, { label: string; className: string }> = {
    RAW_MATERIAL: { label: "Bahan Baku", className: "bg-blue-100 text-blue-800 border-blue-300" },
    WORK_IN_PROGRESS: { label: "WIP", className: "bg-amber-100 text-amber-800 border-amber-300" },
    FINISHED_GOODS: { label: "Barang Jadi", className: "bg-emerald-100 text-emerald-800 border-emerald-300" },
    GENERAL: { label: "Umum", className: "bg-zinc-100 text-zinc-700 border-zinc-300" },
}
import { Button } from "@/components/ui/button"
import { useWarehouseDetail } from "@/hooks/use-warehouse-detail"
import { WarehouseEditDialog } from "@/components/inventory/warehouse-edit-dialog"
import { WarehouseLocationsSection } from "@/components/inventory/warehouse-locations-section"
import { CardPageSkeleton } from "@/components/ui/page-skeleton"
import { deleteWarehouse } from "@/app/actions/inventory"
import { queryKeys } from "@/lib/query-keys"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount)

export default function WarehousePage() {
    const { id } = useParams<{ id: string }>()
    const { data: warehouse, isLoading } = useWarehouseDetail(id)
    const router = useRouter()
    const queryClient = useQueryClient()
    const [isDeleting, setIsDeleting] = useState(false)

    const handleDelete = async () => {
        setIsDeleting(true)
        const result = await deleteWarehouse(id)
        if (result.success) {
            toast.success("Gudang berhasil dihapus")
            queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.inventoryDashboard.all })
            router.push("/inventory/warehouses")
        } else {
            toast.error(result.error || "Gagal menghapus gudang")
            setIsDeleting(false)
        }
    }

    if (isLoading) {
        return <CardPageSkeleton accentColor="bg-amber-400" />
    }

    if (!warehouse) {
        return (
            <div className="p-8 text-center">
                <Package className="h-10 w-10 mx-auto text-zinc-300 mb-3" />
                <h1 className="text-sm font-black uppercase tracking-widest text-zinc-500">Gudang Tidak Ditemukan</h1>
                <Button asChild className="mt-4 border-2 border-black bg-white text-black hover:bg-zinc-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-black uppercase text-xs rounded-none" variant="outline">
                    <Link href="/inventory/warehouses">Kembali</Link>
                </Button>
            </div>
        )
    }

    const totalUnits = warehouse.categories.reduce((a: number, b: any) => a + b.stockCount, 0)
    const totalValue = warehouse.categories.reduce((a: number, b: any) => a + b.value, 0)
    const cap = warehouse.capacity ?? 0
    const pct = cap > 0 ? parseFloat(((totalUnits / cap) * 100).toFixed(1)) : 0

    return (
        <div className="mf-page">

            {/* COMMAND HEADER */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white">
                <div className="px-5 py-4 flex items-center justify-between border-l-[6px] border-l-amber-400">
                    <div className="flex items-center gap-3">
                        <Button variant="outline" size="icon" asChild className="border-2 border-black h-8 w-8 rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-none">
                            <Link href="/inventory/warehouses"><ArrowLeft className="h-4 w-4" /></Link>
                        </Button>
                        <div>
                            <div className="flex items-center gap-2 mb-0.5">
                                <span className="inline-block border-2 border-black bg-zinc-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider font-mono">
                                    {warehouse.code}
                                </span>
                                {warehouse.warehouseType && (
                                    <Badge className={`text-[9px] font-black uppercase px-2 py-0.5 border rounded-none ${WAREHOUSE_TYPE_CONFIG[warehouse.warehouseType]?.className || WAREHOUSE_TYPE_CONFIG.GENERAL.className}`}>
                                        {WAREHOUSE_TYPE_CONFIG[warehouse.warehouseType]?.label || "Umum"}
                                    </Badge>
                                )}
                            </div>
                            <h1 className="text-xl font-black uppercase tracking-tight">
                                {warehouse.name}
                            </h1>
                            {warehouse.address && (
                                <div className="flex items-center gap-1 text-[10px] font-bold text-zinc-500 uppercase tracking-wide mt-0.5">
                                    <MapPin className="h-3 w-3" /> {warehouse.address}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <WarehouseEditDialog warehouse={{ ...warehouse, capacity: warehouse.capacity ?? undefined, warehouseType: warehouse.warehouseType }} />
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="outline" className="border-2 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)] font-bold uppercase text-[10px] tracking-wider h-9 px-3 rounded-none">
                                    <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Hapus
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="border-2 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                <AlertDialogHeader>
                                    <AlertDialogTitle className="font-black uppercase tracking-tight">Hapus Gudang?</AlertDialogTitle>
                                    <AlertDialogDescription className="text-zinc-600">
                                        Gudang <span className="font-bold text-black">{warehouse.name}</span> akan dinonaktifkan.
                                        Gudang dengan stok aktif atau transfer yang belum selesai tidak dapat dihapus.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel disabled={isDeleting} className="border-2 border-black rounded-none font-bold uppercase text-xs">
                                        Batal
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                        onClick={handleDelete}
                                        disabled={isDeleting}
                                        className="bg-red-600 hover:bg-red-700 text-white border-2 border-red-800 rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-bold uppercase text-xs"
                                    >
                                        {isDeleting ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-2 h-3.5 w-3.5" />}
                                        Hapus
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </div>
            </div>

            {/* KPI STRIP */}
            <div className="bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <div className="grid grid-cols-2 md:grid-cols-4">
                    {/* Total Value */}
                    <div className="relative p-4 md:p-5 border-r-2 border-b-2 md:border-b-0 border-zinc-100">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <DollarSign className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Nilai Total</span>
                        </div>
                        <div className="text-lg md:text-xl font-black tracking-tighter text-emerald-600">
                            {formatCurrency(totalValue)}
                        </div>
                    </div>

                    {/* Categories */}
                    <div className="relative p-4 md:p-5 border-r-2 border-b-2 md:border-b-0 border-zinc-100">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-blue-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <Layers className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Kategori</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-blue-600">
                            {warehouse.categories.length}
                        </div>
                    </div>

                    {/* Stock Units */}
                    <div className="relative p-4 md:p-5 border-r-2 border-b-2 md:border-b-0 border-zinc-100">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-violet-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <Package className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total Unit</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-violet-600">
                            {totalUnits.toLocaleString()}
                        </div>
                    </div>

                    {/* Utilization */}
                    <div className="relative p-4 md:p-5">
                        <div className={`absolute top-0 left-0 right-0 h-1 ${pct >= 90 ? 'bg-red-400' : pct >= 60 ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                        <div className="flex items-center gap-2 mb-2">
                            <Box className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Kapasitas</span>
                        </div>
                        <div className={`text-2xl md:text-3xl font-black tracking-tighter ${pct >= 90 ? 'text-red-600' : pct >= 60 ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {pct}%
                        </div>
                        <div className="mt-1.5">
                            <div className="w-full bg-zinc-200 h-1.5">
                                <div
                                    className={`h-1.5 transition-all ${pct >= 90 ? 'bg-red-500' : pct >= 60 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                    style={{ width: `${Math.min(pct, 100)}%` }}
                                />
                            </div>
                            <p className="text-[9px] font-mono font-bold text-zinc-400 text-right mt-0.5">
                                {totalUnits.toLocaleString()} / {(cap || 0).toLocaleString()}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* STORAGE CATEGORIES */}
            <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <div className="px-5 py-3 border-b-2 border-black bg-zinc-50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <LayoutGrid className="h-4 w-4 text-zinc-500" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                            Kategori Penyimpanan
                        </span>
                    </div>
                    <Button asChild className="bg-black text-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-none transition-all font-black uppercase text-[9px] tracking-wider px-3 h-7 rounded-none">
                        <Link href="/inventory/categories">
                            Kelola Kategori
                        </Link>
                    </Button>
                </div>

                {warehouse.categories.length === 0 ? (
                    <div className="p-8 text-center">
                        <Package className="h-8 w-8 mx-auto text-zinc-200 mb-2" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                            Belum ada kategori di gudang ini
                        </p>
                        <p className="text-[10px] text-zinc-400 mt-1">
                            Produk akan muncul di sini setelah di-assign ke gudang
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                        {warehouse.categories.map((cat: any, idx: number) => {
                            const isLast = idx === warehouse.categories.length - 1
                            const catPct = cap > 0 ? parseFloat(((cat.stockCount / cap) * 100).toFixed(1)) : 0
                            return (
                                <div
                                    key={cat.id}
                                    className={`p-4 space-y-3 ${!isLast ? 'border-b-2 md:border-b-0 md:border-r-2 border-black' : ''}`}
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="text-sm font-black uppercase tracking-tight">{cat.name}</h3>
                                            <p className="text-[10px] font-bold text-zinc-500 mt-0.5">
                                                {cat.stockCount.toLocaleString()} unit &middot; {cat.itemCount} SKU
                                            </p>
                                        </div>
                                        <span className="text-[10px] font-black border-2 border-black px-1.5 py-0.5 bg-zinc-50">
                                            {catPct}%
                                        </span>
                                    </div>

                                    {/* Mini capacity bar */}
                                    <div className="w-full bg-zinc-200 h-1">
                                        <div
                                            className="h-1 bg-emerald-500 transition-all"
                                            style={{ width: `${Math.min(catPct, 100)}%` }}
                                        />
                                    </div>

                                    <div className="flex justify-between items-center pt-1 border-t border-zinc-200">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Nilai</span>
                                        <span className="text-xs font-mono font-bold text-emerald-600">{formatCurrency(cat.value)}</span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* LOKASI PENYIMPANAN */}
            <WarehouseLocationsSection warehouseId={warehouse.id} />
        </div>
    )
}
