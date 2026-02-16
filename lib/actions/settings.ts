"use server"

import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// Default Numbering Configs (mock-backed for now)
// ============================================================================

const DEFAULT_NUMBERING: DocumentNumberingConfig[] = [
    { module: "Sales Order", prefix: "SO", separator: "-", dateFormat: "YYMM", digitCount: 4, example: "SO-2602-0001", lastNumber: 0 },
    { module: "Purchase Order", prefix: "PO", separator: "-", dateFormat: "YYMM", digitCount: 4, example: "PO-2602-0001", lastNumber: 0 },
    { module: "Invoice", prefix: "INV", separator: "-", dateFormat: "YYMM", digitCount: 4, example: "INV-2602-0001", lastNumber: 0 },
    { module: "Delivery Note", prefix: "SJ", separator: "-", dateFormat: "YYMM", digitCount: 4, example: "SJ-2602-0001", lastNumber: 0 },
    { module: "Work Order", prefix: "WO", separator: "-", dateFormat: "YYMM", digitCount: 4, example: "WO-2602-0001", lastNumber: 0 },
    { module: "Goods Received", prefix: "GRN", separator: "-", dateFormat: "YYMM", digitCount: 4, example: "GRN-2602-0001", lastNumber: 0 },
    { module: "Purchase Request", prefix: "PR", separator: "-", dateFormat: "YYMM", digitCount: 4, example: "PR-2602-0001", lastNumber: 0 },
    { module: "Journal Entry", prefix: "JE", separator: "-", dateFormat: "YYMM", digitCount: 4, example: "JE-2602-0001", lastNumber: 0 },
    { module: "Subcontract Order", prefix: "SC", separator: "-", dateFormat: "YYMM", digitCount: 4, example: "SC-2602-0001", lastNumber: 0 },
    { module: "Cost Sheet", prefix: "CS", separator: "-", dateFormat: "YYMM", digitCount: 4, example: "CS-2602-0001", lastNumber: 0 },
]

// ============================================================================
// Module definitions for permission matrix
// ============================================================================

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

// ============================================================================
// Permission Matrix
// ============================================================================

export async function getPermissionMatrix(): Promise<{
    success: boolean
    data?: PermissionMatrixEntry[]
    error?: string
}> {
    try {
        const supabase = await createClient()
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) return { success: false, error: "Unauthorized" }

        const roles = await prisma.systemRole.findMany({
            orderBy: { code: "asc" },
        })

        if (roles.length === 0) {
            // Return default roles if none exist
            return {
                success: true,
                data: [
                    { roleCode: "ROLE_ADMIN", roleName: "Administrator", permissions: MODULE_PERMISSIONS.map(m => m.key), isSystem: true },
                    { roleCode: "ROLE_MANAGER", roleName: "Manajer", permissions: ["DASHBOARD", "INVENTORY", "SALES", "PROCUREMENT", "MANUFACTURING", "QUALITY", "HCM"], isSystem: true },
                    { roleCode: "ROLE_ACCOUNTANT", roleName: "Akuntan", permissions: ["DASHBOARD", "FINANCE", "INVOICES", "JOURNAL"], isSystem: true },
                    { roleCode: "ROLE_STAFF", roleName: "Staf", permissions: ["DASHBOARD", "INVENTORY", "SALES"], isSystem: false },
                    { roleCode: "ROLE_PURCHASING", roleName: "Purchasing", permissions: ["DASHBOARD", "PROCUREMENT", "INVENTORY"], isSystem: false },
                    { roleCode: "ROLE_WAREHOUSE", roleName: "Gudang", permissions: ["DASHBOARD", "INVENTORY"], isSystem: false },
                    { roleCode: "ROLE_SALES", roleName: "Sales", permissions: ["DASHBOARD", "SALES"], isSystem: false },
                    { roleCode: "ROLE_VIEWER", roleName: "Viewer", permissions: ["DASHBOARD"], isSystem: false },
                ],
            }
        }

        return {
            success: true,
            data: roles.map(r => ({
                roleCode: r.code,
                roleName: r.name,
                permissions: r.permissions,
                isSystem: r.isSystem,
            })),
        }
    } catch (error) {
        console.error("[Settings] getPermissionMatrix error:", error)
        return { success: false, error: "Gagal memuat matriks izin" }
    }
}

export async function updateRolePermissions(
    roleCode: string,
    permissions: string[]
): Promise<{ success: boolean; error?: string }> {
    try {
        const supabase = await createClient()
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) return { success: false, error: "Unauthorized" }

        await prisma.systemRole.upsert({
            where: { code: roleCode },
            update: { permissions },
            create: {
                code: roleCode,
                name: roleCode.replace("ROLE_", "").replace(/_/g, " "),
                permissions,
                isSystem: false,
            },
        })

        return { success: true }
    } catch (error) {
        console.error("[Settings] updateRolePermissions error:", error)
        return { success: false, error: "Gagal memperbarui izin" }
    }
}

// ============================================================================
// Document Numbering
// ============================================================================

export async function getDocumentNumbering(): Promise<{
    success: boolean
    data?: DocumentNumberingConfig[]
    error?: string
}> {
    try {
        const supabase = await createClient()
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) return { success: false, error: "Unauthorized" }

        // For now return defaults — in production these would come from a settings table
        return { success: true, data: DEFAULT_NUMBERING }
    } catch (error) {
        console.error("[Settings] getDocumentNumbering error:", error)
        return { success: false, error: "Gagal memuat konfigurasi penomoran" }
    }
}

// ============================================================================
// Company Config
// ============================================================================

export async function getCompanyConfig(): Promise<{
    success: boolean
    data?: CompanyConfig
    error?: string
}> {
    try {
        const supabase = await createClient()
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) return { success: false, error: "Unauthorized" }

        // Default company config
        return {
            success: true,
            data: {
                name: "PT Maju Bersama Indonesia",
                npwp: "01.234.567.8-901.000",
                address: "Jl. Industri Textile No. 123, Bandung 40175",
                phone: "+62 22 1234567",
                email: "info@majutextile.co.id",
                taxRate: 11,
                currency: "IDR",
                defaultPaymentTerm: "NET_30",
            },
        }
    } catch (error) {
        console.error("[Settings] getCompanyConfig error:", error)
        return { success: false, error: "Gagal memuat konfigurasi perusahaan" }
    }
}
