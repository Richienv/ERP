import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

const BULAN_INDONESIA = [
    "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
]

async function requireAuth() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new Error("Unauthorized")
    return user
}

// GET — list all fiscal periods, optionally filter by year
export async function GET(req: NextRequest) {
    try {
        await requireAuth()

        const { searchParams } = new URL(req.url)
        const year = searchParams.get("year")

        const periods = await prisma.fiscalPeriod.findMany({
            where: year ? { year: parseInt(year) } : undefined,
            orderBy: [{ year: "desc" }, { month: "asc" }],
        })

        return NextResponse.json({ data: periods })
    } catch (error: any) {
        if (error.message === "Unauthorized") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }
        console.error("GET fiscal-periods error:", error)
        return NextResponse.json({ error: "Gagal memuat periode fiskal" }, { status: 500 })
    }
}

// POST — generate 12 periods for a year, or close/reopen a period
export async function POST(req: NextRequest) {
    try {
        const user = await requireAuth()
        const body = await req.json()

        // Action: generate year
        if (body.action === "generate") {
            const year = body.year as number
            if (!year || year < 2020 || year > 2099) {
                return NextResponse.json({ error: "Tahun tidak valid (2020-2099)" }, { status: 400 })
            }

            // Check if any periods already exist for this year
            const existing = await prisma.fiscalPeriod.count({ where: { year } })
            if (existing > 0) {
                return NextResponse.json({ error: `Periode fiskal ${year} sudah ada` }, { status: 409 })
            }

            const periods = []
            for (let month = 1; month <= 12; month++) {
                const startDate = new Date(year, month - 1, 1)
                const endDate = new Date(year, month, 0) // last day of month
                periods.push({
                    year,
                    month,
                    name: `${BULAN_INDONESIA[month]} ${year}`,
                    startDate,
                    endDate,
                    isClosed: false,
                })
            }

            await prisma.fiscalPeriod.createMany({ data: periods })

            const created = await prisma.fiscalPeriod.findMany({
                where: { year },
                orderBy: { month: "asc" },
            })

            return NextResponse.json({ data: created, message: `12 periode fiskal ${year} berhasil dibuat` })
        }

        // Action: close period
        if (body.action === "close") {
            const id = body.id as string
            if (!id) return NextResponse.json({ error: "ID periode diperlukan" }, { status: 400 })

            const period = await prisma.fiscalPeriod.findUnique({ where: { id } })
            if (!period) return NextResponse.json({ error: "Periode tidak ditemukan" }, { status: 404 })
            if (period.isClosed) return NextResponse.json({ error: "Periode sudah ditutup" }, { status: 400 })

            const updated = await prisma.fiscalPeriod.update({
                where: { id },
                data: {
                    isClosed: true,
                    closedAt: new Date(),
                    closedBy: user.email ?? "unknown",
                },
            })

            return NextResponse.json({ data: updated, message: `${period.name} berhasil ditutup` })
        }

        // Action: reopen period
        if (body.action === "reopen") {
            const id = body.id as string
            if (!id) return NextResponse.json({ error: "ID periode diperlukan" }, { status: 400 })

            const period = await prisma.fiscalPeriod.findUnique({ where: { id } })
            if (!period) return NextResponse.json({ error: "Periode tidak ditemukan" }, { status: 404 })
            if (!period.isClosed) return NextResponse.json({ error: "Periode belum ditutup" }, { status: 400 })

            const updated = await prisma.fiscalPeriod.update({
                where: { id },
                data: {
                    isClosed: false,
                    closedAt: null,
                    closedBy: null,
                },
            })

            return NextResponse.json({ data: updated, message: `${period.name} berhasil dibuka kembali` })
        }

        return NextResponse.json({ error: "Aksi tidak dikenali" }, { status: 400 })
    } catch (error: any) {
        if (error.message === "Unauthorized") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }
        console.error("POST fiscal-periods error:", error)
        return NextResponse.json({ error: "Gagal memproses permintaan" }, { status: 500 })
    }
}
