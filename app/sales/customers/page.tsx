"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { AlertCircle, Building2, Filter, Plus, RefreshCcw, Search, ShoppingBag, User, Users } from "lucide-react"
import { IconTrendingUp } from "@tabler/icons-react"

import { useCustomers } from "@/hooks/use-customers"
import { CustomerRolodexCard } from "@/components/sales/customer-rolodex-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export default function CustomersPage() {
  const { data, isLoading, isFetching, refetch } = useCustomers()
  const customers = data?.customers ?? []
  const summary = data?.summary ?? { totalCustomers: 0, totalProspects: 0, activeCustomers: 0, creditWatch: 0, totalRevenue: 0 }

  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")

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
      totalRevenue: filteredCustomers.reduce((sum, item) => sum + (item.totalOrderValue || 0), 0),
    }
  }, [filteredCustomers])

  return (
    <div className="mf-page min-h-screen">

      {/* COMMAND HEADER */}
      <div className="border border-border shadow-sm overflow-hidden bg-white dark:bg-zinc-900 rounded-md">
        <div className="px-6 py-4 flex items-center justify-between border-l-[6px] border-l-rose-500">
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-rose-500" />
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">
                Manajemen Pelanggan
              </h1>
              <p className="text-zinc-600 text-xs font-bold mt-0.5">
                Database pelanggan, distributor, dan prospek terintegrasi Sales CRM.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-9 border border-border font-bold text-xs shadow-sm hover:shadow-none transition-all rounded-md bg-white"
            >
              <RefreshCcw className={`mr-2 h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button asChild className="h-9 bg-slate-900 text-white hover:bg-zinc-800 border border-border shadow-sm font-semibold text-xs hover:shadow-none transition-all rounded-md px-4">
              <Link href="/sales/customers/new">
                <Plus className="mr-2 h-3.5 w-3.5" />
                Pelanggan Baru
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* KPI PULSE STRIP */}
      <div className="bg-white dark:bg-zinc-900 border border-border shadow-sm overflow-hidden rounded-md">
        <div className="grid grid-cols-2 md:grid-cols-4">
          <div className="relative p-4 md:p-5 md:border-r border-b md:border-b-0 border-zinc-100 dark:border-zinc-800">
            <div className="absolute top-0 left-0 right-0 h-1 bg-zinc-800" />
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="h-4 w-4 text-zinc-400" />
              <span className="text-xs font-semibold text-zinc-500">Total Pelanggan</span>
            </div>
            <div className="text-2xl md:text-3xl font-semibold tracking-tighter text-zinc-900">
              {filteredSummary.totalCustomers}
            </div>
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="bg-emerald-500 w-2 h-2 rounded-full inline-block animate-pulse" />
              <span className="text-xs font-bold text-emerald-600 ">{filteredSummary.activeCustomers} Aktif</span>
            </div>
          </div>

          <div className="relative p-4 md:p-5 md:border-r border-b md:border-b-0 border-zinc-100 dark:border-zinc-800">
            <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500" />
            <div className="flex items-center gap-2 mb-2">
              <User className="h-4 w-4 text-zinc-400" />
              <span className="text-xs font-semibold text-zinc-500">Prospek Baru</span>
            </div>
            <div className="text-2xl md:text-3xl font-semibold tracking-tighter text-blue-600">
              {filteredSummary.totalProspects}
            </div>
            <div className="flex items-center gap-1 mt-1.5">
              <IconTrendingUp className="h-3.5 w-3.5 text-blue-600" />
              <span className="text-xs font-bold text-blue-600 ">Pipeline Peluang</span>
            </div>
          </div>

          <div className="relative p-4 md:p-5 md:border-r border-b md:border-b-0 border-zinc-100 dark:border-zinc-800">
            <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500" />
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-zinc-400" />
              <span className="text-xs font-semibold text-zinc-500">Credit Watch</span>
            </div>
            <div className="text-2xl md:text-3xl font-semibold tracking-tighter text-amber-600">
              {filteredSummary.creditWatch}
            </div>
            <div className="flex items-center gap-1 mt-1.5">
              <span className="text-xs font-bold text-amber-600 ">Perlu Monitoring</span>
            </div>
          </div>

          <div className="relative p-4 md:p-5">
            <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
            <div className="flex items-center gap-2 mb-2">
              <ShoppingBag className="h-4 w-4 text-zinc-400" />
              <span className="text-xs font-semibold text-zinc-500">Revenue Basis</span>
            </div>
            <div className="text-2xl md:text-3xl font-semibold tracking-tighter text-emerald-600">
              {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", notation: "compact", maximumFractionDigits: 1 }).format(filteredSummary.totalRevenue)}
            </div>
            <div className="flex items-center gap-1 mt-1.5">
              <span className="text-xs font-bold text-zinc-400 ">Akumulasi Order</span>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT CONTAINER */}
      <div className="border border-border shadow-sm bg-white rounded-md flex flex-col min-h-[500px]">
        <div className="p-4 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-50">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Customer Database</h2>
            <p className="text-xs font-bold text-zinc-500">Daftar lengkap pelanggan & distributor</p>
          </div>

          <div className="flex items-center space-x-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-[320px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <Input
                placeholder="Cari pelanggan..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-9 border border-zinc-200 focus-visible:ring-0 focus-visible:border-border font-bold h-10 rounded-md bg-white transition-all"
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="border border-border shadow-sm hover:shadow-none font-semibold text-xs h-10 px-4 rounded-md bg-white">
                  <Filter className="mr-2 h-4 w-4" /> Filter
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="border border-border shadow-sm rounded-md min-w-[200px]">
                <DropdownMenuLabel className="text-xs font-semibold text-zinc-500">Status</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-zinc-200" />
                <DropdownMenuItem onClick={() => setFilterStatus("all")} className="font-bold cursor-pointer focus:bg-zinc-100 rounded-md">Semua</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterStatus("active")} className="font-bold cursor-pointer focus:bg-zinc-100 rounded-md">Aktif</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterStatus("inactive")} className="font-bold cursor-pointer focus:bg-zinc-100 rounded-md">Nonaktif</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterStatus("prospect")} className="font-bold cursor-pointer focus:bg-zinc-100 rounded-md">Prospek</DropdownMenuItem>
                <DropdownMenuSeparator className="bg-zinc-200" />
                <DropdownMenuLabel className="text-xs font-semibold text-zinc-500">Tipe</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-zinc-200" />
                <DropdownMenuItem onClick={() => setFilterType("all")} className="font-bold cursor-pointer focus:bg-zinc-100 rounded-md">Semua Tipe</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterType("COMPANY")} className="font-bold cursor-pointer focus:bg-zinc-100 rounded-md">Perusahaan</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterType("INDIVIDUAL")} className="font-bold cursor-pointer focus:bg-zinc-100 rounded-md">Perorangan</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterType("GOVERNMENT")} className="font-bold cursor-pointer focus:bg-zinc-100 rounded-md">Pemerintah</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="p-6 bg-zinc-100/30 flex-1">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 border border-dashed border-zinc-300 bg-white rounded-md">
              <RefreshCcw className="h-10 w-10 text-zinc-300 animate-spin mb-4" />
              <p className="font-bold text-zinc-400">Memuat data pelanggan...</p>
            </div>
          ) : (
            <>
              {filteredCustomers.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-zinc-300 bg-white rounded-md">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-zinc-100 border border-zinc-200 mb-4">
                    <User className="h-8 w-8 text-zinc-400" />
                  </div>
                  <p className="text-zinc-500 font-bold text-lg">Tidak ada pelanggan yang cocok.</p>
                  <p className="text-zinc-400 text-sm max-w-sm mx-auto mt-2">Coba ubah filter pencarian atau buat pelanggan baru jika belum ada.</p>
                  <Button variant="outline" onClick={() => {
                    setSearchTerm("")
                    setFilterStatus("all")
                    setFilterType("all")
                  }} className="mt-6 border border-border font-bold text-xs rounded-md hover:bg-slate-900 hover:text-white">
                    Reset Filter
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-6">
                  {filteredCustomers.map((customer) => (
                    <CustomerRolodexCard key={customer.id} customer={customer} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
