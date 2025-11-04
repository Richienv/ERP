"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, Save, X } from "lucide-react"
import Link from "next/link"

// Mock data for dropdowns
const categories = [
  { id: "1", name: "Elektronik" },
  { id: "2", name: "Furniture" },
  { id: "3", name: "Peralatan Kantor" },
  { id: "4", name: "Stationery" },
  { id: "5", name: "Bahan Baku" }
]

const units = [
  { id: "1", code: "pcs", name: "Pieces" },
  { id: "2", code: "kg", name: "Kilogram" },
  { id: "3", code: "ltr", name: "Liter" },
  { id: "4", code: "rim", name: "Rim" },
  { id: "5", code: "box", name: "Box" },
  { id: "6", code: "set", name: "Set" }
]

interface ProductForm {
  code: string
  name: string
  description: string
  categoryId: string
  unitId: string
  costPrice: string
  sellingPrice: string
  minimumStock: string
  maximumStock: string
  reorderPoint: string
}

export default function NewProductPage() {
  const router = useRouter()
  const [formData, setFormData] = useState<ProductForm>({
    code: "",
    name: "",
    description: "",
    categoryId: "",
    unitId: "",
    costPrice: "",
    sellingPrice: "",
    minimumStock: "",
    maximumStock: "",
    reorderPoint: ""
  })

  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleInputChange = (field: keyof ProductForm, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))

    console.log("Form submitted:", formData)
    
    // Navigate back to products list
    router.push("/inventory/products")
  }

  const handleCancel = () => {
    router.push("/inventory/products")
  }

  // Calculate profit margin
  const calculateProfitMargin = () => {
    const cost = parseFloat(formData.costPrice) || 0
    const selling = parseFloat(formData.sellingPrice) || 0
    if (cost > 0 && selling > 0) {
      return ((selling - cost) / selling * 100).toFixed(1)
    }
    return "0"
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/inventory/products">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Tambah Produk Baru</h2>
          <p className="text-muted-foreground">
            Buat produk baru untuk inventori
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Product Information */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Informasi Produk</CardTitle>
                <CardDescription>
                  Data dasar produk yang akan ditambahkan
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="code">Kode Produk *</Label>
                    <Input
                      id="code"
                      placeholder="Contoh: ELK001"
                      value={formData.code}
                      onChange={(e) => handleInputChange("code", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">Nama Produk *</Label>
                    <Input
                      id="name"
                      placeholder="Masukkan nama produk"
                      value={formData.name}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Deskripsi</Label>
                  <Textarea
                    id="description"
                    placeholder="Deskripsi detail produk..."
                    rows={3}
                    value={formData.description}
                    onChange={(e) => handleInputChange("description", e.target.value)}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="category">Kategori *</Label>
                    <Select 
                      value={formData.categoryId} 
                      onValueChange={(value) => handleInputChange("categoryId", value)}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih kategori" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unit">Satuan *</Label>
                    <Select 
                      value={formData.unitId} 
                      onValueChange={(value) => handleInputChange("unitId", value)}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih satuan" />
                      </SelectTrigger>
                      <SelectContent>
                        {units.map((unit) => (
                          <SelectItem key={unit.id} value={unit.id}>
                            {unit.name} ({unit.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pricing Information */}
            <Card>
              <CardHeader>
                <CardTitle>Informasi Harga</CardTitle>
                <CardDescription>
                  Set harga beli dan jual produk
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="costPrice">Harga Beli (HPP) *</Label>
                    <Input
                      id="costPrice"
                      type="number"
                      placeholder="0"
                      value={formData.costPrice}
                      onChange={(e) => handleInputChange("costPrice", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sellingPrice">Harga Jual *</Label>
                    <Input
                      id="sellingPrice"
                      type="number"
                      placeholder="0"
                      value={formData.sellingPrice}
                      onChange={(e) => handleInputChange("sellingPrice", e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Profit Margin Display */}
                {formData.costPrice && formData.sellingPrice && (
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-sm text-muted-foreground">Margin Keuntungan</div>
                    <div className="text-lg font-semibold text-green-600">
                      {calculateProfitMargin()}%
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Stock Management */}
            <Card>
              <CardHeader>
                <CardTitle>Manajemen Stok</CardTitle>
                <CardDescription>
                  Atur level stok minimum, maksimum, dan titik pemesanan ulang
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="minimumStock">Stok Minimum *</Label>
                    <Input
                      id="minimumStock"
                      type="number"
                      placeholder="0"
                      value={formData.minimumStock}
                      onChange={(e) => handleInputChange("minimumStock", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maximumStock">Stok Maksimum</Label>
                    <Input
                      id="maximumStock"
                      type="number"
                      placeholder="0"
                      value={formData.maximumStock}
                      onChange={(e) => handleInputChange("maximumStock", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reorderPoint">Titik Pemesanan Ulang *</Label>
                    <Input
                      id="reorderPoint"
                      type="number"
                      placeholder="0"
                      value={formData.reorderPoint}
                      onChange={(e) => handleInputChange("reorderPoint", e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="text-sm text-muted-foreground">
                  <p>• <strong>Stok Minimum:</strong> Batas bawah stok yang harus tersedia</p>
                  <p>• <strong>Stok Maksimum:</strong> Batas atas kapasitas penyimpanan</p>
                  <p>• <strong>Titik Pemesanan Ulang:</strong> Level stok untuk trigger pemesanan baru</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Preview & Actions */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Preview Produk</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="text-sm text-muted-foreground">Kode</div>
                  <div className="font-medium">{formData.code || "-"}</div>
                </div>
                <Separator />
                <div>
                  <div className="text-sm text-muted-foreground">Nama</div>
                  <div className="font-medium">{formData.name || "-"}</div>
                </div>
                <Separator />
                <div>
                  <div className="text-sm text-muted-foreground">Kategori</div>
                  <div className="font-medium">
                    {formData.categoryId ? 
                      categories.find(c => c.id === formData.categoryId)?.name : "-"}
                  </div>
                </div>
                <Separator />
                <div>
                  <div className="text-sm text-muted-foreground">Satuan</div>
                  <div className="font-medium">
                    {formData.unitId ? 
                      units.find(u => u.id === formData.unitId)?.name : "-"}
                  </div>
                </div>
                <Separator />
                <div>
                  <div className="text-sm text-muted-foreground">Harga Jual</div>
                  <div className="font-medium">
                    {formData.sellingPrice ? 
                      new Intl.NumberFormat('id-ID', {
                        style: 'currency',
                        currency: 'IDR',
                        minimumFractionDigits: 0
                      }).format(parseInt(formData.sellingPrice)) : "-"}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Aksi</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={isSubmitting}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {isSubmitting ? "Menyimpan..." : "Simpan Produk"}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full"
                  onClick={handleCancel}
                  disabled={isSubmitting}
                >
                  <X className="mr-2 h-4 w-4" />
                  Batal
                </Button>
              </CardContent>
            </Card>

            {/* Help Tips */}
            <Card>
              <CardHeader>
                <CardTitle>Tips</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>• Gunakan kode produk yang unik dan mudah diingat</p>
                <p>• Set stok minimum untuk menghindari kehabisan stok</p>
                <p>• Titik pemesanan ulang sebaiknya di atas stok minimum</p>
                <p>• Margin keuntungan yang wajar adalah 20-50%</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  )
}