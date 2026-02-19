"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    Hash,
    Save,
    FileText,
    RefreshCw,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast, Toaster } from "sonner"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { type DocumentNumberingConfig } from "@/lib/actions/settings"
import { useDocumentNumbering } from "@/hooks/use-document-numbering"

export const dynamic = "force-dynamic"

const DATE_FORMATS = ["YYMM", "YYYYMM", "YY", "YYYY"]
const SEPARATORS = ["-", "/", "."]

function generateExample(prefix: string, sep: string, dateFormat: string, digitCount: number): string {
    const now = new Date()
    const yy = String(now.getFullYear()).slice(-2)
    const yyyy = String(now.getFullYear())
    const mm = String(now.getMonth() + 1).padStart(2, "0")

    let datePart = ""
    switch (dateFormat) {
        case "YYMM": datePart = `${yy}${mm}`; break
        case "YYYYMM": datePart = `${yyyy}${mm}`; break
        case "YY": datePart = yy; break
        case "YYYY": datePart = yyyy; break
    }

    const numPart = "1".padStart(digitCount, "0")
    return `${prefix}${sep}${datePart}${sep}${numPart}`
}

export default function NumberingPage() {
    const { data: initialConfigs, isLoading: loading } = useDocumentNumbering()
    const [configs, setConfigs] = useState<DocumentNumberingConfig[]>([])
    const [dirty, setDirty] = useState(false)

    useEffect(() => {
        if (initialConfigs && initialConfigs.length > 0 && configs.length === 0) {
            setConfigs(initialConfigs)
        }
    }, [initialConfigs, configs.length])

    const updateConfig = (index: number, field: keyof DocumentNumberingConfig, value: string | number) => {
        setConfigs(prev => {
            const updated = [...prev]
            const item = { ...updated[index], [field]: value }
            // Regenerate example
            item.example = generateExample(item.prefix, item.separator, item.dateFormat, item.digitCount)
            updated[index] = item
            return updated
        })
        setDirty(true)
    }

    const handleSave = () => {
        toast.success("Konfigurasi penomoran disimpan!", {
            className: "font-bold border-2 border-black",
        })
        setDirty(false)
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center space-y-2">
                    <Hash className="h-8 w-8 animate-pulse mx-auto" />
                    <p className="text-sm font-bold text-zinc-500 uppercase tracking-wider">Memuat Konfigurasi...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6 p-6">
            <Toaster position="top-center" />

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
                        <Hash className="h-6 w-6" /> Penomoran Dokumen
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Atur format penomoran otomatis untuk setiap jenis dokumen
                    </p>
                </div>
                <Button
                    className={cn(
                        "border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-black uppercase text-xs tracking-wider",
                        dirty ? "bg-black text-white" : "bg-zinc-200 text-zinc-500"
                    )}
                    onClick={handleSave}
                    disabled={!dirty}
                >
                    <Save className="h-4 w-4 mr-1" /> Simpan Perubahan
                </Button>
            </div>

            {/* Numbering Table */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-black text-white">
                            <th className="text-left px-4 py-3 font-black uppercase tracking-wider text-[10px]">Modul</th>
                            <th className="text-left px-3 py-3 font-black uppercase tracking-wider text-[10px]">Prefix</th>
                            <th className="text-left px-3 py-3 font-black uppercase tracking-wider text-[10px]">Pemisah</th>
                            <th className="text-left px-3 py-3 font-black uppercase tracking-wider text-[10px]">Format Tgl</th>
                            <th className="text-left px-3 py-3 font-black uppercase tracking-wider text-[10px]">Digit</th>
                            <th className="text-left px-3 py-3 font-black uppercase tracking-wider text-[10px]">Contoh</th>
                            <th className="text-left px-3 py-3 font-black uppercase tracking-wider text-[10px]">Terakhir</th>
                        </tr>
                    </thead>
                    <tbody>
                        {configs.map((config, idx) => (
                            <tr key={config.module} className="border-b border-zinc-200 hover:bg-zinc-50 transition-colors">
                                <td className="px-4 py-3 font-bold border-r border-zinc-200">
                                    <div className="flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-zinc-400" />
                                        {config.module}
                                    </div>
                                </td>
                                <td className="px-3 py-2 border-r border-zinc-200">
                                    <Input
                                        value={config.prefix}
                                        onChange={e => updateConfig(idx, "prefix", e.target.value.toUpperCase())}
                                        className="border-2 border-black font-mono font-bold h-8 w-20 text-center rounded-none text-xs"
                                        maxLength={5}
                                    />
                                </td>
                                <td className="px-3 py-2 border-r border-zinc-200">
                                    <Select value={config.separator} onValueChange={v => updateConfig(idx, "separator", v)}>
                                        <SelectTrigger className="border-2 border-black h-8 w-16 rounded-none font-mono font-bold text-center text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {SEPARATORS.map(s => (
                                                <SelectItem key={s} value={s} className="font-mono font-bold">{s === "-" ? "Dash (-)" : s === "/" ? "Slash (/)" : "Dot (.)"}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </td>
                                <td className="px-3 py-2 border-r border-zinc-200">
                                    <Select value={config.dateFormat} onValueChange={v => updateConfig(idx, "dateFormat", v)}>
                                        <SelectTrigger className="border-2 border-black h-8 w-24 rounded-none font-mono font-bold text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {DATE_FORMATS.map(f => (
                                                <SelectItem key={f} value={f} className="font-mono">{f}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </td>
                                <td className="px-3 py-2 border-r border-zinc-200">
                                    <Input
                                        type="number"
                                        min={3}
                                        max={8}
                                        value={config.digitCount}
                                        onChange={e => updateConfig(idx, "digitCount", parseInt(e.target.value) || 4)}
                                        className="border-2 border-black font-mono font-bold h-8 w-16 text-center rounded-none text-xs"
                                    />
                                </td>
                                <td className="px-3 py-2 border-r border-zinc-200">
                                    <Badge variant="outline" className="font-mono text-xs border-2 border-zinc-300 bg-zinc-50 px-3 py-1">
                                        {config.example}
                                    </Badge>
                                </td>
                                <td className="px-3 py-2">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono font-bold text-zinc-500 text-xs">{config.lastNumber}</span>
                                        <button
                                            className="h-6 w-6 flex items-center justify-center text-zinc-400 hover:text-red-500 transition-colors"
                                            title="Reset counter"
                                        >
                                            <RefreshCw className="h-3 w-3" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Info Box */}
            <div className="border-2 border-black bg-zinc-50 p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-2">Panduan Format</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                    <div>
                        <span className="font-black">YYMM</span>
                        <span className="text-zinc-500 ml-1">— Tahun 2 digit + Bulan (2602)</span>
                    </div>
                    <div>
                        <span className="font-black">YYYYMM</span>
                        <span className="text-zinc-500 ml-1">— Tahun 4 digit + Bulan (202602)</span>
                    </div>
                    <div>
                        <span className="font-black">YY</span>
                        <span className="text-zinc-500 ml-1">— Tahun saja (26)</span>
                    </div>
                    <div>
                        <span className="font-black">Digit</span>
                        <span className="text-zinc-500 ml-1">— Jumlah angka urut (4 = 0001)</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
