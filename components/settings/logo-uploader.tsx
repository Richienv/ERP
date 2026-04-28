"use client"
import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Upload, X, ImageIcon } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
    currentKey?: string | null
    onChange: (newKey: string | null) => void
}

const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
const MAX_SIZE = 2 * 1024 * 1024

export function LogoUploader({ currentKey, onChange }: Props) {
    const [uploading, setUploading] = useState(false)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
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
                toast.error(json.error || 'Upload gagal')
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
        const file = e.dataTransfer.files[0]
        if (file) handleFile(file)
    }

    return (
        <div className="space-y-2">
            <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDrop}
                className="border-2 border-dashed border-zinc-300 rounded p-6 text-center cursor-pointer hover:border-orange-400 transition-colors"
                onClick={() => inputRef.current?.click()}
            >
                {previewUrl ? (
                    <img src={previewUrl} alt="Preview" className="max-h-24 mx-auto" />
                ) : currentKey ? (
                    <div className="text-sm text-zinc-600">Logo terpasang: <span className="font-mono text-xs">{currentKey}</span></div>
                ) : (
                    <div className="space-y-2">
                        <ImageIcon className="h-8 w-8 mx-auto text-zinc-400" />
                        <p className="text-sm text-zinc-600">
                            Drag & drop file atau klik untuk pilih
                        </p>
                        <p className="text-[11px] text-zinc-500">
                            PNG/JPG/SVG/WebP, maks 2MB
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
                <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading}>
                    <Upload className="h-3.5 w-3.5 mr-1" />
                    {uploading ? 'Mengupload...' : 'Pilih File'}
                </Button>
                {(currentKey || previewUrl) && (
                    <Button size="sm" variant="ghost" onClick={() => { onChange(null); setPreviewUrl(null) }}>
                        <X className="h-3.5 w-3.5 mr-1" />
                        Hapus
                    </Button>
                )}
            </div>
        </div>
    )
}
