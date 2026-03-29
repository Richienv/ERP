import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        // getCostingDashboard
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

        const approvedSheets = await prisma.garmentCostSheet.findMany({
            where: { status: 'CS_APPROVED' },
            include: { product: { select: { name: true } } },
        })

        let totalProductionCost = 0
        let totalMargin = 0
        let marginCount = 0
        const lowMarginSheets: { id: string; number: string; productName: string; margin: number }[] = []

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

        const data = {
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

        // getProductsForCostSheet
        const products = await prisma.product.findMany({
            where: { isActive: true },
            select: { id: true, code: true, name: true },
            orderBy: { name: 'asc' },
        })

        return NextResponse.json({ data, products })
    } catch (e) {
        console.error("[API] costing/dashboard-data:", e)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
