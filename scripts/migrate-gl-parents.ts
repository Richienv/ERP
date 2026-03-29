import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

// Explicit parent assignments based on Indonesian COA structure from seed-gl.ts
const PARENT_MAP: Record<string, string> = {
    // Cash & Bank children -> parent 1000 Kas & Setara Kas
    "1101": "1000",
    "1102": "1000",
    "1110": "1000",
    "1111": "1000",

    // Inventory children -> parent 1300 Persediaan Barang Jadi
    "1310": "1300",
    "1320": "1300",
    "1330": "1300",

    // Fixed Asset children -> parent 1500 Tanah & Bangunan
    "1510": "1500",
    "1520": "1500",
    "1590": "1500",

    // Liability children -> parent 2100 Utang Gaji
    "2110": "2100",
    "2120": "2100",
    "2121": "2100",

    // Equity children -> parent 3000 Modal Disetor
    "3100": "3000",
    "3200": "3000",

    // Revenue children -> parent 4000 Pendapatan Penjualan
    "4100": "4000",
    "4200": "4000",
    "4800": "4000",

    // COGS children -> parent 5000 HPP
    "5100": "5000",
    "5200": "5000",

    // Sales expense children -> parent 6100 Beban Iklan
    "6110": "6100",

    // Admin expense children -> parent 6200 Beban Gaji Kantor
    "6210": "6200",
    "6220": "6200",
    "6230": "6200",
    "6240": "6200",
    "6290": "6200",

    // Other expense children -> parent 7100 Beban Bunga Bank
    "7200": "7100",
}

async function main() {
    console.log("Assigning parentId to GL accounts...")

    const accounts = await prisma.gLAccount.findMany({ select: { id: true, code: true } })
    const codeToId = new Map(accounts.map(a => [a.code, a.id]))

    console.log(`Found ${accounts.length} GL accounts in database.\n`)

    let updated = 0
    let skipped = 0
    for (const [childCode, parentCode] of Object.entries(PARENT_MAP)) {
        const childId = codeToId.get(childCode)
        const parentId = codeToId.get(parentCode)

        if (childId && parentId) {
            await prisma.gLAccount.update({
                where: { id: childId },
                data: { parentId },
            })
            console.log(`  ${childCode} -> parent ${parentCode}`)
            updated++
        } else {
            const missing = !childId ? `child ${childCode}` : `parent ${parentCode}`
            console.log(`  SKIP ${childCode} -> ${parentCode} (${missing} not found in DB)`)
            skipped++
        }
    }

    console.log(`\nDone. Updated ${updated} accounts, skipped ${skipped}.`)
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
