import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { normalizeAPAgingSummary } from "@/lib/ap-aging"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const invoices = await prisma.invoice.findMany({
            where: { type: "INV_IN", status: { in: ["ISSUED", "PARTIAL", "OVERDUE"] } },
            include: { supplier: { select: { id: true, name: true, code: true } } },
            orderBy: { dueDate: "asc" },
        })

        const now = new Date()
        const summary = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0, totalOutstanding: 0 }
        const bySupplier: Record<string, {
            supplierId: string; supplierName: string;
            current: number; d1_30: number; d31_60: number;
            d61_90: number; d90_plus: number; total: number; billCount: number;
        }> = {}

        for (const inv of invoices) {
            const due = Number(inv.balanceDue || 0)
            const daysOverdue = inv.dueDate
                ? Math.floor((now.getTime() - inv.dueDate.getTime()) / 86400000)
                : 0

            let bucket: "current" | "d1_30" | "d31_60" | "d61_90" | "d90_plus"
            if (daysOverdue <= 0) { bucket = "current"; summary.current += due }
            else if (daysOverdue <= 30) { bucket = "d1_30"; summary.d1_30 += due }
            else if (daysOverdue <= 60) { bucket = "d31_60"; summary.d31_60 += due }
            else if (daysOverdue <= 90) { bucket = "d61_90"; summary.d61_90 += due }
            else { bucket = "d90_plus"; summary.d90_plus += due }
            summary.totalOutstanding += due

            const suppId = inv.supplierId || "unknown"
            if (!bySupplier[suppId]) {
                bySupplier[suppId] = {
                    supplierId: suppId, supplierName: inv.supplier?.name || "Unknown",
                    current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0, total: 0, billCount: 0,
                }
            }
            bySupplier[suppId][bucket] += due
            bySupplier[suppId].total += due
            bySupplier[suppId].billCount++
        }

        return NextResponse.json({
            summary: normalizeAPAgingSummary(summary),
            bySupplier: Object.values(bySupplier),
            details: invoices.map(i => ({
                id: i.id, number: i.number, supplierId: i.supplierId,
                supplierName: i.supplier?.name, amount: Number(i.balanceDue || 0),
                dueDate: i.dueDate,
                daysOverdue: i.dueDate ? Math.max(0, Math.floor((now.getTime() - i.dueDate.getTime()) / 86400000)) : 0,
            })).sort((a, b) => b.daysOverdue - a.daysOverdue),
        })
    } catch (error) {
        console.error("[API] finance/payables-data error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
