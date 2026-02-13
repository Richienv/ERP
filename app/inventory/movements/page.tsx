
import {
  ArrowUpRight,
  ArrowDownRight,
  ArrowRightLeft,
  Calendar,
  Filter,
  Activity
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ManualMovementDialog } from "@/components/inventory/manual-movement-dialog";
import { getStockMovements, getProductsForKanban, getWarehouses } from "@/app/actions/inventory";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { InventoryPerformanceProvider } from "@/components/inventory/inventory-performance-provider";

export const dynamic = 'force-dynamic';

/** Race a promise against a timeout — returns fallback on timeout */
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))
  ])
}

export default async function StockMovementsPage() {
  const [movements, products, warehouses] = await Promise.all([
    withTimeout(getStockMovements(100), 8000, []),
    withTimeout(getProductsForKanban(), 8000, []),
    withTimeout(getWarehouses(), 5000, [])
  ]);

  // Calculate Daily Stats
  const today = new Date().toDateString();
  const todaysMoves = movements.filter(m => new Date(m.date).toDateString() === today);

  const inboundCount = todaysMoves.filter(m => ['PO_RECEIVE', 'PRODUCTION_IN', 'RETURN_IN', 'ADJUSTMENT_IN', 'INITIAL'].some(t => m.type.includes(t)) && m.qty > 0).reduce((acc, curr) => acc + curr.qty, 0);
  const outboundCount = todaysMoves.filter(m => ['SO_SHIPMENT', 'PRODUCTION_OUT', 'RETURN_OUT', 'SCRAP', 'ADJUSTMENT_OUT'].some(t => m.type.includes(t)) || m.qty < 0).reduce((acc, curr) => acc + Math.abs(curr.qty), 0);
  const transferCount = todaysMoves.filter(m => m.type === 'TRANSFER').length;

  // Group by Date
  const groupedMovements = movements.reduce((groups, move) => {
    const date = new Date(move.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(move);
    return groups;
  }, {} as Record<string, typeof movements>);

  // Helper for icons/colors
  const getTypeConfig = (type: string, qty: number) => {
    if (type.includes('IN') || (type === 'INITIAL') || (type === 'ADJUSTMENT' && qty > 0)) return { icon: ArrowDownRight, color: 'text-emerald-600', bg: 'bg-emerald-100', border: 'border-emerald-200', label: 'INBOUND' };
    if (type.includes('OUT') || type === 'SCRAP' || (type === 'ADJUSTMENT' && qty < 0)) return { icon: ArrowUpRight, color: 'text-blue-600', bg: 'bg-blue-100', border: 'border-blue-200', label: 'OUTBOUND' };
    if (type === 'TRANSFER') return { icon: ArrowRightLeft, color: 'text-purple-600', bg: 'bg-purple-100', border: 'border-purple-200', label: 'TRANSFER' };
    return { icon: Activity, color: 'text-zinc-600', bg: 'bg-zinc-100', border: 'border-zinc-200', label: 'ACTIVITY' };
  };

  return (
    <InventoryPerformanceProvider currentPath="/inventory/movements">
      <div className="flex-1 space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-black font-serif tracking-tight">Stock Movement</h2>
            <p className="text-muted-foreground mt-1">Real-time history of goods flow and adjustments.</p>
          </div>
          <ManualMovementDialog
            products={products.map(p => ({ id: p.id, name: p.name, code: p.code }))}
            warehouses={warehouses.map(w => ({ id: w.id, name: w.name }))}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Summary Cards */}
          <div className="bg-emerald-50 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 rounded-xl flex items-center justify-between group hover:-translate-y-1 transition-transform">
            <div>
              <p className="text-xs font-bold uppercase text-emerald-800 tracking-wider">Inbound (Today)</p>
              <h3 className="text-3xl font-black text-emerald-900 mt-1">{inboundCount.toLocaleString()} <span className="text-sm font-bold text-emerald-700/60">Units</span></h3>
            </div>
            <div className="h-12 w-12 bg-emerald-200 rounded-full flex items-center justify-center border-2 border-black shadow-sm group-hover:rotate-12 transition-transform">
              <ArrowDownRight className="h-6 w-6 text-emerald-900" />
            </div>
          </div>
          <div className="bg-blue-50 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 rounded-xl flex items-center justify-between group hover:-translate-y-1 transition-transform">
            <div>
              <p className="text-xs font-bold uppercase text-blue-800 tracking-wider">Outbound (Today)</p>
              <h3 className="text-3xl font-black text-blue-900 mt-1">{outboundCount.toLocaleString()} <span className="text-sm font-bold text-blue-700/60">Units</span></h3>
            </div>
            <div className="h-12 w-12 bg-blue-200 rounded-full flex items-center justify-center border-2 border-black shadow-sm group-hover:-rotate-12 transition-transform">
              <ArrowUpRight className="h-6 w-6 text-blue-900" />
            </div>
          </div>
          <div className="bg-purple-50 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 rounded-xl flex items-center justify-between group hover:-translate-y-1 transition-transform">
            <div>
              <p className="text-xs font-bold uppercase text-purple-800 tracking-wider">Transfers (Today)</p>
              <h3 className="text-3xl font-black text-purple-900 mt-1">{transferCount.toLocaleString()} <span className="text-sm font-bold text-purple-700/60">Moves</span></h3>
            </div>
            <div className="h-12 w-12 bg-purple-200 rounded-full flex items-center justify-center border-2 border-black shadow-sm group-hover:scale-110 transition-transform">
              <ArrowRightLeft className="h-6 w-6 text-purple-900" />
            </div>
          </div>
        </div>

        <div className="mt-8">
          <h3 className="text-xl font-black uppercase mb-6 flex items-center gap-2">
            <Activity className="h-5 w-5" /> Activity Log
          </h3>

          <div className="relative border-l-2 border-dashed border-black/20 ml-4 space-y-8">
            {Object.entries(groupedMovements).map(([date, moves]) => (
              <div key={date} className="relative pl-8">
                <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full border-2 border-black bg-white" />
                <h4 className="text-sm font-black uppercase mb-4 text-zinc-500 bg-zinc-100/50 inline-block px-2 py-1 rounded border border-zinc-200">{date}</h4>

                <div className="space-y-3">
                  {moves.map((move) => {
                    const config = getTypeConfig(move.type, move.qty);
                    const Icon = config.icon;

                    return (
                      <div key={move.id} className="relative group">
                        <div className="bg-white border-2 border-black rounded-lg p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all flex items-center justify-between gap-4">

                          <div className="flex items-center gap-4">
                            <div className={cn("h-10 w-10 rounded-md border-2 border-black flex items-center justify-center shrink-0", config.bg)}>
                              <Icon className={cn("h-5 w-5", config.color)} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className={cn("font-black text-[10px] border-black bg-white", config.color)}>
                                  {move.type.replace('_', ' ')}
                                </Badge>
                                <span className="text-xs font-bold text-zinc-400 font-mono">#{move.id.slice(0, 8)}</span>
                              </div>
                              <h4 className="font-bold text-sm">{move.item} <span className="font-normal text-zinc-500">({move.code})</span></h4>

                              <div className="text-xs mt-1 flex items-center gap-2 text-zinc-600">
                                <span className="font-bold">{move.warehouse}</span>
                                {move.type === 'TRANSFER' ? <ArrowRightLeft className="h-3 w-3" /> : (config.label === 'INBOUND' ? <ArrowRightLeft className="h-3 w-3 rotate-180 opacity-0" /> : <ArrowRightLeft className="h-3 w-3 opacity-0" />)}
                                {/* Contextual Info */}
                                {move.type === 'TRANSFER' && <span className="font-bold">{move.entity}</span>}
                                {move.type === 'PO_RECEIVE' && <span>from <span className="font-bold">{move.entity}</span> (PO: {move.reference})</span>}
                                {move.type === 'SO_SHIPMENT' && <span>to <span className="font-bold">{move.entity}</span> (SO: {move.reference})</span>}
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className={cn("text-lg font-black", config.color)}>
                              {move.qty > 0 ? '+' : ''}{move.qty} <span className="text-xs font-bold text-black opacity-60">{move.unit}</span>
                            </div>
                            <div className="text-xs font-bold text-zinc-400 mt-1">
                              {new Date(move.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {move.user}
                            </div>
                          </div>

                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {movements.length === 0 && (
              <div className="pl-8 text-zinc-400 italic font-medium">No movements recorded yet.</div>
            )}
          </div>
        </div>
      </div>
    </InventoryPerformanceProvider>
  );
}