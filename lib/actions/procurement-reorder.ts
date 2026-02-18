'use server'

import { prisma, withPrismaAuth } from "@/lib/db"
import { PrismaClient, ProcurementStatus } from "@prisma/client"
import { createClient } from "@/lib/supabase/server"
// Pure functions moved to helper file for "use server" compatibility
import {
    calculateDaysOfStock,
    determineUrgency,
    calculateSuggestedQty,
} from "@/lib/procurement-reorder-helpers"

async function requireAuth() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new Error("Unauthorized")
    return user
}

// ==============================================================================
// Types
// ==============================================================================

export interface ReorderProduct {
    productId: string
    productName: string
    productCode: string
    currentStock: number
    reorderLevel: number
    safetyStock: number
    minStock: number
    maxStock: number
    leadTimeDays: number
    dailyBurnRate: number
    daysOfStockLeft: number
    suggestedQty: number
    urgency: 'CRITICAL' | 'WARNING' | 'NORMAL'
    preferredSupplier: {
        supplierId: string
        supplierName: string
        unitPrice: number
        leadTimeDays: number
    } | null
    openPOQty: number
}

export interface ReorderSummary {
    totalProducts: number
    criticalCount: number
    warningCount: number
    normalCount: number
    estimatedValue: number
    items: ReorderProduct[]
}

// ==============================================================================
// Server Actions (read-only — use singleton prisma)
// ==============================================================================

/**
 * Analyze all products and return those needing reorder, sorted by urgency.
 */
export async function getReorderSuggestions(): Promise<ReorderSummary> {
    try {
        await requireAuth()

        // Fetch all active products with stock levels and supplier info
        const products = await prisma.product.findMany({
            where: {
                isActive: true,
                reorderLevel: { gt: 0 }, // Only products with reorder level set
            },
            select: {
                id: true,
                name: true,
                code: true,
                minStock: true,
                maxStock: true,
                reorderLevel: true,
                safetyStock: true,
                leadTime: true,
                manualBurnRate: true,
                stockLevels: {
                    select: { quantity: true, reservedQty: true },
                },
                supplierItems: {
                    where: { isPreferred: true },
                    select: {
                        supplierId: true,
                        price: true,
                        leadTime: true,
                        supplier: { select: { name: true } },
                    },
                    take: 1,
                },
            },
        })

        // Get open PO quantities per product
        const openPOItems = await prisma.purchaseOrderItem.groupBy({
            by: ['productId'],
            where: {
                purchaseOrder: {
                    status: {
                        in: [
                            'PO_DRAFT',
                            'PENDING_APPROVAL',
                            'APPROVED',
                            'ORDERED',
                            'VENDOR_CONFIRMED',
                            'SHIPPED',
                        ] as ProcurementStatus[],
                    },
                },
            },
            _sum: { quantity: true },
        })

        const openPOMap = new Map<string, number>()
        for (const item of openPOItems) {
            openPOMap.set(item.productId, item._sum.quantity || 0)
        }

        // Analyze each product
        const items: ReorderProduct[] = []

        for (const p of products) {
            const totalStock = p.stockLevels.reduce(
                (sum, sl) => sum + (sl.quantity - sl.reservedQty),
                0
            )
            const burnRate = Number(p.manualBurnRate) || 0
            const openQty = openPOMap.get(p.id) || 0
            const effectiveStock = totalStock + openQty

            // Only include products below reorder level (accounting for open POs)
            if (effectiveStock >= p.reorderLevel) continue

            const daysLeft = calculateDaysOfStock(totalStock, burnRate)
            const urgency = determineUrgency(totalStock, p.reorderLevel, p.safetyStock)

            const preferred = p.supplierItems[0] || null
            const leadTimeDays = preferred?.leadTime ?? p.leadTime

            const suggestedQty = calculateSuggestedQty(
                totalStock,
                p.maxStock || p.reorderLevel * 2,
                p.safetyStock,
                burnRate,
                leadTimeDays,
                openQty
            )

            if (suggestedQty <= 0) continue

            items.push({
                productId: p.id,
                productName: p.name,
                productCode: p.code,
                currentStock: totalStock,
                reorderLevel: p.reorderLevel,
                safetyStock: p.safetyStock,
                minStock: p.minStock,
                maxStock: p.maxStock || p.reorderLevel * 2,
                leadTimeDays,
                dailyBurnRate: burnRate,
                daysOfStockLeft: daysLeft === Infinity ? 999 : daysLeft,
                suggestedQty,
                urgency,
                preferredSupplier: preferred
                    ? {
                          supplierId: preferred.supplierId,
                          supplierName: preferred.supplier.name,
                          unitPrice: Number(preferred.price),
                          leadTimeDays: preferred.leadTime,
                      }
                    : null,
                openPOQty: openQty,
            })
        }

        // Sort: CRITICAL first, then WARNING, then NORMAL; within each, by days of stock
        const urgencyOrder = { CRITICAL: 0, WARNING: 1, NORMAL: 2 }
        items.sort((a, b) => {
            const urgDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency]
            if (urgDiff !== 0) return urgDiff
            return a.daysOfStockLeft - b.daysOfStockLeft
        })

        const criticalCount = items.filter((i) => i.urgency === 'CRITICAL').length
        const warningCount = items.filter((i) => i.urgency === 'WARNING').length
        const normalCount = items.filter((i) => i.urgency === 'NORMAL').length
        const estimatedValue = items.reduce(
            (sum, i) => sum + i.suggestedQty * (i.preferredSupplier?.unitPrice ?? 0),
            0
        )

        return {
            totalProducts: items.length,
            criticalCount,
            warningCount,
            normalCount,
            estimatedValue,
            items,
        }
    } catch (error) {
        console.error("[getReorderSuggestions] Error:", error)
        return {
            totalProducts: 0,
            criticalCount: 0,
            warningCount: 0,
            normalCount: 0,
            estimatedValue: 0,
            items: [],
        }
    }
}

/**
 * Create purchase requests from selected reorder suggestions.
 * Groups items by preferred supplier for efficient PO conversion later.
 */
export async function createAutoReorderPR(
    productIds: string[]
): Promise<{ success: boolean; prIds?: string[]; error?: string }> {
    if (productIds.length === 0) {
        return { success: false, error: 'Pilih minimal 1 produk untuk di-reorder' }
    }

    try {
        const prIds = await withPrismaAuth(async (prisma: PrismaClient) => {
            // Get current user's employee
            const supabase = await (await import('@/lib/supabase/server')).createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Tidak terautentikasi')

            const employee = await prisma.employee.findFirst({
                where: { email: user.email },
                select: { id: true },
            })
            if (!employee) throw new Error('Profil karyawan tidak ditemukan')

            // Get fresh reorder data for selected products
            const products = await prisma.product.findMany({
                where: { id: { in: productIds }, isActive: true },
                select: {
                    id: true,
                    name: true,
                    code: true,
                    reorderLevel: true,
                    safetyStock: true,
                    maxStock: true,
                    leadTime: true,
                    manualBurnRate: true,
                    stockLevels: {
                        select: { quantity: true, reservedQty: true },
                    },
                    supplierItems: {
                        where: { isPreferred: true },
                        select: { leadTime: true },
                        take: 1,
                    },
                },
            })

            // Get open PO quantities
            const openPOItems = await prisma.purchaseOrderItem.groupBy({
                by: ['productId'],
                where: {
                    productId: { in: productIds },
                    purchaseOrder: {
                        status: {
                            in: [
                                'PO_DRAFT',
                                'PENDING_APPROVAL',
                                'APPROVED',
                                'ORDERED',
                                'VENDOR_CONFIRMED',
                                'SHIPPED',
                            ] as ProcurementStatus[],
                        },
                    },
                },
                _sum: { quantity: true },
            })

            const openPOMap = new Map<string, number>()
            for (const item of openPOItems) {
                openPOMap.set(item.productId, item._sum.quantity || 0)
            }

            // Generate PR number
            const now = new Date()
            const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
            const prCount = await prisma.purchaseRequest.count()
            const prNumber = `PR-${yearMonth}-${String(prCount + 1).padStart(4, '0')}`

            // Calculate quantities and create PR
            const prItems = products.map((p) => {
                const totalStock = p.stockLevels.reduce(
                    (sum, sl) => sum + (sl.quantity - sl.reservedQty),
                    0
                )
                const burnRate = Number(p.manualBurnRate) || 0
                const openQty = openPOMap.get(p.id) || 0
                const leadTime = p.supplierItems[0]?.leadTime ?? p.leadTime

                const suggestedQty = calculateSuggestedQty(
                    totalStock,
                    p.maxStock || p.reorderLevel * 2,
                    p.safetyStock,
                    burnRate,
                    leadTime,
                    openQty
                )

                return {
                    productId: p.id,
                    quantity: Math.max(1, suggestedQty),
                    notes: `Auto-reorder: stok ${totalStock}, reorder level ${p.reorderLevel}`,
                }
            })

            const pr = await prisma.purchaseRequest.create({
                data: {
                    number: prNumber,
                    requesterId: employee.id,
                    department: 'Inventory',
                    notes: `Auto-reorder: ${prItems.length} produk di bawah reorder level`,
                    priority: 'HIGH',
                    items: {
                        create: prItems,
                    },
                },
            })

            return [pr.id]
        })

        return { success: true, prIds }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal membuat PR otomatis'
        console.error("[createAutoReorderPR] Error:", error)
        return { success: false, error: msg }
    }
}
