"use server"

import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

async function requireAuth() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new Error("Unauthorized")
    return user
}

export async function getPaymentTerms() {
    await requireAuth()
    return prisma.paymentTerm.findMany({
        where: { isActive: true },
        include: { lines: { orderBy: { sequence: "asc" } } },
        orderBy: { days: "asc" },
    })
}

export async function createPaymentTerm(data: {
    code: string
    name: string
    days: number
    lines: Array<{ sequence: number; percentage: number; days: number }>
}) {
    await requireAuth()

    const totalPct = data.lines.reduce((sum, l) => sum + l.percentage, 0)
    if (Math.abs(totalPct - 100) > 0.01) {
        throw new Error("Total persentase harus 100%")
    }

    return prisma.paymentTerm.create({
        data: {
            code: data.code,
            name: data.name,
            days: data.days,
            lines: {
                create: data.lines.map(l => ({
                    sequence: l.sequence,
                    percentage: l.percentage,
                    days: l.days,
                })),
            },
        },
        include: { lines: true },
    })
}

export async function deletePaymentTerm(id: string) {
    await requireAuth()

    const term = await prisma.paymentTerm.findUnique({ where: { id } })
    if (!term) throw new Error("Termin tidak ditemukan")
    if (term.isDefault) throw new Error("Tidak bisa hapus termin default")

    return prisma.paymentTerm.delete({ where: { id } })
}
