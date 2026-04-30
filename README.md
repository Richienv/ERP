# integra.id — Mining Edition

> **Status:** Active development on branch `feat/integra-mining-pivot`
> **Target presentation:** 26 Juni 2026 (KRI lead)
> **Stack:** Next.js 16 + Prisma 6 + Supabase + Vercel

---

## Pivot Context (April 2026)

Setelah audit selesai (94/100 findings closed dalam 25 commits), produk pivot dari generic textile ERP ke **integra.id Mining Edition** untuk customer di ekosistem tambang Indonesia:

- **Target customer:** Supplier spare part, perusahaan rental armada (DC + alat berat), workshop service, dealer mobil baru untuk tambang
- **Confirmed lead:** PT KRI — bisnis rental armada + service center + sales mobil baru tambang
- **Presentation:** 26 Juni 2026 (one-shot — tidak ada konsultasi follow-up; menang demo = langsung beli)
- **Pain mereka saat ini:** Excel + spreadsheet, salah input sering, tim saling tunggu approval

## Strategic Decisions

| Topic | Decision | Why |
|-------|----------|-----|
| **Hosting demo** | Vercel + Supabase | Speed, no maintenance, Singapore edge fast untuk Indonesia |
| **Hosting prod** | Docker self-host (siap-siap) | Mining customer concern data residency |
| **Modul scope** | Cut dari 14 → 6 (Inventori, Pengadaan, Keuangan, SDM, Armada, Dasbor) | Fokus + kurangi confusion saat demo |
| **Brand** | integra.id | Domain sudah ada, belum di-connect (Day 14) |
| **Pricing** | Setup Rp 50jt + Rp 30jt/yr ATAU perpetual Rp 150jt | Mining ekosistem budget lebih besar dari garment SME |

## Modul Aktif (KRI Scope)

✅ **Visible di sidebar:**
- **Dasbor** — Executive overview
- **Armada** — Vehicle/equipment master, compliance tracking (STNK/KIR/Asuransi)
- **Inventori** — Spare parts dengan serial number + equipment compatibility
- **Pengadaan** — PR → PO → Approval → GRN → Bill (workflow yang KRI butuh paling)
- **Keuangan** — Full double-entry, AR/AP, reports, fiscal close
- **SDM** — Karyawan, attendance, payroll dengan BPJS + PPh21
- **Pengaturan** — Company profile, user management

❌ **Hidden via feature flag** (re-enable per customer):
- Penjualan & CRM, Manufaktur, POS, Dokumen, Permission Matrix, Document Numbering, Accountant/Manager/Staff Portal, Fabric Rolls

## What's Different vs Generic ERP

### Mining-specific yang sudah dibangun:

1. **Vehicle/Armada master** (`/fleet`) — plat nomor, BPKB, STNK, KIR, asuransi, tipe (LIGHT_VEHICLE / HEAVY_EQUIPMENT / TRUCK / TRAILER), tarif sewa harian + bulanan, engine hours untuk maintenance
2. **Compliance tracking** — STNK/KIR/asuransi expiry highlight merah/amber 30 hari sebelum habis
3. **Customer-owned vehicles** — support service order untuk kendaraan customer eksternal
4. **Product mining fields** — serialNumber, equipmentCompatibility (Komatsu PC200, CAT 320D), equipmentType
5. **Atomic document numbering** — race-safe via `DocumentCounter` table, tidak ada duplikat PR/PO/GRN saat 2 user input bersamaan

### Yang belum dibangun (planned 9-week timeline):

- **Rental Contract** module — recurring invoice bulanan untuk armada disewakan
- **Service Order** module — work order untuk customer eksternal (terima mobil → spare part consume → bill)
- **Vehicle Dealer extension** — beli mobil baru dari ATPM → registrasi BPKB/STNK → sell
- **Approval Queue widget** di dashboard — solve "saling tunggu approval"
- **Onboarding wizard** — 5-step setup untuk customer baru
- **Self-host Docker package** — Caddy + Postgres + auto SSL

## Implementation Plan

Detailed plan in `docs/plans/2026-04-23-integra-mining-launch.md`

**9-week timeline (April 23 → June 26):**

| Week | Fokus | Status |
|------|-------|--------|
| W1 (Apr 23-29) | Cleanup + cut + brand | ✅ Done (Day 1-4) |
| W2 (Apr 30-May 6) | Polish 4 core modul + bug fixing | Pending |
| W3-4 (May 7-20) | Rental Contract module (NEW) | Pending |
| W5-6 (May 21-Jun 3) | Service Order module (NEW) | Pending |
| W7 (Jun 4-10) | Vehicle Dealer extension (NEW) | Pending |
| W8 (Jun 11-17) | Full QA + UI polish | Pending |
| W9 (Jun 18-25) | Demo prep + practice + materials | Pending |
| **Jun 26** | **PRESENTATION** | 🎯 |

## Migration Status

**8 production Supabase migrations applied** (April 23-24):

1. `20260423000000_add_document_counter` — atomic numbering (no race)
2. `20260423120000_add_pr_item_fk_to_po_item` — PR→PO traceability + dedupe
3. `20260423130000_add_supplier_npwp` — NPWP for e-Faktur compliance
4. `20260423140000_stock_level_partial_unique` — locationId race fix
5. `20260423150000_fabric_roll_grn_link` — fabric traceability + inspection gate
6. `20260423160000_stock_level_decimal` — Int → Decimal(18,4) untuk fabric/kg precision
7. `20260424000000_product_mining_fields` — serialNumber + equipmentCompatibility + equipmentType
8. `20260424100000_add_vehicle_model` — Vehicle/Armada master + enums

## Audit Heritage (94/100 findings closed)

Sebelum pivot, ERP ini sudah lewat 3 ultrareview audit (Finance, Inventory, Procurement) dan close 94 dari 100 findings dalam 25 commits:

- **Finance: 100%** — all critical accounting bugs fixed (atomic GL posting, PPN separation, accrual basis, etc)
- **Inventory: 91%** — stock invariants, GL connectivity, atomic numbering, NPWP
- **Procurement: 93%** — SoD guards, atomic approvals, PR→PO traceability, landed cost GL

Sisanya (6 findings) cosmetic atau substantial refactor yang di-defer.

## Development

```bash
# Install + setup
npm install
cp .env.example .env  # set Supabase URLs + keys
npx prisma migrate dev
npm run db:seed       # optional seed data

# Run dev server
npm run dev           # localhost:3000

# Run tests
npx vitest

# Type check
npx tsc --noEmit

# Deploy migration ke production
npx prisma migrate deploy
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 + React 19 + TypeScript (strict) |
| Routing | App Router + Turbopack |
| Database | PostgreSQL via Supabase (managed) |
| ORM | Prisma 6 |
| Auth | Supabase Auth (cookie-based SSR) |
| UI | shadcn/ui + Radix + Tailwind v4 |
| State | TanStack Query (no manual loading state) |
| Forms | React Hook Form + Zod |
| Tables | TanStack Table |
| Icons | Tabler Icons + Lucide |
| Notifications | Sonner |
| Hosting | Vercel (Fluid Compute, Singapore region) |
| Monitoring | Vercel Analytics |

## Project Structure

```
app/
├── dashboard/        # Executive overview
├── fleet/            # 🆕 Armada/vehicle master (mining edition)
├── inventory/        # Products, stock, warehouses, GRN, fabric (hidden)
├── procurement/      # PR, PO, vendors, receiving
├── finance/          # Invoices, bills, payments, journals, reports
├── hcm/              # Employees, attendance, payroll
├── settings/         # Company profile, users
├── sales/            # ❌ Hidden via feature flag
├── manufacturing/    # ❌ Hidden via feature flag
├── api/              # 32+ REST endpoints
└── ...

lib/
├── actions/          # Server actions (finance-*, procurement, vehicles, etc.)
├── sidebar-nav-data.ts          # Sidebar config
├── sidebar-feature-flags.ts     # 🆕 Module visibility per edition
├── document-numbering.ts        # 🆕 Atomic doc number generator
├── gl-accounts.ts               # System chart of accounts
├── tax-rates.ts                 # PPN, PPh constants
└── ...

prisma/
├── schema.prisma                # 58 models (added Vehicle)
├── migrations/                  # 50+ migrations
└── seed*.ts                     # Seeders
```

## Contributing

Single-developer project until product-market fit. Contributions welcomed post-launch.

## License

Proprietary — © 2026 integra.id
