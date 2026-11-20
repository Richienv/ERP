import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * A PO created from a supplier's own invoice (spare-part fast lane) already has its bill with the
 * supplier's prices and tax. Receiving goods must never rebuild that bill from received quantities
 * (which would also force 11% PPN onto an import bill).
 */

const { tx, withPrismaAuthMock } = vi.hoisted(() => {
    const tx = {
        purchaseOrder: { findUnique: vi.fn() },
        supplierInvoiceCapture: { findUnique: vi.fn() },
        invoice: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
        invoiceItem: { deleteMany: vi.fn() },
    }
    return { tx, withPrismaAuthMock: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)) }
})

vi.mock("@/lib/db", () => ({ withPrismaAuth: withPrismaAuthMock, prisma: tx }))
vi.mock("@/lib/period-helpers", () => ({ assertPeriodOpen: vi.fn() }))

import { createBillFromPOId, recordPendingBillFromPO } from "@/lib/actions/finance-invoices"

const po = {
    id: "po-1",
    number: "PO-SP-0001",
    taxMode: "EXCLUSIVE",
    items: [{ productId: "p1", receivedQty: 100, quantity: 100, unitPrice: 448200, product: { name: "Cover Assy Clutch" } }],
}

describe("bill-from-received guard for captured supplier invoices", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        tx.purchaseOrder.findUnique.mockResolvedValue(po)
        tx.supplierInvoiceCapture.findUnique.mockResolvedValue({ billId: "bill-1", bill: { number: "BILL-PO-SP-0001", status: "DRAFT" } })
    })

    it("skips rebuilding the bill after a receipt and reports the existing one", async () => {
        const result = await recordPendingBillFromPO(po)
        expect(result).toMatchObject({ success: true, skipped: true, alreadyExists: true, billId: "bill-1", billNumber: "BILL-PO-SP-0001" })
        expect(tx.invoice.findMany).not.toHaveBeenCalled()
        expect(tx.invoice.create).not.toHaveBeenCalled()
        expect(tx.invoice.update).not.toHaveBeenCalled()
    })

    it("refuses a manual 'bill from PO' even when forced, with a clear reason", async () => {
        const result = await createBillFromPOId("po-1", { forceCreate: true })
        expect(result).toMatchObject({
            success: false,
            code: "INVOICE_ALREADY_EXISTS",
            requiresConfirmation: false,
            existingInvoiceId: "bill-1",
        })
        expect((result as { error: string }).error).toMatch(/invoice supplier/)
        expect(tx.invoice.create).not.toHaveBeenCalled()
    })

    it("still plans a bill for an ordinary PO", async () => {
        tx.supplierInvoiceCapture.findUnique.mockResolvedValue(null)
        tx.invoice.findMany.mockResolvedValue([])
        await recordPendingBillFromPO(po).catch(() => undefined)
        expect(tx.invoice.findMany).toHaveBeenCalled()
    })
})
