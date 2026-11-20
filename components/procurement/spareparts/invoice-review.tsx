"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { AlertTriangle, Check, CircleCheck, FileText, Loader2, Plus, Sparkles, Trash2, X } from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { NB } from "@/lib/dialog-styles"
import { cn } from "@/lib/utils"
import { readInvoiceFile, type ReadResult } from "@/lib/invoice-parse/client"
import { fingerprintOf, learnTemplate, matchLines, matchSupplier, normalisePartCode, type LookupTemplate } from "@/lib/invoice-parse/match"
import type { Box, ParsedInvoice, SupplierTemplate } from "@/lib/invoice-parse/types"
import { derivePurchaseStatus, netUnitPrice, parseRate, parseTypedAmount, rateProblem, type CurrencyCode } from "@/lib/sparepart-purchase-logic"
import { checkSupplierInvoiceDuplicate, findPurchaseByReference, type PurchaseReference, type SaveSupplierInvoiceInput } from "@/lib/actions/sparepart-purchasing"
import { useReceiveByDeliveryNote, useSaveSupplierInvoice, type PendingRow, type SparepartLookup } from "@/hooks/use-sparepart-purchases"
import { detectDocument, planImport, type DocInfo, type ImportPlan } from "@/lib/invoice-parse/doc-type"
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
    /** The name as printed on the invoice (shown when a different known supplier was matched). */
    printedName: string
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
    bankAccountCode: string
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
        printedName: String(f.supplierName?.value ?? ""),
        invoiceNo: String(f.invoiceNo?.value ?? ""),
        invoiceDate: String(f.invoiceDate?.value ?? todayIso()),
        dueDate: String(f.dueDate?.value ?? ""),
        paymentTerms: String(f.paymentTerms?.value ?? ""),
        currency,
        rate: rate ? String(rate) : "",
        tax: currency === "IDR" ? toStr(Number(f.tax?.value ?? 0)) : "0",
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
        bankAccountCode: lookup?.bankAccounts?.[0]?.code ?? "",
    }
}

/** Typed numbers are read the way the screen shows them (Indonesian grouping), for every currency. */
function numOf(s: string, _currency?: CurrencyCode): number | null {
    return parseTypedAmount(s)
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
    const [saving, setSaving] = useState(false)
    // One import: what the document is, what saving it will do, and the purchase it refers to.
    const [doc, setDoc] = useState<DocInfo | null>(null)
    const [plan, setPlan] = useState<ImportPlan | null>(null)
    const [ref, setRef] = useState<{ state: "idle" | "loading" | "found" | "missing"; hit: PurchaseReference | null }>({ state: "idle", hit: null })
    const receiveSj = useReceiveByDeliveryNote()
    const savingRef = useRef(false) // state updates are async; the ref stops a same-tick double click
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
        setSaving(false)
        savingRef.current = false
        setDoc(null)
        setPlan(null)
        setRef({ state: "idle", hit: null })
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
        let d = draftFromParsed(best, lookup)
        const info = detectDocument(read.text?.items ?? [], { issuerName: (best.fields.supplierName?.value as string) ?? null, ours: lookup?.ourCompanies ?? [] })
        const p = planImport(info)
        setDoc(info)
        setPlan(p)
        if (!d.invoiceNo && info.documentNo) d = { ...d, invoiceNo: info.documentNo }
        if (p.action === "CREATE_PO" && info.counterparty) {
            // Our own PO/CO: the vendor is the "KEPADA", not the company printed at the top (us).
            const asVendor = { fields: { supplierName: { value: info.counterparty, confidence: 0.95 } } }
            const sm = lookup ? matchSupplier(asVendor, lookup.suppliers, templates) : null
            const lm = lookup ? matchLines(best.lines, sm?.supplierId ?? null, lookup.products, lookup.skus) : []
            d = {
                ...d,
                invoiceNo: info.documentNo ?? d.invoiceNo,
                supplierId: sm?.supplierId ?? null,
                supplierName: sm ? lookup!.suppliers.find((x) => x.id === sm.supplierId)?.name ?? info.counterparty : info.counterparty,
                printedName: info.counterparty,
                supplierVia: sm?.via ?? null,
                supplierNpwp: "",
                supplierEmail: "",
                lines: d.lines.map((l, i) => ({ ...l, productId: lm[i]?.productId ?? l.productId, matchVia: lm[i]?.via ?? l.matchVia })),
            }
        }
        setDraft(d)
        if (p.action !== "SALES_NOT_ENABLED") {
            void checkSupplierInvoiceDuplicate({ sha256: read.sha256, supplierId: d.supplierId, invoiceNo: d.invoiceNo }).then(setDuplicate).catch(() => undefined)
        }
        const refNo = p.action === "CREATE_PO" ? null : info.poRef
        if (refNo && (p.action === "SUPPLIER_INVOICE" || p.action === "RECEIVE_DELIVERY")) {
            setRef({ state: "loading", hit: null })
            findPurchaseByReference({ ref: refNo })
                .then((hit) => {
                    setRef({ state: hit ? "found" : "missing", hit })
                    if (!hit) return
                    // Tie each line to the PO's part by our code or the supplier's code.
                    const byCode = new Map<string, string>()
                    for (const it of hit.items) {
                        byCode.set(normalisePartCode(it.code), it.productId)
                        if (it.sku) byCode.set(normalisePartCode(it.sku), it.productId)
                    }
                    setDraft((cur) => cur && {
                        ...cur,
                        supplierId: hit.supplier.id,
                        supplierName: hit.supplier.name,
                        supplierVia: "manual",
                        lines: cur.lines.map((l) => {
                            const pid = byCode.get(normalisePartCode(l.partNo))
                            return pid ? { ...l, productId: pid, matchVia: "code" } : l
                        }),
                    })
                })
                .catch(() => setRef({ state: "missing", hit: null }))
        }
    }, [read, parsed, lookup, draft])

    /** The purchase this document will be attached to (vendor invoice) or received against (surat jalan). */
    const refPo = ref.state === "found" && ref.hit ? ref.hit : null
    const poProductIds = useMemo(() => new Set((refPo?.items ?? []).map((i) => i.productId)), [refPo])
    const attachMode = plan?.action === "SUPPLIER_INVOICE" && !!refPo && !refPo.hasBill
    const unmatchedInPo = draft && refPo ? draft.lines.filter((l) => !l.productId || !poProductIds.has(l.productId)).length : 0

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
        const printedTotal = parsed?.fields.total?.source ? Number(parsed.fields.total.value) : null
        const diff = printedTotal != null && read ? Math.round((total - printedTotal) * 100) / 100 : null
        const rate = parseRate(draft.rate, cur)
        const paidTyped = draft.paidAmount.trim() ? numOf(draft.paidAmount) : null
        return { lines, subtotal, tax, total, printedTotal, diff, rate, paidTyped, totalIdr: rate ? total * rate : null }
    }, [draft, parsed, read])

    const problems = useMemo(() => {
        if (!draft || !calc) return ["Membaca invoice…"]
        const p: string[] = []
        if (!draft.supplierId && !draft.supplierName.trim()) p.push("Isi supplier")
        if (!draft.invoiceNo.trim()) p.push("Isi nomor invoice")
        if (!draft.invoiceDate) p.push("Isi tanggal invoice")
        if (draft.currency !== "IDR" && !calc.rate) {
            p.push(draft.rate.trim() ? (rateProblem(numOf(draft.rate) ?? 0, draft.currency) ?? "Kurs tidak wajar") : `Isi kurs ${draft.currency === "CNY" ? "RMB" : draft.currency}`)
        }
        if (draft.currency !== "IDR" && calc.tax > 0) p.push("Invoice impor tanpa PPN Masukan — kosongkan PPN")
        if (draft.paidNow && draft.paidAmount.trim()) {
            if (calc.paidTyped == null) p.push("Jumlah bayar tidak terbaca")
            else if (calc.paidTyped > calc.total + 0.005) p.push("Jumlah bayar melebihi total")
        }
        draft.lines.forEach((l, i) => {
            const c = calc.lines[i]
            if (!l.description.trim()) p.push(`Baris ${i + 1}: nama barang`)
            else if (!(c.qty && c.qty > 0) || !Number.isInteger(c.qty)) p.push(`Baris ${i + 1}: qty bulat`)
            else if (c.price == null) p.push(`Baris ${i + 1}: harga`)
            else if (!l.productId && !l.partNo.trim()) p.push(`Baris ${i + 1}: pilih produk atau isi kode part`)
        })
        if (duplicate && (duplicate.sameFile || duplicate.supplierInvoiceNo === draft.invoiceNo.trim())) p.push("Invoice ini sudah tercatat — buka yang lama")
        if (plan?.action === "SALES_NOT_ENABLED") return ["Dokumen penjualan — modul penjualan belum aktif"]
        if (plan?.action === "RECEIVE_DELIVERY") {
            if (ref.state === "loading") return ["Mencari PO yang dirujuk…"]
            if (!refPo) return [`PO ${doc?.poRef ?? ""} belum tercatat — upload PO/CO-nya dulu`]
            return draft.lines.some((l) => l.productId && poProductIds.has(l.productId)) ? [] : ["Tidak ada barang surat jalan yang cocok dengan PO"]
        }
        if (attachMode && unmatchedInPo > 0) p.push(`${unmatchedInPo} barang tidak ada di ${refPo!.poDocumentNo ?? refPo!.poNumber}`)
        return p
    }, [draft, calc, duplicate, plan, ref.state, refPo, poProductIds, attachMode, unmatchedInPo, doc?.poRef])

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
        if (!draft || !calc || problems.length || saving || savingRef.current) return
        savingRef.current = true
        setSaving(true) // one click = one purchase, even while a large upload finishes
        setSaveError(null)
        if (plan?.action === "RECEIVE_DELIVERY" && refPo) {
            onClose()
            receiveSj.mutate({
                captureId: refPo.captureId,
                deliveryNo: doc?.documentNo ?? null,
                warehouseId: draft.warehouseId || null,
                lines: draft.lines.flatMap((l, i) => (l.productId ? [{ productId: l.productId, qty: calc.lines[i].qty ?? 0 }] : [])),
            }, { onSuccess: () => onSaved(refPo.captureId) })
            return
        }
        const upload = uploadRef.current ? await uploadRef.current : null
        const templates = (lookup?.templates ?? []) as unknown as LookupTemplate[]
        const prevTpl = draft.supplierId ? templates.find((t) => t.supplierId === draft.supplierId)?.template : null
        const isPo = plan?.action === "CREATE_PO"
        const input: SaveSupplierInvoiceInput = {
            kind: isPo ? "PURCHASE_ORDER" : "INVOICE",
            poDocumentNo: isPo ? draft.invoiceNo.trim() : null,
            modelUnit: doc?.modelUnit ?? null,
            attachToCaptureId: attachMode ? refPo!.captureId : null,
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
            file: upload ? { name: upload.name, type: upload.type, size: upload.size, sha256: upload.sha256 } : null,
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
            already: isPo ? null : {
                paidOriginal: draft.paidNow ? (calc.paidTyped ?? calc.total) : null,
                bankAccountCode: draft.paidNow ? draft.bankAccountCode || null : null,
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
            poDocumentNo: isPo ? input.invoiceNo : null,
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
            poStatus: isPo ? "ORDERED" : "VENDOR_CONFIRMED",
            supplierId: draft.supplierId ?? "",
            supplierName: draft.supplierName,
            billId: null,
            billNumber: null,
            billStatus: isPo ? null : "DRAFT",
            billTotal: isPo ? 0 : billTotal,
            balanceDue: isPo ? 0 : billTotal,
            ordered: input.lines.reduce((s, l) => s + l.qty, 0),
            received: 0,
            lineCount: input.lines.length,
            ...derivePurchaseStatus({ poStatus: isPo ? "ORDERED" : "VENDOR_CONFIRMED", billStatus: isPo ? null : "DRAFT", billTotal, balanceDue: billTotal, dueDate: input.dueDate ?? null, ordered: 1, received: 0, shippedAt: null, currencyCode: draft.currency }),
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
                className="w-[96vw] max-w-[1280px] sm:max-w-[1280px] h-[92vh] p-0 gap-0 rounded-md border border-border shadow-sm overflow-hidden flex flex-col"
            >
                {/* Header */}
                <div className="bg-slate-900 text-white px-5 py-3 flex items-center gap-3 shrink-0">
                    <FileText className="h-4 w-4 text-blue-400" />
                    <div className="min-w-0 flex-1">
                        <DialogTitle className="text-sm font-semibold text-white">
                            {!file ? "Catat pembelian manual" : plan ? plan.label : "Cek hasil baca dokumen"}
                        </DialogTitle>
                        <p className="text-zinc-400 text-xs font-bold mt-0.5 truncate">
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
                        <div className="hidden lg:block min-h-0 overflow-y-auto bg-zinc-100 dark:bg-zinc-900 border-r border-border p-4">
                            {read ? (
                                <InvoicePreview file={file} bytes={read.bytes} marks={marks} text={read.text} />
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
                            <div className="m-5 border border-red-300 bg-red-50 p-4 text-sm text-red-700">
                                {readError}. Coba file lain, atau isi manual.
                            </div>
                        )}
                        {draft && calc && (
                            <div className="p-5 space-y-4 animate-in fade-in-0 slide-in-from-bottom-1 duration-200">
                                {doc?.kind && plan && (
                                    <PlanBanner doc={doc} plan={plan} refState={ref.state} refPo={refPo} attachMode={attachMode} unmatched={unmatchedInPo} lines={draft.lines.length} total={money(calc.total, draft.currency)} />
                                )}
                                {read?.text?.totalPages != null && read.text.totalPages > read.text.pages && (
                                    <div className="flex items-start gap-3 border border-amber-400 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                                        <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                                        Invoice ini {read.text.totalPages} halaman; yang dibaca {read.text.pages} halaman pertama. Cek baris di halaman berikutnya.
                                    </div>
                                )}
                                {duplicate && (
                                    <div className="flex items-start gap-3 border border-amber-400 bg-amber-50 px-3 py-2.5">
                                        <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                                        <div className="text-sm text-amber-900 flex-1">
                                            {duplicate.sameFile ? "File yang sama sudah pernah diupload" : `Invoice ${duplicate.supplierInvoiceNo} sudah tercatat`}
                                            {" "}di <b>{duplicate.poNumber}</b> ({duplicate.supplierName}).
                                        </div>
                                        <button onClick={() => onOpenExisting(duplicate.id)} className="text-xs font-semibold text-amber-800 underline underline-offset-2">
                                            Buka
                                        </button>
                                    </div>
                                )}

                                {/* Supplier + invoice */}
                                <section className={NB.section}>
                                    <div className={NB.sectionHead}>
                                        <span className={NB.sectionTitle}>Supplier & invoice</span>
                                        {draft.supplierVia && (
                                            <span className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                                                <CircleCheck className="h-3.5 w-3.5" /> Supplier dikenali ({VIA_LABEL[draft.supplierVia] ?? draft.supplierVia})
                                            </span>
                                        )}
                                    </div>
                                    <div className="p-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                                        <div className="col-span-2">
                                            <label className={NB.label}>{plan?.action === "CREATE_PO" ? "Vendor (kepada)" : "Supplier"}</label>
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
                                                    trigger={<span className="text-xs font-bold text-zinc-500 whitespace-nowrap">Pilih</span>}
                                                />
                                            </div>
                                            {draft.supplierId && draft.printedName && draft.printedName.trim().toLowerCase() !== draft.supplierName.trim().toLowerCase() && (
                                                <p className="mt-1 text-xs text-zinc-500">Tertulis di invoice: <b>{draft.printedName}</b> — ganti lewat Pilih kalau salah</p>
                                            )}
                                            {!draft.supplierId && draft.supplierName && (
                                                <p className="mt-1 text-xs font-bold text-blue-600">+ Supplier baru akan dibuat</p>
                                            )}
                                        </div>
                                        <div className="col-span-2">
                                            <label className={NB.label}>{plan?.action === "CREATE_PO" ? `No. ${doc?.poType === "CO" ? "CO" : "PO"}` : plan?.action === "RECEIVE_DELIVERY" ? "No. surat jalan" : "No. invoice supplier"}</label>
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
                                                            const tpl = draft.supplierId ? lookup?.templates?.find((t) => t.supplierId === draft.supplierId) : null
                                                            const r = c === "IDR" ? "1" : String(tpl?.lastRate ?? lookup?.latestRate?.[c]?.rate ?? "")
                                                            setDraft((d) => (d ? { ...d, currency: c, rate: r, tax: c === "IDR" ? d.tax : "0" } : d))
                                                        }}
                                                        className={cn("flex-1 text-xs font-semibold transition-colors", draft.currency === c ? "bg-slate-900 text-white" : "text-zinc-500 hover:bg-zinc-50")}
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
                                                placeholder="mis. 2.490"
                                            />
                                            {draft.currency !== "IDR" && calc.rate && (
                                                <p className="mt-0.5 text-xs font-mono text-zinc-500">1 {draft.currency === "CNY" ? "RMB" : draft.currency} = {money(calc.rate, "IDR")}</p>
                                            )}
                                        </div>
                                        {draft.paymentTerms && (
                                            <div className="col-span-2 md:col-span-4 text-xs text-zinc-500">
                                                <span className="font-bold  ">Termin:</span> {draft.paymentTerms}
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
                                                <tr className="bg-zinc-50 border-b border-zinc-200 text-xs font-semibold text-zinc-500">
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
                                                                                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 whitespace-nowrap max-w-[260px] truncate">
                                                                                    <Check className="h-3 w-3 shrink-0" /> <span className="truncate">{product.code} · {product.name}</span>
                                                                                </span>
                                                                            ) : (
                                                                                <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 whitespace-nowrap">
                                                                                    <Plus className="h-3 w-3 shrink-0" /> Produk baru
                                                                                </span>
                                                                            )
                                                                        }
                                                                    />
                                                                    {l.issues.map((iss) => (
                                                                        <span key={iss} className="text-xs font-bold text-amber-700">{iss}</span>
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
                                        className="w-full px-3 py-2 text-left text-xs font-semibold text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800 transition-colors"
                                    >
                                        + Tambah baris
                                    </button>
                                </section>

                                {/* Totals */}
                                <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className={cn(NB.section, "p-3 space-y-2.5", (plan?.action === "CREATE_PO" || plan?.action === "RECEIVE_DELIVERY" || plan?.action === "SALES_NOT_ENABLED") && "hidden")}>
                                        <p className={NB.sectionTitle}>Yang sudah terjadi?</p>
                                        <Toggle checked={draft.paidNow} onChange={(v) => set("paidNow", v)} label="Sudah dibayar" />
                                        {draft.paidNow && (
                                            <div className="pl-12">
                                                <Field value={draft.paidAmount} onChange={(v) => set("paidAmount", v)} mono placeholder={`Lunas: ${money(calc.total, draft.currency)}`} />
                                                <p className="mt-1 text-xs text-zinc-500">
                                                    {calc.paidTyped != null
                                                        ? <>Tercatat <b className="font-mono">{money(calc.paidTyped, draft.currency)}</b>{draft.currency !== "IDR" && calc.rate ? <> = {money(calc.paidTyped * calc.rate, "IDR")}</> : null}</>
                                                        : "Kosongkan = lunas. Isi sebagian untuk DP."}
                                                </p>
                                                {(lookup?.bankAccounts?.length ?? 0) > 0 && (
                                                    <select value={draft.bankAccountCode} onChange={(e) => set("bankAccountCode", e.target.value)} className={cn(NB.select, "mt-1.5 w-full px-2 bg-white", NB.inputActive)} aria-label="Dibayar dari">
                                                        {(lookup?.bankAccounts ?? []).map((a) => <option key={a.code} value={a.code}>Dari {a.name} ({a.code})</option>)}
                                                    </select>
                                                )}
                                            </div>
                                        )}
                                        <Toggle checked={draft.receivedAll} onChange={(v) => set("receivedAll", v)} label="Barang sudah datang semua" />
                                        {draft.receivedAll && (lookup?.warehouses?.length ?? 0) > 1 && (
                                            <div className="pl-12">
                                                <select value={draft.warehouseId} onChange={(e) => set("warehouseId", e.target.value)} className={cn(NB.select, "w-full px-2 bg-white", NB.inputActive)}>
                                                    {(lookup?.warehouses ?? []).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                    <div className={cn(NB.section, "p-3 space-y-1.5 text-sm")}>
                                        <Row label="Subtotal" value={money(calc.subtotal, draft.currency)} check={parsed?.checks.linesVsSubtotal === 0} />
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-zinc-500 font-medium">{draft.currency === "IDR" ? "PPN" : "PPN (impor: di bea cukai)"}</span>
                                            <div className="w-36">
                                                {draft.currency === "IDR"
                                                    ? <Cell value={draft.tax} onChange={(v) => set("tax", v)} right mono placeholder="0" />
                                                    : <span className="block text-right font-mono text-zinc-400 pr-1.5">—</span>}
                                            </div>
                                        </div>
                                        <div className="border-t border-zinc-200 pt-1.5 flex items-center justify-between">
                                            <span className="font-semibold text-xs">Total</span>
                                            <span className="font-mono font-semibold text-lg tabular-nums">{money(calc.total, draft.currency)}</span>
                                        </div>
                                        {draft.currency !== "IDR" && calc.totalIdr != null && (
                                            <div className="text-right text-xs font-mono text-zinc-500">≈ {money(calc.totalIdr, "IDR")} @ {calc.rate}</div>
                                        )}
                                        {read && calc.printedTotal == null && (
                                            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700">
                                                <AlertTriangle className="h-3.5 w-3.5" /> Total tidak terbaca di invoice — cocokkan manual
                                            </div>
                                        )}
                                        {calc.diff != null && (
                                            <div className={cn("flex items-center gap-1.5 text-xs font-bold", Math.abs(calc.diff) < 1 ? "text-emerald-700" : "text-amber-700")}>
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
                <div className="shrink-0 border-t border-border bg-zinc-50 dark:bg-zinc-900 px-5 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0 text-xs font-bold">
                        {saveError && <span className="text-red-600">{saveError}</span>}
                        {!saveError && problems.length > 0 && draft && (
                            <span className="text-amber-700 truncate block">Lengkapi: {problems.slice(0, 3).join(" · ")}{problems.length > 3 ? ` · +${problems.length - 3}` : ""}</span>
                        )}
                        {!saveError && problems.length === 0 && (
                            <span className="text-emerald-700 inline-flex items-center gap-1"><CircleCheck className="h-3.5 w-3.5" /> Siap disimpan{lookup?.canPost ? " · tagihan langsung diposting" : " · tagihan menunggu finance"}</span>
                        )}
                    </div>
                    <button onClick={onClose} className={NB.cancelBtn}>Batal</button>
                    <button onClick={handleSave} disabled={problems.length > 0 || saving} className={cn(NB.submitBtnOrange, "disabled:opacity-40 disabled:pointer-events-none")}>
                        {saving ? "Menyimpan…" : primaryLabel(plan, attachMode, refPo)}
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
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" /> Membaca invoice di perangkat ini…
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
                "w-full px-2 outline-none focus:border-border disabled:opacity-60",
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
                "w-full h-7 px-1.5 text-sm border border-transparent hover:border-zinc-200 focus:border-border focus:bg-white bg-transparent outline-none transition-colors",
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

function primaryLabel(plan: ImportPlan | null, attachMode: boolean, refPo: PurchaseReference | null): string {
    switch (plan?.action) {
        case "CREATE_PO":
            return "Simpan PO"
        case "RECEIVE_DELIVERY":
            return "Terima barang"
        case "SALES_NOT_ENABLED":
            return "Belum bisa disimpan"
        default:
            return attachMode && refPo ? `Tempel ke ${refPo.poDocumentNo ?? refPo.poNumber}` : "Simpan pembelian"
    }
}

/** One sentence that says exactly what Simpan will do — before it is pressed. */
function PlanBanner({ doc, plan, refState, refPo, attachMode, unmatched, lines, total }: {
    doc: DocInfo
    plan: ImportPlan
    refState: "idle" | "loading" | "found" | "missing"
    refPo: PurchaseReference | null
    attachMode: boolean
    unmatched: number
    lines: number
    total: string
}) {
    const kindLabel = doc.kind === "PURCHASE_ORDER" ? (doc.poType === "CO" ? "Cash Order" : "Purchase Order") : doc.kind === "DELIVERY_NOTE" ? "Surat jalan" : "Invoice"
    let sentence: string
    let tone: "blue" | "amber" | "slate" = "blue"
    if (plan.action === "CREATE_PO") {
        sentence = `Simpan akan membuat ${doc.poType === "CO" ? "CO" : "PO"} ${doc.documentNo ?? ""} ke ${doc.counterparty ?? "vendor"} · ${lines} barang · ${total}. Tagihan menyusul saat invoice vendor datang.`
    } else if (plan.action === "RECEIVE_DELIVERY") {
        if (refState === "loading") sentence = `Mencari ${doc.poRef ?? "PO"} …`
        else if (refPo) sentence = `Barang di surat jalan ini akan diterima ke ${refPo.poDocumentNo ?? refPo.poNumber} (${refPo.supplier.name}): stok bertambah dan jurnal persediaan tercatat otomatis.`
        else {
            sentence = `PO ${doc.poRef ?? "yang dirujuk"} belum ada di sistem. Upload PO/CO-nya dulu, lalu surat jalan ini.`
            tone = "amber"
        }
    } else if (plan.action === "SUPPLIER_INVOICE") {
        if (attachMode && refPo) {
            sentence = unmatched
                ? `Invoice ini merujuk ${refPo.poDocumentNo ?? refPo.poNumber}, tapi ${unmatched} barang tidak ada di PO itu. Periksa kode part-nya.`
                : `Tagihan akan ditempel ke ${refPo.poDocumentNo ?? refPo.poNumber} (${refPo.supplier.name}) — ${lines} barang cocok. Tidak ada PO dobel.`
            if (unmatched) tone = "amber"
        } else if (refState === "loading") sentence = `Mencari PO ${doc.poRef} …`
        else sentence = `Simpan akan mencatat pembelian baru dari invoice ini${doc.poRef && refState === "missing" ? ` (PO ${doc.poRef} tidak ditemukan)` : ""}: PO, tagihan dan jurnal hutang sekaligus.`
    } else {
        sentence = "Ini dokumen penjualan ke pelanggan. Isinya sudah terbaca, tapi modul penjualan belum aktif di edisi ini, jadi belum disimpan."
        tone = "slate"
    }
    return (
        <div className={cn(
            "flex items-start gap-3 rounded-lg border px-4 py-3",
            tone === "blue" && "border-blue-200 bg-blue-50/70 text-blue-950",
            tone === "amber" && "border-amber-300 bg-amber-50 text-amber-950",
            tone === "slate" && "border-slate-200 bg-slate-50 text-slate-800",
        )}>
            <span className={cn("mt-0.5 shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold", tone === "blue" ? "bg-blue-700 text-white" : tone === "amber" ? "bg-amber-500 text-white" : "bg-slate-600 text-white")}>
                {kindLabel}
            </span>
            <div className="text-sm leading-relaxed">
                <div className="font-semibold">{doc.documentNo ?? "Tanpa nomor"}{doc.pic ? ` · PIC ${doc.pic}` : ""}{doc.modelUnit ? ` · Unit ${doc.modelUnit}` : ""}</div>
                <div>{sentence}</div>
            </div>
        </div>
    )
}

