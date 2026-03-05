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
    getRevenueFromInvoices,
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

type ReportType = "pnl" | "bs" | "cf" | "tb" | "equity_changes" | "ar_aging" | "ap_aging" | "inventory_turnover" | "tax_report" | "budget_vs_actual"

// ── KPI strip: only fetches 4 lightweight queries (PnL + AR/AP aging) ──
export function useFinanceKPI(startDate: Date, endDate: Date) {
    return useQuery({
        queryKey: queryKeys.financeReports.kpi(startDate.toISOString(), endDate.toISOString()),
        queryFn: async () => {
            const [pnlResult, arResult, apResult, revenueResult] = await Promise.allSettled([
                getProfitLossStatement(startDate, endDate),
                getARAgingReport(),
                getAPAgingReport(),
                getRevenueFromInvoices(startDate, endDate),
            ])

            const pnl = pnlResult.status === 'fulfilled' ? pnlResult.value : null
            const ar = arResult.status === 'fulfilled' ? arResult.value : null
            const ap = apResult.status === 'fulfilled' ? apResult.value : null
            const invoiceRevenue = revenueResult.status === 'fulfilled' ? revenueResult.value : null

            // Pendapatan (Omzet) = total invoices issued in period (from actual invoices)
            // After GL fix (Task 1), P&L revenue = invoice revenue, no Math.max hack needed
            const arOutstanding = ar?.summary?.totalOutstanding ?? 0
            const revenue = invoiceRevenue?.totalRevenue ?? pnl?.revenue ?? 0

            return {
                revenue,
                netIncome: pnl?.netIncome ?? 0,
                arOutstanding,
                apOutstanding: ap?.summary?.totalOutstanding ?? 0,
            }
        },
        staleTime: 2 * 60 * 1000,
    })
}

// ── Per-report query: only fetches data for the active tab ──
export function useFinanceReport(reportType: ReportType, startDate: Date, endDate: Date) {
    const startISO = startDate.toISOString()
    const endISO = endDate.toISOString()

    return useQuery({
        queryKey: queryKeys.financeReports.report(reportType, startISO, endISO),
        queryFn: async () => {
            switch (reportType) {
                case "pnl":
                    return { type: "pnl" as const, data: await getProfitLossStatement(startDate, endDate) }
                case "bs":
                    return { type: "bs" as const, data: await getBalanceSheet(endDate) }
                case "cf":
                    return { type: "cf" as const, data: await getCashFlowStatement(startDate, endDate) }
                case "tb":
                    return { type: "tb" as const, data: await getTrialBalance(startDate, endDate) }
                case "ar_aging":
                    return { type: "ar_aging" as const, data: await getARAgingReport() }
                case "ap_aging":
                    return { type: "ap_aging" as const, data: await getAPAgingReport() }
                case "equity_changes": {
                    const result = await getStatementOfEquityChanges(startISO, endISO)
                    return { type: "equity_changes" as const, data: result?.success ? result.data : null }
                }
                case "inventory_turnover": {
                    const result = await getInventoryTurnoverReport(startISO, endISO)
                    return { type: "inventory_turnover" as const, data: result?.success ? result.data : null }
                }
                case "tax_report": {
                    const result = await getTaxReport(startISO, endISO)
                    return { type: "tax_report" as const, data: result?.success ? result.data : null }
                }
                case "budget_vs_actual": {
                    const budgetsResult = await getBudgets()
                    const budgets = budgetsResult?.budgets ?? []
                    let budgetVsActual = null
                    if (budgets.length > 0) {
                        try {
                            const bva = await getBudgetVsActual(budgets[0].id, startISO, endISO)
                            budgetVsActual = bva?.success ? bva.data : null
                        } catch (e) {
                            console.error("Budget vs actual failed:", e)
                        }
                    }
                    return { type: "budget_vs_actual" as const, data: budgetVsActual, budgets }
                }
                default:
                    return { type: reportType, data: null }
            }
        },
        staleTime: 2 * 60 * 1000,
        retry: 1,
    })
}

// ── Legacy hook kept for backward compat (not used by reports page anymore) ──
export function useFinanceReports(startDate: Date, endDate: Date) {
    return useFinanceReport("pnl", startDate, endDate)
}
