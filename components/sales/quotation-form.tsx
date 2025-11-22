"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  Plus, 
  Trash2, 
  Search, 
  Calculator,
  Building2,
  Package,
  Calendar,
  User,
  FileText
} from "lucide-react"
import { toast } from "sonner"

// Quotation schema validation
const quotationSchema = z.object({
  customerId: z.string().min(1, "Customer harus dipilih"),
  customerRef: z.string().optional(),
  quotationDate: z.string().min(1, "Tanggal quotation harus diisi"),
  validUntil: z.string().min(1, "Valid until harus diisi"),
  salesPersonId: z.string().min(1, "Sales person harus dipilih"),
  notes: z.string().optional(),
  terms: z.string().optional(),
  items: z.array(z.object({
    productId: z.string().min(1, "Produk harus dipilih"),
    productName: z.string(),
    description: z.string().optional(),
    quantity: z.number().min(1, "Quantity minimal 1"),
    unit: z.string(),
    unitPrice: z.number().min(0, "Harga unit tidak valid"),
    discount: z.number().min(0).max(100, "Discount maksimal 100%"),
    total: z.number()
  })).min(1, "Minimal harus ada 1 item")
})

type QuotationFormData = z.infer<typeof quotationSchema>

// Mock data untuk dropdown
const mockCustomers = [
  { id: "1", name: "PT. Maju Bersama", type: "Perusahaan" },
  { id: "2", name: "CV. Sukses Mandiri", type: "Perusahaan" },
  { id: "3", name: "PT. Berkah Jaya", type: "Perusahaan" },
  { id: "4", name: "UD. Sumber Rejeki", type: "Usaha Dagang" },
  { id: "5", name: "PT. Cahaya Terang", type: "Perusahaan" }
]

const mockSalesPersons = [
  { id: "1", name: "Ahmad Setiawan" },
  { id: "2", name: "Siti Rahmawati" },
  { id: "3", name: "Budi Prasetyo" },
  { id: "4", name: "Rina Wulandari" }
]

const mockProducts = [
  { id: "1", name: "Laptop Dell Inspiron 15", sku: "LAPTOP-001", price: 8500000, unit: "pcs" },
  { id: "2", name: "Mouse Wireless Logitech", sku: "MOUSE-001", price: 250000, unit: "pcs" },
  { id: "3", name: "Printer Canon Pixma", sku: "PRINTER-001", price: 1200000, unit: "pcs" },
  { id: "4", name: "Monitor Samsung 24 inch", sku: "MONITOR-001", price: 2800000, unit: "pcs" },
  { id: "5", name: "Keyboard Mechanical", sku: "KEYBOARD-001", price: 850000, unit: "pcs" }
]

interface QuotationItem {
  productId: string
  productName: string
  description?: string
  quantity: number
  unit: string
  unitPrice: number
  discount: number
  total: number
}

// Format currency
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

export function QuotationForm() {
  const [quotationItems, setQuotationItems] = useState<QuotationItem[]>([])
  const [showProductSearch, setShowProductSearch] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset
  } = useForm<QuotationFormData>({
    resolver: zodResolver(quotationSchema),
    defaultValues: {
      quotationDate: new Date().toISOString().split('T')[0],
      validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2 weeks from now
      items: []
    }
  })

  // Add product to quotation
  const addProduct = (product: typeof mockProducts[0]) => {
    const newItem: QuotationItem = {
      productId: product.id,
      productName: product.name,
      description: "",
      quantity: 1,
      unit: product.unit,
      unitPrice: product.price,
      discount: 0,
      total: product.price
    }
    
    setQuotationItems([...quotationItems, newItem])
    setShowProductSearch(false)
  }

  // Remove product from quotation
  const removeProduct = (index: number) => {
    const updatedItems = quotationItems.filter((_, i) => i !== index)
    setQuotationItems(updatedItems)
  }

  // Update quotation item
  const updateQuotationItem = (index: number, field: keyof QuotationItem, value: any) => {
    const updatedItems = [...quotationItems]
    updatedItems[index] = { ...updatedItems[index], [field]: value }
    
    // Recalculate total when quantity, unit price, or discount changes
    if (field === 'quantity' || field === 'unitPrice' || field === 'discount') {
      const item = updatedItems[index]
      const subtotal = item.quantity * item.unitPrice
      const discountAmount = (subtotal * item.discount) / 100
      updatedItems[index].total = subtotal - discountAmount
    }
    
    setQuotationItems(updatedItems)
  }

  // Calculate totals
  const calculateTotals = () => {
    const subtotal = quotationItems.reduce((sum, item) => sum + item.total, 0)
    const totalDiscount = quotationItems.reduce((sum, item) => {
      const itemSubtotal = item.quantity * item.unitPrice
      return sum + ((itemSubtotal * item.discount) / 100)
    }, 0)
    const taxAmount = subtotal * 0.11 // PPN 11%
    const grandTotal = subtotal + taxAmount
    
    return {
      subtotal,
      totalDiscount,
      taxAmount,
      grandTotal
    }
  }

  const totals = calculateTotals()

  const onSubmit = (data: QuotationFormData) => {
    const quotationData = {
      ...data,
      items: quotationItems,
      totals
    }
    
    console.log("Quotation Data:", quotationData)
    toast.success("Quotation berhasil dibuat!", {
      description: "Data quotation akan diproses dan disimpan ke database."
    })
    
    // Reset form
    reset()
    setQuotationItems([])
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Header Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Informasi Quotation</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {/* Customer */}
          <div className="space-y-2">
            <Label htmlFor="customerId" className="flex items-center space-x-2">
              <Building2 className="h-4 w-4" />
              <span>Customer *</span>
            </Label>
            <Select onValueChange={(value) => setValue("customerId", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih customer..." />
              </SelectTrigger>
              <SelectContent>
                {mockCustomers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    <div className="flex flex-col">
                      <span>{customer.name}</span>
                      <span className="text-xs text-muted-foreground">{customer.type}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.customerId && (
              <p className="text-sm text-red-500">{errors.customerId.message}</p>
            )}
          </div>

          {/* Customer Reference */}
          <div className="space-y-2">
            <Label htmlFor="customerRef">Referensi Customer</Label>
            <Input
              id="customerRef"
              placeholder="Nomor PO/Request customer..."
              {...register("customerRef")}
            />
          </div>

          {/* Quotation Date */}
          <div className="space-y-2">
            <Label htmlFor="quotationDate" className="flex items-center space-x-2">
              <Calendar className="h-4 w-4" />
              <span>Tanggal Quotation *</span>
            </Label>
            <Input
              id="quotationDate"
              type="date"
              {...register("quotationDate")}
            />
            {errors.quotationDate && (
              <p className="text-sm text-red-500">{errors.quotationDate.message}</p>
            )}
          </div>

          {/* Valid Until */}
          <div className="space-y-2">
            <Label htmlFor="validUntil">Valid Sampai *</Label>
            <Input
              id="validUntil"
              type="date"
              {...register("validUntil")}
            />
            {errors.validUntil && (
              <p className="text-sm text-red-500">{errors.validUntil.message}</p>
            )}
          </div>

          {/* Sales Person */}
          <div className="space-y-2">
            <Label htmlFor="salesPersonId" className="flex items-center space-x-2">
              <User className="h-4 w-4" />
              <span>Sales Person *</span>
            </Label>
            <Select onValueChange={(value) => setValue("salesPersonId", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih sales person..." />
              </SelectTrigger>
              <SelectContent>
                {mockSalesPersons.map((sales) => (
                  <SelectItem key={sales.id} value={sales.id}>
                    {sales.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.salesPersonId && (
              <p className="text-sm text-red-500">{errors.salesPersonId.message}</p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Catatan</Label>
            <Textarea
              id="notes"
              placeholder="Catatan internal untuk quotation..."
              {...register("notes")}
            />
          </div>
        </CardContent>
      </Card>

      {/* Products Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Package className="h-5 w-5" />
              <span>Produk Quotation</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowProductSearch(!showProductSearch)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Tambah Produk
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Product Search */}
          {showProductSearch && (
            <Card className="mb-4">
              <CardHeader>
                <CardTitle className="text-sm">Pilih Produk</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2">
                  {mockProducts.map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between p-2 border rounded-lg hover:bg-gray-50 cursor-pointer"
                      onClick={() => addProduct(product)}
                    >
                      <div>
                        <div className="font-medium">{product.name}</div>
                        <div className="text-sm text-muted-foreground">SKU: {product.sku}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{formatCurrency(product.price)}</div>
                        <div className="text-sm text-muted-foreground">per {product.unit}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quotation Items Table */}
          {quotationItems.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produk</TableHead>
                    <TableHead className="text-center w-20">Qty</TableHead>
                    <TableHead className="text-center w-32">Harga Unit</TableHead>
                    <TableHead className="text-center w-20">Disc %</TableHead>
                    <TableHead className="text-center w-32">Total</TableHead>
                    <TableHead className="text-center w-16">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotationItems.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{item.productName}</div>
                          <Input
                            placeholder="Deskripsi tambahan..."
                            value={item.description || ""}
                            onChange={(e) => updateQuotationItem(index, "description", e.target.value)}
                            className="mt-1 text-xs"
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateQuotationItem(index, "quantity", parseInt(e.target.value) || 0)}
                          className="text-center"
                          min="1"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => updateQuotationItem(index, "unitPrice", parseInt(e.target.value) || 0)}
                          className="text-right"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={item.discount}
                          onChange={(e) => updateQuotationItem(index, "discount", parseInt(e.target.value) || 0)}
                          className="text-center"
                          min="0"
                          max="100"
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(item.total)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeProduct(index)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Belum ada produk dipilih. Klik "Tambah Produk" untuk memulai.
            </div>
          )}

          {errors.items && (
            <p className="text-sm text-red-500 mt-2">{errors.items.message}</p>
          )}
        </CardContent>
      </Card>

      {/* Summary */}
      {quotationItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calculator className="h-5 w-5" />
              <span>Ringkasan</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
              </div>
              {totals.totalDiscount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Total Diskon:</span>
                  <span>-{formatCurrency(totals.totalDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>PPN (11%):</span>
                <span className="font-medium">{formatCurrency(totals.taxAmount)}</span>
              </div>
              <hr />
              <div className="flex justify-between text-lg font-bold">
                <span>Grand Total:</span>
                <span>{formatCurrency(totals.grandTotal)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Terms & Conditions */}
      <Card>
        <CardHeader>
          <CardTitle>Syarat & Ketentuan</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Masukkan syarat dan ketentuan quotation..."
            {...register("terms")}
            rows={4}
          />
        </CardContent>
      </Card>

      {/* Submit Buttons */}
      <div className="flex justify-end space-x-4">
        <Button type="button" variant="outline">
          Simpan sebagai Draft
        </Button>
        <Button type="submit" disabled={quotationItems.length === 0}>
          Buat Quotation
        </Button>
      </div>
    </form>
  )
}