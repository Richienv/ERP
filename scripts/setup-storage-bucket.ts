/**
 * One-shot setup: create the "documents" Supabase Storage bucket.
 *
 * Run via:  npx tsx scripts/setup-storage-bucket.ts
 *
 * Idempotent — safe to run multiple times. Uses SUPABASE_SERVICE_ROLE_KEY
 * (admin key) to bypass RLS for bucket creation.
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv({ path: '.env' })
import { createClient } from '@supabase/supabase-js'

const BUCKET = 'documents'

async function main() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is required')
    if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')

    const admin = createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    })

    // 1. Check if bucket exists
    const { data: existing, error: listErr } = await admin.storage.listBuckets()
    if (listErr) throw listErr

    const found = existing?.find((b) => b.name === BUCKET)

    if (found) {
        console.log(`✓ Bucket "${BUCKET}" already exists (id=${found.id}, public=${found.public})`)
        if (found.public) {
            console.warn(`⚠  Bucket is PUBLIC — should be private (signed URLs only). Updating...`)
            const { error: updErr } = await admin.storage.updateBucket(BUCKET, { public: false })
            if (updErr) throw updErr
            console.log(`✓ Bucket switched to private`)
        }
        return
    }

    // 2. Create bucket as private
    const { error: createErr } = await admin.storage.createBucket(BUCKET, {
        public: false,
        fileSizeLimit: 10 * 1024 * 1024, // 10MB cap (logos 2MB, PDFs vary)
        allowedMimeTypes: ['application/pdf', 'image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'],
    })
    if (createErr) throw createErr

    console.log(`✓ Created private bucket "${BUCKET}"`)
    console.log(`  - public: false (signed URLs only)`)
    console.log(`  - fileSizeLimit: 10MB`)
    console.log(`  - allowedMimeTypes: PDF, PNG, JPG, SVG, WebP`)
    console.log()
    console.log(`Now retry: upload a logo via /settings → Branding`)
}

main().catch((err) => {
    console.error('✗ Setup failed:', err.message ?? err)
    process.exit(1)
})
