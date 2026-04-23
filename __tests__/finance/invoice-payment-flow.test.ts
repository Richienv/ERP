import { beforeEach, describe, expect, it, vi } from "vitest"

import { InvoiceType } from "@prisma/client"

const {
    withPrismaAuthMock,
    postJournalEntryMock,
    assertPeriodOpenMock,
} = vi.hoisted(() => ({
    withPrismaAuthMock: vi.fn(),
    postJournalEntryMock: vi.fn(),
    assertPeriodOpenMock: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
    withPrismaAuth: withPrismaAuthMock,
    prisma: {},
}))

vi.mock("@/lib/actions/finance-gl", () => ({
    postJournalEntry: postJournalEntryMock,
}))

vi.mock("@/lib/period-helpers", () => ({
    assertPeriodOpen: assertPeriodOpenMock,
}))

vi.mock("@/lib/gl-accounts-server", () => ({
    SYS_ACCOUNTS: {
        CASH: "1000",
        BANK_BCA: "1110",
        AR: "1200",
        AP: "2000",
        PPH_PREPAID: "1340",
        PPH_21_PAYABLE: "2310",
        PPH_23_PAYABLE: "2315",
        PPH_4_2_PAYABLE: "2230",
    },
    ensureSystemAccounts: vi.fn(),
    getCashAccountCode: (method: string) => (method === "CASH" ? "1000" : "1110"),
    isCOGSAccount: vi.fn(),
}))

vi.mock("@/lib/pph-helpers", () => ({
    getPPhLiabilityAccount: (type: string) => {
        if (type === "PPH_21") return "2310"
        if (type === "PPH_4_2") return "2230"
        return "2315"
    },
}))

vi.mock("@/lib/payment-term-helpers", () => ({
    legacyTermToDays: vi.fn(),
    calculateDueDate: vi.fn(),
}))

vi.mock("@/lib/currency-helpers", () => ({
    getExchangeRate: vi.fn(),
    convertToIDR: vi.fn((amount: number) => amount),
}))

import {
    recordInvoicePayment,
} from "@/lib/actions/finance-invoices"
import { SYS_ACCOUNTS } from "@/lib/gl-accounts"
import { getRequiredInvoicePaymentPostingSystemAccountCodes } from "@/lib/invoice-payment-posting-accounts"

describe("getRequiredInvoicePaymentPostingSystemAccountCodes", () => {
    it("returns only the AP payment accounts needed for a normal bill payment", () => {
        expect(
            getRequiredInvoicePaymentPostingSystemAccountCodes({
                type: InvoiceType.INV_IN,
                paymentMethod: "TRANSFER",
                withholdingAmount: 0,
            })
        ).toEqual([
            SYS_ACCOUNTS.BANK_BCA,
            SYS_ACCOUNTS.AP,
        ])
    })

    it("adds the withholding liability account for vendor payments with PPh", () => {
        expect(
            getRequiredInvoicePaymentPostingSystemAccountCodes({
                type: InvoiceType.INV_IN,
                paymentMethod: "TRANSFER",
                withholdingType: "PPH_23",
                withholdingAmount: 50000,
            })
        ).toEqual([
            SYS_ACCOUNTS.BANK_BCA,
            SYS_ACCOUNTS.AP,
            SYS_ACCOUNTS.PPH_23_PAYABLE,
        ])
    })
})

describe("recordInvoicePayment", () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it("records a bill payment atomically and posts GL with the transaction client", async () => {
        const tx = {
            invoice: {
                findUnique: vi.fn().mockResolvedValue({
                    id: "inv-1",
                    number: "BILL-2026-0001",
                    type: "INV_IN",
                    status: "ISSUED",
                    balanceDue: 83_250_000,
                    customerId: null,
                    supplierId: "sup-1",
                    customer: null,
                    supplier: { name: "PT Vendor" },
                }),
                update: vi.fn().mockResolvedValue({}),
            },
            payment: {
                count: vi.fn().mockResolvedValue(0),
                create: vi.fn().mockResolvedValue({
                    id: "pay-1",
                    number: "VPAY-2026-0001",
                }),
                update: vi.fn().mockResolvedValue({}),
            },
            withholdingTax: {
                create: vi.fn().mockResolvedValue({}),
            },
            gLAccount: {
                findMany: vi.fn().mockResolvedValue([]),
                createMany: vi.fn().mockResolvedValue({ count: 2 }),
            },
        }

        withPrismaAuthMock.mockImplementation(async (operation: (prisma: typeof tx) => Promise<unknown>) => operation(tx))
        postJournalEntryMock.mockResolvedValue({ success: true, id: "je-1" })

        const paymentDate = new Date("2026-03-29T00:00:00.000Z")
        const result = await recordInvoicePayment({
            invoiceId: "inv-1",
            paymentMethod: "TRANSFER",
            amount: 83_250_000,
            paymentDate,
            reference: "Ref #123456",
            notes: "Pembayaran dari Invoice Center",
        })

        expect(result).toEqual({
            success: true,
            paymentId: "pay-1",
            paymentNumber: "VPAY-2026-0001",
        })
        expect(assertPeriodOpenMock).toHaveBeenCalledWith(new Date("2026-03-29T00:00:00.000Z"))
        expect(tx.gLAccount.createMany).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.arrayContaining([
                expect.objectContaining({ code: SYS_ACCOUNTS.BANK_BCA }),
                expect.objectContaining({ code: SYS_ACCOUNTS.AP }),
            ]),
            skipDuplicates: true,
        }))
        expect(tx.payment.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                number: "VPAY-2026-0001",
                date: new Date("2026-03-29T00:00:00.000Z"),
                amount: 83_250_000,
                method: "TRANSFER",
                invoiceId: "inv-1",
                supplierId: "sup-1",
                glPostingStatus: "PENDING",
            }),
        }))
        expect(tx.invoice.update).toHaveBeenCalledWith({
            where: { id: "inv-1" },
            data: { status: "PAID", balanceDue: 0 },
        })
        expect(postJournalEntryMock).toHaveBeenCalledWith(expect.objectContaining({
            invoiceId: "inv-1",
            paymentId: "pay-1",
            date: new Date("2026-03-29T00:00:00.000Z"),
            reference: "VPAY-2026-0001 — BILL-2026-0001",
        }), tx)
        expect(tx.payment.update).toHaveBeenCalledWith({
            where: { id: "pay-1" },
            data: { glPostingStatus: "POSTED" },
        })
    })

    it("rejects overpayments using the latest invoice balance from the database", async () => {
        const tx = {
            invoice: {
                findUnique: vi.fn().mockResolvedValue({
                    id: "inv-2",
                    number: "INV-2026-0007",
                    type: "INV_OUT",
                    status: "ISSUED",
                    balanceDue: 100_000,
                    customerId: "cust-1",
                    supplierId: null,
                    customer: { name: "PT Customer" },
                    supplier: null,
                }),
                update: vi.fn(),
            },
            payment: {
                count: vi.fn(),
                create: vi.fn(),
                update: vi.fn(),
            },
            withholdingTax: {
                create: vi.fn(),
            },
            gLAccount: {
                findMany: vi.fn().mockResolvedValue([]),
                createMany: vi.fn(),
            },
        }

        withPrismaAuthMock.mockImplementation(async (operation: (prisma: typeof tx) => Promise<unknown>) => operation(tx))

        const result = await recordInvoicePayment({
            invoiceId: "inv-2",
            paymentMethod: "TRANSFER",
            amount: 120_000,
            paymentDate: new Date("2026-03-29T00:00:00.000Z"),
        })

        expect(result).toEqual({
            success: false,
            error: "Jumlah pembayaran tidak boleh melebihi sisa tagihan",
        })
        expect(tx.payment.create).not.toHaveBeenCalled()
        expect(postJournalEntryMock).not.toHaveBeenCalled()
    })
})
