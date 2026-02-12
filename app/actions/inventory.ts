'use server'

import { withPrismaAuth, withRetry, prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"
import { unstable_cache, revalidateTag, revalidatePath } from "next/cache"
import { calculateProductStatus } from "@/lib/inventory-logic"
import { createProductSchema, createCategorySchema, type CreateProductInput, type CreateCategoryInput } from "@/lib/validations"
import { z } from "zod"
import { assertRole, getAuthzUser } from "@/lib/authz"

const revalidateTagSafe = (tag: string) => (revalidateTag as any)(tag, 'default')
const STOCK_OPNAME_PREFIX = "STOCK_OPNAME_REQUEST::"
const STOCK_OPNAME_APPROVER_ROLES = ["ROLE_MANAGER", "ROLE_CEO", "ROLE_DIRECTOR", "ROLE_ADMIN"]
const MANAGE_WAREHOUSE_ROLES = ["ROLE_CEO", "ROLE_DIRECTOR", "ROLE_ADMIN"]

export async function createCategory(input: CreateCategoryInput) {
    try {
        const data = createCategorySchema.parse(input)
        const category = await prisma.category.create({
            data: {
                ...data,
                // Fix: Convert empty string parentId to null for UUID column
                parentId: data.parentId === "" ? null : data.parentId,
                isActive: true
            }
        })

            // Invalidate cache global tag for categories
            ; (revalidateTag as any)('categories')
        revalidatePath('/inventory/categories')
        revalidatePath('/inventory/products')

        return { success: true, data: category }
    } catch (error) {
        if (error instanceof z.ZodError) {
            return { success: false, error: (error as any).errors[0].message }
        }
        return { success: false, error: "Failed to create category" }
    }
}

export const getAllCategories = unstable_cache(
    async () => {
        const categories = await prisma.category.findMany({
            where: { isActive: true },
            include: {
                children: true,
                _count: {
                    select: { products: true }
                }
            },
            orderBy: { name: 'asc' }
        })

        // Transform to match UI structure if needed, or just return as is
        // The UI expects a tree or we can build it on client
        return categories
    },
    ['categories-full'],
    { revalidate: 3600, tags: ['categories'] }
)

export const getCategories = unstable_cache(
    async () => {
        return await prisma.category.findMany({
            where: { isActive: true },
            select: { id: true, name: true, code: true },
            orderBy: { name: 'asc' }
        })
    },
    ['categories-list'],
    { revalidate: 3600, tags: ['categories'] }
)

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

        // Fetch details for Managers
        const managerIds = warehouses.map(w => w.managerId).filter(Boolean) as string[]
        const managers = await prisma.employee.findMany({
            where: { id: { in: managerIds } },
            select: { id: true, firstName: true, lastName: true, phone: true }
        })
        const activeWarehouseStaff = await prisma.employee.findMany({
            where: {
                status: 'ACTIVE',
                OR: [
                    { department: { contains: 'warehouse', mode: 'insensitive' } },
                    { department: { contains: 'gudang', mode: 'insensitive' } },
                    { department: { contains: 'logistik', mode: 'insensitive' } },
                    { department: { contains: 'logistics', mode: 'insensitive' } },
                    { position: { contains: 'warehouse', mode: 'insensitive' } },
                    { position: { contains: 'gudang', mode: 'insensitive' } },
                    { position: { contains: 'logistik', mode: 'insensitive' } },
                    { position: { contains: 'logistics', mode: 'insensitive' } }
                ]
            },
            select: { id: true }
        })

        // In a real app, you'd relate employees to warehouses. 
        // For now, we assume a static staff count per warehouse or fetch generally.
        // Let's just pretend we have 5-15 staff per warehouse.

        return warehouses.map(w => {
            const manager = managers.find(m => m.id === w.managerId)
            const managerName = manager ? `${manager.firstName} ${manager.lastName || ''}`.trim() : 'Unassigned'
            const managerPhone = manager?.phone || '-'

            const totalItems = w.stockLevels.reduce((sum, sl) => sum + sl.quantity, 0)
            const capacity = w.capacity || 50000 // Default if missing
            const utilization = capacity > 0 ? Math.min(Math.round((totalItems / capacity) * 100), 100) : 0

            return {
                id: w.id,
                name: w.name,
                code: w.code,
                location: [w.city, w.province].filter(Boolean).join(', ') || w.address || 'Unknown Location',
                type: 'Warehouse',
                capacity: capacity,
                utilization: utilization,
                manager: managerName,
                status: w.isActive ? 'Active' : 'Inactive',
                totalValue: 0,
                activePOs: 0,
                pendingTasks: 0,
                items: totalItems,
                staff: activeWarehouseStaff.length,
                phone: managerPhone
            }
        })
    },
    ['warehouses-list'],
    { revalidate: 300, tags: ['inventory', 'warehouses'] }
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
    { revalidate: 300, tags: ['inventory', 'kpis'] }
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
                            purchaseOrder: { status: { in: ['ORDERED', 'VENDOR_CONFIRMED', 'SHIPPED'] } }
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

            let gap = totalProjectedNeed - totalProjectedStock

            // If Manual Alert is ON, force gap to be positive to show in Alert Tab
            if (p.manualAlert && gap <= 0) {
                gap = 1 // Artificial gap to trigger visibility
            }

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
                manualAlert: p.manualAlert, // Pass to frontend for badge
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
    { revalidate: 120, tags: ['inventory', 'gap-analysis'] }
)

export const getProcurementInsights = unstable_cache(
    async () => {
        try {
            // 1. Get Active Purchase Orders (Actual Inbound Data)
            const activePOs = await prisma.purchaseOrder.findMany({
                where: {
                    status: { in: ['ORDERED', 'VENDOR_CONFIRMED', 'SHIPPED'] as any }
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

            const incomingStock = activePOs.map((po: any) => {
                const totalItems = po.items.reduce((sum: number, item: any) => sum + item.quantity, 0)
                // Mock Progress Logic
                let progress = 0
                let trackingStatus = 'Confirmed'
                if (po.status === 'SHIPPED') { progress = 60; trackingStatus = 'Shipped' }
                else if (po.status === 'ORDERED') { progress = 35; trackingStatus = 'In Production' }
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
                    items: po.items.map((i: any) => ({
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
    { revalidate: 300, tags: ['inventory', 'procurement'] }
)

export async function getProductsForKanban() {
    return withPrismaAuth(async (prisma) => {
        const products = await prisma.product.findMany({
            where: { isActive: true },
            include: {
                category: true,
                stockLevels: true
            }
        })

        return products.map(p => {
            const totalStock = p.stockLevels.reduce((sum, sl) => sum + sl.quantity, 0)

            const status = calculateProductStatus({
                totalStock,
                minStock: p.minStock,
                reorderLevel: p.reorderLevel,
                manualAlert: p.manualAlert,
                createdAt: p.createdAt
            })

            return JSON.parse(JSON.stringify({
                ...p,
                costPrice: Number(p.costPrice),
                sellingPrice: Number(p.sellingPrice),
                category: p.category,
                totalStock,
                currentStock: totalStock,
                status,
                image: '/placeholder.png'
            }))
        })
    })
}

export async function setProductManualAlert(productId: string, isAlert: boolean) {
    try {
        return await withPrismaAuth(async (prisma) => {
            await prisma.product.update({
                where: { id: productId },
                data: { manualAlert: isAlert }
            })
            revalidateTagSafe('inventory')
            return { success: true }
        })
    } catch (e) {
        console.error("Failed to set manual alert", e)
        return { success: false, error: "Database Error" }
    }
}

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
            address: warehouse.address || '',
            capacity: warehouse.capacity,
            categories: Array.from(categoryMap.values())
        }
    },
    ['warehouse-details'],
    { revalidate: 300, tags: ['inventory', 'warehouse-details'] }
)

// ==========================================
// GOODS RECEIPT ACTION
// ==========================================
export async function createWarehouse(data: { name: string, code: string, address: string, capacity: number }) {
    try {
        return await withPrismaAuth(async (prisma) => {
            await prisma.warehouse.create({
                data: {
                    name: data.name,
                    code: data.code,
                    address: data.address,
                    capacity: data.capacity
                }
            })
                // Invalidate cache global tag for warehouses
                ; (revalidateTag as any)('warehouses')
                ; (revalidateTag as any)('inventory')
            revalidatePath('/inventory/warehouses')

            return { success: true }
        })
    } catch (e: any) {
        console.error("Failed to create warehouse", e)
        return { success: false, error: e.message || "Database Error" }
    }
}

// ==========================================
// RESTOCK REQUEST ACTION
// ==========================================
export async function createRestockRequest(data: {
    productId: string
    warehouseId: string // Which warehouse is requesting (in this context, usually creates a PR for General or specific)
    quantity: number
    notes?: string
}) {
    try {
        const supabase = await createClient()
        const { data: { session } } = await supabase.auth.getSession()

        if (!session?.user) {
            throw new Error("Unauthorized: Invalid user session")
        }

        const result = await withRetry(async () => {
            return await withPrismaAuth(async (prisma) => {

                // ---------------------------------------------------------
                // RESOLVE REQUESTER (EMPLOYEE)
                // ---------------------------------------------------------
                // PurchaseRequest requires an Employee ID (Foreign Key).
                // We try to find the employee linking to this user, or fallback.

                const userEmail = session.user.email
                let employee = userEmail ? await prisma.employee.findUnique({
                    where: { email: userEmail }
                }) : null

                if (!employee) {
                    // Fallback 1: Try to find ANY employee (e.g. for dev/testing environment)
                    employee = await prisma.employee.findFirst()

                    if (!employee) {
                        // Fallback 2: Create a System Employee if none exist
                        console.log("No employees found. Creating System Admin employee.")
                        employee = await prisma.employee.create({
                            data: {
                                employeeId: `SYS-${Date.now().toString().slice(-6)}`,
                                firstName: "System",
                                lastName: "Admin",
                                email: userEmail || `admin-${Date.now()}@system.local`,
                                department: "IT",
                                position: "System Administrator",
                                joinDate: new Date(),
                                status: "ACTIVE"
                            }
                        })
                    }
                }

                if (!employee) throw new Error("Failed to resolve Requester (Employee)")

                // ---------------------------------------------------------
                // TRANSACTION LOGIC
                // ---------------------------------------------------------

                // 1. Set Product Manual Alert to True (CRITICAL)
                await prisma.product.update({
                    where: { id: data.productId },
                    data: { manualAlert: true }
                })

                // 2. Generate PR Number
                const date = new Date()
                const year = date.getFullYear()
                const month = String(date.getMonth() + 1).padStart(2, '0')
                const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
                const number = `PR-${year}${month}-${random}`

                // 3. Create Purchase Request
                // Logic: A PR requests items. We link items to product.
                // We need a requester. If system, we might need a system user or use the passed userId.

                // Verify user exists first to avoid FK error if passed blindly
                // For now assuming userId is valid from session or hardcoded system

                const pr = await prisma.purchaseRequest.create({
                    data: {
                        number,
                        requesterId: employee.id,
                        department: employee.department || "Inventory Control",
                        priority: "HIGH",
                        notes: `Auto-generated from Critical Alert. ${data.notes || ''}`,
                        status: "PENDING",
                        items: {
                            create: {
                                productId: data.productId,
                                quantity: data.quantity,
                                notes: `Target Warehouse: ${data.warehouseId}`,
                                status: "PENDING"
                            }
                        }
                    }
                })

                return { success: true, prNumber: pr.number }
            })
        })

            // Revalidate relevant paths
            ; (revalidateTag as any)('inventory')
            ; (revalidateTag as any)('procurement')
        revalidatePath('/inventory/products')
        revalidatePath('/procurement/requests')

        return result

    } catch (e: any) {
        console.error("Failed to create restock request", e)
        return { success: false, error: e.message || "Database Error" }
    }
}

export async function receiveGoodsFromPO(data: {
    poId: string,
    itemId: string,
    warehouseId: string,
    receivedQty: number
}) {
    try {
        console.log("Receiving Goods:", data)

        return await withPrismaAuth(async (prisma) => {
            // 1. Get PO Item details
            const po = await prisma.purchaseOrder.findUnique({
                where: { id: data.poId },
                include: { items: true }
            })

            if (!po) throw new Error("PO Not Found")

            const poItem = po.items.find(i => i.productId === data.itemId)
            if (!poItem) throw new Error("Item not found in this PO")

            // 2. Validate/Fetch Warehouse
            let targetWarehouseId = data.warehouseId

            // specific check if ID is reliable, otherwise fallback
            let warehouseExists = null
            if (targetWarehouseId && targetWarehouseId.length > 10) {
                try {
                    warehouseExists = await prisma.warehouse.findUnique({ where: { id: targetWarehouseId } })
                } catch {
                    // Ignore invalid UUID error
                }
            }

            if (!warehouseExists) {
                console.warn(`Warehouse ID ${targetWarehouseId} not found or invalid, falling back to default.`)
                const defaultWarehouse = await prisma.warehouse.findFirst()
                if (!defaultWarehouse) throw new Error("No warehouses found in system.")
                targetWarehouseId = defaultWarehouse.id
            }

            // A. Create Transaction Record
            await prisma.inventoryTransaction.create({
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
            const existingLevel = await prisma.stockLevel.findFirst({
                where: { productId: data.itemId, warehouseId: targetWarehouseId }
            })

            if (existingLevel) {
                await prisma.stockLevel.update({
                    where: { id: existingLevel.id },
                    data: {
                        quantity: { increment: data.receivedQty },
                        availableQty: { increment: data.receivedQty }
                    }
                })
            } else {
                await prisma.stockLevel.create({
                    data: {
                        productId: data.itemId,
                        warehouseId: targetWarehouseId,
                        quantity: data.receivedQty,
                        availableQty: data.receivedQty
                    }
                })
            }

            // C. Update PO Item
            await prisma.purchaseOrderItem.update({
                where: { id: poItem.id },
                data: { receivedQty: { increment: data.receivedQty } }
            })

            // D. Check PO Completion
            const updatedPO = await prisma.purchaseOrder.findUnique({
                where: { id: data.poId },
                include: { items: true }
            })

            if (updatedPO) {
                const allReceived = updatedPO.items.every(i => i.receivedQty >= i.quantity)
                const newStatus = allReceived ? 'RECEIVED' : 'SHIPPED'
                if (updatedPO.status !== newStatus && updatedPO.status !== 'RECEIVED') {
                    await prisma.purchaseOrder.update({
                        where: { id: data.poId },
                        data: { status: newStatus }
                    })
                }
            }

            revalidateTagSafe('inventory')
            revalidateTagSafe('procurement')

            return { success: true, message: `Successfully received ${data.receivedQty} units.` }
        }, { maxWait: 5000, timeout: 20000 })

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
        console.log("Requesting Purchase (PR):", data)

        return await withPrismaAuth(async (prisma) => {
            // 1. Check for Duplicate Pending Requests (New Schema)
            const existingItem = await prisma.purchaseRequestItem.findFirst({
                where: {
                    productId: data.itemId,
                    status: 'PENDING',
                    purchaseRequest: {
                        status: { notIn: ['REJECTED', 'CANCELLED'] }
                    }
                },
                include: { purchaseRequest: true }
            })

            if (existingItem) {
                console.warn("Duplicate PR item detected:", data.itemId)
                return {
                    success: false,
                    message: "A pending request for this item already exists.",
                    alreadyPending: true
                }
            }

            // 2. Get Default Requester (Richie or First Active)
            // In a real app, we would get this from the session.
            const requester = await prisma.employee.findFirst({
                where: { OR: [{ firstName: { contains: 'Richie', mode: 'insensitive' } }, { position: 'CEO' }] }
            })
            const activeEmployee = requester || await prisma.employee.findFirst({ where: { status: 'ACTIVE' } })

            if (!activeEmployee) throw new Error("No active employee found to assign as requester")

            // Validate UUID to prevent "found m at 1" errors
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
            if (!uuidRegex.test(activeEmployee.id)) {
                console.error("Invalid Employee UUID found:", activeEmployee.id)
                throw new Error(`Active employee has invalid UUID: ${activeEmployee.id}`)
            }

            // 3. Create Purchase Request
            const date = new Date()
            const year = date.getFullYear()
            const month = String(date.getMonth() + 1).padStart(2, '0')
            const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
            const prNumber = `PR-${year}${month}-${random}`

            const pr = await prisma.purchaseRequest.create({
                data: {
                    number: prNumber,
                    requesterId: activeEmployee.id,
                    status: 'PENDING',
                    priority: 'NORMAL',
                    notes: data.notes || "Auto-generated from Inventory Gap",
                    items: {
                        create: {
                            productId: data.itemId,
                            quantity: data.quantity,
                            status: 'PENDING'
                        }
                    }
                },
                include: { items: true } // Include items to get IDs for conversion
            })

            revalidateTagSafe('inventory')
            revalidateTagSafe('procurement')

            return {
                success: true,
                pendingTask: {
                    id: pr.id,
                    status: 'PR_CREATED',
                    type: 'PURCHASE_REQUEST'
                }
            }
        })

    } catch (error: any) {
        console.error("Error requesting purchase:", error)
        return { success: false, error: "Failed to request purchase" }
    }
}

// ==========================================
// STOCK MOVEMENT ACTIONS
// ==========================================

export const getStockMovements = unstable_cache(
    async (limit = 50) => {
        const movements = await prisma.inventoryTransaction.findMany({
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
                product: { select: { name: true, code: true, unit: true } },
                warehouse: { select: { name: true } },
                // Include relations for context
                purchaseOrder: { select: { number: true, supplier: { select: { name: true } } } },
                salesOrder: { select: { number: true, customer: { select: { name: true } } } },
                workOrder: { select: { number: true } }
            }
        })

        return movements.map(mv => ({
            id: mv.id,
            type: mv.type,
            date: mv.createdAt,
            item: mv.product.name,
            code: mv.product.code,
            qty: mv.quantity,
            unit: mv.product.unit,
            warehouse: mv.warehouse.name,
            // Determine "entity" (Supplier, Customer, or Target Warehouse) based on type
            entity: mv.purchaseOrder?.supplier.name || mv.salesOrder?.customer.name || mv.notes || '-',
            reference: mv.purchaseOrder?.number || mv.salesOrder?.number || mv.workOrder?.number || '-',
            user: mv.performedBy || 'System'
        }))
    },
    ['inventory-movements'],
    { revalidate: 120, tags: ['inventory', 'movements'] }
)

export async function createManualMovement(data: {
    type: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'TRANSFER' | 'SCRAP',
    productId: string,
    warehouseId: string,
    targetWarehouseId?: string, // Only for TRANSFER
    quantity: number,
    notes?: string,
    userId: string
}) {
    try {
        const user = await getAuthzUser()
        if (!Number.isFinite(data.quantity) || data.quantity <= 0) throw new Error("Quantity must be positive")
        if (!Number.isInteger(data.quantity)) throw new Error("Quantity must be a whole number")
        if (data.type === 'TRANSFER' && !data.targetWarehouseId) throw new Error("Target warehouse required for transfer")
        if (data.type === 'TRANSFER' && data.warehouseId === data.targetWarehouseId) throw new Error("Cannot transfer to same warehouse")

        const transactionResult = await withPrismaAuth(async (tx) => {
            // Determine DB Type & Sign
            let dbType = 'ADJUSTMENT'
            let qtyChange = 0

            if (data.type === 'ADJUSTMENT_IN') {
                dbType = 'ADJUSTMENT'
                qtyChange = data.quantity
            } else if (data.type === 'ADJUSTMENT_OUT') {
                dbType = 'ADJUSTMENT'
                qtyChange = -data.quantity
            } else if (data.type === 'SCRAP') {
                dbType = 'SCRAP'
                qtyChange = -data.quantity
            } else if (data.type === 'TRANSFER') {
                dbType = 'TRANSFER'
                qtyChange = -data.quantity // Source decreases
            }

            // Validate source availability for outbound flows
            if (qtyChange < 0) {
                const strictSource = await tx.stockLevel.findFirst({
                    where: { productId: data.productId, warehouseId: data.warehouseId }
                })

                const availableQty = strictSource?.availableQty ?? 0
                if (!strictSource || availableQty < Math.abs(qtyChange)) {
                    throw new Error(`Insufficient available stock. Requested: ${Math.abs(qtyChange)}, Available: ${availableQty}`)
                }
            }

            // 1. Create Source Transaction
            await tx.inventoryTransaction.create({
                data: {
                    productId: data.productId,
                    warehouseId: data.warehouseId,
                    type: dbType as any,
                    quantity: qtyChange,
                    notes: data.notes,
                    performedBy: user.id
                }
            })

            // 2. Update Source Stock Level
            const sourceLevel = await tx.stockLevel.findFirst({
                where: { productId: data.productId, warehouseId: data.warehouseId }
            })

            if (sourceLevel) {
                await tx.stockLevel.update({
                    where: { id: sourceLevel.id },
                    data: {
                        quantity: { increment: qtyChange },
                        availableQty: { increment: qtyChange }
                    }
                })
            } else if (qtyChange > 0) {
                await tx.stockLevel.create({
                    data: {
                        productId: data.productId,
                        warehouseId: data.warehouseId,
                        quantity: qtyChange,
                        availableQty: qtyChange
                    }
                })
            } else {
                throw new Error("Cannot deduct from empty stock")
            }

            // 3. Handle TRANSFER (Target Side)
            if (data.type === 'TRANSFER' && data.targetWarehouseId) {
                await tx.inventoryTransaction.create({
                    data: {
                        productId: data.productId,
                        warehouseId: data.targetWarehouseId,
                        type: 'TRANSFER',
                        quantity: data.quantity, // Positive at target
                        notes: `Transfer from ${data.warehouseId} | ${data.notes || ''}`,
                        performedBy: user.id
                    }
                })

                const targetLevel = await tx.stockLevel.findFirst({
                    where: { productId: data.productId, warehouseId: data.targetWarehouseId }
                })

                if (targetLevel) {
                    await tx.stockLevel.update({
                        where: { id: targetLevel.id },
                        data: {
                            quantity: { increment: data.quantity },
                            availableQty: { increment: data.quantity }
                        }
                    })
                } else {
                    await tx.stockLevel.create({
                        data: {
                            productId: data.productId,
                            warehouseId: data.targetWarehouseId,
                            quantity: data.quantity,
                            availableQty: data.quantity
                        }
                    })
                }
            }

            return { success: true }
        })
        revalidateTagSafe('inventory')
        revalidateTagSafe('movements')
        revalidatePath('/inventory/movements')
        revalidatePath('/inventory/products')
        revalidatePath('/inventory/warehouses')

        return transactionResult

    } catch (e: any) {
        console.error("Manual Movement Failed", e)
        return { success: false, error: e.message || "Failed to process movement" }
    }
}

export async function updateWarehouse(id: string, data: { name: string, code: string, address: string, capacity: number }) {
    try {
        return await withPrismaAuth(async (prisma) => {
            await prisma.warehouse.update({
                where: { id },
                data: {
                    name: data.name,
                    code: data.code,
                    address: data.address,
                    capacity: data.capacity
                }
            })
            revalidateTagSafe('inventory')
            revalidateTagSafe('warehouse-details')
            return { success: true }
        })
    } catch (e: any) {
        console.error("Failed to update warehouse", e)
        return { success: false, error: e.message || "Database Error" }
    }
}

// REAL IMPLEMENTATION
export async function submitSpotAudit(data: {
    warehouseId: string;
    productId: string;
    actualQty: number;
    auditorName: string;
    notes?: string;
}) {
    try {
        const user = await getAuthzUser()
        const { warehouseId, productId, actualQty, auditorName, notes } = data;

        return await withPrismaAuth(async (prisma) => {
            // 1. Get current system stock (Location-agnostic / Default Location)
            const existingStock = await prisma.stockLevel.findFirst({
                where: { productId, warehouseId, locationId: null }
            });

            const systemQty = existingStock?.quantity || 0;
            const discrepancy = actualQty - systemQty;

            if (discrepancy === 0) {
                return { success: true, requiresApproval: false, message: "No discrepancy detected." }
            }

            const warehouse = await prisma.warehouse.findUnique({
                where: { id: warehouseId },
                select: { id: true, name: true, managerId: true }
            })
            if (!warehouse) throw new Error("Warehouse not found")

            let approverId = warehouse.managerId || null
            if (approverId) {
                const manager = await prisma.employee.findUnique({
                    where: { id: approverId },
                    select: { id: true, status: true }
                })
                if (!manager || manager.status !== 'ACTIVE') {
                    approverId = null
                }
            }

            if (!approverId) {
                const fallbackApprover = await prisma.employee.findFirst({
                    where: {
                        status: 'ACTIVE',
                        OR: [
                            { position: { contains: 'manager', mode: 'insensitive' } },
                            { position: { contains: 'head', mode: 'insensitive' } },
                            { position: { contains: 'director', mode: 'insensitive' } },
                            { position: { contains: 'ceo', mode: 'insensitive' } },
                            { department: { contains: 'management', mode: 'insensitive' } }
                        ]
                    },
                    select: { id: true }
                })
                approverId = fallbackApprover?.id || null
            }

            if (!approverId) throw new Error("No approver (manager/boss) is configured")

            const payload = {
                warehouseId,
                productId,
                systemQty,
                actualQty,
                discrepancy,
                auditorName: auditorName || 'System',
                notes: notes || '',
                requestedBy: user.id,
                requestedAt: new Date().toISOString()
            }

            const task = await prisma.employeeTask.create({
                data: {
                    employeeId: approverId,
                    title: `Stock Opname Adjustment - ${warehouse.name}`,
                    type: 'LOGISTICS',
                    status: 'PENDING',
                    priority: Math.abs(discrepancy) >= 10 ? 'HIGH' : 'MEDIUM',
                    notes: `${STOCK_OPNAME_PREFIX}${JSON.stringify(payload)}`,
                    relatedId: warehouseId,
                }
            })

            revalidateTagSafe('inventory')
            revalidatePath('/inventory/audit')
            return { success: true, requiresApproval: true, taskId: task.id };
        })

    } catch (error) {
        console.error("Error submitting spot audit:", error);
        return { success: false, error: "Failed to submit audit" };
    }
}

export async function getRecentAudits() {
    try {
        return await withPrismaAuth(async (prisma) => {
            const transactions = await prisma.inventoryTransaction.findMany({
                where: {
                    referenceId: { startsWith: 'AUDIT-' }
                },
                take: 20,
                orderBy: { createdAt: 'desc' },
                include: {
                    product: { include: { category: true } },
                    warehouse: true
                }
            });

            return transactions.map(tx => {
                // Parse notes for System/Actual qty if available
                // Format: "Spot Audit by {name}. System: {sys}, Actual: {act}."
                let auditor = 'System';
                let systemQty = 0;
                let actualQty = 0;

                if (tx.notes) {
                    const auditorMatch = tx.notes.match(/Spot Audit by (.*?)\./);
                    if (auditorMatch) auditor = auditorMatch[1];

                    const sysMatch = tx.notes.match(/System:\s*(\d+)/);
                    if (sysMatch) systemQty = parseInt(sysMatch[1]);

                    const actMatch = tx.notes.match(/Actual:\s*(\d+)/);
                    if (actMatch) actualQty = parseInt(actMatch[1]);
                }

                return {
                    id: tx.id,
                    productName: tx.product.name,
                    warehouse: tx.warehouse.name,
                    category: tx.product.category?.name || 'Uncategorized',
                    systemQty,
                    actualQty,
                    auditor,
                    date: tx.createdAt,
                    status: (actualQty === systemQty) ? 'MATCH' : 'MISMATCH'
                };
            });
        })

    } catch (error) {
        console.error("Error fetching audits:", error);
        return [];
    }
}

export async function getPendingStockOpnameAdjustments() {
    try {
        return await withPrismaAuth(async (prisma) => {
            const tasks = await prisma.employeeTask.findMany({
                where: {
                    type: 'LOGISTICS',
                    status: 'PENDING',
                    notes: { startsWith: STOCK_OPNAME_PREFIX }
                },
                include: {
                    employee: {
                        select: { id: true, firstName: true, lastName: true, position: true }
                    }
                },
                orderBy: { createdAt: 'desc' },
                take: 50
            })

            const parsed = tasks.map((task) => {
                const raw = (task.notes || '').replace(STOCK_OPNAME_PREFIX, '')
                let payload: any = null
                try {
                    payload = JSON.parse(raw)
                } catch {
                    payload = null
                }
                return { task, payload }
            }).filter((t) => t.payload)

            if (parsed.length === 0) return []

            const warehouseIds = [...new Set(parsed.map((p) => p.payload.warehouseId))]
            const productIds = [...new Set(parsed.map((p) => p.payload.productId))]

            const [warehouses, products] = await Promise.all([
                prisma.warehouse.findMany({ where: { id: { in: warehouseIds } }, select: { id: true, name: true, code: true } }),
                prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true, code: true, unit: true } })
            ])

            const warehouseMap = new Map(warehouses.map((w) => [w.id, w]))
            const productMap = new Map(products.map((p) => [p.id, p]))

            return parsed.map(({ task, payload }) => ({
                taskId: task.id,
                title: task.title,
                createdAt: task.createdAt,
                approverName: `${task.employee.firstName} ${task.employee.lastName || ''}`.trim(),
                approverPosition: task.employee.position,
                warehouseId: payload.warehouseId,
                warehouseName: warehouseMap.get(payload.warehouseId)?.name || payload.warehouseId,
                warehouseCode: warehouseMap.get(payload.warehouseId)?.code || '-',
                productId: payload.productId,
                productName: productMap.get(payload.productId)?.name || payload.productId,
                productCode: productMap.get(payload.productId)?.code || '-',
                unit: productMap.get(payload.productId)?.unit || '-',
                systemQty: Number(payload.systemQty || 0),
                actualQty: Number(payload.actualQty || 0),
                discrepancy: Number(payload.discrepancy || 0),
                auditorName: payload.auditorName || 'System',
                notes: payload.notes || '',
                requestedBy: payload.requestedBy || '-',
                requestedAt: payload.requestedAt || task.createdAt.toISOString()
            }))
        })
    } catch (error) {
        console.error("Error fetching pending stock opname adjustments:", error)
        return []
    }
}

export async function approveStockOpnameAdjustment(taskId: string) {
    try {
        const user = await getAuthzUser()
        assertRole(user, STOCK_OPNAME_APPROVER_ROLES)

        return await withPrismaAuth(async (prisma) => {
            return await prisma.$transaction(async (tx) => {
                const task = await tx.employeeTask.findUnique({ where: { id: taskId } })
                if (!task) throw new Error("Approval task not found")
                if (task.status !== 'PENDING') throw new Error("Task already processed")
                if (!task.notes?.startsWith(STOCK_OPNAME_PREFIX)) throw new Error("Invalid stock opname task payload")

                const payload = JSON.parse(task.notes.replace(STOCK_OPNAME_PREFIX, ''))
                const warehouseId = payload.warehouseId as string
                const productId = payload.productId as string
                const actualQty = Number(payload.actualQty || 0)
                const systemQty = Number(payload.systemQty || 0)
                const discrepancy = actualQty - systemQty

                const existingStock = await tx.stockLevel.findFirst({
                    where: { productId, warehouseId, locationId: null }
                })

                if (existingStock) {
                    await tx.stockLevel.update({
                        where: { id: existingStock.id },
                        data: {
                            quantity: actualQty,
                            availableQty: Math.max(0, actualQty - existingStock.reservedQty)
                        }
                    })
                } else {
                    await tx.stockLevel.create({
                        data: {
                            productId,
                            warehouseId,
                            quantity: actualQty,
                            reservedQty: 0,
                            availableQty: actualQty,
                            locationId: null
                        }
                    })
                }

                await tx.inventoryTransaction.create({
                    data: {
                        type: 'ADJUSTMENT',
                        quantity: discrepancy,
                        productId,
                        warehouseId,
                        referenceId: `AUDIT-${Date.now()}`,
                        adjustmentId: task.id,
                        performedBy: user.id,
                        notes: `Stock opname approved by ${user.role}. Auditor: ${payload.auditorName || 'System'}. System: ${systemQty}, Actual: ${actualQty}. ${payload.notes || ''}`
                    }
                })

                await tx.employeeTask.update({
                    where: { id: task.id },
                    data: {
                        status: 'COMPLETED',
                        completedAt: new Date(),
                        notes: `${task.notes}\nAPPROVED_BY::${user.id}::${new Date().toISOString()}`
                    }
                })

                return { success: true }
            })
        })
    } catch (error: any) {
        console.error("Approve stock opname adjustment failed:", error)
        return { success: false, error: error?.message || "Failed to approve stock opname adjustment" }
    } finally {
        revalidateTagSafe('inventory')
        revalidateTagSafe('warehouse-details')
        revalidatePath('/inventory/audit')
        revalidatePath('/inventory/movements')
        revalidatePath('/inventory/warehouses')
    }
}

export async function rejectStockOpnameAdjustment(taskId: string, reason?: string) {
    try {
        const user = await getAuthzUser()
        assertRole(user, STOCK_OPNAME_APPROVER_ROLES)

        return await withPrismaAuth(async (prisma) => {
            const task = await prisma.employeeTask.findUnique({ where: { id: taskId } })
            if (!task) throw new Error("Approval task not found")
            if (task.status !== 'PENDING') throw new Error("Task already processed")
            if (!task.notes?.startsWith(STOCK_OPNAME_PREFIX)) throw new Error("Invalid stock opname task payload")

            await prisma.employeeTask.update({
                where: { id: task.id },
                data: {
                    status: 'REJECTED',
                    notes: `${task.notes}\nREJECTED_BY::${user.id}::${new Date().toISOString()}::${reason || 'No reason'}`
                }
            })

            revalidatePath('/inventory/audit')
            return { success: true }
        })
    } catch (error: any) {
        console.error("Reject stock opname adjustment failed:", error)
        return { success: false, error: error?.message || "Failed to reject stock opname adjustment" }
    }
}

export async function getWarehouseStaffing(warehouseId: string) {
    try {
        return await withPrismaAuth(async (prisma) => {
            const warehouse = await prisma.warehouse.findUnique({
                where: { id: warehouseId },
                select: { id: true, name: true, code: true, managerId: true }
            })
            if (!warehouse) throw new Error("Warehouse not found")

            const currentManager = warehouse.managerId
                ? await prisma.employee.findUnique({
                    where: { id: warehouse.managerId },
                    select: { id: true, firstName: true, lastName: true, position: true, department: true, status: true, phone: true, email: true }
                })
                : null

            const activeStaff = await prisma.employee.findMany({
                where: {
                    status: 'ACTIVE',
                    OR: [
                        { department: { contains: 'warehouse', mode: 'insensitive' } },
                        { department: { contains: 'gudang', mode: 'insensitive' } },
                        { department: { contains: 'logistik', mode: 'insensitive' } },
                        { department: { contains: 'logistics', mode: 'insensitive' } },
                        { department: { contains: 'operations', mode: 'insensitive' } },
                        { position: { contains: 'warehouse', mode: 'insensitive' } },
                        { position: { contains: 'gudang', mode: 'insensitive' } },
                        { position: { contains: 'logistik', mode: 'insensitive' } },
                        { position: { contains: 'logistics', mode: 'insensitive' } }
                    ]
                },
                orderBy: [{ department: 'asc' }, { firstName: 'asc' }],
                select: { id: true, firstName: true, lastName: true, position: true, department: true, phone: true, email: true, status: true }
            })

            const managerCandidates = await prisma.employee.findMany({
                where: {
                    status: 'ACTIVE',
                    OR: [
                        { position: { contains: 'manager', mode: 'insensitive' } },
                        { position: { contains: 'head', mode: 'insensitive' } },
                        { position: { contains: 'supervisor', mode: 'insensitive' } },
                        { department: { contains: 'operations', mode: 'insensitive' } },
                        { department: { contains: 'warehouse', mode: 'insensitive' } },
                        { department: { contains: 'logistics', mode: 'insensitive' } },
                        { department: { contains: 'logistik', mode: 'insensitive' } }
                    ]
                },
                orderBy: [{ firstName: 'asc' }],
                select: { id: true, firstName: true, lastName: true, position: true, department: true, phone: true, email: true, status: true }
            })

            return {
                warehouse: { id: warehouse.id, name: warehouse.name, code: warehouse.code },
                currentManager: currentManager ? {
                    id: currentManager.id,
                    name: `${currentManager.firstName} ${currentManager.lastName || ''}`.trim(),
                    position: currentManager.position,
                    department: currentManager.department,
                    phone: currentManager.phone || '-',
                    email: currentManager.email || '-'
                } : null,
                activeStaff: activeStaff.map((emp) => ({
                    id: emp.id,
                    name: `${emp.firstName} ${emp.lastName || ''}`.trim(),
                    position: emp.position,
                    department: emp.department,
                    phone: emp.phone || '-',
                    email: emp.email || '-',
                    status: emp.status
                })),
                managerCandidates: managerCandidates.map((emp) => ({
                    id: emp.id,
                    name: `${emp.firstName} ${emp.lastName || ''}`.trim(),
                    position: emp.position,
                    department: emp.department,
                    phone: emp.phone || '-',
                    email: emp.email || '-',
                    status: emp.status
                }))
            }
        })
    } catch (error) {
        console.error("Failed to fetch warehouse staffing:", error)
        return {
            warehouse: null,
            currentManager: null,
            activeStaff: [],
            managerCandidates: []
        }
    }
}

export async function assignWarehouseManager(warehouseId: string, managerEmployeeId: string) {
    try {
        const user = await getAuthzUser()
        assertRole(user, MANAGE_WAREHOUSE_ROLES)

        return await withPrismaAuth(async (prisma) => {
            const [warehouse, manager] = await Promise.all([
                prisma.warehouse.findUnique({ where: { id: warehouseId }, select: { id: true, name: true } }),
                prisma.employee.findUnique({ where: { id: managerEmployeeId }, select: { id: true, status: true, firstName: true, lastName: true } })
            ])

            if (!warehouse) throw new Error("Warehouse not found")
            if (!manager || manager.status !== 'ACTIVE') throw new Error("Selected manager is invalid or inactive")

            await prisma.warehouse.update({
                where: { id: warehouseId },
                data: { managerId: managerEmployeeId }
            })

            revalidateTagSafe('warehouses')
            revalidateTagSafe('inventory')
            revalidatePath('/inventory/warehouses')
            revalidatePath(`/inventory/warehouses/${warehouseId}`)
            return { success: true }
        })
    } catch (error: any) {
        console.error("Failed to assign warehouse manager:", error)
        return { success: false, error: error?.message || "Failed to assign manager" }
    }
}

export async function createProduct(input: CreateProductInput) {
    try {
        console.log("createProduct input:", input)
        const data = createProductSchema.parse(input)

        const product = await withRetry(async () => {
            return await prisma.product.create({
                data: {
                    ...data, // Spread validated data
                    // Fix: Convert empty string categoryId to null for UUID column
                    categoryId: data.categoryId === "" ? null : data.categoryId,
                    isActive: true, // Default to active
                    // Default timestamps are handled by DB
                }
            })
        })

        revalidateTagSafe('inventory')
        revalidateTagSafe('products')
        revalidatePath('/inventory/products')

        // Normalize Decimal fields to plain numbers/strings before returning to client
        const safeProduct = JSON.parse(JSON.stringify(product))

        return { success: true, data: safeProduct }
    } catch (error) {
        console.error("Failed to create product:", error)
        if (error instanceof z.ZodError) {
            return { success: false, error: error.issues[0]?.message || "Validation failed" }
        }
        // Prisma Unique Constraint Error
        if ((error as any).code === 'P2002') {
            return { success: false, error: "A product with this code already exists." }
        }
        return { success: false, error: "Failed to create product. Please try again." }
    }
}
