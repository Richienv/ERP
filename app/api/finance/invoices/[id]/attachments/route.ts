import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

const ALLOWED_TYPES = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
]

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

// GET /api/finance/invoices/[id]/attachments
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient()
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json(
                { success: false, error: "Unauthorized" },
                { status: 401 }
            )
        }

        const { id } = await params

        const attachments = await prisma.invoiceAttachment.findMany({
            where: { invoiceId: id },
            orderBy: { uploadedAt: "desc" },
        })

        return NextResponse.json({ success: true, data: attachments })
    } catch (error) {
        console.error("Error fetching invoice attachments:", error)
        return NextResponse.json(
            { success: false, error: "Gagal mengambil lampiran" },
            { status: 500 }
        )
    }
}

// POST /api/finance/invoices/[id]/attachments
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient()
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json(
                { success: false, error: "Unauthorized" },
                { status: 401 }
            )
        }

        const { id: invoiceId } = await params

        // Verify invoice exists
        const invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId },
            select: { id: true },
        })
        if (!invoice) {
            return NextResponse.json(
                { success: false, error: "Invoice tidak ditemukan" },
                { status: 404 }
            )
        }

        const formData = await request.formData()
        const file = formData.get("file") as File | null

        if (!file) {
            return NextResponse.json(
                { success: false, error: "File wajib diunggah" },
                { status: 400 }
            )
        }

        // Validate file type
        if (!ALLOWED_TYPES.includes(file.type)) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Tipe file tidak didukung. Gunakan PDF, JPEG, PNG, atau WebP",
                },
                { status: 400 }
            )
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Ukuran file melebihi batas 10MB",
                },
                { status: 400 }
            )
        }

        // Sanitize filename and build storage path
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
        const storagePath = `invoice-attachments/${invoiceId}/${Date.now()}-${sanitizedName}`

        // Upload to Supabase Storage
        const arrayBuffer = await file.arrayBuffer()
        const { error: uploadError } = await supabase.storage
            .from("documents")
            .upload(storagePath, arrayBuffer, { contentType: file.type })

        if (uploadError) {
            console.error("Storage upload error:", uploadError)
            return NextResponse.json(
                {
                    success: false,
                    error: "Gagal mengunggah file: " + uploadError.message,
                },
                { status: 500 }
            )
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from("documents")
            .getPublicUrl(storagePath)

        // Create DB record
        const attachment = await prisma.invoiceAttachment.create({
            data: {
                invoiceId,
                fileName: file.name,
                fileUrl: urlData.publicUrl,
                fileType: file.type,
                fileSize: file.size,
            },
        })

        return NextResponse.json(
            { success: true, data: attachment },
            { status: 201 }
        )
    } catch (error) {
        console.error("Error uploading invoice attachment:", error)
        return NextResponse.json(
            { success: false, error: "Gagal mengunggah lampiran" },
            { status: 500 }
        )
    }
}
