"use client"

import { use, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Building,
  Calendar,
  CreditCard,
  FileText,
  Mail,
  MapPin,
  Phone,
  Target,
  TrendingUp,
  User,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useCustomerDetail } from "@/hooks/use-customer-detail"

interface CustomerDetailPageProps {
  params: Promise<{
    id: string
  }>
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

const formatDate = (value?: string | null) => {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

const getCreditStatusBadge = (status: string) => {
  if (status === "GOOD") return <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-600 rounded-md">Baik</Badge>
  if (status === "WATCH") return <Badge className="bg-amber-100 text-amber-800 border border-amber-600 rounded-md">Pantau</Badge>
  if (status === "HOLD") return <Badge className="bg-blue-100 text-blue-800 border border-blue-600 rounded-md">Hold</Badge>
  if (status === "BLOCKED") return <Badge className="bg-red-100 text-red-800 border border-red-600 rounded-md">Blocked</Badge>
  return <Badge variant="outline" className="border rounded-md">{status}</Badge>
}

const getTransactionStatusBadge = (status: string) => {
  const normalized = status.toUpperCase()
  if (["COMPLETED", "PAID", "WON", "CONVERTED", "APPROVED"].includes(normalized)) {
    return <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-600 rounded-md">{status}</Badge>
  }
  if (["REJECTED", "LOST", "CANCELLED", "VOID"].includes(normalized)) {
    return <Badge className="bg-red-100 text-red-800 border border-red-600 rounded-md">{status}</Badge>
  }
  if (["DRAFT", "NEW", "FOLLOW_UP"].includes(normalized)) {
    return <Badge className="bg-zinc-100 text-zinc-800 border border-zinc-600 rounded-md">{status}</Badge>
  }
  return <Badge className="bg-blue-100 text-blue-800 border border-blue-600 rounded-md">{status}</Badge>
}

export default function CustomerDetailPage({ params }: CustomerDetailPageProps) {
  const { id } = use(params)
  const router = useRouter()
  const { data: customer, isLoading } = useCustomerDetail(id)

  const primaryAddress = useMemo(() => customer?.addresses.find((item) => item.isPrimary) || customer?.addresses[0], [customer])
  const primaryContact = useMemo(() => customer?.contacts.find((item) => item.isPrimary) || customer?.contacts[0], [customer])

  if (isLoading) {
    return (
      <div className="flex-1 p-6 md:p-8">
        <div className="text-muted-foreground">Memuat detail customer...</div>
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="flex-1 p-6 md:p-8 space-y-4">
        <Button variant="outline" size="sm" onClick={() => router.back()} className="border border-border font-bold text-xs shadow-sm hover:shadow-none transition-all rounded-md">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Kembali
        </Button>
        <Card className="border border-border shadow-sm rounded-md">
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Customer tidak ditemukan.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mf-page">
      <div className="flex items-center justify-between space-y-2">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" onClick={() => router.back()} className="border border-border font-bold text-xs shadow-sm hover:shadow-none transition-all rounded-md">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Kembali
          </Button>
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">{customer.name}</h2>
            <p className="text-muted-foreground">
              {customer.code} • {customer.customerType}
              {customer.isProspect && <Badge variant="outline" className="ml-2 border rounded-md">Prospek</Badge>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild className="bg-slate-900 text-white hover:bg-zinc-800 border border-border shadow-sm font-semibold text-xs hover:shadow-none transition-all rounded-md">
            <Link href={`/sales/quotations/new?customerId=${customer.id}`}>
              <FileText className="mr-2 h-4 w-4" />
              Buat Quotation
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border border-border shadow-sm rounded-md overflow-hidden relative">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-emerald-500" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4">
            <CardTitle className="font-semibold text-xs text-zinc-500">Total Order Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tracking-tighter">{formatCurrency(customer.totalOrderValue)}</div>
            <p className="text-xs text-muted-foreground">Updated {formatDate(customer.updatedAt)}</p>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm rounded-md overflow-hidden relative">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-blue-500" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4">
            <CardTitle className="font-semibold text-xs text-zinc-500">Limit Kredit</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tracking-tighter">{formatCurrency(customer.creditLimit)}</div>
            <p className="text-xs text-muted-foreground">Term {customer.creditTerm} hari • {customer.paymentTerm}</p>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm rounded-md overflow-hidden relative">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-amber-500" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4">
            <CardTitle className="font-semibold text-xs text-zinc-500">Status Kredit</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="mb-2">{getCreditStatusBadge(customer.creditStatus)}</div>
            <p className="text-xs text-muted-foreground">Status customer: {customer.isActive ? "Aktif" : "Nonaktif"}</p>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm rounded-md overflow-hidden relative">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-zinc-800" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4">
            <CardTitle className="font-semibold text-xs text-zinc-500">Pesanan Terakhir</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tracking-tighter">{formatDate(customer.lastOrderDate)}</div>
            <p className="text-xs text-muted-foreground">Dibuat {formatDate(customer.createdAt)}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="info" className="space-y-4">
        <TabsList className="border border-border rounded-md bg-white shadow-sm">
          <TabsTrigger value="info" className="rounded-md font-semibold text-xs data-[state=active]:bg-black data-[state=active]:text-white">Informasi</TabsTrigger>
          <TabsTrigger value="contacts" className="rounded-md font-semibold text-xs data-[state=active]:bg-black data-[state=active]:text-white">Kontak</TabsTrigger>
          <TabsTrigger value="addresses" className="rounded-md font-semibold text-xs data-[state=active]:bg-black data-[state=active]:text-white">Alamat</TabsTrigger>
          <TabsTrigger value="transactions" className="rounded-md font-semibold text-xs data-[state=active]:bg-black data-[state=active]:text-white">Transaksi</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border border-border shadow-sm rounded-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-semibold text-sm">
                  <Building className="h-5 w-5" />
                  Data Customer
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Nama Legal</p>
                  <p className="font-semibold">{customer.legalName || customer.name}</p>
                </div>
                <Separator className="bg-slate-900" />
                <div>
                  <p className="text-muted-foreground">Kategori</p>
                  <p className="font-semibold">{customer.category?.name || "-"}</p>
                </div>
                <Separator className="bg-slate-900" />
                <div>
                  <p className="text-muted-foreground">NPWP / NIK</p>
                  <p className="font-semibold">{customer.npwp || customer.nik || "-"}</p>
                </div>
                <Separator className="bg-slate-900" />
                <div>
                  <p className="text-muted-foreground">Status Pajak</p>
                  <p className="font-semibold">{customer.taxStatus} ({customer.isTaxable ? "Taxable" : "Non-taxable"})</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border shadow-sm rounded-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-semibold text-sm">
                  <User className="h-5 w-5" />
                  Kontak Utama
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>{primaryContact?.name || "-"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{primaryContact?.phone || primaryContact?.mobile || customer.phone || "-"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{primaryContact?.email || customer.email || "-"}</span>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <span>
                    {primaryAddress
                      ? `${primaryAddress.address1}${primaryAddress.address2 ? `, ${primaryAddress.address2}` : ""}, ${primaryAddress.kabupaten}, ${primaryAddress.provinsi}`
                      : "-"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="contacts">
          <Card className="border border-border shadow-sm rounded-md">
            <CardHeader>
              <CardTitle className="font-semibold text-sm">Daftar Kontak</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {customer.contacts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada data kontak.</p>
              ) : customer.contacts.map((contact) => (
                <div key={contact.id} className="p-3 border border-border rounded-md">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{contact.name}</p>
                    {contact.isPrimary && <Badge className="border rounded-md">Primary</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{contact.title || "-"} • {contact.department || "-"}</p>
                  <p className="text-sm">{contact.phone || contact.mobile || "-"}</p>
                  <p className="text-sm">{contact.email || "-"}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="addresses">
          <Card className="border border-border shadow-sm rounded-md">
            <CardHeader>
              <CardTitle className="font-semibold text-sm">Alamat Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {customer.addresses.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada data alamat.</p>
              ) : customer.addresses.map((address) => (
                <div key={address.id} className="p-3 border border-border rounded-md">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{address.type}</p>
                    {address.isPrimary && <Badge className="border rounded-md">Primary</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {address.address1}
                    {address.address2 ? `, ${address.address2}` : ""}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {address.kelurahan ? `${address.kelurahan}, ` : ""}
                    {address.kecamatan ? `${address.kecamatan}, ` : ""}
                    {address.kabupaten}, {address.provinsi} {address.postalCode}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions">
          <Card className="border border-border shadow-sm rounded-md">
            <CardHeader>
              <CardTitle className="font-semibold text-sm">Riwayat Transaksi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {customer.transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada transaksi.</p>
              ) : customer.transactions.map((transaction) => (
                <div key={`${transaction.type}-${transaction.id}`} className="p-3 border border-border rounded-md flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{transaction.number}</p>
                    <p className="text-sm text-muted-foreground">
                      {transaction.type.toUpperCase()} • {formatDate(transaction.date)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatCurrency(transaction.amount)}</p>
                    {getTransactionStatusBadge(transaction.status)}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
