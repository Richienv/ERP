import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"
import type { Prisma } from "@prisma/client"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const { searchParams } = new URL(request.url)
        const status = searchParams.get("status") || undefined
        const categoryId = searchParams.get("categoryId") || undefined
        const search = searchParams.get("search") || undefined

        // getFixedAssets
        const where: Prisma.FixedAssetWhereInput = {}
        if (status) where.status = status as any
        if (categoryId) where.categoryId = categoryId
        if (search) {
            where.OR = [
                { name: { contains: search, mode: "insensitive" } },
                { assetCode: { contains: search, mode: "insensitive" } },
                { serialNumber: { contains: search, mode: "insensitive" } },
            ]
        }

        const [assets, allAssets, categoriesResult] = await Promise.all([
            prisma.fixedAsset.findMany({
                where,
                include: {
                    category: { select: { id: true, code: true, name: true } },
                    supplier: { select: { id: true, name: true } },
                },
                orderBy: { createdAt: "desc" },
            }),
            // KPI summary
            prisma.fixedAsset.findMany({
                select: { status: true, purchaseCost: true, accumulatedDepreciation: true, netBookValue: true },
            }),
            // getFixedAssetCategories
            prisma.fixedAssetCategory.findMany({
                include: {
                    assetAccount: { select: { id: true, code: true, name: true } },
                    accDepAccount: { select: { id: true, code: true, name: true } },
                    depExpAccount: { select: { id: true, code: true, name: true } },
                    gainLossAccount: { select: { id: true, code: true, name: true } },
                    _count: { select: { assets: true } },
                },
                orderBy: { code: "asc" },
            }),
        ])

        const totalCost = allAssets.reduce((sum, a) => sum + Number(a.purchaseCost), 0)
        const totalAccDep = allAssets.reduce((sum, a) => sum + Number(a.accumulatedDepreciation), 0)
        const totalNBV = allAssets.reduce((sum, a) => sum + Number(a.netBookValue), 0)
        const activeCount = allAssets.filter((a) => a.status === "ACTIVE").length

        return NextResponse.json({
            success: true,
            assets,
            summary: { totalAssets: allAssets.length, activeCount, totalCost, totalAccDep, totalNBV },
            categories: categoriesResult,
        })
    } catch (e) {
        console.error("[API] finance/fixed-assets-data:", e)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
