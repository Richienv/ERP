/**
 * Minimal KRI demo data for local walkthrough.
 * Run: npx tsx scripts/seed-local-kri-demo.ts
 */
import { PrismaClient } from "@prisma/client"
import { LOCAL_DEMO_EMAIL } from "../lib/local-demo"

const prisma = new PrismaClient()

async function main() {
    const user = await prisma.user.upsert({
        where: { email: LOCAL_DEMO_EMAIL },
        create: { email: LOCAL_DEMO_EMAIL, name: "Demo KRI", role: "ADMIN" },
        update: { role: "ADMIN", name: "Demo KRI" },
    })
    await prisma.user.upsert({
        where: { email: "akuntan.kri@local" },
        create: { email: "akuntan.kri@local", name: "Sari Akuntan", role: "ROLE_STAFF" },
        update: { name: "Sari Akuntan" },
    })

    const warehouse = await prisma.warehouse.upsert({
        where: { code: "WH-TABANG" },
        create: { code: "WH-TABANG", name: "Gudang Site Tabang", address: "Tabang, Kutai Kartanegara", isActive: true },
        update: { isActive: true, name: "Gudang Site Tabang" },
    })

    const supplier = await prisma.supplier.upsert({
        where: { code: "SUP-KRI-001" },
        create: { code: "SUP-KRI-001", name: "PT Suku Cadang Tambang", contactName: "Budi" },
        update: { name: "PT Suku Cadang Tambang" },
    })

    const spare = await prisma.product.upsert({
        where: { code: "PRD-SVC-005" },
        create: {
            code: "PRD-SVC-005",
            name: "Filter oli dump truck",
            unit: "Pcs",
            costPrice: 425000,
            isActive: true,
            equipmentType: "spare_part",
        },
        update: { isActive: true, name: "Filter oli dump truck" },
    })

    await prisma.customer.upsert({
        where: { code: "CUST-ADARO" },
        create: {
            code: "CUST-ADARO",
            name: "PT Adaro Indonesia",
            customerType: "COMPANY",
            isActive: true,
        },
        update: { isActive: true, name: "PT Adaro Indonesia" },
    })

    await prisma.vehicle.upsert({
        where: { plateNumber: "KT 8801 TB" },
        create: {
            plateNumber: "KT 8801 TB",
            brand: "Komatsu",
            model: "HD785",
            year: 2022,
            vehicleType: "TRUCK",
            warehouseId: warehouse.id,
            currentLocation: "Site Tabang",
            notes: "Unit demo kapitalisasi",
        },
        update: { isActive: true, currentLocation: "Site Tabang" },
    })

    const existingBill = await prisma.invoice.findFirst({ where: { number: "BILL-DEMO-SETUJUI" } })
    if (!existingBill) {
        await prisma.invoice.create({
            data: {
                number: "BILL-DEMO-SETUJUI",
                type: "INV_IN",
                supplierId: supplier.id,
                status: "DRAFT",
                issueDate: new Date(),
                dueDate: new Date(Date.now() + 7 * 86400000),
                subtotal: 425000,
                taxAmount: 46750,
                totalAmount: 471750,
                balanceDue: 471750,
                items: {
                    create: [{
                        description: spare.name,
                        quantity: 1,
                        unitPrice: 425000,
                        amount: 425000,
                        productId: spare.id,
                    }],
                },
            },
        })
    }

    const { ensureSystemAccounts } = await import("../lib/gl-accounts-server")
    await ensureSystemAccounts()

    console.log("Local KRI demo seeded")
    console.log(`  user=${user.email} role=${user.role}`)
    console.log("  bill=BILL-DEMO-SETUJUI DRAFT")
    console.log("  vehicle=KT 8801 TB")
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
