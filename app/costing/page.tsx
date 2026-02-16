import { Suspense } from "react"
import { getCostingDashboard, getProductsForCostSheet } from "@/lib/actions/costing"
import { CostingDashboardClient } from "./costing-dashboard-client"
import { DollarSign } from "lucide-react"

export const dynamic = "force-dynamic"

async function DashboardContent() {
    const data = await getCostingDashboard()
    const products = await getProductsForCostSheet()

    return <CostingDashboardClient data={data} products={products} />
}

export default function CostingPage() {
    return (
        <div className="min-h-screen bg-background p-4 md:p-8 pb-24">
            <Suspense
                fallback={
                    <div className="flex items-center gap-2 text-zinc-400 pt-8">
                        <DollarSign className="h-5 w-5 animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest">
                            Memuat data biaya...
                        </span>
                    </div>
                }
            >
                <DashboardContent />
            </Suspense>
        </div>
    )
}
