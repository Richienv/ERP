"use client"

import { useInventorySettings, useUpdateInventorySettings } from "@/hooks/use-inventory-settings"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import { IconSettings, IconAlertTriangle, IconCheck } from "@tabler/icons-react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

export default function InventorySettingsPage() {
  const { data, isLoading } = useInventorySettings()
  const mutation = useUpdateInventorySettings()

  if (isLoading || !data) return <TablePageSkeleton accentColor="bg-blue-400" />

  function handleToggleNegativeStock(checked: boolean) {
    mutation.mutate(
      { allowNegativeStock: checked },
      {
        onSuccess: () => {
          toast.success(
            checked
              ? "Stok negatif diizinkan"
              : "Stok negatif tidak diizinkan",
          )
        },
        onError: () => {
          toast.error("Gagal menyimpan pengaturan")
        },
      },
    )
  }

  return (
    <div className="mf-page">
      {/* Header */}
      <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white">
        <div className="px-6 py-4 flex items-center gap-3 border-l-[6px] border-l-blue-500">
          <IconSettings className="h-6 w-6" />
          <div>
            <h1 className="text-xl font-black uppercase tracking-tight">
              Pengaturan Inventori
            </h1>
            <p className="text-xs text-zinc-500 font-medium">
              Konfigurasi kebijakan stok dan aturan inventori
            </p>
          </div>
        </div>
      </div>

      {/* Negative Stock Policy Card */}
      <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white">
        <div className="bg-zinc-100 px-6 py-3 border-b-2 border-black">
          <h2 className="text-xs font-black uppercase tracking-widest">
            Kebijakan Stok
          </h2>
        </div>
        <div className="p-6 space-y-6">
          {/* Toggle Row */}
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <Label className="text-sm font-bold">
                Izinkan Stok Negatif
              </Label>
              <p className="text-xs text-zinc-500">
                Jika diaktifkan, transaksi yang membuat stok menjadi di bawah
                nol akan tetap diproses. Berguna untuk pre-selling kain/bahan.
              </p>
            </div>
            <Switch
              checked={data.allowNegativeStock}
              onCheckedChange={handleToggleNegativeStock}
              disabled={mutation.isPending}
            />
          </div>

          {/* Status Indicator */}
          <div
            className={`flex items-start gap-3 p-4 border-2 border-black ${
              data.allowNegativeStock
                ? "bg-amber-50 border-amber-400"
                : "bg-green-50 border-green-400"
            }`}
          >
            {data.allowNegativeStock ? (
              <IconAlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            ) : (
              <IconCheck className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
            )}
            <div className="space-y-1">
              <p className="text-sm font-bold">
                {data.allowNegativeStock
                  ? "Stok negatif diizinkan"
                  : "Stok negatif tidak diizinkan"}
              </p>
              <p className="text-xs text-zinc-600">
                {data.allowNegativeStock
                  ? "Transaksi pengurangan stok akan tetap diproses meskipun sisa stok menjadi negatif. Pastikan Anda memantau stok secara berkala."
                  : "Transaksi yang menyebabkan stok di bawah nol akan ditolak. Pesan error: 'Stok tidak cukup. Sisa stok: X unit'"}
              </p>
            </div>
          </div>

          {/* Affected Operations */}
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
              Pengecekan berlaku pada:
            </p>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-zinc-700">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 bg-black rounded-full shrink-0" />
                Pengiriman Pesanan Penjualan (SO Shipment)
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 bg-black rounded-full shrink-0" />
                Penyesuaian Stok (Stock Adjustment)
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 bg-black rounded-full shrink-0" />
                Pengeluaran Material Produksi
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 bg-black rounded-full shrink-0" />
                Transfer Stok Antar Gudang
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
