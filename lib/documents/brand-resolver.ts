import { prisma } from '@/lib/db'
import { getDocumentSignedUrl } from '@/lib/storage/document-storage'

export interface BrandInputs {
    company_name: string
    company_address: string
    company_npwp: string
    company_email: string
    company_phone: string
    logo_path: string
    brand_color: string
}

const DEFAULTS: BrandInputs = {
    company_name: 'Perusahaan Anda',
    company_address: '',
    company_npwp: '',
    company_email: '',
    company_phone: '',
    logo_path: '',
    brand_color: '#18181b',
}

export async function resolveBrandInputs(): Promise<BrandInputs> {
    const config = await prisma.tenantConfig.findFirst().catch(() => null)
    if (!config) return DEFAULTS

    let logoPath = ''
    if (config.logoStorageKey) {
        try {
            logoPath = await getDocumentSignedUrl(config.logoStorageKey, 60 * 60)
        } catch {
            // graceful: missing logo doesn't block render
            logoPath = ''
        }
    }

    return {
        company_name: config.tenantName ?? DEFAULTS.company_name,
        company_address: config.companyAddress ?? '',
        company_npwp: config.companyNpwp ?? '',
        company_email: config.companyEmail ?? '',
        company_phone: config.companyPhone ?? '',
        logo_path: logoPath,
        brand_color: config.primaryColor ?? DEFAULTS.brand_color,
    }
}
