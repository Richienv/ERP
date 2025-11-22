"use client"

import { useState } from "react"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Search,
  Filter,
  MoreHorizontal,
  Edit,
  Eye,
  Plus,
  Building2,
  User,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  ShoppingBag,
  CreditCard
} from "lucide-react"
import Link from "next/link"
import { IconTrendingUp, IconTrendingDown } from "@tabler/icons-react"

// Mock data untuk customers - Textile Factory Context
const mockCustomers = [
  {
    id: "1",
    code: "CUST-001",
    name: "PT. Garment Indah Jaya",
    legalName: "PT. Garment Indah Jaya Tbk",
    customerType: "FACTORY",
    categoryName: "Pabrik Garment",
    npwp: "01.234.567.8-901.000",
    phone: "021-5556789",
    email: "procurement@garmentindah.co.id",
    city: "Tangerang",
    creditLimit: 5000000000,
    creditStatus: "GOOD",
    totalOrderValue: 2450000000,
    lastOrderDate: "2024-11-15",
    isActive: true,
    isProspect: false
  },
  {
    id: "2",
    code: "CUST-002",
    name: "CV. Tekstil Makmur",
    legalName: "CV. Tekstil Makmur Abadi",
    customerType: "DISTRIBUTOR",
    categoryName: "Distributor Kain",
    npwp: "02.345.678.9-012.000",
    phone: "022-7778889",
    email: "admin@tekstilmakmur.com",
    city: "Bandung",
    creditLimit: 2000000000,
    creditStatus: "GOOD",
    totalOrderValue: 1890000000,
    lastOrderDate: "2024-11-10",
    isActive: true,
    isProspect: false
  },
  {
    id: "3",
    code: "CUST-003",
    name: "Boutique Fashion A",
    legalName: "Ibu Ani Susanti",
    customerType: "RETAIL",
    categoryName: "Butik Fashion",
    nik: "3201123456789012",
    phone: "0812-3456-7890",
    email: "ani.susanti@email.com",
    city: "Jakarta Selatan",
    creditLimit: 50000000,
    creditStatus: "WATCH",
    totalOrderValue: 156000000,
    lastOrderDate: "2024-11-05",
    isActive: true,
    isProspect: false
  },
  {
    id: "4",
    code: "LEAD-001",
    name: "PT. Mode Nusantara",
    legalName: "PT. Mode Nusantara Group",
    customerType: "BRAND",
    categoryName: "Brand Fashion",
    npwp: null,
    phone: "021-9998887",
    email: "partnership@modenusantara.id",
    city: "Jakarta Pusat",
    creditLimit: 0,
    creditStatus: "GOOD",
    totalOrderValue: 0,
    lastOrderDate: null,
    isActive: true,
    isProspect: true
  },
  {
    id: "5",
    code: "CUST-005",
    name: "UD. Kain Sejahtera",
    legalName: "UD. Kain Sejahtera",
    customerType: "WHOLESALE",
    categoryName: "Grosir Tanah Abang",
    npwp: "05.678.901.2-345.000",
    phone: "021-3334445",
    email: "ud.kainsejahtera@email.com",
    city: "Jakarta Pusat",
    creditLimit: 500000000,
    creditStatus: "HOLD",
    totalOrderValue: 1340000000,
    lastOrderDate: "2024-10-20",
    isActive: false,
    isProspect: false
  }
]

// Get customer type badge
const getCustomerTypeBadge = (type: string) => {
  switch (type) {
    case 'FACTORY':
      return <Badge variant="default" className="bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800">Pabrik</Badge>
    case 'DISTRIBUTOR':
      return <Badge variant="secondary" className="bg-purple-100 text-purple-800 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800">Distributor</Badge>
    case 'RETAIL':
      return <Badge variant="outline" className="bg-pink-100 text-pink-800 hover:bg-pink-200 dark:bg-pink-900/30 dark:text-pink-400 border-pink-200 dark:border-pink-800">Retail</Badge>
    case 'WHOLESALE':
      return <Badge variant="outline" className="bg-orange-100 text-orange-800 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800">Grosir</Badge>
    case 'BRAND':
      return <Badge variant="outline" className="bg-indigo-100 text-indigo-800 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800">Brand</Badge>
    default:
      return <Badge variant="outline">Unknown</Badge>
  }
}

// Get credit status badge
const getCreditStatusBadge = (status: string) => {
  switch (status) {
    case 'GOOD':
      return <Badge variant="default" className="bg-green-100 text-green-800 border-green-200 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800">Lancar</Badge>
    case 'WATCH':
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800">Pantau</Badge>
    case 'HOLD':
      return <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800">Ditahan</Badge>
    default:
      return <Badge variant="outline">Unknown</Badge>
  }
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

// Format date
const formatDate = (dateString: string | null) => {
  if (!dateString) return "-"
  return new Date(dateString).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function CustomersPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")

  // Filter customers
  const filteredCustomers = mockCustomers.filter(customer => {
    const matchesSearch = customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = filterType === "all" || customer.customerType === filterType
    const matchesStatus = filterStatus === "all" ||
      (filterStatus === "active" && customer.isActive) ||
      (filterStatus === "inactive" && !customer.isActive) ||
      (filterStatus === "prospect" && customer.isProspect)
    return matchesSearch && matchesType && matchesStatus
  })

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Manajemen Pelanggan</h2>
          <p className="text-muted-foreground">
            Database pelanggan, distributor, dan prospek pabrik tekstil
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" asChild>
            <Link href="/sales/customers/import">
              <Plus className="mr-2 h-4 w-4" />
              Import Data
            </Link>
          </Button>
          <Button asChild>
            <Link href="/sales/customers/new">
              <Plus className="mr-2 h-4 w-4" />
              Pelanggan Baru
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs @xl:grid-cols-2 @5xl:grid-cols-4">
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Total Pelanggan</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {mockCustomers.filter(c => !c.isProspect).length}
            </CardTitle>
            <CardAction>
              <Badge variant="outline">
                <Building2 className="mr-1 size-3" />
                Mitra
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">
              Pelanggan aktif <Briefcase className="size-4" />
            </div>
            <div className="text-muted-foreground">
              Sudah melakukan transaksi
            </div>
          </CardFooter>
        </Card>

        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Prospek Baru</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-blue-600">
              {mockCustomers.filter(c => c.isProspect).length}
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="border-blue-600 text-blue-600">
                <IconTrendingUp />
                Potensial
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium text-blue-600">
              Calon mitra <User className="size-4" />
            </div>
            <div className="text-muted-foreground">
              Belum ada transaksi
            </div>
          </CardFooter>
        </Card>

        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Tipe Pelanggan</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-green-600">
              {mockCustomers.filter(c => c.customerType === 'FACTORY').length}
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="border-green-600 text-green-600">
                <Building2 className="mr-1 size-3" />
                Pabrik
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium text-green-600">
              Segmen Pabrik Garment <ShoppingBag className="size-4" />
            </div>
            <div className="text-muted-foreground">
              Kontributor revenue terbesar
            </div>
          </CardFooter>
        </Card>

        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Credit Watch</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-yellow-600">
              {mockCustomers.filter(c => c.creditStatus === 'WATCH' || c.creditStatus === 'HOLD').length}
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="border-yellow-600 text-yellow-600">
                <CreditCard className="mr-1 size-3" />
                Limit
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium text-yellow-600">
              Perlu perhatian <IconTrendingDown className="size-4" />
            </div>
            <div className="text-muted-foreground">
              Over limit atau telat bayar
            </div>
          </CardFooter>
        </Card>
      </div>

      {/* Customers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Daftar Mitra & Pelanggan</CardTitle>
          <CardDescription>
            Kelola data kontak, limit kredit, dan riwayat transaksi
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama perusahaan, kode, atau email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Filter className="mr-2 h-4 w-4" />
                  Tipe: {filterType === "all" ? "Semua" : filterType}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Filter Tipe Pelanggan</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setFilterType("all")}>
                  Semua Tipe
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterType("FACTORY")}>
                  Pabrik Garment
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterType("DISTRIBUTOR")}>
                  Distributor
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterType("WHOLESALE")}>
                  Grosir
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterType("RETAIL")}>
                  Retail
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Filter className="mr-2 h-4 w-4" />
                  Status: {filterStatus === "all" ? "Semua" : filterStatus}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Filter Status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setFilterStatus("all")}>
                  Semua Status
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterStatus("active")}>
                  Aktif
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterStatus("inactive")}>
                  Tidak Aktif
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterStatus("prospect")}>
                  Prospek
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Customer Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kode</TableHead>
                  <TableHead>Nama Perusahaan</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead>Kontak</TableHead>
                  <TableHead>Lokasi</TableHead>
                  <TableHead className="text-center">Credit Limit</TableHead>
                  <TableHead className="text-center">Total Order</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Last Order</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{customer.code}</span>
                        {customer.isProspect && (
                          <Badge variant="outline" className="w-fit text-[10px] mt-1">Prospek</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium">{customer.name}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">{customer.legalName}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getCustomerTypeBadge(customer.customerType)}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center text-xs">
                          <Phone className="mr-1 h-3 w-3 text-muted-foreground" />
                          {customer.phone}
                        </div>
                        <div className="flex items-center text-xs text-muted-foreground">
                          <Mail className="mr-1 h-3 w-3" />
                          {customer.email}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center text-sm">
                        <MapPin className="mr-1 h-3 w-3 text-muted-foreground" />
                        {customer.city}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="text-sm font-medium">
                        {formatCurrency(customer.creditLimit).replace(/\D00$/, '')}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="text-sm font-medium">
                        {formatCurrency(customer.totalOrderValue).replace(/\D00$/, '')}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {getCreditStatusBadge(customer.creditStatus)}
                    </TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">
                      {formatDate(customer.lastOrderDate)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Buka menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Aksi</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem asChild>
                            <Link href={`/sales/customers/${customer.id}`}>
                              <Eye className="mr-2 h-4 w-4" />
                              Lihat Detail
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/sales/customers/${customer.id}/edit`}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Data
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem asChild>
                            <Link href={`/sales/quotations/new?customerId=${customer.id}`}>
                              <Plus className="mr-2 h-4 w-4" />
                              Buat Penawaran
                            </Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredCustomers.length === 0 && (
            <div className="text-center py-4">
              <p className="text-muted-foreground">Tidak ada data pelanggan yang ditemukan</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}