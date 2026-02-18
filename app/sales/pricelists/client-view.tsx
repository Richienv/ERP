"use client"

import { useState, useMemo } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Plus, Search, Tag, Package, Users, Filter, RefreshCcw } from "lucide-react"
import Link from "next/link"
import { PriceBookGallery } from "@/components/sales/pricelists/price-book-gallery"
import { BookletViewer } from "@/components/sales/pricelists/booklet-viewer"
import { PriceListSummary } from "@/components/sales/pricelists/data"

interface PriceListsClientProps {
    initialPriceLists: PriceListSummary[]
}

export function PriceListsClient({ initialPriceLists }: PriceListsClientProps) {
    const [search, setSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all")
    const [selectedBook, setSelectedBook] = useState<PriceListSummary | null>(null)
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [isViewerOpen, setIsViewerOpen] = useState(false)
    const [refreshing, setRefreshing] = useState(false)
    const queryClient = useQueryClient()

    const filtered = useMemo(() => {
        return initialPriceLists.filter(pl => {
            const matchSearch = search === "" ||
                pl.name.toLowerCase().includes(search.toLowerCase()) ||
                pl.code.toLowerCase().includes(search.toLowerCase())
            const matchStatus = statusFilter === "all" ||
                (statusFilter === "active" && pl.isActive) ||
                (statusFilter === "inactive" && !pl.isActive)
            return matchSearch && matchStatus
        })
    }, [initialPriceLists, search, statusFilter])

    const totalProducts = initialPriceLists.reduce((acc, pl) => acc + pl.itemCount, 0)
    const totalCustomers = initialPriceLists.reduce((acc, pl) => acc + pl.customerCount, 0)
    const activeCount = initialPriceLists.filter(pl => pl.isActive).length

    const handleOpenBook = (pl: PriceListSummary) => {
        const idx = initialPriceLists.findIndex(p => p.id === pl.id)
        setSelectedBook(pl)
        setSelectedIndex(idx >= 0 ? idx : 0)
        setIsViewerOpen(true)
    }

    const handleRefresh = () => {
        setRefreshing(true)
        queryClient.invalidateQueries({ queryKey: queryKeys.priceLists.all })
        setRefreshing(false)
    }

    return (
        <div className="space-y-6 p-4 md:p-6 lg:p-8 pt-6 w-full min-h-screen bg-zinc-50/50 dark:bg-black">

            {/* ═══════════════════════════════════════════ */}
            {/* COMMAND HEADER                              */}
            {/* ═══════════════════════════════════════════ */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900 rounded-none">
                <div className="px-6 py-4 flex items-center justify-between border-l-[6px] border-l-violet-500">
                    <div className="flex items-center gap-3">
                        <Tag className="h-6 w-6 text-violet-500" />
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                                Daftar Harga
                            </h1>
                            <p className="text-zinc-600 text-xs font-bold mt-0.5">
                                Kelola katalog harga untuk segmen pelanggan berbeda
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            onClick={handleRefresh}
                            disabled={refreshing}
                            className="h-9 border-2 border-black font-bold uppercase text-[10px] tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-none transition-all rounded-none bg-white"
                        >
                            <RefreshCcw className={`mr-2 h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                            Refresh
                        </Button>
                        <Button
                            asChild
                            className="bg-black text-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all font-black uppercase tracking-wide text-[10px] px-4 h-9 rounded-none"
                        >
                            <Link href="/sales/pricelists/new">
                                <Plus className="mr-2 h-4 w-4" />
                                Buat Baru
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════ */}
            {/* KPI PULSE STRIP                            */}
            {/* ═══════════════════════════════════════════ */}
            <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden rounded-none">
                <div className="grid grid-cols-1 md:grid-cols-3">
                    {/* Active Price Lists */}
                    <div className="relative p-4 md:p-5 md:border-r-2 border-b-2 md:border-b-0 border-zinc-100 dark:border-zinc-800">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-violet-500" />
                        <div className="flex items-center gap-2 mb-2">
                            <Tag className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Daftar Harga</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-violet-600">
                            {initialPriceLists.length}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5">
                            <span className="text-[10px] font-bold text-violet-600 uppercase">{activeCount} AKtif</span>
                        </div>
                    </div>

                    {/* Total Price Items */}
                    <div className="relative p-4 md:p-5 md:border-r-2 border-b-2 md:border-b-0 border-zinc-100 dark:border-zinc-800">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500" />
                        <div className="flex items-center gap-2 mb-2">
                            <Package className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Item Harga</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-blue-600">
                            {totalProducts}
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                            <span className="text-[10px] font-bold text-blue-600 uppercase">Variasi Harga</span>
                        </div>
                    </div>

                    {/* Customers Reached */}
                    <div className="relative p-4 md:p-5">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
                        <div className="flex items-center gap-2 mb-2">
                            <Users className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Pelanggan</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-emerald-600">
                            {totalCustomers}
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                            <span className="text-[10px] font-bold text-emerald-600 uppercase">Terhubung</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════ */}
            {/* TOOLBAR                                     */}
            {/* ═══════════════════════════════════════════ */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white rounded-none p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <Input
                        placeholder="Cari nama atau kode..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 border-2 border-black focus-visible:ring-0 font-bold h-10 rounded-none bg-zinc-50 focus:bg-white transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)]"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                        <SelectTrigger className="w-[160px] border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-y-[1px] font-bold uppercase text-[10px] tracking-wide rounded-none h-10 bg-white">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-none">
                            <SelectItem value="all" className="font-bold uppercase text-xs focus:bg-zinc-100 cursor-pointer">Semua Status</SelectItem>
                            <SelectItem value="active" className="font-bold uppercase text-xs focus:bg-zinc-100 cursor-pointer">Aktif</SelectItem>
                            <SelectItem value="inactive" className="font-bold uppercase text-xs focus:bg-zinc-100 cursor-pointer">Nonaktif</SelectItem>
                        </SelectContent>
                    </Select>

                    {search && (
                        <Badge className="bg-black text-white border-2 border-black font-black uppercase text-[10px] tracking-wide px-3 h-10 rounded-none flex items-center">
                            {filtered.length} ditemukan
                        </Badge>
                    )}
                </div>
            </div>

            {/* ═══════════════════════════════════════════ */}
            {/* GALLERY GRID                                */}
            {/* ═══════════════════════════════════════════ */}
            <PriceBookGallery
                priceLists={filtered}
                onOpenBook={handleOpenBook}
            />

            {/* Detail Viewer Sheet */}
            <BookletViewer
                summary={selectedBook}
                colorIndex={selectedIndex}
                isOpen={isViewerOpen}
                onClose={() => setIsViewerOpen(false)}
            />
        </div>
    )
}
