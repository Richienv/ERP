'use server'

import { prisma, withPrismaAuth } from "@/lib/db"
import { PrismaClient, FabricRollStatus } from "@prisma/client"
import { createClient } from "@/lib/supabase/server"
import { calculateRemainingMeters, determineRollStatus } from "@/lib/fabric-roll-helpers"

async function requireAuth() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new Error("Unauthorized")
    return user
}

// ==============================================================================
// Types
// ==============================================================================

export interface FabricRollSummary {
    id: string
    rollNumber: string
    productName: string
    productCode: string
    lengthMeters: number
    remainingMeters: number
    widthCm: number | null
    weight: number | null
    dyeLot: string | null
    grade: string | null
    warehouseName: string
    locationBin: string | null
    status: FabricRollStatus
    createdAt: string
}

export interface FabricRollDetail extends FabricRollSummary {
    greigeDate: string | null
    transactions: {
        id: string
        type: string
        meters: number
        reference: string | null
        date: string
    }[]
}

// ==============================================================================
// Read Actions (use singleton prisma to avoid connection pool exhaustion)
// ==============================================================================

export async function getFabricRolls(filters?: {
    productId?: string
    warehouseId?: string
    status?: FabricRollStatus
    search?: string
}): Promise<FabricRollSummary[]> {
    try {
        await requireAuth()

        const where: Record<string, unknown> = {}

        if (filters?.productId) where.productId = filters.productId
        if (filters?.warehouseId) where.warehouseId = filters.warehouseId
        if (filters?.status) where.status = filters.status
        if (filters?.search) {
            where.OR = [
                { rollNumber: { contains: filters.search, mode: 'insensitive' } },
                { dyeLot: { contains: filters.search, mode: 'insensitive' } },
                { product: { name: { contains: filters.search, mode: 'insensitive' } } },
            ]
        }

        const rolls = await prisma.fabricRoll.findMany({
            where,
            include: {
                product: { select: { name: true, code: true } },
                warehouse: { select: { name: true } },
                transactions: {
                    select: { type: true, meters: true },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: 100,
        })

        return rolls.map((r) => {
            const remaining = calculateRemainingMeters(
                Number(r.lengthMeters),
                r.transactions.map((t) => ({ type: t.type, meters: Number(t.meters) }))
            )
            return {
                id: r.id,
                rollNumber: r.rollNumber,
                productName: r.product.name,
                productCode: r.product.code,
                lengthMeters: Number(r.lengthMeters),
                remainingMeters: remaining,
                widthCm: r.widthCm ? Number(r.widthCm) : null,
                weight: r.weight ? Number(r.weight) : null,
                dyeLot: r.dyeLot,
                grade: r.grade,
                warehouseName: r.warehouse.name,
                locationBin: r.locationBin,
                status: r.status,
                createdAt: r.createdAt.toISOString(),
            }
        })
    } catch (error) {
        console.error("[getFabricRolls] Error:", error)
        return []
    }
}

export async function getFabricRollDetail(rollId: string): Promise<FabricRollDetail | null> {
    try {
        await requireAuth()

        const r = await prisma.fabricRoll.findUnique({
            where: { id: rollId },
            include: {
                product: { select: { name: true, code: true } },
                warehouse: { select: { name: true } },
                transactions: {
                    orderBy: { date: 'desc' },
                    select: { id: true, type: true, meters: true, reference: true, date: true },
                },
            },
        })

        if (!r) return null

        const remaining = calculateRemainingMeters(
            Number(r.lengthMeters),
            r.transactions.map((t) => ({ type: t.type, meters: Number(t.meters) }))
        )

        return {
            id: r.id,
            rollNumber: r.rollNumber,
            productName: r.product.name,
            productCode: r.product.code,
            lengthMeters: Number(r.lengthMeters),
            remainingMeters: remaining,
            widthCm: r.widthCm ? Number(r.widthCm) : null,
            weight: r.weight ? Number(r.weight) : null,
            dyeLot: r.dyeLot,
            grade: r.grade,
            greigeDate: r.greigeDate?.toISOString() ?? null,
            warehouseName: r.warehouse.name,
            locationBin: r.locationBin,
            status: r.status,
            createdAt: r.createdAt.toISOString(),
            transactions: r.transactions.map((t) => ({
                id: t.id,
                type: t.type,
                meters: Number(t.meters),
                reference: t.reference,
                date: t.date.toISOString(),
            })),
        }
    } catch (error) {
        console.error("[getFabricRollDetail] Error:", error)
        return null
    }
}

export async function getWarehousesForRolls(): Promise<{ id: string; name: string; code: string }[]> {
    try {
        await requireAuth()

        return prisma.warehouse.findMany({
            where: { isActive: true },
            select: { id: true, name: true, code: true },
            orderBy: { name: 'asc' },
        })
    } catch (error) {
        console.error("[getWarehousesForRolls] Error:", error)
        return []
    }
}

export async function getFabricProducts(): Promise<{ id: string; name: string; code: string }[]> {
    try {
        await requireAuth()

        return prisma.product.findMany({
            where: {
                isActive: true,
                productType: 'RAW_MATERIAL',
            },
            select: { id: true, name: true, code: true },
            orderBy: { name: 'asc' },
        })
    } catch (error) {
        console.error("[getFabricProducts] Error:", error)
        return []
    }
}

// ==============================================================================
// Write Actions (keep withPrismaAuth for transactional safety)
// ==============================================================================

export async function receiveFabricRoll(data: {
    rollNumber: string
    productId: string
    warehouseId: string
    lengthMeters: number
    widthCm?: number
    weight?: number
    dyeLot?: string
    greigeDate?: string
    grade?: string
    locationBin?: string
    reference?: string
}): Promise<{ success: boolean; rollId?: string; error?: string }> {
    try {
        const rollId = await withPrismaAuth(async (prisma: PrismaClient) => {
            // Check unique roll number
            const existing = await prisma.fabricRoll.findUnique({
                where: { rollNumber: data.rollNumber },
            })
            if (existing) throw new Error(`Roll number ${data.rollNumber} sudah ada`)

            const roll = await prisma.fabricRoll.create({
                data: {
                    rollNumber: data.rollNumber,
                    productId: data.productId,
                    warehouseId: data.warehouseId,
                    lengthMeters: data.lengthMeters,
                    widthCm: data.widthCm ?? null,
                    weight: data.weight ?? null,
                    dyeLot: data.dyeLot ?? null,
                    greigeDate: data.greigeDate ? new Date(data.greigeDate) : null,
                    grade: data.grade ?? null,
                    locationBin: data.locationBin ?? null,
                    status: 'AVAILABLE',
                },
            })

            // Create initial receive transaction
            await prisma.fabricRollTransaction.create({
                data: {
                    fabricRollId: roll.id,
                    type: 'FR_RECEIVE',
                    meters: 0, // Initial receive — length is already on the roll
                    reference: data.reference ?? `Terima roll ${data.rollNumber}`,
                },
            })

            return roll.id
        })

        return { success: true, rollId }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal menerima fabric roll'
        console.error("[receiveFabricRoll] Error:", error)
        return { success: false, error: msg }
    }
}

export async function recordRollTransaction(data: {
    fabricRollId: string
    type: 'FR_CUT' | 'FR_TRANSFER' | 'FR_ADJUST'
    meters: number
    reference?: string
}): Promise<{ success: boolean; error?: string }> {
    try {
        await withPrismaAuth(async (prisma: PrismaClient) => {
            const roll = await prisma.fabricRoll.findUniqueOrThrow({
                where: { id: data.fabricRollId },
                include: {
                    transactions: { select: { type: true, meters: true } },
                },
            })

            const currentRemaining = calculateRemainingMeters(
                Number(roll.lengthMeters),
                roll.transactions.map((t) => ({ type: t.type, meters: Number(t.meters) }))
            )

            // Validate sufficient meters for cut/transfer
            if ((data.type === 'FR_CUT' || data.type === 'FR_TRANSFER') && data.meters > currentRemaining) {
                throw new Error(`Sisa roll hanya ${currentRemaining}m, tidak cukup untuk ${data.meters}m`)
            }

            await prisma.fabricRollTransaction.create({
                data: {
                    fabricRollId: data.fabricRollId,
                    type: data.type,
                    meters: data.meters,
                    reference: data.reference ?? null,
                },
            })

            // Update roll status
            const newRemaining = data.type === 'FR_ADJUST'
                ? currentRemaining + data.meters
                : currentRemaining - data.meters
            const newStatus = determineRollStatus(newRemaining, roll.status)

            if (newStatus !== roll.status) {
                await prisma.fabricRoll.update({
                    where: { id: data.fabricRollId },
                    data: { status: newStatus },
                })
            }
        })

        return { success: true }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal mencatat transaksi roll'
        console.error("[recordRollTransaction] Error:", error)
        return { success: false, error: msg }
    }
}
