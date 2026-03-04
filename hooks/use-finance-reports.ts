"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import {
    getProfitLossStatement,
    getBalanceSheet,
    getCashFlowStatement,
    getTrialBalance,
    getARAgingReport,
    getAPAgingReport,
} from "@/lib/actions/finance"
import type { ProfitLossData, BalanceSheetData, CashFlowData } from "@/lib/actions/finance"
import {
    getStatementOfEquityChanges,
    getInventoryTurnoverReport,
    getTaxReport,
} from "@/lib/actions/finance-reports"
import {
    getBudgetVsActual,
    getBudgets,
} from "@/lib/actions/finance-budget"

const defaultPnL: ProfitLossData = {
    revenue: 0, costOfGoodsSold: 0, grossProfit: 0, operatingExpenses: [],
    totalOperatingExpenses: 0, operatingIncome: 0, otherIncome: 0, otherExpenses: 0,
    netIncomeBeforeTax: 0, taxExpense: 0, netIncome: 0, period: { startDate: '', endDate: '' },
}

const defaultBS: BalanceSheetData = {
    assets: { currentAssets: [], fixedAssets: [], otherAssets: [], totalCurrentAssets: 0, totalFixedAssets: 0, totalOtherAssets: 0, totalAssets: 0 },
    liabilities: { currentLiabilities: [], longTermLiabilities: [], totalCurrentLiabilities: 0, totalLongTermLiabilities: 0, totalLiabilities: 0 },
    equity: { capital: [], retainedEarnings: 0, totalEquity: 0 },
    totalLiabilitiesAndEquity: 0, asOfDate: '',
}

const defaultCF: CashFlowData = {
    operatingActivities: { netIncome: 0, adjustments: [], changesInWorkingCapital: [], netCashFromOperating: 0 },
    investingActivities: { items: [], netCashFromInvesting: 0 },
    financingActivities: { items: [], netCashFromFinancing: 0 },
    netIncreaseInCash: 0, beginningCash: 0, endingCash: 0, period: { startDate: '', endDate: '' },
}

const defaultTB = {
    rows: [] as any[], totals: { totalDebits: 0, totalCredits: 0, difference: 0, isBalanced: true },
    period: { start: new Date(), end: new Date() },
}

const defaultAging = {
    summary: { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0, totalOutstanding: 0, invoiceCount: 0 },
    byCustomer: [] as any[], details: [] as any[],
}

const defaultAPAging = {
    summary: { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0, totalOutstanding: 0, billCount: 0 },
    bySupplier: [] as any[], details: [] as any[],
}

export function useFinanceReports(startDate: Date, endDate: Date) {
    return useQuery({
        queryKey: queryKeys.financeReports.list(startDate.toISOString(), endDate.toISOString()),
        queryFn: async () => {
            const startISO = startDate.toISOString()
            const endISO = endDate.toISOString()

            const results = await Promise.allSettled([
                getProfitLossStatement(startDate, endDate),
                getBalanceSheet(endDate),
                getCashFlowStatement(startDate, endDate),
                getTrialBalance(startDate, endDate),
                getARAgingReport(),
                getAPAgingReport(),
                getStatementOfEquityChanges(startISO, endISO),
                getInventoryTurnoverReport(startISO, endISO),
                getTaxReport(startISO, endISO),
                getBudgets(),
            ])

            const pnl = results[0].status === 'fulfilled' ? results[0].value : defaultPnL
            const bs = results[1].status === 'fulfilled' ? results[1].value : defaultBS
            const cf = results[2].status === 'fulfilled' ? results[2].value : defaultCF
            const tb = results[3].status === 'fulfilled' ? results[3].value : defaultTB
            const arAging = results[4].status === 'fulfilled' ? results[4].value : defaultAging
            const apAging = results[5].status === 'fulfilled' ? results[5].value : defaultAPAging
            const equityResult = results[6].status === 'fulfilled' ? results[6].value : null
            const inventoryResult = results[7].status === 'fulfilled' ? results[7].value : null
            const taxResult = results[8].status === 'fulfilled' ? results[8].value : null
            const budgetsResult = results[9].status === 'fulfilled' ? results[9].value : null

            // Log any failures for debugging
            results.forEach((r, i) => {
                if (r.status === 'rejected') {
                    console.error(`Finance report query ${i} failed:`, r.reason)
                }
            })

            // If there are budgets, fetch the first active one's budget vs actual
            let budgetVsActual = null
            const budgets = budgetsResult?.budgets ?? []
            if (budgets.length > 0) {
                try {
                    budgetVsActual = await getBudgetVsActual(budgets[0].id, startISO, endISO)
                } catch (e) {
                    console.error("Budget vs actual failed:", e)
                }
            }

            return {
                pnl,
                bs,
                cf,
                tb,
                arAging,
                apAging,
                equity: equityResult?.success ? equityResult.data : null,
                inventoryTurnover: inventoryResult?.success ? inventoryResult.data : null,
                tax: taxResult?.success ? taxResult.data : null,
                budgets,
                budgetVsActual: budgetVsActual?.success ? budgetVsActual.data : null,
            }
        },
        retry: 1,
    })
}
