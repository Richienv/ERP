"use client"

import { useParams } from "next/navigation"
import { useSalesOrderDetail } from "@/hooks/use-sales-order-detail"
import Link from "next/link"
import { ArrowLeft, Package, FileText, Users, Calendar, CreditCard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CardPageSkeleton } from "@/components/ui/page-skeleton"

const formatIDR = (value: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value)

const statusConfig: Record<string, { label: string; color: string }> = {
    DRAFT: { label: "Draft", color: "bg-zinc-100 text-zinc-700" },
    CONFIRMED: { label: "Dikonfirmasi", color: "bg-blue-100 text-blue-700" },
    IN_PROGRESS: { label: "Dalam Proses", color: "bg-amber-100 text-amber-700" },
    DELIVERED: { label: "Terkirim", color: "bg-emerald-100 text-emerald-700" },
    INVOICED: { label: "Diinvoice", color: "bg-violet-100 text-violet-700" },
    COMPLETED: { label: "Selesai", color: "bg-emerald-200 text-emerald-800" },
    CANCELLED: { label: "Dibatalkan", color: "bg-red-100 text-red-700" },
}

export default function SalesOrderDetailPage() {
    const { id } = useParams<{ id: string }>()
    const { data: order, isLoading } = useSalesOrderDetail(id)

    if (isLoading) return <CardPageSkeleton accentColor="bg-blue-400" />

    if (!order) {
        return (
            <div className="p-8 text-center">
                <h1 className="text-xl font-black uppercase">Sales Order Tidak Ditemukan</h1>
                <Button asChild variant="outline" className="mt-4">
                    <Link href="/sales/orders">Kembali</Link>
                </Button>
            </div>
        )
    }

    const sc = statusConfig[order.status] || statusConfig.DRAFT

    return (
        <div className="mf-page">
            {/* Header */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white">
                <div className="px-6 py-4 flex items-center justify-between border-l-[6px] border-l-blue-500">
                    <div className="flex items-center gap-3">
                        <Button variant="outline" size="icon" asChild className="border-2 border-black rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                            <Link href="/sales/orders"><ArrowLeft className="h-4 w-4" /></Link>
                        </Button>
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight">{order.number}</h1>
                            <p className="text-zinc-400 text-xs font-medium mt-0.5">
                                {order.customer.name} • {new Date(order.orderDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                            </p>
                        </div>
                    </div>
                    <Badge className={`text-xs font-black uppercase px-3 py-1 border-2 border-black ${sc.color}`}>
                        {sc.label}
                    </Badge>
                </div>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Customer */}
                <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Users className="h-4 w-4 text-zinc-400" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Pelanggan</span>
                    </div>
                    <p className="font-black text-sm">{order.customer.name}</p>
                    {order.customer.code && <p className="text-xs font-mono text-zinc-400">{order.customer.code}</p>}
                    {order.customer.email && <p className="text-xs text-zinc-500 mt-1">{order.customer.email}</p>}
                    {order.customer.phone && <p className="text-xs text-zinc-500">{order.customer.phone}</p>}
                </div>

                {/* Order Info */}
                <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Calendar className="h-4 w-4 text-zinc-400" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Info Order</span>
                    </div>
                    <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                            <span className="text-zinc-500 font-bold">Tanggal Order</span>
                            <span className="font-black">{new Date(order.orderDate).toLocaleDateString("id-ID")}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-zinc-500 font-bold">Payment Term</span>
                            <span className="font-black">{order.paymentTerm}</span>
                        </div>
                        {order.quotation && (
                            <div className="flex justify-between">
                                <span className="text-zinc-500 font-bold">Dari Quotation</span>
                                <Link href={`/sales/quotations/${order.quotation.id}`} className="font-black text-blue-600 hover:underline">
                                    {order.quotation.number}
                                </Link>
                            </div>
                        )}
                    </div>
                </div>

                {/* Financials */}
                <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <CreditCard className="h-4 w-4 text-zinc-400" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Nilai Order</span>
                    </div>
                    <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                            <span className="text-zinc-500 font-bold">Subtotal</span>
                            <span className="font-black">{formatIDR(Number(order.subtotal))}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-zinc-500 font-bold">PPN</span>
                            <span className="font-black">{formatIDR(Number(order.taxAmount))}</span>
                        </div>
                        <div className="flex justify-between border-t-2 border-black pt-2 mt-2">
                            <span className="font-black text-sm">Total</span>
                            <span className="font-black text-sm">{formatIDR(Number(order.total))}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Items Table */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white overflow-hidden">
                <div className="px-6 py-3 border-b-2 border-black bg-zinc-50 flex items-center gap-2">
                    <Package className="h-4 w-4 text-zinc-500" />
                    <span className="text-xs font-black uppercase tracking-widest text-zinc-500">Item Order</span>
                    <span className="text-[10px] font-black uppercase text-zinc-400 ml-auto">{order.items.length} item</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b-2 border-black bg-zinc-100/50">
                                <th className="px-4 py-2.5 text-left font-black uppercase tracking-wider text-zinc-500">Produk</th>
                                <th className="px-4 py-2.5 text-left font-black uppercase tracking-wider text-zinc-500">Kode</th>
                                <th className="px-4 py-2.5 text-right font-black uppercase tracking-wider text-zinc-500">Qty</th>
                                <th className="px-4 py-2.5 text-right font-black uppercase tracking-wider text-zinc-500">Harga</th>
                                <th className="px-4 py-2.5 text-right font-black uppercase tracking-wider text-zinc-500">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                            {order.items.map((item: any) => (
                                <tr key={item.id} className="hover:bg-zinc-50">
                                    <td className="px-4 py-3 font-bold">{item.product.name}</td>
                                    <td className="px-4 py-3 font-mono text-zinc-400">{item.product.code}</td>
                                    <td className="px-4 py-3 text-right font-black">
                                        {Number(item.quantity)} <span className="text-zinc-400 font-bold">{item.product.unit}</span>
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold">{formatIDR(Number(item.unitPrice))}</td>
                                    <td className="px-4 py-3 text-right font-black">{formatIDR(Number(item.lineTotal))}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Invoices */}
            {order.invoices.length > 0 && (
                <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white overflow-hidden">
                    <div className="px-6 py-3 border-b-2 border-black bg-zinc-50 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-zinc-500" />
                        <span className="text-xs font-black uppercase tracking-widest text-zinc-500">Invoice Terkait</span>
                    </div>
                    <div className="divide-y divide-zinc-100">
                        {order.invoices.map((inv: any) => (
                            <Link key={inv.id} href={`/finance/invoices`} className="flex items-center justify-between px-6 py-3 hover:bg-zinc-50 transition-colors">
                                <span className="text-xs font-black">{inv.number}</span>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-bold">{formatIDR(Number(inv.totalAmount))}</span>
                                    <Badge variant="outline" className="text-[10px] font-black uppercase border-black">{inv.status}</Badge>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* Notes */}
            {order.notes && (
                <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Catatan</p>
                    <p className="text-sm text-zinc-700">{order.notes}</p>
                </div>
            )}
        </div>
    )
}
