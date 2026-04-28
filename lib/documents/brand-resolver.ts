// lib/documents/brand-resolver.ts
import { prisma } from '@/lib/db'
import { downloadDocument } from '@/lib/storage/document-storage'
import { promises as fs } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

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

const LOGO_CACHE_DIR = path.join(process.cwd(), 'templates', '_shared', 'cache')

export async function resolveBrandInputs(): Promise<BrandInputs> {
    const config = await prisma.tenantConfig.findFirst().catch((err) => {
        console.warn('[brand-resolver] TenantConfig lookup failed:', err)
        return null
    })
    if (!config) return DEFAULTS

    let logoPath = ''
    if (config.logoStorageKey) {
        try {
            const buffer = await downloadDocument(config.logoStorageKey)
            await fs.mkdir(LOGO_CACHE_DIR, { recursive: true })
            const ext = path.extname(config.logoStorageKey) || '.png'
            const filename = `logo-${randomUUID()}${ext}`
            const fullPath = path.join(LOGO_CACHE_DIR, filename)
            await fs.writeFile(fullPath, buffer)
            // Return path relative to Typst --root (templates/) so Typst's image() can read it
            logoPath = `_shared/cache/${filename}`
        } catch (err) {
            console.warn('[brand-resolver] logo download failed:', err)
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
