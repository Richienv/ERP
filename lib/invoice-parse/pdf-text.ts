import type { TextItem } from "./types"

/**
 * PDF → positioned text items, using pdf.js. The pdf.js module is passed in so the same code
 * runs in the browser (standard build + worker) and in Node tests (legacy build).
 */

type PdfJsLike = {
    getDocument: (src: any) => { promise: Promise<any>; destroy?: () => Promise<void> }
}

export type PdfText = {
    items: TextItem[]
    pages: number
    /** Non-space characters found in the text layer. Near zero = a scan → needs OCR. */
    chars: number
    /** Page sizes in points, for drawing highlight boxes over a rendered page. */
    pageSizes: { width: number; height: number }[]
}

export async function extractTextItems(data: ArrayBuffer | Uint8Array, pdfjs: PdfJsLike, maxPages = 5): Promise<PdfText> {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
    // pdf.js transfers (detaches) the buffer; give it a copy so callers can reuse theirs.
    const task = pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, disableFontFace: true })
    const doc = await task.promise
    const items: TextItem[] = []
    const pageSizes: PdfText["pageSizes"] = []
    let chars = 0
    const pages = Math.min(doc.numPages, maxPages)
    try {
        for (let p = 1; p <= pages; p++) {
            const page = await doc.getPage(p)
            const viewport = page.getViewport({ scale: 1 })
            pageSizes.push({ width: viewport.width, height: viewport.height })
            const content = await page.getTextContent()
            for (const raw of content.items as any[]) {
                if (typeof raw.str !== "string" || raw.str.length === 0) continue
                const [a, b, c, d, e, f] = raw.transform as number[]
                const fontSize = Math.hypot(c, d) || Math.hypot(a, b) || raw.height || 10
                const h = raw.height || fontSize
                items.push({
                    str: raw.str,
                    x: e,
                    y: viewport.height - f,
                    w: raw.width || raw.str.length * fontSize * 0.5,
                    h,
                    page: p,
                })
                chars += raw.str.replace(/\s/g, "").length
            }
            page.cleanup?.()
        }
    } finally {
        await doc.destroy?.()
    }
    return { items, pages, chars, pageSizes }
}

/** A text layer this thin means the PDF is a scan or photo. */
export function needsOcr(text: Pick<PdfText, "chars" | "pages">): boolean {
    return text.chars < 20 * Math.max(1, text.pages)
}
