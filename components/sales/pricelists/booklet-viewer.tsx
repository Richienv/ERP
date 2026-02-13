"use client"

import { useEffect, useState, useTransition } from "react"
import { PriceListSummary, PriceListDetail, formatRupiah } from "./data"
import { getPriceListById } from "@/lib/actions/sales"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import {
    Package,
    Users,
    Tag,
} from "lucide-react"
import { cn } from "@/lib/utils"

const ACCENT_COLORS = [
    "bg-blue-500",
    "bg-emerald-500",
    "bg-amber-500",
    "bg-purple-500",
    "bg-rose-500",
    "bg-cyan-500",
    "bg-orange-500",
    "bg-indigo-500",
]

interface BookletViewerProps {
    summary: PriceListSummary | null
    colorIndex: number
    isOpen: boolean
    onClose: () => void
}

export function BookletViewer({ summary, colorIndex, isOpen, onClose }: BookletViewerProps) {
    const [detail, setDetail] = useState<PriceListDetail | null>(null)
    const [isPending, startTransition] = useTransition()
    const accent = ACCENT_COLORS[colorIndex % ACCENT_COLORS.length]

    useEffect(() => {
        if (isOpen && summary) {
            setDetail(null)
            startTransition(async () => {
                const data = await getPriceListById(summary.id)
                setDetail(data)
            })
        }
    }, [isOpen, summary])

    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent className="sm:max-w-xl md:max-w-2xl w-full p-0 overflow-hidden flex flex-col border-l-4 border-black">
                {/* Neo-Brutalist Header */}
                <div className="border-b-2 border-black bg-white dark:bg-zinc-900 shrink-0">
                    {/* Accent bar */}
                    <div className={cn("h-2 w-full", accent)} />

                    <div className="p-6 pb-4">
                        <SheetHeader className="text-left space-y-1">
                            <div className="flex items-center gap-3 mb-2">
                                <SheetTitle className="text-2xl font-black uppercase tracking-tight">
                                    {summary?.name || "Daftar Harga"}
                                </SheetTitle>
                                {summary && !summary.isActive && (
                                    <span className="bg-zinc-200 text-zinc-600 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border border-black">
                                        Nonaktif
                                    </span>
                                )}
                            </div>
                            {summary && (
                                <p className="text-[10px] text-muted-foreground font-mono font-bold uppercase tracking-widest">
                                    {summary.code} &middot; {summary.currency}
                                </p>
                            )}
                            {summary?.description && (
                                <p className="text-sm font-medium text-muted-foreground">{summary.description}</p>
                            )}
                        </SheetHeader>

                        {/* Stats row */}
                        {detail && (
                            <div className="flex items-center gap-3 mt-4">
                                <div className="flex items-center gap-2 bg-white dark:bg-zinc-800 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] px-3 py-1.5">
                                    <Package className="h-4 w-4" />
                                    <span className="font-black text-sm">{detail.itemCount}</span>
                                    <span className="text-[9px] font-bold text-muted-foreground uppercase">produk</span>
                                </div>
                                <div className="flex items-center gap-2 bg-white dark:bg-zinc-800 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] px-3 py-1.5">
                                    <Users className="h-4 w-4" />
                                    <span className="font-black text-sm">{detail.customerCount}</span>
                                    <span className="text-[9px] font-bold text-muted-foreground uppercase">pelanggan</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Content */}
                <ScrollArea className="flex-1">
                    {isPending || !detail ? (
                        <div className="p-6 space-y-4">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className="flex items-center gap-4 border-2 border-zinc-200 p-3">
                                    <Skeleton className="h-4 w-20" />
                                    <Skeleton className="h-4 flex-1" />
                                    <Skeleton className="h-4 w-24" />
                                </div>
                            ))}
                        </div>
                    ) : detail.items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                            <div className="w-16 h-16 bg-zinc-100 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center mb-4">
                                <Tag className="h-8 w-8 text-zinc-400" />
                            </div>
                            <h4 className="font-black uppercase tracking-tight text-lg mb-1">Belum Ada Produk</h4>
                            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                                Tambahkan produk ke daftar harga ini melalui halaman edit.
                            </p>
                        </div>
                    ) : (
                        <div className="p-4 space-y-6">
                            {/* Product table - neo brutalist */}
                            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                                {/* Table header */}
                                <div className="grid grid-cols-[80px_1fr_60px_100px] gap-2 bg-black text-white p-3 text-[10px] font-black uppercase tracking-widest">
                                    <span>Kode</span>
                                    <span>Produk</span>
                                    <span className="text-right">Min</span>
                                    <span className="text-right">Harga</span>
                                </div>
                                {/* Table rows */}
                                {detail.items.map((item, i) => {
                                    const discount = item.basePrice > 0
                                        ? Math.round(((item.basePrice - item.listPrice) / item.basePrice) * 100)
                                        : 0
                                    return (
                                        <div
                                            key={item.id}
                                            className={cn(
                                                "grid grid-cols-[80px_1fr_60px_100px] gap-2 p-3 items-center border-b border-dashed border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors",
                                                i % 2 === 0 ? "bg-white dark:bg-zinc-900" : "bg-zinc-50/50 dark:bg-zinc-800/30"
                                            )}
                                        >
                                            <span className="font-mono text-[10px] font-bold text-muted-foreground uppercase">
                                                {item.productCode}
                                            </span>
                                            <div>
                                                <div className="font-bold text-sm uppercase tracking-tight">{item.productName}</div>
                                                <div className="text-[10px] font-medium text-muted-foreground uppercase">
                                                    {item.category} &middot; per {item.unit}
                                                </div>
                                            </div>
                                            <span className="text-right text-xs tabular-nums font-bold">
                                                {item.minQty.toLocaleString('id-ID')}
                                            </span>
                                            <div className="text-right">
                                                <div className="font-mono font-black text-sm tracking-tight">
                                                    {formatRupiah(item.listPrice)}
                                                </div>
                                                {discount !== 0 && (
                                                    <div className="text-[10px] text-muted-foreground line-through font-mono">
                                                        {formatRupiah(item.basePrice)}
                                                    </div>
                                                )}
                                                {discount > 0 && (
                                                    <span className="inline-block bg-red-600 text-white px-1.5 py-0 text-[9px] font-black border border-black mt-0.5">
                                                        -{discount}%
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Assigned customers */}
                            {detail.customers.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-black uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <Users className="h-4 w-4" />
                                        Pelanggan Terkait
                                    </h4>
                                    <div className="flex flex-wrap gap-2">
                                        {detail.customers.map(c => (
                                            <span
                                                key={c.id}
                                                className="bg-white dark:bg-zinc-800 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] px-3 py-1 text-xs font-bold uppercase"
                                            >
                                                {c.name}
                                            </span>
                                        ))}
                                        {detail.customerCount > 10 && (
                                            <span className="bg-zinc-200 dark:bg-zinc-700 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] px-3 py-1 text-xs font-bold uppercase">
                                                +{detail.customerCount - 10} lainnya
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </ScrollArea>

                {/* Footer */}
                <div className="p-4 border-t-2 border-black text-center text-[9px] text-muted-foreground font-mono font-bold uppercase tracking-widest bg-zinc-50 dark:bg-zinc-800 shrink-0">
                    Harga dapat berubah sewaktu-waktu &middot; Syarat & Ketentuan Berlaku
                </div>
            </SheetContent>
        </Sheet>
    )
}
