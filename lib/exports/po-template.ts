/**
 * Generate XLSX template for Purchase Order bulk import.
 *
 * Layout (2 sheets):
 *   Sheet "PO Header" — one row per PO
 *     Row 1-7: Instruksi (di-skip oleh parser).
 *     Row 8:   Header kolom (kolom dengan * adalah wajib).
 *     Row 9+:  Sample data.
 *
 *   Sheet "PO Items" — line items (multi-row per PO, di-link via Reference)
 *     Row 1-5: Instruksi.
 *     Row 6:   Header kolom.
 *     Row 7+:  Sample data.
 *
 * Reference field menghubungkan antara Header dan Items — bukan PO Number
 * (PO Number di-generate server-side via getNextDocNumber).
 */
import * as XLSX from "xlsx"

export function generatePOTemplate(): Buffer {
    // ── Sheet 1: PO Header ────────────────────────────────────────────────
    const headerCols = [
        "Reference*",
        "Kode Pemasok*",
        "Tanggal Pesanan",
        "Tgl Diharapkan",
        "Catatan",
    ]
    const headerInstructions: (string | number)[][] = [
        ["INSTRUKSI — SHEET 'PO Header':"],
        ["1. Header kolom ada di Row 8. Isi data mulai dari Row 9 ke bawah."],
        ["2. Reference: ID unik buatan Anda (mis. PO-A, PO-B) untuk menghubungkan ke baris di sheet 'PO Items'. Bukan nomor PO — sistem akan generate nomor otomatis."],
        ["3. Kode Pemasok: harus ada di master Pemasok (mis. VND-001). Cek halaman Pemasok dulu jika ragu."],
        ["4. Tanggal format DD/MM/YYYY (mis. 25/04/2026). Kosong = pakai tanggal hari ini."],
        ["5. PPN 11% dihitung otomatis server-side — jangan masukkan tax di sini."],
        ["6. Status default PO_DRAFT — bisa diubah via UI setelah import."],
    ]
    const headerSamples: (string | number)[][] = [
        [
            "PO-A",
            "VND-001",
            "25/04/2026",
            "10/05/2026",
            "Pesanan spare part rutin Q2",
        ],
        [
            "PO-B",
            "VND-002",
            "25/04/2026",
            "30/04/2026",
            "Oli & filter untuk PM mesin",
        ],
    ]

    const headerData: (string | number)[][] = [
        ...headerInstructions,
        headerCols,
        ...headerSamples,
    ]
    const ws1 = XLSX.utils.aoa_to_sheet(headerData)
    ws1["!cols"] = headerCols.map((h, i) => ({
        wch:
            Math.max(
                h.length,
                ...headerSamples.map((r) => String(r[i] ?? "").length),
            ) + 2,
    }))

    // ── Sheet 2: PO Items ─────────────────────────────────────────────────
    const itemCols = [
        "Reference*",
        "Kode Produk*",
        "Qty*",
        "Harga Satuan*",
        "Catatan",
    ]
    const itemInstructions: (string | number)[][] = [
        ["INSTRUKSI — SHEET 'PO Items':"],
        ["1. Header kolom ada di Row 6. Isi data mulai dari Row 7 ke bawah."],
        ["2. Reference HARUS sama persis dengan Reference di sheet 'PO Header' — itu yang menghubungkan item ke PO."],
        ["3. Kode Produk: harus ada di master Produk. Qty & Harga Satuan wajib > 0."],
        ["4. Total per baris = Qty × Harga Satuan (dihitung otomatis). PPN 11% dihitung di level PO."],
    ]
    const itemSamples: (string | number)[][] = [
        ["PO-A", "PRD-001", 10, 350000, "Filter solar PC200"],
        ["PO-A", "PRD-002", 4, 125000, "Element filter udara"],
        ["PO-A", "PRD-003", 2, 850000, "Hose hidrolik 1.5m"],
        ["PO-B", "PRD-010", 12, 95000, "Oli engine SAE 15W-40 4L"],
        ["PO-B", "PRD-011", 6, 78000, "Oli hidrolik VG46 4L"],
    ]

    const itemData: (string | number)[][] = [
        ...itemInstructions,
        itemCols,
        ...itemSamples,
    ]
    const ws2 = XLSX.utils.aoa_to_sheet(itemData)
    ws2["!cols"] = itemCols.map((h, i) => ({
        wch:
            Math.max(
                h.length,
                ...itemSamples.map((r) => String(r[i] ?? "").length),
            ) + 2,
    }))

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws1, "PO Header")
    XLSX.utils.book_append_sheet(wb, ws2, "PO Items")

    return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer
}
