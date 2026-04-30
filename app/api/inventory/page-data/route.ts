import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { calculateProductStatus } from "@/lib/inventory-logic"

/**
 * GET /api/inventory/page-data
 * Returns all data needed for the inventory products page in a single request.
 * Includes procurement pipeline data for Planning & Incoming columns.
 */
export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const [rawProducts, categories, rawWarehouses, prItems, poItems] = await Promise.all([
            prisma.product.findMany({
                where: { isActive: true },
                include: {
                    category: true,
                    stockLevels: true,
                },
                orderBy: { createdAt: 'desc' },
                take: 500,
            }),
            prisma.category.findMany({
                where: { isActive: true },
                select: { id: true, name: true, code: true },
                orderBy: { name: "asc" },
                take: 500,
            }),
            prisma.warehouse.findMany({
                include: {
                    stockLevels: {
                        include: {
                            product: { select: { costPrice: true } },
                        },
                    },
                    _count: { select: { stockLevels: true } },
                },
                orderBy: { name: 'asc' },
                take: 500,
            }),
            // ALL non-cancelled/rejected PR items (for Planning column + status tracking)
            // 500 open PR items is unrealistic in practice — beyond that signals
            // a data hygiene issue (stale PRs not cancelled). Cap to protect load time.
            prisma.purchaseRequestItem.findMany({
                where: {
                    purchaseRequest: {
                        status: { notIn: ['REJECTED', 'CANCELLED'] },
                    },
                },
                include: {
                    purchaseRequest: {
                        select: {
                            id: true,
                            number: true,
                            status: true,
                            convertedToPOId: true,
                            createdAt: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                take: 500,
            }),
            // Active PO items (for Incoming column — products with orders in progress)
            // 500 open PO items is unrealistic in practice — beyond that signals
            // a data hygiene issue (stale POs not received/closed). Cap to protect load time.
            prisma.purchaseOrderItem.findMany({
                where: {
                    purchaseOrder: {
                        status: {
                            in: ['APPROVED', 'ORDERED', 'VENDOR_CONFIRMED', 'SHIPPED', 'PARTIAL_RECEIVED'],
                        },
                    },
                },
                include: {
                    purchaseOrder: {
                        select: {
                            id: true,
                            number: true,
                            status: true,
                            expectedDate: true,
                            supplier: { select: { name: true } },
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                take: 500,
            }),
        ])

        // Build lookup maps per product
        // Planning: products with pending/approved PRs (not yet PO_CREATED or done)
        const prByProduct = new Map<string, {
            prId: string
            prNumber: string
            prStatus: string
            quantity: number
            createdAt: Date
        }[]>()

        for (const item of prItems) {
            const arr = prByProduct.get(item.productId) || []
            arr.push({
                prId: item.purchaseRequest.id,
                prNumber: item.purchaseRequest.number,
                prStatus: item.purchaseRequest.status,
                quantity: Number(item.quantity),
                createdAt: item.purchaseRequest.createdAt,
            })
            prByProduct.set(item.productId, arr)
        }

        // Incoming: products with active POs (approved/ordered/shipped/etc)
        const poByProduct = new Map<string, {
            poId: string
            poNumber: string
            poStatus: string
            expectedDate: Date | null
            supplierName: string
            orderedQty: number
            receivedQty: number
        }[]>()

        for (const item of poItems) {
            const arr = poByProduct.get(item.productId) || []
            arr.push({
                poId: item.purchaseOrder.id,
                poNumber: item.purchaseOrder.number,
                poStatus: item.purchaseOrder.status,
                expectedDate: item.purchaseOrder.expectedDate,
                supplierName: item.purchaseOrder.supplier.name,
                orderedQty: Number(item.quantity),
                receivedQty: Number(item.receivedQty),
            })
            poByProduct.set(item.productId, arr)
        }

        // Determine which products have pending PRs (for Planning column)
        const pendingPRProductIds = new Set<string>()
        for (const [productId, prs] of prByProduct.entries()) {
            // Has at least one PR that is PENDING or APPROVED (not yet PO_CREATED)
            if (prs.some(pr => ['PENDING', 'APPROVED', 'DRAFT'].includes(pr.prStatus))) {
                pendingPRProductIds.add(productId)
            }
        }

        // Determine which products have active incoming orders (for Incoming column)
        const incomingProductIds = new Set<string>()
        for (const [productId] of poByProduct.entries()) {
            incomingProductIds.add(productId)
        }

        // Transform products
        const idsToResetAlert: string[] = []

        const products = rawProducts.map((p) => {
            const totalStock = p.stockLevels.reduce((sum, sl) => sum + Number(sl.quantity), 0)
            const status = calculateProductStatus({
                totalStock,
                minStock: p.minStock,
                reorderLevel: p.reorderLevel,
                manualAlert: p.manualAlert,
                createdAt: p.createdAt,
            })

            // Auto-clear manualAlert when it's redundant:
            // - HEALTHY: stock is fine, no need for alert
            // - CRITICAL with 0 stock: already critical naturally, flag is pointless
            // manualAlert only matters for LOW_STOCK → CRITICAL elevation
            if (p.manualAlert && (status === "HEALTHY" || totalStock === 0)) {
                idsToResetAlert.push(p.id)
            }

            const hasPendingPR = pendingPRProductIds.has(p.id)
            const hasIncomingPO = incomingProductIds.has(p.id)

            // Get the "best" procurement status for this product
            const productPRs = prByProduct.get(p.id) || []
            const productPOs = poByProduct.get(p.id) || []

            // Determine procurement pipeline step
            let procurementStatus: string | null = null
            let procurementDetail: any = null

            if (productPOs.length > 0) {
                // Has active PO — show PO status
                const latestPO = productPOs[0]
                procurementStatus = latestPO.poStatus
                procurementDetail = {
                    type: 'PO',
                    number: latestPO.poNumber,
                    status: latestPO.poStatus,
                    expectedDate: latestPO.expectedDate,
                    supplierName: latestPO.supplierName,
                    orderedQty: latestPO.orderedQty,
                    receivedQty: latestPO.receivedQty,
                }
            } else if (productPRs.length > 0) {
                const latestPR = productPRs[0]
                procurementStatus = `PR_${latestPR.prStatus}`
                procurementDetail = {
                    type: 'PR',
                    number: latestPR.prNumber,
                    status: latestPR.prStatus,
                    quantity: latestPR.quantity,
                    createdAt: latestPR.createdAt,
                }
            }

            return {
                id: p.id,
                code: p.code,
                name: p.name,
                description: p.description,
                unit: p.unit,
                categoryId: p.categoryId,
                costPrice: Number(p.costPrice),
                sellingPrice: p.sellingPrice === null || p.sellingPrice === undefined ? null : Number(p.sellingPrice),
                minStock: p.minStock,
                maxStock: p.maxStock,
                reorderLevel: p.reorderLevel,
                barcode: p.barcode,
                isActive: p.isActive,
                manualAlert: p.manualAlert,
                category: p.category,
                stockLevels: p.stockLevels,
                totalStock,
                currentStock: totalStock,
                status,
                hasPendingPR,
                hasIncomingPO,
                procurementStatus,
                procurementDetail,
                // PR info — always available if product has a pending PR
                prQuantity: productPRs.length > 0 ? productPRs.reduce((sum, pr) => sum + pr.quantity, 0) : 0,
                prNumber: productPRs.length > 0 ? productPRs[0].prNumber : null,
                prStatus: productPRs.length > 0 ? productPRs[0].prStatus : null,
                image: "/placeholder.png",
            }
        })

        // Transform warehouses
        const warehouses = rawWarehouses.map((w) => {
            const totalItems = w.stockLevels.reduce((sum, sl) => sum + Number(sl.quantity), 0)
            const capacity = w.capacity || 50000
            const utilization = capacity > 0 ? Math.min(parseFloat(((totalItems / capacity) * 100).toFixed(1)), 100) : 0
            return {
                id: w.id,
                name: w.name,
                code: w.code,
                location: [w.city, w.province].filter(Boolean).join(", ") || w.address || "Unknown Location",
                type: "Warehouse",
                capacity,
                utilization,
                manager: "Unassigned",
                status: w.isActive ? "Active" : "Inactive",
                totalValue: Math.round(w.stockLevels.reduce((sum, sl) => sum + Number(sl.quantity) * Number(sl.product.costPrice), 0)),
                activePOs: 0,
                pendingTasks: 0,
                items: totalItems,
                staff: 0,
                phone: "-",
            }
        })

        // Compute stats
        const stats = {
            total: products.length,
            healthy: products.filter((p) => p.status === "HEALTHY").length,
            lowStock: products.filter((p) => p.status === "LOW_STOCK").length,
            critical: products.filter((p) => p.status === "CRITICAL").length,
            newArrivals: products.filter((p) => p.status === "NEW").length,
            planning: products.filter((p) => p.hasPendingPR).length,
            incoming: products.filter((p) => p.hasIncomingPO).length,
            totalValue: products.reduce((sum, p) => sum + (p.totalStock * p.costPrice), 0),
        }

        // Note: previously cleared stale manualAlert flags here on every GET.
        // Removed because:
        //   1. write-in-read-handler blocks caching of this hot endpoint
        //   2. fire-and-forget swallowed errors silently
        // manualAlert is now only changed at the call sites that set/unset it
        // (e.g., setProductManualAlert, stock movement that resolves the alert).
        // If stale flags accumulate, run a one-off cleanup script or a cron job.

        return NextResponse.json({
            success: true,
            products,
            categories,
            warehouses,
            stats,
        })
    } catch (error) {
        console.error("Error fetching inventory page data:", error)
        return NextResponse.json({ success: false, error: "Failed to fetch data" }, { status: 500 })
    }
}
