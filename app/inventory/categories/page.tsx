"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { useCategories, useInvalidateCategories } from "@/hooks/use-categories"
import { useInvalidateMasterData } from "@/hooks/use-master-data"
import { createCategory, updateCategory, deleteCategory } from "@/app/actions/inventory"
import { Plus, Pencil, Trash2, FolderTree } from "lucide-react"
import { toast } from "sonner"

type CategoryDraft = {
    id?: string
    code: string
    name: string
    description?: string
}

type CategoryRow = {
    id: string
    code: string
    name: string
    description?: string | null
    _count?: { products?: number }
}

export default function CategoriesPage() {
    const { data, isLoading } = useCategories()
    const invalidateCategories = useInvalidateCategories()
    const invalidateMaster = useInvalidateMasterData()
    const [editing, setEditing] = useState<CategoryDraft | null>(null)
    const [saving, setSaving] = useState(false)

    const categories: CategoryRow[] = (data?.categories ?? []) as CategoryRow[]

    const refreshAll = () => {
        invalidateCategories()
        invalidateMaster.invalidateCategories()
    }

    const handleSave = async () => {
        if (!editing) return
        if (!editing.code.trim() || !editing.name.trim()) {
            toast.error("Kode dan nama wajib diisi")
            return
        }
        setSaving(true)
        try {
            if (editing.id) {
                const result = await updateCategory(editing.id, {
                    name: editing.name.trim(),
                    code: editing.code.trim(),
                    description: editing.description ?? "",
                })
                if (!result?.success) {
                    toast.error("Gagal memperbarui kategori", {
                        description: result?.error ?? undefined,
                    })
                    return
                }
                toast.success("Kategori diperbarui")
            } else {
                const result = await createCategory({
                    code: editing.code.trim(),
                    name: editing.name.trim(),
                    description: editing.description?.trim() || undefined,
                })
                if (!result?.success) {
                    toast.error("Gagal membuat kategori", {
                        description: result?.error ?? undefined,
                    })
                    return
                }
                toast.success("Kategori dibuat")
            }
            refreshAll()
            setEditing(null)
        } catch (err) {
            toast.error("Terjadi kesalahan", {
                description: err instanceof Error ? err.message : undefined,
            })
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Hapus kategori "${name}"? Produk yang terkait tidak ikut terhapus.`)) return
        const result = await deleteCategory(id)
        if (!result?.success) {
            toast.error("Gagal menghapus kategori", {
                description: result?.error ?? undefined,
            })
            return
        }
        toast.success("Kategori dihapus")
        refreshAll()
    }

    return (
        <div className="mf-page">
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white">
                <div className="h-1 bg-gradient-to-r from-orange-400 via-orange-500 to-orange-400" />
                <div className="px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-orange-500 border-2 border-black flex items-center justify-center">
                            <FolderTree className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight">Kategori Produk</h1>
                            <p className="text-xs text-zinc-500">Master data untuk pengelompokan produk</p>
                        </div>
                    </div>
                    <Button
                        className="h-9 rounded-none text-[10px] font-bold uppercase tracking-wider bg-orange-500 text-white border-2 border-orange-600 hover:bg-orange-600"
                        onClick={() => setEditing({ code: "", name: "", description: "" })}
                    >
                        <Plus className="w-4 h-4 mr-1" /> Tambah Kategori
                    </Button>
                </div>
            </div>

            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white overflow-hidden">
                {isLoading ? (
                    <div className="p-12 text-center text-sm text-zinc-500">Memuat kategori...</div>
                ) : categories.length === 0 ? (
                    <div className="p-12 text-center">
                        <FolderTree className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
                        <p className="text-sm text-zinc-500 mb-4">Belum ada kategori produk</p>
                        <Button
                            className="rounded-none border-2 border-black bg-orange-500 text-white hover:bg-orange-600"
                            onClick={() => setEditing({ code: "", name: "", description: "" })}
                        >
                            <Plus className="w-4 h-4 mr-1" /> Buat kategori pertama
                        </Button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b-2 border-black bg-zinc-50">
                                    <th className="text-left p-3 font-bold uppercase text-[10px] tracking-wider w-32">Kode</th>
                                    <th className="text-left p-3 font-bold uppercase text-[10px] tracking-wider">Nama</th>
                                    <th className="text-left p-3 font-bold uppercase text-[10px] tracking-wider">Deskripsi</th>
                                    <th className="text-right p-3 font-bold uppercase text-[10px] tracking-wider w-24">Produk</th>
                                    <th className="text-right p-3 font-bold uppercase text-[10px] tracking-wider w-32">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {categories.map((c) => (
                                    <tr key={c.id} className="border-b border-zinc-200 hover:bg-zinc-50">
                                        <td className="p-3 font-mono text-xs">{c.code}</td>
                                        <td className="p-3 font-medium">{c.name}</td>
                                        <td className="p-3 text-zinc-500 text-xs">{c.description || "-"}</td>
                                        <td className="p-3 text-right font-mono text-xs">{c._count?.products ?? 0}</td>
                                        <td className="p-3 text-right">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="rounded-none"
                                                onClick={() => setEditing({
                                                    id: c.id,
                                                    code: c.code,
                                                    name: c.name,
                                                    description: c.description ?? "",
                                                })}
                                                aria-label={`Edit ${c.name}`}
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="rounded-none"
                                                onClick={() => handleDelete(c.id, c.name)}
                                                aria-label={`Hapus ${c.name}`}
                                            >
                                                <Trash2 className="w-3.5 h-3.5 text-red-600" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <Dialog open={!!editing} onOpenChange={(o) => !o && !saving && setEditing(null)}>
                <DialogContent className="max-w-md border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-none p-0">
                    <DialogHeader className="bg-black text-white p-4">
                        <DialogTitle className="text-sm font-black uppercase tracking-wider">
                            {editing?.id ? "Edit Kategori" : "Kategori Baru"}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="p-4 space-y-3">
                        <div>
                            <label className="text-xs font-bold uppercase tracking-wider mb-1 block">
                                Kode <span className="text-red-500">*</span>
                            </label>
                            <Input
                                placeholder="KAIN-COTTON"
                                className="rounded-none border-2 border-black placeholder:text-zinc-300"
                                value={editing?.code ?? ""}
                                onChange={(e) => setEditing(p => p ? { ...p, code: e.target.value.toUpperCase() } : null)}
                                disabled={saving}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase tracking-wider mb-1 block">
                                Nama <span className="text-red-500">*</span>
                            </label>
                            <Input
                                placeholder="Kain Katun"
                                className="rounded-none border-2 border-black placeholder:text-zinc-300"
                                value={editing?.name ?? ""}
                                onChange={(e) => setEditing(p => p ? { ...p, name: e.target.value } : null)}
                                disabled={saving}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase tracking-wider mb-1 block">Deskripsi</label>
                            <Textarea
                                placeholder="Deskripsi opsional"
                                className="rounded-none border-2 border-black placeholder:text-zinc-300"
                                value={editing?.description ?? ""}
                                onChange={(e) => setEditing(p => p ? { ...p, description: e.target.value } : null)}
                                disabled={saving}
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter className="p-4 border-t border-zinc-200 gap-2">
                        <Button
                            variant="ghost"
                            className="rounded-none"
                            onClick={() => setEditing(null)}
                            disabled={saving}
                        >
                            Batal
                        </Button>
                        <Button
                            className="bg-orange-500 text-white hover:bg-orange-600 border-2 border-black rounded-none"
                            onClick={handleSave}
                            disabled={saving}
                        >
                            {saving ? "Menyimpan..." : "Simpan"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
