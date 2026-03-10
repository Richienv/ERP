/**
 * Seed: Bank Reconciliation demo data
 *
 * Creates a BankReconciliation for "Bank BCA" (code 1110) with 12 bank
 * statement items (Jan–Mar 2026).  Also creates matching POSTED journal
 * entries for 6 of the 12 items so the auto-match algorithm can find
 * HIGH, MEDIUM, and LOW confidence matches as well as truly unmatched rows.
 *
 * Run standalone:  npx tsx prisma/seed-bank-reconciliation.ts
 */

import { PrismaClient } from '@prisma/client'

/**
 * Seed bank reconciliation data. Accepts an optional PrismaClient instance
 * so it can be called from the main seed.ts or run standalone.
 */
export async function seedBankReconciliation(externalPrisma?: PrismaClient) {
    const prisma = externalPrisma ?? new PrismaClient()
    const shouldDisconnect = !externalPrisma

    try {
        return await _seed(prisma)
    } finally {
        if (shouldDisconnect) await prisma.$disconnect()
    }
}

async function _seed(prisma: PrismaClient) {
    console.log('=== Seed Bank Reconciliation ===')

    // ---------------------------------------------------------------
    // 0. Cleanup existing bank reconciliation data
    // ---------------------------------------------------------------
    await prisma.bankReconciliationItem.deleteMany({})
    await prisma.bankReconciliation.deleteMany({})
    console.log('Cleared existing bank reconciliation data.')

    // ---------------------------------------------------------------
    // 1. Find Bank BCA GL account (seeded by seed-gl.ts, code "1110")
    // ---------------------------------------------------------------
    const bankBCA = await prisma.gLAccount.findFirst({
        where: { code: '1110' },
    })

    if (!bankBCA) {
        console.error(
            'Bank BCA (code 1110) not found. Run seed-gl.ts first:\n' +
            '  npx tsx prisma/seed-gl.ts'
        )
        process.exit(1)
    }

    console.log(`Found Bank BCA: ${bankBCA.id} (${bankBCA.code} - ${bankBCA.name})`)

    // Also fetch some expense / revenue accounts for journal lines
    const apAccount = await prisma.gLAccount.findFirst({ where: { code: '2000' } })   // Utang Usaha
    const arAccount = await prisma.gLAccount.findFirst({ where: { code: '1200' } })   // Piutang Usaha
    const salaryExp = await prisma.gLAccount.findFirst({ where: { code: '6200' } })   // Beban Gaji
    const utilityExp = await prisma.gLAccount.findFirst({ where: { code: '6210' } })  // Beban Listrik
    const revenueAcc = await prisma.gLAccount.findFirst({ where: { code: '4000' } })  // Pendapatan Penjualan
    const purchaseAcc = await prisma.gLAccount.findFirst({ where: { code: '5100' } }) // Pembelian Bahan Baku

    if (!apAccount || !arAccount || !salaryExp || !utilityExp || !revenueAcc || !purchaseAcc) {
        console.error('Required GL accounts not found. Run seed-gl.ts first.')
        process.exit(1)
    }

    // ---------------------------------------------------------------
    // 2. Create POSTED journal entries that will be "system transactions"
    //    for Bank BCA within Jan-Mar 2026
    // ---------------------------------------------------------------
    // These are the GL entries the reconciliation detail page fetches.
    // Each entry has a line on Bank BCA (debit = money in, credit = money out).

    const journalEntries = [
        // JE-1: Penerimaan piutang PT Maju Tekstil — Rp 125.000.000 (IN)
        {
            description: 'Penerimaan piutang PT Maju Tekstil',
            reference: 'INV-2026-0012',
            date: new Date('2026-01-15'),
            lines: [
                { accountId: bankBCA.id, debit: 125_000_000, credit: 0 },
                { accountId: arAccount.id, debit: 0, credit: 125_000_000 },
            ],
        },
        // JE-2: Pembayaran gaji Januari — Rp 87.500.000 (OUT)
        {
            description: 'Pembayaran gaji karyawan Januari 2026',
            reference: 'PAY-2026-001',
            date: new Date('2026-01-31'),
            lines: [
                { accountId: salaryExp.id, debit: 87_500_000, credit: 0 },
                { accountId: bankBCA.id, debit: 0, credit: 87_500_000 },
            ],
        },
        // JE-3: Pembayaran supplier bahan baku — Rp 45.000.000 (OUT)
        {
            description: 'Pembayaran PO-2026-003 CV Benang Sejahtera',
            reference: 'PO-2026-003',
            date: new Date('2026-02-05'),
            lines: [
                { accountId: purchaseAcc.id, debit: 45_000_000, credit: 0 },
                { accountId: bankBCA.id, debit: 0, credit: 45_000_000 },
            ],
        },
        // JE-4: Penerimaan pembayaran SO CV Karya Indah — Rp 210.000.000 (IN)
        {
            description: 'Penerimaan pembayaran SO-2026-007 CV Karya Indah',
            reference: 'SO-2026-007',
            date: new Date('2026-02-18'),
            lines: [
                { accountId: bankBCA.id, debit: 210_000_000, credit: 0 },
                { accountId: arAccount.id, debit: 0, credit: 210_000_000 },
            ],
        },
        // JE-5: Pembayaran listrik & air Februari — Rp 12.350.000 (OUT)
        {
            description: 'Pembayaran listrik, air, internet Februari',
            reference: 'UTL-2026-02',
            date: new Date('2026-02-28'),
            lines: [
                { accountId: utilityExp.id, debit: 12_350_000, credit: 0 },
                { accountId: bankBCA.id, debit: 0, credit: 12_350_000 },
            ],
        },
        // JE-6: Pembayaran gaji Februari — Rp 87.500.000 (OUT)
        {
            description: 'Pembayaran gaji karyawan Februari 2026',
            reference: 'PAY-2026-002',
            date: new Date('2026-02-28'),
            lines: [
                { accountId: salaryExp.id, debit: 87_500_000, credit: 0 },
                { accountId: bankBCA.id, debit: 0, credit: 87_500_000 },
            ],
        },
        // JE-7: Penerimaan piutang PT Sandang Nusantara — Rp 67.800.000 (IN)
        // This one will NOT have a matching bank statement item (orphan system entry)
        {
            description: 'Penerimaan piutang PT Sandang Nusantara',
            reference: 'INV-2026-0019',
            date: new Date('2026-03-10'),
            lines: [
                { accountId: bankBCA.id, debit: 67_800_000, credit: 0 },
                { accountId: arAccount.id, debit: 0, credit: 67_800_000 },
            ],
        },
    ]

    const createdEntryIds: string[] = []

    for (const je of journalEntries) {
        const entry = await prisma.journalEntry.create({
            data: {
                description: je.description,
                reference: je.reference,
                date: je.date,
                status: 'POSTED',
                lines: {
                    create: je.lines.map((l) => ({
                        accountId: l.accountId,
                        debit: l.debit,
                        credit: l.credit,
                    })),
                },
            },
        })
        createdEntryIds.push(entry.id)
        console.log(`  JE: ${je.reference} — ${je.description}`)
    }

    console.log(`Created ${createdEntryIds.length} journal entries for Bank BCA.`)

    // ---------------------------------------------------------------
    // 3. Create a BankReconciliation record (Jan 1 – Mar 31 2026)
    // ---------------------------------------------------------------
    const reconciliation = await prisma.bankReconciliation.create({
        data: {
            glAccountId: bankBCA.id,
            statementDate: new Date('2026-03-31'),
            periodStart: new Date('2026-01-01'),
            periodEnd: new Date('2026-03-31'),
            status: 'REC_IN_PROGRESS',
        },
    })

    console.log(`Created BankReconciliation: ${reconciliation.id}`)

    // ---------------------------------------------------------------
    // 4. Create BankReconciliationItem rows (12 bank statement lines)
    //    Mix of matchable & unmatched transactions.
    // ---------------------------------------------------------------
    //
    // Match strategy vs the journal entries above:
    //   Item 1  → HIGH match to JE-1 (exact amount + close date + reference INV-2026-0012)
    //   Item 2  → HIGH match to JE-2 (exact amount + same date + reference PAY-2026-001)
    //   Item 3  → MEDIUM match to JE-3 (exact amount + close date, no ref overlap)
    //   Item 4  → HIGH match to JE-4 (exact amount + close date + reference SO-2026-007)
    //   Item 5  → MEDIUM match to JE-5 (exact amount + same date, no ref match)
    //   Item 6  → LOW match to JE-6 (amount off by Rp 50, date +4 days)
    //   Items 7-12 → UNMATCHED (no corresponding journal entries)

    const bankItems = [
        // --- Matchable items ---
        {
            bankRef: 'BCA/01/2026/08821',
            bankDate: new Date('2026-01-15'),
            bankAmount: 125_000_000,
            bankDescription: 'Transfer masuk dari PT Maju Tekstil ref INV-2026-0012',
        },
        {
            bankRef: 'BCA/01/2026/09445',
            bankDate: new Date('2026-01-31'),
            bankAmount: -87_500_000,
            bankDescription: 'Payroll Januari PAY-2026-001',
        },
        {
            bankRef: 'BCA/02/2026/01203',
            bankDate: new Date('2026-02-06'),
            bankAmount: -45_000_000,
            bankDescription: 'Transfer keluar ke CV Benang Sejahtera',
        },
        {
            bankRef: 'BCA/02/2026/05892',
            bankDate: new Date('2026-02-19'),
            bankAmount: 210_000_000,
            bankDescription: 'Transfer masuk CV Karya Indah SO-2026-007',
        },
        {
            bankRef: 'BCA/02/2026/09100',
            bankDate: new Date('2026-02-28'),
            bankAmount: -12_350_000,
            bankDescription: 'Auto debet PLN & PDAM Februari',
        },
        {
            bankRef: 'BCA/03/2026/00210',
            bankDate: new Date('2026-03-04'),
            bankAmount: -87_500_050,  // off by Rp 50 → LOW confidence
            bankDescription: 'Payroll Februari 2026',
        },

        // --- Unmatched items (no journal entry counterparts) ---
        {
            bankRef: 'BCA/01/2026/07001',
            bankDate: new Date('2026-01-10'),
            bankAmount: 35_000_000,
            bankDescription: 'Transfer masuk DP order Toko Anugerah',
        },
        {
            bankRef: 'BCA/02/2026/03440',
            bankDate: new Date('2026-02-12'),
            bankAmount: -8_750_000,
            bankDescription: 'Pembayaran jasa pengiriman PT Logistik Cepat',
        },
        {
            bankRef: 'BCA/02/2026/07788',
            bankDate: new Date('2026-02-24'),
            bankAmount: -3_200_000,
            bankDescription: 'Biaya admin bank & provisi Februari',
        },
        {
            bankRef: 'BCA/03/2026/01550',
            bankDate: new Date('2026-03-07'),
            bankAmount: 500_000_000,
            bankDescription: 'Transfer masuk pelunasan PT Sandang Mitra Abadi',
        },
        {
            bankRef: 'BCA/03/2026/02100',
            bankDate: new Date('2026-03-12'),
            bankAmount: -15_400_000,
            bankDescription: 'Pembelian perlengkapan kantor CV Stationery Jaya',
        },
        {
            bankRef: 'BCA/03/2026/03900',
            bankDate: new Date('2026-03-20'),
            bankAmount: -6_500_000,
            bankDescription: 'Pembayaran BPJS Ketenagakerjaan Maret',
        },
    ]

    await prisma.bankReconciliationItem.createMany({
        data: bankItems.map((item) => ({
            reconciliationId: reconciliation.id,
            bankRef: item.bankRef,
            bankDate: item.bankDate,
            bankAmount: item.bankAmount,
            bankDescription: item.bankDescription,
            matchStatus: 'UNMATCHED' as const,
        })),
    })

    console.log(`Created ${bankItems.length} bank statement items.`)

    // ---------------------------------------------------------------
    // Summary
    // ---------------------------------------------------------------
    console.log('\n=== Seed Summary ===')
    console.log(`  Reconciliation period : 2026-01-01 to 2026-03-31`)
    console.log(`  GL Account            : ${bankBCA.code} — ${bankBCA.name}`)
    console.log(`  Journal entries created: ${createdEntryIds.length}`)
    console.log(`  Bank statement items   : ${bankItems.length}`)
    console.log(`  Expected HIGH matches  : 3 (items 1, 2, 4)`)
    console.log(`  Expected MEDIUM matches: 2 (items 3, 5)`)
    console.log(`  Expected LOW matches   : 1 (item 6)`)
    console.log(`  Truly unmatched items  : 6 (items 7-12)`)
    console.log('=== Done ===')
}

// Standalone execution
const isMain = require.main === module || process.argv[1]?.includes('seed-bank-reconciliation')
if (isMain) {
    seedBankReconciliation()
        .catch((e) => {
            console.error(e)
            process.exit(1)
        })
}
