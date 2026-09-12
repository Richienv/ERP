import { describe, expect, it } from "vitest"
import {
    assembleMonthEndChecklist,
    monthEndTitle,
    type MonthEndSignals,
} from "./month-end-checklist-logic"

function baseSignals(overrides: Partial<MonthEndSignals> = {}): MonthEndSignals {
    return {
        year: 2026,
        month: 9,
        periodId: "period-sep",
        periodName: "September 2026",
        isClosed: false,
        periodMissing: false,
        integrity: { failedChecks: 0, draftJournals: 0 },
        draftBills: { count: 0, amount: 0 },
        draftInvoices: { count: 0, amount: 0 },
        payroll: { unposted: false, amount: 12_000_000 },
        depreciation: { unposted: false, amount: 4_000_000 },
        ...overrides,
    }
}

describe("assembleMonthEndChecklist", () => {
    it("enables Tutup Periode when every blocking row is green", () => {
        const view = assembleMonthEndChecklist(baseSignals())
        expect(view.canClose).toBe(true)
        expect(view.blockerHint).toBe("")
        expect(view.rows.every((row) => row.ok)).toBe(true)
        expect(view.totalCount).toBe(6)
        expect(view.readyCount).toBe(6)
    })

    it("disables close and names draft bills in the helper", () => {
        const view = assembleMonthEndChecklist(baseSignals({
            draftBills: { count: 3, amount: 15_000_000 },
        }))
        expect(view.canClose).toBe(false)
        expect(view.blockerHint).toBe("3 bill masih draft")
        const bills = view.rows.find((row) => row.id === "draft-bills")
        expect(bills?.ok).toBe(false)
        expect(bills?.href).toBe("/finance/bills")
        expect(bills?.amount).toBe(15_000_000)
    })

    it("joins several blockers for the tooltip helper", () => {
        const view = assembleMonthEndChecklist(baseSignals({
            integrity: { failedChecks: 1, draftJournals: 2 },
            draftInvoices: { count: 2, amount: 8_000_000 },
            payroll: { unposted: true, amount: 50_000_000 },
        }))
        expect(view.canClose).toBe(false)
        expect(view.blockerHint).toBe(
            "1 cek integritas gagal · 2 jurnal masih draft · 2 invoice masih draft · Payroll September 2026 belum diposting",
        )
    })

    it("keeps close disabled after the period is already locked", () => {
        const view = assembleMonthEndChecklist(baseSignals({ isClosed: true }))
        expect(view.canClose).toBe(false)
        expect(view.blockerHint).toBe("Periode sudah ditutup")
        const lock = view.rows.find((row) => row.id === "period-lock")
        expect(lock?.ok).toBe(true)
        expect(lock?.blocking).toBe(false)
        expect(lock?.label).toBe("Periode sudah dikunci")
    })

    it("blocks close when the fiscal period row is missing", () => {
        const view = assembleMonthEndChecklist(baseSignals({
            periodId: null,
            periodMissing: true,
        }))
        expect(view.canClose).toBe(false)
        expect(view.blockerHint).toBe("Periode fiskal belum digenerate")
        const lock = view.rows.find((row) => row.id === "period-lock")
        expect(lock?.ok).toBe(false)
        expect(lock?.blocking).toBe(true)
    })

    it("omits integrity, payroll, and depreciation when those signals are missing", () => {
        const view = assembleMonthEndChecklist(baseSignals({
            integrity: null,
            payroll: null,
            depreciation: null,
        }))
        expect(view.rows.map((row) => row.id)).toEqual([
            "draft-bills",
            "draft-invoices",
            "period-lock",
        ])
        expect(view.canClose).toBe(true)
    })

    it("treats unposted depreciation as a blocking red row", () => {
        const view = assembleMonthEndChecklist(baseSignals({
            depreciation: { unposted: true, amount: 9_500_000 },
        }))
        const dep = view.rows.find((row) => row.id === "depreciation")
        expect(dep?.ok).toBe(false)
        expect(dep?.href).toBe("/finance/fixed-assets/depreciation")
        expect(view.blockerHint).toBe("Penyusutan September 2026 belum diposting")
        expect(view.canClose).toBe(false)
    })
})

describe("monthEndTitle", () => {
    it("uses the siap-tutup copy for an open period", () => {
        expect(monthEndTitle("September 2026", false)).toBe("Siap Tutup Buku — September 2026")
    })

    it("uses the already-closed copy after lock", () => {
        expect(monthEndTitle("September 2026", true)).toBe("Buku September 2026 Sudah Ditutup")
    })
})
