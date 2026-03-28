# NB Dialog Form Standard — Shared Components

**Date:** 2026-03-28
**Status:** Approved
**Reference implementation:** `app/finance/payments/payments-view.tsx:719-929` (Catat Penerimaan Baru)

## Problem

Every dialog in Keuangan (and the broader ERP) manually assembles the NB Dialog Form Standard from raw shadcn primitives + NB class tokens. This means:

- 13+ finance dialogs each repeat the same 4-layer structure (header, scroll body, sections, footer)
- The active-input indicator ternary (`value ? "border-orange-400 bg-orange-50/50 font-bold" : "border-zinc-300 bg-white"`) is copy-pasted into every single field
- Currency inputs duplicate the Rp-prefix + non-digit stripping + locale formatting logic
- NB tokens in `lib/dialog-styles.ts` have drifted from the reference implementation (e.g. `NB.header` = `px-6 py-4` but reference uses `px-5 py-3`)

## Solution

Create reusable shared components that enforce the NB Dialog Form Standard. Two categories:

1. **Shell components** — enforce the 4-layer dialog structure
2. **Atomic field components** — handle active-input glow, currency formatting, label styling

### Architecture: Hybrid (Compound Shell + Atomic Fields)

The shell enforces structure without being rigid. Fields are standalone atoms with built-in active-input indicators. Layout (grid-cols-2, grid-cols-3, full-width) stays in the consumer's control.

## Component Spec

### File Location

All components in `components/ui/nb-dialog.tsx` (single file, following shadcn pattern of co-locating related primitives).

### Shell Components

#### `NBDialog`

Outer wrapper. Composes shadcn `Dialog` + `DialogContent`.

```tsx
<NBDialog open={open} onOpenChange={setOpen} size="default">
  ...children...
</NBDialog>
```

**Props:**
- `open: boolean`
- `onOpenChange: (open: boolean) => void`
- `size?: "default" | "narrow" | "wide"` — maps to max-w-3xl / max-w-xl / max-w-4xl
- `children: ReactNode`

**Rendered classes (DialogContent):**
```
[size] p-0 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-none overflow-hidden gap-0
```

#### `NBDialogHeader`

Black header bar with icon + title + subtitle.

```tsx
<NBDialogHeader icon={Wallet} title="Catat Penerimaan Baru" subtitle="Catat penerimaan pelanggan..." />
```

**Props:**
- `icon: React.ComponentType<{ className?: string }>` (works with both Lucide and Tabler icons)
- `title: string`
- `subtitle?: string`

**Rendered:**
```
<DialogHeader className="bg-black text-white px-5 py-3">
  <DialogTitle className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
    <Icon className="h-4 w-4" /> {title}
  </DialogTitle>
  {subtitle && <p className="text-zinc-400 text-[11px] font-bold mt-0.5">{subtitle}</p>}
</DialogHeader>
```

#### `NBDialogBody`

Scrollable content area.

```tsx
<NBDialogBody>
  <NBSection .../>
  <NBSection .../>
</NBDialogBody>
```

**Props:**
- `children: ReactNode`

**Rendered:**
```
<div className="overflow-y-auto max-h-[72vh]">
  <div className="p-4 space-y-3">
    {children}
  </div>
</div>
```

#### `NBDialogFooter`

Sticky footer with cancel + submit buttons.

```tsx
<NBDialogFooter
  onCancel={() => setOpen(false)}
  onSubmit={handleSubmit}
  submitting={isSubmitting}
  submitLabel="Simpan Penerimaan"
  disabled={!isValid}
/>
```

**Props:**
- `onCancel: () => void`
- `onSubmit: () => void`
- `submitting?: boolean`
- `submitLabel: string` — e.g. "Simpan Penerimaan"
- `disabled?: boolean` — disables submit when form invalid

**Rendered:**
```
<div className="border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-2.5 flex items-center justify-end gap-2">
  <Button cancel ... disabled={submitting}>Batal</Button>
  <Button submit ... disabled={submitting || disabled}>
    {submitting ? <Loader2 spinner /> : null}
    {submitting ? "Menyimpan..." : submitLabel}
  </Button>
</div>
```

Cancel button: `border border-zinc-300 dark:border-zinc-600 text-zinc-500 font-bold uppercase text-[10px] tracking-wider px-4 h-8 rounded-none`
Submit button: `bg-black text-white border border-black hover:bg-zinc-800 font-black uppercase text-[10px] tracking-wider px-5 h-8 rounded-none gap-1.5`

### Section Component

#### `NBSection`

Card with header bar + body.

```tsx
<NBSection icon={CircleDollarSign} title="Data Penerimaan">
  ...fields...
</NBSection>

<NBSection icon={FileText} title="Hubungkan ke Invoice" optional>
  ...fields...
</NBSection>
```

**Props:**
- `icon: React.ComponentType<{ className?: string }>`
- `title: string`
- `optional?: boolean` — shows "opsional" tag right-aligned
- `children: ReactNode`

**Rendered:**
```
<div className="border border-zinc-200 dark:border-zinc-700">
  <div className="bg-zinc-50 dark:bg-zinc-800/50 px-3 py-1.5 border-b border-zinc-200 dark:border-zinc-700 flex items-center gap-2">
    <Icon className="h-3.5 w-3.5 text-zinc-400" />
    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{title}</span>
    {optional && <span className="text-[10px] font-medium text-zinc-400 ml-auto">opsional</span>}
  </div>
  <div className="p-3 space-y-3">
    {children}
  </div>
</div>
```

### Atomic Field Components

All fields share:
- `h-8 text-sm rounded-none border` base
- `NB.label` for labels: `text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1 block`
- Required indicator: `<span className="text-red-500">*</span>`
- Auto-detect `hasValue` from value prop — consumer never passes hasValue manually

#### `NBInput`

Standard text/date/number input with orange active glow.

```tsx
<NBInput label="Pelanggan" required value={v} onChange={setV} placeholder="Pilih..." />
<NBInput label="Tanggal" type="date" value={v} onChange={setV} />
```

**Props:**
- `label: string`
- `required?: boolean`
- `value: string`
- `onChange: (value: string) => void`
- `type?: "text" | "date" | "number"` (default "text")
- `placeholder?: string`
- `disabled?: boolean`
- `className?: string` — for outer wrapper (allows grid positioning)

**Active state detection:** `hasValue = value !== "" && value !== undefined`

**Active classes:** `border-orange-400 dark:border-orange-500 bg-orange-50/50 dark:bg-orange-950/20 font-bold`
**Empty classes:** `border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900`

**Placeholder styling:** `placeholder:italic placeholder:font-normal placeholder:text-zinc-400`

#### `NBCurrencyInput`

Currency input with emerald glow, Rp prefix, locale formatting.

```tsx
<NBCurrencyInput label="Nominal" required value={amount} onChange={setAmount} />
```

**Props:**
- `label: string`
- `required?: boolean`
- `value: string` — raw digits (no separators)
- `onChange: (value: string) => void`
- `disabled?: boolean`
- `className?: string`

**Active state detection:** `hasValue = Number(value) > 0`

**Active classes:** `border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/20`
**Empty classes:** `border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900`

**Rp prefix color:** `hasValue ? "text-emerald-500" : "text-zinc-300 dark:text-zinc-600"`
**Input text color:** `hasValue ? "text-emerald-700 dark:text-emerald-400" : ""`

**Behavior:**
- `inputMode="numeric"`
- Display: `Number(value).toLocaleString("id-ID")` (or raw value if not numeric)
- On change: strip non-digits `e.target.value.replace(/\D/g, "")`
- Text alignment: right-aligned, monospace, bold

#### `NBSelect`

Dropdown select with orange active glow.

```tsx
<NBSelect
  label="Metode"
  value={method}
  onValueChange={setMethod}
  options={[
    { value: "TRANSFER", label: "Transfer Bank" },
    { value: "CASH", label: "Tunai" },
  ]}
  placeholder="Pilih metode"
/>
```

**Props:**
- `label: string`
- `required?: boolean`
- `value: string`
- `onValueChange: (value: string) => void`
- `options: Array<{ value: string; label: string }>`
- `placeholder?: string`
- `disabled?: boolean`
- `className?: string`

**Active state detection:** `hasValue = value !== "" && value !== undefined`

**Active classes:** Same orange as NBInput + `font-bold`

**Sentinel value:** Uses internal `"__NB_EMPTY__"` sentinel to handle the "no selection" state in Radix Select (which doesn't allow empty string values).

#### `NBTextarea`

Multiline text with orange active glow.

```tsx
<NBTextarea label="Catatan" value={notes} onChange={setNotes} placeholder="Catatan tambahan" rows={3} />
```

**Props:**
- `label: string`
- `required?: boolean`
- `value: string`
- `onChange: (value: string) => void`
- `placeholder?: string`
- `rows?: number` (default 3)
- `disabled?: boolean`
- `className?: string`

**Active state detection:** Same as NBInput.
**Active classes:** Same orange as NBInput.
**Base height:** Determined by rows prop, not h-8.

## NB Token Updates

Update `lib/dialog-styles.ts` to align with the reference implementation. Changes:

| Token | Current | New |
|-------|---------|-----|
| `NB.header` | `bg-black text-white px-6 py-4` | `bg-black text-white px-5 py-3` |
| `NB.title` | `text-lg font-black uppercase...` | `text-sm font-black uppercase...` |
| `NB.section` | `border-2 border-black` | `border border-zinc-200 dark:border-zinc-700` |
| `NB.input` | `border-2 ... h-10` | `h-8 text-sm rounded-none border` |
| `NB.inputSm` | Remove (now redundant) | Deprecated / removed |
| `NB.select` | `border-2 ... font-bold` | `h-8 text-sm rounded-none border` |

Add new tokens:
- `NB.dialogInput` — base input class for dialog forms (h-8)
- `NB.dialogSelect` — base select class for dialog forms (h-8)

Keep existing page-level tokens (`NB.pageCard`, `NB.toolbarBtn`, etc.) unchanged — those are for list pages, not dialog forms.

## Verification Plan

1. Create all components in `components/ui/nb-dialog.tsx`
2. Refactor the reference dialog (Catat Penerimaan Baru in `payments-view.tsx`) to use the new components
3. Visual comparison: output must be pixel-identical to current implementation
4. Test active-input glow: fill field → orange/emerald appears, clear → zinc returns
5. Test submit loading state: Loader2 spinner + "Menyimpan..."
6. Test dark mode: all dark: variants must work

## Scope

**In scope:** Create shared components, update NB tokens, refactor reference dialog.
**Out of scope:** Migrating all 13 finance dialogs (separate task after verification).
