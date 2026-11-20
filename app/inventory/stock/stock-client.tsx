"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import {
    Search,
    AlertTriangle,
    Package,
    ArrowUpRight,
    ArrowDownRight,
    Layers,
    ClipboardEdit,
    Download,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { formatIDR } from "@/lib/utils"
import { AdjustmentForm } from "@/components/inventory/adjustment-form"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { NB } from "@/lib/dialog-styles"
import { exportToExcel } from "@/lib/table-export"

interface StockClientProps {
    products: any[]
    warehouses: any[]
}

export function StockClient({ products, warehouses }: StockClientProps) {
    const [search, setSearch] = useState("")
    const [filterCategory, setFilterCategory] = useState("All")
    const [adjustmentOpen, setAdjustmentOpen] = useState(false)

    // Flatten stock levels into a single list
    const stockItems = useMemo(() => {
        const items: any[] = []
        products.forEach(p => {
            if (p.stockLevels && p.stockLevels.length > 0) {
                p.stockLevels.forEach((sl: any) => {
                    const wh = warehouses.find(w => w.id === sl.warehouseId)
                    items.push({
                        id: p.id,
                        productId: p.id,
                        sku: p.code,
                        name: p.name,
                        category: p.category?.name || 'Uncategorized',
                        location: wh ? wh.name : 'Unknown',
                        qty: sl.quantity,
                        unit: p.unit || 'Units',
                        min: sl.minStock || 0,
                        max: sl.maxStock || 0,
                        status: sl.quantity <= (sl.minStock || 0) ? 'Low' : 'Healthy',
                        cost: p.costPrice || 0
                    })
                })
            } else {
                // Product with no stock record (0 qty)
                items.push({
                    id: p.id,
                    productId: p.id,
                    sku: p.code,
                    name: p.name,
                    category: p.category?.name || 'Uncategorized',
                    location: '-',
                    qty: 0,
                    unit: p.unit || 'Units',
                    min: 0,
                    max: 0,
                    status: 'Empty',
                    cost: p.costPrice || 0
                })
            }
        })
        return items
    }, [products, warehouses])

    // Filter logic
    const filteredItems = stockItems.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) ||
            item.sku.toLowerCase().includes(search.toLowerCase())
        const matchesCategory = filterCategory === "All" || item.category === filterCategory
        return matchesSearch && matchesCategory
    })

    // KPI Stats
    const stats = {
        totalValuation: filteredItems.reduce((acc, item) => acc + (item.qty * item.cost), 0),
        lowStockCount: filteredItems.filter(i => i.status === 'Low').length,
        stockHealth: filteredItems.length > 0
            ? Math.round((filteredItems.filter(i => i.status === 'Healthy').length / filteredItems.length) * 100)
            : 0
    }

    const categories = ['All', ...Array.from(new Set(stockItems.map(i => i.category)))]

    return (
        <div className="space-y-4">
            {/* ═══════════════════════════════════════════ */}
            {/* COMMAND HEADER                              */}
            {/* ═══════════════════════════════════════════ */}
            <div className="border border-border shadow-sm overflow-hidden bg-white dark:bg-zinc-900">
                <div className="px-6 py-4 flex items-center justify-between border-l-[6px] border-l-blue-400">
                    <div className="flex items-center gap-3">
                        <Layers className="h-5 w-5 text-blue-500" />
                        <div>
                            <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">
                                Level Stok
                            </h1>
                            <p className="text-zinc-400 text-xs font-medium mt-0.5">
                                Real-time monitoring persediaan dan status ketersediaan
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={() => {
                                const cols = [
                                    { header: "SKU", accessorKey: "sku" },
                                    { header: "Nama Produk", accessorKey: "name" },
                                    { header: "Kategori", accessorKey: "category" },
                                    { header: "Lokasi", accessorKey: "location" },
                                    { header: "Qty", accessorKey: "qty" },
                                    { header: "Satuan", accessorKey: "unit" },
                                    { header: "Min", accessorKey: "min" },
                                    { header: "Max", accessorKey: "max" },
                                    { header: "Status", accessorKey: "status" },
                                    { header: "Harga Beli", accessorKey: "cost" },
                                ]
                                exportToExcel(cols, filteredItems as Record<string, unknown>[], { filename: "level-stok" })
                            }}
                            className="border border-border font-bold text-xs shadow-sm hover:shadow-none transition-all h-9 rounded-md"
                        >
                            <Download className="mr-2 h-3.5 w-3.5" /> Export
                        </Button>
                        <Button
                            onClick={() => setAdjustmentOpen(true)}
                            className="bg-slate-900 text-white hover:bg-zinc-800 border border-border shadow-sm font-bold text-xs hover:shadow-none transition-all h-9 rounded-md"
                        >
                            <ClipboardEdit className="mr-2 h-3.5 w-3.5" /> Penyesuaian
                        </Button>
                        <Link href="/inventory/alerts">
                            <Button variant="outline" className="border border-border font-bold text-xs shadow-sm hover:shadow-none transition-all h-9 rounded-md">
                                <AlertTriangle className="mr-2 h-3.5 w-3.5 text-amber-500" /> Alerts ({stats.lowStockCount})
                            </Button>
                        </Link>
                        <Link href="/inventory/audit">
                            <Button className="bg-slate-900 text-white hover:bg-zinc-800 border border-border shadow-sm font-bold text-xs hover:shadow-none transition-all h-9 rounded-md">
                                <Package className="mr-2 h-3.5 w-3.5" /> Stock Opname
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════ */}
            {/* KPI PULSE STRIP                            */}
            {/* ═══════════════════════════════════════════ */}
            <div className="bg-white dark:bg-zinc-900 border border-border shadow-sm overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-3">

                    {/* Valuation */}
                    <div className="relative p-4 md:p-5 md:border-r border-b md:border-b-0 border-zinc-100 dark:border-zinc-800">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <ArrowUpRight className="h-4 w-4 text-zinc-400" />
                            <span className="text-xs font-semibold text-zinc-500">Total Valuasi</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-semibold tracking-tighter text-emerald-600">
                            {formatIDR(stats.totalValuation)}
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                            <span className="text-xs font-bold text-emerald-600">Nilai aset saat ini</span>
                        </div>
                    </div>

                    {/* Low Stock */}
                    <div className="relative p-4 md:p-5 md:border-r border-b md:border-b-0 border-zinc-100 dark:border-zinc-800">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-red-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <ArrowDownRight className="h-4 w-4 text-zinc-400" />
                            <span className="text-xs font-semibold text-zinc-500">Stok Menipis</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-semibold tracking-tighter text-red-600">
                            {stats.lowStockCount} <span className="text-lg text-zinc-400">Items</span>
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                            <span className="text-xs font-bold text-red-600">Perlu restock segera</span>
                        </div>
                    </div>

                    {/* Stock Health */}
                    <div className="relative p-4 md:p-5">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-blue-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <Package className="h-4 w-4 text-zinc-400" />
                            <span className="text-xs font-semibold text-zinc-500">Kesehatan Stok</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-semibold tracking-tighter text-blue-600">
                            {stats.stockHealth}%
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 w-full max-w-[200px]">
                            <Progress value={stats.stockHealth} className="h-1.5 flex-1 bg-blue-100 rounded-md" indicatorClassName="bg-blue-500" />
                        </div>
                    </div>

                </div>
            </div>

            {/* ═══════════════════════════════════════════ */}
            {/* FILTERS & SEARCH                            */}
            {/* ═══════════════════════════════════════════ */}
            <div className="flex items-center gap-4 bg-white p-3 border border-border shadow-sm">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <Input
                        placeholder="Cari SKU, Nama Produk..."
                        className="pl-9 border border-zinc-200 focus-visible:ring-0 focus-visible:border-border font-bold rounded-md"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="flex gap-2 overflow-x-auto no-scrollbar">
                    {categories.slice(0, 5).map((cat) => (
                        <button
                            key={cat}
                            onClick={() => setFilterCategory(cat)}
                            className={`
                                px-3 py-1.5 text-xs font-semibold   border transition-all rounded-md
                                ${filterCategory === cat
                                    ? 'bg-primary text-primary-foreground border-border shadow-sm'
                                    : 'bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400 hover:text-black'}
                            `}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* ═══════════════════════════════════════════ */}
            {/* STOCK DATA TABLE                            */}
            {/* ═══════════════════════════════════════════ */}
            <div className="border border-border shadow-sm overflow-hidden bg-white">
                <Table>
                    <TableHeader className="bg-zinc-50 border-b border-border">
                        <TableRow className="hover:bg-zinc-50">
                            <TableHead className="font-semibold text-black text-xs w-[120px]">SKU</TableHead>
                            <TableHead className="font-semibold text-black text-xs">Nama Produk</TableHead>
                            <TableHead className="font-semibold text-black text-xs">Kategori</TableHead>
                            <TableHead className="font-semibold text-black text-xs">Lokasi</TableHead>
                            <TableHead className="font-semibold text-black text-xs text-right">Qty</TableHead>
                            <TableHead className="font-semibold text-black text-xs text-center">Status</TableHead>
                            <TableHead className="font-semibold text-black text-xs text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredItems.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-32 text-center text-zinc-400 font-medium">
                                    Tidak ada data stok ditemukan.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredItems.map((item) => (
                                <TableRow key={`${item.id}-${item.location}`} className="cursor-pointer hover:bg-zinc-50 group border-b border-zinc-100">
                                    <TableCell className="font-mono text-xs font-bold text-zinc-500 group-hover:text-black">
                                        {item.sku}
                                    </TableCell>
                                    <TableCell>
                                        <span className="font-bold text-sm text-zinc-900">{item.name}</span>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="border-zinc-200 text-zinc-500 text-xs font-bold bg-zinc-50 rounded-md">
                                            {item.category}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-xs font-bold text-zinc-500">
                                        <span className="flex items-center gap-1.5"><Layers className="h-3 w-3" /> {item.location}</span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex flex-col items-end">
                                            <span className="font-semibold text-base">{item.qty.toLocaleString()}</span>
                                            <span className="text-xs font-bold text-zinc-400 ">{item.unit}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {item.status === 'Low' ? (
                                            <Badge className="bg-amber-100 text-amber-800 border border-amber-200 hover:bg-amber-200 font-bold text-xs shadow-sm rounded-md">
                                                Low Stock
                                            </Badge>
                                        ) : item.status === 'Empty' ? (
                                            <Badge className="bg-zinc-100 text-zinc-500 border border-zinc-200 font-bold text-xs rounded-md">
                                                Empty
                                            </Badge>
                                        ) : (
                                            <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-200 hover:bg-emerald-200 font-bold text-xs shadow-sm rounded-md">
                                                Healthy
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Link href={`/inventory/movements?product=${item.productId}`}>
                                            <Button variant="outline" size="sm" className="h-7 text-xs font-semibold border border-border bg-white shadow-sm hover:shadow-none rounded-md">
                                                Riwayat
                                            </Button>
                                        </Link>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={adjustmentOpen} onOpenChange={setAdjustmentOpen}>
                <DialogContent className={NB.content}>
                    <DialogHeader className={NB.header}>
                        <DialogTitle className={NB.title}>
                            <ClipboardEdit className="h-5 w-5" /> Penyesuaian Stok
                        </DialogTitle>
                        <p className={NB.subtitle}>Buat penyesuaian stok manual atau transfer antar gudang.</p>
                    </DialogHeader>
                    <div className="p-5">
                        <AdjustmentForm
                            products={products.map((p: any) => ({ id: p.id, name: p.name, code: p.code, unit: p.unit || "PCS" }))}
                            warehouses={warehouses.map((w: any) => ({ id: w.id, name: w.name }))}
                        />
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
