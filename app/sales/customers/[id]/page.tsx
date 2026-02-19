"use client"

import { useMemo } from "react"
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
  params: {
    id: string
  }
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
  if (status === "GOOD") return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Baik</Badge>
  if (status === "WATCH") return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Pantau</Badge>
  if (status === "HOLD") return <Badge className="bg-orange-100 text-orange-800 border-orange-200">Hold</Badge>
  if (status === "BLOCKED") return <Badge className="bg-red-100 text-red-800 border-red-200">Blocked</Badge>
  return <Badge variant="outline">{status}</Badge>
}

const getTransactionStatusBadge = (status: string) => {
  const normalized = status.toUpperCase()
  if (["COMPLETED", "PAID", "WON", "CONVERTED", "APPROVED"].includes(normalized)) {
    return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">{status}</Badge>
  }
  if (["REJECTED", "LOST", "CANCELLED", "VOID"].includes(normalized)) {
    return <Badge className="bg-red-100 text-red-800 border-red-200">{status}</Badge>
  }
  if (["DRAFT", "NEW", "CONTACTED"].includes(normalized)) {
    return <Badge className="bg-zinc-100 text-zinc-800 border-zinc-200">{status}</Badge>
  }
  return <Badge className="bg-blue-100 text-blue-800 border-blue-200">{status}</Badge>
}

export default function CustomerDetailPage({ params }: CustomerDetailPageProps) {
  const router = useRouter()
  const { data: customer, isLoading } = useCustomerDetail(params.id)

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
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Kembali
        </Button>
        <Card>
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
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Kembali
          </Button>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">{customer.name}</h2>
            <p className="text-muted-foreground">
              {customer.code} • {customer.customerType}
              {customer.isProspect && <Badge variant="outline" className="ml-2">Prospek</Badge>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={`/sales/quotations/new?customerId=${customer.id}`}>
              <FileText className="mr-2 h-4 w-4" />
              Buat Quotation
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Order Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(customer.totalOrderValue)}</div>
            <p className="text-xs text-muted-foreground">Updated {formatDate(customer.updatedAt)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Limit Kredit</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(customer.creditLimit)}</div>
            <p className="text-xs text-muted-foreground">Term {customer.creditTerm} hari • {customer.paymentTerm}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status Kredit</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="mb-2">{getCreditStatusBadge(customer.creditStatus)}</div>
            <p className="text-xs text-muted-foreground">Status customer: {customer.isActive ? "Aktif" : "Nonaktif"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pesanan Terakhir</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDate(customer.lastOrderDate)}</div>
            <p className="text-xs text-muted-foreground">Dibuat {formatDate(customer.createdAt)}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="info" className="space-y-4">
        <TabsList>
          <TabsTrigger value="info">Informasi</TabsTrigger>
          <TabsTrigger value="contacts">Kontak</TabsTrigger>
          <TabsTrigger value="addresses">Alamat</TabsTrigger>
          <TabsTrigger value="transactions">Transaksi</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Data Customer
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Nama Legal</p>
                  <p className="font-semibold">{customer.legalName || customer.name}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-muted-foreground">Kategori</p>
                  <p className="font-semibold">{customer.category?.name || "-"}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-muted-foreground">NPWP / NIK</p>
                  <p className="font-semibold">{customer.npwp || customer.nik || "-"}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-muted-foreground">Status Pajak</p>
                  <p className="font-semibold">{customer.taxStatus} ({customer.isTaxable ? "Taxable" : "Non-taxable"})</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
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
          <Card>
            <CardHeader>
              <CardTitle>Daftar Kontak</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {customer.contacts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada data kontak.</p>
              ) : customer.contacts.map((contact) => (
                <div key={contact.id} className="p-3 rounded-lg border">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{contact.name}</p>
                    {contact.isPrimary && <Badge>Primary</Badge>}
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
          <Card>
            <CardHeader>
              <CardTitle>Alamat Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {customer.addresses.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada data alamat.</p>
              ) : customer.addresses.map((address) => (
                <div key={address.id} className="p-3 rounded-lg border">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{address.type}</p>
                    {address.isPrimary && <Badge>Primary</Badge>}
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
          <Card>
            <CardHeader>
              <CardTitle>Riwayat Transaksi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {customer.transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada transaksi.</p>
              ) : customer.transactions.map((transaction) => (
                <div key={`${transaction.type}-${transaction.id}`} className="p-3 rounded-lg border flex items-center justify-between gap-3">
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
