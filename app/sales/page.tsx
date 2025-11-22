"use client"

import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Users,
  FileText,
  DollarSign,
  Target,
  Phone,
  Calendar,
  PlusCircle,
  ShoppingBag,
  Briefcase,
  ArrowUpRight,
  ArrowDownRight,
  Clock
} from "lucide-react"
import Link from "next/link"
import { IconTrendingUp, IconTrendingDown } from "@tabler/icons-react"

// Mock data untuk sales dashboard - Textile Factory Context
const salesMetrics = {
  totalCustomers: 156,
  activeLeads: 23,
  monthlyQuotations: 45,
  monthlyRevenue: 2450000000, // 2.45 miliar
  conversionRate: 68.5,
  pendingOrders: 12,
  thisMonthCalls: 89,
  upcomingFollowups: 15
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

export default function SalesDashboard() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard Penjualan</h2>
          <p className="text-muted-foreground">
            Overview kinerja penjualan kain, benang, dan manajemen relasi pelanggan
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" asChild>
            <Link href="/sales/leads/new">
              <PlusCircle className="mr-2 h-4 w-4" />
              Lead Baru
            </Link>
          </Button>
          <Button asChild>
            <Link href="/sales/quotations/new">
              <FileText className="mr-2 h-4 w-4" />
              Buat Penawaran
            </Link>
          </Button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs @xl:grid-cols-2 @5xl:grid-cols-4">
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Total Revenue</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-green-600">
              {formatCurrency(salesMetrics.monthlyRevenue).replace(/\D00$/, '')}
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="border-green-600 text-green-600">
                <IconTrendingUp />
                +12.5%
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium text-green-600">
              Omset bulan ini <DollarSign className="size-4" />
            </div>
            <div className="text-muted-foreground">
              Target: Rp 3.000.000.000
            </div>
          </CardFooter>
        </Card>

        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Pelanggan Aktif</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {salesMetrics.totalCustomers}
            </CardTitle>
            <CardAction>
              <Badge variant="outline">
                <Users className="mr-1 size-3" />
                Mitra
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">
              Pabrik & Distributor <Briefcase className="size-4" />
            </div>
            <div className="text-muted-foreground">
              Total database pelanggan
            </div>
          </CardFooter>
        </Card>

        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Lead & Prospek</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-blue-600">
              {salesMetrics.activeLeads}
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
              Dalam negosiasi <Target className="size-4" />
            </div>
            <div className="text-muted-foreground">
              Peluang deal baru
            </div>
          </CardFooter>
        </Card>

        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Conversion Rate</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {salesMetrics.conversionRate}%
            </CardTitle>
            <CardAction>
              <Badge variant="outline">
                <IconTrendingUp />
                Efektif
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">
              Lead to Customer <Users className="size-4" />
            </div>
            <div className="text-muted-foreground">
              Rata-rata industri: 45%
            </div>
          </CardFooter>
        </Card>
      </div>

      {/* Quick Actions & Recent Activity */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Quick Actions */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Aksi Cepat</CardTitle>
            <CardDescription>
              Akses cepat fitur penjualan harian
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <Button variant="outline" className="h-24 flex-col hover:bg-primary/5 hover:border-primary/50 transition-all" asChild>
                <Link href="/sales/customers">
                  <Users className="h-8 w-8 mb-3 text-blue-600" />
                  <span className="font-medium">Data Pelanggan</span>
                  <span className="text-xs text-muted-foreground mt-1">Kelola database mitra</span>
                </Link>
              </Button>
              <Button variant="outline" className="h-24 flex-col hover:bg-primary/5 hover:border-primary/50 transition-all" asChild>
                <Link href="/sales/leads">
                  <Target className="h-8 w-8 mb-3 text-orange-600" />
                  <span className="font-medium">Pipeline Lead</span>
                  <span className="text-xs text-muted-foreground mt-1">Monitor prospek</span>
                </Link>
              </Button>
              <Button variant="outline" className="h-24 flex-col hover:bg-primary/5 hover:border-primary/50 transition-all" asChild>
                <Link href="/sales/quotations">
                  <FileText className="h-8 w-8 mb-3 text-green-600" />
                  <span className="font-medium">Buat Penawaran</span>
                  <span className="text-xs text-muted-foreground mt-1">Kirim quotation kain</span>
                </Link>
              </Button>
              <Button variant="outline" className="h-24 flex-col hover:bg-primary/5 hover:border-primary/50 transition-all" asChild>
                <Link href="/sales/orders">
                  <ShoppingBag className="h-8 w-8 mb-3 text-purple-600" />
                  <span className="font-medium">Sales Order</span>
                  <span className="text-xs text-muted-foreground mt-1">Proses pesanan masuk</span>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Activity Summary */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Aktivitas Penjualan</CardTitle>
            <CardDescription>
              Ringkasan aktivitas tim sales minggu ini
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center space-x-4">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                    <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Penawaran Terkirim</p>
                    <p className="text-xs text-muted-foreground">Quotation kain & jasa celup</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-blue-600">{salesMetrics.monthlyQuotations}</p>
                  <p className="text-xs text-muted-foreground">dokumen</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center space-x-4">
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-full">
                    <Phone className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Interaksi Pelanggan</p>
                    <p className="text-xs text-muted-foreground">Call & Meeting visit pabrik</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-green-600">{salesMetrics.thisMonthCalls}</p>
                  <p className="text-xs text-muted-foreground">aktivitas</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center space-x-4">
                  <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
                    <Calendar className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Jadwal Follow-up</p>
                    <p className="text-xs text-muted-foreground">Agenda 7 hari ke depan</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-yellow-600">{salesMetrics.upcomingFollowups}</p>
                  <p className="text-xs text-muted-foreground">agenda</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Quotations & Top Customers */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Penawaran Terbaru</CardTitle>
            <CardDescription>
              Status quotation yang baru dibuat
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { id: "QT-2411-001", customer: "PT. Garment Indah Jaya", amount: 45000000, status: "Sent", date: "Hari ini" },
                { id: "QT-2411-002", customer: "CV. Tekstil Makmur", amount: 32000000, status: "Draft", date: "Kemarin" },
                { id: "QT-2411-003", customer: "Boutique Fashion A", amount: 78000000, status: "Accepted", date: "2 hari lalu" },
                { id: "QT-2411-004", customer: "UD. Kain Sejahtera", amount: 23000000, status: "Sent", date: "3 hari lalu" },
                { id: "QT-2411-005", customer: "PT. Mode Nusantara", amount: 56000000, status: "Draft", date: "4 hari lalu" }
              ].map((quote) => (
                <div key={quote.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-muted rounded-md">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{quote.customer}</p>
                      <div className="flex items-center text-xs text-muted-foreground">
                        <span className="font-mono mr-2">{quote.id}</span>
                        <span>• {quote.date}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{formatCurrency(quote.amount).replace(/\D00$/, '')}</p>
                    <Badge variant={quote.status === 'Accepted' ? 'default' : quote.status === 'Sent' ? 'secondary' : 'outline'} className="text-[10px] h-5">
                      {quote.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Pelanggan</CardTitle>
            <CardDescription>
              Kontribusi revenue tertinggi bulan ini
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { name: "PT. Garment Indah Jaya", value: 245000000, orders: 8, type: "Pabrik" },
                { name: "CV. Tekstil Makmur", value: 189000000, orders: 5, type: "Distributor" },
                { name: "Boutique Fashion A", value: 156000000, orders: 4, type: "Retail" },
                { name: "UD. Kain Sejahtera", value: 134000000, orders: 6, type: "Grosir" },
                { name: "PT. Mode Nusantara", value: 98000000, orders: 3, type: "Brand" }
              ].map((customer, index) => (
                <div key={customer.name} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${index === 0 ? "bg-yellow-100 text-yellow-700" :
                        index === 1 ? "bg-gray-100 text-gray-700" :
                          index === 2 ? "bg-orange-100 text-orange-700" :
                            "bg-muted text-muted-foreground"
                      }`}>
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{customer.name}</p>
                      <p className="text-xs text-muted-foreground">{customer.type} • {customer.orders} order</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-green-600">{formatCurrency(customer.value).replace(/\D00$/, '')}</p>
                    <div className="flex items-center justify-end text-xs text-green-600">
                      <ArrowUpRight className="h-3 w-3 mr-1" />
                      High Value
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}