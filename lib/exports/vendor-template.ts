/**
 * Generate XLSX template for vendor bulk import.
 *
 * Layout:
 *   Row 1-7: Instruksi (akan diabaikan saat parsing — header detection
 *            mencari row pertama yang mengandung "Nama Vendor*").
 *   Row 8:   Header kolom (kolom dengan * adalah wajib).
 *   Row 9+:  2 baris contoh data.
 *
 * Headers (Indonesian, sesuai vendor-xlsx.ts export):
 *   Nama Vendor* | Kode* | PIC | Email | Telepon | NPWP | Alamat |
 *   Pembayaran | Rating (1-5) | Aktif
 */
import * as XLSX from "xlsx"

export function generateVendorTemplate(): Buffer {
    const headers = [
        "Nama Vendor*",
        "Kode*",
        "PIC",
        "Email",
        "Telepon",
        "NPWP",
        "Alamat",
        "Pembayaran",
        "Rating (1-5)",
        "Aktif",
    ]
    const sampleRows: (string | number)[][] = [
        [
            "PT Contoh Mining",
            "VND-001",
            "Pak Budi",
            "budi@contoh.com",
            "021-555-1234",
            "01.234.567.8-901.000",
            "Jl. Sudirman No. 1, Jakarta",
            "NET_30",
            4,
            "Ya",
        ],
        [
            "CV Sumber Rezeki",
            "VND-002",
            "Bu Siti",
            "siti@sumber.id",
            "022-777-8888",
            "",
            "Jl. Asia Afrika No. 5, Bandung",
            "CASH",
            5,
            "Ya",
        ],
    ]
    const instructions: (string | number)[][] = [
        ["INSTRUKSI:"],
        ["1. Header kolom ada di Row 8. Isi data mulai dari Row 9 ke bawah."],
        ["2. Kolom dengan tanda * wajib diisi (Nama Vendor, Kode)."],
        ["3. Kode harus unik — sistem akan reject jika duplikat dengan vendor yang sudah ada."],
        ["4. NPWP format 15 digit (boleh dengan titik/strip — sistem akan normalize otomatis)."],
        ["5. Pembayaran: CASH, NET_15, NET_30, NET_45, NET_60, NET_90, atau COD."],
        ["6. Rating: angka 1 s/d 5. Aktif: 'Ya' atau 'Tidak' (default Ya)."],
    ]

    const data: (string | number)[][] = [
        ...instructions,
        headers,
        ...sampleRows,
    ]

    const ws = XLSX.utils.aoa_to_sheet(data)

    // Auto column widths based on header + sample content length
    ws["!cols"] = headers.map((h, i) => ({
        wch:
            Math.max(
                h.length,
                ...sampleRows.map((r) => String(r[i] ?? "").length),
            ) + 2,
    }))

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Template Vendor")

    return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer
}
