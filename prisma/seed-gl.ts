
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
    // 2. Create Chart of Accounts (Standard Indonesian COA)
    const accounts = [
        // --- ASSETS (HARTA) ---
        // 1100 - Current Assets (Harta Lancar)
        { code: '1000', name: 'Kas & Setara Kas', type: 'ASSET', isSystem: true },
        { code: '1101', name: 'Kas Besar', type: 'ASSET', isSystem: false },
        { code: '1102', name: 'Petty Cash', type: 'ASSET', isSystem: false },
        { code: '1110', name: 'Bank BCA', type: 'ASSET', isSystem: false },
        { code: '1111', name: 'Bank Mandiri', type: 'ASSET', isSystem: false },
        { code: '1200', name: 'Piutang Usaha (AR)', type: 'ASSET', isSystem: true },
        { code: '1300', name: 'Persediaan Barang Jadi', type: 'ASSET', isSystem: true },
        { code: '1310', name: 'Persediaan Bahan Baku', type: 'ASSET', isSystem: true },
        { code: '1320', name: 'Persediaan Dalam Proses (WIP)', type: 'ASSET', isSystem: true },

        // 1200 - Fixed Assets (Harta Tetap)
        { code: '1500', name: 'Tanah & Bangunan', type: 'ASSET', isSystem: false },
        { code: '1510', name: 'Kendaraan', type: 'ASSET', isSystem: false },
        { code: '1520', name: 'Peralatan Kantor', type: 'ASSET', isSystem: false },
        { code: '1590', name: 'Akumulasi Penyusutan', type: 'ASSET', isSystem: true },

        // --- LIABILITIES (KEWAJIBAN) ---
        // 2100 - Short Term Liabilities
        { code: '2000', name: 'Utang Usaha (AP)', type: 'LIABILITY', isSystem: true },
        { code: '2100', name: 'Utang Gaji', type: 'LIABILITY', isSystem: false },
        { code: '2110', name: 'Utang Pajak (PPN/PPh)', type: 'LIABILITY', isSystem: false },
        { code: '2120', name: 'Biaya Yang Masih Harus Dibayar', type: 'LIABILITY', isSystem: false },

        // 2200 - Long Term Liabilities
        { code: '2500', name: 'Utang Bank Jangka Panjang', type: 'LIABILITY', isSystem: false },

        // --- EQUITY (MODAL) ---
        { code: '3000', name: 'Modal Disetor', type: 'EQUITY', isSystem: true },
        { code: '3100', name: 'Laba Ditahan', type: 'EQUITY', isSystem: true },
        { code: '3200', name: 'Prive Pemilik', type: 'EQUITY', isSystem: false },

        // --- REVENUE (PENDAPATAN) ---
        { code: '4000', name: 'Pendapatan Penjualan', type: 'REVENUE', isSystem: true },
        { code: '4100', name: 'Diskon Penjualan', type: 'REVENUE', isSystem: true },
        { code: '4200', name: 'Retur Penjualan', type: 'REVENUE', isSystem: true },
        { code: '4800', name: 'Pendapatan Lain-lain', type: 'REVENUE', isSystem: false },

        // --- COGS (HPP) ---
        { code: '5000', name: 'Beban Pokok Penjualan (HPP)', type: 'EXPENSE', isSystem: true },
        { code: '5100', name: 'Pembelian Bahan Baku', type: 'EXPENSE', isSystem: true },
        { code: '5200', name: 'Upah Langsung Produksi', type: 'EXPENSE', isSystem: true },

        // --- EXPENSES (BEBAN OPERASIONAL) ---
        // 6100 - Sales & Marketing Expenses
        { code: '6100', name: 'Beban Iklan & Promosi', type: 'EXPENSE', isSystem: false },
        { code: '6110', name: 'Komisi Penjualan', type: 'EXPENSE', isSystem: false },

        // 6200 - General & Admin Expenses
        { code: '6200', name: 'Beban Gaji Kantor', type: 'EXPENSE', isSystem: false },
        { code: '6210', name: 'Beban Listrik, Air, Internet', type: 'EXPENSE', isSystem: false },
        { code: '6220', name: 'Beban Sewa', type: 'EXPENSE', isSystem: false },
        { code: '6230', name: 'Beban Perlengkapan Kantor', type: 'EXPENSE', isSystem: false },
        { code: '6240', name: 'Beban Reparasi & Pemeliharaan', type: 'EXPENSE', isSystem: false },
        { code: '6290', name: 'Beban Penyusutan', type: 'EXPENSE', isSystem: true },

        // --- OTHER EXPENSES ---
        { code: '7100', name: 'Beban Bunga Bank', type: 'EXPENSE', isSystem: false },
        { code: '7200', name: 'Beban Administrasi Bank', type: 'EXPENSE', isSystem: false },
        { code: '7900', name: 'Beban Pajak Penghasilan', type: 'EXPENSE', isSystem: true },
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
    const bankId = accountMap.get('1110') // Bank BCA
    const capitalId = accountMap.get('3000') // Modal Disetor

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
