import { TAX_RATES } from "@/lib/tax-rates"

export type TaxMode = "EXCLUSIVE" | "INCLUSIVE" | "NON_PPN"

export const TAX_MODE_LABELS: Record<TaxMode, string> = {
    EXCLUSIVE: "Belum termasuk PPN",
    INCLUSIVE: "Termasuk PPN",
    NON_PPN: "Tanpa PPN (Non-PKP)",
}

export interface TaxTotals {
    subtotal: number   // DPP (pre-tax)
    taxAmount: number  // PPN
    grandTotal: number // DPP + PPN
}

// entered = sum(qty * unitPrice) as typed by the user.
// - EXCLUSIVE: entered is pre-tax → add PPN on top
// - INCLUSIVE: entered already includes PPN → split PPN out of the price
// - NON_PPN: entered has no PPN → no split
export function computeTaxTotals(entered: number, mode: TaxMode): TaxTotals {
    const rate = TAX_RATES.PPN // 0.11
    if (mode === "NON_PPN") {
        return { subtotal: entered, taxAmount: 0, grandTotal: entered }
    }
    if (mode === "INCLUSIVE") {
        const subtotal = Math.round(entered / (1 + rate))
        const taxAmount = entered - subtotal
        return { subtotal, taxAmount, grandTotal: entered }
    }
    const taxAmount = Math.round(entered * rate)
    return { subtotal: entered, taxAmount, grandTotal: entered + taxAmount }
}
