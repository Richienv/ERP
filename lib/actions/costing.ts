'use server'

import { prisma, withPrismaAuth } from "@/lib/db"
import { PrismaClient, CostSheetStatus, CostCategory } from "@prisma/client"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

async function requireAuth() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new Error("Unauthorized")
    return user
}

// ==============================================================================
// Types
// ==============================================================================

export interface CostSheetSummary {
    id: string
    number: string
    productId: string
    productName: string
    productCode: string
    version: number
    status: CostSheetStatus
    targetPrice: number | null
    targetMargin: number | null
    totalCost: number
    itemCount: number
    createdAt: string
}

export interface CostSheetDetail {
    id: string
    number: string
    productId: string
    productName: string
    productCode: string
    version: number
    status: CostSheetStatus
    targetPrice: number | null
    targetMargin: number | null
    totalCost: number
    items: {
        id: string
        category: string
        description: string
        quantity: number
        unitCost: number
        totalCost: number
        actualQuantity: number | null
        actualUnitCost: number | null
        actualTotalCost: number | null
    }[]
}

// ==============================================================================
// Status Transition
// ==============================================================================

const COST_SHEET_TRANSITIONS: Partial<Record<CostSheetStatus, CostSheetStatus[]>> = {
    CS_DRAFT: ['CS_FINALIZED'],
    CS_FINALIZED: ['CS_APPROVED', 'CS_DRAFT'],
}

function assertCostSheetTransition(current: CostSheetStatus, next: CostSheetStatus) {
    const allowed = COST_SHEET_TRANSITIONS[current] || []
    if (!allowed.includes(next)) {
        throw new Error(`Transisi status cost sheet tidak valid: ${current} → ${next}`)
    }
}

// Status labels/colors moved to @/lib/costing-calculations to avoid
// "use server" restriction on non-async exports.

// ==============================================================================
// Read Actions (use singleton prisma to avoid connection pool exhaustion)
// ==============================================================================

export async function getCostSheets(): Promise<CostSheetSummary[]> {
    try {
        await requireAuth()

        const sheets = await prisma.garmentCostSheet.findMany({
            include: {
                product: { select: { name: true, code: true } },
                _count: { select: { items: true } },
            },
            orderBy: { createdAt: 'desc' },
        })

        return sheets.map((s) => ({
            id: s.id,
            number: s.number,
            productId: s.productId,
            productName: s.product.name,
            productCode: s.product.code,
            version: s.version,
            status: s.status,
            targetPrice: s.targetPrice ? Number(s.targetPrice) : null,
            targetMargin: s.targetMargin ? Number(s.targetMargin) : null,
            totalCost: Number(s.totalCost),
            itemCount: s._count.items,
            createdAt: s.createdAt.toISOString(),
        }))
    } catch (error) {
        console.error("[getCostSheets] Error:", error)
        return []
    }
}

export async function getCostSheetDetail(
    sheetId: string
): Promise<CostSheetDetail | null> {
    try {
        await requireAuth()

        const sheet = await prisma.garmentCostSheet.findUnique({
            where: { id: sheetId },
            include: {
                product: { select: { name: true, code: true } },
                items: { orderBy: { category: 'asc' } },
            },
        })

        if (!sheet) return null

        return {
            id: sheet.id,
            number: sheet.number,
            productId: sheet.productId,
            productName: sheet.product.name,
            productCode: sheet.product.code,
            version: sheet.version,
            status: sheet.status,
            targetPrice: sheet.targetPrice ? Number(sheet.targetPrice) : null,
            targetMargin: sheet.targetMargin ? Number(sheet.targetMargin) : null,
            totalCost: Number(sheet.totalCost),
            items: sheet.items.map((i) => ({
                id: i.id,
                category: i.category,
                description: i.description,
                quantity: Number(i.quantity),
                unitCost: Number(i.unitCost),
                totalCost: Number(i.totalCost),
                actualQuantity: i.actualQuantity ? Number(i.actualQuantity) : null,
                actualUnitCost: i.actualUnitCost ? Number(i.actualUnitCost) : null,
                actualTotalCost: i.actualTotalCost ? Number(i.actualTotalCost) : null,
            })),
        }
    } catch (error) {
        console.error("[getCostSheetDetail] Error:", error)
        return null
    }
}

// ==============================================================================
// Write Actions (keep withPrismaAuth for transactional safety)
// ==============================================================================

function generateCSNumber(): string {
    const now = new Date()
    const y = now.getFullYear().toString().slice(-2)
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
    return `CS-${y}${m}-${rand}`
}

export async function createCostSheet(data: {
    productId: string
    targetPrice?: number
    targetMargin?: number
}): Promise<{ success: boolean; id?: string; error?: string }> {
    if (!data.productId) {
        return { success: false, error: 'Produk wajib dipilih' }
    }

    try {
        const id = await withPrismaAuth(async (prisma: PrismaClient) => {
            const existingCount = await prisma.garmentCostSheet.count({
                where: { productId: data.productId },
            })

            const sheet = await prisma.garmentCostSheet.create({
                data: {
                    number: generateCSNumber(),
                    productId: data.productId,
                    version: existingCount + 1,
                    targetPrice: data.targetPrice || null,
                    targetMargin: data.targetMargin || null,
                    status: 'CS_DRAFT',
                },
            })
            return sheet.id
        })

        revalidatePath('/costing')
        return { success: true, id }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal membuat cost sheet'
        console.error("[createCostSheet] Error:", error)
        return { success: false, error: msg }
    }
}

export async function addCostSheetItem(data: {
    costSheetId: string
    category: string
    description: string
    quantity: number
    unitCost: number
}): Promise<{ success: boolean; error?: string }> {
    const totalCost = Math.round(data.quantity * data.unitCost * 100) / 100

    try {
        await withPrismaAuth(async (prisma: PrismaClient) => {
            await prisma.costSheetItem.create({
                data: {
                    costSheetId: data.costSheetId,
                    category: data.category as CostCategory,
                    description: data.description,
                    quantity: data.quantity,
                    unitCost: data.unitCost,
                    totalCost,
                },
            })

            // Recalculate total
            const items = await prisma.costSheetItem.findMany({
                where: { costSheetId: data.costSheetId },
            })
            const newTotal = items.reduce((s, i) => s + Number(i.totalCost), 0)

            await prisma.garmentCostSheet.update({
                where: { id: data.costSheetId },
                data: { totalCost: Math.round(newTotal * 100) / 100 },
            })
        })

        revalidatePath('/costing')
        return { success: true }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal menambah item biaya'
        console.error("[addCostSheetItem] Error:", error)
        return { success: false, error: msg }
    }
}

export async function updateCostSheetItem(data: {
    itemId: string
    quantity?: number
    unitCost?: number
    actualQuantity?: number
    actualUnitCost?: number
}): Promise<{ success: boolean; error?: string }> {
    try {
        await withPrismaAuth(async (prisma: PrismaClient) => {
            const item = await prisma.costSheetItem.findUniqueOrThrow({
                where: { id: data.itemId },
            })

            const quantity = data.quantity ?? Number(item.quantity)
            const unitCost = data.unitCost ?? Number(item.unitCost)
            const totalCost = Math.round(quantity * unitCost * 100) / 100

            const actualQuantity = data.actualQuantity ?? (item.actualQuantity ? Number(item.actualQuantity) : null)
            const actualUnitCost = data.actualUnitCost ?? (item.actualUnitCost ? Number(item.actualUnitCost) : null)
            const actualTotalCost = actualQuantity != null && actualUnitCost != null
                ? Math.round(actualQuantity * actualUnitCost * 100) / 100
                : null

            await prisma.costSheetItem.update({
                where: { id: data.itemId },
                data: {
                    quantity,
                    unitCost,
                    totalCost,
                    actualQuantity,
                    actualUnitCost,
                    actualTotalCost,
                },
            })

            // Recalculate sheet total
            const items = await prisma.costSheetItem.findMany({
                where: { costSheetId: item.costSheetId },
            })
            const newTotal = items.reduce((s, i) => s + Number(i.totalCost), 0)

            await prisma.garmentCostSheet.update({
                where: { id: item.costSheetId },
                data: { totalCost: Math.round(newTotal * 100) / 100 },
            })
        })

        revalidatePath('/costing')
        return { success: true }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal memperbarui item biaya'
        console.error("[updateCostSheetItem] Error:", error)
        return { success: false, error: msg }
    }
}

export async function updateCostSheetStatus(
    sheetId: string,
    newStatus: CostSheetStatus
): Promise<{ success: boolean; error?: string }> {
    try {
        await withPrismaAuth(async (prisma: PrismaClient) => {
            const sheet = await prisma.garmentCostSheet.findUniqueOrThrow({
                where: { id: sheetId },
            })

            assertCostSheetTransition(sheet.status, newStatus)

            await prisma.garmentCostSheet.update({
                where: { id: sheetId },
                data: { status: newStatus },
            })
        })

        revalidatePath('/costing')
        return { success: true }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal mengubah status'
        console.error("[updateCostSheetStatus] Error:", error)
        return { success: false, error: msg }
    }
}

// ==============================================================================
// Dashboard (read-only — use singleton prisma)
// ==============================================================================

export interface DashboardData {
    totalDraft: number
    totalFinalized: number
    totalApproved: number
    totalSheets: number
    avgMargin: number
    totalProductionCost: number
    lowMarginSheets: { id: string; number: string; productName: string; margin: number }[]
    categoryBreakdown: { category: string; total: number; pct: number }[]
    recentSheets: CostSheetSummary[]
}

export async function getCostingDashboard(): Promise<DashboardData> {
    const empty: DashboardData = {
        totalDraft: 0, totalFinalized: 0, totalApproved: 0, totalSheets: 0,
        avgMargin: 0, totalProductionCost: 0, lowMarginSheets: [], categoryBreakdown: [], recentSheets: [],
    }
    try {
        await requireAuth()

        // Sequential to avoid pool exhaustion
        const totalDraft = await prisma.garmentCostSheet.count({ where: { status: 'CS_DRAFT' } })
        const totalFinalized = await prisma.garmentCostSheet.count({ where: { status: 'CS_FINALIZED' } })
        const totalApproved = await prisma.garmentCostSheet.count({ where: { status: 'CS_APPROVED' } })

        const recentSheets = await prisma.garmentCostSheet.findMany({
            include: {
                product: { select: { name: true, code: true } },
                _count: { select: { items: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
        })

        // Approved sheets for margin & cost analysis
        const approvedSheets = await prisma.garmentCostSheet.findMany({
            where: { status: 'CS_APPROVED' },
            include: { product: { select: { name: true } } },
        })

        let totalProductionCost = 0
        let totalMargin = 0
        let marginCount = 0
        const lowMarginSheets: DashboardData['lowMarginSheets'] = []

        for (const s of approvedSheets) {
            const cost = Number(s.totalCost)
            const price = s.targetPrice ? Number(s.targetPrice) : 0
            totalProductionCost += cost
            if (price > 0 && cost > 0) {
                const margin = Math.round(((price - cost) / price) * 100)
                totalMargin += margin
                marginCount++
                if (margin < 15) {
                    lowMarginSheets.push({
                        id: s.id, number: s.number, productName: s.product.name, margin,
                    })
                }
            }
        }

        // Category breakdown across all approved sheets
        const catItems = await prisma.costSheetItem.findMany({
            where: { costSheet: { status: 'CS_APPROVED' } },
            select: { category: true, totalCost: true },
        })
        const catMap = new Map<string, number>()
        let catTotal = 0
        for (const item of catItems) {
            const val = Number(item.totalCost)
            catMap.set(item.category, (catMap.get(item.category) ?? 0) + val)
            catTotal += val
        }
        const categoryBreakdown = Array.from(catMap.entries())
            .map(([category, total]) => ({
                category,
                total: Math.round(total),
                pct: catTotal > 0 ? Math.round((total / catTotal) * 100) : 0,
            }))
            .sort((a, b) => b.total - a.total)

        return {
            totalDraft,
            totalFinalized,
            totalApproved,
            totalSheets: totalDraft + totalFinalized + totalApproved,
            avgMargin: marginCount > 0 ? Math.round(totalMargin / marginCount) : 0,
            totalProductionCost: Math.round(totalProductionCost),
            lowMarginSheets,
            categoryBreakdown,
            recentSheets: recentSheets.map((s) => ({
                id: s.id,
                number: s.number,
                productId: s.productId,
                productName: s.product.name,
                productCode: s.product.code,
                version: s.version,
                status: s.status,
                targetPrice: s.targetPrice ? Number(s.targetPrice) : null,
                targetMargin: s.targetMargin ? Number(s.targetMargin) : null,
                totalCost: Number(s.totalCost),
                itemCount: s._count.items,
                createdAt: s.createdAt.toISOString(),
            })),
        }
    } catch (error) {
        console.error("[getCostingDashboard] Error:", error)
        return empty
    }
}

// ==============================================================================
// Products for dropdown
// ==============================================================================

export async function getProductsForCostSheet(): Promise<{ id: string; name: string; code: string }[]> {
    try {
        await requireAuth()
        return await prisma.product.findMany({
            where: { isActive: true },
            select: { id: true, code: true, name: true },
            orderBy: { name: 'asc' },
        })
    } catch (error) {
        console.error("[getProductsForCostSheet] Error:", error)
        return []
    }
}

// ==============================================================================
// BOM Import
// ==============================================================================

function resolveMaterialUnitCost(material: {
    costPrice: any
    supplierItems?: Array<{ price: any; isPreferred: boolean }>
}): number {
    const directCost = Number(material.costPrice || 0)
    if (directCost > 0) return directCost
    const preferred = material.supplierItems?.find((s) => s.isPreferred)?.price
    if (preferred != null) return Number(preferred || 0)
    const fallback = material.supplierItems?.[0]?.price
    return Number(fallback || 0)
}

export interface BOMItemForImport {
    materialId: string
    materialName: string
    materialCode: string
    category: string
    quantity: number
    unit: string
    wastePct: number
    unitCost: number
    lineCost: number
}

export async function getProductActiveBOM(productId: string): Promise<{
    bomId: string | null
    items: BOMItemForImport[]
}> {
    try {
        await requireAuth()

        const bom = await prisma.billOfMaterials.findFirst({
            where: { productId, isActive: true },
            include: {
                items: {
                    include: {
                        material: {
                            select: {
                                id: true, code: true, name: true, unit: true,
                                costPrice: true, productType: true,
                                supplierItems: {
                                    select: { price: true, isPreferred: true },
                                    orderBy: { isPreferred: 'desc' },
                                    take: 3,
                                },
                            },
                        },
                    },
                },
            },
        })

        if (!bom) return { bomId: null, items: [] }

        const items: BOMItemForImport[] = bom.items.map((item) => {
            const unitCost = resolveMaterialUnitCost(item.material)
            const qty = Number(item.quantity)
            const waste = Number(item.wastePct) / 100
            const lineCost = Math.round(qty * unitCost * (1 + waste) * 100) / 100
            const isRaw = item.material.productType === 'RAW_MATERIAL' || item.material.productType === 'WIP'
            return {
                materialId: item.material.id,
                materialName: item.material.name,
                materialCode: item.material.code,
                category: isRaw ? 'FABRIC' : 'TRIM',
                quantity: qty,
                unit: item.unit || item.material.unit,
                wastePct: Number(item.wastePct),
                unitCost,
                lineCost,
            }
        })

        return { bomId: bom.id, items }
    } catch (error) {
        console.error("[getProductActiveBOM] Error:", error)
        return { bomId: null, items: [] }
    }
}

export async function importBOMToCostSheet(
    costSheetId: string,
    items: { category: string; description: string; quantity: number; unitCost: number }[]
): Promise<{ success: boolean; itemsAdded?: number; error?: string }> {
    if (!items.length) return { success: false, error: 'Tidak ada item untuk diimpor' }

    try {
        const count = await withPrismaAuth(async (prisma: PrismaClient) => {
            const sheet = await prisma.garmentCostSheet.findUniqueOrThrow({ where: { id: costSheetId } })
            if (sheet.status !== 'CS_DRAFT') throw new Error('Hanya bisa impor ke cost sheet berstatus Draft')

            for (const item of items) {
                const totalCost = Math.round(item.quantity * item.unitCost * 100) / 100
                await prisma.costSheetItem.create({
                    data: {
                        costSheetId,
                        category: item.category as CostCategory,
                        description: item.description,
                        quantity: item.quantity,
                        unitCost: item.unitCost,
                        totalCost,
                    },
                })
            }

            // Recalculate total
            const allItems = await prisma.costSheetItem.findMany({ where: { costSheetId } })
            const newTotal = allItems.reduce((s, i) => s + Number(i.totalCost), 0)
            await prisma.garmentCostSheet.update({
                where: { id: costSheetId },
                data: { totalCost: Math.round(newTotal * 100) / 100 },
            })

            return items.length
        })

        revalidatePath('/costing')
        return { success: true, itemsAdded: count }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal mengimpor dari BOM'
        console.error("[importBOMToCostSheet] Error:", error)
        return { success: false, error: msg }
    }
}

// ==============================================================================
// Delete item
// ==============================================================================

export async function deleteCostSheetItem(itemId: string): Promise<{ success: boolean; error?: string }> {
    try {
        await withPrismaAuth(async (prisma: PrismaClient) => {
            const item = await prisma.costSheetItem.findUniqueOrThrow({ where: { id: itemId } })

            const sheet = await prisma.garmentCostSheet.findUniqueOrThrow({ where: { id: item.costSheetId } })
            if (sheet.status !== 'CS_DRAFT') throw new Error('Hanya bisa hapus item dari cost sheet berstatus Draft')

            await prisma.costSheetItem.delete({ where: { id: itemId } })

            // Recalculate total
            const remaining = await prisma.costSheetItem.findMany({ where: { costSheetId: item.costSheetId } })
            const newTotal = remaining.reduce((s, i) => s + Number(i.totalCost), 0)
            await prisma.garmentCostSheet.update({
                where: { id: item.costSheetId },
                data: { totalCost: Math.round(newTotal * 100) / 100 },
            })
        })

        revalidatePath('/costing')
        return { success: true }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal menghapus item'
        console.error("[deleteCostSheetItem] Error:", error)
        return { success: false, error: msg }
    }
}

// ==============================================================================
// Duplicate cost sheet
// ==============================================================================

export async function duplicateCostSheet(sheetId: string): Promise<{ success: boolean; newId?: string; error?: string }> {
    try {
        const newId = await withPrismaAuth(async (prisma: PrismaClient) => {
            const original = await prisma.garmentCostSheet.findUniqueOrThrow({
                where: { id: sheetId },
                include: { items: true },
            })

            const existingCount = await prisma.garmentCostSheet.count({
                where: { productId: original.productId },
            })

            const newSheet = await prisma.garmentCostSheet.create({
                data: {
                    number: generateCSNumber(),
                    productId: original.productId,
                    version: existingCount + 1,
                    status: 'CS_DRAFT',
                    targetPrice: original.targetPrice,
                    targetMargin: original.targetMargin,
                    totalCost: original.totalCost,
                },
            })

            for (const item of original.items) {
                await prisma.costSheetItem.create({
                    data: {
                        costSheetId: newSheet.id,
                        category: item.category,
                        description: item.description,
                        quantity: item.quantity,
                        unitCost: item.unitCost,
                        totalCost: item.totalCost,
                    },
                })
            }

            return newSheet.id
        })

        revalidatePath('/costing')
        return { success: true, newId }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal menduplikasi cost sheet'
        console.error("[duplicateCostSheet] Error:", error)
        return { success: false, error: msg }
    }
}
