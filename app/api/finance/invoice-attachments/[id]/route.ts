import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

// DELETE /api/finance/invoice-attachments/[id]
export async function DELETE(
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

        const attachment = await prisma.invoiceAttachment.findUnique({
            where: { id },
        })
        if (!attachment) {
            return NextResponse.json(
                { success: false, error: "Lampiran tidak ditemukan" },
                { status: 404 }
            )
        }

        // Delete from Supabase Storage (non-fatal)
        try {
            const urlPath = new URL(attachment.fileUrl).pathname
            const storagePath = urlPath.split("/documents/")[1]
            if (storagePath) {
                await supabase.storage
                    .from("documents")
                    .remove([storagePath])
            }
        } catch {
            console.warn(
                "Gagal menghapus file dari storage, melanjutkan penghapusan DB"
            )
        }

        // Delete DB record
        await prisma.invoiceAttachment.delete({ where: { id } })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Error deleting invoice attachment:", error)
        return NextResponse.json(
            { success: false, error: "Gagal menghapus lampiran" },
            { status: 500 }
        )
    }
}
