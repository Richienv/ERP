'use server'

import { withPrismaAuth, safeQuery, withRetry, prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

import { calculateProductStatus } from "@/lib/inventory-logic"
import { approvePurchaseRequest, createPOFromPR } from "@/lib/actions/procurement"
import { postInventoryGLEntry } from "@/lib/actions/inventory-gl"
import type { InventoryGLType } from "@/lib/actions/inventory-gl"
import {
    FALLBACK_INVENTORY_KPIS,
    FALLBACK_MATERIAL_GAP,
    FALLBACK_PROCUREMENT_INSIGHTS,
    FALLBACK_WAREHOUSES
} from "@/lib/db-fallbacks"
import { createProductSchema, createCategorySchema, type CreateProductInput, type CreateCategoryInput } from "@/lib/validations"
import { generateBarcode, checkStockAvailability } from "@/lib/inventory-utils"
import { getNegativeStockPolicy } from "@/lib/inventory-settings"
import { logAudit, computeChanges } from "@/lib/audit-helpers"
import { requireRole } from "@/lib/auth/role-guard"
import { checkBulkImportSize, BULK_IMPORT_ROLES } from "@/lib/inventory-helpers"
import { z } from "zod"
import { revalidatePath } from "next/cache"

export async function getNextCategoryCode(): Promise<string> {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new Error("Unauthorized")

    const last = await prisma.category.findFirst({
        where: { code: { startsWith: 'CAT-' } },
        orderBy: { code: 'desc' },
        select: { code: true },
    })
    const lastNum = last ? parseInt(last.code.replace('CAT-', ''), 10) : 0
    const next = (isNaN(lastNum) ? 0 : lastNum) + 1
    return `CAT-${String(next).padStart(3, '0')}`
}

export async function getProductsNotInCategory(categoryId: string) {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new Error("Unauthorized")

    const products = await prisma.product.findMany({
        where: {
            isActive: true,
            OR: [
                { categoryId: null },
                { categoryId: { not: categoryId } },
            ],
        },
        select: { id: true, code: true, name: true },
        orderBy: { name: 'asc' },
        take: 100,
    })
    return products
}

export async function assignProductToCategory(productId: string, categoryId: string) {
    try {
        await requireRole(["admin", "manager"])
    } catch {
        return { success: false, error: "Akses ditolak: hanya admin atau manager yang dapat mengubah kategori produk" }
    }
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new Error("Unauthorized")

    try {
        await prisma.product.update({
            where: { id: productId },
            data: { categoryId },
        })
        revalidatePath("/inventory")
        return { success: true }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal menambahkan produk'
        return { success: false, error: msg }
    }
}

export async function removeProductFromCategory(productId: string) {
    try {
        await requireRole(["admin", "manager"])
    } catch {
        return { success: false, error: "Akses ditolak: hanya admin atau manager yang dapat mengubah kategori produk" }
    }
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new Error("Unauthorized")

    try {
        await prisma.product.update({
            where: { id: productId },
            data: { categoryId: null },
        })
        revalidatePath("/inventory")
        return { success: true }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal menghapus produk dari kategori'
        return { success: false, error: msg }
    }
}

export async function getProductsByCategory(categoryId: string) {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new Error("Unauthorized")

    const products = await prisma.product.findMany({
        where: { categoryId, isActive: true },
        select: {
            id: true,
            code: true,
            name: true,
            unit: true,
            sellingPrice: true,
            stockLevels: {
                select: { quantity: true },
            },
        },
        orderBy: { name: 'asc' },
        take: 50,
    })
    return products.map(p => ({
        id: p.id,
        code: p.code,
        name: p.name,
        unit: p.unit,
        sellingPrice: p.sellingPrice !== null ? Number(p.sellingPrice) : null,
        totalStock: p.stockLevels.reduce((sum, sl) => sum + Number(sl.quantity), 0),
    }))
}

export async function updateCategory(id: string, data: { name?: string; code?: string; description?: string }) {
    try {
        await requireRole(["admin", "manager"])
    } catch {
        return { success: false, error: "Akses ditolak: hanya admin atau manager yang dapat memperbarui kategori" }
    }
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new Error("Unauthorized")

    try {
        const updateData: any = {}
        if (data.name !== undefined) updateData.name = data.name.trim()
        if (data.code !== undefined) updateData.code = data.code.trim()
        if (data.description !== undefined) updateData.description = data.description.trim() || null

        await prisma.category.update({
            where: { id },
            data: updateData,
        })

        revalidatePath("/inventory/categories")
        return { success: true }
    } catch (error) {
        console.error("Failed to update category:", error)
        return { success: false, error: "Gagal memperbarui kategori" }
    }
}

export async function createCategory(input: CreateCategoryInput) {
    try {
        await requireRole(["admin", "manager"])
    } catch {
        return { success: false, error: "Akses ditolak: hanya admin atau manager yang dapat membuat kategori" }
    }
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new Error("Unauthorized")

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

        revalidatePath("/inventory/categories")
        return { success: true, data: category }
    } catch (error) {
        if (error instanceof z.ZodError) {
            return { success: false, error: (error as any).issues[0].message }
        }
        return { success: false, error: "Failed to create category" }
    }
}

export async function deleteCategory(categoryId: string) {
    try {
        await requireRole(["admin", "manager"])
    } catch {
        return { success: false, error: "Akses ditolak: hanya admin atau manager yang dapat menghapus kategori" }
    }
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new Error("Unauthorized")

    try {
        // Check if any active products use this category
        const productCount = await prisma.product.count({
            where: { categoryId, isActive: true },
        })
        if (productCount > 0) {
            return { success: false, error: `Kategori masih digunakan oleh ${productCount} produk aktif` }
        }

        // Check if category has child categories
        const childCount = await prisma.category.count({
            where: { parentId: categoryId },
        })
        if (childCount > 0) {
            return { success: false, error: "Kategori memiliki sub-kategori. Hapus sub-kategori terlebih dahulu." }
        }

        await prisma.category.delete({ where: { id: categoryId } })
        revalidatePath("/inventory/categories")
        return { success: true }
    } catch (error) {
        console.error("Failed to delete category:", error)
        return { success: false, error: "Gagal menghapus kategori" }
    }
}

export async function getAllCategories() {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new Error("Unauthorized")

    const categories = await prisma.category.findMany({
        where: { isActive: true },
        include: {
            children: {
                include: {
                    _count: { select: { products: true } }
                },
                where: { isActive: true }
            },
            _count: {
                select: { products: true }
            }
        },
        orderBy: { name: 'asc' }
    })

    return categories
}

export async function getCategories() {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new Error("Unauthorized")

    return await prisma.category.findMany({
        where: { isActive: true },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' }
    })
}

export async function getWarehouses() {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new Error("Unauthorized")

    const warehouses = await prisma.warehouse.findMany({
        where: { isActive: true },
        include: {
            stockLevels: {
                include: {
                    product: { select: { costPrice: true } }
                }
            },
            fabricRolls: {
                where: { status: { in: ['AVAILABLE', 'RESERVED', 'IN_USE'] } },
                select: { lengthMeters: true }
            },
            _count: {
                select: { stockLevels: true }
            }
        }
    })

    const managerIds = warehouses.map(w => w.managerId).filter(Boolean) as string[]
    const managers = await prisma.employee.findMany({
        where: { id: { in: managerIds } },
        select: { id: true, firstName: true, lastName: true, phone: true }
    })

    return warehouses.map(w => {
        const manager = managers.find(m => m.id === w.managerId)
        const managerName = manager ? `${manager.firstName} ${manager.lastName || ''}`.trim() : 'Unassigned'
        const managerPhone = manager?.phone || '-'

        const stockLevelItems = w.stockLevels.reduce((sum, sl) => sum + Number(sl.quantity), 0)
        const fabricRollMeters = w.fabricRolls.reduce((sum, fr) => sum + Math.round(Number(fr.lengthMeters)), 0)
        const totalItems = stockLevelItems + fabricRollMeters
        const capacity = w.capacity || 50000
        const utilization = capacity > 0 ? Math.min(parseFloat(((totalItems / capacity) * 100).toFixed(1)), 100) : 0

        return {
            id: w.id,
            name: w.name,
            code: w.code,
            location: [w.city, w.province].filter(Boolean).join(', ') || w.address || 'Unknown Location',
            type: 'Warehouse',
            warehouseType: w.warehouseType,
            capacity: capacity,
            utilization: utilization,
            manager: managerName,
            status: w.isActive ? 'Active' : 'Inactive',
            totalValue: Math.round(w.stockLevels.reduce((sum, sl) => sum + Number(sl.quantity) * Number(sl.product.costPrice), 0)),
            activePOs: 0,
            pendingTasks: 0,
            items: totalItems,
            staff: 0,
            phone: managerPhone
        }
    })
}

export async function getInventoryKPIs() {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new Error("Unauthorized")

    // Use the same query & status logic as the product table / kanban
    // so KPI numbers match what users see in the product list.
    // TODO(perf): KPIs are aggregations over all active products. Cap at 500 to
    // protect dashboard load time on large catalogs; revisit with DB-side
    // aggregation (groupBy / raw SQL) when SKU count exceeds this limit.
    const products = await prisma.product.findMany({
        where: { isActive: true },
        include: { stockLevels: true },
        orderBy: { createdAt: 'desc' },
        take: 500,
    })

    let lowStock = 0
    let critical = 0
    let totalValue = 0

    for (const p of products) {
        const totalStock = p.stockLevels.reduce((sum, sl) => sum + Number(sl.quantity), 0)

        // Accumulate inventory value (same formula as /api/inventory/page-data)
        totalValue += totalStock * Number(p.costPrice)

        // Use the SINGLE source-of-truth status function
        const status = calculateProductStatus({
            totalStock,
            minStock: p.minStock,
            reorderLevel: p.reorderLevel,
            manualAlert: p.manualAlert,
            createdAt: p.createdAt,
        })

        if (status === 'LOW_STOCK') lowStock++
        if (status === 'CRITICAL') critical++
    }

    // Compute inventory accuracy from real audit data
    // Audits are recorded as ADJUSTMENT transactions with "Audit" in notes
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [auditTransactions, todayTransactions] = await Promise.all([
        prisma.inventoryTransaction.count({
            where: { type: 'ADJUSTMENT', notes: { contains: 'Audit' } },
        }).then(async (totalCount) => {
            if (totalCount === 0) return { totalCount: 0, matchCount: 0 }
            // MATCH audits = adjustments with quantity 0 (no discrepancy)
            const matchCount = await prisma.inventoryTransaction.count({
                where: { type: 'ADJUSTMENT', notes: { contains: 'Audit' }, quantity: 0 },
            })
            return { totalCount, matchCount }
        }),
        // Count today's inbound and outbound transactions
        Promise.all([
            prisma.inventoryTransaction.count({
                where: { createdAt: { gte: todayStart }, quantity: { gt: 0 } },
            }),
            prisma.inventoryTransaction.count({
                where: { createdAt: { gte: todayStart }, quantity: { lt: 0 } },
            }),
        ]),
    ])

    const inventoryAccuracy = auditTransactions.totalCount > 0
        ? Math.round((auditTransactions.matchCount / auditTransactions.totalCount) * 100)
        : 100 // No discrepancies found = perfect accuracy

    return {
        totalProducts: products.length,
        lowStock: lowStock + critical, // KPI "low stock" includes both LOW_STOCK and CRITICAL
        totalValue,
        inventoryAccuracy,
        inboundToday: todayTransactions[0],
        outboundToday: todayTransactions[1],
    }
}

export async function getMaterialGapAnalysis() {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new Error("Unauthorized")

    // 1. Lean product query — only fields we need + light relations.
    // Replaces a single monster findMany with deep-nested includes (PO+supplier,
    // supplierItems, workOrders, BOMItem→bom→product→workOrders, PR items, etc.)
    // which produced hundreds of joins for 500 products.
    // TODO(perf): bounded to prevent dashboard slowdown on large catalogs.
    // Long-term: replace with DB-side aggregation (groupBy / raw SQL) to compute gaps without scanning all products.
    const products = await prisma.product.findMany({
        where: { isActive: true },
        select: {
            id: true,
            code: true,
            name: true,
            unit: true,
            costPrice: true,
            minStock: true,
            leadTime: true,
            safetyStock: true,
            manualBurnRate: true,
            manualAlert: true,
            category: { select: { id: true, name: true } },
            stockLevels: {
                select: {
                    quantity: true,
                    warehouse: { select: { id: true, name: true } },
                },
            },
            alternativeProduct: { select: { name: true, code: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 500,
    })

    const productIds = products.map(p => p.id)

    if (productIds.length === 0) {
        return []
    }

    // 2. Batched lookups, each keyed on productId / materialId. All bounded.
    // Run in parallel — Postgres handles `IN (...)` predicates with index scans,
    // which is far cheaper than the original nested-loop joins.
    const [
        poItems,
        supplierItems,
        bomItems,
        prItems,
        pendingTasks,
    ] = await Promise.all([
        // Open PO line items for these products
        prisma.purchaseOrderItem.findMany({
            where: {
                productId: { in: productIds },
                purchaseOrder: { status: { in: ['ORDERED', 'VENDOR_CONFIRMED', 'SHIPPED'] } },
            },
            select: {
                productId: true,
                quantity: true,
                receivedQty: true,
                unitPrice: true,
                purchaseOrder: {
                    select: {
                        id: true,
                        number: true,
                        expectedDate: true,
                        supplier: { select: { name: true } },
                    },
                },
            },
            orderBy: { purchaseOrder: { expectedDate: 'asc' } },
            take: 2000,
        }),
        // Preferred supplier per product
        prisma.supplierProduct.findMany({
            where: { productId: { in: productIds }, isPreferred: true },
            select: {
                productId: true,
                price: true,
                leadTime: true,
                supplier: { select: { name: true, contactName: true } },
            },
            take: 2000,
        }),
        // BOM rows where these products are used as raw materials
        prisma.bOMItem.findMany({
            where: { materialId: { in: productIds } },
            select: {
                materialId: true,
                quantity: true,
                bom: {
                    select: {
                        productId: true, // Finished good
                        product: { select: { name: true } },
                    },
                },
            },
            take: 2000,
        }),
        // Pending PR items (restock demand signal)
        prisma.purchaseRequestItem.findMany({
            where: {
                productId: { in: productIds },
                status: 'PENDING',
                purchaseRequest: { status: { in: ['PENDING', 'APPROVED'] } },
            },
            select: {
                productId: true,
                quantity: true,
                purchaseRequest: { select: { number: true, status: true } },
            },
            take: 2000,
        }),
        // Pending PR-typed employee tasks (used to mark isPendingRequest)
        prisma.employeeTask.findMany({
            where: { type: 'PURCHASE_REQUEST', status: 'PENDING' },
            select: { relatedId: true },
            // TODO(perf): bounded for safety. If >500 pending PR tasks ever exist,
            // some products will incorrectly show isPendingRequest=false. Consider DB-side join.
            orderBy: { createdAt: 'desc' },
            take: 500,
        }),
    ])

    // 3. Active work orders for the finished goods that consume these materials.
    // We can only know which finished goods to query AFTER bomItems resolves —
    // hence this is a follow-up query (still a single index scan, not a join blow-up).
    const finishedGoodIds = Array.from(new Set(bomItems.map(bi => bi.bom.productId)))
    const workOrders = finishedGoodIds.length > 0
        ? await prisma.workOrder.findMany({
            where: {
                productId: { in: finishedGoodIds },
                status: { in: ['PLANNED', 'IN_PROGRESS'] },
            },
            select: {
                id: true,
                number: true,
                productId: true,
                plannedQty: true,
                startDate: true,
            },
            take: 2000,
        })
        : []

    // 4. Group lookups by key for O(1) merge.
    const groupBy = <T>(rows: T[], keyFn: (r: T) => string | null | undefined): Record<string, T[]> => {
        const out: Record<string, T[]> = {}
        for (const row of rows) {
            const k = keyFn(row)
            if (!k) continue
            if (!out[k]) out[k] = []
            out[k].push(row)
        }
        return out
    }

    const poByProduct = groupBy(poItems, (r) => r.productId)
    const supplierByProduct = groupBy(supplierItems, (r) => r.productId)
    const bomByMaterial = groupBy(bomItems, (r) => r.materialId)
    const prByProduct = groupBy(prItems, (r) => r.productId)
    const woByFinishedGood = groupBy(workOrders, (r) => r.productId)
    const pendingSet = new Set(pendingTasks.map(t => t.relatedId))

    // 5. Merge — preserves original return shape exactly so consumers don't break.
    return products.map(p => {
        const stockLevels = p.stockLevels ?? []
        const currentStock = stockLevels.reduce((sum, sl) => sum + Number(sl.quantity), 0)

        const productPRItems = prByProduct[p.id] ?? []
        const pendingRestockQty = productPRItems.reduce((sum, pri) => sum + Number(pri.quantity), 0)

        // 1. Calculate real demand from active Work Orders via BOM
        let woDemandQty = 0
        const activeWOs: Array<{ id: string; number: string; date: Date | null; qty: number; productName: string }> = []
        const productBomRows = bomByMaterial[p.id] ?? []

        for (const bomItem of productBomRows) {
            const fgId = bomItem.bom.productId
            const fgName = bomItem.bom.product?.name ?? ''
            const fgWOs = woByFinishedGood[fgId] ?? []
            for (const wo of fgWOs) {
                const requiredForWO = Number(bomItem.quantity) * wo.plannedQty
                woDemandQty += requiredForWO
                activeWOs.push({
                    id: wo.id,
                    number: wo.number,
                    date: wo.startDate,
                    qty: requiredForWO,
                    productName: fgName,
                })
            }
        }

        // 2. Supply chain data
        const productPOItems = poByProduct[p.id] ?? []
        const incomingPO = productPOItems[0] // first by expectedDate ASC
        const incomingQty = productPOItems.reduce((sum, item) => sum + Number(item.quantity), 0)

        const preferredSupplier = (supplierByProduct[p.id] ?? [])[0]

        // 3. Planning parameters
        const leadTime = preferredSupplier?.leadTime || p.leadTime || 7
        const safetyStock = p.safetyStock || 0
        const burnRate = Number(p.manualBurnRate) || 0 // Per day
        const cost = preferredSupplier?.price ? Number(preferredSupplier.price) : Number(p.costPrice)

        // 4. Calculations
        const stockEndsInDays = burnRate > 0 ? (currentStock / burnRate) : 999

        const calculatedROP = (burnRate * leadTime) + safetyStock
        const reorderPoint = Math.max(calculatedROP, p.minStock || 0)

        const totalProjectedNeed = woDemandQty + reorderPoint
        const totalProjectedStock = currentStock // + incomingQty intentionally excluded

        let gap = totalProjectedNeed - totalProjectedStock

        if (p.manualAlert && gap <= 0) {
            gap = 1 // Artificial gap to trigger visibility
        }

        // Map all open POs for the dialog
        const openPOs = productPOItems.map(poi => {
            const orderedQty = Number(poi.quantity)
            const receivedQty = Number(poi.receivedQty || 0)
            return {
                id: poi.purchaseOrder.id,
                number: poi.purchaseOrder.number,
                supplierName: poi.purchaseOrder.supplier?.name ?? '',
                expectedDate: poi.purchaseOrder.expectedDate,
                orderedQty,
                receivedQty,
                remainingQty: orderedQty - receivedQty,
                unitPrice: Number(poi.unitPrice),
            }
        }).filter(po => po.remainingQty > 0)

        // Status logic
        let status = 'OK'
        if (gap > 0) {
            if (currentStock <= 0) status = 'OUT_OF_STOCK'
            else if (woDemandQty > currentStock) status = 'CRITICAL_WO_SHORTAGE'
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
            pendingRestockQty,
            incomingQty,
            warehouses: stockLevels.map(sl => ({
                id: sl.warehouse.id,
                name: sl.warehouse.name,
                qty: sl.quantity,
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
            manualAlert: p.manualAlert,
            demandSources: activeWOs,

            // Financials
            cost,
            totalGapCost: gap > 0 ? gap * cost : 0,

            // Procurement
            lastProcurement: incomingPO?.purchaseOrder.expectedDate || null,
            activePO: incomingPO ? {
                number: incomingPO.purchaseOrder.number,
                qty: incomingQty,
                eta: incomingPO.purchaseOrder.expectedDate,
            } : null,
            supplier: preferredSupplier ? {
                name: preferredSupplier.supplier.name,
                isPreferred: true,
            } : null,

            // Alternatives
            alternative: p.alternativeProduct ? {
                name: p.alternativeProduct.name,
                code: p.alternativeProduct.code,
            } : null,

            // Open POs for Goods Receipt
            openPOs,
        }
    })
}

export async function getProcurementInsights() {
    try {
        // Auth guard: only authenticated users may view procurement insights.
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return {
                activePOs: [],
                restockItems: [],
                summary: {
                    totalIncoming: 0,
                    totalRestockCost: 0,
                    itemsCriticalCount: 0,
                    itemsCriticalList: [],
                    totalPending: 0,
                    pendingApproval: 0,
                }
            }
        }

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
        // TODO(perf): bounded to prevent dashboard slowdown on large catalogs.
        // Long-term: replace with DB-side aggregation (groupBy / raw SQL) to compute gaps.
        const lowStockProducts = await prisma.product.findMany({
            where: { isActive: true },
            include: {
                stockLevels: true,
                purchaseOrderItems: {
                    include: { purchaseOrder: { include: { supplier: true } } },
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 500,
        })

        // Calculate Gap & Cost
        let totalRestockCost = 0
        const restockItems = lowStockProducts.map(p => {
            const totalStock = p.stockLevels.reduce((sum, sl) => sum + Number(sl.quantity), 0)
            const deficit = p.minStock - totalStock

            if (deficit > 0) {
                totalRestockCost += (deficit * Number(p.costPrice))
            }

            const po = p.purchaseOrderItems[0]?.purchaseOrder
            const deadlineDays = po?.expectedDate
                ? Math.ceil((new Date(po.expectedDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                : 0

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

        // 3. Count pending Purchase Requests (for planning visibility on dashboard)
        const pendingPRCount = await prisma.purchaseRequest.count({
            where: {
                status: { in: ['PENDING', 'APPROVED', 'DRAFT'] },
            },
        })

        return {
            activePOs: incomingStock,
            restockItems: restockItems.slice(0, 5),
            summary: {
                totalIncoming: incomingStock.length,
                totalRestockCost,
                itemsCriticalCount: restockItems.length,
                itemsCriticalList: restockItems,
                totalPending: pendingPRCount,
                pendingApproval: pendingPRCount,
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
                itemsCriticalList: [],
                totalPending: 0,
                pendingApproval: 0,
            }
        }
    }
}

export async function getProductsForKanban() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new Error("Unauthorized")

    const products = await prisma.product.findMany({
        where: { isActive: true },
        include: {
            category: true,
            stockLevels: true
        },
        orderBy: { createdAt: 'desc' },
        take: 500,
    })

    return products.map(p => {
        const totalStock = p.stockLevels.reduce((sum, sl) => sum + Number(sl.quantity), 0)

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
            sellingPrice: p.sellingPrice !== null ? Number(p.sellingPrice) : null,
            category: p.category,
            totalStock,
            currentStock: totalStock,
            status,
            image: '/placeholder.png'
        }))
    })
}

export async function setProductManualAlert(productId: string, isAlert: boolean) {
    try {
        // Auth guard: only authenticated users may flip the manual-alert flag.
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return { success: false, error: "Unauthorized" }
        }

        // Validate the product exists and capture the previous flag for audit.
        const product = await prisma.product.findUnique({
            where: { id: productId },
            select: { id: true, manualAlert: true }
        })
        if (!product) {
            return { success: false, error: "Produk tidak ditemukan" }
        }

        const result = await withPrismaAuth(async (prisma) => {
            await prisma.product.update({
                where: { id: productId },
                data: { manualAlert: isAlert }
            })
            return { success: true as const }
        })

        // Audit trail — manualAlert decides whether the product surfaces in the
        // critical-stock list, so every flip must be traceable.
        try {
            await logAudit(prisma, {
                entityType: "Product",
                entityId: productId,
                action: "UPDATE",
                userId: user.id,
                userName: user.email || undefined,
                changes: {
                    manualAlert: { from: product.manualAlert, to: isAlert }
                }
            })
        } catch { /* audit is best-effort */ }

        return result
    } catch (e) {
        console.error("Failed to set manual alert", e)
        return { success: false, error: "Database Error" }
    }
}

export async function getWarehouseDetails(id: string) {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new Error("Unauthorized")

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

        const slQty = Number(sl.quantity)
        existing.itemCount += 1
        existing.stockCount += slQty
        existing.value += slQty * Number(sl.product.costPrice)

        categoryMap.set(catId, existing)
    })

    return {
        id: warehouse.id,
        name: warehouse.name,
        code: warehouse.code,
        address: warehouse.address || '',
        capacity: warehouse.capacity,
        warehouseType: warehouse.warehouseType,
        categories: Array.from(categoryMap.values())
    }
}

// ==========================================
// GOODS RECEIPT ACTION
// ==========================================
export async function createWarehouse(data: { name: string, code: string, address: string, capacity: number, warehouseType?: string }) {
    try {
        await requireRole(["admin", "manager"])
    } catch {
        return { success: false, error: "Akses ditolak: hanya admin atau manager yang dapat membuat gudang" }
    }

    try {
        return await withPrismaAuth(async (prisma) => {
            await prisma.warehouse.create({
                data: {
                    name: data.name,
                    code: data.code,
                    address: data.address,
                    capacity: data.capacity,
                    warehouseType: (data.warehouseType as any) || 'GENERAL'
                }
            })
            revalidatePath("/inventory")
            revalidatePath("/inventory/warehouses")
            return { success: true }
        })
    } catch (e: any) {
        console.error("Failed to create warehouse", e)
        return { success: false, error: e.message || "Database Error" }
    }
}

// ==========================================
// DELETE (SOFT) WAREHOUSE
// ==========================================
export async function deleteWarehouse(warehouseId: string) {
    try {
        await requireRole(["admin", "manager"])
    } catch {
        return { success: false, error: "Akses ditolak: hanya admin atau manager yang dapat menghapus gudang" }
    }

    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return { success: false, error: "Unauthorized" }
        }

        // Check if warehouse has any stock
        const hasStock = await prisma.stockLevel.findFirst({
            where: { warehouseId, quantity: { gt: 0 } },
        })
        if (hasStock) {
            return { success: false, error: "Gudang masih memiliki stok. Pindahkan stok terlebih dahulu." }
        }

        // Check if warehouse has active fabric rolls (greige / WIP textile inventory).
        // StockLevel only tracks the aggregate quantity for non-trackable items;
        // FabricRolls are tracked individually and would be orphaned if we soft-delete.
        const activeRolls = await prisma.fabricRoll.count({
            where: {
                warehouseId,
                status: { in: ["AVAILABLE", "RESERVED", "IN_USE"] },
            },
        })
        if (activeRolls > 0) {
            return {
                success: false,
                error: `Gudang masih memiliki ${activeRolls} fabric roll aktif. Pindahkan rol ke gudang lain terlebih dahulu.`,
            }
        }

        // Check if warehouse has pending stock transfers (as source or target)
        const pendingTransfer = await prisma.stockTransfer.findFirst({
            where: {
                OR: [
                    { fromWarehouseId: warehouseId },
                    { toWarehouseId: warehouseId },
                ],
                status: { notIn: ["RECEIVED", "CANCELLED"] },
            },
        })
        if (pendingTransfer) {
            return { success: false, error: "Gudang memiliki transfer stok yang belum selesai." }
        }

        // Soft-delete: set isActive to false
        await prisma.warehouse.update({
            where: { id: warehouseId },
            data: { isActive: false },
        })

        // Audit trail
        try {
            await logAudit(prisma, {
                entityType: "Warehouse",
                entityId: warehouseId,
                action: "DELETE",
                userId: user.id,
                userName: user.email || undefined,
            })
        } catch { /* audit is best-effort */ }

        revalidatePath("/inventory")
        revalidatePath("/inventory/warehouses")
        return { success: true }
    } catch (e: any) {
        console.error("Failed to delete warehouse", e)
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
        await requireRole(["admin", "manager", "PURCHASING"])
    } catch {
        return { success: false, error: "Akses ditolak: hanya admin, manager, atau purchasing yang dapat membuat permintaan restock" }
    }

    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return { success: false, error: "Unauthorized: Invalid user session" }
        }

        const result = await withRetry(async () => {
            return await withPrismaAuth(async (prisma) => {

                // ---------------------------------------------------------
                // RESOLVE REQUESTER (EMPLOYEE)
                // ---------------------------------------------------------
                // PurchaseRequest requires an Employee ID (Foreign Key).
                // Derive the requester strictly from the auth user's email.
                // No fallback to "any employee" or "System Admin" — that would
                // attribute purchase requests to an arbitrary user and break
                // the audit trail.

                const userEmail = user.email
                const employee = userEmail
                    ? await prisma.employee.findFirst({ where: { email: userEmail } })
                    : null

                if (!employee) {
                    return { success: false, error: "Akun tidak terhubung ke data karyawan — hubungi admin" }
                }

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
        await requireRole(["admin", "manager", "WAREHOUSE"])
    } catch {
        return { success: false, error: "Akses ditolak: hanya admin, manager, atau warehouse yang dapat menerima barang dari PO" }
    }

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

            // 1b. Check if GRN flow has already received items for this PO
            // Sum accepted quantities from all ACCEPTED GRNs for this PO item
            const grnAccepted = await (prisma as any).gRNItem.aggregate({
                where: {
                    poItemId: poItem.id,
                    grn: { status: 'ACCEPTED' }
                },
                _sum: { quantityAccepted: true }
            })
            const totalGrnAccepted = Number(grnAccepted._sum?.quantityAccepted || 0)

            // Guard: total received (from GRN + this request) must not exceed ordered qty
            const totalAfterReceive = Number(poItem.receivedQty) + data.receivedQty
            if (totalAfterReceive > Number(poItem.quantity)) {
                return {
                    success: false,
                    error: "Jumlah penerimaan melebihi jumlah pesanan. Kemungkinan barang sudah diterima melalui Surat Jalan Masuk (GRN)."
                }
            }

            // Also guard against GRN-accepted quantities that haven't synced to receivedQty yet
            const effectiveReceived = Math.max(Number(poItem.receivedQty), totalGrnAccepted)
            const remainingQty = Number(poItem.quantity) - effectiveReceived
            if (data.receivedQty > remainingQty) {
                return {
                    success: false,
                    error: "Jumlah penerimaan melebihi jumlah pesanan. Kemungkinan barang sudah diterima melalui Surat Jalan Masuk (GRN)."
                }
            }

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
            const unitCost = poItem.unitPrice ? Number(poItem.unitPrice) : 0
            const totalValue = unitCost * data.receivedQty

            const invTx = await prisma.inventoryTransaction.create({
                data: {
                    productId: data.itemId,
                    warehouseId: targetWarehouseId,
                    type: 'PO_RECEIVE', // Correct enum value from schema
                    quantity: data.receivedQty,
                    unitCost: unitCost,
                    totalValue: totalValue,
                    notes: `Received from PO ${po.number}`,
                    performedBy: 'System User'
                }
            })

            // B. Update Stock Level (findFirst + create/update to avoid Prisma null-in-composite-key issue)
            const existingStock = await prisma.stockLevel.findFirst({
                where: {
                    productId: data.itemId,
                    warehouseId: targetWarehouseId,
                    locationId: null,
                }
            })

            if (existingStock) {
                await prisma.stockLevel.update({
                    where: { id: existingStock.id },
                    data: {
                        quantity: { increment: data.receivedQty },
                        availableQty: { increment: data.receivedQty },
                    }
                })
            } else {
                await prisma.stockLevel.create({
                    data: {
                        productId: data.itemId,
                        warehouseId: targetWarehouseId,
                        quantity: data.receivedQty,
                        availableQty: data.receivedQty,
                        reservedQty: 0,
                    }
                })
            }

            // B2. Post GL Journal Entry (blocking — GL failure rolls back stock changes)
            if (totalValue > 0) {
                const product = await prisma.product.findUnique({
                    where: { id: data.itemId },
                    select: { name: true },
                })
                await postInventoryGLEntry(prisma, {
                    transactionId: invTx.id,
                    type: 'PO_RECEIVE',
                    productName: product?.name || data.itemId.slice(0, 8),
                    quantity: data.receivedQty,
                    unitCost,
                    totalValue,
                    reference: po.number,
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
                const newStatus = allReceived ? 'RECEIVED' : 'PARTIAL_RECEIVED'
                if (updatedPO.status !== newStatus && updatedPO.status !== 'RECEIVED') {
                    await prisma.purchaseOrder.update({
                        where: { id: data.poId },
                        data: { status: newStatus }
                    })
                }
            }

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
        await requireRole(["admin", "manager", "PURCHASING"])
    } catch {
        return { success: false, error: "Akses ditolak: hanya admin, manager, atau purchasing yang dapat membuat permintaan pembelian" }
    }

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

export async function getStockMovements(limit = 50) {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new Error("Unauthorized")

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

    // Decimal fields (quantity, unitCost, totalValue) serialize as strings in
    // JSON; cast to Number so UI consumers can compare/format safely.
    return movements.map(mv => ({
        id: mv.id,
        productId: mv.productId,
        warehouseId: mv.warehouseId,
        type: mv.type,
        date: mv.createdAt,
        item: mv.product.name,
        code: mv.product.code,
        qty: Number(mv.quantity),
        unitCost: mv.unitCost ? Number(mv.unitCost) : null,
        totalValue: mv.totalValue ? Number(mv.totalValue) : null,
        unit: mv.product.unit,
        warehouse: mv.warehouse.name,
        // Determine "entity" (Supplier, Customer, or Target Warehouse) based on type
        entity: mv.purchaseOrder?.supplier.name || mv.salesOrder?.customer.name || mv.notes || '-',
        reference: mv.purchaseOrder?.number || mv.salesOrder?.number || mv.workOrder?.number || '-',
        user: mv.performedBy || 'System'
    }))
}

export async function createManualMovement(data: {
    type: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'TRANSFER' | 'SCRAP',
    productId: string,
    warehouseId: string,
    targetWarehouseId?: string, // Only for TRANSFER
    quantity: number,
    notes?: string,
    userId?: string, // Deprecated: ignored, user is resolved from auth context
}) {
    try {
        await requireRole(["admin", "manager", "WAREHOUSE"])
    } catch {
        return { success: false, error: "Akses ditolak: hanya admin, manager, atau warehouse yang dapat membuat pergerakan stok" }
    }

    try {
        if (data.quantity <= 0) throw new Error("Quantity must be positive")
        if (data.type === 'TRANSFER' && !data.targetWarehouseId) throw new Error("Target warehouse required for transfer")
        if (data.type === 'TRANSFER' && data.warehouseId === data.targetWarehouseId) throw new Error("Cannot transfer to same warehouse")
        // Audit trail (ISO/SOX): adjustment must have a reason. Form sends
        // "<reason> - <notes>" so >= 5 chars is the floor.
        if (!data.notes || data.notes.trim().length < 5) {
            throw new Error("Alasan penyesuaian wajib diisi (minimal 5 karakter) untuk audit trail")
        }

        // Resolve user from auth context instead of trusting client-provided userId
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) throw new Error("Unauthorized")
        const authenticatedUserId = user.id

        // Read negative-stock policy from system settings.
        // When false (default), outbound transactions that would drive stock
        // below zero are rejected. When true (pre-selling mode), they are allowed.
        const allowNegativeStock = await getNegativeStockPolicy()

        const result = await withPrismaAuth(async (tx) => {
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

            // 0. Validate Source Stock for Outbound/Transfer using the
            //    system-wide negative-stock policy (configurable in
            //    /inventory/settings). For ADJUSTMENT_OUT and TRANSFER we
            //    honor the policy; SCRAP always strictly rejects negative
            //    (you cannot scrap stock you don't have).
            if (qtyChange < 0) {
                const strictSource = await tx.stockLevel.findFirst({
                    where: { productId: data.productId, warehouseId: data.warehouseId }
                })
                const currentStock = strictSource ? Number(strictSource.quantity) : 0
                const honorPolicy = data.type === 'ADJUSTMENT_OUT' || data.type === 'TRANSFER'
                const effectiveAllowNegative = honorPolicy ? allowNegativeStock : false

                const stockCheck = checkStockAvailability(
                    currentStock,
                    Math.abs(qtyChange),
                    effectiveAllowNegative,
                )
                if (!stockCheck.allowed) {
                    throw new Error(stockCheck.message ?? `Insufficient stock in source warehouse. Available: ${currentStock}`)
                }
            }

            // Fetch product info for GL description and cost calculation
            const product = await tx.product.findUnique({
                where: { id: data.productId },
                select: { name: true, costPrice: true },
            })
            const productName = product?.name || data.productId.slice(0, 8)
            const unitCost = product?.costPrice ? Number(product.costPrice) : 0
            const totalValue = unitCost * data.quantity

            // 1. Create Source Transaction
            const invTx = await tx.inventoryTransaction.create({
                data: {
                    productId: data.productId,
                    warehouseId: data.warehouseId,
                    type: dbType as any,
                    quantity: qtyChange,
                    unitCost: unitCost > 0 ? unitCost : undefined,
                    totalValue: totalValue > 0 ? totalValue : undefined,
                    notes: data.notes,
                    performedBy: authenticatedUserId
                }
            })

            // 2. Update Source Stock Level (Atomic — no read-then-write race)
            if (qtyChange < 0) {
                // For outbound: use updateMany with a WHERE guard to prevent
                // negative stock — but only when the policy disallows it.
                // SCRAP always strictly rejects negative; ADJUSTMENT_OUT and
                // TRANSFER honor the configurable policy (already validated
                // above via checkStockAvailability).
                const honorPolicy = data.type === 'ADJUSTMENT_OUT' || data.type === 'TRANSFER'
                const effectiveAllowNegative = honorPolicy ? allowNegativeStock : false

                const updated = await tx.stockLevel.updateMany({
                    where: {
                        productId: data.productId,
                        warehouseId: data.warehouseId,
                        locationId: null,
                        ...(effectiveAllowNegative
                            ? {}
                            : { quantity: { gte: Math.abs(qtyChange) } }),
                    },
                    data: {
                        quantity: { increment: qtyChange },
                        availableQty: { increment: qtyChange },
                    },
                })
                if (updated.count === 0) {
                    // If the row didn't exist at all and negative is allowed,
                    // create it with negative quantity (pre-selling mode).
                    if (effectiveAllowNegative) {
                        await tx.stockLevel.create({
                            data: {
                                productId: data.productId,
                                warehouseId: data.warehouseId,
                                quantity: qtyChange,
                                availableQty: qtyChange,
                                reservedQty: 0,
                            }
                        })
                    } else {
                        throw new Error("Stok tidak mencukupi")
                    }
                }
            } else {
                // For inbound: findFirst + create/update (Prisma can't handle null in composite unique for upsert)
                const existingInbound = await tx.stockLevel.findFirst({
                    where: {
                        productId: data.productId,
                        warehouseId: data.warehouseId,
                        locationId: null,
                    }
                })

                if (existingInbound) {
                    await tx.stockLevel.update({
                        where: { id: existingInbound.id },
                        data: {
                            quantity: { increment: qtyChange },
                            availableQty: { increment: qtyChange },
                        }
                    })
                } else {
                    await tx.stockLevel.create({
                        data: {
                            productId: data.productId,
                            warehouseId: data.warehouseId,
                            quantity: qtyChange,
                            availableQty: qtyChange,
                            reservedQty: 0,
                        }
                    })
                }
            }

            // 3. Handle TRANSFER (Target Side)
            if (data.type === 'TRANSFER' && data.targetWarehouseId) {
                await tx.inventoryTransaction.create({
                    data: {
                        productId: data.productId,
                        warehouseId: data.targetWarehouseId,
                        type: 'TRANSFER',
                        quantity: data.quantity,
                        notes: `Transfer from ${data.warehouseId} | ${data.notes || ''}`,
                        performedBy: authenticatedUserId
                    }
                })

                // Update target warehouse stock (findFirst + create/update for null locationId)
                const existingTarget = await tx.stockLevel.findFirst({
                    where: {
                        productId: data.productId,
                        warehouseId: data.targetWarehouseId,
                        locationId: null,
                    }
                })

                if (existingTarget) {
                    await tx.stockLevel.update({
                        where: { id: existingTarget.id },
                        data: {
                            quantity: { increment: data.quantity },
                            availableQty: { increment: data.quantity },
                        }
                    })
                } else {
                    await tx.stockLevel.create({
                        data: {
                            productId: data.productId,
                            warehouseId: data.targetWarehouseId,
                            quantity: data.quantity,
                            availableQty: data.quantity,
                            reservedQty: 0,
                        }
                    })
                }
            }

            // 4. Post GL Journal Entry (skip TRANSFER — intra-entity movement)
            if (data.type !== 'TRANSFER' && totalValue > 0) {
                const glType: InventoryGLType = data.type === 'SCRAP'
                    ? 'SCRAP'
                    : data.type === 'ADJUSTMENT_IN'
                        ? 'ADJUSTMENT_IN'
                        : 'ADJUSTMENT_OUT'

                await postInventoryGLEntry(tx, {
                    transactionId: invTx.id,
                    type: glType,
                    productName,
                    quantity: data.quantity,
                    unitCost,
                    totalValue,
                    warehouseFrom: data.warehouseId,
                    warehouseTo: data.targetWarehouseId,
                    reference: data.notes,
                    transactionDate: invTx.createdAt,
                })
            }

            return { success: true }
        })

        revalidatePath("/inventory")
        revalidatePath("/inventory/stock")
        revalidatePath("/inventory/movements")
        revalidatePath("/inventory/adjustments")
        revalidatePath("/finance")

        return result
    } catch (e: any) {
        console.error("Manual Movement Failed", e)
        return { success: false, error: e.message || "Failed to process movement" }
    }
}

export async function updateWarehouse(id: string, data: { name: string, code: string, address: string, capacity: number, warehouseType?: string }) {
    try {
        await requireRole(["admin", "manager"])
    } catch {
        return { success: false, error: "Akses ditolak: hanya admin atau manager yang dapat mengubah gudang" }
    }

    try {
        return await withPrismaAuth(async (prisma) => {
            await prisma.warehouse.update({
                where: { id },
                data: {
                    name: data.name,
                    code: data.code,
                    address: data.address,
                    capacity: data.capacity,
                    ...(data.warehouseType ? { warehouseType: data.warehouseType as any } : {})
                }
            })
            revalidatePath("/inventory")
            revalidatePath("/inventory/warehouses")
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
    countedSystemQty: number; // System qty displayed when auditor began counting (snapshot)
    auditorName: string;
    notes?: string;
}) {
    try {
        await requireRole(["admin", "manager", "WAREHOUSE"])
    } catch {
        return { success: false, error: "Akses ditolak: hanya admin, manager, atau warehouse yang dapat melakukan spot audit" }
    }

    try {
        const { warehouseId, productId, actualQty, auditorName, notes } = data;

        return await withPrismaAuth(async (prisma) => {
            // 1. Get current system stock (Location-agnostic / Default Location)
            const existingStock = await prisma.stockLevel.findFirst({
                where: { productId, warehouseId, locationId: null }
            });

            const currentSystemQty = Number(existingStock?.quantity || 0);
            // Discrepancy reported by the auditor: actual on shelf vs what they were shown.
            const discrepancy = actualQty - data.countedSystemQty;

            // 2. Update Stock (Only if discrepancy exists). Use delta-increment so
            // concurrent movements during the count window are preserved (lost-update fix).
            // Upsert keyed on @@unique([productId, warehouseId, locationId]) so two
            // concurrent audits against a missing row don't race on create (P2002).
            if (discrepancy !== 0) {
                if (existingStock || discrepancy > 0) {
                    // Prisma typings require non-null on compound unique keys, but the
                    // @@unique([productId, warehouseId, locationId]) accepts NULL at the DB
                    // level (and the partial-unique migration pins it). Cast the where to
                    // satisfy TS while keeping the runtime semantics correct.
                    await prisma.stockLevel.upsert({
                        where: {
                            productId_warehouseId_locationId: {
                                productId,
                                warehouseId,
                                locationId: null,
                            },
                        } as any,
                        update: {
                            quantity: { increment: discrepancy },
                            availableQty: { increment: discrepancy },
                        },
                        create: {
                            productId,
                            warehouseId,
                            locationId: null,
                            quantity: discrepancy, // only positive when creating
                            availableQty: discrepancy,
                        },
                    });

                    // Clamp availableQty at 0 — the increment path doesn't preserve
                    // the Math.max(0, ...) floor that the absolute-set path used to apply.
                    // Inside the same transaction so it's atomic with the upsert.
                    const after = await prisma.stockLevel.findFirst({
                        where: { productId, warehouseId, locationId: null }
                    });
                    if (after && Number(after.availableQty) < 0) {
                        await prisma.stockLevel.update({
                            where: { id: after.id },
                            data: { availableQty: 0 }
                        });
                    }
                }
            }

            // Preserve `systemQty` for downstream notes/GL (semantic: what the user saw)
            const systemQty = data.countedSystemQty;

            // 3. Record Transaction (Always record audit, even if match)
            // Fetch product for GL description and cost
            const product = await prisma.product.findUnique({
                where: { id: productId },
                select: { name: true, costPrice: true },
            });
            const productName = product?.name || productId.slice(0, 8);
            const unitCost = product?.costPrice ? Number(product.costPrice) : 0;
            const absDiscrepancy = Math.abs(discrepancy);
            const totalValue = unitCost * absDiscrepancy;

            const auditTx = await prisma.inventoryTransaction.create({
                data: {
                    type: 'ADJUSTMENT', // Fixed Enum
                    quantity: discrepancy, // Signed value (+ for IN, - for OUT, 0 for MATCH)
                    productId,
                    warehouseId,
                    unitCost: unitCost > 0 ? unitCost : undefined,
                    totalValue: totalValue > 0 ? totalValue : undefined,
                    referenceId: `AUDIT-${Date.now()}`,
                    notes: `Spot Audit by ${auditorName}. Counted system: ${data.countedSystemQty}, Current system: ${currentSystemQty}, Actual: ${actualQty}. ${notes || ''}`
                }
            });

            // 4. Post GL Journal Entry (only if discrepancy != 0)
            if (discrepancy !== 0 && totalValue > 0) {
                const glType: InventoryGLType = discrepancy > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT';
                await postInventoryGLEntry(prisma, {
                    transactionId: auditTx.id,
                    type: glType,
                    productName,
                    quantity: absDiscrepancy,
                    unitCost,
                    totalValue,
                    warehouseFrom: warehouseId,
                    reference: `Spot Audit oleh ${auditorName}`,
                });
            }

            return { success: true };
        })

    } catch (error) {
        console.error("Error submitting spot audit:", error);
        return { success: false, error: "Failed to submit audit" };
    }
}

export async function getRecentAudits() {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) throw new Error("Unauthorized")

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
            // Format (new): "Spot Audit by {name}. Counted system: {csys}, Current system: {cur}, Actual: {act}."
            // Format (legacy): "Spot Audit by {name}. System: {sys}, Actual: {act}."
            let auditor = 'System';
            let systemQty = 0;
            let actualQty = 0;

            if (tx.notes) {
                const auditorMatch = tx.notes.match(/Spot Audit by (.*?)\./);
                if (auditorMatch) auditor = auditorMatch[1];

                // Prefer "Counted system" (new format); fall back to "System" (legacy format)
                const countedSysMatch = tx.notes.match(/Counted system:\s*(\d+)/i);
                const legacySysMatch = tx.notes.match(/(?<!Counted |Current )System:\s*(\d+)/i);
                if (countedSysMatch) systemQty = parseInt(countedSysMatch[1]);
                else if (legacySysMatch) systemQty = parseInt(legacySysMatch[1]);

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
                status: (actualQty === systemQty) ? 'MATCH' : 'DISCREPANCY'
            };
        });

    } catch (error) {
        console.error("Error fetching audits:", error);
        return [];
    }
}

/**
 * Generate next sequence for a structured product code prefix.
 * Prefix = "MFG-TSH-BR-BLK" → finds highest "MFG-TSH-BR-BLK-NNN" → returns NNN+1
 */
export async function generateNextSequence(prefix: string): Promise<number> {
    const existing = await prisma.product.findMany({
        where: { code: { startsWith: prefix } },
        select: { code: true },
        orderBy: { code: 'desc' },
        take: 1,
    })

    if (existing.length === 0) return 1

    const lastCode = existing[0].code
    const parts = lastCode.split('-')
    const seqPart = parts[parts.length - 1]
    const parsed = parseInt(seqPart, 10)
    return isNaN(parsed) ? 1 : parsed + 1
}

export async function createProduct(input: CreateProductInput) {
    try {
        await requireRole(["admin", "manager"])
    } catch {
        return { success: false, error: "Akses ditolak: hanya admin atau manager yang dapat membuat produk" }
    }

    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) throw new Error("Unauthorized")

        const data = createProductSchema.parse(input)

        // Build structured code from segments
        const catCode = (data as any).codeCategory || 'TRD'
        const typeCode = (data as any).codeType || 'OTR'
        const brandCode = (data as any).codeBrand || 'XX'
        const colorCode = (data as any).codeColor || 'NAT'

        const prefix = `${catCode}-${typeCode}-${brandCode}-${colorCode}`
        const seq = await generateNextSequence(prefix)
        const finalCode = `${prefix}-${seq.toString().padStart(3, '0')}`

        // Derive productType from category segment
        const typeMap: Record<string, string> = { MFG: 'MANUFACTURED', TRD: 'TRADING', RAW: 'RAW_MATERIAL', WIP: 'WIP' }
        const productType = typeMap[catCode] || 'TRADING'

        // Auto-generate barcode
        const finalBarcode = generateBarcode(finalCode)

        const product = await withRetry(async () => {
            return await prisma.product.create({
                data: {
                    code: finalCode,
                    name: data.name,
                    description: data.description || null,
                    productType: productType as any,
                    unit: data.unit,
                    costPrice: data.costPrice ?? 0,
                    sellingPrice: data.sellingPrice ?? null,
                    minStock: data.minStock ?? 0,
                    maxStock: data.maxStock ?? 0,
                    reorderLevel: data.reorderLevel ?? 0,
                    barcode: finalBarcode,
                    isActive: true,
                    // Mining-edition fields
                    serialNumber: data.serialNumber ?? null,
                    equipmentCompatibility: data.equipmentCompatibility ?? null,
                    equipmentType: data.equipmentType ?? null,
                }
            })
        })

        // Audit trail
        try {
            const sbClient = await createClient()
            const { data: { user: authUser } } = await sbClient.auth.getUser()
            if (authUser) {
                await logAudit(prisma, {
                    entityType: "Product",
                    entityId: product.id,
                    action: "CREATE",
                    userId: authUser.id,
                    userName: authUser.email || undefined,
                })
            }
        } catch { /* audit is best-effort */ }

        const safeProduct = JSON.parse(JSON.stringify(product))
        revalidatePath("/inventory")
        return { success: true, data: safeProduct }
    } catch (error) {
        console.error("Failed to create product:", error)
        if (error instanceof z.ZodError) {
            return { success: false, error: error.issues[0].message }
        }
        if ((error as any).code === 'P2002') {
            return { success: false, error: "Kode produk sudah digunakan. Coba lagi." }
        }
        return { success: false, error: "Gagal membuat produk. Silakan coba lagi." }
    }
}

// ===============================================================================
// PRODUCT MOVEMENTS (per product), UPDATE, DELETE
// ===============================================================================

/** Get stock movement history for a specific product */
export async function getProductMovements(productId: string) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) throw new Error("Unauthorized")

        const movements = await prisma.inventoryTransaction.findMany({
            where: { productId },
            take: 50,
            orderBy: { createdAt: 'desc' },
            include: {
                warehouse: { select: { id: true, name: true } },
                purchaseOrder: { select: { number: true, supplier: { select: { name: true } } } },
                salesOrder: { select: { number: true, customer: { select: { name: true } } } },
                workOrder: { select: { number: true } },
            }
        })

        // Decimal fields serialize as strings in JSON; cast to Number so UI
        // consumers (product-quick-view) can compare qty < 0 / qty > 0 safely.
        return movements.map(mv => ({
            id: mv.id,
            type: mv.type as string,
            date: mv.createdAt.toISOString(),
            qty: Number(mv.quantity),
            unitCost: mv.unitCost ? Number(mv.unitCost) : null,
            totalValue: mv.totalValue ? Number(mv.totalValue) : null,
            warehouseId: mv.warehouse.id,
            warehouseName: mv.warehouse.name,
            referenceId: mv.referenceId || undefined,
            reference: mv.purchaseOrder?.number || mv.salesOrder?.number || mv.workOrder?.number || mv.referenceId || undefined,
            entity: mv.purchaseOrder?.supplier.name || mv.salesOrder?.customer.name || undefined,
            notes: mv.notes || undefined,
            performedBy: mv.performedBy || 'System',
        }))
    } catch (error) {
        console.error("Failed to fetch product movements:", error)
        return []
    }
}

/** Get full product detail by ID */
export async function getProductById(productId: string) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) throw new Error("Unauthorized")

        const product = await prisma.product.findUnique({
            where: { id: productId },
            include: {
                category: { select: { id: true, name: true, code: true } },
                stockLevels: {
                    include: { warehouse: { select: { id: true, name: true } } }
                },
            }
        })
        if (!product) return null

        return {
            id: product.id,
            code: product.code,
            name: product.name,
            description: product.description,
            unit: product.unit,
            categoryId: product.categoryId,
            categoryName: product.category?.name || null,
            costPrice: product.costPrice?.toNumber() || 0,
            sellingPrice: product.sellingPrice !== null ? product.sellingPrice.toNumber() : null,
            minStock: product.minStock,
            maxStock: product.maxStock,
            reorderLevel: product.reorderLevel,
            barcode: product.barcode,
            isActive: product.isActive,
            manualAlert: product.manualAlert,
            stockLevels: product.stockLevels.map(sl => ({
                warehouseId: sl.warehouse.id,
                warehouseName: sl.warehouse.name,
                quantity: sl.quantity,
            })),
            totalStock: product.stockLevels.reduce((sum, sl) => sum + Number(sl.quantity), 0),
        }
    } catch (error) {
        console.error("Failed to fetch product by ID:", error)
        return null
    }
}

/** Update an existing product */
export async function updateProduct(productId: string, data: {
    name?: string
    description?: string
    unit?: string
    costPrice?: number
    sellingPrice?: number | null
    minStock?: number
    maxStock?: number
    reorderLevel?: number
    barcode?: string
    serialNumber?: string | null
    equipmentCompatibility?: string | null
    equipmentType?: string | null
}) {
    try {
        await requireRole(["admin", "manager"])
    } catch {
        return { success: false, error: "Akses ditolak: hanya admin atau manager yang dapat mengubah produk" }
    }

    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) throw new Error("Unauthorized")

        const updateData: any = {}
        if (data.name !== undefined) updateData.name = data.name
        if (data.description !== undefined) updateData.description = data.description
        if (data.unit !== undefined) updateData.unit = data.unit
        if (data.costPrice !== undefined) updateData.costPrice = data.costPrice
        if (data.sellingPrice !== undefined) updateData.sellingPrice = data.sellingPrice
        if (data.minStock !== undefined) updateData.minStock = data.minStock
        if (data.maxStock !== undefined) updateData.maxStock = data.maxStock
        if (data.reorderLevel !== undefined) updateData.reorderLevel = data.reorderLevel
        if (data.barcode !== undefined) updateData.barcode = data.barcode || null
        // Mining-edition fields
        if (data.serialNumber !== undefined) updateData.serialNumber = data.serialNumber || null
        if (data.equipmentCompatibility !== undefined) updateData.equipmentCompatibility = data.equipmentCompatibility || null
        if (data.equipmentType !== undefined) updateData.equipmentType = data.equipmentType || null

        // Fetch old values for audit diff
        const oldProduct = await prisma.product.findUnique({
            where: { id: productId },
            select: { name: true, description: true, unit: true, costPrice: true, sellingPrice: true, minStock: true, maxStock: true, reorderLevel: true, barcode: true },
        })

        await prisma.product.update({
            where: { id: productId },
            data: updateData,
        })

        // Audit trail
        try {
            const sbClient = await createClient()
            const { data: { user: authUser } } = await sbClient.auth.getUser()
            if (authUser && oldProduct) {
                const changes = computeChanges(
                    oldProduct as unknown as Record<string, unknown>,
                    updateData as Record<string, unknown>
                )
                await logAudit(prisma, {
                    entityType: "Product",
                    entityId: productId,
                    action: "UPDATE",
                    userId: authUser.id,
                    userName: authUser.email || undefined,
                    changes: Object.keys(changes).length > 0 ? changes : undefined,
                })
            }
        } catch { /* audit is best-effort */ }

        revalidatePath("/inventory")
        return { success: true }
    } catch (error) {
        console.error("Failed to update product:", error)
        return { success: false, error: "Gagal memperbarui produk" }
    }
}

/** Soft-delete a product (set isActive = false).
 *
 * Checks every FK relation that references Product before allowing the
 * delete. If any active reference exists, the product is left untouched
 * (no soft-delete) and a Bahasa Indonesia error is returned. Otherwise
 * the product is soft-deleted via `isActive = false` to preserve audit
 * trails (transactions, inspections) without orphaning data. */
export async function deleteProduct(productId: string) {
    try {
        await requireRole(["admin", "manager"])
    } catch {
        return { success: false, error: "Akses ditolak: hanya admin atau manager yang dapat menghapus produk" }
    }

    try {
        // Auth check
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) throw new Error("Unauthorized")

        // Check if product is used as material in any active BOM
        const activeBomUsage = await prisma.bOMItem.findFirst({
            where: {
                materialId: productId,
                bom: { isActive: true },
            },
            include: { bom: { select: { product: { select: { name: true } }, version: true } } },
        })
        if (activeBomUsage) {
            const bomProduct = activeBomUsage.bom.product.name
            const bomVersion = activeBomUsage.bom.version
            return {
                success: false,
                error: `Tidak dapat menghapus produk karena masih digunakan sebagai material di BOM "${bomProduct}" (${bomVersion})`,
            }
        }

        // Check ALL BOMItem links (including inactive BOM versions) — would orphan a BOMItem row
        const anyBomItem = await prisma.bOMItem.findFirst({
            where: { materialId: productId },
            select: { id: true },
        })
        if (anyBomItem) {
            return {
                success: false,
                error: "Tidak dapat menghapus produk: masih direferensikan oleh BOMItem (termasuk versi BOM lama)",
            }
        }

        // Check if product is the output of any BOM (BillOfMaterials.productId)
        const bomAsProduct = await prisma.billOfMaterials.findFirst({
            where: { productId },
            select: { version: true },
        })
        if (bomAsProduct) {
            return {
                success: false,
                error: `Tidak dapat menghapus produk: masih memiliki BOM (${bomAsProduct.version})`,
            }
        }

        // Check Work Orders referencing this product
        const workOrder = await prisma.workOrder.findFirst({
            where: { productId },
            select: { number: true },
        })
        if (workOrder) {
            return {
                success: false,
                error: `Tidak dapat menghapus produk: masih ada Work Order (${workOrder.number})`,
            }
        }

        // Check Quotation Items
        const quotationItem = await prisma.quotationItem.findFirst({
            where: { productId },
            include: { quotation: { select: { number: true } } },
        })
        if (quotationItem) {
            return {
                success: false,
                error: `Tidak dapat menghapus produk: masih terdapat di Quotation (${quotationItem.quotation.number})`,
            }
        }

        // Check if product has items in active Sales Orders
        const activeSalesOrderItem = await prisma.salesOrderItem.findFirst({
            where: {
                productId,
                salesOrder: {
                    status: { notIn: ["COMPLETED", "CANCELLED", "DELIVERED"] },
                },
            },
            include: { salesOrder: { select: { number: true } } },
        })
        if (activeSalesOrderItem) {
            return {
                success: false,
                error: `Tidak dapat menghapus produk karena masih terdapat di Sales Order aktif (${activeSalesOrderItem.salesOrder.number})`,
            }
        }

        // Check if product has items in active Purchase Orders
        const activePurchaseOrderItem = await prisma.purchaseOrderItem.findFirst({
            where: {
                productId,
                purchaseOrder: {
                    status: { notIn: ["COMPLETED", "CANCELLED", "REJECTED"] },
                },
            },
            include: { purchaseOrder: { select: { number: true } } },
        })
        if (activePurchaseOrderItem) {
            return {
                success: false,
                error: `Tidak dapat menghapus produk karena masih terdapat di Purchase Order aktif (${activePurchaseOrderItem.purchaseOrder.number})`,
            }
        }

        // Check Inventory Transactions (audit trail) — block to preserve history
        const transaction = await prisma.inventoryTransaction.findFirst({
            where: { productId },
            select: { id: true },
        })
        if (transaction) {
            return {
                success: false,
                error: "Tidak dapat menghapus produk: masih ada riwayat pergerakan stok (audit trail). Nonaktifkan produk dari halaman edit jika ingin disembunyikan.",
            }
        }

        // Check Quality Inspections (audit trail) — relation field is `materialId`
        const inspection = await prisma.qualityInspection.findFirst({
            where: { materialId: productId },
            select: { id: true },
        })
        if (inspection) {
            return {
                success: false,
                error: "Tidak dapat menghapus produk: masih ada riwayat inspeksi kualitas",
            }
        }

        // Check Price List Items — would orphan a price tier
        const priceListItem = await prisma.priceListItem.findFirst({
            where: { productId },
            include: { priceList: { select: { name: true } } },
        })
        if (priceListItem) {
            return {
                success: false,
                error: `Tidak dapat menghapus produk: masih terdapat di Price List "${priceListItem.priceList.name}"`,
            }
        }

        // Check if product has stock
        const stockLevels = await prisma.stockLevel.findMany({
            where: { productId },
            select: { quantity: true }
        })
        const totalStock = stockLevels.reduce((sum, sl) => sum + Number(sl.quantity), 0)
        if (totalStock > 0) {
            return { success: false, error: "Tidak dapat menghapus produk yang masih memiliki stok" }
        }

        // Check active StockReservation — material masih dipesan oleh WO
        const activeReservation = await prisma.stockReservation.findFirst({
            where: {
                productId,
                status: "ACTIVE",
                reservedQty: { gt: 0 },
            },
            include: { workOrder: { select: { number: true } } },
        })
        if (activeReservation) {
            return {
                success: false,
                error: `Tidak dapat menghapus produk: masih ada reservasi aktif untuk WO ${activeReservation.workOrder.number}`,
            }
        }

        // Check active FabricRoll — fabric stok yang masih trackable
        const activeRoll = await prisma.fabricRoll.findFirst({
            where: {
                productId,
                status: { in: ["AVAILABLE", "RESERVED", "IN_USE"] },
            },
            select: { rollNumber: true },
        })
        if (activeRoll) {
            return {
                success: false,
                error: `Tidak dapat menghapus produk: masih ada fabric roll aktif (${activeRoll.rollNumber})`,
            }
        }

        await prisma.product.update({
            where: { id: productId },
            data: { isActive: false },
        })

        // Audit trail
        try {
            await logAudit(prisma, {
                entityType: "Product",
                entityId: productId,
                action: "DELETE",
                userId: user.id,
                userName: user.email || undefined,
            })
        } catch { /* audit is best-effort */ }

        revalidatePath("/inventory")
        return { success: true }
    } catch (error) {
        console.error("Failed to delete product:", error)
        return { success: false, error: "Gagal menghapus produk" }
    }
}

// ==========================================
// WAREHOUSE STAFFING
// ==========================================

export async function getWarehouseStaffing(warehouseId: string) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) throw new Error("Unauthorized")

        const warehouse = await prisma.warehouse.findUnique({
            where: { id: warehouseId },
            select: {
                id: true,
                managerId: true,
            }
        })

        if (!warehouse) {
            return {
                currentManager: null,
                managerCandidates: [],
                activeStaff: []
            }
        }

        // Get all users as potential manager candidates
        const users = await prisma.user.findMany({
            where: { isActive: true },
            select: { id: true, name: true },
            take: 50
        })

        const candidates = users.map(u => ({
            id: u.id,
            name: u.name || 'Unnamed',
            position: 'Staff'
        }))

        const currentManager = warehouse.managerId
            ? candidates.find(c => c.id === warehouse.managerId) || null
            : null

        return {
            currentManager,
            managerCandidates: candidates,
            activeStaff: candidates.slice(0, 10).map(c => ({
                ...c,
                department: 'Gudang',
                status: 'active' as const
            }))
        }
    } catch (error) {
        console.error("Failed to get warehouse staffing:", error)
        return {
            currentManager: null,
            managerCandidates: [],
            activeStaff: []
        }
    }
}

export async function assignWarehouseManager(warehouseId: string, managerId: string) {
    try {
        // Role guard: only admin/manager/WAREHOUSE roles may reassign a warehouse manager.
        const user = await requireRole(["admin", "manager", "WAREHOUSE"])

        // Validate the warehouse exists and capture the previous manager for audit.
        const warehouse = await prisma.warehouse.findUnique({
            where: { id: warehouseId },
            select: { id: true, managerId: true }
        })
        if (!warehouse) {
            return { success: false, error: "Gudang tidak ditemukan" }
        }

        // Validate the managerId points to a real Employee — prevent planting arbitrary UUIDs.
        const manager = await prisma.employee.findUnique({
            where: { id: managerId },
            select: { id: true }
        })
        if (!manager) {
            return { success: false, error: "Manajer tidak ditemukan" }
        }

        await withPrismaAuth(async (prisma) => {
            await prisma.warehouse.update({
                where: { id: warehouseId },
                data: { managerId }
            })
        })

        // Audit trail
        try {
            await logAudit(prisma, {
                entityType: "Warehouse",
                entityId: warehouseId,
                action: "UPDATE",
                userId: user.id,
                userName: user.email || undefined,
                changes: {
                    managerId: { from: warehouse.managerId, to: managerId }
                }
            })
        } catch { /* audit is best-effort */ }

        return { success: true }
    } catch (error: any) {
        console.error("Failed to assign warehouse manager:", error)
        if (typeof error?.message === "string" && error.message.startsWith("Forbidden")) {
            return { success: false, error: "Akses ditolak" }
        }
        if (typeof error?.message === "string" && error.message.startsWith("Unauthorized")) {
            return { success: false, error: "Belum login" }
        }
        return { success: false, error: "Gagal assign manager gudang" }
    }
}

// ==========================================
// BULK IMPORT PRODUCTS ACTION
// ==========================================

export interface BulkImportProductRow {
    name: string
    code?: string
    categoryName?: string
    unit?: string
    costPrice?: number
    sellingPrice?: number
    description?: string
}

export async function bulkImportProducts(rows: BulkImportProductRow[]): Promise<{
    success: boolean
    imported: number
    errors: string[]
}> {
    // Role guard: only inventory-relevant roles can mass-import.
    await requireRole([...BULK_IMPORT_ROLES])

    // Row cap to prevent self-DOS / mass GL flooding.
    const sizeCheck = checkBulkImportSize(rows)
    if (!sizeCheck.ok) {
        return {
            success: false,
            imported: 0,
            errors: [sizeCheck.error],
        }
    }

    const errors: string[] = []
    let imported = 0

    try {
        // Pre-fetch last product codes to generate sequences without conflicts
        // We'll batch the sequence lookups up front for each prefix we'll need
        const prefixCounts = new Map<string, number>()

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i]
            const rowNum = i + 2 // 1-indexed, row 1 is header

            if (!row.name || !row.name.trim()) {
                errors.push(`Baris ${rowNum}: Nama Produk wajib diisi`)
                continue
            }

            try {
                // Build code or auto-generate
                let finalCode: string
                if (row.code && row.code.trim()) {
                    // Check for duplicate code
                    const existing = await prisma.product.findFirst({ where: { code: row.code.trim() } })
                    if (existing) {
                        errors.push(`Baris ${rowNum}: Kode "${row.code.trim()}" sudah digunakan`)
                        continue
                    }
                    finalCode = row.code.trim()
                } else {
                    // Auto-generate: use TRD-OTR-XX-NAT prefix pattern
                    const prefix = 'TRD-OTR-XX-NAT'
                    const currentCount = prefixCounts.get(prefix) ?? 0

                    // Get DB sequence only once per prefix
                    if (currentCount === 0) {
                        const seq = await generateNextSequence(prefix)
                        prefixCounts.set(prefix, seq)
                        finalCode = `${prefix}-${seq.toString().padStart(3, '0')}`
                        prefixCounts.set(prefix, seq + 1)
                    } else {
                        finalCode = `${prefix}-${currentCount.toString().padStart(3, '0')}`
                        prefixCounts.set(prefix, currentCount + 1)
                    }
                }

                // Generate barcode
                const barcode = generateBarcode(finalCode)

                // Resolve unit
                const unit = (row.unit ?? '').trim() || 'PCS'

                await prisma.product.create({
                    data: {
                        code: finalCode,
                        name: row.name.trim(),
                        description: row.description?.trim() || null,
                        productType: 'TRADING',
                        unit,
                        costPrice: row.costPrice ?? 0,
                        sellingPrice: row.sellingPrice ?? null,
                        minStock: 0,
                        maxStock: 0,
                        reorderLevel: 0,
                        barcode,
                        isActive: true,
                    },
                })

                imported++
            } catch (rowErr: any) {
                const msg = rowErr?.message || 'Unknown error'
                errors.push(`Baris ${rowNum} (${row.name}): ${msg}`)
            }
        }

        return { success: true, imported, errors }
    } catch (err: any) {
        console.error('bulkImportProducts fatal error:', err)
        return { success: false, imported, errors: [...errors, `Fatal: ${err.message}`] }
    }
}

// ─── Bulk Import Movements ──────────────────────────────────────────────────

export interface BulkImportMovementRow {
    productCode: string
    warehouseName: string
    type: string          // ADJUSTMENT_IN | ADJUSTMENT_OUT | TRANSFER | SCRAP
    quantity: number
    targetWarehouseName?: string  // Only for TRANSFER
    notes?: string
}

const VALID_MOVEMENT_TYPES = new Set(['ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'TRANSFER', 'SCRAP'])

export async function bulkImportMovements(rows: BulkImportMovementRow[]): Promise<{
    success: boolean
    imported: number
    errors: string[]
}> {
    // Role guard: only inventory-relevant roles can mass-import.
    await requireRole([...BULK_IMPORT_ROLES])

    // Row cap to prevent self-DOS / mass GL flooding.
    const sizeCheck = checkBulkImportSize(rows)
    if (!sizeCheck.ok) {
        return {
            success: false,
            imported: 0,
            errors: [sizeCheck.error],
        }
    }

    const errors: string[] = []
    let imported = 0

    try {
        // Pre-fetch products and warehouses for lookup
        const allProducts = await prisma.product.findMany({
            where: { isActive: true },
            select: { id: true, code: true, name: true },
        })
        const productByCode = new Map(allProducts.map(p => [p.code.toLowerCase().trim(), p]))

        const allWarehouses = await prisma.warehouse.findMany({
            where: { isActive: true },
            select: { id: true, name: true },
        })
        const warehouseByName = new Map(allWarehouses.map(w => [w.name.toLowerCase().trim(), w]))

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i]
            const rowNum = i + 2 // 1-indexed, row 1 is header

            try {
                // Validate type
                const type = (row.type ?? '').trim().toUpperCase()
                if (!VALID_MOVEMENT_TYPES.has(type)) {
                    errors.push(`Baris ${rowNum}: Tipe "${row.type}" tidak valid. Gunakan: ADJUSTMENT_IN, ADJUSTMENT_OUT, TRANSFER, atau SCRAP`)
                    continue
                }

                // Validate quantity
                const qty = Number(row.quantity)
                if (!qty || qty <= 0) {
                    errors.push(`Baris ${rowNum}: Jumlah harus lebih dari 0`)
                    continue
                }

                // Resolve product
                const productKey = (row.productCode ?? '').toLowerCase().trim()
                const product = productByCode.get(productKey)
                if (!product) {
                    errors.push(`Baris ${rowNum}: Produk "${row.productCode}" tidak ditemukan`)
                    continue
                }

                // Resolve warehouse
                const warehouseKey = (row.warehouseName ?? '').toLowerCase().trim()
                const warehouse = warehouseByName.get(warehouseKey)
                if (!warehouse) {
                    errors.push(`Baris ${rowNum}: Gudang "${row.warehouseName}" tidak ditemukan`)
                    continue
                }

                // Resolve target warehouse for TRANSFER
                let targetWarehouseId: string | undefined
                if (type === 'TRANSFER') {
                    const targetKey = (row.targetWarehouseName ?? '').toLowerCase().trim()
                    const targetWarehouse = warehouseByName.get(targetKey)
                    if (!targetWarehouse) {
                        errors.push(`Baris ${rowNum}: Gudang tujuan "${row.targetWarehouseName}" tidak ditemukan`)
                        continue
                    }
                    if (targetWarehouse.id === warehouse.id) {
                        errors.push(`Baris ${rowNum}: Gudang asal dan tujuan tidak boleh sama`)
                        continue
                    }
                    targetWarehouseId = targetWarehouse.id
                }

                // Execute the movement using existing action
                const result = await createManualMovement({
                    type: type as any,
                    productId: product.id,
                    warehouseId: warehouse.id,
                    targetWarehouseId,
                    quantity: qty,
                    notes: row.notes?.trim() || `Bulk import baris ${rowNum}`,
                    userId: 'system-user',
                })

                if (result.success) {
                    imported++
                } else {
                    const errMsg = 'error' in result ? String(result.error) : 'Gagal'
                    errors.push(`Baris ${rowNum} (${row.productCode}): ${errMsg}`)
                }
            } catch (rowErr: any) {
                const msg = rowErr?.message || 'Unknown error'
                errors.push(`Baris ${rowNum} (${row.productCode}): ${msg}`)
            }
        }

        return { success: true, imported, errors }
    } catch (err: any) {
        console.error('bulkImportMovements fatal error:', err)
        return { success: false, imported, errors: [...errors, `Fatal: ${err.message}`] }
    }
}

// ================================
// Warehouse Location CRUD
// ================================

export async function getWarehouseLocations(warehouseId: string) {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new Error("Unauthorized")

    const locations = await prisma.location.findMany({
        where: { warehouseId, isActive: true },
        orderBy: { code: 'asc' },
        include: {
            _count: { select: { stockLevels: true } },
        },
    })

    return locations.map(loc => ({
        id: loc.id,
        code: loc.code,
        name: loc.name,
        rack: loc.rack,
        bin: loc.bin,
        aisle: loc.aisle,
        capacity: loc.capacity,
        stockLevelCount: loc._count.stockLevels,
        createdAt: loc.createdAt,
    }))
}

export async function createWarehouseLocation(data: {
    warehouseId: string
    code: string
    name: string
    rack?: string
    bin?: string
    aisle?: string
    capacity?: number
}) {
    try {
        await requireRole(["admin", "manager"])
    } catch {
        return { success: false, error: "Akses ditolak: hanya admin atau manager yang dapat membuat lokasi gudang" }
    }

    try {
        const location = await prisma.location.create({
            data: {
                warehouseId: data.warehouseId,
                code: data.code,
                name: data.name,
                rack: data.rack || null,
                bin: data.bin || null,
                aisle: data.aisle || null,
                capacity: data.capacity || null,
            },
        })
        return { success: true, location }
    } catch (error: any) {
        if (error.code === 'P2002') {
            return { success: false, error: 'Kode lokasi sudah digunakan di gudang ini' }
        }
        return { success: false, error: error.message || 'Gagal membuat lokasi' }
    }
}

export async function updateWarehouseLocation(id: string, data: {
    code?: string
    name?: string
    rack?: string
    bin?: string
    aisle?: string
    capacity?: number
}) {
    try {
        await requireRole(["admin", "manager"])
    } catch {
        return { success: false, error: "Akses ditolak: hanya admin atau manager yang dapat mengubah lokasi gudang" }
    }

    try {
        await prisma.location.update({
            where: { id },
            data: {
                ...(data.code !== undefined && { code: data.code }),
                ...(data.name !== undefined && { name: data.name }),
                ...(data.rack !== undefined && { rack: data.rack || null }),
                ...(data.bin !== undefined && { bin: data.bin || null }),
                ...(data.aisle !== undefined && { aisle: data.aisle || null }),
                ...(data.capacity !== undefined && { capacity: data.capacity || null }),
            },
        })
        return { success: true }
    } catch (error: any) {
        if (error.code === 'P2002') {
            return { success: false, error: 'Kode lokasi sudah digunakan di gudang ini' }
        }
        return { success: false, error: error.message || 'Gagal mengubah lokasi' }
    }
}

export async function deleteWarehouseLocation(id: string) {
    try {
        await requireRole(["admin", "manager"])
    } catch {
        return { success: false, error: "Akses ditolak: hanya admin atau manager yang dapat menghapus lokasi gudang" }
    }

    // Check if any stock levels reference this location
    const stockCount = await prisma.stockLevel.count({ where: { locationId: id } })
    if (stockCount > 0) {
        return { success: false, error: `Lokasi masih memiliki ${stockCount} stok. Pindahkan stok terlebih dahulu.` }
    }

    try {
        await prisma.location.update({
            where: { id },
            data: { isActive: false },
        })
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message || 'Gagal menghapus lokasi' }
    }
}
