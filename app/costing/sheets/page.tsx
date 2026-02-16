import { Suspense } from "react"
import { getCostSheets, getProductsForCostSheet } from "@/lib/actions/costing"
import { SheetsClient } from "./sheets-client"
import { DollarSign } from "lucide-react"

export const dynamic = "force-dynamic"

async function SheetsContent() {
    const sheets = await getCostSheets()
    const products = await getProductsForCostSheet()

    return <SheetsClient initialSheets={sheets} products={products} />
}

export default function CostSheetsPage() {
    return (
        <div className="min-h-screen bg-background p-4 md:p-8 pb-24">
            <Suspense
                fallback={
                    <div className="flex items-center gap-2 text-zinc-400 pt-8">
                        <DollarSign className="h-5 w-5 animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest">
                            Memuat cost sheet...
                        </span>
                    </div>
                }
            >
                <SheetsContent />
            </Suspense>
        </div>
    )
}
