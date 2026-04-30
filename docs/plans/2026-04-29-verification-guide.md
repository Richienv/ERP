# Panduan Verifikasi — Document System Hardening + Pengadaan Performance Sprint

**Tanggal:** 2026-04-29
**Branch:** `feat/integra-mining-pivot`
**Untuk:** Manual testing semua perubahan dari 2 sprint terakhir
**Server dev:** `npm run dev` → http://localhost:3000

---

## Cara pakai panduan ini

Setiap test punya format:
- **Halaman**: URL yang harus dibuka
- **Sebelumnya**: Apa yang broken sebelum fix
- **Sekarang**: Apa yang harus terjadi setelah fix
- **Cara test**: Step-by-step
- **✅ Pass**: Tanda berhasil
- **❌ Fail**: Tanda gagal — laporkan kalau ketemu

Centang `[x]` setiap test yang sudah lulus. Kalau ada yang gagal, screenshot + tulis di bagian bawah dokumen.

---

# BAGIAN A — Document Hardening (24 fixes shipped)

## A1 — Branding Form bisa disimpan ✓ admin only

**Halaman:** http://localhost:3000/settings → klik tab **Branding**

**Sebelumnya:**
- Form save gagal dengan "Internal error" (Bucket not found / RLS violation / stale Prisma)
- Setiap user (termasuk STAFF) bisa edit branding → security hole

**Sekarang:**
- Cuma ROLE_ADMIN/CEO/DIRECTOR yang bisa edit
- Form ada live PDF preview di kanan
- Logo upload via drag-drop dengan preview

**Cara test (sebagai ADMIN):**
1. [ ] Login dengan akun admin
2. [ ] Buka `/settings` → klik tab **Branding**
3. [ ] Form layout 2-kolom muncul (form kiri, preview kanan)
4. [ ] Isi: Nama = `PT Demo`, NPWP = `01.234.567.8-901.000`, Telepon, Email
5. [ ] Live preview di kanan harus update real-time saat ngetik
6. [ ] Pilih warna brand (klik kotak warna, pilih orange `#f97316`)
7. [ ] Preview update warna heading
8. [ ] Drag-drop file logo PNG/JPG (≤2MB) ke drop zone
   - **✅ Pass**: Toast hijau "Logo diupload" + preview muncul + label hijau "✓ Preview baru"
   - **❌ Fail**: Toast merah dengan error spesifik (screenshot + tunjukkan)
9. [ ] Klik **Simpan Branding**
   - **✅ Pass**: Toast "Branding disimpan" + indikator "Tersimpan terakhir HH:MM"
   - **❌ Fail**: Toast merah → screenshot + cek terminal `npm run dev`
10. [ ] Refresh halaman → semua field tetap terisi, logo masih ada

**Cara test negative (sebagai STAFF):**
11. [ ] Logout, login dengan user STAFF (atau buat akun baru tanpa role admin)
12. [ ] Buka DevTools → Console, jalankan:
    ```js
    fetch('/api/settings/branding', {
        method: 'PATCH',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({tenantName: 'Hack'})
    }).then(r => console.log(r.status))
    ```
   - **✅ Pass**: `403`
   - **❌ Fail**: `200` atau `500`

---

## A2 — Auto-snapshot setelah PO approval

**Halaman:** http://localhost:3000/procurement/orders → klik PO mana saja → tab **Lampiran**

**Sebelumnya:**
- PDF generate on-demand setiap klik (no version, no audit)
- User harus manual klik "Generate" untuk lihat PDF

**Sekarang:**
- Approve PO → snapshot otomatis dibuat dalam 2-3 detik
- Logo + warna brand muncul di PDF (dari A1)
- Versi tersimpan immutable

**Cara test:**
1. [ ] Buat PO baru atau pakai PO PENDING_APPROVAL
2. [ ] Sebagai user dengan role MANAGER/CEO/DIRECTOR/ADMIN, klik **Setujui PO**
   - **✅ Pass**: Toast "PO disetujui"
3. [ ] Pindah ke tab **Lampiran**
4. [ ] Tunggu ~3-5 detik (auto-snapshot generate di background)
   - **✅ Pass**: Muncul `v1 • TERBARU` dengan timestamp + label "AUTO_PO_APPROVED"
   - **❌ Fail**: Stuck di "Belum ada dokumen" → cek terminal log
5. [ ] Klik icon **Print** (printer icon)
   - **✅ Pass**: PDF buka di tab baru, header pakai logo + warna brand dari A1
6. [ ] Klik icon **Buat Versi Baru** (rotate icon)
   - **✅ Pass**: v2 muncul, v1 tetap accessible, TERBARU pindah ke v2

---

## A3 — PR template baru (tidak lagi rendering sebagai "PURCHASE ORDER")

**Halaman:** http://localhost:3000/procurement/requests → buat/buka PR → **Setujui** → tab **Lampiran**

**Sebelumnya:**
- PR snapshot render sebagai "PURCHASE ORDER" PDF (template salah)

**Sekarang:**
- Header PDF: **"FORMULIR PERMINTAAN PEMBELIAN"**
- Field PR-specific: Pemohon, Departemen, Prioritas, Justifikasi
- Tidak ada vendor/PPN/harga (dokumen internal)

**Cara test:**
1. [ ] Buat PR baru dengan items + isi field "Justifikasi/Notes"
2. [ ] Approve PR
3. [ ] Buka tab Lampiran → tunggu v1 muncul
4. [ ] Klik Print
   - **✅ Pass**: Header PDF tertulis "FORMULIR PERMINTAAN PEMBELIAN" (BUKAN "PURCHASE ORDER")
   - **✅ Pass**: Kolom hanya Kode | Nama Barang | Qty | Catatan (TIDAK ada harga/PPN)
   - **✅ Pass**: Section "Justifikasi" tampil di bawah tabel
   - **❌ Fail**: Header masih "PURCHASE ORDER" → bug

---

## A4 — AR Invoice auto-snapshot

**Halaman:** http://localhost:3000/finance/invoices → klik invoice → buka detail drawer

**Sebelumnya:**
- Invoice issued tidak menghasilkan PDF snapshot

**Sekarang:**
- Issue invoice → snapshot otomatis dibuat
- Detail drawer punya section "Dokumen PDF (versi tercatat)"

**Cara test:**
1. [ ] Buka `/finance/invoices`, klik salah satu invoice DRAFT
2. [ ] Klik tombol **Send / Issue** → status berubah ISSUED
3. [ ] Tunggu 3-5 detik, lihat detail drawer
   - **✅ Pass**: Section "Dokumen PDF (versi tercatat)" muncul di atas Attachments
   - **✅ Pass**: v1 snapshot muncul dengan label "AUTO_INVOICE_ISSUED"
4. [ ] Klik Print
   - **✅ Pass**: PDF buka dengan branding perusahaan dari A1

---

## A5 — IDOR Security (paling penting!)

**Halaman:** Browser DevTools Console di halaman mana saja

**Sebelumnya:**
- STAFF user bisa download CEO payslip / AP bill / faktur pajak via guess UUID

**Sekarang:**
- Semua document API endpoints cek role per DocType (PROCUREMENT_VIEWERS / FINANCE_VIEWERS / dll)

**Cara test (sebagai PROCUREMENT user):**
1. [ ] Login sebagai user PROCUREMENT, buka satu PO, copy snapshot ID dari Lampiran tab
2. [ ] Logout, login sebagai user STAFF (no role)
3. [ ] DevTools Console:
   ```js
   fetch('/api/documents/snapshots/<paste-snapshot-id>').then(r => console.log(r.status))
   ```
   - **✅ Pass**: `403`
   - **❌ Fail**: `200` (security hole — IDOR vulnerability)
4. [ ] Coba juga GET list:
   ```js
   fetch('/api/documents/snapshots?type=PO&entityId=<po-id>').then(r => console.log(r.status))
   ```
   - **✅ Pass**: `403`

---

## A6 — Email button SUDAH HILANG

**Halaman:** PO/PR/GRN/Invoice Lampiran tab → versi snapshot

**Sebelumnya:**
- Tombol Mail icon yang lying ("Email dikirim" tapi cuma console.log)

**Sekarang:**
- Hanya 3 tombol: Cetak (Printer), Unduh (Download), Buat Versi Baru (Refresh)

**Cara test:**
1. [ ] Buka PO yang sudah di-approve → tab Lampiran
2. [ ] Hover ke baris snapshot
   - **✅ Pass**: Lihat 3 icon: 🖨 Cetak, ⬇ Unduh, 🔄 Buat Versi Baru + tooltip Bahasa
   - **✅ Pass**: TIDAK ada icon ✉ Email
3. [ ] Hover masing-masing icon
   - **✅ Pass**: Tooltip "Cetak", "Unduh PDF", "Buat Versi Baru"

---

## A7 — Audit trail tidak bisa hilang (cascade Restrict)

**Halaman:** Prisma Studio (`npx prisma studio` di terminal lain)

**Sebelumnya:**
- Cascade delete → distributions ikut hilang (audit trail wiped)

**Sekarang:**
- Restrict — admin harus delete distributions dulu

**Cara test:**
1. [ ] Buka terminal baru, jalankan `npx prisma studio`
2. [ ] Buka tabel `document_snapshots`
3. [ ] Pilih satu snapshot yang ada `document_distributions` (sudah pernah di-print/download)
4. [ ] Klik delete pada snapshot itu
   - **✅ Pass**: Error "Foreign key constraint failed" — tidak bisa delete
   - **❌ Fail**: Snapshot terhapus + distribution rows ikut hilang

---

## A8 — PO rollback saat finance error (atomic)

**Cara test (manual scenario):**
1. [ ] Buka Prisma Studio, tutup periode finansial (atau set period ke "CLOSED")
2. [ ] Coba approve PO baru via UI
   - **✅ Pass**: Error toast "Failed: period locked..." muncul
   - **✅ Pass**: PO status TETAP `PENDING_APPROVAL` (TIDAK berubah jadi APPROVED)
3. [ ] Cek tabel `purchase_order_events` untuk PO ini
   - **✅ Pass**: Ada event `TRANSITION_FAILED` dengan reason "Bill creation failed: ..."
4. [ ] Buka periode lagi → approve sukses normal

---

# BAGIAN B — Performance Sprint (15 fixes shipped)

## B1 — Sidebar hover prefetch (was 50-300ms TTFB → now ~5-20ms)

**Halaman:** http://localhost:3000/dashboard

**Sebelumnya:**
- Setiap hover sidebar fire `supabase.auth.getUser()` → 50-300ms TTFB
- 5-20 prefetch per session × 200ms = 1-4 detik wasted

**Sekarang:**
- Middleware skip auth untuk prefetch requests
- Prefetch instant <20ms

**Cara test:**
1. [ ] Buka DevTools → Network tab, filter "Doc"
2. [ ] **Hover** (jangan klik) sidebar item "Pengadaan" → "Pesanan Pembelian"
3. [ ] Lihat request prefetch yang fire
   - **✅ Pass**: Request `/procurement/orders` dengan header `next-router-prefetch: 1`, response time **<30ms**
   - **❌ Fail**: TTFB >100ms atau request gagal
4. [ ] Klik link
   - **✅ Pass**: Halaman load **near-instant** karena bundle + data sudah pre-warmed

---

## B2 — PO list page (was ~600-1200ms → now ~200-400ms warm)

**Halaman:** http://localhost:3000/procurement/orders

**Sebelumnya:**
- Hook fire 4 server actions tiap visit (orders, vendors, products, warehouses)
- 2 dari 4 (products, warehouses) tidak dipakai di list view

**Sekarang:**
- Hanya 2 server actions (orders, vendors)
- products + warehouses pindah ke `usePOFormOptions` (lazy)

**Cara test:**
1. [ ] DevTools Network tab, filter "Fetch/XHR"
2. [ ] **Cold load** (clear cache, refresh): catat total time
   - **✅ Pass**: ~400-700ms
3. [ ] Navigate ke `/dashboard`, lalu balik ke `/procurement/orders`
4. [ ] **Warm load** (cache hit): catat time
   - **✅ Pass**: <200ms (near-instant — TanStack Query serves cached data)
   - **❌ Fail**: Still 600ms+ → cache miss issue
5. [ ] Cek server actions yang fire
   - **✅ Pass**: Hanya `getAllPurchaseOrders` + `getVendors` (2 calls)
   - **❌ Fail**: Juga ada `getProductsForPO` + `getWarehousesForGRN` → P erf-3 not landed

---

## B3 — PO detail row hover prefetch (was cold-load → now warm-load)

**Halaman:** http://localhost:3000/procurement/orders → list page

**Sebelumnya:**
- Klik row = `router.push(...)` → cold load detail page (~300-700ms blank)

**Sekarang:**
- Hover row = `router.prefetch(...)` → route bundle + data pre-loaded

**Cara test:**
1. [ ] DevTools Network tab
2. [ ] Hover row PO selama ~300ms (jangan klik dulu)
   - **✅ Pass**: Network fire prefetch untuk `/procurement/orders/<id>`
3. [ ] Klik row
   - **✅ Pass**: Detail page muncul **near-instant** (<200ms)
4. [ ] Compare: hover-then-click vs cold-click (ke row yang belum di-hover)
   - **✅ Pass**: Hover-then-click visibly faster

---

## B4 — PO detail tabs lazy-mount

**Halaman:** http://localhost:3000/procurement/orders/[any-id]

**Sebelumnya:**
- All 6 tabs (Header, Item, Approval, History, Lampiran, Komunikasi) mount upfront
- Lampiran's `useDocumentSnapshots` fire fetch immediately

**Sekarang:**
- Hanya HeaderTab eager
- ItemTab, ApprovalTab, HistoryTab, LampiranTab, KomunikasiTab lazy via `next/dynamic`

**Cara test:**
1. [ ] DevTools Network tab, filter **JS**
2. [ ] Buka detail PO baru (clear cache)
3. [ ] Cek JS chunks yang load
   - **✅ Pass**: Hanya HeaderTab chunk; tab lain belum di-load
4. [ ] Klik **Lampiran** tab
   - **✅ Pass**: Network fire chunk `lampiran-tab.js` saat klik
5. [ ] Klik **Approval** tab
   - **✅ Pass**: Chunk `approval-tab.js` load on demand
6. [ ] Klik balik ke Header
   - **✅ Pass**: Instant (cached)

---

## B5 — Lampiran NO MORE polling (was 1.5 req/s → now 0)

**Halaman:** http://localhost:3000/procurement/orders/[id-with-snapshot] → tab Lampiran

**Sebelumnya:**
- Lampiran tab polling `GET /api/documents/snapshots` setiap 2 detik selama 30 detik
- 1.5 req/s background noise per detail page

**Sekarang:**
- Polling sepenuhnya dihilangkan
- Refresh manual via "Buat Versi Baru" button

**Cara test:**
1. [ ] Buka PO detail dengan snapshot
2. [ ] Klik tab Lampiran → snapshot muncul
3. [ ] DevTools Network tab → tunggu 30 detik
   - **✅ Pass**: TIDAK ada request `GET /api/documents/snapshots?...` setiap 2 detik
   - **❌ Fail**: Repeating GET every 2s → Perf-2 not landed
4. [ ] Klik "Buat Versi Baru" (regen)
   - **✅ Pass**: 1 request fire, lalu tenang lagi

---

## B6 — Vendor list NO MORE 60s polling

**Halaman:** http://localhost:3000/procurement/vendors

**Sebelumnya:**
- `useVendors` polling setiap 60 detik
- Comment di code: "vendor list rarely changes" — polling pure waste

**Sekarang:**
- Polling dihilangkan, rely pada staleTime + invalidation

**Cara test:**
1. [ ] Buka `/procurement/vendors`
2. [ ] DevTools Network tab → tunggu 2 menit
   - **✅ Pass**: TIDAK ada request `getVendors` fire setiap 60s
   - **❌ Fail**: Repeating fetch every minute

---

## B7 — Bundle size reduction (xlsx + framer-motion lazy)

**Halaman:** Mode production build (`npm run build && npm run start`)

**Sebelumnya:**
- xlsx (~140KB gz) bundled ke setiap PO/PR/GRN list page
- framer-motion (~85KB gz) bundled ke setiap halaman

**Sekarang:**
- xlsx lazy-load saat user klik export/import
- framer-motion diganti CSS keyframe

**Cara test (advanced — optional):**
1. [ ] Build production: `npm run build`
2. [ ] Lihat output build → cari size untuk `/procurement/orders` route
3. [ ] **Compare:** sebelum sprint vs sekarang
   - **✅ Pass**: Initial JS untuk procurement pages turun ~400-500KB gz
4. [ ] Atau: install `@next/bundle-analyzer`, jalankan analyze
5. [ ] Verifikasi xlsx + framer-motion bukan di main chunks

**Skip kalau ribet:** Cukup lihat di DevTools Network → "JS" → load count saat first-visit. Should be lebih sedikit chunks.

---

## B8 — Smoothness keseluruhan (subjective check)

**Cara test:**
1. [ ] Login fresh
2. [ ] Klik berurutan: `/dashboard` → `/procurement` → `/procurement/orders` → klik PO → Lampiran → balik → klik PO lain → Approval → balik
3. [ ] Catat impression umum:
   - **✅ Pass**: Semua transition ≤500ms (kecuali first-visit dev compile yang tidak terkontrol)
   - **❌ Fail**: Ada step yang masih >1s konsisten → laporkan step mana

---

# BAGIAN C — Workflow Tests

## C1 — Create PO → Approve → GRN → semua pakai branding

**Cara test end-to-end:**
1. [ ] Pastikan branding sudah terisi (A1)
2. [ ] Create PR baru → approve → convert ke PO
3. [ ] Approve PO
4. [ ] Buka tab Lampiran → v1 PDF should have logo + warna brand
5. [ ] Mark as Ordered (jika ada button) → tunggu v2 (AUTO_PO_SENT)
6. [ ] Create GRN dari PO → accept GRN
7. [ ] Buka GRN detail → Lampiran → v1 GRN PDF should also have branding

---

## C2 — Test rollback fail flow (advanced)

(Kalau punya akses Prisma Studio)
1. [ ] Tutup current period (Prisma Studio: edit `accounting_period.status` → `CLOSED`)
2. [ ] Approve PO baru via UI
   - **✅ Pass**: Toast error muncul, PO tetap di status PENDING_APPROVAL
3. [ ] Cek `purchase_order_events` table — should ada `TRANSITION_FAILED` event
4. [ ] Buka period lagi → approve normal

---

# Reporting

## Catatan kalau ada test yang FAIL

Kalau ada test gagal, tulis di sini:

| Test | Step | Apa yang terjadi | Screenshot |
|------|------|------------------|------------|
| (e.g. A1, step 9) | "Klik Simpan Branding" | Toast error: "Internal error: ..." | (paste screenshot) |
|  |  |  |  |

## Apa yang harus dilihat di terminal `npm run dev`

Kalau toast error muncul, lihat terminal — log akan seperti:
```
[PATCH /api/settings/branding] error: <stack trace lengkap>
```

Copy paste ke laporan.

---

# Quick Sanity Checklist (5 menit cek cepat)

Kalau gak ada waktu jalanin semua:

- [ ] **A1**: Branding form bisa save tanpa error
- [ ] **A2**: Approve PO → PDF muncul di Lampiran dalam ~5 detik
- [ ] **A6**: Tidak ada Email button di snapshot row
- [ ] **B5**: Lampiran tab tidak polling (cek Network 30 detik)
- [ ] **B8**: Navigation antara pengadaan pages terasa snappy

Kalau 5 ini lulus = sprint kerja dengan benar. Sisanya cek detailed.

---

**Selamat testing! 🚀**

Setelah selesai, kalau semua hijau → ready untuk merge ke main atau push ke staging.
Kalau ada yang merah → laporkan dengan detail di tabel di atas.
