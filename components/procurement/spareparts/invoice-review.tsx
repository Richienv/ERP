"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { AlertTriangle, Check, CircleCheck, FileText, Loader2, Plus, Sparkles, Trash2, X } from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { NB } from "@/lib/dialog-styles"
import { cn } from "@/lib/utils"
import { readInvoiceFile, type ReadResult } from "@/lib/invoice-parse/client"
import { fingerprintOf, learnTemplate, matchLines, matchSupplier, normalisePartCode, type LookupTemplate } from "@/lib/invoice-parse/match"
import { parseAmount } from "@/lib/invoice-parse/numbers"
import type { Box, ParsedInvoice, SupplierTemplate } from "@/lib/invoice-parse/types"
import { derivePurchaseStatus, netUnitPrice, type CurrencyCode } from "@/lib/sparepart-purchase-logic"
import { checkSupplierInvoiceDuplicate, type SaveSupplierInvoiceInput } from "@/lib/actions/sparepart-purchasing"
import { useSaveSupplierInvoice, type PendingRow, type SparepartLookup } from "@/hooks/use-sparepart-purchases"
import { InvoicePreview, type PreviewMark } from "./pdf-preview"
import { SearchPicker } from "./pickers"
import { money, ms, todayIso } from "./format"

// ── Draft model ──────────────────────────────────────────────────────────────

type DraftLine = {
    key: string
    partNo: string
    description: string
    qty: string
    unit: string
    unitPrice: string
    discountPct: string
    productId: string | null
    matchVia: "sku" | "code" | "manual" | null
    confidence: number
    issues: string[]
    source?: Box
}

type Draft = {
    supplierId: string | null
    supplierName: string
    supplierNpwp: string
    supplierEmail: string
    supplierVia: string | null
    invoiceNo: string
    invoiceDate: string
    dueDate: string
    paymentTerms: string
    currency: CurrencyCode
    rate: string
    tax: string
    lines: DraftLine[]
    paidNow: boolean
    paidAmount: string
    receivedAll: boolean
    warehouseId: string
}

type Upload = { sha256: string; storagePath: string; name: string; type: string; size: number }

let keySeq = 0
const nextKey = () => `l${++keySeq}`

function emptyLine(): DraftLine {
    return { key: nextKey(), partNo: "", description: "", qty: "1", unit: "PCS", unitPrice: "", discountPct: "", productId: null, matchVia: null, confidence: 1, issues: [] }
}

const toStr = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? "" : String(Math.round(n * 100) / 100))

function draftFromParsed(parsed: ParsedInvoice, lookup: SparepartLookup | undefined): Draft {
    const f = parsed.fields
    const templates = (lookup?.templates ?? []) as unknown as LookupTemplate[]
    const sm = lookup ? matchSupplier(parsed, lookup.suppliers, templates) : null
    const supplier = sm ? lookup!.suppliers.find((s) => s.id === sm.supplierId) : null
    const currency = ((f.currency?.value as CurrencyCode) || "IDR") as CurrencyCode
    const lm = lookup ? matchLines(parsed.lines, sm?.supplierId ?? null, lookup.products, lookup.skus) : parsed.lines.map(() => ({ productId: null, via: null }))
    const tpl = sm ? lookup!.templates.find((t) => t.supplierId === sm.supplierId) : null
    const rate = currency === "IDR" ? 1 : tpl?.lastRate ?? lookup?.latestRate?.[currency]?.rate ?? null
    return {
        supplierId: sm?.supplierId ?? null,
        supplierName: supplier?.name ?? String(f.supplierName?.value ?? ""),
        supplierNpwp: String(f.supplierNpwp?.value ?? ""),
        supplierEmail: String(f.supplierEmail?.value ?? ""),
        supplierVia: sm?.via ?? null,
        invoiceNo: String(f.invoiceNo?.value ?? ""),
        invoiceDate: String(f.invoiceDate?.value ?? todayIso()),
        dueDate: String(f.dueDate?.value ?? ""),
        paymentTerms: String(f.paymentTerms?.value ?? ""),
        currency,
        rate: rate ? String(rate) : "",
        tax: toStr(Number(f.tax?.value ?? 0)),
        lines: parsed.lines.length
            ? parsed.lines.map((l, i) => ({
                key: nextKey(),
                partNo: l.partNo ?? "",
                description: l.description,
                qty: toStr(l.qty),
                unit: l.unit ?? "PCS",
                unitPrice: toStr(l.unitPrice),
                discountPct: l.discountPct ? toStr(l.discountPct) : "",
                productId: lm[i]?.productId ?? null,
                matchVia: lm[i]?.via ?? null,
                confidence: l.confidence,
                issues: l.issues,
                source: l.source,
            }))
            : [emptyLine()],
        paidNow: false,
        paidAmount: "",
        receivedAll: false,
        warehouseId: lookup?.warehouses?.[0]?.id ?? "",
    }
}

function numOf(s: string, currency: CurrencyCode): number | null {
    if (!s.trim()) return null
    return parseAmount(s, currency === "IDR" ? "id" : "en")
}

// ── Component ────────────────────────────────────────────────────────────────

export type ReviewTarget = { file: File | null; key: number }

export function InvoiceReview({
    target,
    lookup,
    onClose,
    onSaved,
    onOpenExisting,
}: {
    target: ReviewTarget | null
    lookup: SparepartLookup | undefined
    onClose: () => void
    onSaved: (id: string) => void
    onOpenExisting: (id: string) => void
}) {
    const [read, setRead] = useState<ReadResult | null>(null)
    const [parsed, setParsed] = useState<ParsedInvoice | null>(null)
    const [readError, setReadError] = useState<string | null>(null)
    const [draft, setDraft] = useState<Draft | null>(null)
    const [focus, setFocus] = useState<Box | null>(null)
    const [duplicate, setDuplicate] = useState<Awaited<ReturnType<typeof checkSupplierInvoiceDuplicate>>>(null)
    const [saveError, setSaveError] = useState<string | null>(null)
    const uploadRef = useRef<Promise<Upload | null> | null>(null)
    const save = useSaveSupplierInvoice()
    const file = target?.file ?? null

    // Read + upload start the moment a file lands. Both run in parallel.
    useEffect(() => {
        setRead(null)
        setParsed(null)
        setReadError(null)
        setDuplicate(null)
        setSaveError(null)
        setFocus(null)
        if (!target) {
            setDraft(null)
            return
        }
        if (!target.file) {
            setDraft(draftFromParsed({ fields: {}, lines: [], numberLocale: "id", checks: { linesVsSubtotal: null, subtotalPlusTaxVsTotal: null }, confidence: 0, headerCells: [], method: "TEXT", pages: 0 }, lookup))
            uploadRef.current = null
            return
        }
        const f = target.file
        setDraft(null)
        const form = new FormData()
        form.append("file", f)
        uploadRef.current = fetch("/api/procurement/sparepart-invoices/upload", { method: "POST", body: form })
            .then((r) => r.json())
            .then((j) => (j?.success ? (j as Upload) : null))
            .catch(() => null)
        let cancelled = false
        // Scans and photos fall back to OCR in the browser; the engine loads only when needed.
        const ocr = (file: File, bytes: Uint8Array) => import("@/lib/invoice-parse/ocr").then((m) => m.ocrInvoice(file, bytes))
        readInvoiceFile(f, { ocr })
            .then((r) => {
                if (cancelled) return
                setRead(r)
                setParsed(r.parsed)
            })
            .catch((e) => !cancelled && setReadError(e?.message || "File tidak bisa dibaca"))
        return () => {
            cancelled = true
        }
    }, [target?.key])

    // Once we have both the parse and the lookup: match, apply the supplier's template, fill the form.
    useEffect(() => {
        if (!read || !parsed || draft) return
        let best = parsed
        const templates = (lookup?.templates ?? []) as unknown as LookupTemplate[]
        const sm = lookup ? matchSupplier(parsed, lookup.suppliers, templates) : null
        const tpl = sm ? templates.find((t) => t.supplierId === sm.supplierId) : null
        if (tpl && tpl.template && Object.keys(tpl.template).length) {
            const again = read.reparse(tpl.template as SupplierTemplate)
            if (again.confidence >= parsed.confidence) best = again
        }
        if (best !== parsed) setParsed(best)
        const d = draftFromParsed(best, lookup)
        setDraft(d)
        void checkSupplierInvoiceDuplicate({ sha256: read.sha256, supplierId: d.supplierId, invoiceNo: d.invoiceNo }).then(setDuplicate).catch(() => undefined)
    }, [read, parsed, lookup, draft])

    const set = useCallback(<K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d)), [])
    const setLine = useCallback((key: string, patch: Partial<DraftLine>) => {
        setDraft((d) => (d ? { ...d, lines: d.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) } : d))
    }, [])

    // ── Live totals and checks ──
    const calc = useMemo(() => {
        if (!draft) return null
        const cur = draft.currency
        const lines = draft.lines.map((l) => {
            const qty = numOf(l.qty, cur)
            const price = numOf(l.unitPrice, cur)
            const disc = numOf(l.discountPct, cur) ?? 0
            const amount = qty != null && price != null ? Math.round(qty * netUnitPrice(price, disc) * 100) / 100 : null
            return { qty, price, disc, amount }
        })
        const subtotal = Math.round(lines.reduce((s, l) => s + (l.amount ?? 0), 0) * 100) / 100
        const tax = numOf(draft.tax, cur) ?? 0
        const total = Math.round((subtotal + tax) * 100) / 100
        const printedTotal = parsed?.fields.total ? Number(parsed.fields.total.value) : null
        const diff = printedTotal != null && read ? Math.round((total - printedTotal) * 100) / 100 : null
        const rate = cur === "IDR" ? 1 : numOf(draft.rate, "USD")
        return { lines, subtotal, tax, total, printedTotal, diff, rate, totalIdr: rate ? total * rate : null }
    }, [draft, parsed, read])

    const problems = useMemo(() => {
        if (!draft || !calc) return ["Membaca invoice…"]
        const p: string[] = []
        if (!draft.supplierId && !draft.supplierName.trim()) p.push("Isi supplier")
        if (!draft.invoiceNo.trim()) p.push("Isi nomor invoice")
        if (!draft.invoiceDate) p.push("Isi tanggal invoice")
        if (draft.currency !== "IDR" && !(calc.rate && calc.rate > 0)) p.push(`Isi kurs ${draft.currency}`)
        draft.lines.forEach((l, i) => {
            const c = calc.lines[i]
            if (!l.description.trim()) p.push(`Baris ${i + 1}: nama barang`)
            else if (!(c.qty && c.qty > 0) || !Number.isInteger(c.qty)) p.push(`Baris ${i + 1}: qty bulat`)
            else if (c.price == null) p.push(`Baris ${i + 1}: harga`)
            else if (!l.productId && !l.partNo.trim()) p.push(`Baris ${i + 1}: pilih produk atau isi kode part`)
        })
        if (duplicate && (duplicate.sameFile || duplicate.supplierInvoiceNo === draft.invoiceNo.trim())) p.push("Invoice ini sudah tercatat — buka yang lama")
        return p
    }, [draft, calc, duplicate])

    const marks: PreviewMark[] = useMemo(() => {
        const out: PreviewMark[] = []
        if (parsed) {
            for (const fld of Object.values(parsed.fields)) if (fld?.source && fld.confidence < 0.75) out.push({ box: fld.source, tone: "warn" })
            for (const l of parsed.lines) if (l.source && (l.confidence < 0.75 || l.issues.length)) out.push({ box: l.source, tone: "warn" })
        }
        if (focus) out.push({ box: focus, tone: "focus" })
        return out
    }, [parsed, focus])

    async function handleSave() {
        if (!draft || !calc || problems.length) return
        setSaveError(null)
        const upload = uploadRef.current ? await uploadRef.current : null
        const templates = (lookup?.templates ?? []) as unknown as LookupTemplate[]
        const prevTpl = draft.supplierId ? templates.find((t) => t.supplierId === draft.supplierId)?.template : null
        const input: SaveSupplierInvoiceInput = {
            supplier: draft.supplierId
                ? { id: draft.supplierId, name: draft.supplierName }
                : { name: draft.supplierName.trim(), npwp: draft.supplierNpwp || null, email: draft.supplierEmail || null },
            invoiceNo: draft.invoiceNo.trim(),
            invoiceDate: draft.invoiceDate,
            dueDate: draft.dueDate || null,
            paymentTerms: draft.paymentTerms || null,
            currencyCode: draft.currency,
            exchangeRate: calc.rate ?? 0,
            taxOriginal: calc.tax,
            lines: draft.lines.map((l, i) => ({
                productId: l.productId,
                newProduct: l.productId ? null : { code: normalisePartCode(l.partNo) || l.partNo.trim(), name: l.description.trim(), unit: l.unit || "PCS" },
                partNo: l.partNo.trim() || null,
                description: l.description.trim(),
                qty: calc.lines[i].qty ?? 0,
                unit: l.unit || null,
                unitPriceOriginal: calc.lines[i].price ?? 0,
                discountPct: calc.lines[i].disc || null,
            })),
            file: upload,
            parse: parsed && read
                ? {
                    method: parsed.method,
                    ms: read.timing.total,
                    confidence: parsed.confidence,
                    snapshot: { checks: parsed.checks, numberLocale: parsed.numberLocale, timing: read.timing, fields: Object.fromEntries(Object.entries(parsed.fields).map(([k, v]) => [k, { value: v?.value, confidence: v?.confidence }])) },
                    fingerprint: fingerprintOf(parsed),
                    template: learnTemplate(prevTpl as SupplierTemplate | null, parsed, { currencyCode: draft.currency }) as Record<string, unknown>,
                }
                : { method: "MANUAL" },
            already: {
                paidOriginal: draft.paidNow ? (numOf(draft.paidAmount, draft.currency) ?? calc.total) : null,
                receivedAll: draft.receivedAll,
                warehouseId: draft.warehouseId || null,
            },
        }
        const rate = calc.rate ?? 1
        const billTotal = calc.total * rate
        const optimistic: PendingRow = {
            id: `pending-${Date.now()}`,
            pending: true,
            supplierInvoiceNo: input.invoiceNo,
            invoiceDate: new Date(input.invoiceDate).toISOString(),
            dueDate: input.dueDate ? new Date(input.dueDate).toISOString() : null,
            currencyCode: draft.currency,
            exchangeRate: rate,
            totalOriginal: calc.total,
            shippedAt: null,
            trackingNumber: null,
            eta: null,
            createdAt: new Date().toISOString(),
            parseMethod: input.parse?.method ?? "MANUAL",
            poId: "",
            poNumber: "Menyimpan…",
            poStatus: "VENDOR_CONFIRMED",
            supplierId: draft.supplierId ?? "",
            supplierName: draft.supplierName,
            billId: null,
            billNumber: null,
            billStatus: "DRAFT",
            billTotal,
            balanceDue: billTotal,
            ordered: input.lines.reduce((s, l) => s + l.qty, 0),
            received: 0,
            lineCount: input.lines.length,
            ...derivePurchaseStatus({ poStatus: "VENDOR_CONFIRMED", billStatus: "DRAFT", billTotal, balanceDue: billTotal, dueDate: input.dueDate ?? null, ordered: 1, received: 0, shippedAt: null, currencyCode: draft.currency }),
        }
        onClose()
        save.mutate(
            { input, optimistic },
            {
                onSuccess: (r) => {
                    const notes: string[] = []
                    if (r.steps.post?.ok) notes.push("tagihan diposting")
                    else if (r.steps.post?.skipped) notes.push(r.steps.post.skipped.toLowerCase())
                    else if (r.steps.post?.error) notes.push(`tagihan belum diposting: ${r.steps.post.error}`)
                    if (r.steps.pay) notes.push(r.steps.pay.ok ? "pembayaran tercatat" : `bayar belum: ${r.steps.pay.error || r.steps.pay.skipped}`)
                    if (r.steps.receive) notes.push(r.steps.receive.ok ? "barang diterima" : `terima belum: ${r.steps.receive.error}`)
                    const allOk = [r.steps.post, r.steps.pay, r.steps.receive].every((s) => !s || s.ok || s.skipped)
                    ;(allOk ? toastSuccess : toastWarn)(`Tersimpan · ${r.poNumber}${notes.length ? ` · ${notes.join(" · ")}` : ""}`)
                    onSaved(r.captureId)
                },
                onError: (e) => {
                    const res = (e as Error & { result?: { code?: string; existingId?: string } }).result
                    if (res?.code === "DUPLICATE" && res.existingId) {
                        toastWarn(e.message, { label: "Buka", onClick: () => onOpenExisting(res.existingId!) })
                    } else {
                        toastError(`Gagal menyimpan: ${e.message}`)
                    }
                },
            },
        )
    }

    const open = !!target
    const reading = !!file && !draft && !readError
    const lookupProducts = useMemo(() => (lookup?.products ?? []).map((p) => ({ id: p.id, label: p.name, sub: `${p.code} · ${p.unit}` })), [lookup?.products])
    const lookupSuppliers = useMemo(() => (lookup?.suppliers ?? []).map((s) => ({ id: s.id, label: s.name, sub: s.code })), [lookup?.suppliers])
    const productById = useMemo(() => new Map((lookup?.products ?? []).map((p) => [p.id, p])), [lookup?.products])

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent
                showCloseButton={false}
                className="w-[96vw] max-w-[1280px] sm:max-w-[1280px] h-[92vh] p-0 gap-0 rounded-none border-2 border-black shadow-[8px_8px_0_0_rgba(0,0,0,1)] overflow-hidden flex flex-col"
            >
                {/* Header */}
                <div className="bg-black text-white px-5 py-3 flex items-center gap-3 shrink-0">
                    <FileText className="h-4 w-4 text-orange-400" />
                    <div className="min-w-0 flex-1">
                        <DialogTitle className="text-sm font-black uppercase tracking-wider text-white">
                            {file ? "Cek hasil baca invoice" : "Catat pembelian manual"}
                        </DialogTitle>
                        <p className="text-zinc-400 text-[11px] font-bold mt-0.5 truncate">
                            {file ? file.name : "Tanpa file — isi seperti di invoice"}
                            {read && parsed && (
                                <span className="ml-2 text-zinc-500">
                                    · dibaca dalam <span className="text-emerald-400 font-mono">{ms(read.timing.total)}</span>
                                    {" · "}
                                    {parsed.method === "OCR" ? "scan (OCR)" : "teks PDF"}
                                    {" · keyakinan "}
                                    <span className={cn("font-mono", parsed.confidence >= 0.9 ? "text-emerald-400" : parsed.confidence >= 0.7 ? "text-amber-400" : "text-red-400")}>
                                        {Math.round(parsed.confidence * 100)}%
                                    </span>
                                </span>
                            )}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-zinc-400 hover:text-white transition-colors" aria-label="Tutup">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className={cn("flex-1 min-h-0 grid", file ? "grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]" : "grid-cols-1")}>
                    {/* Left: the real invoice */}
                    {file && (
                        <div className="hidden lg:block min-h-0 overflow-y-auto bg-zinc-100 dark:bg-zinc-900 border-r-2 border-black p-4">
                            {read ? (
                                <InvoicePreview file={file} bytes={read.bytes} marks={marks} />
                            ) : (
                                <div className="aspect-[1/1.414] w-full animate-pulse bg-zinc-200 dark:bg-zinc-800" />
                            )}
                            {read?.scanned && (
                                <p className="mt-3 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2">
                                    File ini hasil scan/foto. Teks dibaca lewat OCR di perangkat ini — cek angka dengan teliti.
                                </p>
                            )}
                        </div>
                    )}

                    {/* Right: fields */}
                    <div className="min-h-0 overflow-y-auto">
                        {reading && <ReadingState />}
                        {readError && (
                            <div className="m-5 border-2 border-red-300 bg-red-50 p-4 text-sm text-red-700">
                                {readError}. Coba file lain, atau isi manual.
                            </div>
                        )}
                        {draft && calc && (
                            <div className="p-5 space-y-4 animate-in fade-in-0 slide-in-from-bottom-1 duration-200">
                                {duplicate && (
                                    <div className="flex items-start gap-3 border-2 border-amber-400 bg-amber-50 px-3 py-2.5">
                                        <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                                        <div className="text-sm text-amber-900 flex-1">
                                            {duplicate.sameFile ? "File yang sama sudah pernah diupload" : `Invoice ${duplicate.supplierInvoiceNo} sudah tercatat`}
                                            {" "}di <b>{duplicate.poNumber}</b> ({duplicate.supplierName}).
                                        </div>
                                        <button onClick={() => onOpenExisting(duplicate.id)} className="text-xs font-black uppercase tracking-wider text-amber-800 underline underline-offset-2">
                                            Buka
                                        </button>
                                    </div>
                                )}

                                {/* Supplier + invoice */}
                                <section className={NB.section}>
                                    <div className={NB.sectionHead}>
                                        <span className={NB.sectionTitle}>Supplier & invoice</span>
                                        {draft.supplierVia && (
                                            <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                                                <CircleCheck className="h-3.5 w-3.5" /> Supplier dikenali ({VIA_LABEL[draft.supplierVia] ?? draft.supplierVia})
                                            </span>
                                        )}
                                    </div>
                                    <div className="p-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                                        <div className="col-span-2">
                                            <label className={NB.label}>Supplier</label>
                                            <div className="flex items-center gap-2">
                                                <Field
                                                    value={draft.supplierName}
                                                    onChange={(v) => setDraft((d) => (d ? { ...d, supplierName: v, supplierId: null, supplierVia: null } : d))}
                                                    onFocus={() => setFocus(parsed?.fields.supplierName?.source ?? null)}
                                                    low={!draft.supplierId && (parsed?.fields.supplierName?.confidence ?? 1) < 0.75}
                                                    placeholder="Nama supplier"
                                                />
                                                <SearchPicker
                                                    value={draft.supplierId}
                                                    options={lookupSuppliers}
                                                    placeholder="Cari supplier…"
                                                    emptyLabel="Tidak ada. Biarkan nama di kiri → supplier baru."
                                                    onPick={(id) => {
                                                        const s = lookup?.suppliers.find((x) => x.id === id)
                                                        setDraft((d) => (d ? { ...d, supplierId: id, supplierName: s?.name ?? d.supplierName, supplierVia: "manual" } : d))
                                                    }}
                                                    trigger={<span className="text-[11px] font-bold text-zinc-500 whitespace-nowrap">Pilih</span>}
                                                />
                                            </div>
                                            {!draft.supplierId && draft.supplierName && (
                                                <p className="mt-1 text-[11px] font-bold text-orange-600">+ Supplier baru akan dibuat</p>
                                            )}
                                        </div>
                                        <div className="col-span-2">
                                            <label className={NB.label}>No. invoice supplier</label>
                                            <Field value={draft.invoiceNo} onChange={(v) => set("invoiceNo", v)} onFocus={() => setFocus(parsed?.fields.invoiceNo?.source ?? null)} mono low={(parsed?.fields.invoiceNo?.confidence ?? 1) < 0.75} placeholder="mis. INV/001" />
                                        </div>
                                        <div>
                                            <label className={NB.label}>Tanggal</label>
                                            <Field type="date" value={draft.invoiceDate} onChange={(v) => set("invoiceDate", v)} onFocus={() => setFocus(parsed?.fields.invoiceDate?.source ?? null)} />
                                        </div>
                                        <div>
                                            <label className={NB.label}>Jatuh tempo</label>
                                            <Field type="date" value={draft.dueDate} onChange={(v) => set("dueDate", v)} onFocus={() => setFocus(parsed?.fields.dueDate?.source ?? null)} placeholder="+30 hari" />
                                        </div>
                                        <div>
                                            <label className={NB.label}>Mata uang</label>
                                            <div className="flex h-8 border border-zinc-300">
                                                {(["IDR", "CNY", "USD"] as CurrencyCode[]).map((c) => (
                                                    <button
                                                        key={c}
                                                        type="button"
                                                        onClick={() => {
                                                            const tpl = draft.supplierId ? lookup?.templates.find((t) => t.supplierId === draft.supplierId) : null
                                                            const r = c === "IDR" ? "1" : String(tpl?.lastRate ?? lookup?.latestRate?.[c]?.rate ?? "")
                                                            setDraft((d) => (d ? { ...d, currency: c, rate: r } : d))
                                                        }}
                                                        className={cn("flex-1 text-[11px] font-black transition-colors", draft.currency === c ? "bg-black text-white" : "text-zinc-500 hover:bg-zinc-50")}
                                                    >
                                                        {c === "CNY" ? "RMB" : c}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <label className={NB.label}>Kurs → IDR</label>
                                            <Field
                                                value={draft.currency === "IDR" ? "1" : draft.rate}
                                                onChange={(v) => set("rate", v)}
                                                disabled={draft.currency === "IDR"}
                                                mono
                                                low={draft.currency !== "IDR" && !draft.rate}
                                                placeholder="mis. 2490"
                                            />
                                        </div>
                                        {draft.paymentTerms && (
                                            <div className="col-span-2 md:col-span-4 text-[11px] text-zinc-500">
                                                <span className="font-bold uppercase tracking-wider">Termin:</span> {draft.paymentTerms}
                                            </div>
                                        )}
                                    </div>
                                </section>

                                {/* Lines */}
                                <section className={NB.section}>
                                    <div className={NB.sectionHead}>
                                        <span className={NB.sectionTitle}>Barang</span>
                                        <span className={NB.sectionHint}>{draft.lines.length} baris</span>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm table-fixed">
                                            <thead>
                                                <tr className="bg-zinc-50 border-b border-zinc-200 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                                    <th className="px-2 py-1.5 text-left w-[100px]">Kode part</th>
                                                    <th className="px-2 py-1.5 text-left">Nama barang</th>
                                                    <th className="px-2 py-1.5 text-right w-[56px]">Qty</th>
                                                    <th className="px-2 py-1.5 text-right w-[92px]">Harga</th>
                                                    <th className="px-2 py-1.5 text-right w-[48px]">Disc%</th>
                                                    <th className="px-2 py-1.5 text-right w-[104px]">Jumlah</th>
                                                    <th className="w-[28px]" />
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {draft.lines.map((l, i) => {
                                                    const c = calc.lines[i]
                                                    const product = l.productId ? productById.get(l.productId) : null
                                                    const low = l.confidence < 0.75 || l.issues.length > 0
                                                    return (
                                                        <tr
                                                            key={l.key}
                                                            className={cn("border-b border-zinc-100 align-top group", low && "bg-amber-50/60")}
                                                            onMouseEnter={() => setFocus(l.source ?? null)}
                                                            onMouseLeave={() => setFocus(null)}
                                                        >
                                                            <td className="px-2 py-1.5">
                                                                <Cell value={l.partNo} onChange={(v) => setLine(l.key, { partNo: v, ...(l.matchVia !== "manual" ? { productId: null, matchVia: null } : {}) })} mono />
                                                            </td>
                                                            <td className="px-2 py-1.5">
                                                                <Cell value={l.description} onChange={(v) => setLine(l.key, { description: v })} />
                                                                <div className="mt-0.5 flex items-center gap-2 min-w-0">
                                                                    <SearchPicker
                                                                        value={l.productId}
                                                                        options={lookupProducts}
                                                                        placeholder="Cari produk / kode…"
                                                                        emptyLabel="Tidak ketemu"
                                                                        onPick={(id) => setLine(l.key, { productId: id, matchVia: "manual" })}
                                                                        onCreate={() => setLine(l.key, { productId: null, matchVia: null })}
                                                                        createLabel="Jadikan produk baru"
                                                                        trigger={
                                                                            product ? (
                                                                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 whitespace-nowrap max-w-[260px] truncate">
                                                                                    <Check className="h-3 w-3 shrink-0" /> <span className="truncate">{product.code} · {product.name}</span>
                                                                                </span>
                                                                            ) : (
                                                                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-600 whitespace-nowrap">
                                                                                    <Plus className="h-3 w-3 shrink-0" /> Produk baru
                                                                                </span>
                                                                            )
                                                                        }
                                                                    />
                                                                    {l.issues.map((iss) => (
                                                                        <span key={iss} className="text-[11px] font-bold text-amber-700">{iss}</span>
                                                                    ))}
                                                                </div>
                                                            </td>
                                                            <td className="px-2 py-1.5"><Cell value={l.qty} onChange={(v) => setLine(l.key, { qty: v })} right mono /></td>
                                                            <td className="px-2 py-1.5"><Cell value={l.unitPrice} onChange={(v) => setLine(l.key, { unitPrice: v })} right mono /></td>
                                                            <td className="px-2 py-1.5"><Cell value={l.discountPct} onChange={(v) => setLine(l.key, { discountPct: v })} right mono placeholder="0" /></td>
                                                            <td className="px-2 py-2 text-right font-mono font-bold tabular-nums whitespace-nowrap">
                                                                {c.amount == null ? "—" : money(c.amount, draft.currency)}
                                                            </td>
                                                            <td className="py-1.5">
                                                                <button
                                                                    onClick={() => setDraft((d) => (d && d.lines.length > 1 ? { ...d, lines: d.lines.filter((x) => x.key !== l.key) } : d))}
                                                                    className="p-1 text-zinc-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                    aria-label="Hapus baris"
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                    <button
                                        onClick={() => setDraft((d) => (d ? { ...d, lines: [...d.lines, emptyLine()] } : d))}
                                        className="w-full px-3 py-2 text-left text-[11px] font-black uppercase tracking-wider text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800 transition-colors"
                                    >
                                        + Tambah baris
                                    </button>
                                </section>

                                {/* Totals */}
                                <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className={cn(NB.section, "p-3 space-y-2.5")}>
                                        <p className={NB.sectionTitle}>Yang sudah terjadi?</p>
                                        <Toggle checked={draft.paidNow} onChange={(v) => set("paidNow", v)} label="Sudah dibayar" />
                                        {draft.paidNow && (
                                            <div className="pl-12">
                                                <Field value={draft.paidAmount} onChange={(v) => set("paidAmount", v)} mono placeholder={`Lunas: ${money(calc.total, draft.currency)}`} />
                                                <p className="mt-1 text-[11px] text-zinc-500">Kosongkan = lunas. Isi sebagian untuk DP.</p>
                                            </div>
                                        )}
                                        <Toggle checked={draft.receivedAll} onChange={(v) => set("receivedAll", v)} label="Barang sudah datang semua" />
                                        {draft.receivedAll && (lookup?.warehouses.length ?? 0) > 1 && (
                                            <div className="pl-12">
                                                <select value={draft.warehouseId} onChange={(e) => set("warehouseId", e.target.value)} className={cn(NB.select, "w-full px-2 bg-white", NB.inputActive)}>
                                                    {lookup!.warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                    <div className={cn(NB.section, "p-3 space-y-1.5 text-sm")}>
                                        <Row label="Subtotal" value={money(calc.subtotal, draft.currency)} check={parsed?.checks.linesVsSubtotal === 0} />
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-zinc-500 font-medium">PPN</span>
                                            <div className="w-36"><Cell value={draft.tax} onChange={(v) => set("tax", v)} right mono placeholder="0" /></div>
                                        </div>
                                        <div className="border-t border-zinc-200 pt-1.5 flex items-center justify-between">
                                            <span className="font-black uppercase tracking-wider text-xs">Total</span>
                                            <span className="font-mono font-black text-lg tabular-nums">{money(calc.total, draft.currency)}</span>
                                        </div>
                                        {draft.currency !== "IDR" && calc.totalIdr != null && (
                                            <div className="text-right text-xs font-mono text-zinc-500">≈ {money(calc.totalIdr, "IDR")} @ {calc.rate}</div>
                                        )}
                                        {calc.diff != null && (
                                            <div className={cn("flex items-center gap-1.5 text-[11px] font-bold", Math.abs(calc.diff) < 1 ? "text-emerald-700" : "text-amber-700")}>
                                                {Math.abs(calc.diff) < 1 ? <CircleCheck className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                                                {Math.abs(calc.diff) < 1
                                                    ? "Sama persis dengan total di invoice"
                                                    : `Beda ${money(Math.abs(calc.diff), draft.currency)} dari total di invoice (${money(calc.printedTotal!, draft.currency)})`}
                                            </div>
                                        )}
                                    </div>
                                </section>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer: one action */}
                <div className="shrink-0 border-t-2 border-black bg-zinc-50 dark:bg-zinc-900 px-5 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0 text-[11px] font-bold">
                        {saveError && <span className="text-red-600">{saveError}</span>}
                        {!saveError && problems.length > 0 && draft && (
                            <span className="text-amber-700 truncate block">Lengkapi: {problems.slice(0, 3).join(" · ")}{problems.length > 3 ? ` · +${problems.length - 3}` : ""}</span>
                        )}
                        {!saveError && problems.length === 0 && (
                            <span className="text-emerald-700 inline-flex items-center gap-1"><CircleCheck className="h-3.5 w-3.5" /> Siap disimpan{lookup?.canPost ? " · tagihan langsung diposting" : " · tagihan menunggu finance"}</span>
                        )}
                    </div>
                    <button onClick={onClose} className={NB.cancelBtn}>Batal</button>
                    <button onClick={handleSave} disabled={problems.length > 0} className={cn(NB.submitBtnOrange, "disabled:opacity-40 disabled:pointer-events-none")}>
                        Simpan pembelian
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    )
}

const VIA_LABEL: Record<string, string> = { npwp: "NPWP", email: "email", template: "pernah upload", name: "nama", manual: "dipilih" }

// ── Small parts ──────────────────────────────────────────────────────────────

function ReadingState() {
    return (
        <div className="p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-zinc-600">
                <Loader2 className="h-4 w-4 animate-spin text-orange-500" /> Membaca invoice di perangkat ini…
                <span className="font-medium text-zinc-400">(PDF teks: sekejap · scan/foto: beberapa detik)</span>
            </div>
            {[0, 1, 2].map((i) => (
                <div key={i} className="space-y-2">
                    <div className="h-3 w-32 bg-zinc-100 animate-pulse" />
                    <div className="h-8 w-full bg-zinc-100 animate-pulse" />
                </div>
            ))}
        </div>
    )
}

function Field({ value, onChange, onFocus, low, mono, type = "text", placeholder, disabled }: {
    value: string
    onChange: (v: string) => void
    onFocus?: () => void
    low?: boolean
    mono?: boolean
    type?: string
    placeholder?: string
    disabled?: boolean
}) {
    return (
        <input
            type={type}
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            onFocus={onFocus}
            placeholder={placeholder}
            className={cn(
                mono ? NB.inputMono : NB.input,
                "w-full px-2 outline-none focus:border-black disabled:opacity-60",
                low ? "border-amber-400 bg-amber-50" : value ? NB.inputActive : NB.inputEmpty,
            )}
        />
    )
}

function Cell({ value, onChange, right, mono, placeholder }: { value: string; onChange: (v: string) => void; right?: boolean; mono?: boolean; placeholder?: string }) {
    return (
        <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={cn(
                "w-full h-7 px-1.5 text-sm border border-transparent hover:border-zinc-200 focus:border-black focus:bg-white bg-transparent outline-none transition-colors",
                right && "text-right",
                mono && "font-mono tabular-nums",
            )}
        />
    )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
    return (
        <label className="flex items-center gap-3 cursor-pointer select-none">
            <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={cn(NB.toggle, checked ? NB.toggleActive : NB.toggleInactive)}>
                <span className={NB.toggleThumb} style={{ transform: `translateX(${checked ? 20 : 2}px)` }} />
            </button>
            <span className="text-sm font-bold">{label}</span>
        </label>
    )
}

function Row({ label, value, check }: { label: string; value: string; check?: boolean }) {
    return (
        <div className="flex items-center justify-between gap-3">
            <span className="text-zinc-500 font-medium inline-flex items-center gap-1">{label}{check && <Sparkles className="h-3 w-3 text-emerald-500" />}</span>
            <span className="font-mono font-bold tabular-nums">{value}</span>
        </div>
    )
}

function toastSuccess(m: string) {
    toast.success(m)
}
function toastWarn(m: string, action?: { label: string; onClick: () => void }) {
    toast.warning(m, action ? { action } : undefined)
}
function toastError(m: string) {
    toast.error(m)
}

