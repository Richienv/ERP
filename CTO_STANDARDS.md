# CTO STANDARDS & RULES OF ENGAGEMENT

**Document ID**: `CTO-STD-001`
**Purpose**: To ensure every line of code functionality meets "Enterprise Grade" standards.
**Audience**: AI Developers & Human Reviewers.

---

## 1. THE GOLDEN RULES (Prinsip Utama)
*Rules ini bersifat MUTLAK. Pelanggaran terhadap rules ini dianggap sebagai kegagalan task.*

### Rule #1: NO MOCKUPS / NO PLACEHOLDERS
*   **Dilarang Keras** menggunakan data dummy hardcoded (contoh: `const data = [{id: 1, name: 'Dummy'}]`).
*   **Wajib** fetch data dari Database (Supabase/PostgreSQL) via Prisma.
*   Jika data belum ada, **buat Seed Script** `prisma/seed.ts` untuk mengisinya, jangan hardcode di UI.

### Rule #2: FULL-STACK INTEGRITY (Tuntas ke Akar)
Sebuah fitur dianggap "Selesai" HANYA jika memenuhi **5 Layer Integrasi**:
1.  **Database Layer**: Schema Prisma terdefinisi (`schema.prisma`).
2.  **Data Layer**: Server Action (`actions/*.ts`) untuk CRUD aman (Zod validation).
3.  **UI Layer**: Component (`.tsx`) yang memanggil Server Action tsb.
4.  **Feedback Layer**: Toast success/error notification (`sonner`) & Loading state (`useTransition`).
5.  **Security Layer**: Cek permission/role user sebelum eksekusi action.

### Rule #3: INTER-CONNECTIVITY (Keterhubungan)
*   Jangan buat fitur "Pulau" (berdiri sendiri).
*   **Contoh Benar**: Tombol "Terima Barang" di Gudang -> (1) Update Status PO, (2) Tambah Stok Fisik, (3) Catat Jurnal Akuntansi.
*   **Contoh Salah**: Tombol "Terima Barang" hanya ubah status jadi "Done" tanpa efek lain.

### Rule #4: NO AI FEATURES (Back to Basics)
*   Dilarang implementasi chatbot, prediksi, atau fitur "smart" lainnya sebelum Core Business Logic berjalan sempurna.
*   Fokus pada: Input Data, Proses Data, Laporan Data.

---

## 2. STANDAR IMPLEMENTASI (Workflow)

Setiap kali mengerjakan Tiket/Task dari `master_roadmap.md`, ikuti langkah ini:

### Step 1: Database Verification
*   Cek `schema.prisma`. Apakah tabel yang dibutuhkan sudah ada?
*   Apakah relasi (FK) ke tabel lain sudah benar (misal: `customerId` di `SalesOrder`)?
*   *Action*: Update schema & jalankan `prisma generate`.

### Step 2: Server Action (The Engine)
*   Buat file di `app/actions/[module].ts`.
*   Gunakan library `zod` untuk validasi input.
*   Gunakan `revalidatePath` agar UI update otomatis.
*   *Code Standard*:
    ```typescript
    export async function createItem(data: InputType) {
        // 1. Validate
        // 2. Auth Check
        // 3. DB Transaction
        // 4. Return { success: true, data: result }
    }
    ```

### Step 3: UI Implementation (The Face)
*   Gunakan `useTransition` untuk handle loading state yang smooth.
*   Gunakan Form Action atau `onClick` handler yang memanggil Server Action.
*   Tampilkan feedback user: `toast.success("Berhasil disimpan")` atau `toast.error(message)`.
*   **NO `Link href="#"`**: Semua link harus menuju halaman nyata.

---

## 3. CHECKLIST KUALITAS (Definition of Done)

Sebelum lapor "Selesai" ke User, AI wajib cek:

- [ ] **Real DB Check**: Apakah data yang saya input di UI benar-benar masuk ke Table Supabase?
- [ ] **Relation Check**: Apakah data ini terhubung ke parent-nya? (misal: Item Order terhubung ke Order ID?)
- [ ] **Refresh Check**: Apakah setelah save, data langsung muncul tanpa refresh halaman manual?
- [ ] **Error Check**: Apa yang terjadi jika saya input data kosong? Apakah aplikasi crash atau muncul pesan error sopan?

---

## 4. LARANGAN KERAS (Big No-No)
1.  Menggunakan `any` di TypeScript.
2.  Membuat UI "kosong" (hanya tampilan tapi tombol tidak bisa diklik).
3.  Menjawab "Saya sudah implementasi" padahal hanya buat file tapi belum di-connect.


---

## 5. USER GUIDE: HOW TO ENFORCE THIS (Manual Penggunaan)

Agar AI (Gemini) selalu patuh, gunakan **"Magic Prompt"** ini di awal setiap sesi baru:

> "Agent, tolong baca `CTO_STANDARDS.md` dan `master_roadmap.md`. Saya ingin mengerjakan item [Nama Task]. Buatkan Implementation Plan yang mematuhi Rule #2 (Full-Stack Integrity). Jangan mulai koding sebelum plan disetujui."

### Siklus Kerja (The Loop)
1.  **Select Task**: Pilih 1 item dari `master_roadmap.md` yang statusnya `[ ]`.
2.  **Audit Plan**: Minta AI buat plan. Tanya: *"Apakah ini sudah pakai real DB? Apakah ada server action?"*
3.  **Execute**: Biarkan AI coding.
4.  **CTO Review**: Sebelum terima, minta AI verifikasi: *"Coba cek ulang, apakah kamu melanggar Rule #1 atau Rule #3?"*

