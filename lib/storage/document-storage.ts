import { createClient } from '@/lib/supabase/server'

const BUCKET = 'documents'

export async function uploadDocument(buffer: Buffer, key: string): Promise<string> {
    const supabase = await createClient()
    const { error } = await supabase.storage.from(BUCKET).upload(key, buffer, {
        contentType: 'application/pdf',
        upsert: false,
    })
    if (error) throw new Error(`Storage upload failed: ${error.message}`)
    return key
}

export async function getDocumentSignedUrl(key: string, expiresInSeconds = 60 * 60): Promise<string> {
    const supabase = await createClient()
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(key, expiresInSeconds)
    if (error || !data) throw new Error(`Signed URL failed: ${error?.message ?? 'unknown'}`)
    return data.signedUrl
}

export async function downloadDocument(key: string): Promise<Buffer> {
    const supabase = await createClient()
    const { data, error } = await supabase.storage.from(BUCKET).download(key)
    if (error || !data) throw new Error(`Download failed: ${error?.message ?? 'unknown'}`)
    return Buffer.from(await data.arrayBuffer())
}

export async function deleteDocument(key: string): Promise<void> {
    const supabase = await createClient()
    await supabase.storage.from(BUCKET).remove([key])
    // intentionally swallow "not found" — idempotent delete
}
