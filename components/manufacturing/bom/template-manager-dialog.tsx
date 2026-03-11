"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Plus, Trash2, LayoutTemplate, ChevronRight, Lock } from "lucide-react"

const ALL_TYPES = ["CUTTING", "SEWING", "WASHING", "PRINTING", "EMBROIDERY", "QC", "PACKING", "FINISHING", "OTHER"] as const
const TYPE_LABELS: Record<string, string> = {
    CUTTING: "Potong", SEWING: "Jahit", WASHING: "Cuci", PRINTING: "Sablon",
    EMBROIDERY: "Bordir", QC: "QC", PACKING: "Packing", FINISHING: "Finishing", OTHER: "Lainnya",
}

interface BOMTemplate {
    id: string
    name: string
    description?: string | null
    stepsJson: string[]
    isBuiltIn: boolean
}

interface Props {
    open: boolean
    onClose: () => void
    onApply: (types: string[]) => void
}

function useTemplates() {
    return useQuery<{ templates: BOMTemplate[] }>({
        queryKey: ["bom-templates"],
        queryFn: () => fetch("/api/manufacturing/bom-templates").then(r => r.json()),
    })
}

export function TemplateManagerDialog({ open, onClose, onApply }: Props) {
    const qc = useQueryClient()
    const { data, isLoading } = useTemplates()
    const templates = data?.templates ?? []

    const [creating, setCreating] = useState(false)
    const [name, setName] = useState("")
    const [description, setDescription] = useState("")
    const [selectedTypes, setSelectedTypes] = useState<string[]>([])

    const createMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/manufacturing/bom-templates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, description, stepsJson: selectedTypes }),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || "Gagal menyimpan")
            return json
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["bom-templates"] })
            toast.success("Template disimpan")
            setCreating(false)
            setName("")
            setDescription("")
            setSelectedTypes([])
        },
        onError: (e: any) => toast.error(e.message),
    })

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/manufacturing/bom-templates/${id}`, { method: "DELETE" })
            if (!res.ok) throw new Error("Gagal menghapus")
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["bom-templates"] })
            toast.success("Template dihapus")
        },
        onError: (e: any) => toast.error(e.message),
    })

    const toggleType = (type: string) => {
        setSelectedTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type])
    }

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-lg border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-none">
                <DialogHeader>
                    <DialogTitle className="text-base font-black uppercase flex items-center gap-2">
                        <LayoutTemplate className="h-4 w-4" />
                        Template Proses
                    </DialogTitle>
                    <DialogDescription className="text-xs text-zinc-500">
                        Pilih template untuk menambah urutan proses ke kanvas BOM.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                    {isLoading && <p className="text-xs text-zinc-400 text-center py-4">Memuat...</p>}

                    {templates.map((t) => (
                        <div key={t.id} className="border-2 border-zinc-200 p-3 flex items-start gap-3 hover:border-zinc-400 transition-colors">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-sm font-black truncate">{t.name}</span>
                                    {t.isBuiltIn && <Lock className="h-3 w-3 text-zinc-400 shrink-0" title="Template bawaan" />}
                                </div>
                                {t.description && <p className="text-[10px] text-zinc-400 mt-0.5">{t.description}</p>}
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                    {t.stepsJson.map((type, i) => (
                                        <span key={i} className="text-[9px] font-bold bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 text-zinc-600">
                                            {TYPE_LABELS[type] ?? type}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                {!t.isBuiltIn && (
                                    <button
                                        onClick={() => deleteMutation.mutate(t.id)}
                                        className="p-1 hover:bg-red-50 text-zinc-400 hover:text-red-500 transition-colors"
                                        title="Hapus"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                )}
                                <Button
                                    size="sm"
                                    onClick={() => { onApply(t.stepsJson); onClose() }}
                                    className="h-7 px-3 text-[10px] font-bold bg-black hover:bg-zinc-800 rounded-none border-2 border-black"
                                >
                                    Terapkan <ChevronRight className="h-3 w-3 ml-0.5" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Create new template */}
                {creating ? (
                    <div className="border-2 border-orange-300 bg-orange-50 p-3 space-y-3 mt-2">
                        <p className="text-xs font-black uppercase text-orange-700">Template Baru</p>
                        <div className="space-y-1">
                            <Label className="text-[10px] font-bold">Nama Template</Label>
                            <Input value={name} onChange={e => setName(e.target.value)} placeholder="cth: CMT Export" className="h-8 text-xs rounded-none border-2 border-black" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] font-bold">Deskripsi (opsional)</Label>
                            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Keterangan singkat..." className="h-8 text-xs rounded-none border-2 border-black" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] font-bold">Urutan Proses</Label>
                            <div className="flex flex-wrap gap-1.5">
                                {ALL_TYPES.map(type => (
                                    <button
                                        key={type}
                                        onClick={() => toggleType(type)}
                                        className={`text-[9px] font-bold px-2 py-1 border-2 transition-all ${selectedTypes.includes(type) ? "bg-black text-white border-black" : "bg-white text-zinc-600 border-zinc-300 hover:border-zinc-500"}`}
                                    >
                                        {TYPE_LABELS[type]}
                                    </button>
                                ))}
                            </div>
                            {selectedTypes.length > 0 && (
                                <p className="text-[9px] text-zinc-500 mt-1">
                                    Urutan: {selectedTypes.map(t => TYPE_LABELS[t]).join(" → ")}
                                </p>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                onClick={() => createMutation.mutate()}
                                disabled={!name || selectedTypes.length === 0 || createMutation.isPending}
                                className="h-7 text-[10px] font-bold bg-black hover:bg-zinc-800 rounded-none border-2 border-black"
                            >
                                {createMutation.isPending ? "Menyimpan..." : "Simpan Template"}
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setCreating(false)}
                                className="h-7 text-[10px] font-bold rounded-none border-2 border-zinc-300"
                            >
                                Batal
                            </Button>
                        </div>
                    </div>
                ) : (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCreating(true)}
                        className="mt-2 h-8 text-[10px] font-bold rounded-none border-2 border-dashed border-zinc-400 hover:border-black w-full"
                    >
                        <Plus className="h-3.5 w-3.5 mr-1.5" />
                        Buat Template Baru
                    </Button>
                )}
            </DialogContent>
        </Dialog>
    )
}
