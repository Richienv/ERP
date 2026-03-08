import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"

async function requireAuth() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new Error("Unauthorized")
    return user
}

// GET /api/finance/currencies — list currencies with latest rates
export async function GET() {
    try {
        await requireAuth()

        const currencies = await prisma.currency.findMany({
            where: { isActive: true },
            include: {
                rates: {
                    orderBy: { date: "desc" },
                    take: 30,
                },
            },
            orderBy: { code: "asc" },
        })

        return NextResponse.json({ success: true, data: currencies })
    } catch (error) {
        console.error("Error fetching currencies:", error)
        return NextResponse.json(
            { success: false, error: "Gagal memuat data mata uang" },
            { status: 500 }
        )
    }
}

// POST /api/finance/currencies — create currency or add exchange rate
export async function POST(request: NextRequest) {
    try {
        await requireAuth()
        const body = await request.json()

        // If action is "add-rate", add a new exchange rate
        if (body.action === "add-rate") {
            const { currencyId, date, buyRate, sellRate, middleRate, source } = body

            if (!currencyId || !date || buyRate == null || sellRate == null || middleRate == null) {
                return NextResponse.json(
                    { success: false, error: "Semua field kurs wajib diisi" },
                    { status: 400 }
                )
            }

            const rate = await prisma.exchangeRate.upsert({
                where: {
                    currencyId_date: {
                        currencyId,
                        date: new Date(date),
                    },
                },
                update: {
                    buyRate,
                    sellRate,
                    middleRate,
                    source: source || "Manual",
                },
                create: {
                    currencyId,
                    date: new Date(date),
                    buyRate,
                    sellRate,
                    middleRate,
                    source: source || "Manual",
                },
            })

            return NextResponse.json(
                { success: true, data: rate, message: "Kurs berhasil disimpan" },
                { status: 201 }
            )
        }

        // Default: create currency
        const { code, name, symbol } = body

        if (!code?.trim() || !name?.trim() || !symbol?.trim()) {
            return NextResponse.json(
                { success: false, error: "Kode, nama, dan simbol mata uang wajib diisi" },
                { status: 400 }
            )
        }

        const existing = await prisma.currency.findUnique({ where: { code: code.trim().toUpperCase() } })
        if (existing) {
            return NextResponse.json(
                { success: false, error: `Mata uang ${code} sudah ada` },
                { status: 409 }
            )
        }

        const currency = await prisma.currency.create({
            data: {
                code: code.trim().toUpperCase(),
                name: name.trim(),
                symbol: symbol.trim(),
            },
        })

        return NextResponse.json(
            { success: true, data: currency, message: "Mata uang berhasil dibuat" },
            { status: 201 }
        )
    } catch (error: any) {
        console.error("Error in currencies POST:", error)

        if (error?.code === "P2002") {
            return NextResponse.json(
                { success: false, error: "Data sudah ada (duplikat)" },
                { status: 409 }
            )
        }

        return NextResponse.json(
            { success: false, error: "Gagal menyimpan data" },
            { status: 500 }
        )
    }
}

// DELETE /api/finance/currencies — delete a rate or deactivate currency
export async function DELETE(request: NextRequest) {
    try {
        await requireAuth()
        const { searchParams } = new URL(request.url)
        const rateId = searchParams.get("rateId")
        const currencyId = searchParams.get("currencyId")

        if (rateId) {
            await prisma.exchangeRate.delete({ where: { id: rateId } })
            return NextResponse.json({ success: true, message: "Kurs berhasil dihapus" })
        }

        if (currencyId) {
            await prisma.currency.update({
                where: { id: currencyId },
                data: { isActive: false },
            })
            return NextResponse.json({ success: true, message: "Mata uang dinonaktifkan" })
        }

        return NextResponse.json({ success: false, error: "ID tidak ditemukan" }, { status: 400 })
    } catch (error) {
        console.error("Error in currencies DELETE:", error)
        return NextResponse.json(
            { success: false, error: "Gagal menghapus data" },
            { status: 500 }
        )
    }
}
