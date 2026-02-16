"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { BookTemplate, FileText, Package, Save } from "lucide-react"
import { toast } from "sonner"
import { NB } from "@/lib/dialog-styles"
import type { POTemplate } from "@/lib/actions/procurement"

interface POTemplateSelectorProps {
    templates: POTemplate[]
    onSelectTemplate: (templateName: string) => Promise<{ success: boolean; poId?: string; error?: string }>
    /** Save current PO as template */
    onSaveAsTemplate?: (templateName: string) => Promise<{ success: boolean; error?: string }>
    mode: 'select' | 'save'
}

export function POTemplateSelector({
    templates,
    onSelectTemplate,
    onSaveAsTemplate,
    mode,
}: POTemplateSelectorProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [saveName, setSaveName] = useState("")

    const handleSelect = async (templateName: string) => {
        setLoading(true)
        const result = await onSelectTemplate(templateName)
        setLoading(false)

        if (result.success) {
            toast.success(`PO berhasil dibuat dari template "${templateName}"`)
            setOpen(false)
        } else {
            toast.error(result.error || "Gagal membuat PO dari template")
        }
    }

    const handleSave = async () => {
        if (!saveName.trim() || !onSaveAsTemplate) return
        setLoading(true)
        const result = await onSaveAsTemplate(saveName.trim())
        setLoading(false)

        if (result.success) {
            toast.success(`Template "${saveName}" berhasil disimpan`)
            setSaveName("")
            setOpen(false)
        } else {
            toast.error(result.error || "Gagal menyimpan template")
        }
    }

    const formatIDR = (n: number) => n.toLocaleString('id-ID')

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {mode === 'select' ? (
                    <Button
                        variant="outline"
                        className="h-8 px-3 text-[9px] font-black uppercase border-2 border-black rounded-none gap-1"
                    >
                        <BookTemplate className="h-3.5 w-3.5" />
                        Dari Template
                    </Button>
                ) : (
                    <Button
                        variant="outline"
                        className="h-8 px-3 text-[9px] font-black uppercase border-2 border-black rounded-none gap-1"
                    >
                        <Save className="h-3.5 w-3.5" />
                        Simpan Template
                    </Button>
                )}
            </DialogTrigger>

            <DialogContent className={NB.content}>
                <DialogHeader className={NB.header}>
                    <DialogTitle className={NB.title}>
                        {mode === 'select' ? (
                            <><BookTemplate className="h-5 w-5" /> Pilih Template PO</>
                        ) : (
                            <><Save className="h-5 w-5" /> Simpan Sebagai Template</>
                        )}
                    </DialogTitle>
                    <p className={NB.subtitle}>
                        {mode === 'select'
                            ? 'Buat PO baru dari template yang sudah disimpan'
                            : 'Simpan konfigurasi PO ini untuk digunakan kembali'}
                    </p>
                </DialogHeader>

                {mode === 'save' ? (
                    <div className="p-6 space-y-4">
                        <div>
                            <label className={NB.label}>
                                Nama Template <span className={NB.labelRequired}>*</span>
                            </label>
                            <Input
                                className={NB.input}
                                placeholder="Contoh: Kain Katun Bulanan"
                                value={saveName}
                                onChange={(e) => setSaveName(e.target.value)}
                            />
                        </div>
                        <div className={NB.footer}>
                            <Button
                                variant="outline"
                                className={NB.cancelBtn}
                                onClick={() => setOpen(false)}
                            >
                                Batal
                            </Button>
                            <Button
                                className={NB.submitBtn}
                                disabled={!saveName.trim() || loading}
                                onClick={handleSave}
                            >
                                {loading ? 'Menyimpan...' : 'Simpan Template'}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <ScrollArea className={NB.scroll}>
                        <div className="p-4 space-y-3">
                            {templates.length === 0 ? (
                                <div className="p-8 text-center">
                                    <BookTemplate className="h-8 w-8 mx-auto text-zinc-300 mb-2" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                                        Belum ada template tersimpan
                                    </span>
                                </div>
                            ) : (
                                templates.map((t) => (
                                    <button
                                        key={t.templateName}
                                        className="w-full text-left bg-white border-2 border-black p-4 hover:bg-zinc-50 transition-colors"
                                        disabled={loading}
                                        onClick={() => handleSelect(t.templateName)}
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <FileText className="h-4 w-4 text-zinc-500" />
                                                    <span className="text-sm font-black">{t.templateName}</span>
                                                </div>
                                                <span className="text-[10px] text-zinc-400 font-bold">
                                                    {t.supplierName} ({t.supplierCode})
                                                </span>
                                            </div>
                                            <span className="text-[9px] font-black px-2 py-0.5 bg-zinc-100 border-2 border-black">
                                                {t.itemCount} item
                                            </span>
                                        </div>

                                        <div className="space-y-1">
                                            {t.items.slice(0, 3).map((item, idx) => (
                                                <div key={idx} className="flex items-center justify-between text-[10px]">
                                                    <span className="flex items-center gap-1 text-zinc-600">
                                                        <Package className="h-2.5 w-2.5" />
                                                        {item.productName}
                                                        <span className="font-mono text-zinc-400">({item.productCode})</span>
                                                    </span>
                                                    <span className="font-mono font-bold">
                                                        {item.quantity} × Rp {formatIDR(item.unitPrice)}
                                                    </span>
                                                </div>
                                            ))}
                                            {t.items.length > 3 && (
                                                <span className="text-[9px] text-zinc-400 font-bold">
                                                    +{t.items.length - 3} item lainnya
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </ScrollArea>
                )}
            </DialogContent>
        </Dialog>
    )
}
