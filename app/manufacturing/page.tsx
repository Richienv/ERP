"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Factory,
  Settings,
  ClipboardList,
  CalendarClock,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Box,
  ArrowRight,
  Plus
} from "lucide-react";
import Link from "next/link";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
} from "recharts";

const productionData = [
  { name: "Sen", output: 450, target: 500 },
  { name: "Sel", output: 480, target: 500 },
  { name: "Rab", output: 520, target: 500 },
  { name: "Kam", output: 490, target: 500 },
  { name: "Jum", output: 510, target: 500 },
  { name: "Sab", output: 300, target: 300 },
];

const efficiencyData = [
  { name: "Line A", value: 92 },
  { name: "Line B", value: 88 },
  { name: "Line C", value: 95 },
  { name: "Assembly", value: 85 },
];

export default function ManufacturingDashboard() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard Manufaktur</h2>
          <p className="text-muted-foreground">
            Monitoring produksi real-time dan efisiensi operasional
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button asChild>
            <Link href="/manufacturing/orders/new">
              <Plus className="mr-2 h-4 w-4" />
              Buat Order Produksi
            </Link>
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Order Produksi Aktif</CardTitle>
            <Factory className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">8</div>
            <p className="text-xs text-muted-foreground">
              3 dalam proses, 5 terjadwal
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Efisiensi Keseluruhan (OEE)</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">89.5%</div>
            <p className="text-xs text-muted-foreground">
              +2.5% dari target mingguan
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rasio Cacat (Defect)</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">1.2%</div>
            <p className="text-xs text-muted-foreground">
              Dalam batas toleransi (Max 2%)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">On-Time Delivery</CardTitle>
            <CalendarClock className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">98%</div>
            <p className="text-xs text-muted-foreground">
              45 order selesai tepat waktu
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Production Output Chart */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Output Produksi Mingguan</CardTitle>
            <CardDescription>
              Realisasi vs Target Produksi (Unit)
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={productionData}>
                <defs>
                  <linearGradient id="colorOutput" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="output" name="Output Aktual" stroke="#2563eb" fillOpacity={1} fill="url(#colorOutput)" />
                <Area type="monotone" dataKey="target" name="Target" stroke="#94a3b8" strokeDasharray="5 5" fill="none" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Work Center Efficiency */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Efisiensi Pusat Kerja</CardTitle>
            <CardDescription>
              Performa per lini produksi (%)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={efficiencyData} layout="vertical">
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis dataKey="name" type="category" width={80} fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: 'transparent' }} />
                <Bar dataKey="value" name="Efisiensi %" fill="#16a34a" radius={[0, 4, 4, 0]} barSize={32}>
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions & Recent Activity */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Aktivitas Produksi Terkini</CardTitle>
            <CardDescription>Status update dari lantai produksi</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { id: "MO-2024-089", item: "Kursi Ergonomis X1", status: "Selesai", time: "10 menit yang lalu", user: "Budi Santoso" },
                { id: "MO-2024-090", item: "Meja Kantor L-Shape", status: "Dalam Proses", time: "45 menit yang lalu", user: "Siti Aminah" },
                { id: "MO-2024-091", item: "Lemari Arsip 3 Pintu", status: "QC Check", time: "1 jam yang lalu", user: "Rudi Hermawan" },
                { id: "MO-2024-092", item: "Rak Buku Minimalis", status: "Menunggu Material", time: "2 jam yang lalu", user: "Gudang Bahan" },
              ].map((activity, i) => (
                <div key={i} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-full ${activity.status === 'Selesai' ? 'bg-green-100 text-green-600' :
                        activity.status === 'Dalam Proses' ? 'bg-blue-100 text-blue-600' :
                          activity.status === 'QC Check' ? 'bg-purple-100 text-purple-600' :
                            'bg-yellow-100 text-yellow-600'
                      }`}>
                      <Box className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{activity.item}</p>
                      <p className="text-xs text-muted-foreground">{activity.id} • Oleh {activity.user}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${activity.status === 'Selesai' ? 'bg-green-100 text-green-700' :
                        activity.status === 'Dalam Proses' ? 'bg-blue-100 text-blue-700' :
                          activity.status === 'QC Check' ? 'bg-purple-100 text-purple-700' :
                            'bg-yellow-100 text-yellow-700'
                      }`}>
                      {activity.status}
                    </span>
                    <p className="text-[10px] text-muted-foreground mt-1">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Menu Cepat</CardTitle>
            <CardDescription>Akses fitur utama</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link href="/manufacturing/bom">
                <Settings className="mr-2 h-4 w-4" />
                Kelola BoM
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link href="/manufacturing/planning">
                <CalendarClock className="mr-2 h-4 w-4" />
                Jadwal Produksi
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link href="/manufacturing/quality">
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Inspeksi Kualitas
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link href="/manufacturing/work-orders">
                <ClipboardList className="mr-2 h-4 w-4" />
                Laporan Hasil Kerja
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}