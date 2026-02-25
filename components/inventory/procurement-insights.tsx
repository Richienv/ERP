import Link from "next/link"
import { AlertCircle, Truck, ArrowRight, ShoppingCart } from "lucide-react"

interface ProcurementInsightsProps {
    data: {
        summary: {
            totalRestockCost: number
            itemsCriticalCount: number
            totalIncoming: number
            totalPending?: number
            pendingApproval?: number
        }
    }
}

export function ProcurementInsights({ data }: ProcurementInsightsProps) {

    const formatCurrency = (val: number) => {
        if (val === 0) return "Rp 0"
        const abs = Math.abs(val)
        if (abs >= 1_000_000_000) return `Rp ${(val / 1_000_000_000).toFixed(1)}M`
        if (abs >= 1_000_000) return `Rp ${(val / 1_000_000).toFixed(1)}jt`
        if (abs >= 1_000) return `Rp ${(val / 1_000).toFixed(0)}rb`
        return `Rp ${val.toFixed(0)}`
    }

    return (
        <div className="bg-zinc-50 dark:bg-zinc-800/50 h-full flex items-center">
            <div className="flex flex-wrap items-center w-full px-3 py-2 gap-3 lg:gap-5">

                {/* Restock Alert */}
                <div className="flex items-center gap-2 shrink-0">
                    <div className="w-7 h-7 bg-red-500 border-2 border-black flex items-center justify-center shrink-0">
                        <AlertCircle className="h-3.5 w-3.5 text-white" />
                    </div>
                    <div>
                        <div className="text-[8px] font-black uppercase tracking-widest text-zinc-400">Restock</div>
                        <div className="text-base font-black text-red-600 tracking-tighter leading-none">
                            {formatCurrency(data.summary.totalRestockCost)}
                        </div>
                        <div className="text-[7px] font-bold text-zinc-400">
                            {data.summary.itemsCriticalCount} item kritis
                        </div>
                    </div>
                </div>

                {/* Incoming POs */}
                <div className="flex items-center gap-2 shrink-0">
                    <div className="w-7 h-7 bg-cyan-500 border-2 border-black flex items-center justify-center shrink-0">
                        <Truck className="h-3.5 w-3.5 text-white" />
                    </div>
                    <div>
                        <div className="text-[8px] font-black uppercase tracking-widest text-zinc-400">Incoming</div>
                        <div className="text-base font-black text-zinc-900 dark:text-white tracking-tighter leading-none">
                            {data.summary.totalIncoming} <span className="text-[10px] text-zinc-400 font-bold">PO</span>
                        </div>
                        <div className="text-[7px] font-bold text-zinc-400">
                            Diproses vendor
                        </div>
                    </div>
                </div>

                {/* Planning (Pending PRs) */}
                {(data.summary.totalPending ?? 0) > 0 && (
                    <div className="flex items-center gap-2 shrink-0">
                        <div className="w-7 h-7 bg-violet-500 border-2 border-black flex items-center justify-center shrink-0">
                            <ShoppingCart className="h-3.5 w-3.5 text-white" />
                        </div>
                        <div>
                            <div className="text-[8px] font-black uppercase tracking-widest text-zinc-400">Planning</div>
                            <div className="text-base font-black text-violet-600 tracking-tighter leading-none">
                                {data.summary.totalPending} <span className="text-[10px] text-zinc-400 font-bold">PR</span>
                            </div>
                            <div className="text-[7px] font-bold text-zinc-400">
                                Menunggu proses
                            </div>
                        </div>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center gap-1.5 ml-auto shrink-0">
                    <Link href="/procurement">
                        <div className="flex items-center gap-1 px-2.5 py-1.5 text-[8px] font-black uppercase bg-black text-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)] hover:shadow-none hover:translate-y-[1px] transition-all whitespace-nowrap">
                            <ShoppingCart className="h-3 w-3" /> Procurement
                            <ArrowRight className="h-2.5 w-2.5" />
                        </div>
                    </Link>
                    {data.summary.itemsCriticalCount > 0 && (
                        <Link href="/procurement/requests/create?type=bulk_restock">
                            <div className="flex items-center gap-1 px-2.5 py-1.5 text-[8px] font-black uppercase bg-red-600 text-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-red-700 hover:shadow-none hover:translate-y-[1px] transition-all whitespace-nowrap">
                                <AlertCircle className="h-3 w-3" /> Restock
                            </div>
                        </Link>
                    )}
                </div>

            </div>
        </div>
    )
}
