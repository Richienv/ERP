"use client"

import { useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Dialog,
    DialogContent,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { FileSpreadsheet, Download, FileText } from "lucide-react"
import { toast } from "sonner"
import {
    NBDialogHeader,
    NBDialogBody,
    NBDialogFooter,
} from "@/components/ui/nb-dialog"
import { NB } from "@/lib/dialog-styles"
import type { EFakturInvoice } from "@/lib/actions/finance-efaktur"

interface EFakturExportDialogProps {
    invoices: EFakturInvoice[]
    onExport: (invoiceIds: string[]) => Promise<{ success: boolean; csv?: string; error?: string }>
}

export function EFakturExportDialog({ invoices, onExport }: EFakturExportDialogProps) {
    const [open, setOpen] = useState(false)
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [loading, setLoading] = useState(false)

    const formatIDR = (n: number) => n.toLocaleString('id-ID')

    const toggleAll = () => {
        if (selected.size === invoices.length) {
            setSelected(new Set())
        } else {
            setSelected(new Set(invoices.map((i) => i.id)))
        }
    }

    const toggle = (id: string) => {
        const next = new Set(selected)
        if (next.has(id)) {
            next.delete(id)
        } else {
            next.add(id)
        }
        setSelected(next)
    }

    const handleExport = async () => {
        if (selected.size === 0) {
            toast.error("Pilih minimal 1 invoice")
            return
        }

        setLoading(true)
        const result = await onExport(Array.from(selected))
        setLoading(false)

        if (result.success && result.csv) {
            // Download CSV
            const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8;' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `efaktur_export_${new Date().toISOString().split('T')[0]}.csv`
            a.click()
            URL.revokeObjectURL(url)

            toast.success(`${selected.size} faktur berhasil diekspor`)
            setOpen(false)
        } else {
            toast.error(result.error || "Gagal mengekspor")
        }
    }

    const selectedTotal = invoices
        .filter((i) => selected.has(i.id))
        .reduce((s, i) => s + i.totalAmount, 0)

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className={NB.triggerBtn}>
                    <FileSpreadsheet className="h-4 w-4 mr-1" /> Export e-Faktur
                </Button>
            </DialogTrigger>

            <DialogContent
                showCloseButton={false}
                className="max-w-4xl sm:max-w-4xl p-0 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-none overflow-hidden gap-0"
            >
                <NBDialogHeader icon={FileSpreadsheet} title="Export e-Faktur CSV" subtitle="Pilih invoice untuk diekspor ke format DJP e-Faktur" />

                <NBDialogBody>
                    {invoices.length === 0 ? (
                        <div className="p-8 text-center">
                            <FileText className="h-8 w-8 mx-auto text-zinc-300 mb-2" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                                Tidak ada invoice yang eligible
                            </span>
                        </div>
                    ) : (
                        <div className={NB.tableWrap}>
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className={NB.tableHead}>
                                        <th className={`${NB.tableHeadCell} w-8`}>
                                            <Checkbox
                                                checked={selected.size === invoices.length}
                                                onCheckedChange={toggleAll}
                                            />
                                        </th>
                                        <th className={`${NB.tableHeadCell} text-left`}>No. Invoice</th>
                                        <th className={`${NB.tableHeadCell} text-left`}>Pelanggan</th>
                                        <th className={`${NB.tableHeadCell} text-left`}>NPWP</th>
                                        <th className={`${NB.tableHeadCell} text-right`}>DPP</th>
                                        <th className={`${NB.tableHeadCell} text-right`}>PPN</th>
                                        <th className={`${NB.tableHeadCell} text-right`}>Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {invoices.map((inv) => (
                                        <tr
                                            key={inv.id}
                                            className={`${NB.tableRow} cursor-pointer hover:bg-zinc-50 ${
                                                selected.has(inv.id) ? 'bg-blue-50' : ''
                                            }`}
                                            onClick={() => toggle(inv.id)}
                                        >
                                            <td className={NB.tableCell}>
                                                <Checkbox
                                                    checked={selected.has(inv.id)}
                                                    onCheckedChange={() => toggle(inv.id)}
                                                />
                                            </td>
                                            <td className={`${NB.tableCell} font-mono font-bold`}>
                                                {inv.number}
                                            </td>
                                            <td className={NB.tableCell}>{inv.customerName}</td>
                                            <td className={`${NB.tableCell} font-mono text-[10px]`}>
                                                {inv.customerNpwp || '-'}
                                            </td>
                                            <td className={`${NB.tableCell} text-right font-mono`}>
                                                {formatIDR(inv.dppAmount)}
                                            </td>
                                            <td className={`${NB.tableCell} text-right font-mono`}>
                                                {formatIDR(inv.ppnAmount)}
                                            </td>
                                            <td className={`${NB.tableCell} text-right font-mono font-bold`}>
                                                {formatIDR(inv.totalAmount)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {invoices.length > 0 && (
                        <div className="text-[10px] font-bold text-zinc-400 pt-2">
                            {selected.size} dari {invoices.length} dipilih · Total: Rp {formatIDR(selectedTotal)}
                        </div>
                    )}
                </NBDialogBody>

                {invoices.length > 0 && (
                    <NBDialogFooter
                        onCancel={() => setOpen(false)}
                        onSubmit={handleExport}
                        submitting={loading}
                        submitLabel={loading ? 'Mengekspor...' : `Export ${selected.size} Faktur`}
                        disabled={selected.size === 0}
                    />
                )}
            </DialogContent>
        </Dialog>
    )
}
