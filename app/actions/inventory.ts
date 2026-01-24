
'use server'

import { prisma } from "@/lib/prisma"
import { unstable_cache, revalidateTag, revalidatePath } from "next/cache"

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
        const [products, pendingTasks] = await Promise.all([
            prisma.product.findMany({
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
                            purchaseOrder: {
                                include: { supplier: true }
                            }
                        },
                        orderBy: {
                            purchaseOrder: { expectedDate: 'asc' }
                        }
                    },
                    supplierItems: {
                        where: { isPreferred: true },
                        include: { supplier: { select: { name: true, contactName: true } } },
                        take: 1
                    },
                    workOrders: {
                        where: { status: { in: ['PLANNED', 'IN_PROGRESS'] } }
                    },
                    alternativeProduct: true,
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
            }),
            prisma.employeeTask.findMany({
                where: { type: 'PURCHASE_REQUEST', status: 'PENDING' },
                select: { relatedId: true }
            })
        ])

        const pendingSet = new Set(pendingTasks.map(t => t.relatedId))

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

            // Reorder Point = Max of ((Average Daily Usage * Lead Time) + Safety Stock) OR MinStock
            const calculatedROP = (burnRate * leadTime) + safetyStock
            const reorderPoint = Math.max(calculatedROP, p.minStock || 0)

            // Gap = (Demand + Reorder Point) - (Current Stock)
            // WE EXCLUDE INCOMING QTY from Gap calculation to ensure "Receive Goods" button stays visible until physically received.
            const totalProjectedNeed = woDemandQty + reorderPoint
            const totalProjectedStock = currentStock // + incomingQty (removed to keep gap > 0 until receipt)

            const gap = totalProjectedNeed - totalProjectedStock

            // Map all open POs for the dialog
            const openPOs = p.purchaseOrderItems.map(poi => ({
                id: poi.purchaseOrder.id,
                number: poi.purchaseOrder.number,
                supplierName: poi.purchaseOrder.supplier.name,
                expectedDate: poi.purchaseOrder.expectedDate,
                orderedQty: poi.quantity,
                receivedQty: (poi as any).receivedQty || 0,
                remainingQty: poi.quantity - ((poi as any).receivedQty || 0),
                unitPrice: Number(poi.unitPrice)
            })).filter(po => po.remainingQty > 0)

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
                warehouses: p.stockLevels.map(sl => ({
                    id: sl.warehouse.id,
                    name: sl.warehouse.name,
                    qty: sl.quantity
                })),

                // Planning
                minStock: p.minStock,
                reorderPoint,
                safetyStock,
                leadTime,
                consumptionRate: burnRate,
                stockEndsInDays: stockEndsInDays > 365 ? 365 : Math.floor(stockEndsInDays),

                // Demand & Status
                status,
                isPendingRequest: pendingSet.has(p.id),
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
                } : null,

                // Open POs for Goods Receipt
                openPOs
            }
        })
    },
    ['material-gap-analysis'],
    { revalidate: 30, tags: ['inventory', 'gap-analysis'] }
)

// ==========================================
// GOODS RECEIPT ACTION
// ==========================================
export async function receiveGoodsFromPO(data: {
    poId: string,
    itemId: string,
    warehouseId: string,
    receivedQty: number
}) {
    try {
        console.log("Receiving Goods:", data)

        // 1. Get PO Item details
        const po = await prisma.purchaseOrder.findUnique({
            where: { id: data.poId },
            include: { items: true }
        })

        if (!po) throw new Error("PO Not Found")

        const poItem = po.items.find(i => i.productId === data.itemId)
        if (!poItem) throw new Error("Item not found in this PO")

        // 2. Validate/Fetch Warehouse
        let targetWarehouseId = data.warehouseId;

        // specific check if ID is reliable, otherwise fallback
        let warehouseExists = null;
        if (targetWarehouseId && targetWarehouseId.length > 10) {
            try {
                warehouseExists = await prisma.warehouse.findUnique({ where: { id: targetWarehouseId } })
            } catch (e) {
                // Ignore invalid UUID error
            }
        }

        if (!warehouseExists) {
            console.warn(`Warehouse ID ${targetWarehouseId} not found or invalid, falling back to default.`)
            const defaultWarehouse = await prisma.warehouse.findFirst()
            if (!defaultWarehouse) throw new Error("No warehouses found in system.")
            targetWarehouseId = defaultWarehouse.id
        }

        // 2. Perform all updates in a transaction for data integrity & speed
        await prisma.$transaction(async (tx) => {
            // A. Create Transaction Record
            await tx.inventoryTransaction.create({
                data: {
                    productId: data.itemId,
                    warehouseId: targetWarehouseId,
                    type: 'PO_RECEIVE', // Correct enum value from schema
                    quantity: data.receivedQty,
                    notes: `Received from PO ${po.number}`,
                    performedBy: 'System User'
                }
            })

            // B. Update Stock Level (Upsert)
            const existingLevel = await tx.stockLevel.findFirst({
                where: { productId: data.itemId, warehouseId: targetWarehouseId }
            })

            if (existingLevel) {
                await tx.stockLevel.update({
                    where: { id: existingLevel.id },
                    data: {
                        quantity: { increment: data.receivedQty },
                        availableQty: { increment: data.receivedQty }
                    }
                })
            } else {
                await tx.stockLevel.create({
                    data: {
                        productId: data.itemId,
                        warehouseId: targetWarehouseId,
                        quantity: data.receivedQty,
                        availableQty: data.receivedQty
                    }
                })
            }

            // C. Update PO Item
            await tx.purchaseOrderItem.update({
                where: { id: poItem.id },
                data: { receivedQty: { increment: data.receivedQty } }
            })

            // D. Check PO Completion
            const updatedPO = await tx.purchaseOrder.findUnique({
                where: { id: data.poId },
                include: { items: true }
            })

            if (updatedPO) {
                const allReceived = updatedPO.items.every(i => i.receivedQty >= i.quantity)
                const newStatus = allReceived ? 'RECEIVED' : 'PARTIAL'
                if (updatedPO.status !== newStatus && updatedPO.status !== 'RECEIVED') {
                    await tx.purchaseOrder.update({
                        where: { id: data.poId },
                        data: { status: newStatus }
                    })
                }
            }
        }, {
            maxWait: 5000, // 5s max wait to get a connection
            timeout: 20000 // 20s for the transaction itself (fixes P2028)
        })

        // Optimized: Removed blocking revalidatePath.
        // The Client already updates optimistically. 
        // Background revalidation or next visit will sync data.
        // revalidatePath('/inventory')

        return { success: true, message: `Successfully received ${data.receivedQty} units.` }

        return { success: true, message: `Successfully received ${data.receivedQty} units.` }

    } catch (error) {
        console.error("Error receiving goods:", error)
        return { success: false, error: "Failed to receive goods" }
    }
}

// ==========================================
// PURCHASE REQUEST ACTION
// ==========================================
export async function requestPurchase(data: {
    itemId: string,
    quantity: number,
    notes?: string
}) {
    try {
        console.log("Requesting Purchase:", data)

        // 1. Check for Duplicate Pending Requests
        const existingTask = await prisma.employeeTask.findFirst({
            where: {
                relatedId: data.itemId,
                type: 'PURCHASE_REQUEST',
                status: 'PENDING'
            }
        })

        if (existingTask) {
            console.warn("Duplicate request detected for item:", data.itemId)
            return {
                success: false,
                message: "A pending request for this item already exists.",
                alreadyPending: true
            }
        }

        // 2. Parallel Fetching: Product and Assignee
        const [product, assignee] = await Promise.all([
            prisma.product.findUnique({
                where: { id: data.itemId },
                include: { supplierItems: { include: { supplier: true } } }
            }),
            prisma.employee.findFirst({
                where: { OR: [{ firstName: { contains: 'Richie', mode: 'insensitive' } }, { position: 'CEO' }] }
            })
        ])

        if (!product) throw new Error("Product not found")

        // User Fallback (if Richie not found, get any active)
        const finalAssignee = assignee || await prisma.employee.findFirst({ where: { status: 'ACTIVE' } })
        if (!finalAssignee) throw new Error("No active employee found")

        // 3. Create Employee Task (PENDING)
        // We do NOT create a PO here anymore. The procurement team will do that.
        const newTask = await prisma.employeeTask.create({
            data: {
                employeeId: finalAssignee.id,
                title: `Purchase Request: ${product.name}`,
                type: 'PURCHASE_REQUEST',
                priority: 'HIGH',
                status: 'PENDING',
                relatedId: data.itemId,
                notes: data.notes || `Requested by System (Gap Analysis)`
            }
        })

        // Revalidate cache
        revalidateTag('inventory')
        revalidateTag('procurement')

        console.log("Purchase Request Task Created:", newTask)

        return {
            success: true,
            message: "Request sent to Procurement Team",
            pendingTask: newTask
        }

    } catch (error) {
        console.error("Error requesting purchase:", error)
        return { success: false, error: "Failed to request purchase" }
    }
}



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

export const getProductsForKanban = unstable_cache(
    async () => {
        const products = await prisma.product.findMany({
            where: { isActive: true },
            include: {
                category: true,
                stockLevels: true
            }
        })

        return products.map(p => {
            const totalStock = p.stockLevels.reduce((sum, sl) => sum + sl.quantity, 0)

            // Determine Status
            let status = 'IN_STOCK'
            if (totalStock === 0) status = 'OUT_OF_STOCK'
            else if (totalStock <= p.minStock) status = 'LOW_STOCK'

            return {
                id: p.id,
                code: p.code,
                name: p.name,
                category: p.category?.name || 'Uncategorized',
                unit: p.unit,
                minStock: p.minStock,
                totalStock: totalStock,
                status: status,
                image: '/placeholder.png' // Mock if needed
            }
        })
    },
    ['inventory-kanban'],
    { revalidate: 60, tags: ['inventory', 'products'] }
)

export const getWarehouseDetails = unstable_cache(
    async (id: string) => {
        const warehouse = await prisma.warehouse.findUnique({
            where: { id },
            include: {
                stockLevels: {
                    include: {
                        product: {
                            include: { category: true }
                        }
                    }
                }
            }
        })

        if (!warehouse) return null

        // Group by Category
        const categoryMap = new Map<string, { id: string, name: string, itemCount: number, stockCount: number, value: number }>()

        warehouse.stockLevels.forEach(sl => {
            const catName = sl.product.category?.name || 'Uncategorized'
            const catId = sl.product.category?.id || 'uncat'

            const existing = categoryMap.get(catId) || { id: catId, name: catName, itemCount: 0, stockCount: 0, value: 0 }

            existing.itemCount += 1
            existing.stockCount += sl.quantity
            existing.value += sl.quantity * Number(sl.product.costPrice)

            categoryMap.set(catId, existing)
        })

        return {
            id: warehouse.id,
            name: warehouse.name,
            code: warehouse.code,
            address: warehouse.city || warehouse.address || '',
            categories: Array.from(categoryMap.values())
        }
    },
    ['warehouse-details'],
    { revalidate: 60, tags: ['inventory', 'warehouse-details'] }
)
