import { getProductsForKanban, getWarehouses } from "@/app/actions/inventory";
import { StockClient } from "./stock-client";
import { InventoryPerformanceProvider } from "@/components/inventory/inventory-performance-provider";

export const dynamic = 'force-dynamic';

/** Race a promise against a timeout — returns fallback on timeout */
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))
  ])
}

export default async function StockLevelPage() {
  const [products, warehouses] = await Promise.all([
    withTimeout(getProductsForKanban(), 8000, []),
    withTimeout(getWarehouses(), 5000, [])
  ]);

  return (
    <InventoryPerformanceProvider currentPath="/inventory/stock">
      <div className="p-4 md:p-8 pt-6 max-w-[1600px] mx-auto min-h-screen">
        <StockClient products={products} warehouses={warehouses} />
      </div>
    </InventoryPerformanceProvider>
  );
}