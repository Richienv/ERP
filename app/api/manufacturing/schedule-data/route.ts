import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const [workOrdersRaw, machines, routings] = await Promise.all([
            // getSchedulableWorkOrders
            prisma.workOrder.findMany({
                where: {
                    status: { in: ['PLANNED', 'IN_PROGRESS'] },
                },
                include: {
                    product: { select: { name: true, code: true } },
                    machine: { select: { name: true } },
                },
                orderBy: [
                    { scheduledStart: 'asc' },
                    { dueDate: 'asc' },
                ],
            }),
            // getMachinesForScheduling
            prisma.machine.findMany({
                where: { isActive: true },
                select: { id: true, name: true, code: true, status: true },
                orderBy: { name: 'asc' },
            }),
            // getRoutingsForScheduling
            prisma.routing.findMany({
                where: { isActive: true },
                select: { id: true, name: true, code: true },
                orderBy: { name: 'asc' },
            }),
        ])

        const workOrders = workOrdersRaw.map((wo) => ({
            id: wo.id,
            number: wo.number,
            productName: wo.product.name,
            productCode: wo.product.code,
            stage: wo.stage,
            status: wo.status,
            plannedQty: wo.plannedQty,
            actualQty: wo.actualQty,
            startDate: wo.startDate?.toISOString() ?? null,
            dueDate: wo.dueDate?.toISOString() ?? null,
            scheduledStart: wo.scheduledStart?.toISOString() ?? null,
            scheduledEnd: wo.scheduledEnd?.toISOString() ?? null,
            machineName: wo.machine?.name ?? null,
            priority: wo.priority,
        }))

        return NextResponse.json({ workOrders, machines, routings })
    } catch (e) {
        console.error("[API] manufacturing/schedule-data:", e)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
