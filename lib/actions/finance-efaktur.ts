'use server'

import { prisma, withPrismaAuth } from "@/lib/db"
import { PrismaClient } from "@prisma/client"
import { createClient } from "@/lib/supabase/server"

// Pure functions and types moved to helper file for "use server" compatibility
// (detectKodeTransaksi is unused while the NSFP feature is unimplemented — see note below)
import {
    invoiceToEFakturRow,
    generateEFakturCSV,
} from "@/lib/finance-efaktur-helpers"

async function requireAuth() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new Error("Unauthorized")
    return user
}

// Re-export types for consumers (type exports are allowed in "use server" files)
export type { EFakturInvoice, EFakturCSVRow, KodeTransaksiCustomer } from "@/lib/finance-efaktur-helpers"

/**
 * ============================================================================
 * NSFP / FAKTUR PAJAK PERSISTENCE — NOT IMPLEMENTED (no database schema)
 * ============================================================================
 *
 * The Invoice model in prisma/schema.prisma has NO `kodeTransaksi`,
 * `nsfpNumber` or `fakturPajakDate` columns, and there is NO `NSFPRange` model
 * (verified: zero matches for "nsfp" in the schema, and no migration for it).
 *
 * Consequences, kept explicit on purpose:
 *   - The CSV export below still works, but the three faktur-pajak fields are
 *     always null (previously they read undefined off the Prisma row, which is
 *     exactly the same value — no behaviour change, just no longer a lie in
 *     the type system).
 *   - Anything that must PERSIST an NSFP or kode transaksi cannot work at all.
 *     Those entry points now fail fast with the message below instead of
 *     crashing inside Prisma with "Unknown argument"/"cannot read property of
 *     undefined".
 *
 * TODO(schema): add `model NSFPRange { year, startNumber BigInt, endNumber
 * BigInt, currentCounter BigInt, status }` and the three Invoice columns, run a
 * migration, then restore the allocation logic (algorithm preserved in the
 * reference comment at the bottom of this file).
 */
const NSFP_NOT_IMPLEMENTED =
    'Fitur NSFP / Faktur Pajak belum tersedia — model NSFPRange dan kolom Invoice ' +
    '(nsfpNumber, kodeTransaksi, fakturPajakDate) belum ada di database schema.'

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
    kodeTransaksi: string | null
    nsfpNumber: string | null
    fakturPajakDate: string | null
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
            // Not persisted yet — see NSFP_NOT_IMPLEMENTED note above.
            kodeTransaksi: null,
            nsfpNumber: null,
            fakturPajakDate: null,
        }))
    } catch (error) {
        console.error("[getEFakturEligibleInvoices] failed:", error)
        throw error
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
                        // Not persisted yet — see NSFP_NOT_IMPLEMENTED note above.
                        // invoiceToEFakturRow falls back to kode '01' and a zero-filled
                        // nomor faktur, which is what happened before as well.
                        kodeTransaksi: null,
                        nsfpNumber: null,
                        fakturPajakDate: null,
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

// ==============================================================================
// NSFP Allocation — NOT IMPLEMENTED (see NSFP_NOT_IMPLEMENTED note at top)
// ==============================================================================

/**
 * Allocate an NSFP (Nomor Seri Faktur Pajak) to an invoice.
 *
 * The NSFP is a 17-digit number issued by DJP (Direktorat Jenderal Pajak):
 *   - Digits 1-2: Kode Transaksi (e.g., 01, 02, 07)
 *   - Digits 3-4: Kode Status (00 = normal, 01 = replacement)
 *   - Digits 5-17: 13-digit serial number from DJP range
 *
 * UNIMPLEMENTED: requires the NSFPRange model and Invoice.nsfpNumber /
 * Invoice.kodeTransaksi / Invoice.fakturPajakDate columns. Returns a failure
 * result (the shape callers already handle) instead of silently doing nothing.
 */
export async function allocateNSFP(_invoiceId: string): Promise<{
    success: boolean
    nsfpNumber?: string
    error?: string
}> {
    console.error('[allocateNSFP]', NSFP_NOT_IMPLEMENTED)
    return { success: false, error: NSFP_NOT_IMPLEMENTED }
}

/**
 * Batch-allocate NSFP to multiple invoices at once.
 *
 * UNIMPLEMENTED — see allocateNSFP.
 */
export async function allocateNSFPBatch(invoiceIds: string[]): Promise<{
    success: boolean
    results?: { invoiceId: string; nsfpNumber?: string; error?: string }[]
    error?: string
}> {
    if (invoiceIds.length === 0) {
        return { success: false, error: 'Pilih minimal 1 invoice' }
    }
    console.error('[allocateNSFPBatch]', NSFP_NOT_IMPLEMENTED)
    return {
        success: false,
        error: NSFP_NOT_IMPLEMENTED,
        results: invoiceIds.map((invoiceId) => ({ invoiceId, error: NSFP_NOT_IMPLEMENTED })),
    }
}

/**
 * Detect and set kode transaksi for an invoice based on customer profile.
 *
 * The detection itself (detectKodeTransaksi) is pure and still works, but there
 * is nowhere to store the result: Invoice has no kodeTransaksi column.
 * UNIMPLEMENTED until that column exists.
 */
export async function detectAndSetKodeTransaksi(_invoiceId: string): Promise<{
    success: boolean
    kodeTransaksi?: string
    error?: string
}> {
    console.error('[detectAndSetKodeTransaksi]', NSFP_NOT_IMPLEMENTED)
    return { success: false, error: NSFP_NOT_IMPLEMENTED }
}

// ==============================================================================
// NSFP Range Management — NOT IMPLEMENTED (no NSFPRange model)
// ==============================================================================

/**
 * Add a new NSFP range (received from DJP).
 *
 * UNIMPLEMENTED: there is no NSFPRange model to persist into.
 */
export async function addNSFPRange(_input: {
    year: number
    startNumber: string // e.g., "0000000000001"
    endNumber: string   // e.g., "0000000000100"
}): Promise<{ success: boolean; id?: string; error?: string }> {
    console.error('[addNSFPRange]', NSFP_NOT_IMPLEMENTED)
    return { success: false, error: NSFP_NOT_IMPLEMENTED }
}

/**
 * Get all NSFP ranges with usage stats.
 *
 * UNIMPLEMENTED: there is no NSFPRange model to read from. This throws rather
 * than returning [] so the UI cannot mistake "feature missing" for "no ranges
 * registered yet".
 */
export async function getNSFPRanges(): Promise<never> {
    throw new Error(NSFP_NOT_IMPLEMENTED)
}

/* ---------------------------------------------------------------------------
 * REFERENCE — NSFP allocation algorithm, kept for when the schema lands.
 *
 *   Inside a $transaction:
 *   1. Load invoice (+ customer + primary address); require type INV_OUT and
 *      reject when invoice.nsfpNumber is already set.
 *   2. kodeTransaksi = invoice.kodeTransaksi ?? detectKodeTransaksi({
 *        customerType, taxStatus, country: primaryAddress.country })
 *   3. range = first NSFPRange for the current year with status ACTIVE,
 *      ordered by startNumber asc. Error when none exists.
 *   4. nextCounter = range.currentCounter + 1n. When nextCounter > range.endNumber,
 *      set range.status = 'EXHAUSTED' and error ("range habis").
 *   5. Persist range.currentCounter = nextCounter, and set status EXHAUSTED when
 *      nextCounter === range.endNumber.
 *   6. nsfpNumber = kodeTransaksi(2) + kodeStatus '00'(2) + String(nextCounter)
 *      padStart(13, '0')  → 17 digits.
 *   7. Update the invoice: nsfpNumber, kodeTransaksi,
 *      fakturPajakDate = invoice.fakturPajakDate ?? invoice.issueDate.
 *
 *   Range stats (getNSFPRanges): total = endNumber - startNumber + 1,
 *   used = currentCounter - startNumber + 1, remaining = max(0, total - used).
 * ------------------------------------------------------------------------- */
