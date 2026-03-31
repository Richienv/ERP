import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"

async function requireAuth() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new Error("Unauthorized")
    return user
}

export const dynamic = "force-dynamic"

// Valid status transitions for Sales Order lifecycle.
// Designed for Phase 2 extension — cross-module side effects
// will be added inside the $transaction below.
const VALID_TRANSITIONS: Record<string, string[]> = {
    DRAFT:       ["CONFIRMED", "CANCELLED"],
    CONFIRMED:   ["IN_PROGRESS", "DELIVERED", "CANCELLED"], // DELIVERED = skip production (stock exists)
    IN_PROGRESS: ["DELIVERED", "CANCELLED"],
    DELIVERED:   ["INVOICED", "COMPLETED"],
    INVOICED:    ["COMPLETED"],
    // COMPLETED and CANCELLED are terminal states
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await requireAuth()
        const { id } = await params
        const body = await request.json()
        const { targetStatus, note } = body

        if (!targetStatus) {
            return NextResponse.json(
                { error: "targetStatus wajib diisi" },
                { status: 400 }
            )
        }

        // Use $transaction from day one — Phase 2 will add side effects inside it
        const result = await prisma.$transaction(async (tx) => {
            const so = await tx.salesOrder.findUnique({
                where: { id },
                include: {
                    items: { include: { product: true } },
                    customer: true,
                },
            })

            if (!so) {
                throw new Error("Pesanan tidak ditemukan")
            }

            const allowed = VALID_TRANSITIONS[so.status] || []
            if (!allowed.includes(targetStatus)) {
                throw new Error(
                    `Transisi tidak valid: ${so.status} \u2192 ${targetStatus}. ` +
                    `Diizinkan: ${allowed.join(", ") || "tidak ada (status terminal)"}`
                )
            }

            const updateData: Record<string, unknown> = {
                status: targetStatus,
            }

            // Set confirmedDate when confirming
            if (targetStatus === "CONFIRMED") {
                updateData.confirmedDate = new Date()
            }

            // Append note to internalNotes if provided
            if (note) {
                const timestamp = new Date().toISOString()
                const existing = so.internalNotes || ""
                updateData.internalNotes = existing
                    ? `${existing}\n[${timestamp}] ${so.status}\u2192${targetStatus}: ${note}`
                    : `[${timestamp}] ${so.status}\u2192${targetStatus}: ${note}`
            }

            const updated = await tx.salesOrder.update({
                where: { id },
                data: updateData,
                include: {
                    items: { include: { product: true } },
                    customer: true,
                },
            })

            // PHASE 2 HOOKS WILL GO HERE:
            // if (targetStatus === 'DELIVERED') { /* decrease inventory, stock movement, COGS GL journal */ }
            // if (targetStatus === 'INVOICED') { /* auto-create Invoice DRAFT in Finance */ }

            return updated
        })

        return NextResponse.json({
            success: true,
            data: {
                ...result,
                subtotal: Number(result.subtotal) || 0,
                taxAmount: Number(result.taxAmount) || 0,
                total: Number(result.total) || 0,
                items: result.items.map((item) => ({
                    ...item,
                    quantity: Number(item.quantity) || 0,
                    unitPrice: Number(item.unitPrice) || 0,
                    lineTotal: Number(item.lineTotal) || 0,
                })),
            },
        })
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        console.error("[SO Transition]", message)
        return NextResponse.json(
            { error: message },
            { status: message.includes("tidak ditemukan") ? 404 : 400 }
        )
    }
}
