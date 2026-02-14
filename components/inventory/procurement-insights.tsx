
import { getProcurementInsights } from "@/app/actions/inventory"
import Link from "next/link"
import { AlertCircle, Truck, ArrowRight, ShoppingCart } from "lucide-react"

export async function ProcurementInsights() {
    const data = await getProcurementInsights()

    const formatCurrency = (val: number) => {
        if (val === 0) return "Rp 0"
        const abs = Math.abs(val)
        if (abs >= 1_000_000_000) return `Rp ${(val / 1_000_000_000).toFixed(1)}M`
        if (abs >= 1_000_000) return `Rp ${(val / 1_000_000).toFixed(1)}jt`
        if (abs >= 1_000) return `Rp ${(val / 1_000).toFixed(0)}rb`
        return `Rp ${val.toFixed(0)}`
    }

    return (
        <div className="bg-zinc-50 dark:bg-zinc-800/50 overflow-hidden h-full flex items-center">
            <div className="flex items-center justify-between w-full px-4 py-2.5 gap-6">

                {/* Restock Alert */}
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-red-500 border-2 border-black flex items-center justify-center shrink-0">
                        <AlertCircle className="h-4 w-4 text-white" />
                    </div>
                    <div>
                        <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Restock</div>
                        <div className="text-lg font-black text-red-600 tracking-tighter leading-none">
                            {formatCurrency(data.summary.totalRestockCost)}
                        </div>
                        <div className="text-[8px] font-bold text-zinc-400">
                            {data.summary.itemsCriticalCount} item kritis
                        </div>
                    </div>
                </div>

                {/* Incoming POs */}
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-500 border-2 border-black flex items-center justify-center shrink-0">
                        <Truck className="h-4 w-4 text-white" />
                    </div>
                    <div>
                        <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Incoming</div>
                        <div className="text-lg font-black text-zinc-900 dark:text-white tracking-tighter leading-none">
                            {data.summary.totalIncoming} <span className="text-xs text-zinc-400 font-bold">PO</span>
                        </div>
                        <div className="text-[8px] font-bold text-zinc-400">
                            Diproses vendor
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                    <Link href="/procurement">
                        <div className="flex items-center gap-1.5 px-4 py-2 text-[9px] font-black uppercase bg-black text-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)] hover:shadow-none hover:translate-y-[1px] transition-all whitespace-nowrap">
                            <ShoppingCart className="h-3.5 w-3.5" /> Procurement
                            <ArrowRight className="h-3 w-3" />
                        </div>
                    </Link>
                    {data.summary.itemsCriticalCount > 0 && (
                        <Link href="/procurement/requests/create?type=bulk_restock">
                            <div className="flex items-center gap-1.5 px-4 py-2 text-[9px] font-black uppercase bg-red-600 text-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-red-700 hover:shadow-none hover:translate-y-[1px] transition-all whitespace-nowrap">
                                <AlertCircle className="h-3.5 w-3.5" /> Restock Sekarang
                            </div>
                        </Link>
                    )}
                </div>

            </div>
        </div>
    )
}
