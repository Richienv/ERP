"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AlertCircle, Building2, Filter, Plus, RefreshCcw, Search, ShoppingBag, User } from "lucide-react"
import { IconTrendingUp } from "@tabler/icons-react"
import { toast } from "sonner"

import { CustomerRolodexCard } from "@/components/sales/customer-rolodex-card"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface CustomerItem {
  id: string
  code: string
  name: string
  customerType: string
  city: string
  phone: string
  email: string
  creditStatus: string
  totalOrderValue: number
  lastOrderDate: string | null
  isActive: boolean
  isProspect: boolean
}

interface CustomerSummary {
  totalCustomers: number
  totalProspects: number
  activeCustomers: number
  creditWatch: number
  totalRevenue: number
}

interface CustomersResponse {
  success: boolean
  data: CustomerItem[]
  summary?: CustomerSummary
  error?: string
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerItem[]>([])
  const [summary, setSummary] = useState<CustomerSummary>({
    totalCustomers: 0,
    totalProspects: 0,
    activeCustomers: 0,
    creditWatch: 0,
    totalRevenue: 0,
  })
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadCustomers = useCallback(async () => {
    setRefreshing(true)
    try {
      const response = await fetch("/api/sales/customers", {
        cache: "no-store",
      })
      const payload: CustomersResponse = await response.json()
      if (!payload.success) {
        throw new Error(payload.error || "Failed to load customers")
      }

      setCustomers(payload.data || [])
      setSummary(payload.summary || {
        totalCustomers: 0,
        totalProspects: 0,
        activeCustomers: 0,
        creditWatch: 0,
        totalRevenue: 0,
      })
    } catch (error: any) {
      toast.error(error?.message || "Gagal memuat data pelanggan")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadCustomers()
  }, [loadCustomers])

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const normalizedSearch = searchTerm.toLowerCase()
      const matchesSearch =
        customer.name.toLowerCase().includes(normalizedSearch)
        || customer.code.toLowerCase().includes(normalizedSearch)
        || customer.email.toLowerCase().includes(normalizedSearch)

      const matchesType = filterType === "all" || customer.customerType === filterType

      const matchesStatus =
        filterStatus === "all"
        || (filterStatus === "active" && customer.isActive)
        || (filterStatus === "inactive" && !customer.isActive)
        || (filterStatus === "prospect" && customer.isProspect)

      return matchesSearch && matchesType && matchesStatus
    })
  }, [customers, searchTerm, filterType, filterStatus])

  const filteredSummary = useMemo(() => {
    return {
      totalCustomers: filteredCustomers.filter((item) => !item.isProspect).length,
      totalProspects: filteredCustomers.filter((item) => item.isProspect).length,
      activeCustomers: filteredCustomers.filter((item) => item.isActive).length,
      creditWatch: filteredCustomers.filter((item) => ["WATCH", "HOLD", "BLOCKED"].includes(item.creditStatus)).length,
    }
  }, [filteredCustomers])

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Manajemen Pelanggan</h2>
          <p className="text-muted-foreground">
            Database pelanggan, distributor, dan prospek terintegrasi Sales CRM.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={loadCustomers} disabled={refreshing}>
            <RefreshCcw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button asChild>
            <Link href="/sales/customers/new">
              <Plus className="mr-2 h-4 w-4" />
              Pelanggan Baru
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-zinc-900 text-white">
          <CardHeader className="pb-2">
            <CardDescription className="text-zinc-400 font-bold uppercase tracking-wider text-xs">Total Pelanggan</CardDescription>
            <div className="flex justify-between items-end">
              <CardTitle className="text-4xl font-black">{filteredSummary.totalCustomers}</CardTitle>
              <div className="h-8 w-8 rounded bg-zinc-800 flex items-center justify-center border border-zinc-700">
                <Building2 className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardFooter className="pt-0 pb-4">
            <div className="flex items-center gap-2 text-sm text-zinc-300">
              <span className="bg-emerald-500 w-2 h-2 rounded-full inline-block animate-pulse" />
              <span>{summary.activeCustomers} active</span>
            </div>
          </CardFooter>
        </Card>

        <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white">
          <CardHeader className="pb-2">
            <CardDescription className="text-muted-foreground font-bold uppercase tracking-wider text-xs">Prospek Baru</CardDescription>
            <div className="flex justify-between items-end">
              <CardTitle className="text-4xl font-black">{filteredSummary.totalProspects}</CardTitle>
              <div className="h-8 w-8 rounded bg-blue-50 flex items-center justify-center border border-blue-200">
                <User className="h-4 w-4 text-blue-600" />
              </div>
            </div>
          </CardHeader>
          <CardFooter className="pt-0 pb-4">
            <div className="flex items-center gap-2 text-sm font-bold text-blue-600">
              <IconTrendingUp className="h-4 w-4" />
              <span>Pipeline peluang</span>
            </div>
          </CardFooter>
        </Card>

        <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white">
          <CardHeader className="pb-2">
            <CardDescription className="text-muted-foreground font-bold uppercase tracking-wider text-xs">Credit Watch</CardDescription>
            <div className="flex justify-between items-end">
              <CardTitle className="text-4xl font-black text-orange-600">{filteredSummary.creditWatch}</CardTitle>
              <div className="h-8 w-8 rounded bg-orange-50 flex items-center justify-center border border-orange-200">
                <AlertCircle className="h-4 w-4 text-orange-600" />
              </div>
            </div>
          </CardHeader>
          <CardFooter className="pt-0 pb-4">
            <div className="flex items-center gap-2 text-sm font-bold text-orange-600">
              <span>Perlu monitoring</span>
            </div>
          </CardFooter>
        </Card>

        <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white">
          <CardHeader className="pb-2">
            <CardDescription className="text-muted-foreground font-bold uppercase tracking-wider text-xs">Revenue Basis</CardDescription>
            <div className="flex justify-between items-end">
              <CardTitle className="text-3xl font-black">
                {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", notation: "compact", maximumFractionDigits: 1 }).format(summary.totalRevenue)}
              </CardTitle>
              <div className="h-8 w-8 rounded bg-zinc-100 flex items-center justify-center border border-black">
                <ShoppingBag className="h-4 w-4 text-black" />
              </div>
            </div>
          </CardHeader>
          <CardFooter className="pt-0 pb-4">
            <div className="text-sm text-muted-foreground">
              Akumulasi value order pelanggan
            </div>
          </CardFooter>
        </Card>
      </div>

      <Card className="border-0 shadow-none bg-transparent">
        <CardHeader className="px-0 pt-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-2xl font-black uppercase tracking-tight">Customer Database</CardTitle>
              <CardDescription className="text-base font-medium text-black/60">Daftar lengkap pelanggan & distributor</CardDescription>
            </div>

            <div className="flex items-center space-x-2">
              <div className="relative w-full md:w-[320px]">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari pelanggan..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
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
                  <DropdownMenuLabel>Status</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setFilterStatus("all")}>Semua</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterStatus("active")}>Aktif</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterStatus("inactive")}>Nonaktif</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterStatus("prospect")}>Prospek</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Tipe</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setFilterType("all")}>Semua Tipe</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterType("COMPANY")}>Perusahaan</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterType("INDIVIDUAL")}>Perorangan</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterType("GOVERNMENT")}>Pemerintah</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>

        <div className="px-0">
          {loading ? (
            <div className="text-center py-12 border-2 border-dashed border-zinc-300 rounded-xl text-muted-foreground">
              Memuat data pelanggan...
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                {filteredCustomers.map((customer) => (
                  <CustomerRolodexCard key={customer.id} customer={customer} />
                ))}
              </div>

              {filteredCustomers.length === 0 && (
                <div className="text-center py-12 border-2 border-dashed border-zinc-300 rounded-xl">
                  <p className="text-muted-foreground font-medium text-lg">Tidak ada pelanggan yang cocok.</p>
                  <Button variant="link" onClick={() => {
                    setSearchTerm("")
                    setFilterStatus("all")
                    setFilterType("all")
                  }}>
                    Reset Filter
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  )
}
