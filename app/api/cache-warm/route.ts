import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProcurementStats, getPurchaseRequests, getAllPurchaseOrders, getVendors } from '@/lib/actions/procurement'
import { getProductsForPO } from '@/app/actions/purchase-order'
import { getPendingPOsForReceiving, getAllGRNs, getWarehousesForGRN, getEmployeesForGRN } from '@/lib/actions/grn'
import { getInventoryKPIs, getMaterialGapAnalysis, getProcurementInsights, getProductsForKanban, getStockMovements, getWarehouses } from '@/app/actions/inventory'

export const dynamic = 'force-dynamic'

// Maximum number of cache keys accepted in a single bulk (POST) request.
// Prevents an unbounded fan-out / amplification DoS against our own database.
const MAX_BULK_KEYS = 20

/**
 * Ensure the caller has an authenticated Supabase session.
 * Returns a 401 response when unauthenticated, otherwise null.
 */
async function requireSession(): Promise<NextResponse | null> {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) {
            return NextResponse.json({ error: 'Sesi tidak valid. Silakan login kembali.' }, { status: 401 })
        }
        return null
    } catch (error) {
        console.error('[cache-warm] Auth check failed:', error)
        return NextResponse.json({ error: 'Sesi tidak valid. Silakan login kembali.' }, { status: 401 })
    }
}

/**
 * Allowlist of warmable cache keys. Any key outside this switch is rejected,
 * so callers cannot use this route to invoke arbitrary server actions.
 * Returns `undefined` for an unknown key.
 */
async function warmCacheKey(key: string): Promise<unknown | undefined> {
    switch (key) {
        case 'procurement-stats':
            return await getProcurementStats()

        case 'vendors-list':
            return await getVendors()

        case 'products-list':
            return await getProductsForPO()

        case 'pending-requests':
            return await getPurchaseRequests()

        case 'purchase-orders':
            return await getAllPurchaseOrders()

        case 'pending-pos':
            return await getPendingPOsForReceiving()

        case 'grn-list':
            return await getAllGRNs()

        case 'warehouses-list':
            return await getWarehousesForGRN()

        case 'employees-list':
            return await getEmployeesForGRN()

        case 'inventory-kpis':
            return await getInventoryKPIs()

        case 'material-gap-analysis':
            return await getMaterialGapAnalysis()

        case 'procurement-insights':
            return await getProcurementInsights()

        case 'inventory-kanban':
            return await getProductsForKanban()

        case 'inventory-movements':
            return await getStockMovements(100)

        case 'warehouses-list-inventory':
            return await getWarehouses()

        case 'recent-activity': {
            const stats = await getProcurementStats()
            return stats.recentActivity
        }

        default:
            return undefined
    }
}

// Enterprise-grade cache warming endpoint
// Used by intelligent prefetching system to warm caches before user needs data
export async function GET(request: NextRequest) {
    const unauthorized = await requireSession()
    if (unauthorized) return unauthorized

    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')

    if (!key) {
        return NextResponse.json({ error: 'Cache key wajib diisi' }, { status: 400 })
    }

    try {
        const startTime = Date.now()
        const result = await warmCacheKey(key)

        if (result === undefined) {
            return NextResponse.json({ error: 'Cache key tidak dikenal' }, { status: 400 })
        }

        const duration = Date.now() - startTime

        return NextResponse.json({
            success: true,
            key,
            duration: `${duration}ms`,
            dataCount: Array.isArray(result) ? result.length : 1,
            timestamp: new Date().toISOString()
        })

    } catch (error) {
        console.error(`Cache warming failed for ${key}:`, error)
        return NextResponse.json(
            { error: 'Cache warming gagal', key },
            { status: 500 }
        )
    }
}

// Bulk cache warming for enterprise performance
export async function POST(request: NextRequest) {
    const unauthorized = await requireSession()
    if (unauthorized) return unauthorized

    try {
        const body = await request.json()
        const { keys } = body

        if (!Array.isArray(keys)) {
            return NextResponse.json({ error: 'Keys harus berupa array' }, { status: 400 })
        }

        if (keys.length > MAX_BULK_KEYS) {
            return NextResponse.json(
                { error: `Maksimal ${MAX_BULK_KEYS} cache key per permintaan` },
                { status: 400 }
            )
        }

        const startTime = Date.now()

        // Warm in-process instead of self-fetching this same route: a self-fetch
        // would drop the caller's session cookie (401) and doubles the request
        // fan-out for every key, which is the amplification vector we are closing.
        const results = await Promise.allSettled(
            keys.map(async (key: unknown) => {
                if (typeof key !== 'string') {
                    throw new Error('Cache key harus berupa string')
                }
                const result = await warmCacheKey(key)
                if (result === undefined) {
                    throw new Error(`Cache key tidak dikenal: ${key}`)
                }
                return {
                    success: true,
                    key,
                    dataCount: Array.isArray(result) ? result.length : 1,
                }
            })
        )

        const duration = Date.now() - startTime
        const successful = results.filter(r => r.status === 'fulfilled').length
        const failed = results.filter(r => r.status === 'rejected').length

        return NextResponse.json({
            success: true,
            totalKeys: keys.length,
            successful,
            failed,
            duration: `${duration}ms`,
            results: results.map((r, i) => ({
                key: typeof keys[i] === 'string' ? keys[i] : null,
                status: r.status,
                data: r.status === 'fulfilled' ? r.value : null
            }))
        })

    } catch (error) {
        console.error('Bulk cache warming failed:', error)
        return NextResponse.json(
            { error: 'Bulk cache warming gagal' },
            { status: 500 }
        )
    }
}
