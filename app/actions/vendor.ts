'use server'

import { prisma } from "@/lib/prisma"
import { supabase } from "@/lib/supabase"
import { ProcurementStatus } from "@prisma/client"
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache"

const revalidateTagSafe = (tag: string) => (revalidateTag as any)(tag, 'default')

// ==========================================
// GET ALL VENDORS
// ==========================================
export const getVendors = unstable_cache(
    async () => {
        try {
            // Supabase Client
            const { data: vendors, error } = await supabase
                .from('suppliers')
                .select('*, purchase_orders(count)')
                .eq('isActive', true)
                .order('name', { ascending: true })

            if (error) {
                console.error("Supabase Error fetching vendors:", error)
                return []
            }

            if (!vendors) return []

            return vendors.map((v: any) => ({
                id: v.id,
                code: v.code,
                name: v.name,
                contactName: v.contactName,
                email: v.email,
                phone: v.phone,
                address: v.address,
                rating: v.rating,
                onTimeRate: v.onTimeRate,
                isActive: v.isActive,
                totalOrders: v.purchase_orders?.[0]?.count || 0,
                activeOrders: 0, // Simplified: Active orders count needs complex filtering, setting to 0 for now
                createdAt: v.createdAt
            }))
        } catch (error) {
            console.error("Error fetching vendors:", error)
            return []
        }
    },
    ['vendors-list-procurement'],
    { revalidate: 600, tags: ['procurement', 'vendors'] }
)

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
}) {
    try {
        // Validate required fields
        if (!data.code || !data.name) {
            return { success: false, error: "Code and Name are required" }
        }

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
                isActive: true
            }
        })

        revalidateTagSafe('procurement')
        revalidateTagSafe('vendors')
        revalidatePath('/procurement/vendors')

        return {
            success: true,
            message: "Vendor created successfully",
            vendor: { id: vendor.id, name: vendor.name }
        }
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
