# ERP Big Picture Execution Plan (Unified, Low-Friction, Daily-Use System)

Status: Draft for execution alignment  
Owner: Product + Engineering  
Scope Priority: Inventory, Pengadaan, Finance (then Manufacturing, Sales/CRM, SDM, Document & System)

---

## 1) North Star

Bangun ERP yang:
- dipakai setiap hari karena cepat dan jelas,
- bukan karena “harus”, tapi karena jadi cara termudah menyelesaikan pekerjaan.

Target UX:
- 1-2 klik untuk aksi operasional utama.
- Tidak ada input ulang data antar modul.
- Status dan angka konsisten di semua view (kanban/list/dashboard/detail).

---

## 2) Product Principles (Wajib)

1. `Single Next Action`
- Setiap dokumen menampilkan aksi lanjutan paling relevan (bukan user disuruh “mikir pilih menu”).
- Contoh: PR approved -> langsung buat PO, PO approved -> kirim vendor + mark ordered.

2. `Source-of-Truth Chain`
- Dokumen harus lahir dari dokumen sebelumnya (dependency chain), bukan create terpisah.
- Contoh utama:
  - Pengadaan: `PR -> PO -> GRN -> Bill/AP -> Payment`
  - Sales: `Lead -> Quotation -> SO -> Delivery -> Invoice/AR -> Receipt`
  - Manufaktur: `BOM + Routing -> WO/SPK -> Material Consumption -> FG -> Finance Posting`

3. `No Silent Failure`
- Semua action harus punya feedback eksplisit: sukses, gagal, atau partial.
- Kalau gagal, tampilkan penyebab + next step.

4. `Real-Time Consistency`
- Satu perubahan harus sinkron ke:
  - card KPI,
  - table/list,
  - kanban,
  - detail modal.

5. `Fast by Default`
- Prefetch data penting.
- Kurangi query berulang.
- Optimalkan connection pooling Prisma/Supabase.

---

## 3) System Architecture Reframe (Anti-Friction)

### A. Workflow Backbone
- Semua transisi status via server action/state machine (bukan UI-only).
- Simpan event trail untuk audit dan debug.

### B. Command + Read Model
- Command: create/update/approve/post.
- Read model: dashboard/list/kanban gunakan aggregator yang sama.
- Tujuan: angka tidak beda-beda antar halaman.

### C. Shared Action Components
- Action pattern seragam:
  - `validate -> execute -> revalidate -> toast -> refresh affected views`
- Hilangkan pola lama yang setengah jalan (toast sukses tapi data belum berubah).

### D. Approval Layer
- Approval matrix untuk:
  - stock opname adjustment,
  - payment voucher/check,
  - PR/PO amount thresholds,
  - exceptional finance actions.

### E. Performance Layer
- DB: index untuk status/date/foreign-key kolom yang dipakai filter dashboard.
- App: cache strategis + invalidation tag yang tepat.
- UI: skeleton + optimistic feedback + no blocking transitions.

---

## 4) Unified Dependency Map (Lintas Modul)

### Pengadaan + Inventory + Finance (Core Loop)
1. PR dibuat dari kebutuhan internal/reorder.
2. PR approved sesuai matrix.
3. PO dibuat dari PR (auto carry items, vendor, tax mode).
4. PO approved dan dikirim ke vendor.
5. GRN/Receiving menerima barang.
6. Inventory bertambah + movement tercatat.
7. Bill AP terbentuk dari PO/GRN.
8. Payment AP (check/signature/authorization) menutup kewajiban.

### Manufacturing Loop
1. BOM + Routing valid.
2. WO/SPK dibuat dari demand.
3. Konsumsi material mengurangi inventory.
4. Hasil produksi menambah FG stock.
5. Posting biaya ke finance (WIP -> FG/COGS).

### Sales/CRM Loop
1. Customer/prospect actions (WA/Quote/Order).
2. Quotation -> Sales Order.
3. Delivery + stock outbound.
4. Invoice AR -> receipt/payment.

### SDM Loop
1. Employee identity linked ke user.
2. Attendance/approval memengaruhi payroll.
3. Role scope memengaruhi approval dan akses lintas modul.

---

## 5) Execution Phases (Practical, Can Start Today)

## Phase A - Core Integrity (Today First)
Goal: data benar, status benar, sinkron semua view.

Deliverables:
- Dashboard Pengadaan tampil angka real (PO/PR/GRN by status).
- Stock movement counters (inbound/outbound/transfer) sesuai activity log.
- Kanban vs detailed list inventory sinkron.
- Hapus interaction liar (row click/side panel lama) yang ganggu flow.

Done criteria:
- KPI = table totals = raw query totals.
- Tidak ada toast sukses tanpa perubahan data.

## Phase B - 1-Click Workflows (Today Next)
Goal: potong 5-6 step jadi 1-2 step.

Deliverables:
- `Approve + Generate PO` fast-lane di PR.
- `Send to Vendor + Mark Ordered` fast-lane di PO approved.
- Customer card punya `Next Best Action` (WA/Quote/Order/Review Credit).
- Form punya self-correction (ubah field penting tanpa restart dokumen).

Done criteria:
- User role utama bisa selesaikan flow utama dalam <= 2 klik per transisi.

## Phase C - Approval & Risk Controls
Goal: mengurangi kesalahan bisnis.

Deliverables:
- Stock opname adjustment wajib approval manager/boss.
- CEO dashboard dapat queue approval stock adjustments.
- Payment/check signature flow benar-benar enforce authorization.
- Duplicate guard untuk invoice/documents penting.

Done criteria:
- Semua action high-risk tercatat event + approval trail.

## Phase D - Performance Hardening
Goal: latency terasa instan.

Deliverables:
- Audit Prisma/Supabase pooling config (hindari max clients reached).
- Indexing query kritikal (status/date/foreign keys).
- Prefetch modul prioritas (Inventory, Pengadaan, Finance).
- Perbaiki N+1 query dan query berat dashboard.

Done criteria:
- P95 navigation/action latency target < 500 ms (local production-like).
- Tidak ada error koneksi pool di operasi normal.

## Phase E - UX Standardization
Goal: profesional, konsisten, minim kebingungan.

Deliverables:
- Semua sidebar lama diganti modal/popup standar.
- Layout form padat dirapikan (no overlap, responsive desktop/mobile).
- Action button state seragam: disabled/loading/success/error.
- Terminologi Indonesia konsisten per modul.

Done criteria:
- Tidak ada dead button.
- Tidak ada layout tabrakan pada resolusi umum laptop.

## Phase F - Module Completion Consistency
Goal: semua halaman mengikuti standar yang sama.

Deliverables:
- Terapkan pattern A-E ke modul yang belum disentuh penuh.
- Document & System jadi control center master data/roles/templates.
- Semua modul ikut dependency chain, bukan berdiri sendiri.

Done criteria:
- Setiap modul punya: real DB, actions bekerja, sync dashboard, approval logic.

---

## 6) Pod Strategy (Team Kecil, Kecepatan Tinggi)

Pod 1: `Procurement -> Inventory -> Finance Core`
- PR/PO/GRN/AP/payment chain.

Pod 2: `Inventory Consistency + Performance`
- movement counters, stock opname, warehouse interactions, sync views.

Pod 3: `Finance Reliability + Authorization`
- invoice lifecycle, due date correctness, payment signatures/checkbook flow.

Pod 4: `UX System & Shared Components`
- modal standards, action components, feedback patterns, no-sidebar migration.

Pod 5: `Cross-Module Governance`
- approval matrix, audit trail, role scopes, document registry integration.

---

## 7) Measurement Dashboard (Must Track Weekly)

Operational KPIs:
- Flow completion rate per chain (PR->PO->GRN->AP).
- Median clicks to complete core tasks.
- Error rate per server action.
- Dashboard/table mismatch count.

Performance KPIs:
- P50/P95 response time per module.
- Cache hit ratio.
- DB connection pool saturation incidents.

Adoption KPIs:
- Daily active users by role.
- Repeat usage of fast-lane actions.
- Time-to-completion per role (before vs after).

---

## 8) Risk Register (Immediate Attention)

1. `Data mismatch risk`
- Mitigation: unify read model + strict revalidation.

2. `Connection pool saturation`
- Mitigation: singleton Prisma client, query batching, reduce parallel heavy calls.

3. `Role/approval bypass`
- Mitigation: enforce on server actions, not in UI.

4. `UX inconsistency across modules`
- Mitigation: shared action/mode components and design checklist.

5. `Silent partial failures`
- Mitigation: structured action responses with explicit fallback path.

---

## 9) Definition of Done (Per Feature)

Feature dianggap selesai jika:
- Real DB integrated (no mock fallback as primary path).
- Server action validated and role-guarded.
- UI state sync across card/list/kanban/detail.
- Loading/error/success states complete.
- Logged in audit/event trail if business critical.
- Manual UAT scenario passed (happy path + 2 edge cases).

---

## 10) Immediate Next 3 Workblocks

1. Stabilize Core Metrics Sync
- Audit and fix all mismatched counters in Inventory + Pengadaan dashboards.

2. Complete Approval-Critical Flows
- Stock opname adjustment approval + CEO queue + payment signature checkpoints.

3. Finish UX Normalization Pass
- Remove remaining sidebar legacy interactions and standardize polished modal flows.

---

## 11) Working Rule for Every New Change

Sebelum merge:
- “Apakah ini mengurangi jumlah langkah user?”
- “Apakah ini menambah atau mengurangi kebingungan?”
- “Apakah data langsung sinkron di semua view?”
- “Apakah role dan approval benar-benar enforce di backend?”

Jika salah satu jawaban = tidak, fitur belum siap rilis.

