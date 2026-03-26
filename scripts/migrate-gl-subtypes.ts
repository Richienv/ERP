import { PrismaClient } from "@prisma/client"

function inferSubType(code: string): string {
    const num = parseInt(code, 10)
    if (isNaN(num)) return "GENERAL"
    if (num >= 1000 && num <= 1199) return "ASSET_CASH"
    if (num >= 1200 && num <= 1299) return "ASSET_RECEIVABLE"
    if (num >= 1300 && num <= 1329) return "ASSET_CURRENT"
    if (num >= 1330 && num <= 1399) return "ASSET_PREPAYMENTS"
    if (num >= 1400 && num <= 1499) return "ASSET_CURRENT"
    if (num >= 1500 && num <= 1799) return "ASSET_FIXED"
    if (num >= 1800 && num <= 1999) return "ASSET_NON_CURRENT"
    if (num >= 2000 && num <= 2099) return "LIABILITY_PAYABLE"
    if (num >= 2100 && num <= 2499) return "LIABILITY_CURRENT"
    if (num >= 2500 && num <= 2999) return "LIABILITY_NON_CURRENT"
    if (num === 3300) return "EQUITY_UNAFFECTED"
    if (num >= 3000 && num <= 3999) return "EQUITY"
    if (num >= 4000 && num <= 4199) return "INCOME"
    if (num >= 4200 && num <= 4999) return "INCOME_OTHER"
    if (num >= 5000 && num <= 5999) return "EXPENSE_DIRECT_COST"
    if (num === 6290) return "EXPENSE_DEPRECIATION"
    if (num >= 6000 && num <= 6999) return "EXPENSE"
    if (num >= 7000 && num <= 7999) return "EXPENSE_DEPRECIATION"
    if (num >= 8000 && num <= 9999) return "EXPENSE"
    return "GENERAL"
}

const prisma = new PrismaClient()

async function main() {
    console.log("Assigning subType to GL accounts...")
    const accounts = await prisma.gLAccount.findMany({ select: { id: true, code: true, subType: true } })

    let updated = 0
    for (const acc of accounts) {
        const newSubType = inferSubType(acc.code)
        if (acc.subType !== newSubType) {
            await prisma.gLAccount.update({
                where: { id: acc.id },
                data: { subType: newSubType as any },
            })
            console.log(`  ${acc.code} → ${newSubType}`)
            updated++
        }
    }
    console.log(`Done. Updated ${updated} of ${accounts.length} accounts.`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
