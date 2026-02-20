"use client"

import { useState } from "react"
import {
    Package,
    LayoutGrid,
    List,
    AlertTriangle,
    CheckCircle2,
    Boxes,
    Wallet,
    Download,
    ChevronDown,
} from "lucide-react"
import * as XLSX from "xlsx"
import { Button } from "@/components/ui/button"
import { InventoryKanbanBoard } from "@/components/inventory/inventory-kanban-board"
import { ProductDataTable } from "@/components/inventory/product-data-table"
import { ProductCreateDialog } from "@/components/inventory/product-create-dialog"
import { ImportProductsDialog } from "@/components/inventory/import-products-dialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatIDR } from "@/lib/utils"

interface ProductsPageClientProps {
    products: any[]
    categories: any[]
    warehouses: any[]
    stats: {
        total: number
        healthy: number
        lowStock: number
        critical: number
        totalValue: number
    }
}

function exportProducts(products: any[], format: "csv" | "xlsx") {
    const rows = products.map((p: any) => ({
        Kode: p.code || "",
        Nama: p.name || "",
        Kategori: p.category?.name || "",
        Unit: p.unit?.name || p.unit || "",
        "Harga Beli": p.costPrice ?? 0,
        "Harga Jual": p.sellingPrice ?? 0,
        Stok: p.currentStock ?? 0,
        "Stok Minimum": p.minStock ?? 0,
    }))

    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Produk")

    const filename = `produk-${new Date().toISOString().slice(0, 10)}`
    if (format === "csv") {
        XLSX.writeFile(wb, `${filename}.csv`, { bookType: "csv" })
    } else {
        XLSX.writeFile(wb, `${filename}.xlsx`)
    }
}

export function ProductsPageClient({ products, categories, warehouses, stats }: ProductsPageClientProps) {
    const [view, setView] = useState<"kanban" | "list">("kanban")

    return (
        <div className="mf-page">

            {/* ═══════════════════════════════════════════ */}
            {/* COMMAND HEADER                              */}
            {/* ═══════════════════════════════════════════ */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900">
                <div className="px-6 py-4 flex items-center justify-between border-l-[6px] border-l-emerald-400">
                    <div className="flex items-center gap-3">
                        <Package className="h-5 w-5 text-emerald-500" />
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                                Kelola Produk
                            </h1>
                            <p className="text-zinc-400 text-xs font-medium mt-0.5">
                                Monitor stok, nilai inventori, dan kebutuhan replenishment
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* View Toggle */}
                        <div className="flex border-2 border-black">
                            <button
                                onClick={() => setView("kanban")}
                                className={`px-3 py-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest transition-all border-r-2 border-black ${
                                    view === "kanban"
                                        ? "bg-black text-white"
                                        : "bg-white text-zinc-400 hover:bg-zinc-50"
                                }`}
                            >
                                <LayoutGrid className="h-3.5 w-3.5" />
                                Kanban
                            </button>
                            <button
                                onClick={() => setView("list")}
                                className={`px-3 py-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest transition-all ${
                                    view === "list"
                                        ? "bg-black text-white"
                                        : "bg-white text-zinc-400 hover:bg-zinc-50"
                                }`}
                            >
                                <List className="h-3.5 w-3.5" />
                                Tabel
                            </button>
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    className="border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-bold text-xs uppercase tracking-wide h-9"
                                >
                                    <Download className="h-3.5 w-3.5 mr-1.5" />
                                    Export
                                    <ChevronDown className="h-3 w-3 ml-1" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="border-2 border-black">
                                <DropdownMenuItem onClick={() => exportProducts(products, "xlsx")} className="font-bold text-xs">
                                    Export XLSX (Excel)
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => exportProducts(products, "csv")} className="font-bold text-xs">
                                    Export CSV
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <ImportProductsDialog />
                        <ProductCreateDialog />
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════ */}
            {/* KPI PULSE STRIP                            */}
            {/* ═══════════════════════════════════════════ */}
            <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <div className="grid grid-cols-2 md:grid-cols-5">
                    {/* Total Products */}
                    <div className="relative p-4 md:p-5 md:border-r-2 border-b-2 md:border-b-0 border-zinc-100 dark:border-zinc-800">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <Boxes className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total Produk</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-zinc-900 dark:text-white">
                            {stats.total}
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                            <span className="text-[10px] font-bold text-emerald-600">Produk aktif</span>
                        </div>
                    </div>

                    {/* Healthy */}
                    <div className="relative p-4 md:p-5 md:border-r-2 border-b-2 md:border-b-0 border-zinc-100 dark:border-zinc-800">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <CheckCircle2 className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Stok Sehat</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-emerald-600">
                            {stats.healthy}
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                            <span className="text-[10px] font-bold text-emerald-600">Level normal</span>
                        </div>
                    </div>

                    {/* Low Stock */}
                    <div className="relative p-4 md:p-5 md:border-r-2 border-b-2 md:border-b-0 border-zinc-100 dark:border-zinc-800">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-amber-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <Package className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Stok Menipis</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-amber-600">
                            {stats.lowStock}
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                            <span className="text-[10px] font-bold text-amber-600">Perlu perhatian</span>
                        </div>
                    </div>

                    {/* Critical */}
                    <div className="relative p-4 md:p-5 md:border-r-2 border-b-2 md:border-b-0 border-zinc-100 dark:border-zinc-800">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-red-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Kritis</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-red-600">
                            {stats.critical}
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                            <span className="text-[10px] font-bold text-red-600">Segera restock</span>
                        </div>
                    </div>

                    {/* Total Value */}
                    <div className="relative p-4 md:p-5">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-violet-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <Wallet className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Nilai Inventori</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-zinc-900 dark:text-white">
                            {stats.totalValue === 0
                                ? <span className="text-zinc-300 text-lg">Rp 0</span>
                                : formatIDR(stats.totalValue)}
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                            <span className="text-[10px] font-bold text-violet-600">Berdasarkan harga beli</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════ */}
            {/* VIEW CONTENT                               */}
            {/* ═══════════════════════════════════════════ */}
            {view === "kanban" ? (
                <InventoryKanbanBoard products={products} warehouses={warehouses} categories={categories} />
            ) : (
                <ProductDataTable data={products} categories={categories} />
            )}
        </div>
    )
}
