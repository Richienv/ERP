import { describe, it, expect, vi, beforeEach } from 'vitest'
import { uploadDocument, getDocumentSignedUrl, deleteDocument } from '@/lib/storage/document-storage'

vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(() => Promise.resolve({
        storage: {
            from: vi.fn(() => ({
                upload: vi.fn(() => Promise.resolve({ data: { path: 'PO/abc/v1.pdf' }, error: null })),
                createSignedUrl: vi.fn(() => Promise.resolve({
                    data: { signedUrl: 'https://example.com/signed?token=abc' },
                    error: null,
                })),
                remove: vi.fn(() => Promise.resolve({ data: null, error: null })),
            })),
        },
    })),
}))

describe('document-storage', () => {
    it('uploadDocument returns the storage key on success', async () => {
        const buffer = Buffer.from('fake-pdf-bytes')
        const key = await uploadDocument(buffer, 'PO/abc/v1.pdf')
        expect(key).toBe('PO/abc/v1.pdf')
    })

    it('getDocumentSignedUrl returns a URL string', async () => {
        const url = await getDocumentSignedUrl('PO/abc/v1.pdf', 60 * 60)
        expect(url).toContain('https://')
    })

    it('deleteDocument is idempotent (no throw on missing)', async () => {
        await expect(deleteDocument('PO/missing/v0.pdf')).resolves.not.toThrow()
    })

    it('uploadDocument accepts custom contentType', async () => {
        const buffer = Buffer.from('fake-png-bytes')
        const key = await uploadDocument(buffer, 'test/logo.png', 'image/png')
        expect(key).toBe('test/logo.png')
        // Mock returns the key from the from().upload() call — main assertion is no throw
    })
})
