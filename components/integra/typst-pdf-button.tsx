"use client"

import * as React from "react"
import { toast } from "sonner"
import { IconPrinter, IconLoader } from "@tabler/icons-react"

/**
 * TypstPdfButton — Integra primitive that fetches a PDF from a server endpoint
 * and triggers a download. Used by detail pages (PO, Invoice, GRN, etc.) to
 * print Typst-generated documents without leaving the page.
 *
 * Endpoint contract: GET request returning `application/pdf` blob on 2xx,
 * any non-2xx is treated as a failure.
 */
export function TypstPdfButton({
    endpoint,
    filename,
    label,
    icon,
}: {
    endpoint: string
    filename: string
    label: string
    icon?: React.ReactNode
}) {
    const [loading, setLoading] = React.useState(false)

    async function handleClick() {
        setLoading(true)
        let url: string | null = null
        let downloadStarted = false
        try {
            const res = await fetch(endpoint)
            if (!res.ok) throw new Error("Gagal membuat PDF")
            const blob = await res.blob()
            url = URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = filename
            a.click()
            downloadStarted = true
            toast.success(`PDF disimpan: ${filename}`)
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : "Tidak diketahui"
            toast.error(`Gagal generate PDF: ${message}`)
        } finally {
            // Revoke object URL untuk cegah memory leak. Pada path sukses,
            // delay sebentar — beberapa browser membatalkan download kalau
            // blob URL di-revoke synchronously sebelum unduhan dimulai.
            if (url) {
                if (downloadStarted) {
                    const blobUrl = url
                    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000)
                } else {
                    URL.revokeObjectURL(url)
                }
            }
            setLoading(false)
        }
    }

    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={loading}
            aria-label={loading ? "Generating PDF" : undefined}
            aria-busy={loading || undefined}
            className="h-7 px-3 border border-[var(--integra-hairline-strong)] rounded-[3px] text-[12px] flex items-center gap-1.5 hover:border-[var(--integra-ink)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {loading ? (
                <IconLoader className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
                icon ?? <IconPrinter className="size-3.5" aria-hidden="true" />
            )}
            {loading ? "Generating..." : label}
        </button>
    )
}
