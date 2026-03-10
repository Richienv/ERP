"use client"

import { useState } from "react"
import { useCashflowPlan, useAccuracyTrend } from "@/hooks/use-cashflow-plan"
import { useCashflowForecast } from "@/hooks/use-cashflow-forecast"
import { useUpcomingObligations } from "@/hooks/use-upcoming-obligations"
import { CashflowPlanningBoard } from "@/components/finance/cashflow-planning-board"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"

export const dynamic = "force-dynamic"

export default function CashflowPlanningPage() {
    const now = new Date()
    const [month, setMonth] = useState(now.getMonth() + 1)
    const [year, setYear] = useState(now.getFullYear())
    const { data, isLoading } = useCashflowPlan(month, year)
    const { data: accuracyTrend } = useAccuracyTrend(3)
    const { data: forecast } = useCashflowForecast(6)
    const { data: upcoming } = useUpcomingObligations(90)

    if (isLoading || !data) return <TablePageSkeleton accentColor="bg-emerald-400" />

    return (
        <div className="mf-page">
            <CashflowPlanningBoard
                data={data}
                month={month}
                year={year}
                onMonthChange={setMonth}
                onYearChange={setYear}
                accuracyTrend={accuracyTrend}
                forecast={forecast}
                upcoming={upcoming}
            />
        </div>
    )
}
