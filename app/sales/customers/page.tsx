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
  CreditCard,
  AlertCircle
} from "lucide-react"
import Link from "next/link"
import { IconTrendingUp, IconTrendingDown } from "@tabler/icons-react"
import { CustomerRolodexCard } from "@/components/sales/customer-rolodex-card"

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

      {/* Stats Cards - Ritchie Minimal */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-zinc-900 text-white">
          <CardHeader className="pb-2">
            <CardDescription className="text-zinc-400 font-bold uppercase tracking-wider text-xs">Total Pelanggan</CardDescription>
            <div className="flex justify-between items-end">
              <CardTitle className="text-4xl font-black">{mockCustomers.filter(c => !c.isProspect).length}</CardTitle>
              <div className="h-8 w-8 rounded bg-zinc-800 flex items-center justify-center border border-zinc-700">
                <Building2 className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardFooter className="pt-0 pb-4">
            <div className="flex items-center gap-2 text-sm text-zinc-300">
              <span className="bg-emerald-500 w-2 h-2 rounded-full inline-block animate-pulse" />
              <span>Active & Transacting</span>
            </div>
          </CardFooter>
        </Card>

        <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white">
          <CardHeader className="pb-2">
            <CardDescription className="text-muted-foreground font-bold uppercase tracking-wider text-xs">Prospek Baru</CardDescription>
            <div className="flex justify-between items-end">
              <CardTitle className="text-4xl font-black">{mockCustomers.filter(c => c.isProspect).length}</CardTitle>
              <div className="h-8 w-8 rounded bg-blue-50 flex items-center justify-center border border-blue-200">
                <User className="h-4 w-4 text-blue-600" />
              </div>
            </div>
          </CardHeader>
          <CardFooter className="pt-0 pb-4">
            <div className="flex items-center gap-2 text-sm font-bold text-blue-600">
              <IconTrendingUp className="h-4 w-4" />
              <span>Potential Leads</span>
            </div>
          </CardFooter>
        </Card>

        <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white">
          <CardHeader className="pb-2">
            <CardDescription className="text-muted-foreground font-bold uppercase tracking-wider text-xs">Credit Watch</CardDescription>
            <div className="flex justify-between items-end">
              <CardTitle className="text-4xl font-black text-orange-600">{mockCustomers.filter(c => c.creditStatus === 'WATCH' || c.creditStatus === 'HOLD').length}</CardTitle>
              <div className="h-8 w-8 rounded bg-orange-50 flex items-center justify-center border border-orange-200">
                <AlertCircle className="h-4 w-4 text-orange-600" />
              </div>
            </div>
          </CardHeader>
          <CardFooter className="pt-0 pb-4">
            <div className="flex items-center gap-2 text-sm font-bold text-orange-600">
              <span>Over Limit / Late Pay</span>
            </div>
          </CardFooter>
        </Card>

        <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white">
          <CardHeader className="pb-2">
            <CardDescription className="text-muted-foreground font-bold uppercase tracking-wider text-xs">Factory Segment</CardDescription>
            <div className="flex justify-between items-end">
              <CardTitle className="text-4xl font-black">{mockCustomers.filter(c => c.customerType === 'FACTORY').length}</CardTitle>
              <div className="h-8 w-8 rounded bg-zinc-100 flex items-center justify-center border border-black">
                <ShoppingBag className="h-4 w-4 text-black" />
              </div>
            </div>
          </CardHeader>
          <CardFooter className="pt-0 pb-4">
            <div className="text-sm text-muted-foreground">
              Mayoritas Revenue Stream
            </div>
          </CardFooter>
        </Card>
      </div>

      {/* Customers Grid Rolodex */}
      <Card className="border-0 shadow-none bg-transparent">
        <CardHeader className="px-0 pt-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-2xl font-black uppercase tracking-tight">Customer Database</CardTitle>
              <CardDescription className="text-base font-medium text-black/60">Daftar lengkap pelanggan & distributor</CardDescription>
            </div>

            <div className="flex items-center space-x-2">
              <div className="relative w-full md:w-[300px]">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search customers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] focus-visible:ring-0"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-bold">
                    <Filter className="mr-2 h-4 w-4" /> Filter
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="border-black">
                  {/* Existing filter items */}
                  <DropdownMenuLabel>Filter Tipe Pelanggan</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setFilterType("all")}>Semua Tipe</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterType("FACTORY")}>Pabrik Garment</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterType("DISTRIBUTOR")}>Distributor</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterType("RETAIL")}>Retail</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
            {filteredCustomers.map((customer) => (
              <CustomerRolodexCard key={customer.id} customer={customer} />
            ))}
          </div>

          {filteredCustomers.length === 0 && (
            <div className="text-center py-12 border-2 border-dashed border-zinc-300 rounded-xl">
              <p className="text-muted-foreground font-medium text-lg">No customers found.</p>
              <Button variant="link" onClick={() => setSearchTerm("")}>Clear Search</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}