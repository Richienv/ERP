
'use server'

import { prisma } from "@/lib/prisma"
import { unstable_cache } from "next/cache"

export const getWarehouses = unstable_cache(
    async () => {
        const warehouses = await prisma.warehouse.findMany({
            include: {
                stockLevels: true,
                _count: {
                    select: { stockLevels: true }
                }
            }
        })

        return warehouses.map(w => ({
            id: w.id,
            name: w.name,
            code: w.code,
            location: w.city || w.address || 'Unknown',
            type: 'General', // Fallback as description/type might be missing
            capacity: 10000, // Mock or fetch if available
            utilization: Math.floor(Math.random() * 100), // Mock for now
            manager: 'Staff', // Mock
            status: 'Active',
            totalValue: 0, // Calculate if needed
            activePOs: 0,
            pendingTasks: 0
        }))
    },
    ['warehouses-list'],
    { revalidate: 60, tags: ['inventory', 'warehouses'] }
)

export const getInventoryKPIs = unstable_cache(
    async () => {
        const totalProducts = await prisma.product.count({ where: { isActive: true } })
        const lowStock = await prisma.product.count({
            where: {
                isActive: true,
                stockLevels: {
                    some: {
                        quantity: {
                            lte: 10 // Assuming 10 is global threshold or needs refinement
                        }
                    }
                }
            }
        })

        // Calculate Inventory Value
        const allStock = await prisma.stockLevel.findMany({
            include: { product: true }
        })
        const totalValue = allStock.reduce((sum, item) => sum + (item.quantity * Number(item.product.costPrice)), 0)

        return {
            totalProducts,
            lowStock,
            totalValue,
            inventoryAccuracy: 98 // Mock
        }
    },
    ['inventory-kpis'],
    { revalidate: 60, tags: ['inventory', 'kpis'] }
)

export const getMaterialGapAnalysis = unstable_cache(
    async () => {
        const products = await prisma.product.findMany({
            where: { isActive: true },
            include: {
                stockLevels: {
                    include: { warehouse: true }
                },
                category: true,
                purchaseOrderItems: {
                    where: {
                        purchaseOrder: { status: { in: ['OPEN', 'PARTIAL'] } }
                    },
                    include: {
                        purchaseOrder: { select: { id: true, number: true, expectedDate: true } }
                    }
                },
                // 3. Supplier Intelligence
                supplierItems: {
                    where: { isPreferred: true }, // Get preferred vendor
                    include: { supplier: { select: { name: true, contactName: true } } },
                    take: 1
                },
                // 4. Alternatives
                alternativeProduct: { select: { id: true, name: true, code: true } },
                // 5. BOM & Demand (Critical for loop)
                BOMItem: {
                    include: {
                        bom: {
                            include: {
                                product: {
                                    include: {
                                        workOrders: {
                                            where: { status: { in: ['PLANNED', 'IN_PROGRESS'] } }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        })

        return products.map(p => {
            const currentStock = p.stockLevels.reduce((sum, sl) => sum + sl.quantity, 0)

            // 1. Calculate Real Demand from Active Work Orders
            // Logic: Iterate through BOM items where this material is used
            let woDemandQty = 0
            const activeWOs: any[] = []

            p.BOMItem.forEach(bomItem => {
                const fg = bomItem.bom.product
                if (fg && fg.workOrders.length > 0) {
                    fg.workOrders.forEach(wo => {
                        const requiredForWO = Number(bomItem.quantity) * wo.plannedQty
                        woDemandQty += requiredForWO
                        activeWOs.push({
                            id: wo.id,
                            number: wo.number,
                            date: wo.startDate,
                            qty: requiredForWO,
                            productName: fg.name
                        })
                    })
                }
            })

            // 2. Supply Chain Data
            const incomingPO = p.purchaseOrderItems[0] // Just take the first one for now
            const incomingQty = p.purchaseOrderItems.reduce((sum, item) => sum + Number(item.quantity), 0)

            const preferredSupplier = p.supplierItems[0]

            // 3. Planning Parameters (Real Data)
            const leadTime = preferredSupplier?.leadTime || p.leadTime || 7
            const safetyStock = p.safetyStock || 0
            const burnRate = Number(p.manualBurnRate) || 0 // Per day
            const cost = preferredSupplier?.price ? Number(preferredSupplier.price) : Number(p.costPrice)

            // 4. Calculations
            // How many days until we run out?
            const stockEndsInDays = burnRate > 0 ? (currentStock / burnRate) : 999

            // Reorder Point = (Average Daily Usage * Lead Time) + Safety Stock
            const reorderPoint = (burnRate * leadTime) + safetyStock

            // Gap = (Demand + Reorder Point) - (Current Stock + Incoming)
            // If we have immediate WO demand, that increases urgency
            const totalProjectedNeed = woDemandQty + reorderPoint
            const totalProjectedStock = currentStock + incomingQty

            const gap = totalProjectedNeed - totalProjectedStock

            // Status Logic
            let status = 'OK'
            if (gap > 0) {
                if (currentStock <= 0) status = 'OUT_OF_STOCK'
                else if (woDemandQty > currentStock) status = 'CRITICAL_WO_SHORTAGE' // Cannot fulfill active WO
                else status = 'RESTOCK_NEEDED'
            }

            return {
                id: p.id,
                name: p.name,
                sku: p.code,
                category: p.category?.name || 'Uncategorized',
                unit: p.unit,

                // Stock
                currentStock,
                incomingQty,
                warehouses: p.stockLevels.map(sl => ({ name: sl.warehouse.name, qty: sl.quantity })),

                // Planning
                minStock: p.minStock,
                reorderPoint,
                safetyStock,
                leadTime,
                consumptionRate: burnRate,
                stockEndsInDays: stockEndsInDays > 365 ? 365 : Math.floor(stockEndsInDays),

                // Demand & Status
                status,
                gap: gap > 0 ? gap : 0,
                demandSources: activeWOs, // Detailed breakdown

                // Financials
                cost,
                totalGapCost: gap > 0 ? gap * cost : 0,

                // Procurement
                lastProcurement: incomingPO?.purchaseOrder.expectedDate || null,
                activePO: incomingPO ? {
                    number: incomingPO.purchaseOrder.number,
                    qty: incomingQty,
                    eta: incomingPO.purchaseOrder.expectedDate
                } : null,
                supplier: preferredSupplier ? {
                    name: preferredSupplier.supplier.name,
                    isPreferred: true
                } : null,

                // Alternatives
                alternative: p.alternativeProduct ? {
                    name: p.alternativeProduct.name,
                    code: p.alternativeProduct.code
                } : null
            }
        })
    },
    ['material-gap-analysis-v3'],
    { revalidate: 60, tags: ['inventory', 'gap-analysis'] }
)

export const getProcurementInsights = unstable_cache(
    async () => {
        try {
            // 1. Get Active Purchase Orders (Actual Inbound Data)
            const activePOs = await prisma.purchaseOrder.findMany({
                where: {
                    status: { in: ['OPEN', 'PARTIAL'] }
                },
                include: {
                    supplier: true,
                    items: {
                        include: { product: true }
                    }
                },
                orderBy: { createdAt: 'desc' },
                take: 5
            })

            const incomingStock = activePOs.map(po => {
                const totalItems = po.items.reduce((sum, item) => sum + item.quantity, 0)
                // Mock Progress Logic
                let progress = 0
                let trackingStatus = 'Confirmed'
                if (po.status === 'PARTIAL') { progress = 60; trackingStatus = 'Shipped' }
                else if (po.status === 'OPEN') { progress = 35; trackingStatus = 'In Production' }
                // Mock logic for status if not partial/open specific
                if (!trackingStatus) trackingStatus = 'Processing'
                if (progress === 0) progress = 10

                // ETA Logic
                const etaDate = po.expectedDate ? new Date(po.expectedDate) : new Date(Date.now() + 86400000 * 5)
                const daysUntilarrival = Math.ceil((etaDate.getTime() - Date.now()) / (1000 * 3600 * 24))

                return {
                    id: po.id,
                    poNumber: po.number,
                    vendor: po.supplier.name,
                    contact: po.supplier.contactName || po.supplier.email || 'N/A',
                    status: po.status,
                    trackingStatus,
                    progress,
                    totalItems,
                    totalValue: Number(po.totalAmount),
                    eta: etaDate,
                    daysUntilarrival,
                    items: po.items.map(i => ({
                        name: i.product.name,
                        qty: i.quantity,
                        unit: i.product.unit
                    })).slice(0, 3)
                }
            })

            // 2. Calculate Required Restock Cost (Gap Analysis)
            const lowStockProducts = await prisma.product.findMany({
                where: { isActive: true },
                include: {
                    stockLevels: true,
                    purchaseOrderItems: {
                        include: { purchaseOrder: { include: { supplier: true } } },
                        orderBy: { createdAt: 'desc' },
                        take: 1
                    }
                }
            })

            // Calculate Gap & Cost
            let totalRestockCost = 0
            const restockItems = lowStockProducts.map(p => {
                const totalStock = p.stockLevels.reduce((sum, sl) => sum + sl.quantity, 0)
                const deficit = p.minStock - totalStock

                if (deficit > 0) {
                    totalRestockCost += (deficit * Number(p.costPrice))
                }

                // Mock deadlines
                const deadlineDays = Math.floor(Math.random() * 5) + 1

                return {
                    id: p.id,
                    name: p.name,
                    code: p.code,
                    deficit: deficit > 0 ? deficit : 0,
                    unit: p.unit,
                    cost: Number(p.costPrice),
                    totalCost: deficit * Number(p.costPrice),
                    deadlineDays,
                    lastVendor: p.purchaseOrderItems[0]?.purchaseOrder.supplier.name || 'Unknown Vendor'
                }
            }).filter(i => i.deficit > 0).sort((a, b) => a.deadlineDays - b.deadlineDays)

            return {
                activePOs: incomingStock,
                restockItems: restockItems.slice(0, 5),
                summary: {
                    totalIncoming: incomingStock.length,
                    totalRestockCost,
                    itemsCriticalCount: restockItems.length,
                    itemsCriticalList: restockItems
                }
            }

        } catch (error) {
            console.error("Error fetching procurement insights:", error)
            return {
                activePOs: [],
                restockItems: [],
                summary: {
                    totalIncoming: 0,
                    totalRestockCost: 0,
                    itemsCriticalCount: 0,
                    itemsCriticalList: []
                }
            }
        }
    },
    ['procurement-insights'],
    { revalidate: 60, tags: ['inventory', 'procurement'] }
)
