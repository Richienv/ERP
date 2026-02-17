"use client"

import { PriceListSummary, formatRupiah } from "./data"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import {
    Tag,
    Users,
    Package,
    MoreVertical,
    Eye,
    Edit,
    Trash2,
    ToggleLeft,
    ToggleRight,
} from "lucide-react"
import { updatePriceList, deletePriceList } from "@/lib/actions/sales"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface PriceBookGalleryProps {
    priceLists: PriceListSummary[]
    onOpenBook: (pl: PriceListSummary) => void
}

export function PriceBookGallery({ priceLists, onOpenBook }: PriceBookGalleryProps) {
    if (priceLists.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-black bg-white dark:bg-zinc-900">
                <div className="w-20 h-20 bg-zinc-100 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center mb-6">
                    <Tag className="h-10 w-10 text-zinc-400" />
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight mb-2">Belum Ada Daftar Harga</h3>
                <p className="text-sm font-medium text-muted-foreground max-w-sm uppercase tracking-wide">
                    Buat daftar harga pertama untuk mulai mengatur harga produk berdasarkan segmen pelanggan.
                </p>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-5">
            {priceLists.map((pl, index) => (
                <PriceListCard
                    key={pl.id}
                    priceList={pl}
                    colorIndex={index}
                    onOpen={() => onOpenBook(pl)}
                />
            ))}
        </div>
    )
}

const CARD_ACCENTS = [
    "bg-blue-500",
    "bg-emerald-500",
    "bg-amber-500",
    "bg-purple-500",
    "bg-rose-500",
    "bg-cyan-500",
    "bg-orange-500",
    "bg-indigo-500",
]

function PriceListCard({
    priceList,
    colorIndex,
    onOpen,
}: {
    priceList: PriceListSummary
    colorIndex: number
    onOpen: () => void
}) {
    const accent = CARD_ACCENTS[colorIndex % CARD_ACCENTS.length]
    const router = useRouter()

    async function handleToggleActive() {
        const res = await updatePriceList(priceList.id, { isActive: !priceList.isActive })
        if (res.success) {
            toast.success(priceList.isActive ? "Daftar harga dinonaktifkan" : "Daftar harga diaktifkan", {
                className: "font-bold border-2 border-black"
            })
            router.refresh()
        } else {
            toast.error(res.error)
        }
    }

    async function handleDelete() {
        if (!confirm(`Hapus daftar harga "${priceList.name}"? Tindakan ini tidak dapat dibatalkan.`)) return
        const res = await deletePriceList(priceList.id)
        if (res.success) {
            toast.success("Daftar harga dihapus", {
                className: "font-bold border-2 border-black"
            })
            router.refresh()
        } else {
            toast.error(res.error)
        }
    }

    const updatedDate = new Date(priceList.updatedAt).toLocaleDateString('id-ID', {
        day: 'numeric', month: 'short', year: 'numeric'
    })

    return (
        <div
            className="group relative overflow-hidden cursor-pointer bg-white dark:bg-zinc-900 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all active:scale-[0.98]"
            onClick={onOpen}
        >
            {/* Color accent header */}
            <div className={cn("h-3 w-full border-b-2 border-black", accent)} />

            <div className="p-5">
                {/* Header row */}
                <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-black text-base uppercase tracking-tight truncate">
                                {priceList.name}
                            </h3>
                            {!priceList.isActive && (
                                <span className="bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border border-black">
                                    Nonaktif
                                </span>
                            )}
                        </div>
                        <p className="text-[10px] text-muted-foreground font-mono font-bold uppercase tracking-widest">
                            {priceList.code}
                        </p>
                    </div>

                    {/* Actions dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 shrink-0 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all opacity-0 group-hover:opacity-100 bg-white"
                            >
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()} className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                            <DropdownMenuItem onClick={onOpen} className="font-bold text-xs uppercase">
                                <Eye className="mr-2 h-4 w-4" /> Lihat Detail
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => router.push(`/sales/pricelists/new?edit=${priceList.id}`)} className="font-bold text-xs uppercase">
                                <Edit className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-black" />
                            <DropdownMenuItem onClick={handleToggleActive} className="font-bold text-xs uppercase">
                                {priceList.isActive
                                    ? <><ToggleLeft className="mr-2 h-4 w-4" /> Nonaktifkan</>
                                    : <><ToggleRight className="mr-2 h-4 w-4" /> Aktifkan</>
                                }
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive focus:text-destructive font-bold text-xs uppercase" onClick={handleDelete}>
                                <Trash2 className="mr-2 h-4 w-4" /> Hapus
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {/* Description */}
                {priceList.description && (
                    <p className="text-xs font-medium text-muted-foreground line-clamp-2 mb-3">
                        {priceList.description}
                    </p>
                )}

                {/* Preview items */}
                {priceList.previewItems.length > 0 && (
                    <div className="border-2 border-black bg-zinc-50 dark:bg-zinc-800 p-3 mb-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        <div className="space-y-2">
                            {priceList.previewItems.map((item, i) => (
                                <div key={i} className="flex items-center justify-between text-xs">
                                    <span className="truncate flex-1 mr-2 font-bold uppercase">{item.productName}</span>
                                    <span className="font-mono font-black shrink-0 tracking-tight">{formatRupiah(item.price)}</span>
                                </div>
                            ))}
                            {priceList.itemCount > 3 && (
                                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide pt-1 border-t border-dashed border-zinc-300 dark:border-zinc-600">
                                    +{priceList.itemCount - 3} produk lainnya
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* Footer stats */}
                <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-3 border-t-2 border-black">
                    <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 font-bold uppercase">
                            <Package className="h-3 w-3" />
                            {priceList.itemCount}
                        </span>
                        <span className="flex items-center gap-1 font-bold uppercase">
                            <Users className="h-3 w-3" />
                            {priceList.customerCount}
                        </span>
                    </div>
                    <span className="font-mono font-bold">{updatedDate}</span>
                </div>
            </div>
        </div>
    )
}
