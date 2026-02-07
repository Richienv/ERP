
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('🌱 Professional Seeding: Enforcing Referential Integrity...')

    // 1. Ensure Prerequisites (PO and WorkOrder) exist
    const customer = await prisma.customer.findFirst() || await prisma.customer.create({
        data: { code: 'CUST-ENT-001', name: 'Enterprise Corp', customerType: 'COMPANY' }
    })

    const product = await prisma.product.findFirst()

    // Create/Find a PO
    const po = await prisma.purchaseOrder.findFirst() || await prisma.purchaseOrder.create({
        data: {
            number: 'PO-2024-PROF-001',
            supplier: {
                create: {
                    code: 'SUP-999',
                    name: 'Premium Textiles Ltd'
                }
            },
            status: 'CONFIRMED'
        }
    })

    // Create/Find a WorkOrder
    let wo = await prisma.workOrder.findFirst({ where: { status: 'IN_PROGRESS' } })
    if (!wo && product) {
        wo = await prisma.workOrder.create({
            data: {
                number: 'WO-2024-BATCH-X',
                productId: product.id,
                plannedQty: 1000,
                status: 'IN_PROGRESS',
                startDate: new Date()
            }
        })
    }

    // 2. Assign Linked Tasks
    const employees = await prisma.employee.findMany({ where: { status: 'ACTIVE' }, take: 10 })

    if (employees.length > 0) {
        console.log('Linking tasks to POs and WorkOrders...')

        // Task linked to PO
        await prisma.employeeTask.create({
            data: {
                employeeId: employees[0].id,
                title: `Verify Inbound: ${po.number}`,
                type: 'PO_REVIEW',
                status: 'IN_PROGRESS',
                priority: 'HIGH',
                purchaseOrderId: po.id, // Hard Link!
                deadline: new Date(Date.now() + 86400000)
            }
        })

        if (wo && employees[1]) {
            // Task linked to WorkOrder
            await prisma.employeeTask.create({
                data: {
                    employeeId: employees[1].id,
                    title: `Monitor Production: ${wo.number}`,
                    type: 'PRODUCTION',
                    status: 'IN_PROGRESS',
                    priority: 'MEDIUM',
                    workOrderId: wo.id, // Hard Link!
                    deadline: new Date(Date.now() + 86400000)
                }
            })
        }
    }

    // 3. Create Quality Inspections Linked to WorkOrder
    const qcStaff = employees.find(e => e.department === 'Quality') || employees[0]

    if (product && qcStaff && wo) {
        console.log('Linking QC to WorkOrder...')

        await prisma.qualityInspection.create({
            data: {
                batchNumber: `${wo.number}-B1`, // Logical batch naming
                materialId: product.id,
                inspectorId: qcStaff.id,
                workOrderId: wo.id, // Hard Link!
                status: 'PASS',
                score: 99.2,
                notes: 'Perfect batch from new line.',
                inspectionDate: new Date()
            }
        })
        console.log('Created linked QC records.')
    }

    console.log('✅ Professional Seed Complete! Data is now Relational.')
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
