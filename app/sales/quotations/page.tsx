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
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowRight,
  Building2,
  Printer,
  Mail
} from "lucide-react"
import Link from "next/link"
import { IconTrendingUp, IconTrendingDown } from "@tabler/icons-react"
import { QuotationKanban } from "@/components/sales/quotation-kanban"

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

      {/* Stats Cards - Ritchie Minimal */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <CardDescription className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Pipe Value (Sent)</CardDescription>
                <CardTitle className="text-3xl font-black">
                  {formatCurrency(mockQuotations.filter(q => q.status === 'SENT').reduce((acc, q) => acc + q.total, 0)).replace(/\D00$/, '')}
                </CardTitle>
              </div>
              <div className="h-8 w-8 rounded bg-blue-50 border border-blue-200 flex items-center justify-center">
                <IconTrendingUp className="h-4 w-4 text-blue-600" />
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <CardDescription className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Win Rate</CardDescription>
                <CardTitle className="text-3xl font-black text-emerald-600">
                  {Math.round((mockQuotations.filter(q => q.status === 'ACCEPTED' || q.status === 'CONVERTED').length / mockQuotations.length) * 100)}%
                </CardTitle>
              </div>
              <div className="h-8 w-8 rounded bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                <CheckCircle className="h-4 w-4 text-emerald-600" />
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <CardDescription className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Active Deals</CardDescription>
                <CardTitle className="text-3xl font-black text-black">
                  {mockQuotations.filter(q => q.status === 'SENT' || q.status === 'DRAFT').length}
                </CardTitle>
              </div>
              <Badge variant="outline" className="border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                Target: 15
              </Badge>
            </div>
          </CardHeader>
        </Card>

        <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-red-50">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <CardDescription className="font-bold text-xs uppercase tracking-wider text-red-800">Stalled / Expiring</CardDescription>
                <CardTitle className="text-3xl font-black text-red-600">
                  {mockQuotations.filter(q => q.status === 'EXPIRED' || isExpiringSoon(q.validUntil)).length}
                </CardTitle>
              </div>
              <div className="h-8 w-8 rounded bg-white border border-red-200 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4 text-red-600" />
              </div>
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* Kanban Board Area */}
      <div className="flex items-center space-x-4 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search deals..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
          />
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" className="border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-bold">
            <Filter className="mr-2 h-4 w-4" /> Filter by Sales
          </Button>
          <Button className="border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-bold bg-black text-white hover:bg-zinc-800" asChild>
            <Link href="/sales/quotations/new">
              <Plus className="mr-2 h-4 w-4" /> New Quote
            </Link>
          </Button>
        </div>
      </div>

      <div className="h-full">
        <QuotationKanban quotations={filteredQuotations} />
      </div>

      {filteredQuotations.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground font-medium">No quotations match your filter.</p>
        </div>
      )}
    </div>
  )
}