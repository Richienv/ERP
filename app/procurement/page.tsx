"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ShoppingCart,
  Truck,
  Package,
  AlertCircle,
  FileText,
  TrendingDown,
  Plus,
  ArrowRight
} from "lucide-react";
import Link from "next/link";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";

const procurementMetrics = {
  activeOrders: 12,
  pendingRequests: 5,
  lowStockItems: 8,
  monthlySpend: 145000000,
  topVendors: [
    { name: "PT. Supplier Utama", amount: 45000000 },
    { name: "CV. Material Jaya", amount: 32000000 },
    { name: "UD. Sumber Alam", amount: 28000000 },
  ],
  recentOrders: [
    { id: "PO-2024-001", vendor: "PT. Supplier Utama", status: "Dikirim", date: "2024-11-20", amount: 12500000 },
    { id: "PO-2024-002", vendor: "CV. Material Jaya", status: "Menunggu Persetujuan", date: "2024-11-21", amount: 8500000 },
    { id: "PO-2024-003", vendor: "Global Electronics Ltd", status: "Diterima", date: "2024-11-18", amount: 45000000 },
  ]
};

const spendData = [
  { name: "Jan", total: 120000000 },
  { name: "Feb", total: 135000000 },
  { name: "Mar", total: 125000000 },
  { name: "Apr", total: 145000000 },
  { name: "Mei", total: 160000000 },
  { name: "Jun", total: 140000000 },
];

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

export default function ProcurementDashboard() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard Pengadaan</h2>
          <p className="text-muted-foreground">
            Overview aktivitas pembelian dan manajemen pemasok
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button asChild>
            <Link href="/procurement/orders/new">
              <Plus className="mr-2 h-4 w-4" />
              Buat Pesanan (PO)
            </Link>
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pesanan Aktif</CardTitle>
            <ShoppingCart className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{procurementMetrics.activeOrders}</div>
            <p className="text-xs text-muted-foreground">
              PO dalam proses
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Permintaan Pending</CardTitle>
            <FileText className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{procurementMetrics.pendingRequests}</div>
            <p className="text-xs text-muted-foreground">
              Menunggu persetujuan
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pengeluaran Bulan Ini</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(procurementMetrics.monthlySpend)}
            </div>
            <p className="text-xs text-muted-foreground">
              Total pembelian November
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stok Menipis</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{procurementMetrics.lowStockItems}</div>
            <p className="text-xs text-muted-foreground">
              Item perlu restock segera
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Spend Analytics */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Analisis Pengeluaran</CardTitle>
            <CardDescription>
              Tren pengeluaran pengadaan 6 bulan terakhir
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={spendData}>
                  <XAxis
                    dataKey="name"
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `Rp${value / 1000000}jt`}
                  />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    cursor={{ fill: 'transparent' }}
                  />
                  <Bar
                    dataKey="total"
                    fill="currentColor"
                    radius={[4, 4, 0, 0]}
                    className="fill-primary"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Pesanan Terbaru</CardTitle>
            <CardDescription>
              Status pesanan pembelian terkini
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {procurementMetrics.recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">{order.vendor}</p>
                    <p className="text-xs text-muted-foreground">{order.id} • {order.date}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{formatCurrency(order.amount)}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${order.status === 'Diterima' ? 'bg-green-100 text-green-700' :
                        order.status === 'Dikirim' ? 'bg-blue-100 text-blue-700' :
                          'bg-yellow-100 text-yellow-700'
                      }`}>
                      {order.status}
                    </span>
                  </div>
                </div>
              ))}
              <Button variant="ghost" className="w-full mt-4" asChild>
                <Link href="/procurement/orders">
                  Lihat Semua Pesanan <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
          <CardHeader className="flex flex-row items-center gap-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Truck className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-base">Kelola Pemasok</CardTitle>
              <CardDescription>Database vendor & supplier</CardDescription>
            </div>
          </CardHeader>
        </Card>

        <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
          <CardHeader className="flex flex-row items-center gap-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <Package className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <CardTitle className="text-base">Penerimaan Barang</CardTitle>
              <CardDescription>Input barang masuk gudang</CardDescription>
            </div>
          </CardHeader>
        </Card>

        <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
          <CardHeader className="flex flex-row items-center gap-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <FileText className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <CardTitle className="text-base">Laporan Pembelian</CardTitle>
              <CardDescription>Analisa performa pengadaan</CardDescription>
            </div>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}