# QA Document — Dashboard SDM

> **Last updated:** 2026-03-27
> **Source:** `app/hcm/page.tsx` (282 lines)

---

## 1. Page Info

| Field | Value |
|-------|-------|
| **Name** | Dashboard SDM (Sumber Daya Manusia) |
| **Route** | `/hcm` |
| **Breadcrumb** | SDM > Dashboard |
| **Client/Server** | `"use client"` — fully client-rendered via React Query |
| **Layout** | No dedicated `layout.tsx` in `/hcm`; inherits global layout |

---

## 2. Purpose

Hub utama modul SDM yang menampilkan ringkasan real-time kehadiran, payroll, headcount, permintaan cuti, dan performa karyawan — sekaligus menyediakan navigasi cepat ke subpage SDM lainnya.

---

## 3. UI Elements

### 3.1 Header Section (`page.tsx:169–196`)

| Element | Type | Label | Icon | Position |
|---------|------|-------|------|----------|
| Title | `<h2>` | "Sumber Daya Manusia (SDM)" | — | Left |
| Subtitle | `<p>` | "Platform manajemen karyawan, kehadiran, dan payroll terpadu." | — | Left, below title |
| Muat Ulang | Button (outline) | "Muat Ulang" | `RefreshCw` (spins when loading) | Right toolbar |
| Lihat Jurnal Gaji | Button (outline) → Link | "Lihat Jurnal Gaji" | `BookOpen` | Right toolbar |
| Laporan SDM | Button (outline) → Link | "Laporan SDM" | `Download` | Right toolbar |
| Karyawan Baru | Button (default/primary) → Link | "Karyawan Baru" | `UserPlus` | Right toolbar |

### 3.2 Widget Row 1 — Attendance & Payroll (`page.tsx:199–202`)

#### 3.2.1 AttendanceWidget (`components/hcm/attendance-widget.tsx`)

Card spanning `col-span-1 md:col-span-2`.

| Element | Detail |
|---------|--------|
| Title | "Kehadiran Hari Ini" with `Clock` icon (blue) |
| Timestamp | Top-right badge — `HH:mm` format from `attendance.timestamp` |
| Summary line | "{present} Hadir" ... "dari {total} Karyawan" |
| Progress bar | Stacked horizontal bar: emerald (present), yellow (late), blue (leave) |
| Stat cards (grid 2×2 or 4×1) | Telat, Cuti, Tidak Hadir, Rate — each in bordered box |

**Data source:** `dashboardData.attendance` from `getHCMDashboardData()`

#### 3.2.2 PayrollSummaryWidget (`components/hcm/payroll-summary.tsx`)

Card spanning `col-span-1 md:col-span-2`. Uses NB design (black border + shadow).

| Element | Detail |
|---------|--------|
| Title | "Payroll {period}" with `Wallet` icon (indigo) |
| Status badge | Top-right — `summary.status` (e.g. DRAFT, POSTED, REVIEW) |
| Grid 3-col | Gaji Kotor / Potongan / Estimasi Netto (IDR formatted) |

**Data source:** `dashboardData.payroll` from `getHCMDashboardData()`

### 3.3 KPI Cards Row (`page.tsx:204–225`)

Two `sm:grid-cols-2` cards:

| Card | Title | Subtitle | Value | Sub-value |
|------|-------|----------|-------|-----------|
| Karyawan Aktif | "Karyawan Aktif" | "Headcount aktif yang bisa di-assign ke operasi." | `headcount.active` (3xl bold) | "Dari total {total} karyawan" |
| Cuti Menunggu Approval | "Cuti Menunggu Approval" | "Request pending manager/HR approval." | `leaves.pendingCount` (3xl bold) | "Masuk ke alur approval SDM" |

### 3.4 Staff Activity Table (`page.tsx:227–228`)

#### DetailedStaffActivity (`components/hcm/detailed-staff-activity.tsx`)

NB-styled table with filters.

**Header:**
- Title: "Aktivitas Karyawan Hari Ini" with `Activity` icon (blue)
- Subtitle: "Status kehadiran dan jam kerja real-time"

**Filters:**

| Filter | Type | Options | Default |
|--------|------|---------|---------|
| Search | Text input with `Search` icon | Free-text (name, code, position) | "" |
| Departemen | Select dropdown | "Semua Dept" + dynamic dept list | "all" |
| Status | Select dropdown | Semua, Hadir, Remote, Cuti, Tidak Hadir | "all" |
| Reset | Button (visible only when filters active) | Clears all filters | — |

**Table columns:**

| # | Column | Align | Content |
|---|--------|-------|---------|
| 1 | Karyawan | Left | Avatar (initials) + name + employeeCode · position |
| 2 | Departemen | Left | department |
| 3 | Status | Left | Badge (color-coded: emerald=Hadir, blue=Cuti, rose=Absent) — shows "Hadir (Telat)" if `isLate && PRESENT` |
| 4 | Clock In | Right | Time string or "-" |
| 5 | Clock Out | Right | Time string or "-" |
| 6 | Jam Kerja | Right | `workingHours.toFixed(1)` or "-" |
| 7 | Lembur | Right | Amber-colored if > 0, or "-" |

**Footer:** "Menampilkan {filtered} dari {total} karyawan" (shown when `filtered.length > 0`)

**Empty state:**
- No employees at all: "Belum ada data karyawan"
- Filters match nothing: "Tidak ada hasil untuk filter ini"

**Pagination:** None — all rows rendered.

**Sorting:** None — server returns in `department ASC, firstName ASC` order.

### 3.5 Performance Table (`page.tsx:229`)

#### DetailedPerformanceTable (`components/hcm/detailed-performance-table.tsx`)

NB-styled table, sorted by `attendanceRate DESC` client-side.

**Header:**
- Title: "Performance & Kehadiran" with `Award` icon (purple)
- Subtitle: "Rekap kehadiran dan lembur bulan berjalan"

**Table columns:**

| # | Column | Align | Content |
|---|--------|-------|---------|
| 1 | Karyawan | Left | name + employeeCode · department |
| 2 | Posisi | Left | position |
| 3 | Hadir | Right | `attendanceDays/workingDays` |
| 4 | Rate | Right | Badge (emerald ≥95%, amber ≥80%, rose <80%) |
| 5 | Telat | Right | `{lateCount}x` amber, or "0" gray |
| 6 | Lembur | Right | `{hours} jam` bold, or "-" gray |

**Empty state:** "Belum ada data karyawan" + "Data akan muncul setelah karyawan ditambahkan"

**Pagination:** None.

### 3.6 Widget Row 2 — Leave & Performance (`page.tsx:232–243`)

Grid `md:grid-cols-2 lg:grid-cols-4`.

#### 3.6.1 LeaveRequestWidget (`components/hcm/leave-requests.tsx`)

Spans `col-span-1 md:col-span-2`.

| Element | Detail |
|---------|--------|
| Title | "Permintaan Cuti & Izin" |
| Pending badge | Orange pill: "{pendingCount} Pending" |
| Request list | Each: Avatar (initials) + employee name + type · date range (days) |
| Action buttons | Per-row: green checkmark (Approve), red X (Reject) — appear on hover (desktop) |

**Empty state:** Dashed border box: "Tidak ada permintaan cuti pending."

**Max visible:** Up to 5 requests (server caps `take: 5`)

#### 3.6.2 PerformanceWidget (`components/hcm/performance-widget.tsx`)

Spans `col-span-1 md:col-span-2`. NB-styled (black border + shadow).

| Element | Detail |
|---------|--------|
| Title | "Performa & Top Talent" with `Trophy` icon (amber) |
| Tingkat Kehadiran | Percentage + progress bar (emerald) |
| Karyawan Aktif | Total active count + "{present} hadir hari ini" |
| Top Kehadiran | Top 3 performers by attendance: department, name, rate badge |

**Empty state:** "Belum ada data kehadiran"

### 3.7 Bottom Tabs (`page.tsx:245–278`)

Three tabs (shadcn `Tabs`, default = "employees"):

| Tab | Label | Content |
|-----|-------|---------|
| `employees` | "Database Karyawan" | Card with dashed border placeholder: "Kelola data lengkap pada menu Data Karyawan." + `Users` icon |
| `payroll` | "Payroll & Benefit" | Card with text: "Gunakan menu Penggajian untuk proses payroll periodik." |
| `recruitment` | "Rekrutmen" | **No TabsContent defined** — tab button exists but clicking renders nothing |

---

## 4. User Actions

### 4.1 Muat Ulang (Refresh)

| Step | Detail |
|------|--------|
| **Trigger** | Click "Muat Ulang" button |
| **Behavior** | Invalidates `queryKeys.hcmDashboard.all` and `queryKeys.hcmAttendance.all` |
| **Loading** | Button disabled, `RefreshCw` icon spins (`animate-spin`) |
| **Success** | React Query refetches both queries; UI updates with fresh data |
| **Failure** | Silent — fallback data shown (all zeros) |

### 4.2 Navigate: Lihat Jurnal Gaji

| Step | Detail |
|------|--------|
| **Trigger** | Click "Lihat Jurnal Gaji" button |
| **Behavior** | `<Link href="/finance/journal">` — navigates to Finance Journal page |

### 4.3 Navigate: Laporan SDM

| Step | Detail |
|------|--------|
| **Trigger** | Click "Laporan SDM" button |
| **Behavior** | `<Link href="/hcm/employee-master">` — navigates to Employee Master |

### 4.4 Navigate: Karyawan Baru

| Step | Detail |
|------|--------|
| **Trigger** | Click "Karyawan Baru" button |
| **Behavior** | `<Link href="/hcm/employee-master">` — navigates to Employee Master |

### 4.5 Approve Leave Request

| Step | Detail |
|------|--------|
| **Trigger** | Click green check icon on a leave request row |
| **Server action** | `approveLeaveRequest(requestId)` |
| **Auth required** | `SDM_APPROVER_ROLES`: ROLE_ADMIN, ROLE_CEO, ROLE_DIRECTOR, ROLE_MANAGER, ROLE_HR, admin, CEO, DIRECTOR, manager |
| **Success** | Toast: "Pengajuan cuti berhasil diproses" (or server message). Invalidates `hcmAttendance` queries. Calls `onChanged()` to refresh dashboard. |
| **Failure** | Toast error: server error message or "Gagal memproses cuti" |
| **Side effects** | LeaveRequest status → APPROVED. Related EmployeeTasks → COMPLETED. Attendance rows created for each day in leave range (status: LEAVE). |

### 4.6 Reject Leave Request

| Step | Detail |
|------|--------|
| **Trigger** | Click red X icon on a leave request row |
| **Server action** | `rejectLeaveRequest(requestId, "Ditolak dari dashboard SDM")` |
| **Auth required** | Same as approve (SDM_APPROVER_ROLES) |
| **Success** | Toast: server message or "Pengajuan cuti berhasil diproses". Invalidates `hcmAttendance` queries. Calls `onChanged()`. |
| **Failure** | Toast error: server error message or "Gagal memproses cuti" |
| **Side effects** | LeaveRequest status → REJECTED, reason appended. Related EmployeeTasks → REJECTED. |

### 4.7 Filter Staff Activity

| Step | Detail |
|------|--------|
| **Trigger** | Type in search box, or change department/status dropdown |
| **Behavior** | Client-side filtering (useMemo) — no API call |
| **Reset** | "Reset" button clears all three filters |

### 4.8 Tab Navigation (Bottom)

| Step | Detail |
|------|--------|
| **Trigger** | Click tab: "Database Karyawan", "Payroll & Benefit", or "Rekrutmen" |
| **Behavior** | Shows corresponding placeholder card. No data loading. |

---

## 5. Form Validations

This page has **no input forms** — it is read-only with action buttons.

The only interactive inputs are the **filter controls** in DetailedStaffActivity:

| Field | Required | Validation | Error behavior |
|-------|----------|------------|----------------|
| Search input | No | Free-text, no validation | Filters in real-time |
| Departemen dropdown | No | Select from dynamic list | — |
| Status dropdown | No | Select from fixed list | — |

Leave approve/reject buttons have **no confirmation dialog** — they fire immediately on click.

---

## 6. API Calls (Server Actions)

### 6.1 `getHCMDashboardData()` (`app/actions/hcm.ts:1900`)

| Field | Detail |
|-------|--------|
| **Called by** | `useQuery({ queryKey: queryKeys.hcmDashboard.list() })` |
| **Auth** | `withPrismaAuth` — requires authenticated Supabase session |
| **DB queries** | 7 parallel Prisma calls: employee count (active), employee count (total), today's attendance, pending leave count, pending leave requests (take 5), salary aggregate, latest payroll task |
| **Response shape** | `{ attendance: {...}, payroll: {...}, leaves: {...}, headcount: {...} }` |
| **Loading state** | `isLoading` / `isRefetching` — `refreshing` variable controls button disabled state + icon animation |
| **Error fallback** | Returns all-zero data structure (never throws). Page shows zeroed-out widgets. |

### 6.2 `getAttendanceSnapshot()` (`app/actions/hcm.ts:800`)

| Field | Detail |
|-------|--------|
| **Called by** | `useQuery({ queryKey: [...queryKeys.hcmAttendance.all, "snapshot"] })` |
| **Auth** | `withPrismaAuth` — requires authenticated Supabase session |
| **Parameters** | None (called without args from dashboard) |
| **DB queries** | 2 parallel: active employees, today's attendance records |
| **Response shape** | `{ date, rows: AttendanceRow[], departments: string[], stats: {...} }` |
| **Error fallback** | Returns empty rows/departments, zeroed stats. |

### 6.3 `approveLeaveRequest(leaveId)` (`app/actions/hcm.ts:1171`)

| Field | Detail |
|-------|--------|
| **Auth** | `getAuthzUser()` + `assertRole(SDM_APPROVER_ROLES)` + `assertLeaveApprovalAuthority()` |
| **Response** | `{ success: true, message: string }` or `{ success: false, error: string }` |

### 6.4 `rejectLeaveRequest(leaveId, reason)` (`app/actions/hcm.ts:1247`)

| Field | Detail |
|-------|--------|
| **Auth** | Same as approve |
| **Response** | `{ success: true, message: string }` or `{ success: false, error: string }` |

---

## 7. State & Dependencies

### React Query Keys

| Key | Data |
|-----|------|
| `["hcmDashboard", "list"]` | Dashboard summary (attendance, payroll, leaves, headcount) |
| `["hcmAttendance", "snapshot"]` | Today's detailed attendance rows + departments |

### Data Dependencies

| Dependency | Source |
|------------|--------|
| Authenticated user | Supabase session (cookie-based) |
| Employee records | `Employee` model (must have employees in DB) |
| Attendance records | `Attendance` model (today's date window) |
| Leave requests | `LeaveRequest` model (PENDING status) |
| Payroll run data | `EmployeeTask` model (latest payroll task note) |

### Component Dependencies

| Component | File | Props from |
|-----------|------|------------|
| AttendanceWidget | `components/hcm/attendance-widget.tsx` | `dashboardData.attendance` |
| PayrollSummaryWidget | `components/hcm/payroll-summary.tsx` | `dashboardData.payroll` |
| DetailedStaffActivity | `components/hcm/detailed-staff-activity.tsx` | `snapshot.rows` + `snapshot.departments` |
| DetailedPerformanceTable | `components/hcm/detailed-performance-table.tsx` | `snapshot.rows` (mapped to PerformanceRow) |
| LeaveRequestWidget | `components/hcm/leave-requests.tsx` | `dashboardData.leaves` + `handleRefresh` |
| PerformanceWidget | `components/hcm/performance-widget.tsx` | `snapshot.rows` (filtered) + `headcount.active` |

---

## 8. Edge Cases & States

### 8.1 Empty State (No Data)

| Scenario | Behavior |
|----------|----------|
| No employees in DB | All counters show 0. Progress bar empty. Tables show "Belum ada data karyawan". Top performers show "Belum ada data kehadiran". |
| No attendance today | Present=0, Late=0, Leave=0, Absent=all active. Rate=0%. Staff table shows all as ABSENT. |
| No pending leaves | Leave card shows 0. Widget shows dashed border: "Tidak ada permintaan cuti pending." |
| No payroll runs | Payroll widget shows Rp 0 for all values, status badge shows "DRAFT" or "READY". |

### 8.2 Loading State

| Scenario | Behavior |
|----------|----------|
| Initial load | `isLoading=true` → `refreshing=true` → Muat Ulang button disabled, icon spins. Widgets show fallback zeros until data arrives. **No loading skeleton on this page** — content renders immediately with zero values. |
| Refetch | Same behavior via `isRefetching`. |

### 8.3 Error State

| Scenario | Behavior |
|----------|----------|
| `getHCMDashboardData` fails | Server returns zeroed fallback object. Page renders with all 0s. **No error toast or message shown to user.** |
| `getAttendanceSnapshot` fails | Server returns empty rows/stats. Tables show "Belum ada data karyawan". **No error toast.** |
| `approveLeaveRequest` fails | Toast error shown: server message or "Gagal memproses cuti" |
| `rejectLeaveRequest` fails | Toast error shown: server message or "Gagal memproses cuti" |
| Auth error (not logged in) | `withPrismaAuth` throws; caught by server action try/catch → zeroed fallback |
| Role error (insufficient permissions) | `assertRole` throws on approve/reject → toast error: "Anda tidak memiliki akses..." |

### 8.4 Permission / Role-Based Visibility

| Feature | Restriction |
|---------|-------------|
| View dashboard | Any authenticated user (no role check on read actions) |
| Approve/Reject leave | `SDM_APPROVER_ROLES` only: ROLE_ADMIN, ROLE_CEO, ROLE_DIRECTOR, ROLE_MANAGER, ROLE_HR, admin, CEO, DIRECTOR, manager |
| Buttons visible to all | Approve/reject buttons are always visible regardless of role — auth check happens server-side on click |

### 8.5 Large Dataset Behavior

| Concern | Status |
|---------|--------|
| Staff Activity table | No pagination — renders ALL employees. Could be slow with 500+ rows. |
| Performance table | Same — no pagination, renders all rows. |
| Leave requests | Capped at 5 by server (`take: 5`). |
| Stacked bar | Width percentages can exceed 100% if data is inconsistent (present + late + leave > total). |

---

## 9. Issues & Notes

### 9.1 Bugs / Inconsistencies

| # | Severity | Description |
|---|----------|-------------|
| 1 | **Medium** | **"Laporan SDM" and "Karyawan Baru" both link to `/hcm/employee-master`** — "Laporan SDM" should probably link to a report page or at least open the reports tab. The `Download` icon further misleads the user into expecting a download action. |
| 2 | **Medium** | **"Rekrutmen" tab has no TabsContent** — clicking the tab renders blank space. The tab trigger exists at `page.tsx:249` but there is no matching `<TabsContent value="recruitment">`. |
| 3 | **Low** | **Performance data is daily, not monthly** — `page.tsx:144–155` maps each snapshot row to `attendanceDays: 1, workingDays: 1` — so the "Performance & Kehadiran" table shows "1/1" for hadir and either 100% or 0% rate. The subtitle says "Rekap kehadiran dan lembur bulan berjalan" but it only reflects today. |
| 4 | **Low** | **Top performers list shows all present employees with 100%** — since data is from today's snapshot only, every present/remote employee gets `attendanceRate: 100`. The "Top 3" are just the first 3 alphabetically, not truly best performers. |
| 5 | **Low** | **No loading skeleton** — unlike other subpages (Employee Master, Attendance) which use `<TablePageSkeleton>`, this dashboard jumps from zero-data to real data. |
| 6 | **Low** | **AttendanceWidget does not use NB design** — uses rounded Card with `rounded-full` progress bar, while PayrollSummaryWidget uses NB black borders. Visual inconsistency. |
| 7 | **Low** | **Leave approve/reject has no confirmation dialog** — clicking the button immediately fires the server action. Accidental clicks cannot be undone. |
| 8 | **Info** | **Leave reject reason is hardcoded** — always passes `"Ditolak dari dashboard SDM"`. No user input for rejection reason. |
| 9 | **Info** | **Attendance rate formula includes leave as "present"** — `attendanceRate = (present + onLeave) / activeCount * 100`. This means employees on approved leave boost the rate. May be intentional for Indonesian SME context. |
| 10 | **Info** | **No dark mode testing guidance** — widgets have `dark:` classes but mixed approaches (some use `dark:bg-zinc-900`, others don't). |

### 9.2 Missing Features

| Feature | Note |
|---------|------|
| Loading skeleton | Should use `<TablePageSkeleton>` like other HCM pages |
| Period selector | Payroll widget is locked to current period; cannot view past months |
| Click-through from KPI cards | "Karyawan Aktif" card doesn't link to employee master; "Cuti Menunggu" doesn't link to attendance/leave tab |
| Staff activity row click | Cannot click a row to see employee detail |
| Pagination on tables | Both tables render all rows without pagination |
| Rekrutmen tab content | Tab exists but content is missing |

---

## Appendix: Component File Map

| File | Lines | Role |
|------|-------|------|
| `app/hcm/page.tsx` | 282 | Main dashboard page |
| `components/hcm/attendance-widget.tsx` | 87 | Attendance KPI card |
| `components/hcm/payroll-summary.tsx` | 61 | Payroll summary card |
| `components/hcm/detailed-staff-activity.tsx` | 215 | Staff activity table with filters |
| `components/hcm/detailed-performance-table.tsx` | 108 | Performance ranking table |
| `components/hcm/leave-requests.tsx` | 120 | Leave request approve/reject widget |
| `components/hcm/performance-widget.tsx` | 90 | Top performer KPI widget |
| `app/actions/hcm.ts` | 2046 | Server actions (getHCMDashboardData, getAttendanceSnapshot, approveLeaveRequest, rejectLeaveRequest) |
| `lib/query-keys.ts` | — | Query key definitions (hcmDashboard, hcmAttendance) |
