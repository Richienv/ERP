"use client"

import { useState, useCallback } from "react"
import { useOpeningStock, useSubmitOpeningStock } from "@/hooks/use-opening-stock"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import { ComboboxWithCreate } from "@/components/ui/combobox-with-create"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatCurrency } from "@/lib/inventory-utils"
import { toast } from "sonner"
import {
    IconPackage,
    IconPlus,
    IconTrash,
    IconDeviceFloppy,
    IconClipboardList,
} from "@tabler/icons-react"

interface LineItem {
    id: string
    productId: string
    warehouseId: string
    quantity: string
    unitCost: string
}

function createEmptyLine(): LineItem {
    return {
        id: crypto.randomUUID(),
        productId: "",
        warehouseId: "",
        quantity: "",
        unitCost: "",
    }
}

export default function OpeningStockPage() {
    const { data, isLoading } = useOpeningStock()
    const submitMutation = useSubmitOpeningStock()

    const [lines, setLines] = useState<LineItem[]>([createEmptyLine()])

    const addLine = useCallback(() => {
        setLines(prev => [...prev, createEmptyLine()])
    }, [])

    const removeLine = useCallback((id: string) => {
        setLines(prev => prev.length > 1 ? prev.filter(l => l.id !== id) : prev)
    }, [])

    const updateLine = useCallback((id: string, field: keyof LineItem, value: string) => {
        setLines(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l))
    }, [])

    const handleSubmit = async () => {
        const items = lines
            .filter(l => l.productId && l.warehouseId && l.quantity)
            .map(l => ({
                productId: l.productId,
                warehouseId: l.warehouseId,
                quantity: parseInt(l.quantity, 10),
                unitCost: parseFloat(l.unitCost) || 0,
            }))

        if (items.length === 0) {
            toast.error("Minimal 1 baris harus diisi lengkap")
            return
        }

        // Check for duplicates (same product + warehouse)
        const keys = items.map(i => `${i.productId}-${i.warehouseId}`)
        const uniqueKeys = new Set(keys)
        if (uniqueKeys.size !== keys.length) {
            toast.error("Ada duplikat produk + gudang. Gabungkan ke satu baris.")
            return
        }

        try {
            const result = await submitMutation.mutateAsync(items)
            toast.success(result.message)
            if (!result.hasJournal) {
                toast.warning("Jurnal GL tidak dibuat — akun Persediaan atau Ekuitas Saldo Awal belum ditemukan di Chart of Accounts.")
            }
            setLines([createEmptyLine()])
        } catch (err: any) {
            toast.error(err.message || "Gagal menyimpan saldo awal")
        }
    }

    if (isLoading || !data) return <TablePageSkeleton accentColor="bg-emerald-400" />

    const { products, warehouses, existingTransactions } = data

    const productOptions = products.map(p => ({
        value: p.id,
        label: `${p.code} — ${p.name}`,
    }))

    const warehouseOptions = warehouses.map(w => ({
        value: w.id,
        label: `${w.code} — ${w.name}`,
    }))

    // Calculate total value of current lines
    const totalValue = lines.reduce((sum, l) => {
        const qty = parseInt(l.quantity, 10) || 0
        const cost = parseFloat(l.unitCost) || 0
        return sum + qty * cost
    }, 0)

    return (
        <div className="mf-page">
            {/* Page Header */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900">
                <div className="px-6 py-4 flex items-center justify-between border-l-[6px] border-l-emerald-400">
                    <div className="flex items-center gap-3">
                        <IconPackage className="h-6 w-6" />
                        <div>
                            <h1 className="text-lg font-bold">Saldo Awal Stok</h1>
                            <p className="text-sm text-zinc-500">
                                Input kuantitas awal persediaan per produk dan gudang
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={addLine}
                            className="border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none transition-shadow"
                        >
                            <IconPlus className="h-4 w-4 mr-1" />
                            Tambah Baris
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleSubmit}
                            disabled={submitMutation.isPending}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none transition-shadow"
                        >
                            <IconDeviceFloppy className="h-4 w-4 mr-1" />
                            {submitMutation.isPending ? "Menyimpan..." : "Simpan Semua"}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Bulk Entry Form */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900">
                <div className="px-6 py-3 bg-zinc-50 dark:bg-zinc-800 border-b-2 border-black flex items-center justify-between">
                    <span className="text-sm font-bold uppercase tracking-wide">
                        Entri Saldo Awal
                    </span>
                    <span className="text-sm font-mono font-bold text-emerald-600">
                        Total: {formatCurrency(totalValue)}
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b-2 border-black bg-zinc-50 dark:bg-zinc-800">
                                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide w-8">#</th>
                                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide">Produk</th>
                                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide">Gudang</th>
                                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide w-32">Kuantitas</th>
                                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide w-44">Harga Satuan (Rp)</th>
                                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide w-44">Total Nilai</th>
                                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wide w-16"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {lines.map((line, idx) => {
                                const qty = parseInt(line.quantity, 10) || 0
                                const cost = parseFloat(line.unitCost) || 0
                                const lineTotal = qty * cost

                                return (
                                    <tr key={line.id} className="border-b border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                                        <td className="px-4 py-2 text-sm text-zinc-500 font-mono">{idx + 1}</td>
                                        <td className="px-4 py-2">
                                            <ComboboxWithCreate
                                                options={productOptions}
                                                value={line.productId}
                                                onChange={(v) => {
                                                    updateLine(line.id, "productId", v)
                                                    // Auto-fill unit cost from product's costPrice
                                                    const product = products.find(p => p.id === v)
                                                    if (product && !line.unitCost) {
                                                        updateLine(line.id, "unitCost", String(product.costPrice))
                                                    }
                                                }}
                                                placeholder="Pilih produk..."
                                                searchPlaceholder="Cari produk..."
                                                emptyMessage="Produk tidak ditemukan"
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <ComboboxWithCreate
                                                options={warehouseOptions}
                                                value={line.warehouseId}
                                                onChange={(v) => updateLine(line.id, "warehouseId", v)}
                                                placeholder="Pilih gudang..."
                                                searchPlaceholder="Cari gudang..."
                                                emptyMessage="Gudang tidak ditemukan"
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <Input
                                                type="number"
                                                min={1}
                                                value={line.quantity}
                                                onChange={(e) => updateLine(line.id, "quantity", e.target.value)}
                                                placeholder="0"
                                                className="w-full border-2 border-black placeholder:text-zinc-300"
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <Input
                                                type="number"
                                                min={0}
                                                step="0.01"
                                                value={line.unitCost}
                                                onChange={(e) => updateLine(line.id, "unitCost", e.target.value)}
                                                placeholder="0"
                                                className="w-full border-2 border-black placeholder:text-zinc-300"
                                            />
                                        </td>
                                        <td className="px-4 py-2 text-right text-sm font-mono font-medium">
                                            {formatCurrency(lineTotal)}
                                        </td>
                                        <td className="px-4 py-2 text-center">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => removeLine(line.id)}
                                                disabled={lines.length <= 1}
                                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                            >
                                                <IconTrash className="h-4 w-4" />
                                            </Button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                        <tfoot>
                            <tr className="border-t-2 border-black bg-zinc-50 dark:bg-zinc-800">
                                <td colSpan={5} className="px-4 py-3 text-right text-sm font-bold uppercase tracking-wide">
                                    Grand Total
                                </td>
                                <td className="px-4 py-3 text-right text-sm font-mono font-bold text-emerald-600">
                                    {formatCurrency(totalValue)}
                                </td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <div className="px-6 py-3 border-t border-zinc-200 dark:border-zinc-700 flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={addLine}
                        className="border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none transition-shadow"
                    >
                        <IconPlus className="h-4 w-4 mr-1" />
                        Tambah Baris
                    </Button>
                    <span className="text-xs text-zinc-400 ml-2">
                        {lines.length} baris | Jurnal GL otomatis: DR Persediaan, CR Ekuitas Saldo Awal
                    </span>
                </div>
            </div>

            {/* Existing Transactions */}
            {existingTransactions.length > 0 && (
                <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900">
                    <div className="px-6 py-3 bg-zinc-50 dark:bg-zinc-800 border-b-2 border-black flex items-center gap-2">
                        <IconClipboardList className="h-4 w-4" />
                        <span className="text-sm font-bold uppercase tracking-wide">
                            Riwayat Saldo Awal ({existingTransactions.length} transaksi)
                        </span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800">
                                    <th className="px-4 py-2 text-left text-xs font-bold uppercase">Tanggal</th>
                                    <th className="px-4 py-2 text-left text-xs font-bold uppercase">Produk</th>
                                    <th className="px-4 py-2 text-left text-xs font-bold uppercase">Gudang</th>
                                    <th className="px-4 py-2 text-right text-xs font-bold uppercase">Kuantitas</th>
                                    <th className="px-4 py-2 text-right text-xs font-bold uppercase">Harga Satuan</th>
                                    <th className="px-4 py-2 text-right text-xs font-bold uppercase">Total Nilai</th>
                                </tr>
                            </thead>
                            <tbody>
                                {existingTransactions.map((tx) => (
                                    <tr key={tx.id} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                                        <td className="px-4 py-2 text-sm text-zinc-500">
                                            {new Date(tx.createdAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                                        </td>
                                        <td className="px-4 py-2 text-sm">
                                            <span className="font-mono text-xs text-zinc-400">{tx.product.code}</span>{" "}
                                            <span className="font-medium">{tx.product.name}</span>
                                        </td>
                                        <td className="px-4 py-2 text-sm">{tx.warehouse.name}</td>
                                        <td className="px-4 py-2 text-sm text-right font-mono">
                                            {tx.quantity.toLocaleString("id-ID")} {tx.product.unit}
                                        </td>
                                        <td className="px-4 py-2 text-sm text-right font-mono">
                                            {formatCurrency(tx.unitCost)}
                                        </td>
                                        <td className="px-4 py-2 text-sm text-right font-mono font-medium">
                                            {formatCurrency(tx.totalValue)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}
