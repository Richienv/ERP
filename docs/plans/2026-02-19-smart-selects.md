# Smart Selects: DB-Backed Dropdowns with Create-New for Inventory

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert all free-text and hardcoded fields in /inventory forms to searchable, DB-backed selects with inline "Buat Baru" creation option.

**Architecture:** New Prisma models (Unit, Brand, Color) + reusable ComboboxWithCreate component + systematic form upgrades.

---

### Task 1: Add Prisma Models (Unit, Brand, Color) + Seed Data

**Files:**
- Modify: `prisma/schema.prisma` — add Unit, Brand, Color models
- Create: migration via `prisma migrate dev`
- Modify: seed script to populate from existing hardcoded arrays

**Models:**
```prisma
model Unit {
  id       String   @id @default(cuid())
  code     String   @unique  // pcs, kg, m, yard
  name     String             // Pieces, Kilogram, Meter, Yard
  isActive Boolean  @default(true)
  products Product[]
  createdAt DateTime @default(now())
}

model Brand {
  id       String   @id @default(cuid())
  code     String   @unique  // BR, ZR, XX
  name     String             // Brodo, Zara, Unbranded
  isActive Boolean  @default(true)
  createdAt DateTime @default(now())
}

model Color {
  id       String   @id @default(cuid())
  code     String   @unique  // BLK, WHT, RED
  name     String             // Hitam, Putih, Merah
  hexCode  String?            // #000000 (optional)
  isActive Boolean  @default(true)
  createdAt DateTime @default(now())
}
```

Seed from existing `INDONESIAN_UNITS` (20 units), `CODE_BRANDS` (6 brands), `CODE_COLORS` (19 colors).

---

### Task 2: Server Actions + API for Unit, Brand, Color CRUD

**Files:**
- Create: `lib/actions/master-data.ts` — getUnits, getBrands, getColors, createUnit, createBrand, createColor
- Modify: `lib/query-keys.ts` — add units, brands, colors key factories

---

### Task 3: Build ComboboxWithCreate Reusable Component

**Files:**
- Create: `components/ui/combobox-with-create.tsx`

**Props:**
```ts
interface ComboboxWithCreateProps {
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
  placeholder: string
  searchPlaceholder?: string
  emptyMessage?: string
  createLabel: string // e.g. "+ Buat Kategori Baru"
  onCreate: (name: string) => Promise<string> // returns new ID
  isLoading?: boolean
}
```

Uses shadcn Popover + Command (cmdk) pattern. Neo-brutalist styling.

---

### Task 4: Upgrade ProductCreateDialog (Tambah Produk Baru)

**File:** `components/inventory/product-create-dialog.tsx`

Changes:
- Satuan: replace hardcoded `INDONESIAN_UNITS` Select → `ComboboxWithCreate` from Unit DB table
- Brand (code builder): replace hardcoded `CODE_BRANDS` → `ComboboxWithCreate` from Brand DB table
- Warna (code builder): replace hardcoded `CODE_COLORS` → `ComboboxWithCreate` from Color DB table
- Kategori Inventori: already DB-backed, add "+ Buat Kategori Baru" option
- Add Supplier Utama field: `ComboboxWithCreate` from Supplier DB table

---

### Task 5: Wire + Upgrade MaterialInputForm (Input Material Baru)

**File:** `components/inventory/material-input-form.tsx`

Changes:
- Wire handleSubmit to actual `createProduct` server action (currently TODO/mock)
- Satuan: free-text Input → `ComboboxWithCreate` from Unit DB
- Supplier Utama: free-text Input → `ComboboxWithCreate` from Supplier DB
- Brand (code builder): hardcoded → Brand DB
- Warna (code builder): hardcoded → Color DB

---

### Task 6: Upgrade inventory/product-form.tsx + Fix products/new page

**Files:**
- Modify: `components/inventory/product-form.tsx` — Satuan → Unit DB select
- Modify: `app/inventory/products/new/page.tsx` — pass categories prop, wire real server action

---

### Task 7: Upgrade Remaining Inventory Dialogs to Searchable Selects

**Files:**
- `components/inventory/manual-movement-dialog.tsx` — Product: plain Select → searchable Combobox
- `components/inventory/create-transfer-dialog.tsx` — native `<select>` → shadcn Select for warehouses, searchable Combobox for products
- `components/inventory/fabric-roll-receive-dialog.tsx` — native `<select>` → shadcn Select, product → searchable Combobox
- `components/inventory/adjustment-form.tsx` — Alasan: free-text → Select with predefined reasons
- `app/inventory/audit/page.tsx` — Produk in Input Opname: plain Select → searchable Combobox

---

### Task 8: Fix/Deprecate Legacy product-form.tsx

**File:** `components/product-form.tsx`

Replace `mockCategories` with real DB categories. Replace hardcoded `units` array with Unit DB. Or deprecate if no longer used anywhere.
