"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Calculator, Plus, Save, ShoppingCart, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"

interface SalesOrderFormProps {
  quotationId?: string
}

interface CustomerOption {
  id: string
  code: string
  name: string
  paymentTerm: string
}

interface ProductOption {
  id: string
  code: string
  name: string
  unit: string
  sellingPrice: number
}

interface QuotationOption {
  id: string
  number: string
  customerId: string
  total: number
  status: string
}

interface SalesOptionsResponse {
  success: boolean
  data?: {
    customers?: CustomerOption[]
    products?: ProductOption[]
    quotations?: QuotationOption[]
  }
  error?: string
}

interface OrderLine {
  productId: string
  description: string
  quantity: number
  unitPrice: number
  discount: number
  taxRate: number
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function SalesOrderForm({ quotationId }: SalesOrderFormProps) {
  const router = useRouter()

  const [loadingOptions, setLoadingOptions] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [products, setProducts] = useState<ProductOption[]>([])
  const [quotations, setQuotations] = useState<QuotationOption[]>([])

  const [form, setForm] = useState({
    customerId: "",
    quotationId: quotationId || "",
    customerRef: "",
    orderDate: new Date().toISOString().slice(0, 10),
    requestedDate: "",
    paymentTerm: "NET_30",
    deliveryTerm: "",
    notes: "",
    internalNotes: "",
  })

  const [items, setItems] = useState<OrderLine[]>([
    {
      productId: "",
      description: "",
      quantity: 1,
      unitPrice: 0,
      discount: 0,
      taxRate: 11,
    },
  ])

  useEffect(() => {
    const loadOptions = async () => {
      setLoadingOptions(true)
      try {
        const response = await fetch("/api/sales/options", {
          cache: "no-store",
        })

        const payload: SalesOptionsResponse = await response.json()
        if (!payload.success || !payload.data) {
          throw new Error(payload.error || "Gagal memuat opsi sales order")
        }

        const incomingCustomers = payload.data.customers || []
        const incomingProducts = payload.data.products || []
        const incomingQuotations = payload.data.quotations || []

        setCustomers(incomingCustomers)
        setProducts(incomingProducts)
        setQuotations(incomingQuotations)

        if (quotationId) {
          const selectedQuote = incomingQuotations.find((quote) => quote.id === quotationId)
          if (selectedQuote) {
            const selectedCustomer = incomingCustomers.find((customer) => customer.id === selectedQuote.customerId)
            setForm((current) => ({
              ...current,
              quotationId: selectedQuote.id,
              customerId: selectedQuote.customerId,
              paymentTerm: selectedCustomer?.paymentTerm || current.paymentTerm,
            }))
          }
        }
      } catch (error: any) {
        toast.error(error?.message || "Gagal memuat opsi sales order")
      } finally {
        setLoadingOptions(false)
      }
    }

    loadOptions()
  }, [quotationId])

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === form.customerId),
    [customers, form.customerId]
  )

  const availableQuotations = useMemo(() => {
    if (!form.customerId) return quotations
    return quotations.filter((quote) => quote.customerId === form.customerId)
  }, [form.customerId, quotations])

  const totals = useMemo(() => {
    return items.reduce((acc, item) => {
      const quantity = Number(item.quantity || 0)
      const unitPrice = Number(item.unitPrice || 0)
      const discount = Number(item.discount || 0)
      const taxRate = Number(item.taxRate || 0)

      const lineSubtotal = quantity * unitPrice
      const lineDiscount = lineSubtotal * (discount / 100)
      const afterDiscount = lineSubtotal - lineDiscount
      const lineTax = afterDiscount * (taxRate / 100)
      const lineTotal = afterDiscount + lineTax

      return {
        subtotal: acc.subtotal + lineSubtotal,
        discount: acc.discount + lineDiscount,
        tax: acc.tax + lineTax,
        total: acc.total + lineTotal,
      }
    }, {
      subtotal: 0,
      discount: 0,
      tax: 0,
      total: 0,
    })
  }, [items])

  const updateForm = (key: keyof typeof form, value: string) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }))
  }

  const onCustomerChange = (customerId: string) => {
    const customer = customers.find((item) => item.id === customerId)
    setForm((current) => ({
      ...current,
      customerId,
      quotationId: "",
      paymentTerm: customer?.paymentTerm || current.paymentTerm,
    }))
  }

  const onQuotationChange = (newQuotationId: string) => {
    if (newQuotationId === "none") {
      setForm((current) => ({
        ...current,
        quotationId: "",
      }))
      return
    }

    const quote = quotations.find((item) => item.id === newQuotationId)
    if (!quote) return

    const customer = customers.find((item) => item.id === quote.customerId)
    setForm((current) => ({
      ...current,
      quotationId: quote.id,
      customerId: quote.customerId,
      paymentTerm: customer?.paymentTerm || current.paymentTerm,
    }))
  }

  const updateItem = (index: number, patch: Partial<OrderLine>) => {
    setItems((current) => current.map((item, itemIndex) => (
      itemIndex === index
        ? {
            ...item,
            ...patch,
          }
        : item
    )))
  }

  const onProductChange = (index: number, productId: string) => {
    const product = products.find((item) => item.id === productId)
    if (!product) return

    updateItem(index, {
      productId,
      description: product.name,
      unitPrice: product.sellingPrice,
    })
  }

  const addItem = () => {
    setItems((current) => [
      ...current,
      {
        productId: "",
        description: "",
        quantity: 1,
        unitPrice: 0,
        discount: 0,
        taxRate: 11,
      },
    ])
  }

  const removeItem = (index: number) => {
    setItems((current) => (current.length === 1 ? current : current.filter((_, itemIndex) => itemIndex !== index)))
  }

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!form.customerId) {
      toast.error("Customer wajib dipilih")
      return
    }

    const validItems = items.filter((item) => item.productId && Number(item.quantity) > 0)
    if (validItems.length === 0) {
      toast.error("Minimal satu item pesanan wajib diisi")
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch("/api/sales/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          salesOrder: {
            customerId: form.customerId,
            quotationId: form.quotationId || undefined,
            customerRef: form.customerRef || undefined,
            orderDate: form.orderDate,
            requestedDate: form.requestedDate || undefined,
            paymentTerm: form.paymentTerm,
            deliveryTerm: form.deliveryTerm || undefined,
            notes: form.notes || undefined,
            internalNotes: form.internalNotes || undefined,
          },
          items: validItems,
        }),
      })

      const payload = await response.json()
      if (!payload.success) {
        throw new Error(payload.error || "Gagal membuat sales order")
      }

      toast.success(`Sales order ${payload.data?.number || "baru"} berhasil dibuat`)
      router.push("/sales/orders")
    } catch (error: any) {
      toast.error(error?.message || "Gagal membuat sales order")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Informasi Pesanan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Customer *</Label>
              <Select value={form.customerId} onValueChange={onCustomerChange} disabled={loadingOptions}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.code} - {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Quotation (Opsional)</Label>
              <Select value={form.quotationId || "none"} onValueChange={onQuotationChange} disabled={loadingOptions}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih quotation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tanpa quotation</SelectItem>
                  {availableQuotations.map((quotation) => (
                    <SelectItem key={quotation.id} value={quotation.id}>
                      {quotation.number} ({quotation.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Referensi Customer</Label>
              <Input
                value={form.customerRef}
                onChange={(event) => updateForm("customerRef", event.target.value)}
                placeholder="Nomor PO / referensi customer"
              />
            </div>

            <div className="space-y-2">
              <Label>Term Pembayaran</Label>
              <Select value={form.paymentTerm} onValueChange={(value) => updateForm("paymentTerm", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="NET_15">NET 15</SelectItem>
                  <SelectItem value="NET_30">NET 30</SelectItem>
                  <SelectItem value="NET_45">NET 45</SelectItem>
                  <SelectItem value="NET_60">NET 60</SelectItem>
                  <SelectItem value="NET_90">NET 90</SelectItem>
                  <SelectItem value="COD">COD</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tanggal Pesanan</Label>
              <Input
                type="date"
                value={form.orderDate}
                onChange={(event) => updateForm("orderDate", event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Tanggal Diminta</Label>
              <Input
                type="date"
                value={form.requestedDate}
                onChange={(event) => updateForm("requestedDate", event.target.value)}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Delivery Term</Label>
              <Input
                value={form.deliveryTerm}
                onChange={(event) => updateForm("deliveryTerm", event.target.value)}
                placeholder="Contoh: Ex-work / FOB"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Catatan</Label>
              <Textarea
                value={form.notes}
                onChange={(event) => updateForm("notes", event.target.value)}
                placeholder="Catatan untuk operasional"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Catatan Internal</Label>
              <Textarea
                value={form.internalNotes}
                onChange={(event) => updateForm("internalNotes", event.target.value)}
                placeholder="Catatan internal tim sales"
              />
            </div>
          </div>

          {selectedCustomer && (
            <p className="text-xs text-muted-foreground">
              Customer terpilih: <span className="font-semibold">{selectedCustomer.code} - {selectedCustomer.name}</span>
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2"><Calculator className="h-5 w-5" /> Item Pesanan</span>
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              <Plus className="mr-2 h-4 w-4" /> Tambah Item
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[260px]">Produk</TableHead>
                  <TableHead className="w-24">Qty</TableHead>
                  <TableHead className="w-44">Harga</TableHead>
                  <TableHead className="w-24">Disc %</TableHead>
                  <TableHead className="w-24">Tax %</TableHead>
                  <TableHead className="w-40 text-right">Total</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, index) => {
                  const lineSubtotal = item.quantity * item.unitPrice
                  const lineDiscount = lineSubtotal * (item.discount / 100)
                  const afterDiscount = lineSubtotal - lineDiscount
                  const lineTax = afterDiscount * (item.taxRate / 100)
                  const lineTotal = afterDiscount + lineTax

                  return (
                    <TableRow key={index}>
                      <TableCell className="space-y-2">
                        <Select
                          value={item.productId || "none"}
                          onValueChange={(value) => onProductChange(index, value === "none" ? "" : value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih produk" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Pilih produk</SelectItem>
                            {products.map((product) => (
                              <SelectItem key={product.id} value={product.id}>
                                {product.code} - {product.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          value={item.description}
                          onChange={(event) => updateItem(index, { description: event.target.value })}
                          placeholder="Deskripsi item"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0.001"
                          step="0.001"
                          value={item.quantity}
                          onChange={(event) => updateItem(index, { quantity: Number(event.target.value || 0) })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          value={item.unitPrice}
                          onChange={(event) => updateItem(index, { unitPrice: Number(event.target.value || 0) })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={item.discount}
                          onChange={(event) => updateItem(index, { discount: Number(event.target.value || 0) })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={item.taxRate}
                          onChange={(event) => updateItem(index, { taxRate: Number(event.target.value || 0) })}
                        />
                      </TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(lineTotal)}</TableCell>
                      <TableCell>
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="max-w-sm ml-auto space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span>Subtotal</span>
              <span>{formatCurrency(totals.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Diskon</span>
              <span>- {formatCurrency(totals.discount)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Pajak</span>
              <span>{formatCurrency(totals.tax)}</span>
            </div>
            <div className="flex items-center justify-between border-t pt-2 text-lg font-black">
              <span>Total</span>
              <span>{formatCurrency(totals.total)}</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 mt-6">
            <Button type="button" variant="outline" onClick={() => router.push("/sales/orders")}>Batal</Button>
            <Button type="submit" disabled={submitting || loadingOptions}>
              <Save className="mr-2 h-4 w-4" />
              {submitting ? "Menyimpan..." : "Simpan Sales Order"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
