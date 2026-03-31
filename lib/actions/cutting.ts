'use server'

import { prisma, withPrismaAuth } from "@/lib/db"
import { PrismaClient, CutPlanStatus, FabricRollStatus } from "@prisma/client"
import { createClient } from "@/lib/supabase/server"
import { assertCutPlanTransition } from "@/lib/cut-plan-state-machine"
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

export interface CutPlanSummary {
    id: string
    number: string
    fabricProductName: string
    fabricProductCode: string
    status: CutPlanStatus
    markerLength: number | null
    markerEfficiency: number | null
    totalLayers: number | null
    totalFabricMeters: number | null
    plannedDate: string | null
    workOrderId: string | null
    outputCount: number
    layerCount: number
}

export interface CutPlanDetail {
    id: string
    number: string
    fabricProductId: string
    fabricProductName: string
    fabricProductCode: string
    status: CutPlanStatus
    markerLength: number | null
    markerEfficiency: number | null
    totalLayers: number | null
    totalFabricMeters: number | null
    plannedDate: string | null
    workOrderId: string | null
    layers: {
        id: string
        layerNumber: number
        fabricRollId: string
        rollNumber: string
        metersUsed: number
    }[]
    outputs: {
        id: string
        styleVariantId: string
        sku: string
        colorName: string | null
        size: string | null
        plannedQty: number
        actualQty: number
        defectQty: number
    }[]
}

// ==============================================================================
// Read Actions (use singleton prisma to avoid connection pool exhaustion)
// ==============================================================================

export async function getCutPlans(filters?: {
    status?: CutPlanStatus
}): Promise<CutPlanSummary[]> {
    try {
        await requireAuth()

        const plans = await prisma.cutPlan.findMany({
            where: {
                ...(filters?.status && { status: filters.status }),
            },
            include: {
                fabricProduct: { select: { name: true, code: true } },
                _count: { select: { layers: true, outputs: true } },
            },
            orderBy: { createdAt: 'desc' },
        })

        return plans.map((p) => ({
            id: p.id,
            number: p.number,
            fabricProductName: p.fabricProduct.name,
            fabricProductCode: p.fabricProduct.code,
            status: p.status,
            markerLength: p.markerLength ? Number(p.markerLength) : null,
            markerEfficiency: p.markerEfficiency ? Number(p.markerEfficiency) : null,
            totalLayers: p.totalLayers,
            totalFabricMeters: p.totalFabricMeters ? Number(p.totalFabricMeters) : null,
            plannedDate: p.plannedDate?.toISOString() || null,
            workOrderId: p.workOrderId,
            outputCount: p._count.outputs,
            layerCount: p._count.layers,
        }))
    } catch (error) {
        console.error("[getCutPlans] Error:", error)
        return []
    }
}

export async function getCutPlanDetail(
    planId: string
): Promise<CutPlanDetail | null> {
    try {
        await requireAuth()

        const plan = await prisma.cutPlan.findUnique({
            where: { id: planId },
            include: {
                fabricProduct: { select: { name: true, code: true } },
                layers: {
                    include: {
                        fabricRoll: { select: { rollNumber: true } },
                    },
                    orderBy: { layerNumber: 'asc' },
                },
                outputs: {
                    include: {
                        styleVariant: {
                            select: { sku: true, colorName: true, size: true },
                        },
                    },
                },
            },
        })

        if (!plan) return null

        return {
            id: plan.id,
            number: plan.number,
            fabricProductId: plan.fabricProductId,
            fabricProductName: plan.fabricProduct.name,
            fabricProductCode: plan.fabricProduct.code,
            status: plan.status,
            markerLength: plan.markerLength ? Number(plan.markerLength) : null,
            markerEfficiency: plan.markerEfficiency ? Number(plan.markerEfficiency) : null,
            totalLayers: plan.totalLayers,
            totalFabricMeters: plan.totalFabricMeters ? Number(plan.totalFabricMeters) : null,
            plannedDate: plan.plannedDate?.toISOString() || null,
            workOrderId: plan.workOrderId,
            layers: plan.layers.map((l) => ({
                id: l.id,
                layerNumber: l.layerNumber,
                fabricRollId: l.fabricRollId,
                rollNumber: l.fabricRoll.rollNumber,
                metersUsed: Number(l.metersUsed),
            })),
            outputs: plan.outputs.map((o) => ({
                id: o.id,
                styleVariantId: o.styleVariantId,
                sku: o.styleVariant.sku,
                colorName: o.styleVariant.colorName,
                size: o.styleVariant.size,
                plannedQty: o.plannedQty,
                actualQty: o.actualQty,
                defectQty: o.defectQty,
            })),
        }
    } catch (error) {
        console.error("[getCutPlanDetail] Error:", error)
        return null
    }
}

// ==============================================================================
// Write Actions (keep withPrismaAuth for transactional safety)
// ==============================================================================

function generateCPNumber(): string {
    const now = new Date()
    const y = now.getFullYear().toString().slice(-2)
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
    return `CP-${y}${m}-${rand}`
}

export async function createCutPlan(data: {
    fabricProductId: string
    workOrderId?: string
    markerLength?: number
    markerEfficiency?: number
    totalLayers?: number
    totalFabricMeters?: number
    plannedDate?: string
}): Promise<{ success: boolean; id?: string; error?: string }> {
    if (!data.fabricProductId) {
        return { success: false, error: 'Produk kain wajib dipilih' }
    }

    try {
        const id = await withPrismaAuth(async (prisma: PrismaClient) => {
            const plan = await prisma.cutPlan.create({
                data: {
                    number: generateCPNumber(),
                    fabricProductId: data.fabricProductId,
                    workOrderId: data.workOrderId || null,
                    markerLength: data.markerLength || null,
                    markerEfficiency: data.markerEfficiency || null,
                    totalLayers: data.totalLayers || null,
                    totalFabricMeters: data.totalFabricMeters || null,
                    plannedDate: data.plannedDate ? new Date(data.plannedDate) : null,
                    status: 'CP_DRAFT',
                },
            })
            return plan.id
        })

        return { success: true, id }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal membuat cut plan'
        console.error("[createCutPlan] Error:", error)
        return { success: false, error: msg }
    }
}

export async function updateCutPlanStatus(
    planId: string,
    newStatus: CutPlanStatus
): Promise<{ success: boolean; error?: string }> {
    try {
        await withPrismaAuth(async (prisma: PrismaClient) => {
            const plan = await prisma.cutPlan.findUniqueOrThrow({
                where: { id: planId },
                include: {
                    layers: {
                        select: { fabricRollId: true },
                    },
                },
            })

            assertCutPlanTransition(plan.status, newStatus)

            await prisma.cutPlan.update({
                where: { id: planId },
                data: { status: newStatus },
            })

            // Update fabric roll statuses based on the new cut plan status
            const uniqueRollIds = [...new Set(plan.layers.map((l) => l.fabricRollId))]

            if (uniqueRollIds.length > 0) {
                if (newStatus === 'IN_CUTTING') {
                    // Mark all associated rolls as IN_USE
                    await prisma.fabricRoll.updateMany({
                        where: {
                            id: { in: uniqueRollIds },
                            status: { in: ['AVAILABLE', 'RESERVED'] },
                        },
                        data: { status: 'IN_USE' },
                    })
                } else if (newStatus === 'CP_COMPLETED' || newStatus === 'CP_CANCELLED') {
                    // Recalculate each roll's status based on remaining meters
                    for (const rollId of uniqueRollIds) {
                        const roll = await prisma.fabricRoll.findUniqueOrThrow({
                            where: { id: rollId },
                            include: {
                                transactions: { select: { type: true, meters: true } },
                                cutPlanLayers: {
                                    include: {
                                        cutPlan: { select: { status: true } },
                                    },
                                },
                            },
                        })

                        const remaining = calculateRemainingMeters(
                            Number(roll.lengthMeters),
                            roll.transactions.map((t) => ({ type: t.type, meters: Number(t.meters) }))
                        )

                        // Check if this roll is still used by other active cut plans
                        const hasActiveCutPlan = roll.cutPlanLayers.some(
                            (l) => l.cutPlan.status === 'IN_CUTTING'
                        )

                        const hasCutTxns = roll.transactions.some((t) => t.type === 'FR_CUT')

                        let rollStatus: FabricRollStatus
                        if (remaining <= 0) {
                            rollStatus = 'DEPLETED'
                        } else if (hasActiveCutPlan) {
                            rollStatus = 'IN_USE'
                        } else if (hasCutTxns) {
                            rollStatus = 'IN_USE'
                        } else {
                            rollStatus = 'AVAILABLE'
                        }

                        if (rollStatus !== roll.status) {
                            await prisma.fabricRoll.update({
                                where: { id: rollId },
                                data: { status: rollStatus },
                            })
                        }
                    }
                }
            }
        })

        return { success: true }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal mengubah status'
        console.error("[updateCutPlanStatus] Error:", error)
        return { success: false, error: msg }
    }
}

export async function addCutPlanLayer(data: {
    cutPlanId: string
    layerNumber: number
    fabricRollId: string
    metersUsed: number
}): Promise<{ success: boolean; error?: string }> {
    try {
        await withPrismaAuth(async (prisma: PrismaClient) => {
            // Fetch cut plan number for the transaction reference
            const cutPlan = await prisma.cutPlan.findUniqueOrThrow({
                where: { id: data.cutPlanId },
                select: { number: true },
            })

            // Validate sufficient remaining meters on the roll
            const roll = await prisma.fabricRoll.findUniqueOrThrow({
                where: { id: data.fabricRollId },
                include: {
                    transactions: { select: { type: true, meters: true } },
                    product: { select: { id: true, name: true, costPrice: true } },
                },
            })

            const currentRemaining = calculateRemainingMeters(
                Number(roll.lengthMeters),
                roll.transactions.map((t) => ({ type: t.type, meters: Number(t.meters) }))
            )

            if (data.metersUsed > currentRemaining) {
                throw new Error(
                    `Sisa roll hanya ${currentRemaining}m, tidak cukup untuk ${data.metersUsed}m`
                )
            }

            // Create the cut plan layer
            await prisma.cutPlanLayer.create({
                data: {
                    cutPlanId: data.cutPlanId,
                    layerNumber: data.layerNumber,
                    fabricRollId: data.fabricRollId,
                    metersUsed: data.metersUsed,
                },
            })

            // Record FR_CUT transaction on the fabric roll
            await prisma.fabricRollTransaction.create({
                data: {
                    fabricRollId: data.fabricRollId,
                    type: 'FR_CUT',
                    meters: data.metersUsed,
                    reference: `Cut plan ${cutPlan.number} layer #${data.layerNumber}`,
                },
            })

            // Create CUT_CONSUME inventory transaction for GL tracking
            const unitCost = Number(roll.product.costPrice || 0)
            const totalValue = unitCost > 0 ? data.metersUsed * unitCost : 0
            const invTx = await prisma.inventoryTransaction.create({
                data: {
                    productId: roll.product.id,
                    warehouseId: roll.warehouseId,
                    type: 'CUT_CONSUME' as any,
                    quantity: -data.metersUsed,
                    unitCost,
                    totalValue,
                    notes: `Potong kain - ${cutPlan.number} layer #${data.layerNumber} (${roll.rollNumber})`,
                },
            })

            // Post GL entry: DR WIP, CR Raw Materials
            // BLOCKING: GL failure rolls back the entire cut plan layer transaction
            if (totalValue > 0) {
                const { postInventoryGLEntry } = await import("@/lib/actions/inventory-gl")
                await postInventoryGLEntry(prisma, {
                    transactionId: invTx.id,
                    type: 'CUT_CONSUME',
                    productName: roll.product.name,
                    quantity: data.metersUsed,
                    unitCost,
                    totalValue,
                    reference: `${cutPlan.number} layer #${data.layerNumber}`,
                })
            }

            // Update fabric roll status
            const newRemaining = currentRemaining - data.metersUsed
            const newStatus = determineRollStatus(newRemaining, roll.status, true)

            if (newStatus !== roll.status) {
                await prisma.fabricRoll.update({
                    where: { id: data.fabricRollId },
                    data: { status: newStatus },
                })
            }
        })

        return { success: true }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal menambah layer'
        console.error("[addCutPlanLayer] Error:", error)
        return { success: false, error: msg }
    }
}

export async function removeCutPlanLayer(
    layerId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        await withPrismaAuth(async (prisma: PrismaClient) => {
            // Fetch layer details before deleting (need fabricRollId and metersUsed)
            const layer = await prisma.cutPlanLayer.findUniqueOrThrow({
                where: { id: layerId },
                include: {
                    cutPlan: { select: { number: true } },
                },
            })

            await prisma.cutPlanLayer.delete({ where: { id: layerId } })

            // Reverse the cut by adding meters back via FR_ADJUST
            await prisma.fabricRollTransaction.create({
                data: {
                    fabricRollId: layer.fabricRollId,
                    type: 'FR_ADJUST',
                    meters: Number(layer.metersUsed), // positive = adds back
                    reference: `Batal layer #${layer.layerNumber} dari ${layer.cutPlan.number}`,
                },
            })

            // Recalculate roll status
            const roll = await prisma.fabricRoll.findUniqueOrThrow({
                where: { id: layer.fabricRollId },
                include: {
                    transactions: { select: { type: true, meters: true } },
                },
            })

            const remaining = calculateRemainingMeters(
                Number(roll.lengthMeters),
                roll.transactions.map((t) => ({ type: t.type, meters: Number(t.meters) }))
            )

            const hasCutTxns = roll.transactions.some((t) => t.type === 'FR_CUT')
            const newStatus = determineRollStatus(remaining, roll.status, hasCutTxns)

            if (newStatus !== roll.status) {
                await prisma.fabricRoll.update({
                    where: { id: layer.fabricRollId },
                    data: { status: newStatus },
                })
            }
        })

        return { success: true }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal menghapus layer'
        console.error("[removeCutPlanLayer] Error:", error)
        return { success: false, error: msg }
    }
}

export async function setCutPlanOutput(data: {
    id?: string
    cutPlanId: string
    styleVariantId: string
    plannedQty: number
    actualQty?: number
    defectQty?: number
}): Promise<{ success: boolean; error?: string }> {
    try {
        await withPrismaAuth(async (prisma: PrismaClient) => {
            if (data.id) {
                await prisma.cutPlanOutput.update({
                    where: { id: data.id },
                    data: {
                        plannedQty: data.plannedQty,
                        actualQty: data.actualQty ?? 0,
                        defectQty: data.defectQty ?? 0,
                    },
                })
            } else {
                await prisma.cutPlanOutput.create({
                    data: {
                        cutPlanId: data.cutPlanId,
                        styleVariantId: data.styleVariantId,
                        plannedQty: data.plannedQty,
                        actualQty: data.actualQty ?? 0,
                        defectQty: data.defectQty ?? 0,
                    },
                })
            }
        })

        return { success: true }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal menyimpan output'
        console.error("[setCutPlanOutput] Error:", error)
        return { success: false, error: msg }
    }
}

// ==============================================================================
// Dashboard (read-only — use singleton prisma)
// ==============================================================================

export async function getCuttingDashboard(): Promise<{
    totalDraft: number
    totalAllocated: number
    totalInCutting: number
    totalCompleted: number
    recentPlans: CutPlanSummary[]
}> {
    try {
        await requireAuth()

        const [totalDraft, totalAllocated, totalInCutting, totalCompleted, recentPlans] =
            await Promise.all([
                prisma.cutPlan.count({ where: { status: 'CP_DRAFT' } }),
                prisma.cutPlan.count({ where: { status: 'FABRIC_ALLOCATED' } }),
                prisma.cutPlan.count({ where: { status: 'IN_CUTTING' } }),
                prisma.cutPlan.count({ where: { status: 'CP_COMPLETED' } }),
                prisma.cutPlan.findMany({
                    include: {
                        fabricProduct: { select: { name: true, code: true } },
                        _count: { select: { layers: true, outputs: true } },
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 10,
                }),
            ])

        return {
            totalDraft,
            totalAllocated,
            totalInCutting,
            totalCompleted,
            recentPlans: recentPlans.map((p) => ({
                id: p.id,
                number: p.number,
                fabricProductName: p.fabricProduct.name,
                fabricProductCode: p.fabricProduct.code,
                status: p.status,
                markerLength: p.markerLength ? Number(p.markerLength) : null,
                markerEfficiency: p.markerEfficiency ? Number(p.markerEfficiency) : null,
                totalLayers: p.totalLayers,
                totalFabricMeters: p.totalFabricMeters ? Number(p.totalFabricMeters) : null,
                plannedDate: p.plannedDate?.toISOString() || null,
                workOrderId: p.workOrderId,
                outputCount: p._count.outputs,
                layerCount: p._count.layers,
            })),
        }
    } catch (error) {
        console.error("[getCuttingDashboard] Error:", error)
        return { totalDraft: 0, totalAllocated: 0, totalInCutting: 0, totalCompleted: 0, recentPlans: [] }
    }
}

// ==============================================================================
// Fabric Products (for cut plan form dropdown)
// ==============================================================================

export async function getFabricProducts(): Promise<
    { id: string; name: string; code: string }[]
> {
    try {
        await requireAuth()
        const products = await prisma.product.findMany({
            where: {
                isActive: true,
                OR: [
                    { code: { contains: '-FAB-' } },  // Kain mentah (raw/trading fabric)
                    { code: { contains: '-GRY-' } },  // Greige (kain belum finishing)
                    { code: { contains: '-DYD-' } },  // Dyed (kain sudah dicelup)
                    { code: { contains: '-PRT-' } },  // Printed (kain sudah dicetak)
                ],
            },
            select: { id: true, name: true, code: true },
            orderBy: { name: 'asc' },
        })
        return products
    } catch (error) {
        console.error("[getFabricProducts] Error:", error)
        return []
    }
}
