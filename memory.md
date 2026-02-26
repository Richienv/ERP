# Memory — ERP Development Log

> Dokumen ini mencatat perubahan penting berserta konteks, alasan, dan cara verifikasi.
> Updated: 2026-02-25

---

## 2026-02-25: Inventory > Kelola Produk — Major Kanban Redesign

### Sebelum (Before)
- Kanban board memiliki **4 kolom**: New Arrivals, Healthy Stock, Low Stock, Critical/Alert
- **"New Arrivals"** kolom menampilkan produk baru (< 24 jam) dengan nama kurang tepat
- **Purchase Request (PR)** hanya bisa dibuat saat user drag produk ke kolom Critical — artinya user harus menandai produk sebagai KRITIS dulu baru bisa beli
- **KPI strip** menampilkan 5 stat: Total Produk, Stok Sehat, Stok Menipis, Kritis, Nilai Inventori
- **Total produk mismatch** — total menunjukkan 5, tapi penjumlahan kategori lain hanya 4 (produk NEW tidak terhitung di breakdown)
- **Produk baru tidak muncul** di kanban setelah save tanpa full page refresh (bug `useState` tidak sync dengan prop baru)

### Sesudah (After)
1. **Renamed "New Arrivals" → "Incoming"** — lebih jelas artinya, menandakan produk yang baru masuk ke sistem
2. **Tambah kolom "Planning (PR Aktif)"** — kolom baru berwarna violet yang menampilkan semua produk yang memiliki Purchase Request aktif (pending). Data diambil dari tabel `PurchaseRequestItem` di database
3. **PR button di setiap card** — hover ke card mana saja akan menampilkan tombol "Request PR". User bisa langsung kirim Purchase Request dari card mana saja (Healthy, Low Stock, Incoming, dll) — **tidak perlu drag ke Critical lagi**
4. **KPI strip 6 kolom** — ditambah stat "Planning" (jumlah produk dengan PR aktif) berwarna violet
5. **Fix total mismatch** — `newArrivals` count ditambahkan ke stats
6. **Fix produk baru tidak muncul** — Added `useEffect` di `InventoryKanbanBoard` untuk sync state internal dengan props terbaru dari React Query

### File yang Diubah
| File | Perubahan |
|------|-----------|
| `lib/inventory-logic.ts` | Added `PLANNING` to `KanbanStatus` type |
| `app/api/inventory/page-data/route.ts` | Added pending PR lookup, `hasPendingPR` field to products, `planning` + `newArrivals` to stats |
| `hooks/use-products-query.ts` | Added `planning` + `newArrivals` defaults to stats |
| `app/inventory/products/products-client.tsx` | Added Planning KPI stat + `ClipboardList` icon, grid 6 cols |
| `components/inventory/inventory-kanban-board.tsx` | Full rewrite: renamed Incoming, added Planning column, added PR button on every card, refactored dialog to support normal PR vs critical restock |

### Cara Verifikasi (How to Check)
1. **Buka** `Inventory > Kelola Produk`
2. **KPI strip** — cek bahwa total produk = penjumlahan semua kategori (Sehat + Menipis + Kritis + Incoming produk baru). Cek stat "Planning" berwarna violet
3. **Kanban view** — harus ada 5 kolom: Incoming, Healthy Stock, Low Stock, Critical/Alert, Planning (PR Aktif)
4. **Hover di card mana saja** — akan muncul tombol "Request PR" berwarna violet. Klik untuk membuka PR dialog
5. **PR Dialog** — isi jumlah + catatan → klik "Buat PR" → cek toast success muncul + card menampilkan badge "PR" ungu
6. **Planning column** — setelah PR dibuat, produk tersebut akan muncul di kolom Planning
7. **Tambah produk baru** — klik "Produk Baru", isi data, save → produk harus langsung muncul di kolom Incoming tanpa full page refresh

### Kenapa Penting (Why This Matters)
- **PR dari card apapun**: Sebelumnya user harus menandai produk KRITIS dulu baru bisa purchase. Ini membuat workflow procurement terputus — banyak produk yang perlu dibeli tapi belum kritis. Sekarang purchasing bisa dimulai dari mana saja
- **Planning column**: Memberikan visibility produk mana yang sudah di-request untuk pembelian — penting untuk tracking pipeline procurement
- **Total mismatch fix**: Data yang tidak konsisten menurunkan kepercayaan user terhadap sistem

---

## 2026-02-25 (Update 2): Planning Column → Paling Kiri + PR di Quick View

### Sebelum (Before)
- Planning column berada di posisi paling kanan (kolom ke-5)
- Product Quick View popup (klik card → detail) **tidak ada** tombol untuk membuat PR — hanya bisa lihat detail, edit, hapus

### Sesudah (After)
1. **Planning column dipindah ke paling kiri** — karena planning/purchasing adalah langkah pertama dalam workflow procurement. Urutan sekarang: Planning → Incoming → Healthy → Low Stock → Critical
2. **Tombol "Buat Purchase Request" di Quick View popup** — di bawah detail produk (read-only mode), ada tombol violet "Buat Purchase Request". Klik untuk expand form inline dengan field yang sama seperti dialog critical restock:
   - Jumlah (auto-filled berdasarkan deficit stok)
   - Gudang tujuan (opsional)
   - Catatan/alasan
   - Estimasi biaya (subtotal + PPN 11% + total)
   - Tombol "Buat PR" dan "Batal"

### File yang Diubah
| File | Perubahan |
|------|-----------|
| `components/inventory/inventory-kanban-board.tsx` | Reorder kolom: Planning first. Pass `warehouses` to `ProductQuickView` |
| `components/inventory/product-quick-view.tsx` | Added `warehouses` prop, PR form state, `handleQuickPR` handler, inline PR form section with cost estimation |

### Cara Verifikasi (How to Check)
1. **Kanban view** — Planning harus ada di paling kiri
2. **Klik card mana saja** → popup detail produk muncul
3. **Scroll ke bawah** — harus ada tombol violet "Buat Purchase Request"
4. **Klik tombol** → form expand: isi jumlah, pilih gudang, tambah catatan
5. **Estimasi biaya** — muncul otomatis jika HPP dan jumlah terisi
6. **Klik "Buat PR"** → toast success, form collapse, data di-refresh

### Kenapa Penting
- User bisa membuat PR langsung dari popup detail produk — **tanpa harus kembali ke kanban view, hover card, atau drag card**
- Flow yang sama: jumlah, gudang, catatan, estimasi biaya — konsisten dengan critical restock dialog
- Planning di kiri = first thing user sees = first thing to do

---

## 2026-02-25 (Update 3): Incoming Column = PO Aktif + Procurement Pipeline Badges

### Sebelum (Before)
- **Incoming column** menampilkan produk baru (< 24 jam, status NEW) — tidak menunjukkan apakah barang sedang datang
- Tidak ada tracking pipeline procurement di card
- Dashboard Inventory tidak menampilkan pending PR count

### Sesudah (After)
1. **Incoming column sekarang berdasarkan PO aktif** — menampilkan produk yang memiliki Purchase Order dengan status: APPROVED, ORDERED, VENDOR_CONFIRMED, SHIPPED, PARTIAL_RECEIVED. Ini berarti user bisa melihat barang yang **benar-benar sedang datang**
2. **Produk NEW kembali ke kolom status asli** — produk baru (< 24 jam) sekarang masuk ke HEALTHY/LOW_STOCK/CRITICAL berdasarkan stok, bukan kolom Incoming
3. **Procurement Pipeline Badge di setiap card** — jika produk memiliki PR/PO aktif, card menampilkan:
   - Status badge (PR PENDING, PR APPROVED, APPROVED, ORDERED, VENDOR_CONFIRMED, SHIPPED dll)
   - Nomor PR/PO
   - Nama supplier
   - ETA (expected date) jika ada
4. **KPI strip 7 kolom** — ditambah stat "Incoming" (cyan) selain "Planning" (violet) yang sudah ada
5. **Dashboard Inventory updated** — Procurement Insights bar sekarang menampilkan jumlah pending PR (Planning section violet) di samping Restock dan Incoming yang sudah ada

### Alur Data (Data Flow)
```
Product card → Request PR (violet button)
    ↓
Planning column (PR: PENDING → APPROVED)
    ↓ (PR dikonversi menjadi PO)
Incoming column (PO: APPROVED → ORDERED → SHIPPED)
    ↓ (PO received, stok bertambah)
Healthy/Low Stock/Critical (berdasarkan stok aktual)
```

### File yang Diubah
| File | Perubahan |
|------|-----------|
| `app/api/inventory/page-data/route.ts` | Full rewrite: fetch PR items + PO items, build `procurementStatus` & `procurementDetail` per product, add `hasIncomingPO`, `incoming` stat |
| `lib/inventory-logic.ts` | Added `INCOMING` to `KanbanStatus` type |
| `components/inventory/inventory-kanban-board.tsx` | Incoming column now filters by `hasIncomingPO`, added `INCOMING` status styling (cyan), added procurement badge on cards |
| `app/inventory/products/products-client.tsx` | 7-col KPI strip with Incoming (cyan) stat |
| `hooks/use-products-query.ts` | Added `incoming` default to stats |
| `app/actions/inventory.ts` | Added `pendingPRCount` query in `getProcurementInsights` |
| `components/inventory/procurement-insights.tsx` | Added Planning section (violet) showing pending PR count |

### Cara Verifikasi (How to Check)
1. **Kanban** — harus ada 5 kolom: Planning | Incoming | Healthy | Low Stock | Critical
2. **Planning** — berisi produk dengan PR pending (belum jadi PO)
3. **Incoming** — berisi produk dengan PO approved/ordered/shipped (barang yang sedang datang)
4. **Card dengan PR/PO** — harus menampilkan badge status (PR PENDING, ORDERED, SHIPPED, dll) + nomor + supplier + ETA
5. **KPI strip** — harus 7 stat termasuk Planning (violet) dan Incoming (cyan)
6. **Dashboard Inventory** (`/inventory`) — Procurement Insights harus menampilkan Planning PR count jika ada

---
