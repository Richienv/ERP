import {
  CreditCard,
  DollarSign,
  Package,
  ShoppingCart,
  Users,
  FileText,
  Plus,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Truck
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { getProcurementStats } from "@/lib/actions/procurement"
import { formatIDR } from "@/lib/utils"
import Link from "next/link"
import { ProcurementModules } from "@/components/procurement/procurement-modules"

export default async function ProcurementPage() {
  const stats = await getProcurementStats()

  return (
    <div className="min-h-[calc(100vh-theme(spacing.16))] w-full bg-background p-4 md:p-8 font-sans transition-colors duration-300">
      <div className="max-w-7xl mx-auto space-y-8 pb-20">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-foreground font-serif tracking-tight uppercase">Pengadaan & Purchasing</h1>
            <p className="text-muted-foreground mt-1 font-medium">Kontrol pembelanjaan, relasi vendor, dan pemenuhan material.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="border-black font-bold uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px]">
              Laporan Spend
            </Button>
            <Link href="/procurement/orders/new">
              <Button className="bg-black text-white hover:bg-zinc-800 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase font-bold tracking-wide active:translate-y-1 active:shadow-none transition-all">
                <Plus className="mr-2 h-4 w-4" /> Buat PO Baru
              </Button>
            </Link>
          </div>
        </div>

        {/* "Unit 3" Key Metrics */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* 1. Open PO Value */}
          <Card className="group relative border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[3px] hover:translate-y-[3px] transition-all bg-white rounded-xl overflow-hidden">
            <div className="h-2 w-full bg-emerald-500 border-b border-black/10" />
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-emerald-100 border border-black/10 text-emerald-700 rounded-lg flex items-center justify-center">
                  <DollarSign className="h-6 w-6" />
                </div>
                <div>
                  <CardDescription className="font-bold text-emerald-700 uppercase text-[10px] tracking-wide">Active Spend</CardDescription>
                  <CardTitle className="text-2xl font-black uppercase">Open PO Value</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-black">
                  {formatIDR(stats.openPOValue)}
                </span>
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-xs font-bold uppercase text-muted-foreground">
                  <span>Budget Usage</span>
                  <span>65%</span>
                </div>
                <Progress value={65} className="h-2 border border-black/10 bg-zinc-100" indicatorClassName="bg-emerald-500" />
              </div>
            </CardContent>
          </Card>

          {/* 2. Pending Approvals */}
          <Card className="group relative border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[3px] hover:translate-y-[3px] transition-all bg-white rounded-xl overflow-hidden">
            <div className="h-2 w-full bg-amber-500 border-b border-black/10" />
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-amber-100 border border-black/10 text-amber-700 rounded-lg flex items-center justify-center">
                  <FileText className="h-6 w-6" />
                </div>
                <div>
                  <CardDescription className="font-bold text-amber-700 uppercase text-[10px] tracking-wide">Action Required</CardDescription>
                  <CardTitle className="text-2xl font-black uppercase">Pending Approval</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-black">{stats.pendingCount}</span>
                <span className="text-sm font-bold text-muted-foreground uppercase">Requests</span>
              </div>
              <p className="text-xs font-bold text-black/60 mt-2">Menunggu persetujuan manajer.</p>
            </CardContent>
            <CardFooter className="pt-0 pb-4">
            </CardFooter>
          </Card>

          {/* 3. Receivables -> Incoming Goods */}
          <Card className="group relative border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[3px] hover:translate-y-[3px] transition-all bg-white rounded-xl overflow-hidden">
            <div className="h-2 w-full bg-blue-500 border-b border-black/10" />
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-blue-100 border border-black/10 text-blue-700 rounded-lg flex items-center justify-center">
                  <Truck className="h-6 w-6" />
                </div>
                <div>
                  <CardDescription className="font-bold text-blue-700 uppercase text-[10px] tracking-wide">In Transit</CardDescription>
                  <CardTitle className="text-2xl font-black uppercase">Incoming Goods</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-black">{stats.incomingCount}</span>
                <span className="text-sm font-bold text-muted-foreground uppercase">Orders</span>
              </div>
              <p className="text-xs font-bold text-black/60 mt-2">Estimasi tiba minggu ini.</p>
            </CardContent>
          </Card>

        </section>

        {/* Quick Launch */}
        <ProcurementModules />

        {/* Activity Stream */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white">
            <CardHeader>
              <CardTitle className="uppercase font-black flex items-center gap-2">
                <Clock className="h-5 w-5" /> Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              {stats.recentActivity.length > 0 ? (
                stats.recentActivity.map((po, i) => (
                  <div key={po.id} className="flex gap-4 py-3 border-b border-dashed border-zinc-200 last:border-0 hover:bg-zinc-50 p-2 rounded-lg transition-colors">
                    <div className="h-2 w-2 mt-2 rounded-full bg-black/20" />
                    <div>
                      <p className="text-sm font-bold">{po.number} Created</p>
                      <p className="text-xs text-muted-foreground">
                        {po.supplier.name} • {new Date(po.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="ml-auto">
                      <Badge variant="outline" className="text-[10px] border-black/20">{po.status}</Badge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  Belum ada aktivitas.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white">
            <CardHeader>
              <CardTitle className="uppercase font-black flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" /> Procurement Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Keeping static alerts for now, can be dynamic later */}
              <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
                <div>
                  <h4 className="text-sm font-bold text-red-900">Vendor Contract Expiring</h4>
                  <p className="text-xs text-red-700 mt-1">Kontrak "PT Textile Jaya" berakhir dalam 14 hari.</p>
                </div>
                <Button size="sm" variant="outline" className="ml-auto h-7 text-xs border-red-200 text-red-700 hover:bg-red-100 border-2">
                  Renew
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

      </div>
    </div>
  )
}