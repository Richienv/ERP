import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"
import { calculateProductStatus } from "@/lib/inventory-logic"

export const dynamic = "force-dynamic"

// No query params accepted; reject any unexpected input defensively.
const QuerySchema = z.object({}).strict()

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const params = Object.fromEntries(request.nextUrl.searchParams.entries())
        const parsed = QuerySchema.safeParse(params)
        if (!parsed.success) {
            return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 })
        }

        const [auditTransactions, rawProducts, rawWarehouses] = await Promise.all([
            prisma.inventoryTransaction.findMany({
                where: { referenceId: { startsWith: "AUDIT-" } },
                take: 20,
                orderBy: { createdAt: "desc" },
                include: {
                    product: { include: { category: true } },
                    warehouse: true,
                },
            }),
            prisma.product.findMany({
                where: { isActive: true },
                include: { category: true, stockLevels: true },
                orderBy: { name: 'asc' },
                take: 200,
            }),
            prisma.warehouse.findMany({
                where: { isActive: true },
                orderBy: { name: 'asc' },
                take: 200,
                include: {
                    stockLevels: { include: { product: { select: { costPrice: true } } } },
                    fabricRolls: {
                        where: { status: { in: ["AVAILABLE", "RESERVED", "IN_USE"] } },
                        select: { lengthMeters: true },
                    },
                    _count: { select: { stockLevels: true } },
                },
            }),
        ])

        const audits = auditTransactions.map((tx) => {
            let auditor = "System"
            let systemQty = 0
            let actualQty = 0

            if (tx.notes) {
                const auditorMatch = tx.notes.match(/Spot Audit by (.*?)\./)
                if (auditorMatch) auditor = auditorMatch[1]
                const sysMatch = tx.notes.match(/System:\s*(\d+)/)
                if (sysMatch) systemQty = parseInt(sysMatch[1])
                const actMatch = tx.notes.match(/Actual:\s*(\d+)/)
                if (actMatch) actualQty = parseInt(actMatch[1])
            }

            return {
                id: tx.id,
                productName: tx.product.name,
                warehouse: tx.warehouse.name,
                category: tx.product.category?.name || "Uncategorized",
                systemQty,
                actualQty,
                auditor,
                date: tx.createdAt,
                status: actualQty === systemQty ? "MATCH" : "DISCREPANCY",
            }
        })

        const products = rawProducts.map((p) => {
            const totalStock = p.stockLevels.reduce((sum, sl) => sum + Number(sl.quantity), 0)
            const status = calculateProductStatus({
                totalStock,
                minStock: p.minStock,
                reorderLevel: p.reorderLevel,
                manualAlert: p.manualAlert,
                createdAt: p.createdAt,
            })
            return JSON.parse(JSON.stringify({
                ...p,
                costPrice: Number(p.costPrice),
                sellingPrice: p.sellingPrice === null || p.sellingPrice === undefined ? null : Number(p.sellingPrice),
                category: p.category,
                totalStock,
                currentStock: totalStock,
                status,
                image: "/placeholder.png",
            }))
        })

        const managerIds = rawWarehouses.map((w) => w.managerId).filter(Boolean) as string[]
        // Phone (PII per UU PDP 27/2022) is intentionally NOT selected here.
        // Manager-only views must fetch via a role-guarded endpoint.
        const managers = managerIds.length
            ? await prisma.employee.findMany({
                where: { id: { in: managerIds } },
                select: { id: true, firstName: true, lastName: true },
            })
            : []

        const warehouses = rawWarehouses.map((w) => {
            const manager = managers.find((m) => m.id === w.managerId)
            const managerName = manager ? `${manager.firstName} ${manager.lastName || ""}`.trim() : "Unassigned"
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
            }
        })

        return NextResponse.json({ audits, products, warehouses })
    } catch (e) {
        console.error("[API] audit-data:", e)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
