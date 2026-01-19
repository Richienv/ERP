import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    try {
        console.log("Start seeding...")

        // ==========================================
        // 1. CLEANUP (Reverse Dependency Order)
        // ==========================================
        await prisma.stockAuditItem.deleteMany({})
        await prisma.stockAudit.deleteMany({})
        await prisma.workOrder.deleteMany({})
        await prisma.purchaseOrderItem.deleteMany({})
        await prisma.purchaseOrder.deleteMany({})
        await prisma.inventoryTransaction.deleteMany({})
        await prisma.stockLevel.deleteMany({})
        await prisma.product.deleteMany({})
        await prisma.category.deleteMany({})
        await prisma.supplier.deleteMany({})
        await prisma.leaveRequest.deleteMany({})
        await prisma.attendance.deleteMany({})
        await prisma.executiveSnapshot.deleteMany({})
        await prisma.employee.deleteMany({})
        await prisma.warehouse.deleteMany({})

        console.log("Cleaned up existing data.")

        // ==========================================
        // 2. WAREHOUSE & CATEGORIES
        // ==========================================
        const warehouse = await prisma.warehouse.create({
            data: { code: 'WH-001', name: 'Gudang Pusat', address: 'Jakarta Industrial Estate' }
        })

        const catRaw = await prisma.category.create({ data: { code: 'CAT-RAW', name: 'Raw Material' } })
        const catFinish = await prisma.category.create({ data: { code: 'CAT-FIN', name: 'Finished Product' } })

        // ==========================================
        // 3. PRODUCTS
        // ==========================================
        const cotton = await prisma.product.create({
            data: { name: 'Cotton 30s', code: 'RM-CTN-30S', unit: 'Roll', categoryId: catRaw.id }
        })

        const dyeRed = await prisma.product.create({
            data: { name: 'Dye - Bright Red', code: 'RM-DYE-RED', unit: 'Can', categoryId: catRaw.id }
        })

        const tshirt = await prisma.product.create({
            data: { name: 'Basic T-Shirt (White) - Bulk', code: 'TS-WHT-001', unit: 'Pcs', categoryId: catFinish.id }
        })

        // ==========================================
        // 4. SUPPLIERS & POs
        // ==========================================
        const supplierA = await prisma.supplier.create({ data: { code: 'SUP-001', name: 'PT. Bahan Baku Utama', contactName: 'Budi Santoso', email: 'budi@bahanbaku.com', phone: '08123456789' } })
        const supplierB = await prisma.supplier.create({ data: { code: 'SUP-002', name: 'CV. Pewarna Abadi', contactName: 'Siti Aminah', email: 'siti@pewarna.com', phone: '08198765432' } })

        // Active POs
        await prisma.purchaseOrder.create({
            data: {
                number: 'PO-2024-001', supplierId: supplierA.id, status: 'OPEN', totalAmount: 50000000, expectedDate: new Date(new Date().setDate(new Date().getDate() + 7)),
                items: { create: [{ productId: cotton.id, quantity: 10, unitPrice: 5000000, totalPrice: 50000000 }] }
            }
        })

        // DELAYED POs
        await prisma.purchaseOrder.create({
            data: {
                number: 'PO-2024-002-LATE', supplierId: supplierA.id, status: 'OPEN', totalAmount: 25000000,
                expectedDate: new Date(new Date().setDate(new Date().getDate() - 5)),
                items: { create: [{ productId: cotton.id, quantity: 5, unitPrice: 5000000, totalPrice: 25000000 }] }
            }
        })

        await prisma.purchaseOrder.create({
            data: {
                number: 'PO-2024-003-LATE', supplierId: supplierB.id, status: 'OPEN', totalAmount: 5000000,
                expectedDate: new Date(new Date().setDate(new Date().getDate() - 2)),
                items: { create: [{ productId: dyeRed.id, quantity: 10, unitPrice: 500000, totalPrice: 5000000 }] }
            }
        })

        // Filler POs
        for (let i = 0; i < 9; i++) {
            await prisma.purchaseOrder.create({
                data: {
                    number: `PO-GEN-${i}`, supplierId: supplierA.id, status: 'OPEN', totalAmount: 5000000,
                    expectedDate: new Date(new Date().setDate(new Date().getDate() + 10)),
                    items: { create: [{ productId: cotton.id, quantity: 1, unitPrice: 5000000, totalPrice: 5000000 }] }
                }
            })
        }

        // ==========================================
        // 5. EMPLOYEES & HR
        // ==========================================
        // Key Employees
        await prisma.employee.create({ data: { employeeId: 'E001', firstName: 'Andi', lastName: 'Saputra', department: 'Sales', position: 'Manager', joinDate: new Date('2020-01-01'), baseSalary: 12000000 } })
        await prisma.employee.create({ data: { employeeId: 'E002', firstName: 'Budi', lastName: 'Kurniawan', department: 'Warehouse', position: 'Staff', joinDate: new Date('2021-03-01'), baseSalary: 5500000 } })
        await prisma.employee.create({ data: { employeeId: 'E003', firstName: 'Dedi', lastName: 'Supriyadi', department: 'Production', position: 'Operator', joinDate: new Date('2022-06-01'), baseSalary: 4800000 } })

        // Filler Employees
        const fillerData = Array(139).fill(0).map((_, i) => ({
            employeeId: `E${100 + i}`, firstName: `Staff ${i}`, department: 'Production', position: 'Operator', joinDate: new Date(), baseSalary: 3111510
        }))
        await prisma.employee.createMany({ data: fillerData })

        // Fetch Employees
        const employees = await prisma.employee.findMany({ where: { employeeId: { in: ['E001', 'E002', 'E003'] } } })
        const andi = employees.find(e => e.employeeId === 'E001')
        const budi = employees.find(e => e.employeeId === 'E002')
        const dedi = employees.find(e => e.employeeId === 'E003')

        // Attendance (Lateness)
        const today = new Date(); today.setHours(0, 0, 0, 0)
        if (andi) await prisma.attendance.create({ data: { employeeId: andi.id, date: today, checkIn: new Date(new Date().setHours(8, 35)), isLate: true } })
        if (budi) await prisma.attendance.create({ data: { employeeId: budi.id, date: today, checkIn: new Date(new Date().setHours(8, 15)), isLate: true } })
        if (dedi) await prisma.attendance.create({ data: { employeeId: dedi.id, date: today, checkIn: new Date(new Date().setHours(8, 10)), isLate: true } })

        // Leaves
        if (andi) await prisma.leaveRequest.create({ data: { employeeId: andi.id, type: 'ANNUAL', startDate: new Date(), endDate: new Date(), reason: 'Family', status: 'PENDING' } })
        if (budi) await prisma.leaveRequest.create({ data: { employeeId: budi.id, type: 'SICK', startDate: new Date(), endDate: new Date(), reason: 'Flu', status: 'PENDING' } })

        // ==========================================
        // 6. INVENTORY OP (Audit)
        // ==========================================
        await prisma.stockAudit.create({
            data: {
                warehouseId: warehouse.id,
                scheduledDate: new Date(),
                status: 'SCHEDULED',
                items: {
                    create: [
                        { productId: cotton.id, expectedQty: 5000 },
                        { productId: dyeRed.id, expectedQty: 200 }
                    ]
                }
            }
        })

        // ==========================================
        // 7. PRODUCTION (Work Order)
        // ==========================================
        await prisma.workOrder.createMany({
            data: [
                { number: 'WO-2024-001', productId: tshirt.id, plannedQty: 1000, actualQty: 250, status: 'IN_PROGRESS', startDate: new Date() },
                { number: 'WO-2024-002', productId: tshirt.id, plannedQty: 5000, actualQty: 0, status: 'PLANNED', startDate: new Date(new Date().setDate(new Date().getDate() + 5)) }
            ]
        })

        // ==========================================
        // 8. EXECUTIVE SNAPSHOT
        // ==========================================
        const snapshot = await prisma.executiveSnapshot.create({
            data: {
                date: new Date(),
                cashBalance: 5000000000,
                burnRate: 45000000,
                accountsReceivable: 3800000000,
                accountsPayable: 2100000000,
                totalRevenue: 2400000000,
                netProfit: 240000000,
                activeHeadcount: 142,
                totalProduction: 12500,
                avgEfficiency: new Prisma.Decimal(88.5)
            }
        })

        console.log('Seeding finished.')
        console.log(`Snapshot ID: ${snapshot.id}`)
        console.log(`Cash: ${snapshot.cashBalance}`)
    } catch (e) {
        console.error(e)
        process.exit(1)
    } finally {
        await prisma.$disconnect()
    }
}

main()
