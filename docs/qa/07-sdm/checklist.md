# QA Checklist — Modul SDM (Sumber Daya Manusia)

> Module route: `/hcm`
> Last updated: 2026-03-27
> Module summary: [`_module-summary.md`](./_module-summary.md)

---

## Pages & Routes

| # | Subpage / Feature | File Path | Route | Status |
|---|-------------------|-----------|-------|--------|
| 1 | Dashboard SDM (main) | `app/hcm/page.tsx` | `/hcm` | ✅ |
| 2 | Data Karyawan (Employee Master) | `app/hcm/employee-master/page.tsx` | `/hcm/employee-master` | ✅ |
| 3 | Pelacakan Absensi (Attendance) | `app/hcm/attendance/page.tsx` | `/hcm/attendance` | ✅ |
| 4 | Pemrosesan Payroll | `app/hcm/payroll/page.tsx` | `/hcm/payroll` | ✅ |
| 5 | Jadwal Shift | `app/hcm/shifts/page.tsx` | `/hcm/shifts` | ✅ |
| 6 | Onboarding Karyawan | `app/hcm/onboarding/page.tsx` | `/hcm/onboarding` | ✅ |
| 7 | Error Boundary | `app/hcm/error.tsx` | (error fallback) | ✅ |

---

## Dashboard SDM (`/hcm`) — Widgets & Sections

| # | Feature | Component / Source | Status |
|---|---------|-------------------|--------|
| 8 | Widget Kehadiran (attendance stats) | `components/hcm/attendance-widget.tsx` | ✅ |
| 9 | Widget Ringkasan Payroll | `components/hcm/payroll-summary.tsx` | ✅ |
| 10 | Card Karyawan Aktif (headcount) | inline in `app/hcm/page.tsx` | ✅ |
| 11 | Card Cuti Menunggu Approval | inline in `app/hcm/page.tsx` | ✅ |
| 12 | Tabel Aktivitas Staff Harian | `components/hcm/detailed-staff-activity.tsx` | ✅ |
| 13 | Tabel Performa Karyawan | `components/hcm/detailed-performance-table.tsx` | ✅ |
| 14 | Widget Cuti (approve/reject) | `components/hcm/leave-requests.tsx` | ✅ |
| 15 | Widget Performa (top performers) | `components/hcm/performance-widget.tsx` | ✅ |
| 16 | Tab: Database Karyawan (placeholder) | inline tab in `app/hcm/page.tsx` | ✅ |
| 17 | Tab: Payroll & Benefit (placeholder) | inline tab in `app/hcm/page.tsx` | ✅ |
| 18 | Tab: Rekrutmen (placeholder) | inline tab in `app/hcm/page.tsx` | ⚠️ No TabsContent |
| 19 | Button: Muat Ulang (refresh) | inline in `app/hcm/page.tsx` | ✅ |
| 20 | Button: Lihat Jurnal Gaji (link to `/finance/journal`) | inline in `app/hcm/page.tsx` | ✅ |
| 21 | Button: Laporan SDM (link to employee master) | inline in `app/hcm/page.tsx` | ⚠️ Misleading link |
| 22 | Button: Karyawan Baru (link to employee master) | inline in `app/hcm/page.tsx` | ✅ |

---

## Data Karyawan (`/hcm/employee-master`) — Features

| # | Feature | Component / Source | Status |
|---|---------|-------------------|--------|
| 23 | Daftar Karyawan (list tab) | `app/hcm/employee-master/employee-master-client.tsx` | ✅ |
| 24 | Filter: Cari Karyawan (search by name/code/email) | inline in employee-master-client | ✅ |
| 25 | Filter: Departemen | inline in employee-master-client | ✅ |
| 26 | Filter: Status (Aktif/Non-Aktif/Cuti/Terminasi) | inline in employee-master-client | ✅ |
| 27 | Dialog: Tambah Karyawan | inline Dialog in employee-master-client | ✅ |
| 28 | Dialog: Edit Karyawan | inline Dialog in employee-master-client (same form) | ✅ |
| 29 | Action: Nonaktifkan Karyawan (single) | deactivateEmployee server action | ✅ |
| 30 | Action: Nonaktifkan Bulk (multi-select) | bulkDeactivateEmployees server action | ✅ |
| 31 | Dialog: Konfirmasi Bulk Deactivate | inline Dialog in employee-master-client | ✅ |
| 32 | Checkbox Select All / Select Individual | inline in employee-master-client | ✅ |
| 33 | Tab: Analitik SDM | inline tab (analytics) in employee-master-client | ⚠️ Placeholder |
| 34 | Tab: Laporan | inline tab (reports) in employee-master-client | ⚠️ Placeholder |
| 35 | Combobox: Departemen (with create new) | `components/ui/combobox-with-create.tsx` | ✅ |
| 36 | Combobox: Posisi (with create new) | `components/ui/combobox-with-create.tsx` | ✅ |
| 37 | Loading skeleton | `app/hcm/employee-master/loading.tsx` | ✅ |

---

## Pelacakan Absensi (`/hcm/attendance`) — Features

| # | Feature | Component / Source | Status |
|---|---------|-------------------|--------|
| 38 | Tab: Hari Ini (today's attendance snapshot) | `app/hcm/attendance/attendance-client.tsx` | ✅ |
| 39 | Tab: Bulanan (monthly summary) | attendance-client.tsx | ⚠️ Count hardcoded 0 |
| 40 | Tab: Lembur (overtime list) | attendance-client.tsx | ✅ |
| 41 | Tab: Cuti & Izin (leave requests) | attendance-client.tsx | ✅ |
| 42 | Filter: Tanggal | date input in attendance-client | ✅ |
| 43 | Filter: Departemen | select in attendance-client | ✅ |
| 44 | KPI: Total Karyawan / Hadir / Terlambat / Cuti / Absen | stats in attendance-client | ✅ |
| 45 | Dialog: Clock In / Clock Out | inline Dialog in attendance-client | ✅ |
| 46 | Form: Pengajuan Cuti (leave request submission) | inline form in attendance-client | ✅ |
| 47 | Action: Approve Cuti | approveLeaveRequest server action | ✅ |
| 48 | Action: Reject Cuti | rejectLeaveRequest server action | ⚠️ Hardcoded reason |
| 49 | Tabel Absensi Harian (rows with status badges) | inline table in attendance-client | ✅ |
| 50 | Tabel Lembur (overtime rows sorted by hours) | inline table in attendance-client | ✅ |
| 51 | Tabel Cuti Pending (with approve/reject buttons) | inline table in attendance-client | ✅ |

---

## Pemrosesan Payroll (`/hcm/payroll`) — Features

| # | Feature | Component / Source | Status |
|---|---------|-------------------|--------|
| 52 | Period Selector (12-month dropdown) | `app/hcm/payroll/page.tsx` | ✅ |
| 53 | KPI Strip: Gaji Kotor / Potongan / Gaji Bersih / Karyawan / Lembur | payroll page.tsx | ✅ |
| 54 | Status Pipeline (Draft → Posted → Disbursed) | StatusStep component in payroll page.tsx | ✅ |
| 55 | Action: Generate Payroll Draft (Hitung Gaji) | generatePayrollDraft server action | ✅ |
| 56 | Action: Approve/Post Payroll | approvePayrollRun server action | ⚠️ No confirmation dialog |
| 57 | Action: Create Disbursement Batch | createPayrollDisbursementBatch server action | ✅ |
| 58 | Tab: Payroll Berjalan (current payroll table) | payroll page.tsx TabsContent "current" | ✅ |
| 59 | Tab: Perhitungan (calculation formulas/breakdown) | payroll page.tsx TabsContent "calculation" | ✅ |
| 60 | Tab: Laporan (reports — compliance, BPJS, PPh21) | payroll page.tsx TabsContent "reports" | ✅ |
| 61 | Tab: Pengaturan (settings — salary components) | payroll page.tsx TabsContent "settings" | ⚠️ Read-only |
| 62 | Toggle: Tampilkan/Sembunyikan Nominal (eye icon) | showAmounts toggle in payroll page | ✅ |
| 63 | Export: CSV Payroll | handleExportCSV in payroll page | ✅ |
| 64 | Export: XLS Payroll | handleExportXLS in payroll page | ✅ |
| 65 | Export: CSV Compliance | handleExportComplianceCSV in payroll page | ✅ |
| 66 | Export: XLS Compliance | handleExportComplianceXLS in payroll page | ✅ |
| 67 | Print: Payroll Report PDF | handleOpenPayrollPDF → `/api/documents/payroll/[period]` | ✅ |
| 68 | Print: Payslip PDF (per employee) | handleOpenPayslipPDF → `/api/documents/payslip/[period]/[employeeId]` | ✅ |

---

## Jadwal Shift (`/hcm/shifts`) — Features

| # | Feature | Component / Source | Status |
|---|---------|-------------------|--------|
| 69 | Shift Calendar (weekly grid) | `components/hcm/shift-calendar.tsx` | ✅ |
| 70 | Shift Types: Pagi / Siang / Malam | SHIFT_CONFIG in shift-calendar.tsx | ✅ |
| 71 | Assign Shift per Employee | assignEmployeeShift server action | ✅ |
| 72 | Employee Shift Summary list | getEmployeeShifts in `lib/actions/hcm-shifts.ts` | ✅ |
| 73 | Week Navigation (prev/next week) | ShiftCalendar component | ⚠️ Nav broken — doesn't pass date to server |

---

## Onboarding Karyawan (`/hcm/onboarding`) — Features

| # | Feature | Component / Source | Status |
|---|---------|-------------------|--------|
| 74 | Template List (grid cards) | `app/hcm/onboarding/page.tsx` | ✅ |
| 75 | Dialog: Buat Template Onboarding | CreateTemplateDialog in onboarding page | ✅ |
| 76 | Dialog: Mulai Onboarding (assign employee + template) | StartOnboardingDialog in onboarding page | ✅ |
| 77 | Tab: Template | onboarding page tab "template" | ✅ |
| 78 | Tab: Karyawan Aktif (employee onboarding progress) | onboarding page tab "karyawan" | ✅ |
| 79 | Onboarding Checklist (task toggle) | `components/hcm/onboarding-checklist.tsx` | ✅ |
| 80 | KPI: Template count / Total Tugas / Karyawan Aktif | KPI strip in onboarding page | ✅ |
| 81 | Employee Selector (dropdown) | Select in onboarding page "karyawan" tab | ✅ |

---

## API Endpoints (Document Generation)

| # | Feature | File Path | Route | Status |
|---|---------|-----------|-------|--------|
| 82 | Payroll Report PDF (Typst) | `app/api/documents/payroll/[period]/route.ts` | `GET /api/documents/payroll/:period` | ✅ |
| 83 | Payslip PDF (Typst) | `app/api/documents/payslip/[period]/[employeeId]/route.ts` | `GET /api/documents/payslip/:period/:employeeId` | ✅ |

---

## Server Actions (`app/actions/hcm.ts`)

| # | Feature | Function | Status |
|---|---------|----------|--------|
| 84 | Get Employees list | `getEmployees()` | ✅ |
| 85 | Create Employee | `createEmployee()` | ✅ |
| 86 | Update Employee | `updateEmployee()` | ✅ |
| 87 | Deactivate Employee (single) | `deactivateEmployee()` | ✅ |
| 88 | Bulk Deactivate Employees | `bulkDeactivateEmployees()` | ✅ |
| 89 | Get Attendance Snapshot | `getAttendanceSnapshot()` | ✅ |
| 90 | Record Clock In/Out | `recordAttendanceEvent()` | ✅ |
| 91 | Submit Leave Request | `submitLeaveRequest()` | ✅ |
| 92 | Get Leave Requests | `getLeaveRequests()` | ✅ |
| 93 | Approve Leave Request | `approveLeaveRequest()` | ✅ |
| 94 | Reject Leave Request | `rejectLeaveRequest()` | ✅ |
| 95 | Get Payroll Run | `getPayrollRun()` | ✅ |
| 96 | Generate Payroll Draft | `generatePayrollDraft()` | ✅ |
| 97 | Approve/Post Payroll Run | `approvePayrollRun()` | ✅ |
| 98 | Get Payroll Export Data | `getPayrollExportData()` | ✅ |
| 99 | Get Payslip Data | `getPayslipData()` | ✅ |
| 100 | Get Payroll Compliance Report | `getPayrollComplianceReport()` | ✅ |
| 101 | Create Payroll Disbursement Batch | `createPayrollDisbursementBatch()` | ✅ |
| 102 | Get Distinct Departments | `getDistinctDepartments()` | ✅ |
| 103 | Get Distinct Positions | `getDistinctPositions()` | ✅ |
| 104 | Get HCM Dashboard Data | `getHCMDashboardData()` | ✅ |

---

## Server Actions (`lib/actions/hcm-onboarding.ts`)

| # | Feature | Function | Status |
|---|---------|----------|--------|
| 105 | Get Onboarding Templates | `getOnboardingTemplates()` | ✅ |
| 106 | Create Onboarding Template | `createOnboardingTemplate()` | ✅ |
| 107 | Start Onboarding (assign to employee) | `startOnboarding()` | ✅ |
| 108 | Get Employee Onboarding progress | `getEmployeeOnboarding()` | ✅ |
| 109 | Toggle Onboarding Task | `toggleOnboardingTask()` | ✅ |

---

## Server Actions (`lib/actions/hcm-shifts.ts`)

| # | Feature | Function | Status |
|---|---------|----------|--------|
| 110 | Get Weekly Shift Schedule | `getWeeklyShiftSchedule()` | ✅ |
| 111 | Get Employee Shifts | `getEmployeeShifts()` | ✅ |
| 112 | Assign Employee Shift | `assignEmployeeShift()` | ✅ |
| 113 | Batch Assign Shifts | `batchAssignShifts()` | ⚠️ Not exposed in UI |

---

## Server Actions (`lib/actions/hcm-payroll.ts`)

| # | Feature | Function | Status |
|---|---------|----------|--------|
| 114 | Get Piece Rate Payroll | `getPieceRatePayroll()` | ✅ |
| 115 | Get Employee Payslip | `getEmployeePayslip()` | ✅ |

---

## Data Hooks

| # | Feature | File Path | Status |
|---|---------|-----------|--------|
| 116 | useEmployees | `hooks/use-employees.ts` | ✅ |
| 117 | useAttendance | `hooks/use-attendance.ts` | ✅ |
| 118 | usePayrollRun / usePayrollCompliance | `hooks/use-payroll.ts` | ✅ |
| 119 | useShifts | `hooks/use-shifts.ts` | ✅ |
| 120 | useOnboarding | `hooks/use-onboarding.ts` | ✅ |

---

## Typst Templates (PDF generation)

| # | Feature | File Path | Status |
|---|---------|-----------|--------|
| 121 | Payroll Report template | `templates/payroll_report/main.typ` | ✅ |
| 122 | Payslip template | `templates/payslip/main.typ` | ✅ |

---

## Dashboard Integration (HCM widgets on main dashboard)

| # | Feature | Component | Status |
|---|---------|-----------|--------|
| 123 | SDM Card on main dashboard | `components/dashboard/ritchie-sdm-card.tsx` | ✅ |
| 124 | SDM Approval Queue Card | `components/dashboard/sdm-approval-queue-card.tsx` | ✅ |
| 125 | Human Resources dashboard widget | `components/dashboard/human-resources.tsx` | ✅ |
| 126 | Staff Today widget | `components/dashboard/staff-today.tsx` | ✅ |

---

## Prisma Models (schema.prisma)

| # | Model | Line | Status |
|---|-------|------|--------|
| 127 | Employee | L1434 | ✅ |
| 128 | Attendance | L1483 | ✅ |
| 129 | LeaveRequest | L1521 | ✅ |
| 130 | EmployeeTask | L1540 | ✅ |
| 131 | ShiftNote | L2431 | ✅ |
| 132 | OnboardingTemplate | L2832 | ✅ |
| 133 | OnboardingProgress | L2845 | ✅ |

---

**Total items: 133** — ✅ 120 | ⚠️ 13 | ❌ 0

Legend:
- ⬜ = Not tested
- ✅ = Passed / Code-reviewed
- ❌ = Failed / Bug found
- ⚠️ = Partial / Has issues (see `_module-summary.md` §3 for details)
