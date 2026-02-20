"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import {
  AlertTriangle, Calculator, Plus, Save, Trash2, User, FileText,
  CalendarDays, StickyNote, Loader2
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ComboboxWithCreate, type ComboboxOption } from "@/components/ui/combobox-with-create"
import { createCustomerQuick } from "@/lib/actions/master-data"

interface CustomerOption {
  id: string
  code: string
  name: string
  creditLimit?: number
  creditStatus?: string
}

interface ProductOption {
  id: string
  code: string
  name: string
  unit: string
  sellingPrice: number
}

interface UserOption {
  id: string
  name: string | null
  email: string | null
}

interface QuotationLine {
  productId: string
  description: string
  quantity: number
  unitPrice: number
  discount: number
  taxRate: number
}

interface SalesOptionsResponse {
  success: boolean
  data?: {
    customers?: CustomerOption[]
    products?: ProductOption[]
    users?: UserOption[]
  }
  error?: string
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

interface QuotationFormProps {
  initialCustomerId?: string
  initialData?: any
}

export function QuotationForm({ initialCustomerId, initialData }: QuotationFormProps) {
  const router = useRouter()
  const queryClient = useQueryClient()

  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [products, setProducts] = useState<ProductOption[]>([])
  const [salesPersons, setSalesPersons] = useState<UserOption[]>([])
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    customerId: initialData?.customerId || "",
    customerRef: initialData?.customerRef || "",
    quotationDate: initialData?.quotationDate ? new Date(initialData.quotationDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    validUntil: initialData?.validUntil ? new Date(initialData.validUntil).toISOString().slice(0, 10) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    salesPersonId: initialData?.salesPersonId || "",
    paymentTerm: initialData?.paymentTerm || "NET_30",
    deliveryTerm: initialData?.deliveryTerm || "",
    notes: initialData?.notes || "",
  })

  const [lines, setLines] = useState<QuotationLine[]>(() => {
    if (initialData?.items && initialData.items.length > 0) {
      return initialData.items.map((item: any) => ({
        productId: item.productId,
        description: item.description || "",
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        discount: Number(item.discount || 0),
        taxRate: Number(item.taxRate || 11),
      }))
    }
    return [
      {
        productId: "",
        description: "",
        quantity: 1,
        unitPrice: 0,
        discount: 0,
        taxRate: 11,
      },
    ]
  })

  useEffect(() => {
    const loadOptions = async () => {
      setLoadingOptions(true)
      try {
        const response = await fetch("/api/sales/options", { cache: "no-store" })
        const payload: SalesOptionsResponse = await response.json()

        if (!payload.success || !payload.data) {
          throw new Error(payload.error || "Gagal memuat data referensi")
        }

        setCustomers(payload.data.customers || [])
        setProducts(payload.data.products || [])
        setSalesPersons(payload.data.users || [])

        if (initialCustomerId && !initialData) {
          const hasCustomer = (payload.data.customers || []).some((customer) => customer.id === initialCustomerId)
          if (hasCustomer) {
            setForm((current) => ({
              ...current,
              customerId: initialCustomerId,
            }))
          }
        }
      } catch (error: any) {
        toast.error(error?.message || "Gagal memuat data referensi")
      } finally {
        setLoadingOptions(false)
      }
    }

    loadOptions()
  }, [initialCustomerId, initialData])

  const updateForm = (key: keyof typeof form, value: string) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }))
  }

  const updateLine = (index: number, patch: Partial<QuotationLine>) => {
    setLines((current) => current.map((line, lineIndex) => (
      lineIndex === index
        ? {
          ...line,
          ...patch,
        }
        : line
    )))
  }

  const onProductSelect = (index: number, productId: string) => {
    const product = products.find((item) => item.id === productId)
    if (!product) return

    updateLine(index, {
      productId,
      description: product.name,
      unitPrice: product.sellingPrice,
    })
  }

  const addLine = () => {
    setLines((current) => [
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

  const removeLine = (index: number) => {
    setLines((current) => (current.length === 1 ? current : current.filter((_, lineIndex) => lineIndex !== index)))
  }

  const totals = useMemo(() => {
    return lines.reduce((acc, line) => {
      const quantity = Number(line.quantity || 0)
      const unitPrice = Number(line.unitPrice || 0)
      const discount = Number(line.discount || 0)
      const taxRate = Number(line.taxRate || 0)

      const lineSubtotal = quantity * unitPrice
      const lineDiscount = lineSubtotal * (discount / 100)
      const afterDiscount = lineSubtotal - lineDiscount
      const lineTax = afterDiscount * (taxRate / 100)
      const lineTotal = afterDiscount + lineTax

      return {
        subtotal: acc.subtotal + lineSubtotal,
        discount: acc.discount + lineDiscount,
        tax: acc.tax + lineTax,
        grandTotal: acc.grandTotal + lineTotal,
      }
    }, {
      subtotal: 0,
      discount: 0,
      tax: 0,
      grandTotal: 0,
    })
  }, [lines])

  const creditWarning = useMemo(() => {
    if (!form.customerId) return null
    const selected = customers.find(c => c.id === form.customerId)
    if (!selected) return null
    if (selected.creditStatus === 'HOLD' || selected.creditStatus === 'BLOCKED') {
      return { type: 'blocked' as const, message: `Customer ini memiliki status kredit ${selected.creditStatus}. Tidak bisa membuat penawaran.` }
    }
    const limit = selected.creditLimit || 0
    if (limit > 0 && totals.grandTotal > limit) {
      return { type: 'over' as const, message: `Total ${formatCurrency(totals.grandTotal)} melebihi limit kredit ${formatCurrency(limit)}. Penawaran akan ditolak.` }
    }
    if (limit > 0 && totals.grandTotal > limit * 0.8) {
      return { type: 'warn' as const, message: `Total mendekati limit kredit (${formatCurrency(limit)}). Sisa: ${formatCurrency(limit - totals.grandTotal)}.` }
    }
    return null
  }, [form.customerId, customers, totals.grandTotal])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!form.customerId) {
      toast.error("Customer wajib dipilih")
      return
    }

    const validLines = lines.filter((line) => line.productId && Number(line.quantity) > 0)
    if (validLines.length === 0) {
      toast.error("Minimal satu item quotation wajib diisi")
      return
    }

    setSubmitting(true)
    try {
      const isEdit = !!initialData?.id
      const url = isEdit ? `/api/sales/quotations/${initialData.id}` : "/api/sales/quotations"
      const method = isEdit ? "PATCH" : "POST"

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerId: form.customerId,
          customerRef: form.customerRef || undefined,
          quotationDate: form.quotationDate,
          validUntil: form.validUntil,
          paymentTerm: form.paymentTerm,
          deliveryTerm: form.deliveryTerm || undefined,
          notes: form.notes || undefined,
          salesPersonId: form.salesPersonId || undefined,
          items: validLines,
        }),
      })

      const payload = await response.json()
      if (!payload.success) {
        throw new Error(payload.error || `Gagal ${isEdit ? 'memperbarui' : 'membuat'} quotation`)
      }

      toast.success(isEdit ? `Quotation ${initialData.number} berhasil diperbarui` : `Quotation ${payload.data?.number || "baru"} berhasil dibuat`)
      queryClient.invalidateQueries({ queryKey: queryKeys.quotations.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.salesDashboard.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.salesPage.all })
      router.push("/sales/quotations")
    } catch (error: any) {
      toast.error(error?.message || `Gagal ${initialData?.id ? 'memperbarui' : 'membuat'} quotation`)
    } finally {
      setSubmitting(false)
    }
  }


  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* ================================================================== */}
      {/* SECTION 1 — Customer & Info                                        */}
      {/* ================================================================== */}
      <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="bg-blue-50 dark:bg-blue-950/20 px-5 py-2.5 border-b-2 border-black flex items-center gap-2 border-l-[5px] border-l-blue-400">
          <User className="h-4 w-4 text-blue-600" />
          <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-200">Customer & Info</h3>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Customer *</Label>
              <ComboboxWithCreate
                options={customers.map((c) => ({ value: c.id, label: c.name, subtitle: c.code }))}
                value={form.customerId}
                onChange={(value) => updateForm("customerId", value)}
                placeholder="Pilih customer..."
                searchPlaceholder="Cari customer..."
                emptyMessage="Customer tidak ditemukan."
                createLabel="+ Tambah Customer Baru"
                onCreate={async (name) => {
                  const customer = await createCustomerQuick(name)
                  setCustomers((prev) => [...prev, { id: customer.id, code: customer.code, name: customer.name }])
                  queryClient.invalidateQueries({ queryKey: queryKeys.customers.all })
                  queryClient.invalidateQueries({ queryKey: queryKeys.sidebarActions.all })
                  toast.success(`Customer "${name}" berhasil dibuat`)
                  return customer.id
                }}
                isLoading={loadingOptions}
                disabled={loadingOptions}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Referensi Customer</Label>
              <Input
                value={form.customerRef}
                onChange={(event) => updateForm("customerRef", event.target.value)}
                placeholder="Nomor referensi customer"
                className="border-2 border-black h-10 font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Sales Person</Label>
              <Select value={form.salesPersonId || "none"} onValueChange={(value) => updateForm("salesPersonId", value === "none" ? "" : value)}>
                <SelectTrigger className="border-2 border-black h-10 font-medium">
                  <SelectValue placeholder="Pilih sales person" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tanpa sales person</SelectItem>
                  {salesPersons.map((person) => (
                    <SelectItem key={person.id} value={person.id}>
                      {person.name || person.email || person.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
        </div>
      </div>

      {/* ================================================================== */}
      {/* SECTION 2 — Tanggal & Pengiriman                                   */}
      {/* ================================================================== */}
      <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="bg-blue-50 dark:bg-blue-950/20 px-5 py-2.5 border-b-2 border-black flex items-center gap-2 border-l-[5px] border-l-blue-400">
          <CalendarDays className="h-4 w-4 text-blue-600" />
          <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-200">Tanggal & Pengiriman</h3>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Tanggal Quotation</Label>
              <Input
                type="date"
                value={form.quotationDate}
                onChange={(event) => updateForm("quotationDate", event.target.value)}
                className="border-2 border-black h-10 font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Valid Sampai</Label>
              <Input
                type="date"
                value={form.validUntil}
                onChange={(event) => updateForm("validUntil", event.target.value)}
                className="border-2 border-black h-10 font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Delivery Term</Label>
              <Input
                value={form.deliveryTerm}
                onChange={(event) => updateForm("deliveryTerm", event.target.value)}
                placeholder="Ex-warehouse / FOB / CIF"
                className="border-2 border-black h-10 font-medium"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* SECTION 3 — Item Quotation                                         */}
      {/* ================================================================== */}
      <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="bg-blue-50 dark:bg-blue-950/20 px-5 py-2.5 border-b-2 border-black flex items-center justify-between border-l-[5px] border-l-blue-400">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-blue-600" />
            <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-200">Item Quotation</h3>
            <span className="bg-blue-500 text-white text-[10px] font-black px-2 py-0.5 min-w-[20px] text-center rounded-sm">
              {lines.length}
            </span>
          </div>
          <Button
            type="button"
            onClick={addLine}
            className="bg-blue-500 text-white hover:bg-blue-600 border-2 border-blue-600 text-[10px] font-black uppercase tracking-wide h-8 px-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)] active:shadow-none active:translate-y-[1px] transition-all"
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Tambah
          </Button>
        </div>

        <div className="divide-y divide-zinc-200 dark:divide-zinc-700">
          {lines.map((line, index) => {
            const lineSubtotal = line.quantity * line.unitPrice
            const lineDiscount = lineSubtotal * (line.discount / 100)
            const afterDiscount = lineSubtotal - lineDiscount
            const lineTax = afterDiscount * (line.taxRate / 100)
            const lineTotal = afterDiscount + lineTax

            return (
              <div key={index} className={`p-4 ${index % 2 === 0 ? "bg-white dark:bg-zinc-900" : "bg-zinc-50/50 dark:bg-zinc-800/30"}`}>
                {/* Row 1: Product + Delete */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex-none w-7 h-7 bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-black rounded-sm">
                    {index + 1}
                  </div>
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Produk</Label>
                      <Select
                        value={line.productId || "none"}
                        onValueChange={(value) => onProductSelect(index, value === "none" ? "" : value)}
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
                        onClick={() => removeLine(index)}
                        disabled={lines.length === 1}
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
                    value={line.description}
                    onChange={(event) => updateLine(index, { description: event.target.value })}
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
                      value={line.quantity}
                      onChange={(event) => updateLine(index, { quantity: Number(event.target.value || 0) })}
                      className="border-2 border-black h-10 font-bold text-center"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Harga</Label>
                    <Input
                      type="number"
                      min="0"
                      value={line.unitPrice}
                      onChange={(event) => updateLine(index, { unitPrice: Number(event.target.value || 0) })}
                      className="border-2 border-black h-10 font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Diskon %</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={line.discount}
                      onChange={(event) => updateLine(index, { discount: Number(event.target.value || 0) })}
                      className="border border-zinc-300 dark:border-zinc-600 h-10 text-center"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">PPN %</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={line.taxRate}
                      onChange={(event) => updateLine(index, { taxRate: Number(event.target.value || 0) })}
                      className="border border-zinc-300 dark:border-zinc-600 h-10 text-center"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Total</Label>
                    <div className="h-10 bg-blue-50 dark:bg-blue-950/20 border-2 border-blue-300 dark:border-blue-700 flex items-center justify-end px-3 font-black text-sm font-mono text-blue-900 dark:text-blue-200">
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
        <div className="bg-blue-50 dark:bg-blue-950/20 px-5 py-2.5 border-b-2 border-black flex items-center gap-2 border-l-[5px] border-l-blue-400">
          <StickyNote className="h-4 w-4 text-blue-600" />
          <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-200">Catatan</h3>
        </div>
        <div className="p-5">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Catatan Quotation</Label>
            <Textarea
              value={form.notes}
              onChange={(event) => updateForm("notes", event.target.value)}
              placeholder="Catatan untuk quotation"
              className="border-2 border-black min-h-[80px] resize-none"
            />
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* SECTION 5 — Ringkasan & Submit                                     */}
      {/* ================================================================== */}
      <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="bg-blue-50 dark:bg-blue-950/20 px-5 py-2.5 border-b-2 border-black flex items-center gap-2 border-l-[5px] border-l-blue-400">
          <FileText className="h-4 w-4 text-blue-600" />
          <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-200">Ringkasan Quotation</h3>
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
            <div className="border-t-2 border-blue-300 dark:border-blue-700 pt-3 flex items-center justify-between">
              <span className="text-sm font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-200">Grand Total</span>
              <span className="text-2xl font-black font-mono text-blue-700 dark:text-blue-300">
                {formatCurrency(totals.grandTotal)}
              </span>
            </div>
          </div>

          {creditWarning && (
            <div className={`mt-4 p-3 border-2 rounded-none flex items-start gap-2.5 ${
              creditWarning.type === 'blocked' ? 'border-red-600 bg-red-50 text-red-800' :
              creditWarning.type === 'over' ? 'border-red-600 bg-red-50 text-red-800' :
              'border-amber-500 bg-amber-50 text-amber-800'
            }`}>
              <AlertTriangle className={`h-4 w-4 shrink-0 mt-0.5 ${
                creditWarning.type === 'warn' ? 'text-amber-600' : 'text-red-600'
              }`} />
              <p className="text-xs font-bold">{creditWarning.message}</p>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 mt-6 pt-5 border-t border-zinc-200 dark:border-zinc-700">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/sales/quotations")}
              className="border-2 border-zinc-300 dark:border-zinc-600 font-bold uppercase text-xs tracking-wide h-11 px-6 hover:border-zinc-500 transition-colors"
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={submitting || loadingOptions || creditWarning?.type === 'blocked' || creditWarning?.type === 'over'}
              className="bg-blue-500 text-white hover:bg-blue-600 border-2 border-blue-600 font-black uppercase text-xs tracking-wide h-11 px-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)] transition-all active:scale-[0.98]"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" /> Simpan Quotation
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </form>
  )
}
