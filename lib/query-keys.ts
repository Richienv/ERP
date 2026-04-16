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
        attachments: (invoiceId: string) =>
            [...queryKeys.invoices.all, "attachments", invoiceId] as const,
    },
    products: {
        all: ["products"] as const,
        list: () => [...queryKeys.products.all, "list"] as const,
        detail: (id: string) => [...queryKeys.products.all, id] as const,
        manufacturing: (id: string) => [...queryKeys.products.all, "manufacturing", id] as const,
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
        cost: (id: string) => [...queryKeys.bom.all, "cost", id] as const,
    },
    processStations: {
        all: ["processStations"] as const,
        list: () => [...queryKeys.processStations.all, "list"] as const,
    },
    productionBom: {
        all: ["productionBom"] as const,
        list: () => [...queryKeys.productionBom.all, "list"] as const,
        detail: (id: string) => [...queryKeys.productionBom.all, "detail", id] as const,
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
    pettyCash: {
        all: ["pettyCash"] as const,
        list: () => [...queryKeys.pettyCash.all, "list"] as const,
    },
    financeReports: {
        all: ["financeReports"] as const,
        list: (start?: string, end?: string) => [...queryKeys.financeReports.all, "list", start, end] as const,
        report: (type: string, start: string, end: string) => [...queryKeys.financeReports.all, "report", type, start, end] as const,
        kpi: (start: string, end: string) => [...queryKeys.financeReports.all, "kpi", start, end] as const,
    },
    accountTransactions: {
        all: ["accountTransactions"] as const,
        list: () => [...queryKeys.accountTransactions.all, "list"] as const,
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
    mfgGantt: {
        all: ["mfgGantt"] as const,
        list: () => [...queryKeys.mfgGantt.all, "list"] as const,
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
        bankAccounts: () => [...queryKeys.glAccounts.all, "bankAccounts"] as const,
    },
    executiveDashboard: {
        all: ["executiveDashboard"] as const,
        list: () => [...queryKeys.executiveDashboard.all, "list"] as const,
    },
    inventoryDashboard: {
        all: ["inventoryDashboard"] as const,
        list: () => [...queryKeys.inventoryDashboard.all, "list"] as const,
    },
    inventorySettings: {
        all: ["inventorySettings"] as const,
        list: () => [...queryKeys.inventorySettings.all, "list"] as const,
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
    uomConversions: {
        all: ["uomConversions"] as const,
        list: () => [...queryKeys.uomConversions.all, "list"] as const,
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
    supplierCategories: {
        all: ["supplierCategories"] as const,
        list: () => [...queryKeys.supplierCategories.all, "list"] as const,
    },
    adjustments: {
        all: ["adjustments"] as const,
        list: () => [...queryKeys.adjustments.all, "list"] as const,
    },
    stockMovements: {
        all: ["stockMovements"] as const,
        list: () => [...queryKeys.stockMovements.all, "list"] as const,
    },
    cycleCounts: {
        all: ["cycleCounts"] as const,
        list: () => [...queryKeys.cycleCounts.all, "list"] as const,
    },
    openingStock: {
        all: ["openingStock"] as const,
        list: () => [...queryKeys.openingStock.all, "list"] as const,
    },
    fabricRolls: {
        all: ["fabricRolls"] as const,
        list: () => [...queryKeys.fabricRolls.all, "list"] as const,
    },
    stockTransfers: {
        all: ["stockTransfers"] as const,
        list: () => [...queryKeys.stockTransfers.all, "list"] as const,
    },
    receiving: {
        all: ["receiving"] as const,
        list: () => [...queryKeys.receiving.all, "list"] as const,
    },
    arAging: {
        all: ["finance", "ar-aging"] as const,
    },
    apAging: {
        all: ["finance", "ap-aging"] as const,
    },
    arPayments: {
        all: ["arPayments"] as const,
        list: () => [...queryKeys.arPayments.all, "list"] as const,
    },
    salesOptions: {
        all: ["salesOptions"] as const,
        list: () => [...queryKeys.salesOptions.all, "list"] as const,
    },
    payroll: {
        all: ["payroll"] as const,
        run: (period: string) => [...queryKeys.payroll.all, "run", period] as const,
        compliance: (period: string) => [...queryKeys.payroll.all, "compliance", period] as const,
    },
    documentNumbering: {
        all: ["documentNumbering"] as const,
        list: () => [...queryKeys.documentNumbering.all, "list"] as const,
    },
    permissionMatrix: {
        all: ["permissionMatrix"] as const,
        list: () => [...queryKeys.permissionMatrix.all, "list"] as const,
    },
    sidebarActions: {
        all: ["sidebarActions"] as const,
        list: () => [...queryKeys.sidebarActions.all, "list"] as const,
    },
    manufacturing: {
        all: ["manufacturing"] as const,
        stationWorkload: () => [...queryKeys.manufacturing.all, "stationWorkload"] as const,
    },
    materialDemand: {
        all: ["materialDemand"] as const,
        list: () => [...queryKeys.materialDemand.all, "list"] as const,
    },
    discounts: {
        all: ["discounts"] as const,
        list: () => [...queryKeys.discounts.all, "list"] as const,
    },
    dcNotes: {
        all: ["dcNotes"] as const,
        list: (filters?: any) => ["dcNotes", "list", filters] as const,
        detail: (id: string) => ["dcNotes", "detail", id] as const,
        formData: () => ["dcNotes", "formData"] as const,
    },
    openingBalances: {
        all: ["openingBalances"] as const,
        list: () => [...["openingBalances"], "list"] as const,
    },
    currencies: {
        all: ["currencies"] as const,
        list: () => [...["currencies"], "list"] as const,
    },
    salespersons: {
        all: ["salespersons"] as const,
        list: () => [...["salespersons"], "list"] as const,
        commissionReport: (start?: string, end?: string) => [...["salespersons"], "commissionReport", start, end] as const,
    },
    fiscalPeriods: {
        all: ["fiscalPeriods"] as const,
        list: (year?: number) => [...["fiscalPeriods"], "list", year] as const,
    },
    cashflowPlan: {
        all: ["cashflowPlan"] as const,
        list: (month: number, year: number) => [...["cashflowPlan"], "list", month, year] as const,
    },
    cashflowForecast: {
        all: ["cashflowForecast"] as const,
        list: (months?: number) => [...["cashflowForecast"], "list", months] as const,
    },
    cashflowAccuracy: {
        all: ["cashflowAccuracy"] as const,
        trend: (months?: number) => [...queryKeys.cashflowAccuracy.all, "trend", months] as const,
    },
    cashflowScenarios: {
        all: ["cashflowScenarios"] as const,
        list: (month: number, year: number) => [...["cashflowScenarios"], "list", month, year] as const,
        detail: (id: string) => [...["cashflowScenarios"], "detail", id] as const,
    },
    cashflowActual: {
        all: ["cashflowActual"] as const,
        list: (month: number, year: number) => [...["cashflowActual"], "list", month, year] as const,
    },
    warehouseLocations: {
        all: ["warehouseLocations"] as const,
        list: (warehouseId: string) => ["warehouseLocations", "list", warehouseId] as const,
    },
    expenses: {
        all: ["expenses"] as const,
        list: () => [...queryKeys.expenses.all, "list"] as const,
    },
    ceoFlags: {
        all: ["ceo-flags"] as const,
        list: (filters?: Record<string, string>) => [...queryKeys.ceoFlags.all, "list", filters ?? {}] as const,
        count: () => [...queryKeys.ceoFlags.all, "count"] as const,
    },
    fixedAssets: {
        all: ["fixedAssets"] as const,
        list: (filters?: Record<string, string>) => [...["fixedAssets"], "list", filters ?? {}] as const,
        detail: (id: string) => [...["fixedAssets"], "detail", id] as const,
    },
    fixedAssetCategories: {
        all: ["fixedAssetCategories"] as const,
        list: () => [...["fixedAssetCategories"], "list"] as const,
    },
    depreciationRuns: {
        all: ["depreciationRuns"] as const,
        list: () => [...["depreciationRuns"], "list"] as const,
        detail: (id: string) => [...["depreciationRuns"], "detail", id] as const,
        preview: (start: string, end: string) => [...["depreciationRuns"], "preview", start, end] as const,
    },
    paymentTerms: {
        all: () => ['paymentTerms'] as const,
        list: () => ['paymentTerms', 'list'] as const,
    },
    fixedAssetReports: {
        all: ["fixedAssetReports"] as const,
        register: () => [...["fixedAssetReports"], "register"] as const,
        schedule: (assetId?: string) => [...["fixedAssetReports"], "schedule", assetId] as const,
        movements: (start?: string, end?: string) => [...["fixedAssetReports"], "movements", start, end] as const,
        nbv: () => [...["fixedAssetReports"], "nbv"] as const,
    },
    invoiceAvailableOrders: {
        all: ["invoiceAvailableOrders"] as const,
        list: () => [...queryKeys.invoiceAvailableOrders.all, "list"] as const,
    },
} as const
