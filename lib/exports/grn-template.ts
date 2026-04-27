/**
 * Generate XLSX template for Goods Received Note (GRN) bulk import.
 *
 * Layout (2 sheets):
 *   Sheet "GRN Header" — one row per GRN
 *     Row 1-7: Instruksi (di-skip oleh parser).
 *     Row 8:   Header kolom (kolom dengan * adalah wajib).
 *     Row 9+:  Sample data.
 *
 *   Sheet "GRN Items" — line items (multi-row per GRN, di-link via Reference)
 *     Row 1-5: Instruksi.
 *     Row 6:   Header kolom.
 *     Row 7+:  Sample data.
 *
 * Reference field menghubungkan antara Header dan Items — bukan nomor GRN
 * (nomor GRN di-generate server-side via getNextDocNumber dgn prefix SJM-YYYYMM).
 *
 * Khusus GRN: tiap baris harus reference No PO yang SUDAH ADA di sistem.
 * Use case utama = backlog migration (penerimaan masa lalu dari sistem lama).
 */
import * as XLSX from "xlsx"

export function generateGRNTemplate(): Buffer {
    // ── Sheet 1: GRN Header ───────────────────────────────────────────────
    const headerCols = [
        "Reference*",
        "No PO*",
        "Tanggal Terima",
        "Kode Gudang",
        "Catatan",
    ]
    const headerInstructions: (string | number)[][] = [
        ["INSTRUKSI — SHEET 'GRN Header':"],
        ["1. Header kolom ada di Row 8. Isi data mulai dari Row 9 ke bawah."],
        ["2. Reference: ID unik buatan Anda (mis. GRN-A, GRN-B) untuk menghubungkan ke baris di sheet 'GRN Items'. Bukan nomor GRN — sistem akan generate nomor otomatis (SJM-YYYYMM-####)."],
        ["3. No PO: harus nomor PO yang SUDAH ADA di sistem (mis. PO-202604-0001). Cek halaman Pesanan Pembelian dulu."],
        ["4. Tanggal Terima format DD/MM/YYYY (mis. 25/04/2026). Kosong = pakai tanggal hari ini."],
        ["5. Kode Gudang: opsional, harus cocok dgn master Gudang (mis. GD-001). Kosong = ambil gudang utama PO."],
        ["6. Status default DRAFT — harus diterima manual via UI agar stok bertambah dan jurnal terbentuk."],
    ]
    const headerSamples: (string | number)[][] = [
        [
            "GRN-A",
            "PO-202604-0001",
            "25/04/2026",
            "GD-001",
            "Pengiriman batch 1 dari vendor",
        ],
        [
            "GRN-B",
            "PO-202604-0002",
            "25/04/2026",
            "GD-001",
            "Spare part PM mesin Q2",
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

    // ── Sheet 2: GRN Items ────────────────────────────────────────────────
    const itemCols = [
        "Reference*",
        "Kode Produk*",
        "Qty Diterima*",
        "Sesuai Pesanan",
        "Catatan",
    ]
    const itemInstructions: (string | number)[][] = [
        ["INSTRUKSI — SHEET 'GRN Items':"],
        ["1. Header kolom ada di Row 6. Isi data mulai dari Row 7 ke bawah."],
        ["2. Reference HARUS sama persis dengan Reference di sheet 'GRN Header' — itu yang menghubungkan item ke GRN."],
        ["3. Kode Produk: harus terdaftar di PO yang di-reference. Qty Diterima wajib > 0."],
        ["4. Sesuai Pesanan: Ya/Tidak (default Ya). Pilih Tidak jika qty terima < qty pesanan PO (jadi PO menjadi PARTIAL_RECEIVED setelah diterima)."],
    ]
    const itemSamples: (string | number)[][] = [
        ["GRN-A", "PRD-001", 10, "Ya", "Lengkap & kondisi baik"],
        ["GRN-A", "PRD-002", 4, "Ya", "Sesuai PO"],
        ["GRN-A", "PRD-003", 1, "Tidak", "Hanya 1 dari 2 unit datang"],
        ["GRN-B", "PRD-010", 12, "Ya", "Oli engine SAE 15W-40"],
        ["GRN-B", "PRD-011", 6, "Ya", "Oli hidrolik VG46"],
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
    XLSX.utils.book_append_sheet(wb, ws1, "GRN Header")
    XLSX.utils.book_append_sheet(wb, ws2, "GRN Items")

    return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer
}
