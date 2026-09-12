import { describe, expect, it } from "vitest"
import { TAX_RATES } from "@/lib/tax-rates"
import { planBillFromReceived, totalsFromReceivedLines } from "@/lib/bill-from-received"

const solar = {
    productId: "prod-solar",
    product: { name: "Solar Industri" },
    receivedQty: 60,
    unitPrice: 10_000,
}

function po(receivedQty: number, extra: Partial<typeof solar> = {}) {
    return [{ ...solar, receivedQty, ...extra }]
}

describe("planBillFromReceived", () => {
    it("skips when nothing has been received (PO approve is a no-op)", () => {
        const plan = planBillFromReceived({
            poItems: po(0),
            taxMode: "EXCLUSIVE",
            existingBills: [],
        })
        expect(plan).toEqual({ action: "skip", reason: "nothing_received" })
    })

    it("creates a draft for received qty only — not the ordered qty", () => {
        const plan = planBillFromReceived({
            poItems: po(60),
            taxMode: "EXCLUSIVE",
            existingBills: [],
        })
        expect(plan.action).toBe("create")
        if (plan.action !== "create") return
        expect(plan.lines).toEqual([
            {
                description: "Solar Industri",
                quantity: 60,
                unitPrice: 10_000,
                amount: 600_000,
                productId: "prod-solar",
            },
        ])
        expect(plan.totals.subtotal).toBe(600_000)
        expect(plan.totals.taxAmount).toBe(Math.round(600_000 * TAX_RATES.PPN))
        expect(plan.totals.totalAmount).toBe(plan.totals.subtotal + plan.totals.taxAmount)
        expect(plan.totals.balanceDue).toBe(plan.totals.totalAmount)
    })

    it("refreshes the existing DRAFT up to the latest received qty", () => {
        const plan = planBillFromReceived({
            poItems: po(100),
            taxMode: "EXCLUSIVE",
            existingBills: [{
                id: "draft-1",
                number: "BILL-PO-1",
                status: "DRAFT",
                items: [{ productId: "prod-solar", description: "Solar Industri", quantity: 60 }],
            }],
        })
        expect(plan.action).toBe("refresh")
        if (plan.action !== "refresh") return
        expect(plan.draftId).toBe("draft-1")
        expect(plan.lines[0]?.quantity).toBe(100)
        expect(plan.totals.subtotal).toBe(1_000_000)
    })

    it("opens a new draft for the unbilled delta after a posted bill", () => {
        const plan = planBillFromReceived({
            poItems: po(100),
            taxMode: "EXCLUSIVE",
            existingBills: [{
                id: "posted-1",
                number: "BILL-PO-1",
                status: "ISSUED",
                items: [{ productId: "prod-solar", description: "Solar Industri", quantity: 60 }],
            }],
        })
        expect(plan.action).toBe("create")
        if (plan.action !== "create") return
        expect(plan.lines[0]?.quantity).toBe(40)
        expect(plan.totals.subtotal).toBe(400_000)
    })

    it("asks before creating another bill when received qty is already billed", () => {
        const plan = planBillFromReceived({
            poItems: po(60),
            taxMode: "EXCLUSIVE",
            existingBills: [{
                id: "posted-1",
                number: "BILL-PO-1",
                status: "ISSUED",
                items: [{ productId: "prod-solar", description: "Solar Industri", quantity: 60 }],
            }],
            options: { requireConfirmationOnDuplicate: true },
        })
        expect(plan).toMatchObject({
            action: "confirm",
            existing: { id: "posted-1", number: "BILL-PO-1", status: "ISSUED" },
        })
    })

    it("strips PPN from inclusive unit prices so the header is DPP + PPN", () => {
        const plan = planBillFromReceived({
            poItems: po(10, { unitPrice: 111_000 }),
            taxMode: "INCLUSIVE",
            existingBills: [],
        })
        expect(plan.action).toBe("create")
        if (plan.action !== "create") return
        const unitPrice = Math.round(111_000 / (1 + TAX_RATES.PPN))
        expect(plan.lines[0]?.unitPrice).toBe(unitPrice)
        expect(plan.totals.subtotal).toBe(Math.round(10 * unitPrice))
        expect(plan.totals.taxAmount).toBe(Math.round(plan.totals.subtotal * TAX_RATES.PPN))
    })
})

describe("totalsFromReceivedLines", () => {
    it("never copies PO header totals — tax comes from TAX_RATES.PPN", () => {
        const totals = totalsFromReceivedLines([
            { description: "A", quantity: 2, unitPrice: 50_000, amount: 100_000, productId: "a" },
        ])
        expect(totals.taxAmount).toBe(Math.round(100_000 * TAX_RATES.PPN))
        expect(totals.totalAmount).toBe(100_000 + totals.taxAmount)
    })
})
