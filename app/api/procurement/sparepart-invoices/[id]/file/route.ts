import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"
import { contentTypeForPath, readLocalInvoiceFile, signedInvoiceFileUrl, isLocalFileStore } from "@/lib/sparepart-file-store"

/** GET /api/procurement/sparepart-invoices/[id]/file — the original supplier invoice, logged-in users only. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ success: false, error: "Tidak ditemukan" }, { status: 404 })
    const capture = await prisma.supplierInvoiceCapture.findUnique({
        where: { id },
        select: { storagePath: true, fileType: true, fileName: true },
    })
    if (!capture?.storagePath) return NextResponse.json({ success: false, error: "File tidak ditemukan" }, { status: 404 })

    try {
        if (isLocalFileStore()) {
            const bytes = await readLocalInvoiceFile(capture.storagePath)
            return new NextResponse(Buffer.from(bytes), {
                headers: {
                    "Content-Type": contentTypeForPath(capture.storagePath),
                    "X-Content-Type-Options": "nosniff",
                    "Content-Disposition": `${/\.xlsx$/.test(capture.storagePath) ? "attachment" : "inline"}; filename="${(capture.fileName || "invoice").replace(/[^\w.-]/g, "_")}"`,
                    "Cache-Control": "private, max-age=3600",
                },
            })
        }
        return NextResponse.redirect(await signedInvoiceFileUrl(capture.storagePath, supabase as never))
    } catch (error) {
        console.error("[sparepart-invoices/file]", error)
        return NextResponse.json({ success: false, error: "File tidak ditemukan" }, { status: 404 })
    }
}
