"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ArrowLeft,
  Package,
  Warehouse,
  BarChart3
} from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { formatCurrency } from "@/lib/utils"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"

// Transaction type label mapping
const TRANSACTION_TYPE_LABELS: Record<string, { label: string; variant: "masuk" | "keluar" | "internal" }> = {
  PO_RECEIVE: { label: "Penerimaan PO", variant: "masuk" },
  PRODUCTION_IN: { label: "Hasil Produksi", variant: "masuk" },
  RETURN_IN: { label: "Retur Masuk", variant: "masuk" },
  SO_SHIPMENT: { label: "Pengiriman SO", variant: "keluar" },
  PRODUCTION_OUT: { label: "Konsumsi Produksi", variant: "keluar" },
  RETURN_OUT: { label: "Retur Keluar", variant: "keluar" },
  SCRAP: { label: "Scrap/Rusak", variant: "keluar" },
  TRANSFER: { label: "Transfer", variant: "internal" },
  ADJUSTMENT: { label: "Penyesuaian", variant: "internal" },
  INITIAL: { label: "Saldo Awal", variant: "masuk" },
}

function getMovementTypeBadge(type: string) {
  const info = TRANSACTION_TYPE_LABELS[type]
  if (!info) return <Badge variant="secondary">{type}</Badge>

  const colorMap = {
    masuk: "bg-green-100 text-green-800",
    keluar: "bg-red-100 text-red-800",
    internal: "bg-blue-100 text-blue-800",
  }

  return <Badge className={colorMap[info.variant]}>{info.label}</Badge>
}

export default function ProductDetailPage() {
  const params = useParams()
  const productId = params.id as string
  const [activeTab, setActiveTab] = useState("overview")

  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.products.detail(productId),
    queryFn: async () => {
      const res = await fetch(`/api/products/${productId}`)
      if (res.status === 404) return null
      if (!res.ok) throw new Error("Gagal memuat data produk")
      const json = await res.json()
      return json.data ?? null
    },
    enabled: !!productId,
  })

  if (isLoading) {
    return <TablePageSkeleton accentColor="bg-blue-400" />
  }

  if (!data || isError) {
    return (
      <div className="mf-page">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="icon" asChild className="border-2 border-black">
            <Link href="/inventory/products">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Produk Tidak Ditemukan</h2>
            <p className="text-muted-foreground">
              Produk dengan ID {productId} tidak ditemukan
            </p>
          </div>
        </div>
      </div>
    )
  }

  const product = data
  const stockLevels: Array<{
    id: string
    quantity: number
    reservedQty: number
    availableQty: number
    warehouse: { id: string; name: string }
    location: { id: string; name: string; code: string } | null
  }> = product.stockLevels ?? []

  const transactions: Array<{
    id: string
    type: string
    quantity: number
    unitCost: string | number | null
    referenceId: string | null
    createdAt: string
    warehouse: { id: string; name: string }
  }> = product.transactions ?? []

  // Calculate totals from real stock levels
  const totalStock = stockLevels.reduce((sum, sl) => sum + sl.quantity, 0)
  const totalReserved = stockLevels.reduce((sum, sl) => sum + sl.reservedQty, 0)
  const totalAvailable = stockLevels.reduce((sum, sl) => sum + sl.availableQty, 0)
  const costPrice = Number(product.costPrice ?? 0)
  const sellingPrice = Number(product.sellingPrice ?? 0)
  const totalValue = totalStock * costPrice

  // Stock status based on real thresholds
  const getStockStatus = () => {
    if (totalAvailable === 0) return { status: "Habis Stok", color: "text-red-600" }
    if (totalAvailable <= product.reorderLevel) return { status: "Perlu Restok", color: "text-yellow-600" }
    if (totalAvailable <= product.minStock) return { status: "Stok Menipis", color: "text-orange-600" }
    return { status: "Stok Normal", color: "text-green-600" }
  }

  const stockStatus = getStockStatus()

  // Margin calculation (avoid division by zero)
  const margin = sellingPrice > 0
    ? ((sellingPrice - costPrice) / sellingPrice * 100).toFixed(1)
    : "0.0"

  return (
    <div className="mf-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="icon" asChild className="border-2 border-black">
            <Link href="/inventory/products">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">{product.name}</h2>
            <p className="text-muted-foreground">
              {product.code} {product.category ? `\u2022 ${product.category.name}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {!product.isActive && (
            <Badge className="bg-red-100 text-red-800">Nonaktif</Badge>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Stok</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStock}</div>
            <p className="text-xs text-muted-foreground">
              {totalReserved} dipesan
            </p>
          </CardContent>
        </Card>

        <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stok Tersedia</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stockStatus.color}`}>{totalAvailable}</div>
            <p className={`text-xs ${stockStatus.color}`}>
              {stockStatus.status}
            </p>
          </CardContent>
        </Card>

        <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Nilai Total</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalValue)}</div>
            <p className="text-xs text-muted-foreground">
              Berdasarkan HPP
            </p>
          </CardContent>
        </Card>

        <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lokasi</CardTitle>
            <Warehouse className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stockLevels.length}</div>
            <p className="text-xs text-muted-foreground">
              Gudang aktif
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: "overview", label: "Overview" },
            { key: "stock", label: "Lokasi Stok" },
            { key: "movements", label: "Riwayat Gerakan" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Product Information */}
          <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <CardHeader>
              <CardTitle>Informasi Produk</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm text-muted-foreground">Kode Produk</div>
                <div className="font-medium">{product.code}</div>
              </div>
              <Separator />
              <div>
                <div className="text-sm text-muted-foreground">Nama Produk</div>
                <div className="font-medium">{product.name}</div>
              </div>
              <Separator />
              <div>
                <div className="text-sm text-muted-foreground">Deskripsi</div>
                <div className="text-sm">{product.description || "-"}</div>
              </div>
              <Separator />
              <div>
                <div className="text-sm text-muted-foreground">Kategori</div>
                <div className="font-medium">{product.category?.name || "-"}</div>
              </div>
              <Separator />
              <div>
                <div className="text-sm text-muted-foreground">Satuan</div>
                <div className="font-medium">{product.unit}</div>
              </div>
              {product.color && (
                <>
                  <Separator />
                  <div>
                    <div className="text-sm text-muted-foreground">Warna</div>
                    <div className="font-medium">{product.color}</div>
                  </div>
                </>
              )}
              {product.size && (
                <>
                  <Separator />
                  <div>
                    <div className="text-sm text-muted-foreground">Ukuran</div>
                    <div className="font-medium">{product.size}</div>
                  </div>
                </>
              )}
              {product.composition && (
                <>
                  <Separator />
                  <div>
                    <div className="text-sm text-muted-foreground">Komposisi</div>
                    <div className="font-medium">{product.composition}</div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Pricing & Stock Settings */}
          <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <CardHeader>
              <CardTitle>Harga & Pengaturan Stok</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm text-muted-foreground">Harga Pokok Penjualan (HPP)</div>
                <div className="font-medium">{formatCurrency(costPrice)}</div>
              </div>
              <Separator />
              <div>
                <div className="text-sm text-muted-foreground">Harga Jual</div>
                <div className="font-medium">{formatCurrency(sellingPrice)}</div>
              </div>
              <Separator />
              <div>
                <div className="text-sm text-muted-foreground">Margin Keuntungan</div>
                <div className="font-medium text-green-600">
                  {margin}%
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Stok Min</div>
                  <div className="font-medium">{product.minStock ?? 0}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Stok Max</div>
                  <div className="font-medium">{product.maxStock ?? 0}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Reorder Point</div>
                  <div className="font-medium">{product.reorderLevel ?? 0}</div>
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Lead Time</div>
                  <div className="font-medium">{product.leadTime ?? 7} hari</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Safety Stock</div>
                  <div className="font-medium">{product.safetyStock ?? 0}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "stock" && (
        <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <CardHeader>
            <CardTitle>Lokasi Penyimpanan Stok</CardTitle>
            <CardDescription>
              Distribusi stok di berbagai gudang dan lokasi
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stockLevels.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Belum ada data stok untuk produk ini.</p>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Gudang</TableHead>
                      <TableHead>Lokasi</TableHead>
                      <TableHead className="text-center">Qty On Hand</TableHead>
                      <TableHead className="text-center">Dipesan</TableHead>
                      <TableHead className="text-center">Tersedia</TableHead>
                      <TableHead className="text-right">Nilai</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stockLevels.map((sl) => (
                      <TableRow key={sl.id}>
                        <TableCell className="font-medium">{sl.warehouse?.name ?? "-"}</TableCell>
                        <TableCell>{sl.location?.code ?? sl.location?.name ?? "-"}</TableCell>
                        <TableCell className="text-center">{sl.quantity}</TableCell>
                        <TableCell className="text-center">{sl.reservedQty}</TableCell>
                        <TableCell className="text-center font-medium">{sl.availableQty}</TableCell>
                        <TableCell className="text-right">{formatCurrency(sl.quantity * costPrice)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "movements" && (
        <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <CardHeader>
            <CardTitle>Riwayat Pergerakan Stok</CardTitle>
            <CardDescription>
              10 transaksi terakhir masuk, keluar, dan penyesuaian stok
            </CardDescription>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Belum ada riwayat pergerakan stok.</p>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Tipe</TableHead>
                      <TableHead>Referensi</TableHead>
                      <TableHead className="text-center">Quantity</TableHead>
                      <TableHead>Gudang</TableHead>
                      <TableHead className="text-right">Unit Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell>
                          {new Date(tx.createdAt).toLocaleDateString("id-ID", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </TableCell>
                        <TableCell>{getMovementTypeBadge(tx.type)}</TableCell>
                        <TableCell className="font-mono text-sm">{tx.referenceId || "-"}</TableCell>
                        <TableCell
                          className={`text-center font-medium ${
                            tx.quantity > 0 ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {tx.quantity > 0 ? "+" : ""}
                          {tx.quantity}
                        </TableCell>
                        <TableCell>{tx.warehouse?.name ?? "-"}</TableCell>
                        <TableCell className="text-right">
                          {tx.unitCost ? formatCurrency(Number(tx.unitCost)) : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
