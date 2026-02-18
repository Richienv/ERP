/**
 * Centralized query key factory.
 * Ensures cache keys are consistent across hooks & prefetch.
 */

export const queryKeys = {
    customers: {
        all: ["customers"] as const,
        list: () => [...queryKeys.customers.all, "list"] as const,
        detail: (id: string) => [...queryKeys.customers.all, id] as const,
    },
    leads: {
        all: ["leads"] as const,
        list: () => [...queryKeys.leads.all, "list"] as const,
        detail: (id: string) => [...queryKeys.leads.all, id] as const,
    },
    salesOrders: {
        all: ["salesOrders"] as const,
        list: () => [...queryKeys.salesOrders.all, "list"] as const,
        detail: (id: string) => [...queryKeys.salesOrders.all, id] as const,
    },
    invoices: {
        all: ["invoices"] as const,
        kanban: (params?: { q?: string; type?: string }) =>
            [...queryKeys.invoices.all, "kanban", params ?? {}] as const,
    },
    products: {
        all: ["products"] as const,
        list: () => [...queryKeys.products.all, "list"] as const,
        detail: (id: string) => [...queryKeys.products.all, id] as const,
    },
    vendors: {
        all: ["vendors"] as const,
        list: () => [...queryKeys.vendors.all, "list"] as const,
    },
    purchaseOrders: {
        all: ["purchaseOrders"] as const,
        list: () => [...queryKeys.purchaseOrders.all, "list"] as const,
    },
    employees: {
        all: ["employees"] as const,
        list: () => [...queryKeys.employees.all, "list"] as const,
    },
    categories: {
        all: ["categories"] as const,
        list: () => [...queryKeys.categories.all, "list"] as const,
        master: () => [...queryKeys.categories.all, "master"] as const,
    },
    bom: {
        all: ["bom"] as const,
        list: () => [...queryKeys.bom.all, "list"] as const,
    },
    workOrders: {
        all: ["workOrders"] as const,
        list: () => [...queryKeys.workOrders.all, "list"] as const,
    },
    quotations: {
        all: ["quotations"] as const,
        list: () => [...queryKeys.quotations.all, "list"] as const,
        detail: (id: string) => [...queryKeys.quotations.all, id] as const,
    },
    salesDashboard: {
        all: ["salesDashboard"] as const,
        list: () => [...queryKeys.salesDashboard.all, "list"] as const,
    },
    financeDashboard: {
        all: ["financeDashboard"] as const,
        list: () => [...queryKeys.financeDashboard.all, "list"] as const,
    },
    purchaseRequests: {
        all: ["purchaseRequests"] as const,
        list: () => [...queryKeys.purchaseRequests.all, "list"] as const,
    },
    bills: {
        all: ["bills"] as const,
        list: () => [...queryKeys.bills.all, "list"] as const,
    },
    journal: {
        all: ["journal"] as const,
        list: () => [...queryKeys.journal.all, "list"] as const,
    },
    chartAccounts: {
        all: ["chartAccounts"] as const,
        list: () => [...queryKeys.chartAccounts.all, "list"] as const,
    },
    vendorPayments: {
        all: ["vendorPayments"] as const,
        list: () => [...queryKeys.vendorPayments.all, "list"] as const,
    },
    financeReports: {
        all: ["financeReports"] as const,
        list: (start?: string, end?: string) => [...queryKeys.financeReports.all, "list", start, end] as const,
    },
    mfgDashboard: {
        all: ["mfgDashboard"] as const,
        list: () => [...queryKeys.mfgDashboard.all, "list"] as const,
    },
    machines: {
        all: ["machines"] as const,
        list: () => [...queryKeys.machines.all, "list"] as const,
    },
    mfgGroups: {
        all: ["mfgGroups"] as const,
        list: () => [...queryKeys.mfgGroups.all, "list"] as const,
    },
    mfgRouting: {
        all: ["mfgRouting"] as const,
        list: () => [...queryKeys.mfgRouting.all, "list"] as const,
    },
    mfgPlanning: {
        all: ["mfgPlanning"] as const,
        list: () => [...queryKeys.mfgPlanning.all, "list"] as const,
    },
    spkOrders: {
        all: ["spkOrders"] as const,
        list: () => [...queryKeys.spkOrders.all, "list"] as const,
    },
    mfgQuality: {
        all: ["mfgQuality"] as const,
        list: () => [...queryKeys.mfgQuality.all, "list"] as const,
    },
    mfgSchedule: {
        all: ["mfgSchedule"] as const,
        list: () => [...queryKeys.mfgSchedule.all, "list"] as const,
    },
    glAccounts: {
        all: ["glAccounts"] as const,
        list: () => [...queryKeys.glAccounts.all, "list"] as const,
    },
    executiveDashboard: {
        all: ["executiveDashboard"] as const,
        list: () => [...queryKeys.executiveDashboard.all, "list"] as const,
    },
    inventoryDashboard: {
        all: ["inventoryDashboard"] as const,
        list: () => [...queryKeys.inventoryDashboard.all, "list"] as const,
    },
    procurementDashboard: {
        all: ["procurementDashboard"] as const,
        list: () => [...queryKeys.procurementDashboard.all, "list"] as const,
    },
    staffTasks: {
        all: ["staffTasks"] as const,
        list: () => [...queryKeys.staffTasks.all, "list"] as const,
    },
    managerDashboard: {
        all: ["managerDashboard"] as const,
        list: () => [...queryKeys.managerDashboard.all, "list"] as const,
    },
    cuttingDashboard: {
        all: ["cuttingDashboard"] as const,
        list: () => [...queryKeys.cuttingDashboard.all, "list"] as const,
    },
    cutPlans: {
        all: ["cutPlans"] as const,
        list: () => [...queryKeys.cutPlans.all, "list"] as const,
        detail: (id: string) => [...queryKeys.cutPlans.all, id] as const,
    },
    subcontractDashboard: {
        all: ["subcontractDashboard"] as const,
        list: () => [...queryKeys.subcontractDashboard.all, "list"] as const,
    },
    subcontractOrders: {
        all: ["subcontractOrders"] as const,
        list: () => [...queryKeys.subcontractOrders.all, "list"] as const,
        detail: (id: string) => [...queryKeys.subcontractOrders.all, id] as const,
    },
    subcontractRegistry: {
        all: ["subcontractRegistry"] as const,
        list: () => [...queryKeys.subcontractRegistry.all, "list"] as const,
        detail: (id: string) => [...queryKeys.subcontractRegistry.all, id] as const,
    },
    hcmAttendance: {
        all: ["hcmAttendance"] as const,
        list: () => [...queryKeys.hcmAttendance.all, "list"] as const,
    },
    hcmShifts: {
        all: ["hcmShifts"] as const,
        list: () => [...queryKeys.hcmShifts.all, "list"] as const,
    },
    hcmOnboarding: {
        all: ["hcmOnboarding"] as const,
        list: () => [...queryKeys.hcmOnboarding.all, "list"] as const,
    },
    costingDashboard: {
        all: ["costingDashboard"] as const,
        list: () => [...queryKeys.costingDashboard.all, "list"] as const,
    },
    costSheets: {
        all: ["costSheets"] as const,
        list: () => [...queryKeys.costSheets.all, "list"] as const,
        detail: (id: string) => [...queryKeys.costSheets.all, id] as const,
    },
    warehouses: {
        all: ["warehouses"] as const,
        list: () => [...queryKeys.warehouses.all, "list"] as const,
        detail: (id: string) => [...queryKeys.warehouses.all, id] as const,
    },
    procurementRequestForm: {
        all: ["procurementRequestForm"] as const,
        list: () => [...queryKeys.procurementRequestForm.all, "list"] as const,
    },
    approvals: {
        all: ["approvals"] as const,
        list: () => [...queryKeys.approvals.all, "list"] as const,
    },
    priceLists: {
        all: ["priceLists"] as const,
        list: () => [...queryKeys.priceLists.all, "list"] as const,
    },
    reconciliation: {
        all: ["reconciliation"] as const,
        list: () => [...queryKeys.reconciliation.all, "list"] as const,
    },
    documents: {
        all: ["documents"] as const,
        list: () => [...queryKeys.documents.all, "list"] as const,
    },
    salesPage: {
        all: ["salesPage"] as const,
        list: () => [...queryKeys.salesPage.all, "list"] as const,
    },
    hcmDashboard: {
        all: ["hcmDashboard"] as const,
        list: () => [...queryKeys.hcmDashboard.all, "list"] as const,
    },
    inventoryAudit: {
        all: ["inventoryAudit"] as const,
        list: () => [...queryKeys.inventoryAudit.all, "list"] as const,
    },
    units: {
        all: ["units"] as const,
        list: () => [...queryKeys.units.all, "list"] as const,
    },
    brands: {
        all: ["brands"] as const,
        list: () => [...queryKeys.brands.all, "list"] as const,
    },
    colors: {
        all: ["colors"] as const,
        list: () => [...queryKeys.colors.all, "list"] as const,
    },
    suppliers: {
        all: ["suppliers"] as const,
        list: () => [...queryKeys.suppliers.all, "list"] as const,
    },
    adjustments: {
        all: ["adjustments"] as const,
        list: () => [...queryKeys.adjustments.all, "list"] as const,
    },
    stockMovements: {
        all: ["stockMovements"] as const,
        list: () => [...queryKeys.stockMovements.all, "list"] as const,
    },
    fabricRolls: {
        all: ["fabricRolls"] as const,
        list: () => [...queryKeys.fabricRolls.all, "list"] as const,
    },
    stockTransfers: {
        all: ["stockTransfers"] as const,
        list: () => [...queryKeys.stockTransfers.all, "list"] as const,
    },
} as const
