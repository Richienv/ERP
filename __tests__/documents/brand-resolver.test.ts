import { describe, it, expect, vi } from 'vitest'
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
}))

import { prisma } from '@/lib/db'
import { getDocumentSignedUrl } from '@/lib/storage/document-storage'

describe('brand-resolver', () => {
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
        expect(inputs.logo_path).toBe('https://example.com/logo.png')
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
        ;(getDocumentSignedUrl as any).mockRejectedValueOnce(new Error('not found'))

        const inputs = await resolveBrandInputs()
        expect(inputs.logo_path).toBe('') // graceful: no logo, no throw
    })
})
