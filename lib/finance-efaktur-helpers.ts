// ==============================================================================
// e-Faktur Pure Functions (extracted from "use server" file)
// ==============================================================================

export interface EFakturInvoice {
    id: string
    number: string
    customerName: string
    customerNpwp: string | null
    issueDate: string
    dppAmount: number // Dasar Pengenaan Pajak (base amount before tax)
    ppnAmount: number // PPN amount
    totalAmount: number
    status: string
}

export interface EFakturCSVRow {
    FK: string          // "FK" literal
    KD_JENIS_TRANSAKSI: string  // "01" for local, "02" for export
    FG_PENGGANTI: string        // "0" for normal, "1" for replacement
    NOMOR_FAKTUR: string
    MASA_PAJAK: string          // MM
    TAHUN_PAJAK: string         // YYYY
    TANGGAL_FAKTUR: string      // DD/MM/YYYY
    NPWP: string
    NAMA: string
    ALAMAT_LENGKAP: string
    JUMLAH_DPP: string
    JUMLAH_PPN: string
    JUMLAH_PPNBM: string       // Usually "0"
    ID_KETERANGAN_TAMBAHAN: string
    FG_UANG_MUKA: string       // "0"
    UANG_MUKA_DPP: string      // "0"
    UANG_MUKA_PPN: string      // "0"
    UANG_MUKA_PPNBM: string    // "0"
    REFERENSI: string
}

/**
 * Format a date to DD/MM/YYYY format required by e-Faktur.
 */
export function formatEFakturDate(date: Date): string {
    const d = String(date.getDate()).padStart(2, '0')
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const y = date.getFullYear()
    return `${d}/${m}/${y}`
}

/**
 * Format NPWP: strip non-digits, pad to 15 characters.
 */
export function formatNPWP(npwp: string | null): string {
    if (!npwp) return '000000000000000'
    const digits = npwp.replace(/\D/g, '')
    return digits.padStart(15, '0').substring(0, 15)
}

/**
 * Convert invoice data to e-Faktur CSV row.
 */
export function invoiceToEFakturRow(invoice: EFakturInvoice, address: string): EFakturCSVRow {
    const issueDate = new Date(invoice.issueDate)
    return {
        FK: 'FK',
        KD_JENIS_TRANSAKSI: '01',
        FG_PENGGANTI: '0',
        NOMOR_FAKTUR: invoice.number.replace(/[^0-9]/g, '').padStart(13, '0'),
        MASA_PAJAK: String(issueDate.getMonth() + 1).padStart(2, '0'),
        TAHUN_PAJAK: String(issueDate.getFullYear()),
        TANGGAL_FAKTUR: formatEFakturDate(issueDate),
        NPWP: formatNPWP(invoice.customerNpwp),
        NAMA: invoice.customerName.toUpperCase(),
        ALAMAT_LENGKAP: (address || '-').toUpperCase(),
        JUMLAH_DPP: String(Math.round(invoice.dppAmount)),
        JUMLAH_PPN: String(Math.round(invoice.ppnAmount)),
        JUMLAH_PPNBM: '0',
        ID_KETERANGAN_TAMBAHAN: '',
        FG_UANG_MUKA: '0',
        UANG_MUKA_DPP: '0',
        UANG_MUKA_PPN: '0',
        UANG_MUKA_PPNBM: '0',
        REFERENSI: invoice.number,
    }
}

/**
 * Generate CSV string from e-Faktur rows.
 */
export function generateEFakturCSV(rows: EFakturCSVRow[]): string {
    const headers = [
        'FK', 'KD_JENIS_TRANSAKSI', 'FG_PENGGANTI', 'NOMOR_FAKTUR',
        'MASA_PAJAK', 'TAHUN_PAJAK', 'TANGGAL_FAKTUR', 'NPWP', 'NAMA',
        'ALAMAT_LENGKAP', 'JUMLAH_DPP', 'JUMLAH_PPN', 'JUMLAH_PPNBM',
        'ID_KETERANGAN_TAMBAHAN', 'FG_UANG_MUKA', 'UANG_MUKA_DPP',
        'UANG_MUKA_PPN', 'UANG_MUKA_PPNBM', 'REFERENSI',
    ]

    const csvLines = [headers.join(',')]
    for (const row of rows) {
        const values = headers.map((h) => {
            const val = row[h as keyof EFakturCSVRow] || ''
            // Quote if contains comma
            return val.includes(',') ? `"${val}"` : val
        })
        csvLines.push(values.join(','))
    }

    return csvLines.join('\n')
}
