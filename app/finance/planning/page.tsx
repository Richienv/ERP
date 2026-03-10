"use client"

import { useState } from "react"
import { useCashflowPlan } from "@/hooks/use-cashflow-plan"
import { CashflowPlanningBoard } from "@/components/finance/cashflow-planning-board"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"

export const dynamic = "force-dynamic"

export default function CashflowPlanningPage() {
    const now = new Date()
    const [month, setMonth] = useState(now.getMonth() + 1)
    const [year, setYear] = useState(now.getFullYear())
    const { data, isLoading } = useCashflowPlan(month, year)

    if (isLoading || !data) return <TablePageSkeleton accentColor="bg-emerald-400" />

    return (
        <div className="mf-page">
            <CashflowPlanningBoard
                data={data}
                month={month}
                year={year}
                onMonthChange={setMonth}
                onYearChange={setYear}
            />
        </div>
    )
}
