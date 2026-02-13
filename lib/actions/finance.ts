// Barrel re-export — this file was split into domain-specific modules.
// All existing imports from "@/lib/actions/finance" continue to work.
// Note: 'use server' is declared in each sub-module, not here.

export {
    // GL & Chart of Accounts
    getGLAccounts,
    getChartOfAccountsTree,
    getGLAccountsList,
    createGLAccount,
    // Journal Entries
    postJournalEntry,
    getJournalEntries,
    getJournalEntryById,
    // Types
    type GLAccountNode,
    type JournalEntryItem,
} from "./finance-gl"

export {
    // Dashboard & Metrics
    getFinanceDashboardData,
    getFinancialMetrics,
    // Financial Reports
    getProfitLossStatement,
    getBalanceSheet,
    getCashFlowStatement,
    // Types
    type FinancialMetrics,
    type FinanceDashboardData,
    type FinanceDashboardCashPoint,
    type FinanceDashboardActionItem,
    type FinanceDashboardRecentTransaction,
    type ProfitLossData,
    type BalanceSheetData,
    type CashFlowData,
} from "./finance-reports"

export {
    // Invoice Kanban & Customers
    getInvoiceKanbanData,
    getInvoiceCustomers,
    // Invoice CRUD
    createCustomerInvoice,
    recordPendingBillFromPO,
    createInvoiceFromSalesOrder,
    getPendingSalesOrders,
    getPendingPurchaseOrders,
    createBillFromPOId,
    // Invoice Workflow
    moveInvoiceToSent,
    recordInvoicePayment,
    // Types
    type InvoiceKanbanItem,
    type InvoiceKanbanData,
} from "./finance-invoices"

export {
    // Credit Notes & Refunds
    createCreditNote,
    processRefund,
    // Payment Vouchers & GIRO
    createPaymentVoucher,
    processGIROClearing,
    // Bank Reconciliation
    importBankStatement,
    getUnreconciledBankLines,
    reconcileBankLine,
    // AR Payments
    getARPaymentRegistry,
    getUnallocatedPayments,
    getOpenInvoices,
    recordARPayment,
    matchPaymentToInvoice,
    getARPaymentStats,
    // Types
    type BankStatementLine,
    type UnallocatedPayment,
    type OpenInvoice,
    type ARPaymentRegistryResult,
} from "./finance-ar"

export {
    // Vendor Bills
    getVendorBills,
    getVendorBillsRegistry,
    approveVendorBill,
    // Vendor Payments
    getVendorPayments,
    recordVendorPayment,
    // AP Stats & Actions
    getAPStats,
    disputeBill,
    approveAndPayBill,
    // Types
    type VendorBill,
    type VendorBillRegistryResult,
    type VendorPayment,
} from "./finance-ap"
