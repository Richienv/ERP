"use client"

import { useState, useEffect, useCallback } from "react"
import { AlertTriangle, Loader2, Package, Save } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
    NBDialog,
    NBDialogHeader,
    NBDialogBody,
    NBSection,
    NBInput,
} from "@/components/ui/nb-dialog"
import { Button } from "@/components/ui/button"
import { queryKeys } from "@/lib/query-keys"
import type { SidebarActionCounts } from "@/hooks/use-sidebar-actions"

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
    onAllActioned?: () => void
}

export function LowStockPopup({ open, onClose, onAllActioned }: LowStockPopupProps) {
    const [items, setItems] = useState<LowStockProduct[]>([])
    const [loading, setLoading] = useState(true)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editMinStock, setEditMinStock] = useState("")
    const [editReorderLevel, setEditReorderLevel] = useState("")
    const [saving, setSaving] = useState<string | null>(null)
    const queryClient = useQueryClient()

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
        if (open) {
            fetchData()
            setEditingId(null)
        }
    }, [open, fetchData])

    const startEdit = useCallback((product: LowStockProduct) => {
        setEditingId(product.id)
        setEditMinStock(String(product.minStock))
        setEditReorderLevel(String(product.reorderLevel))
    }, [])

    const handleSaveStock = useCallback(async (product: LowStockProduct) => {
        const newMinStock = parseInt(editMinStock)
        const newReorderLevel = parseInt(editReorderLevel)

        if (isNaN(newMinStock) || newMinStock < 0) {
            toast.error("Min stok harus angka positif")
            return
        }

        setSaving(product.id)
        try {
            const res = await fetch(`/api/products/${product.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    minStock: newMinStock,
                    reorderLevel: isNaN(newReorderLevel) ? undefined : newReorderLevel,
                }),
            })
            if (!res.ok) throw new Error("Gagal menyimpan")

            toast.success(`Min stok ${product.code} diperbarui`)

            // Update local state
            setItems(prev => prev.map(p =>
                p.id === product.id
                    ? { ...p, minStock: newMinStock, reorderLevel: isNaN(newReorderLevel) ? p.reorderLevel : newReorderLevel }
                    : p
            ))
            setEditingId(null)

            // Invalidate
            queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.sidebarActions.all })
        } catch (err: any) {
            toast.error(err.message || "Gagal menyimpan min stok")
        } finally {
            setSaving(null)
        }
    }, [editMinStock, editReorderLevel, queryClient])

    return (
        <NBDialog open={open} onOpenChange={(v) => !v && onClose()}>
            <NBDialogHeader icon={AlertTriangle} title="Produk Stok Rendah" subtitle={`${items.length} produk perlu perhatian`} />
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
                    items.map((product) => (
                        <NBSection key={product.id} icon={Package} title={`${product.code} - ${product.name}`}>
                            <div className="space-y-2.5">
                                {/* Status + Current Stock */}
                                <div className="flex items-center justify-between">
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
                                        Stok: <span className="font-bold text-zinc-900 dark:text-zinc-100">{product.currentStock}</span>
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

                                {/* Inline Edit */}
                                {editingId === product.id ? (
                                    <div className="border border-zinc-200 dark:border-zinc-700 p-2.5 space-y-2">
                                        <div className="flex gap-2">
                                            <NBInput
                                                label="Min Stok"
                                                type="number"
                                                value={editMinStock}
                                                onChange={setEditMinStock}
                                                placeholder="0"
                                                className="flex-1"
                                            />
                                            <NBInput
                                                label="Reorder Level"
                                                type="number"
                                                value={editReorderLevel}
                                                onChange={setEditReorderLevel}
                                                placeholder="0"
                                                className="flex-1"
                                            />
                                        </div>
                                        <div className="flex gap-1.5">
                                            <Button
                                                size="sm"
                                                disabled={saving === product.id}
                                                onClick={() => handleSaveStock(product)}
                                                className="flex-1 h-7 px-3 rounded-none bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-wider"
                                            >
                                                {saving === product.id ? (
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                    <Save className="h-3 w-3 mr-1" />
                                                )}
                                                Simpan
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => setEditingId(null)}
                                                className="h-7 px-3 rounded-none border-zinc-300 text-zinc-600 text-[10px] font-black uppercase tracking-wider"
                                            >
                                                Batal
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => startEdit(product)}
                                        className="w-full h-7 px-3 rounded-none border-zinc-300 text-zinc-700 text-[10px] font-black uppercase tracking-wider hover:bg-zinc-50"
                                    >
                                        Edit Min Stok & Reorder Level
                                    </Button>
                                )}
                            </div>
                        </NBSection>
                    ))
                )}
            </NBDialogBody>
        </NBDialog>
    )
}
