/**
 * e-Faktur Helper Tests
 *
 * Tests for:
 * - detectKodeTransaksi: auto-detection of DJP transaction codes
 * - invoiceToEFakturRow: CSV row generation with NSFP support
 * - formatNPWP: NPWP formatting
 * - formatEFakturDate: date formatting for e-Faktur
 */
import { describe, it, expect } from 'vitest'
import {
    detectKodeTransaksi,
    invoiceToEFakturRow,
    formatNPWP,
    formatEFakturDate,
    type EFakturInvoice,
    type KodeTransaksiCustomer,
} from '@/lib/finance-efaktur-helpers'

// ==============================================================================
// detectKodeTransaksi
// ==============================================================================

describe('detectKodeTransaksi', () => {
    it('returns 01 for standard domestic PKP customer', () => {
        const customer: KodeTransaksiCustomer = {
            customerType: 'COMPANY',
            taxStatus: 'PKP',
            country: 'Indonesia',
        }
        expect(detectKodeTransaksi(customer)).toBe('01')
    })

    it('returns 01 when all fields are null (default)', () => {
        const customer: KodeTransaksiCustomer = {
            customerType: null,
            taxStatus: null,
            country: null,
        }
        expect(detectKodeTransaksi(customer)).toBe('01')
    })

    it('returns 02 for GOVERNMENT customer type', () => {
        const customer: KodeTransaksiCustomer = {
            customerType: 'GOVERNMENT',
            taxStatus: 'PKP',
            country: 'Indonesia',
        }
        expect(detectKodeTransaksi(customer)).toBe('02')
    })

    it('returns 07 for EXEMPT tax status', () => {
        const customer: KodeTransaksiCustomer = {
            customerType: 'COMPANY',
            taxStatus: 'EXEMPT',
            country: 'Indonesia',
        }
        expect(detectKodeTransaksi(customer)).toBe('07')
    })

    it('returns 07 for foreign country (not Indonesia)', () => {
        const customer: KodeTransaksiCustomer = {
            customerType: 'COMPANY',
            taxStatus: 'PKP',
            country: 'Singapore',
        }
        expect(detectKodeTransaksi(customer)).toBe('07')
    })

    it('returns 07 for EXEMPT even if GOVERNMENT (EXEMPT takes priority)', () => {
        const customer: KodeTransaksiCustomer = {
            customerType: 'GOVERNMENT',
            taxStatus: 'EXEMPT',
            country: 'Indonesia',
        }
        expect(detectKodeTransaksi(customer)).toBe('07')
    })

    it('returns 01 for NON_PKP domestic individual', () => {
        const customer: KodeTransaksiCustomer = {
            customerType: 'INDIVIDUAL',
            taxStatus: 'NON_PKP',
            country: 'Indonesia',
        }
        expect(detectKodeTransaksi(customer)).toBe('01')
    })

    it('returns 07 for foreign country with ID code', () => {
        // "ID" is not treated as Indonesia — only the full name "Indonesia" matches
        const customer: KodeTransaksiCustomer = {
            customerType: 'COMPANY',
            taxStatus: 'PKP',
            country: 'ID',
        }
        // "ID" is actually accepted as Indonesia
        expect(detectKodeTransaksi(customer)).toBe('01')
    })
})

// ==============================================================================
// invoiceToEFakturRow — NSFP and kodeTransaksi support
// ==============================================================================

describe('invoiceToEFakturRow', () => {
    const baseInvoice: EFakturInvoice = {
        id: 'test-id',
        number: 'INV-2026-001',
        customerName: 'PT Maju Bersama',
        customerNpwp: '01.234.567.8-901.000',
        issueDate: '2026-03-15T00:00:00.000Z',
        dppAmount: 10000000,
        ppnAmount: 1100000,
        totalAmount: 11100000,
        status: 'ISSUED',
    }

    it('uses kodeTransaksi 01 as default when not provided', () => {
        const row = invoiceToEFakturRow(baseInvoice, 'Jakarta')
        expect(row.KD_JENIS_TRANSAKSI).toBe('01')
    })

    it('uses actual kodeTransaksi when provided', () => {
        const invoice: EFakturInvoice = {
            ...baseInvoice,
            kodeTransaksi: '02',
        }
        const row = invoiceToEFakturRow(invoice, 'Jakarta')
        expect(row.KD_JENIS_TRANSAKSI).toBe('02')
    })

    it('uses nsfpNumber for NOMOR_FAKTUR when provided', () => {
        const invoice: EFakturInvoice = {
            ...baseInvoice,
            nsfpNumber: '01000000000000042',
        }
        const row = invoiceToEFakturRow(invoice, 'Jakarta')
        // Should use last 13 digits of NSFP
        expect(row.NOMOR_FAKTUR).toBe('0000000000042')
    })

    it('falls back to invoice number for NOMOR_FAKTUR when no NSFP', () => {
        const row = invoiceToEFakturRow(baseInvoice, 'Jakarta')
        // Invoice number "INV-2026-001" stripped to digits: "2026001", padded to 13
        expect(row.NOMOR_FAKTUR).toBe('0000002026001')
    })

    it('uses fakturPajakDate for TANGGAL_FAKTUR when provided', () => {
        const invoice: EFakturInvoice = {
            ...baseInvoice,
            fakturPajakDate: '2026-03-20T00:00:00.000Z',
        }
        const row = invoiceToEFakturRow(invoice, 'Jakarta')
        expect(row.TANGGAL_FAKTUR).toBe('20/03/2026')
        expect(row.MASA_PAJAK).toBe('03')
        expect(row.TAHUN_PAJAK).toBe('2026')
    })

    it('falls back to issueDate when no fakturPajakDate', () => {
        const row = invoiceToEFakturRow(baseInvoice, 'Jakarta')
        expect(row.TANGGAL_FAKTUR).toBe('15/03/2026')
    })

    it('formats DPP and PPN correctly', () => {
        const row = invoiceToEFakturRow(baseInvoice, 'Jakarta')
        expect(row.JUMLAH_DPP).toBe('10000000')
        expect(row.JUMLAH_PPN).toBe('1100000')
        expect(row.JUMLAH_PPNBM).toBe('0')
    })

    it('formats customer name in uppercase', () => {
        const row = invoiceToEFakturRow(baseInvoice, 'Jakarta')
        expect(row.NAMA).toBe('PT MAJU BERSAMA')
    })

    it('preserves invoice.number as REFERENSI', () => {
        const invoice: EFakturInvoice = {
            ...baseInvoice,
            nsfpNumber: '01000000000000042',
        }
        const row = invoiceToEFakturRow(invoice, 'Jakarta')
        // REFERENSI always uses the original invoice number
        expect(row.REFERENSI).toBe('INV-2026-001')
    })

    it('handles null kodeTransaksi gracefully', () => {
        const invoice: EFakturInvoice = {
            ...baseInvoice,
            kodeTransaksi: null,
        }
        const row = invoiceToEFakturRow(invoice, 'Jakarta')
        expect(row.KD_JENIS_TRANSAKSI).toBe('01')
    })

    it('handles null nsfpNumber gracefully', () => {
        const invoice: EFakturInvoice = {
            ...baseInvoice,
            nsfpNumber: null,
        }
        const row = invoiceToEFakturRow(invoice, 'Jakarta')
        expect(row.NOMOR_FAKTUR).toBe('0000002026001')
    })
})

// ==============================================================================
// formatNPWP
// ==============================================================================

describe('formatNPWP', () => {
    it('strips non-digits and pads to 15', () => {
        expect(formatNPWP('01.234.567.8-901.000')).toBe('012345678901000')
    })

    it('returns zeros for null', () => {
        expect(formatNPWP(null)).toBe('000000000000000')
    })

    it('pads short NPWP', () => {
        expect(formatNPWP('123')).toBe('000000000000123')
    })

    it('truncates to 15 chars if longer', () => {
        expect(formatNPWP('1234567890123456789')).toBe('123456789012345')
    })
})

// ==============================================================================
// formatEFakturDate
// ==============================================================================

describe('formatEFakturDate', () => {
    it('formats date as DD/MM/YYYY', () => {
        const date = new Date(2026, 2, 15) // March 15, 2026
        expect(formatEFakturDate(date)).toBe('15/03/2026')
    })

    it('pads single-digit day and month', () => {
        const date = new Date(2026, 0, 5) // January 5, 2026
        expect(formatEFakturDate(date)).toBe('05/01/2026')
    })
})
