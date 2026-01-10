"use client"

import { useState } from "react"
import {
  Search,
  Filter,
  MoreHorizontal,
  Check,
  X,
  AlertTriangle,
  Package,
  Clock,
  Settings,
  Bell,
  ShieldAlert,
  ArrowRight,
  RefreshCcw,
  AlertOctagon
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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

// Mock data
const mockStockAlerts = [
  {
    id: "1",
    product: { code: "FAB-DEN-001", name: "Kain Denim Raw 14oz", currentStock: 8, minStock: 15, unit: "roll" },
    alertType: "LOW_STOCK",
    threshold: 15,
    severity: "medium",
    warehouse: "Gudang Bahan Baku",
    time: "2 jam lalu"
  },
  {
    id: "2",
    product: { code: "ACC-BTN-001", name: "Kancing Kemeja 18L - Putih", currentStock: 0, minStock: 50, unit: "gross" },
    alertType: "OUT_OF_STOCK",
    threshold: 0,
    severity: "high",
    warehouse: "Gudang Aksesori",
    time: "4 jam lalu"
  },
  {
    id: "3",
    product: { code: "FAB-RAY-001", name: "Kain Rayon Viscose - Motif", currentStock: 3, minStock: 10, unit: "roll" },
    alertType: "LOW_STOCK",
    threshold: 10,
    severity: "high",
    warehouse: "Gudang Bahan Baku",
    time: "Hari ini"
  },
  {
    id: "4",
    product: { code: "THR-PLY-001", name: "Benang Polyester 40/2", currentStock: 520, maxStock: 500, unit: "cone" },
    alertType: "OVERSTOCK",
    threshold: 500,
    severity: "low",
    warehouse: "Gudang Bahan Baku",
    time: "Kemarin"
  },
  {
    id: "5",
    product: { code: "CHEM-DYE-001", name: "Pewarna Tekstil Indigo Blue", currentStock: 25, minStock: 20, unit: "kg", expiryDate: "2024-12-15" },
    alertType: "EXPIRY_WARNING",
    threshold: 45,
    severity: "medium",
    warehouse: "Gudang Kimia",
    time: "2 hari lalu"
  }
]

export default function StockAlertsPage() {
  const [searchTerm, setSearchTerm] = useState("")

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 font-sans">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black font-serif tracking-tight text-black">Peringatan Stok</h2>
          <p className="text-muted-foreground mt-1 font-medium">
            Pusat notifikasi kritis untuk anomali inventori.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="border-black font-bold uppercase hover:bg-zinc-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all">
            <Settings className="mr-2 h-4 w-4" /> Konfigurasi
          </Button>
          <Button className="bg-black text-white hover:bg-zinc-800 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase font-bold tracking-wide active:translate-y-1 active:shadow-none transition-all">
            <RefreshCcw className="mr-2 h-4 w-4" /> Scan Ulang
          </Button>
        </div>
      </div>

      {/* "Unit 3" Alert Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Card 1: Critical / Out of Stock */}
        <Card className="group relative border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[3px] hover:translate-y-[3px] transition-all bg-white rounded-xl overflow-hidden">
          <div className="h-2 w-full bg-red-500 border-b border-black/10" />
          <div className="absolute top-4 right-4 animate-pulse">
            <div className="h-3 w-3 bg-red-500 rounded-full" />
          </div>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-red-100 border border-black/10 text-red-600 rounded-lg flex items-center justify-center">
                <AlertOctagon className="h-6 w-6" />
              </div>
              <div>
                <CardDescription className="font-bold text-red-600 uppercase text-[10px] tracking-wide">Critical Attention</CardDescription>
                <CardTitle className="text-2xl font-black uppercase">Habis Stok</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black text-black">1</span>
              <span className="text-sm font-bold text-muted-foreground uppercase">Item Kosong</span>
            </div>
            <p className="text-xs font-medium text-black/60 mt-2">Berdampak langsung pada produksi.</p>
          </CardContent>
          <CardFooter className="pt-0 pb-4">
            <Button variant="outline" size="sm" className="w-full border-black font-bold uppercase text-xs hover:bg-red-50 hover:text-red-700">Lihat Detail <ArrowRight className="ml-2 h-3 w-3" /></Button>
          </CardFooter>
        </Card>

        {/* Card 2: Warnings / Low Stock */}
        <Card className="group relative border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[3px] hover:translate-y-[3px] transition-all bg-white rounded-xl overflow-hidden">
          <div className="h-2 w-full bg-amber-400 border-b border-black/10" />
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-amber-100 border border-black/10 text-amber-600 rounded-lg flex items-center justify-center">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <CardDescription className="font-bold text-amber-600 uppercase text-[10px] tracking-wide">Warning Level</CardDescription>
                <CardTitle className="text-2xl font-black uppercase">Stok Menipis</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black text-black">2</span>
              <span className="text-sm font-bold text-muted-foreground uppercase">Item</span>
            </div>
            <p className="text-xs font-medium text-black/60 mt-2">Perlu re-order dalam 3 hari.</p>
          </CardContent>
          <CardFooter className="pt-0 pb-4">
            <Button variant="outline" size="sm" className="w-full border-black font-bold uppercase text-xs hover:bg-amber-50 hover:text-amber-700">Lihat Detail <ArrowRight className="ml-2 h-3 w-3" /></Button>
          </CardFooter>
        </Card>

        {/* Card 3: New / Overstock */}
        <Card className="group relative border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[3px] hover:translate-y-[3px] transition-all bg-white rounded-xl overflow-hidden">
          <div className="h-2 w-full bg-blue-500 border-b border-black/10" />
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-blue-100 border border-black/10 text-blue-600 rounded-lg flex items-center justify-center">
                <Package className="h-6 w-6" />
              </div>
              <div>
                <CardDescription className="font-bold text-blue-600 uppercase text-[10px] tracking-wide">Optimization</CardDescription>
                <CardTitle className="text-2xl font-black uppercase">Over Stock</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black text-black">1</span>
              <span className="text-sm font-bold text-muted-foreground uppercase">Item</span>
            </div>
            <p className="text-xs font-medium text-black/60 mt-2">Kelebihan muatan gudang.</p>
          </CardContent>
          <CardFooter className="pt-0 pb-4">
            <Button variant="outline" size="sm" className="w-full border-black font-bold uppercase text-xs hover:bg-blue-50 hover:text-blue-700">Lihat Detail <ArrowRight className="ml-2 h-3 w-3" /></Button>
          </CardFooter>
        </Card>

      </div>

      {/* Main Alerts Table */}
      <Card className="border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-xl overflow-hidden bg-white mt-8">
        <CardHeader className="bg-zinc-50 border-b border-black py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="uppercase font-black text-lg">Daftar Notifikasi</CardTitle>
              <CardDescription className="text-xs font-medium text-black/60">Monitoring log peringatan sistem.</CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="relative w-full md:w-[250px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Cari SKU / Nama..." className="pl-8 h-9 border-black text-xs font-medium" />
              </div>
              <Button variant="outline" size="sm" className="border-black shadow-sm font-bold h-9 bg-white"><Filter className="h-3.5 w-3.5 mr-2" /> Filter</Button>
            </div>
          </div>
        </CardHeader>
        <div className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b border-black bg-zinc-100/50">
                <TableHead className="w-[120px] font-bold text-black uppercase text-xs">SKU Code</TableHead>
                <TableHead className="font-bold text-black uppercase text-xs">Material Name</TableHead>
                <TableHead className="font-bold text-black uppercase text-xs">Alert Type</TableHead>
                <TableHead className="text-center font-bold text-black uppercase text-xs">Status</TableHead>
                <TableHead className="font-bold text-black uppercase text-xs">Location</TableHead>
                <TableHead className="text-right font-bold text-black uppercase text-xs">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockStockAlerts.map((alert) => (
                <TableRow key={alert.id} className="cursor-pointer hover:bg-zinc-50 group border-b border-black/5">
                  <TableCell className="font-mono text-xs font-bold text-muted-foreground group-hover:text-black">{alert.product.code}</TableCell>
                  <TableCell>
                    <span className="font-bold block text-sm">{alert.product.name}</span>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {alert.time}
                    </span>
                  </TableCell>
                  <TableCell>
                    <AlertBadge type={alert.alertType} />
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="font-black">{alert.product.currentStock}</span>
                    <span className="text-xs text-muted-foreground ml-1">{alert.product.unit}</span>
                    <div className="text-[10px] font-bold text-black/40 mt-0.5">Threshold: {alert.threshold}</div>
                  </TableCell>
                  <TableCell className="text-xs font-medium text-muted-foreground">{alert.warehouse}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-black hover:text-white rounded-full">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  )
}

function AlertBadge({ type }: { type: string }) {
  switch (type) {
    case 'OUT_OF_STOCK':
      return <Badge variant="destructive" className="border-black shadow-sm font-bold uppercase text-[10px] tracking-wide animate-pulse">Habis Stok</Badge>
    case 'LOW_STOCK':
      return <Badge className="bg-amber-100 text-amber-800 border-black hover:bg-amber-200 uppercase font-bold text-[10px] tracking-wide">Stok Menipis</Badge>
    case 'OVERSTOCK':
      return <Badge variant="outline" className="text-blue-700 border-blue-200 bg-blue-50 uppercase font-bold text-[10px] tracking-wide">Over</Badge>
    case 'EXPIRY_WARNING':
      return <Badge variant="outline" className="text-orange-700 border-orange-200 bg-orange-50 uppercase font-bold text-[10px] tracking-wide">Expired</Badge>
    default:
      return <Badge variant="outline">Unknown</Badge>
  }
}