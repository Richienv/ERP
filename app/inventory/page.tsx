"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { 
  Package, 
  Warehouse, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  BarChart3,
  Plus,
  Search,
  Filter
} from "lucide-react"
import Link from "next/link"

// Mock data untuk dashboard metrics
const dashboardMetrics = {
  totalProducts: 1247,
  totalCategories: 23,
  totalWarehouses: 5,
  lowStockItems: 18,
  outOfStockItems: 3,
  totalStockValue: 2847500000, // dalam rupiah
  monthlyMovements: {
    stockIn: 245,
    stockOut: 198
  },
  topCategories: [
    { name: "Elektronik", products: 342, value: 850000000 },
    { name: "Furniture", products: 156, value: 420000000 },
    { name: "Peralatan Kantor", products: 203, value: 280000000 },
    { name: "Bahan Baku", products: 89, value: 350000000 }
  ],
  recentActivities: [
    { type: "IN", product: "Laptop Dell Inspiron", quantity: 25, warehouse: "Gudang Utama", time: "2 jam lalu" },
    { type: "OUT", product: "Meja Kantor", quantity: 12, warehouse: "Gudang Cabang", time: "4 jam lalu" },
    { type: "ADJUSTMENT", product: "Printer HP", quantity: -2, warehouse: "Gudang Utama", time: "6 jam lalu" },
    { type: "IN", product: "Kertas A4", quantity: 100, warehouse: "Gudang Cabang", time: "1 hari lalu" }
  ],
  stockAlerts: [
    { product: "Tinta Printer Canon", currentStock: 8, minStock: 10, status: "LOW" },
    { product: "Baterai Laptop", currentStock: 0, minStock: 5, status: "OUT" },
    { product: "Mouse Wireless", currentStock: 3, minStock: 15, status: "CRITICAL" }
  ]
}

// Format currency helper
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount)
}

export default function InventoryDashboard() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dasbor Inventori</h2>
          <p className="text-muted-foreground">
            Overview dan ringkasan aktivitas inventori
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Produk Baru
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Produk</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardMetrics.totalProducts.toLocaleString('id-ID')}</div>
            <p className="text-xs text-muted-foreground">
              {dashboardMetrics.totalCategories} kategori
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Nilai Total Stok</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(dashboardMetrics.totalStockValue)}</div>
            <p className="text-xs text-muted-foreground">
              +12% dari bulan lalu
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stok Menipis</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{dashboardMetrics.lowStockItems}</div>
            <p className="text-xs text-muted-foreground">
              {dashboardMetrics.outOfStockItems} habis stok
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gudang Aktif</CardTitle>
            <Warehouse className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardMetrics.totalWarehouses}</div>
            <p className="text-xs text-muted-foreground">
              Lokasi penyimpanan
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Stock Movements */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Pergerakan Stok Bulan Ini</CardTitle>
            <CardDescription>
              Ringkasan masuk dan keluar stok
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center">
                  <TrendingUp className="mr-2 h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">Stok Masuk</span>
                </div>
                <div className="text-2xl font-bold text-green-600">
                  {dashboardMetrics.monthlyMovements.stockIn}
                </div>
                <p className="text-xs text-muted-foreground">transaksi</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center">
                  <TrendingDown className="mr-2 h-4 w-4 text-red-600" />
                  <span className="text-sm font-medium">Stok Keluar</span>
                </div>
                <div className="text-2xl font-bold text-red-600">
                  {dashboardMetrics.monthlyMovements.stockOut}
                </div>
                <p className="text-xs text-muted-foreground">transaksi</p>
              </div>
            </div>
            
            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-2 pt-4">
              <Button variant="outline" className="w-full" asChild>
                <Link href="/inventory/stock">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Lihat Stok
                </Link>
              </Button>
              <Button variant="outline" className="w-full" asChild>
                <Link href="/inventory/movements">
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Riwayat Gerakan
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stock Alerts */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Peringatan Stok</CardTitle>
            <CardDescription>
              Produk yang perlu perhatian
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dashboardMetrics.stockAlerts.map((alert, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="space-y-1">
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

      {/* Categories Overview & Recent Activities */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Top Categories */}
        <Card>
          <CardHeader>
            <CardTitle>Kategori Teratas</CardTitle>
            <CardDescription>
              Berdasarkan nilai stok
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dashboardMetrics.topCategories.map((category, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">{category.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {category.products} produk
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{formatCurrency(category.value)}</p>
                    </div>
                  </div>
                  <Progress 
                    value={(category.value / dashboardMetrics.totalStockValue) * 100} 
                    className="h-2"
                  />
                </div>
              ))}
            </div>
            <Button variant="outline" className="w-full mt-4" asChild>
              <Link href="/inventory/categories">
                Kelola Kategori
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Recent Activities */}
        <Card>
          <CardHeader>
            <CardTitle>Aktivitas Terbaru</CardTitle>
            <CardDescription>
              Pergerakan stok terkini
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dashboardMetrics.recentActivities.map((activity, index) => (
                <div key={index} className="flex items-center space-x-3 p-2 border rounded-lg">
                  <div className={`p-2 rounded-full ${
                    activity.type === 'IN' ? 'bg-green-100 text-green-600' :
                    activity.type === 'OUT' ? 'bg-red-100 text-red-600' :
                    'bg-blue-100 text-blue-600'
                  }`}>
                    {activity.type === 'IN' ? <TrendingUp className="h-3 w-3" /> :
                     activity.type === 'OUT' ? <TrendingDown className="h-3 w-3" /> :
                     <BarChart3 className="h-3 w-3" />}
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-xs font-medium leading-none">{activity.product}</p>
                    <p className="text-xs text-muted-foreground">
                      {activity.type === 'IN' ? '+' : activity.type === 'OUT' ? '-' : ''}{activity.quantity} • {activity.warehouse}
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
      </div>

      {/* Quick Access Menu */}
      <Card>
        <CardHeader>
          <CardTitle>Menu Cepat</CardTitle>
          <CardDescription>
            Akses cepat ke fitur utama inventori
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button variant="outline" className="h-20 flex-col space-y-2" asChild>
              <Link href="/inventory/products">
                <Package className="h-6 w-6" />
                <span>Kelola Produk</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-20 flex-col space-y-2" asChild>
              <Link href="/inventory/stock">
                <BarChart3 className="h-6 w-6" />
                <span>Level Stok</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-20 flex-col space-y-2" asChild>
              <Link href="/inventory/warehouses">
                <Warehouse className="h-6 w-6" />
                <span>Gudang</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-20 flex-col space-y-2" asChild>
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