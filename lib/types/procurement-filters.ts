/**
 * Shared filter types for the Procurement module.
 *
 * Lives in a neutral types file so both `"use server"` action files
 * (e.g. `lib/actions/procurement.ts`) and client hooks
 * (e.g. `hooks/use-purchase-orders.ts`) can import it without crossing
 * the server/client boundary in TypeScript.
 *
 * All fields are optional — an empty `POFilter` (or `undefined`) means
 * "no filter applied, return everything".
 */
export type POFilter = {
    /** ProcurementStatus enum values (e.g. ["PO_DRAFT", "APPROVED"]). */
    status?: string[]
    /** Supplier IDs to include. */
    vendorIds?: string[]
    /** ISO date string (inclusive lower bound on `orderDate`). */
    dateStart?: string
    /** ISO date string (inclusive upper bound on `orderDate`). */
    dateEnd?: string
    /** Inclusive lower bound on `totalAmount` (DPP). */
    amountMin?: number
    /** Inclusive upper bound on `totalAmount` (DPP). */
    amountMax?: number
    /**
     * PaymentTermLegacy enum values (CASH, NET_15, NET_30, ...).
     * Filtered via the related Supplier (PurchaseOrder has no direct
     * paymentTerm column — it lives on Supplier).
     */
    paymentTerms?: string[]
    /** Free-text search across PO number and supplier name (case-insensitive). */
    search?: string
}
