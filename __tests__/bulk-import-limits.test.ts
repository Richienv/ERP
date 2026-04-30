import { describe, it, expect } from "vitest"
import { MAX_BULK_IMPORT_ROWS, checkBulkImportSize } from "@/lib/inventory-helpers"

describe("bulk import row cap", () => {
    it("accepts an empty array", () => {
        expect(checkBulkImportSize([]).ok).toBe(true)
    })

    it("accepts exactly MAX_BULK_IMPORT_ROWS rows", () => {
        expect(checkBulkImportSize(new Array(MAX_BULK_IMPORT_ROWS).fill({})).ok).toBe(true)
    })

    it("rejects MAX_BULK_IMPORT_ROWS + 1 rows with Bahasa Indonesia error", () => {
        const result = checkBulkImportSize(new Array(MAX_BULK_IMPORT_ROWS + 1).fill({}))
        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.error).toContain(`Maksimal ${MAX_BULK_IMPORT_ROWS}`)
            expect(result.error).toContain("Pisahkan file")
            expect(result.error).toContain(`${MAX_BULK_IMPORT_ROWS + 1} baris`)  // includes actual count
        }
    })

    it("rejects much larger payloads", () => {
        expect(checkBulkImportSize(new Array(10000).fill({})).ok).toBe(false)
    })
})
