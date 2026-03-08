"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  IconPackage,
  IconBuildingFactory2,
  IconTruckDelivery,
  IconClipboardList,
  IconAlertTriangle,
} from "@tabler/icons-react"
import { useProductManufacturing } from "@/hooks/use-product-manufacturing"

interface ProductManufacturingTabProps {
  productId: string
}

function SkeletonCard() {
  return (
    <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      <CardContent className="p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-1/3" />
          <div className="h-8 bg-gray-200 rounded w-1/2" />
        </div>
      </CardContent>
    </Card>
  )
}

function StatusBadge({ label, color }: { label: string; color: string }) {
  const colorMap: Record<string, string> = {
    green: "bg-green-100 text-green-800 border-green-300",
    yellow: "bg-yellow-100 text-yellow-800 border-yellow-300",
    red: "bg-red-100 text-red-800 border-red-300",
  }
  return (
    <Badge className={`${colorMap[color] ?? colorMap.green} text-sm px-3 py-1`}>
      {label}
    </Badge>
  )
}

function WOStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    PLANNED: { label: "Direncanakan", className: "bg-blue-100 text-blue-800" },
    IN_PROGRESS: { label: "Berjalan", className: "bg-orange-100 text-orange-800" },
    COMPLETED: { label: "Selesai", className: "bg-green-100 text-green-800" },
    CANCELLED: { label: "Dibatalkan", className: "bg-gray-100 text-gray-800" },
    ON_HOLD: { label: "Ditunda", className: "bg-yellow-100 text-yellow-800" },
  }
  const info = map[status] ?? { label: status, className: "bg-gray-100 text-gray-800" }
  return <Badge className={info.className}>{info.label}</Badge>
}

export function ProductManufacturingTab({ productId }: ProductManufacturingTabProps) {
  const { data, isLoading } = useProductManufacturing(productId)

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <SkeletonCard />
      </div>
    )
  }

  const { bomUsages, activeWorkOrders, stockSummary, supplyStatus } = data
  const isEmpty = bomUsages.length === 0

  if (isEmpty) {
    return (
      <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <CardContent className="py-16 text-center">
          <IconBuildingFactory2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-medium text-muted-foreground">
            Produk ini belum digunakan dalam BOM manufaktur
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Tambahkan produk ini sebagai material di BOM untuk melihat data manufaktur
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Supply Summary KPI Strip */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">Stok Tersedia</CardTitle>
            <IconPackage className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stockSummary.totalAvailable}</div>
            <p className="text-xs text-muted-foreground">dari {stockSummary.totalStock} total</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">Direservasi</CardTitle>
            <IconClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stockSummary.totalReserved}</div>
            <p className="text-xs text-muted-foreground">untuk produksi</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">Dalam Pesanan</CardTitle>
            <IconTruckDelivery className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stockSummary.onOrder}</div>
            <p className="text-xs text-muted-foreground">PO aktif</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">Kebutuhan Aktif</CardTitle>
            <IconBuildingFactory2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stockSummary.activeDemand}</div>
            <p className="text-xs text-muted-foreground">{activeWorkOrders.length} work order</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">Net Available</CardTitle>
            {stockSummary.netAvailable <= 0 && (
              <IconAlertTriangle className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${
              stockSummary.netAvailable > 0 ? "text-green-600" : "text-red-600"
            }`}>
              {stockSummary.netAvailable}
            </div>
            <p className="text-xs text-muted-foreground">stok - reserved + PO - demand</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">Status Pasokan</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBadge label={supplyStatus.label} color={supplyStatus.color} />
          </CardContent>
        </Card>
      </div>

      {/* BOM Usage Table */}
      <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <CardHeader>
          <CardTitle>Digunakan di BOM</CardTitle>
          <CardDescription>
            Daftar Bill of Materials yang menggunakan produk ini sebagai material
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produk Jadi</TableHead>
                  <TableHead>Kode</TableHead>
                  <TableHead>Versi BOM</TableHead>
                  <TableHead className="text-center">Qty / Unit</TableHead>
                  <TableHead className="text-center">Waste %</TableHead>
                  <TableHead>Satuan</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bomUsages.map((bom) => (
                  <TableRow key={bom.id}>
                    <TableCell className="font-medium">{bom.productName}</TableCell>
                    <TableCell className="font-mono text-sm">{bom.productCode}</TableCell>
                    <TableCell>{bom.bomVersion}</TableCell>
                    <TableCell className="text-center">{bom.quantityPerUnit}</TableCell>
                    <TableCell className="text-center">{bom.wastePct}%</TableCell>
                    <TableCell>{bom.unit ?? "-"}</TableCell>
                    <TableCell>
                      <Badge className={bom.bomIsActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                        {bom.bomIsActive ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Active Work Orders Table */}
      {activeWorkOrders.length > 0 && (
        <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <CardHeader>
            <CardTitle>Work Order Aktif</CardTitle>
            <CardDescription>
              Work order yang membutuhkan material ini
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No. WO</TableHead>
                    <TableHead>Produk</TableHead>
                    <TableHead className="text-center">Qty Rencana</TableHead>
                    <TableHead className="text-center">Kebutuhan Material</TableHead>
                    <TableHead className="text-center">Qty Aktual</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Deadline</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeWorkOrders.map((wo) => (
                    <TableRow key={wo.id}>
                      <TableCell className="font-mono text-sm font-medium">{wo.number}</TableCell>
                      <TableCell>{wo.productName}</TableCell>
                      <TableCell className="text-center">{wo.plannedQty}</TableCell>
                      <TableCell className="text-center font-medium text-orange-600">
                        {wo.requiredQty}
                      </TableCell>
                      <TableCell className="text-center">{wo.actualQty}</TableCell>
                      <TableCell>
                        <WOStatusBadge status={wo.status} />
                      </TableCell>
                      <TableCell>
                        {wo.dueDate
                          ? new Date(wo.dueDate).toLocaleDateString("id-ID", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
