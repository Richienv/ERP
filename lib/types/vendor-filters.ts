/**
 * Shared filter types for the Vendor (Supplier) master.
 *
 * Lives in a neutral types file so both `"use server"` action files
 * (e.g. `app/actions/vendor.ts`) and client hooks/pages can import it
 * without crossing the server/client boundary in TypeScript.
 *
 * All fields are optional — an empty `VendorFilter` (or `undefined`) means
 * "no filter applied, return everything".
 */
export type VendorFilter = {
    /** Vendor activation status. */
    status?: ("ACTIVE" | "INACTIVE")[]
    /** Star ratings (1-5) to include. Inclusive — selecting [4,5] returns rating ≥ 4 OR ==. */
    ratings?: number[]
    /** PaymentTermLegacy enum values (CASH, NET_15, NET_30, NET_45, NET_60, NET_90, COD). */
    paymentTerms?: string[]
    /** Free-text search across vendor name, code, NPWP, contactName (case-insensitive). */
    search?: string
}
