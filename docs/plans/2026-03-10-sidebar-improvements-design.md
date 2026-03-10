# Sidebar & Layout Improvements Design

**Date:** 2026-03-10
**Branch:** feat/csa-parity
**Status:** Approved

## Problem

The sidebar has 85+ sub-items across 8 modules with no grouping, no breadcrumbs, duplicate code, and basic styling. Users scroll endlessly, get lost in detail pages, and can't visually scan modules quickly.

## Scope

### Section 1: Nav Clutter Reduction — Smart Sub-Item Grouping

Add labeled separator groups within large modules:

**Inventori (13 items → 3 groups):**
- Products: Dashboard, Kelola Produk, Kategori Produk
- Stok: Level Stok, Pergerakan Stok, Transfer Stok, Gudang & Lokasi, Fabric Rolls
- Kontrol: Stok Opname, Peringatan Stok, Laporan Inventori
- Pengaturan: Saldo Awal Stok, Pengaturan Inventori

**Keuangan (13 items → 3 groups):**
- Transaksi: Invoicing, AR, AP, Nota Kredit/Debit, Peti Kas
- Akuntansi: Jurnal Umum, Transaksi Akun, Rekonsiliasi Bank, Chart of Accounts
- Laporan & Setup: Laporan Keuangan, Saldo Awal, Kurs Mata Uang, Periode Fiskal

**Manufaktur (12 items → 3 groups):**
- Perencanaan: Dashboard, BOM, Kebutuhan Material, MPS, Cost Sheet
- Produksi: Work Center, Proses, SPK, Cut Plan
- Kualitas & Mitra: QC, Order Subkontrak, Registri Mitra CMT

Implementation: Add `group?: string` field to sub-item type. NavMain renders a separator label when group changes.

### Section 2: Breadcrumbs in Site Header

- `useBreadcrumbs()` hook maps URL segments to Bahasa Indonesia labels
- Uses nav data for label consistency
- Clickable segments navigate to parent routes
- Mobile: show current page title only
- Style: segments separated by `/`, current segment `font-semibold`, ancestors `text-muted-foreground`

### Section 3: Code Cleanup

Split app-sidebar.tsx (585 lines → ~80 lines):

| New File | Responsibility |
|----------|---------------|
| `lib/sidebar-nav-data.ts` | Static nav structure + group separators |
| `hooks/use-filtered-nav.ts` | Role + workflow visibility filtering |
| `hooks/use-inject-badges.ts` | Badge count injection |
| `components/app-sidebar.tsx` | JSX shell composing hooks |

Additional cleanup:
- Fix duplicate `<SidebarTrigger>` in site-header (2 → 1 with responsive classes)
- Fix `IconUsers` duplication: use `IconId` for SDM
- Remove prefetch logic from app-sidebar (already in use-nav-prefetch + warm-cache)

### Section 4: Frontend Design Polish

**4a. Module accent colors:**
- Inventori (blue), Penjualan (green), Pengadaan (orange), Keuangan (purple), Manufaktur (slate), SDM (warm)
- Rendered as `w-2 h-2 rounded-full` dot next to module icon

**4b. Group separators:**
- `text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-3 py-1`

**4c. Badge severity colors:**
- Yellow `bg-amber-500` — informational (incomplete data)
- Orange `bg-orange-500` — needs attention (pending approvals)
- Red `bg-red-500` — urgent (overdue, low stock)

**4d. Active page indicator:**
- Left border accent `border-l-2 border-black` on active nav item

**4e. Sidebar header polish:**
- Slightly larger logo box, thin bottom shadow separator

**4f. Mobile sheet fixes:**
- Sticky header/footer in mobile sheet
- Only middle content scrolls

## Files Affected

- `components/app-sidebar.tsx` — major refactor (split out)
- `components/nav-main.tsx` — add group separator rendering, accent dots, active indicator
- `components/site-header.tsx` — add breadcrumbs, fix duplicate trigger
- `components/ui/sidebar.tsx` — mobile sheet sticky header/footer fix
- `lib/sidebar-nav-data.ts` — new file (nav structure)
- `hooks/use-filtered-nav.ts` — new file
- `hooks/use-inject-badges.ts` — new file
- `hooks/use-breadcrumbs.ts` — new file

## Out of Scope

- Command palette (Cmd+K) — future enhancement
- Recent pages / favorites — future enhancement
- Prefetch optimization — separate task
- Cache warming overlay changes — separate task
