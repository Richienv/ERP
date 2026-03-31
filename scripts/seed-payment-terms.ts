import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const TERMS = [
    { code: "CASH",   name: "Tunai",       days: 0,  isDefault: false },
    { code: "COD",    name: "COD",          days: 0,  isDefault: false },
    { code: "NET_15", name: "Net 15 Hari",  days: 15, isDefault: false },
    { code: "NET_30", name: "Net 30 Hari",  days: 30, isDefault: true  },
    { code: "NET_45", name: "Net 45 Hari",  days: 45, isDefault: false },
    { code: "NET_60", name: "Net 60 Hari",  days: 60, isDefault: false },
    { code: "NET_90", name: "Net 90 Hari",  days: 90, isDefault: false },
]

async function main() {
    console.log("Seeding payment terms...")

    for (const term of TERMS) {
        const existing = await prisma.paymentTerm.findUnique({ where: { code: term.code } })
        if (existing) {
            console.log(`  SKIP ${term.code} (already exists)`)
            continue
        }

        const created = await prisma.paymentTerm.create({
            data: {
                ...term,
                lines: {
                    create: [{ sequence: 1, percentage: 100, days: term.days }],
                },
            },
        })
        console.log(`  CREATED ${term.code} → ${created.id}`)
    }

    console.log("Done.")
}

main().catch(console.error).finally(() => prisma.$disconnect())
