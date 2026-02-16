export const dynamic = 'force-dynamic'

import {
  Activity,
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  FileText,
  Package,
  Plus,
  Star,
  Truck,
  Users
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { getProcurementStats } from "@/lib/actions/procurement"
import { formatIDR } from "@/lib/utils"
import Link from "next/link"
import { ProcurementPerformanceProvider } from "@/components/procurement/procurement-performance-provider"
import { InlineApprovalList } from "@/components/procurement/inline-approval-list"
import { prisma } from "@/lib/prisma"
import { ProcurementStatus, PRStatus } from "@prisma/client"

type SearchParamsValue = string | string[] | undefined

const readSearchParam = (params: Record<string, SearchParamsValue>, key: string) => {
  const value = params[key]
  if (Array.isArray(value)) return value[0]
  return value
}

const readSearchParamInt = (params: Record<string, SearchParamsValue>, key: string) => {
  const value = Number(readSearchParam(params, key))
  if (!Number.isFinite(value)) return undefined
  return Math.trunc(value)
}

function statusLabel(status: string) {
  const map: Record<string, { label: string; dot: string; bg: string; text: string }> = {
    PO_DRAFT: { label: 'Draft', dot: 'bg-zinc-400', bg: 'bg-zinc-100 border-zinc-300', text: 'text-zinc-700' },
    DRAFT: { label: 'Draft', dot: 'bg-zinc-400', bg: 'bg-zinc-100 border-zinc-300', text: 'text-zinc-700' },
    PENDING: { label: 'Pending', dot: 'bg-amber-500', bg: 'bg-amber-50 border-amber-300', text: 'text-amber-700' },
    PENDING_APPROVAL: { label: 'Pending', dot: 'bg-amber-500', bg: 'bg-amber-50 border-amber-300', text: 'text-amber-700' },
    APPROVED: { label: 'Approved', dot: 'bg-emerald-500', bg: 'bg-emerald-50 border-emerald-300', text: 'text-emerald-700' },
    PO_CREATED: { label: 'PO Created', dot: 'bg-blue-500', bg: 'bg-blue-50 border-blue-300', text: 'text-blue-700' },
    ORDERED: { label: 'Ordered', dot: 'bg-blue-500', bg: 'bg-blue-50 border-blue-300', text: 'text-blue-700' },
    VENDOR_CONFIRMED: { label: 'Confirmed', dot: 'bg-blue-500', bg: 'bg-blue-50 border-blue-300', text: 'text-blue-700' },
    SHIPPED: { label: 'Shipped', dot: 'bg-indigo-500', bg: 'bg-indigo-50 border-indigo-300', text: 'text-indigo-700' },
    PARTIAL_RECEIVED: { label: 'Partial', dot: 'bg-amber-500', bg: 'bg-amber-50 border-amber-300', text: 'text-amber-700' },
    PARTIAL_ACCEPTED: { label: 'Partial', dot: 'bg-amber-500', bg: 'bg-amber-50 border-amber-300', text: 'text-amber-700' },
    RECEIVED: { label: 'Received', dot: 'bg-emerald-500', bg: 'bg-emerald-50 border-emerald-300', text: 'text-emerald-700' },
    ACCEPTED: { label: 'Accepted', dot: 'bg-emerald-500', bg: 'bg-emerald-50 border-emerald-300', text: 'text-emerald-700' },
    COMPLETED: { label: 'Completed', dot: 'bg-emerald-600', bg: 'bg-emerald-50 border-emerald-300', text: 'text-emerald-700' },
    INSPECTING: { label: 'Inspecting', dot: 'bg-amber-500', bg: 'bg-amber-50 border-amber-300', text: 'text-amber-700' },
    REJECTED: { label: 'Rejected', dot: 'bg-red-500', bg: 'bg-red-50 border-red-300', text: 'text-red-700' },
    CANCELLED: { label: 'Cancelled', dot: 'bg-zinc-400', bg: 'bg-zinc-100 border-zinc-300', text: 'text-zinc-500' },
  }
  return map[status] || { label: status, dot: 'bg-zinc-400', bg: 'bg-zinc-100 border-zinc-300', text: 'text-zinc-700' }
}

export default async function ProcurementPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, SearchParamsValue>> | Record<string, SearchParamsValue>
}) {
  const resolvedSearchParams = searchParams
    ? (typeof (searchParams as Promise<Record<string, SearchParamsValue>>).then === "function"
      ? await (searchParams as Promise<Record<string, SearchParamsValue>>)
      : (searchParams as Record<string, SearchParamsValue>))
    : {}

  const currentParams = new URLSearchParams()
  for (const [key, raw] of Object.entries(resolvedSearchParams)) {
    if (Array.isArray(raw)) {
      if (raw[0]) currentParams.set(key, raw[0])
    } else if (raw) {
      currentParams.set(key, raw)
    }
  }

  const buildHref = (overrides: Record<string, string | null>) => {
    const next = new URLSearchParams(currentParams.toString())
    Object.entries(overrides).forEach(([key, value]) => {
      if (!value) next.delete(key)
      else next.set(key, value)
    })
    const qs = next.toString()
    return qs ? `/procurement?${qs}` : "/procurement"
  }

  const stats = await getProcurementStats({
    registryQuery: {
      purchaseOrders: {
        status: readSearchParam(resolvedSearchParams, "po_status"),
        page: readSearchParamInt(resolvedSearchParams, "po_page"),
        pageSize: readSearchParamInt(resolvedSearchParams, "po_size"),
      },
      purchaseRequests: {
        status: readSearchParam(resolvedSearchParams, "pr_status"),
        page: readSearchParamInt(resolvedSearchParams, "pr_page"),
        pageSize: readSearchParamInt(resolvedSearchParams, "pr_size"),
      },
      receiving: {
        status: readSearchParam(resolvedSearchParams, "grn_status"),
        page: readSearchParamInt(resolvedSearchParams, "grn_page"),
        pageSize: readSearchParamInt(resolvedSearchParams, "grn_size"),
      },
    },
  })
  const { spend, needsApproval, urgentNeeds, vendorHealth, incomingCount, recentActivity, purchaseOrders, purchaseRequests, receiving } = stats

  // Fetch pending items for inline approval — sequential to avoid pool exhaustion
  let pendingItemsForApproval: any[] = []
  try {
    const pendingPOsRaw = await prisma.purchaseOrder.findMany({
      where: { status: ProcurementStatus.PENDING_APPROVAL },
      select: {
        id: true, number: true, totalAmount: true, netAmount: true,
        supplier: { select: { name: true } },
        items: { select: { product: { select: { name: true, code: true } }, quantity: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })
    const pendingPRsRaw = await prisma.purchaseRequest.findMany({
      where: { status: PRStatus.PENDING },
      select: {
        id: true, number: true, department: true, priority: true,
        requester: { select: { firstName: true, lastName: true } },
        items: { select: { product: { select: { name: true, code: true } }, quantity: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })
    pendingItemsForApproval = [
      ...pendingPOsRaw.map((po) => ({
        id: po.id, type: 'PO' as const, number: po.number || '—',
        label: po.supplier?.name || 'Unknown',
        amount: Number(po.netAmount || po.totalAmount) || 0,
        itemCount: po.items.length,
        items: po.items.map((i) => ({ productName: i.product?.name || 'Unknown', productCode: i.product?.code || '—', quantity: Number(i.quantity) || 0 })),
      })),
      ...pendingPRsRaw.map((pr) => ({
        id: pr.id, type: 'PR' as const, number: pr.number || '—',
        label: `${pr.requester?.firstName || ''} ${pr.requester?.lastName || ''}`.trim() || 'Unknown',
        amount: 0, department: pr.department || undefined, priority: pr.priority || undefined,
        itemCount: pr.items.length,
        items: pr.items.map((i) => ({ productName: i.product?.name || 'Unknown', productCode: i.product?.code || '—', quantity: Number(i.quantity) || 0 })),
      })),
    ]
  } catch (e) {
    console.error("[ProcurementPage] Failed to fetch pending items:", e)
  }

  const poMeta = stats.registryMeta.purchaseOrders
  const prMeta = stats.registryMeta.purchaseRequests
  const grnMeta = stats.registryMeta.receiving

  return (
    <ProcurementPerformanceProvider currentPath="/procurement">
      <div className="flex-1 p-4 md:p-8 pt-6 max-w-7xl mx-auto space-y-4">

        {/* ── Page Header ─────────────────────────────────────────── */}
        <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900">
          <div className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 border-l-[6px] border-l-violet-400">
            <div className="flex items-center gap-3">
              <Package className="h-5 w-5 text-violet-500" />
              <div>
                <h1 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                  Dashboard Pengadaan
                </h1>
                <p className="text-zinc-400 text-xs font-medium mt-0.5">
                  Command center rantai pasok & manajemen vendor
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Link href="/procurement/requests">
                <Button variant="outline" className="border-2 border-zinc-300 dark:border-zinc-600 font-bold uppercase text-[10px] tracking-wide h-10 px-4 hover:border-zinc-500 transition-colors">
                  <FileText className="mr-1.5 h-3.5 w-3.5" /> Requests
                </Button>
              </Link>
              <Link href="/procurement/vendors">
                <Button variant="outline" className="border-2 border-zinc-300 dark:border-zinc-600 font-bold uppercase text-[10px] tracking-wide h-10 px-4 hover:border-zinc-500 transition-colors">
                  <Users className="mr-1.5 h-3.5 w-3.5" /> Vendors
                </Button>
              </Link>
              <Link href="/procurement/requests/new">
                <Button className="bg-violet-500 text-white hover:bg-violet-600 border-2 border-violet-600 font-black uppercase text-[10px] tracking-wide h-10 px-5 shadow-[3px_3px_0px_0px_rgba(0,0,0,0.2)] active:shadow-none active:translate-y-[1px] transition-all">
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Buat Request
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* ── KPI Cards ───────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Spend */}
          <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Spend (Bulan)</span>
                <DollarSign className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="text-xl font-black text-zinc-900 dark:text-white">{formatIDR(spend.current)}</div>
              <div className="flex items-center gap-1 mt-1">
                {spend.growth > 0 ? (
                  <ArrowUpRight className="h-3 w-3 text-red-500" />
                ) : (
                  <ArrowDownRight className="h-3 w-3 text-emerald-500" />
                )}
                <span className={`text-[10px] font-bold ${spend.growth > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                  {Math.abs(spend.growth).toFixed(1)}%
                </span>
                <span className="text-[10px] text-zinc-400">vs bulan lalu</span>
              </div>
            </div>
          </div>

          {/* Vendor Health */}
          <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Vendor Health</span>
                <Activity className="h-4 w-4 text-blue-500" />
              </div>
              <div className="text-xl font-black text-zinc-900 dark:text-white flex items-center gap-1.5">
                {vendorHealth.rating.toFixed(1)} <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              </div>
              <span className="text-[10px] text-zinc-400 font-medium mt-1 block">
                {vendorHealth.onTime.toFixed(0)}% On-Time Delivery
              </span>
            </div>
          </div>

          {/* Urgent Restock */}
          <div className={`border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden ${urgentNeeds > 0 ? 'bg-red-50 dark:bg-red-950/20' : 'bg-white dark:bg-zinc-900'}`}>
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Urgent Restock</span>
                <AlertCircle className={`h-4 w-4 ${urgentNeeds > 0 ? 'text-red-500' : 'text-zinc-400'}`} />
              </div>
              <div className={`text-xl font-black ${urgentNeeds > 0 ? 'text-red-600' : 'text-zinc-900 dark:text-white'}`}>
                {urgentNeeds} Item
              </div>
              <span className="text-[10px] text-zinc-400 font-medium mt-1 block">
                Di bawah stok minimum
              </span>
            </div>
          </div>

          {/* Incoming */}
          <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Incoming</span>
                <Truck className="h-4 w-4 text-indigo-500" />
              </div>
              <div className="text-xl font-black text-zinc-900 dark:text-white">{incomingCount} Order</div>
              <span className="text-[10px] text-zinc-400 font-medium mt-1 block">
                Open / partial delivery
              </span>
            </div>
          </div>
        </div>

        {/* ── Approval Center ─────────────────────────────────────── */}
        <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="bg-amber-50 dark:bg-amber-950/20 px-5 py-2.5 border-b-2 border-black flex items-center justify-between border-l-[5px] border-l-amber-400">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-amber-600" />
              <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-200">
                Menunggu Persetujuan
              </h3>
              <span className="bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 min-w-[20px] text-center rounded-sm">
                {needsApproval}
              </span>
            </div>
            <Link href="/procurement/requests">
              <Button variant="outline" className="border-2 border-zinc-300 font-bold uppercase text-[10px] tracking-wide h-8 px-3 hover:border-zinc-500 transition-colors">
                Lihat Semua
              </Button>
            </Link>
          </div>
          <InlineApprovalList pendingItems={pendingItemsForApproval} />
        </div>

        {/* ── Registry Tables ─────────────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

          {/* ─── Pesanan Pembelian (PO) ─── */}
          <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
            <div className="bg-violet-50 dark:bg-violet-950/20 px-5 py-2.5 border-b-2 border-black flex items-center gap-2 border-l-[5px] border-l-violet-400">
              <FileText className="h-4 w-4 text-violet-600" />
              <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-200">
                Pesanan Pembelian (PO)
              </h3>
            </div>

            {/* Summary chips */}
            <div className="px-4 pt-3 pb-2 flex flex-wrap gap-1.5">
              <span className="text-[10px] font-bold px-2 py-0.5 border rounded-sm bg-zinc-50 border-zinc-200 text-zinc-700">Draft: {purchaseOrders.summary.draft}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 border rounded-sm bg-amber-50 border-amber-200 text-amber-700">Pending: {purchaseOrders.summary.pendingApproval}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 border rounded-sm bg-emerald-50 border-emerald-200 text-emerald-700">Approved: {purchaseOrders.summary.approved}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 border rounded-sm bg-blue-50 border-blue-200 text-blue-700">Active: {purchaseOrders.summary.inProgress}</span>
            </div>

            {/* Filter pills */}
            <div className="px-4 pb-2 flex flex-wrap gap-1.5">
              {[
                { label: 'Semua', href: buildHref({ po_status: null, po_page: "1" }) },
                { label: 'Pending', href: buildHref({ po_status: "PENDING_APPROVAL", po_page: "1" }) },
                { label: 'Approved', href: buildHref({ po_status: "APPROVED", po_page: "1" }) },
                { label: 'Ordered', href: buildHref({ po_status: "ORDERED", po_page: "1" }) },
                { label: 'Received', href: buildHref({ po_status: "RECEIVED", po_page: "1" }) },
              ].map((f) => (
                <Link key={f.label} href={f.href}>
                  <span className="text-[10px] font-bold px-2 py-0.5 border-2 border-zinc-200 hover:border-violet-400 hover:text-violet-700 transition-colors cursor-pointer rounded-sm text-zinc-500">
                    {f.label}
                  </span>
                </Link>
              ))}
            </div>

            {/* PO list */}
            <div className="border-t border-zinc-200 dark:border-zinc-700">
              {purchaseOrders.recent.length === 0 ? (
                <div className="text-center py-10 text-zinc-400 text-xs font-bold uppercase tracking-widest">
                  Tidak ada PO ditemukan
                </div>
              ) : (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {purchaseOrders.recent.map((po: any, idx: number) => {
                    const cfg = statusLabel(po.status)
                    return (
                      <div key={po.id} className={`px-4 py-2.5 flex items-center justify-between gap-2 ${idx % 2 === 0 ? '' : 'bg-zinc-50/50 dark:bg-zinc-800/10'}`}>
                        <div className="min-w-0">
                          <span className="font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100">{po.number}</span>
                          <span className="block text-[11px] text-zinc-400 truncate">{po.supplier}</span>
                        </div>
                        <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wide px-2 py-0.5 border rounded-sm whitespace-nowrap ${cfg.bg} ${cfg.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Pagination */}
            <div className="px-4 py-2.5 border-t-2 border-black flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                {poMeta.total} total
              </span>
              {poMeta.totalPages > 1 ? (
                <div className="flex items-center gap-1.5">
                  <Link href={buildHref({ po_page: String(Math.max(1, poMeta.page - 1)) })} className={poMeta.page <= 1 ? "pointer-events-none opacity-40" : ""}>
                    <Button variant="outline" size="icon" className="h-7 w-7 border-2 border-black">
                      <ChevronLeft className="h-3 w-3" />
                    </Button>
                  </Link>
                  <span className="text-[10px] font-black min-w-[40px] text-center">{poMeta.page}/{poMeta.totalPages}</span>
                  <Link href={buildHref({ po_page: String(Math.min(poMeta.totalPages, poMeta.page + 1)) })} className={poMeta.page >= poMeta.totalPages ? "pointer-events-none opacity-40" : ""}>
                    <Button variant="outline" size="icon" className="h-7 w-7 border-2 border-black">
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              ) : (
                <div />
              )}
            </div>
          </div>

          {/* ─── Permintaan Pembelian (PR) ─── */}
          <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
            <div className="bg-violet-50 dark:bg-violet-950/20 px-5 py-2.5 border-b-2 border-black flex items-center gap-2 border-l-[5px] border-l-violet-400">
              <CheckSquare className="h-4 w-4 text-violet-600" />
              <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-200">
                Permintaan Pembelian (PR)
              </h3>
            </div>

            {/* Summary chips */}
            <div className="px-4 pt-3 pb-2 flex flex-wrap gap-1.5">
              <span className="text-[10px] font-bold px-2 py-0.5 border rounded-sm bg-zinc-50 border-zinc-200 text-zinc-700">Draft: {purchaseRequests.summary.draft}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 border rounded-sm bg-amber-50 border-amber-200 text-amber-700">Pending: {purchaseRequests.summary.pending}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 border rounded-sm bg-emerald-50 border-emerald-200 text-emerald-700">Approved: {purchaseRequests.summary.approved}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 border rounded-sm bg-blue-50 border-blue-200 text-blue-700">PO Created: {purchaseRequests.summary.poCreated}</span>
            </div>

            {/* Filter pills */}
            <div className="px-4 pb-2 flex flex-wrap gap-1.5">
              {[
                { label: 'Semua', href: buildHref({ pr_status: null, pr_page: "1" }) },
                { label: 'Pending', href: buildHref({ pr_status: "PENDING", pr_page: "1" }) },
                { label: 'Approved', href: buildHref({ pr_status: "APPROVED", pr_page: "1" }) },
                { label: 'PO Created', href: buildHref({ pr_status: "PO_CREATED", pr_page: "1" }) },
                { label: 'Draft', href: buildHref({ pr_status: "DRAFT", pr_page: "1" }) },
              ].map((f) => (
                <Link key={f.label} href={f.href}>
                  <span className="text-[10px] font-bold px-2 py-0.5 border-2 border-zinc-200 hover:border-violet-400 hover:text-violet-700 transition-colors cursor-pointer rounded-sm text-zinc-500">
                    {f.label}
                  </span>
                </Link>
              ))}
            </div>

            {/* PR list */}
            <div className="border-t border-zinc-200 dark:border-zinc-700">
              {purchaseRequests.recent.length === 0 ? (
                <div className="text-center py-10 text-zinc-400 text-xs font-bold uppercase tracking-widest">
                  Tidak ada PR ditemukan
                </div>
              ) : (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {purchaseRequests.recent.map((pr: any, idx: number) => {
                    const cfg = statusLabel(pr.status)
                    return (
                      <div key={pr.id} className={`px-4 py-2.5 flex items-center justify-between gap-2 ${idx % 2 === 0 ? '' : 'bg-zinc-50/50 dark:bg-zinc-800/10'}`}>
                        <div className="min-w-0">
                          <span className="font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100">{pr.number}</span>
                          <span className="block text-[11px] text-zinc-400 truncate">{pr.requester}</span>
                        </div>
                        <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wide px-2 py-0.5 border rounded-sm whitespace-nowrap ${cfg.bg} ${cfg.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Pagination */}
            <div className="px-4 py-2.5 border-t-2 border-black flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                {prMeta.total} total
              </span>
              {prMeta.totalPages > 1 ? (
                <div className="flex items-center gap-1.5">
                  <Link href={buildHref({ pr_page: String(Math.max(1, prMeta.page - 1)) })} className={prMeta.page <= 1 ? "pointer-events-none opacity-40" : ""}>
                    <Button variant="outline" size="icon" className="h-7 w-7 border-2 border-black">
                      <ChevronLeft className="h-3 w-3" />
                    </Button>
                  </Link>
                  <span className="text-[10px] font-black min-w-[40px] text-center">{prMeta.page}/{prMeta.totalPages}</span>
                  <Link href={buildHref({ pr_page: String(Math.min(prMeta.totalPages, prMeta.page + 1)) })} className={prMeta.page >= prMeta.totalPages ? "pointer-events-none opacity-40" : ""}>
                    <Button variant="outline" size="icon" className="h-7 w-7 border-2 border-black">
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              ) : (
                <div />
              )}
            </div>
          </div>

          {/* ─── Penerimaan (GRN) ─── */}
          <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
            <div className="bg-violet-50 dark:bg-violet-950/20 px-5 py-2.5 border-b-2 border-black flex items-center gap-2 border-l-[5px] border-l-violet-400">
              <Truck className="h-4 w-4 text-violet-600" />
              <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-200">
                Penerimaan (Receiving)
              </h3>
            </div>

            {/* Summary chips */}
            <div className="px-4 pt-3 pb-2 flex flex-wrap gap-1.5">
              <span className="text-[10px] font-bold px-2 py-0.5 border rounded-sm bg-zinc-50 border-zinc-200 text-zinc-700">Draft: {receiving.summary.draft}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 border rounded-sm bg-amber-50 border-amber-200 text-amber-700">Inspecting: {receiving.summary.inspecting}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 border rounded-sm bg-blue-50 border-blue-200 text-blue-700">Partial: {receiving.summary.partialAccepted}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 border rounded-sm bg-emerald-50 border-emerald-200 text-emerald-700">Accepted: {receiving.summary.accepted}</span>
            </div>

            {/* Filter pills */}
            <div className="px-4 pb-2 flex flex-wrap gap-1.5">
              {[
                { label: 'Semua', href: buildHref({ grn_status: null, grn_page: "1" }) },
                { label: 'Draft', href: buildHref({ grn_status: "DRAFT", grn_page: "1" }) },
                { label: 'Inspecting', href: buildHref({ grn_status: "INSPECTING", grn_page: "1" }) },
                { label: 'Partial', href: buildHref({ grn_status: "PARTIAL_ACCEPTED", grn_page: "1" }) },
                { label: 'Accepted', href: buildHref({ grn_status: "ACCEPTED", grn_page: "1" }) },
              ].map((f) => (
                <Link key={f.label} href={f.href}>
                  <span className="text-[10px] font-bold px-2 py-0.5 border-2 border-zinc-200 hover:border-violet-400 hover:text-violet-700 transition-colors cursor-pointer rounded-sm text-zinc-500">
                    {f.label}
                  </span>
                </Link>
              ))}
            </div>

            {/* GRN list */}
            <div className="border-t border-zinc-200 dark:border-zinc-700">
              {receiving.recent.length === 0 ? (
                <div className="text-center py-10 text-zinc-400 text-xs font-bold uppercase tracking-widest">
                  Tidak ada GRN ditemukan
                </div>
              ) : (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {receiving.recent.map((grn: any, idx: number) => {
                    const cfg = statusLabel(grn.status)
                    return (
                      <div key={grn.id} className={`px-4 py-2.5 flex items-center justify-between gap-2 ${idx % 2 === 0 ? '' : 'bg-zinc-50/50 dark:bg-zinc-800/10'}`}>
                        <div className="min-w-0">
                          <span className="font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100">{grn.number}</span>
                          <span className="block text-[11px] text-zinc-400 truncate">{grn.poNumber} &bull; {grn.warehouse}</span>
                        </div>
                        <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wide px-2 py-0.5 border rounded-sm whitespace-nowrap ${cfg.bg} ${cfg.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Pagination */}
            <div className="px-4 py-2.5 border-t-2 border-black flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                {grnMeta.total} total
              </span>
              {grnMeta.totalPages > 1 ? (
                <div className="flex items-center gap-1.5">
                  <Link href={buildHref({ grn_page: String(Math.max(1, grnMeta.page - 1)) })} className={grnMeta.page <= 1 ? "pointer-events-none opacity-40" : ""}>
                    <Button variant="outline" size="icon" className="h-7 w-7 border-2 border-black">
                      <ChevronLeft className="h-3 w-3" />
                    </Button>
                  </Link>
                  <span className="text-[10px] font-black min-w-[40px] text-center">{grnMeta.page}/{grnMeta.totalPages}</span>
                  <Link href={buildHref({ grn_page: String(Math.min(grnMeta.totalPages, grnMeta.page + 1)) })} className={grnMeta.page >= grnMeta.totalPages ? "pointer-events-none opacity-40" : ""}>
                    <Button variant="outline" size="icon" className="h-7 w-7 border-2 border-black">
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              ) : (
                <div />
              )}
            </div>
          </div>
        </div>

        {/* ── Recent Activity ─────────────────────────────────────── */}
        <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="bg-violet-50 dark:bg-violet-950/20 px-5 py-2.5 border-b-2 border-black flex items-center gap-2 border-l-[5px] border-l-violet-400">
            <Clock className="h-4 w-4 text-violet-600" />
            <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-200">
              Aktivitas Terbaru
            </h3>
          </div>
          {recentActivity.length > 0 ? (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {recentActivity.map((po: any) => {
                const cfg = statusLabel(po.status)
                return (
                  <div key={po.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 block">{po.supplier.name}</span>
                      <span className="text-[10px] text-zinc-400">{new Date(po.createdAt).toLocaleDateString('id-ID')}</span>
                    </div>
                    <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wide px-2 py-0.5 border rounded-sm whitespace-nowrap ${cfg.bg} ${cfg.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-10 text-zinc-400 text-xs font-bold uppercase tracking-widest">
              Belum ada aktivitas
            </div>
          )}
        </div>

      </div>
    </ProcurementPerformanceProvider>
  )
}
