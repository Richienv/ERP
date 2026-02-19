"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getPayrollRun, getPayrollComplianceReport } from "@/app/actions/hcm"

export interface PayrollLine {
    employeeId: string
    employeeCode: string
    employeeName: string
    department: string
    position: string
    attendanceDays: number
    leaveDays: number
    lateCount: number
    overtimeHours: number
    basicSalary: number
    transportAllowance: number
    mealAllowance: number
    positionAllowance: number
    overtimePay: number
    bpjsKesehatan: number
    bpjsKetenagakerjaan: number
    pph21: number
    grossSalary: number
    totalDeductions: number
    netSalary: number
}

export interface PayrollRunData {
    period: string
    periodLabel: string
    status: "PENDING_APPROVAL" | "POSTED"
    generatedAt: string
    generatedBy: string
    postedAt: string | null
    postedBy: string | null
    postedJournalReference: string | null
    disbursementStatus?: "PENDING" | "PAID" | null
    disbursedAt?: string | null
    disbursementReference?: string | null
    disbursementMethod?: string | null
    approverName: string
    summary: {
        gross: number
        deductions: number
        net: number
        employees: number
        overtimeHours: number
    }
    lines: PayrollLine[]
}

export interface PayrollComplianceReport {
    period: string
    periodLabel: string
    employeeCount: number
    totals: {
        bpjsKesehatan: number
        bpjsKetenagakerjaan: number
        bpjsTotal: number
        pph21: number
    }
    rows?: Array<{
        employeeCode: string
        employeeName: string
        department: string
        bpjsKesehatan: number
        bpjsKetenagakerjaan: number
        pph21: number
        netSalary: number
    }>
}

async function fetchPayrollRun(period: string): Promise<PayrollRunData | null> {
    const result = await getPayrollRun(period)
    if (!result.success) return null
    if ("exists" in result && !result.exists) return null
    if ("run" in result) return result.run as PayrollRunData
    return null
}

async function fetchPayrollCompliance(period: string): Promise<PayrollComplianceReport | null> {
    const result = await getPayrollComplianceReport(period)
    if (!result.success || !("report" in result) || !result.report) return null
    return result.report as PayrollComplianceReport
}

export function usePayrollRun(period: string) {
    return useQuery({
        queryKey: queryKeys.payroll.run(period),
        queryFn: () => fetchPayrollRun(period),
        enabled: !!period,
    })
}

export function usePayrollCompliance(period: string) {
    return useQuery({
        queryKey: queryKeys.payroll.compliance(period),
        queryFn: () => fetchPayrollCompliance(period),
        enabled: !!period,
    })
}
