// Constants and types exported from settings module.
// Moved out of "use server" file (lib/actions/settings.ts) because
// "use server" files can only export async functions.

export type PermissionMatrixEntry = {
    roleCode: string
    roleName: string
    permissions: string[]
    isSystem: boolean
}

export type DocumentNumberingConfig = {
    module: string
    prefix: string
    separator: string
    dateFormat: string
    digitCount: number
    example: string
    lastNumber: number
}

export type CompanyConfig = {
    name: string
    npwp: string
    address: string
    phone: string
    email: string
    taxRate: number
    currency: string
    defaultPaymentTerm: string
}

export const MODULE_PERMISSIONS = [
    { key: "DASHBOARD", label: "Dashboard", group: "Umum" },
    { key: "INVENTORY", label: "Inventaris", group: "Umum" },
    { key: "SALES", label: "Penjualan", group: "Umum" },
    { key: "PROCUREMENT", label: "Pengadaan", group: "Umum" },
    { key: "FINANCE", label: "Keuangan", group: "Keuangan" },
    { key: "INVOICES", label: "Faktur", group: "Keuangan" },
    { key: "JOURNAL", label: "Jurnal", group: "Keuangan" },
    { key: "MANUFACTURING", label: "Manufaktur", group: "Produksi" },
    { key: "QUALITY", label: "Kualitas", group: "Produksi" },
    { key: "SUBCONTRACT", label: "Subkontrak", group: "Produksi" },
    { key: "CUTTING", label: "Pemotongan", group: "Produksi" },
    { key: "COSTING", label: "Kalkulasi Biaya", group: "Produksi" },
    { key: "HCM", label: "SDM", group: "SDM" },
    { key: "PAYROLL", label: "Penggajian", group: "SDM" },
    { key: "SETTINGS", label: "Pengaturan", group: "Sistem" },
    { key: "USERS", label: "Manajemen Pengguna", group: "Sistem" },
] as const
