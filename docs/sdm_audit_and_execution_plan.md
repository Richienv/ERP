# SDM / HCM Audit and Execution Plan

## 1) Executive Summary

Status saat ini: **SDM UI sudah terlihat lengkap, tetapi backend SDM belum terhubung penuh**.

- `/hcm`, `/hcm/employee-master`, `/hcm/attendance`, `/hcm/payroll` masih dominan mock/static data.
- Fondasi database SDM sudah ada: `Employee`, `Attendance`, `LeaveRequest`, `EmployeeTask`.
- Integrasi lintas modul sudah mulai ada di level data/process (Procurement, Inventory, QC, Dashboard CEO), tetapi belum dibungkus dalam modul SDM operasional end-to-end.

Kesimpulan: SDM bisa dijadikan **spine dependensi antar modul**, tetapi perlu implementasi backend SDM yang sistematis.

---

## 2) Current-State Audit (As-Is)

## 2.1 UI / Route Audit

- `/app/hcm/page.tsx`
  - Dashboard SDM + widget, namun source data bukan query server yang stabil.
  - Beberapa area placeholder (“Modul ... akan ditampilkan di sini”).

- `/app/hcm/employee-master/page.tsx`
  - Daftar karyawan dari array `employees` statis.
  - Tombol tambah/edit/hapus belum ke DB.

- `/app/hcm/attendance/page.tsx`
  - Data absensi `attendanceToday` + `monthlyStats` statis.
  - Clock-in/out belum menulis ke tabel `attendance`.

- `/app/hcm/payroll/page.tsx`
  - `payrollData` statis.
  - Tidak ada payroll run engine, approval chain, atau posting ke Finance.

## 2.2 Database & Domain Audit

Sudah ada di schema:

- `Employee`
- `Attendance`
- `LeaveRequest`
- `EmployeeTask`

Belum ada model payroll inti:

- `PayrollPeriod`
- `PayrollRun`
- `PayrollLineItem`
- `Payslip`
- `PayrollComponent`

## 2.3 Integration Audit (Cross-Module)

Sudah terhubung parsial:

- Procurement:
  - `PurchaseRequest.requesterId` / `approverId` -> `Employee`
- Inventory:
  - Stock opname approval memakai `EmployeeTask`
  - Manager gudang di-resolve dari `Employee`
- Receiving / QC:
  - `GoodsReceivedNote.receivedById` -> `Employee`
  - `QualityInspection.inspectorId` -> `Employee`
- CEO Dashboard:
  - Workforce, attendance, pending leaves sudah dihitung dari tabel SDM

Gap penting:

- Mapping `User` ke `Employee` belum eksplisit (masih ada fallback by email/any employee).
- Modul SDM belum jadi source-of-truth untuk data yang dipakai modul lain.

---

## 3) Delta vs Master Roadmap

Temuan utama: `master_roadmap.md` sebelumnya belum punya fase SDM khusus.

Perubahan yang dibutuhkan:

- Tambah fase SDM/HCM dedicated.
- Cantumkan dependency enforcement ke Procurement, Inventory, Manufacturing, Finance, CEO Dashboard.
- Jadikan SDM bukan hanya “support page”, tapi modul backbone approval dan tenaga kerja.

---

## 4) Target Final Product (To-Be)

## 4.1 SDM Command Center

- KPI real-time: active headcount, attendance hari ini, leave pending, overtime pending, payroll draft/approved.
- Queue aksi: approval cuti/lembur/payroll.
- Aktivitas karyawan lintas area (warehouse, work center, QC).

## 4.2 Employee Master as Source of Truth

- CRUD penuh + status lifecycle (active/on-leave/inactive/terminated).
- Assignment: department, manager, warehouse/work center.
- Dokumen personal & compliance (NPWP, BPJS, kontrak).

## 4.3 Attendance & Shift Engine

- Clock in/out berbasis employee identity.
- Shift schedule + late policy + overtime capture.
- Integrasi ke kapasitas manufaktur harian.

## 4.4 Leave & Overtime Workflow

- Request -> approval manager -> approval HR/CEO (opsional by policy).
- Semua approval tercatat di `EmployeeTask` + audit trail.

## 4.5 Payroll + Finance Posting

- Generate payroll per periode dari attendance/leave/overtime.
- Approval berjenjang + lock period.
- Auto-post jurnal ke Finance (salary expense, liabilities, bank/cash).

---

## 5) Build Sequence (Recommended Start Order)

1. Identity layer: relasi tegas `User <-> Employee` + role scope.
2. Employee Master backend actions + API-safe form validation.
3. Attendance clock-in/out endpoints + late calculation rules.
4. Leave request + approval workflow via `EmployeeTask`.
5. Overtime request + approval workflow.
6. SDM dashboard cards pakai query real DB (hapus mock widget stats).
7. Payroll schema + migration.
8. Payroll draft generation engine.
9. Payroll approval + lock + payslip output.
10. Finance journal posting from approved payroll.
11. CEO dashboard HR cards sinkron ke workflow SDM baru.
12. Hardening: tests, permissions, audit log, report exports.

---

## 6) Acceptance Criteria (Definition of Done)

- SDM pages tidak lagi memakai mock array statis.
- Semua create/edit/update/delete utama tersimpan ke DB dan terbaca ulang saat refresh.
- Approval actions meninggalkan jejak audit (siapa, kapan, status lama/baru).
- PR/PO/Gudang/Quality hanya menerima employee aktif valid.
- Payroll approval mem-posting jurnal finance dan bisa ditelusuri dari nomor referensi.
- KPI SDM di dashboard CEO berubah sesuai data transaksi real-time.

---

## 7) Immediate Next Sprint Scope (Small but High Impact)

Scope sprint 1 (disarankan):

- Employee Master real CRUD
- Attendance clock-in/out real
- Leave request + manager approval
- SDM dashboard cards real query

Ini sudah cukup untuk mengubah SDM dari mock menjadi operasional, dan langsung memperkuat dependensi modul lain.
