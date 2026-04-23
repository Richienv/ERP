import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()
async function main() {
    const checks: any = await prisma.$queryRawUnsafe(`
        SELECT
            (SELECT count(*) FROM information_schema.tables WHERE table_name = 'vehicles') as table_exists,
            (SELECT count(*) FROM information_schema.columns WHERE table_name = 'vehicles') as column_count,
            (SELECT typname FROM pg_type WHERE typname = 'VehicleType') as enum_type,
            (SELECT typname FROM pg_type WHERE typname = 'VehicleStatus') as enum_status
    `)
    console.log("Vehicle schema verification:", Object.entries(checks[0]).map(([k,v]) => k+": "+v).join(" | "))

    // Test insert
    const wh = await prisma.warehouse.findFirst()
    if (!wh) {
        console.log("⚠️ No warehouse — skipping insert test")
        return
    }
    const test = await prisma.vehicle.create({
        data: {
            plateNumber: "TEST-VEHICLE-001",
            brand: "Toyota",
            model: "Hilux DC",
            year: 2024,
            vehicleType: "LIGHT_VEHICLE",
            status: "AVAILABLE",
            warehouseId: wh.id,
            dailyRate: 750000,
            monthlyRate: 18000000,
        }
    })
    console.log(`\n✓ Test insert OK: id=${test.id}, plate=${test.plateNumber}`)
    await prisma.vehicle.delete({ where: { id: test.id } })
    console.log("✓ Cleanup OK")
}
main().catch((e) => { console.error("❌", e); process.exit(1) }).finally(() => prisma.$disconnect())
