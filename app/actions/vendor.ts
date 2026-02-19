'use server'

import { withPrismaAuth } from "@/lib/db"
import { supabase } from "@/lib/supabase"
import { ProcurementStatus } from "@prisma/client"

// ==========================================
// GET ALL VENDORS
// ==========================================
// ==========================================
// GET ALL VENDORS
// ==========================================
export async function getVendors() {
    try {
        return await withPrismaAuth(async (prisma) => {
            const vendors = await prisma.supplier.findMany({
                where: { isActive: true },
                orderBy: { name: 'asc' },
                include: {
                    _count: {
                        select: { purchaseOrders: true }
                    },
                    categories: true
                }
            })

            return vendors.map(v => ({
                id: v.id,
                code: v.code,
                name: v.name,
                contactName: v.contactName,
                email: v.email,
                phone: v.phone,
                address: v.address,
                rating: Number(v.rating) || 0,
                onTimeRate: Number(v.onTimeRate) || 0,
                isActive: v.isActive,
                totalOrders: v._count.purchaseOrders,
                activeOrders: 0, // Simplified for list view
                createdAt: v.createdAt,
                categories: v.categories.map(c => ({ id: c.id, code: c.code, name: c.name }))
            }))
        })
    } catch (error) {
        console.error("Error fetching vendors:", error)
        return []
    }
}

// ==========================================
// CREATE VENDOR
// ==========================================
export async function createVendor(data: {
    code: string
    name: string
    contactName?: string
    email?: string
    phone?: string
    address?: string
    categoryIds?: string[]
}) {
    try {
        // Validate required fields
        if (!data.code || !data.name) {
            return { success: false, error: "Code and Name are required" }
        }

        return await withPrismaAuth(async (prisma) => {
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
                    email: data.email || null,
                    phone: data.phone || null,
                    address: data.address || null,
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
// GET VENDOR HISTORY
// ==========================================
export async function getVendorHistory(vendorId: string) {
    try {
        return await withPrismaAuth(async (prisma) => {
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
        })
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
        return await withPrismaAuth(async (prisma) => {
            return prisma.supplierCategory.findMany({
                where: { isActive: true },
                orderBy: { name: 'asc' },
                select: { id: true, code: true, name: true },
            })
        })
    } catch (error) {
        console.error("Error fetching supplier categories:", error)
        return []
    }
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
