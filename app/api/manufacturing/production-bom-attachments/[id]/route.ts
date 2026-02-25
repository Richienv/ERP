import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

// DELETE /api/manufacturing/production-bom-attachments/[id]
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        }

        const { id } = await params

        const attachment = await prisma.productionBOMAttachment.findUnique({ where: { id } })
        if (!attachment) {
            return NextResponse.json({ success: false, error: 'Attachment not found' }, { status: 404 })
        }

        // Delete from Supabase Storage
        try {
            const urlPath = new URL(attachment.fileUrl).pathname
            const storagePath = urlPath.split('/documents/')[1]
            if (storagePath) {
                await supabase.storage.from('documents').remove([storagePath])
            }
        } catch {
            // Storage deletion failure is non-fatal
            console.warn('Failed to delete file from storage, continuing with DB deletion')
        }

        await prisma.productionBOMAttachment.delete({ where: { id } })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting attachment:', error)
        return NextResponse.json({ success: false, error: 'Failed to delete' }, { status: 500 })
    }
}
