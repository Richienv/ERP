"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ArrowLeft,
  Edit,
  Mail,
  Phone,
  MapPin,
  Building,
  CreditCard,
  FileText,
  ShoppingCart,
  Target,
  User,
  Calendar,
  TrendingUp
} from "lucide-react"
import Link from "next/link"

// Mock customer data - would normally come from API
const mockCustomer = {
  id: "1",
  code: "CUST001",
  name: "PT Teknologi Maju Indonesia",
  legalName: "PT Teknologi Maju Indonesia",
  customerType: "COMPANY",
  categoryId: "1",
  npwp: "01.234.567.8-901.000",
  taxStatus: "PKP",
  phone: "+62-21-12345678",
  email: "info@teknologi-maju.co.id",
  website: "https://www.teknologi-maju.co.id",
  creditLimit: 500000000,
  creditTerm: 30,
  paymentTerm: "NET_30",
  creditStatus: "GOOD",
  isActive: true,
  isProspect: false,
  lastOrderDate: new Date("2024-10-15"),
  totalOrderValue: 1250000000,
  createdAt: new Date("2024-01-15"),
  updatedAt: new Date("2024-11-01"),
  category: {
    id: "1",
    code: "CORP",
    name: "Korporat",
    description: "Pelanggan korporat"
  },
  addresses: [
    {
      id: "1",
      type: "BILLING",
      address1: "Jl. Sudirman No. 123",
      address2: "Lantai 15, Tower A",
      kelurahan: "Senayan",
      kecamatan: "Kebayoran Baru",
      kabupaten: "Jakarta Selatan",
      provinsi: "DKI Jakarta",
      postalCode: "12190",
      country: "Indonesia",
      isPrimary: true,
      isActive: true
    },
    {
      id: "2",
      type: "SHIPPING",
      address1: "Jl. Thamrin No. 456",
      address2: "Gudang B",
      kelurahan: "Menteng",
      kecamatan: "Menteng",
      kabupaten: "Jakarta Pusat", 
      provinsi: "DKI Jakarta",
      postalCode: "10310",
      country: "Indonesia",
      isPrimary: false,
      isActive: true
    }
  ],
  contacts: [
    {
      id: "1",
      name: "Budi Santoso",
      title: "Procurement Manager",
      department: "Purchasing",
      email: "budi@teknologi-maju.co.id",
      phone: "+62-21-12345678",
      mobile: "+62-812-3456789",
      isPrimary: true,
      isActive: true
    },
    {
      id: "2",
      name: "Sari Dewi",
      title: "Finance Manager", 
      department: "Finance",
      email: "sari@teknologi-maju.co.id",
      phone: "+62-21-12345679",
      mobile: "+62-812-9876543",
      isPrimary: false,
      isActive: true
    }
  ]
}

// Mock transactions data
const mockTransactions = [
  {
    id: "1",
    type: "quotation",
    number: "QUO-2024-001",
    date: new Date("2024-11-01"),
    amount: 125000000,
    status: "SENT",
    description: "Pengadaan Laptop Dell untuk 50 unit"
  },
  {
    id: "2", 
    type: "order",
    number: "SO-2024-045",
    date: new Date("2024-10-15"),
    amount: 89000000,
    status: "COMPLETED",
    description: "Pembelian Furniture Kantor"
  },
  {
    id: "3",
    type: "quotation",
    number: "QUO-2024-002",
    date: new Date("2024-10-10"),
    amount: 156000000,
    status: "ACCEPTED",
    description: "Sistem ERP dan Training"
  }
]

interface CustomerDetailPageProps {
  params: { id: string }
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

const getCustomerTypeName = (type: string) => {
  switch (type) {
    case 'COMPANY':
      return 'Perusahaan'
    case 'GOVERNMENT':
      return 'Pemerintah'
    case 'INDIVIDUAL':
      return 'Perorangan'
    default:
      return type
  }
}

const getCreditStatusBadge = (status: string) => {
  switch (status) {
    case 'GOOD':
      return <Badge variant="outline" className="text-green-600 border-green-600">Baik</Badge>
    case 'WATCH':
      return <Badge variant="outline" className="text-yellow-600 border-yellow-600">Perhatian</Badge>
    case 'HOLD':
      return <Badge variant="outline" className="text-red-600 border-red-600">Ditahan</Badge>
    case 'BLOCKED':
      return <Badge variant="destructive">Diblokir</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

const getPaymentTermName = (term: string) => {
  switch (term) {
    case 'CASH':
      return 'Tunai'
    case 'COD':
      return 'COD'
    case 'NET_15':
      return '15 Hari'
    case 'NET_30':
      return '30 Hari'
    case 'NET_45':
      return '45 Hari'
    case 'NET_60':
      return '60 Hari'
    case 'NET_90':
      return '90 Hari'
    default:
      return term
  }
}

const getAddressTypeName = (type: string) => {
  switch (type) {
    case 'BILLING':
      return 'Penagihan'
    case 'SHIPPING':
      return 'Pengiriman'
    case 'OFFICE':
      return 'Kantor'
    case 'WAREHOUSE':
      return 'Gudang'
    default:
      return type
  }
}

const getTransactionStatusBadge = (status: string) => {
  switch (status) {
    case 'SENT':
      return <Badge variant="secondary">Terkirim</Badge>
    case 'ACCEPTED':
      return <Badge variant="default">Diterima</Badge>
    case 'COMPLETED':
      return <Badge variant="outline" className="text-green-600 border-green-600">Selesai</Badge>
    case 'REJECTED':
      return <Badge variant="destructive">Ditolak</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

export default function CustomerDetailPage({ params }: CustomerDetailPageProps) {
  const router = useRouter()
  const customer = mockCustomer // In real app, fetch by params.id

  const primaryAddress = customer.addresses.find(addr => addr.isPrimary)
  const primaryContact = customer.contacts.find(contact => contact.isPrimary)

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between space-y-2">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Kembali
          </Button>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">{customer.name}</h2>
            <p className="text-muted-foreground">
              {customer.code} " {getCustomerTypeName(customer.customerType)}
              {customer.isProspect && (
                <Badge variant="outline" className="ml-2">Prospek</Badge>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button asChild>
            <Link href={`/sales/customers/${customer.id}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Pelanggan
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/sales/quotations/new?customerId=${customer.id}`}>
              <FileText className="mr-2 h-4 w-4" />
              Buat Penawaran
            </Link>
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transaksi</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(customer.totalOrderValue)}</div>
            <p className="text-xs text-muted-foreground">
              Sejak {customer.createdAt.toLocaleDateString('id-ID')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Limit Kredit</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(customer.creditLimit)}</div>
            <p className="text-xs text-muted-foreground">
              {getPaymentTermName(customer.paymentTerm)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status Kredit</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">
              {getCreditStatusBadge(customer.creditStatus)}
            </div>
            <p className="text-xs text-muted-foreground">
              Term: {customer.creditTerm} hari
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pesanan Terakhir</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {customer.lastOrderDate ? customer.lastOrderDate.toLocaleDateString('id-ID') : 'Belum ada'}
            </div>
            <p className="text-xs text-muted-foreground">
              {customer.isActive ? 'Aktif' : 'Nonaktif'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Information Tabs */}
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
                  Informasi Perusahaan
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <div className="text-sm text-muted-foreground">Nama Legal</div>
                  <div className="font-medium">{customer.legalName || customer.name}</div>
                </div>
                <div className="grid gap-2">
                  <div className="text-sm text-muted-foreground">Kategori</div>
                  <div className="font-medium">{customer.category.name}</div>
                </div>
                <div className="grid gap-2">
                  <div className="text-sm text-muted-foreground">NPWP</div>
                  <div className="font-mono text-sm">{customer.npwp || 'Tidak ada'}</div>
                </div>
                <div className="grid gap-2">
                  <div className="text-sm text-muted-foreground">Status Pajak</div>
                  <div className="font-medium">{customer.taxStatus}</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  Kontak Utama
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <div className="text-sm text-muted-foreground">Telepon</div>
                  <div className="font-medium">{customer.phone}</div>
                </div>
                <div className="grid gap-2">
                  <div className="text-sm text-muted-foreground">Email</div>
                  <div className="font-medium">{customer.email}</div>
                </div>
                <div className="grid gap-2">
                  <div className="text-sm text-muted-foreground">Website</div>
                  <div className="font-medium">{customer.website || 'Tidak ada'}</div>
                </div>
                {primaryContact && (
                  <div className="grid gap-2">
                    <div className="text-sm text-muted-foreground">PIC Utama</div>
                    <div className="font-medium">
                      {primaryContact.name} - {primaryContact.title}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="contacts" className="space-y-4">
          <div className="grid gap-4">
            {customer.contacts.map((contact) => (
              <Card key={contact.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      {contact.name}
                      {contact.isPrimary && (
                        <Badge variant="default">Utama</Badge>
                      )}
                    </div>
                    <Badge variant="outline">{contact.title}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="grid gap-2">
                      <div className="text-sm text-muted-foreground">Departemen</div>
                      <div className="font-medium">{contact.department || 'Tidak disebutkan'}</div>
                    </div>
                    <div className="grid gap-2">
                      <div className="text-sm text-muted-foreground">Email</div>
                      <div className="font-medium">{contact.email}</div>
                    </div>
                    <div className="grid gap-2">
                      <div className="text-sm text-muted-foreground">Telepon</div>
                      <div className="font-medium">
                        {contact.phone}
                        {contact.mobile && (
                          <div className="text-sm text-muted-foreground">
                            Mobile: {contact.mobile}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="addresses" className="space-y-4">
          <div className="grid gap-4">
            {customer.addresses.map((address) => (
              <Card key={address.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      Alamat {getAddressTypeName(address.type)}
                      {address.isPrimary && (
                        <Badge variant="default">Utama</Badge>
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div>{address.address1}</div>
                    {address.address2 && <div>{address.address2}</div>}
                    <div>
                      {address.kelurahan && `${address.kelurahan}, `}
                      {address.kecamatan && `${address.kecamatan}, `}
                      {address.kabupaten}, {address.provinsi} {address.postalCode}
                    </div>
                    <div className="text-sm text-muted-foreground">{address.country}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          <div className="grid gap-4">
            {mockTransactions.map((transaction) => (
              <Card key={transaction.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {transaction.type === 'quotation' ? (
                        <FileText className="h-5 w-5" />
                      ) : (
                        <ShoppingCart className="h-5 w-5" />
                      )}
                      {transaction.number}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="font-medium">{formatCurrency(transaction.amount)}</div>
                        <div className="text-sm text-muted-foreground">
                          {transaction.date.toLocaleDateString('id-ID')}
                        </div>
                      </div>
                      {getTransactionStatusBadge(transaction.status)}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    {transaction.description}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}