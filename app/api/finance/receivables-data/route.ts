import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const invoices = await prisma.invoice.findMany({
            where: { type: "INV_OUT", status: { in: ["ISSUED", "PARTIAL", "OVERDUE"] } },
            select: {
                id: true, number: true, balanceDue: true, dueDate: true, customerId: true,
                customer: { select: { id: true, name: true, code: true } },
            },
            orderBy: { dueDate: "asc" },
            take: 500,
        })

        const now = new Date()
        const summary = { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, days90plus: 0, total: 0 }
        const byCustomer: Record<string, {
            customerId: string; customerName: string;
            current: number; days1to30: number; days31to60: number;
            days61to90: number; days90plus: number; total: number; billCount: number;
        }> = {}

        for (const inv of invoices) {
            const due = Number(inv.balanceDue || 0)
            const daysOverdue = inv.dueDate
                ? Math.floor((now.getTime() - inv.dueDate.getTime()) / 86400000)
                : 0

            let bucket: "current" | "days1to30" | "days31to60" | "days61to90" | "days90plus"
            if (daysOverdue <= 0) { bucket = "current"; summary.current += due }
            else if (daysOverdue <= 30) { bucket = "days1to30"; summary.days1to30 += due }
            else if (daysOverdue <= 60) { bucket = "days31to60"; summary.days31to60 += due }
            else if (daysOverdue <= 90) { bucket = "days61to90"; summary.days61to90 += due }
            else { bucket = "days90plus"; summary.days90plus += due }
            summary.total += due

            const custId = inv.customerId || "unknown"
            if (!byCustomer[custId]) {
                byCustomer[custId] = {
                    customerId: custId, customerName: inv.customer?.name || "Unknown",
                    current: 0, days1to30: 0, days31to60: 0, days61to90: 0, days90plus: 0, total: 0, billCount: 0,
                }
            }
            byCustomer[custId][bucket] += due
            byCustomer[custId].total += due
            byCustomer[custId].billCount++
        }

        return NextResponse.json({
            summary,
            byCustomer: Object.values(byCustomer),
            details: invoices.map(i => ({
                id: i.id, number: i.number, customerId: i.customerId,
                customerName: i.customer?.name, amount: Number(i.balanceDue || 0),
                dueDate: i.dueDate,
                daysOverdue: i.dueDate ? Math.max(0, Math.floor((now.getTime() - i.dueDate.getTime()) / 86400000)) : 0,
            })).sort((a, b) => b.daysOverdue - a.daysOverdue),
        })
    } catch (error) {
        console.error("[API] finance/receivables-data error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
