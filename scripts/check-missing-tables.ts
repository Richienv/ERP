import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()
async function main() {
    // Check which tables from Prisma client are missing in DB
    const toCheck = [
        'ceo_flags', 'flag_status',
    ]
    const tables: any = await prisma.$queryRawUnsafe(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name
    `)
    const existing = new Set(tables.map((t: any) => t.table_name))
    console.log("Total public tables:", tables.length)
    console.log("ceo_flags exists?", existing.has('ceo_flags'))

    // Also check enums
    const enums: any = await prisma.$queryRawUnsafe(`
        SELECT typname FROM pg_type WHERE typtype = 'e' ORDER BY typname
    `)
    console.log("FlagStatus enum exists?", enums.some((e: any) => e.typname === 'FlagStatus'))
}
main().catch(console.error).finally(() => prisma.$disconnect())
