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
  FileText,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  ArrowRight,
  Building2,
  Printer,
  Mail
} from "lucide-react"
import Link from "next/link"
import { IconTrendingUp, IconTrendingDown } from "@tabler/icons-react"

// Mock data untuk quotations - Textile Factory Context
const mockQuotations = [
  {
    id: "1",
    number: "QT-2411-001",
    customerId: "1",
    customerName: "PT. Garment Indah Jaya",
    customerRef: "REQ-GIJ-001",
    quotationDate: "2024-11-20",
    validUntil: "2024-11-27",
    status: "SENT",
    subtotal: 45000000,
    taxAmount: 4950000,
    discountAmount: 0,
    total: 49950000,
    itemCount: 3,
    salesPerson: "Ahmad Setiawan",
    notes: "Penawaran kain Cotton Combed 30s & 24s"
  },
  {
    id: "2",
    number: "QT-2411-002",
    customerId: "2",
    customerName: "CV. Tekstil Makmur",
    customerRef: "PROJ-TM-A",
    quotationDate: "2024-11-19",
    validUntil: "2024-11-26",
    status: "ACCEPTED",
    subtotal: 32000000,
    taxAmount: 3520000,
    discountAmount: 1600000,
    total: 33920000,
    itemCount: 5,
    salesPerson: "Siti Rahmawati",
    notes: "Quote accepted, lanjut PO batch 1"
  },
  {
    id: "3",
    number: "QT-2411-003",
    customerId: "3",
    customerName: "Boutique Fashion A",
    customerRef: null,
    quotationDate: "2024-11-10",
    validUntil: "2024-11-17",
    status: "EXPIRED",
    subtotal: 78000000,
    taxAmount: 8580000,
    discountAmount: 3900000,
    total: 82680000,
    itemCount: 8,
    salesPerson: "Budi Prasetyo",
    notes: "Expired, customer minta revisi harga"
  },
  {
    id: "4",
    number: "QT-2411-004",
    customerId: "4",
    customerName: "UD. Kain Sejahtera",
    customerRef: "PO-REQ-456",
    quotationDate: "2024-11-21",
    validUntil: "2024-11-28",
    status: "DRAFT",
    subtotal: 23000000,
    taxAmount: 2530000,
    discountAmount: 0,
    total: 25530000,
    itemCount: 2,
    salesPerson: "Ahmad Setiawan",
    notes: "Draft penawaran jasa celup"
  },
  {
    id: "5",
    number: "QT-2411-005",
    customerId: "5",
    customerName: "PT. Mode Nusantara",
    customerRef: "REQ-MN-789",
    quotationDate: "2024-11-15",
    validUntil: "2024-11-22",
    status: "REJECTED",
    subtotal: 56000000,
    taxAmount: 6160000,
    discountAmount: 2800000,
    total: 59360000,
    itemCount: 4,
    salesPerson: "Siti Rahmawati",
    notes: "Ditolak, harga kompetitor lebih rendah"
  },
  {
    id: "6",
    number: "QT-2411-006",
    customerId: "1",
    customerName: "PT. Garment Indah Jaya",
    customerRef: "REQ-GIJ-002",
    quotationDate: "2024-11-18",
    validUntil: "2024-11-25",
    status: "CONVERTED",
    subtotal: 89000000,
    taxAmount: 9790000,
    discountAmount: 4450000,
    total: 94340000,
    itemCount: 6,
    salesPerson: "Budi Prasetyo",
    notes: "Converted to SO-2411-003"
  }
]

// Get quotation status badge
const getQuotationStatusBadge = (status: string) => {
  switch (status) {
    case 'DRAFT':
      return <Badge variant="secondary" className="bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300">Draft</Badge>
    case 'SENT':
      return <Badge variant="default" className="bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800">Terkirim</Badge>
    case 'ACCEPTED':
      return <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800">Diterima</Badge>
    case 'REJECTED':
      return <Badge variant="destructive" className="bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800">Ditolak</Badge>
    case 'EXPIRED':
      return <Badge variant="outline" className="bg-orange-100 text-orange-800 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800">Kedaluwarsa</Badge>
    case 'CONVERTED':
      return <Badge variant="default" className="bg-purple-100 text-purple-800 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800">Dikonversi</Badge>
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
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Check if quotation is expiring soon (within 3 days)
const isExpiringSoon = (validUntil: string) => {
  const today = new Date()
  const expiryDate = new Date(validUntil)
  const diffTime = expiryDate.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays <= 3 && diffDays > 0
}

export default function QuotationsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterSalesPerson, setFilterSalesPerson] = useState("all")

  // Filter quotations
  const filteredQuotations = mockQuotations.filter(quotation => {
    const matchesSearch = quotation.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quotation.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (quotation.customerRef && quotation.customerRef.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesStatus = filterStatus === "all" || quotation.status === filterStatus
    const matchesSalesPerson = filterSalesPerson === "all" || quotation.salesPerson === filterSalesPerson
    return matchesSearch && matchesStatus && matchesSalesPerson
  })

  // Get unique sales persons
  const salesPersons = ["all", ...new Set(mockQuotations.map(q => q.salesPerson))]

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Manajemen Penawaran</h2>
          <p className="text-muted-foreground">
            Buat dan kelola penawaran harga kain, benang, dan jasa
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" asChild>
            <Link href="/sales/quotations/templates">
              <FileText className="mr-2 h-4 w-4" />
              Template
            </Link>
          </Button>
          <Button asChild>
            <Link href="/sales/quotations/new">
              <Plus className="mr-2 h-4 w-4" />
              Buat Penawaran
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs @xl:grid-cols-2 @5xl:grid-cols-4">
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Total Penawaran</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {mockQuotations.length}
            </CardTitle>
            <CardAction>
              <Badge variant="outline">
                <FileText className="mr-1 size-3" />
                Bulan Ini
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">
              Aktif & Arsip <FileText className="size-4" />
            </div>
            <div className="text-muted-foreground">
              Total dokumen dibuat
            </div>
          </CardFooter>
        </Card>

        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Menunggu Respons</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-blue-600">
              {mockQuotations.filter(q => q.status === 'SENT').length}
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="border-blue-600 text-blue-600">
                <Send className="mr-1 size-3" />
                Terkirim
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium text-blue-600">
              Follow-up segera <Clock className="size-4" />
            </div>
            <div className="text-muted-foreground">
              Menunggu persetujuan customer
            </div>
          </CardFooter>
        </Card>

        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Win Rate</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-green-600">
              {Math.round((mockQuotations.filter(q => q.status === 'ACCEPTED' || q.status === 'CONVERTED').length / mockQuotations.length) * 100)}%
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="border-green-600 text-green-600">
                <IconTrendingUp />
                Sukses
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium text-green-600">
              Diterima/Converted <CheckCircle className="size-4" />
            </div>
            <div className="text-muted-foreground">
              Konversi ke Sales Order
            </div>
          </CardFooter>
        </Card>

        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Perlu Perhatian</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-yellow-600">
              {mockQuotations.filter(q => q.status === 'EXPIRED' || isExpiringSoon(q.validUntil)).length}
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="border-yellow-600 text-yellow-600">
                <Clock className="mr-1 size-3" />
                Urgent
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium text-yellow-600">
              Expiring/Expired <IconTrendingDown className="size-4" />
            </div>
            <div className="text-muted-foreground">
              Perbarui masa berlaku
            </div>
          </CardFooter>
        </Card>
      </div>

      {/* Quotations Table */}
      <Card>
        <CardHeader>
          <CardTitle>Daftar Penawaran Harga</CardTitle>
          <CardDescription>
            Monitor status penawaran dan konversi penjualan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari nomor quotation, nama customer, atau referensi PO..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
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
                <DropdownMenuItem onClick={() => setFilterStatus("DRAFT")}>
                  Draft
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterStatus("SENT")}>
                  Terkirim
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterStatus("ACCEPTED")}>
                  Diterima
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterStatus("REJECTED")}>
                  Ditolak
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterStatus("EXPIRED")}>
                  Kedaluwarsa
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterStatus("CONVERTED")}>
                  Dikonversi
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Filter className="mr-2 h-4 w-4" />
                  Sales: {filterSalesPerson === "all" ? "Semua" : filterSalesPerson}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Filter Sales Person</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setFilterSalesPerson("all")}>
                  Semua Sales
                </DropdownMenuItem>
                {salesPersons.filter(sp => sp !== "all").map((salesPerson) => (
                  <DropdownMenuItem
                    key={salesPerson}
                    onClick={() => setFilterSalesPerson(salesPerson)}
                  >
                    {salesPerson}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Quotation Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No. Quotation</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Sales Person</TableHead>
                  <TableHead className="text-center">Tanggal</TableHead>
                  <TableHead className="text-center">Valid Until</TableHead>
                  <TableHead className="text-center">Items</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredQuotations.map((quotation) => (
                  <TableRow key={quotation.id}>
                    <TableCell className="font-medium">
                      <div className="space-y-1">
                        <div className="flex items-center">
                          <FileText className="mr-2 h-3 w-3 text-muted-foreground" />
                          {quotation.number}
                        </div>
                        {quotation.customerRef && (
                          <div className="text-xs text-muted-foreground ml-5">
                            Ref: {quotation.customerRef}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{quotation.customerName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {quotation.salesPerson}
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {formatDate(quotation.quotationDate)}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className={`text-sm ${isExpiringSoon(quotation.validUntil) && quotation.status !== 'CONVERTED' && quotation.status !== 'ACCEPTED' ? 'text-red-600 font-medium' : ''}`}>
                        {formatDate(quotation.validUntil)}
                        {isExpiringSoon(quotation.validUntil) && quotation.status !== 'CONVERTED' && quotation.status !== 'ACCEPTED' && (
                          <div className="text-[10px] text-red-600 flex items-center justify-center mt-0.5">
                            <Clock className="h-3 w-3 mr-1" /> Expiring
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="font-normal">
                        {quotation.itemCount} item
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="space-y-1">
                        <div className="text-sm font-bold">{formatCurrency(quotation.total).replace(/\D00$/, '')}</div>
                        {quotation.discountAmount > 0 && (
                          <div className="text-[10px] text-green-600">
                            Hemat {formatCurrency(quotation.discountAmount).replace(/\D00$/, '')}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {getQuotationStatusBadge(quotation.status)}
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
                            <Link href={`/sales/quotations/${quotation.id}`}>
                              <Eye className="mr-2 h-4 w-4" />
                              Lihat Detail
                            </Link>
                          </DropdownMenuItem>
                          {(quotation.status === 'DRAFT' || quotation.status === 'SENT') && (
                            <DropdownMenuItem asChild>
                              <Link href={`/sales/quotations/${quotation.id}/edit`}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </Link>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          {quotation.status === 'DRAFT' && (
                            <DropdownMenuItem>
                              <Send className="mr-2 h-4 w-4" />
                              Kirim via Email
                            </DropdownMenuItem>
                          )}
                          {(quotation.status === 'ACCEPTED' || quotation.status === 'SENT') && (
                            <DropdownMenuItem asChild>
                              <Link href={`/sales/orders/new?quotationId=${quotation.id}`}>
                                <ArrowRight className="mr-2 h-4 w-4" />
                                Konversi ke SO
                              </Link>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem>
                            <Printer className="mr-2 h-4 w-4" />
                            Cetak PDF
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredQuotations.length === 0 && (
            <div className="text-center py-4">
              <p className="text-muted-foreground">Tidak ada penawaran yang ditemukan</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}