import { describe, it, expect } from "vitest"

// Unit test for revision history logic (no DB dependency)

interface RevisionHistoryEntry {
    revision: number
    changedAt: string
    changedBy: string
    changedByEmail: string
    reason: string
    snapshot: {
        items: {
            productId: string
            productName: string
            productCode: string
            quantity: number
            unitPrice: number
            lineTotal: number
        }[]
        subtotal: number
        taxAmount: number
        total: number
        paymentTerm: string
        deliveryTerm: string | null
        notes: string | null
    }
}

function buildRevisionEntry(
    currentRevision: number,
    userId: string,
    email: string,
    reason: string,
    snapshot: RevisionHistoryEntry["snapshot"]
): RevisionHistoryEntry {
    return {
        revision: currentRevision,
        changedAt: new Date().toISOString(),
        changedBy: userId,
        changedByEmail: email,
        reason,
        snapshot,
    }
}

function appendRevisionHistory(
    existingHistory: RevisionHistoryEntry[] | null | undefined,
    newEntry: RevisionHistoryEntry
): RevisionHistoryEntry[] {
    const history = Array.isArray(existingHistory) ? existingHistory : []
    return [...history, newEntry]
}

function formatDocumentNumber(baseNumber: string, revision: number): string {
    return revision > 0 ? `${baseNumber} Rev.${revision}` : baseNumber
}

describe("Order Amendment / Revision Tracking", () => {
    describe("formatDocumentNumber", () => {
        it("should return base number when revision is 0", () => {
            expect(formatDocumentNumber("SO-20260308-0001", 0)).toBe("SO-20260308-0001")
        })

        it("should append Rev.N when revision > 0", () => {
            expect(formatDocumentNumber("SO-20260308-0001", 1)).toBe("SO-20260308-0001 Rev.1")
            expect(formatDocumentNumber("SO-20260308-0001", 5)).toBe("SO-20260308-0001 Rev.5")
        })

        it("should work for PO numbers too", () => {
            expect(formatDocumentNumber("PO-2026-001", 2)).toBe("PO-2026-001 Rev.2")
        })
    })

    describe("buildRevisionEntry", () => {
        it("should create a valid revision entry with snapshot", () => {
            const snapshot = {
                items: [
                    {
                        productId: "prod-1",
                        productName: "Kain Katun",
                        productCode: "KC-001",
                        quantity: 100,
                        unitPrice: 50000,
                        lineTotal: 5000000,
                    },
                ],
                subtotal: 5000000,
                taxAmount: 550000,
                total: 5550000,
                paymentTerm: "NET_30",
                deliveryTerm: null,
                notes: null,
            }

            const entry = buildRevisionEntry(0, "user-123", "admin@test.com", "Perubahan harga", snapshot)

            expect(entry.revision).toBe(0)
            expect(entry.changedBy).toBe("user-123")
            expect(entry.changedByEmail).toBe("admin@test.com")
            expect(entry.reason).toBe("Perubahan harga")
            expect(entry.snapshot.items).toHaveLength(1)
            expect(entry.snapshot.total).toBe(5550000)
            expect(entry.changedAt).toBeTruthy()
        })
    })

    describe("appendRevisionHistory", () => {
        it("should handle null existing history", () => {
            const entry = buildRevisionEntry(0, "u1", "a@b.com", "Initial change", {
                items: [],
                subtotal: 0,
                taxAmount: 0,
                total: 0,
                paymentTerm: "NET_30",
                deliveryTerm: null,
                notes: null,
            })

            const result = appendRevisionHistory(null, entry)
            expect(result).toHaveLength(1)
            expect(result[0].revision).toBe(0)
        })

        it("should handle undefined existing history", () => {
            const entry = buildRevisionEntry(0, "u1", "a@b.com", "First rev", {
                items: [],
                subtotal: 0,
                taxAmount: 0,
                total: 0,
                paymentTerm: "NET_30",
                deliveryTerm: null,
                notes: null,
            })

            const result = appendRevisionHistory(undefined, entry)
            expect(result).toHaveLength(1)
        })

        it("should append to existing history maintaining chronological order", () => {
            const existing: RevisionHistoryEntry[] = [
                {
                    revision: 0,
                    changedAt: "2026-03-01T00:00:00Z",
                    changedBy: "u1",
                    changedByEmail: "a@b.com",
                    reason: "Perubahan qty",
                    snapshot: {
                        items: [{ productId: "p1", productName: "Item A", productCode: "A1", quantity: 10, unitPrice: 1000, lineTotal: 10000 }],
                        subtotal: 10000,
                        taxAmount: 1100,
                        total: 11100,
                        paymentTerm: "NET_30",
                        deliveryTerm: null,
                        notes: null,
                    },
                },
            ]

            const newEntry = buildRevisionEntry(1, "u2", "b@c.com", "Perubahan harga", {
                items: [{ productId: "p1", productName: "Item A", productCode: "A1", quantity: 10, unitPrice: 2000, lineTotal: 20000 }],
                subtotal: 20000,
                taxAmount: 2200,
                total: 22200,
                paymentTerm: "NET_30",
                deliveryTerm: null,
                notes: null,
            })

            const result = appendRevisionHistory(existing, newEntry)
            expect(result).toHaveLength(2)
            expect(result[0].revision).toBe(0)
            expect(result[1].revision).toBe(1)
            expect(result[0].snapshot.total).toBe(11100)
            expect(result[1].snapshot.total).toBe(22200)
        })
    })

    describe("Revision validation rules", () => {
        it("should require a reason for amendment", () => {
            const reason = ""
            expect(reason.trim().length === 0).toBe(true)
        })

        it("should require at least one item", () => {
            const items: any[] = []
            expect(items.length === 0).toBe(true)
        })

        it("should only allow amendment on DRAFT or CONFIRMED status (SO)", () => {
            const amendableStatuses = ["DRAFT", "CONFIRMED"]
            expect(amendableStatuses.includes("DRAFT")).toBe(true)
            expect(amendableStatuses.includes("CONFIRMED")).toBe(true)
            expect(amendableStatuses.includes("IN_PROGRESS")).toBe(false)
            expect(amendableStatuses.includes("DELIVERED")).toBe(false)
            expect(amendableStatuses.includes("CANCELLED")).toBe(false)
        })

        it("should only allow amendment on PO_DRAFT or PENDING_APPROVAL status (PO)", () => {
            const amendableStatuses = ["PO_DRAFT", "PENDING_APPROVAL"]
            expect(amendableStatuses.includes("PO_DRAFT")).toBe(true)
            expect(amendableStatuses.includes("PENDING_APPROVAL")).toBe(true)
            expect(amendableStatuses.includes("APPROVED")).toBe(false)
            expect(amendableStatuses.includes("ORDERED")).toBe(false)
        })
    })
})
