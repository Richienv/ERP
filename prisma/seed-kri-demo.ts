// prisma/seed-kri-demo.ts
//
// Comprehensive demo seed for KRI mining customer presentation (June 26).
// Idempotent — uses upsert / findFirst-then-create.
//
// Run:
//   npx tsx prisma/seed-kri-demo.ts
//   npm run seed:kri-demo
//
// IMPORTANT: assumes seed-gl.ts has been run (or system accounts exist).
// We call ensureSystemAccounts() defensively to guarantee SYS_ACCOUNTS exist.

import { PrismaClient, Prisma } from '@prisma/client'
import { SYS_ACCOUNTS } from '../lib/gl-accounts'

const prisma = new PrismaClient()

// ============================================================
// Helpers
// ============================================================

const D = (n: number | string) => new Prisma.Decimal(n)

function daysFromNow(days: number): Date {
    return new Date(Date.now() + days * 86_400_000)
}

function startOfMonth(): Date {
    const d = new Date()
    d.setDate(1)
    d.setHours(0, 0, 0, 0)
    return d
}

function ymd(d: Date): Date {
    const x = new Date(d)
    x.setHours(0, 0, 0, 0)
    return x
}

// Ensure all SYS_ACCOUNTS exist before posting journals (mirrors lib/gl-accounts-server.ts)
const SYSTEM_ACCOUNT_DEFS: { code: string; name: string; type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE' }[] = [
    { code: SYS_ACCOUNTS.CASH, name: 'Kas & Setara Kas', type: 'ASSET' },
    { code: SYS_ACCOUNTS.PETTY_CASH, name: 'Kas Kecil (Petty Cash)', type: 'ASSET' },
    { code: SYS_ACCOUNTS.BANK_BCA, name: 'Bank BCA', type: 'ASSET' },
    { code: SYS_ACCOUNTS.BANK_MANDIRI, name: 'Bank Mandiri', type: 'ASSET' },
    { code: SYS_ACCOUNTS.AR, name: 'Piutang Usaha', type: 'ASSET' },
    { code: SYS_ACCOUNTS.INVENTORY_ASSET, name: 'Persediaan Barang Jadi', type: 'ASSET' },
    { code: SYS_ACCOUNTS.PPN_MASUKAN, name: 'PPN Masukan (Input VAT)', type: 'ASSET' },
    { code: SYS_ACCOUNTS.AP, name: 'Utang Usaha (AP)', type: 'LIABILITY' },
    { code: SYS_ACCOUNTS.PPN_KELUARAN, name: 'Utang Pajak (PPN/PPh)', type: 'LIABILITY' },
    { code: SYS_ACCOUNTS.REVENUE, name: 'Pendapatan Penjualan', type: 'REVENUE' },
    { code: SYS_ACCOUNTS.SERVICE_REVENUE, name: 'Pendapatan Jasa', type: 'REVENUE' },
    { code: SYS_ACCOUNTS.COGS, name: 'Beban Pokok Penjualan (HPP)', type: 'EXPENSE' },
    { code: SYS_ACCOUNTS.EXPENSE_DEFAULT, name: 'Beban Lain-lain', type: 'EXPENSE' },
]

async function ensureSystemAccounts() {
    for (const def of SYSTEM_ACCOUNT_DEFS) {
        await prisma.gLAccount.upsert({
            where: { code: def.code },
            create: { code: def.code, name: def.name, type: def.type, balance: 0, isSystem: true },
            update: {},
        })
    }
}

// Mirror of postJournalEntryInner from lib/actions/finance-gl.ts (no auth wrapper).
async function postJournal(data: {
    description: string
    date: Date
    reference: string
    invoiceId?: string
    paymentId?: string
    lines: { accountCode: string; debit: number; credit: number; description?: string }[]
}) {
    const totalDebit = data.lines.reduce((s, l) => s + l.debit, 0)
    const totalCredit = data.lines.reduce((s, l) => s + l.credit, 0)
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
        throw new Error(
            `Unbalanced journal "${data.reference}": debit ${totalDebit} != credit ${totalCredit}`
        )
    }

    const codes = Array.from(new Set(data.lines.map(l => l.accountCode)))
    const accounts = await prisma.gLAccount.findMany({ where: { code: { in: codes } } })
    const accountMap = new Map(accounts.map(a => [a.code, a]))

    // Skip silently if reference already posted (idempotent re-runs)
    const existing = await prisma.journalEntry.findFirst({ where: { reference: data.reference } })
    if (existing) return { success: true, id: existing.id, skipped: true }

    const entry = await prisma.journalEntry.create({
        data: {
            date: data.date,
            description: data.description,
            reference: data.reference,
            status: 'POSTED',
            ...(data.invoiceId ? { invoice: { connect: { id: data.invoiceId } } } : {}),
            ...(data.paymentId ? { payment: { connect: { id: data.paymentId } } } : {}),
            lines: {
                create: data.lines.map(line => {
                    const acc = accountMap.get(line.accountCode)
                    if (!acc) throw new Error(`Account code not found: ${line.accountCode}`)
                    return {
                        account: { connect: { id: acc.id } },
                        debit: line.debit,
                        credit: line.credit,
                        description: line.description || data.description,
                    }
                }),
            },
        },
    })

    // Update GL balances
    for (const line of data.lines) {
        const acc = accountMap.get(line.accountCode)!
        const balanceChange = ['ASSET', 'EXPENSE'].includes(acc.type)
            ? line.debit - line.credit
            : line.credit - line.debit
        await prisma.gLAccount.update({
            where: { id: acc.id },
            data: { balance: { increment: balanceChange } },
        })
    }

    return { success: true, id: entry.id, skipped: false }
}

// ============================================================
// MASTER DATA — Suppliers
// ============================================================

const SUPPLIERS = [
    {
        code: 'SUP-KRI-001', name: 'PT. United Tractors',
        contactName: 'Pak Hartono', email: 'sales@unitedtractors.co.id', phone: '021-2457-9999',
        address: 'Jl. Raya Bekasi Km 22, Cakung, Jakarta Timur',
        bankName: 'Bank Mandiri', bankAccountNumber: '1234567890', bankAccountName: 'PT United Tractors',
        npwp: '01.234.567.8-091.000', paymentTerm: 'NET_30' as const, rating: 5, onTimeRate: 95,
    },
    {
        code: 'SUP-KRI-002', name: 'PT. Trakindo Utama',
        contactName: 'Bu Sari', email: 'procurement@trakindo.co.id', phone: '021-5050-9999',
        address: 'Cilandak Commercial Estate, Jakarta Selatan',
        bankName: 'Bank BCA', bankAccountNumber: '0987654321', bankAccountName: 'PT Trakindo Utama',
        npwp: '01.345.678.9-091.000', paymentTerm: 'NET_30' as const, rating: 5, onTimeRate: 92,
    },
    {
        code: 'SUP-KRI-003', name: 'PT. Pertamina Lubricants',
        contactName: 'Pak Anto', email: 'b2b@pertaminalubricants.com', phone: '021-3144-7999',
        address: 'Wisma Tugu, Jl. HR Rasuna Said, Jakarta Selatan',
        bankName: 'Bank Mandiri', bankAccountNumber: '1357924680', bankAccountName: 'PT Pertamina Lubricants',
        npwp: '01.456.789.0-091.000', paymentTerm: 'NET_30' as const, rating: 5, onTimeRate: 98,
    },
    {
        code: 'SUP-KRI-004', name: 'PT. Bridgestone Tire Indonesia',
        contactName: 'Pak Yudi', email: 'industrial@bridgestone.co.id', phone: '021-8990-9999',
        address: 'Jl. Thamrin Kav 22, Bekasi',
        bankName: 'Bank BCA', bankAccountNumber: '2468013579', bankAccountName: 'PT Bridgestone Indonesia',
        npwp: '01.567.890.1-091.000', paymentTerm: 'NET_45' as const, rating: 4, onTimeRate: 88,
    },
    {
        code: 'SUP-KRI-005', name: 'PT. Sumber Gas Sejahtera',
        contactName: 'Bu Rina', email: 'order@sumbergas.co.id', phone: '0541-744-555',
        address: 'Jl. Bhayangkara, Samarinda, Kalimantan Timur',
        bankName: 'Bank BCA', bankAccountNumber: '3690258147', bankAccountName: 'PT Sumber Gas Sejahtera',
        npwp: '01.678.901.2-722.000', paymentTerm: 'COD' as const, rating: 4, onTimeRate: 90,
    },
    {
        code: 'SUP-KRI-006', name: 'PT. Astra Heavy Equipment',
        contactName: 'Pak Bambang', email: 'sales@astraheavy.co.id', phone: '021-6520-9999',
        address: 'Sunter II, Jakarta Utara',
        bankName: 'Bank Mandiri', bankAccountNumber: '7531902468', bankAccountName: 'PT Astra Heavy Equipment',
        npwp: '01.789.012.3-091.000', paymentTerm: 'NET_60' as const, rating: 5, onTimeRate: 91,
    },
    {
        code: 'SUP-KRI-007', name: 'PT. Indomobil Multi Trada',
        contactName: 'Pak Dedi', email: 'sales@indomobilmt.com', phone: '021-6580-1111',
        address: 'Jl. MT Haryono Kav 8, Jakarta',
        bankName: 'Bank BCA', bankAccountNumber: '8642097531', bankAccountName: 'PT Indomobil Multi Trada',
        npwp: '01.890.123.4-091.000', paymentTerm: 'NET_30' as const, rating: 4, onTimeRate: 85,
    },
]

// ============================================================
// MASTER DATA — Categories
// ============================================================

const CATEGORIES = [
    { code: 'CAT-HE', name: 'Heavy Equipment Parts', description: 'Spare parts alat berat (bucket, hydraulic, undercarriage)' },
    { code: 'CAT-LUB', name: 'Lubricant & Consumables', description: 'Oli, grease, filter, hydraulic fluid' },
    { code: 'CAT-TIRE', name: 'OTR Tires', description: 'Off-the-road tires untuk dump truck dan loader' },
    { code: 'CAT-FUEL', name: 'BBM & Fuel', description: 'Solar industri, BBM untuk armada' },
    { code: 'CAT-SVC', name: 'Service Parts', description: 'Alternator, starter, radiator, electrical' },
]

// ============================================================
// MASTER DATA — Products
// ============================================================

type ProductSeed = {
    code: string; name: string; unit: string; categoryCode: string;
    costPrice: number; sellingPrice: number; minStock: number; reorderLevel: number;
    equipmentType?: string; equipmentCompatibility?: string;
}

const PRODUCTS: ProductSeed[] = [
    // Heavy Equipment Parts
    { code: 'PRD-HE-001', name: 'Bucket Teeth PC200-8', unit: 'pcs', categoryCode: 'CAT-HE', costPrice: 1_250_000, sellingPrice: 1_650_000, minStock: 20, reorderLevel: 30, equipmentType: 'spare_part', equipmentCompatibility: 'Komatsu PC200-8, PC200-10' },
    { code: 'PRD-HE-002', name: 'Hydraulic Pump PC300', unit: 'unit', categoryCode: 'CAT-HE', costPrice: 45_000_000, sellingPrice: 58_000_000, minStock: 2, reorderLevel: 3, equipmentType: 'spare_part', equipmentCompatibility: 'Komatsu PC300-8' },
    { code: 'PRD-HE-003', name: 'Undercarriage Track Link CAT 320D', unit: 'set', categoryCode: 'CAT-HE', costPrice: 28_500_000, sellingPrice: 36_000_000, minStock: 1, reorderLevel: 2, equipmentType: 'spare_part', equipmentCompatibility: 'CAT 320D, CAT 320DL' },
    { code: 'PRD-HE-004', name: 'Cutting Edge Bulldozer D85', unit: 'pcs', categoryCode: 'CAT-HE', costPrice: 8_750_000, sellingPrice: 11_500_000, minStock: 4, reorderLevel: 6, equipmentType: 'spare_part', equipmentCompatibility: 'Komatsu D85ESS, D85PX' },
    { code: 'PRD-HE-005', name: 'Final Drive Excavator PC400', unit: 'unit', categoryCode: 'CAT-HE', costPrice: 65_000_000, sellingPrice: 82_000_000, minStock: 1, reorderLevel: 2, equipmentType: 'spare_part', equipmentCompatibility: 'Komatsu PC400-7, PC400-8' },

    // Lubricants & Consumables
    { code: 'PRD-LUB-001', name: 'Engine Oil Meditran SX 15W-40 Drum 209L', unit: 'drum', categoryCode: 'CAT-LUB', costPrice: 6_500_000, sellingPrice: 7_950_000, minStock: 8, reorderLevel: 12, equipmentType: 'consumable' },
    { code: 'PRD-LUB-002', name: 'Hydraulic Fluid Turalik 52 Drum 209L', unit: 'drum', categoryCode: 'CAT-LUB', costPrice: 7_200_000, sellingPrice: 8_750_000, minStock: 6, reorderLevel: 10, equipmentType: 'consumable' },
    { code: 'PRD-LUB-003', name: 'Grease MP3 Pail 16kg', unit: 'pail', categoryCode: 'CAT-LUB', costPrice: 875_000, sellingPrice: 1_125_000, minStock: 15, reorderLevel: 25, equipmentType: 'consumable' },
    { code: 'PRD-LUB-004', name: 'Fuel Filter Komatsu 600-311-3750', unit: 'pcs', categoryCode: 'CAT-LUB', costPrice: 285_000, sellingPrice: 385_000, minStock: 30, reorderLevel: 50, equipmentType: 'consumable', equipmentCompatibility: 'Komatsu PC200, PC300' },
    { code: 'PRD-LUB-005', name: 'Air Filter CAT 110-6326', unit: 'pcs', categoryCode: 'CAT-LUB', costPrice: 425_000, sellingPrice: 575_000, minStock: 25, reorderLevel: 40, equipmentType: 'consumable', equipmentCompatibility: 'CAT 320D, 330D' },
    { code: 'PRD-LUB-006', name: 'Coolant Diesel Long-life 20L', unit: 'jerigen', categoryCode: 'CAT-LUB', costPrice: 850_000, sellingPrice: 1_125_000, minStock: 12, reorderLevel: 20, equipmentType: 'consumable' },

    // Tires
    { code: 'PRD-TIRE-001', name: 'Bridgestone OTR 23.5R25 VJT L5', unit: 'pcs', categoryCode: 'CAT-TIRE', costPrice: 28_500_000, sellingPrice: 36_500_000, minStock: 4, reorderLevel: 8, equipmentType: 'spare_part', equipmentCompatibility: 'Wheel Loader 988, 980' },
    { code: 'PRD-TIRE-002', name: 'Bridgestone OTR 18.00R33 VRDP E4', unit: 'pcs', categoryCode: 'CAT-TIRE', costPrice: 42_000_000, sellingPrice: 53_500_000, minStock: 4, reorderLevel: 6, equipmentType: 'spare_part', equipmentCompatibility: 'Dump Truck HD465, HD605' },
    { code: 'PRD-TIRE-003', name: 'Bridgestone Truck 11R22.5 M748', unit: 'pcs', categoryCode: 'CAT-TIRE', costPrice: 4_850_000, sellingPrice: 6_200_000, minStock: 12, reorderLevel: 20, equipmentType: 'spare_part', equipmentCompatibility: 'Dump Truck Hino, Mitsubishi Fuso' },

    // Fuel
    { code: 'PRD-FUEL-001', name: 'Solar Industri (BBM)', unit: 'liter', categoryCode: 'CAT-FUEL', costPrice: 14_500, sellingPrice: 16_800, minStock: 5_000, reorderLevel: 10_000, equipmentType: 'consumable' },
    { code: 'PRD-FUEL-002', name: 'Pelumas Gear Oil SAE 90 Drum', unit: 'drum', categoryCode: 'CAT-FUEL', costPrice: 5_750_000, sellingPrice: 7_450_000, minStock: 6, reorderLevel: 10, equipmentType: 'consumable' },

    // Service Parts
    { code: 'PRD-SVC-001', name: 'Alternator 24V 60A Komatsu', unit: 'pcs', categoryCode: 'CAT-SVC', costPrice: 4_250_000, sellingPrice: 5_750_000, minStock: 6, reorderLevel: 10, equipmentType: 'spare_part', equipmentCompatibility: 'Komatsu PC200, PC300' },
    { code: 'PRD-SVC-002', name: 'Starter Motor 24V 11kW', unit: 'pcs', categoryCode: 'CAT-SVC', costPrice: 6_850_000, sellingPrice: 8_950_000, minStock: 4, reorderLevel: 8, equipmentType: 'spare_part', equipmentCompatibility: 'Komatsu, CAT, Hitachi' },
    { code: 'PRD-SVC-003', name: 'Radiator Assy CAT 320D', unit: 'unit', categoryCode: 'CAT-SVC', costPrice: 18_500_000, sellingPrice: 24_000_000, minStock: 2, reorderLevel: 4, equipmentType: 'spare_part', equipmentCompatibility: 'CAT 320D, 320DL' },
    { code: 'PRD-SVC-004', name: 'Battery N200 24V 200Ah', unit: 'pcs', categoryCode: 'CAT-SVC', costPrice: 3_450_000, sellingPrice: 4_650_000, minStock: 8, reorderLevel: 14, equipmentType: 'consumable' },
    { code: 'PRD-SVC-005', name: 'Belt V-Belt B-89 (set)', unit: 'set', categoryCode: 'CAT-SVC', costPrice: 425_000, sellingPrice: 585_000, minStock: 15, reorderLevel: 25, equipmentType: 'consumable' },
]

// ============================================================
// MASTER DATA — Warehouses
// ============================================================

const WAREHOUSES = [
    { code: 'WH-KRI-SMD', name: 'Gudang Pusat Samarinda', address: 'Jl. Cipto Mangunkusumo No.45', city: 'Samarinda', province: 'Kalimantan Timur' },
    { code: 'WH-KRI-BPN', name: 'Gudang Balikpapan', address: 'Jl. Soekarno-Hatta Km 5,5', city: 'Balikpapan', province: 'Kalimantan Timur' },
    { code: 'WH-KRI-TRK', name: 'Gudang Tarakan', address: 'Jl. Yos Sudarso No.12', city: 'Tarakan', province: 'Kalimantan Utara' },
]

// ============================================================
// MASTER DATA — Customers
// ============================================================

const CUSTOMERS = [
    {
        code: 'CUST-KRI-001', name: 'PT. Adaro Indonesia',
        legalName: 'PT. Adaro Indonesia Tbk', customerType: 'COMPANY' as const,
        npwp: '01.111.222.3-722.000', taxStatus: 'PKP' as const,
        email: 'procurement@adaro.com', phone: '0526-22-1234',
        creditLimit: 5_000_000_000, creditTerm: 30, paymentTerm: 'NET_30' as const,
    },
    {
        code: 'CUST-KRI-002', name: 'PT. Bukit Asam',
        legalName: 'PT. Bukit Asam Tbk', customerType: 'COMPANY' as const,
        npwp: '01.222.333.4-052.000', taxStatus: 'PKP' as const,
        email: 'logistics@ptba.co.id', phone: '0734-451-411',
        creditLimit: 3_500_000_000, creditTerm: 45, paymentTerm: 'NET_45' as const,
    },
    {
        code: 'CUST-KRI-003', name: 'PT. Berau Coal',
        legalName: 'PT. Berau Coal Energy', customerType: 'COMPANY' as const,
        npwp: '01.333.444.5-722.000', taxStatus: 'PKP' as const,
        email: 'spare@beraucoal.co.id', phone: '0554-22-7000',
        creditLimit: 2_500_000_000, creditTerm: 30, paymentTerm: 'NET_30' as const,
    },
    {
        code: 'CUST-KRI-004', name: 'Dinas ESDM Kalimantan Timur',
        legalName: 'Dinas Energi & Sumber Daya Mineral Kaltim', customerType: 'GOVERNMENT' as const,
        npwp: '00.444.555.6-722.000', taxStatus: 'NON_PKP' as const,
        email: 'tender@esdmkaltim.go.id', phone: '0541-741-414',
        creditLimit: 1_500_000_000, creditTerm: 60, paymentTerm: 'NET_60' as const,
    },
    {
        code: 'CUST-KRI-005', name: 'PT. Bumi Resources Mineral',
        legalName: 'PT. Bumi Resources Minerals Tbk', customerType: 'COMPANY' as const,
        npwp: '01.555.666.7-091.000', taxStatus: 'PKP' as const,
        email: 'purchasing@bumiresources.com', phone: '021-5794-7333',
        creditLimit: 2_000_000_000, creditTerm: 30, paymentTerm: 'NET_30' as const,
    },
]

// ============================================================
// MASTER DATA — Employees
// ============================================================

const EMPLOYEES = [
    { employeeId: 'KRI-001', firstName: 'Budi', lastName: 'Santoso', department: 'Operasional', position: 'Operations Manager', baseSalary: 18_500_000, email: 'budi.santoso@kri.co.id' },
    { employeeId: 'KRI-002', firstName: 'Siti', lastName: 'Wijaya', department: 'Keuangan', position: 'Finance Manager', baseSalary: 17_500_000, email: 'siti.wijaya@kri.co.id' },
    { employeeId: 'KRI-003', firstName: 'Agus', lastName: 'Kurniawan', department: 'Workshop', position: 'Workshop Supervisor', baseSalary: 12_500_000, email: 'agus.k@kri.co.id' },
    { employeeId: 'KRI-004', firstName: 'Dewi', lastName: 'Putri', department: 'Sales', position: 'Sales Manager', baseSalary: 16_000_000, email: 'dewi.putri@kri.co.id' },
    { employeeId: 'KRI-005', firstName: 'Rudi', lastName: 'Hidayat', department: 'Workshop', position: 'Senior Mechanic', baseSalary: 9_500_000, email: 'rudi.h@kri.co.id' },
    { employeeId: 'KRI-006', firstName: 'Lina', lastName: 'Sari', department: 'Sales', position: 'Sales Executive', baseSalary: 8_500_000, email: 'lina.s@kri.co.id' },
    { employeeId: 'KRI-007', firstName: 'Eko', lastName: 'Pratama', department: 'Operasional', position: 'Logistik Coordinator', baseSalary: 9_000_000, email: 'eko.p@kri.co.id' },
    { employeeId: 'KRI-008', firstName: 'Rina', lastName: 'Wati', department: 'HSE', position: 'HSE Officer', baseSalary: 11_500_000, email: 'rina.w@kri.co.id' },
    { employeeId: 'KRI-009', firstName: 'Andi', lastName: 'Saputra', department: 'Operasional', position: 'Inventory Staff', baseSalary: 7_500_000, email: 'andi.s@kri.co.id' },
    { employeeId: 'KRI-010', firstName: 'Maya', lastName: 'Anggraini', department: 'Keuangan', position: 'Accounting Staff', baseSalary: 8_500_000, email: 'maya.a@kri.co.id' },
    { employeeId: 'KRI-011', firstName: 'Hendra', lastName: 'Wibowo', department: 'Workshop', position: 'Mechanic', baseSalary: 7_000_000, email: 'hendra.w@kri.co.id' },
    { employeeId: 'KRI-012', firstName: 'Yuni', lastName: 'Lestari', department: 'Sales', position: 'Sales Admin', baseSalary: 6_500_000, email: 'yuni.l@kri.co.id' },
]

// ============================================================
// MAIN
// ============================================================

async function main() {
    console.log('🌱 [KRI Demo Seed] Starting...')

    // ---------- 0. System GL Accounts ----------
    console.log('  [0/14] Ensuring system GL accounts...')
    await ensureSystemAccounts()

    // ---------- 1. Categories ----------
    console.log('  [1/14] Seeding categories...')
    const categoryMap = new Map<string, string>()
    for (const c of CATEGORIES) {
        const cat = await prisma.category.upsert({
            where: { code: c.code },
            update: { name: c.name, description: c.description },
            create: c,
        })
        categoryMap.set(c.code, cat.id)
    }

    // ---------- 2. Suppliers ----------
    console.log('  [2/14] Seeding suppliers...')
    const supplierMap = new Map<string, string>()
    for (const s of SUPPLIERS) {
        const sup = await prisma.supplier.upsert({
            where: { code: s.code },
            update: {
                name: s.name, contactName: s.contactName, email: s.email, phone: s.phone,
                address: s.address, bankName: s.bankName, bankAccountNumber: s.bankAccountNumber,
                bankAccountName: s.bankAccountName, npwp: s.npwp, paymentTerm: s.paymentTerm,
                rating: s.rating, onTimeRate: s.onTimeRate, isActive: true,
            },
            create: { ...s, isActive: true },
        })
        supplierMap.set(s.code, sup.id)
    }

    // ---------- 3. Warehouses ----------
    console.log('  [3/14] Seeding warehouses...')
    const warehouseMap = new Map<string, string>()
    for (const w of WAREHOUSES) {
        const wh = await prisma.warehouse.upsert({
            where: { code: w.code },
            update: { name: w.name, address: w.address, city: w.city, province: w.province, isActive: true },
            create: { ...w, isActive: true },
        })
        warehouseMap.set(w.code, wh.id)
    }

    // ---------- 4. Products ----------
    console.log('  [4/14] Seeding products...')
    const productMap = new Map<string, { id: string; costPrice: number; sellingPrice: number }>()
    for (const p of PRODUCTS) {
        const prd = await prisma.product.upsert({
            where: { code: p.code },
            update: {
                name: p.name, unit: p.unit, costPrice: D(p.costPrice), sellingPrice: D(p.sellingPrice),
                minStock: p.minStock, reorderLevel: p.reorderLevel,
                categoryId: categoryMap.get(p.categoryCode),
                equipmentType: p.equipmentType, equipmentCompatibility: p.equipmentCompatibility,
                isActive: true,
            },
            create: {
                code: p.code, name: p.name, unit: p.unit, productType: 'TRADING',
                costPrice: D(p.costPrice), sellingPrice: D(p.sellingPrice),
                minStock: p.minStock, reorderLevel: p.reorderLevel,
                categoryId: categoryMap.get(p.categoryCode),
                equipmentType: p.equipmentType, equipmentCompatibility: p.equipmentCompatibility,
                isActive: true,
            },
        })
        productMap.set(p.code, { id: prd.id, costPrice: p.costPrice, sellingPrice: p.sellingPrice })
    }

    // ---------- 5. StockLevel — mixed health (critical / low / healthy) ----------
    console.log('  [5/14] Seeding stock levels...')
    const stockSeeds: Array<{ productCode: string; warehouseCode: string; qty: number }> = [
        // Critical (qty < minStock by big margin)
        { productCode: 'PRD-HE-001', warehouseCode: 'WH-KRI-SMD', qty: 4 },
        { productCode: 'PRD-LUB-004', warehouseCode: 'WH-KRI-SMD', qty: 5 },
        { productCode: 'PRD-TIRE-002', warehouseCode: 'WH-KRI-BPN', qty: 0 },
        { productCode: 'PRD-FUEL-001', warehouseCode: 'WH-KRI-BPN', qty: 1_200 },
        // Low (qty between min and reorder)
        { productCode: 'PRD-HE-002', warehouseCode: 'WH-KRI-SMD', qty: 2 },
        { productCode: 'PRD-LUB-001', warehouseCode: 'WH-KRI-SMD', qty: 9 },
        { productCode: 'PRD-LUB-005', warehouseCode: 'WH-KRI-BPN', qty: 28 },
        { productCode: 'PRD-SVC-001', warehouseCode: 'WH-KRI-SMD', qty: 7 },
        // Healthy
        { productCode: 'PRD-HE-003', warehouseCode: 'WH-KRI-SMD', qty: 5 },
        { productCode: 'PRD-HE-004', warehouseCode: 'WH-KRI-BPN', qty: 12 },
        { productCode: 'PRD-HE-005', warehouseCode: 'WH-KRI-SMD', qty: 3 },
        { productCode: 'PRD-LUB-002', warehouseCode: 'WH-KRI-SMD', qty: 18 },
        { productCode: 'PRD-LUB-003', warehouseCode: 'WH-KRI-SMD', qty: 35 },
        { productCode: 'PRD-LUB-006', warehouseCode: 'WH-KRI-BPN', qty: 25 },
        { productCode: 'PRD-TIRE-001', warehouseCode: 'WH-KRI-SMD', qty: 12 },
        { productCode: 'PRD-TIRE-003', warehouseCode: 'WH-KRI-BPN', qty: 24 },
        { productCode: 'PRD-FUEL-002', warehouseCode: 'WH-KRI-SMD', qty: 14 },
        { productCode: 'PRD-SVC-002', warehouseCode: 'WH-KRI-BPN', qty: 9 },
        { productCode: 'PRD-SVC-003', warehouseCode: 'WH-KRI-SMD', qty: 4 },
        { productCode: 'PRD-SVC-004', warehouseCode: 'WH-KRI-BPN', qty: 16 },
        { productCode: 'PRD-SVC-005', warehouseCode: 'WH-KRI-TRK', qty: 28 },
        // Tarakan branch additional
        { productCode: 'PRD-LUB-001', warehouseCode: 'WH-KRI-TRK', qty: 6 },
        { productCode: 'PRD-LUB-003', warehouseCode: 'WH-KRI-TRK', qty: 18 },
        { productCode: 'PRD-FUEL-001', warehouseCode: 'WH-KRI-TRK', qty: 8_500 },
    ]

    let stockLevelCount = 0
    for (const s of stockSeeds) {
        const prd = productMap.get(s.productCode)
        const wh = warehouseMap.get(s.warehouseCode)
        if (!prd || !wh) continue
        // Use raw query for unique constraint with NULL locationId
        const existing = await prisma.stockLevel.findFirst({
            where: { productId: prd.id, warehouseId: wh, locationId: null },
        })
        if (existing) {
            await prisma.stockLevel.update({
                where: { id: existing.id },
                data: { quantity: D(s.qty), availableQty: D(s.qty), reservedQty: D(0) },
            })
        } else {
            await prisma.stockLevel.create({
                data: {
                    productId: prd.id, warehouseId: wh,
                    quantity: D(s.qty), availableQty: D(s.qty), reservedQty: D(0),
                },
            })
        }
        stockLevelCount++
    }

    // ---------- 6. Employees ----------
    console.log('  [6/14] Seeding employees...')
    const employeeMap = new Map<string, string>()
    for (const e of EMPLOYEES) {
        const emp = await prisma.employee.upsert({
            where: { employeeId: e.employeeId },
            update: {
                firstName: e.firstName, lastName: e.lastName, department: e.department,
                position: e.position, baseSalary: D(e.baseSalary), email: e.email, status: 'ACTIVE',
            },
            create: {
                employeeId: e.employeeId, firstName: e.firstName, lastName: e.lastName,
                department: e.department, position: e.position, baseSalary: D(e.baseSalary),
                email: e.email, joinDate: new Date('2023-01-15'), status: 'ACTIVE',
            },
        })
        employeeMap.set(e.employeeId, emp.id)
    }

    // ---------- 7. Today's Attendance ----------
    console.log('  [7/14] Seeding today\'s attendance...')
    const today = ymd(new Date())
    let attCount = 0
    for (const [idx, e] of EMPLOYEES.entries()) {
        const empId = employeeMap.get(e.employeeId)!
        const isLate = idx >= 9 // Last 3 are late
        const checkInTime = new Date(today)
        checkInTime.setHours(7, isLate ? 45 : Math.floor(Math.random() * 30), 0, 0)
        await prisma.attendance.upsert({
            where: { employeeId_date: { employeeId: empId, date: today } },
            update: { checkIn: checkInTime, status: 'PRESENT', isLate },
            create: { employeeId: empId, date: today, checkIn: checkInTime, status: 'PRESENT', isLate },
        })
        attCount++
    }

    // ---------- 8. Customers ----------
    console.log('  [8/14] Seeding customers...')
    const customerMap = new Map<string, string>()
    for (const c of CUSTOMERS) {
        const cust = await prisma.customer.upsert({
            where: { code: c.code },
            update: {
                name: c.name, legalName: c.legalName, customerType: c.customerType,
                npwp: c.npwp, taxStatus: c.taxStatus, email: c.email, phone: c.phone,
                creditLimit: D(c.creditLimit), creditTerm: c.creditTerm,
                paymentTerm: c.paymentTerm, isActive: true,
            },
            create: {
                code: c.code, name: c.name, legalName: c.legalName, customerType: c.customerType,
                npwp: c.npwp, taxStatus: c.taxStatus, email: c.email, phone: c.phone,
                creditLimit: D(c.creditLimit), creditTerm: c.creditTerm,
                paymentTerm: c.paymentTerm, isActive: true,
            },
        })
        customerMap.set(c.code, cust.id)
    }

    // ---------- 9. Purchase Requests (PR) ----------
    console.log('  [9/14] Seeding purchase requests...')
    const requesterId = employeeMap.get('KRI-009')! // Inventory Staff
    const approverId = employeeMap.get('KRI-001')!  // Operations Manager

    const PR_SEEDS = [
        {
            number: 'PR-KRI-2026-001', status: 'PENDING' as const, priority: 'HIGH', daysAgo: 3,
            notes: 'Spare parts urgent — overhaul PC200 unit #07',
            items: [
                { productCode: 'PRD-HE-001', qty: 40 },
                { productCode: 'PRD-LUB-004', qty: 50 },
            ],
        },
        {
            number: 'PR-KRI-2026-002', status: 'APPROVED' as const, priority: 'NORMAL', daysAgo: 5,
            notes: 'Restocking lubricant gudang Samarinda',
            items: [
                { productCode: 'PRD-LUB-001', qty: 20 },
                { productCode: 'PRD-LUB-002', qty: 12 },
                { productCode: 'PRD-LUB-003', qty: 30 },
            ],
        },
        {
            number: 'PR-KRI-2026-003', status: 'PO_CREATED' as const, priority: 'HIGH', daysAgo: 10,
            notes: 'Tires HD465 — emergency stock zero di BPN',
            items: [
                { productCode: 'PRD-TIRE-002', qty: 6 },
            ],
        },
        {
            number: 'PR-KRI-2026-004', status: 'PENDING' as const, priority: 'NORMAL', daysAgo: 1,
            notes: 'BBM Solar untuk armada bulan depan',
            items: [
                { productCode: 'PRD-FUEL-001', qty: 15_000 },
            ],
        },
        {
            number: 'PR-KRI-2026-005', status: 'APPROVED' as const, priority: 'NORMAL', daysAgo: 7,
            notes: 'Service parts — alternator + starter motor',
            items: [
                { productCode: 'PRD-SVC-001', qty: 8 },
                { productCode: 'PRD-SVC-002', qty: 5 },
            ],
        },
    ]

    for (const pr of PR_SEEDS) {
        const exists = await prisma.purchaseRequest.findUnique({ where: { number: pr.number } })
        if (exists) continue
        await prisma.purchaseRequest.create({
            data: {
                number: pr.number, status: pr.status, priority: pr.priority,
                requesterId, approverId: pr.status !== 'PENDING' ? approverId : null,
                requestDate: daysFromNow(-pr.daysAgo), department: 'Operasional', notes: pr.notes,
                items: {
                    create: pr.items.map(it => {
                        const prd = productMap.get(it.productCode)!
                        return {
                            productId: prd.id,
                            quantity: it.qty,
                            status: pr.status === 'PENDING' ? 'PENDING' : pr.status === 'APPROVED' ? 'APPROVED' : 'PO_CREATED',
                            targetDate: daysFromNow(7),
                        }
                    }),
                },
            },
        })
    }

    // ---------- 10. Purchase Orders (mixed status) ----------
    console.log('  [10/14] Seeding purchase orders...')
    const PO_SEEDS = [
        { number: 'PO-KRI-2026-001', supplierCode: 'SUP-KRI-001', status: 'PO_DRAFT' as const, daysAgo: 1, items: [{ productCode: 'PRD-HE-001', qty: 30 }] },
        { number: 'PO-KRI-2026-002', supplierCode: 'SUP-KRI-002', status: 'PENDING_APPROVAL' as const, daysAgo: 2, items: [{ productCode: 'PRD-HE-005', qty: 1 }] },
        { number: 'PO-KRI-2026-003', supplierCode: 'SUP-KRI-003', status: 'APPROVED' as const, daysAgo: 4, items: [{ productCode: 'PRD-LUB-001', qty: 20 }, { productCode: 'PRD-LUB-002', qty: 12 }] },
        { number: 'PO-KRI-2026-004', supplierCode: 'SUP-KRI-004', status: 'ORDERED' as const, daysAgo: 7, items: [{ productCode: 'PRD-TIRE-002', qty: 6 }] },
        { number: 'PO-KRI-2026-005', supplierCode: 'SUP-KRI-005', status: 'SHIPPED' as const, daysAgo: 10, items: [{ productCode: 'PRD-FUEL-001', qty: 12_000 }] },
        { number: 'PO-KRI-2026-006', supplierCode: 'SUP-KRI-006', status: 'PARTIAL_RECEIVED' as const, daysAgo: 14, items: [{ productCode: 'PRD-HE-002', qty: 2 }] },
        { number: 'PO-KRI-2026-007', supplierCode: 'SUP-KRI-001', status: 'RECEIVED' as const, daysAgo: 18, items: [{ productCode: 'PRD-HE-003', qty: 2 }] },
        { number: 'PO-KRI-2026-008', supplierCode: 'SUP-KRI-002', status: 'COMPLETED' as const, daysAgo: 25, items: [{ productCode: 'PRD-LUB-003', qty: 30 }] },
        { number: 'PO-KRI-2026-009', supplierCode: 'SUP-KRI-007', status: 'COMPLETED' as const, daysAgo: 30, items: [{ productCode: 'PRD-SVC-002', qty: 5 }, { productCode: 'PRD-SVC-001', qty: 8 }] },
        { number: 'PO-KRI-2026-010', supplierCode: 'SUP-KRI-003', status: 'COMPLETED' as const, daysAgo: 40, items: [{ productCode: 'PRD-LUB-004', qty: 60 }] },
        { number: 'PO-KRI-2026-011', supplierCode: 'SUP-KRI-004', status: 'CANCELLED' as const, daysAgo: 12, items: [{ productCode: 'PRD-TIRE-003', qty: 8 }] },
        { number: 'PO-KRI-2026-012', supplierCode: 'SUP-KRI-006', status: 'CANCELLED' as const, daysAgo: 20, items: [{ productCode: 'PRD-HE-004', qty: 4 }] },
    ]

    const purchaseOrderRecords: Array<{ id: string; number: string; supplierId: string; status: string; netAmount: number; subtotal: number; tax: number; daysAgo: number }> = []
    for (const po of PO_SEEDS) {
        const exists = await prisma.purchaseOrder.findUnique({ where: { number: po.number } })
        if (exists) {
            purchaseOrderRecords.push({
                id: exists.id, number: po.number, supplierId: exists.supplierId,
                status: exists.status, netAmount: Number(exists.netAmount), subtotal: Number(exists.totalAmount),
                tax: Number(exists.taxAmount), daysAgo: po.daysAgo,
            })
            continue
        }
        const supplierId = supplierMap.get(po.supplierCode)!
        const lineDetails = po.items.map(it => {
            const prd = productMap.get(it.productCode)!
            const lineTotal = prd.costPrice * it.qty
            return { productId: prd.id, qty: it.qty, unitPrice: prd.costPrice, lineTotal }
        })
        const subtotal = lineDetails.reduce((s, l) => s + l.lineTotal, 0)
        const tax = Math.round(subtotal * 0.11)
        const netAmount = subtotal + tax

        const created = await prisma.purchaseOrder.create({
            data: {
                number: po.number, supplierId, status: po.status,
                orderDate: daysFromNow(-po.daysAgo),
                expectedDate: daysFromNow(-po.daysAgo + 14),
                totalAmount: D(subtotal), taxAmount: D(tax), netAmount: D(netAmount),
                taxMode: 'EXCLUSIVE',
                paymentStatus: po.status === 'COMPLETED' ? 'PAID' : 'UNPAID',
                items: {
                    create: lineDetails.map(l => ({
                        productId: l.productId, quantity: l.qty,
                        receivedQty: po.status === 'PARTIAL_RECEIVED' ? Math.floor(l.qty / 2) :
                            ['RECEIVED', 'COMPLETED'].includes(po.status) ? l.qty : 0,
                        unitPrice: D(l.unitPrice), totalPrice: D(l.lineTotal),
                    })),
                },
            },
        })
        purchaseOrderRecords.push({
            id: created.id, number: po.number, supplierId, status: po.status,
            netAmount, subtotal, tax, daysAgo: po.daysAgo,
        })
    }

    // ---------- 11. Goods Received Notes (GRN) ----------
    console.log('  [11/14] Seeding goods received notes...')
    const grnSourcePOs = purchaseOrderRecords.filter(p =>
        ['PARTIAL_RECEIVED', 'RECEIVED', 'COMPLETED'].includes(p.status)
    )
    let grnCount = 0
    for (const [idx, po] of grnSourcePOs.slice(0, 5).entries()) {
        const grnNumber = `GRN-KRI-2026-${String(idx + 1).padStart(3, '0')}`
        const exists = await prisma.goodsReceivedNote.findUnique({ where: { number: grnNumber } })
        if (exists) { grnCount++; continue }

        const poItems = await prisma.purchaseOrderItem.findMany({ where: { purchaseOrderId: po.id } })
        const grnStatusList: ('DRAFT' | 'INSPECTING' | 'PARTIAL_ACCEPTED' | 'ACCEPTED')[] = ['ACCEPTED', 'PARTIAL_ACCEPTED', 'INSPECTING', 'ACCEPTED', 'ACCEPTED']
        const grnStatus = grnStatusList[idx % grnStatusList.length]

        await prisma.goodsReceivedNote.create({
            data: {
                number: grnNumber, purchaseOrderId: po.id,
                warehouseId: warehouseMap.get('WH-KRI-SMD')!,
                receivedDate: daysFromNow(-po.daysAgo + 3),
                status: grnStatus,
                receivedById: employeeMap.get('KRI-009')!,
                items: {
                    create: poItems.map(pi => {
                        const received = Number(pi.receivedQty || pi.quantity)
                        const accepted = grnStatus === 'PARTIAL_ACCEPTED'
                            ? Math.floor(received * 0.85)
                            : grnStatus === 'INSPECTING' ? 0 : received
                        const rejected = received - accepted
                        return {
                            poItemId: pi.id, productId: pi.productId,
                            quantityOrdered: pi.quantity,
                            quantityReceived: received,
                            quantityAccepted: accepted,
                            quantityRejected: rejected,
                            unitCost: pi.unitPrice,
                        }
                    }),
                },
            },
        })
        grnCount++
    }

    // ---------- 12. Invoices (AR + AP) with Journal Entries ----------
    console.log('  [12/14] Seeding invoices (AR + AP)...')

    // ---- AR (Sales) Invoices ----
    const AR_INVOICES = [
        // PAID
        { number: 'INV-KRI-2026-001', customerCode: 'CUST-KRI-001', subtotal: 850_000_000, daysAgo: 30, status: 'PAID' as const, dueDays: 30 },
        { number: 'INV-KRI-2026-002', customerCode: 'CUST-KRI-003', subtotal: 425_000_000, daysAgo: 25, status: 'PAID' as const, dueDays: 30 },
        // PARTIAL
        { number: 'INV-KRI-2026-003', customerCode: 'CUST-KRI-002', subtotal: 1_250_000_000, daysAgo: 20, status: 'PARTIAL' as const, dueDays: 45, paid: 600_000_000 },
        { number: 'INV-KRI-2026-004', customerCode: 'CUST-KRI-005', subtotal: 750_000_000, daysAgo: 15, status: 'PARTIAL' as const, dueDays: 30, paid: 350_000_000 },
        // ISSUED (this month — boost monthly revenue)
        { number: 'INV-KRI-2026-005', customerCode: 'CUST-KRI-001', subtotal: 1_850_000_000, daysAgo: 8, status: 'ISSUED' as const, dueDays: 30 },
        { number: 'INV-KRI-2026-006', customerCode: 'CUST-KRI-003', subtotal: 925_000_000, daysAgo: 5, status: 'ISSUED' as const, dueDays: 30 },
        { number: 'INV-KRI-2026-007', customerCode: 'CUST-KRI-005', subtotal: 480_000_000, daysAgo: 3, status: 'ISSUED' as const, dueDays: 30 },
        // OVERDUE
        { number: 'INV-KRI-2026-008', customerCode: 'CUST-KRI-004', subtotal: 380_000_000, daysAgo: 75, status: 'OVERDUE' as const, dueDays: 60 },
    ]

    let arCount = 0
    let arPayments = 0
    for (const inv of AR_INVOICES) {
        const exists = await prisma.invoice.findUnique({ where: { number: inv.number } })
        if (exists) { arCount++; continue }

        const customerId = customerMap.get(inv.customerCode)!
        const taxAmount = Math.round(inv.subtotal * 0.11)
        const totalAmount = inv.subtotal + taxAmount
        const balanceDue = inv.status === 'PAID' ? 0
            : inv.status === 'PARTIAL' ? totalAmount - (inv.paid ?? 0)
            : totalAmount

        const issueDate = daysFromNow(-inv.daysAgo)
        const dueDate = new Date(issueDate.getTime() + inv.dueDays * 86_400_000)

        const created = await prisma.invoice.create({
            data: {
                number: inv.number, type: 'INV_OUT', customerId,
                issueDate, dueDate,
                subtotal: D(inv.subtotal), taxAmount: D(taxAmount),
                totalAmount: D(totalAmount), balanceDue: D(balanceDue),
                amountInIDR: D(totalAmount), status: inv.status,
            },
        })
        arCount++

        // Post AR journal: DR AR, CR Revenue + PPN Keluaran
        // (all seeded invoices are non-DRAFT — ISSUED/PARTIAL/PAID/OVERDUE)
        await postJournal({
            description: `Invoice ${inv.number} — Sales to ${inv.customerCode}`,
            date: issueDate, reference: `JE-AR-${inv.number}`,
            invoiceId: created.id,
            lines: [
                { accountCode: SYS_ACCOUNTS.AR, debit: totalAmount, credit: 0, description: `Piutang ${inv.customerCode}` },
                { accountCode: SYS_ACCOUNTS.REVENUE, debit: 0, credit: inv.subtotal, description: 'Pendapatan penjualan' },
                { accountCode: SYS_ACCOUNTS.PPN_KELUARAN, debit: 0, credit: taxAmount, description: 'PPN Keluaran 11%' },
            ],
        })

        // Post payment if PAID or PARTIAL
        if (inv.status === 'PAID' || inv.status === 'PARTIAL') {
            const paidAmount = inv.status === 'PAID' ? totalAmount : (inv.paid ?? 0)
            const payDate = new Date(issueDate.getTime() + Math.min(inv.dueDays - 5, 25) * 86_400_000)
            const payment = await prisma.payment.create({
                data: {
                    number: `PMT-AR-${inv.number}`, invoiceId: created.id, customerId,
                    date: payDate, amount: D(paidAmount), method: 'TRANSFER',
                    reference: `BCA-TRF-${Math.floor(100000 + Math.random() * 900000)}`,
                    glPostingStatus: 'POSTED',
                },
            })
            arPayments++

            await postJournal({
                description: `Payment received for ${inv.number}`,
                date: payDate, reference: `JE-PMT-AR-${inv.number}`,
                paymentId: payment.id, invoiceId: created.id,
                lines: [
                    { accountCode: SYS_ACCOUNTS.BANK_BCA, debit: paidAmount, credit: 0, description: `Penerimaan ${inv.customerCode}` },
                    { accountCode: SYS_ACCOUNTS.AR, debit: 0, credit: paidAmount, description: 'Pelunasan piutang' },
                ],
            })
        }
    }

    // ---- AP (Vendor) Invoices ----
    const AP_INVOICES = [
        { number: 'BILL-KRI-2026-001', supplierCode: 'SUP-KRI-002', subtotal: 65_000_000, daysAgo: 30, status: 'PAID' as const, dueDays: 30 },
        { number: 'BILL-KRI-2026-002', supplierCode: 'SUP-KRI-003', subtotal: 145_000_000, daysAgo: 25, status: 'PAID' as const, dueDays: 30 },
        { number: 'BILL-KRI-2026-003', supplierCode: 'SUP-KRI-007', subtotal: 78_000_000, daysAgo: 18, status: 'ISSUED' as const, dueDays: 30 },
        { number: 'BILL-KRI-2026-004', supplierCode: 'SUP-KRI-001', subtotal: 49_500_000, daysAgo: 10, status: 'PARTIAL' as const, dueDays: 30, paid: 25_000_000 },
        { number: 'BILL-KRI-2026-005', supplierCode: 'SUP-KRI-006', subtotal: 232_000_000, daysAgo: 50, status: 'OVERDUE' as const, dueDays: 30 },
    ]

    let apCount = 0
    let apPayments = 0
    for (const bill of AP_INVOICES) {
        const exists = await prisma.invoice.findUnique({ where: { number: bill.number } })
        if (exists) { apCount++; continue }

        const supplierId = supplierMap.get(bill.supplierCode)!
        const taxAmount = Math.round(bill.subtotal * 0.11)
        const totalAmount = bill.subtotal + taxAmount
        const balanceDue = bill.status === 'PAID' ? 0
            : bill.status === 'PARTIAL' ? totalAmount - (bill.paid ?? 0)
            : totalAmount

        const issueDate = daysFromNow(-bill.daysAgo)
        const dueDate = new Date(issueDate.getTime() + bill.dueDays * 86_400_000)

        const created = await prisma.invoice.create({
            data: {
                number: bill.number, type: 'INV_IN', supplierId,
                issueDate, dueDate,
                subtotal: D(bill.subtotal), taxAmount: D(taxAmount),
                totalAmount: D(totalAmount), balanceDue: D(balanceDue),
                amountInIDR: D(totalAmount), status: bill.status,
            },
        })
        apCount++

        // Post AP journal: DR Expense + PPN Masukan, CR AP
        // (all seeded bills are non-DRAFT)
        await postJournal({
            description: `Bill ${bill.number} from ${bill.supplierCode}`,
            date: issueDate, reference: `JE-AP-${bill.number}`,
            invoiceId: created.id,
            lines: [
                { accountCode: SYS_ACCOUNTS.EXPENSE_DEFAULT, debit: bill.subtotal, credit: 0, description: 'Beban pembelian' },
                { accountCode: SYS_ACCOUNTS.PPN_MASUKAN, debit: taxAmount, credit: 0, description: 'PPN Masukan 11%' },
                { accountCode: SYS_ACCOUNTS.AP, debit: 0, credit: totalAmount, description: `Hutang ke ${bill.supplierCode}` },
            ],
        })

        if (bill.status === 'PAID' || bill.status === 'PARTIAL') {
            const paidAmount = bill.status === 'PAID' ? totalAmount : (bill.paid ?? 0)
            const payDate = new Date(issueDate.getTime() + Math.min(bill.dueDays - 3, 25) * 86_400_000)
            const payment = await prisma.payment.create({
                data: {
                    number: `PMT-AP-${bill.number}`, invoiceId: created.id, supplierId,
                    date: payDate, amount: D(paidAmount), method: 'TRANSFER',
                    reference: `BCA-OUT-${Math.floor(100000 + Math.random() * 900000)}`,
                    glPostingStatus: 'POSTED',
                },
            })
            apPayments++

            await postJournal({
                description: `Payment to ${bill.supplierCode} for ${bill.number}`,
                date: payDate, reference: `JE-PMT-AP-${bill.number}`,
                paymentId: payment.id, invoiceId: created.id,
                lines: [
                    { accountCode: SYS_ACCOUNTS.AP, debit: paidAmount, credit: 0, description: 'Pembayaran hutang' },
                    { accountCode: SYS_ACCOUNTS.BANK_BCA, debit: 0, credit: paidAmount, description: `Transfer ke ${bill.supplierCode}` },
                ],
            })
        }
    }

    // ---------- 13. Machines (executive alerts source) ----------
    console.log('  [13/14] Seeding machines (status feed for alerts)...')
    const MACHINES = [
        { code: 'EXC-001', name: 'Excavator Komatsu PC200-8 #01', brand: 'Komatsu', model: 'PC200-8', status: 'RUNNING' as const, healthScore: 92 },
        { code: 'EXC-002', name: 'Excavator CAT 320D #02', brand: 'Caterpillar', model: '320D', status: 'BREAKDOWN' as const, healthScore: 25 },
        { code: 'BLD-001', name: 'Bulldozer Komatsu D85 #01', brand: 'Komatsu', model: 'D85ESS', status: 'MAINTENANCE' as const, healthScore: 65 },
        { code: 'DT-001',  name: 'Dump Truck HD465 #01', brand: 'Komatsu', model: 'HD465-7', status: 'RUNNING' as const, healthScore: 88 },
        { code: 'DT-002',  name: 'Dump Truck HD605 #02', brand: 'Komatsu', model: 'HD605-7', status: 'IDLE' as const, healthScore: 78 },
        { code: 'WL-001',  name: 'Wheel Loader CAT 988 #01', brand: 'Caterpillar', model: '988H', status: 'BREAKDOWN' as const, healthScore: 35 },
    ]
    let machineCount = 0
    for (const m of MACHINES) {
        await prisma.machine.upsert({
            where: { code: m.code },
            update: { name: m.name, brand: m.brand, model: m.model, status: m.status, healthScore: m.healthScore, isActive: true },
            create: { ...m, capacityPerHour: 100, isActive: true },
        })
        machineCount++
    }

    // ---------- 14. Monthly Sales Target (SystemSetting fallback) ----------
    console.log('  [14/14] Seeding monthly sales target...')
    // SCHEMA GAP: no MonthlySalesTarget model exists. Backend dashboard reads
    // sales.monthlyTarget but no current API surfaces it. We store the target
    // in SystemSetting for future backend wiring.
    const monthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
    await prisma.systemSetting.upsert({
        where: { key: 'kri.monthlyTarget' },
        update: { value: '8500000000', description: `Monthly sales target IDR — ${monthKey}` },
        create: {
            key: 'kri.monthlyTarget', value: '8500000000',
            description: `Monthly sales target IDR — ${monthKey} (Rp 8,5 milyar)`,
        },
    })
    await prisma.systemSetting.upsert({
        where: { key: 'kri.monthlyTarget.month' },
        update: { value: monthKey },
        create: { key: 'kri.monthlyTarget.month', value: monthKey, description: 'Bulan target aktif' },
    })

    // ============================================================
    // SUMMARY
    // ============================================================
    const counts = {
        suppliers: await prisma.supplier.count({ where: { code: { startsWith: 'SUP-KRI-' } } }),
        categories: await prisma.category.count({ where: { code: { startsWith: 'CAT-' } } }),
        warehouses: await prisma.warehouse.count({ where: { code: { startsWith: 'WH-KRI-' } } }),
        products: await prisma.product.count({ where: { code: { startsWith: 'PRD-' } } }),
        stockLevels: stockLevelCount,
        employees: await prisma.employee.count({ where: { employeeId: { startsWith: 'KRI-' } } }),
        attendance: attCount,
        customers: await prisma.customer.count({ where: { code: { startsWith: 'CUST-KRI-' } } }),
        purchaseRequests: await prisma.purchaseRequest.count({ where: { number: { startsWith: 'PR-KRI-' } } }),
        purchaseOrders: await prisma.purchaseOrder.count({ where: { number: { startsWith: 'PO-KRI-' } } }),
        grns: grnCount,
        invoicesAR: arCount,
        invoicesAP: apCount,
        paymentsAR: arPayments,
        paymentsAP: apPayments,
        machines: machineCount,
        journalEntries: await prisma.journalEntry.count({ where: { reference: { startsWith: 'JE-' } } }),
    }
    console.log('\n✅ KRI Demo Seed Complete!\n')
    console.log('Records inserted:')
    Object.entries(counts).forEach(([k, v]) => console.log(`  ${k.padEnd(20)} ${v}`))
}

main()
    .catch(e => {
        console.error('❌ Seed failed:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
