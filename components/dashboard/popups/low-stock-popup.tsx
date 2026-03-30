"use client"

import { useState, useEffect, useCallback } from "react"
import { AlertTriangle, Loader2, ExternalLink, Package } from "lucide-react"
import {
    NBDialog,
    NBDialogHeader,
    NBDialogBody,
    NBSection,
} from "@/components/ui/nb-dialog"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface LowStockProduct {
    id: string
    name: string
    code: string
    currentStock: number
    minStock: number
    reorderLevel: number
    status: "LOW_STOCK" | "CRITICAL"
}

interface LowStockPopupProps {
    open: boolean
    onClose: () => void
}

export function LowStockPopup({ open, onClose }: LowStockPopupProps) {
    const [items, setItems] = useState<LowStockProduct[]>([])
    const [loading, setLoading] = useState(true)

    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch("/api/dashboard/low-stock-products")
            const json = await res.json()
            setItems(json.products ?? [])
        } catch {
            setItems([])
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        if (open) fetchData()
    }, [open, fetchData])

    return (
        <NBDialog open={open} onOpenChange={(v) => !v && onClose()}>
            <NBDialogHeader icon={AlertTriangle} title="Produk Stok Rendah" subtitle={`${items.length} produk perlu restock`} />
            <NBDialogBody>
                {loading ? (
                    <div className="flex items-center justify-center py-10">
                        <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                    </div>
                ) : items.length === 0 ? (
                    <p className="text-sm text-zinc-500 text-center py-10">
                        Tidak ada produk dengan stok rendah.
                    </p>
                ) : (
                    <>
                        {items.map((product) => (
                            <NBSection key={product.id} icon={Package} title={`${product.code} - ${product.name}`}>
                                <div className="flex items-center justify-between gap-3">
                                    <div className="space-y-1 min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 border ${
                                                product.status === "CRITICAL"
                                                    ? "border-red-300 bg-red-50 text-red-700"
                                                    : "border-amber-300 bg-amber-50 text-amber-700"
                                            }`}>
                                                {product.status === "CRITICAL" ? "KRITIS" : "RENDAH"}
                                            </span>
                                        </div>
                                        <p className="text-xs text-zinc-500">
                                            Stok: <span className="font-bold text-zinc-900">{product.currentStock}</span>
                                            {" / "}
                                            Min: <span className="font-bold">{product.minStock}</span>
                                            {product.reorderLevel > 0 && (
                                                <>
                                                    {" / "}
                                                    Reorder: <span className="font-bold">{product.reorderLevel}</span>
                                                </>
                                            )}
                                        </p>
                                    </div>
                                    <Link href="/inventory/alerts" onClick={onClose}>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 px-3 rounded-none border-zinc-300 text-zinc-700 text-[10px] font-black uppercase tracking-wider"
                                        >
                                            <ExternalLink className="h-3 w-3 mr-1" />
                                            Lihat Detail
                                        </Button>
                                    </Link>
                                </div>
                            </NBSection>
                        ))}
                    </>
                )}
            </NBDialogBody>
        </NBDialog>
    )
}
