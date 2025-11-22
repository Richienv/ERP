"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  Plus, 
  Minus,
  RotateCcw,
  ArrowRightLeft,
  Package,
  AlertCircle,
  CheckCircle,
  Clock
} from "lucide-react"
import { toast } from "sonner"

// Mock data for warehouses and products
const mockWarehouses = [
  { id: "1", code: "GU001", name: "Gudang Utama" },
  { id: "2", code: "GC001", name: "Gudang Cabang" },
  { id: "3", code: "GT001", name: "Gudang Transit" }
]

const mockProducts = [
  { id: "1", code: "ELK001", name: "Laptop Dell Inspiron 15", currentStock: 25 },
  { id: "2", code: "FUR001", name: "Meja Kantor Eksekutif", currentStock: 8 },
  { id: "3", code: "OFF001", name: "Printer HP LaserJet", currentStock: 0 },
  { id: "4", code: "ELK002", name: "Mouse Wireless Logitech", currentStock: 45 },
  { id: "5", code: "ELK003", name: "Keyboard Mechanical", currentStock: 3 }
]

// Mock recent adjustments
const recentAdjustments = [
  {
    id: "1",
    type: "IN",
    product: "Laptop Dell Inspiron 15",
    warehouse: "Gudang Utama",
    quantity: 5,
    reason: "Pembelian baru",
    date: "2024-11-05",
    status: "completed"
  },
  {
    id: "2", 
    type: "ADJUSTMENT",
    product: "Printer HP LaserJet",
    warehouse: "Gudang Cabang",
    quantity: -2,
    reason: "Barang rusak",
    date: "2024-11-04",
    status: "completed"
  },
  {
    id: "3",
    type: "TRANSFER",
    product: "Mouse Wireless Logitech",
    warehouse: "Gudang Utama → Gudang Cabang",
    quantity: 10,
    reason: "Transfer antar gudang",
    date: "2024-11-04",
    status: "pending"
  }
]

export default function StockAdjustmentsPage() {
  const [adjustmentType, setAdjustmentType] = useState("")
  const [selectedProduct, setSelectedProduct] = useState("")
  const [selectedWarehouse, setSelectedWarehouse] = useState("")
  const [quantity, setQuantity] = useState("")
  const [reason, setReason] = useState("")
  const [notes, setNotes] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!adjustmentType || !selectedProduct || !selectedWarehouse || !quantity || !reason) {
      toast.error("Semua field wajib diisi")
      return
    }

    // Here you would typically submit to your API
    toast.success("Penyesuaian stok berhasil disimpan")
    
    // Reset form
    setAdjustmentType("")
    setSelectedProduct("")
    setSelectedWarehouse("")
    setQuantity("")
    setReason("")
    setNotes("")
  }

  const getAdjustmentIcon = (type: string) => {
    switch (type) {
      case "IN":
        return <Plus className="h-4 w-4 text-green-600" />
      case "OUT":
        return <Minus className="h-4 w-4 text-red-600" />
      case "ADJUSTMENT":
        return <RotateCcw className="h-4 w-4 text-blue-600" />
      case "TRANSFER":
        return <ArrowRightLeft className="h-4 w-4 text-purple-600" />
      default:
        return <Package className="h-4 w-4" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="default"><CheckCircle className="w-3 h-3 mr-1" />Selesai</Badge>
      case "pending":
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>
      case "failed":
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Gagal</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Penyesuaian Stok</h2>
          <p className="text-muted-foreground">
            Kelola perubahan stok dan transfer antar gudang
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Adjustment Form */}
        <Card>
          <CardHeader>
            <CardTitle>Buat Penyesuaian Baru</CardTitle>
            <CardDescription>
              Tambah, kurangi, atau transfer stok produk
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="adjustmentType">Tipe Penyesuaian</Label>
                <Select value={adjustmentType} onValueChange={setAdjustmentType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih tipe penyesuaian" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IN">
                      <div className="flex items-center">
                        <Plus className="w-4 h-4 mr-2 text-green-600" />
                        Tambah Stok
                      </div>
                    </SelectItem>
                    <SelectItem value="OUT">
                      <div className="flex items-center">
                        <Minus className="w-4 h-4 mr-2 text-red-600" />
                        Kurangi Stok
                      </div>
                    </SelectItem>
                    <SelectItem value="ADJUSTMENT">
                      <div className="flex items-center">
                        <RotateCcw className="w-4 h-4 mr-2 text-blue-600" />
                        Penyesuaian Manual
                      </div>
                    </SelectItem>
                    <SelectItem value="TRANSFER">
                      <div className="flex items-center">
                        <ArrowRightLeft className="w-4 h-4 mr-2 text-purple-600" />
                        Transfer Antar Gudang
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="product">Produk</Label>
                <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih produk" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockProducts.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        <div className="flex justify-between items-center w-full">
                          <span>{product.code} - {product.name}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            Stok: {product.currentStock}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="warehouse">Gudang</Label>
                <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih gudang" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockWarehouses.map((warehouse) => (
                      <SelectItem key={warehouse.id} value={warehouse.id}>
                        {warehouse.code} - {warehouse.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantity">Jumlah</Label>
                <Input
                  id="quantity"
                  type="number"
                  placeholder="Masukkan jumlah"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Alasan</Label>
                <Input
                  id="reason"
                  placeholder="Alasan penyesuaian"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Catatan (Opsional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Catatan tambahan..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <Button type="submit" className="w-full">
                <Package className="w-4 h-4 mr-2" />
                Simpan Penyesuaian
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Recent Adjustments */}
        <Card>
          <CardHeader>
            <CardTitle>Penyesuaian Terbaru</CardTitle>
            <CardDescription>
              Riwayat penyesuaian stok terkini
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentAdjustments.map((adjustment) => (
                <div key={adjustment.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                  <div className="flex-shrink-0">
                    {getAdjustmentIcon(adjustment.type)}
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {adjustment.product}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {adjustment.warehouse} • {adjustment.quantity > 0 ? '+' : ''}{adjustment.quantity}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {adjustment.reason}
                    </p>
                  </div>
                  <div className="flex flex-col items-end space-y-1">
                    {getStatusBadge(adjustment.status)}
                    <span className="text-xs text-muted-foreground">
                      {adjustment.date}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}