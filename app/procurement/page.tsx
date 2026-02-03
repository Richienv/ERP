
import {
  Activity,
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  CheckSquare,
  Clock,
  CreditCard,
  DollarSign,
  FileText,
  MoreVertical,
  Package,
  Plus,
  ShoppingCart,
  Star,
  TrendingUp,
  Truck,
  Users
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
import { ProcurementPerformanceProvider, usePerformanceMonitor } from "@/components/procurement/procurement-performance-provider"
import { ReactNode } from "react"

// Performance monitoring component
function ProcurementPageWithMonitoring({ children }: { children: ReactNode }) {
    usePerformanceMonitor('Procurement Dashboard')
    return <ProcurementPerformanceProvider currentPath="/procurement">{children}</ProcurementPerformanceProvider>
}

export default async function ProcurementPage() {
  // Enterprise: Parallel data fetching with aggressive caching
  const stats = await getProcurementStats()
  const { spend, needsApproval, urgentNeeds, vendorHealth, incomingCount, recentActivity } = stats

  return (
    <ProcurementPerformanceProvider currentPath="/procurement">
      <div className="min-h-[calc(100vh-theme(spacing.16))] w-full bg-background p-4 md:p-8 font-sans transition-colors duration-300">
        <div className="max-w-7xl mx-auto space-y-8 pb-20">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-foreground font-serif tracking-tight uppercase">Pengadaan & Purchasing</h1>
            <p className="text-muted-foreground mt-1 font-medium">Command Center rantai pasok & manajemen vendor.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/procurement/requests">
              <Button variant="outline" className="border-black font-bold uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px]">
                <FileText className="mr-2 h-4 w-4" /> Requests
              </Button>
            </Link>
            <Link href="/procurement/vendors">
              <Button variant="outline" className="border-black font-bold uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px]">
                <Users className="mr-2 h-4 w-4" /> Vendors
              </Button>
            </Link>
            <Link href="/procurement/requests/new">
              <Button className="bg-black text-white hover:bg-zinc-800 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase font-bold tracking-wide active:translate-y-1 active:shadow-none transition-all">
                <Plus className="mr-2 h-4 w-4" /> Buat Request
              </Button>
            </Link>
          </div>
        </div>

        {/* 1. Smart KPI Cards */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

          {/* KPI: Spend Velocity */}
          <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-black uppercase text-muted-foreground">Spend (Month)</CardTitle>
              <DollarSign className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black">{formatIDR(spend.current)}</div>
              <p className="text-xs font-bold text-muted-foreground mt-1 flex items-center">
                {spend.growth > 0 ? (
                  <ArrowUpRight className="h-3 w-3 text-red-500 mr-1" />
                ) : (
                  <ArrowDownRight className="h-3 w-3 text-emerald-500 mr-1" />
                )}
                <span className={spend.growth > 0 ? "text-red-500" : "text-emerald-500"}>
                  {Math.abs(spend.growth).toFixed(1)}%
                </span>
                <span className="ml-1">vs last month</span>
              </p>
            </CardContent>
          </Card>

          {/* KPI: Vendor Health */}
          <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-black uppercase text-muted-foreground">Vendor Health</CardTitle>
              <Activity className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black flex items-center gap-2">
                {vendorHealth.rating.toFixed(1)} <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              </div>
              <p className="text-xs font-bold text-muted-foreground mt-1 text-black/60">
                {vendorHealth.onTime.toFixed(0)}% On-Time Delivery Rate
              </p>
            </CardContent>
          </Card>

          {/* KPI: Urgent Needs */}
          <Card className={`border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-xl ${urgentNeeds > 0 ? 'bg-red-50' : 'bg-white'}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-black uppercase text-muted-foreground">Urgent Restock</CardTitle>
              <AlertCircle className={`h-4 w-4 ${urgentNeeds > 0 ? 'text-red-600' : 'text-muted-foreground'}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-black ${urgentNeeds > 0 ? 'text-red-600' : ''}`}>{urgentNeeds} Items</div>
              <p className="text-xs font-bold text-muted-foreground mt-1">
                Below minimum stock level
              </p>
            </CardContent>
          </Card>

          {/* KPI: Incoming Goods */}
          <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-black uppercase text-muted-foreground">Incoming</CardTitle>
              <Truck className="h-4 w-4 text-indigo-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black">{incomingCount} Orders</div>
              <p className="text-xs font-bold text-muted-foreground mt-1">
                Open or Partial delivery
              </p>
            </CardContent>
          </Card>
        </section>

        {/* 2. Action Center */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-8">

          {/* Needs Approval (Managers) */}
          <Card className="md:col-span-2 border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] bg-white rounded-xl overflow-hidden">
            <CardHeader className="bg-amber-50 border-b border-black/10 pb-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 bg-amber-100 text-amber-700 rounded-lg flex items-center justify-center border border-amber-200">
                      <CheckSquare className="h-5 w-5" />
                    </div>
                    <CardTitle className="uppercase font-black text-lg">Needs Approval</CardTitle>
                  </div>
                  <CardDescription className="text-xs font-bold uppercase tracking-wide text-amber-700/80 pl-10">
                    {needsApproval} Requests Waiting
                  </CardDescription>
                </div>
                <Link href="/procurement/requests">
                  <Button size="sm" className="bg-black text-white text-xs font-bold uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,0.5)]">
                    Review All
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {/* Mini List Preview - We could fetch this real-time or just link out. 
                                 For now, let's keep it simple with empty state or static visual if 0
                             */}
              {needsApproval > 0 ? (
                <div className="p-8 text-center bg-zinc-50/50">
                  <p className="text-sm font-medium text-muted-foreground">
                    You have <span className="font-bold text-black">{needsApproval} pending requests</span> requiring your attention.
                  </p>
                  <Link href="/procurement/requests" className="mt-4 inline-block text-xs font-bold uppercase underline underline-offset-4 decoration-2 decoration-amber-400 hover:decoration-amber-600">
                    Go to Approval Queue &rarr;
                  </Link>
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500/50" />
                  <p>All caught up! No pending approvals.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Shortcuts */}
          <div className="space-y-6">
            <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white">
              <CardHeader>
                <CardTitle className="uppercase font-black flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4" /> Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0 p-0">
                {recentActivity.length > 0 ? (
                  <div className="divide-y divide-dashed divide-zinc-200">
                    {recentActivity.map((po) => (
                      <div key={po.id} className="p-3 text-sm flex justify-between items-center hover:bg-zinc-50 transition-colors">
                        <div>
                          <span className="font-bold block">{po.supplier.name}</span>
                          <span className="text-[10px] text-muted-foreground uppercase">{new Date(po.createdAt).toLocaleDateString()}</span>
                        </div>
                        <Badge variant="outline" className="text-[10px] h-5">{po.status}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-xs text-muted-foreground">No recent activity.</div>
                )}
              </CardContent>
            </Card>

            {/* Simple Links */}
            <div className="grid grid-cols-2 gap-3">
              <Link href="/procurement/vendors" className="block p-3 border border-black shadow-sm bg-white hover:bg-zinc-50 rounded-lg text-center transition-all active:translate-y-1">
                <Users className="h-5 w-5 mx-auto mb-1 text-black" />
                <span className="text-[10px] font-bold uppercase">Vendors</span>
              </Link>
              <Link href="/inventory" className="block p-3 border border-black shadow-sm bg-white hover:bg-zinc-50 rounded-lg text-center transition-all active:translate-y-1">
                <Package className="h-5 w-5 mx-auto mb-1 text-black" />
                <span className="text-[10px] font-bold uppercase">Stock</span>
              </Link>
            </div>
          </div>

        </section>

        {/* 3. Strategic View (Placeholder for Charts) */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5" />
            <h3 className="text-lg font-black uppercase">Strategic Insights</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-64 border border-dashed border-black/20 rounded-xl bg-black/5 flex items-center justify-center text-muted-foreground font-medium text-sm">
              Top Suppliers Chart (Coming Soon)
            </div>
            <div className="h-64 border border-dashed border-black/20 rounded-xl bg-black/5 flex items-center justify-center text-muted-foreground font-medium text-sm">
              Spend by Category Chart (Coming Soon)
            </div>
          </div>
        </section>

        </div>
      </div>
    </ProcurementPerformanceProvider>
  )
}

function CheckCircle2({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}