# Panduan Verifikasi Manual — Meeting Backlog Fixes
**Tanggal:** 10 Maret 2026
**Total Item:** 10 perubahan untuk dicek

---

## 1. MTG-001: Neraca Seimbang (Balance Sheet)

**Halaman:** `/finance/reports`

**Cara Test:**
1. Buka halaman Laporan Keuangan
2. Pilih tab "Neraca" / Balance Sheet
3. Lihat banner di atas tabel neraca

**Expected Result:**
- Jika neraca seimbang → banner HIJAU: "Neraca Seimbang"
- Jika tidak seimbang → banner MERAH: "Neraca tidak seimbang — selisih Rp XXX"
- Selisih = Total Aset - (Total Kewajiban + Ekuitas)

**Sebelumnya:** Banner selalu tidak muncul karena field `isBalanced` tidak ada
**Sekarang:** Banner muncul sesuai kondisi aktual

---

## 2. MTG-002: Rekonsiliasi Bank (Seed Data)

**Halaman:** `/finance/reconciliation`

**Persiapan:** Jalankan `npm run db:fresh` untuk reseed database

**Cara Test:**
1. Buka halaman Rekonsiliasi Bank
2. Pilih akun "Bank BCA" (kode 1110)
3. Set range: Januari 2026 - Maret 2026
4. Klik "Muat Data" atau pilih rekonsiliasi yang ada

**Expected Result:**
- Terlihat 12 item laporan bank (bukan 0)
- Beberapa item menunjukkan status "MATCHED" (hijau)
- Beberapa item menunjukkan status "UNMATCHED" (merah/kuning)
- Klik "Auto Match" → minimal 3 item ter-match otomatis dengan confidence HIGH

**Contoh transaksi yang harus muncul:**
- Penerimaan dari PT Maju Tekstil — Rp 125.000.000
- Pembayaran gaji Januari — Rp 87.500.000
- Transfer ke CV Benang Sejahtera — Rp 45.000.000
- DP Order dari PT Fashion Prima — Rp 35.000.000
- Ongkos kirim JNE — Rp 2.450.000

---

## 3. MTG-003: Performa Rekonsiliasi Bank (Pagination)

**Halaman:** `/finance/reconciliation`

**Cara Test:**
1. Buka rekonsiliasi yang sudah ada (dari test #2)
2. Lihat bagian bawah panel "Laporan Bank" dan "Jurnal Sistem"

**Expected Result:**
- Jika item > 50: muncul pagination "Hal 1/X (Y item)"
- Tombol Previous/Next untuk navigasi halaman
- Loading lebih cepat karena hanya 50 item per halaman
- Header menunjukkan total count: "12 item" atau "7 entri"

**Sebelumnya:** Semua data di-load sekaligus, lambat
**Sekarang:** Pagination 50 item/halaman + loading lebih cepat

---

## 4. MTG-004: Arus Kas — Kategori Aktivitas

**Halaman:** `/finance/reports`

**Cara Test:**
1. Buka halaman Laporan Keuangan
2. Pilih tab "Arus Kas" / Cash Flow Statement
3. Periksa 3 kategori: Operasional, Investasi, Pendanaan

**Expected Result:**
- **Aktivitas Operasional:** Transaksi dari akun pendapatan (4xxx), beban (5xxx, 6xxx), piutang (12xx), hutang (2000-2499)
- **Aktivitas Investasi:** Transaksi dari akun aset tetap (15xx)
- **Aktivitas Pendanaan:** Transaksi dari akun ekuitas (3xxx), pinjaman jangka panjang (2500+)
- Opening Balance (Modal Disetor Rp 2,45M) harus muncul di Aktivitas Pendanaan, BUKAN operasional

**Sebelumnya:** Kategori berdasarkan keyword di deskripsi (sering salah)
**Sekarang:** Kategori berdasarkan kode akun GL (akurat, standar IAS 7)

---

## 5. MTG-006: Metode Pembayaran GIRO

**Halaman:** `/finance/vendor-payments` dan `/finance/payments` dan `/finance/invoices`

**Cara Test — Vendor Payments:**
1. Buka halaman Pembayaran Vendor
2. Klik "Bayar Tagihan" atau buka form pembayaran
3. Lihat dropdown "Metode Pembayaran"

**Expected Result:**
- Opsi: Tunai, Transfer Bank, Cek, **Giro**, Kartu Kredit, Lainnya
- Pilih "Giro" → muncul field tambahan:
  - "No. Giro" (wajib diisi)
  - "Bank Giro"
  - "Tanggal Jatuh Tempo"
- Submit → pembayaran tercatat dengan metode GIRO

**Cara Test — Multi-Bayar:**
1. Klik "Multi-Bayar" di halaman vendor payments
2. Lihat dropdown metode → harus ada opsi "Giro" terpisah dari "Cek"

**Cara Test — Invoice:**
1. Buka `/finance/invoices`
2. Buka detail invoice → klik "Catat Pembayaran"
3. Dropdown metode harus menampilkan: Transfer Bank, Tunai, Cek, **Giro**, Kartu Kredit

**Cara Test — Transactions:**
1. Buka `/finance/transactions`
2. Cari pembayaran yang sudah dicatat dengan metode GIRO
3. Badge harus menampilkan "Giro" (bukan kode enum)

**Sebelumnya:** Hanya ada Tunai, Transfer, Cek. Giro tidak ada di enum
**Sekarang:** Giro tersedia di semua form pembayaran dengan label Bahasa Indonesia

---

## 6. MTG-008: Download CSV Transfer (Bulk Payment)

**Halaman:** `/finance/vendor-payments`

**Cara Test:**
1. Buka halaman Pembayaran Vendor
2. Pastikan ada data pembayaran (minimal 1 record)
3. Cari tombol baru "Download Transfer" (warna biru, icon download)
4. Klik dropdown arrow pada tombol

**Expected Result:**
- Muncul 2 opsi:
  - **KlikBCA Bisnis (.txt)** — format pipe-delimited untuk upload ke internet banking BCA
  - **CSV Umum (.csv)** — format CSV standar dengan header Bahasa Indonesia

**Test Export BCA:**
1. Pilih "KlikBCA Bisnis (.txt)"
2. File `.txt` ter-download
3. Isi file: baris per transaksi, dipisah `|`
4. Format: `Tanggal|NoRekening|NamaPenerima|Jumlah|Keterangan|KodeBank`
5. Jumlah = angka bulat (tanpa desimal)
6. Nama penerima max 35 karakter

**Test Export CSV:**
1. Pilih "CSV Umum (.csv)"
2. File `.csv` ter-download
3. Buka di Excel → header: Tanggal, Nama Penerima, No Rekening, Bank, Kode Bank, Jumlah, Keterangan, Referensi
4. Encoding UTF-8 (karakter Indonesia tampil benar)

**Test Disabled State:**
1. Filter pembayaran sampai 0 hasil
2. Tombol "Download Transfer" harus disabled (tidak bisa diklik)

**Toast:** Setelah download sukses, muncul toast: "X transaksi diekspor ke KlikBCA Bisnis" atau "...CSV Umum"

**Sebelumnya:** Tidak ada cara export pembayaran ke format bank
**Sekarang:** Export 1-klik ke format BCA atau CSV umum

---

## 7. MTG-014: Durasi Per Piece (Manufacturing)

**Halaman:** `/manufacturing/bom/[id]` (halaman BOM Canvas)

**Cara Test:**
1. Buka atau buat BOM dengan beberapa proses
2. Buat flow: CUTTING → SEWING + PRINTING (paralel) → PACKING

**Expected Result — Summary Bar:**
- Durasi total = CUTTING + max(SEWING, PRINTING) + PACKING
- Contoh: CUTTING(5m) → SEWING(10m) + PRINTING(3m) paralel → PACKING(2m)
- Total harus = 5 + 10 + 2 = **17 menit** (bukan 5+10+3+2=20)

**Expected Result — Station Node:**
- Setiap node menampilkan durasi per piece sendiri (misal "10m/pcs")
- BUKAN akumulasi dari semua proses

**Sebelumnya:** Durasi paralel dijumlah (seharusnya ambil yang terlama)
**Sekarang:** Menggunakan DAG critical path — paralel = max, sequential = sum

---

## 8. MTG-020: Subprocess UI Disederhanakan

**Halaman:** `/manufacturing/work-centers`

**Cara Test:**
1. Buka halaman Work Centers / Stasiun
2. Lihat proses yang memiliki sub-proses

**Expected Result:**
- Sub-proses ditampilkan sebagai tag/pill kecil (bukan card besar)
- TIDAK ada tombol "Tambah Sub-Proses" yang prominent
- Hover di tag sub-proses → tooltip menampilkan detail (nama, subkontraktor, biaya)
- Data sub-proses tetap tersimpan di database

**Sebelumnya:** Card besar per sub-proses dengan tombol edit/delete/duplicate
**Sekarang:** Tag kecil read-only, lebih clean

---

## 9. MTG-023: Field Gaji di BOM

**Halaman:** `/manufacturing/bom/[id]` (detail panel kanan)

**Cara Test:**
1. Buka BOM Canvas
2. Klik salah satu station/proses untuk buka detail panel
3. Pilih operator dari dropdown

**Expected Result:**
- Field gaji TIDAK ditampilkan sebagai input besar
- Muncul teks kecil di bawah dropdown operator: "Gaji: Rp X.XXX.XXX /bln"
- Jika gaji belum di-set: teks "Gaji dari HCM" (warna abu-abu muda)
- Tooltip: "Atur gaji di modul HCM → Master Karyawan"
- Biaya tenaga kerja tetap dihitung di tabel material cost

**Sebelumnya:** Field gaji besar dan prominent di panel
**Sekarang:** Teks kecil inline, tidak mengambil banyak ruang

---

## 10. MTG-022, 024, 025: Hasil Investigasi (Tidak Perlu Dicek di UI)

| Item | Hasil | Keterangan |
|------|-------|------------|
| MTG-022: Tombol "delete for new" | SUDAH HILANG | Tidak ditemukan di codebase. Tidak perlu action. |
| MTG-024: Fitur time study | BELUM DIBANGUN | Fitur ini tidak pernah dibuat. Buat task baru jika diperlukan. |
| MTG-025: Rasio 3/4 | TIDAK ADA BUG | Denominator selalu dari `totalQty` (dinamis). Angka "4" berasal dari data test spesifik. |

---

## Checklist Ringkas

| # | Item | Halaman | Status |
|---|------|---------|--------|
| 1 | Balance Sheet isBalanced | `/finance/reports` | ☐ |
| 2 | Bank Recon seed data | `/finance/reconciliation` | ☐ |
| 3 | Bank Recon pagination | `/finance/reconciliation` | ☐ |
| 4 | Cashflow kategorisasi | `/finance/reports` | ☐ |
| 5 | Metode GIRO | `/finance/vendor-payments` | ☐ |
| 6 | Download CSV Transfer | `/finance/vendor-payments` | ☐ |
| 7 | Durasi per piece | `/manufacturing/bom/[id]` | ☐ |
| 8 | Subprocess UI | `/manufacturing/work-centers` | ☐ |
| 9 | Gaji di BOM | `/manufacturing/bom/[id]` | ☐ |
| 10 | Investigasi (3 item) | N/A | ☐ |
