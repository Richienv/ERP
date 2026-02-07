"use client"

import { useState, useEffect } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { createCompleteSalesOrderSchema, type CreateCompleteSalesOrderInput } from "@/lib/validations"
import { Save, X, Plus, Trash2, Calculator, ShoppingCart } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// Mock data
const mockCustomers = [
  { id: "1", name: "PT. Maju Bersama", code: "CUST-001" },
  { id: "2", name: "CV. Sukses Mandiri", code: "CUST-002" },
  { id: "3", name: "Toko Elektronik Jaya", code: "CUST-003" },
  { id: "4", name: "PT. Teknologi Canggih", code: "CUST-004" },
]

const mockProducts = [
  { id: "1", name: "Laptop Dell XPS 13", code: "PROD-001", unitPrice: 15000000, stock: 10 },
  { id: "2", name: "Printer Canon Pixma", code: "PROD-002", unitPrice: 2500000, stock: 25 },
  { id: "3", name: "Monitor LG 24 inch", code: "PROD-003", unitPrice: 3200000, stock: 15 },
  { id: "4", name: "Keyboard Logitech MX", code: "PROD-004", unitPrice: 1200000, stock: 30 },
  { id: "5", name: "Mouse Wireless", code: "PROD-005", unitPrice: 350000, stock: 50 },
]

const mockQuotations = [
  { id: "1", number: "QT-2024-001", customerId: "1" },
  { id: "2", number: "QT-2024-002", customerId: "2" },
  { id: "3", number: "QT-2024-003", customerId: "3" },
]

interface SalesOrderFormProps {
  quotationId?: string
}

export function SalesOrderForm({ quotationId }: SalesOrderFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<typeof mockCustomers[0] | null>(null)

  const form = useForm<CreateCompleteSalesOrderInput>({
    resolver: zodResolver(createCompleteSalesOrderSchema),
    defaultValues: {
      salesOrder: {
        customerId: "",
        quotationId: quotationId || undefined,
        customerRef: "",
        orderDate: new Date(),
        requestedDate: undefined,
        paymentTerm: "NET_30",
        deliveryTerm: "",
        notes: "",
        internalNotes: "",
      },
      items: [
        {
          productId: "",
          description: "",
          quantity: 1,
          unitPrice: 0,
          discount: 0,
          taxRate: 11,
        },
      ],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  })

  const watchedItems = form.watch("items")

  // Calculate totals
  const calculateLineTotal = (quantity: number, unitPrice: number, discount: number = 0, taxRate: number = 11) => {
    const subtotal = quantity * unitPrice
    const discountAmount = subtotal * (discount / 100)
    const afterDiscount = subtotal - discountAmount
    const taxAmount = afterDiscount * (taxRate / 100)
    return afterDiscount + taxAmount
  }

  const orderTotals = watchedItems.reduce((totals, item) => {
    const lineTotal = calculateLineTotal(item.quantity, item.unitPrice, item.discount, item.taxRate)
    const subtotal = item.quantity * item.unitPrice
    const discountAmount = subtotal * (item.discount / 100)
    const afterDiscount = subtotal - discountAmount
    const taxAmount = afterDiscount * (item.taxRate / 100)

    return {
      subtotal: totals.subtotal + subtotal,
      discountAmount: totals.discountAmount + discountAmount,
      taxAmount: totals.taxAmount + taxAmount,
      total: totals.total + lineTotal,
    }
  }, { subtotal: 0, discountAmount: 0, taxAmount: 0, total: 0 })

  async function onSubmit(values: CreateCompleteSalesOrderInput) {
    setIsLoading(true)
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500))
      
      console.log("Sales Order Data:", values)
      console.log("Calculated Totals:", orderTotals)
      
      toast.success("Pesanan berhasil dibuat!")
      
      // Reset form or redirect
      form.reset()
    } catch (error) {
      toast.error("Gagal membuat pesanan. Silakan coba lagi.")
      console.error("Error creating sales order:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleProductSelect = (index: number, productId: string) => {
    const product = mockProducts.find(p => p.id === productId)
    if (product) {
      form.setValue(`items.${index}.productId`, productId)
      form.setValue(`items.${index}.unitPrice`, product.unitPrice)
      form.setValue(`items.${index}.description`, product.name)
    }
  }

  const handleCustomerSelect = (customerId: string) => {
    const customer = mockCustomers.find(c => c.id === customerId)
    setSelectedCustomer(customer || null)
    form.setValue('salesOrder.customerId', customerId)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Customer Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Informasi Customer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="salesOrder.customerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer *</FormLabel>
                    <Select onValueChange={handleCustomerSelect} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih customer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {mockCustomers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            <div>
                              <div className="font-medium">{customer.name}</div>
                              <div className="text-sm text-muted-foreground">{customer.code}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="salesOrder.quotationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quotation (Opsional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih quotation" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">Tanpa Quotation</SelectItem>
                        {mockQuotations
                          .filter(q => !selectedCustomer || q.customerId === selectedCustomer.id)
                          .map((quotation) => (
                            <SelectItem key={quotation.id} value={quotation.id}>
                              {quotation.number}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="salesOrder.customerRef"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Referensi Customer</FormLabel>
                    <FormControl>
                      <Input placeholder="PO number atau referensi lain" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="salesOrder.paymentTerm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Termin Pembayaran</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="CASH">Tunai</SelectItem>
                        <SelectItem value="NET_15">NET 15 Hari</SelectItem>
                        <SelectItem value="NET_30">NET 30 Hari</SelectItem>
                        <SelectItem value="NET_45">NET 45 Hari</SelectItem>
                        <SelectItem value="NET_60">NET 60 Hari</SelectItem>
                        <SelectItem value="NET_90">NET 90 Hari</SelectItem>
                        <SelectItem value="COD">Bayar di Tempat</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="salesOrder.orderDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tanggal Pesanan</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        value={field.value ? field.value.toISOString().split('T')[0] : ''}
                        onChange={(e) => field.onChange(new Date(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="salesOrder.requestedDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tanggal Diminta</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        value={field.value ? field.value.toISOString().split('T')[0] : ''}
                        onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="salesOrder.deliveryTerm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Syarat Pengiriman</FormLabel>
                  <FormControl>
                    <Input placeholder="FOB, CIF, atau syarat lainnya" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Order Items */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Item Pesanan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produk</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Harga Satuan</TableHead>
                  <TableHead>Diskon %</TableHead>
                  <TableHead>Pajak %</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field, index) => (
                  <TableRow key={field.id}>
                    <TableCell className="w-[300px]">
                      <FormField
                        control={form.control}
                        name={`items.${index}.productId`}
                        render={({ field }) => (
                          <FormItem>
                            <Select 
                              onValueChange={(value) => handleProductSelect(index, value)} 
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Pilih produk" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {mockProducts.map((product) => (
                                  <SelectItem key={product.id} value={product.id}>
                                    <div>
                                      <div className="font-medium">{product.name}</div>
                                      <div className="text-sm text-muted-foreground">
                                        {product.code} - Stock: {product.stock}
                                      </div>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`items.${index}.description`}
                        render={({ field }) => (
                          <FormItem className="mt-2">
                            <FormControl>
                              <Input 
                                placeholder="Deskripsi tambahan" 
                                {...field} 
                                className="text-sm"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <FormField
                        control={form.control}
                        name={`items.${index}.quantity`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input 
                                type="number"
                                min="1"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                className="w-20"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <FormField
                        control={form.control}
                        name={`items.${index}.unitPrice`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input 
                                type="number"
                                min="0"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                className="w-32"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <FormField
                        control={form.control}
                        name={`items.${index}.discount`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input 
                                type="number"
                                min="0"
                                max="100"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                className="w-20"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <FormField
                        control={form.control}
                        name={`items.${index}.taxRate`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input 
                                type="number"
                                min="0"
                                max="100"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                className="w-20"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      {new Intl.NumberFormat('id-ID', {
                        style: 'currency',
                        currency: 'IDR',
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0
                      }).format(calculateLineTotal(
                        watchedItems[index]?.quantity || 0,
                        watchedItems[index]?.unitPrice || 0,
                        watchedItems[index]?.discount || 0,
                        watchedItems[index]?.taxRate || 11
                      ))}
                    </TableCell>
                    <TableCell>
                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex justify-between items-center mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => append({
                  productId: "",
                  description: "",
                  quantity: 1,
                  unitPrice: 0,
                  discount: 0,
                  taxRate: 11,
                })}
              >
                <Plus className="mr-2 h-4 w-4" />
                Tambah Item
              </Button>

              <div className="text-right space-y-1">
                <div className="text-sm">
                  Subtotal: {new Intl.NumberFormat('id-ID', {
                    style: 'currency',
                    currency: 'IDR',
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0
                  }).format(orderTotals.subtotal)}
                </div>
                <div className="text-sm">
                  Diskon: {new Intl.NumberFormat('id-ID', {
                    style: 'currency',
                    currency: 'IDR',
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0
                  }).format(orderTotals.discountAmount)}
                </div>
                <div className="text-sm">
                  Pajak: {new Intl.NumberFormat('id-ID', {
                    style: 'currency',
                    currency: 'IDR',
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0
                  }).format(orderTotals.taxAmount)}
                </div>
                <div className="text-lg font-bold">
                  Total: {new Intl.NumberFormat('id-ID', {
                    style: 'currency',
                    currency: 'IDR',
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0
                  }).format(orderTotals.total)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Catatan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="salesOrder.notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Catatan untuk Customer</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Catatan yang akan terlihat di dokumen pesanan"
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="salesOrder.internalNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Catatan Internal</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Catatan internal yang tidak terlihat customer"
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Catatan ini hanya untuk tim internal dan tidak akan tampil di dokumen customer
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-2">
          <Button type="button" variant="outline">
            <X className="mr-2 h-4 w-4" />
            Batal
          </Button>
          <Button type="submit" disabled={isLoading}>
            <Save className="mr-2 h-4 w-4" />
            {isLoading ? "Menyimpan..." : "Simpan Pesanan"}
          </Button>
        </div>
      </form>
    </Form>
  )
}