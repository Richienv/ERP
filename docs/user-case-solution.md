# User Case & Solution Log

> Setiap fitur yang kita bangun harus punya alasan jelas dari sisi pengguna.
> Format: Sebelumnya → Sekarang → Kenapa Penting

---

## Modul Subkontrak (CMT)

### 1. Kirim & Terima Barang ke CMT (Inventory Integration)

**Sebelumnya:** Pemilik usaha kirim kain/bahan ke mitra jahit (CMT), tapi stok di sistem tidak berubah. Mereka harus catat manual di Excel berapa yang dikirim, berapa yang kembali. Kalau ada selisih, tidak ketahuan sampai audit akhir bulan. Stok di gudang terlihat masih penuh padahal barangnya sudah di vendor.

**Sekarang:** Saat catat pengiriman ke CMT, stok otomatis berkurang (SUBCONTRACT_OUT). Saat barang kembali, stok otomatis bertambah (SUBCONTRACT_IN). Satu klik, dua hal terjadi — pengiriman tercatat DAN stok terupdate. Cacat dan sisa juga tercatat per item.

**Kenapa penting:** Ini standar industri yang dimiliki Accurate dan SAP tapi tidak ada di kebanyakan ERP lokal murah. Tanpa ini, pemilik usaha tidak tahu berapa sebenarnya stok yang tersedia vs yang sedang di vendor. Menghemat 30+ menit/hari dari pencatatan manual dan menghilangkan risiko salah hitung stok.

---

### 2. Dashboard CMT dengan 6 KPI

**Sebelumnya:** Untuk tahu performa mitra CMT, pemilik usaha harus buka Excel, hitung manual: berapa order aktif, berapa yang terlambat, berapa yield rate, berapa biaya bulan ini. Informasi tersebar di banyak tempat.

**Sekarang:** Buka satu halaman, langsung terlihat: Order Aktif, Mitra CMT, Terlambat, Biaya Bulan Ini, Yield Rate %, On-Time %. Plus grafik distribusi status dan tabel material yang masih di vendor. Order terlambat muncul sebagai alert merah yang bisa langsung diklik.

**Kenapa penting:** Pemilik usaha bisa ambil keputusan dalam 10 detik — "mitra A sering terlambat, mitra B yield rate-nya rendah, bulan ini biaya CMT sudah Rp X." Tidak perlu lagi tanya admin atau buka spreadsheet.

---

### 3. Registrasi & Scorecard Mitra CMT

**Sebelumnya:** Data mitra CMT tersimpan tapi tidak ada cara untuk lihat performa mereka. Mau bandingkan mitra A vs B harus hitung manual dari history order.

**Sekarang:** Klik kartu mitra → langsung lihat scorecard: Total Order, On-Time %, Defect Rate %, Rata-rata Turnaround. Plus daftar tarif dan history order. Edit data mitra dan kelola tarif juga bisa langsung dari halaman registri (tombol pensil dan dollar).

**Kenapa penting:** Saat mau pilih mitra untuk order baru, pemilik usaha langsung tahu siapa yang paling reliable. Tidak perlu lagi "feeling" atau tanya-tanya ke tim. Data bicara.

---

### 4. Order Subkontrak End-to-End

**Sebelumnya:** Bisa buat order tapi tidak bisa filter, tidak bisa cari, halaman detail belum ada. Untuk track progress harus buka database atau tanya admin.

**Sekarang:** Halaman order punya search, filter status, filter mitra. Klik order → lihat detail lengkap dengan item, qty kirim/kembali/cacat, estimasi biaya (otomatis dari tarif mitra), dan history pengiriman. Ubah status order langsung dari tombol di halaman detail. Catat pengiriman keluar/masuk dengan pilih gudang dan input qty per item.

**Kenapa penting:** Seluruh alur CMT — dari buat order, kirim barang, terima barang, sampai selesai — bisa dilakukan dalam satu sistem tanpa keluar ke Excel atau WhatsApp. Ini mengubah proses 5-6 langkah manual jadi 2-3 klik di sistem.

---

## Modul Staff & Task Management

### 1. Manajer Beri Tugas ke Operator (Task Assignment)

**Sebelumnya:** Kepala shift/supervisor di pabrik punya 15-20 operator per shift. Untuk kasih tugas harian, mereka pakai WhatsApp group atau papan tulis di lantai produksi. Masalahnya: pesan tenggelam, operator sering lupa, tidak ada bukti siapa dikasih tugas apa, dan kalau ada masalah tidak tertrack.

**Sekarang:** Buka halaman Manajer → klik "Tugas Baru" → pilih karyawan, jenis tugas (Produksi/QC/Gudang/Teknisi), prioritas, deadline, dan link ke Work Order/PO/SO yang relevan. Tugas langsung muncul di HP operator. Kanban board menampilkan 4 kolom: Menunggu, Berjalan, Kendala, Selesai.

**Kenapa penting:** Supervisor tidak perlu kirim 15 pesan WA. Satu form, langsung ke orang yang tepat. Plus ada bukti tertulis — siapa dapat tugas apa, kapan mulai, kapan selesai. Ini standar yang ada di SAP/Oracle tapi disederhanakan untuk pabrik tekstil Indonesia.

---

### 2. Operator Terima & Kerjakan Tugas (Staff Task Flow)

**Sebelumnya:** Operator datang shift pagi, tidak tahu tugas apa hari ini. Harus tunggu instruksi lisan dari supervisor. Kalau supervisor sibuk, operator nganggur. Kalau ada kendala mesin/material, lapornya lewat WA — tidak tertrack, sering dilupakan.

**Sekarang:** Operator buka HP → langsung lihat daftar tugas hari ini, dikelompokkan per kategori (Produksi/Kualitas/Gudang/Teknisi). Tap "Mulai" untuk kerjakan. Tap "Selesai" kalau sudah beres. Kalau ada kendala, tap "Lapor Isu" — pilih kategori masalah, lokasi, dan deskripsi. Tugas yang terhubung ke Work Order bisa langsung diklik "Lihat Dokumen" untuk lihat detail order.

**Kenapa penting:** Zero waiting time. Operator langsung produktif dari menit pertama. Kendala dilaporkan secara terstruktur (kategori + lokasi + deskripsi), bukan chat random yang bisa hilang. Supervisor langsung tahu ada kendala lewat kolom "KENDALA" di Kanban board mereka.

---

### 3. Dashboard Manajer Real-time (Operations Command Center)

**Sebelumnya:** Supervisor harus jalan keliling pabrik untuk tahu: mesin mana yang jalan, operator mana yang idle, material apa yang hampir habis, ada QC gagal atau tidak. Informasi tersebar dan harus ditanyakan satu per satu.

**Sekarang:** Satu halaman "Pusat Komando Pabrik" menampilkan: 4 KPI utama (Efisiensi Produksi, Order Tepat Waktu, Tingkat Lolos QC, Staf Aktif), status line produksi dengan progress bar dari Work Order aktif, aktivitas staf real-time, tracking bahan baku kritis, dan hasil inspeksi QC terbaru. Semua data dari database — bukan mock.

**Kenapa penting:** Supervisor tidak perlu keliling 30 menit. Buka HP 10 detik, langsung tahu situasi pabrik. "Line 2 progress 75%, material X critical, QC batch kemarin gagal." Keputusan bisa diambil lebih cepat, masalah ditangani sebelum membesar.

---

### 4. Integrasi Tugas dengan Order (Cross-Module Linking)

**Sebelumnya:** Tugas berdiri sendiri — tidak terhubung ke order produksi, purchase order, atau sales order. Kalau operator mau tahu detail order terkait, harus buka halaman lain dan cari manual.

**Sekarang:** Saat membuat tugas, manajer bisa langsung link ke Work Order, Purchase Order, atau Sales Order yang aktif. Operator lihat badge order di kartu tugas. Klik "Lihat Dokumen" langsung buka halaman detail order terkait. Di Kanban manajer, setiap kartu tugas menampilkan nomor order yang terhubung.

**Kenapa penting:** Konteks lengkap dalam satu tempat. Operator tahu bukan hanya "potong kain" tapi "potong kain untuk WO-2026-001 (order Zara, deadline Jumat)." Ini mengurangi kesalahan karena kurang informasi dan membuat semua pekerjaan bisa di-trace balik ke order asalnya.
