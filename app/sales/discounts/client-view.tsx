"use client"

import { useState, useMemo } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
    Plus,
    Search,
    Percent,
    MoreHorizontal,
    Pencil,
    Trash2,
    RefreshCcw,
    Tag,
    Layers,
    DollarSign,
    BarChart3,
} from "lucide-react"
import { DiscountSchemeRow, DiscountSummary, useDeleteDiscount } from "@/hooks/use-discounts"
import { formatIDR } from "@/lib/utils"
import { DiscountFormDialog } from "./discount-form-dialog"

// ─── Type / Scope labels ─────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
    PERCENTAGE: "Persentase",
    FIXED: "Potongan Tetap",
    TIERED: "Bertingkat",
}

const TYPE_COLORS: Record<string, string> = {
    PERCENTAGE: "bg-blue-100 text-blue-800 border-blue-300",
    FIXED: "bg-amber-100 text-amber-800 border-amber-300",
    TIERED: "bg-purple-100 text-purple-800 border-purple-300",
}

const SCOPE_LABELS: Record<string, string> = {
    GLOBAL: "Semua Produk",
    PRICELIST: "Daftar Harga",
    CUSTOMER: "Pelanggan",
    PRODUCT: "Produk",
    CATEGORY: "Kategori",
}

// ─── Component ───────────────────────────────────────────────────────────

interface DiscountsClientProps {
    schemes: DiscountSchemeRow[]
    summary: DiscountSummary
}

export function DiscountsClient({ schemes, summary }: DiscountsClientProps) {
    const [search, setSearch] = useState("")
    const [typeFilter, setTypeFilter] = useState<string>("all")
    const [scopeFilter, setScopeFilter] = useState<string>("all")
    const [formOpen, setFormOpen] = useState(false)
    const [editing, setEditing] = useState<DiscountSchemeRow | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<DiscountSchemeRow | null>(null)
    const [refreshing, setRefreshing] = useState(false)
    const queryClient = useQueryClient()
    const deleteMutation = useDeleteDiscount()

    const filtered = useMemo(() => {
        return schemes.filter((s) => {
            const matchSearch =
                search === "" ||
                s.name.toLowerCase().includes(search.toLowerCase()) ||
                s.code.toLowerCase().includes(search.toLowerCase())
            const matchType = typeFilter === "all" || s.type === typeFilter
            const matchScope = scopeFilter === "all" || s.scope === scopeFilter
            return matchSearch && matchType && matchScope
        })
    }, [schemes, search, typeFilter, scopeFilter])

    const handleRefresh = () => {
        setRefreshing(true)
        queryClient.invalidateQueries({ queryKey: queryKeys.discounts.all })
        setTimeout(() => setRefreshing(false), 500)
    }

    const handleEdit = (scheme: DiscountSchemeRow) => {
        setEditing(scheme)
        setFormOpen(true)
    }

    const handleCreate = () => {
        setEditing(null)
        setFormOpen(true)
    }

    const handleDelete = () => {
        if (!deleteTarget) return
        deleteMutation.mutate(deleteTarget.id, {
            onSettled: () => setDeleteTarget(null),
        })
    }

    function formatValue(scheme: DiscountSchemeRow): string {
        if (scheme.type === "PERCENTAGE") return `${Number(scheme.value ?? 0)}%`
        if (scheme.type === "FIXED") return formatIDR(Number(scheme.value ?? 0))
        if (scheme.type === "TIERED") {
            const rules = Array.isArray(scheme.tieredRules) ? scheme.tieredRules : []
            return `${rules.length} tier`
        }
        return "-"
    }

    function scopeTarget(scheme: DiscountSchemeRow): string {
        if (scheme.scope === "GLOBAL") return "Semua"
        if (scheme.scope === "PRICELIST" && scheme.priceList) return scheme.priceList.name
        if (scheme.scope === "CUSTOMER" && scheme.customer) return scheme.customer.name
        if (scheme.scope === "PRODUCT" && scheme.product) return scheme.product.name
        if (scheme.scope === "CATEGORY" && scheme.category) return scheme.category.name
        return "-"
    }

    return (
        <div className="mf-page">
            {/* ═══ HEADER ═══ */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900">
                <div className="px-6 py-4 flex items-center justify-between border-l-[6px] border-l-emerald-500">
                    <div className="flex items-center gap-3">
                        <Percent className="h-6 w-6 text-emerald-600" />
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                                Skema Diskon
                            </h1>
                            <p className="text-zinc-600 text-xs font-bold mt-0.5">
                                Kelola skema potongan harga — persentase, tetap, atau bertingkat
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleRefresh}
                            className="border-2 border-black font-bold text-xs rounded-none"
                        >
                            <RefreshCcw className={`h-3.5 w-3.5 mr-1 ${refreshing ? "animate-spin" : ""}`} />
                            Refresh
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleCreate}
                            className="bg-black text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-black uppercase text-xs tracking-wider rounded-none"
                        >
                            <Plus className="h-4 w-4 mr-1" />
                            Buat Skema
                        </Button>
                    </div>
                </div>
            </div>

            {/* ═══ KPI STRIP ═══ */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {[
                    { label: "Total Skema", value: summary.total, icon: Tag, color: "bg-zinc-900 text-white" },
                    { label: "Aktif", value: summary.active, icon: Percent, color: "bg-emerald-500 text-white" },
                    { label: "Persentase", value: summary.percentage, icon: Percent, color: "bg-blue-500 text-white" },
                    { label: "Tetap", value: summary.fixed, icon: DollarSign, color: "bg-amber-500 text-white" },
                    { label: "Bertingkat", value: summary.tiered, icon: BarChart3, color: "bg-purple-500 text-white" },
                ].map((kpi) => (
                    <div
                        key={kpi.label}
                        className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 p-3"
                    >
                        <div className="flex items-center gap-2 mb-1">
                            <div className={`p-1 ${kpi.color}`}>
                                <kpi.icon className="h-3.5 w-3.5" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
                                {kpi.label}
                            </span>
                        </div>
                        <div className="text-2xl font-black">{kpi.value}</div>
                    </div>
                ))}
            </div>

            {/* ═══ FILTERS ═══ */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 max-w-lg">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <Input
                        placeholder="Cari..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 border-2 border-black font-bold h-9 rounded-none placeholder:text-zinc-300"
                    />
                </div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-[160px] border-2 border-black font-bold h-9 rounded-none">
                        <SelectValue placeholder="Tipe" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Semua Tipe</SelectItem>
                        <SelectItem value="PERCENTAGE">Persentase</SelectItem>
                        <SelectItem value="FIXED">Potongan Tetap</SelectItem>
                        <SelectItem value="TIERED">Bertingkat</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={scopeFilter} onValueChange={setScopeFilter}>
                    <SelectTrigger className="w-[160px] border-2 border-black font-bold h-9 rounded-none">
                        <SelectValue placeholder="Cakupan" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Semua Cakupan</SelectItem>
                        <SelectItem value="GLOBAL">Semua Produk</SelectItem>
                        <SelectItem value="PRICELIST">Daftar Harga</SelectItem>
                        <SelectItem value="CUSTOMER">Pelanggan</SelectItem>
                        <SelectItem value="PRODUCT">Produk</SelectItem>
                        <SelectItem value="CATEGORY">Kategori</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* ═══ TABLE ═══ */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
                <div className="overflow-x-auto">
                    <Table className="w-full">
                        <TableHeader>
                            <TableRow className="bg-zinc-100 dark:bg-zinc-800 border-b-2 border-black">
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-4 py-2.5">
                                    Kode
                                </TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-4 py-2.5">
                                    Nama Skema
                                </TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-4 py-2.5">
                                    Tipe
                                </TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-4 py-2.5">
                                    Nilai
                                </TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-4 py-2.5">
                                    Cakupan
                                </TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-4 py-2.5">
                                    Target
                                </TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-4 py-2.5">
                                    Status
                                </TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-4 py-2.5 w-10">
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-12 text-zinc-400 font-bold">
                                        {schemes.length === 0
                                            ? "Belum ada skema diskon. Klik \"Buat Skema\" untuk memulai."
                                            : "Tidak ada hasil yang cocok dengan filter."}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filtered.map((scheme) => (
                                    <TableRow
                                        key={scheme.id}
                                        className="border-b border-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer"
                                        onClick={() => handleEdit(scheme)}
                                    >
                                        <TableCell className="px-4 py-2.5 font-mono font-bold text-sm">
                                            {scheme.code}
                                        </TableCell>
                                        <TableCell className="px-4 py-2.5">
                                            <div className="font-bold text-sm">{scheme.name}</div>
                                            {scheme.description && (
                                                <div className="text-xs text-zinc-400 truncate max-w-[200px]">
                                                    {scheme.description}
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell className="px-4 py-2.5">
                                            <Badge
                                                variant="outline"
                                                className={`text-[10px] font-black uppercase border ${TYPE_COLORS[scheme.type] || ""}`}
                                            >
                                                {TYPE_LABELS[scheme.type] || scheme.type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="px-4 py-2.5 font-bold text-sm">
                                            {formatValue(scheme)}
                                        </TableCell>
                                        <TableCell className="px-4 py-2.5 text-xs font-bold text-zinc-500">
                                            {SCOPE_LABELS[scheme.scope] || scheme.scope}
                                        </TableCell>
                                        <TableCell className="px-4 py-2.5 text-sm">
                                            {scopeTarget(scheme)}
                                        </TableCell>
                                        <TableCell className="px-4 py-2.5">
                                            <Badge
                                                variant="outline"
                                                className={`text-[10px] font-black uppercase border ${
                                                    scheme.isActive
                                                        ? "bg-green-100 text-green-800 border-green-300"
                                                        : "bg-zinc-100 text-zinc-500 border-zinc-300"
                                                }`}
                                            >
                                                {scheme.isActive ? "Aktif" : "Nonaktif"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="px-4 py-2.5">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            handleEdit(scheme)
                                                        }}
                                                    >
                                                        <Pencil className="h-3.5 w-3.5 mr-2" />
                                                        Edit
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        className="text-red-600"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            setDeleteTarget(scheme)
                                                        }}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5 mr-2" />
                                                        Hapus
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* ═══ FORM DIALOG ═══ */}
            <DiscountFormDialog
                open={formOpen}
                onOpenChange={setFormOpen}
                editing={editing}
            />

            {/* ═══ DELETE DIALOG ═══ */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
                <AlertDialogContent className="border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-none">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="font-black uppercase">
                            Hapus Skema Diskon?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Skema <strong>{deleteTarget?.name}</strong> ({deleteTarget?.code}) akan dihapus permanen.
                            Tindakan ini tidak dapat dibatalkan.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="border-2 border-black font-bold rounded-none">
                            Batal
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-red-600 text-white border-2 border-black font-black uppercase rounded-none"
                        >
                            Hapus
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
