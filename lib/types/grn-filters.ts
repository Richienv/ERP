/**
 * Shared filter + result types for the Goods Received Note (GRN / Surat Jalan Masuk) module.
 *
 * Lives in a neutral types file so both `"use server"` action files
 * (e.g. `lib/actions/grn.ts`) and client hooks/pages can import it
 * without crossing the server/client boundary in TypeScript.
 *
 * All fields are optional — an empty `GRNFilter` (or `undefined`) means
 * "no filter applied, return everything".
 */
export type GRNFilter = {
    /** GRNStatus enum values: DRAFT, INSPECTING, PARTIAL_ACCEPTED, ACCEPTED, REJECTED. */
    status?: string[]
    /** Supplier IDs to include (resolved via the related PurchaseOrder). */
    vendorIds?: string[]
    /** Free-text search on PO number reference. */
    poRef?: string
    /** ISO date string (inclusive lower bound on `receivedDate`). */
    dateStart?: string
    /** ISO date string (inclusive upper bound on `receivedDate`). */
    dateEnd?: string
    /** Free-text search across GRN number, PO number, and supplier name (case-insensitive). */
    search?: string
}

/** Shape returned by `bulkAcceptGRNs` / `bulkRejectGRNs`. */
export type BulkGRNResult = {
    succeeded: string[]
    failed: { id: string; reason: string }[]
}

