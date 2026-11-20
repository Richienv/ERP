"use client"

import { useState } from "react"
import { useActionSignal } from "@/hooks/use-action-signal"
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
    ClipboardList,
    ArrowDownToLine,
    DollarSign,
} from "lucide-react"
import * as XLSX from "xlsx"
import { Button } from "@/components/ui/button"
import { InventoryKanbanBoard } from "@/components/inventory/inventory-kanban-board"
import { ProductDataTable } from "@/components/inventory/product-data-table"
import { ProductCreateDialog } from "@/components/inventory/product-create-dialog"
import { ImportProductsDialog } from "@/components/inventory/import-products-dialog"
import { BatchPriceDialog } from "@/components/inventory/batch-price-dialog"
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
        newArrivals: number
        planning: number
        incoming: number
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
        "Harga Jual": p.sellingPrice ?? "",
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
    const { triggered: autoOpenCreate, clear: clearAutoOpen } = useActionSignal("new")
    const [view, setView] = useState<"kanban" | "list">("kanban")
    const [batchPriceOpen, setBatchPriceOpen] = useState(false)

    return (
        <div className="mf-page">

            {/* ═══════════════════════════════════════════ */}
            {/* COMMAND HEADER                              */}
            {/* ═══════════════════════════════════════════ */}
            <div className="border border-border shadow-sm overflow-hidden bg-white dark:bg-zinc-900">
                <div className="px-6 py-4 flex items-center justify-between border-l-[6px] border-l-emerald-400">
                    <div className="flex items-center gap-3">
                        <Package className="h-5 w-5 text-emerald-500" />
                        <div>
                            <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">
                                Kelola Produk
                            </h1>
                            <p className="text-zinc-400 text-xs font-medium mt-0.5">
                                Monitor stok, nilai inventori, dan kebutuhan replenishment
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* View Toggle */}
                        <div className="flex border border-border">
                            <button
                                onClick={() => setView("kanban")}
                                className={`px-3 py-2 flex items-center gap-1.5 text-xs font-semibold   transition-all border-r border-border ${view === "kanban"
                                    ? "bg-slate-900 text-white"
                                    : "bg-white text-zinc-400 hover:bg-zinc-50"
                                    }`}
                            >
                                <LayoutGrid className="h-3.5 w-3.5" />
                                Kanban
                            </button>
                            <button
                                onClick={() => setView("list")}
                                className={`px-3 py-2 flex items-center gap-1.5 text-xs font-semibold   transition-all ${view === "list"
                                    ? "bg-slate-900 text-white"
                                    : "bg-white text-zinc-400 hover:bg-zinc-50"
                                    }`}
                            >
                                <List className="h-3.5 w-3.5" />
                                Tabel
                            </button>
                        </div>
                        <Button
                            variant="outline"
                            onClick={() => setBatchPriceOpen(true)}
                            className="border border-border shadow-sm font-bold text-xs h-9"
                        >
                            <DollarSign className="h-3.5 w-3.5 mr-1.5" />
                            Update Harga Massal
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    className="border border-border shadow-sm font-bold text-xs h-9"
                                >
                                    <Download className="h-3.5 w-3.5 mr-1.5" />
                                    Export
                                    <ChevronDown className="h-3 w-3 ml-1" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="border border-border">
                                <DropdownMenuItem onClick={() => exportProducts(products, "xlsx")} className="font-bold text-xs">
                                    Export XLSX (Excel)
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => exportProducts(products, "csv")} className="font-bold text-xs">
                                    Export CSV
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <ImportProductsDialog />
                        <ProductCreateDialog autoOpen={autoOpenCreate} onAutoOpenConsumed={clearAutoOpen} />
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════ */}
            {/* KPI PULSE STRIP                            */}
            {/* ═══════════════════════════════════════════ */}
            <div className="bg-white dark:bg-zinc-900 border border-border shadow-sm overflow-hidden">
                <div className="grid grid-cols-2 md:grid-cols-7">
                    {/* Total Products */}
                    <div className="relative p-4 md:p-5 md:border-r border-b md:border-b-0 border-zinc-100 dark:border-zinc-800">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <Boxes className="h-4 w-4 text-zinc-400" />
                            <span className="text-xs font-semibold text-zinc-500">Total Produk</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-semibold tracking-tighter text-zinc-900 dark:text-white">
                            {stats.total}
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                            <span className="text-xs font-bold text-emerald-600">Produk aktif</span>
                        </div>
                    </div>

                    {/* Healthy */}
                    <div className="relative p-4 md:p-5 md:border-r border-b md:border-b-0 border-zinc-100 dark:border-zinc-800">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <CheckCircle2 className="h-4 w-4 text-zinc-400" />
                            <span className="text-xs font-semibold text-zinc-500">Stok Sehat</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-semibold tracking-tighter text-emerald-600">
                            {stats.healthy}
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                            <span className="text-xs font-bold text-emerald-600">Level normal</span>
                        </div>
                    </div>

                    {/* Low Stock */}
                    <div className="relative p-4 md:p-5 md:border-r border-b md:border-b-0 border-zinc-100 dark:border-zinc-800">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-amber-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <Package className="h-4 w-4 text-zinc-400" />
                            <span className="text-xs font-semibold text-zinc-500">Stok Menipis</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-semibold tracking-tighter text-amber-600">
                            {stats.lowStock}
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                            <span className="text-xs font-bold text-amber-600">Perlu perhatian</span>
                        </div>
                    </div>

                    {/* Critical */}
                    <div className="relative p-4 md:p-5 md:border-r border-b md:border-b-0 border-zinc-100 dark:border-zinc-800">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-red-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="h-4 w-4 text-zinc-400" />
                            <span className="text-xs font-semibold text-zinc-500">Kritis</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-semibold tracking-tighter text-red-600">
                            {stats.critical}
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                            <span className="text-xs font-bold text-red-600">Segera restock</span>
                        </div>
                    </div>

                    {/* Planning (PR Aktif) */}
                    <div className="relative p-4 md:p-5 md:border-r border-b md:border-b-0 border-zinc-100 dark:border-zinc-800">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-violet-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <ClipboardList className="h-4 w-4 text-zinc-400" />
                            <span className="text-xs font-semibold text-zinc-500">Planning</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-semibold tracking-tighter text-violet-600">
                            {stats.planning}
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                            <span className="text-xs font-bold text-violet-600">PR aktif</span>
                        </div>
                    </div>

                    {/* Incoming (PO Aktif) */}
                    <div className="relative p-4 md:p-5 md:border-r border-b md:border-b-0 border-zinc-100 dark:border-zinc-800">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-cyan-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <ArrowDownToLine className="h-4 w-4 text-zinc-400" />
                            <span className="text-xs font-semibold text-zinc-500">Incoming</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-semibold tracking-tighter text-cyan-600">
                            {stats.incoming}
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                            <span className="text-xs font-bold text-cyan-600">PO aktif</span>
                        </div>
                    </div>

                    {/* Total Value */}
                    <div className="relative p-4 md:p-5">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-zinc-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <Wallet className="h-4 w-4 text-zinc-400" />
                            <span className="text-xs font-semibold text-zinc-500">Nilai Inventori</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-semibold tracking-tighter text-zinc-900 dark:text-white">
                            {stats.totalValue === 0
                                ? <span className="text-zinc-300 text-lg">Rp 0</span>
                                : formatIDR(stats.totalValue)}
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                            <span className="text-xs font-bold text-zinc-500">Berdasarkan harga beli</span>
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

            <BatchPriceDialog
                products={products}
                open={batchPriceOpen}
                onOpenChange={setBatchPriceOpen}
            />
        </div>
    )
}
