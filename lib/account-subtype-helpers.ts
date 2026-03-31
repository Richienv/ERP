/**
 * Infer AccountSubType from account code based on Indonesian PSAK COA structure.
 */
export function inferSubType(code: string): string {
    const num = parseInt(code, 10)
    if (isNaN(num)) return "GENERAL"

    // Assets (1xxx)
    if (num >= 1000 && num <= 1199) return "ASSET_CASH"
    if (num >= 1200 && num <= 1299) return "ASSET_RECEIVABLE"
    if (num >= 1300 && num <= 1329) return "ASSET_CURRENT"
    if (num >= 1330 && num <= 1399) return "ASSET_PREPAYMENTS"
    if (num >= 1400 && num <= 1499) return "ASSET_CURRENT"
    if (num >= 1500 && num <= 1799) return "ASSET_FIXED"
    if (num >= 1800 && num <= 1999) return "ASSET_NON_CURRENT"

    // Liabilities (2xxx)
    if (num >= 2000 && num <= 2099) return "LIABILITY_PAYABLE"
    if (num >= 2100 && num <= 2499) return "LIABILITY_CURRENT"
    if (num >= 2500 && num <= 2999) return "LIABILITY_NON_CURRENT"

    // Equity (3xxx)
    if (num === 3300) return "EQUITY_UNAFFECTED"
    if (num >= 3000 && num <= 3999) return "EQUITY"

    // Revenue (4xxx)
    if (num >= 4000 && num <= 4199) return "INCOME"
    if (num >= 4200 && num <= 4999) return "INCOME_OTHER"

    // COGS (5xxx)
    if (num >= 5000 && num <= 5999) return "EXPENSE_DIRECT_COST"

    // Operating expenses (6xxx)
    if (num === 6290) return "EXPENSE_DEPRECIATION"
    if (num >= 6000 && num <= 6999) return "EXPENSE"

    // Depreciation / Other (7xxx)
    if (num >= 7000 && num <= 7999) return "EXPENSE_DEPRECIATION"

    // Non-operational / tax (8-9xxx)
    if (num >= 8000 && num <= 9999) return "EXPENSE"

    return "GENERAL"
}

/**
 * Human-readable label for AccountSubType (Bahasa Indonesia)
 */
export function subTypeLabel(subType: string): string {
    const labels: Record<string, string> = {
        ASSET_CASH: "Kas & Bank",
        ASSET_RECEIVABLE: "Piutang",
        ASSET_CURRENT: "Aset Lancar",
        ASSET_NON_CURRENT: "Aset Tidak Lancar",
        ASSET_PREPAYMENTS: "Biaya Dibayar Dimuka",
        ASSET_FIXED: "Aset Tetap",
        LIABILITY_PAYABLE: "Hutang Usaha",
        LIABILITY_CURRENT: "Kewajiban Lancar",
        LIABILITY_NON_CURRENT: "Kewajiban Jk Panjang",
        EQUITY: "Modal",
        EQUITY_UNAFFECTED: "Laba Tahun Berjalan",
        INCOME: "Pendapatan",
        INCOME_OTHER: "Pendapatan Lain-lain",
        EXPENSE: "Beban Operasional",
        EXPENSE_DEPRECIATION: "Penyusutan",
        EXPENSE_DIRECT_COST: "Harga Pokok",
        GENERAL: "Umum",
    }
    return labels[subType] || subType
}
