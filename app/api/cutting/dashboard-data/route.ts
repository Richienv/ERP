import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const [totalDraft, totalAllocated, totalInCutting, totalCompleted, recentPlansRaw, fabricProducts] =
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
                // getFabricProducts
                prisma.product.findMany({
                    where: {
                        isActive: true,
                        OR: [
                            { code: { contains: '-FAB-' } },
                            { code: { contains: '-GRY-' } },
                            { code: { contains: '-DYD-' } },
                            { code: { contains: '-PRT-' } },
                        ],
                    },
                    select: { id: true, name: true, code: true },
                    orderBy: { name: 'asc' },
                }),
            ])

        const recentPlans = recentPlansRaw.map((p) => ({
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

        const data = {
            totalDraft,
            totalAllocated,
            totalInCutting,
            totalCompleted,
            recentPlans,
        }

        return NextResponse.json({ data, fabricProducts })
    } catch (e) {
        console.error("[API] cutting/dashboard-data:", e)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
