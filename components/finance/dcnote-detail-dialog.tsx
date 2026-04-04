"use client"

import { useEffect, useState } from "react"
import { FileText, ExternalLink, Loader2, Receipt, BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { NB } from "@/lib/dialog-styles"
import { formatIDR } from "@/lib/utils"
import { getDCNoteDetail } from "@/lib/actions/finance-dcnotes"

type DCNoteDetail = NonNullable<Extract<Awaited<ReturnType<typeof getDCNoteDetail>>, { success: true }>["data"]>

interface DCNoteDetailDialogProps {
    noteId: string | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

const TYPE_LABELS: Record<string, string> = {
    SALES_CN: "Nota Kredit Penjualan",
    PURCHASE_DN: "Nota Debit Pembelian",
    SALES_DN: "Nota Debit Penjualan",
    PURCHASE_CN: "Nota Kredit Pembelian",
}

const STATUS_STYLES: Record<string, string> = {
    DRAFT: "border-zinc-300 text-zinc-500",
    POSTED: "border-blue-300 text-blue-600 bg-blue-50",
    VOID: "border-red-300 text-red-600 bg-red-50",
    SETTLED: "border-emerald-300 text-emerald-600 bg-emerald-50",
}

export function DCNoteDetailDialog({ noteId, open, onOpenChange }: DCNoteDetailDialogProps) {
    const [data, setData] = useState<DCNoteDetail | null>(null)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!open || !noteId) { setData(null); return }
        setLoading(true)
        getDCNoteDetail(noteId).then(result => {
            if (result.success) setData(result.data)
        }).finally(() => setLoading(false))
    }, [open, noteId])

    const party = data?.customer?.name || data?.supplier?.name || "-"
    const partyCode = data?.customer?.code || data?.supplier?.code || ""

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={NB.contentWide}>
                <DialogHeader className={NB.header}>
                    <DialogTitle className={NB.title}>
                        <FileText className="h-5 w-5" />
                        {loading ? "Memuat..." : data ? `${data.number} — ${TYPE_LABELS[data.type] ?? data.type}` : "Detail Nota"}
                    </DialogTitle>
                    {data && <p className={NB.subtitle}>{party}{partyCode ? ` · ${partyCode}` : ""}</p>}
                </DialogHeader>

                {loading && (
                    <div className="flex items-center justify-center p-12">
                        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
                    </div>
                )}

                {!loading && data && (
                    <div className={`overflow-y-auto ${NB.scroll} p-5 space-y-4`}>

                        {/* Header Info */}
                        <div className="grid grid-cols-3 gap-3">
                            <InfoCell label="Nomor" value={data.number} mono />
                            <InfoCell label="Tipe" value={TYPE_LABELS[data.type] ?? data.type} />
                            <div>
                                <p className={NB.label}>Status</p>
                                <Badge variant="outline" className={`text-[9px] font-black uppercase rounded-none ${STATUS_STYLES[data.status] ?? ""}`}>
                                    {data.status}
                                </Badge>
                            </div>
                            <InfoCell label="Tanggal Terbit" value={new Date(data.issueDate).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })} />
                            <InfoCell label="Alasan" value={data.reasonCode} />
                            {data.notes && <InfoCell label="Catatan" value={data.notes} />}
                        </div>

                        {/* Invoice Asal */}
                        <div className={NB.section}>
                            <div className={NB.sectionHead}>
                                <Receipt className="h-3.5 w-3.5 text-orange-500" />
                                <span className={NB.sectionTitle}>Invoice Asal</span>
                            </div>
                            <div className={NB.sectionBody}>
                                {data.originalInvoice ? (
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <span className="font-mono font-black text-sm">{data.originalInvoice.number}</span>
                                            <Badge variant="outline" className={`text-[9px] font-black uppercase rounded-none ${STATUS_STYLES[data.originalInvoice.status] ?? ""}`}>
                                                {data.originalInvoice.status}
                                            </Badge>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">Total Invoice</p>
                                            <p className="font-mono font-black text-sm">{formatIDR(data.originalInvoice.totalAmount)}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">Sisa Tagihan</p>
                                            <p className={`font-mono font-black text-sm ${data.originalInvoice.balanceDue > 0 ? "text-orange-600" : "text-emerald-600"}`}>
                                                {formatIDR(data.originalInvoice.balanceDue)}
                                            </p>
                                        </div>
                                        <a
                                            href={`/finance/invoices/${data.originalInvoice.id}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="flex items-center gap-1 text-[10px] font-bold uppercase text-blue-600 hover:underline"
                                        >
                                            <ExternalLink className="h-3 w-3" /> Buka Invoice
                                        </a>
                                    </div>
                                ) : (
                                    <p className="text-xs text-zinc-400 italic">
                                        Tidak terhubung ke invoice — diterapkan secara manual
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Items */}
                        {data.items.length > 0 && (
                            <div className={NB.section}>
                                <div className={NB.sectionHead}>
                                    <FileText className="h-3.5 w-3.5 text-zinc-400" />
                                    <span className={NB.sectionTitle}>Item Nota</span>
                                </div>
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-zinc-200 bg-zinc-50">
                                            <th className="text-left px-3 py-2 text-[9px] font-black uppercase tracking-widest text-zinc-400">Deskripsi</th>
                                            <th className="text-right px-3 py-2 text-[9px] font-black uppercase tracking-widest text-zinc-400">Qty</th>
                                            <th className="text-right px-3 py-2 text-[9px] font-black uppercase tracking-widest text-zinc-400">Harga Satuan</th>
                                            <th className="text-right px-3 py-2 text-[9px] font-black uppercase tracking-widest text-zinc-400">PPN</th>
                                            <th className="text-right px-3 py-2 text-[9px] font-black uppercase tracking-widest text-zinc-400">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.items.map(item => (
                                            <tr key={item.id} className="border-b border-zinc-100">
                                                <td className="px-3 py-2">{item.description}</td>
                                                <td className="px-3 py-2 text-right font-mono">{item.quantity}</td>
                                                <td className="px-3 py-2 text-right font-mono">{formatIDR(item.unitPrice)}</td>
                                                <td className="px-3 py-2 text-right font-mono text-zinc-500">{formatIDR(item.ppnAmount)}</td>
                                                <td className="px-3 py-2 text-right font-mono font-bold">{formatIDR(item.totalAmount)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="border-t-2 border-black">
                                            <td colSpan={3} />
                                            <td className="px-3 py-2 text-right text-[9px] font-black uppercase tracking-widest text-zinc-400">Subtotal</td>
                                            <td className="px-3 py-2 text-right font-mono font-bold">{formatIDR(data.subtotal)}</td>
                                        </tr>
                                        {data.ppnAmount > 0 && (
                                            <tr>
                                                <td colSpan={3} />
                                                <td className="px-3 py-1 text-right text-[9px] font-black uppercase tracking-widest text-zinc-400">PPN 11%</td>
                                                <td className="px-3 py-1 text-right font-mono">{formatIDR(data.ppnAmount)}</td>
                                            </tr>
                                        )}
                                        <tr className="bg-zinc-50">
                                            <td colSpan={3} />
                                            <td className="px-3 py-2 text-right text-[10px] font-black uppercase tracking-widest">Total</td>
                                            <td className="px-3 py-2 text-right font-mono font-black text-base">{formatIDR(data.totalAmount)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}

                        {/* Journal Entry */}
                        {data.journalEntry && (
                            <div className={NB.section}>
                                <div className={NB.sectionHead}>
                                    <BookOpen className="h-3.5 w-3.5 text-zinc-400" />
                                    <span className={NB.sectionTitle}>Jurnal</span>
                                    <span className={`${NB.sectionHint} font-mono`}>{data.journalEntry.reference || data.journalEntry.id.slice(0, 8)}</span>
                                    <Badge variant="outline" className={`ml-2 text-[8px] font-black uppercase rounded-none ${data.journalEntry.status === "POSTED" ? "border-blue-300 text-blue-600" : "border-zinc-300 text-zinc-500"}`}>
                                        {data.journalEntry.status}
                                    </Badge>
                                </div>
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="border-b border-zinc-200 bg-zinc-50">
                                            <th className="text-left px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-zinc-400">Akun</th>
                                            <th className="text-right px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-zinc-400">Debit</th>
                                            <th className="text-right px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-zinc-400">Kredit</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.journalEntry.lines.map(line => (
                                            <tr key={line.id} className="border-b border-zinc-100">
                                                <td className="px-3 py-1.5 font-mono">
                                                    <span className="font-bold">{line.accountCode}</span>
                                                    <span className="text-zinc-500 ml-2">{line.accountName}</span>
                                                </td>
                                                <td className="px-3 py-1.5 text-right font-mono">{line.debit > 0 ? formatIDR(line.debit) : ""}</td>
                                                <td className="px-3 py-1.5 text-right font-mono text-zinc-500">{line.credit > 0 ? formatIDR(line.credit) : ""}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="border-t-2 border-black bg-zinc-50">
                                            <td className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-zinc-400">Total</td>
                                            <td className="px-3 py-1.5 text-right font-mono font-black">
                                                {formatIDR(data.journalEntry.lines.reduce((s, l) => s + l.debit, 0))}
                                            </td>
                                            <td className="px-3 py-1.5 text-right font-mono font-black text-zinc-500">
                                                {formatIDR(data.journalEntry.lines.reduce((s, l) => s + l.credit, 0))}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                <DialogFooter className="p-4 border-t border-zinc-200 bg-zinc-50 flex justify-end">
                    <Button variant="outline" className={NB.cancelBtn} onClick={() => onOpenChange(false)}>Tutup</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function InfoCell({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
    return (
        <div>
            <p className={NB.label}>{label}</p>
            <p className={`text-sm font-medium ${mono ? "font-mono" : ""}`}>{value}</p>
        </div>
    )
}
