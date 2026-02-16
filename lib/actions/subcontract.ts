'use server'

import { prisma, withPrismaAuth } from "@/lib/db"
import { PrismaClient, SubcontractOrderStatus, SubcontractShipmentDirection } from "@prisma/client"
import { createClient } from "@/lib/supabase/server"
import { assertSubcontractTransition } from "@/lib/subcontract-state-machine"
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

export interface SubcontractorSummary {
    id: string
    name: string
    npwp: string | null
    address: string | null
    capabilities: string[]
    capacityUnitsPerDay: number | null
    contactPerson: string | null
    phone: string | null
    email: string | null
    isActive: boolean
    activeOrderCount: number
    rateCount: number
}

export interface SubcontractOrderSummary {
    id: string
    number: string
    subcontractorName: string
    operation: string
    status: SubcontractOrderStatus
    issuedDate: string
    expectedReturnDate: string | null
    workOrderNumber: string | null
    itemCount: number
    totalIssuedQty: number
    totalReturnedQty: number
}

export interface SubcontractOrderDetail {
    id: string
    number: string
    subcontractorId: string
    subcontractorName: string
    operation: string
    status: SubcontractOrderStatus
    issuedDate: string
    expectedReturnDate: string | null
    workOrderId: string | null
    workOrderNumber: string | null
    estimatedCost: number | null
    items: {
        id: string
        productId: string
        productName: string
        productCode: string
        issuedQty: number
        returnedQty: number
        defectQty: number
        wastageQty: number
    }[]
    shipments: {
        id: string
        direction: SubcontractShipmentDirection
        date: string
        deliveryNoteNumber: string | null
        items: unknown
    }[]
}

export interface SubcontractorRateData {
    id: string
    operation: string
    productType: string | null
    ratePerUnit: number
    validFrom: string
    validTo: string | null
}

export interface SubcontractorDetailData {
    id: string
    name: string
    npwp: string | null
    address: string | null
    capabilities: string[]
    capacityUnitsPerDay: number | null
    contactPerson: string | null
    phone: string | null
    email: string | null
    isActive: boolean
    rates: SubcontractorRateData[]
    activeOrders: SubcontractOrderSummary[]
    completedOrders: SubcontractOrderSummary[]
    performance: {
        totalOrders: number
        completedOrders: number
        onTimePercent: number
        defectRatePercent: number
        avgTurnaroundDays: number
    }
}

export interface WarehouseOption {
    id: string
    name: string
    code: string
}

export interface DashboardData {
    totalActive: number
    totalSubcontractors: number
    overdueCount: number
    totalCostThisMonth: number
    yieldRate: number
    onTimeDeliveryPercent: number
    statusDistribution: { status: string; count: number }[]
    materialAtVendor: { subcontractorName: string; productName: string; qty: number }[]
    overdueOrders: SubcontractOrderSummary[]
    recentOrders: SubcontractOrderSummary[]
}

// ==============================================================================
// Warehouses (read-only)
// ==============================================================================

export async function getWarehousesForSubcontract(): Promise<WarehouseOption[]> {
    try {
        await requireAuth()
        const warehouses = await prisma.warehouse.findMany({
            where: { isActive: true },
            select: { id: true, name: true, code: true },
            orderBy: { name: 'asc' },
        })
        return warehouses
    } catch (error) {
        console.error("[getWarehousesForSubcontract] Error:", error)
        return []
    }
}

// ==============================================================================
// Subcontractor Registry (read-only — use singleton prisma)
// ==============================================================================

export async function getSubcontractors(): Promise<SubcontractorSummary[]> {
    try {
        await requireAuth()

        const subs = await prisma.subcontractor.findMany({
            orderBy: { name: 'asc' },
            include: {
                _count: {
                    select: {
                        rates: true,
                        orders: {
                            where: {
                                status: {
                                    in: [
                                        'SC_SENT',
                                        'SC_IN_PROGRESS',
                                        'SC_PARTIAL_COMPLETE',
                                    ],
                                },
                            },
                        },
                    },
                },
            },
        })

        return subs.map((s) => ({
            id: s.id,
            name: s.name,
            npwp: s.npwp,
            address: s.address,
            capabilities: s.capabilities,
            capacityUnitsPerDay: s.capacityUnitsPerDay,
            contactPerson: s.contactPerson,
            phone: s.phone,
            email: s.email,
            isActive: s.isActive,
            activeOrderCount: s._count.orders,
            rateCount: s._count.rates,
        }))
    } catch (error) {
        console.error("[getSubcontractors] Error:", error)
        return []
    }
}

export async function getSubcontractorDetail(
    subcontractorId: string
): Promise<SubcontractorDetailData | null> {
    try {
        await requireAuth()

        const sub = await prisma.subcontractor.findUnique({
            where: { id: subcontractorId },
            include: {
                rates: {
                    orderBy: [{ operation: 'asc' }, { validFrom: 'desc' }],
                },
                orders: {
                    include: {
                        subcontractor: { select: { name: true } },
                        workOrder: { select: { id: true } },
                        items: {
                            select: {
                                issuedQty: true,
                                returnedQty: true,
                                defectQty: true,
                                wastageQty: true,
                            },
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                },
            },
        })

        if (!sub) return null

        const activeStatuses: SubcontractOrderStatus[] = ['SC_DRAFT', 'SC_SENT', 'SC_IN_PROGRESS', 'SC_PARTIAL_COMPLETE']
        const activeOrders = sub.orders.filter((o) => activeStatuses.includes(o.status))
        const completedOrders = sub.orders.filter((o) => o.status === 'SC_COMPLETED')

        // Performance metrics from completed orders
        const now = new Date()
        let onTimeCount = 0
        let totalIssuedAll = 0
        let totalDefectAll = 0
        let totalTurnaroundDays = 0

        for (const o of completedOrders) {
            if (o.expectedReturnDate && o.updatedAt <= o.expectedReturnDate) {
                onTimeCount++
            }
            for (const item of o.items) {
                totalIssuedAll += item.issuedQty
                totalDefectAll += item.defectQty
            }
            const turnaround = (o.updatedAt.getTime() - o.issuedDate.getTime()) / (1000 * 60 * 60 * 24)
            totalTurnaroundDays += turnaround
        }

        const mapOrder = (o: typeof sub.orders[number]): SubcontractOrderSummary => ({
            id: o.id,
            number: o.number,
            subcontractorName: sub.name,
            operation: o.operation,
            status: o.status,
            issuedDate: o.issuedDate.toISOString(),
            expectedReturnDate: o.expectedReturnDate?.toISOString() || null,
            workOrderNumber: o.workOrder?.id || null,
            itemCount: o.items.length,
            totalIssuedQty: o.items.reduce((s, i) => s + i.issuedQty, 0),
            totalReturnedQty: o.items.reduce((s, i) => s + i.returnedQty, 0),
        })

        return {
            id: sub.id,
            name: sub.name,
            npwp: sub.npwp,
            address: sub.address,
            capabilities: sub.capabilities,
            capacityUnitsPerDay: sub.capacityUnitsPerDay,
            contactPerson: sub.contactPerson,
            phone: sub.phone,
            email: sub.email,
            isActive: sub.isActive,
            rates: sub.rates.map((r) => ({
                id: r.id,
                operation: r.operation,
                productType: r.productType,
                ratePerUnit: Number(r.ratePerUnit),
                validFrom: r.validFrom.toISOString(),
                validTo: r.validTo?.toISOString() || null,
            })),
            activeOrders: activeOrders.map(mapOrder),
            completedOrders: completedOrders.slice(0, 20).map(mapOrder),
            performance: {
                totalOrders: sub.orders.length,
                completedOrders: completedOrders.length,
                onTimePercent: completedOrders.length > 0
                    ? Math.round((onTimeCount / completedOrders.length) * 100)
                    : 0,
                defectRatePercent: totalIssuedAll > 0
                    ? Math.round((totalDefectAll / totalIssuedAll) * 10000) / 100
                    : 0,
                avgTurnaroundDays: completedOrders.length > 0
                    ? Math.round(totalTurnaroundDays / completedOrders.length)
                    : 0,
            },
        }
    } catch (error) {
        console.error("[getSubcontractorDetail] Error:", error)
        return null
    }
}

// ==============================================================================
// Write Actions (keep withPrismaAuth for transactional safety)
// ==============================================================================

export async function createSubcontractor(data: {
    name: string
    npwp?: string
    address?: string
    capabilities: string[]
    capacityUnitsPerDay?: number
    contactPerson?: string
    phone?: string
    email?: string
}): Promise<{ success: boolean; id?: string; error?: string }> {
    if (!data.name.trim()) {
        return { success: false, error: 'Nama subkontraktor wajib diisi' }
    }

    try {
        const id = await withPrismaAuth(async (prisma: PrismaClient) => {
            const sub = await prisma.subcontractor.create({
                data: {
                    name: data.name.trim(),
                    npwp: data.npwp?.trim() || null,
                    address: data.address?.trim() || null,
                    capabilities: data.capabilities as never[],
                    capacityUnitsPerDay: data.capacityUnitsPerDay || null,
                    contactPerson: data.contactPerson?.trim() || null,
                    phone: data.phone?.trim() || null,
                    email: data.email?.trim() || null,
                },
            })
            return sub.id
        })

        revalidatePath('/subcontract')
        return { success: true, id }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal membuat subkontraktor'
        console.error("[createSubcontractor] Error:", error)
        return { success: false, error: msg }
    }
}

export async function updateSubcontractor(
    id: string,
    data: {
        name?: string
        npwp?: string
        address?: string
        capabilities?: string[]
        capacityUnitsPerDay?: number | null
        contactPerson?: string
        phone?: string
        email?: string
        isActive?: boolean
    }
): Promise<{ success: boolean; error?: string }> {
    try {
        await withPrismaAuth(async (prisma: PrismaClient) => {
            await prisma.subcontractor.update({
                where: { id },
                data: {
                    ...(data.name !== undefined && { name: data.name.trim() }),
                    ...(data.npwp !== undefined && { npwp: data.npwp.trim() || null }),
                    ...(data.address !== undefined && { address: data.address.trim() || null }),
                    ...(data.capabilities !== undefined && { capabilities: data.capabilities as never[] }),
                    ...(data.capacityUnitsPerDay !== undefined && { capacityUnitsPerDay: data.capacityUnitsPerDay }),
                    ...(data.contactPerson !== undefined && { contactPerson: data.contactPerson.trim() || null }),
                    ...(data.phone !== undefined && { phone: data.phone.trim() || null }),
                    ...(data.email !== undefined && { email: data.email.trim() || null }),
                    ...(data.isActive !== undefined && { isActive: data.isActive }),
                },
            })
        })

        revalidatePath('/subcontract')
        return { success: true }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal mengubah data subkontraktor'
        console.error("[updateSubcontractor] Error:", error)
        return { success: false, error: msg }
    }
}

// ==============================================================================
// Subcontractor Rates (read-only — use singleton prisma)
// ==============================================================================

export async function getSubcontractorRates(
    subcontractorId: string
): Promise<SubcontractorRateData[]> {
    try {
        await requireAuth()

        const rates = await prisma.subcontractorRate.findMany({
            where: { subcontractorId },
            orderBy: [{ operation: 'asc' }, { validFrom: 'desc' }],
        })

        return rates.map((r) => ({
            id: r.id,
            operation: r.operation,
            productType: r.productType,
            ratePerUnit: Number(r.ratePerUnit),
            validFrom: r.validFrom.toISOString(),
            validTo: r.validTo?.toISOString() || null,
        }))
    } catch (error) {
        console.error("[getSubcontractorRates] Error:", error)
        return []
    }
}

export async function upsertSubcontractorRate(data: {
    id?: string
    subcontractorId: string
    operation: string
    productType?: string
    ratePerUnit: number
    validFrom: string
    validTo?: string
}): Promise<{ success: boolean; error?: string }> {
    try {
        await withPrismaAuth(async (prisma: PrismaClient) => {
            if (data.id) {
                await prisma.subcontractorRate.update({
                    where: { id: data.id },
                    data: {
                        operation: data.operation,
                        productType: data.productType || null,
                        ratePerUnit: data.ratePerUnit,
                        validFrom: new Date(data.validFrom),
                        validTo: data.validTo ? new Date(data.validTo) : null,
                    },
                })
            } else {
                await prisma.subcontractorRate.create({
                    data: {
                        subcontractorId: data.subcontractorId,
                        operation: data.operation,
                        productType: data.productType || null,
                        ratePerUnit: data.ratePerUnit,
                        validFrom: new Date(data.validFrom),
                        validTo: data.validTo ? new Date(data.validTo) : null,
                    },
                })
            }
        })

        revalidatePath('/subcontract')
        return { success: true }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal menyimpan tarif'
        console.error("[upsertSubcontractorRate] Error:", error)
        return { success: false, error: msg }
    }
}

export async function deleteSubcontractorRate(
    rateId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        await withPrismaAuth(async (prisma: PrismaClient) => {
            await prisma.subcontractorRate.delete({
                where: { id: rateId },
            })
        })

        revalidatePath('/subcontract')
        return { success: true }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal menghapus tarif'
        console.error("[deleteSubcontractorRate] Error:", error)
        return { success: false, error: msg }
    }
}

// ==============================================================================
// Subcontract Orders (read-only — use singleton prisma)
// ==============================================================================

export async function getSubcontractOrders(filters?: {
    status?: SubcontractOrderStatus
    subcontractorId?: string
    search?: string
}): Promise<SubcontractOrderSummary[]> {
    try {
        await requireAuth()

        const orders = await prisma.subcontractOrder.findMany({
            where: {
                ...(filters?.status && { status: filters.status }),
                ...(filters?.subcontractorId && { subcontractorId: filters.subcontractorId }),
                ...(filters?.search && {
                    OR: [
                        { number: { contains: filters.search, mode: 'insensitive' as const } },
                        { subcontractor: { name: { contains: filters.search, mode: 'insensitive' as const } } },
                    ],
                }),
            },
            include: {
                subcontractor: { select: { name: true } },
                workOrder: { select: { id: true } },
                items: {
                    select: { issuedQty: true, returnedQty: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        })

        return orders.map((o) => ({
            id: o.id,
            number: o.number,
            subcontractorName: o.subcontractor.name,
            operation: o.operation,
            status: o.status,
            issuedDate: o.issuedDate.toISOString(),
            expectedReturnDate: o.expectedReturnDate?.toISOString() || null,
            workOrderNumber: o.workOrder ? o.workOrder.id : null,
            itemCount: o.items.length,
            totalIssuedQty: o.items.reduce((s, i) => s + i.issuedQty, 0),
            totalReturnedQty: o.items.reduce((s, i) => s + i.returnedQty, 0),
        }))
    } catch (error) {
        console.error("[getSubcontractOrders] Error:", error)
        return []
    }
}

export async function getSubcontractOrderDetail(
    orderId: string
): Promise<SubcontractOrderDetail | null> {
    try {
        await requireAuth()

        const order = await prisma.subcontractOrder.findUnique({
            where: { id: orderId },
            include: {
                subcontractor: { select: { name: true } },
                workOrder: { select: { id: true } },
                items: {
                    include: {
                        product: { select: { name: true, code: true } },
                    },
                },
                shipments: {
                    orderBy: { date: 'desc' },
                },
            },
        })

        if (!order) return null

        // Calculate estimated cost from rates
        let estimatedCost: number | null = null
        try {
            const rate = await prisma.subcontractorRate.findFirst({
                where: {
                    subcontractorId: order.subcontractorId,
                    operation: order.operation,
                    validFrom: { lte: order.issuedDate },
                    OR: [
                        { validTo: null },
                        { validTo: { gte: order.issuedDate } },
                    ],
                },
                orderBy: { validFrom: 'desc' },
            })

            if (rate) {
                const totalQty = order.items.reduce((s, i) => s + i.issuedQty, 0)
                estimatedCost = totalQty * Number(rate.ratePerUnit)
            }
        } catch {
            // Cost calculation is non-critical
        }

        return {
            id: order.id,
            number: order.number,
            subcontractorId: order.subcontractorId,
            subcontractorName: order.subcontractor.name,
            operation: order.operation,
            status: order.status,
            issuedDate: order.issuedDate.toISOString(),
            expectedReturnDate: order.expectedReturnDate?.toISOString() || null,
            workOrderId: order.workOrderId,
            workOrderNumber: order.workOrder?.id || null,
            estimatedCost,
            items: order.items.map((i) => ({
                id: i.id,
                productId: i.productId,
                productName: i.product.name,
                productCode: i.product.code,
                issuedQty: i.issuedQty,
                returnedQty: i.returnedQty,
                defectQty: i.defectQty,
                wastageQty: i.wastageQty,
            })),
            shipments: order.shipments.map((s) => ({
                id: s.id,
                direction: s.direction,
                date: s.date.toISOString(),
                deliveryNoteNumber: s.deliveryNoteNumber,
                items: s.items,
            })),
        }
    } catch (error) {
        console.error("[getSubcontractOrderDetail] Error:", error)
        return null
    }
}

function generateSCNumber(): string {
    const now = new Date()
    const y = now.getFullYear().toString().slice(-2)
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
    return `SC-${y}${m}-${rand}`
}

export async function createSubcontractOrder(data: {
    subcontractorId: string
    operation: string
    workOrderId?: string
    expectedReturnDate?: string
    items: { productId: string; issuedQty: number }[]
}): Promise<{ success: boolean; id?: string; error?: string }> {
    if (!data.subcontractorId) {
        return { success: false, error: 'Subkontraktor wajib dipilih' }
    }
    if (data.items.length === 0) {
        return { success: false, error: 'Minimal 1 item diperlukan' }
    }

    try {
        const id = await withPrismaAuth(async (prisma: PrismaClient) => {
            const order = await prisma.subcontractOrder.create({
                data: {
                    number: generateSCNumber(),
                    subcontractorId: data.subcontractorId,
                    operation: data.operation,
                    workOrderId: data.workOrderId || null,
                    expectedReturnDate: data.expectedReturnDate
                        ? new Date(data.expectedReturnDate)
                        : null,
                    status: 'SC_DRAFT',
                    items: {
                        create: data.items.map((item) => ({
                            productId: item.productId,
                            issuedQty: item.issuedQty,
                        })),
                    },
                },
            })
            return order.id
        })

        revalidatePath('/subcontract')
        return { success: true, id }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal membuat order subkontrak'
        console.error("[createSubcontractOrder] Error:", error)
        return { success: false, error: msg }
    }
}

export async function updateSubcontractOrderStatus(
    orderId: string,
    newStatus: SubcontractOrderStatus
): Promise<{ success: boolean; error?: string }> {
    try {
        await withPrismaAuth(async (prisma: PrismaClient) => {
            const order = await prisma.subcontractOrder.findUniqueOrThrow({
                where: { id: orderId },
            })

            assertSubcontractTransition(order.status, newStatus)

            await prisma.subcontractOrder.update({
                where: { id: orderId },
                data: { status: newStatus },
            })
        })

        revalidatePath('/subcontract')
        return { success: true }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal mengubah status'
        console.error("[updateSubcontractOrderStatus] Error:", error)
        return { success: false, error: msg }
    }
}

// ==============================================================================
// Shipments with Inventory Integration (write — keep withPrismaAuth)
// ==============================================================================

export async function recordShipment(data: {
    orderId: string
    direction: 'OUTBOUND' | 'INBOUND'
    warehouseId: string
    deliveryNoteNumber?: string
    items: { productId: string; quantity: number; defectQty?: number; wastageQty?: number }[]
}): Promise<{ success: boolean; error?: string }> {
    if (!data.warehouseId) {
        return { success: false, error: 'Gudang wajib dipilih' }
    }
    if (data.items.length === 0) {
        return { success: false, error: 'Minimal 1 item diperlukan' }
    }

    try {
        const user = await requireAuth()

        await withPrismaAuth(async (prisma: PrismaClient) => {
            return await (prisma as any).$transaction(async (tx: any) => {
                // 1. Fetch the order for reference
                const order = await tx.subcontractOrder.findUniqueOrThrow({
                    where: { id: data.orderId },
                    include: { subcontractor: { select: { name: true } } },
                })

                // 2. Process each item
                for (const item of data.items) {
                    if (item.quantity <= 0) continue

                    if (data.direction === 'OUTBOUND') {
                        // Validate stock availability
                        const stockLevel = await tx.stockLevel.findUnique({
                            where: {
                                productId_warehouseId_locationId: {
                                    productId: item.productId,
                                    warehouseId: data.warehouseId,
                                    locationId: null as any,
                                },
                            },
                        })

                        if (!stockLevel || stockLevel.availableQty < item.quantity) {
                            const product = await tx.product.findUnique({
                                where: { id: item.productId },
                                select: { name: true },
                            })
                            throw new Error(
                                `Stok tidak mencukupi untuk ${product?.name || item.productId}. ` +
                                `Tersedia: ${stockLevel?.availableQty || 0}, Dibutuhkan: ${item.quantity}`
                            )
                        }

                        // Create SUBCONTRACT_OUT inventory transaction
                        await tx.inventoryTransaction.create({
                            data: {
                                productId: item.productId,
                                warehouseId: data.warehouseId,
                                type: 'SUBCONTRACT_OUT',
                                quantity: -item.quantity,
                                referenceId: order.number,
                                workOrderId: order.workOrderId,
                                performedBy: user.id,
                                notes: `Subkontrak keluar ke ${order.subcontractor.name} - ${order.number}`,
                            },
                        })

                        // Decrement stock
                        await tx.stockLevel.update({
                            where: {
                                productId_warehouseId_locationId: {
                                    productId: item.productId,
                                    warehouseId: data.warehouseId,
                                    locationId: null as any,
                                },
                            },
                            data: {
                                quantity: { decrement: item.quantity },
                                availableQty: { decrement: item.quantity },
                            },
                        })
                    } else {
                        // INBOUND: receive materials back from CMT
                        const goodQty = item.quantity
                        const defect = item.defectQty || 0
                        const wastage = item.wastageQty || 0

                        // Create SUBCONTRACT_IN inventory transaction (only good qty goes to stock)
                        await tx.inventoryTransaction.create({
                            data: {
                                productId: item.productId,
                                warehouseId: data.warehouseId,
                                type: 'SUBCONTRACT_IN',
                                quantity: goodQty,
                                referenceId: order.number,
                                workOrderId: order.workOrderId,
                                performedBy: user.id,
                                notes: `Subkontrak masuk dari ${order.subcontractor.name} - ${order.number}` +
                                    (defect > 0 ? ` (cacat: ${defect})` : '') +
                                    (wastage > 0 ? ` (sisa: ${wastage})` : ''),
                            },
                        })

                        // Increment stock (only good quantity)
                        await tx.stockLevel.upsert({
                            where: {
                                productId_warehouseId_locationId: {
                                    productId: item.productId,
                                    warehouseId: data.warehouseId,
                                    locationId: null as any,
                                },
                            },
                            create: {
                                productId: item.productId,
                                warehouseId: data.warehouseId,
                                quantity: goodQty,
                                availableQty: goodQty,
                                reservedQty: 0,
                            },
                            update: {
                                quantity: { increment: goodQty },
                                availableQty: { increment: goodQty },
                            },
                        })

                        // Auto-update SubcontractOrderItem returnedQty/defectQty/wastageQty
                        const orderItem = await tx.subcontractOrderItem.findFirst({
                            where: {
                                orderId: data.orderId,
                                productId: item.productId,
                            },
                        })

                        if (orderItem) {
                            await tx.subcontractOrderItem.update({
                                where: { id: orderItem.id },
                                data: {
                                    returnedQty: { increment: goodQty },
                                    defectQty: { increment: defect },
                                    wastageQty: { increment: wastage },
                                },
                            })
                        }
                    }
                }

                // 3. Create shipment record
                await tx.subcontractShipment.create({
                    data: {
                        orderId: data.orderId,
                        direction: data.direction as SubcontractShipmentDirection,
                        deliveryNoteNumber: data.deliveryNoteNumber || null,
                        items: data.items as object,
                    },
                })
            })
        })

        revalidatePath('/subcontract')
        return { success: true }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal mencatat pengiriman'
        console.error("[recordShipment] Error:", error)
        return { success: false, error: msg }
    }
}

export async function updateItemReturnQty(
    itemId: string,
    returnedQty: number,
    defectQty: number,
    wastageQty: number
): Promise<{ success: boolean; error?: string }> {
    try {
        await withPrismaAuth(async (prisma: PrismaClient) => {
            await prisma.subcontractOrderItem.update({
                where: { id: itemId },
                data: { returnedQty, defectQty, wastageQty },
            })
        })

        revalidatePath('/subcontract')
        return { success: true }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal mengubah qty pengembalian'
        console.error("[updateItemReturnQty] Error:", error)
        return { success: false, error: msg }
    }
}

// ==============================================================================
// Products list (for order creation)
// ==============================================================================

export async function getProductsForSubcontract(): Promise<{ id: string; name: string; code: string }[]> {
    try {
        await requireAuth()
        const products = await prisma.product.findMany({
            where: { isActive: true },
            select: { id: true, name: true, code: true },
            orderBy: { name: 'asc' },
            take: 500,
        })
        return products
    } catch (error) {
        console.error("[getProductsForSubcontract] Error:", error)
        return []
    }
}

// ==============================================================================
// Dashboard summary (read-only — use singleton prisma)
// ==============================================================================

export async function getSubcontractDashboard(): Promise<DashboardData> {
    try {
        await requireAuth()
        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

        const [
            totalActive,
            totalSubcontractors,
            overdueOrdersRaw,
            recentOrdersRaw,
            statusGroupRaw,
            materialAtVendorRaw,
            completedThisMonth,
        ] = await Promise.all([
            // Active order count
            prisma.subcontractOrder.count({
                where: {
                    status: { in: ['SC_SENT', 'SC_IN_PROGRESS', 'SC_PARTIAL_COMPLETE'] },
                },
            }),
            // Active subcontractor count
            prisma.subcontractor.count({ where: { isActive: true } }),
            // Overdue orders (full data)
            prisma.subcontractOrder.findMany({
                where: {
                    status: { in: ['SC_SENT', 'SC_IN_PROGRESS', 'SC_PARTIAL_COMPLETE'] },
                    expectedReturnDate: { lt: now },
                },
                include: {
                    subcontractor: { select: { name: true } },
                    workOrder: { select: { id: true } },
                    items: { select: { issuedQty: true, returnedQty: true } },
                },
                orderBy: { expectedReturnDate: 'asc' },
            }),
            // Recent orders
            prisma.subcontractOrder.findMany({
                include: {
                    subcontractor: { select: { name: true } },
                    workOrder: { select: { id: true } },
                    items: { select: { issuedQty: true, returnedQty: true } },
                },
                orderBy: { createdAt: 'desc' },
                take: 10,
            }),
            // Status distribution
            prisma.subcontractOrder.groupBy({
                by: ['status'],
                _count: true,
            }),
            // Materials at vendor (active orders with remaining qty)
            prisma.subcontractOrder.findMany({
                where: {
                    status: { in: ['SC_SENT', 'SC_IN_PROGRESS', 'SC_PARTIAL_COMPLETE'] },
                },
                include: {
                    subcontractor: { select: { name: true } },
                    items: {
                        include: { product: { select: { name: true } } },
                    },
                },
            }),
            // Completed this month (for on-time stats)
            prisma.subcontractOrder.findMany({
                where: {
                    status: 'SC_COMPLETED',
                    updatedAt: { gte: startOfMonth },
                },
                include: {
                    items: { select: { issuedQty: true, returnedQty: true, defectQty: true } },
                },
            }),
        ])

        // Compute materialAtVendor
        const materialAtVendor: DashboardData['materialAtVendor'] = []
        for (const order of materialAtVendorRaw) {
            for (const item of order.items) {
                const remaining = item.issuedQty - item.returnedQty - item.defectQty - item.wastageQty
                if (remaining > 0) {
                    materialAtVendor.push({
                        subcontractorName: order.subcontractor.name,
                        productName: item.product.name,
                        qty: remaining,
                    })
                }
            }
        }

        // Compute yield rate from active orders
        let totalIssued = 0
        let totalReturned = 0
        for (const order of materialAtVendorRaw) {
            for (const item of order.items) {
                totalIssued += item.issuedQty
                totalReturned += item.returnedQty
            }
        }
        // Also add completed orders for a more accurate yield
        for (const order of completedThisMonth) {
            for (const item of order.items) {
                totalIssued += item.issuedQty
                totalReturned += item.returnedQty
            }
        }

        // Compute on-time delivery
        let onTimeCount = 0
        for (const o of completedThisMonth) {
            if (o.expectedReturnDate && o.updatedAt <= o.expectedReturnDate) {
                onTimeCount++
            }
        }

        // Compute total cost this month (estimated from rates)
        let totalCostThisMonth = 0
        try {
            const monthOrders = await prisma.subcontractOrder.findMany({
                where: { issuedDate: { gte: startOfMonth } },
                include: {
                    items: { select: { issuedQty: true } },
                },
            })
            // Simple estimate: sum issuedQty * average rate for the operation
            for (const order of monthOrders) {
                const rate = await prisma.subcontractorRate.findFirst({
                    where: {
                        subcontractorId: order.subcontractorId,
                        operation: order.operation,
                    },
                    orderBy: { validFrom: 'desc' },
                })
                if (rate) {
                    const qty = order.items.reduce((s, i) => s + i.issuedQty, 0)
                    totalCostThisMonth += qty * Number(rate.ratePerUnit)
                }
            }
        } catch {
            // Cost calculation is non-critical
        }

        const mapOrder = (o: typeof recentOrdersRaw[number]): SubcontractOrderSummary => ({
            id: o.id,
            number: o.number,
            subcontractorName: o.subcontractor.name,
            operation: o.operation,
            status: o.status,
            issuedDate: o.issuedDate.toISOString(),
            expectedReturnDate: o.expectedReturnDate?.toISOString() || null,
            workOrderNumber: o.workOrder ? o.workOrder.id : null,
            itemCount: o.items.length,
            totalIssuedQty: o.items.reduce((s, i) => s + i.issuedQty, 0),
            totalReturnedQty: o.items.reduce((s, i) => s + i.returnedQty, 0),
        })

        return {
            totalActive,
            totalSubcontractors,
            overdueCount: overdueOrdersRaw.length,
            totalCostThisMonth,
            yieldRate: totalIssued > 0 ? Math.round((totalReturned / totalIssued) * 100) : 0,
            onTimeDeliveryPercent: completedThisMonth.length > 0
                ? Math.round((onTimeCount / completedThisMonth.length) * 100)
                : 0,
            statusDistribution: statusGroupRaw.map((g) => ({
                status: g.status,
                count: g._count,
            })),
            materialAtVendor,
            overdueOrders: overdueOrdersRaw.map(mapOrder),
            recentOrders: recentOrdersRaw.map(mapOrder),
        }
    } catch (error) {
        console.error("[getSubcontractDashboard] Error:", error)
        return {
            totalActive: 0,
            totalSubcontractors: 0,
            overdueCount: 0,
            totalCostThisMonth: 0,
            yieldRate: 0,
            onTimeDeliveryPercent: 0,
            statusDistribution: [],
            materialAtVendor: [],
            overdueOrders: [],
            recentOrders: [],
        }
    }
}
