"use client"

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { ArrowRight, FileUp, PenLine, Search, Upload, X } from "lucide-react"
import { IconEngine } from "@tabler/icons-react"
import { NB } from "@/lib/dialog-styles"
import { cn } from "@/lib/utils"
import { NEXT_ACTION_LABEL } from "@/lib/sparepart-purchase-logic"
import type { SparepartFilter, SparepartRow } from "@/lib/actions/sparepart-purchasing"
import { preloadPdfjs } from "@/lib/invoice-parse/client"
import { prefetchSparepartDetail, useSparepartList, useSparepartLookup, type PendingRow } from "@/hooks/use-sparepart-purchases"
import { InvoiceReview, type ReviewTarget } from "@/components/procurement/spareparts/invoice-review"
import { PurchaseDetailSheet } from "@/components/procurement/spareparts/purchase-detail-sheet"
import { GoodsBar, PayBar } from "@/components/procurement/spareparts/stage-bars"
import { money, rupiahShort, shortDate } from "@/components/procurement/spareparts/format"

const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

const FILTERS: { key: SparepartFilter; label: string; dot: string }[] = [
    { key: "all", label: "Semua", dot: "bg-zinc-400" },
    { key: "unpaid", label: "Belum lunas", dot: "bg-amber-500" },
    { key: "transit", label: "Di jalan", dot: "bg-sky-500" },
    { key: "incoming", label: "Belum lengkap", dot: "bg-sky-300" },
    { key: "done", label: "Selesai", dot: "bg-emerald-500" },
]

export default function SparepartPurchasesPage() {
    const qc = useQueryClient()
    const [filter, setFilter] = useState<SparepartFilter>("all")
    const [search, setSearch] = useState("")
    const q = useDeferredValue(search.trim())
    const list = useSparepartList(filter, q)
    const lookup = useSparepartLookup()
    const [review, setReview] = useState<ReviewTarget | null>(null)
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [dragging, setDragging] = useState(false)
    const fileInput = useRef<HTMLInputElement>(null)
    const lastRows = useRef(new Map<string, SparepartRow>())

    // Warm the PDF reader while the user looks at the list, so the first drop parses at once.
    useEffect(() => {
        const idle = (window as unknown as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback
        const run = () => void preloadPdfjs().catch(() => undefined)
        if (idle) idle(run)
        else setTimeout(run, 300)
    }, [])

    const rows: PendingRow[] = useMemo(() => list.data?.pages.flatMap((p) => p.rows) ?? [], [list.data])
    useEffect(() => {
        for (const r of rows) lastRows.current.set(r.id, r)
    }, [rows])
    const selected = selectedId ? rows.find((r) => r.id === selectedId) ?? lastRows.current.get(selectedId) ?? null : null
    const kpi = list.data?.pages[0]?.kpi
    const serverMs = list.data?.pages[0]?.serverMs

    const openFile = useCallback((file: File | null | undefined) => {
        if (!file) return
        setReview({ file, key: Date.now() })
    }, [])

    // A file can be dropped anywhere on the page.
    useEffect(() => {
        let depth = 0
        const hasFile = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files")
        const enter = (e: DragEvent) => {
            if (!hasFile(e)) return
            depth++
            setDragging(true)
        }
        const leave = () => {
            depth = Math.max(0, depth - 1)
            if (!depth) setDragging(false)
        }
        const over = (e: DragEvent) => hasFile(e) && e.preventDefault()
        const drop = (e: DragEvent) => {
            if (!hasFile(e)) return
            e.preventDefault()
            depth = 0
            setDragging(false)
            openFile(e.dataTransfer?.files?.[0])
        }
        const paste = (e: ClipboardEvent) => {
            const f = Array.from(e.clipboardData?.files ?? [])[0]
            if (f) openFile(f)
        }
        window.addEventListener("dragenter", enter)
        window.addEventListener("dragleave", leave)
        window.addEventListener("dragover", over)
        window.addEventListener("drop", drop)
        window.addEventListener("paste", paste)
        return () => {
            window.removeEventListener("dragenter", enter)
            window.removeEventListener("dragleave", leave)
            window.removeEventListener("dragover", over)
            window.removeEventListener("drop", drop)
            window.removeEventListener("paste", paste)
        }
    }, [openFile])

    // Infinite scroll: load the next page before the user reaches the end.
    const sentinel = useRef<HTMLDivElement>(null)
    useEffect(() => {
        const el = sentinel.current
        if (!el) return
        const io = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting && list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage()
        }, { rootMargin: "600px" })
        io.observe(el)
        return () => io.disconnect()
    }, [list])

    const warm = (id: string) => {
        if (!id.startsWith("pending-")) prefetchSparepartDetail(qc, id)
    }

    return (
        <div className="flex-1 p-4 md:p-6 lg:p-8 pt-6 w-full space-y-4">
            <input ref={fileInput} type="file" accept={ACCEPT} className="hidden" onChange={(e) => { openFile(e.target.files?.[0]); e.target.value = "" }} />

            <div className={NB.pageCard}>
                <div className={NB.pageAccent} />
                {/* Row 1: title + the one primary action */}
                <div className={cn("px-5 py-4 flex flex-wrap items-center gap-4", NB.pageRowBorder)}>
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="h-10 w-10 bg-blue-500 border border-border flex items-center justify-center shrink-0">
                            <IconEngine className="h-5 w-5 text-white" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-lg font-semibold leading-tight">Pembelian Sparepart</h1>
                            <p className="text-sm text-slate-500">Seret PO, CO, invoice atau surat jalan ke halaman ini — PDF, Excel atau foto. Sistem membaca dan mengerjakan sisanya.</p>
                        </div>
                    </div>
                    <div className="flex items-center">
                        <button onClick={() => setReview({ file: null, key: Date.now() })} className={cn(NB.toolbarBtn, "inline-flex items-center gap-1.5")}>
                            <PenLine className="h-3.5 w-3.5" /> Isi manual
                        </button>
                        <button onClick={() => fileInput.current?.click()} className={cn(NB.toolbarBtnPrimary, "inline-flex items-center gap-1.5")}>
                            <Upload className="h-4 w-4" /> Import dokumen
                        </button>
                    </div>
                </div>

                {/* Row 2: KPI strip — also the filters */}
                <div className={cn(NB.kpiStrip, NB.pageRowBorder, "overflow-x-auto")}>
                    {FILTERS.map((f) => {
                        const count = kpi ? (f.key === "all" ? kpi.total : kpi[f.key]) : null
                        const active = filter === f.key
                        return (
                            <button
                                key={f.key}
                                onClick={() => setFilter(f.key)}
                                className={cn(NB.kpiCell, "cursor-pointer min-w-[150px] transition-colors text-left", active ? "bg-blue-50/70 dark:bg-blue-950/20" : "hover:bg-zinc-50")}
                            >
                                <span className={cn(NB.kpiLabel, "flex items-center gap-1.5", active && "text-blue-700")}>
                                    <span className={cn("h-2 w-2", f.dot)} /> {f.label}
                                </span>
                                <span className="text-right">
                                    <span className={NB.kpiCount}>{count ?? "–"}</span>
                                    {f.key === "unpaid" && kpi && kpi.unpaidAmount > 0 && (
                                        <span className={cn(NB.kpiAmount, "block")}>{rupiahShort(kpi.unpaidAmount)}</span>
                                    )}
                                </span>
                            </button>
                        )
                    })}
                </div>

                {/* Row 3: search */}
                <div className={NB.filterBar}>
                    <div className="relative w-full max-w-md">
                        <Search className={cn("absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 z-20", search ? NB.inputIconActive : NB.inputIconEmpty)} />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Cari kode part, no. invoice, supplier, PO…"
                            className={cn(NB.filterInput, "w-full", search ? NB.inputActive : NB.inputEmpty)}
                        />
                        {search && (
                            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 z-20 p-0.5 text-zinc-400 hover:text-zinc-700" aria-label="Hapus pencarian">
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                    <span className="text-xs font-bold text-zinc-400 whitespace-nowrap ml-3">
                        {rows.length} pembelian{serverMs != null && <span className="font-mono"> · {serverMs} ms</span>}
                        {list.isFetching && !list.isFetchingNextPage && <span className="ml-1.5 inline-block h-1.5 w-1.5 bg-blue-500 animate-pulse" />}
                    </span>
                </div>
            </div>

            {/* List */}
            {!list.data ? (
                <div className="border border-border bg-white">
                    {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-[68px] border-b border-zinc-100 animate-pulse bg-zinc-50/60" />)}
                </div>
            ) : rows.length === 0 ? (
                <EmptyState searching={!!q || filter !== "all"} onUpload={() => fileInput.current?.click()} onReset={() => { setSearch(""); setFilter("all") }} />
            ) : (
                <div className="border border-border bg-white dark:bg-zinc-900 shadow-sm">
                    <div className="hidden md:grid grid-cols-[minmax(0,2.2fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_150px] gap-4 px-4 py-2 border-b border-border bg-zinc-100 dark:bg-zinc-800 text-xs font-semibold text-zinc-500">
                        <span>Supplier · invoice</span>
                        <span className="text-right">Total</span>
                        <span>Bayar</span>
                        <span>Barang</span>
                        <span className="text-right">Langkah berikutnya</span>
                    </div>
                    {rows.map((r) => (
                        <div
                            key={r.id}
                            role="button"
                            tabIndex={0}
                            onPointerEnter={() => warm(r.id)}
                            onPointerDown={() => warm(r.id)}
                            onFocus={() => warm(r.id)}
                            onClick={() => !r.pending && setSelectedId(r.id)}
                            onKeyDown={(e) => e.key === "Enter" && !r.pending && setSelectedId(r.id)}
                            className={cn(
                                "grid grid-cols-1 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_150px] gap-x-4 gap-y-2 items-center px-4 py-3 border-b border-zinc-100 last:border-0 cursor-pointer transition-colors outline-none",
                                "hover:bg-blue-50/50 focus-visible:bg-blue-50 active:bg-blue-100/60",
                                selectedId === r.id && "bg-blue-50",
                                r.pending && "opacity-60 animate-pulse cursor-wait",
                            )}
                        >
                            <div className="min-w-0">
                                <div className="font-bold truncate">{r.supplierName}</div>
                                <div className="text-xs text-zinc-500 truncate">
                                    <span className="font-mono">{r.supplierInvoiceNo}</span> · {shortDate(r.invoiceDate)} · <span className="font-mono">{r.poNumber}</span>
                                </div>
                            </div>
                            <div className="md:text-right">
                                <div className="font-mono font-semibold tabular-nums">{money(r.totalOriginal, r.currencyCode)}</div>
                                {r.currencyCode !== "IDR" && <div className="text-xs font-mono text-zinc-400 tabular-nums">{rupiahShort(r.billTotal)}</div>}
                            </div>
                            <PayBar stage={r.payStage} pct={r.paidPct} overdue={r.overdue} />
                            <GoodsBar stage={r.goodsStage} pct={r.receivedPct} />
                            <div className="md:text-right">
                                {r.pending ? (
                                    <span className="text-xs font-bold text-zinc-400">Menyimpan…</span>
                                ) : r.nextAction === "NONE" ? (
                                    <span className="text-xs font-semibold text-emerald-600">Selesai</span>
                                ) : (
                                    <span className={cn("inline-flex items-center gap-1 text-xs font-semibold  ", r.overdue ? "text-red-600" : "text-blue-600")}>
                                        {NEXT_ACTION_LABEL[r.nextAction]} <ArrowRight className="h-3 w-3" />
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                    <div ref={sentinel} />
                    {list.isFetchingNextPage && <div className="h-12 animate-pulse bg-zinc-50" />}
                </div>
            )}

            {/* Drop overlay */}
            <div
                className={cn(
                    "fixed inset-0 z-40 pointer-events-none flex items-center justify-center bg-blue-500/10 backdrop-blur-[1px] transition-opacity duration-150",
                    dragging ? "opacity-100" : "opacity-0",
                )}
            >
                <div className={cn("border border-dashed border-blue-500 bg-white px-10 py-8 text-center transition-transform duration-150", dragging ? "scale-100" : "scale-95")}>
                    <FileUp className="h-10 w-10 text-blue-500 mx-auto" />
                    <p className="mt-2 text-lg font-semibold  ">Lepas untuk membaca invoice</p>
                    <p className="text-xs text-zinc-500">PDF, JPG atau PNG · dibaca di perangkat ini</p>
                </div>
            </div>

            <InvoiceReview
                target={review}
                lookup={lookup.data}
                onClose={() => setReview(null)}
                onSaved={(id) => setSelectedId(id)}
                onOpenExisting={(id) => {
                    setReview(null)
                    setSelectedId(id)
                }}
            />
            <PurchaseDetailSheet row={selected} lookup={lookup.data} onClose={() => setSelectedId(null)} onUpload={() => fileInput.current?.click()} />
        </div>
    )
}

function EmptyState({ searching, onUpload, onReset }: { searching: boolean; onUpload: () => void; onReset: () => void }) {
    if (searching) {
        return (
            <div className="border border-dashed border-zinc-300 bg-white px-6 py-12 text-center">
                <p className="font-bold">Tidak ada yang cocok.</p>
                <button onClick={onReset} className="mt-2 text-xs font-semibold text-blue-600 hover:underline">Tampilkan semua</button>
            </div>
        )
    }
    return (
        <button onClick={onUpload} className="w-full border border-dashed border-zinc-300 hover:border-blue-500 bg-white hover:bg-blue-50/40 px-6 py-16 text-center transition-colors group">
            <FileUp className="h-10 w-10 mx-auto text-zinc-300 group-hover:text-blue-500 transition-colors" />
            <p className="mt-3 text-lg font-semibold text-slate-900">Seret dokumen pertama ke sini</p>
            <p className="mt-1 text-sm text-slate-500">PO / CO ke vendor, invoice supplier, atau surat jalan — PDF, Excel atau foto.</p>
            <p className="mt-1 text-sm text-slate-500">Nomor, tanggal, kode part, qty dan harga terisi sendiri. Bapak/Ibu cukup cek, lalu simpan.</p>
        </button>
    )
}
