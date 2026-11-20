"use client"

import { useEffect, useMemo, useState } from "react"
import { Banknote, PackageCheck, Truck } from "lucide-react"
import { NBDialog, NBDialogBody, NBDialogFooter, NBDialogHeader } from "@/components/ui/nb-dialog"
import { NB } from "@/lib/dialog-styles"
import { cn } from "@/lib/utils"
import { parseAmount } from "@/lib/invoice-parse/numbers"
import type { SparepartDetail } from "@/lib/actions/sparepart-purchasing"
import { usePaySparepart, useReceiveSparepart, useShipSparepart, type SparepartLookup } from "@/hooks/use-sparepart-purchases"
import { money } from "./format"

export type ActionKind = "pay" | "ship" | "receive"

/** Remaining balance in the invoice currency (the bill is kept in IDR). */
function remainingOriginal(d: SparepartDetail) {
    const balance = d.bill?.balanceDue ?? 0
    return d.currencyCode === "IDR" ? balance : Math.round((balance / (d.exchangeRate || 1)) * 100) / 100
}

export function PayDialog({ detail, open, onOpenChange }: { detail: SparepartDetail; open: boolean; onOpenChange: (v: boolean) => void }) {
    const pay = usePaySparepart()
    const remaining = remainingOriginal(detail)
    const [amount, setAmount] = useState("")
    useEffect(() => {
        if (open) setAmount(String(remaining))
    }, [open, remaining])
    const value = parseAmount(amount, detail.currencyCode === "IDR" ? "id" : "en") ?? 0
    const total = detail.totalOriginal
    const chips = useMemo(() => {
        const out: { label: string; value: number }[] = []
        if (remaining > 0) out.push({ label: "Lunasi sisa", value: remaining })
        if (remaining >= total * 0.3 && remaining === total) out.push({ label: "DP 30%", value: Math.round(total * 0.3 * 100) / 100 })
        if (remaining >= total * 0.5 && remaining === total) out.push({ label: "50%", value: Math.round(total * 0.5 * 100) / 100 })
        return out
    }, [remaining, total])
    const invalid = !(value > 0) || value > remaining + 0.005

    return (
        <NBDialog open={open} onOpenChange={onOpenChange} size="narrow">
            <NBDialogHeader icon={Banknote} title="Catat pembayaran" subtitle={`${detail.supplier.name} · ${detail.supplierInvoiceNo}`} />
            <NBDialogBody>
                <div className="flex items-baseline justify-between">
                    <span className={NB.label}>Sisa tagihan</span>
                    <span className="font-mono font-black text-lg">{money(remaining, detail.currencyCode)}</span>
                </div>
                <div>
                    <label className={NB.label}>Jumlah dibayar ({detail.currencyCode === "CNY" ? "RMB" : detail.currencyCode})</label>
                    <input
                        autoFocus
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className={cn(NB.inputMono, "w-full px-2 h-10 text-base", amount ? NB.inputActive : NB.inputEmpty)}
                        inputMode="decimal"
                    />
                    <div className="mt-2 flex gap-2">
                        {chips.map((c) => (
                            <button key={c.label} onClick={() => setAmount(String(c.value))} className="border border-zinc-300 px-2.5 h-7 text-[11px] font-bold hover:border-black transition-colors">
                                {c.label}
                            </button>
                        ))}
                    </div>
                    {detail.currencyCode !== "IDR" && value > 0 && (
                        <p className="mt-2 text-xs font-mono text-zinc-500">
                            Dibukukan {money(value * detail.exchangeRate, "IDR")} @ {detail.exchangeRate.toLocaleString("id-ID")}
                        </p>
                    )}
                    {value > remaining + 0.005 && <p className={NB.error}>Lebih dari sisa tagihan</p>}
                </div>
            </NBDialogBody>
            <NBDialogFooter
                onCancel={() => onOpenChange(false)}
                onSubmit={() => {
                    pay.mutate({ id: detail.id, amountOriginal: value, rate: detail.currencyCode === "IDR" ? 1 : detail.exchangeRate })
                    onOpenChange(false)
                }}
                submitLabel="Catat bayar"
                disabled={invalid}
            />
        </NBDialog>
    )
}

export function ShipDialog({ detail, open, onOpenChange }: { detail: SparepartDetail; open: boolean; onOpenChange: (v: boolean) => void }) {
    const ship = useShipSparepart()
    const [tracking, setTracking] = useState("")
    const [eta, setEta] = useState("")
    useEffect(() => {
        if (open) {
            setTracking(detail.trackingNumber ?? "")
            setEta(detail.eta?.slice(0, 10) ?? "")
        }
    }, [open, detail.trackingNumber, detail.eta])
    return (
        <NBDialog open={open} onOpenChange={onOpenChange} size="narrow">
            <NBDialogHeader icon={Truck} title="Tandai dikirim" subtitle={`${detail.supplier.name} · ${detail.po.number}`} />
            <NBDialogBody>
                <div>
                    <label className={NB.label}>No. resi / B/L (opsional)</label>
                    <input autoFocus value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="mis. COSU6123456780" className={cn(NB.inputMono, "w-full px-2", tracking ? NB.inputActive : NB.inputEmpty)} />
                </div>
                <div>
                    <label className={NB.label}>Perkiraan tiba (opsional)</label>
                    <input type="date" value={eta} onChange={(e) => setEta(e.target.value)} className={cn(NB.input, "w-full px-2", eta ? NB.inputActive : NB.inputEmpty)} />
                </div>
            </NBDialogBody>
            <NBDialogFooter
                onCancel={() => onOpenChange(false)}
                onSubmit={() => {
                    ship.mutate({ id: detail.id, trackingNumber: tracking || null, eta: eta || null })
                    onOpenChange(false)
                }}
                submitLabel="Tandai dikirim"
            />
        </NBDialog>
    )
}

export function ReceiveDialog({ detail, lookup, open, onOpenChange }: { detail: SparepartDetail; lookup: SparepartLookup | undefined; open: boolean; onOpenChange: (v: boolean) => void }) {
    const receive = useReceiveSparepart()
    const open_items = detail.po.items.filter((i) => i.quantity > i.receivedQty)
    const [qty, setQty] = useState<Record<string, string>>({})
    const [warehouseId, setWarehouseId] = useState("")
    useEffect(() => {
        if (open) {
            setQty(Object.fromEntries(detail.po.items.map((i) => [i.id, String(i.quantity - i.receivedQty)])))
            setWarehouseId(lookup?.warehouses?.[0]?.id ?? "")
        }
    }, [open, detail.po.items, lookup?.warehouses])
    const lines = open_items.map((i) => ({ poItemId: i.id, qty: Math.max(0, Math.min(i.quantity - i.receivedQty, Math.floor(Number(qty[i.id] || 0)))) }))
    const totalQty = lines.reduce((s, l) => s + l.qty, 0)

    return (
        <NBDialog open={open} onOpenChange={onOpenChange} size="default">
            <NBDialogHeader icon={PackageCheck} title="Terima barang" subtitle={`${detail.po.number} · isi jumlah yang benar-benar datang`} />
            <NBDialogBody>
                {(lookup?.warehouses.length ?? 0) > 1 && (
                    <div>
                        <label className={NB.label}>Gudang</label>
                        <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className={cn(NB.select, "w-full px-2 bg-white", NB.inputActive)}>
                            {lookup!.warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                    </div>
                )}
                <div className={NB.tableWrap}>
                    <table className="w-full text-sm">
                        <thead className={NB.tableHead}>
                            <tr>
                                <th className={cn(NB.tableHeadCell, "text-left")}>Barang</th>
                                <th className={cn(NB.tableHeadCell, "text-right")}>Sisa</th>
                                <th className={cn(NB.tableHeadCell, "text-right w-28")}>Datang</th>
                            </tr>
                        </thead>
                        <tbody>
                            {open_items.map((i) => (
                                <tr key={i.id} className={NB.tableRow}>
                                    <td className={NB.tableCell}>
                                        <div className="font-mono text-xs text-zinc-500">{i.partNo || i.code}</div>
                                        <div className="font-medium">{i.name}</div>
                                    </td>
                                    <td className={cn(NB.tableCell, "text-right font-mono")}>{i.quantity - i.receivedQty}</td>
                                    <td className={cn(NB.tableCell, "text-right")}>
                                        <input
                                            value={qty[i.id] ?? ""}
                                            onChange={(e) => setQty((q) => ({ ...q, [i.id]: e.target.value.replace(/[^\d]/g, "") }))}
                                            inputMode="numeric"
                                            className={cn(NB.inputMono, "w-20 px-2 text-right", NB.inputActive)}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <p className="text-[11px] text-zinc-500">Barang yang belum datang tetap tercatat sebagai sisa — bisa diterima nanti.</p>
            </NBDialogBody>
            <NBDialogFooter
                onCancel={() => onOpenChange(false)}
                onSubmit={() => {
                    receive.mutate({ id: detail.id, warehouseId: warehouseId || null, lines, totalQty })
                    onOpenChange(false)
                }}
                submitLabel={`Terima ${totalQty} barang`}
                disabled={totalQty <= 0}
            />
        </NBDialog>
    )
}
