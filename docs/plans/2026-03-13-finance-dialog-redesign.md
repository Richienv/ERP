# Finance Module Dialog Redesign Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign all 20 unstyled/partially-styled dialogs across the finance module to use the NB (neo-brutalist) dialog system consistently.

**Architecture:** Each dialog gets: NB.contentNarrow/content container, NB.header (black bg), NB.title with icon, NB.label/input/select form elements, NB.footer with cancel+submit buttons, plus contextual improvements (preview strips, visual pickers, section dividers where appropriate). No new components — just applying the existing NB design system from `lib/dialog-styles.ts`.

**Tech Stack:** React, shadcn/ui Dialog, Tailwind CSS, Lucide icons, NB style constants

---

## Design Pattern Reference

All dialogs follow this NB pattern (from `lib/dialog-styles.ts`):

```tsx
<DialogContent className={NB.contentNarrow}>
    <DialogHeader className={NB.header}>
        <DialogTitle className={NB.title}>
            <Icon className="h-5 w-5" /> Title
        </DialogTitle>
        <p className="text-zinc-400 text-[11px] font-bold mt-0.5">Subtitle</p>
    </DialogHeader>
    <div className="p-6 space-y-5">
        <div>
            <label className={NB.label}>Field <span className={NB.labelRequired}>*</span></label>
            <Input className={NB.input} />
        </div>
        <div className={NB.footer}>
            <Button variant="outline" className={NB.cancelBtn}>Batal</Button>
            <Button className={NB.submitBtn}>Submit</Button>
        </div>
    </div>
</DialogContent>
```

**Required import:** `import { NB } from "@/lib/dialog-styles"`

---

### Task 1: accounting-module-actions.tsx (4 dialogs)

**Files:**
- Modify: `components/finance/accounting-module-actions.tsx`

**What:** Redesign 4 action dialogs: Buat Pembayaran AP, Tambah Akun COA, Posting Jurnal Umum, Generate Laporan Keuangan.

**Step 1:** Read the file and identify all 4 dialog sections (lines ~242-433).

**Step 2:** Add `import { NB } from "@/lib/dialog-styles"` and any missing Lucide icons (Loader2, Plus, etc.).

**Step 3:** For each dialog, apply:
- `DialogContent className={NB.contentNarrow}`
- `DialogHeader className={NB.header}` with `DialogTitle className={NB.title}` + relevant icon
- All labels → `className={NB.label}`, all inputs → `className={NB.input}` or `NB.inputMono`
- All selects → `className={NB.select}`
- Footer → `className={NB.footer}` with `NB.cancelBtn` and `NB.submitBtn`

**Step 4: Tambah Akun COA dialog** — match the pattern from the already-redesigned `chart-accounts/page.tsx`: visual tile picker for account type, 1/3 code + 2/3 name grid, preview strip.

**Step 5: Posting Jurnal Umum dialog** — add section dividers for header vs lines, NB.inputMono for amounts.

**Step 6:** Verify no TS errors: `npx tsc --noEmit 2>&1 | grep accounting-module`

**Step 7:** Commit: `git add components/finance/accounting-module-actions.tsx && git commit -m "feat(finance): redesign 4 action dialogs in accounting-module-actions"`

---

### Task 2: bills/page.tsx (3 dialogs)

**Files:**
- Modify: `app/finance/bills/page.tsx`

**What:** Redesign: Detail Tagihan (bill detail sheet), Dispute Tagihan, Bayar via Xendit.

**Step 1:** Read the file around lines 440-686 to understand all 3 dialogs.

**Step 2:** Add NB import. For each dialog:
- **Detail Tagihan (~440-527):** Already has `border-2 border-black` — upgrade to `NB.contentNarrow`, add NB.header with FileText icon, structured bill info with labels.
- **Dispute Tagihan (~531-564):** Add NB.contentNarrow, NB.header with AlertCircle icon (red-tinted subtitle), NB.textarea for reason, NB.footer.
- **Bayar via Xendit (~567-686):** Add NB.content (wider for payment details), NB.header with CreditCard icon, section dividers for payment method vs amount vs confirmation.

**Step 3:** Verify: `npx tsc --noEmit 2>&1 | grep "bills/page"`

**Step 4:** Commit: `git add app/finance/bills/page.tsx && git commit -m "feat(bills): redesign 3 bill dialogs with NB styling"`

---

### Task 3: vendor-payments/page.tsx (2 dialogs)

**Files:**
- Modify: `app/finance/vendor-payments/page.tsx`

**What:** Redesign: Konfirmasi Pembayaran AP, Otorisasi Tanda Tangan.

**Step 1:** Read file around lines 586-650.

**Step 2:** Apply NB styling:
- **Konfirmasi Pembayaran:** NB.contentNarrow, NB.header with Banknote icon, payment summary section with NB.inputMono amounts, NB.footer.
- **Otorisasi Tanda Tangan:** NB.contentNarrow, NB.header with PenTool icon, authorization fields, NB.footer.

**Step 3:** Verify and commit.

---

### Task 4: reports/page.tsx (2 dialogs)

**Files:**
- Modify: `app/finance/reports/page.tsx`

**What:** Redesign: Pilih Rentang Tanggal, Export Laporan.

**Step 1:** Read file around lines 510-565.

**Step 2:** Apply NB styling:
- **Date range:** NB.contentNarrow, NB.header with Calendar icon, date inputs with `Dari → Sampai` arrow pattern (like reconciliation dialog).
- **Export:** NB.contentNarrow, NB.header with Download icon, format selector as visual tile picker (CSV/XLS tiles).

**Step 3:** Verify and commit.

---

### Task 5: journal/page.tsx (1 dialog)

**Files:**
- Modify: `app/finance/journal/page.tsx`

**What:** Redesign: Export General Ledger dialog.

**Step 1:** Read file around line 150-163.

**Step 2:** Apply NB.contentNarrow, NB.header with Download icon, export options, NB.footer.

**Step 3:** Verify and commit.

---

### Task 6: petty-cash/page.tsx (2 dialogs)

**Files:**
- Modify: `app/finance/petty-cash/page.tsx`

**What:** Standardize: Top Up Peti Kas, Catat Pengeluaran — both have custom NB-like styling but don't use the NB constants.

**Step 1:** Read file around lines 187-418.

**Step 2:** Replace custom className strings with NB constants:
- Custom `bg-emerald-600` header → keep the color but use NB.title for text styling
- Custom borders/shadows → NB.contentNarrow
- Custom labels → NB.label
- Custom inputs → NB.input / NB.inputMono
- Custom buttons → NB.submitBtn / NB.cancelBtn
- Add Rp prefix pattern on amount fields

**Step 3:** Verify and commit.

---

### Task 7: nota-debit-tab.tsx + nota-kredit-tab.tsx (2 dialogs)

**Files:**
- Modify: `components/finance/nota-debit-tab.tsx`
- Modify: `components/finance/nota-kredit-tab.tsx`

**What:** Switch custom className to NB constants, add proper NB.header.

**Step 1:** Read both files around line 181-294.

**Step 2:** For both:
- Replace `border-2 border-black shadow-[6px_6px...] max-w-lg` → `NB.contentNarrow`
- Add NB.header with appropriate icon (FileText for debit, FileText for kredit)
- All form elements → NB constants
- Ensure NB.footer pattern

**Step 3:** Verify: `npx tsc --noEmit 2>&1 | grep "nota-"`

**Step 4:** Commit: `git add components/finance/nota-*.tsx && git commit -m "feat(finance): standardize nota debit/kredit dialogs to NB system"`

---

### Task 8: Final verification + push

**Step 1:** Run full type check: `npx tsc --noEmit 2>&1 | grep -c "error TS"` — should not increase from baseline.

**Step 2:** Visual spot-check: `npm run dev` and check each dialog renders correctly.

**Step 3:** Commit any remaining fixes.

**Step 4:** Push to main: `git push origin feat/csa-parity:main`

---

## Files Summary

| # | File | Dialogs | Priority |
|---|------|---------|----------|
| 1 | `components/finance/accounting-module-actions.tsx` | 4 | High — most visible |
| 2 | `app/finance/bills/page.tsx` | 3 | High — user-facing |
| 3 | `app/finance/vendor-payments/page.tsx` | 2 | Medium |
| 4 | `app/finance/reports/page.tsx` | 2 | Medium |
| 5 | `app/finance/journal/page.tsx` | 1 | Low |
| 6 | `app/finance/petty-cash/page.tsx` | 2 | Low — already partially styled |
| 7 | `components/finance/nota-debit-tab.tsx` | 1 | Low — already partially styled |
| 7 | `components/finance/nota-kredit-tab.tsx` | 1 | Low — already partially styled |

**Total: 20 dialogs across 8 files**
