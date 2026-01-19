
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('🌱 Lite Seeding: Filling missing Big ERP data...')

    // 1. Assign Tasks to Existing Employees
    const employees = await prisma.employee.findMany({
        where: { status: 'ACTIVE' },
        take: 20
    })

    if (employees.length === 0) {
        console.log('No employees found, skipping tasks.')
    } else {
        console.log(`Assigning tasks to subset of ${employees.length} employees...`)
        const taskTypes = ['PO_REVIEW', 'PRODUCTION', 'LOGISTICS', 'SALES', 'QUALITY_CHECK']
        const taskTitles = [
            'Verify Inbound Shipment #442',
            'Calibrate Weaving Machine A-1',
            'Review Monthly Sales Report',
            'Approve Purchase Order #902',
            'Inspect Batch B-2024-001'
        ]

        let taskCount = 0
        for (const emp of employees) {
            // Give 80% of top 20 employees a task
            if (Math.random() > 0.2) {
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
                taskCount++
            }
        }
        console.log(`Created ${taskCount} tasks.`)
    }

    // 2. Create Quality Inspections
    const product = await prisma.product.findFirst()
    const qcStaff = employees.find(e => e.department === 'Quality') || employees[0]

    if (product && qcStaff) {
        console.log('Creating QC Inspections...')

        // Pass
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

        // Fail
        const failedInspection = await prisma.qualityInspection.create({
            data: {
                batchNumber: 'BATCH-2024-002',
                materialId: product.id,
                inspectorId: qcStaff.id, // Ensure this ID exists
                status: 'FAIL',
                score: 45.0,
                notes: 'Serious color deviation.',
                inspectionDate: new Date(Date.now() - 3600000 * 4)
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
        console.log('Created QC records.')
    } else {
        console.log('Skipping QC: No product or staff found.')
    }

    console.log('✅ Lite Seed Complete!')
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
