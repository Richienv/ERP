"use client"

import { preloadPdfjs } from "./client"
import type { PdfText } from "./pdf-text"
import type { TextItem } from "./types"

/**
 * OCR fallback for scanned PDFs and photos, run entirely in the browser with tesseract.js.
 * Only loaded when a file has no text layer. The invoice image never leaves the device; the
 * OCR engine and language model are static files (downloaded once, then cached by the browser).
 *
 * Output is the same TextItem shape as the pdf.js reader, in PDF points for PDFs (so the review
 * boxes line up) and in image pixels for photos.
 */

const RENDER_SCALE = 2.5 // ≈ 180 dpi for A4: enough for printed invoices, fast enough on a laptop

type Word = { text: string; bbox: { x0: number; y0: number; x1: number; y1: number }; confidence: number }

async function pdfPagesToImages(bytes: Uint8Array, maxPages = 3): Promise<{ canvas: HTMLCanvasElement; scale: number; size: { width: number; height: number } }[]> {
    const pdfjs = await preloadPdfjs()
    const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise
    const out: { canvas: HTMLCanvasElement; scale: number; size: { width: number; height: number } }[] = []
    try {
        for (let p = 1; p <= Math.min(doc.numPages, maxPages); p++) {
            const page = await doc.getPage(p)
            const base = page.getViewport({ scale: 1 })
            const viewport = page.getViewport({ scale: RENDER_SCALE })
            const canvas = document.createElement("canvas")
            canvas.width = Math.floor(viewport.width)
            canvas.height = Math.floor(viewport.height)
            await page.render({ canvas, viewport } as never).promise
            out.push({ canvas, scale: RENDER_SCALE, size: { width: base.width, height: base.height } })
        }
    } finally {
        await doc.destroy()
    }
    return out
}

type Line = {
    words?: Word[]
    bbox: { x0: number; y0: number; x1: number; y1: number }
    baseline?: { x0: number; y0: number; x1: number; y1: number; has_baseline?: boolean }
}

/**
 * Words with the BASELINE of their line, not the bottom of their own box: "g", "p" and "y" hang
 * below the line, and using box bottoms would split one table row into several.
 */
/** Photos and low-dpi scans read much better when small text is enlarged first (to ~2400 px wide). */
async function imageToCanvas(file: File) {
    const bitmap = await createImageBitmap(file)
    const scale = Math.max(1, Math.min(2.5, 2400 / bitmap.width))
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext("2d")!
    ctx.imageSmoothingQuality = "high"
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    return { canvas, scale, size: { width: canvas.width / scale, height: canvas.height / scale } }
}

function wordsOf(data: unknown): (Word & { baseline: number; lineHeight: number })[] {
    const out: (Word & { baseline: number; lineHeight: number })[] = []
    const blocks = (data as { blocks?: { paragraphs?: { lines?: Line[] }[] }[] })?.blocks ?? []
    for (const b of blocks) {
        for (const p of b.paragraphs ?? []) {
            for (const l of p.lines ?? []) {
                const lineHeight = Math.max(1, l.bbox.y1 - l.bbox.y0)
                const base = l.baseline && l.baseline.has_baseline !== false ? Math.max(l.baseline.y0, l.baseline.y1) : l.bbox.y1 - lineHeight * 0.2
                for (const w of l.words ?? []) out.push({ ...w, baseline: base, lineHeight })
            }
        }
    }
    return out
}

export async function ocrInvoice(file: File, bytes: Uint8Array): Promise<PdfText> {
    const { createWorker } = await import("tesseract.js")
    // English covers the Latin script of both ID and CN export invoices; Indonesian adds its words.
    const worker = await createWorker(["eng", "ind"])
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name)
    const items: TextItem[] = []
    const pageSizes: PdfText["pageSizes"] = []
    try {
        const pages = isPdf ? await pdfPagesToImages(bytes) : [await imageToCanvas(file)]
        for (const [i, pg] of pages.entries()) {
            const { data } = await worker.recognize(pg.canvas as never, {}, { blocks: true })
            for (const w of wordsOf(data)) {
                if (!w.text?.trim() || w.confidence < 30) continue
                const { x0, x1 } = w.bbox
                // Cap height ≈ 70% of the line box; TextItem.y is a baseline in a top-left frame.
                const h = (w.lineHeight * 0.7) / pg.scale
                items.push({ str: w.text, x: x0 / pg.scale, y: w.baseline / pg.scale, w: (x1 - x0) / pg.scale, h, page: i + 1 })
            }
            pageSizes.push(pg.size)
        }
    } finally {
        await worker.terminate()
    }
    return { items, pages: pageSizes.length, chars: items.reduce((s, it) => s + it.str.length, 0), pageSizes }
}
