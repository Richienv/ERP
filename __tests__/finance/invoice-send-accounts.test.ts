import { describe, expect, it } from "vitest"

import { InvoiceType } from "@prisma/client"

import { getRequiredInvoicePostingSystemAccountCodes } from "@/lib/actions/finance-invoices"
import { SYS_ACCOUNTS } from "@/lib/gl-accounts"

describe("getRequiredInvoicePostingSystemAccountCodes", () => {
    it("returns only the outbound invoice accounts needed for AR recognition and fallback COGS", () => {
        expect(
            getRequiredInvoicePostingSystemAccountCodes({
                type: InvoiceType.INV_OUT,
                taxAmount: 11000,
                goodsReceivedViaPO: false,
            })
        ).toEqual([
            SYS_ACCOUNTS.AR,
            SYS_ACCOUNTS.REVENUE,
            SYS_ACCOUNTS.COGS,
            SYS_ACCOUNTS.INVENTORY_ASSET,
            SYS_ACCOUNTS.PPN_KELUARAN,
        ])
    })

    it("skips output VAT when the outbound invoice has no tax", () => {
        expect(
            getRequiredInvoicePostingSystemAccountCodes({
                type: InvoiceType.INV_OUT,
                taxAmount: 0,
                goodsReceivedViaPO: false,
            })
        ).toEqual([
            SYS_ACCOUNTS.AR,
            SYS_ACCOUNTS.REVENUE,
            SYS_ACCOUNTS.COGS,
            SYS_ACCOUNTS.INVENTORY_ASSET,
        ])
    })

    it("uses GR/IR clearing for PO-linked vendor bills", () => {
        expect(
            getRequiredInvoicePostingSystemAccountCodes({
                type: InvoiceType.INV_IN,
                taxAmount: 22000,
                goodsReceivedViaPO: true,
            })
        ).toEqual([
            SYS_ACCOUNTS.AP,
            SYS_ACCOUNTS.GR_IR_CLEARING,
            SYS_ACCOUNTS.PPN_MASUKAN,
        ])
    })

    it("uses the default expense account for direct vendor bills", () => {
        expect(
            getRequiredInvoicePostingSystemAccountCodes({
                type: InvoiceType.INV_IN,
                taxAmount: 0,
                goodsReceivedViaPO: false,
            })
        ).toEqual([
            SYS_ACCOUNTS.AP,
            SYS_ACCOUNTS.EXPENSE_DEFAULT,
        ])
    })
})
