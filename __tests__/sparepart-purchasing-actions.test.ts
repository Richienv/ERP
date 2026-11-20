import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => {
    const tx = {
        supplier: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
        supplierInvoiceCapture: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
        category: { upsert: vi.fn() },
        product: { findMany: vi.fn(), createManyAndReturn: vi.fn() },
        purchaseOrder: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
        purchaseOrderEvent: { create: vi.fn() },
        invoice: { create: vi.fn() },
        $executeRaw: vi.fn(),
        supplierInvoiceTemplate: { upsert: vi.fn() },
        invoiceAttachment: { create: vi.fn() },
        goodsReceivedNote: { deleteMany: vi.fn() },
    }
    return {
        tx,
        withPrismaAuth: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
        getAuthzUser: vi.fn(),
        assertRole: vi.fn(),
        getNextDocNumber: vi.fn(),
        moveInvoiceToSent: vi.fn(),
        recordVendorPayment: vi.fn(),
        markAsShipped: vi.fn(),
        createGRN: vi.fn(),
        acceptGRN: vi.fn(),
        ensureSystemAccounts: vi.fn(),
    }
})

vi.mock("@/lib/db", () => ({ withPrismaAuth: m.withPrismaAuth, prisma: m.tx }))
vi.mock("@/lib/authz", () => ({
    getAuthzUser: m.getAuthzUser,
    assertRole: m.assertRole,
    FINANCE_POSTING_ROLES: ["ROLE_ADMIN", "ROLE_ACCOUNTANT"],
}))
vi.mock("@/lib/gl-accounts-server", () => ({
    SYS_ACCOUNTS: { GR_IR_CLEARING: "2150", CASH: "1000", PETTY_CASH: "1050", BANK_BCA: "1110" },
    CASH_BANK_CODES: ["1000", "1050", "1110", "1111"],
    ensureSystemAccounts: m.ensureSystemAccounts,
}))
vi.mock("@/lib/sparepart-file-store", () => ({
    INVOICE_FILE_TYPES: { "application/pdf": "pdf" },
    storagePathFor: (sha: string) => `supplier-invoices/${sha}.pdf`,
    invoiceFileExists: vi.fn(async () => true),
}))
vi.mock("@/lib/document-numbering", () => ({ getNextDocNumber: m.getNextDocNumber }))
vi.mock("@/lib/actions/finance-invoices", () => ({ moveInvoiceToSent: m.moveInvoiceToSent }))
vi.mock("@/lib/actions/finance-ap", () => ({ recordVendorPayment: m.recordVendorPayment }))
vi.mock("@/lib/actions/procurement", () => ({ markAsShipped: m.markAsShipped }))
vi.mock("@/lib/actions/grn", () => ({ createGRN: m.createGRN, acceptGRN: m.acceptGRN }))

import { recordSparepartPayment, saveSupplierInvoice, type SaveSupplierInvoiceInput } from "@/lib/actions/sparepart-purchasing"

const rmbInvoice = (): SaveSupplierInvoiceInput => ({
    supplier: { name: "GUANGZHOU RUIXIANG AUTO PARTS CO., LTD.", email: "sales@ruixiang-parts.example" },
    invoiceNo: "RX-2026-1108",
    invoiceDate: "2026-11-08",
    dueDate: null,
    paymentTerms: "T/T 30% deposit, 70% before shipment",
    currencyCode: "CNY",
    exchangeRate: 2490,
    taxOriginal: 0,
    lines: [
        { productId: "p-cover", partNo: "2304A078", description: "COVER ASSY,CLUTCH", qty: 100, unit: "PCS", unitPriceOriginal: 180 },
        { newProduct: { code: "1465A041", name: "INJECTOR ASSEMBLY/FUEL", unit: "PCS" }, partNo: "1465A041", description: "INJECTOR ASSEMBLY/FUEL", qty: 50, unit: "PCS", unitPriceOriginal: 585 },
    ],
    file: { name: "rx.pdf", type: "application/pdf", size: 50000, sha256: "abc" },
    parse: { method: "TEXT", ms: 42, confidence: 0.97, fingerprint: { printedName: "GUANGZHOU RUIXIANG" }, template: { numberLocale: "en" } },
})

describe("saveSupplierInvoice", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        m.getAuthzUser.mockResolvedValue({ id: "u1", role: "ROLE_ADMIN", email: "a@b.c" })
        m.assertRole.mockImplementation(() => undefined)
        m.getNextDocNumber.mockImplementation(async (_tx: unknown, prefix: string) => `${prefix}-0001`)
        m.tx.supplier.findUnique.mockResolvedValue(null)
        m.tx.supplier.findFirst.mockResolvedValue(null)
        m.tx.supplier.create.mockResolvedValue({ id: "s-new" })
        m.tx.supplierInvoiceCapture.findUnique.mockResolvedValue(null)
        m.tx.category.upsert.mockResolvedValue({ id: "cat-sp" })
        m.tx.product.findMany.mockResolvedValue([])
        m.tx.product.createManyAndReturn.mockResolvedValue([{ id: "p-new", code: "1465A041" }])
        m.tx.purchaseOrder.findUnique.mockResolvedValue(null)
        m.tx.purchaseOrder.create.mockResolvedValue({ id: "po-1", number: "PO-202611-0001" })
        m.tx.invoice.create.mockResolvedValue({ id: "bill-1", number: "BILL-PO-202611-0001" })
        m.tx.supplierInvoiceCapture.create.mockResolvedValue({ id: "cap-1" })
        m.moveInvoiceToSent.mockResolvedValue({ success: true })
    })

    it("creates supplier, product, PO, bill and capture in one transaction, in IDR at the invoice rate", async () => {
        const r = await saveSupplierInvoice(rmbInvoice())
        expect(r).toMatchObject({ success: true, captureId: "cap-1", poNumber: "PO-202611-0001", billNumber: "BILL-PO-202611-0001" })
        expect(m.withPrismaAuth).toHaveBeenCalledTimes(1)

        expect(m.tx.supplier.create.mock.calls[0][0].data).toMatchObject({ code: "SUP-SP-0001", name: "GUANGZHOU RUIXIANG AUTO PARTS CO., LTD." })
        expect(m.tx.product.createManyAndReturn.mock.calls[0][0].data).toEqual([
            expect.objectContaining({ code: "1465A041", equipmentType: "spare_part", categoryId: "cat-sp", costPrice: 1456650 }),
        ])

        const po = m.tx.purchaseOrder.create.mock.calls[0][0].data
        expect(po).toMatchObject({ status: "VENDOR_CONFIRMED", taxMode: "NON_PPN", totalAmount: 117652500, taxAmount: 0, netAmount: 117652500, supplierId: "s-new" })
        expect(po.items.createMany.data).toEqual([
            expect.objectContaining({ productId: "p-cover", quantity: 100, unitPrice: 448200, totalPrice: 44820000 }),
            expect.objectContaining({ productId: "p-new", quantity: 50, unitPrice: 1456650, totalPrice: 72832500 }),
        ])
        // The PO item ids are stored with each parsed line, so the detail never mixes up OE numbers.
        const capLines = m.tx.supplierInvoiceCapture.create.mock.calls[0][0].data.parsed.lines
        expect(capLines.map((l: { poItemId: string }) => l.poItemId)).toEqual(po.items.createMany.data.map((i: { id: string }) => i.id))

        const bill = m.tx.invoice.create.mock.calls[0][0].data
        expect(bill).toMatchObject({ type: "INV_IN", status: "DRAFT", glAccountCode: "2150", subtotal: 117652500, totalAmount: 117652500, balanceDue: 117652500, currencyCode: "IDR" })

        const cap = m.tx.supplierInvoiceCapture.create.mock.calls[0][0].data
        expect(cap).toMatchObject({ currencyCode: "CNY", exchangeRate: 2490, subtotalOriginal: 47250, totalOriginal: 47250, parseMethod: "TEXT", fileSha256: "abc" })
        expect(cap.searchText).toContain("2304a078")
        expect(cap.searchText).toContain("rx-2026-1108")

        // Supplier SKUs and prices for every line: one statement, not one per line.
        expect(m.tx.$executeRaw).toHaveBeenCalledTimes(1)
        expect(m.tx.supplierInvoiceTemplate.upsert.mock.calls[0][0].create).toMatchObject({ supplierId: "s-new", lastRate: 2490 })
        expect(m.tx.invoiceAttachment.create.mock.calls[0][0].data.fileUrl).toBe("/api/procurement/sparepart-invoices/cap-1/file")

        // Posting goes through the canonical bill posting, after the commit.
        expect(m.ensureSystemAccounts).toHaveBeenCalled()
        expect(m.moveInvoiceToSent).toHaveBeenCalledWith("bill-1")
        expect(r.success && r.steps.post).toEqual({ ok: true })
    })

    it("separates PPN for a local invoice", async () => {
        const input = rmbInvoice()
        input.currencyCode = "IDR"
        input.exchangeRate = 1
        input.taxOriginal = 1084325
        input.lines = [{ productId: "p1", partNo: "4605A558", description: "Kampas Rem", qty: 10, unitPriceOriginal: 425000, discountPct: 5 }]
        await saveSupplierInvoice(input)
        const po = m.tx.purchaseOrder.create.mock.calls[0][0].data
        expect(po).toMatchObject({ taxMode: "EXCLUSIVE", totalAmount: 4037500, taxAmount: 1084325, netAmount: 5121825 })
        const bill = m.tx.invoice.create.mock.calls[0][0].data
        expect(bill).toMatchObject({ subtotal: 4037500, taxAmount: 1084325, totalAmount: 5121825 })
    })

    it("refuses an implausible rate such as 2.49 for RMB", async () => {
        const input = rmbInvoice()
        input.exchangeRate = 2.49
        const r = await saveSupplierInvoice(input)
        expect(r).toMatchObject({ success: false })
        expect(r.success ? "" : r.error).toMatch(/antara 500 dan 10\.000/)
        expect(m.withPrismaAuth).not.toHaveBeenCalled()
    })

    it("refuses VAT on an import invoice (it is not PPN Masukan)", async () => {
        const input = rmbInvoice()
        input.taxOriginal = 11524.5
        expect(await saveSupplierInvoice(input)).toMatchObject({ success: false, error: expect.stringMatching(/PPN impor/) })
    })

    it("reuses an existing supplier with the same name instead of creating a twin", async () => {
        m.tx.supplier.findFirst.mockResolvedValue({ id: "s-old", name: "Guangzhou Ruixiang Auto Parts Co., Ltd." })
        const r = await saveSupplierInvoice(rmbInvoice())
        expect(r).toMatchObject({ success: true, supplierId: "s-old" })
        expect(m.tx.supplier.create).not.toHaveBeenCalled()
    })

    it("skips PO numbers already taken by the count-based New PO dialog", async () => {
        let n = 0
        m.getNextDocNumber.mockImplementation(async (_tx: unknown, prefix: string) => `${prefix}-000${++n}`)
        m.tx.purchaseOrder.findUnique.mockImplementation(async ({ where }: { where: { number: string } }) => (where.number.endsWith("-0002") || where.number.endsWith("-0003") ? { id: "x" } : null))
        await saveSupplierInvoice(rmbInvoice())
        expect(m.tx.purchaseOrder.create.mock.calls[0][0].data.number).toMatch(/-0004$/)
    })

    it("derives the file path on the server from the hash", async () => {
        await saveSupplierInvoice(rmbInvoice())
        expect(m.tx.supplierInvoiceCapture.create.mock.calls[0][0].data.storagePath).toBe("supplier-invoices/abc.pdf")
    })

    it("rejects the same supplier invoice twice with a link to the first", async () => {
        m.tx.supplierInvoiceCapture.findUnique.mockResolvedValue({ id: "cap-old", purchaseOrder: { number: "PO-202611-0007" } })
        const r = await saveSupplierInvoice(rmbInvoice())
        expect(r).toMatchObject({ success: false, code: "DUPLICATE", existingId: "cap-old" })
        expect(r.success ? "" : r.error).toMatch(/sudah tercatat \(PO-202611-0007\)/)
        expect(m.tx.purchaseOrder.create).not.toHaveBeenCalled()
    })

    it("asks for the rate when a foreign invoice has none", async () => {
        const input = rmbInvoice()
        input.exchangeRate = 0
        expect(await saveSupplierInvoice(input)).toMatchObject({ success: false, error: expect.stringMatching(/Kurs RMB harus antara/) })
        expect(m.withPrismaAuth).not.toHaveBeenCalled()
    })

    it("saves but leaves the bill for finance when the user cannot post", async () => {
        m.getAuthzUser.mockResolvedValue({ id: "u2", role: "ROLE_PURCHASING" })
        m.assertRole.mockImplementation((_u: unknown, roles: string[]) => {
            if (!roles.includes("ROLE_PURCHASING")) throw new Error("forbidden")
        })
        const input = rmbInvoice()
        input.already = { paidOriginal: 14175 }
        const r = await saveSupplierInvoice(input)
        expect(r.success).toBe(true)
        expect(m.moveInvoiceToSent).not.toHaveBeenCalled()
        expect(r.success && r.steps.post?.skipped).toMatch(/finance/)
        expect(r.success && r.steps.pay?.skipped).toMatch(/setelah tagihan diposting/)
        expect(m.recordVendorPayment).not.toHaveBeenCalled()
    })

    it("refuses users without a purchasing role", async () => {
        m.assertRole.mockImplementation(() => {
            throw new Error("Akses ditolak")
        })
        expect(await saveSupplierInvoice(rmbInvoice())).toMatchObject({ success: false, error: "Akses ditolak" })
    })
})

describe("recordSparepartPayment", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        m.tx.supplierInvoiceCapture.findUnique.mockReset()
    })

    it("converts an RMB deposit at the booked rate, pays through the canonical AP action and syncs the PO", async () => {
        m.tx.supplierInvoiceCapture.findUnique
            .mockResolvedValueOnce({ supplierId: "s1", supplierInvoiceNo: "RX-1", currencyCode: "CNY", exchangeRate: 2490, billId: "bill-1", bill: { balanceDue: 220738500, status: "ISSUED" } })
            .mockResolvedValueOnce({ purchaseOrderId: "po-1", bill: { totalAmount: 220738500, balanceDue: 154516950 } })
        m.recordVendorPayment.mockResolvedValue({ success: true })
        m.getAuthzUser.mockResolvedValue({ id: "u1", role: "ROLE_ADMIN" })
        m.assertRole.mockImplementation(() => undefined)
        const r = await recordSparepartPayment({ id: "cap-1", amountOriginal: 26595 })
        expect(r).toEqual({ success: true, balanceDue: 154516950 })
        expect(m.recordVendorPayment).toHaveBeenCalledWith(expect.objectContaining({ supplierId: "s1", billId: "bill-1", amount: 66221550, method: "TRANSFER", reference: "RX-1" }))
        expect(m.tx.purchaseOrder.update).toHaveBeenCalledWith({ where: { id: "po-1" }, data: { paymentStatus: "PARTIAL" } })
    })

    it("checks the role before reading anything", async () => {
        m.getAuthzUser.mockResolvedValue({ id: "u2", role: "ROLE_PURCHASING" })
        m.assertRole.mockImplementation(() => {
            throw new Error("forbidden")
        })
        expect(await recordSparepartPayment({ id: "cap-1", amountOriginal: 5 })).toMatchObject({ success: false })
        expect(m.tx.supplierInvoiceCapture.findUnique).not.toHaveBeenCalled()
    })

    it("pays from Kas as CASH when a cash account is chosen", async () => {
        m.getAuthzUser.mockResolvedValue({ id: "u1", role: "ROLE_ADMIN" })
        m.assertRole.mockImplementation(() => undefined)
        m.tx.supplierInvoiceCapture.findUnique
            .mockResolvedValueOnce({ supplierId: "s1", supplierInvoiceNo: "N-1", currencyCode: "IDR", exchangeRate: 1, billId: "b", bill: { balanceDue: 1000, status: "ISSUED" } })
            .mockResolvedValueOnce({ purchaseOrderId: "po-1", bill: { totalAmount: 1000, balanceDue: 0 } })
        m.recordVendorPayment.mockResolvedValue({ success: true })
        await recordSparepartPayment({ id: "cap-1", amountOriginal: 1000, bankAccountCode: "1000" })
        expect(m.recordVendorPayment).toHaveBeenCalledWith(expect.objectContaining({ method: "CASH", bankAccountCode: "1000", amount: 1000 }))
    })

    it("will not pay a bill that is not posted yet", async () => {
        m.getAuthzUser.mockResolvedValue({ id: "u1", role: "ROLE_ADMIN" })
        m.assertRole.mockImplementation(() => undefined)
        m.tx.supplierInvoiceCapture.findUnique.mockResolvedValueOnce({ supplierId: "s1", currencyCode: "IDR", exchangeRate: 1, billId: "b", bill: { balanceDue: 10, status: "DRAFT" } })
        expect(await recordSparepartPayment({ id: "cap-1", amountOriginal: 5 })).toEqual({ success: false, error: "Tagihan belum diposting" })
        expect(m.recordVendorPayment).not.toHaveBeenCalled()
    })
})
