import { createServiceClient } from '@/lib/supabase/server'

const BUCKET = 'documents'

/**
 * NOTE: All storage operations here use the service-role Supabase client,
 * NOT the user-cookie client. The bucket is private and RLS-locked.
 * Authorization is enforced at the API route layer (see canViewEntity in
 * lib/documents/entity-authz.ts) BEFORE these helpers are called.
 *
 * Using user-session client + per-bucket RLS policies would require
 * complex policy gymnastics for the polymorphic snapshot model. The
 * service role bypasses RLS, which is safe because we never expose this
 * code path to the browser.
 */

export async function uploadDocument(
    buffer: Buffer,
    key: string,
    contentType: string = 'application/pdf',
): Promise<string> {
    const supabase = createServiceClient()
    const { error } = await supabase.storage.from(BUCKET).upload(key, buffer, {
        contentType,
        upsert: false,
    })
    if (error) throw new Error(`Storage upload failed: ${error.message}`)
    return key
}

export const DEFAULT_SIGNED_URL_TTL = 60 * 5  // 5 minutes — sensitive PDF docs, re-issue per click

export async function getDocumentSignedUrl(key: string, expiresInSeconds: number = DEFAULT_SIGNED_URL_TTL): Promise<string> {
    const supabase = createServiceClient()
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(key, expiresInSeconds)
    if (error || !data) throw new Error(`Signed URL failed: ${error?.message ?? 'unknown'}`)
    return data.signedUrl
}

export async function downloadDocument(key: string): Promise<Buffer> {
    const supabase = createServiceClient()
    const { data, error } = await supabase.storage.from(BUCKET).download(key)
    if (error || !data) throw new Error(`Download failed: ${error?.message ?? 'unknown'}`)
    return Buffer.from(await data.arrayBuffer())
}

export async function deleteDocument(key: string): Promise<void> {
    const supabase = createServiceClient()
    await supabase.storage.from(BUCKET).remove([key])
    // intentionally swallow ALL errors — delete is best-effort (snapshots are
    // append-only audit artifacts; failures here don't affect correctness)
}
