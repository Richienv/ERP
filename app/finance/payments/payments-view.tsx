"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { formatIDR } from "@/lib/utils"
import {
    Plus,
    Wallet,
    Building,
    Link,
    TrendingUp,
    ArrowDownLeft,
    RefreshCw
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    CardFooter
} from "@/components/ui/card"
import { matchPaymentToInvoice } from "@/lib/actions/finance"
import { toast } from "sonner"

interface UnallocatedPayment {
    id: string
    number: string
    from: string
    amount: number
    date: Date
    method: string
}

interface OpenInvoice {
    id: string
    number: string
    customer: { id: string; name: string } | null
    balanceDue: number
    dueDate: Date
    isOverdue: boolean
}

interface ARPaymentsViewProps {
    unallocated: UnallocatedPayment[]
    openInvoices: OpenInvoice[]
    stats: {
        unallocatedCount: number
        unallocatedAmount: number
        openInvoicesCount: number
        todayPayments: number
    }
}

export function ARPaymentsView({ unallocated, openInvoices, stats }: ARPaymentsViewProps) {
    const router = useRouter()
    const [processing, setProcessing] = useState<string | null>(null)

    const handleMatch = async (paymentId: string, invoiceId: string) => {
        setProcessing(paymentId)
        try {
            const result = await matchPaymentToInvoice(paymentId, invoiceId)
            if (result.success) {
                toast.success(result.message || "Payment matched successfully")
                router.refresh()
            } else {
                toast.error(result.error || "Failed to match payment")
            }
        } catch (error) {
            toast.error("An error occurred")
        } finally {
            setProcessing(null)
        }
    }

    return (
        <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 font-sans h-[calc(100vh-theme(spacing.16))] flex flex-col">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
                <div>
                    <h2 className="text-3xl font-black font-serif tracking-tight text-black flex items-center gap-2">
                        AR Payment Matching (Penerimaan AR)
                    </h2>
                    <p className="text-muted-foreground mt-1 font-medium">
                        Match customer payments to invoices in real-time
                    </p>
                </div>
                <Button className="bg-emerald-600 text-white hover:bg-emerald-700">
                    <Plus className="mr-2 h-4 w-4" /> Record New Payment
                </Button>
            </div>

            {/* Live Stats Ticker */}
            <div className="bg-black text-emerald-400 p-2 overflow-hidden flex items-center gap-8 font-mono text-sm font-bold border-y-2 border-emerald-500/50">
                <span className="flex items-center gap-2">
                    <ArrowDownLeft className="h-4 w-4" />
                    UNALLOCATED: {formatIDR(stats.unallocatedAmount)}
                </span>
                <span className="text-zinc-500">///</span>
                <span className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    TODAY: {formatIDR(stats.todayPayments)}
                </span>
                <span className="text-zinc-500">///</span>
                <span className="flex items-center gap-2 text-white">
                    PENDING: {stats.openInvoicesCount} invoices
                </span>
            </div>

            {/* The Matcher Arena */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 min-h-0">

                {/* Left: Unallocated Money Pool */}
                <Card className="border-2 border-black bg-zinc-100/50 flex flex-col overflow-hidden shadow-[8px_8px_0px_0px_rgba(0,0,0,0.2)]">
                    <CardHeader className="bg-emerald-100 border-b-2 border-black pb-4">
                        <CardTitle className="font-black uppercase flex items-center gap-2 text-emerald-900">
                            <Wallet className="h-6 w-6" /> Unallocated Payments
                        </CardTitle>
                        <CardDescription className="text-emerald-800 font-bold">
                            {stats.unallocatedCount} payments waiting to be matched
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                        {unallocated.length === 0 ? (
                            <div className="h-40 border-2 border-dashed border-zinc-300 rounded-xl flex items-center justify-center text-zinc-400 font-bold uppercase">
                                All payments allocated ✓
                            </div>
                        ) : (
                            unallocated.map((pay) => (
                                <div
                                    key={pay.id}
                                    className={`group bg-white border-2 border-black p-4 rounded-xl shadow-sm hover:translate-x-2 transition-all ${processing === pay.id ? 'opacity-50' : ''
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <Badge variant="outline" className="font-black border-black bg-emerald-50 text-emerald-700">
                                            {pay.number}
                                        </Badge>
                                        <span className="text-xs font-bold text-muted-foreground uppercase">
                                            {new Date(pay.date).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-end">
                                        <div>
                                            <h4 className="font-black text-lg">{pay.from}</h4>
                                            <p className="text-xs font-medium text-muted-foreground">{pay.method}</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="block text-2xl font-black text-emerald-600">
                                                {formatIDR(pay.amount)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>

                {/* Right: Open Invoices Target */}
                <Card className="border-2 border-black bg-white flex flex-col overflow-hidden shadow-[8px_8px_0px_0px_rgba(0,0,0,0.2)]">
                    <CardHeader className="bg-zinc-100 border-b-2 border-black pb-4 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-zinc-200 rounded-bl-[100px] border-l-2 border-b-2 border-black opacity-50" />

                        <CardTitle className="font-black uppercase flex items-center gap-2">
                            <Building className="h-6 w-6" /> Open Invoices
                        </CardTitle>
                        <CardDescription className="font-bold text-muted-foreground">
                            {stats.openInvoicesCount} invoices waiting for payment
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                        {openInvoices.length === 0 ? (
                            <div className="h-40 border-2 border-dashed border-zinc-300 rounded-xl flex items-center justify-center text-zinc-400 font-bold uppercase">
                                No open invoices
                            </div>
                        ) : (
                            openInvoices.map((inv) => (
                                <div
                                    key={inv.id}
                                    className="bg-zinc-50 border border-black/20 p-4 rounded-xl flex items-center justify-between hover:bg-zinc-100 transition-colors"
                                >
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-mono font-bold text-xs">{inv.number}</span>
                                            <Badge
                                                variant="outline"
                                                className={`text-[10px] border-black/20 h-5 ${inv.isOverdue ? 'bg-red-100 text-red-700' : ''
                                                    }`}
                                            >
                                                {inv.isOverdue ? 'OVERDUE' : 'DUE'}
                                            </Badge>
                                        </div>
                                        <h4 className="font-bold text-sm">{inv.customer?.name || 'Unknown'}</h4>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="font-black text-lg text-black/70">
                                            {formatIDR(inv.balanceDue)}
                                        </span>
                                        {unallocated.length > 0 && (
                                            <Button
                                                size="sm"
                                                className="rounded-full bg-black text-white hover:bg-emerald-600 hover:scale-110 transition-all"
                                                onClick={() => handleMatch(unallocated[0].id, inv.id)}
                                                disabled={!!processing}
                                            >
                                                <Link className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </CardContent>
                    <CardFooter className="bg-zinc-50 border-t-2 border-black p-4">
                        <Button
                            className="w-full bg-emerald-600 text-white hover:bg-emerald-700 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase font-black py-6 text-lg tracking-widest active:translate-y-1 active:shadow-none transition-all"
                            onClick={() => router.refresh()}
                        >
                            <RefreshCw className="mr-2 h-5 w-5" /> Refresh Data
                        </Button>
                    </CardFooter>
                </Card>

            </div>

        </div>
    )
}
