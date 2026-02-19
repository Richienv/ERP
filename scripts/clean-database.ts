import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('🗑️  Function to clean database started...')

    try {
        // 1. Get all table names from the public schema
        const tables: { tablename: string }[] = await prisma.$queryRaw`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != '_prisma_migrations';
    `

        if (tables.length === 0) {
            console.log('⚠️  No tables found to clean.')
            return
        }

        // 2. Construct valid table names with quotes to handle mixed case/special chars
        const tableNames = tables
            .map((t) => `"${t.tablename}"`)
            .join(', ')

        console.log(`🧹 Found ${tables.length} tables. Cleaning data...`)

        // 3. Truncate all tables with CASCADE to handle foreign key constraints
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE;`)

        console.log('✅ Database cleaned successfully! All data has been wiped (tables preserved).')
    } catch (error) {
        console.error('❌ Error cleaning database:', error)
        process.exit(1)
    } finally {
        await prisma.$disconnect()
    }
}

main()
