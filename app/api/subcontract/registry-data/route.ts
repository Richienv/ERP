import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const subs = await prisma.subcontractor.findMany({
            orderBy: { name: 'asc' },
            include: {
                _count: {
                    select: {
                        rates: true,
                        orders: {
                            where: {
                                status: {
                                    in: ['SC_SENT', 'SC_IN_PROGRESS', 'SC_PARTIAL_COMPLETE'],
                                },
                            },
                        },
                    },
                },
            },
        })

        const subcontractors = subs.map((s) => ({
            id: s.id,
            name: s.name,
            npwp: s.npwp,
            address: s.address,
            capabilities: s.capabilities,
            capacityUnitsPerDay: s.capacityUnitsPerDay,
            contactPerson: s.contactPerson,
            phone: s.phone,
            email: s.email,
            isActive: s.isActive,
            activeOrderCount: s._count.orders,
            rateCount: s._count.rates,
        }))

        return NextResponse.json({ subcontractors })
    } catch (e) {
        console.error("[API] subcontract/registry-data:", e)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
