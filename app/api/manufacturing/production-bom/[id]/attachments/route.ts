import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

// POST /api/manufacturing/production-bom/[id]/attachments
export async function POST(
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
        const formData = await request.formData()
        const file = formData.get('file') as File
        const stepId = formData.get('stepId') as string

        if (!file || !stepId) {
            return NextResponse.json({ success: false, error: 'file and stepId are required' }, { status: 400 })
        }

        // C4: Reject temp IDs (unsaved steps) — user must save BOM first
        if (stepId.startsWith('step-') || stepId.startsWith('temp-')) {
            return NextResponse.json({
                success: false,
                error: 'Simpan BOM terlebih dahulu sebelum upload lampiran',
            }, { status: 400 })
        }

        // Upload to Supabase Storage
        const fileName = `${Date.now()}-${file.name}`
        const filePath = `bom-attachments/${id}/${stepId}/${fileName}`

        const { error: uploadError } = await supabase.storage
            .from('documents')
            .upload(filePath, file)

        if (uploadError) {
            return NextResponse.json({ success: false, error: 'Upload failed: ' + uploadError.message }, { status: 500 })
        }

        const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath)

        const attachment = await prisma.productionBOMAttachment.create({
            data: {
                stepId,
                fileName: file.name,
                fileUrl: urlData.publicUrl,
                fileType: file.type,
                fileSize: file.size,
            },
        })

        return NextResponse.json({ success: true, data: attachment }, { status: 201 })
    } catch (error) {
        console.error('Error uploading attachment:', error)
        return NextResponse.json({ success: false, error: 'Failed to upload' }, { status: 500 })
    }
}
