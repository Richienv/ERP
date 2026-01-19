
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Start seeding General Ledger (GLAccount)...')

    try {
        await (prisma as any).journalLine.deleteMany()
        await (prisma as any).journalEntry.deleteMany()
        await (prisma as any).gLAccount.deleteMany() // Note: Prisma likely generates gLAccount or GLAccount. We'll check "glAccount" or "gLAccount"
        // Based on defaults: GLAccount -> gLAccount usually
        console.log('Cleared existing GL data.')
    } catch (e) {
        console.log('Error clearing data, likely empty tables or model mismatch', e)
    }

    // 2. Create Chart of Accounts
    const accounts = [
        // --- ASSETS ---
        { code: '1000', name: 'Kas & Bank', type: 'ASSET', isSystem: true },
        { code: '1010', name: 'Bank BCA', type: 'ASSET', isSystem: false },
        { code: '1020', name: 'Petty Cash', type: 'ASSET', isSystem: false },
        { code: '1200', name: 'Piutang Usaha (AR)', type: 'ASSET', isSystem: true },
        { code: '1400', name: 'Persediaan (Inventory)', type: 'ASSET', isSystem: true },

        // --- LIABILITIES ---
        { code: '2000', name: 'Utang Usaha (AP)', type: 'LIABILITY', isSystem: true },
        { code: '2100', name: 'Utang Gaji', type: 'LIABILITY', isSystem: false },
        { code: '2200', name: 'Utang Pajak', type: 'LIABILITY', isSystem: false },

        // --- EQUITY ---
        { code: '3000', name: 'Modal Disetor', type: 'EQUITY', isSystem: true },
        { code: '3100', name: 'Laba Ditahan', type: 'EQUITY', isSystem: true },

        // --- REVENUE ---
        { code: '4000', name: 'Pendapatan Penjualan', type: 'REVENUE', isSystem: true },

        // --- EXPENSES ---
        { code: '6000', name: 'Beban Pokok Penjualan (HPP)', type: 'EXPENSE', isSystem: true },
        { code: '6100', name: 'Beban Gaji', type: 'EXPENSE', isSystem: false },
        { code: '6200', name: 'Beban Operasional', type: 'EXPENSE', isSystem: false },
        { code: '6300', name: 'Beban Pemasaran', type: 'EXPENSE', isSystem: false },
    ]

    const accountMap = new Map<string, string>()

    // Using 'as any' to bypass specific model name casing issues (gLAccount vs GLAccount)
    // We'll try gLAccount first as that's typical Prisma camelCase for GLAccount
    const glDelegate = (prisma as any).gLAccount || (prisma as any).glAccount || (prisma as any).GLAccount

    if (!glDelegate) {
        throw new Error("Could not find GLAccount delegate on prisma client. Check generated client.")
    }

    for (const acc of accounts) {
        const created = await glDelegate.create({
            data: {
                code: acc.code,
                name: acc.name,
                type: acc.type,
                isSystem: acc.isSystem
            },
        })
        accountMap.set(acc.code, created.id)
        console.log(`Created GLAccount: ${acc.code} - ${acc.name}`)
    }

    // 3. Create Opening Balance Journal Entry
    const bankId = accountMap.get('1010')
    const capitalId = accountMap.get('3000')

    if (bankId && capitalId) {
        console.log('Creating Opening Balance Journal Entry...')

        await (prisma as any).journalEntry.create({
            data: {
                description: 'Opening Balance',
                reference: 'OPEN-001',
                date: new Date(),
                lines: {
                    create: [
                        // Debit: Bank BCA (2.45 M)
                        {
                            accountId: bankId,
                            debit: 2450000000.00,
                            credit: 0
                        },
                        // Credit: Modal Disetor (2.45 M)
                        {
                            accountId: capitalId,
                            debit: 0,
                            credit: 2450000000.00
                        }
                    ]
                }
            }
        })

        await glDelegate.update({
            where: { id: bankId },
            data: { balance: { increment: 2450000000.00 } }
        })
        await glDelegate.update({
            where: { id: capitalId },
            data: { balance: { increment: 2450000000.00 } }
        })

        console.log('Balances initialized.')
    }

    console.log('Seeding finished.')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
