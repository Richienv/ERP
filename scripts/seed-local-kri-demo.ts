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

    // Relative expiries so the /fleet war room stays visible on every local seed.
    const day = (offset: number) => {
        const d = new Date()
        d.setHours(12, 0, 0, 0)
        d.setDate(d.getDate() + offset)
        return d
    }
    const demoDocs = {
        stnkNumber: "STNK-8801",
        stnkExpiry: day(-12),
        kirNumber: "KIR-8801",
        kirExpiry: day(14),
        insurancePolicyNumber: "POL-8801",
        insuranceExpiry: day(200),
        insurer: "Jasindo",
    }

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
            notes: "Unit demo kapitalisasi + dokumen habis/jatuh tempo",
            ...demoDocs,
        },
        update: {
            isActive: true,
            currentLocation: "Site Tabang",
            ...demoDocs,
        },
    })

    await prisma.vehicle.upsert({
        where: { plateNumber: "KT 8812 TB" },
        create: {
            plateNumber: "KT 8812 TB",
            brand: "Scania",
            model: "P410",
            year: 2021,
            vehicleType: "TRUCK",
            warehouseId: warehouse.id,
            currentLocation: "Site Tabang",
            notes: "Unit demo asuransi habis — war room dua plat",
            stnkNumber: "STNK-8812",
            stnkExpiry: day(8),
            kirNumber: "KIR-8812",
            insurancePolicyNumber: "POL-8812",
            insuranceExpiry: day(-3),
            insurer: "Askrida",
        },
        update: {
            isActive: true,
            currentLocation: "Site Tabang",
            stnkExpiry: day(8),
            insuranceExpiry: day(-3),
            insurer: "Askrida",
        },
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

    // PO 100 / GRN 60 / bill 100 → OVER_BILLED so Verifikasi 3 Arah is visible.
    const matchPo = await prisma.purchaseOrder.upsert({
        where: { number: "PO-DEMO-MATCH" },
        create: {
            number: "PO-DEMO-MATCH",
            supplierId: supplier.id,
            status: "PARTIAL_RECEIVED",
            totalAmount: 42500000,
            taxAmount: 4675000,
            netAmount: 47175000,
            items: {
                create: [{
                    productId: spare.id,
                    quantity: 100,
                    receivedQty: 60,
                    unitPrice: 425000,
                    totalPrice: 42500000,
                }],
            },
        },
        update: { status: "PARTIAL_RECEIVED" },
    })
    const matchPoItem = await prisma.purchaseOrderItem.findFirst({
        where: { purchaseOrderId: matchPo.id, productId: spare.id },
    })
    if (matchPoItem && matchPoItem.receivedQty !== 60) {
        await prisma.purchaseOrderItem.update({
            where: { id: matchPoItem.id },
            data: { receivedQty: 60, quantity: 100 },
        })
    }
    if (matchPoItem) {
        await prisma.goodsReceivedNote.upsert({
            where: { number: "GRN-DEMO-MATCH" },
            create: {
                number: "GRN-DEMO-MATCH",
                purchaseOrderId: matchPo.id,
                warehouseId: warehouse.id,
                status: "ACCEPTED",
                acceptedAt: new Date(),
                items: {
                    create: [{
                        poItemId: matchPoItem.id,
                        productId: spare.id,
                        quantityOrdered: 100,
                        quantityReceived: 60,
                        quantityAccepted: 60,
                        unitCost: 425000,
                    }],
                },
            },
            update: { status: "ACCEPTED" },
        })
    }
    const matchBill = await prisma.invoice.findFirst({ where: { number: "BILL-DEMO-MATCH" } })
    if (!matchBill) {
        await prisma.invoice.create({
            data: {
                number: "BILL-DEMO-MATCH",
                type: "INV_IN",
                supplierId: supplier.id,
                purchaseOrderId: matchPo.id,
                status: "DRAFT",
                issueDate: new Date(),
                dueDate: new Date(Date.now() + 7 * 86400000),
                subtotal: 42500000,
                taxAmount: 4675000,
                totalAmount: 47175000,
                balanceDue: 47175000,
                items: {
                    create: [{
                        description: spare.name,
                        quantity: 100,
                        unitPrice: 425000,
                        amount: 42500000,
                        productId: spare.id,
                    }],
                },
            },
        })
    } else if (!matchBill.purchaseOrderId) {
        await prisma.invoice.update({
            where: { id: matchBill.id },
            data: { purchaseOrderId: matchPo.id, status: "DRAFT" },
        })
    }

    const { ensureSystemAccounts } = await import("../lib/gl-accounts-server")
    await ensureSystemAccounts()

    console.log("Local KRI demo seeded")
    console.log(`  user=${user.email} role=${user.role}`)
    console.log("  bill=BILL-DEMO-SETUJUI DRAFT")
    console.log("  bill=BILL-DEMO-MATCH DRAFT (PO 100 / GRN 60 / bill 100)")
    console.log("  vehicle=KT 8801 TB (STNK habis, KIR ≤30 hari)")
    console.log("  vehicle=KT 8812 TB (asuransi habis, STNK ≤30 hari)")
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
