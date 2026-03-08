"use client"

import { useMemo } from "react"
import { useBOMCost, useUpdateProductCostFromBOM } from "@/hooks/use-bom-cost"
import { calculateBOMCost, type BOMCostItem, type BOMCostResult } from "@/lib/bom-costing"
import { formatCurrency } from "@/lib/inventory-utils"
import { Button } from "@/components/ui/button"
import {
  Calculator,
  RefreshCw,
  ArrowUpRight,
  Loader2,
  Package,
  Percent,
  AlertTriangle,
} from "lucide-react"

/**
 * Two usage modes:
 *
 * 1. API mode: pass `bomId` (BillOfMaterials ID) — fetches cost from API
 * 2. Inline mode: pass `items` + `productName` + `productId` — calculates client-side
 *    Used by ProductionBOM detail page which already has material data loaded.
 */
interface BOMCostCardApiProps {
  mode: "api"
  bomId: string
  onCostUpdated?: () => void
}

interface BOMCostCardInlineProps {
  mode: "inline"
  bomId?: string  // optional, for update-product-cost action
  productId: string
  productName: string
  productUnit?: string
  currentCostPrice?: number
  items: Array<{
    id: string
    materialId?: string
    materialCode?: string
    materialName?: string
    material?: { id?: string; code?: string; name?: string; unit?: string; costPrice?: number | string }
    quantityPerUnit?: number | string
    quantity?: number | string
    wastePct?: number | string
    unit?: string
  }>
  onCostUpdated?: () => void
}

type BOMCostCardProps = BOMCostCardApiProps | BOMCostCardInlineProps

export function BOMCostCard(props: BOMCostCardProps) {
  if (props.mode === "api") {
    return <BOMCostCardApi {...props} />
  }
  return <BOMCostCardInline {...props} />
}

// --- API Mode ---
function BOMCostCardApi({ bomId, onCostUpdated }: BOMCostCardApiProps) {
  const { data: costData, isLoading, refetch } = useBOMCost(bomId)
  const updateCost = useUpdateProductCostFromBOM(bomId)

  if (isLoading) {
    return <CostCardSkeleton />
  }
  if (!costData) {
    return <CostCardEmpty />
  }

  return (
    <CostCardContent
      costResult={{
        ...costData,
        items: costData.items,
        totalMaterialCost: costData.totalMaterialCost,
        costPerUnit: costData.costPerUnit,
      }}
      currentProductCost={Number(costData.product?.costPrice || 0)}
      productUnit={costData.product?.unit || "pcs"}
      onRefresh={() => refetch()}
      onUpdateCost={async () => {
        await updateCost.mutateAsync(undefined)
        onCostUpdated?.()
      }}
      isUpdating={updateCost.isPending}
    />
  )
}

// --- Inline Mode (ProductionBOM page) ---
function BOMCostCardInline({
  bomId,
  productId,
  productName,
  productUnit,
  currentCostPrice,
  items,
  onCostUpdated,
}: BOMCostCardInlineProps) {
  const updateCost = useUpdateProductCostFromBOM(bomId || null)

  const costResult = useMemo(() => {
    const mappedItems = items.map((item) => ({
      id: item.id,
      materialId: item.materialId || item.material?.id || "",
      materialCode: item.materialCode || item.material?.code || "",
      materialName: item.materialName || item.material?.name || "Unknown",
      unit: item.unit || item.material?.unit || "pcs",
      quantity: Number(item.quantityPerUnit ?? item.quantity ?? 0),
      wastePct: Number(item.wastePct || 0),
      unitCost: Number(item.material?.costPrice || 0),
    }))

    return calculateBOMCost({
      id: bomId || "",
      productId,
      productName,
      outputQty: 1,
      items: mappedItems,
    })
  }, [items, bomId, productId, productName])

  return (
    <CostCardContent
      costResult={costResult}
      currentProductCost={currentCostPrice || 0}
      productUnit={productUnit || "pcs"}
      onUpdateCost={
        productId
          ? async () => {
              await updateCost.mutateAsync({ productId, costPerUnit: costResult.costPerUnit })
              onCostUpdated?.()
            }
          : undefined
      }
      isUpdating={updateCost.isPending}
    />
  )
}

// --- Shared Content Component ---
function CostCardContent({
  costResult,
  currentProductCost,
  productUnit,
  onRefresh,
  onUpdateCost,
  isUpdating,
}: {
  costResult: BOMCostResult
  currentProductCost: number
  productUnit: string
  onRefresh?: () => void
  onUpdateCost?: () => Promise<void>
  isUpdating: boolean
}) {
  const calculatedCost = costResult.costPerUnit
  const costDiff = calculatedCost - currentProductCost
  const hasDiff = Math.abs(costDiff) > 0 && currentProductCost > 0

  return (
    <div className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-black bg-emerald-50 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-emerald-700" />
          <h3 className="text-sm font-black uppercase text-emerald-900">
            Kalkulasi HPP / COGS
          </h3>
        </div>
        {onRefresh && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            className="h-7 px-2 text-xs"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Refresh
          </Button>
        )}
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-0 border-b border-zinc-200">
        <div className="p-3 border-r border-zinc-200">
          <p className="text-[10px] font-black uppercase text-zinc-400 mb-0.5">
            Total Biaya Material
          </p>
          <p className="text-base font-black text-black">
            {formatCurrency(costResult.totalMaterialCost)}
          </p>
        </div>
        <div className="p-3 border-r border-zinc-200">
          <p className="text-[10px] font-black uppercase text-zinc-400 mb-0.5">
            HPP per Unit
          </p>
          <p className="text-base font-black text-emerald-700">
            {formatCurrency(calculatedCost)}
          </p>
        </div>
        <div className="p-3 border-r border-zinc-200">
          <p className="text-[10px] font-black uppercase text-zinc-400 mb-0.5">
            Harga Pokok Saat Ini
          </p>
          <p className="text-base font-bold text-zinc-600">
            {currentProductCost > 0 ? formatCurrency(currentProductCost) : "\u2014"}
          </p>
        </div>
        <div className="p-3">
          <p className="text-[10px] font-black uppercase text-zinc-400 mb-0.5">
            Selisih
          </p>
          {hasDiff ? (
            <p
              className={`text-base font-black ${costDiff > 0 ? "text-red-600" : "text-green-600"}`}
            >
              {costDiff > 0 ? "+" : ""}
              {formatCurrency(costDiff)}
            </p>
          ) : (
            <p className="text-base font-bold text-zinc-400">{"\u2014"}</p>
          )}
        </div>
      </div>

      {/* Material Breakdown Table */}
      {costResult.items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50">
                <th className="text-left px-3 py-2 font-black uppercase text-[10px] text-zinc-500">
                  Material
                </th>
                <th className="text-right px-3 py-2 font-black uppercase text-[10px] text-zinc-500">
                  Qty
                </th>
                <th className="text-right px-3 py-2 font-black uppercase text-[10px] text-zinc-500">
                  Waste %
                </th>
                <th className="text-right px-3 py-2 font-black uppercase text-[10px] text-zinc-500">
                  Qty Efektif
                </th>
                <th className="text-right px-3 py-2 font-black uppercase text-[10px] text-zinc-500">
                  Harga Satuan
                </th>
                <th className="text-right px-3 py-2 font-black uppercase text-[10px] text-zinc-500">
                  Subtotal
                </th>
                <th className="text-right px-3 py-2 font-black uppercase text-[10px] text-zinc-500">
                  Porsi
                </th>
              </tr>
            </thead>
            <tbody>
              {costResult.items.map((item: BOMCostItem) => (
                <tr
                  key={item.id}
                  className="border-b border-zinc-100 hover:bg-zinc-50"
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <Package className="h-3 w-3 text-zinc-400 shrink-0" />
                      <div>
                        <p className="font-bold text-black">
                          {item.materialName}
                        </p>
                        {item.materialCode && (
                          <p className="text-[10px] text-zinc-400">
                            {item.materialCode}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-zinc-700">
                    {item.quantity} {item.unit}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {item.wastePct > 0 ? (
                      <span className="inline-flex items-center gap-0.5 text-amber-600 font-bold">
                        <Percent className="h-2.5 w-2.5" />
                        {item.wastePct}
                      </span>
                    ) : (
                      <span className="text-zinc-300">0</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-zinc-700">
                    {item.effectiveQty}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-zinc-700">
                    {formatCurrency(item.unitCost)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-bold text-black">
                    {formatCurrency(item.lineCost)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <CostPortionBar portion={item.costPortion} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-black bg-zinc-50">
                <td
                  colSpan={5}
                  className="px-3 py-2 text-right font-black uppercase text-[10px] text-zinc-600"
                >
                  Total Biaya Material
                </td>
                <td className="px-3 py-2 text-right font-mono font-black text-emerald-700 text-sm">
                  {formatCurrency(costResult.totalMaterialCost)}
                </td>
                <td className="px-3 py-2 text-right font-black text-zinc-500 text-[10px]">
                  100%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Update Product Cost Action */}
      {onUpdateCost && (
        <div className="flex items-center justify-between border-t-2 border-black bg-zinc-50 px-4 py-3">
          <div className="text-xs text-zinc-500">
            <span className="font-bold">Output:</span> 1 {productUnit} ={" "}
            <span className="font-black text-emerald-700">
              {formatCurrency(calculatedCost)}
            </span>
          </div>
          <Button
            size="sm"
            onClick={onUpdateCost}
            disabled={isUpdating || calculatedCost <= 0}
            className="bg-black text-white hover:bg-zinc-800 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] text-xs font-black"
          >
            {isUpdating ? (
              <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
            ) : (
              <ArrowUpRight className="h-3 w-3 mr-1.5" />
            )}
            Update Harga Pokok Produk
          </Button>
        </div>
      )}
    </div>
  )
}

function CostCardSkeleton() {
  return (
    <div className="border-2 border-black bg-white p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      <div className="flex items-center gap-2 text-zinc-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm font-bold">Menghitung HPP...</span>
      </div>
    </div>
  )
}

function CostCardEmpty() {
  return (
    <div className="border-2 border-black bg-white p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      <div className="flex items-center gap-2 text-zinc-400">
        <AlertTriangle className="h-4 w-4" />
        <span className="text-sm">Data biaya tidak tersedia</span>
      </div>
    </div>
  )
}

/** Small inline bar showing cost portion */
function CostPortionBar({ portion }: { portion: number }) {
  return (
    <div className="flex items-center gap-1.5 justify-end">
      <div className="h-1.5 w-12 bg-zinc-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500 rounded-full"
          style={{ width: `${Math.min(portion, 100)}%` }}
        />
      </div>
      <span className="text-[10px] font-mono font-bold text-zinc-500 w-10 text-right">
        {portion.toFixed(1)}%
      </span>
    </div>
  )
}
