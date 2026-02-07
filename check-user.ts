
import { prisma } from "./lib/prisma"

async function main() {
    const users = await prisma.employee.findMany({
        where: {
            OR: [
                { firstName: { contains: 'Richie', mode: 'insensitive' } },
                { lastName: { contains: 'Richie', mode: 'insensitive' } }
            ]
        }
    })

    console.log("Found users:", users)

    if (users.length === 0) {
        console.log("Creating Richie...")
        const richie = await prisma.employee.create({
            data: {
                employeeId: 'CEO-001',
                firstName: 'Richie',
                lastName: 'Novell',
                email: 'richie@erp.com',
                department: 'Executive',
                position: 'CEO',
                joinDate: new Date(),
                status: 'ACTIVE',
                baseSalary: 100000000
            }
        })
        console.log("Created:", richie)
    }
}

main()
