/**
 * seed-cfs.ts — Tag all GL accounts with Cash Flow Statement (CFS) classifications.
 * Run: npx ts-node prisma/seed-cfs.ts
 *
 * Rules:
 * - cfsActivity: OPERATING | INVESTING | FINANCING | NON_CASH | EXCLUDED
 * - cfsDirection: INFLOW | OUTFLOW | ADJUSTMENT | NOT_APPLICABLE
 * - Missing codes are silently skipped (no throw).
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface CFSMapping {
    code: string
    cfsActivity: string
    cfsLineItem?: string
    cfsDirection?: string
    cfsRequiresOverride?: boolean
}

// Full mapping table — derived from the CFS implementation spec
const cfsMappings: CFSMapping[] = [
    // ── CASH & BANK (EXCLUDED — captured in proof equation, not categorised line) ─
    { code: '1000', cfsActivity: 'EXCLUDED', cfsDirection: 'NOT_APPLICABLE' },
    { code: '1050', cfsActivity: 'EXCLUDED', cfsDirection: 'NOT_APPLICABLE' },
    { code: '1101', cfsActivity: 'EXCLUDED', cfsDirection: 'NOT_APPLICABLE' },
    { code: '1102', cfsActivity: 'EXCLUDED', cfsDirection: 'NOT_APPLICABLE' },
    // Bank accounts: require per-line tagging when a transaction is investing/financing
    { code: '1110', cfsActivity: 'EXCLUDED', cfsDirection: 'NOT_APPLICABLE', cfsRequiresOverride: true },
    { code: '1111', cfsActivity: 'EXCLUDED', cfsDirection: 'NOT_APPLICABLE', cfsRequiresOverride: true },
    { code: '1112', cfsActivity: 'EXCLUDED', cfsDirection: 'NOT_APPLICABLE', cfsRequiresOverride: true },
    { code: '1113', cfsActivity: 'EXCLUDED', cfsDirection: 'NOT_APPLICABLE', cfsRequiresOverride: true },

    // ── OPERATING — WORKING CAPITAL (ASSETS) ─────────────────────────────────────
    { code: '1200', cfsActivity: 'OPERATING', cfsLineItem: 'Change in AR',              cfsDirection: 'ADJUSTMENT' },
    { code: '1210', cfsActivity: 'OPERATING', cfsLineItem: 'Change in AR',              cfsDirection: 'ADJUSTMENT' },
    { code: '1300', cfsActivity: 'OPERATING', cfsLineItem: 'Change in Inventory',       cfsDirection: 'ADJUSTMENT' },
    { code: '1310', cfsActivity: 'OPERATING', cfsLineItem: 'Change in Inventory',       cfsDirection: 'ADJUSTMENT' },
    { code: '1320', cfsActivity: 'OPERATING', cfsLineItem: 'Change in Inventory',       cfsDirection: 'ADJUSTMENT' },
    { code: '1325', cfsActivity: 'OPERATING', cfsLineItem: 'Change in Inventory',       cfsDirection: 'ADJUSTMENT' },
    { code: '1330', cfsActivity: 'OPERATING', cfsLineItem: 'Change in Input VAT',       cfsDirection: 'ADJUSTMENT' },
    { code: '1400', cfsActivity: 'OPERATING', cfsLineItem: 'Change in Prepaid Expense', cfsDirection: 'ADJUSTMENT' },
    { code: '1410', cfsActivity: 'OPERATING', cfsLineItem: 'Change in Tax Assets',      cfsDirection: 'ADJUSTMENT' },
    { code: '1420', cfsActivity: 'OPERATING', cfsLineItem: 'Change in Other Assets',    cfsDirection: 'ADJUSTMENT' },

    // ── INVESTING — FIXED ASSETS ──────────────────────────────────────────────────
    { code: '1500', cfsActivity: 'INVESTING', cfsLineItem: 'Purchase of Fixed Assets',  cfsDirection: 'OUTFLOW' },
    { code: '1510', cfsActivity: 'NON_CASH',  cfsLineItem: 'Depreciation and Amortization', cfsDirection: 'ADJUSTMENT' },
    { code: '1520', cfsActivity: 'INVESTING', cfsLineItem: 'Purchase of Fixed Assets',  cfsDirection: 'OUTFLOW' },
    { code: '1530', cfsActivity: 'INVESTING', cfsLineItem: 'Purchase of Fixed Assets',  cfsDirection: 'OUTFLOW' },
    { code: '1540', cfsActivity: 'INVESTING', cfsLineItem: 'Purchase of Fixed Assets',  cfsDirection: 'OUTFLOW' },
    { code: '1550', cfsActivity: 'INVESTING', cfsLineItem: 'Purchase of Fixed Assets',  cfsDirection: 'OUTFLOW' },
    { code: '1560', cfsActivity: 'INVESTING', cfsLineItem: 'Purchase of Fixed Assets',  cfsDirection: 'OUTFLOW' },
    { code: '1590', cfsActivity: 'NON_CASH',  cfsLineItem: 'Depreciation and Amortization', cfsDirection: 'ADJUSTMENT' },

    // ── INVESTING — INTANGIBLES ───────────────────────────────────────────────────
    { code: '1600', cfsActivity: 'INVESTING', cfsLineItem: 'Purchase of Intangibles',   cfsDirection: 'OUTFLOW' },
    { code: '1610', cfsActivity: 'NON_CASH',  cfsLineItem: 'Depreciation and Amortization', cfsDirection: 'ADJUSTMENT' },

    // ── INVESTING — LONG-TERM INVESTMENTS ────────────────────────────────────────
    { code: '1700', cfsActivity: 'INVESTING', cfsLineItem: 'Purchase of Investments',   cfsDirection: 'OUTFLOW' },
    { code: '1800', cfsActivity: 'INVESTING', cfsLineItem: 'Purchase of Investments',   cfsDirection: 'OUTFLOW' },

    // ── OPERATING — WORKING CAPITAL (LIABILITIES) ────────────────────────────────
    { code: '2000', cfsActivity: 'OPERATING', cfsLineItem: 'Change in AP',                   cfsDirection: 'ADJUSTMENT' },
    { code: '2100', cfsActivity: 'OPERATING', cfsLineItem: 'Change in AP',                   cfsDirection: 'ADJUSTMENT' },
    { code: '2110', cfsActivity: 'OPERATING', cfsLineItem: 'Change in VAT Payable',          cfsDirection: 'ADJUSTMENT' },
    { code: '2200', cfsActivity: 'OPERATING', cfsLineItem: 'Change in Accrued Liabilities',  cfsDirection: 'ADJUSTMENT' },
    { code: '2210', cfsActivity: 'OPERATING', cfsLineItem: 'Change in Accrued Liabilities',  cfsDirection: 'ADJUSTMENT' },
    { code: '2300', cfsActivity: 'OPERATING', cfsLineItem: 'Change in VAT Payable',          cfsDirection: 'ADJUSTMENT' },
    { code: '2310', cfsActivity: 'OPERATING', cfsLineItem: 'Change in Tax Payable',          cfsDirection: 'ADJUSTMENT' },
    { code: '2320', cfsActivity: 'OPERATING', cfsLineItem: 'Change in Tax Payable',          cfsDirection: 'ADJUSTMENT' },
    { code: '2400', cfsActivity: 'OPERATING', cfsLineItem: 'Change in Unearned Revenue',     cfsDirection: 'ADJUSTMENT' },
    { code: '2410', cfsActivity: 'OPERATING', cfsLineItem: 'Change in Accrued Liabilities',  cfsDirection: 'ADJUSTMENT' },

    // ── FINANCING — BANK LOANS ────────────────────────────────────────────────────
    { code: '2500', cfsActivity: 'FINANCING', cfsLineItem: 'Proceeds from Bank Loans',       cfsDirection: 'INFLOW' },
    { code: '2510', cfsActivity: 'FINANCING', cfsLineItem: 'Repayment of Bank Loans',        cfsDirection: 'OUTFLOW' },
    { code: '2520', cfsActivity: 'FINANCING', cfsLineItem: 'Proceeds from Bank Loans',       cfsDirection: 'INFLOW' },
    { code: '2600', cfsActivity: 'FINANCING', cfsLineItem: 'Proceeds from Bank Loans',       cfsDirection: 'INFLOW' },
    { code: '2700', cfsActivity: 'FINANCING', cfsLineItem: 'Repayment of Lease Liabilities', cfsDirection: 'OUTFLOW' },
    { code: '2800', cfsActivity: 'FINANCING', cfsLineItem: 'Proceeds from Bank Loans',       cfsDirection: 'INFLOW' },

    // ── EQUITY (EXCLUDED from P&L, flows via Net Profit or financing) ─────────────
    { code: '3000', cfsActivity: 'EXCLUDED',   cfsDirection: 'NOT_APPLICABLE' },
    { code: '3100', cfsActivity: 'FINANCING',  cfsLineItem: 'Proceeds from Share Issuance',   cfsDirection: 'INFLOW' },
    { code: '3200', cfsActivity: 'EXCLUDED',   cfsDirection: 'NOT_APPLICABLE' },  // Retained Earnings
    { code: '3300', cfsActivity: 'EXCLUDED',   cfsDirection: 'NOT_APPLICABLE' },  // Current Year Income (computed)
    { code: '3400', cfsActivity: 'FINANCING',  cfsLineItem: 'Dividends Paid',                 cfsDirection: 'OUTFLOW' },
    { code: '3500', cfsActivity: 'FINANCING',  cfsLineItem: 'Owner Withdrawal',               cfsDirection: 'OUTFLOW' },

    // ── REVENUE (EXCLUDED — flows through Net Profit) ────────────────────────────
    { code: '4000', cfsActivity: 'EXCLUDED', cfsDirection: 'NOT_APPLICABLE' },
    { code: '4100', cfsActivity: 'EXCLUDED', cfsDirection: 'NOT_APPLICABLE' },
    { code: '4200', cfsActivity: 'EXCLUDED', cfsDirection: 'NOT_APPLICABLE' },
    { code: '4300', cfsActivity: 'EXCLUDED', cfsDirection: 'NOT_APPLICABLE' },
    // Interest income: reclassified to operating inflow
    { code: '4400', cfsActivity: 'OPERATING',  cfsLineItem: 'Interest Income Received', cfsDirection: 'INFLOW' },
    // Gain on asset disposal: remove from operating, reclassify to investing
    { code: '4500', cfsActivity: 'INVESTING',  cfsLineItem: 'Gain on Asset Disposal',   cfsDirection: 'ADJUSTMENT' },
    { code: '4600', cfsActivity: 'NON_CASH',   cfsLineItem: 'Unrealized Forex Gain',    cfsDirection: 'ADJUSTMENT' },

    // ── COGS & OPERATING EXPENSES (EXCLUDED — flows through Net Profit) ──────────
    { code: '5000', cfsActivity: 'EXCLUDED', cfsDirection: 'NOT_APPLICABLE' },
    { code: '5010', cfsActivity: 'EXCLUDED', cfsDirection: 'NOT_APPLICABLE' },
    { code: '5020', cfsActivity: 'EXCLUDED', cfsDirection: 'NOT_APPLICABLE' },
    { code: '5030', cfsActivity: 'EXCLUDED', cfsDirection: 'NOT_APPLICABLE' },
    { code: '5040', cfsActivity: 'EXCLUDED', cfsDirection: 'NOT_APPLICABLE' },
    { code: '5050', cfsActivity: 'EXCLUDED', cfsDirection: 'NOT_APPLICABLE' },
    { code: '5100', cfsActivity: 'EXCLUDED', cfsDirection: 'NOT_APPLICABLE' },
    { code: '5200', cfsActivity: 'EXCLUDED', cfsDirection: 'NOT_APPLICABLE' },
    { code: '6000', cfsActivity: 'EXCLUDED', cfsDirection: 'NOT_APPLICABLE' },
    { code: '6100', cfsActivity: 'EXCLUDED', cfsDirection: 'NOT_APPLICABLE' },
    { code: '6200', cfsActivity: 'EXCLUDED', cfsDirection: 'NOT_APPLICABLE' },
    { code: '6300', cfsActivity: 'EXCLUDED', cfsDirection: 'NOT_APPLICABLE' },
    // Depreciation: non-cash add-back to net profit
    { code: '6400', cfsActivity: 'NON_CASH',  cfsLineItem: 'Depreciation and Amortization', cfsDirection: 'ADJUSTMENT' },
    // Bad debt expense: non-cash add-back
    { code: '6500', cfsActivity: 'NON_CASH',  cfsLineItem: 'Bad Debt Expense',              cfsDirection: 'ADJUSTMENT' },
    { code: '6510', cfsActivity: 'NON_CASH',  cfsLineItem: 'Inventory Write-off',            cfsDirection: 'ADJUSTMENT' },
    { code: '6600', cfsActivity: 'EXCLUDED',   cfsDirection: 'NOT_APPLICABLE' },
    { code: '6700', cfsActivity: 'EXCLUDED',   cfsDirection: 'NOT_APPLICABLE' },
    { code: '6800', cfsActivity: 'EXCLUDED',   cfsDirection: 'NOT_APPLICABLE' },
    { code: '6900', cfsActivity: 'EXCLUDED',   cfsDirection: 'NOT_APPLICABLE' },
    // Interest expense: cash outflow from operating
    { code: '7100', cfsActivity: 'OPERATING',  cfsLineItem: 'Interest Paid',                 cfsDirection: 'OUTFLOW' },
    { code: '7200', cfsActivity: 'EXCLUDED',   cfsDirection: 'NOT_APPLICABLE' },
    { code: '7300', cfsActivity: 'EXCLUDED',   cfsDirection: 'NOT_APPLICABLE' },
    // Unrealized forex loss: non-cash add-back
    { code: '7400', cfsActivity: 'NON_CASH',   cfsLineItem: 'Unrealized Forex Loss',         cfsDirection: 'ADJUSTMENT' },
    // Loss on asset disposal: reclassified to investing
    { code: '7500', cfsActivity: 'INVESTING',  cfsLineItem: 'Loss on Asset Disposal',        cfsDirection: 'ADJUSTMENT' },
    { code: '8000', cfsActivity: 'EXCLUDED',   cfsDirection: 'NOT_APPLICABLE' },
    { code: '8100', cfsActivity: 'EXCLUDED',   cfsDirection: 'NOT_APPLICABLE' },
    { code: '8200', cfsActivity: 'EXCLUDED',   cfsDirection: 'NOT_APPLICABLE' },
    { code: '8300', cfsActivity: 'EXCLUDED',   cfsDirection: 'NOT_APPLICABLE' },
    { code: '8900', cfsActivity: 'EXCLUDED',   cfsDirection: 'NOT_APPLICABLE' },
    { code: '9000', cfsActivity: 'EXCLUDED',   cfsDirection: 'NOT_APPLICABLE' },
    { code: '9100', cfsActivity: 'EXCLUDED',   cfsDirection: 'NOT_APPLICABLE' },
    { code: '9900', cfsActivity: 'EXCLUDED',   cfsDirection: 'NOT_APPLICABLE' },
]

async function main() {
    console.log('🌱 Seeding CFS classifications for GL accounts...')

    let updated = 0
    let skipped = 0

    for (const mapping of cfsMappings) {
        const account = await prisma.gLAccount.findUnique({
            where: { code: mapping.code },
            select: { id: true },
        })

        if (!account) {
            skipped++
            continue
        }

        await prisma.gLAccount.update({
            where: { id: account.id },
            data: {
                cfsActivity:         mapping.cfsActivity,
                cfsLineItem:         mapping.cfsLineItem   ?? null,
                cfsDirection:        mapping.cfsDirection  ?? null,
                cfsRequiresOverride: mapping.cfsRequiresOverride ?? false,
            },
        })
        updated++
    }

    console.log(`✅ CFS seeding complete: ${updated} accounts tagged, ${skipped} codes skipped (not in DB).`)
}

main()
    .catch((e) => { console.error(e); process.exit(1) })
    .finally(() => prisma.$disconnect())
