import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const CURRENCIES = [
    { code: "USD", name: "Dolar Amerika", symbol: "$" },
    { code: "EUR", name: "Euro", symbol: "\u20ac" },
    { code: "SGD", name: "Dolar Singapura", symbol: "S$" },
    { code: "CNY", name: "Yuan Tiongkok", symbol: "\u00a5" },
    { code: "JPY", name: "Yen Jepang", symbol: "\u00a5" },
    { code: "KRW", name: "Won Korea", symbol: "\u20a9" },
]

async function main() {
    console.log("Seeding currencies...")
    for (const c of CURRENCIES) {
        const existing = await prisma.currency.findUnique({ where: { code: c.code } })
        if (existing) {
            console.log(`  SKIP ${c.code} (already exists)`)
            continue
        }
        await prisma.currency.create({ data: c })
        console.log(`  CREATED ${c.code}`)
    }
    console.log("Done.")
}

main().catch(console.error).finally(() => prisma.$disconnect())
