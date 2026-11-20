"use client"

import { useState } from "react"
import { ArrowRight, Banknote, CircleCheck, ExternalLink, FileText, PackageCheck, Receipt, Truck } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { NEXT_ACTION_LABEL, type NextAction } from "@/lib/sparepart-purchase-logic"
import type { SparepartRow } from "@/lib/actions/sparepart-purchasing"
import { usePostSparepartBill, useSparepartDetail, type SparepartLookup } from "@/hooks/use-sparepart-purchases"
import { GoodsBar, PayBar } from "./stage-bars"
import { PayDialog, ReceiveDialog, ShipDialog, type ActionKind } from "./action-dialogs"
import { money, shortDate } from "./format"

const ACTION_ICON: Record<NextAction, React.ComponentType<{ className?: string }>> = {
    ATTACH_INVOICE: FileText,
    POST_BILL: Receipt,
    PAY: Banknote,
    SHIP: Truck,
    RECEIVE: PackageCheck,
    NONE: CircleCheck,
}

const EVENT_LABEL: Record<string, string> = {
    CAPTURE_SUPPLIER_INVOICE: "Dicatat dari invoice supplier",
    MARK_SHIPPED: "Ditandai dikirim",
    SOD_OVERRIDE: "Penerimaan oleh approver",
    AUTO_ORDERED_VIA_GRN: "Diterima",
}

/**
 * Opens instantly with what the list already knows (supplier, totals, status), then fills in
 * items, payments and receipts from a fresh read — money on this panel is never stale.
 */
export function PurchaseDetailSheet({ row, lookup, onClose, onUpload }: { row: SparepartRow | null; lookup: SparepartLookup | undefined; onClose: () => void; onUpload?: () => void }) {
    const id = row && !row.id.startsWith("pending-") ? row.id : null
    const { data: detail } = useSparepartDetail(id)
    const postBill = usePostSparepartBill()
    const [dialog, setDialog] = useState<ActionKind | null>(null)

    const view = detail ?? null
    const s = view ?? row
    const next: NextAction = s?.nextAction ?? "NONE"
    const NextIcon = ACTION_ICON[next]
    const goodsOpen = s ? s.goodsStage !== "RECEIVED" && s.goodsStage !== "CANCELLED" : false
    const payOpen = s ? s.payStage === "UNPAID" || s.payStage === "PARTIAL" : false

    function run(action: NextAction | ActionKind) {
        if (!row) return
        if (action === "ATTACH_INVOICE") onUpload?.()
        else if (action === "POST_BILL") postBill.mutate({ id: row.id })
        else if (action === "PAY" || action === "pay") setDialog("pay")
        else if (action === "SHIP" || action === "ship") setDialog("ship")
        else if (action === "RECEIVE" || action === "receive") setDialog("receive")
    }

    const secondary: { kind: ActionKind; label: string; show: boolean }[] = [
        { kind: "pay", label: "Catat bayar", show: payOpen && next !== "PAY" },
        { kind: "ship", label: "Tandai dikirim", show: goodsOpen && next !== "SHIP" && !(s?.shippedAt) },
        { kind: "receive", label: "Terima barang", show: goodsOpen && next !== "RECEIVE" },
    ]

    return (
        <>
            <Sheet open={!!row} onOpenChange={(v) => !v && onClose()}>
                <SheetContent
                    side="right"
                    className="w-full sm:max-w-[560px] p-0 gap-0 border-l border-border data-[state=open]:duration-200 data-[state=closed]:duration-150 overflow-y-auto"
                >
                    {row && s && (
                        <>
                            <div className="h-1 bg-blue-500" />
                            <div className="px-5 pt-4 pb-3 border-b border-zinc-200">
                                <SheetDescription className="text-xs font-semibold text-zinc-400">
                                    {row.poNumber} · {row.billNumber ?? "tagihan"}
                                </SheetDescription>
                                <SheetTitle className="text-lg font-semibold leading-tight mt-0.5 pr-8">{row.supplierName}</SheetTitle>
                                <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                                    <span className="font-mono font-bold">{row.supplierInvoiceNo}</span>
                                    <span className="text-zinc-500">{shortDate(row.invoiceDate)}</span>
                                    <span className="ml-auto font-mono font-semibold text-base">{money(row.totalOriginal, row.currencyCode)}</span>
                                </div>
                                {row.currencyCode !== "IDR" && (
                                    <div className="text-right text-xs font-mono text-zinc-500">{money(row.billTotal, "IDR")} @ {row.exchangeRate.toLocaleString("id-ID")}</div>
                                )}
                            </div>

                            <div className="px-5 py-4 grid grid-cols-2 gap-4 border-b border-zinc-200">
                                <PayBar stage={s.payStage} pct={s.paidPct} overdue={s.overdue} />
                                <GoodsBar stage={s.goodsStage} pct={s.receivedPct} />
                                {s.shippedAt && goodsOpen && (
                                    <p className="col-span-2 text-xs text-zinc-500">
                                        Dikirim {shortDate(s.shippedAt)}{s.trackingNumber ? ` · resi ${s.trackingNumber}` : ""}{s.eta ? ` · tiba ±${shortDate(s.eta)}` : ""}
                                    </p>
                                )}
                            </div>

                            {/* The one obvious next step */}
                            <div className="px-5 py-4 border-b border-zinc-200 space-y-2.5">
                                {next === "NONE" ? (
                                    <div className="flex items-center gap-2 text-sm font-bold text-emerald-700">
                                        <CircleCheck className="h-5 w-5" /> Lunas dan barang lengkap
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => run(next)}
                                        disabled={row.id.startsWith("pending-") || (next === "POST_BILL" && !lookup?.canPost)}
                                        className="w-full h-12 bg-blue-500 text-white border border-border shadow-sm hover:shadow-sm active:shadow-none transition-all font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
                                    >
                                        <NextIcon className="h-4 w-4" /> {NEXT_ACTION_LABEL[next]} <ArrowRight className="h-4 w-4" />
                                    </button>
                                )}
                                {next === "POST_BILL" && !lookup?.canPost && (
                                    <p className="text-xs font-bold text-zinc-500">Menunggu finance memposting tagihan. Barang tetap bisa diterima.</p>
                                )}
                                <div className="flex flex-wrap gap-x-4 gap-y-1">
                                    {secondary.filter((a) => a.show).map((a) => (
                                        <button key={a.kind} onClick={() => run(a.kind)} className="text-xs font-semibold text-zinc-500 hover:text-black underline-offset-4 hover:underline">
                                            {a.label}
                                        </button>
                                    ))}
                                    {view?.file && (
                                        <a href={view.file.url} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-zinc-500 hover:text-black">
                                            <FileText className="h-3.5 w-3.5" /> Invoice asli <ExternalLink className="h-3 w-3" />
                                        </a>
                                    )}
                                </div>
                            </div>

                            {!view && (
                                <div className="p-5 space-y-2">
                                    {[0, 1, 2, 3].map((i) => <div key={i} className="h-9 bg-zinc-100 animate-pulse" />)}
                                </div>
                            )}

                            {view && (
                                <div className="animate-in fade-in-0 duration-150">
                                    <Section title="Barang" hint={`${view.received}/${view.ordered} datang`}>
                                        <table className="w-full text-sm">
                                            <tbody>
                                                {view.po.items.map((i) => (
                                                    <tr key={i.id} className="border-b border-zinc-100 last:border-0">
                                                        <td className="py-2 pr-2">
                                                            <div className="font-mono text-xs text-zinc-500">{i.partNo || i.code}</div>
                                                            <div className="font-medium leading-tight">{i.name}</div>
                                                        </td>
                                                        <td className="py-2 px-2 text-right font-mono text-xs whitespace-nowrap">
                                                            {i.unitPriceOriginal != null && view.currencyCode !== "IDR" ? money(i.unitPriceOriginal, view.currencyCode) : money(i.unitPriceIdr, "IDR")}
                                                        </td>
                                                        <td className="py-2 pl-2 text-right whitespace-nowrap">
                                                            <span className={cn("font-mono font-bold text-xs", i.receivedQty >= i.quantity ? "text-emerald-700" : i.receivedQty > 0 ? "text-sky-700" : "text-zinc-500")}>
                                                                {i.receivedQty}/{i.quantity}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </Section>

                                    <Section title="Pembayaran" hint={view.bill ? `sisa ${money(view.bill.balanceDue, "IDR")}` : undefined}>
                                        {view.bill?.payments.length ? (
                                            view.bill.payments.map((p) => (
                                                <div key={p.id} className="flex items-center justify-between py-1.5 text-sm border-b border-zinc-100 last:border-0">
                                                    <span><span className="font-mono text-xs text-zinc-500">{p.number}</span> · {shortDate(p.date)}</span>
                                                    <span className="font-mono font-bold">{money(p.amount, "IDR")}</span>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-sm text-zinc-500">Belum ada pembayaran.</p>
                                        )}
                                    </Section>

                                    <Section title="Penerimaan barang">
                                        {view.po.grns.length ? (
                                            view.po.grns.map((g) => (
                                                <div key={g.id} className="flex items-center justify-between py-1.5 text-sm border-b border-zinc-100 last:border-0">
                                                    <span><span className="font-mono text-xs text-zinc-500">{g.number}</span> · {shortDate(g.receivedDate)}{g.warehouse ? ` · ${g.warehouse}` : ""}</span>
                                                    <span className="font-mono font-bold">{g.qty} pcs</span>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-sm text-zinc-500">Belum ada barang datang.</p>
                                        )}
                                    </Section>

                                    <Section title="Riwayat">
                                        <ol className="space-y-1.5">
                                            {view.po.events.map((e) => (
                                                <li key={e.id} className="flex gap-2 text-xs">
                                                    <span className="text-zinc-400 font-mono w-16 shrink-0">{shortDate(e.createdAt)}</span>
                                                    <span className="text-zinc-700">{EVENT_LABEL[e.action] ?? e.notes ?? e.action}</span>
                                                </li>
                                            ))}
                                        </ol>
                                        {view.parseMethod !== "MANUAL" && (
                                            <p className="mt-3 text-xs text-zinc-400">
                                                Dibaca otomatis{view.parseConfidence != null ? ` · keyakinan ${Math.round(view.parseConfidence * 100)}%` : ""}
                                            </p>
                                        )}
                                    </Section>
                                </div>
                            )}
                        </>
                    )}
                </SheetContent>
            </Sheet>
            {view && (
                <>
                    <PayDialog detail={view} lookup={lookup} open={dialog === "pay"} onOpenChange={(v) => setDialog(v ? "pay" : null)} />
                    <ShipDialog detail={view} open={dialog === "ship"} onOpenChange={(v) => setDialog(v ? "ship" : null)} />
                    <ReceiveDialog detail={view} lookup={lookup} open={dialog === "receive"} onOpenChange={(v) => setDialog(v ? "receive" : null)} />
                </>
            )}
        </>
    )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
    return (
        <div className="px-5 py-4 border-b border-zinc-200">
            <div className="flex items-baseline justify-between mb-2">
                <h3 className="text-xs font-semibold text-zinc-500">{title}</h3>
                {hint && <span className="text-xs font-mono text-zinc-400">{hint}</span>}
            </div>
            {children}
        </div>
    )
}
