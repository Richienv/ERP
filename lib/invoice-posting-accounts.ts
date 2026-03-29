import { InvoiceType } from "@prisma/client"

import { SYS_ACCOUNTS } from "@/lib/gl-accounts"

export type RequiredSystemAccountDef = {
    code: string
    name: string
    type: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE"
}

export const INVOICE_POSTING_ACCOUNT_DEFS: Record<string, RequiredSystemAccountDef> = {
    [SYS_ACCOUNTS.AR]: { code: SYS_ACCOUNTS.AR, name: "Piutang Usaha", type: "ASSET" },
    [SYS_ACCOUNTS.AP]: { code: SYS_ACCOUNTS.AP, name: "Utang Usaha (AP)", type: "LIABILITY" },
    [SYS_ACCOUNTS.REVENUE]: { code: SYS_ACCOUNTS.REVENUE, name: "Pendapatan Penjualan", type: "REVENUE" },
    [SYS_ACCOUNTS.PPN_KELUARAN]: { code: SYS_ACCOUNTS.PPN_KELUARAN, name: "Utang Pajak (PPN/PPh)", type: "LIABILITY" },
    [SYS_ACCOUNTS.EXPENSE_DEFAULT]: { code: SYS_ACCOUNTS.EXPENSE_DEFAULT, name: "Beban Lain-lain", type: "EXPENSE" },
    [SYS_ACCOUNTS.PPN_MASUKAN]: { code: SYS_ACCOUNTS.PPN_MASUKAN, name: "PPN Masukan (Input VAT)", type: "ASSET" },
    [SYS_ACCOUNTS.GR_IR_CLEARING]: { code: SYS_ACCOUNTS.GR_IR_CLEARING, name: "Barang Diterima / Faktur Belum Diterima", type: "LIABILITY" },
    [SYS_ACCOUNTS.COGS]: { code: SYS_ACCOUNTS.COGS, name: "Beban Pokok Penjualan (HPP)", type: "EXPENSE" },
    [SYS_ACCOUNTS.INVENTORY_ASSET]: { code: SYS_ACCOUNTS.INVENTORY_ASSET, name: "Persediaan Barang Jadi", type: "ASSET" },
}

export function getRequiredInvoicePostingSystemAccountCodes(input: {
    type: InvoiceType
    taxAmount: number
    goodsReceivedViaPO: boolean
}): string[] {
    if (input.type === "INV_OUT") {
        const codes = [
            SYS_ACCOUNTS.AR,
            SYS_ACCOUNTS.REVENUE,
            SYS_ACCOUNTS.COGS,
            SYS_ACCOUNTS.INVENTORY_ASSET,
        ]
        if (input.taxAmount > 0) codes.push(SYS_ACCOUNTS.PPN_KELUARAN)
        return codes
    }

    const codes = [
        SYS_ACCOUNTS.AP,
        input.goodsReceivedViaPO ? SYS_ACCOUNTS.GR_IR_CLEARING : SYS_ACCOUNTS.EXPENSE_DEFAULT,
    ]
    if (input.taxAmount > 0) codes.push(SYS_ACCOUNTS.PPN_MASUKAN)
    return codes
}
