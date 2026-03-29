import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"
import { calculateRemainingMeters } from "@/lib/fabric-roll-helpers"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const [rawRolls, warehouses, products] = await Promise.all([
            prisma.fabricRoll.findMany({
                include: {
                    product: { select: { name: true, code: true } },
                    warehouse: { select: { name: true } },
                    transactions: { select: { type: true, meters: true } },
                },
                orderBy: { createdAt: "desc" },
                take: 100,
            }),
            prisma.warehouse.findMany({
                where: { isActive: true },
                select: { id: true, name: true, code: true },
                orderBy: { name: "asc" },
            }),
            prisma.product.findMany({
                where: { isActive: true, productType: "RAW_MATERIAL" },
                select: { id: true, name: true, code: true },
                orderBy: { name: "asc" },
            }),
        ])

        const rolls = rawRolls.map((r) => {
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

        return NextResponse.json({ rolls, warehouses, products })
    } catch (e) {
        console.error("[API] fabric-rolls-data:", e)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
