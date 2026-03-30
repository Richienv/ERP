"use client"

import { useState, useEffect, useCallback } from "react"
import { Package, Users, Loader2, ExternalLink, AlertTriangle } from "lucide-react"
import {
    NBDialog,
    NBDialogHeader,
    NBDialogBody,
    NBSection,
} from "@/components/ui/nb-dialog"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface IncompleteProduct {
    id: string
    name: string
    code: string
    missingFields: string[]
}

const FIELD_LABELS: Record<string, string> = {
    costPrice: "Harga Pokok",
    category: "Kategori",
}

interface ProductQuickEditPopupProps {
    open: boolean
    onClose: () => void
    taskType: "products-incomplete" | "customers-incomplete"
}

export function ProductQuickEditPopup({ open, onClose, taskType }: ProductQuickEditPopupProps) {
    const [items, setItems] = useState<IncompleteProduct[]>([])
    const [loading, setLoading] = useState(true)

    const isProducts = taskType === "products-incomplete"
    const title = isProducts ? "Produk Data Belum Lengkap" : "Customer Data Belum Lengkap"
    const linkHref = isProducts ? "/inventory/products" : "/sales/customers"
    const Icon = isProducts ? Package : Users

    const fetchData = useCallback(async () => {
        if (!isProducts) {
            // For customers-incomplete, we just show a link — no dedicated endpoint yet
            setLoading(false)
            setItems([])
            return
        }

        setLoading(true)
        try {
            const res = await fetch("/api/dashboard/incomplete-products")
            const json = await res.json()
            setItems(json.products ?? [])
        } catch {
            setItems([])
        } finally {
            setLoading(false)
        }
    }, [isProducts])

    useEffect(() => {
        if (open) fetchData()
    }, [open, fetchData])

    return (
        <NBDialog open={open} onOpenChange={(v) => !v && onClose()}>
            <NBDialogHeader
                icon={Icon}
                title={title}
                subtitle={isProducts ? `${items.length} produk perlu dilengkapi` : "Periksa data customer"}
            />
            <NBDialogBody>
                {loading ? (
                    <div className="flex items-center justify-center py-10">
                        <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                    </div>
                ) : !isProducts ? (
                    <div className="text-center py-8 space-y-3">
                        <p className="text-sm text-zinc-500">
                            Buka halaman Customer untuk melengkapi data.
                        </p>
                        <Link href={linkHref} onClick={onClose}>
                            <Button
                                size="sm"
                                className="h-8 px-4 rounded-none bg-black text-white text-[10px] font-black uppercase tracking-wider"
                            >
                                <ExternalLink className="h-3 w-3 mr-1.5" />
                                Buka Halaman Customer
                            </Button>
                        </Link>
                    </div>
                ) : items.length === 0 ? (
                    <p className="text-sm text-zinc-500 text-center py-10">
                        Semua produk sudah lengkap datanya.
                    </p>
                ) : (
                    <>
                        {items.map((product) => (
                            <NBSection key={product.id} icon={Package} title={`${product.code} - ${product.name}`}>
                                <div className="flex items-center justify-between gap-3">
                                    <div className="space-y-1 min-w-0 flex-1">
                                        <div className="flex flex-wrap gap-1">
                                            {product.missingFields.map((field) => (
                                                <span
                                                    key={field}
                                                    className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 border border-amber-300 bg-amber-50 text-amber-700"
                                                >
                                                    <AlertTriangle className="h-2.5 w-2.5" />
                                                    {FIELD_LABELS[field] || field}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <Link href={linkHref} onClick={onClose}>
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
