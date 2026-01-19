
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const employees = await prisma.employee.count()
    const tasks = await prisma.employeeTask.count()
    const audits = await prisma.stockAudit.count()
    const inspections = await prisma.qualityInspection.count()
    const defects = await prisma.inspectionDefect.count()

    console.log('--- DB Verification ---')
    console.log(`Employees: ${employees}`)
    console.log(`Tasks: ${tasks}`)
    console.log(`Audits: ${audits}`)
    console.log(`Inspections: ${inspections}`)
    console.log(`Defects: ${defects}`)
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
