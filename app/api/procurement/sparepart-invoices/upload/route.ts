import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { assertRole, getAuthzUser } from "@/lib/authz"
import { INVOICE_FILE_MAX_BYTES, INVOICE_FILE_TYPES, hasMagicBytes, saveInvoiceFile, isLocalFileStore } from "@/lib/sparepart-file-store"

const PURCHASING_ROLES = ["ROLE_PURCHASING", "ROLE_ADMIN", "ROLE_CEO", "ROLE_DIRECTOR"]

/**
 * POST /api/procurement/sparepart-invoices/upload
 * Stores a supplier invoice file in the ERP's own storage (content-addressed by SHA-256) and
 * returns where it lives. Called in parallel with in-browser parsing, so Simpan never waits on it.
 */
export async function POST(request: NextRequest) {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })

    try {
        assertRole(await getAuthzUser(), PURCHASING_ROLES)
    } catch {
        return NextResponse.json({ success: false, error: "Tidak punya akses pembelian" }, { status: 403 })
    }

    const form = await request.formData().catch(() => null)
    const file = form?.get("file")
    if (!(file instanceof File)) return NextResponse.json({ success: false, error: "File wajib diunggah" }, { status: 400 })
    if (!INVOICE_FILE_TYPES[file.type]) {
        return NextResponse.json({ success: false, error: "Gunakan PDF, JPG, PNG atau WebP" }, { status: 400 })
    }
    if (file.size > INVOICE_FILE_MAX_BYTES) {
        return NextResponse.json({ success: false, error: "File lebih dari 10 MB" }, { status: 400 })
    }

    try {
        const bytes = new Uint8Array(await file.arrayBuffer())
        if (!hasMagicBytes(bytes, file.type)) {
            return NextResponse.json({ success: false, error: "Isi file tidak sesuai jenisnya" }, { status: 400 })
        }
        const stored = await saveInvoiceFile(bytes, file.type, isLocalFileStore() ? null : (supabase as never))
        return NextResponse.json({ success: true, ...stored, name: file.name, type: file.type, size: file.size })
    } catch (error) {
        console.error("[sparepart-invoices/upload]", error)
        return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Gagal menyimpan file" }, { status: 500 })
    }
}
