"use client"

import { useState, useEffect, useCallback } from "react"
import { Package, Users, Loader2, Save, AlertTriangle, ExternalLink } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
    NBDialog,
    NBDialogHeader,
    NBDialogBody,
    NBSection,
    NBCurrencyInput,
} from "@/components/ui/nb-dialog"
import { Button } from "@/components/ui/button"
import { queryKeys } from "@/lib/query-keys"
import type { SidebarActionCounts } from "@/hooks/use-sidebar-actions"
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
    onAllActioned?: () => void
}

export function ProductQuickEditPopup({ open, onClose, taskType, onAllActioned }: ProductQuickEditPopupProps) {
    const [items, setItems] = useState<IncompleteProduct[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState<string | null>(null)

    // Per-product edit state
    const [editData, setEditData] = useState<Map<string, { costPrice: string }>>(new Map())

    const queryClient = useQueryClient()

    const isProducts = taskType === "products-incomplete"
    const title = isProducts ? "Produk Data Belum Lengkap" : "Customer Data Belum Lengkap"
    const linkHref = isProducts ? "/inventory/products" : "/sales/customers"
    const Icon = isProducts ? Package : Users

    const fetchData = useCallback(async () => {
        if (!isProducts) {
            setLoading(false)
            setItems([])
            return
        }

        setLoading(true)
        try {
            const res = await fetch("/api/dashboard/incomplete-products")
            const json = await res.json()
            const products = json.products ?? []
            setItems(products)
            const initData = new Map<string, { costPrice: string }>()
            for (const p of products) {
                initData.set(p.id, { costPrice: "" })
            }
            setEditData(initData)
        } catch {
            setItems([])
        } finally {
            setLoading(false)
        }
    }, [isProducts])

    useEffect(() => {
        if (open) fetchData()
    }, [open, fetchData])

    const updatePrice = useCallback((productId: string, value: string) => {
        setEditData(prev => {
            const next = new Map(prev)
            next.set(productId, { costPrice: value })
            return next
        })
    }, [])

    const handleSave = useCallback(async (product: IncompleteProduct) => {
        const data = editData.get(product.id)
        if (!data) return

        const costPrice = Number(data.costPrice)
        if (!costPrice || costPrice <= 0) {
            toast.error("Masukkan harga pokok yang valid")
            return
        }

        setSaving(product.id)
        try {
            const res = await fetch(`/api/products/${product.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ costPrice }),
            })
            if (!res.ok) throw new Error("Gagal menyimpan")

            toast.success(`Harga pokok ${product.code} berhasil disimpan`)

            // Optimistic sidebar update
            queryClient.setQueryData<SidebarActionCounts | null>(
                queryKeys.sidebarActions.list(),
                (old) => old ? { ...old, productsIncomplete: Math.max(0, old.productsIncomplete - 1) } : old
            )

            // Remove from list
            const remaining = items.filter((i) => i.id !== product.id)
            setItems(remaining)

            queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.sidebarActions.all })

            if (remaining.length === 0) {
                onAllActioned?.()
                onClose()
            }
        } catch (err: any) {
            toast.error(err.message || "Gagal menyimpan harga produk")
        } finally {
            setSaving(null)
        }
    }, [items, editData, queryClient, onClose, onAllActioned])

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
                    items.map((product) => {
                        const data = editData.get(product.id) ?? { costPrice: "" }
                        const hasCostPriceMissing = product.missingFields.includes("costPrice")
                        const hasCategoryMissing = product.missingFields.includes("category")

                        return (
                            <NBSection key={product.id} icon={Package} title={`${product.code} - ${product.name}`}>
                                <div className="space-y-2.5">
                                    {/* Missing field tags */}
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

                                    {/* Inline cost price edit */}
                                    {hasCostPriceMissing && (
                                        <div className="space-y-2">
                                            <NBCurrencyInput
                                                label="Harga Pokok (HPP)"
                                                required
                                                value={data.costPrice}
                                                onChange={(v) => updatePrice(product.id, v)}
                                            />
                                            <Button
                                                size="sm"
                                                disabled={saving === product.id || !data.costPrice || Number(data.costPrice) <= 0}
                                                onClick={() => handleSave(product)}
                                                className="w-full h-7 px-3 rounded-none bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-wider"
                                            >
                                                {saving === product.id ? (
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                    <Save className="h-3 w-3 mr-1" />
                                                )}
                                                Simpan Harga
                                            </Button>
                                        </div>
                                    )}

                                    {/* Category missing — link to product page */}
                                    {hasCategoryMissing && !hasCostPriceMissing && (
                                        <Link href={`/inventory/products/${product.id}`} onClick={onClose}>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="w-full h-7 px-3 rounded-none border-zinc-300 text-zinc-700 text-[10px] font-black uppercase tracking-wider"
                                            >
                                                <ExternalLink className="h-3 w-3 mr-1" />
                                                Atur Kategori di Halaman Produk
                                            </Button>
                                        </Link>
                                    )}
                                </div>
                            </NBSection>
                        )
                    })
                )}
            </NBDialogBody>
        </NBDialog>
    )
}
