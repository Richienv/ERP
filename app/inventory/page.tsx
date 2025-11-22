"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
import { IconTrendingDown, IconTrendingUp } from "@tabler/icons-react"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Package,
  Warehouse,
  AlertTriangle,
  Plus,
  Boxes,
  Activity
} from "lucide-react"
import Link from "next/link"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import { Label } from "@/components/ui/label"

// Mock data untuk textile factory
const dashboardMetrics = {
  totalFabricRolls: 3247,
  totalCategories: 12,
  totalWarehouses: 3,
  lowStockItems: 24,
  outOfStockItems: 5,
  totalStockValue: 1850000000,
  monthlyMovements: {
    stockIn: 382,
    stockOut: 298
  },
  topFabricTypes: [
    { name: "Katun Premium", rolls: 842, value: 520000000, percentage: 28 },
    { name: "Polyester", rolls: 656, value: 380000000, percentage: 21 },
    { name: "Rayon", rolls: 503, value: 295000000, percentage: 16 },
    { name: "Linen", rolls: 389, value: 240000000, percentage: 13 }
  ],
  recentActivities: [
    { type: "IN", product: "Katun Combed 30s - Putih", quantity: 150, warehouse: "Gudang Utama", time: "1 jam lalu" },
    { type: "OUT", product: "Polyester PE100 - Hitam", quantity: 80, warehouse: "Gudang Produksi", time: "3 jam lalu" },
    { type: "ADJUSTMENT", product: "Rayon Viscose - Navy", quantity: -5, warehouse: "Gudang Utama", time: "5 jam lalu" },
    { type: "IN", product: "Linen Blend - Natural", quantity: 60, warehouse: "Gudang Bahan Baku", time: "8 jam lalu" }
  ],
  stockAlerts: [
    { product: "Benang Jahit Polyester 40/2", currentStock: 15, minStock: 50, status: "CRITICAL" },
    { product: "Kancing Putih 18mm", currentStock: 0, minStock: 1000, status: "OUT" },
    { product: "Resleting Jepang 60cm", currentStock: 120, minStock: 500, status: "LOW" }
  ]
}

const stockMovementData = [
  { date: "2024-10-01", masuk: 245, keluar: 180 },
  { date: "2024-10-05", masuk: 310, keluar: 220 },
  { date: "2024-10-10", masuk: 280, keluar: 195 },
  { date: "2024-10-15", masuk: 365, keluar: 240 },
  { date: "2024-10-20", masuk: 295, keluar: 210 },
  { date: "2024-10-25", masuk: 420, keluar: 280 },
  { date: "2024-10-30", masuk: 380, keluar: 260 },
  { date: "2024-11-01", masuk: 350, keluar: 230 },
  { date: "2024-11-05", masuk: 390, keluar: 270 },
  { date: "2024-11-10", masuk: 410, keluar: 290 },
  { date: "2024-11-15", masuk: 385, keluar: 265 },
  { date: "2024-11-20", masuk: 425, keluar: 305 },
]

const chartConfig = {
  masuk: {
    label: "Masuk",
    color: "var(--primary)",
  },
  keluar: {
    label: "Keluar",
    color: "hsl(var(--destructive))",
  },
} satisfies ChartConfig

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

export default function InventoryDashboard() {
  const isMobile = useIsMobile()
  const [timeRange, setTimeRange] = React.useState("30d")

  const filteredData = stockMovementData.filter((item) => {
    const date = new Date(item.date)
    const referenceDate = new Date("2024-11-20")
    let daysToSubtract = 30
    if (timeRange === "7d") {
      daysToSubtract = 7
    } else if (timeRange === "60d") {
      daysToSubtract = 60
    }
    const startDate = new Date(referenceDate)
    startDate.setDate(startDate.getDate() - daysToSubtract)
    return date >= startDate
  })

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dasbor Inventori Tekstil</h2>
          <p className="text-muted-foreground">
            Monitoring stok kain, benang, dan bahan produksi
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Tambah Material
          </Button>
        </div>
      </div>

      {/* Quick Stats - Enhanced with gradients and trending */}
      <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs @xl:grid-cols-2 @5xl:grid-cols-4">
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Total Roll Kain</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {dashboardMetrics.totalFabricRolls.toLocaleString('id-ID')}
            </CardTitle>
            <CardAction>
              <Badge variant="outline">
                <IconTrendingUp />
                +15.2%
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">
              Stok naik bulan ini <IconTrendingUp className="size-4" />
            </div>
            <div className="text-muted-foreground">
              {dashboardMetrics.totalCategories} jenis kain tekstil
            </div>
          </CardFooter>
        </Card>

        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Nilai Total Inventori</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {formatCurrency(dashboardMetrics.totalStockValue).replace(/\D00$/, '')}
            </CardTitle>
            <CardAction>
              <Badge variant="outline">
                <IconTrendingUp />
                +8.5%
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">
              Investasi stok meningkat <IconTrendingUp className="size-4" />
            </div>
            <div className="text-muted-foreground">
              Nilai aset bahan produksi
            </div>
          </CardFooter>
        </Card>

        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Material Menipis</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-yellow-600">
              {dashboardMetrics.lowStockItems}
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="border-yellow-600 text-yellow-600">
                <IconTrendingDown />
                Perhatian
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium text-yellow-600">
              {dashboardMetrics.outOfStockItems} item habis stok
            </div>
            <div className="text-muted-foreground">
              Segera lakukan restock
            </div>
          </CardFooter>
        </Card>

        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Pergerakan Bulan Ini</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {dashboardMetrics.monthlyMovements.stockIn + dashboardMetrics.monthlyMovements.stockOut}
            </CardTitle>
            <CardAction>
              <Badge variant="outline">
                <IconTrendingUp />
                +12%
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">
              Aktivitas inventori tinggi
            </div>
            <div className="text-muted-foreground">
              {dashboardMetrics.monthlyMovements.stockIn} masuk, {dashboardMetrics.monthlyMovements.stockOut} keluar
            </div>
          </CardFooter>
        </Card>
      </div>

      {/* Stock Movement Chart */}
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>Pergerakan Stok Bahan Tekstil</CardTitle>
          <CardDescription>
            <span className="hidden @[540px]/card:block">
              Monitoring keluar masuk material produksi
            </span>
            <span className="@[540px]/card:hidden">Monitoring material</span>
          </CardDescription>
          <CardAction>
            <ToggleGroup
              type="single"
              value={timeRange}
              onValueChange={setTimeRange}
              variant="outline"
              className="hidden *:data-[slot=toggle-group-item]:!px-4 @[767px]/card:flex"
            >
              <ToggleGroupItem value="60d">60 hari terakhir</ToggleGroupItem>
              <ToggleGroupItem value="30d">30 hari terakhir</ToggleGroupItem>
              <ToggleGroupItem value="7d">7 hari terakhir</ToggleGroupItem>
            </ToggleGroup>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger
                className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
                size="sm"
                aria-label="Select a value"
              >
                <SelectValue placeholder="30 hari terakhir" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="60d" className="rounded-lg">
                  60 hari terakhir
                </SelectItem>
                <SelectItem value="30d" className="rounded-lg">
                  30 hari terakhir
                </SelectItem>
                <SelectItem value="7d" className="rounded-lg">
                  7 hari terakhir
                </SelectItem>
              </SelectContent>
            </Select>
          </CardAction>
        </CardHeader>
        <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-[250px] w-full"
          >
            <AreaChart data={filteredData}>
              <defs>
                <linearGradient id="fillMasuk" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-masuk)"
                    stopOpacity={1.0}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-masuk)"
                    stopOpacity={0.1}
                  />
                </linearGradient>
                <linearGradient id="fillKeluar" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-keluar)"
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-keluar)"
                    stopOpacity={0.1}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={(value) => {
                  const date = new Date(value)
                  return date.toLocaleDateString("id-ID", {
                    month: "short",
                    day: "numeric",
                  })
                }}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => {
                      return new Date(value).toLocaleDateString("id-ID", {
                        month: "short",
                        day: "numeric",
                      })
                    }}
                    indicator="dot"
                  />
                }
              />
              <Area
                dataKey="keluar"
                type="natural"
                fill="url(#fillKeluar)"
                stroke="var(--color-keluar)"
                stackId="a"
              />
              <Area
                dataKey="masuk"
                type="natural"
                fill="url(#fillMasuk)"
                stroke="var(--color-masuk)"
                stackId="a"
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Main Content Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Top Fabric Types */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Jenis Kain Utama</CardTitle>
            <CardDescription>
              Berdasarkan nilai stok material
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dashboardMetrics.topFabricTypes.map((fabric, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">{fabric.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {fabric.rolls} roll tersedia
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{formatCurrency(fabric.value).replace(/\D00$/, '')}</p>
                      <p className="text-xs text-muted-foreground">{fabric.percentage}% dari total</p>
                    </div>
                  </div>
                  <Progress
                    value={fabric.percentage}
                    className="h-2"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Stock Alerts */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Peringatan Stok</CardTitle>
            <CardDescription>
              Material yang perlu segera di-restock
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dashboardMetrics.stockAlerts.map((alert, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="space-y-1 flex-1">
                    <p className="text-sm font-medium leading-none">{alert.product}</p>
                    <p className="text-xs text-muted-foreground">
                      Stok: {alert.currentStock} / Min: {alert.minStock}
                    </p>
                  </div>
                  <Badge
                    variant={alert.status === 'OUT' ? 'destructive' : alert.status === 'CRITICAL' ? 'destructive' : 'secondary'}
                  >
                    {alert.status === 'OUT' ? 'Habis' : alert.status === 'CRITICAL' ? 'Kritis' : 'Rendah'}
                  </Badge>
                </div>
              ))}
            </div>
            <Button variant="outline" className="w-full mt-4" asChild>
              <Link href="/inventory/alerts">
                Lihat Semua Peringatan
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activities */}
      <Card>
        <CardHeader>
          <CardTitle>Aktivitas Material Terbaru</CardTitle>
          <CardDescription>
            Transaksi keluar masuk bahan produksi hari ini
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {dashboardMetrics.recentActivities.map((activity, index) => (
              <div key={index} className="flex items-center space-x-3 p-3 border rounded-lg">
                <div className={`p-2 rounded-full ${activity.type === 'IN' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' :
                    activity.type === 'OUT' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                      'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                  }`}>
                  {activity.type === 'IN' ? <Package className="h-4 w-4" /> :
                    activity.type === 'OUT' ? <Boxes className="h-4 w-4" /> :
                      <Activity className="h-4 w-4" />}
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium leading-none">{activity.product}</p>
                  <p className="text-xs text-muted-foreground">
                    {activity.type === 'IN' ? '+' : activity.type === 'OUT' ? '-' : ''}{activity.quantity} roll • {activity.warehouse}
                  </p>
                </div>
                <div className="text-xs text-muted-foreground">
                  {activity.time}
                </div>
              </div>
            ))}
          </div>
          <Button variant="outline" className="w-full mt-4" asChild>
            <Link href="/inventory/movements">
              Lihat Semua Aktivitas
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Quick Access Menu */}
      <Card>
        <CardHeader>
          <CardTitle>Akses Cepat Manajemen Material</CardTitle>
          <CardDescription>
            Kelola kain, benang, dan aksesori produksi
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button variant="outline" className="h-24 flex-col space-y-2" asChild>
              <Link href="/inventory/products">
                <Package className="h-6 w-6" />
                <span>Material Kain</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-24 flex-col space-y-2" asChild>
              <Link href="/inventory/stock">
                <Boxes className="h-6 w-6" />
                <span>Level Stok</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-24 flex-col space-y-2" asChild>
              <Link href="/inventory/warehouses">
                <Warehouse className="h-6 w-6" />
                <span>Gudang</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-24 flex-col space-y-2" asChild>
              <Link href="/inventory/adjustments">
                <AlertTriangle className="h-6 w-6" />
                <span>Penyesuaian</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}