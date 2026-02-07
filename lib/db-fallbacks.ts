// Fallback data structures when database is unreachable
// These provide empty but valid data so the UI doesn't crash

export const FALLBACK_PURCHASE_ORDERS: any[] = []

export const FALLBACK_VENDORS: any[] = []

export const FALLBACK_PRODUCTS: any[] = []

export const FALLBACK_MATERIAL_GAP: any[] = []

export const FALLBACK_INVENTORY_KPIS = {
    totalProducts: 0,
    lowStock: 0,
    totalValue: 0,
    inventoryAccuracy: 0
}

export const FALLBACK_PROCUREMENT_INSIGHTS = {
    activePOs: [],
    restockItems: [],
    summary: {
        totalIncoming: 0,
        totalRestockCost: 0,
        itemsCriticalCount: 0,
        itemsCriticalList: []
    }
}

export const FALLBACK_DASHBOARD_SNAPSHOT = {
    date: new Date(),
    revenue: 0,
    expenses: 0,
    profit: 0,
    cashFlow: 0,
    accountsReceivable: 0,
    accountsPayable: 0,
    inventoryValue: 0,
    pendingInvoices: 0,
    overdueInvoices: 0
}

export const FALLBACK_PROCUREMENT_METRICS = {
    activePO: 0,
    pendingPR: 0,
    totalSpend: 0,
    savingsRate: 0
}

export const FALLBACK_HR_METRICS = {
    totalEmployees: 0,
    activeToday: 0,
    onLeave: 0,
    attendanceRate: 0
}

export const FALLBACK_PRODUCTION_METRICS = {
    activeWO: 0,
    efficiency: 0,
    completedToday: 0,
    defectRate: 0
}

export const FALLBACK_PRODUCTION_STATUS: any[] = []

export const FALLBACK_MATERIAL_STATUS: any[] = []

export const FALLBACK_QUALITY_STATUS = {
    passRate: 0,
    pendingQC: 0,
    recentDefects: []
}

export const FALLBACK_WORKFORCE_STATUS = {
    totalActive: 0,
    byDepartment: [],
    recentActivity: []
}

export const FALLBACK_ACTIVITY_FEED: any[] = []

export const FALLBACK_EXECUTIVE_ALERTS: any[] = []

export const FALLBACK_PENDING_POS: any[] = []

export const FALLBACK_GRNS: any[] = []

export const FALLBACK_WAREHOUSES: any[] = []

export const FALLBACK_EMPLOYEES: any[] = []
