"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Calculator, Plus, Save, Trash2, User, FileText,
  CalendarDays, StickyNote, Loader2
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

interface SalesOrderFormProps {
  quotationId?: string
  initialCustomerId?: string
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

export function SalesOrderForm({ quotationId, initialCustomerId }: SalesOrderFormProps) {
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
        } else if (initialCustomerId) {
          const selectedCustomer = incomingCustomers.find((customer) => customer.id === initialCustomerId)
          if (selectedCustomer) {
            setForm((current) => ({
              ...current,
              customerId: selectedCustomer.id,
              paymentTerm: selectedCustomer.paymentTerm || current.paymentTerm,
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
  }, [quotationId, initialCustomerId])

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
    <form onSubmit={onSubmit} className="space-y-3">
      {/* ================================================================== */}
      {/* SECTION 1 — Customer & Quotation                                   */}
      {/* ================================================================== */}
      <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="bg-amber-50 dark:bg-amber-950/20 px-5 py-2.5 border-b-2 border-black flex items-center gap-2 border-l-[5px] border-l-amber-400">
          <User className="h-4 w-4 text-amber-600" />
          <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-200">Customer & Quotation</h3>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Customer *</Label>
              <Select value={form.customerId} onValueChange={onCustomerChange} disabled={loadingOptions}>
                <SelectTrigger className="border-2 border-black h-10 font-medium">
                  <SelectValue placeholder="Pilih customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      <span className="font-mono text-xs text-zinc-400 mr-1">{customer.code}</span> {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Quotation (Opsional)</Label>
              <Select value={form.quotationId || "none"} onValueChange={onQuotationChange} disabled={loadingOptions}>
                <SelectTrigger className="border-2 border-black h-10 font-medium">
                  <SelectValue placeholder="Tanpa quotation" />
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

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Referensi Customer</Label>
              <Input
                value={form.customerRef}
                onChange={(event) => updateForm("customerRef", event.target.value)}
                placeholder="Nomor PO / referensi customer"
                className="border-2 border-black h-10 font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Term Pembayaran</Label>
              <Select value={form.paymentTerm} onValueChange={(value) => updateForm("paymentTerm", value)}>
                <SelectTrigger className="border-2 border-black h-10 font-medium">
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
          </div>

          {selectedCustomer && (
            <div className="mt-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-700 px-4 py-2.5 flex items-center gap-2">
              <User className="h-4 w-4 text-amber-600" />
              <span className="text-xs font-bold text-amber-900 dark:text-amber-300">
                {selectedCustomer.code} — {selectedCustomer.name}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ================================================================== */}
      {/* SECTION 2 — Tanggal & Pengiriman                                   */}
      {/* ================================================================== */}
      <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="bg-amber-50 dark:bg-amber-950/20 px-5 py-2.5 border-b-2 border-black flex items-center gap-2 border-l-[5px] border-l-amber-400">
          <CalendarDays className="h-4 w-4 text-amber-600" />
          <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-200">Tanggal & Pengiriman</h3>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Tanggal Pesanan</Label>
              <Input
                type="date"
                value={form.orderDate}
                onChange={(event) => updateForm("orderDate", event.target.value)}
                className="border-2 border-black h-10 font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Tanggal Diminta</Label>
              <Input
                type="date"
                value={form.requestedDate}
                onChange={(event) => updateForm("requestedDate", event.target.value)}
                className="border-2 border-black h-10 font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Delivery Term</Label>
              <Input
                value={form.deliveryTerm}
                onChange={(event) => updateForm("deliveryTerm", event.target.value)}
                placeholder="Ex-work / FOB / CIF"
                className="border-2 border-black h-10 font-medium"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* SECTION 3 — Item Pesanan                                           */}
      {/* ================================================================== */}
      <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="bg-amber-50 dark:bg-amber-950/20 px-5 py-2.5 border-b-2 border-black flex items-center justify-between border-l-[5px] border-l-amber-400">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-amber-600" />
            <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-200">Item Pesanan</h3>
            <span className="bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 min-w-[20px] text-center rounded-sm">
              {items.length}
            </span>
          </div>
          <Button
            type="button"
            onClick={addItem}
            className="bg-amber-500 text-white hover:bg-amber-600 border-2 border-amber-600 text-[10px] font-black uppercase tracking-wide h-8 px-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)] active:shadow-none active:translate-y-[1px] transition-all"
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Tambah
          </Button>
        </div>

        <div className="divide-y divide-zinc-200 dark:divide-zinc-700">
          {items.map((item, index) => {
            const lineSubtotal = item.quantity * item.unitPrice
            const lineDiscount = lineSubtotal * (item.discount / 100)
            const afterDiscount = lineSubtotal - lineDiscount
            const lineTax = afterDiscount * (item.taxRate / 100)
            const lineTotal = afterDiscount + lineTax

            return (
              <div key={index} className={`p-4 ${index % 2 === 0 ? "bg-white dark:bg-zinc-900" : "bg-zinc-50/50 dark:bg-zinc-800/30"}`}>
                {/* Row 1: Product + Delete */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex-none w-7 h-7 bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 flex items-center justify-center text-xs font-black rounded-sm">
                    {index + 1}
                  </div>
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Produk</Label>
                      <Select
                        value={item.productId || "none"}
                        onValueChange={(value) => onProductChange(index, value === "none" ? "" : value)}
                      >
                        <SelectTrigger className="border-2 border-black h-10 font-medium">
                          <SelectValue placeholder="Pilih produk" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Pilih produk</SelectItem>
                          {products.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              <span className="font-mono text-xs text-zinc-400 mr-1">{product.code}</span> {product.name}
                              <span className="text-zinc-400 ml-1">({product.unit})</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(index)}
                        disabled={items.length === 1}
                        className="h-10 w-10 border border-red-200 text-red-400 hover:bg-red-50 hover:text-red-600 hover:border-red-300 disabled:opacity-30 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Row 2: Description */}
                <div className="ml-10 mb-3">
                  <Input
                    value={item.description}
                    onChange={(event) => updateItem(index, { description: event.target.value })}
                    placeholder="Deskripsi item"
                    className="border border-zinc-300 dark:border-zinc-600 h-9 text-sm"
                  />
                </div>

                {/* Row 3: Qty, Price, Disc, Tax, Total */}
                <div className="ml-10 grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Qty</Label>
                    <Input
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={item.quantity}
                      onChange={(event) => updateItem(index, { quantity: Number(event.target.value || 0) })}
                      className="border-2 border-black h-10 font-bold text-center"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Harga</Label>
                    <Input
                      type="number"
                      min="0"
                      value={item.unitPrice}
                      onChange={(event) => updateItem(index, { unitPrice: Number(event.target.value || 0) })}
                      className="border-2 border-black h-10 font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Diskon %</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={item.discount}
                      onChange={(event) => updateItem(index, { discount: Number(event.target.value || 0) })}
                      className="border border-zinc-300 dark:border-zinc-600 h-10 text-center"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">PPN %</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={item.taxRate}
                      onChange={(event) => updateItem(index, { taxRate: Number(event.target.value || 0) })}
                      className="border border-zinc-300 dark:border-zinc-600 h-10 text-center"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Total</Label>
                    <div className="h-10 bg-amber-50 dark:bg-amber-950/20 border-2 border-amber-300 dark:border-amber-700 flex items-center justify-end px-3 font-black text-sm font-mono text-amber-900 dark:text-amber-200">
                      {formatCurrency(lineTotal)}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ================================================================== */}
      {/* SECTION 4 — Catatan                                                */}
      {/* ================================================================== */}
      <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="bg-amber-50 dark:bg-amber-950/20 px-5 py-2.5 border-b-2 border-black flex items-center gap-2 border-l-[5px] border-l-amber-400">
          <StickyNote className="h-4 w-4 text-amber-600" />
          <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-200">Catatan</h3>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Catatan Operasional</Label>
            <Textarea
              value={form.notes}
              onChange={(event) => updateForm("notes", event.target.value)}
              placeholder="Catatan untuk operasional & pengiriman"
              className="border-2 border-black min-h-[80px] resize-none"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Catatan Internal</Label>
            <Textarea
              value={form.internalNotes}
              onChange={(event) => updateForm("internalNotes", event.target.value)}
              placeholder="Catatan internal tim sales"
              className="border-2 border-black min-h-[80px] resize-none"
            />
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* SECTION 5 — Ringkasan & Submit                                     */}
      {/* ================================================================== */}
      <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="bg-amber-50 dark:bg-amber-950/20 px-5 py-2.5 border-b-2 border-black flex items-center gap-2 border-l-[5px] border-l-amber-400">
          <FileText className="h-4 w-4 text-amber-600" />
          <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-200">Ringkasan Pesanan</h3>
        </div>
        <div className="p-5">
          <div className="max-w-md ml-auto space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Subtotal</span>
              <span className="font-mono font-bold">{formatCurrency(totals.subtotal)}</span>
            </div>
            {totals.discount > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-[10px] font-black uppercase tracking-widest text-red-500">Diskon</span>
                <span className="font-mono font-bold text-red-600">- {formatCurrency(totals.discount)}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">PPN</span>
              <span className="font-mono font-bold">{formatCurrency(totals.tax)}</span>
            </div>
            <div className="border-t-2 border-amber-300 dark:border-amber-700 pt-3 flex items-center justify-between">
              <span className="text-sm font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-200">Grand Total</span>
              <span className="text-2xl font-black font-mono text-amber-700 dark:text-amber-300">
                {formatCurrency(totals.total)}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 mt-6 pt-5 border-t border-zinc-200 dark:border-zinc-700">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/sales/orders")}
              className="border-2 border-zinc-300 dark:border-zinc-600 font-bold uppercase text-xs tracking-wide h-11 px-6 hover:border-zinc-500 transition-colors"
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={submitting || loadingOptions}
              className="bg-amber-500 text-white hover:bg-amber-600 border-2 border-amber-600 font-black uppercase text-xs tracking-wide h-11 px-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)] transition-all active:scale-[0.98]"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" /> Simpan Sales Order
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </form>
  )
}
