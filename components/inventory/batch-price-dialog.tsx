"use client"

import { useState, useMemo, useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { formatIDR } from "@/lib/utils"
import { toast } from "sonner"
import {
    NBDialog,
    NBDialogHeader,
    NBDialogBody,
    NBSection,
} from "@/components/ui/nb-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    DollarSign,
    Percent,
    ArrowUp,
    ArrowDown,
    Search,
    Check,
    ArrowRight,
    Table2,
} from "lucide-react"

interface Product {
    id: string
    code: string
    name: string
    costPrice: number | string
    sellingPrice: number | string
    category?: { name: string } | null
    unit?: string | { name: string } | null
}

interface BatchPriceDialogProps {
    products: Product[]
    open: boolean
    onOpenChange: (open: boolean) => void
}

interface PriceEdit {
    newCostPrice: number | null
    newSellingPrice: number | null
}

type BulkMode = "percent" | "fixed"
type BulkTarget = "costPrice" | "sellingPrice" | "both"
type BulkDirection = "increase" | "decrease"

export function BatchPriceDialog({ products, open, onOpenChange }: BatchPriceDialogProps) {
    const queryClient = useQueryClient()
    const [search, setSearch] = useState("")
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [edits, setEdits] = useState<Record<string, PriceEdit>>({})
    const [submitting, setSubmitting] = useState(false)
    const [step, setStep] = useState<"edit" | "preview">("edit")

    // Bulk action state
    const [bulkMode, setBulkMode] = useState<BulkMode>("percent")
    const [bulkTarget, setBulkTarget] = useState<BulkTarget>("both")
    const [bulkDirection, setBulkDirection] = useState<BulkDirection>("increase")
    const [bulkValue, setBulkValue] = useState("")

    const filtered = useMemo(() => {
        if (!search.trim()) return products
        const q = search.toLowerCase()
        return products.filter(
            (p) =>
                p.name.toLowerCase().includes(q) ||
                p.code.toLowerCase().includes(q) ||
                (p.category?.name ?? "").toLowerCase().includes(q)
        )
    }, [products, search])

    const toggleSelect = useCallback((id: string) => {
        setSelected((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }, [])

    const toggleAll = useCallback(() => {
        setSelected((prev) => {
            if (prev.size === filtered.length) return new Set()
            return new Set(filtered.map((p) => p.id))
        })
    }, [filtered])

    const getNum = (v: number | string) => Number(v) || 0

    const setProductPrice = useCallback(
        (productId: string, field: "newCostPrice" | "newSellingPrice", value: string) => {
            const numVal = value === "" ? null : parseFloat(value)
            setEdits((prev) => ({
                ...prev,
                [productId]: {
                    newCostPrice: prev[productId]?.newCostPrice ?? null,
                    newSellingPrice: prev[productId]?.newSellingPrice ?? null,
                    [field]: isNaN(numVal as number) ? null : numVal,
                },
            }))
        },
        []
    )

    const applyBulk = useCallback(() => {
        const val = parseFloat(bulkValue)
        if (isNaN(val) || val <= 0) {
            toast.error("Masukkan nilai yang valid")
            return
        }
        if (selected.size === 0) {
            toast.error("Pilih minimal 1 produk")
            return
        }

        setEdits((prev) => {
            const next = { ...prev }
            for (const id of selected) {
                const product = products.find((p) => p.id === id)
                if (!product) continue

                const oldCost = getNum(product.costPrice)
                const oldSell = getNum(product.sellingPrice)
                const existing = next[id] ?? { newCostPrice: null, newSellingPrice: null }

                if (bulkTarget === "costPrice" || bulkTarget === "both") {
                    let newPrice: number
                    if (bulkMode === "percent") {
                        const delta = oldCost * (val / 100)
                        newPrice = bulkDirection === "increase" ? oldCost + delta : oldCost - delta
                    } else {
                        newPrice = bulkDirection === "increase" ? oldCost + val : oldCost - val
                    }
                    existing.newCostPrice = Math.max(0, Math.round(newPrice))
                }
                if (bulkTarget === "sellingPrice" || bulkTarget === "both") {
                    let newPrice: number
                    if (bulkMode === "percent") {
                        const delta = oldSell * (val / 100)
                        newPrice = bulkDirection === "increase" ? oldSell + delta : oldSell - delta
                    } else {
                        newPrice = bulkDirection === "increase" ? oldSell + val : oldSell - val
                    }
                    existing.newSellingPrice = Math.max(0, Math.round(newPrice))
                }

                next[id] = existing
            }
            return next
        })

        toast.success(`Harga diterapkan ke ${selected.size} produk`)
    }, [bulkValue, bulkMode, bulkTarget, bulkDirection, selected, products])

    // Get only products that have actual changes
    const changedProducts = useMemo(() => {
        return products.filter((p) => {
            const edit = edits[p.id]
            if (!edit) return false
            const costChanged = edit.newCostPrice !== null && edit.newCostPrice !== getNum(p.costPrice)
            const sellChanged = edit.newSellingPrice !== null && edit.newSellingPrice !== getNum(p.sellingPrice)
            return costChanged || sellChanged
        })
    }, [products, edits])

    const handlePreview = () => {
        if (changedProducts.length === 0) {
            toast.error("Belum ada perubahan harga")
            return
        }
        setStep("preview")
    }

    const handleSubmit = async () => {
        if (changedProducts.length === 0) return
        setSubmitting(true)

        try {
            const updates = changedProducts.map((p) => {
                const edit = edits[p.id]!
                return {
                    productId: p.id,
                    newCostPrice: edit.newCostPrice !== null && edit.newCostPrice !== getNum(p.costPrice)
                        ? edit.newCostPrice
                        : undefined,
                    newSellingPrice: edit.newSellingPrice !== null && edit.newSellingPrice !== getNum(p.sellingPrice)
                        ? edit.newSellingPrice
                        : undefined,
                }
            })

            const res = await fetch("/api/products/batch-price", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ updates }),
            })

            const json = await res.json()
            if (!res.ok || !json.success) {
                toast.error(json.error || "Gagal update harga")
                return
            }

            toast.success(`${json.updated} produk berhasil diupdate`)

            // Invalidate all product-related queries
            queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.inventoryDashboard.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.priceLists.all })

            // Reset and close
            resetState()
            onOpenChange(false)
        } catch (err) {
            toast.error("Terjadi kesalahan saat update harga")
            console.error(err)
        } finally {
            setSubmitting(false)
        }
    }

    const resetState = () => {
        setSearch("")
        setSelected(new Set())
        setEdits({})
        setBulkValue("")
        setStep("edit")
    }

    const handleOpenChange = (v: boolean) => {
        if (!v) resetState()
        onOpenChange(v)
    }

    const LABEL = "text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1 block"
    const BTN_CANCEL = "border border-zinc-300 dark:border-zinc-600 text-zinc-500 font-bold uppercase text-[10px] tracking-wider px-4 h-8 rounded-none disabled:opacity-50"
    const BTN_SUBMIT = "bg-black text-white border border-black hover:bg-zinc-800 font-black uppercase text-[10px] tracking-wider px-5 h-8 rounded-none gap-1.5 disabled:opacity-50 transition-colors"

    return (
        <NBDialog open={open} onOpenChange={handleOpenChange} size="wide">
            <NBDialogHeader
                icon={DollarSign}
                title="Update Harga Massal"
                subtitle={step === "edit"
                    ? "Pilih produk dan ubah harga beli/jual secara massal"
                    : `Preview perubahan — ${changedProducts.length} produk akan diupdate`}
            />

            {step === "edit" ? (
                <NBDialogBody>
                    {/* Bulk Action Panel */}
                    <NBSection icon={Percent} title="Ubah Massal">
                        <div className="flex flex-wrap items-end gap-3">
                            {/* Direction */}
                            <div>
                                <label className={LABEL}>Arah</label>
                                <div className="flex border border-black">
                                    <button
                                        type="button"
                                        onClick={() => setBulkDirection("increase")}
                                        className={`px-3 py-1.5 flex items-center gap-1 text-[10px] font-black uppercase tracking-widest border-r border-black ${
                                            bulkDirection === "increase"
                                                ? "bg-emerald-500 text-white"
                                                : "bg-white hover:bg-zinc-50"
                                        }`}
                                    >
                                        <ArrowUp className="h-3 w-3" />
                                        Naik
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setBulkDirection("decrease")}
                                        className={`px-3 py-1.5 flex items-center gap-1 text-[10px] font-black uppercase tracking-widest ${
                                            bulkDirection === "decrease"
                                                ? "bg-red-500 text-white"
                                                : "bg-white hover:bg-zinc-50"
                                        }`}
                                    >
                                        <ArrowDown className="h-3 w-3" />
                                        Turun
                                    </button>
                                </div>
                            </div>

                            {/* Mode */}
                            <div>
                                <label className={LABEL}>Mode</label>
                                <div className="flex border border-black">
                                    <button
                                        type="button"
                                        onClick={() => setBulkMode("percent")}
                                        className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest border-r border-black ${
                                            bulkMode === "percent"
                                                ? "bg-black text-white"
                                                : "bg-white hover:bg-zinc-50"
                                        }`}
                                    >
                                        Persen (%)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setBulkMode("fixed")}
                                        className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest ${
                                            bulkMode === "fixed"
                                                ? "bg-black text-white"
                                                : "bg-white hover:bg-zinc-50"
                                        }`}
                                    >
                                        Nominal (Rp)
                                    </button>
                                </div>
                            </div>

                            {/* Target */}
                            <div>
                                <label className={LABEL}>Target</label>
                                <div className="flex border border-black">
                                    <button
                                        type="button"
                                        onClick={() => setBulkTarget("both")}
                                        className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest border-r border-black ${
                                            bulkTarget === "both"
                                                ? "bg-black text-white"
                                                : "bg-white hover:bg-zinc-50"
                                        }`}
                                    >
                                        Keduanya
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setBulkTarget("costPrice")}
                                        className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest border-r border-black ${
                                            bulkTarget === "costPrice"
                                                ? "bg-black text-white"
                                                : "bg-white hover:bg-zinc-50"
                                        }`}
                                    >
                                        Harga Beli
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setBulkTarget("sellingPrice")}
                                        className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest ${
                                            bulkTarget === "sellingPrice"
                                                ? "bg-black text-white"
                                                : "bg-white hover:bg-zinc-50"
                                        }`}
                                    >
                                        Harga Jual
                                    </button>
                                </div>
                            </div>

                            {/* Value */}
                            <div className="flex-1 min-w-[120px]">
                                <label className={LABEL}>
                                    Nilai {bulkMode === "percent" ? "(%)" : "(Rp)"}
                                </label>
                                <Input
                                    type="number"
                                    value={bulkValue}
                                    onChange={(e) => setBulkValue(e.target.value)}
                                    placeholder={bulkMode === "percent" ? "10" : "5000"}
                                    className="border border-zinc-300 rounded-none h-8 text-sm"
                                    min={0}
                                />
                            </div>

                            {/* Apply */}
                            <Button
                                type="button"
                                onClick={applyBulk}
                                className={BTN_SUBMIT}
                            >
                                Terapkan
                            </Button>
                        </div>
                    </NBSection>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Cari produk..."
                            className="border border-zinc-300 rounded-none h-8 text-sm pl-9"
                        />
                    </div>

                    {/* Product Table */}
                    <NBSection icon={Table2} title="Daftar Produk">
                        <div className="-mx-3 -mb-3">
                            <div className="bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-200">
                                <div className="grid grid-cols-[40px_1fr_1fr_140px_140px] items-center">
                                    <div className="px-3 py-2 flex items-center justify-center">
                                        <Checkbox
                                            checked={filtered.length > 0 && selected.size === filtered.length}
                                            onCheckedChange={toggleAll}
                                        />
                                    </div>
                                    <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">Produk</div>
                                    <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">Kategori</div>
                                    <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Harga Beli</div>
                                    <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Harga Jual</div>
                                </div>
                            </div>
                            <ScrollArea className="max-h-[40vh]">
                                {filtered.length === 0 ? (
                                    <div className="p-8 text-center text-zinc-400 text-sm font-bold">
                                        Tidak ada produk ditemukan
                                    </div>
                                ) : (
                                    filtered.map((product) => {
                                        const edit = edits[product.id]
                                        const costChanged =
                                            edit?.newCostPrice !== null &&
                                            edit?.newCostPrice !== undefined &&
                                            edit?.newCostPrice !== getNum(product.costPrice)
                                        const sellChanged =
                                            edit?.newSellingPrice !== null &&
                                            edit?.newSellingPrice !== undefined &&
                                            edit?.newSellingPrice !== getNum(product.sellingPrice)

                                        return (
                                            <div
                                                key={product.id}
                                                className={`grid grid-cols-[40px_1fr_1fr_140px_140px] items-center border-b border-zinc-100 ${
                                                    selected.has(product.id) ? "bg-emerald-50 dark:bg-emerald-950/20" : ""
                                                }`}
                                            >
                                                <div className="px-3 py-2 flex items-center justify-center">
                                                    <Checkbox
                                                        checked={selected.has(product.id)}
                                                        onCheckedChange={() => toggleSelect(product.id)}
                                                    />
                                                </div>
                                                <div className="px-3 py-2">
                                                    <div className="font-bold text-sm">{product.name}</div>
                                                    <div className="text-[10px] text-zinc-400 font-mono">{product.code}</div>
                                                </div>
                                                <div className="px-3 py-2 text-zinc-500 text-xs">
                                                    {product.category?.name ?? "-"}
                                                </div>
                                                <div className="px-3 py-2">
                                                    <Input
                                                        type="number"
                                                        value={edit?.newCostPrice ?? ""}
                                                        onChange={(e) =>
                                                            setProductPrice(product.id, "newCostPrice", e.target.value)
                                                        }
                                                        placeholder={String(getNum(product.costPrice))}
                                                        className={`border border-zinc-300 rounded-none h-8 text-right text-xs ${
                                                            costChanged ? "border-amber-500 bg-amber-50" : ""
                                                        }`}
                                                    />
                                                </div>
                                                <div className="px-3 py-2">
                                                    <Input
                                                        type="number"
                                                        value={edit?.newSellingPrice ?? ""}
                                                        onChange={(e) =>
                                                            setProductPrice(product.id, "newSellingPrice", e.target.value)
                                                        }
                                                        placeholder={String(getNum(product.sellingPrice))}
                                                        className={`border border-zinc-300 rounded-none h-8 text-right text-xs ${
                                                            sellChanged ? "border-amber-500 bg-amber-50" : ""
                                                        }`}
                                                    />
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                            </ScrollArea>
                        </div>
                    </NBSection>

                    {/* Footer */}
                    <div className="border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-2.5 flex items-center justify-end gap-2 -mx-4 -mb-4 mt-1">
                        <span className="text-xs text-zinc-500 font-bold mr-auto">
                            {changedProducts.length} produk berubah
                        </span>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleOpenChange(false)}
                            className={BTN_CANCEL}
                        >
                            Batal
                        </Button>
                        <Button
                            type="button"
                            onClick={handlePreview}
                            className={BTN_SUBMIT}
                            disabled={changedProducts.length === 0}
                        >
                            Preview
                            <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                        </Button>
                    </div>
                </NBDialogBody>
            ) : (
                /* Preview Step */
                <NBDialogBody>
                    <NBSection icon={Table2} title="Preview Perubahan">
                        <div className="-mx-3 -mb-3">
                            <div className="bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-200">
                                <div className="grid grid-cols-[1fr_140px_140px_140px_140px] items-center">
                                    <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">Produk</div>
                                    <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Harga Beli Lama</div>
                                    <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Harga Beli Baru</div>
                                    <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Harga Jual Lama</div>
                                    <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Harga Jual Baru</div>
                                </div>
                            </div>
                            <ScrollArea className="max-h-[50vh]">
                                {changedProducts.map((product) => {
                                    const edit = edits[product.id]!
                                    const oldCost = getNum(product.costPrice)
                                    const newCost = edit.newCostPrice ?? oldCost
                                    const oldSell = getNum(product.sellingPrice)
                                    const newSell = edit.newSellingPrice ?? oldSell
                                    const costDiff = newCost - oldCost
                                    const sellDiff = newSell - oldSell

                                    return (
                                        <div
                                            key={product.id}
                                            className="grid grid-cols-[1fr_140px_140px_140px_140px] items-center border-b border-zinc-100"
                                        >
                                            <div className="px-3 py-2">
                                                <div className="font-bold text-sm">{product.name}</div>
                                                <div className="text-[10px] text-zinc-400 font-mono">{product.code}</div>
                                            </div>
                                            <div className="px-3 py-2 text-right text-xs text-zinc-500">
                                                {formatIDR(oldCost)}
                                            </div>
                                            <div className="px-3 py-2 text-right text-xs font-bold">
                                                <div>{formatIDR(newCost)}</div>
                                                {costDiff !== 0 && (
                                                    <div
                                                        className={`text-[10px] ${
                                                            costDiff > 0 ? "text-emerald-600" : "text-red-600"
                                                        }`}
                                                    >
                                                        {costDiff > 0 ? "+" : ""}
                                                        {formatIDR(costDiff)}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="px-3 py-2 text-right text-xs text-zinc-500">
                                                {formatIDR(oldSell)}
                                            </div>
                                            <div className="px-3 py-2 text-right text-xs font-bold">
                                                <div>{formatIDR(newSell)}</div>
                                                {sellDiff !== 0 && (
                                                    <div
                                                        className={`text-[10px] ${
                                                            sellDiff > 0 ? "text-emerald-600" : "text-red-600"
                                                        }`}
                                                    >
                                                        {sellDiff > 0 ? "+" : ""}
                                                        {formatIDR(sellDiff)}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </ScrollArea>
                        </div>
                    </NBSection>

                    {/* Footer */}
                    <div className="border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-2.5 flex items-center justify-end gap-2 -mx-4 -mb-4 mt-1">
                        <span className="text-xs text-zinc-500 font-bold mr-auto">
                            {changedProducts.length} produk akan diupdate
                        </span>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setStep("edit")}
                            className={BTN_CANCEL}
                            disabled={submitting}
                        >
                            Kembali
                        </Button>
                        <Button
                            type="button"
                            onClick={handleSubmit}
                            className={BTN_SUBMIT}
                            disabled={submitting}
                        >
                            {submitting ? (
                                "Menyimpan..."
                            ) : (
                                <>
                                    <Check className="h-3.5 w-3.5 mr-1.5" />
                                    Konfirmasi Update
                                </>
                            )}
                        </Button>
                    </div>
                </NBDialogBody>
            )}
        </NBDialog>
    )
}
