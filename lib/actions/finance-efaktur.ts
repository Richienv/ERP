'use server'

import { prisma, withPrismaAuth } from "@/lib/db"
import { PrismaClient } from "@prisma/client"
import { createClient } from "@/lib/supabase/server"

// Pure functions and types moved to helper file for "use server" compatibility
import { invoiceToEFakturRow, generateEFakturCSV } from "@/lib/finance-efaktur-helpers"

async function requireAuth() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new Error("Unauthorized")
    return user
}

// Re-export types for consumers (type exports are allowed in "use server" files)
export type { EFakturInvoice, EFakturCSVRow } from "@/lib/finance-efaktur-helpers"

// ==============================================================================
// Server Actions
// ==============================================================================

/**
 * Get invoices eligible for e-Faktur export (customer invoices with issued/paid status).
 * Read-only — use singleton prisma.
 */
export async function getEFakturEligibleInvoices(): Promise<{
    id: string
    number: string
    customerName: string
    customerNpwp: string | null
    issueDate: string
    dppAmount: number
    ppnAmount: number
    totalAmount: number
    status: string
}[]> {
    try {
        await requireAuth()

        const invoices = await prisma.invoice.findMany({
            where: {
                type: 'INV_OUT',
                status: { in: ['ISSUED', 'PAID', 'PARTIAL'] },
            },
            include: {
                customer: { select: { name: true, npwp: true } },
            },
            orderBy: { issueDate: 'desc' },
            take: 200,
        })

        return invoices.map((inv) => ({
            id: inv.id,
            number: inv.number,
            customerName: inv.customer?.name || 'Unknown',
            customerNpwp: inv.customer?.npwp || null,
            issueDate: inv.issueDate.toISOString(),
            dppAmount: Number(inv.subtotal),
            ppnAmount: Number(inv.taxAmount),
            totalAmount: Number(inv.totalAmount),
            status: inv.status,
        }))
    } catch (error) {
        console.error("[getEFakturEligibleInvoices] Error:", error)
        return []
    }
}

/**
 * Export selected invoices to e-Faktur CSV format.
 */
export async function exportEFakturCSV(
    invoiceIds: string[]
): Promise<{ success: boolean; csv?: string; error?: string }> {
    if (invoiceIds.length === 0) {
        return { success: false, error: 'Pilih minimal 1 invoice untuk di-export' }
    }

    try {
        const csv = await withPrismaAuth(async (prisma: PrismaClient) => {
            const invoices = await prisma.invoice.findMany({
                where: {
                    id: { in: invoiceIds },
                    type: 'INV_OUT',
                },
                include: {
                    customer: {
                        include: {
                            addresses: {
                                select: { address1: true, kabupaten: true, provinsi: true },
                                take: 1,
                            },
                        },
                    },
                },
            })

            const rows = invoices.map((inv) => {
                const addr = inv.customer?.addresses?.[0]
                const fullAddress = addr
                    ? [addr.address1, addr.kabupaten, addr.provinsi].filter(Boolean).join(', ')
                    : '-'

                return invoiceToEFakturRow(
                    {
                        id: inv.id,
                        number: inv.number,
                        customerName: inv.customer?.name || 'Unknown',
                        customerNpwp: inv.customer?.npwp || null,
                        issueDate: inv.issueDate.toISOString(),
                        dppAmount: Number(inv.subtotal),
                        ppnAmount: Number(inv.taxAmount),
                        totalAmount: Number(inv.totalAmount),
                        status: inv.status,
                    },
                    fullAddress
                )
            })

            return generateEFakturCSV(rows)
        })

        return { success: true, csv }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal mengekspor e-Faktur'
        console.error("[exportEFakturCSV] Error:", error)
        return { success: false, error: msg }
    }
}
