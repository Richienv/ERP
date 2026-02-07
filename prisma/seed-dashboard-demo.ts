
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('🌱 Information Sowing... Seeding Dashboard Demo Data V2...')

    // 1. Workforce (Employees & Attendance)
    console.log('Creating Workforce...')

    // Create Departments
    const departments = ['Production', 'Logistics', 'Quality', 'HR']

    // Create random employees
    const createdEmployees = []
    for (let i = 0; i < 15; i++) {
        const emp = await prisma.employee.create({
            data: {
                employeeId: `EMP-${2024000 + i}`,
                firstName: ['Budi', 'Siti', 'Agus', 'Dewi', 'Rudi', 'Lina', 'Eko', 'Rina'][i % 8],
                lastName: ['Santoso', 'Wijaya', 'Kurniawan', 'Putri', 'Hidayat', 'Sari', 'Pratama', 'Wati'][i % 8],
                department: departments[i % 4],
                position: 'Staff',
                joinDate: new Date(new Date().setFullYear(2023)),
                status: 'ACTIVE',
                baseSalary: 5000000 + (i * 500000)
            }
        }).catch(() => null)
        if (emp) createdEmployees.push(emp)
    }

    // Mark today's attendance
    const today = new Date()
    today.setHours(7, 0, 0, 0)

    const employees = await prisma.employee.findMany({ take: 100 }) // Get all for tasks

    for (const [index, emp] of employees.entries()) {
        const isLate = index > 8 // A few employees late
        const checkInTime = new Date(today)
        checkInTime.setMinutes(isLate ? 45 : Math.floor(Math.random() * 30))

        await prisma.attendance.upsert({
            where: {
                employeeId_date: {
                    employeeId: emp.id,
                    date: new Date(new Date().setHours(0, 0, 0, 0))
                }
            },
            update: {},
            create: {
                employeeId: emp.id,
                date: new Date(new Date().setHours(0, 0, 0, 0)),
                checkIn: checkInTime,
                status: 'PRESENT',
                isLate: isLate
            }
        })
    }

    // 1.5 Create Employee Tasks (New)
    console.log('Assigning Tasks...')
    const taskTypes = ['PO_REVIEW', 'PRODUCTION', 'LOGISTICS', 'SALES', 'QUALITY_CHECK']
    const taskTitles = [
        'Verify Inbound Shipment #442',
        'Calibrate Weaving Machine A-1',
        'Review Monthly Sales Report',
        'Approve Purchase Order #902',
        'Inspect Batch B-2024-001'
    ]

    for (const emp of employees) {
        // Give 70% of employees a task
        if (Math.random() > 0.3) {
            await prisma.employeeTask.create({
                data: {
                    employeeId: emp.id,
                    title: taskTitles[Math.floor(Math.random() * taskTitles.length)],
                    type: taskTypes[Math.floor(Math.random() * taskTypes.length)] as any,
                    status: Math.random() > 0.5 ? 'IN_PROGRESS' : 'PENDING',
                    priority: Math.random() > 0.7 ? 'HIGH' : 'MEDIUM',
                    deadline: new Date(Date.now() + 86400000 * 2)
                }
            })
        }
    }

    // 2. Inventory (Materials & Stock)
    console.log('Creating Inventory...')

    const warehouse = await prisma.warehouse.upsert({
        where: { code: 'WH-MAIN' },
        update: {},
        create: { code: 'WH-MAIN', name: 'Main Warehouse', isActive: true }
    })

    const location = await prisma.location.upsert({
        where: {
            warehouseId_code: {
                warehouseId: warehouse.id,
                code: 'LOC-GEN'
            }
        },
        update: {},
        create: {
            warehouseId: warehouse.id,
            code: 'LOC-GEN',
            name: 'General Storage',
            isActive: true
        }
    })

    const materials = [
        { name: 'Cotton 30s', code: 'MAT-COT-30', unit: 'Roll', stock: 120, min: 50 },
        { name: 'Dye - Bright Red', code: 'MAT-DYE-RED', unit: 'Liters', stock: 5, min: 20 },
        { name: 'Polyester Thread', code: 'MAT-POLY-TH', unit: 'Spools', stock: 35, min: 50 },
        { name: 'Buttons - White', code: 'MAT-BTN-WHT', unit: 'Gross', stock: 200, min: 100 },
        { name: 'Zippers YKK', code: 'MAT-ZIP-YKK', unit: 'Pcs', stock: 0, min: 100 },
    ]

    for (const m of materials) {
        const product = await prisma.product.upsert({
            where: { code: m.code },
            update: { minStock: m.min },
            create: {
                code: m.code,
                name: m.name,
                unit: m.unit,
                minStock: m.min,
                costPrice: 50000,
            }
        })

        await prisma.stockLevel.upsert({
            where: {
                productId_warehouseId_locationId: {
                    productId: product.id,
                    warehouseId: warehouse.id,
                    locationId: location.id
                }
            },
            update: { quantity: m.stock },
            create: {
                productId: product.id,
                warehouseId: warehouse.id,
                locationId: location.id,
                quantity: m.stock,
                availableQty: m.stock
            }
        })
    }

    // 3. Activity Feed (Movements, Invoices)
    console.log('Creating Activities...')

    const customer = await prisma.customer.findFirst() || await prisma.customer.create({
        data: { code: 'CUST-DEMO', name: 'Demo Customer', customerType: 'COMPANY' }
    })

    await prisma.invoice.create({
        data: {
            number: `INV-DEMO-${Date.now()}`,
            customerId: customer.id,
            type: 'INV_OUT',
            issueDate: new Date(),
            dueDate: new Date(Date.now() + 86400000 * 30),
            subtotal: 15000000,
            taxAmount: 1650000,
            totalAmount: 16650000,
            balanceDue: 16650000,
            status: 'ISSUED'
        }
    })

    const product = await prisma.product.findFirst()
    if (product) {
        await prisma.inventoryTransaction.create({
            data: {
                productId: product.id,
                warehouseId: warehouse.id,
                type: 'IN',
                quantity: 50,
                createdAt: new Date(Date.now() - 1000 * 60 * 30),
                performedBy: 'Gudang Staff'
            }
        })
    }

    // 4. Quality (Inspections & Audits)
    console.log('Creating QC Inspections...')

    const qcStaff = await prisma.employee.findFirst({ where: { department: 'Quality' } }) || employees[0]

    // Create detailed inspections for "Big ERP" feel
    if (product && qcStaff) {
        // 1. Pass Inspection
        await prisma.qualityInspection.create({
            data: {
                batchNumber: 'BATCH-2024-001',
                materialId: product.id,
                inspectorId: qcStaff.id,
                status: 'PASS',
                score: 98.5,
                notes: 'Passed all criteria.',
                inspectionDate: new Date()
            }
        })

        // 2. Fail Inspection with Defect
        const failedInspection = await prisma.qualityInspection.create({
            data: {
                batchNumber: 'BATCH-2024-002',
                materialId: product.id, // Using same product for demo
                inspectorId: qcStaff.id,
                status: 'FAIL',
                score: 45.0,
                notes: 'Serious color deviation.',
                inspectionDate: new Date(Date.now() - 3600000 * 4) // 4 hours ago
            }
        })

        await prisma.inspectionDefect.create({
            data: {
                inspectionId: failedInspection.id,
                type: 'MAJOR',
                description: 'Color deltaE > 3.0',
                actionTaken: 'REWORK'
            }
        })
    }

    await prisma.stockAudit.create({
        data: {
            warehouseId: warehouse.id,
            scheduledDate: new Date(),
            status: 'COMPLETED',
            notes: 'Routine Weekly Check'
        }
    })

    await prisma.stockAudit.create({
        data: {
            warehouseId: warehouse.id,
            scheduledDate: new Date(Date.now() - 86400000),
            status: 'CANCELLED',
            notes: 'Discrepancy found'
        }
    })

    // 5. Production (Machines & Alerts)
    console.log('Creating Production Status...')

    const machines = [
        { code: 'MCH-001', name: 'Weaving A-1', status: 'RUNNING' },
        { code: 'MCH-002', name: 'Dyeing B-2', status: 'BREAKDOWN' },
        { code: 'MCH-003', name: 'Cutting C-3', status: 'IDLE' },
        { code: 'MCH-004', name: 'Sewing D-4', status: 'RUNNING' },
    ]

    for (const m of machines) {
        await prisma.machine.upsert({
            where: { code: m.code },
            update: { status: m.status as any },
            create: {
                code: m.code,
                name: m.name,
                status: m.status as any,
                capacityPerHour: 100
            }
        })
    }

    console.log('✅ Dashboard Demo Data Seeded!')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
