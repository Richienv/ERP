import Link from "next/link"
import { ArrowLeft, Package, FileText, Users, Calendar, CreditCard, Sparkles, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const formatIDR = (value: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value)

const statusConfig: Record<string, { label: string; color: string }> = {
    DRAFT: { label: "Draft", color: "bg-zinc-100 text-zinc-700" },
    SENT: { label: "Terkirim", color: "bg-blue-100 text-blue-700" },
    ACCEPTED: { label: "Diterima", color: "bg-emerald-100 text-emerald-700" },
    REJECTED: { label: "Ditolak", color: "bg-red-100 text-red-700" },
    EXPIRED: { label: "Expired", color: "bg-zinc-200 text-zinc-500" },
    CONVERTED: { label: "Dikonversi", color: "bg-violet-100 text-violet-700" },
}

export default async function QuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params

    let quotation: any = null
    try {
        quotation = await prisma.quotation.findUnique({
            where: { id },
            include: {
                customer: { select: { name: true, code: true, email: true, phone: true } },
                items: {
                    include: {
                        product: { select: { name: true, code: true, unit: true } },
                    },
                    orderBy: { createdAt: "asc" },
                },
                salesOrders: { select: { id: true, number: true, status: true } },
            },
        })
    } catch (e) {
        console.error("[QuotationDetail] Error:", e)
    }

    if (!quotation) {
        return (
            <div className="p-8 text-center">
                <h1 className="text-xl font-black uppercase">Penawaran Tidak Ditemukan</h1>
                <Button asChild variant="outline" className="mt-4">
                    <Link href="/sales/quotations">Kembali</Link>
                </Button>
            </div>
        )
    }

    const sc = statusConfig[quotation.status] || statusConfig.DRAFT

    return (
        <div className="p-4 md:p-8 pt-6 w-full space-y-4 font-sans max-w-5xl mx-auto">
            {/* Header */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900">
                <div className="px-6 py-4 flex items-center justify-between border-l-[6px] border-l-amber-400">
                    <div className="flex items-center gap-3">
                        <Button variant="outline" size="icon" asChild className="border-2 border-black rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                            <Link href="/sales/quotations"><ArrowLeft className="h-4 w-4" /></Link>
                        </Button>
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">{quotation.number}</h1>
                            <p className="text-zinc-400 text-xs font-medium mt-0.5">
                                {quotation.customer.name} • {new Date(quotation.quotationDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Badge className={`text-xs font-black uppercase px-3 py-1 border-2 border-black rounded-none ${sc.color}`}>
                            {sc.label}
                        </Badge>
                        <Button asChild variant="outline" className="border-2 border-black rounded-none h-9 font-black uppercase text-xs tracking-wider shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                            <Link href={`/sales/quotations/${quotation.id}/edit`}>
                                <Pencil className="mr-2 h-4 w-4" /> Edit
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Customer */}
                <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Users className="h-4 w-4 text-zinc-400" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Pelanggan</span>
                    </div>
                    <p className="font-black text-sm text-zinc-900 dark:text-white">{quotation.customer.name}</p>
                    {quotation.customer.code && <p className="text-xs font-mono text-zinc-400">{quotation.customer.code}</p>}
                    {quotation.customer.email && <p className="text-xs text-zinc-500 mt-1">{quotation.customer.email}</p>}
                    {quotation.customer.phone && <p className="text-xs text-zinc-500">{quotation.customer.phone}</p>}
                </div>

                {/* Quotation Info */}
                <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Calendar className="h-4 w-4 text-zinc-400" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Info Penawaran</span>
                    </div>
                    <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                            <span className="text-zinc-500 font-bold uppercase tracking-tighter">Tgl Quotation</span>
                            <span className="font-black text-zinc-900 dark:text-white">{new Date(quotation.quotationDate).toLocaleDateString("id-ID")}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-zinc-500 font-bold uppercase tracking-tighter">Valid Sampai</span>
                            <span className="font-black text-zinc-900 dark:text-white">{new Date(quotation.validUntil).toLocaleDateString("id-ID")}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-zinc-500 font-bold uppercase tracking-tighter">Payment Term</span>
                            <span className="font-black text-zinc-900 dark:text-white">{quotation.paymentTerm}</span>
                        </div>
                    </div>
                </div>

                {/* Financials */}
                <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <CreditCard className="h-4 w-4 text-zinc-400" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Nilai Penawaran</span>
                    </div>
                    <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                            <span className="text-zinc-500 font-bold uppercase tracking-tighter">Subtotal</span>
                            <span className="font-black text-zinc-900 dark:text-white">{formatIDR(Number(quotation.subtotal))}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-zinc-500 font-bold uppercase tracking-tighter">PPN</span>
                            <span className="font-black text-zinc-900 dark:text-white">{formatIDR(Number(quotation.taxAmount))}</span>
                        </div>
                        <div className="flex justify-between border-t-2 border-black pt-2 mt-2">
                            <span className="font-black text-sm uppercase text-zinc-900 dark:text-white">Total</span>
                            <span className="font-black text-sm text-amber-600 font-mono tracking-tighter">{formatIDR(Number(quotation.total))}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Items Table */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
                <div className="px-6 py-3 border-b-2 border-black bg-zinc-50 dark:bg-zinc-800 flex items-center gap-2">
                    <Package className="h-4 w-4 text-zinc-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Item Penawaran</span>
                    <span className="text-[10px] font-black uppercase text-zinc-400 ml-auto">{quotation.items.length} item</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b-2 border-black bg-zinc-100/50 dark:bg-zinc-800/50">
                                <th className="px-4 py-2.5 text-left font-black uppercase tracking-wider text-zinc-500">Produk</th>
                                <th className="px-4 py-2.5 text-left font-black uppercase tracking-wider text-zinc-500">Kode</th>
                                <th className="px-4 py-2.5 text-right font-black uppercase tracking-wider text-zinc-500">Qty</th>
                                <th className="px-4 py-2.5 text-right font-black uppercase tracking-wider text-zinc-500">Harga</th>
                                <th className="px-4 py-2.5 text-right font-black uppercase tracking-wider text-zinc-500">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {quotation.items.map((item: any) => (
                                <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                    <td className="px-4 py-3 font-bold text-zinc-900 dark:text-zinc-100">{item.product.name}</td>
                                    <td className="px-4 py-3 font-mono text-zinc-400">{item.product.code}</td>
                                    <td className="px-4 py-3 text-right font-black text-zinc-900 dark:text-zinc-100">
                                        {Number(item.quantity).toLocaleString("id-ID")} <span className="text-zinc-400 font-bold">{item.product.unit}</span>
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold text-zinc-900 dark:text-zinc-100">{formatIDR(Number(item.unitPrice))}</td>
                                    <td className="px-4 py-3 text-right font-black text-zinc-900 dark:text-zinc-100">{formatIDR(Number(item.lineTotal))}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Sales Orders */}
            {quotation.salesOrders.length > 0 && (
                <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
                    <div className="px-6 py-3 border-b-2 border-black bg-zinc-50 dark:bg-zinc-800 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-amber-500" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Sales Order Terkait</span>
                    </div>
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {quotation.salesOrders.map((so: any) => (
                            <Link key={so.id} href={`/sales/orders/${so.id}`} className="flex items-center justify-between px-6 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group">
                                <span className="text-xs font-black text-zinc-900 dark:text-white group-hover:text-blue-600">{so.number}</span>
                                <Badge variant="outline" className="text-[10px] font-black uppercase border-black dark:border-zinc-700">{so.status}</Badge>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* Notes */}
            {(quotation.notes || quotation.internalNotes) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {quotation.notes && (
                        <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 p-4">
                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Catatan Pelanggan</p>
                            <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">{quotation.notes}</p>
                        </div>
                    )}
                    {quotation.internalNotes && (
                        <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-amber-50 dark:bg-amber-950/20 p-4">
                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Catatan Internal</p>
                            <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">{quotation.internalNotes}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
