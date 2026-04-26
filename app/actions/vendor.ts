'use server'

import { prisma, withPrismaAuth } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"
import { PaymentTermLegacy, type Prisma } from "@prisma/client"
import { isLegacyPaymentTerm } from "@/lib/payment-term-options"
import type { VendorFilter } from "@/lib/types/vendor-filters"

export type { VendorFilter } from "@/lib/types/vendor-filters"

async function requireAuth() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new Error("Unauthorized")
    return user
}

// ==========================================
// GET ALL VENDORS (with optional filter)
// ==========================================
export async function getVendors(filter?: VendorFilter) {
    try {
        await requireAuth()

        const where: Prisma.SupplierWhereInput = {}

        // Status filter (ACTIVE / INACTIVE)
        if (filter?.status?.length) {
            const wantsActive = filter.status.includes("ACTIVE")
            const wantsInactive = filter.status.includes("INACTIVE")
            if (wantsActive && !wantsInactive) where.isActive = true
            else if (wantsInactive && !wantsActive) where.isActive = false
        }

        // Rating filter — multi-select [1..5]
        if (filter?.ratings?.length) {
            where.rating = { in: filter.ratings }
        }

        // Payment term filter
        if (filter?.paymentTerms?.length) {
            const valid = filter.paymentTerms.filter(isLegacyPaymentTerm) as PaymentTermLegacy[]
            if (valid.length) where.paymentTerm = { in: valid }
        }

        // Free-text search across name / code / NPWP / contactName
        if (filter?.search?.trim()) {
            const q = filter.search.trim()
            where.OR = [
                { name: { contains: q, mode: "insensitive" } },
                { code: { contains: q, mode: "insensitive" } },
                { npwp: { contains: q, mode: "insensitive" } },
                { contactName: { contains: q, mode: "insensitive" } },
            ]
        }

        const [vendors, activePOCounts] = await Promise.all([
            prisma.supplier.findMany({
                where,
                orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
                include: {
                    _count: {
                        select: { purchaseOrders: true }
                    },
                    categories: true
                }
            }),
            prisma.purchaseOrder.groupBy({
                by: ['supplierId'],
                where: {
                    status: { in: ['ORDERED', 'VENDOR_CONFIRMED', 'SHIPPED', 'PARTIAL_RECEIVED'] }
                },
                _count: { id: true }
            })
        ])

        const activeOrderMap = new Map(activePOCounts.map(c => [c.supplierId, c._count.id]))

        return vendors.map(v => ({
            id: v.id,
            code: v.code,
            name: v.name,
            contactName: v.contactName,
            contactTitle: v.contactTitle,
            email: v.email,
            phone: v.phone,
            picPhone: v.picPhone,
            officePhone: v.officePhone,
            address: v.address,
            address2: v.address2,
            npwp: v.npwp ?? null,
            paymentTerm: v.paymentTerm,
            bankName: v.bankName,
            bankAccountNumber: v.bankAccountNumber,
            bankAccountName: v.bankAccountName,
            rating: Number(v.rating) || 0,
            onTimeRate: Number(v.onTimeRate) || 0,
            isActive: v.isActive,
            totalOrders: v._count.purchaseOrders,
            activeOrders: activeOrderMap.get(v.id) || 0,
            createdAt: v.createdAt,
            categories: v.categories.map(c => ({ id: c.id, code: c.code, name: c.name }))
        }))
    } catch (error) {
        console.error("Error fetching vendors:", error)
        return []
    }
}

// ==========================================
// GET VENDOR BY ID
// ==========================================
export async function getVendorById(id: string) {
    try {
        await requireAuth()
        const vendor = await prisma.supplier.findUnique({
            where: { id },
            include: {
                categories: true,
                _count: { select: { purchaseOrders: true } },
            },
        })
        if (!vendor) return null
        return {
            id: vendor.id,
            code: vendor.code,
            name: vendor.name,
            contactName: vendor.contactName,
            contactTitle: vendor.contactTitle,
            email: vendor.email,
            phone: vendor.phone,
            picPhone: vendor.picPhone,
            officePhone: vendor.officePhone,
            address: vendor.address,
            address2: vendor.address2,
            npwp: vendor.npwp ?? null,
            paymentTerm: vendor.paymentTerm,
            bankName: vendor.bankName,
            bankAccountNumber: vendor.bankAccountNumber,
            bankAccountName: vendor.bankAccountName,
            rating: Number(vendor.rating) || 0,
            onTimeRate: Number(vendor.onTimeRate) || 0,
            qualityScore: vendor.qualityScore != null ? Number(vendor.qualityScore) : null,
            responsiveness: vendor.responsiveness != null ? Number(vendor.responsiveness) : null,
            isActive: vendor.isActive,
            totalOrders: vendor._count.purchaseOrders,
            createdAt: vendor.createdAt,
            updatedAt: vendor.updatedAt,
            categories: vendor.categories.map(c => ({ id: c.id, code: c.code, name: c.name })),
        }
    } catch (error) {
        console.error("Error fetching vendor by id:", error)
        return null
    }
}

// ==========================================
// BULK UPDATE VENDOR STATUS
// ==========================================
export async function bulkUpdateVendorStatus(
    ids: string[],
    status: 'ACTIVE' | 'INACTIVE',
): Promise<{ succeeded: string[]; failed: { id: string; reason: string }[] }> {
    const result: { succeeded: string[]; failed: { id: string; reason: string }[] } = {
        succeeded: [],
        failed: [],
    }
    if (!Array.isArray(ids) || ids.length === 0) return result

    try {
        await requireAuth()
    } catch (e) {
        const reason = e instanceof Error ? e.message : "Unauthorized"
        for (const id of ids) result.failed.push({ id, reason })
        return result
    }

    const isActive = status === 'ACTIVE'

    for (const id of ids) {
        try {
            await withPrismaAuth(async (p) => {
                const vendor = await p.supplier.findUnique({ where: { id } })
                if (!vendor) throw new Error("Vendor tidak ditemukan")
                await p.supplier.update({ where: { id }, data: { isActive } })
            })
            result.succeeded.push(id)
        } catch (e) {
            const reason = e instanceof Error ? e.message : "Unknown error"
            result.failed.push({ id, reason })
        }
    }

    return result
}

// ==========================================
// CREATE VENDOR
// ==========================================
export async function createVendor(data: {
    code: string
    name: string
    contactName?: string
    contactTitle?: string
    email?: string
    phone?: string
    picPhone?: string
    officePhone?: string
    address?: string
    address2?: string
    paymentTerm?: string
    categoryIds?: string[]
    bankName?: string
    bankAccountNumber?: string
    bankAccountName?: string
}) {
    try {
        // Validate required fields
        if (!data.code || !data.name) {
            return { success: false, error: "Code and Name are required" }
        }

        return await withPrismaAuth(async (prisma) => {
            const paymentTerm = isLegacyPaymentTerm(data.paymentTerm) ? data.paymentTerm : "CASH"

            // Check for duplicate code
            const existing = await prisma.supplier.findUnique({
                where: { code: data.code }
            })

            if (existing) {
                return { success: false, error: `Vendor code "${data.code}" already exists` }
            }

            // Create vendor
            const vendor = await prisma.supplier.create({
                data: {
                    code: data.code.toUpperCase(),
                    name: data.name,
                    contactName: data.contactName || null,
                    contactTitle: data.contactTitle || null,
                    email: data.email || null,
                    phone: data.phone || null,
                    picPhone: data.picPhone || null,
                    officePhone: data.officePhone || null,
                    address: data.address || null,
                    address2: data.address2 || null,
                    paymentTerm: paymentTerm as PaymentTermLegacy,
                    bankName: data.bankName || null,
                    bankAccountNumber: data.bankAccountNumber || null,
                    bankAccountName: data.bankAccountName || null,
                    rating: 0,
                    onTimeRate: 0,
                    isActive: true,
                    categories: data.categoryIds?.length ? { connect: data.categoryIds.map(id => ({ id })) } : undefined
                }
            })

            return {
                success: true,
                message: "Vendor created successfully",
                vendor: { id: vendor.id, name: vendor.name }
            }
        })
    } catch (error: any) {
        console.error("Error creating vendor:", error)
        return { success: false, error: error.message || "Failed to create vendor" }
    }
}

// ==========================================
// UPDATE VENDOR
// ==========================================
export async function updateVendor(vendorId: string, data: {
    code: string
    name: string
    contactName?: string
    contactTitle?: string
    email?: string
    phone?: string
    picPhone?: string
    officePhone?: string
    address?: string
    address2?: string
    paymentTerm?: string
    categoryIds?: string[]
    bankName?: string
    bankAccountNumber?: string
    bankAccountName?: string
}) {
    try {
        // Validate required fields
        if (!data.code || !data.name) {
            return { success: false, error: "Code and Name are required" }
        }

        return await withPrismaAuth(async (prisma) => {
            const paymentTerm = isLegacyPaymentTerm(data.paymentTerm) ? data.paymentTerm : "CASH"

            // Check vendor exists
            const existing = await prisma.supplier.findUnique({
                where: { id: vendorId }
            })

            if (!existing) {
                return { success: false, error: "Vendor tidak ditemukan" }
            }

            // Check for duplicate code (if code changed)
            if (data.code.toUpperCase() !== existing.code) {
                const duplicateCode = await prisma.supplier.findUnique({
                    where: { code: data.code.toUpperCase() }
                })
                if (duplicateCode) {
                    return { success: false, error: `Vendor code "${data.code}" already exists` }
                }
            }

            // Update vendor
            const vendor = await prisma.supplier.update({
                where: { id: vendorId },
                data: {
                    code: data.code.toUpperCase(),
                    name: data.name,
                    contactName: data.contactName || null,
                    contactTitle: data.contactTitle || null,
                    email: data.email || null,
                    phone: data.phone || null,
                    picPhone: data.picPhone || null,
                    officePhone: data.officePhone || null,
                    address: data.address || null,
                    address2: data.address2 || null,
                    paymentTerm: paymentTerm as PaymentTermLegacy,
                    bankName: data.bankName || null,
                    bankAccountNumber: data.bankAccountNumber || null,
                    bankAccountName: data.bankAccountName || null,
                    categories: {
                        set: (data.categoryIds || []).map(id => ({ id }))
                    }
                }
            })

            return {
                success: true,
                vendor: { id: vendor.id, name: vendor.name }
            }
        })
    } catch (error: any) {
        console.error("Error updating vendor:", error)
        return { success: false, error: error.message || "Failed to update vendor" }
    }
}

// ==========================================
// GET VENDOR HISTORY
// ==========================================
export async function getVendorHistory(vendorId: string) {
    try {
        await requireAuth()

        const history = await prisma.purchaseOrder.findMany({
            where: { supplierId: vendorId },
            include: {
                items: true
            },
            orderBy: { orderDate: 'desc' }
        })

        return history.map(po => ({
            id: po.id,
            number: po.number,
            date: po.orderDate,
            status: po.status,
            totalAmount: Number(po.totalAmount),
            itemCount: po.items.length
        }))
    } catch (error) {
        console.error("Error fetching vendor history:", error)
        return []
    }
}

// ==========================================
// SUPPLIER CATEGORIES
// ==========================================
export async function getSupplierCategories() {
    try {
        await requireAuth()

        return prisma.supplierCategory.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' },
            select: { id: true, code: true, name: true },
        })
    } catch (error) {
        console.error("Error fetching supplier categories:", error)
        return []
    }
}

// ==========================================
// TOGGLE VENDOR ACTIVE STATUS
// ==========================================
export async function toggleVendorStatus(vendorId: string) {
    try {
        return await withPrismaAuth(async (prisma) => {
            const vendor = await prisma.supplier.findUnique({ where: { id: vendorId } })
            if (!vendor) return { success: false, error: "Vendor tidak ditemukan" }

            const updated = await prisma.supplier.update({
                where: { id: vendorId },
                data: { isActive: !vendor.isActive },
                select: { id: true, name: true, isActive: true },
            })

            return {
                success: true,
                message: updated.isActive ? `${updated.name} diaktifkan` : `${updated.name} dinonaktifkan`,
                vendor: updated,
            }
        })
    } catch (error: any) {
        console.error("Error toggling vendor status:", error)
        return { success: false, error: error.message || "Gagal mengubah status vendor" }
    }
}

// ==========================================
// CHECK DUPLICATE VENDOR (fuzzy matching)
// ==========================================
export async function checkDuplicateVendor(name: string) {
    try {
        if (!name || name.trim().length < 2) return { duplicates: [] }

        await requireAuth()

        const vendors = await prisma.supplier.findMany({
            where: { isActive: true },
            select: { id: true, code: true, name: true },
        })

        const normalizedInput = name.trim().toLowerCase()

        const matches = vendors.filter(v => {
            const normalizedName = v.name.toLowerCase()
            // Exact match (case-insensitive)
            if (normalizedName === normalizedInput) return true
            // Contains match
            if (normalizedName.includes(normalizedInput) || normalizedInput.includes(normalizedName)) return true
            // Simple Levenshtein distance <= 2
            if (levenshtein(normalizedName, normalizedInput) <= 2) return true
            return false
        })

        return { duplicates: matches }
    } catch (error) {
        console.error("Error checking duplicate vendor:", error)
        return { duplicates: [] }
    }
}

function levenshtein(a: string, b: string): number {
    const matrix: number[][] = []
    for (let i = 0; i <= b.length; i++) matrix[i] = [i]
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b[i - 1] === a[j - 1]) {
                matrix[i][j] = matrix[i - 1][j - 1]
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                )
            }
        }
    }
    return matrix[b.length][a.length]
}

export async function createSupplierCategory(name: string) {
    try {
        if (!name || name.trim().length < 2) {
            return { success: false, error: "Nama kategori minimal 2 karakter" }
        }
        return await withPrismaAuth(async (prisma) => {
            const code = "SC-" + name.trim().substring(0, 3).toUpperCase() + "-" + Date.now().toString().slice(-4)
            const category = await prisma.supplierCategory.create({
                data: { code, name: name.trim() },
                select: { id: true, code: true, name: true },
            })
            return { success: true, category }
        })
    } catch (error: any) {
        console.error("Error creating supplier category:", error)
        return { success: false, error: error.message || "Gagal membuat kategori" }
    }
}
