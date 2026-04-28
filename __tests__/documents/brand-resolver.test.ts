import { describe, it, expect, vi, afterEach } from 'vitest'
import { resolveBrandInputs } from '@/lib/documents/brand-resolver'

vi.mock('@/lib/db', () => ({
    prisma: {
        tenantConfig: {
            findFirst: vi.fn(),
        },
    },
}))

vi.mock('@/lib/storage/document-storage', () => ({
    getDocumentSignedUrl: vi.fn(() => Promise.resolve('https://example.com/logo.png')),
    downloadDocument: vi.fn(() => Promise.resolve(Buffer.from('fake'))),
}))

import { prisma } from '@/lib/db'

describe('brand-resolver', () => {
    afterEach(async () => {
        const fs = await import('fs/promises')
        const path = await import('path')
        const dir = path.join(process.cwd(), 'templates', '_shared', 'cache')
        // Only remove logo-* cache files, preserve .gitignore so dir stays tracked
        try {
            const entries = await fs.readdir(dir)
            await Promise.all(
                entries
                    .filter((f) => f.startsWith('logo-'))
                    .map((f) => fs.unlink(path.join(dir, f))),
            )
        } catch {
            // dir may not exist; ignore
        }
    })

    it('returns full brand inputs when TenantConfig fully populated', async () => {
        ;(prisma.tenantConfig.findFirst as any).mockResolvedValue({
            tenantName: 'PT Integra',
            companyAddress: 'Jl. Test 1',
            companyNpwp: '01.234.567.8-901.000',
            companyEmail: 'info@integra.id',
            companyPhone: '+62 21 1234567',
            logoStorageKey: '_brand/logo.png',
            primaryColor: '#f97316',
        })

        const inputs = await resolveBrandInputs()
        expect(inputs.company_name).toBe('PT Integra')
        expect(inputs.company_npwp).toBe('01.234.567.8-901.000')
        expect(inputs.brand_color).toBe('#f97316')
        expect(inputs.logo_path).toMatch(/^_shared\/cache\/logo-.*\.png$/)
    })

    it('falls back to defaults when TenantConfig missing', async () => {
        ;(prisma.tenantConfig.findFirst as any).mockResolvedValue(null)

        const inputs = await resolveBrandInputs()
        expect(inputs.company_name).toBe('Perusahaan Anda')
        expect(inputs.brand_color).toBe('#18181b')
        expect(inputs.logo_path).toBe('')
    })

    it('falls back to empty logo_path when logoStorageKey null', async () => {
        ;(prisma.tenantConfig.findFirst as any).mockResolvedValue({
            tenantName: 'PT Test',
            primaryColor: null,
            logoStorageKey: null,
        })

        const inputs = await resolveBrandInputs()
        expect(inputs.logo_path).toBe('')
        expect(inputs.brand_color).toBe('#18181b') // default
    })

    it('falls back to defaults when storage URL signing fails', async () => {
        ;(prisma.tenantConfig.findFirst as any).mockResolvedValue({
            tenantName: 'PT Test',
            logoStorageKey: '_brand/missing.png',
        })
        const { downloadDocument } = await import('@/lib/storage/document-storage') as any
        downloadDocument.mockRejectedValueOnce(new Error('not found'))

        const inputs = await resolveBrandInputs()
        expect(inputs.logo_path).toBe('') // graceful: no logo, no throw
    })

    it('downloads logo to local file when logoStorageKey set', async () => {
        ;(prisma.tenantConfig.findFirst as any).mockResolvedValue({
            tenantName: 'PT Test', logoStorageKey: '_brand/logo.png',
        })
        const { downloadDocument } = await import('@/lib/storage/document-storage') as any
        downloadDocument.mockResolvedValueOnce(Buffer.from('fake-png'))

        const inputs = await resolveBrandInputs()
        expect(inputs.logo_path).toMatch(/^_shared\/cache\/logo-.*\.png$/)
    })

    it('falls back to empty logo_path when downloadDocument throws', async () => {
        ;(prisma.tenantConfig.findFirst as any).mockResolvedValue({
            tenantName: 'PT Test', logoStorageKey: '_brand/missing.png',
        })
        const { downloadDocument } = await import('@/lib/storage/document-storage') as any
        downloadDocument.mockRejectedValueOnce(new Error('not found'))

        const inputs = await resolveBrandInputs()
        expect(inputs.logo_path).toBe('')
    })
})
