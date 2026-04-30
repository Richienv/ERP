"use client"
import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Upload, X, ImageIcon, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Props {
    currentKey?: string | null
    onChange: (newKey: string | null) => void
}

const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
const MAX_SIZE = 2 * 1024 * 1024

export function LogoUploader({ currentKey, onChange }: Props) {
    const [uploading, setUploading] = useState(false)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [dragActive, setDragActive] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    async function handleFile(file: File) {
        if (!ALLOWED_MIME.includes(file.type)) {
            toast.error('Format harus PNG/JPG/SVG/WebP')
            return
        }
        if (file.size > MAX_SIZE) {
            toast.error('Ukuran maksimal 2MB')
            return
        }

        // Local preview before upload
        const url = URL.createObjectURL(file)
        setPreviewUrl(url)

        setUploading(true)
        try {
            const fd = new FormData()
            fd.append('file', file)
            const res = await fetch('/api/settings/branding/logo', { method: 'POST', body: fd })
            const json = await res.json()
            if (!res.ok) {
                toast.error(json.detail ? `${json.error}: ${json.detail}` : (json.error || 'Upload gagal'))
                setPreviewUrl(null)
                return
            }
            onChange(json.data.logoStorageKey)
            toast.success('Logo diupload')
        } catch {
            toast.error('Upload gagal — coba lagi')
            setPreviewUrl(null)
        } finally {
            setUploading(false)
        }
    }

    function onDrop(e: React.DragEvent) {
        e.preventDefault()
        setDragActive(false)
        const file = e.dataTransfer.files[0]
        if (file) handleFile(file)
    }

    const hasContent = !!(previewUrl || currentKey)

    return (
        <div className="space-y-2">
            <div
                onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
                onDragLeave={() => setDragActive(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                className={cn(
                    'border-2 border-dashed p-6 text-center cursor-pointer transition-all rounded-none',
                    dragActive
                        ? 'border-orange-500 bg-orange-50'
                        : hasContent
                            ? 'border-zinc-400 bg-zinc-50'
                            : 'border-zinc-300 bg-white hover:border-orange-400 hover:bg-orange-50/30',
                )}
            >
                {previewUrl ? (
                    <div className="space-y-2">
                        <img src={previewUrl} alt="Preview" className="max-h-20 mx-auto border border-zinc-200" />
                        <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                            ✓ Preview baru — klik Simpan untuk apply
                        </div>
                    </div>
                ) : currentKey ? (
                    <div className="space-y-1">
                        <ImageIcon className="h-6 w-6 mx-auto text-zinc-400" />
                        <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-600">
                            Logo terpasang
                        </div>
                        <div className="text-[10px] text-zinc-400 font-mono truncate max-w-xs mx-auto">
                            {currentKey}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-1.5">
                        <ImageIcon className="h-7 w-7 mx-auto text-zinc-300" />
                        <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                            Drag & drop file atau klik untuk pilih
                        </p>
                        <p className="text-[10px] text-zinc-400">
                            PNG · JPG · SVG · WebP — maks 2MB
                        </p>
                    </div>
                )}
            </div>
            <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <div className="flex gap-2">
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => inputRef.current?.click()}
                    disabled={uploading}
                    className="border border-zinc-300 text-[10px] font-bold uppercase tracking-wider h-8 rounded-none hover:bg-zinc-50"
                >
                    {uploading ? (
                        <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Mengupload...</>
                    ) : (
                        <><Upload className="h-3.5 w-3.5 mr-1" /> Pilih File</>
                    )}
                </Button>
                {hasContent && (
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => { onChange(null); setPreviewUrl(null) }}
                        className="text-[10px] font-bold uppercase tracking-wider h-8 rounded-none text-red-600 hover:bg-red-50"
                    >
                        <X className="h-3.5 w-3.5 mr-1" /> Hapus
                    </Button>
                )}
            </div>
        </div>
    )
}
