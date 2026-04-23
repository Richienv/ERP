import { prisma } from "@/lib/db"
import { VehicleForm } from "../vehicle-form"

export const dynamic = "force-dynamic"

export default async function NewVehiclePage() {
    const [warehouses, customers] = await Promise.all([
        prisma.warehouse.findMany({
            where: { isActive: true },
            select: { id: true, code: true, name: true },
            orderBy: { name: "asc" },
        }),
        prisma.customer.findMany({
            select: { id: true, code: true, name: true },
            orderBy: { name: "asc" },
            take: 500,
        }),
    ])

    return <VehicleForm warehouses={warehouses} customers={customers} />
}
