'use server'

import { SYS_ACCOUNTS } from "@/lib/gl-accounts"

/**
 * Inventory → General Ledger integration.
 *
 * Creates automatic journal entries when inventory transactions occur,
 * keeping the balance sheet Inventory Asset account accurate.
 *
 * Accounting rules:
 *   PO_RECEIVE      → DR Inventory Asset (1300),  CR Accounts Payable (2000)
 *   SO_SHIPMENT     → DR Cost of Goods Sold (5000), CR Inventory Asset (1300)
 *   PRODUCTION_OUT  → DR Work-in-Progress (1320),  CR Raw Materials (1310)
 *   ADJUSTMENT_IN   → DR Inventory Asset (1300),  CR Inventory Adjustment (8300)
 *   ADJUSTMENT_OUT  → DR Inventory Adjustment (8300), CR Inventory Asset (1300)
 *   SCRAP           → DR Loss/Write-off (8200),   CR Inventory Asset (1300)
 *   RETURN_IN       → DR Inventory Asset (1300),  CR COGS (5000) — reversal of SO_SHIPMENT
 *   RETURN_OUT      → DR AP (2000),               CR Inventory Asset (1300) — reversal of PO_RECEIVE
 *   TRANSFER        → No GL entry (intra-entity movement)
 */

// ---- Types (exported via `export type`) ----

export type InventoryGLType =
    | 'PO_RECEIVE'
    | 'SO_SHIPMENT'
    | 'PRODUCTION_OUT'
    | 'ADJUSTMENT_IN'
    | 'ADJUSTMENT_OUT'
    | 'SCRAP'
    | 'RETURN_IN'
    | 'RETURN_OUT'

export type PostInventoryGLParams = {
    transactionId: string
    type: InventoryGLType
    productName: string
    quantity: number
    unitCost: number
    totalValue: number
    warehouseFrom?: string
    warehouseTo?: string
    reference?: string
}

// ---- GL Account code constants ----

const GL_INVENTORY_ASSET = SYS_ACCOUNTS.INVENTORY_ASSET
const GL_RAW_MATERIALS = SYS_ACCOUNTS.RAW_MATERIALS
const GL_WORK_IN_PROGRESS = SYS_ACCOUNTS.WIP
const GL_ACCOUNTS_PAYABLE = SYS_ACCOUNTS.AP
const GL_COGS = SYS_ACCOUNTS.COGS  // Fixed: was '5100', now '5000' (HPP)
const GL_LOSS_WRITEOFF = SYS_ACCOUNTS.LOSS_WRITEOFF
const GL_INVENTORY_ADJUSTMENT = SYS_ACCOUNTS.INV_ADJUSTMENT

// ---- Description templates (Bahasa Indonesia) ----

function glDescription(type: InventoryGLType, productName: string, ref?: string): string {
    const suffix = ref ? ` — ${ref}` : ''
    switch (type) {
        case 'PO_RECEIVE':
            return `Penerimaan barang dari PO - ${productName}${suffix}`
        case 'SO_SHIPMENT':
            return `Pengiriman barang (HPP) - ${productName}${suffix}`
        case 'PRODUCTION_OUT':
            return `Konsumsi bahan baku produksi - ${productName}${suffix}`
        case 'ADJUSTMENT_IN':
            return `Penyesuaian persediaan masuk - ${productName}${suffix}`
        case 'ADJUSTMENT_OUT':
            return `Penyesuaian persediaan keluar - ${productName}${suffix}`
        case 'SCRAP':
            return `Penghapusan persediaan (scrap) - ${productName}${suffix}`
        case 'RETURN_IN':
            return `Retur penjualan masuk (reversal HPP) - ${productName}${suffix}`
        case 'RETURN_OUT':
            return `Retur pembelian keluar - ${productName}${suffix}`
    }
}

// ---- Helpers ----

/** Find a GL account by code first, falling back to name pattern. */
async function findGLAccount(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prisma: any,
    code: string,
    nameFallback: string,
    accountType?: string,
) {
    // Try exact code first
    const byCode = await prisma.gLAccount.findFirst({
        where: { code },
    })
    if (byCode) return byCode

    // Fallback: name contains pattern (+ optional type filter)
    const where: Record<string, unknown> = {
        name: { contains: nameFallback, mode: 'insensitive' },
    }
    if (accountType) where.type = accountType

    return prisma.gLAccount.findFirst({ where })
}

/** Generate entry number: JV-INV-YYYYMMDD-XXXXXX (timestamp-based, collision-resistant) */
function generateEntryNumber(): string {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    // Use millisecond timestamp + small random suffix for uniqueness
    const ms = String(now.getTime() % 1000000).padStart(6, '0')
    return `JV-INV-${y}${m}${d}-${ms}`
}

// ---- Main function ----

/**
 * Post a GL journal entry for an inventory transaction.
 *
 * This is **fire-and-forget with logging** — if GL posting fails the
 * inventory transaction still succeeds. Pass the same prisma instance /
 * transaction that is already in scope.
 *
 * @param prisma  Prisma client or transaction instance
 * @param params  Transaction details
 */
export async function postInventoryGLEntry(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prisma: any,
    params: PostInventoryGLParams,
): Promise<void> {
    try {
        const { transactionId, type, productName, totalValue, reference } = params

        // Skip if no monetary value
        if (!totalValue || totalValue <= 0) {
            return
        }

        // ---- Resolve required GL accounts based on transaction type ----
        type AccountPair = { debitAccount: { id: string; type: string } | null; creditAccount: { id: string; type: string } | null }

        let pair: AccountPair

        switch (type) {
            case 'PO_RECEIVE': {
                const [inv, ap] = await Promise.all([
                    findGLAccount(prisma, GL_INVENTORY_ASSET, 'Persediaan', 'ASSET'),
                    findGLAccount(prisma, GL_ACCOUNTS_PAYABLE, 'Hutang', 'LIABILITY'),
                ])
                pair = { debitAccount: inv, creditAccount: ap }
                break
            }
            case 'SO_SHIPMENT': {
                const [cogs, inv] = await Promise.all([
                    findGLAccount(prisma, GL_COGS, 'Harga Pokok', 'EXPENSE'),
                    findGLAccount(prisma, GL_INVENTORY_ASSET, 'Persediaan', 'ASSET'),
                ])
                pair = { debitAccount: cogs, creditAccount: inv }
                break
            }
            case 'PRODUCTION_OUT': {
                const [wip, raw] = await Promise.all([
                    findGLAccount(prisma, GL_WORK_IN_PROGRESS, 'Barang Dalam Proses', 'ASSET'),
                    findGLAccount(prisma, GL_RAW_MATERIALS, 'Bahan Baku', 'ASSET'),
                ])
                pair = { debitAccount: wip, creditAccount: raw }
                break
            }
            case 'ADJUSTMENT_IN': {
                const [inv, adj] = await Promise.all([
                    findGLAccount(prisma, GL_INVENTORY_ASSET, 'Persediaan', 'ASSET'),
                    findGLAccount(prisma, GL_INVENTORY_ADJUSTMENT, 'Penyesuaian', 'EXPENSE'),
                ])
                pair = { debitAccount: inv, creditAccount: adj }
                break
            }
            case 'ADJUSTMENT_OUT': {
                const [adj, inv] = await Promise.all([
                    findGLAccount(prisma, GL_INVENTORY_ADJUSTMENT, 'Penyesuaian', 'EXPENSE'),
                    findGLAccount(prisma, GL_INVENTORY_ASSET, 'Persediaan', 'ASSET'),
                ])
                pair = { debitAccount: adj, creditAccount: inv }
                break
            }
            case 'SCRAP': {
                const [loss, inv] = await Promise.all([
                    findGLAccount(prisma, GL_LOSS_WRITEOFF, 'Kerugian', 'EXPENSE'),
                    findGLAccount(prisma, GL_INVENTORY_ASSET, 'Persediaan', 'ASSET'),
                ])
                pair = { debitAccount: loss, creditAccount: inv }
                break
            }
            case 'RETURN_IN': {
                // Reversal of SO_SHIPMENT: DR Inventory Asset, CR COGS
                const [inv, cogs] = await Promise.all([
                    findGLAccount(prisma, GL_INVENTORY_ASSET, 'Persediaan', 'ASSET'),
                    findGLAccount(prisma, GL_COGS, 'Harga Pokok', 'EXPENSE'),
                ])
                pair = { debitAccount: inv, creditAccount: cogs }
                break
            }
            case 'RETURN_OUT': {
                // Reversal of PO_RECEIVE: DR AP, CR Inventory Asset
                const [ap, inv] = await Promise.all([
                    findGLAccount(prisma, GL_ACCOUNTS_PAYABLE, 'Hutang', 'LIABILITY'),
                    findGLAccount(prisma, GL_INVENTORY_ASSET, 'Persediaan', 'ASSET'),
                ])
                pair = { debitAccount: ap, creditAccount: inv }
                break
            }
        }

        // If either account is missing, skip GL posting (don't crash)
        if (!pair.debitAccount || !pair.creditAccount) {
            console.warn(
                `[inventory-gl] Skipping GL posting for ${type}: missing accounts.`,
                `Debit account (${pair.debitAccount ? 'found' : 'MISSING'}),`,
                `Credit account (${pair.creditAccount ? 'found' : 'MISSING'})`,
            )
            return
        }

        const description = glDescription(type, productName, reference)
        const entryNumber = generateEntryNumber()

        // Create JournalEntry + JournalLines
        await prisma.journalEntry.create({
            data: {
                date: new Date(),
                description,
                reference: entryNumber,
                status: 'POSTED',
                inventoryTransactionId: transactionId,
                lines: {
                    create: [
                        {
                            accountId: pair.debitAccount.id,
                            description,
                            debit: totalValue,
                            credit: 0,
                        },
                        {
                            accountId: pair.creditAccount.id,
                            description,
                            debit: 0,
                            credit: totalValue,
                        },
                    ],
                },
            },
        })

        // Update GL Account balances using the normal-balance convention:
        //   ASSET / EXPENSE: balance increases with debit
        //   LIABILITY / EQUITY / REVENUE: balance increases with credit
        const debitBalanceChange = ['ASSET', 'EXPENSE'].includes(pair.debitAccount.type)
            ? totalValue
            : -totalValue

        const creditBalanceChange = ['ASSET', 'EXPENSE'].includes(pair.creditAccount.type)
            ? -totalValue
            : totalValue

        await Promise.all([
            prisma.gLAccount.update({
                where: { id: pair.debitAccount.id },
                data: { balance: { increment: debitBalanceChange } },
            }),
            prisma.gLAccount.update({
                where: { id: pair.creditAccount.id },
                data: { balance: { increment: creditBalanceChange } },
            }),
        ])

    } catch (error) {
        // Fire-and-forget: log error but don't throw
        console.error(`[inventory-gl] Failed to post GL entry for transaction ${params.transactionId}:`, error)
    }
}
