"use client"

import { extractTextItems, needsOcr, type PdfText } from "./pdf-text"
import { excelToTextItems, isExcelFile } from "./excel"
import { parseInvoice } from "./parse-invoice"
import type { ParsedInvoice, SupplierTemplate } from "./types"

/**
 * Browser side of the invoice reader. pdf.js does the heavy lifting in its own worker; our parser
 * is pure TS and takes a few milliseconds. Nothing here talks to any server.
 */

type PdfJs = typeof import("pdfjs-dist")
let pdfjsPromise: Promise<PdfJs> | null = null

/** Load pdf.js + its worker ahead of time (call when the page is idle) so the first drop is instant. */
export function preloadPdfjs(): Promise<PdfJs> {
    if (!pdfjsPromise) {
        pdfjsPromise = import("pdfjs-dist").then((mod) => {
            mod.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/pdf.worker.min.mjs"
            // Warm the worker with a tiny empty document so its startup is paid now, not on drop.
            return mod
        })
        pdfjsPromise.catch(() => {
            pdfjsPromise = null
        })
    }
    return pdfjsPromise
}

export type ReadResult = {
    kind: "pdf" | "image" | "excel"
    parsed: ParsedInvoice
    text: PdfText | null
    sha256: string
    bytes: Uint8Array
    /** Milliseconds: reading the file, extracting text (or OCR), parsing, and the whole thing. */
    timing: { read: number; extract: number; parse: number; total: number }
    /** Re-parse with a supplier template (after the supplier is recognised). Takes a few ms. */
    reparse: (template: SupplierTemplate | null) => ParsedInvoice
    scanned: boolean
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
    const digest = await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer)
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("")
}

export async function readInvoiceFile(file: File, opts: { ocr?: (file: File, bytes: Uint8Array) => Promise<PdfText> } = {}): Promise<ReadResult> {
    const t0 = performance.now()
    const bytes = new Uint8Array(await file.arrayBuffer())
    const hashPromise = sha256Hex(bytes)
    const t1 = performance.now()
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name)
    const isExcel = isExcelFile(file)

    let text: PdfText | null = null
    let scanned = false
    if (isExcel) {
        const XLSX = await import("xlsx")
        text = excelToTextItems(bytes, XLSX as never)
    } else if (isPdf) {
        const pdfjs = await preloadPdfjs()
        text = await extractTextItems(bytes, pdfjs as never)
        if (needsOcr(text) && opts.ocr) {
            scanned = true
            text = await opts.ocr(file, bytes)
        } else if (needsOcr(text)) {
            scanned = true
        }
    } else if (opts.ocr) {
        scanned = true
        text = await opts.ocr(file, bytes)
    } else {
        scanned = true
    }
    const t2 = performance.now()
    const method = scanned ? "OCR" : "TEXT"
    const parsed = parseInvoice(text?.items ?? [], { method })
    const t3 = performance.now()
    const sha256 = await hashPromise

    return {
        kind: isExcel ? "excel" : isPdf ? "pdf" : "image",
        parsed,
        text,
        sha256,
        bytes,
        scanned,
        timing: { read: t1 - t0, extract: t2 - t1, parse: t3 - t2, total: performance.now() - t0 },
        reparse: (template) => parseInvoice(text?.items ?? [], { template, method }),
    }
}
