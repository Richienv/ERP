'use server'

import { prisma, withPrismaAuth } from "@/lib/db"
import { PrismaClient } from "@prisma/client"
import { createClient } from "@/lib/supabase/server"

// Pure functions and types moved to helper file for "use server" compatibility
import {
    invoiceToEFakturRow,
    generateEFakturCSV,
    detectKodeTransaksi,
} from "@/lib/finance-efaktur-helpers"

async function requireAuth() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new Error("Unauthorized")
    return user
}

// Re-export types for consumers (type exports are allowed in "use server" files)
export type { EFakturInvoice, EFakturCSVRow, KodeTransaksiCustomer } from "@/lib/finance-efaktur-helpers"

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
            kodeTransaksi: inv.kodeTransaksi || null,
            nsfpNumber: inv.nsfpNumber || null,
            fakturPajakDate: inv.fakturPajakDate?.toISOString() || null,
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
                        kodeTransaksi: inv.kodeTransaksi || null,
                        nsfpNumber: inv.nsfpNumber || null,
                        fakturPajakDate: inv.fakturPajakDate?.toISOString() || null,
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
// NSFP Allocation
// ==============================================================================

/**
 * Allocate an NSFP (Nomor Seri Faktur Pajak) to an invoice.
 *
 * The NSFP is a 17-digit number issued by DJP (Direktorat Jenderal Pajak):
 *   - Digits 1-2: Kode Transaksi (e.g., 01, 02, 07)
 *   - Digits 3-4: Kode Status (00 = normal, 01 = replacement)
 *   - Digits 5-17: 13-digit serial number from DJP range
 *
 * This function:
 * 1. Finds the active NSFP range for the current year
 * 2. Atomically increments the counter
 * 3. Builds the full 17-digit NSFP
 * 4. Updates the invoice with the NSFP and kode transaksi
 * 5. Marks range as EXHAUSTED when depleted
 */
export async function allocateNSFP(invoiceId: string): Promise<{
    success: boolean
    nsfpNumber?: string
    error?: string
}> {
    try {
        await requireAuth()

        const result = await prisma.$transaction(async (tx) => {
            // 1. Load the invoice with customer data for kode transaksi detection
            const invoice = await tx.invoice.findUnique({
                where: { id: invoiceId },
                include: {
                    customer: {
                        include: {
                            addresses: {
                                where: { isPrimary: true },
                                take: 1,
                            },
                        },
                    },
                },
            })

            if (!invoice) {
                throw new Error('Invoice tidak ditemukan')
            }

            if (invoice.type !== 'INV_OUT') {
                throw new Error('NSFP hanya untuk invoice penjualan (INV_OUT)')
            }

            if (invoice.nsfpNumber) {
                throw new Error(`Invoice sudah memiliki NSFP: ${invoice.nsfpNumber}`)
            }

            // 2. Auto-detect kode transaksi from customer profile
            const primaryAddr = invoice.customer?.addresses?.[0]
            const kodeTransaksi = invoice.kodeTransaksi || detectKodeTransaksi({
                customerType: invoice.customer?.customerType || null,
                taxStatus: invoice.customer?.taxStatus || null,
                country: primaryAddr?.country || null,
            })

            // 3. Find active NSFP range for current year
            const currentYear = new Date().getFullYear()
            const range = await tx.nSFPRange.findFirst({
                where: {
                    year: currentYear,
                    status: 'ACTIVE',
                },
                orderBy: { startNumber: 'asc' },
            })

            if (!range) {
                throw new Error(
                    `Tidak ada range NSFP aktif untuk tahun ${currentYear}. ` +
                    `Silakan input range NSFP dari DJP terlebih dahulu.`
                )
            }

            // 4. Increment counter atomically
            const nextCounter = range.currentCounter + BigInt(1)

            if (nextCounter > range.endNumber) {
                // Mark as exhausted and try next range
                await tx.nSFPRange.update({
                    where: { id: range.id },
                    data: { status: 'EXHAUSTED' },
                })
                throw new Error(
                    `Range NSFP ${range.startNumber}-${range.endNumber} sudah habis. ` +
                    `Silakan tambah range baru dari DJP.`
                )
            }

            // Update counter
            await tx.nSFPRange.update({
                where: { id: range.id },
                data: {
                    currentCounter: nextCounter,
                    // Auto-exhaust if this was the last number
                    ...(nextCounter === range.endNumber ? { status: 'EXHAUSTED' } : {}),
                },
            })

            // 5. Build 17-digit NSFP: kodeTransaksi(2) + kodeStatus(2) + serial(13)
            const kodeStatus = '00' // 00 = normal, 01 = pengganti
            const serialNumber = String(nextCounter).padStart(13, '0')
            const nsfpNumber = `${kodeTransaksi}${kodeStatus}${serialNumber}`

            // 6. Update invoice
            await tx.invoice.update({
                where: { id: invoiceId },
                data: {
                    nsfpNumber,
                    kodeTransaksi,
                    fakturPajakDate: invoice.fakturPajakDate || invoice.issueDate,
                },
            })

            return nsfpNumber
        })

        return { success: true, nsfpNumber: result }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal mengalokasikan NSFP'
        console.error("[allocateNSFP] Error:", error)
        return { success: false, error: msg }
    }
}

/**
 * Batch-allocate NSFP to multiple invoices at once.
 */
export async function allocateNSFPBatch(invoiceIds: string[]): Promise<{
    success: boolean
    results?: { invoiceId: string; nsfpNumber?: string; error?: string }[]
    error?: string
}> {
    if (invoiceIds.length === 0) {
        return { success: false, error: 'Pilih minimal 1 invoice' }
    }

    try {
        await requireAuth()

        const results: { invoiceId: string; nsfpNumber?: string; error?: string }[] = []

        // Process sequentially to maintain NSFP ordering
        for (const invoiceId of invoiceIds) {
            const result = await allocateNSFP(invoiceId)
            results.push({
                invoiceId,
                nsfpNumber: result.nsfpNumber,
                error: result.error,
            })
        }

        const allSuccess = results.every((r) => !r.error)
        return { success: allSuccess, results }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal mengalokasikan NSFP batch'
        console.error("[allocateNSFPBatch] Error:", error)
        return { success: false, error: msg }
    }
}

/**
 * Detect and set kode transaksi for an invoice based on customer profile.
 * Does NOT allocate NSFP — only sets the kode transaksi field.
 */
export async function detectAndSetKodeTransaksi(invoiceId: string): Promise<{
    success: boolean
    kodeTransaksi?: string
    error?: string
}> {
    try {
        await requireAuth()

        const invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId },
            include: {
                customer: {
                    include: {
                        addresses: {
                            where: { isPrimary: true },
                            take: 1,
                        },
                    },
                },
            },
        })

        if (!invoice) {
            return { success: false, error: 'Invoice tidak ditemukan' }
        }

        const primaryAddr = invoice.customer?.addresses?.[0]
        const kodeTransaksi = detectKodeTransaksi({
            customerType: invoice.customer?.customerType || null,
            taxStatus: invoice.customer?.taxStatus || null,
            country: primaryAddr?.country || null,
        })

        await prisma.invoice.update({
            where: { id: invoiceId },
            data: { kodeTransaksi },
        })

        return { success: true, kodeTransaksi }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal mendeteksi kode transaksi'
        console.error("[detectAndSetKodeTransaksi] Error:", error)
        return { success: false, error: msg }
    }
}

// ==============================================================================
// NSFP Range Management
// ==============================================================================

/**
 * Add a new NSFP range (received from DJP).
 * Called when the admin inputs a new batch of NSFP numbers.
 */
export async function addNSFPRange(input: {
    year: number
    startNumber: string // e.g., "0000000000001"
    endNumber: string   // e.g., "0000000000100"
}): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
        await requireAuth()

        const start = BigInt(input.startNumber.replace(/\D/g, ''))
        const end = BigInt(input.endNumber.replace(/\D/g, ''))

        if (start <= 0 || end <= 0) {
            return { success: false, error: 'Nomor awal dan akhir harus lebih dari 0' }
        }
        if (start > end) {
            return { success: false, error: 'Nomor awal harus lebih kecil dari nomor akhir' }
        }

        const range = await prisma.nSFPRange.create({
            data: {
                year: input.year,
                startNumber: start,
                endNumber: end,
                currentCounter: start - BigInt(1), // So first allocation gives startNumber
                status: 'ACTIVE',
            },
        })

        return { success: true, id: range.id }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal menambah range NSFP'
        console.error("[addNSFPRange] Error:", error)
        return { success: false, error: msg }
    }
}

/**
 * Get all NSFP ranges with usage stats.
 */
export async function getNSFPRanges(): Promise<{
    id: string
    year: number
    startNumber: string
    endNumber: string
    currentCounter: string
    used: number
    total: number
    remaining: number
    status: string
}[]> {
    try {
        await requireAuth()

        const ranges = await prisma.nSFPRange.findMany({
            orderBy: [{ year: 'desc' }, { startNumber: 'asc' }],
        })

        return ranges.map((r) => {
            const total = Number(r.endNumber - r.startNumber) + 1
            const used = Number(r.currentCounter - r.startNumber) + 1
            const remaining = Math.max(0, total - used)
            return {
                id: r.id,
                year: r.year,
                startNumber: String(r.startNumber).padStart(13, '0'),
                endNumber: String(r.endNumber).padStart(13, '0'),
                currentCounter: String(r.currentCounter).padStart(13, '0'),
                used: Math.max(0, used),
                total,
                remaining,
                status: r.status,
            }
        })
    } catch (error) {
        console.error("[getNSFPRanges] failed:", error)
        throw error
    }
}
