"use client"

import { usePlanningContext } from "../layout"
import { useCashflowActual } from "@/hooks/use-cashflow-actual"
import { useCashflowForecast } from "@/hooks/use-cashflow-forecast"
import { CashflowAktualBoard } from "@/components/finance/cashflow-aktual-board"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"

export default function AktualPage() {
    const { month, year } = usePlanningContext()
    const { data, isLoading } = useCashflowActual(month, year)
    const { data: forecast } = useCashflowForecast(6)

    if (isLoading || !data) return <TablePageSkeleton accentColor="bg-emerald-400" />

    return (
        <div className="mt-4">
            <CashflowAktualBoard
                data={data}
                month={month}
                year={year}
                forecast={forecast}
            />
        </div>
    )
}
