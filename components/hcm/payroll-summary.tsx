import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Wallet } from "lucide-react"

interface PayrollSummaryData {
    gross: number
    deductions: number
    net: number
    status: string
    period: string
}

interface PayrollSummaryWidgetProps {
    data?: PayrollSummaryData
}

export function PayrollSummaryWidget({ data }: PayrollSummaryWidgetProps) {
    const summary: PayrollSummaryData = data || {
        gross: 0,
        deductions: 0,
        net: 0,
        status: "DRAFT",
        period: new Date().toLocaleDateString("id-ID", { month: "long", year: "numeric" }),
    }

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            maximumFractionDigits: 0,
        }).format(value)

    return (
        <Card className="col-span-1 border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] md:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between border-b border-black bg-zinc-50">
                <CardTitle className="flex items-center gap-2 text-base font-black uppercase tracking-wide">
                    <Wallet className="h-4 w-4 text-indigo-600" />
                    Payroll {summary.period}
                </CardTitle>
                <Badge variant="outline" className="border-black bg-white text-[10px] font-bold">
                    {summary.status}
                </Badge>
            </CardHeader>
            <CardContent className="grid gap-3 p-4 sm:grid-cols-3">
                <div className="rounded-md border bg-zinc-50 p-3">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Gaji Kotor</p>
                    <p className="text-base font-bold">{formatCurrency(summary.gross)}</p>
                </div>
                <div className="rounded-md border bg-zinc-50 p-3">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Potongan</p>
                    <p className="text-base font-bold">{formatCurrency(summary.deductions)}</p>
                </div>
                <div className="rounded-md border bg-indigo-50 p-3">
                    <p className="text-xs font-semibold uppercase text-indigo-600">Estimasi Netto</p>
                    <p className="text-base font-bold text-indigo-700">{formatCurrency(summary.net)}</p>
                </div>
            </CardContent>
        </Card>
    )
}
