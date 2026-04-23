import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const warehouses = await prisma.warehouse.findMany({
            where: { isActive: true },
            include: {
                stockLevels: {
                    include: { product: { select: { costPrice: true } } },
                },
                fabricRolls: {
                    where: { status: { in: ["AVAILABLE", "RESERVED", "IN_USE"] } },
                    select: { lengthMeters: true },
                },
                _count: { select: { stockLevels: true } },
            },
        })

        const managerIds = warehouses.map((w) => w.managerId).filter(Boolean) as string[]
        const managers = managerIds.length
            ? await prisma.employee.findMany({
                where: { id: { in: managerIds } },
                select: { id: true, firstName: true, lastName: true, phone: true },
            })
            : []

        const data = warehouses.map((w) => {
            const manager = managers.find((m) => m.id === w.managerId)
            const managerName = manager ? `${manager.firstName} ${manager.lastName || ""}`.trim() : "Unassigned"
            const managerPhone = manager?.phone || "-"
            const stockLevelItems = w.stockLevels.reduce((sum, sl) => sum + Number(sl.quantity), 0)
            const fabricRollMeters = w.fabricRolls.reduce((sum, fr) => sum + Math.round(Number(fr.lengthMeters)), 0)
            const totalItems = stockLevelItems + fabricRollMeters
            const capacity = w.capacity || 50000
            const utilization = capacity > 0 ? Math.min(parseFloat(((totalItems / capacity) * 100).toFixed(1)), 100) : 0

            return {
                id: w.id,
                name: w.name,
                code: w.code,
                location: [w.city, w.province].filter(Boolean).join(", ") || w.address || "Unknown Location",
                type: "Warehouse",
                warehouseType: w.warehouseType,
                capacity,
                utilization,
                manager: managerName,
                status: w.isActive ? "Active" : "Inactive",
                totalValue: Math.round(w.stockLevels.reduce((sum, sl) => sum + Number(sl.quantity) * Number(sl.product.costPrice), 0)),
                activePOs: 0,
                pendingTasks: 0,
                items: totalItems,
                staff: 0,
                phone: managerPhone,
            }
        })

        return NextResponse.json(data)
    } catch (e) {
        console.error("[API] warehouses-data:", e)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
