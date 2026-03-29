import { InvoiceType } from "@prisma/client"

import { SYS_ACCOUNTS, getCashAccountCode } from "@/lib/gl-accounts"
import { getPPhLiabilityAccount, type PPhTypeValue } from "@/lib/pph-helpers"
import type { RequiredSystemAccountDef } from "@/lib/invoice-posting-accounts"

export const INVOICE_PAYMENT_ACCOUNT_DEFS: Record<string, RequiredSystemAccountDef> = {
    [SYS_ACCOUNTS.CASH]: { code: SYS_ACCOUNTS.CASH, name: "Kas & Setara Kas", type: "ASSET" },
    [SYS_ACCOUNTS.BANK_BCA]: { code: SYS_ACCOUNTS.BANK_BCA, name: "Bank BCA", type: "ASSET" },
    [SYS_ACCOUNTS.AR]: { code: SYS_ACCOUNTS.AR, name: "Piutang Usaha", type: "ASSET" },
    [SYS_ACCOUNTS.PPH_PREPAID]: { code: SYS_ACCOUNTS.PPH_PREPAID, name: "PPh Dibayar Dimuka", type: "ASSET" },
    [SYS_ACCOUNTS.AP]: { code: SYS_ACCOUNTS.AP, name: "Utang Usaha (AP)", type: "LIABILITY" },
    [SYS_ACCOUNTS.PPH_21_PAYABLE]: { code: SYS_ACCOUNTS.PPH_21_PAYABLE, name: "Utang PPh 21", type: "LIABILITY" },
    [SYS_ACCOUNTS.PPH_23_PAYABLE]: { code: SYS_ACCOUNTS.PPH_23_PAYABLE, name: "Utang PPh 23", type: "LIABILITY" },
    [SYS_ACCOUNTS.PPH_4_2_PAYABLE]: { code: SYS_ACCOUNTS.PPH_4_2_PAYABLE, name: "Utang PPh 4(2)", type: "LIABILITY" },
}

export function getRequiredInvoicePaymentPostingSystemAccountCodes(input: {
    type: InvoiceType
    paymentMethod: 'CASH' | 'TRANSFER' | 'CHECK' | 'GIRO' | 'CREDIT_CARD' | 'OTHER'
    withholdingType?: PPhTypeValue
    withholdingAmount?: number
}): string[] {
    const codes = [
        getCashAccountCode(input.paymentMethod),
        input.type === "INV_OUT" ? SYS_ACCOUNTS.AR : SYS_ACCOUNTS.AP,
    ]

    if ((input.withholdingAmount || 0) > 0) {
        if (input.type === "INV_OUT") {
            codes.push(SYS_ACCOUNTS.PPH_PREPAID)
        } else if (input.withholdingType) {
            codes.push(getPPhLiabilityAccount(input.withholdingType))
        }
    }

    return Array.from(new Set(codes))
}
