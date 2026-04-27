import { PrismaClient } from "@prisma/client"
import { readFileSync } from "fs"
const prisma = new PrismaClient()

async function main() {
    // Get all tables in DB
    const dbTables: any = await prisma.$queryRawUnsafe(`
        SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name
    `)
    const dbSet = new Set(dbTables.map((t: any) => t.table_name))

    // Get all @@map names from schema
    const schema = readFileSync("prisma/schema.prisma", "utf-8")
    const mapped = [...schema.matchAll(/@@map\("([^"]+)"\)/g)].map(m => m[1])
    const schemaSet = new Set(mapped)

    // Models without @@map use PascalCase model name
    const models = [...schema.matchAll(/^model\s+(\w+)\s*{/gm)].map(m => m[1])
    // Filter to those WITHOUT @@map (Prisma defaults to model name)
    const modelsWithoutMap: string[] = []
    for (const m of models) {
        const modelBlockMatch = schema.match(new RegExp(`model\\s+${m}\\s*\\{[\\s\\S]*?\\n\\}`))
        if (modelBlockMatch && !modelBlockMatch[0].includes("@@map(")) {
            modelsWithoutMap.push(m)
            schemaSet.add(m) // Prisma uses PascalCase as table name
        }
    }

    // Find missing in DB
    const missing: string[] = []
    for (const t of schemaSet) {
        if (!dbSet.has(t)) missing.push(t)
    }

    console.log(`Schema tables: ${schemaSet.size}, DB tables: ${dbSet.size}`)
    console.log(`Models without @@map: ${modelsWithoutMap.length}`)
    if (missing.length > 0) {
        console.log("\n⚠️ MISSING IN DB:")
        missing.forEach(t => console.log(`  - ${t}`))
    } else {
        console.log("\n✅ No drift")
    }
}
main().catch(console.error).finally(() => prisma.$disconnect())
