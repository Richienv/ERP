# UI/UX master audit: Integra Pro, checked against the ui-ux-master skill

**Date:** 2026-11-21 · **Branch:** `claude/erp-uiux-master-ccd195` (stacked on `feat/erp-redesign`, PR #21)
**Method:** the `ui-ux-master` skill (`~/.claude/skills/ui-ux-master`). It works in ten layers (user,
IA, flow, layout, components and states, tokens, motion, copy, speed, accessibility). It runs a
lint (`scripts/ui_lint.py --audience mature --lang id`) and five tests (5-second, squint, hunt,
persona, worst-data). Every screen below was looked at in the browser at 1440 px and at 375 px,
against the local demo database.

Audience: admins and owners aged 40–60+ at a spare-part trading company. They come from Excel,
Accurate or SAP, and use a laptop at the desk and a phone in the warehouse.

## What the audit found, ranked

Severity: **B** = Blocker (misleads about money or stock, or the job can't be done), **M** = Major,
**m** = minor. Reach: how many screens share the fix.

| # | Layer | Where | What the user felt | Sev | Fix |
|---|---|---|---|---|---|
| 1 | 9/data | Dashboard, Inventori card | Stock read "Stok: 012" and "080". `quantity` is a Prisma Decimal, so `0 + Decimal` joined the numbers as strings | **B** | `Number()` in the API sum |
| 2 | 5/data | Dashboard, Keuangan card | "Tagihan Mendatang" showed **Rp 0** for every bill (it read `bill.amount`, a field that doesn't exist) | **B** | show `balanceDue` (what is still owed) + due date; same fix for overdue invoices |
| 3 | 1/8 | Every page | A hidden "ERP Intelligence · Powered by Gemini" panel with fake English chat ("Wireless Headset X1") was mounted on every page. Nothing could open it, but screen readers read it | **B** | not mounted any more |
| 4 | 10/6 | Whole app | 1,764 labels use `text-zinc-400`: **2.6:1** contrast on white, which fails WCAG AA and is hard for older eyes | **M**, reach 1,764 | light-mode token floor: zinc-400 → 5.1:1, zinc-500 → 5.9:1 (dark mode untouched) |
| 5 | 8 | Dashboard, feed, bills, procurement | Statuses as English enums: "PARTIAL RECEIVED", "VENDOR CONFIRMED", "ISSUED", "Overdue" | **M** | one dictionary, `lib/status-labels.ts` ("Diterima sebagian", "Belum bayar", "Terlambat · 933 hari"), used by the shared `StatusBadge` |
| 6 | 4/6 | 14 finance/HR tables | Black table-header bars with grey text, left over from the neo-brutalist look | **M**, reach 14 | calm `slate-50` header with a hairline |
| 7 | 4/6 | 46 files | The selected tab or chip was a black slab | m, reach 54 | brand blue (`bg-primary`) |
| 8 | 6 | 20 files | 38 places with text of 6–11 px (charts, reconciliation, badges) | **M** | everything ≥ 12 px (`text-xs`) |
| 9 | 8/5 | Login | Raw English Supabase errors ("Invalid login credentials"), shown twice (inline + toast); a "Lanjutkan dengan Google" button that only said "not configured" | **M** | plain Indonesian with what to do next; the stub button removed; the button says "Memeriksa…" / "Membuka dasbor…" |
| 10 | 4 | Tagihan Vendor | Paid history sat **above** the bills still to pay; English labels ("No. Bill", "Scan Bill", "Pending"); "2/5/2024" dates | **M** | work list first, history below; Indonesian words; "2 Mei 2024"; amounts right-aligned |
| 11 | 10 | 70 icon buttons | Icon-only buttons with no accessible name | **M** | `aria-label` in Indonesian from the icon (Hapus, Ubah, Lihat rincian…) |
| 12 | 4 | Fixed assets, reports | Money columns left-aligned | m | right-aligned with tabular figures (receipt rule) |
| 13 | 3 | Phone menu | After tapping a menu item the menu stayed open over the page: one extra tap on every navigation | **M** | the menu closes when the page changes |
| 14 | 4 | Bayar Vendor (375 px) | Six columns squeezed into 330 px; text overlapped | **M** | the table scrolls sideways; page headers stack on phones (13 pages) |
| 15 | 4/6 | Dashboard cards | Black card headers, two-column metrics that wrapped ("Kas Masuk Bersih"), hard offset shadows | **M** | calm header + "Lihat →"; one column like a ledger; no hard shadows |
| 16 | 8 | Dashboard | "Revenue", "Net Cash Flow", "AP Overdue", "Absent", "LIVE", "Review" | m | Pendapatan, Arus kas bersih, Hutang terlambat, Tidak hadir, Terkini, Tinjau |
| 17 | 5 | Six dialogs and popups | Spinner with no words | m | "Memuat data PO…", "Memuat invoice…" |
| 18 | 8 | Spare-part list | "6 pembelian · 5 ms": developer timing shown to users | m | the timing moved to a tooltip |

Lint over `app/ components/ lib/` (930 files):

| | Errors | Warnings |
|---|---|---|
| Before (`feat/erp-redesign`) | 109 | 437 |
| After (this branch) | **0** | 365 |

## Sebelumnya / Sekarang / Kenapa penting

**1. Angka stok dan tagihan di dasbor**
- *Sebelumnya:* Stock showed "012" or "080", and upcoming bills showed Rp 0. The owner couldn't
  trust the first screen, so he had to open every module to check.
- *Sekarang:* real stock (12, 80) and the real amount still owed, with "Jatuh tempo 15 Des 2026".
- *Kenapa penting:* the dashboard is the screen the owner opens every morning. A wrong number there
  costs more trust than any visual polish can earn back.

**2. Teks abu-abu bisa dibaca**
- *Sebelumnya:* labels, dates and secondary numbers at 2.6:1 contrast. Users leaned in or asked
  someone.
- *Sekarang:* every secondary text passes WCAG AA (≥ 4.5:1), across all 1,764 places, from one token.
- *Kenapa penting:* the users are 40–60+. Reading is the job.

**3. Status dalam bahasa mereka**
- *Sebelumnya:* "PARTIAL RECEIVED", "ISSUED", "Overdue".
- *Sekarang:* "Diterima sebagian", "Belum bayar", "Terlambat · 933 hari", always with a dot.
- *Kenapa penting:* nobody has to translate in their head. The status also says what to do next.

**4. Tagihan Vendor: kerjaan dulu, riwayat belakangan**
- *Sebelumnya:* the paid history came first, and the bills to pay were below it.
- *Sekarang:* the bills to pay come first, and the history is below them.
- *Kenapa penting:* a page is opened to act. History is only looked up.

**5. Login**
- *Sebelumnya:* "Login gagal: Invalid login credentials", twice, and a Google button that didn't
  work.
- *Sekarang:* "Email atau kata sandi salah. Periksa lagi, atau pilih 'Lupa kata sandi?'…". No fake
  buttons.
- *Kenapa penting:* the login is the first impression, and it must never look broken or cheap.

**6. HP**
- *Sebelumnya:* the menu stayed open after every tap, and the payments table overlapped.
- *Sekarang:* the menu closes by itself, tables scroll sideways, and headers stack.
- *Kenapa penting:* the warehouse checks on the phone. One tap less on every page adds up.

## Verified

- `npx vitest run`: 1,267 pass. The same 7 pre-existing failures as the base branch
  (`invoice-payment-flow`, `app/actions/inventory.test.ts`). New: `__tests__/ui-ux-master-guards.test.ts`
  (16 tests).
- `npx tsc --noEmit`: 21 errors, the baseline. All are in files this branch doesn't touch.
- `next build`: pass. The token floor is in the production CSS.
- Browser, local demo DB: dashboard, Pembelian Sparepart, Tagihan Vendor and Bayar Vendor at 1440 px
  and 375 px. No horizontal page scroll at 375 px. The phone menu closes after navigation.
- Login: checked in code and tests only. The browser session is signed in to the local demo, and
  signing out was avoided.

## Not done (next)

- 26 native `confirm()` / `prompt()` dialogs (mostly manufacturing). They are Indonesian already, but
  unstyled. Move them to `components/ui/confirm-dialog`.
- 61 button spinners keep their label while waiting ("Simpan" stays "Simpan"). They should say
  "Menyimpan…". This should be fixed once in `Button` (a `loading` + `loadingText` prop), not per page.
- 60 English words remain, mostly in manufacturing, HR and sales, which this business has hidden.
- 68 one-off hex colours, 44 clickable divs without keyboard support, 28 hover-only actions.
- The dashboard still shows mining-edition cards (Armada, SDM attendance) for the spare-part
  business. Whether to hide them is a product decision.
- Pre-existing: a hard reload in local demo mode lands on the dashboard.
- Pre-existing, found while tracing #1: manufacturing BOM screens sum `quantity` the same way
  (`app/manufacturing/bom/[id]/page.tsx:242,249`, `components/manufacturing/bom/timeline-view.tsx:248`).
  Check whether those values are Decimals there too.
