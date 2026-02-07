import { NextRequest, NextResponse } from 'next/server'
import { getProcurementStats, getPurchaseRequests, getAllPurchaseOrders, getVendors } from '@/lib/actions/procurement'
import { getProductsForPO } from '@/app/actions/purchase-order'
import { getPendingPOsForReceiving, getAllGRNs, getWarehousesForGRN, getEmployeesForGRN } from '@/lib/actions/grn'
import { getInventoryKPIs, getMaterialGapAnalysis, getProcurementInsights, getProductsForKanban, getStockMovements, getWarehouses } from '@/app/actions/inventory'

// Enterprise-grade cache warming endpoint
// Used by intelligent prefetching system to warm caches before user needs data
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')

    if (!key) {
        return NextResponse.json({ error: 'Missing cache key' }, { status: 400 })
    }

    try {
        const startTime = Date.now()
        let result = null

        // Warm specific cache based on key
        switch (key) {
            case 'procurement-stats':
                result = await getProcurementStats()
                break
                
            case 'vendors-list':
                result = await getVendors()
                break
                
            case 'products-list':
                result = await getProductsForPO()
                break
                
            case 'pending-requests':
                result = await getPurchaseRequests()
                break
                
            case 'purchase-orders':
                result = await getAllPurchaseOrders()
                break
                
            case 'pending-pos':
                result = await getPendingPOsForReceiving()
                break
                
            case 'grn-list':
                result = await getAllGRNs()
                break
                
            case 'warehouses-list':
                result = await getWarehousesForGRN()
                break
                
            case 'employees-list':
                result = await getEmployeesForGRN()
                break

            case 'inventory-kpis':
                result = await getInventoryKPIs()
                break

            case 'material-gap-analysis':
                result = await getMaterialGapAnalysis()
                break

            case 'procurement-insights':
                result = await getProcurementInsights()
                break

            case 'inventory-kanban':
                result = await getProductsForKanban()
                break

            case 'inventory-movements':
                result = await getStockMovements(100)
                break

            case 'warehouses-list-inventory':
                result = await getWarehouses()
                break
                
            case 'recent-activity':
                const stats = await getProcurementStats()
                result = stats.recentActivity
                break
                
            default:
                return NextResponse.json({ error: 'Unknown cache key' }, { status: 400 })
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
            { error: 'Cache warming failed', key }, 
            { status: 500 }
        )
    }
}

// Bulk cache warming for enterprise performance
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { keys } = body

        if (!Array.isArray(keys)) {
            return NextResponse.json({ error: 'Keys must be an array' }, { status: 400 })
        }

        const startTime = Date.now()
        const results = await Promise.allSettled(
            keys.map(async (key) => {
                const response = await fetch(
                    `${request.nextUrl.origin}/api/cache-warm?key=${key}`,
                    { cache: 'no-store' }
                )
                return response.json()
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
                key: keys[i],
                status: r.status,
                data: r.status === 'fulfilled' ? r.value : null
            }))
        })

    } catch (error) {
        console.error('Bulk cache warming failed:', error)
        return NextResponse.json(
            { error: 'Bulk cache warming failed' }, 
            { status: 500 }
        )
    }
}
