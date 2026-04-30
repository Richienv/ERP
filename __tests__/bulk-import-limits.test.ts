import { describe, it, expect } from "vitest"

const MAX_BULK_IMPORT_ROWS = 500

function checkBulkImportSize(rows: unknown[]) {
    if (rows.length > MAX_BULK_IMPORT_ROWS) {
        return {
            ok: false,
            error: `Maksimal ${MAX_BULK_IMPORT_ROWS} baris per impor. Pisahkan file menjadi beberapa bagian.`
        }
    }
    return { ok: true as const }
}

describe("bulk import row cap", () => {
    it("accepts an empty array", () => {
        expect(checkBulkImportSize([]).ok).toBe(true)
    })

    it("accepts exactly 500 rows", () => {
        expect(checkBulkImportSize(new Array(500).fill({})).ok).toBe(true)
    })

    it("rejects 501 rows with Bahasa Indonesia error", () => {
        const result = checkBulkImportSize(new Array(501).fill({}))
        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.error).toContain("Maksimal 500")
            expect(result.error).toContain("Pisahkan file")
        }
    })

    it("rejects much larger payloads", () => {
        expect(checkBulkImportSize(new Array(10000).fill({})).ok).toBe(false)
    })
})
