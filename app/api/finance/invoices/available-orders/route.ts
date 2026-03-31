import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

/**
 * GET /api/finance/invoices/available-orders
 *
 * Returns all data the "Buat Invoice" dialog needs in ONE request:
 * - customers & suppliers (for manual invoice)
 * - revenue/expense/cash GL accounts (for COA picker)
 * - pending Sales Orders (not yet invoiced)
 * - pending Purchase Orders (not yet billed)
 *
 * Uses prisma singleton directly (no $transaction) to avoid pool exhaustion.
 */
export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const [
            customers,
            suppliers,
            expenseAccounts,
            revenueAccounts,
            pendingSOs,
            pendingPOs,
        ] = await Promise.all([
            // Active customers
            prisma.customer.findMany({
                select: { id: true, name: true },
                where: { isActive: true },
                orderBy: { name: "asc" },
                take: 200,
            }),
            // Active suppliers
            prisma.supplier.findMany({
                select: { id: true, name: true },
                where: { isActive: true },
                orderBy: { name: "asc" },
                take: 200,
            }),
            // Expense accounts
            prisma.gLAccount.findMany({
                where: { type: "EXPENSE" },
                select: { id: true, code: true, name: true },
                orderBy: { code: "asc" },
            }),
            // Revenue accounts
            prisma.gLAccount.findMany({
                where: { type: "REVENUE" },
                select: { id: true, code: true, name: true },
                orderBy: { code: "asc" },
            }),
            // Pending Sales Orders (not yet invoiced with active INV_OUT)
            prisma.salesOrder.findMany({
                where: {
                    status: { in: ["CONFIRMED", "IN_PROGRESS", "DELIVERED", "COMPLETED"] },
                    invoices: {
                        none: {
                            type: "INV_OUT",
                            status: { notIn: ["CANCELLED", "VOID"] },
                        },
                    },
                },
                include: {
                    customer: { select: { id: true, name: true } },
                    items: {
                        select: {
                            id: true,
                            description: true,
                            quantity: true,
                            unitPrice: true,
                            product: { select: { name: true, code: true } },
                        },
                    },
                },
                orderBy: { orderDate: "desc" },
                take: 100,
            }),
            // Pending Purchase Orders (not yet billed with active INV_IN)
            prisma.purchaseOrder.findMany({
                where: {
                    status: { in: ["RECEIVED", "ORDERED", "APPROVED"] },
                    invoices: {
                        none: {
                            type: "INV_IN",
                            status: { notIn: ["CANCELLED", "VOID"] },
                        },
                    },
                },
                include: {
                    supplier: { select: { id: true, name: true } },
                    items: {
                        select: {
                            id: true,
                            quantity: true,
                            unitPrice: true,
                            product: { select: { name: true, code: true } },
                        },
                    },
                },
                orderBy: { orderDate: "desc" },
                take: 100,
            }),
        ])

        // Shape customers + suppliers into a unified list with type tag
        const parties = [
            ...customers.map((c) => ({ id: c.id, name: c.name, type: "CUSTOMER" as const })),
            ...suppliers.map((s) => ({ id: s.id, name: s.name, type: "SUPPLIER" as const })),
        ]

        // Shape accounts
        const accounts = [...revenueAccounts, ...expenseAccounts]

        // Shape pending SOs
        const salesOrders = pendingSOs.map((o) => ({
            id: o.id,
            number: o.number,
            customerName: o.customer?.name || "Unknown",
            amount: Number(o.total),
            date: o.orderDate,
            items: o.items.map((i) => ({
                id: i.id,
                productName: i.product?.name || i.description || "-",
                sku: i.product?.code,
                quantity: Number(i.quantity),
                unitPrice: Number(i.unitPrice),
            })),
        }))

        // Shape pending POs
        const purchaseOrders = pendingPOs.map((o) => ({
            id: o.id,
            number: o.number,
            vendorName: o.supplier?.name || "Unknown",
            amount: Number(o.totalAmount),
            date: o.orderDate,
            items: o.items.map((i) => ({
                id: i.id,
                productName: i.product?.name || "-",
                sku: i.product?.code,
                quantity: Number(i.quantity),
                unitPrice: Number(i.unitPrice),
            })),
        }))

        return NextResponse.json({
            parties,
            accounts,
            salesOrders,
            purchaseOrders,
        })
    } catch (err) {
        console.error("[available-orders] Error:", err)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
