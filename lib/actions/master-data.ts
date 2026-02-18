'use server'

import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

async function requireAuth() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new Error("Unauthorized")
    return user
}

// ─── Units ───────────────────────────────────────────────

export async function getUnits() {
    await requireAuth()
    return prisma.unit.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, code: true, name: true },
    })
}

export async function createUnit(code: string, name: string) {
    await requireAuth()
    const unit = await prisma.unit.create({
        data: { code: code.toLowerCase(), name },
        select: { id: true, code: true, name: true },
    })
    return unit
}

// ─── Brands ──────────────────────────────────────────────

export async function getBrands() {
    await requireAuth()
    return prisma.brand.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, code: true, name: true },
    })
}

export async function createBrand(code: string, name: string) {
    await requireAuth()
    const brand = await prisma.brand.create({
        data: { code: code.toUpperCase(), name },
        select: { id: true, code: true, name: true },
    })
    return brand
}

// ─── Colors ──────────────────────────────────────────────

export async function getColors() {
    await requireAuth()
    return prisma.color.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, code: true, name: true, hexCode: true },
    })
}

export async function createColor(code: string, name: string, hexCode?: string) {
    await requireAuth()
    const color = await prisma.color.create({
        data: { code: code.toUpperCase(), name, hexCode: hexCode || null },
        select: { id: true, code: true, name: true, hexCode: true },
    })
    return color
}

// ─── Categories (existing model, just adding create-new) ─

export async function getCategories() {
    await requireAuth()
    return prisma.category.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, code: true, name: true },
    })
}

export async function createCategory(code: string, name: string) {
    await requireAuth()
    const category = await prisma.category.create({
        data: { code: code.toUpperCase(), name, description: name },
        select: { id: true, code: true, name: true },
    })
    return category
}

// ─── Suppliers (existing model) ──────────────────────────

export async function getSuppliers() {
    await requireAuth()
    return prisma.supplier.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true, code: true },
    })
}
