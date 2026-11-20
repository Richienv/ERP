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
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface PriceBookGalleryProps {
    priceLists: PriceListSummary[]
    onOpenBook: (pl: PriceListSummary) => void
}

export function PriceBookGallery({ priceLists, onOpenBook }: PriceBookGalleryProps) {
    if (priceLists.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-border bg-white dark:bg-zinc-900">
                <div className="w-20 h-20 bg-zinc-100 border border-border shadow-sm flex items-center justify-center mb-6">
                    <Tag className="h-10 w-10 text-zinc-400" />
                </div>
                <h3 className="text-xl font-semibold tracking-tight mb-2">Belum Ada Daftar Harga</h3>
                <p className="text-sm font-medium text-muted-foreground max-w-sm  ">
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
    "bg-blue-500",
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
    const queryClient = useQueryClient()

    async function handleToggleActive() {
        const res = await updatePriceList(priceList.id, { isActive: !priceList.isActive })
        if (res.success) {
            toast.success(priceList.isActive ? "Daftar harga dinonaktifkan" : "Daftar harga diaktifkan", {
                className: "font-bold border border-border"
            })
            queryClient.invalidateQueries({ queryKey: queryKeys.priceLists.all })
        } else {
            toast.error(res.error)
        }
    }

    async function handleDelete() {
        if (!confirm(`Hapus daftar harga "${priceList.name}"? Tindakan ini tidak dapat dibatalkan.`)) return
        const res = await deletePriceList(priceList.id)
        if (res.success) {
            toast.success("Daftar harga dihapus", {
                className: "font-bold border border-border"
            })
            queryClient.invalidateQueries({ queryKey: queryKeys.priceLists.all })
        } else {
            toast.error(res.error)
        }
    }

    const updatedDate = new Date(priceList.updatedAt).toLocaleDateString('id-ID', {
        day: 'numeric', month: 'short', year: 'numeric'
    })

    return (
        <div
            className="group relative overflow-hidden cursor-pointer bg-white dark:bg-zinc-900 border border-border shadow-sm hover:shadow-sm transition-all active:scale-[0.98]"
            onClick={onOpen}
        >
            {/* Color accent header */}
            <div className={cn("h-3 w-full border-b border-border", accent)} />

            <div className="p-5">
                {/* Header row */}
                <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-base tracking-tight truncate">
                                {priceList.name}
                            </h3>
                            {!priceList.isActive && (
                                <span className="bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300 px-2 py-0.5 text-xs font-semibold border border-border">
                                    Nonaktif
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground font-mono font-bold  ">
                            {priceList.code}
                        </p>
                    </div>

                    {/* Actions dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button aria-label="Aksi lainnya"
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 shrink-0 border border-border shadow-sm hover:shadow-sm transition-all opacity-0 group-hover:opacity-100 bg-white"
                            >
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()} className="border border-border shadow-sm">
                            <DropdownMenuItem onClick={onOpen} className="font-bold text-xs ">
                                <Eye className="mr-2 h-4 w-4" /> Lihat Detail
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => router.push(`/sales/pricelists/new?edit=${priceList.id}`)} className="font-bold text-xs ">
                                <Edit className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-slate-900" />
                            <DropdownMenuItem onClick={handleToggleActive} className="font-bold text-xs ">
                                {priceList.isActive
                                    ? <><ToggleLeft className="mr-2 h-4 w-4" /> Nonaktifkan</>
                                    : <><ToggleRight className="mr-2 h-4 w-4" /> Aktifkan</>
                                }
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive focus:text-destructive font-bold text-xs " onClick={handleDelete}>
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
                    <div className="border border-border bg-zinc-50 dark:bg-zinc-800 p-3 mb-3 shadow-sm">
                        <div className="space-y-2">
                            {priceList.previewItems.map((item, i) => (
                                <div key={i} className="flex items-center justify-between text-xs">
                                    <span className="truncate flex-1 mr-2 font-bold ">{item.productName}</span>
                                    <span className="font-mono font-semibold shrink-0 tracking-tight">{formatRupiah(item.price)}</span>
                                </div>
                            ))}
                            {priceList.itemCount > 3 && (
                                <p className="text-xs font-bold text-muted-foreground pt-1 border-t border-dashed border-zinc-300 dark:border-zinc-600">
                                    +{priceList.itemCount - 3} produk lainnya
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* Footer stats */}
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-border">
                    <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 font-bold ">
                            <Package className="h-3 w-3" />
                            {priceList.itemCount}
                        </span>
                        <span className="flex items-center gap-1 font-bold ">
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
