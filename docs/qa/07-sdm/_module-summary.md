# Module Summary — SDM (Sumber Daya Manusia / HCM)

> **Last updated:** 2026-03-27
> **Module route:** `/hcm`
> **Module status:** ~40% complete (per CLAUDE.md)

---

## 1. Subpages Documented

| # | Subpage | Route | QA Doc | Status |
|---|---------|-------|--------|--------|
| 1 | Dashboard SDM | `/hcm` | `01-dashboard-sdm.md` | ✅ Full QA |
| 2 | Data Karyawan | `/hcm/employee-master` | — | ✅ Code-reviewed for summary |
| 3 | Pelacakan Absensi | `/hcm/attendance` | — | ✅ Code-reviewed for summary |
| 4 | Pemrosesan Payroll | `/hcm/payroll` | — | ✅ Code-reviewed for summary |
| 5 | Jadwal Shift | `/hcm/shifts` | — | ✅ Code-reviewed for summary |
| 6 | Onboarding Karyawan | `/hcm/onboarding` | — | ✅ Code-reviewed for summary |
| 7 | Error Boundary | `/hcm` (error) | — | ✅ Trivial (ErrorFallback wrapper) |

**Total: 6 pages + 1 error boundary.** All source code reviewed for this summary.

---

## 2. Key Findings by Domain

### 2.1 Employee Data (`/hcm/employee-master`)

- **CRUD complete**: Create, read, update, deactivate (soft-delete). No hard delete.
- **Bulk operations**: Multi-select with checkbox → bulk deactivate. Confirmation dialog present.
- **Form fields**: employeeCode, firstName, lastName, email, phone, department (ComboboxWithCreate), position (ComboboxWithCreate), joinDate, status, baseSalary.
- **Validations**: Client-side only — checks firstName, department, position, joinDate are non-empty. No email format validation, no phone format validation, no salary range check.
- **3 tabs**: Daftar Karyawan (functional), Analitik SDM (placeholder analytics stats), Laporan (placeholder).
- **No pagination**: All employees rendered. Client-side search/filter by name, code, email, department, status.

### 2.2 Payroll Calculations (`/hcm/payroll`)

- **Full payroll pipeline**: Generate Draft → Approve/Post → Disbursement (3-stage status pipeline).
- **Salary components**: Gaji Pokok, Tunjangan Transport (7%), Makan (3%), Posisi (10%), Lembur.
- **Deductions**: BPJS Kesehatan (1%, max 12M basis), BPJS JHT (2%), BPJS JP (1%, max 9.5M basis), BPJS Ketenagakerjaan, PPh21 (progressive 5-35%).
- **Overtime**: Kepmenaker 102/2004 formula. Hour 1 at 1.5x, hours 2+ at 2x. Hourly rate = salary / 173.
- **Export**: CSV and XLS (via xlsx library) for both payroll data and compliance report.
- **PDF generation**: Payroll report (Typst template) and individual payslip (Typst template).
- **Journal posting**: `approvePayrollRun()` creates GL journal entries (finance integration).
- **Disbursement**: `createPayrollDisbursementBatch()` creates batch payment records.
- **Settings tab**: Read-only — cut-off date (25th), PTKP TK/0, rounding method, formula version. No editing.
- **Privacy toggle**: Eye icon to show/hide salary amounts in KPI strip.

### 2.3 Attendance Tracking (`/hcm/attendance`)

- **4 tabs**: Hari Ini (daily snapshot), Bulanan (monthly — placeholder count 0), Lembur (overtime list), Cuti & Izin (leave management).
- **Clock In/Out dialog**: Select employee → select mode (CLOCK_IN/CLOCK_OUT) → submit.
- **Date + department filter**: Server-side re-fetch via `getAttendanceSnapshot()`.
- **KPI cards**: Hadir, Terlambat, Cuti, Tidak Hadir — from stats object.
- **Status types**: PRESENT, ABSENT, LEAVE, SICK, REMOTE. Late is derived from `isLate` flag on PRESENT.
- **Leave workflow**: Submit form (employee, type, start/end date, reason) → PENDING → Approve/Reject.
- **Leave types**: ANNUAL, SICK, UNPAID, MATERNITY, OTHER.
- **Side effects**: Approving leave creates Attendance records (status: LEAVE) for each day in range.

### 2.4 Leave Workflows

- **Submission**: From attendance page leave tab. Required: employee, startDate, endDate. Type defaults to ANNUAL.
- **Approval**: From both dashboard and attendance page. Requires `SDM_APPROVER_ROLES`.
- **Rejection**: Hardcoded reasons — "Ditolak dari dashboard SDM" or "Ditolak dari modul Absensi". No user input for reason.
- **Authority check**: `assertLeaveApprovalAuthority()` — super-roles can approve any department; managers/HR only their own department.
- **No undo**: Once approved/rejected, status cannot be changed back.

### 2.5 Shift Management (`/hcm/shifts`)

- **Weekly calendar view**: 7-day grid showing shift counts per type.
- **3 shift types**: Pagi (07-15), Siang (15-23), Malam (23-07).
- **Assignment**: Per-employee dropdown to assign default shift.
- **Week navigation**: Prev/next buttons, invalidates query to reload.
- **Bug noted**: `navigateWeek()` calculates new date but doesn't pass it to the server — it only invalidates queries, so the server always returns the current week.

### 2.6 Onboarding (`/hcm/onboarding`)

- **Template-based**: Create template with named tasks → assign template to employee → track progress.
- **Task fields**: key, title, description (optional), department — all text inputs.
- **Progress tracking**: Per-employee checklist with toggle (completed/not completed).
- **2 tabs**: Template (list/create) and Karyawan Aktif (progress view).
- **2 dialogs**: Create Template and Start Onboarding (select employee + template).

---

## 3. All Issues Found — Prioritized by Severity

### Critical (0)

No critical bugs found. Core CRUD and payroll pipeline are functional.

### High (3)

| # | Page | Issue |
|---|------|-------|
| H1 | Payroll | **Payroll Settings tab is read-only** — cut-off date, PTKP, rounding are hardcoded. No ability to configure per-employee PTKP (e.g. married TK/1, K/0, K/1) which affects PPh21 calculation. All employees use TK/0 (Rp 54M). This produces incorrect tax calculations for married employees. |
| H2 | Shift | **Week navigation is broken** — `navigateWeek()` in `shift-calendar.tsx:63-68` computes a new date but only calls `queryClient.invalidateQueries()` without passing the new date. The server always returns the current week regardless of navigation clicks. |
| H3 | Attendance | **"Bulanan" (Monthly) tab always shows count 0** — `tabCounts.monthly` is hardcoded to `0` at `attendance-client.tsx:179`. The tab renders but has no content or data aggregation. |

### Medium (7)

| # | Page | Issue |
|---|------|-------|
| M1 | Dashboard | **"Laporan SDM" and "Karyawan Baru" both link to `/hcm/employee-master`** — "Laporan SDM" with Download icon misleads users into expecting a report download. |
| M2 | Dashboard | **"Rekrutmen" tab has no TabsContent** — `TabsTrigger` exists at `page.tsx:249` but no matching content panel. Clicking renders blank. |
| M3 | Dashboard | **Leave approve/reject has no confirmation dialog** — one-click actions that cannot be undone. Risk of accidental approval/rejection. |
| M4 | Employee | **No email format validation** — email field accepts any string. Server action passes it through without regex check. |
| M5 | Employee | **No salary range validation** — baseSalary can be 0 or negative. Payroll calculations downstream may produce odd results. |
| M6 | Attendance | **Leave rejection reason is hardcoded** — "Ditolak dari modul Absensi" or "Ditolak dari dashboard SDM". Users cannot provide a custom rejection reason. |
| M7 | Payroll | **No confirmation before Approve & Post** — clicking "Approve & Post Jurnal" immediately posts to GL. This is an irreversible financial action with no confirmation dialog. |

### Low (10)

| # | Page | Issue |
|---|------|-------|
| L1 | Dashboard | **Performance data shows daily, not monthly** — subtitle says "bulan berjalan" but data is today-only. All present employees show 100%. |
| L2 | Dashboard | **Top 3 performers are arbitrary** — all present employees get 100% rate, so "top 3" is just first 3 alphabetically. |
| L3 | Dashboard | **No loading skeleton** — renders zero-value widgets then swaps to real data. Other HCM pages use `<TablePageSkeleton>`. |
| L4 | Dashboard | **AttendanceWidget doesn't use NB design** — rounded Card vs PayrollSummaryWidget which uses NB black borders. |
| L5 | Employee | **Analytics and Reports tabs are placeholders** — basic stats visible (total/active/on-leave/inactive counts) but no charts or exportable reports. |
| L6 | All tables | **No pagination** — employee master, attendance, payroll all render every row. Performance issue at 500+ employees. |
| L7 | Payroll | **Compliance section only visible when compliance data loads** — if compliance hook returns null, entire section is hidden with no error message. |
| L8 | Payroll | **No payroll period locking** — user can re-generate a draft for an already-posted period. Unclear what happens to existing journal entries. |
| L9 | Onboarding | **No template editing or deletion** — once created, templates cannot be modified or removed. |
| L10 | Shift | **No batch shift assignment from UI** — `batchAssignShifts()` exists in server actions but is not exposed in the calendar component. Only one-by-one assignment. |

---

## 4. Missing Test Coverage

### 4.1 Existing Tests

| File | Coverage |
|------|----------|
| `__tests__/hcm-calculations.test.ts` | Pure calculation functions: overtime pay, BPJS, PPh21, piece rate, payslip. **Good coverage of math.** |

### 4.2 Untested Areas

| Area | What needs testing | Priority |
|------|-------------------|----------|
| **Server actions (CRUD)** | `createEmployee`, `updateEmployee`, `deactivateEmployee`, `bulkDeactivateEmployees` — no integration tests. | High |
| **Attendance recording** | `recordAttendanceEvent` — clock in/out logic, duplicate detection, date boundary handling. | High |
| **Leave workflow** | `submitLeaveRequest` → `approveLeaveRequest` → verify Attendance rows created for each day. | High |
| **Payroll pipeline** | `generatePayrollDraft` → `approvePayrollRun` → verify journal entry creation. End-to-end. | High |
| **Payroll disbursement** | `createPayrollDisbursementBatch` — verify GL posting and vendor payment record creation. | High |
| **Role-based access** | `assertRole(SDM_APPROVER_ROLES)` — test that non-authorized roles are rejected. | Medium |
| **Leave approval authority** | `assertLeaveApprovalAuthority` — cross-department vs same-department approval. | Medium |
| **Shift assignment** | `assignEmployeeShift`, `batchAssignShifts` — verify DB updates. | Medium |
| **Onboarding workflow** | Template creation → start onboarding → toggle task → verify progress tracking. | Medium |
| **Export functions** | CSV/XLS export — verify data shape, column headers, currency formatting. | Low |
| **PDF generation** | Payroll report and payslip PDF — verify Typst template renders without errors. | Low |
| **Edge cases** | Empty DB, 0 employees, overlapping leave dates, clock-out before clock-in, same-day re-clock. | Medium |
| **UI components** | No component-level tests for any HCM widget (attendance-widget, payroll-summary, etc.). | Low |

---

## 5. Recommended QA Test Cases for Stakeholder Demo

### Demo Scenario 1: Employee Lifecycle

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/hcm/employee-master` | Employee list loads with filter bar |
| 2 | Click "Tambah Karyawan" | Create dialog opens |
| 3 | Fill: Budi Santoso, Dept: Produksi, Position: Operator, Join: today, Salary: 5.000.000 | Form accepts all fields |
| 4 | Submit | Toast: "Karyawan berhasil ditambahkan". Row appears in table. |
| 5 | Click edit pencil on Budi | Edit dialog opens with pre-filled data |
| 6 | Change salary to 5.500.000, submit | Toast: "Data karyawan berhasil diperbarui" |
| 7 | Select Budi via checkbox, click "Nonaktifkan Terpilih" | Confirmation dialog → confirm → status changes to INACTIVE |

### Demo Scenario 2: Attendance + Leave Flow

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/hcm/attendance` | Today's snapshot with KPI cards |
| 2 | Click "Clock In/Out" | Dialog opens |
| 3 | Select employee, mode: CLOCK_IN, submit | Toast: "Absensi berhasil dicatat". KPI "Hadir" increments. |
| 4 | Switch to "Cuti & Izin" tab | Leave form and pending list visible |
| 5 | Submit leave: employee, ANNUAL, tomorrow–next day, reason "Keperluan keluarga" | Toast: "Pengajuan cuti berhasil dibuat". Appears in pending list. |
| 6 | Click approve (green check) on the new request | Toast: "Pengajuan cuti disetujui". Request disappears from pending. |
| 7 | Navigate to dashboard `/hcm` | "Cuti Menunggu Approval" count updates |

### Demo Scenario 3: Payroll End-to-End

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/hcm/payroll` | Period selector defaults to current month |
| 2 | Click "Hitung Payroll" | Toast: "Payroll draft berhasil dihitung". KPI strip populates. Table shows per-employee breakdown. |
| 3 | Verify calculation tab | Formulas for tunjangan, BPJS, PPh21 displayed |
| 4 | Click "Approve & Post Jurnal" on amber alert bar | Toast: "Payroll berhasil diposting". Status badge → POSTED (green). |
| 5 | Click "Buat Batch Disbursement" on green alert bar | Toast: "Batch disbursement payroll berhasil dibuat" |
| 6 | Click CSV export | CSV file downloads with all salary components |
| 7 | Click PDF on a payroll line | Payslip PDF opens in new tab |
| 8 | Switch to "Laporan" tab | Report info grid + compliance section visible |

### Demo Scenario 4: Shift & Onboarding

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/hcm/shifts` | Weekly calendar with shift counts |
| 2 | Change employee shift from Pagi to Malam via dropdown | Toast: "Shift berhasil diubah" |
| 3 | Navigate to `/hcm/onboarding` | Template tab visible |
| 4 | Click "Buat Template" → fill name + 2 tasks → submit | Toast: "Template berhasil dibuat". Card appears in grid. |
| 5 | Switch to "Karyawan Aktif" tab, click "Mulai Onboarding" | Dialog: select employee + template → submit → Toast: "Onboarding dimulai!" |
| 6 | Check a task in the onboarding checklist | Checkbox toggles, progress updates |

### Demo Scenario 5: Dashboard Overview

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/hcm` | Dashboard loads with attendance, payroll, headcount widgets |
| 2 | Verify KPI accuracy | Compare "Hadir" count with attendance page data |
| 3 | Click "Muat Ulang" | Data refreshes (icon spins) |
| 4 | Approve a leave from the widget | Toast success. Widget re-renders. |
| 5 | Click "Lihat Jurnal Gaji" | Navigates to `/finance/journal` |

---

## Appendix: File Inventory

### Pages (7 files)

| File | Lines | Type |
|------|-------|------|
| `app/hcm/page.tsx` | 282 | Dashboard |
| `app/hcm/employee-master/page.tsx` | 23 | Employee master wrapper |
| `app/hcm/employee-master/employee-master-client.tsx` | ~550 | Employee master client |
| `app/hcm/attendance/page.tsx` | 22 | Attendance wrapper |
| `app/hcm/attendance/attendance-client.tsx` | ~780 | Attendance client |
| `app/hcm/payroll/page.tsx` | ~990 | Payroll (all-in-one) |
| `app/hcm/shifts/page.tsx` | 24 | Shift wrapper |
| `app/hcm/onboarding/page.tsx` | 818 | Onboarding (with dialogs) |
| `app/hcm/error.tsx` | 14 | Error boundary |

### Components (8 files)

| File | Role |
|------|------|
| `components/hcm/attendance-widget.tsx` | Attendance KPI card |
| `components/hcm/payroll-summary.tsx` | Payroll summary card |
| `components/hcm/detailed-staff-activity.tsx` | Staff activity table |
| `components/hcm/detailed-performance-table.tsx` | Performance ranking table |
| `components/hcm/leave-requests.tsx` | Leave approve/reject widget |
| `components/hcm/performance-widget.tsx` | Top performer widget |
| `components/hcm/shift-calendar.tsx` | Shift weekly calendar |
| `components/hcm/onboarding-checklist.tsx` | Onboarding task checklist |

### Server Actions (4 files)

| File | Functions |
|------|-----------|
| `app/actions/hcm.ts` | 21 exported functions (employees, attendance, leaves, payroll, dashboard) |
| `lib/actions/hcm-onboarding.ts` | 5 functions (templates, progress) |
| `lib/actions/hcm-shifts.ts` | 4 functions (schedule, assignment) |
| `lib/actions/hcm-payroll.ts` | 2 functions (piece rate, payslip) |

### Hooks (5 files)

| File | Hook |
|------|------|
| `hooks/use-employees.ts` | `useEmployees()` |
| `hooks/use-attendance.ts` | `useAttendance()` |
| `hooks/use-payroll.ts` | `usePayrollRun()`, `usePayrollCompliance()` |
| `hooks/use-shifts.ts` | `useShifts()` |
| `hooks/use-onboarding.ts` | `useOnboarding()` |

### Tests (1 file)

| File | Coverage |
|------|----------|
| `__tests__/hcm-calculations.test.ts` | Pure math: overtime, BPJS, PPh21, payslip |

### Prisma Models (7)

Employee, Attendance, LeaveRequest, EmployeeTask, ShiftNote, OnboardingTemplate, OnboardingProgress
