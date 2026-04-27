/**
 * Generate XLSX template for Purchase Request (PR) bulk import.
 *
 * Layout: 2 sheets karena PR memiliki line items.
 *
 *   Sheet 1 — "PR Header"
 *     Row 1-7: Instruksi (akan diabaikan saat parsing — header detection
 *              mencari row pertama yang mengandung "Reference*").
 *     Row 8:   Header kolom (kolom dengan * adalah wajib).
 *     Row 9+:  2 baris contoh data.
 *
 *   Sheet 2 — "PR Items"
 *     Row 1-5: Instruksi
 *     Row 6:   Header kolom
 *     Row 7+:  3 baris contoh data
 *
 * Reference (kolom pertama) digunakan untuk menghubungkan baris header
 * dengan baris item. Contoh: header `PR-A` → semua item dengan reference
 * `PR-A` masuk ke PR tersebut.
 */
import * as XLSX from "xlsx"

export function generatePRTemplate(): Buffer {
    // ─── Sheet 1: PR Header ───────────────────────────────────────────────
    const headerInstructions: (string | number)[][] = [
        ["INSTRUKSI:"],
        ["1. Sheet 'PR Header' = satu baris per PR. Wajib: Reference, Email Pemohon, Departemen."],
        ["2. Sheet 'PR Items' = baris per item, matched via Reference (kolom pertama)."],
        ["3. Reference bebas (e.g. PR-001, REQ-A) — gunakan untuk hubungkan header dengan items."],
        ["4. Email Pemohon harus terdaftar di sistem (cek di /hcm/employee-master)."],
        ["5. Prioritas: LOW, NORMAL, MEDIUM, HIGH, atau URGENT (default NORMAL)."],
        ["6. Nomor PR digenerate otomatis oleh sistem."],
        [""],
    ]
    const headerCols = [
        "Reference*",
        "Email Pemohon*",
        "Departemen*",
        "Prioritas",
        "Catatan",
    ]
    const headerSamples: (string | number)[][] = [
        ["PR-A", "budi@kri.demo", "Operasional", "HIGH", "Spare parts excavator"],
        ["PR-B", "siti@kri.demo", "Workshop", "NORMAL", "Consumables bulanan"],
    ]
    const headerData: (string | number)[][] = [
        ...headerInstructions,
        headerCols,
        ...headerSamples,
    ]
    const wsHeader = XLSX.utils.aoa_to_sheet(headerData)
    wsHeader["!cols"] = headerCols.map((h, i) => ({
        wch:
            Math.max(
                h.length,
                ...headerSamples.map((r) => String(r[i] ?? "").length),
            ) + 2,
    }))

    // ─── Sheet 2: PR Items ────────────────────────────────────────────────
    const itemInstructions: (string | number)[][] = [
        ["INSTRUKSI:"],
        ["1. Reference harus match dengan Reference di Sheet 'PR Header'."],
        ["2. Kode Produk wajib ada di sistem (cek di /inventory/products)."],
        ["3. Qty wajib > 0 (angka, bukan teks)."],
        [""],
    ]
    const itemCols = ["Reference*", "Kode Produk*", "Qty*", "Catatan"]
    const itemSamples: (string | number)[][] = [
        ["PR-A", "MTR-0184", 4, "Untuk excavator A-15"],
        ["PR-A", "BRG-1042", 24, ""],
        ["PR-B", "OIL-0050", 200, "Stok bulan depan"],
    ]
    const itemData: (string | number)[][] = [
        ...itemInstructions,
        itemCols,
        ...itemSamples,
    ]
    const wsItems = XLSX.utils.aoa_to_sheet(itemData)
    wsItems["!cols"] = itemCols.map((h, i) => ({
        wch:
            Math.max(
                h.length,
                ...itemSamples.map((r) => String(r[i] ?? "").length),
            ) + 2,
    }))

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, wsHeader, "PR Header")
    XLSX.utils.book_append_sheet(wb, wsItems, "PR Items")

    return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer
}
