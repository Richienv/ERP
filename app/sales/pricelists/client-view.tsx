"use client"

import { useState, useMemo } from "react"
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
import { Plus, Search, Tag, Package, Users } from "lucide-react"
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

    return (
        <div className="space-y-6">
            {/* Page Header - Neo Brutalist */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black uppercase tracking-tight">Daftar Harga</h1>
                    <p className="text-sm font-medium text-muted-foreground mt-1 uppercase tracking-wide">
                        Kelola katalog harga untuk segmen pelanggan berbeda
                    </p>
                </div>
                <Button
                    asChild
                    className="bg-black text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-black uppercase tracking-wide active:scale-[0.98]"
                >
                    <Link href="/sales/pricelists/new">
                        <Plus className="mr-2 h-4 w-4" />
                        Buat Daftar Harga
                    </Link>
                </Button>
            </div>

            {/* Summary Stats - Neo Brutalist Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 flex items-center gap-4">
                    <div className="h-12 w-12 bg-black text-white flex items-center justify-center border-2 border-black shadow-[2px_2px_0px_0px_rgba(255,255,255,0.3)]">
                        <Tag className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-3xl font-black tracking-tighter">{initialPriceLists.length}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                            Daftar Harga ({activeCount} aktif)
                        </p>
                    </div>
                </div>
                <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 flex items-center gap-4">
                    <div className="h-12 w-12 bg-blue-500 text-white flex items-center justify-center border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)]">
                        <Package className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-3xl font-black tracking-tighter">{totalProducts}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                            Total Item Harga
                        </p>
                    </div>
                </div>
                <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 flex items-center gap-4">
                    <div className="h-12 w-12 bg-emerald-500 text-white flex items-center justify-center border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)]">
                        <Users className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-3xl font-black tracking-tighter">{totalCustomers}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                            Pelanggan Terhubung
                        </p>
                    </div>
                </div>
            </div>

            {/* Filters - Neo Brutalist */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Cari nama atau kode..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] focus-visible:ring-0 focus-visible:translate-x-[2px] focus-visible:translate-y-[2px] focus-visible:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-medium bg-white dark:bg-zinc-900"
                    />
                </div>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                    <SelectTrigger className="w-[160px] border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-bold uppercase text-xs tracking-wide bg-white dark:bg-zinc-900">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <SelectItem value="all" className="font-bold uppercase text-xs">Semua Status</SelectItem>
                        <SelectItem value="active" className="font-bold uppercase text-xs">Aktif</SelectItem>
                        <SelectItem value="inactive" className="font-bold uppercase text-xs">Nonaktif</SelectItem>
                    </SelectContent>
                </Select>
                {search && (
                    <Badge className="bg-black text-white border-2 border-black font-black uppercase text-xs tracking-wide px-3 py-1">
                        {filtered.length} hasil
                    </Badge>
                )}
            </div>

            {/* Gallery Grid */}
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
