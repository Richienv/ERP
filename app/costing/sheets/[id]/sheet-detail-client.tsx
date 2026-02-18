"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import Link from "next/link"
import {
    ArrowLeft,
    Plus,
    Trash2,
    Pencil,
    Download,
    Lock,
    CheckCircle2,
    Undo2,
    Copy,
    Package,
} from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { NB } from "@/lib/dialog-styles"
import { toast } from "sonner"
import {
    COST_CATEGORY_LABELS,
    COST_CATEGORY_COLORS,
    costSheetStatusLabels,
    costSheetStatusColors,
} from "@/lib/costing-calculations"
import type { CostCategoryType, CostSheetStatusType } from "@/lib/costing-calculations"
import { MarginAnalysis } from "@/components/costing/margin-analysis"
import { BreakdownChart } from "@/components/costing/breakdown-chart"
import {
    addCostSheetItem,
    updateCostSheetItem,
    deleteCostSheetItem,
    updateCostSheetStatus,
    duplicateCostSheet,
    getProductActiveBOM,
    importBOMToCostSheet,
} from "@/lib/actions/costing"
import type { CostSheetDetail, BOMItemForImport } from "@/lib/actions/costing"

const formatIDR = (n: number) =>
    new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n)

const CATEGORIES: CostCategoryType[] = ["FABRIC", "TRIM", "LABOR", "OVERHEAD", "SUBCONTRACT", "OTHER"]

interface Props {
    sheet: CostSheetDetail
}

export function SheetDetailClient({ sheet }: Props) {
    const router = useRouter()
    const queryClient = useQueryClient()
    const isDraft = sheet.status === "CS_DRAFT"
    const isFinalized = sheet.status === "CS_FINALIZED"

    // Dialogs
    const [addOpen, setAddOpen] = useState(false)
    const [editItem, setEditItem] = useState<CostSheetDetail["items"][0] | null>(null)
    const [bomOpen, setBomOpen] = useState(false)
    const [actualItem, setActualItem] = useState<CostSheetDetail["items"][0] | null>(null)

    // Loading
    const [loading, setLoading] = useState(false)

    // Add item form
    const [addForm, setAddForm] = useState({
        category: "FABRIC" as string,
        description: "",
        quantity: "",
        unitCost: "",
    })

    // Edit item form
    const [editForm, setEditForm] = useState({
        quantity: "",
        unitCost: "",
    })

    // Actual cost form
    const [actualForm, setActualForm] = useState({
        actualQuantity: "",
        actualUnitCost: "",
    })

    // BOM import
    const [bomItems, setBomItems] = useState<BOMItemForImport[]>([])
    const [bomSelected, setBomSelected] = useState<Set<number>>(new Set())
    const [bomLoading, setBomLoading] = useState(false)

    // Group items by category
    const groupedItems = useMemo(() => {
        const groups: Record<string, CostSheetDetail["items"]> = {}
        for (const item of sheet.items) {
            if (!groups[item.category]) groups[item.category] = []
            groups[item.category].push(item)
        }
        return groups
    }, [sheet.items])

    // ── Handlers ──

    const handleAddItem = async () => {
        if (!addForm.description.trim() || !addForm.quantity || !addForm.unitCost) {
            toast.error("Deskripsi, jumlah, dan biaya satuan wajib diisi")
            return
        }
        setLoading(true)
        const result = await addCostSheetItem({
            costSheetId: sheet.id,
            category: addForm.category,
            description: addForm.description,
            quantity: parseFloat(addForm.quantity),
            unitCost: parseFloat(addForm.unitCost),
        })
        setLoading(false)
        if (result.success) {
            toast.success("Item berhasil ditambahkan")
            setAddOpen(false)
            setAddForm({ category: "FABRIC", description: "", quantity: "", unitCost: "" })
            queryClient.invalidateQueries({ queryKey: queryKeys.costSheets.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.costingDashboard.all })
        } else {
            toast.error(result.error || "Gagal menambah item")
        }
    }

    const handleEditItem = async () => {
        if (!editItem || !editForm.quantity || !editForm.unitCost) return
        setLoading(true)
        const result = await updateCostSheetItem({
            itemId: editItem.id,
            quantity: parseFloat(editForm.quantity),
            unitCost: parseFloat(editForm.unitCost),
        })
        setLoading(false)
        if (result.success) {
            toast.success("Item berhasil diperbarui")
            setEditItem(null)
            queryClient.invalidateQueries({ queryKey: queryKeys.costSheets.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.costingDashboard.all })
        } else {
            toast.error(result.error || "Gagal memperbarui item")
        }
    }

    const handleDeleteItem = async (itemId: string) => {
        setLoading(true)
        const result = await deleteCostSheetItem(itemId)
        setLoading(false)
        if (result.success) {
            toast.success("Item berhasil dihapus")
            queryClient.invalidateQueries({ queryKey: queryKeys.costSheets.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.costingDashboard.all })
        } else {
            toast.error(result.error || "Gagal menghapus item")
        }
    }

    const handleUpdateActual = async () => {
        if (!actualItem || !actualForm.actualQuantity || !actualForm.actualUnitCost) return
        setLoading(true)
        const result = await updateCostSheetItem({
            itemId: actualItem.id,
            actualQuantity: parseFloat(actualForm.actualQuantity),
            actualUnitCost: parseFloat(actualForm.actualUnitCost),
        })
        setLoading(false)
        if (result.success) {
            toast.success("Biaya aktual berhasil diperbarui")
            setActualItem(null)
            queryClient.invalidateQueries({ queryKey: queryKeys.costSheets.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.costingDashboard.all })
        } else {
            toast.error(result.error || "Gagal memperbarui biaya aktual")
        }
    }

    const handleStatusChange = async (newStatus: string) => {
        setLoading(true)
        const result = await updateCostSheetStatus(sheet.id, newStatus as any)
        setLoading(false)
        if (result.success) {
            toast.success("Status berhasil diubah")
            queryClient.invalidateQueries({ queryKey: queryKeys.costSheets.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.costingDashboard.all })
        } else {
            toast.error(result.error || "Gagal mengubah status")
        }
    }

    const handleDuplicate = async () => {
        setLoading(true)
        const result = await duplicateCostSheet(sheet.id)
        setLoading(false)
        if (result.success && result.newId) {
            toast.success("Cost sheet berhasil diduplikasi")
            queryClient.invalidateQueries({ queryKey: queryKeys.costSheets.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.costingDashboard.all })
            router.push(`/costing/sheets/${result.newId}`)
        } else {
            toast.error(result.error || "Gagal menduplikasi")
        }
    }

    const handleOpenBOM = async () => {
        setBomLoading(true)
        setBomOpen(true)
        const result = await getProductActiveBOM(sheet.productId)
        setBomItems(result.items)
        setBomSelected(new Set(result.items.map((_, i) => i)))
        setBomLoading(false)
    }

    const handleImportBOM = async () => {
        const selectedItems = Array.from(bomSelected).map((i) => bomItems[i])
        if (selectedItems.length === 0) {
            toast.error("Pilih minimal 1 item")
            return
        }
        setLoading(true)
        const mapped = selectedItems.map((item) => ({
            category: item.category,
            description: `${item.materialCode} — ${item.materialName}`,
            quantity: item.quantity * (1 + item.wastePct / 100),
            unitCost: item.unitCost,
        }))
        const result = await importBOMToCostSheet(sheet.id, mapped)
        setLoading(false)
        if (result.success) {
            toast.success(`${result.itemsAdded} item berhasil diimpor dari BOM`)
            setBomOpen(false)
            queryClient.invalidateQueries({ queryKey: queryKeys.costSheets.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.costingDashboard.all })
        } else {
            toast.error(result.error || "Gagal mengimpor dari BOM")
        }
    }

    const toggleBomItem = (idx: number) => {
        setBomSelected((prev) => {
            const next = new Set(prev)
            if (next.has(idx)) next.delete(idx)
            else next.add(idx)
            return next
        })
    }

    return (
        <div className="space-y-6">
            {/* ── Header ── */}
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start gap-3">
                    <Link
                        href="/costing/sheets"
                        className="p-2 border-2 border-black hover:bg-zinc-100 transition-colors mt-1"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-xl font-black uppercase tracking-wider">
                                {sheet.number}
                            </h1>
                            <span className="text-[9px] font-black px-2 py-0.5 bg-zinc-100 border-2 border-black">
                                v{sheet.version}
                            </span>
                            <span className={`text-[9px] font-black px-2 py-0.5 border ${costSheetStatusColors[sheet.status as CostSheetStatusType]}`}>
                                {costSheetStatusLabels[sheet.status as CostSheetStatusType]}
                            </span>
                        </div>
                        <div className="text-xs font-bold text-zinc-500 mt-1">
                            [{sheet.productCode}] {sheet.productName}
                        </div>
                    </div>
                </div>

                {/* Action buttons based on status */}
                <div className="flex flex-wrap gap-2">
                    {isDraft && (
                        <>
                            <button
                                onClick={() => setAddOpen(true)}
                                className="flex items-center gap-1.5 px-3 py-2 border-2 border-black bg-black text-white font-black uppercase text-[10px] tracking-wider shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                Tambah Item
                            </button>
                            <button
                                onClick={handleOpenBOM}
                                className="flex items-center gap-1.5 px-3 py-2 border-2 border-black bg-white text-black font-black uppercase text-[10px] tracking-wider shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                            >
                                <Download className="h-3.5 w-3.5" />
                                Tarik dari BOM
                            </button>
                            <button
                                onClick={() => handleStatusChange("CS_FINALIZED")}
                                disabled={loading || sheet.items.length === 0}
                                className="flex items-center gap-1.5 px-3 py-2 border-2 border-blue-600 bg-blue-600 text-white font-black uppercase text-[10px] tracking-wider shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50"
                            >
                                <Lock className="h-3.5 w-3.5" />
                                Finalisasi
                            </button>
                        </>
                    )}
                    {isFinalized && (
                        <>
                            <button
                                onClick={() => handleStatusChange("CS_APPROVED")}
                                disabled={loading}
                                className="flex items-center gap-1.5 px-3 py-2 border-2 border-emerald-600 bg-emerald-600 text-white font-black uppercase text-[10px] tracking-wider shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                            >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Setujui
                            </button>
                            <button
                                onClick={() => handleStatusChange("CS_DRAFT")}
                                disabled={loading}
                                className="flex items-center gap-1.5 px-3 py-2 border-2 border-black bg-white text-black font-black uppercase text-[10px] tracking-wider shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                            >
                                <Undo2 className="h-3.5 w-3.5" />
                                Buka Kembali
                            </button>
                        </>
                    )}
                    <button
                        onClick={handleDuplicate}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-2 border-2 border-black bg-white text-black font-black uppercase text-[10px] tracking-wider shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                    >
                        <Copy className="h-3.5 w-3.5" />
                        Duplikasi
                    </button>
                </div>
            </div>

            {/* ── Margin Analysis + Breakdown side by side ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <MarginAnalysis
                    totalCost={sheet.totalCost}
                    targetPrice={sheet.targetPrice}
                    targetMargin={sheet.targetMargin}
                    items={sheet.items.map((i) => ({
                        category: i.category as CostCategoryType,
                        quantity: i.quantity,
                        unitCost: i.unitCost,
                        totalCost: i.totalCost,
                        actualQuantity: i.actualQuantity,
                        actualUnitCost: i.actualUnitCost,
                        actualTotalCost: i.actualTotalCost,
                    }))}
                />
                <BreakdownChart
                    items={sheet.items}
                    totalCost={sheet.totalCost}
                />
            </div>

            {/* ── Items Table ── */}
            <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <div className="px-4 py-2.5 border-b-2 border-black bg-zinc-50 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        Item Biaya
                    </span>
                    <span className="text-[10px] font-bold text-zinc-400 font-mono">
                        {sheet.items.length} item — Total: Rp {formatIDR(sheet.totalCost)}
                    </span>
                </div>

                {sheet.items.length === 0 ? (
                    <div className="p-8 text-center">
                        <Package className="h-8 w-8 mx-auto text-zinc-200 mb-2" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                            Belum ada item — tambah manual atau tarik dari BOM
                        </span>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        {CATEGORIES.map((cat) => {
                            const items = groupedItems[cat]
                            if (!items?.length) return null
                            const subtotal = items.reduce((s, i) => s + i.totalCost, 0)
                            const actualSubtotal = items.reduce((s, i) => s + (i.actualTotalCost ?? 0), 0)
                            return (
                                <div key={cat}>
                                    {/* Category header */}
                                    <div className="px-4 py-1.5 bg-zinc-100 border-b border-zinc-200 border-t border-t-zinc-300 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="w-2.5 h-2.5 border border-black"
                                                style={{ backgroundColor: COST_CATEGORY_COLORS[cat] }}
                                            />
                                            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
                                                {COST_CATEGORY_LABELS[cat]}
                                            </span>
                                        </div>
                                        <span className="text-[9px] font-bold font-mono text-zinc-500">
                                            Rp {formatIDR(subtotal)}
                                            {actualSubtotal > 0 && (
                                                <span className="ml-2 text-zinc-400">
                                                    (Aktual: Rp {formatIDR(actualSubtotal)})
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                    {/* Rows */}
                                    {items.map((item) => (
                                        <div
                                            key={item.id}
                                            className="px-4 py-2.5 border-b border-zinc-200 last:border-b-0 flex items-center gap-4"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs font-bold truncate">{item.description}</div>
                                            </div>
                                            <div className="text-right shrink-0 w-20">
                                                <div className="text-[9px] font-bold text-zinc-400 uppercase">Qty</div>
                                                <div className="text-xs font-mono">{item.quantity}</div>
                                            </div>
                                            <div className="text-right shrink-0 w-24">
                                                <div className="text-[9px] font-bold text-zinc-400 uppercase">Biaya/Unit</div>
                                                <div className="text-xs font-mono">Rp {formatIDR(item.unitCost)}</div>
                                            </div>
                                            <div className="text-right shrink-0 w-28">
                                                <div className="text-[9px] font-bold text-zinc-400 uppercase">Total</div>
                                                <div className="text-xs font-mono font-bold">Rp {formatIDR(item.totalCost)}</div>
                                            </div>
                                            {/* Actual columns */}
                                            <div className="text-right shrink-0 w-28 border-l border-zinc-200 pl-4">
                                                <div className="text-[9px] font-bold text-zinc-400 uppercase">Aktual</div>
                                                {item.actualTotalCost != null ? (
                                                    <div className={`text-xs font-mono font-bold ${item.actualTotalCost > item.totalCost ? "text-red-600" : "text-emerald-600"}`}>
                                                        Rp {formatIDR(item.actualTotalCost)}
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => {
                                                            setActualItem(item)
                                                            setActualForm({
                                                                actualQuantity: String(item.quantity),
                                                                actualUnitCost: String(item.unitCost),
                                                            })
                                                        }}
                                                        className="text-[9px] font-bold text-blue-600 hover:underline"
                                                    >
                                                        Input
                                                    </button>
                                                )}
                                            </div>
                                            {/* Actions */}
                                            {isDraft && (
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <button
                                                        onClick={() => {
                                                            setEditItem(item)
                                                            setEditForm({
                                                                quantity: String(item.quantity),
                                                                unitCost: String(item.unitCost),
                                                            })
                                                        }}
                                                        className="p-1.5 border border-zinc-300 hover:border-black hover:bg-zinc-100 transition-colors"
                                                        title="Edit"
                                                    >
                                                        <Pencil className="h-3 w-3" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteItem(item.id)}
                                                        className="p-1.5 border border-red-300 text-red-600 hover:border-red-600 hover:bg-red-50 transition-colors"
                                                        title="Hapus"
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* ── Add Item Dialog ── */}
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogContent className={NB.contentNarrow}>
                    <DialogHeader className={NB.header}>
                        <DialogTitle className={NB.title}>
                            <Plus className="h-5 w-5" />
                            Tambah Item Biaya
                        </DialogTitle>
                        <p className={NB.subtitle}>Tambahkan komponen biaya ke cost sheet</p>
                    </DialogHeader>
                    <ScrollArea className={NB.scroll}>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className={NB.label}>
                                    Kategori <span className={NB.labelRequired}>*</span>
                                </label>
                                <select
                                    className={NB.select}
                                    value={addForm.category}
                                    onChange={(e) => setAddForm((f) => ({ ...f, category: e.target.value }))}
                                >
                                    {CATEGORIES.map((c) => (
                                        <option key={c} value={c}>{COST_CATEGORY_LABELS[c]}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className={NB.label}>
                                    Deskripsi <span className={NB.labelRequired}>*</span>
                                </label>
                                <Input
                                    className={NB.input}
                                    value={addForm.description}
                                    onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
                                    placeholder="Contoh: Kain Cotton Combed 30s"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={NB.label}>
                                        Jumlah <span className={NB.labelRequired}>*</span>
                                    </label>
                                    <Input
                                        className={NB.inputMono}
                                        type="number"
                                        step="0.01"
                                        value={addForm.quantity}
                                        onChange={(e) => setAddForm((f) => ({ ...f, quantity: e.target.value }))}
                                        placeholder="2.5"
                                    />
                                </div>
                                <div>
                                    <label className={NB.label}>
                                        Biaya Satuan (Rp) <span className={NB.labelRequired}>*</span>
                                    </label>
                                    <Input
                                        className={NB.inputMono}
                                        type="number"
                                        value={addForm.unitCost}
                                        onChange={(e) => setAddForm((f) => ({ ...f, unitCost: e.target.value }))}
                                        placeholder="45000"
                                    />
                                </div>
                            </div>
                            {addForm.quantity && addForm.unitCost && (
                                <div className="bg-zinc-100 border-2 border-black p-3 text-center">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Total:</span>
                                    <span className="text-sm font-black font-mono ml-2">
                                        Rp {formatIDR(parseFloat(addForm.quantity) * parseFloat(addForm.unitCost))}
                                    </span>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                    <DialogFooter className="px-6 py-4 border-t-2 border-black bg-zinc-50">
                        <div className={NB.footer}>
                            <button onClick={() => setAddOpen(false)} className={NB.cancelBtn}>Batal</button>
                            <button onClick={handleAddItem} disabled={loading} className={NB.submitBtn}>
                                {loading ? "Menyimpan..." : "Tambah Item"}
                            </button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Edit Item Dialog ── */}
            <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
                <DialogContent className={NB.contentNarrow}>
                    <DialogHeader className={NB.header}>
                        <DialogTitle className={NB.title}>
                            <Pencil className="h-5 w-5" />
                            Edit Item
                        </DialogTitle>
                        <p className={NB.subtitle}>{editItem?.description}</p>
                    </DialogHeader>
                    <div className="p-6 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={NB.label}>Jumlah</label>
                                <Input
                                    className={NB.inputMono}
                                    type="number"
                                    step="0.01"
                                    value={editForm.quantity}
                                    onChange={(e) => setEditForm((f) => ({ ...f, quantity: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className={NB.label}>Biaya Satuan (Rp)</label>
                                <Input
                                    className={NB.inputMono}
                                    type="number"
                                    value={editForm.unitCost}
                                    onChange={(e) => setEditForm((f) => ({ ...f, unitCost: e.target.value }))}
                                />
                            </div>
                        </div>
                        {editForm.quantity && editForm.unitCost && (
                            <div className="bg-zinc-100 border-2 border-black p-3 text-center">
                                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Total:</span>
                                <span className="text-sm font-black font-mono ml-2">
                                    Rp {formatIDR(parseFloat(editForm.quantity) * parseFloat(editForm.unitCost))}
                                </span>
                            </div>
                        )}
                    </div>
                    <DialogFooter className="px-6 py-4 border-t-2 border-black bg-zinc-50">
                        <div className={NB.footer}>
                            <button onClick={() => setEditItem(null)} className={NB.cancelBtn}>Batal</button>
                            <button onClick={handleEditItem} disabled={loading} className={NB.submitBtn}>
                                {loading ? "Menyimpan..." : "Simpan"}
                            </button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Input Actual Dialog ── */}
            <Dialog open={!!actualItem} onOpenChange={(open) => !open && setActualItem(null)}>
                <DialogContent className={NB.contentNarrow}>
                    <DialogHeader className={NB.header}>
                        <DialogTitle className={NB.title}>
                            <CheckCircle2 className="h-5 w-5" />
                            Input Biaya Aktual
                        </DialogTitle>
                        <p className={NB.subtitle}>{actualItem?.description}</p>
                    </DialogHeader>
                    <div className="p-6 space-y-4">
                        <div className="bg-zinc-100 border-2 border-black p-3">
                            <div className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">Rencana</div>
                            <div className="text-xs font-mono">
                                {actualItem?.quantity} × Rp {formatIDR(actualItem?.unitCost ?? 0)} = Rp {formatIDR(actualItem?.totalCost ?? 0)}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={NB.label}>Jumlah Aktual</label>
                                <Input
                                    className={NB.inputMono}
                                    type="number"
                                    step="0.01"
                                    value={actualForm.actualQuantity}
                                    onChange={(e) => setActualForm((f) => ({ ...f, actualQuantity: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className={NB.label}>Biaya Aktual (Rp)</label>
                                <Input
                                    className={NB.inputMono}
                                    type="number"
                                    value={actualForm.actualUnitCost}
                                    onChange={(e) => setActualForm((f) => ({ ...f, actualUnitCost: e.target.value }))}
                                />
                            </div>
                        </div>
                        {actualForm.actualQuantity && actualForm.actualUnitCost && actualItem && (
                            <div className="border-2 border-black p-3 text-center">
                                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Total Aktual:</span>
                                <span className="text-sm font-black font-mono ml-2">
                                    Rp {formatIDR(parseFloat(actualForm.actualQuantity) * parseFloat(actualForm.actualUnitCost))}
                                </span>
                                {(() => {
                                    const actual = parseFloat(actualForm.actualQuantity) * parseFloat(actualForm.actualUnitCost)
                                    const diff = actual - actualItem.totalCost
                                    const pct = actualItem.totalCost > 0 ? Math.round((diff / actualItem.totalCost) * 100) : 0
                                    return (
                                        <div className={`text-[10px] font-bold mt-1 ${diff > 0 ? "text-red-600" : "text-emerald-600"}`}>
                                            {diff > 0 ? "+" : ""}{formatIDR(diff)} ({pct > 0 ? "+" : ""}{pct}%)
                                        </div>
                                    )
                                })()}
                            </div>
                        )}
                    </div>
                    <DialogFooter className="px-6 py-4 border-t-2 border-black bg-zinc-50">
                        <div className={NB.footer}>
                            <button onClick={() => setActualItem(null)} className={NB.cancelBtn}>Batal</button>
                            <button onClick={handleUpdateActual} disabled={loading} className={NB.submitBtn}>
                                {loading ? "Menyimpan..." : "Simpan Aktual"}
                            </button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── BOM Import Dialog ── */}
            <Dialog open={bomOpen} onOpenChange={setBomOpen}>
                <DialogContent className={NB.content}>
                    <DialogHeader className={NB.header}>
                        <DialogTitle className={NB.title}>
                            <Download className="h-5 w-5" />
                            Tarik dari BOM
                        </DialogTitle>
                        <p className={NB.subtitle}>
                            Impor material dari Bill of Materials produk
                        </p>
                    </DialogHeader>
                    <ScrollArea className={NB.scroll}>
                        <div className="p-6">
                            {bomLoading ? (
                                <div className="text-center py-8">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 animate-pulse">
                                        Memuat data BOM...
                                    </span>
                                </div>
                            ) : bomItems.length === 0 ? (
                                <div className="text-center py-8">
                                    <Package className="h-8 w-8 mx-auto text-zinc-200 mb-2" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                                        Tidak ada BOM aktif untuk produk ini
                                    </span>
                                </div>
                            ) : (
                                <div className="border-2 border-black overflow-hidden">
                                    <table className="w-full">
                                        <thead className="bg-zinc-100 border-b-2 border-black">
                                            <tr>
                                                <th className="px-3 py-2 w-8">
                                                    <input
                                                        type="checkbox"
                                                        checked={bomSelected.size === bomItems.length}
                                                        onChange={() => {
                                                            if (bomSelected.size === bomItems.length) setBomSelected(new Set())
                                                            else setBomSelected(new Set(bomItems.map((_, i) => i)))
                                                        }}
                                                        className="accent-black"
                                                    />
                                                </th>
                                                <th className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-left">Material</th>
                                                <th className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-center">Kategori</th>
                                                <th className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-right">Qty</th>
                                                <th className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-right">Biaya/Unit</th>
                                                <th className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-right">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {bomItems.map((item, idx) => (
                                                <tr key={idx} className="border-b border-zinc-200 last:border-b-0">
                                                    <td className="px-3 py-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={bomSelected.has(idx)}
                                                            onChange={() => toggleBomItem(idx)}
                                                            className="accent-black"
                                                        />
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <div className="text-xs font-bold">{item.materialName}</div>
                                                        <div className="text-[9px] text-zinc-400 font-mono">{item.materialCode}</div>
                                                    </td>
                                                    <td className="px-3 py-2 text-center">
                                                        <span
                                                            className="text-[8px] font-black px-1.5 py-0.5 border"
                                                            style={{
                                                                backgroundColor: `${COST_CATEGORY_COLORS[item.category as CostCategoryType]}20`,
                                                                borderColor: COST_CATEGORY_COLORS[item.category as CostCategoryType],
                                                            }}
                                                        >
                                                            {COST_CATEGORY_LABELS[item.category as CostCategoryType] || item.category}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2 text-xs font-mono text-right">
                                                        {item.quantity}
                                                        {item.wastePct > 0 && (
                                                            <span className="text-[8px] text-zinc-400 ml-1">(+{item.wastePct}%)</span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2 text-xs font-mono text-right">
                                                        Rp {formatIDR(item.unitCost)}
                                                    </td>
                                                    <td className="px-3 py-2 text-xs font-mono font-bold text-right">
                                                        Rp {formatIDR(item.lineCost)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                    {bomItems.length > 0 && (
                        <DialogFooter className="px-6 py-4 border-t-2 border-black bg-zinc-50">
                            <div className={NB.footer}>
                                <span className="text-[10px] font-bold text-zinc-500 mr-auto">
                                    {bomSelected.size} dari {bomItems.length} dipilih
                                </span>
                                <button onClick={() => setBomOpen(false)} className={NB.cancelBtn}>Batal</button>
                                <button onClick={handleImportBOM} disabled={loading || bomSelected.size === 0} className={NB.submitBtn}>
                                    {loading ? "Mengimpor..." : `Impor ${bomSelected.size} Item`}
                                </button>
                            </div>
                        </DialogFooter>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
