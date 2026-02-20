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
  if (status === "GOOD") return <Badge className="bg-emerald-100 text-emerald-800 border-2 border-emerald-600 rounded-none">Baik</Badge>
  if (status === "WATCH") return <Badge className="bg-amber-100 text-amber-800 border-2 border-amber-600 rounded-none">Pantau</Badge>
  if (status === "HOLD") return <Badge className="bg-orange-100 text-orange-800 border-2 border-orange-600 rounded-none">Hold</Badge>
  if (status === "BLOCKED") return <Badge className="bg-red-100 text-red-800 border-2 border-red-600 rounded-none">Blocked</Badge>
  return <Badge variant="outline" className="border-2 rounded-none">{status}</Badge>
}

const getTransactionStatusBadge = (status: string) => {
  const normalized = status.toUpperCase()
  if (["COMPLETED", "PAID", "WON", "CONVERTED", "APPROVED"].includes(normalized)) {
    return <Badge className="bg-emerald-100 text-emerald-800 border-2 border-emerald-600 rounded-none">{status}</Badge>
  }
  if (["REJECTED", "LOST", "CANCELLED", "VOID"].includes(normalized)) {
    return <Badge className="bg-red-100 text-red-800 border-2 border-red-600 rounded-none">{status}</Badge>
  }
  if (["DRAFT", "NEW", "FOLLOW_UP"].includes(normalized)) {
    return <Badge className="bg-zinc-100 text-zinc-800 border-2 border-zinc-600 rounded-none">{status}</Badge>
  }
  return <Badge className="bg-blue-100 text-blue-800 border-2 border-blue-600 rounded-none">{status}</Badge>
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
        <Button variant="outline" size="sm" onClick={() => router.back()} className="border-2 border-black font-bold uppercase text-[10px] tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-none transition-all rounded-none">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Kembali
        </Button>
        <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-none">
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
          <Button variant="outline" size="sm" onClick={() => router.back()} className="border-2 border-black font-bold uppercase text-[10px] tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-none transition-all rounded-none">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Kembali
          </Button>
          <div>
            <h2 className="text-3xl font-black uppercase tracking-tight">{customer.name}</h2>
            <p className="text-muted-foreground">
              {customer.code} • {customer.customerType}
              {customer.isProspect && <Badge variant="outline" className="ml-2 border-2 rounded-none">Prospek</Badge>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild className="bg-black text-white hover:bg-zinc-800 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] uppercase font-black text-[10px] tracking-wider hover:translate-y-[1px] hover:shadow-none transition-all rounded-none">
            <Link href={`/sales/quotations/new?customerId=${customer.id}`}>
              <FileText className="mr-2 h-4 w-4" />
              Buat Quotation
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-none overflow-hidden relative">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-emerald-500" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4">
            <CardTitle className="font-black uppercase text-[10px] tracking-widest text-zinc-500">Total Order Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black tracking-tighter">{formatCurrency(customer.totalOrderValue)}</div>
            <p className="text-xs text-muted-foreground">Updated {formatDate(customer.updatedAt)}</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-none overflow-hidden relative">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-blue-500" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4">
            <CardTitle className="font-black uppercase text-[10px] tracking-widest text-zinc-500">Limit Kredit</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black tracking-tighter">{formatCurrency(customer.creditLimit)}</div>
            <p className="text-xs text-muted-foreground">Term {customer.creditTerm} hari • {customer.paymentTerm}</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-none overflow-hidden relative">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-amber-500" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4">
            <CardTitle className="font-black uppercase text-[10px] tracking-widest text-zinc-500">Status Kredit</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="mb-2">{getCreditStatusBadge(customer.creditStatus)}</div>
            <p className="text-xs text-muted-foreground">Status customer: {customer.isActive ? "Aktif" : "Nonaktif"}</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-none overflow-hidden relative">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-zinc-800" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4">
            <CardTitle className="font-black uppercase text-[10px] tracking-widest text-zinc-500">Pesanan Terakhir</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black tracking-tighter">{formatDate(customer.lastOrderDate)}</div>
            <p className="text-xs text-muted-foreground">Dibuat {formatDate(customer.createdAt)}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="info" className="space-y-4">
        <TabsList className="border-2 border-black rounded-none bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <TabsTrigger value="info" className="rounded-none font-black uppercase text-[10px] tracking-wider data-[state=active]:bg-black data-[state=active]:text-white">Informasi</TabsTrigger>
          <TabsTrigger value="contacts" className="rounded-none font-black uppercase text-[10px] tracking-wider data-[state=active]:bg-black data-[state=active]:text-white">Kontak</TabsTrigger>
          <TabsTrigger value="addresses" className="rounded-none font-black uppercase text-[10px] tracking-wider data-[state=active]:bg-black data-[state=active]:text-white">Alamat</TabsTrigger>
          <TabsTrigger value="transactions" className="rounded-none font-black uppercase text-[10px] tracking-wider data-[state=active]:bg-black data-[state=active]:text-white">Transaksi</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-black uppercase text-sm tracking-wide">
                  <Building className="h-5 w-5" />
                  Data Customer
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Nama Legal</p>
                  <p className="font-semibold">{customer.legalName || customer.name}</p>
                </div>
                <Separator className="bg-black" />
                <div>
                  <p className="text-muted-foreground">Kategori</p>
                  <p className="font-semibold">{customer.category?.name || "-"}</p>
                </div>
                <Separator className="bg-black" />
                <div>
                  <p className="text-muted-foreground">NPWP / NIK</p>
                  <p className="font-semibold">{customer.npwp || customer.nik || "-"}</p>
                </div>
                <Separator className="bg-black" />
                <div>
                  <p className="text-muted-foreground">Status Pajak</p>
                  <p className="font-semibold">{customer.taxStatus} ({customer.isTaxable ? "Taxable" : "Non-taxable"})</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-black uppercase text-sm tracking-wide">
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
          <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-none">
            <CardHeader>
              <CardTitle className="font-black uppercase text-sm tracking-wide">Daftar Kontak</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {customer.contacts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada data kontak.</p>
              ) : customer.contacts.map((contact) => (
                <div key={contact.id} className="p-3 border-2 border-black rounded-none">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{contact.name}</p>
                    {contact.isPrimary && <Badge className="border-2 rounded-none">Primary</Badge>}
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
          <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-none">
            <CardHeader>
              <CardTitle className="font-black uppercase text-sm tracking-wide">Alamat Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {customer.addresses.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada data alamat.</p>
              ) : customer.addresses.map((address) => (
                <div key={address.id} className="p-3 border-2 border-black rounded-none">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{address.type}</p>
                    {address.isPrimary && <Badge className="border-2 rounded-none">Primary</Badge>}
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
          <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-none">
            <CardHeader>
              <CardTitle className="font-black uppercase text-sm tracking-wide">Riwayat Transaksi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {customer.transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada transaksi.</p>
              ) : customer.transactions.map((transaction) => (
                <div key={`${transaction.type}-${transaction.id}`} className="p-3 border-2 border-black rounded-none flex items-center justify-between gap-3">
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
