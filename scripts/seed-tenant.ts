/**
 * Seed script for new tenant databases.
 * Creates: TenantConfig, default warehouse, basic COA, admin user record.
 *
 * Usage (called by provision-tenant.sh):
 *   DATABASE_URL=... npx tsx scripts/seed-tenant.ts \
 *     --slug garmen --name "PT Garmen" --email admin@garmen.com \
 *     --plan PRO --modules "INVENTORY,SALES" --maxUsers 15
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

function parseArgs(): Record<string, string> {
    const args: Record<string, string> = {}
    const argv = process.argv.slice(2)
    for (let i = 0; i < argv.length; i += 2) {
        const key = argv[i].replace(/^--/, "")
        args[key] = argv[i + 1] || ""
    }
    return args
}

async function main() {
    const args = parseArgs()
    const slug = args.slug
    const name = args.name
    const email = args.email
    const plan = args.plan || "STARTER"
    const modules = (args.modules || "").split(",").filter(Boolean)
    const maxUsers = parseInt(args.maxUsers || "5", 10)

    if (!slug || !name || !email) {
        console.error("Missing required args: --slug, --name, --email")
        process.exit(1)
    }

    console.log(`Seeding tenant: ${name} (${slug})`)

    // 1. TenantConfig
    await (prisma as any).tenantConfig.upsert({
        where: { tenantSlug: slug },
        update: {
            tenantName: name,
            enabledModules: modules,
            maxUsers,
            planType: plan,
        },
        create: {
            tenantSlug: slug,
            tenantName: name,
            enabledModules: modules,
            maxUsers,
            planType: plan,
        },
    })
    console.log("  [OK] TenantConfig")

    // 2. Default warehouse
    const warehouseExists = await prisma.warehouse.findUnique({ where: { code: "WH-UTAMA" } })
    if (!warehouseExists) {
        await prisma.warehouse.create({
            data: {
                code: "WH-UTAMA",
                name: "Gudang Utama",
                address: "-",
                isActive: true,
            },
        })
        console.log("  [OK] Default warehouse: WH-UTAMA")
    } else {
        console.log("  [SKIP] Warehouse WH-UTAMA already exists")
    }

    // 3. Default product categories
    const defaultCategories = [
        { code: "FABRIC", name: "Kain / Fabric" },
        { code: "TRIM", name: "Aksesoris / Trim" },
        { code: "FG", name: "Barang Jadi / Finished Goods" },
        { code: "PACK", name: "Packaging" },
    ]
    for (const cat of defaultCategories) {
        const exists = await prisma.category.findUnique({ where: { code: cat.code } })
        if (!exists) {
            await prisma.category.create({ data: { ...cat, isActive: true } })
            console.log(`  [OK] Category: ${cat.code}`)
        }
    }

    // 4. Basic Chart of Accounts (minimal COA for any plan)
    const defaultCOA = [
        { code: "1000", name: "Kas & Bank", type: "ASSET" as const },
        { code: "1100", name: "Piutang Usaha", type: "ASSET" as const },
        { code: "1200", name: "Persediaan", type: "ASSET" as const },
        { code: "1300", name: "Aset Tetap", type: "ASSET" as const },
        { code: "2000", name: "Hutang Usaha", type: "LIABILITY" as const },
        { code: "2100", name: "Hutang Pajak", type: "LIABILITY" as const },
        { code: "3000", name: "Modal", type: "EQUITY" as const },
        { code: "3100", name: "Laba Ditahan", type: "EQUITY" as const, isSystem: true },
        { code: "4000", name: "Pendapatan Penjualan", type: "REVENUE" as const },
        { code: "4100", name: "Pendapatan Lain-lain", type: "REVENUE" as const },
        { code: "5000", name: "Harga Pokok Penjualan", type: "EXPENSE" as const },
        { code: "5100", name: "Biaya Operasional", type: "EXPENSE" as const },
        { code: "5200", name: "Biaya Gaji", type: "EXPENSE" as const },
        { code: "5300", name: "Biaya Penyusutan", type: "EXPENSE" as const },
    ]
    for (const acct of defaultCOA) {
        const exists = await prisma.gLAccount.findUnique({ where: { code: acct.code } })
        if (!exists) {
            await prisma.gLAccount.create({
                data: {
                    code: acct.code,
                    name: acct.name,
                    type: acct.type,
                    isSystem: (acct as any).isSystem || false,
                },
            })
            console.log(`  [OK] GL Account: ${acct.code} - ${acct.name}`)
        }
    }

    // 5. Admin user record (Supabase auth user must be created separately)
    const adminExists = await prisma.user.findUnique({ where: { email } })
    if (!adminExists) {
        await prisma.user.create({
            data: {
                email,
                name: `Admin ${name}`,
                role: "admin",
            },
        })
        console.log(`  [OK] Admin user: ${email}`)
    } else {
        console.log(`  [SKIP] User ${email} already exists`)
    }

    // 6. Default SystemRoles
    const defaultRoles = [
        { code: "ADMIN", name: "Administrator", permissions: ["ALL"], isSystem: true },
        { code: "MANAGER", name: "Manager", permissions: modules, isSystem: true },
        { code: "STAFF", name: "Staff", permissions: ["INVENTORY", "SALES"], isSystem: true },
    ]
    for (const role of defaultRoles) {
        const exists = await prisma.systemRole.findUnique({ where: { code: role.code } })
        if (!exists) {
            await prisma.systemRole.create({ data: role })
            console.log(`  [OK] SystemRole: ${role.code}`)
        }
    }

    console.log("")
    console.log(`Tenant "${name}" seeded successfully.`)
}

main()
    .catch((e) => {
        console.error("Seed failed:", e)
        process.exit(1)
    })
    .finally(() => prisma.$disconnect())
