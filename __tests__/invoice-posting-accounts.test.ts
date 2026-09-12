import { describe, expect, it } from "vitest"
import { SYS_ACCOUNTS } from "@/lib/gl-accounts"
import { resolveVendorBillDebitAccount } from "@/lib/invoice-posting-accounts"

describe("resolveVendorBillDebitAccount", () => {
    it("clears GR/IR when spare parts were already received", () => {
        expect(resolveVendorBillDebitAccount({
            goodsReceivedViaPO: true,
            glAccountCode: SYS_ACCOUNTS.EXPENSE_DEFAULT,
        })).toBe(SYS_ACCOUNTS.GR_IR_CLEARING)
    })

    it("expenses a service bill that never went through GRN", () => {
        expect(resolveVendorBillDebitAccount({
            goodsReceivedViaPO: false,
            glAccountCode: null,
        })).toBe(SYS_ACCOUNTS.EXPENSE_DEFAULT)
    })

    it("honours a user-selected expense account when there is no GRN", () => {
        expect(resolveVendorBillDebitAccount({
            goodsReceivedViaPO: false,
            glAccountCode: "6240",
        })).toBe("6240")
    })
})
