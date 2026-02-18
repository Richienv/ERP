'use server'

import { prisma, withPrismaAuth } from "@/lib/db"
import { PrismaClient } from "@prisma/client"
import { createClient } from "@/lib/supabase/server"

// Pure functions and types moved to helper file for "use server" compatibility
import { calculate4PointScore } from "@/lib/fabric-inspection-helpers"
import type { FabricDefectEntry } from "@/lib/fabric-inspection-helpers"

async function requireAuth() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new Error("Unauthorized")
    return user
}

// Re-export types for consumers (type exports are allowed in "use server" files)
export type { FabricDefectEntry, FabricInspectionResult } from "@/lib/fabric-inspection-helpers"

// ==============================================================================
// Server Actions
// ==============================================================================

export async function createFabricInspection(data: {
    batchNumber: string
    productId: string
    inspectorId: string
    metersInspected: number
    defects: FabricDefectEntry[]
    purchaseOrderId?: string
    notes?: string
}): Promise<{ success: boolean; result?: ReturnType<typeof calculate4PointScore>; error?: string }> {
    try {
        const result = calculate4PointScore(data.metersInspected, data.defects)

        await withPrismaAuth(async (prisma: PrismaClient) => {
            await prisma.qualityInspection.create({
                data: {
                    batchNumber: data.batchNumber,
                    materialId: data.productId,
                    inspectorId: data.inspectorId,
                    status: result.passed ? 'PASS' : 'FAIL',
                    score: result.pointsPer100Yards,
                    notes: [
                        data.notes,
                        `4-Point: ${result.totalPoints} pts / ${result.metersInspected}m = ${result.pointsPer100Yards} pts/100yd`,
                        `Grade: ${result.grade}`,
                    ].filter(Boolean).join(' | '),
                    purchaseOrderId: data.purchaseOrderId ?? null,
                    defects: {
                        create: data.defects.map((d) => ({
                            type: d.points >= 3 ? 'MAJOR' : d.points >= 2 ? 'MINOR' : 'MINOR',
                            description: `${d.type} @ ${d.location} (${d.points}pt)`,
                            actionTaken: result.passed ? 'ACCEPT_CONCESSION' : 'REWORK',
                        })),
                    },
                },
            })
        })

        return { success: true, result }
    } catch (error) {
        console.error("[createFabricInspection] Error:", error)
        return { success: false, error: 'Gagal membuat inspeksi kain' }
    }
}

export async function getFabricInspections(limit = 20): Promise<{
    id: string
    batchNumber: string
    productName: string
    inspectorName: string
    score: number
    status: string
    grade: string
    defectCount: number
    inspectionDate: string
}[]> {
    try {
        await requireAuth()

        const inspections = await prisma.qualityInspection.findMany({
            where: {
                notes: { contains: '4-Point' },
            },
            orderBy: { inspectionDate: 'desc' },
            take: limit,
            include: {
                material: { select: { name: true } },
                inspector: { select: { firstName: true, lastName: true } },
                _count: { select: { defects: true } },
            },
        })

        return inspections.map((i) => {
            const gradeMatch = i.notes?.match(/Grade: ([A-C]|REJECT)/)
            return {
                id: i.id,
                batchNumber: i.batchNumber,
                productName: i.material.name,
                inspectorName: [i.inspector.firstName, i.inspector.lastName].filter(Boolean).join(' '),
                score: Number(i.score),
                status: i.status,
                grade: gradeMatch?.[1] ?? '—',
                defectCount: i._count.defects,
                inspectionDate: i.inspectionDate.toISOString(),
            }
        })
    } catch (error) {
        console.error("[getFabricInspections] Error:", error)
        return []
    }
}
