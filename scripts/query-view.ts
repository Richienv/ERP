import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()
async function main() {
    const result: any = await prisma.$queryRawUnsafe(`SELECT pg_get_viewdef('mv_inventory_status'::regclass, true) as def`)
    console.log(result[0]?.def ?? "no view found")
    // Also get index definitions on the view
    const indexes: any = await prisma.$queryRawUnsafe(`SELECT indexdef FROM pg_indexes WHERE tablename = 'mv_inventory_status'`)
    console.log("\n-- Indexes:")
    indexes.forEach((i: any) => console.log(i.indexdef))
}
main().catch(console.error).finally(() => prisma.$disconnect())
