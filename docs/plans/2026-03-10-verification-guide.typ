#set page(paper: "a4", margin: (x: 2cm, y: 2cm))
#set text(font: "Helvetica", size: 10pt)
#set heading(numbering: "1.")
#set par(justify: true)

#align(center)[
  #text(size: 20pt, weight: "bold")[Panduan Verifikasi Manual]
  #v(4pt)
  #text(size: 14pt, fill: rgb("#555"))[Meeting Backlog Fixes — 10 Maret 2026]
  #v(4pt)
  #text(size: 10pt, fill: rgb("#888"))[Total: 10 perubahan untuk dicek]
]

#v(12pt)
#line(length: 100%, stroke: 0.5pt)
#v(8pt)

= Balance Sheet — Neraca Seimbang (MTG-001)

#table(
  columns: (auto, 1fr),
  stroke: 0.5pt,
  inset: 8pt,
  [*Halaman*], [`/finance/reports` → tab Neraca],
  [*Prioritas*], [P0 — Blocker],
)

#v(4pt)
*Cara Test:*
+ Buka halaman Laporan Keuangan
+ Pilih tab "Neraca" / Balance Sheet
+ Lihat banner di atas tabel neraca

*Expected Result:*
- Jika neraca seimbang → banner #text(fill: rgb("#16a34a"))[HIJAU]: "Neraca Seimbang"
- Jika tidak seimbang → banner #text(fill: rgb("#dc2626"))[MERAH]: "Neraca tidak seimbang — selisih Rp XXX"

#block(fill: rgb("#f0fdf4"), inset: 8pt, radius: 4pt, width: 100%)[
  *Sebelumnya:* Banner tidak pernah muncul (field `isBalanced` tidak ada)\
  *Sekarang:* Banner muncul sesuai kondisi aktual neraca
]

#v(12pt)

= Rekonsiliasi Bank — Seed Data (MTG-002)

#table(
  columns: (auto, 1fr),
  stroke: 0.5pt,
  inset: 8pt,
  [*Halaman*], [`/finance/reconciliation`],
  [*Prioritas*], [P0 — Blocker],
  [*Persiapan*], [Jalankan `npm run db:fresh` untuk reseed database],
)

#v(4pt)
*Cara Test:*
+ Buka halaman Rekonsiliasi Bank
+ Pilih akun "Bank BCA" (kode 1110)
+ Set range: Januari 2026 – Maret 2026
+ Klik "Muat Data"

*Expected Result:*
- Terlihat *12 item* laporan bank (bukan 0)
- Beberapa item status "MATCHED" (hijau)
- Beberapa item status "UNMATCHED" (merah/kuning)
- Klik "Auto Match" → minimal 3 item ter-match otomatis

*Contoh transaksi yang harus muncul:*
#table(
  columns: (1fr, auto),
  stroke: 0.5pt,
  inset: 6pt,
  [Penerimaan dari PT Maju Tekstil], [Rp 125.000.000],
  [Pembayaran gaji Januari], [Rp 87.500.000],
  [Transfer ke CV Benang Sejahtera], [Rp 45.000.000],
  [DP Order dari PT Fashion Prima], [Rp 35.000.000],
  [Ongkos kirim JNE], [Rp 2.450.000],
)

#block(fill: rgb("#f0fdf4"), inset: 8pt, radius: 4pt, width: 100%)[
  *Sebelumnya:* Menampilkan 0 cocok dan 0 tidak cocok\
  *Sekarang:* Data demo tersedia, auto-match berfungsi
]

#v(12pt)

= Rekonsiliasi Bank — Pagination (MTG-003)

#table(
  columns: (auto, 1fr),
  stroke: 0.5pt,
  inset: 8pt,
  [*Halaman*], [`/finance/reconciliation`],
  [*Prioritas*], [P1],
)

#v(4pt)
*Cara Test:*
+ Buka rekonsiliasi yang sudah ada (dari test \#2)
+ Lihat bagian bawah panel "Laporan Bank" dan "Jurnal Sistem"

*Expected Result:*
- Jika item > 50: muncul pagination "Hal 1/X (Y item)"
- Tombol Previous/Next untuk navigasi halaman
- Header menunjukkan total count

#block(fill: rgb("#f0fdf4"), inset: 8pt, radius: 4pt, width: 100%)[
  *Sebelumnya:* Semua data di-load sekaligus, lambat\
  *Sekarang:* Pagination 50 item/halaman + algoritma matching lebih cepat
]

#v(12pt)

= Arus Kas — Kategori Aktivitas (MTG-004)

#table(
  columns: (auto, 1fr),
  stroke: 0.5pt,
  inset: 8pt,
  [*Halaman*], [`/finance/reports` → tab Arus Kas],
  [*Prioritas*], [P1],
)

#v(4pt)
*Cara Test:*
+ Buka halaman Laporan Keuangan
+ Pilih tab "Arus Kas" / Cash Flow Statement
+ Periksa 3 kategori: Operasional, Investasi, Pendanaan

*Expected Result:*
#table(
  columns: (auto, 1fr),
  stroke: 0.5pt,
  inset: 6pt,
  [*Operasional*], [Akun pendapatan (4xxx), beban (5xxx, 6xxx), piutang (12xx), hutang (2000-2499)],
  [*Investasi*], [Akun aset tetap (15xx)],
  [*Pendanaan*], [Akun ekuitas (3xxx), pinjaman jangka panjang (2500+)],
)

- Opening Balance (Modal Disetor Rp 2,45M) harus di *Pendanaan*, BUKAN operasional

#block(fill: rgb("#f0fdf4"), inset: 8pt, radius: 4pt, width: 100%)[
  *Sebelumnya:* Kategori berdasarkan keyword di deskripsi (sering salah)\
  *Sekarang:* Kategori berdasarkan kode akun GL (standar IAS 7)
]

#v(12pt)

= Metode Pembayaran GIRO (MTG-006)

#table(
  columns: (auto, 1fr),
  stroke: 0.5pt,
  inset: 8pt,
  [*Halaman*], [`/finance/vendor-payments`, `/finance/payments`, `/finance/invoices`],
  [*Prioritas*], [P0 — Blocker],
)

#v(4pt)
*Cara Test — Vendor Payments:*
+ Buka `/finance/vendor-payments`
+ Klik "Bayar Tagihan" atau buka form pembayaran
+ Lihat dropdown "Metode Pembayaran"

*Expected Result:*
- Opsi: Tunai, Transfer Bank, Cek, *Giro*, Kartu Kredit, Lainnya
- Pilih "Giro" → muncul field tambahan:
  - "No. Giro" (wajib diisi)
  - "Bank Giro"
  - "Tanggal Jatuh Tempo"

*Cara Test — Multi-Bayar:*
+ Klik "Multi-Bayar" → dropdown metode harus ada "Giro" terpisah dari "Cek"

*Cara Test — Invoice:*
+ Buka `/finance/invoices` → detail invoice → "Catat Pembayaran" → opsi Giro tersedia

#block(fill: rgb("#f0fdf4"), inset: 8pt, radius: 4pt, width: 100%)[
  *Sebelumnya:* Hanya Tunai, Transfer, Cek. Giro tidak ada di enum\
  *Sekarang:* Giro tersedia di semua form pembayaran
]

#v(12pt)

= Download CSV Transfer — Bulk Payment (MTG-008)

#table(
  columns: (auto, 1fr),
  stroke: 0.5pt,
  inset: 8pt,
  [*Halaman*], [`/finance/vendor-payments`],
  [*Prioritas*], [P3 — Batch 2],
)

#v(4pt)
*Cara Test:*
+ Buka halaman Pembayaran Vendor
+ Pastikan ada data pembayaran (minimal 1 record)
+ Cari tombol "Download Transfer" (warna biru, icon download)
+ Klik dropdown arrow

*Expected Result:*
- 2 opsi: *KlikBCA Bisnis (.txt)* dan *CSV Umum (.csv)*

*Test Export BCA:*
+ Pilih "KlikBCA Bisnis (.txt)" → file `.txt` ter-download
+ Format per baris: `Tanggal|NoRekening|NamaPenerima|Jumlah|Keterangan|KodeBank`
+ Jumlah = angka bulat, Nama max 35 karakter

*Test Export CSV:*
+ Pilih "CSV Umum (.csv)" → file `.csv` ter-download
+ Buka di Excel → header: Tanggal, Nama Penerima, No Rekening, Bank, Kode Bank, Jumlah, Keterangan, Referensi

*Test Disabled:*
+ Filter sampai 0 hasil → tombol harus disabled

*Toast:* "X transaksi diekspor ke KlikBCA Bisnis"

#block(fill: rgb("#f0fdf4"), inset: 8pt, radius: 4pt, width: 100%)[
  *Sebelumnya:* Tidak ada cara export ke format bank\
  *Sekarang:* Export 1-klik ke BCA atau CSV umum
]

#v(12pt)

= Durasi Per Piece — Manufacturing (MTG-014)

#table(
  columns: (auto, 1fr),
  stroke: 0.5pt,
  inset: 8pt,
  [*Halaman*], [`/manufacturing/bom/[id]` — BOM Canvas],
  [*Prioritas*], [P1],
)

#v(4pt)
*Cara Test:*
+ Buka atau buat BOM dengan beberapa proses
+ Buat flow: CUTTING → SEWING + PRINTING (paralel) → PACKING

*Expected Result:*
- Contoh: CUTTING(5m) → SEWING(10m) + PRINTING(3m) paralel → PACKING(2m)
- Total harus = 5 + max(10, 3) + 2 = *17 menit*
- BUKAN 5 + 10 + 3 + 2 = 20 menit
- Setiap node menampilkan durasi sendiri (misal "10m/pcs")

#block(fill: rgb("#f0fdf4"), inset: 8pt, radius: 4pt, width: 100%)[
  *Sebelumnya:* Durasi paralel dijumlah (inflated)\
  *Sekarang:* DAG critical path — paralel = max, sequential = sum
]

#v(12pt)

= Subprocess UI Disederhanakan (MTG-020)

#table(
  columns: (auto, 1fr),
  stroke: 0.5pt,
  inset: 8pt,
  [*Halaman*], [`/manufacturing/work-centers`],
  [*Prioritas*], [P2],
)

#v(4pt)
*Cara Test:*
+ Buka halaman Work Centers / Stasiun
+ Lihat proses yang memiliki sub-proses

*Expected Result:*
- Sub-proses ditampilkan sebagai tag/pill kecil (bukan card besar)
- Tidak ada tombol "Tambah Sub-Proses" yang prominent
- Hover di tag → tooltip detail (nama, subkontraktor, biaya)

#block(fill: rgb("#f0fdf4"), inset: 8pt, radius: 4pt, width: 100%)[
  *Sebelumnya:* Card besar per sub-proses dengan tombol edit/delete/duplicate\
  *Sekarang:* Tag kecil read-only, lebih clean
]

#v(12pt)

= Field Gaji di BOM (MTG-023)

#table(
  columns: (auto, 1fr),
  stroke: 0.5pt,
  inset: 8pt,
  [*Halaman*], [`/manufacturing/bom/[id]` — detail panel kanan],
  [*Prioritas*], [P2],
)

#v(4pt)
*Cara Test:*
+ Buka BOM Canvas → klik salah satu station → buka detail panel
+ Pilih operator dari dropdown

*Expected Result:*
- Field gaji TIDAK ditampilkan sebagai input besar
- Teks kecil: "Gaji: Rp X.XXX.XXX /bln" + biaya per-pcs
- Jika belum di-set: "Gaji dari HCM" (abu-abu)
- Tooltip: "Atur gaji di modul HCM → Master Karyawan"

#block(fill: rgb("#f0fdf4"), inset: 8pt, radius: 4pt, width: 100%)[
  *Sebelumnya:* Field gaji besar dan prominent\
  *Sekarang:* Teks kecil inline, tidak mengambil banyak ruang
]

#v(12pt)

= Hasil Investigasi (MTG-022, 024, 025)

#text(size: 9pt, fill: rgb("#666"))[Tidak perlu dicek di UI — hasil investigasi kode saja]

#table(
  columns: (auto, auto, 1fr),
  stroke: 0.5pt,
  inset: 6pt,
  [*Item*], [*Hasil*], [*Keterangan*],
  [MTG-022: Tombol "delete for new"], [SUDAH HILANG], [Tidak ditemukan di codebase],
  [MTG-024: Fitur time study], [BELUM DIBANGUN], [Buat task baru jika diperlukan],
  [MTG-025: Rasio 3/4], [TIDAK ADA BUG], [Denominator dinamis dari totalQty],
)

#v(20pt)
#line(length: 100%, stroke: 0.5pt)
#v(8pt)

#align(center)[
  #text(size: 14pt, weight: "bold")[Checklist Ringkas]
]

#v(8pt)

#table(
  columns: (auto, auto, 1fr, auto),
  stroke: 0.5pt,
  inset: 8pt,
  fill: (_, row) => if row == 0 { rgb("#f1f5f9") } else { none },
  [*\#*], [*ID*], [*Item*], [*Cek*],
  [1], [MTG-001], [Balance Sheet isBalanced → `/finance/reports`], [☐],
  [2], [MTG-002], [Bank Recon seed data → `/finance/reconciliation`], [☐],
  [3], [MTG-003], [Bank Recon pagination → `/finance/reconciliation`], [☐],
  [4], [MTG-004], [Cashflow kategorisasi → `/finance/reports`], [☐],
  [5], [MTG-006], [Metode GIRO → `/finance/vendor-payments`], [☐],
  [6], [MTG-008], [Download CSV Transfer → `/finance/vendor-payments`], [☐],
  [7], [MTG-014], [Durasi per piece → `/manufacturing/bom/[id]`], [☐],
  [8], [MTG-020], [Subprocess UI → `/manufacturing/work-centers`], [☐],
  [9], [MTG-023], [Gaji di BOM → `/manufacturing/bom/[id]`], [☐],
  [10], [MTG-022,024,025], [Investigasi (3 item) → N/A], [☐],
)
