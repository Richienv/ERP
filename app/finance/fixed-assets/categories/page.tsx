"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { useFixedAssetCategories, useGLAccountsForFA } from "@/hooks/use-fixed-assets"
import { createFixedAssetCategory, updateFixedAssetCategory, deleteFixedAssetCategory } from "@/lib/actions/finance-fixed-assets"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import { NB } from "@/lib/dialog-styles"
import { toast } from "sonner"
import Link from "next/link"
import { FolderTree, Plus, ArrowLeft, RefreshCcw, Pencil, Trash2, Loader2 } from "lucide-react"

export const dynamic = "force-dynamic"

type DepreciationMethod = "STRAIGHT_LINE" | "DECLINING_BALANCE" | "UNITS_OF_PRODUCTION"

const methodLabels: Record<string, string> = {
    STRAIGHT_LINE: "Garis Lurus",
    DECLINING_BALANCE: "Saldo Menurun",
    UNITS_OF_PRODUCTION: "Unit Produksi",
}

type CategoryForm = {
    code: string
    name: string
    description: string
    defaultMethod: DepreciationMethod
    defaultUsefulLife: string
    defaultResidualPct: string
    assetAccountId: string
    accDepAccountId: string
    depExpAccountId: string
    gainLossAccountId: string
}

const emptyForm: CategoryForm = {
    code: "",
    name: "",
    description: "",
    defaultMethod: "STRAIGHT_LINE",
    defaultUsefulLife: "60",
    defaultResidualPct: "0",
    assetAccountId: "",
    accDepAccountId: "",
    depExpAccountId: "",
    gainLossAccountId: "",
}

export default function FixedAssetCategoriesPage() {
    const queryClient = useQueryClient()
    const { data, isLoading } = useFixedAssetCategories()
    const { data: glData } = useGLAccountsForFA()

    const [dialogOpen, setDialogOpen] = useState(false)
    const [editId, setEditId] = useState<string | null>(null)
    const [form, setForm] = useState<CategoryForm>(emptyForm)
    const [submitting, setSubmitting] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
    const [deleting, setDeleting] = useState(false)

    const accounts = glData?.accounts ?? []
    const categories = data?.categories ?? []

    if (isLoading || !data) return <TablePageSkeleton accentColor="bg-purple-400" />

    const openCreate = () => {
        setEditId(null)
        setForm(emptyForm)
        setDialogOpen(true)
    }

    const openEdit = (cat: any) => {
        setEditId(cat.id)
        setForm({
            code: cat.code || "",
            name: cat.name || "",
            description: cat.description || "",
            defaultMethod: cat.defaultMethod || "STRAIGHT_LINE",
            defaultUsefulLife: String(cat.defaultUsefulLife ?? 60),
            defaultResidualPct: String(cat.defaultResidualPct ?? 0),
            assetAccountId: cat.assetAccountId || "",
            accDepAccountId: cat.accDepAccountId || "",
            depExpAccountId: cat.depExpAccountId || "",
            gainLossAccountId: cat.gainLossAccountId || "",
        })
        setDialogOpen(true)
    }

    const handleSubmit = async () => {
        if (!form.code.trim()) {
            toast.error("Kode kategori wajib diisi")
            return
        }
        if (!form.name.trim()) {
            toast.error("Nama kategori wajib diisi")
            return
        }

        setSubmitting(true)
        try {
            const payload = {
                code: form.code.trim(),
                name: form.name.trim(),
                description: form.description.trim() || undefined,
                defaultMethod: form.defaultMethod,
                defaultUsefulLife: parseInt(form.defaultUsefulLife) || 60,
                defaultResidualPct: parseFloat(form.defaultResidualPct) || 0,
                assetAccountId: form.assetAccountId && form.assetAccountId !== "none" ? form.assetAccountId : undefined,
                accDepAccountId: form.accDepAccountId && form.accDepAccountId !== "none" ? form.accDepAccountId : undefined,
                depExpAccountId: form.depExpAccountId && form.depExpAccountId !== "none" ? form.depExpAccountId : undefined,
                gainLossAccountId: form.gainLossAccountId && form.gainLossAccountId !== "none" ? form.gainLossAccountId : undefined,
            }

            const result = editId
                ? await updateFixedAssetCategory(editId, payload)
                : await createFixedAssetCategory(payload)

            if (result.success) {
                toast.success(editId ? "Kategori berhasil diperbarui" : "Kategori berhasil dibuat")
                setDialogOpen(false)
                setForm(emptyForm)
                setEditId(null)
                queryClient.invalidateQueries({ queryKey: queryKeys.fixedAssetCategories.all })
            } else {
                toast.error((result as any).error || "Gagal menyimpan kategori")
            }
        } catch {
            toast.error("Terjadi kesalahan saat menyimpan")
        } finally {
            setSubmitting(false)
        }
    }

    const handleDelete = async () => {
        if (!deleteTarget) return
        setDeleting(true)
        try {
            const result = await deleteFixedAssetCategory(deleteTarget.id)
            if (result.success) {
                toast.success(`Kategori "${deleteTarget.name}" berhasil dihapus`)
                setDeleteTarget(null)
                queryClient.invalidateQueries({ queryKey: queryKeys.fixedAssetCategories.all })
            } else {
                toast.error((result as any).error || "Gagal menghapus kategori")
            }
        } catch {
            toast.error("Terjadi kesalahan saat menghapus")
        } finally {
            setDeleting(false)
        }
    }

    const updateField = <K extends keyof CategoryForm>(key: K, value: CategoryForm[K]) => {
        setForm(prev => ({ ...prev, [key]: value }))
    }

    return (
        <div className="mf-page min-h-screen space-y-4">
            {/* HEADER */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white">
                <div className="px-6 py-4 flex items-center justify-between border-l-[6px] border-l-purple-500">
                    <div className="flex items-center gap-3">
                        <FolderTree className="h-6 w-6 text-purple-500" />
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight text-zinc-900">Kategori Aset Tetap</h1>
                            <p className="text-zinc-600 text-xs font-bold mt-0.5">Kelola kategori dan pengaturan default penyusutan</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link href="/finance/fixed-assets">
                            <Button variant="outline" className="h-9 border-2 border-black font-bold uppercase text-[10px] tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-none transition-all bg-white">
                                <ArrowLeft className="mr-2 h-3.5 w-3.5" /> Kembali
                            </Button>
                        </Link>
                        <Button
                            variant="outline"
                            onClick={() => queryClient.invalidateQueries({ queryKey: queryKeys.fixedAssetCategories.all })}
                            className="h-9 border-2 border-black font-bold uppercase text-[10px] tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-none transition-all bg-white"
                        >
                            <RefreshCcw className="mr-2 h-3.5 w-3.5" /> Refresh
                        </Button>
                        <Button
                            onClick={openCreate}
                            className="h-9 bg-purple-600 text-white hover:bg-purple-700 border-2 border-purple-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] uppercase font-black text-[10px] tracking-wider hover:translate-y-[1px] hover:shadow-none transition-all px-4"
                        >
                            <Plus className="mr-2 h-3.5 w-3.5" /> Tambah Kategori
                        </Button>
                    </div>
                </div>
            </div>

            {/* TABLE */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b-2 border-black bg-zinc-50">
                                {["Kode", "Nama Kategori", "Metode Default", "Masa Manfaat", "Residu (%)", "Akun Aset", "Akun Akum.", "Akun Beban", "Jumlah Aset", "Aksi"].map(h => (
                                    <th key={h} className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-4 py-3 text-left">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {categories.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="text-center py-20 text-zinc-400">
                                        <FolderTree className="h-12 w-12 mx-auto mb-4 text-zinc-200" />
                                        <p className="font-bold text-lg text-zinc-500">Belum ada kategori</p>
                                        <p className="text-sm mt-1">Klik &quot;Tambah Kategori&quot; untuk membuat kategori pertama</p>
                                    </td>
                                </tr>
                            ) : (
                                categories.map((cat: any) => (
                                    <tr key={cat.id} className="border-b border-zinc-100 hover:bg-zinc-50 transition-colors">
                                        <td className="px-4 py-3 font-mono font-bold text-sm text-purple-700">{cat.code}</td>
                                        <td className="px-4 py-3">
                                            <div className="font-bold text-sm">{cat.name}</div>
                                            {cat.description && <div className="text-[10px] text-zinc-400 mt-0.5">{cat.description}</div>}
                                        </td>
                                        <td className="px-4 py-3 text-sm font-medium text-zinc-600">{methodLabels[cat.defaultMethod] || cat.defaultMethod}</td>
                                        <td className="px-4 py-3 text-sm font-bold text-zinc-700">{cat.defaultUsefulLife} bulan</td>
                                        <td className="px-4 py-3 text-sm font-bold text-zinc-700">{cat.defaultResidualPct}%</td>
                                        <td className="px-4 py-3 text-xs font-medium text-zinc-500">{cat.assetAccount ? `${cat.assetAccount.code} - ${cat.assetAccount.name}` : <span className="text-zinc-300">-</span>}</td>
                                        <td className="px-4 py-3 text-xs font-medium text-zinc-500">{cat.accDepAccount ? `${cat.accDepAccount.code} - ${cat.accDepAccount.name}` : <span className="text-zinc-300">-</span>}</td>
                                        <td className="px-4 py-3 text-xs font-medium text-zinc-500">{cat.depExpAccount ? `${cat.depExpAccount.code} - ${cat.depExpAccount.name}` : <span className="text-zinc-300">-</span>}</td>
                                        <td className="px-4 py-3">
                                            <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-purple-100 text-purple-700 font-black text-xs border border-purple-200">
                                                {cat._count?.assets ?? 0}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => openEdit(cat)}
                                                    className="h-7 w-7 p-0 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-none transition-all"
                                                >
                                                    <Pencil className="h-3 w-3" />
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setDeleteTarget({ id: cat.id, name: cat.name })}
                                                    className="h-7 w-7 p-0 border-2 border-red-300 text-red-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)] hover:bg-red-50 hover:translate-y-[1px] hover:shadow-none transition-all"
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* CREATE / EDIT DIALOG */}
            <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) { setDialogOpen(false); setEditId(null); setForm(emptyForm) } }}>
                <DialogContent className={NB.content}>
                    <DialogHeader className={NB.header}>
                        <DialogTitle className={NB.title}>
                            <FolderTree className="h-5 w-5" />
                            {editId ? "Edit Kategori Aset" : "Tambah Kategori Aset"}
                        </DialogTitle>
                    </DialogHeader>

                    <ScrollArea className={NB.scroll}>
                        <div className="p-6 space-y-4">
                            {/* INFO DASAR */}
                            <div className={NB.section}>
                                <div className={NB.sectionHead}>
                                    <span className={NB.sectionTitle}>Informasi Dasar</span>
                                </div>
                                <div className={NB.sectionBody}>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className={NB.label}>
                                                Kode <span className={NB.labelRequired}>*</span>
                                            </label>
                                            <Input
                                                className={NB.input}
                                                placeholder="cth: FA-BNG"
                                                value={form.code}
                                                onChange={e => updateField("code", e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className={NB.label}>
                                                Nama <span className={NB.labelRequired}>*</span>
                                            </label>
                                            <Input
                                                className={NB.input}
                                                placeholder="cth: Bangunan"
                                                value={form.name}
                                                onChange={e => updateField("name", e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className={NB.label}>Deskripsi</label>
                                        <Input
                                            className={NB.input}
                                            placeholder="Deskripsi kategori (opsional)"
                                            value={form.description}
                                            onChange={e => updateField("description", e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* PENYUSUTAN DEFAULT */}
                            <div className={NB.section}>
                                <div className={NB.sectionHead}>
                                    <span className={NB.sectionTitle}>Penyusutan Default</span>
                                </div>
                                <div className={NB.sectionBody}>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <label className={NB.label}>Metode Default</label>
                                            <Select value={form.defaultMethod} onValueChange={(v) => updateField("defaultMethod", v as DepreciationMethod)}>
                                                <SelectTrigger className={NB.select}>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="STRAIGHT_LINE">Garis Lurus</SelectItem>
                                                    <SelectItem value="DECLINING_BALANCE">Saldo Menurun</SelectItem>
                                                    <SelectItem value="UNITS_OF_PRODUCTION">Unit Produksi</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <label className={NB.label}>Masa Manfaat Default (Bulan)</label>
                                            <Input
                                                className={NB.input}
                                                type="number"
                                                min={1}
                                                placeholder="60"
                                                value={form.defaultUsefulLife}
                                                onChange={e => updateField("defaultUsefulLife", e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className={NB.label}>Persentase Residu Default (%)</label>
                                            <Input
                                                className={NB.input}
                                                type="number"
                                                min={0}
                                                max={100}
                                                step={0.1}
                                                placeholder="0"
                                                value={form.defaultResidualPct}
                                                onChange={e => updateField("defaultResidualPct", e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* AKUN GL */}
                            <div className={NB.section}>
                                <div className={NB.sectionHead}>
                                    <span className={NB.sectionTitle}>Akun GL Default</span>
                                </div>
                                <div className={NB.sectionBody}>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className={NB.label}>Akun Aset</label>
                                            <Select value={form.assetAccountId} onValueChange={(v) => updateField("assetAccountId", v)}>
                                                <SelectTrigger className={NB.select}>
                                                    <SelectValue placeholder="Pilih akun aset..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">-- Tidak ada --</SelectItem>
                                                    {accounts.map((acc: any) => (
                                                        <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <label className={NB.label}>Akun Akum. Penyusutan</label>
                                            <Select value={form.accDepAccountId} onValueChange={(v) => updateField("accDepAccountId", v)}>
                                                <SelectTrigger className={NB.select}>
                                                    <SelectValue placeholder="Pilih akun akumulasi..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">-- Tidak ada --</SelectItem>
                                                    {accounts.map((acc: any) => (
                                                        <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <label className={NB.label}>Akun Beban Penyusutan</label>
                                            <Select value={form.depExpAccountId} onValueChange={(v) => updateField("depExpAccountId", v)}>
                                                <SelectTrigger className={NB.select}>
                                                    <SelectValue placeholder="Pilih akun beban..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">-- Tidak ada --</SelectItem>
                                                    {accounts.map((acc: any) => (
                                                        <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <label className={NB.label}>Akun Laba/Rugi Disposal</label>
                                            <Select value={form.gainLossAccountId} onValueChange={(v) => updateField("gainLossAccountId", v)}>
                                                <SelectTrigger className={NB.select}>
                                                    <SelectValue placeholder="Pilih akun disposal..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">-- Tidak ada --</SelectItem>
                                                    {accounts.map((acc: any) => (
                                                        <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* FOOTER */}
                            <div className={NB.footer}>
                                <Button
                                    type="button"
                                    className={NB.cancelBtn}
                                    onClick={() => { setDialogOpen(false); setEditId(null); setForm(emptyForm) }}
                                    disabled={submitting}
                                >
                                    Batal
                                </Button>
                                <Button
                                    type="button"
                                    className={NB.submitBtn}
                                    onClick={handleSubmit}
                                    disabled={submitting}
                                >
                                    {submitting ? (
                                        <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Menyimpan...</>
                                    ) : (
                                        editId ? "Simpan Perubahan" : "Buat Kategori"
                                    )}
                                </Button>
                            </div>
                        </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>

            {/* DELETE CONFIRMATION DIALOG */}
            <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
                <DialogContent className={NB.contentNarrow}>
                    <DialogHeader className={NB.header}>
                        <DialogTitle className={NB.title}>
                            <Trash2 className="h-5 w-5 text-red-400" />
                            Hapus Kategori
                        </DialogTitle>
                    </DialogHeader>
                    <div className="p-6 space-y-4">
                        <div className={NB.section}>
                            <div className={NB.sectionBody}>
                                <p className="text-sm font-medium text-zinc-700">
                                    Apakah Anda yakin ingin menghapus kategori <span className="font-black text-red-600">&quot;{deleteTarget?.name}&quot;</span>?
                                </p>
                                <p className="text-xs text-zinc-500 mt-2">
                                    Kategori yang masih memiliki aset terdaftar tidak dapat dihapus. Tindakan ini tidak dapat dibatalkan.
                                </p>
                            </div>
                        </div>
                        <div className={NB.footer}>
                            <Button
                                className={NB.cancelBtn}
                                onClick={() => setDeleteTarget(null)}
                                disabled={deleting}
                            >
                                Batal
                            </Button>
                            <Button
                                className="bg-red-600 text-white border-2 border-red-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-black uppercase text-xs tracking-wider px-8 h-9 rounded-none"
                                onClick={handleDelete}
                                disabled={deleting}
                            >
                                {deleting ? (
                                    <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Menghapus...</>
                                ) : (
                                    "Ya, Hapus"
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
