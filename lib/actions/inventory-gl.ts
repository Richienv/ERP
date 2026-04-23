'use server'

import { SYS_ACCOUNTS } from "@/lib/gl-accounts"
import { postJournalEntry } from "@/lib/actions/finance-gl"

/**
 * Inventory → General Ledger integration.
 *
 * Creates automatic journal entries when inventory transactions occur,
 * keeping the balance sheet Inventory Asset account accurate.
 *
 * Accounting rules:
 *   PO_RECEIVE      → DR Inventory Asset (1300),  CR GR/IR Clearing (2150)
 *   SO_SHIPMENT     → DR Cost of Goods Sold (5000), CR Inventory Asset (1300)
 *   PRODUCTION_OUT  → DR Work-in-Progress (1320),  CR Raw Materials (1310)
 *   ADJUSTMENT_IN   → DR Inventory Asset (1300),  CR Inventory Adjustment (8300)
 *   ADJUSTMENT_OUT  → DR Inventory Adjustment (8300), CR Inventory Asset (1300)
 *   SCRAP           → DR Loss/Write-off (8200),   CR Inventory Asset (1300)
 *   RETURN_IN       → DR Inventory Asset (1300),  CR COGS (5000) — reversal of SO_SHIPMENT
 *   RETURN_OUT      → DR GR/IR Clearing (2150),   CR Inventory Asset (1300) — reversal of PO_RECEIVE
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
    | 'CUT_CONSUME'

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
    /** Date the underlying business event occurred (e.g. grn.receivedAt,
     * session.completedAt, invTx.createdAt). Falls back to `new Date()` if
     * omitted, but callers SHOULD pass the source date for accrual-basis
     * period matching. */
    transactionDate?: Date
}

// ---- GL Account code constants ----

const GL_INVENTORY_ASSET = SYS_ACCOUNTS.INVENTORY_ASSET
const GL_RAW_MATERIALS = SYS_ACCOUNTS.RAW_MATERIALS
const GL_WORK_IN_PROGRESS = SYS_ACCOUNTS.WIP
const GL_GR_IR_CLEARING = SYS_ACCOUNTS.GR_IR_CLEARING
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
        case 'CUT_CONSUME':
            return `Konsumsi kain potong - ${productName}${suffix}`
    }
}

// ---- Helpers ----

/** Generate entry number via atomic DocumentCounter — no collision under
 * concurrent batch GRN acceptance (the old timestamp+random pattern could
 * collide within the same millisecond). */
async function generateEntryNumber(prismaTx: any): Promise<string> {
    const { getNextDocNumber } = await import("@/lib/document-numbering")
    const now = new Date()
    const yyyymmdd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
    return getNextDocNumber(prismaTx, `JV-INV-${yyyymmdd}`, 6)
}

// ---- Main function ----

/**
 * Post a GL journal entry for an inventory transaction.
 *
 * BLOCKING: If GL posting fails, the error propagates to the caller.
 * Since callers pass their transaction client, this means the entire
 * business transaction (stock + GL) rolls back together.
 *
 * @param prisma  Prisma client or transaction instance
 * @param params  Transaction details
 */
export async function postInventoryGLEntry(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prisma: any,
    params: PostInventoryGLParams,
): Promise<void> {
    const { transactionId, type, productName, totalValue, reference, transactionDate } = params

    // Skip if no monetary value
    if (!totalValue || totalValue <= 0) {
        return
    }

    // Resolve required GL account codes for the transaction type. Map each
    // movement to its (debit, credit) account-code pair.
    let debitCode: string
    let creditCode: string

    switch (type) {
        case 'PO_RECEIVE':
            debitCode = GL_INVENTORY_ASSET; creditCode = GL_GR_IR_CLEARING
            break
        case 'SO_SHIPMENT':
            debitCode = GL_COGS; creditCode = GL_INVENTORY_ASSET
            break
        case 'PRODUCTION_OUT':
        case 'CUT_CONSUME':
            debitCode = GL_WORK_IN_PROGRESS; creditCode = GL_RAW_MATERIALS
            break
        case 'ADJUSTMENT_IN':
            debitCode = GL_INVENTORY_ASSET; creditCode = GL_INVENTORY_ADJUSTMENT
            break
        case 'ADJUSTMENT_OUT':
            debitCode = GL_INVENTORY_ADJUSTMENT; creditCode = GL_INVENTORY_ASSET
            break
        case 'SCRAP':
            debitCode = GL_LOSS_WRITEOFF; creditCode = GL_INVENTORY_ASSET
            break
        case 'RETURN_IN':
            debitCode = GL_INVENTORY_ASSET; creditCode = GL_COGS
            break
        case 'RETURN_OUT':
            debitCode = GL_GR_IR_CLEARING; creditCode = GL_INVENTORY_ASSET
            break
    }

    const description = glDescription(type, productName, reference)
    const entryNumber = await generateEntryNumber(prisma)

    // Delegate to canonical postJournalEntry helper (M3/M4): gets the
    // control-account guard, period assertion, balance check, and consistent
    // GL-balance direction handling for free.
    const result = await postJournalEntry({
        description,
        date: transactionDate ?? new Date(),
        reference: entryNumber,
        inventoryTransactionId: transactionId,
        sourceDocumentType: `INVENTORY_${type}`,
        lines: [
            { accountCode: debitCode, debit: totalValue, credit: 0, description },
            { accountCode: creditCode, debit: 0, credit: totalValue, description },
        ],
    }, prisma)

    if (!result?.success) {
        throw new Error(
            `[inventory-gl] Gagal posting jurnal untuk ${type}: ${(result as any)?.error || 'Unknown'}. ` +
            `Pastikan akun GL ${debitCode} dan ${creditCode} sudah ada (jalankan ensureSystemAccounts).`
        )
    }
}
