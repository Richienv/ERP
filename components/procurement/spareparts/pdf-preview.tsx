"use client"

import { useEffect, useRef, useState } from "react"
import { preloadPdfjs } from "@/lib/invoice-parse/client"
import type { Box } from "@/lib/invoice-parse/types"
import type { PdfText } from "@/lib/invoice-parse/pdf-text"
import { cn } from "@/lib/utils"

export type PreviewMark = { box: Box; tone: "focus" | "warn" }

/**
 * The supplier's invoice as it really looks, with boxes over the text each field was read from.
 * Hovering a field on the right lights up its source here, so checking takes a glance.
 */
export function InvoicePreview({ file, bytes, marks, text }: { file: File; bytes: Uint8Array; marks: PreviewMark[]; text?: PdfText | null }) {
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name)
    if (/\.(xlsx|xlsm)$/i.test(file.name) && text) return <SheetPreview text={text} marks={marks} />
    return isPdf ? <PdfPages bytes={bytes} marks={marks} /> : <ImagePreview file={file} />
}

/** An Excel document drawn like its printout: every cell where it would print, with the same boxes. */
function SheetPreview({ text, marks }: { text: PdfText; marks: PreviewMark[] }) {
    const wrapRef = useRef<HTMLDivElement>(null)
    const [cssWidth, setCssWidth] = useState(0)
    useEffect(() => {
        const el = wrapRef.current
        if (!el) return
        const ro = new ResizeObserver(([entry]) => setCssWidth(Math.floor(entry.contentRect.width)))
        ro.observe(el)
        return () => ro.disconnect()
    }, [])
    const size = text.pageSizes[0] ?? { width: 600, height: 800 }
    const scale = cssWidth ? cssWidth / size.width : 1
    return (
        <div ref={wrapRef}>
            <div className="relative bg-white rounded-md shadow-sm border border-border overflow-hidden" style={{ height: size.height * scale }}>
                {text.items.map((it, i) => (
                    <span
                        key={i}
                        className="absolute whitespace-nowrap text-slate-800 leading-none"
                        style={{ left: it.x * scale, top: (it.y - it.h) * scale, fontSize: Math.max(7, 8.5 * scale) }}
                    >
                        {it.str}
                    </span>
                ))}
                {marks.map((m, j) => (
                    <div
                        key={`${m.tone}-${j}`}
                        className={cn("pointer-events-none absolute rounded-sm transition-all duration-150", m.tone === "focus" ? "bg-blue-400/20 ring-2 ring-blue-600" : "bg-amber-300/20 ring-1 ring-amber-500/70")}
                        style={{ left: m.box.x * scale - 2, top: m.box.y * scale - 2, width: m.box.w * scale + 4, height: m.box.h * scale + 3 }}
                    />
                ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">Tampilan isi file Excel (tanpa format warna).</p>
        </div>
    )
}

function ImagePreview({ file }: { file: File }) {
    const [url, setUrl] = useState<string | null>(null)
    useEffect(() => {
        const u = URL.createObjectURL(file)
        setUrl(u)
        return () => URL.revokeObjectURL(u)
    }, [file])
    return url ? <img src={url} alt="Invoice supplier" className="w-full border border-zinc-200 bg-white" /> : null
}

function PdfPages({ bytes, marks }: { bytes: Uint8Array; marks: PreviewMark[] }) {
    const wrapRef = useRef<HTMLDivElement>(null)
    const canvases = useRef<(HTMLCanvasElement | null)[]>([])
    const [pages, setPages] = useState<{ width: number; height: number }[]>([])
    const [cssWidth, setCssWidth] = useState(0)

    useEffect(() => {
        const el = wrapRef.current
        if (!el) return
        const ro = new ResizeObserver(([entry]) => setCssWidth(Math.floor(entry.contentRect.width)))
        ro.observe(el)
        return () => ro.disconnect()
    }, [])

    useEffect(() => {
        if (!cssWidth) return
        let cancelled = false
        let destroy: (() => void) | undefined
        ;(async () => {
            const pdfjs = await preloadPdfjs()
            const task = pdfjs.getDocument({ data: bytes.slice() })
            destroy = () => void task.destroy()
            const doc = await task.promise
            const n = Math.min(doc.numPages, 3)
            const sizes: { width: number; height: number }[] = []
            for (let p = 1; p <= n; p++) {
                const page = await doc.getPage(p)
                const vp = page.getViewport({ scale: 1 })
                sizes.push({ width: vp.width, height: vp.height })
            }
            if (cancelled) return
            setPages(sizes)
            // Let React mount the canvases, then paint.
            await new Promise((r) => requestAnimationFrame(() => r(null)))
            const dpr = Math.min(window.devicePixelRatio || 1, 2)
            for (let p = 1; p <= n; p++) {
                const canvas = canvases.current[p - 1]
                if (!canvas || cancelled) continue
                const page = await doc.getPage(p)
                const scale = (cssWidth / sizes[p - 1].width) * dpr
                const viewport = page.getViewport({ scale })
                canvas.width = Math.floor(viewport.width)
                canvas.height = Math.floor(viewport.height)
                await page.render({ canvas, viewport } as never).promise
            }
        })().catch(() => undefined)
        return () => {
            cancelled = true
            destroy?.()
        }
    }, [bytes, cssWidth])

    return (
        <div ref={wrapRef} className="space-y-3">
            {pages.length === 0 && <div className="aspect-[1/1.414] w-full animate-pulse bg-zinc-100 dark:bg-zinc-800" />}
            {pages.map((size, i) => {
                const scale = cssWidth / size.width
                return (
                    <div key={i} className="relative bg-white shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.25)]" style={{ height: size.height * scale }}>
                        <canvas ref={(el) => { canvases.current[i] = el }} className="absolute inset-0 h-full w-full" />
                        {marks
                            .filter((m) => m.box.page === i + 1)
                            .map((m, j) => (
                                <div
                                    key={`${m.tone}-${j}`}
                                    className={cn(
                                        "pointer-events-none absolute transition-all duration-150",
                                        m.tone === "focus" ? "bg-blue-400/25 ring-2 ring-blue-500" : "bg-amber-300/20 ring-1 ring-amber-500/70",
                                    )}
                                    style={{
                                        left: m.box.x * scale - 2,
                                        top: m.box.y * scale - 2,
                                        width: m.box.w * scale + 4,
                                        height: m.box.h * scale + 3,
                                    }}
                                />
                            ))}
                    </div>
                )
            })}
        </div>
    )
}
