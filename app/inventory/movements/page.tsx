
import {
  ArrowUpRight,
  ArrowDownRight,
  ArrowRightLeft,
  Activity,
  Filter,
  Calendar,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ManualMovementDialog } from "@/components/inventory/manual-movement-dialog";
import { getStockMovements, getProductsForKanban, getWarehouses } from "@/app/actions/inventory";
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

  // Calculate Daily Stats in business timezone (Indonesia)
  const BUSINESS_TZ = 'Asia/Jakarta';
  const inboundTypes = new Set(['PO_RECEIVE', 'PRODUCTION_IN', 'RETURN_IN', 'INITIAL', 'ADJUSTMENT_IN']);
  const outboundTypes = new Set(['SO_SHIPMENT', 'PRODUCTION_OUT', 'RETURN_OUT', 'SCRAP', 'ADJUSTMENT_OUT']);

  const dateKey = (value: Date | string) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TZ }).format(new Date(value));

  const todayKey = dateKey(new Date());
  const todaysMoves = movements.filter((m) => dateKey(m.date) === todayKey);

  const classifyMovement = (type: string, qtyRaw: number) => {
    if (type === 'TRANSFER') return { direction: 'TRANSFER' as const, units: 0 };
    if (qtyRaw > 0 || (type === 'ADJUSTMENT' && qtyRaw >= 0) || inboundTypes.has(type)) {
      return { direction: 'INBOUND' as const, units: Math.abs(qtyRaw) };
    }
    if (qtyRaw < 0 || (type === 'ADJUSTMENT' && qtyRaw < 0) || outboundTypes.has(type)) {
      return { direction: 'OUTBOUND' as const, units: Math.abs(qtyRaw) };
    }
    return { direction: 'OTHER' as const, units: 0 };
  };

  const inboundCount = todaysMoves.reduce((acc, move) => {
    const { direction, units } = classifyMovement(move.type, Number(move.qty || 0));
    return direction === 'INBOUND' ? acc + units : acc;
  }, 0);

  const outboundCount = todaysMoves.reduce((acc, move) => {
    const { direction, units } = classifyMovement(move.type, Number(move.qty || 0));
    return direction === 'OUTBOUND' ? acc + units : acc;
  }, 0);

  const transferCount = todaysMoves.filter((m) => m.type === 'TRANSFER').length;

  // Group by Date
  const groupedMovements = movements.reduce((groups, move) => {
    const date = new Date(move.date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(move);
    return groups;
  }, {} as Record<string, typeof movements>);

  // Helper for icons/colors
  const getTypeConfig = (type: string, qty: number) => {
    if (inboundTypes.has(type) || (type === 'ADJUSTMENT' && qty > 0)) return { icon: ArrowDownRight, color: 'text-emerald-600', bg: 'bg-emerald-500', bgLight: 'bg-emerald-50', border: 'border-emerald-200', label: 'INBOUND' };
    if (outboundTypes.has(type) || (type === 'ADJUSTMENT' && qty < 0)) return { icon: ArrowUpRight, color: 'text-blue-600', bg: 'bg-blue-500', bgLight: 'bg-blue-50', border: 'border-blue-200', label: 'OUTBOUND' };
    if (type === 'TRANSFER') return { icon: ArrowRightLeft, color: 'text-violet-600', bg: 'bg-violet-500', bgLight: 'bg-violet-50', border: 'border-violet-200', label: 'TRANSFER' };
    return { icon: Activity, color: 'text-zinc-600', bg: 'bg-zinc-500', bgLight: 'bg-zinc-50', border: 'border-zinc-200', label: 'ACTIVITY' };
  };

  return (
    <InventoryPerformanceProvider currentPath="/inventory/movements">
      <div className="p-4 md:p-8 pt-6 max-w-[1600px] mx-auto space-y-4">

        {/* ═══════════════════════════════════════════ */}
        {/* COMMAND HEADER                              */}
        {/* ═══════════════════════════════════════════ */}
        <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900">
          <div className="px-6 py-4 flex items-center justify-between border-l-[6px] border-l-violet-400">
            <div className="flex items-center gap-3">
              <ArrowRightLeft className="h-5 w-5 text-violet-500" />
              <div>
                <h1 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                  Stock Movement
                </h1>
                <p className="text-zinc-400 text-xs font-medium mt-0.5">
                  Real-time history of goods flow and adjustments
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ManualMovementDialog
                products={products.map(p => ({ id: p.id, name: p.name, code: p.code }))}
                warehouses={warehouses.map(w => ({ id: w.id, name: w.name }))}
              />
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════ */}
        {/* KPI PULSE STRIP                            */}
        {/* ═══════════════════════════════════════════ */}
        <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
          <div className="grid grid-cols-2 md:grid-cols-4">
            {/* Inbound Today */}
            <div className="relative p-4 md:p-5 md:border-r-2 border-b-2 md:border-b-0 border-zinc-100 dark:border-zinc-800">
              <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-400" />
              <div className="flex items-center gap-2 mb-2">
                <ArrowDownRight className="h-4 w-4 text-zinc-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Inbound Hari Ini</span>
              </div>
              <div className="text-2xl md:text-3xl font-black tracking-tighter text-emerald-600">
                {inboundCount.toLocaleString()}
              </div>
              <div className="flex items-center gap-1 mt-1.5">
                <span className="text-[10px] font-bold text-emerald-600">Unit masuk</span>
              </div>
            </div>

            {/* Outbound Today */}
            <div className="relative p-4 md:p-5 md:border-r-2 border-b-2 md:border-b-0 border-zinc-100 dark:border-zinc-800">
              <div className="absolute top-0 left-0 right-0 h-1 bg-blue-400" />
              <div className="flex items-center gap-2 mb-2">
                <ArrowUpRight className="h-4 w-4 text-zinc-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Outbound Hari Ini</span>
              </div>
              <div className="text-2xl md:text-3xl font-black tracking-tighter text-blue-600">
                {outboundCount.toLocaleString()}
              </div>
              <div className="flex items-center gap-1 mt-1.5">
                <span className="text-[10px] font-bold text-blue-600">Unit keluar</span>
              </div>
            </div>

            {/* Transfers Today */}
            <div className="relative p-4 md:p-5 md:border-r-2 border-b-2 md:border-b-0 border-zinc-100 dark:border-zinc-800">
              <div className="absolute top-0 left-0 right-0 h-1 bg-violet-400" />
              <div className="flex items-center gap-2 mb-2">
                <ArrowRightLeft className="h-4 w-4 text-zinc-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Transfer Hari Ini</span>
              </div>
              <div className="text-2xl md:text-3xl font-black tracking-tighter text-violet-600">
                {transferCount.toLocaleString()}
              </div>
              <div className="flex items-center gap-1 mt-1.5">
                <span className="text-[10px] font-bold text-violet-600">Perpindahan</span>
              </div>
            </div>

            {/* Total Movements */}
            <div className="relative p-4 md:p-5">
              <div className="absolute top-0 left-0 right-0 h-1 bg-zinc-400" />
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-4 w-4 text-zinc-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total Pergerakan</span>
              </div>
              <div className="text-2xl md:text-3xl font-black tracking-tighter text-zinc-900 dark:text-white">
                {movements.length.toLocaleString()}
              </div>
              <div className="flex items-center gap-1 mt-1.5">
                <span className="text-[10px] font-bold text-zinc-400">Seluruh histori</span>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════ */}
        {/* ACTIVITY TABLE                              */}
        {/* ═══════════════════════════════════════════ */}
        <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900">
          {/* Table Header */}
          <div className="px-6 py-3 border-b-2 border-black bg-zinc-50 dark:bg-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-zinc-500" />
              <span className="text-sm font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-200">Activity Log</span>
            </div>
            <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-zinc-400">
              <Calendar className="h-3 w-3" />
              {movements.length} entries
            </div>
          </div>

          {/* Table Content */}
          <div className="divide-y-2 divide-black">
            {Object.entries(groupedMovements).map(([date, moves]) => (
              <div key={date}>
                {/* Date Header */}
                <div className="px-6 py-2 bg-zinc-100 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{date}</span>
                </div>

                {/* Movement Rows */}
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {moves.map((move) => {
                    const config = getTypeConfig(move.type, move.qty);
                    const Icon = config.icon;

                    return (
                      <div
                        key={move.id}
                        className="px-6 py-3 flex items-center justify-between gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors group"
                      >
                        {/* Left: Icon + Info */}
                        <div className="flex items-center gap-4 min-w-0 flex-1">
                          {/* Type Icon */}
                          <div className={cn(
                            "h-9 w-9 border-2 border-black flex items-center justify-center shrink-0 text-white",
                            config.bg
                          )}>
                            <Icon className="h-4 w-4" />
                          </div>

                          {/* Details */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-sm font-black text-zinc-900 dark:text-white truncate">
                                {move.item}
                              </span>
                              <span className="text-[10px] font-mono font-bold text-zinc-400 shrink-0">
                                {move.code}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge
                                className={cn(
                                  "text-[8px] font-black uppercase px-1.5 py-0 h-4 border-2 border-black text-white",
                                  config.bg
                                )}
                              >
                                {move.type.replace('_', ' ')}
                              </Badge>
                              <span className="text-[10px] font-bold text-zinc-400">
                                {move.warehouse}
                              </span>
                              {move.type === 'PO_RECEIVE' && (
                                <span className="text-[10px] text-zinc-400">
                                  dari <span className="font-bold">{move.entity}</span>
                                </span>
                              )}
                              {move.type === 'SO_SHIPMENT' && (
                                <span className="text-[10px] text-zinc-400">
                                  ke <span className="font-bold">{move.entity}</span>
                                </span>
                              )}
                              {move.type === 'TRANSFER' && (
                                <span className="text-[10px] text-zinc-400">
                                  → <span className="font-bold">{move.entity}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right: Quantity + Time */}
                        <div className="text-right shrink-0">
                          <div className={cn("text-base font-black tabular-nums", config.color)}>
                            {move.qty > 0 ? '+' : ''}{move.qty}
                            <span className="text-[10px] font-bold text-zinc-400 ml-1">{move.unit}</span>
                          </div>
                          <div className="text-[10px] font-bold text-zinc-400 mt-0.5">
                            {new Date(move.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {move.user}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {movements.length === 0 && (
              <div className="px-6 py-12 text-center">
                <Activity className="h-8 w-8 text-zinc-300 mx-auto mb-3" />
                <p className="text-sm font-bold text-zinc-400">Belum ada pergerakan stok tercatat.</p>
                <p className="text-xs text-zinc-400 mt-1">Pergerakan akan muncul saat ada transaksi masuk/keluar.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </InventoryPerformanceProvider>
  );
}
