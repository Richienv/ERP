
import { AdjustmentForm } from "@/components/inventory/adjustment-form"
import { getStockMovements, getProductsForKanban, getWarehouses } from "@/app/actions/inventory"
import { Badge } from "@/components/ui/badge"
import { ArrowRightLeft, CheckCircle2, RotateCcw } from "lucide-react"

export const dynamic = 'force-dynamic';

export default async function StockAdjustmentsPage() {
  const [products, warehouses, movements] = await Promise.all([
    getProductsForKanban(),
    getWarehouses(),
    getStockMovements(50)
  ])

  // Filter for display if desired, or show all relevant Manual types
  const filteredMovements = movements.filter(m =>
    ['ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'TRANSFER', 'SCRAP'].some(t => m.type.includes(t))
  )

  return (
    <div className="flex-1 space-y-8 p-4 md:p-8 pt-6 font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-black font-serif tracking-tight">Stock Adjustment</h2>
          <p className="text-muted-foreground mt-2 font-medium">Manage stock changes and transfers between warehouses</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Form */}
        <div className="border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-3xl p-8 bg-white h-fit">
          <h3 className="text-2xl font-black mb-1">Create New Adjustment</h3>
          <p className="text-muted-foreground mb-6 font-medium">Add, reduce, or transfer product stock</p>
          <AdjustmentForm products={products} warehouses={warehouses} />
        </div>

        {/* Right: History */}
        <div className="border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-3xl p-8 bg-zinc-50/50 h-fit min-h-[500px]">
          <h3 className="text-2xl font-black mb-1">Latest Adjustments</h3>
          <p className="text-muted-foreground mb-6 font-medium">Recent stock adjustment history</p>

          <div className="space-y-4">
            {filteredMovements.length === 0 && <p className="text-zinc-400 font-bold italic py-10 text-center">No recent adjustments found.</p>}

            {filteredMovements.slice(0, 10).map(move => (
              <div key={move.id} className="bg-white border-2 border-black rounded-xl p-5 shadow-sm hover:translate-x-1 transition-transform group relative overflow-hidden">
                {/* Decorative side bar */}
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${move.qty > 0 ? 'bg-emerald-500' : 'bg-red-500'} ${move.type === 'TRANSFER' && 'bg-blue-500'}`}></div>

                <div className="flex justify-between items-start mb-2 pl-3">
                  <h4 className="font-bold text-lg leading-tight group-hover:underline decoration-2 underline-offset-2">{move.item} <span className="text-zinc-400 text-sm font-normal">({move.code})</span></h4>
                  <Badge className="bg-black text-white hover:bg-zinc-800 border border-transparent flex items-center gap-1 pl-2 pr-3 py-1 text-[10px] uppercase tracking-wider font-bold rounded-full">
                    <CheckCircle2 className="h-3 w-3" /> Done
                  </Badge>
                </div>

                <div className="flex items-center justify-between mt-4 pl-3">
                  <div className="text-sm font-bold text-muted-foreground flex flex-col gap-1">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-zinc-300"></span>
                      {move.warehouse}
                      {move.type === 'TRANSFER' && <ArrowRightLeft className="h-3 w-3" />}
                      {move.type === 'TRANSFER' && <span className="text-black">{move.entity}</span>}
                    </span>
                    <span className="text-xs font-mono opacity-70 flex items-center gap-2">
                      {new Date(move.date).toLocaleDateString()} • {new Date(move.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className={`text-2xl font-black ${move.qty > 0 ? 'text-emerald-700' : 'text-red-700'} ${move.type === 'TRANSFER' && 'text-blue-700'}`}>
                    {move.qty > 0 ? '+' : ''}{move.qty}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}