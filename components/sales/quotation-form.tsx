"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Building2, Calendar, FileText, Package, Plus, Trash2, User } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"

interface CustomerOption {
  id: string
  code: string
  name: string
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
}

export function QuotationForm({ initialCustomerId }: QuotationFormProps) {
  const router = useRouter()

  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [products, setProducts] = useState<ProductOption[]>([])
  const [salesPersons, setSalesPersons] = useState<UserOption[]>([])
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    customerId: "",
    customerRef: "",
    quotationDate: new Date().toISOString().slice(0, 10),
    validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    salesPersonId: "",
    paymentTerm: "NET_30",
    deliveryTerm: "",
    notes: "",
  })

  const [lines, setLines] = useState<QuotationLine[]>([
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
        const response = await fetch("/api/sales/options", { cache: "no-store" })
        const payload: SalesOptionsResponse = await response.json()

        if (!payload.success || !payload.data) {
          throw new Error(payload.error || "Gagal memuat data referensi")
        }

        setCustomers(payload.data.customers || [])
        setProducts(payload.data.products || [])
        setSalesPersons(payload.data.users || [])

        if (initialCustomerId) {
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
  }, [initialCustomerId])

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
      const response = await fetch("/api/sales/quotations", {
        method: "POST",
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
        throw new Error(payload.error || "Gagal membuat quotation")
      }

      toast.success(`Quotation ${payload.data?.number || "baru"} berhasil dibuat`)
      router.push("/sales/quotations")
    } catch (error: any) {
      toast.error(error?.message || "Gagal membuat quotation")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Informasi Quotation
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="flex items-center gap-2"><Building2 className="h-4 w-4" /> Customer *</Label>
            <Select value={form.customerId} onValueChange={(value) => updateForm("customerId", value)} disabled={loadingOptions}>
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
            <Label>Ref Customer</Label>
            <Input
              value={form.customerRef}
              onChange={(event) => updateForm("customerRef", event.target.value)}
              placeholder="Nomor referensi customer"
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2"><Calendar className="h-4 w-4" /> Tanggal Quotation</Label>
            <Input
              type="date"
              value={form.quotationDate}
              onChange={(event) => updateForm("quotationDate", event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Valid Sampai</Label>
            <Input
              type="date"
              value={form.validUntil}
              onChange={(event) => updateForm("validUntil", event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2"><User className="h-4 w-4" /> Sales Person</Label>
            <Select value={form.salesPersonId || "none"} onValueChange={(value) => updateForm("salesPersonId", value === "none" ? "" : value)}>
              <SelectTrigger>
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

          <div className="space-y-2 md:col-span-2">
            <Label>Delivery Term</Label>
            <Input
              value={form.deliveryTerm}
              onChange={(event) => updateForm("deliveryTerm", event.target.value)}
              placeholder="Contoh: Ex-warehouse / FOB"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Catatan</Label>
            <Textarea
              value={form.notes}
              onChange={(event) => updateForm("notes", event.target.value)}
              placeholder="Catatan untuk quotation"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2"><Package className="h-5 w-5" /> Item Quotation</span>
            <Button type="button" variant="outline" size="sm" onClick={addLine}>
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
                {lines.map((line, index) => {
                  const lineSubtotal = line.quantity * line.unitPrice
                  const lineDiscount = lineSubtotal * (line.discount / 100)
                  const afterDiscount = lineSubtotal - lineDiscount
                  const lineTax = afterDiscount * (line.taxRate / 100)
                  const lineTotal = afterDiscount + lineTax

                  return (
                    <TableRow key={index}>
                      <TableCell className="space-y-2">
                        <Select
                          value={line.productId || "none"}
                          onValueChange={(value) => onProductSelect(index, value === "none" ? "" : value)}
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
                          value={line.description}
                          onChange={(event) => updateLine(index, { description: event.target.value })}
                          placeholder="Deskripsi item"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0.001"
                          step="0.001"
                          value={line.quantity}
                          onChange={(event) => updateLine(index, { quantity: Number(event.target.value || 0) })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          value={line.unitPrice}
                          onChange={(event) => updateLine(index, { unitPrice: Number(event.target.value || 0) })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={line.discount}
                          onChange={(event) => updateLine(index, { discount: Number(event.target.value || 0) })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={line.taxRate}
                          onChange={(event) => updateLine(index, { taxRate: Number(event.target.value || 0) })}
                        />
                      </TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(lineTotal)}</TableCell>
                      <TableCell>
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeLine(index)}>
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
              <span>{formatCurrency(totals.grandTotal)}</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 mt-6">
            <Button type="button" variant="outline" onClick={() => router.push("/sales/quotations")}>Batal</Button>
            <Button type="submit" disabled={submitting || loadingOptions}>
              {submitting ? "Menyimpan..." : "Simpan Quotation"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
