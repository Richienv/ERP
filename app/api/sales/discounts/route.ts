import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"

// ─── Auth helper ─────────────────────────────────────────────────────────

async function requireAuth() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new Error("Unauthorized")
    return user
}

// ─── GET: List all discount schemes ──────────────────────────────────────

export async function GET() {
    try {
        await requireAuth()

        const schemes = await prisma.discountScheme.findMany({
            include: {
                priceList: { select: { id: true, name: true, code: true } },
                customer: { select: { id: true, name: true, code: true } },
                product: { select: { id: true, name: true, code: true } },
                category: { select: { id: true, name: true, code: true } },
            },
            orderBy: { updatedAt: "desc" },
        })

        const summary = {
            total: schemes.length,
            active: schemes.filter((s) => s.isActive).length,
            percentage: schemes.filter((s) => s.type === "PERCENTAGE").length,
            fixed: schemes.filter((s) => s.type === "FIXED").length,
            tiered: schemes.filter((s) => s.type === "TIERED").length,
        }

        return NextResponse.json({ data: schemes, summary })
    } catch (err: any) {
        if (err.message === "Unauthorized") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }
        console.error("[GET /api/sales/discounts]", err)
        return NextResponse.json({ error: "Gagal memuat skema diskon" }, { status: 500 })
    }
}

// ─── POST: Create a new discount scheme ──────────────────────────────────

export async function POST(req: NextRequest) {
    try {
        await requireAuth()

        const body = await req.json()
        const {
            code, name, description, type, scope, value,
            tieredRules, priceListId, customerId, productId, categoryId,
            validFrom, validTo, minOrderValue, isActive,
        } = body

        if (!code || !name || !type) {
            return NextResponse.json(
                { error: "Kode, nama, dan tipe diskon wajib diisi" },
                { status: 400 }
            )
        }

        // Check code uniqueness
        const existing = await prisma.discountScheme.findUnique({ where: { code } })
        if (existing) {
            return NextResponse.json(
                { error: `Kode diskon "${code}" sudah digunakan` },
                { status: 409 }
            )
        }

        const scheme = await prisma.discountScheme.create({
            data: {
                code,
                name,
                description: description || null,
                type,
                scope: scope || "GLOBAL",
                value: value != null ? value : null,
                tieredRules: tieredRules || null,
                priceListId: priceListId || null,
                customerId: customerId || null,
                productId: productId || null,
                categoryId: categoryId || null,
                validFrom: validFrom ? new Date(validFrom) : null,
                validTo: validTo ? new Date(validTo) : null,
                minOrderValue: minOrderValue != null ? minOrderValue : null,
                isActive: isActive ?? true,
            },
            include: {
                priceList: { select: { id: true, name: true, code: true } },
                customer: { select: { id: true, name: true, code: true } },
                product: { select: { id: true, name: true, code: true } },
                category: { select: { id: true, name: true, code: true } },
            },
        })

        return NextResponse.json({ data: scheme }, { status: 201 })
    } catch (err: any) {
        if (err.message === "Unauthorized") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }
        console.error("[POST /api/sales/discounts]", err)
        return NextResponse.json({ error: "Gagal membuat skema diskon" }, { status: 500 })
    }
}

// ─── PUT: Update a discount scheme ───────────────────────────────────────

export async function PUT(req: NextRequest) {
    try {
        await requireAuth()

        const body = await req.json()
        const { id, ...updateData } = body

        if (!id) {
            return NextResponse.json({ error: "ID wajib diisi" }, { status: 400 })
        }

        // Check code uniqueness if code changed
        if (updateData.code) {
            const existing = await prisma.discountScheme.findFirst({
                where: { code: updateData.code, NOT: { id } },
            })
            if (existing) {
                return NextResponse.json(
                    { error: `Kode diskon "${updateData.code}" sudah digunakan` },
                    { status: 409 }
                )
            }
        }

        const scheme = await prisma.discountScheme.update({
            where: { id },
            data: {
                ...(updateData.code != null && { code: updateData.code }),
                ...(updateData.name != null && { name: updateData.name }),
                ...(updateData.description !== undefined && { description: updateData.description || null }),
                ...(updateData.type != null && { type: updateData.type }),
                ...(updateData.scope != null && { scope: updateData.scope }),
                ...(updateData.value !== undefined && { value: updateData.value }),
                ...(updateData.tieredRules !== undefined && { tieredRules: updateData.tieredRules }),
                ...(updateData.priceListId !== undefined && { priceListId: updateData.priceListId || null }),
                ...(updateData.customerId !== undefined && { customerId: updateData.customerId || null }),
                ...(updateData.productId !== undefined && { productId: updateData.productId || null }),
                ...(updateData.categoryId !== undefined && { categoryId: updateData.categoryId || null }),
                ...(updateData.validFrom !== undefined && { validFrom: updateData.validFrom ? new Date(updateData.validFrom) : null }),
                ...(updateData.validTo !== undefined && { validTo: updateData.validTo ? new Date(updateData.validTo) : null }),
                ...(updateData.minOrderValue !== undefined && { minOrderValue: updateData.minOrderValue }),
                ...(updateData.isActive !== undefined && { isActive: updateData.isActive }),
            },
            include: {
                priceList: { select: { id: true, name: true, code: true } },
                customer: { select: { id: true, name: true, code: true } },
                product: { select: { id: true, name: true, code: true } },
                category: { select: { id: true, name: true, code: true } },
            },
        })

        return NextResponse.json({ data: scheme })
    } catch (err: any) {
        if (err.message === "Unauthorized") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }
        console.error("[PUT /api/sales/discounts]", err)
        return NextResponse.json({ error: "Gagal mengubah skema diskon" }, { status: 500 })
    }
}

// ─── DELETE: Delete a discount scheme ────────────────────────────────────

export async function DELETE(req: NextRequest) {
    try {
        await requireAuth()

        const { searchParams } = new URL(req.url)
        const id = searchParams.get("id")

        if (!id) {
            return NextResponse.json({ error: "ID wajib diisi" }, { status: 400 })
        }

        await prisma.discountScheme.delete({ where: { id } })

        return NextResponse.json({ success: true })
    } catch (err: any) {
        if (err.message === "Unauthorized") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }
        console.error("[DELETE /api/sales/discounts]", err)
        return NextResponse.json({ error: "Gagal menghapus skema diskon" }, { status: 500 })
    }
}
