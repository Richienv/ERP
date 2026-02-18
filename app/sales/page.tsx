"use client"

import Link from "next/link"
import {
  ArrowRight,
  CircleDollarSign,
  FileText,
  Package,
  Users,
  ShoppingCart,
  TrendingUp,
  BarChart3,
  Database,
  Factory,
  Receipt,
  Square,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { useSalesPage } from "@/hooks/use-sales-page"
import { CardPageSkeleton } from "@/components/ui/page-skeleton"

const formatIDR = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value)

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export default function SalesDashboardPage() {
  const { data: raw, isLoading } = useSalesPage()

  if (isLoading || !raw) {
    return <CardPageSkeleton accentColor="bg-blue-400" />
  }

  const {
    monthlyRevenue,
    orderStats,
    quotationStats,
    leadStats,
    openAR,
    recentOrders,
    recentQuotations,
    recentInvoices,
  } = raw

  const totalOrders = (orderStats ?? []).reduce((s: number, r: any) => s + (r._count._all || 0), 0)
  const totalOrderValue = (orderStats ?? []).reduce((s: number, r: any) => s + toNumber(r._sum.total), 0)
  const activeOrders = (orderStats ?? [])
    .filter((r: any) => ["CONFIRMED", "IN_PROGRESS", "DELIVERED", "INVOICED"].includes(r.status))
    .reduce((s: number, r: any) => s + (r._count._all || 0), 0)

  const activeQuotes = (quotationStats ?? [])
    .filter((r: any) => ["DRAFT", "SENT", "ACCEPTED"].includes(r.status))
    .reduce((s: number, r: any) => s + (r._count._all || 0), 0)
  const quotePipelineValue = (quotationStats ?? [])
    .filter((r: any) => ["DRAFT", "SENT", "ACCEPTED"].includes(r.status))
    .reduce((s: number, r: any) => s + toNumber(r._sum.total), 0)

  const totalLeads = (leadStats ?? []).reduce((s: number, r: any) => s + (r._count._all || 0), 0)
  const openLeadValue = (leadStats ?? [])
    .filter((r: any) => !["WON", "LOST"].includes(r.status))
    .reduce((s: number, r: any) => s + toNumber(r._sum.estimatedValue), 0)

  const revenueMTD = toNumber(monthlyRevenue?._sum?.totalAmount)
  const arOutstanding = toNumber(openAR?._sum?.balanceDue)

  // KPI strip data
  const kpis = [
    {
      label: "Revenue MTD",
      value: formatIDR(revenueMTD),
      detail: new Date().toLocaleDateString("id-ID", { month: "long" }),
      icon: <TrendingUp className="h-4 w-4" />,
      health: revenueMTD > 0 ? ("good" as const) : ("warning" as const),
      href: "/finance",
    },
    {
      label: "Sales Orders",
      value: `${totalOrders}`,
      detail: formatIDR(totalOrderValue),
      icon: <ShoppingCart className="h-4 w-4" />,
      health: totalOrders > 0 ? ("good" as const) : ("warning" as const),
      href: "/sales/orders",
    },
    {
      label: "Order Aktif",
      value: `${activeOrders}`,
      detail: "dalam proses",
      icon: <Package className="h-4 w-4" />,
      health: activeOrders > 0 ? ("good" as const) : ("warning" as const),
      href: "/sales/orders",
    },
    {
      label: "Quotation",
      value: `${activeQuotes}`,
      detail: formatIDR(quotePipelineValue),
      icon: <FileText className="h-4 w-4" />,
      health: activeQuotes > 0 ? ("good" as const) : ("warning" as const),
      href: "/sales/quotations",
    },
    {
      label: "AR Outstanding",
      value: formatIDR(arOutstanding),
      detail: "piutang aktif",
      icon: <CircleDollarSign className="h-4 w-4" />,
      health: arOutstanding === 0 ? ("good" as const) : arOutstanding > 50_000_000 ? ("critical" as const) : ("warning" as const),
      href: "/finance/invoices",
    },
  ]

  const healthColor = (h: "good" | "warning" | "critical") =>
    h === "good" ? "bg-emerald-500" : h === "warning" ? "bg-amber-500" : "bg-red-500"

  // Quick links
  const quickLinks = [
    {
      title: "Link Cepat Keuangan",
      icon: <CircleDollarSign className="h-4 w-4" />,
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
      headerBg: "bg-emerald-500",
      borderColor: "border-emerald-300 dark:border-emerald-800",
      iconColor: "text-emerald-600",
      linkBg: "bg-emerald-100 dark:bg-emerald-900/40 hover:bg-emerald-200 dark:hover:bg-emerald-800/60 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300",
      links: [
        { label: "Penerimaan (AR)", href: "/finance/invoices", icon: <Receipt className="h-3.5 w-3.5" /> },
        { label: "Jurnal Umum", href: "/finance/journal", icon: <FileText className="h-3.5 w-3.5" /> },
      ],
    },
    {
      title: "Eksekusi Order",
      icon: <Factory className="h-4 w-4" />,
      bg: "bg-blue-50 dark:bg-blue-950/30",
      headerBg: "bg-blue-500",
      borderColor: "border-blue-300 dark:border-blue-800",
      iconColor: "text-blue-600",
      linkBg: "bg-blue-100 dark:bg-blue-900/40 hover:bg-blue-200 dark:hover:bg-blue-800/60 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-300",
      links: [
        { label: "Sales Order Queue", href: "/sales/orders", icon: <ShoppingCart className="h-3.5 w-3.5" /> },
        { label: "Manufacturing WO", href: "/manufacturing", icon: <Factory className="h-3.5 w-3.5" /> },
      ],
    },
    {
      title: "Master Data",
      icon: <Database className="h-4 w-4" />,
      bg: "bg-purple-50 dark:bg-purple-950/30",
      headerBg: "bg-purple-500",
      borderColor: "border-purple-300 dark:border-purple-800",
      iconColor: "text-purple-600",
      linkBg: "bg-purple-100 dark:bg-purple-900/40 hover:bg-purple-200 dark:hover:bg-purple-800/60 border-purple-300 dark:border-purple-700 text-purple-800 dark:text-purple-300",
      links: [
        { label: "Customer Master", href: "/sales/customers", icon: <Users className="h-3.5 w-3.5" /> },
        { label: "Product & Stock", href: "/inventory", icon: <Package className="h-3.5 w-3.5" /> },
      ],
    },
  ]

  return (
    <div className="w-full bg-zinc-50 dark:bg-black font-sans min-h-[calc(100svh-theme(spacing.16))]">
      <div className="flex flex-col gap-4 p-4 md:p-5 lg:p-6 min-h-[calc(100svh-theme(spacing.16))]">

        {/* Row 1: Header */}
        <div className="flex-none flex items-center justify-between">
          <div>
            <h1 className="text-lg font-black uppercase tracking-widest text-zinc-900 dark:text-white">
              Penjualan & CRM
            </h1>
            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              Monitor performa Sales, CRM pipeline, dan status eksekusi order
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/sales/quotations/new">
              <Button
                variant="outline"
                size="sm"
                className="border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all font-bold text-xs uppercase tracking-wider rounded-none"
              >
                <FileText className="mr-1.5 h-3.5 w-3.5" />
                Quotation
              </Button>
            </Link>
            <Link href="/sales/orders/new">
              <Button
                size="sm"
                className="bg-black text-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all font-bold text-xs uppercase tracking-wider rounded-none"
              >
                <Package className="mr-1.5 h-3.5 w-3.5" />
                Sales Order
              </Button>
            </Link>
          </div>
        </div>

        {/* Row 2: KPI Strip */}
        <div className="flex-none bg-white dark:bg-zinc-900 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
          <div className="grid grid-cols-2 md:grid-cols-5">
            {kpis.map((kpi, i) => (
              <Link
                key={kpi.label}
                href={kpi.href}
                className={`
                  group relative p-4 transition-all hover:bg-zinc-50 dark:hover:bg-zinc-800/50 active:scale-[0.98]
                  ${i < kpis.length - 1 ? "md:border-r-2 border-b-2 md:border-b-0 border-black" : "border-b-2 md:border-b-0 border-black"}
                `}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors">
                      {kpi.icon}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors">
                      {kpi.label}
                    </span>
                  </div>
                  <div className={`h-2 w-2 border border-black ${healthColor(kpi.health)}`} />
                </div>
                <p className="text-xl font-black tracking-tighter text-zinc-900 dark:text-white">
                  {kpi.value}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mt-0.5">
                  {kpi.detail}
                </p>
              </Link>
            ))}
          </div>
        </div>

        {/* Row 3: Main Content — Orders + CRM */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 min-h-0">

          {/* Recent Sales Orders */}
          <div className="md:col-span-7 min-h-0 overflow-hidden">
            <div className="h-full flex flex-col bg-white dark:bg-zinc-900 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
              <div className="flex-none flex items-center justify-between px-4 py-3 border-b-2 border-black">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-zinc-500" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                    Sales Order Terbaru
                  </h3>
                </div>
                <Link
                  href="/sales/orders"
                  className="text-[10px] font-black uppercase tracking-wider text-zinc-400 hover:text-black dark:hover:text-white transition-colors flex items-center gap-1"
                >
                  Semua <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="flex-1 overflow-y-auto">
                {(recentOrders ?? []).length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-sm text-zinc-400 font-medium">Belum ada sales order.</p>
                  </div>
                ) : (
                  <div className="divide-y-2 divide-black">
                    {(recentOrders ?? []).map((order: any) => (
                      <Link
                        key={order.id}
                        href={`/sales/orders/${order.id}`}
                        className="flex items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-2 w-2 bg-blue-500 border border-black flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-black uppercase tracking-wide truncate">
                              {order.number}
                            </p>
                            <p className="text-[10px] font-mono text-zinc-400 truncate">
                              {order.customer?.name} • {new Date(order.orderDate).toLocaleDateString("id-ID")}
                            </p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-3">
                          <p className="text-sm font-black">{formatIDR(toNumber(order.total))}</p>
                          <span className={`
                            text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 border-2 border-black
                            ${order.status === "COMPLETED" ? "bg-emerald-100 text-emerald-800" :
                              order.status === "CANCELLED" ? "bg-red-100 text-red-800" :
                                order.status === "CONFIRMED" ? "bg-blue-100 text-blue-800" :
                                  "bg-zinc-100 text-zinc-800"
                            }
                          `}>
                            {order.status}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* CRM Snapshot */}
          <div className="md:col-span-5 min-h-0 overflow-hidden">
            <div className="h-full flex flex-col bg-white dark:bg-zinc-900 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
              <div className="flex-none flex items-center justify-between px-4 py-3 border-b-2 border-black">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-zinc-500" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                    CRM Snapshot
                  </h3>
                </div>
                <Link
                  href="/sales/leads"
                  className="text-[10px] font-black uppercase tracking-wider text-zinc-400 hover:text-black dark:hover:text-white transition-colors flex items-center gap-1"
                >
                  Detail <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Leads Summary */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="border-2 border-black p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Total Leads</p>
                    <p className="text-2xl font-black">{totalLeads}</p>
                    <p className="text-[10px] font-bold text-zinc-400 mt-0.5">
                      Open: {formatIDR(openLeadValue)}
                    </p>
                  </div>
                  <div className="border-2 border-black p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Quotations</p>
                    <p className="text-2xl font-black">{activeQuotes}</p>
                    <p className="text-[10px] font-bold text-zinc-400 mt-0.5">
                      Pipeline: {formatIDR(quotePipelineValue)}
                    </p>
                  </div>
                </div>

                {/* Recent Quotations */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2 border-b border-black/10 pb-1">
                    Quotation Terbaru
                  </p>
                  {(recentQuotations ?? []).length === 0 ? (
                    <p className="text-xs text-zinc-400">Belum ada quotation.</p>
                  ) : (
                    <div className="space-y-2">
                      {(recentQuotations ?? []).map((quote: any) => (
                        <Link
                          key={quote.id}
                          href={`/sales/quotations/${quote.id}`}
                          className="flex items-center justify-between py-1.5 border-b border-black/5 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors px-1 -mx-1"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate">{quote.number}</p>
                            <p className="text-[10px] text-zinc-400 truncate">{quote.customer?.name}</p>
                          </div>
                          <span className={`
                            text-[9px] font-black uppercase px-1.5 py-0.5 flex-shrink-0 border bg-white border-black
                            ${quote.status === "ACCEPTED" ? "text-emerald-700 bg-emerald-50" :
                              quote.status === "SENT" ? "text-blue-700 bg-blue-50" :
                                quote.status === "REJECTED" ? "text-red-700 bg-red-50" :
                                  "text-zinc-600"
                            }
                          `}>
                            {quote.status}
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                {/* CRM Actions */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <Link href="/sales/leads">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all font-bold text-[10px] uppercase tracking-wider rounded-none"
                    >
                      CRM Leads
                    </Button>
                  </Link>
                  <Link href="/sales/quotations">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all font-bold text-[10px] uppercase tracking-wider rounded-none"
                    >
                      Quotations
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Row 4: Recent Invoices */}
        {(recentInvoices ?? []).length > 0 && (
          <div className="flex-none bg-white dark:bg-zinc-900 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b-2 border-black">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-zinc-500" />
                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500">Invoice Terbaru</h3>
              </div>
              <Link href="/finance/invoices" className="text-[10px] font-black uppercase tracking-wider text-zinc-400 hover:text-black transition-colors flex items-center gap-1">
                Semua <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x-2 divide-black">
              {(recentInvoices ?? []).map((inv: any) => (
                <Link key={inv.id} href="/finance/invoices" className="px-4 py-3 hover:bg-zinc-50 transition-colors">
                  <p className="text-xs font-black uppercase">{inv.number}</p>
                  <p className="text-[10px] text-zinc-400 truncate">{inv.customer?.name || "-"}</p>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-xs font-black">{formatIDR(toNumber(inv.totalAmount))}</span>
                    <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 border border-black ${inv.status === "PAID" ? "bg-emerald-100 text-emerald-700" :
                        inv.status === "ISSUED" ? "bg-blue-100 text-blue-700" :
                          inv.status === "OVERDUE" ? "bg-red-100 text-red-700" :
                            "bg-zinc-100 text-zinc-700"
                      }`}>{inv.status}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Row 5: Quick Links Strip */}
        <div className="flex-none grid grid-cols-1 md:grid-cols-3 gap-4">
          {quickLinks.map((group) => (
            <div
              key={group.title}
              className={`${group.bg} border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden`}
            >
              <div className={`${group.headerBg} px-4 py-2 border-b-2 border-black flex items-center gap-2`}>
                <span className="text-white">{group.icon}</span>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-white">
                  {group.title}
                </h4>
              </div>
              <div className="p-3 flex gap-2">
                {group.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 border-2 border-black ${group.linkBg} font-black text-xs uppercase tracking-wide transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,0.15)] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] active:scale-[0.97] rounded-none`}
                  >
                    {link.icon}
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
