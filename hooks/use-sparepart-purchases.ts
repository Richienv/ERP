"use client"

import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData, type QueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { queryKeys } from "@/lib/query-keys"
import { CACHE_TIERS } from "@/lib/cache-tiers"
import { MONEY_TIER } from "@/lib/query-client"
import { invalidateOpsLoop } from "@/lib/invalidate-ops-loop"
import { derivePurchaseStatus, type PurchaseStatus } from "@/lib/sparepart-purchase-logic"
import {
    getSparepartLookup,
    getSparepartPurchase,
    listSparepartPurchases,
    markSparepartShipped,
    postSparepartBill,
    receiveSparepartGoods,
    receiveByDeliveryNote,
    recordSparepartPayment,
    saveSupplierInvoice,
    type SaveSupplierInvoiceInput,
    type SparepartDetail,
    type SparepartFilter,
    type SparepartRow,
} from "@/lib/actions/sparepart-purchasing"

type ListPage = Awaited<ReturnType<typeof listSparepartPurchases>>
type ListData = InfiniteData<ListPage, string | null>

/**
 * Used by the sidebar prefetch AND by background refresh on the same key as the infinite list.
 * TanStack calls it two ways: as a plain prefetch (no pageParam → return the whole infinite shape)
 * or with the infinite behaviour still attached (pageParam present → return ONE page). Returning the
 * whole shape in the second case nests pages inside pages and breaks the list.
 */
export async function fetchSparepartFirstPage(ctx?: { pageParam?: unknown }): Promise<ListData | ListPage> {
    if (ctx && typeof ctx === "object" && "pageParam" in ctx) {
        return listSparepartPurchases({ cursor: (ctx.pageParam as string | null) ?? null, filter: "all" })
    }
    return { pages: [await listSparepartPurchases({ filter: "all" })], pageParams: [null] }
}

export function useSparepartList(filter: SparepartFilter, q: string) {
    return useInfiniteQuery({
        queryKey: queryKeys.sparepartPurchases.list(filter, q),
        queryFn: ({ pageParam }) => listSparepartPurchases({ cursor: pageParam, filter, q }),
        initialPageParam: null as string | null,
        getNextPageParam: (last) => last.nextCursor,
        placeholderData: keepPreviousData,
        ...CACHE_TIERS.TRANSACTIONAL,
    })
}

export function useSparepartLookup(enabled = true) {
    return useQuery({
        queryKey: queryKeys.sparepartPurchases.lookup(),
        queryFn: () => getSparepartLookup(),
        enabled,
        ...CACHE_TIERS.MASTER_PLUS,
    })
}

export type SparepartLookup = Awaited<ReturnType<typeof getSparepartLookup>>

/** Money on this screen is always re-read (MONEY_TIER); the cached row paints first. */
export function useSparepartDetail(id: string | null) {
    return useQuery({
        queryKey: queryKeys.sparepartPurchases.detail(id ?? "none"),
        queryFn: () => getSparepartPurchase(id!),
        enabled: !!id,
        ...MONEY_TIER,
    })
}

export function prefetchSparepartDetail(qc: QueryClient, id: string) {
    const key = queryKeys.sparepartPurchases.detail(id)
    const state = qc.getQueryState(key)
    if (state?.fetchStatus === "fetching" || (state?.dataUpdatedAt && Date.now() - state.dataUpdatedAt < 5000)) return
    void qc.prefetchQuery({ queryKey: key, queryFn: () => getSparepartPurchase(id), staleTime: 5000 })
}

// ── Optimistic cache helpers ─────────────────────────────────────────────────

type Patch = Partial<Pick<SparepartRow, "billStatus" | "balanceDue" | "received" | "shippedAt" | "trackingNumber" | "eta">>

function restatus<T extends Patch & { poStatus: string; billTotal: number; dueDate: string | null; ordered: number; currencyCode: string; billStatus: string | null; balanceDue: number; received: number; shippedAt: string | null }>(row: T): T & PurchaseStatus {
    return {
        ...row,
        ...derivePurchaseStatus({
            poStatus: row.poStatus,
            billStatus: row.billStatus,
            billTotal: row.billTotal,
            balanceDue: row.balanceDue,
            dueDate: row.dueDate,
            ordered: row.ordered,
            received: row.received,
            shippedAt: row.shippedAt,
            currencyCode: row.currencyCode,
        }),
    }
}

/** Stop in-flight reads of this purchase so they cannot overwrite the optimistic change. Not awaited: the UI changes now. */
function cancelFor(qc: QueryClient, id: string) {
    void qc.cancelQueries({ queryKey: queryKeys.sparepartPurchases.lists() })
    void qc.cancelQueries({ queryKey: queryKeys.sparepartPurchases.detail(id) })
}

function snapshot(qc: QueryClient, id: string) {
    return {
        lists: qc.getQueriesData<ListData>({ queryKey: queryKeys.sparepartPurchases.lists() }),
        detail: qc.getQueryData<SparepartDetail | null>(queryKeys.sparepartPurchases.detail(id)),
    }
}

function restore(qc: QueryClient, id: string, snap: ReturnType<typeof snapshot>) {
    for (const [key, data] of snap.lists) qc.setQueryData(key, data)
    qc.setQueryData(queryKeys.sparepartPurchases.detail(id), snap.detail)
}

function patchEverywhere(qc: QueryClient, id: string, patch: (row: SparepartRow) => Patch) {
    qc.setQueriesData<ListData>({ queryKey: queryKeys.sparepartPurchases.lists() }, (data) =>
        data
            ? {
                ...data,
                pages: data.pages.map((p) => ({ ...p, rows: p.rows.map((r) => (r.id === id ? restatus({ ...r, ...patch(r) }) : r)) })),
            }
            : data,
    )
    qc.setQueryData<SparepartDetail | null>(queryKeys.sparepartPurchases.detail(id), (d) => {
        if (!d) return d
        const asRow = {
            poStatus: d.po.status,
            billStatus: d.bill?.status ?? null,
            billTotal: d.bill?.totalAmount ?? 0,
            balanceDue: d.bill?.balanceDue ?? 0,
            dueDate: d.dueDate,
            ordered: d.ordered,
            received: d.received,
            shippedAt: d.shippedAt,
            trackingNumber: d.trackingNumber,
            eta: d.eta,
            currencyCode: d.currencyCode,
        }
        const next = restatus({ ...asRow, ...patch(asRow as unknown as SparepartRow) })
        const patched: SparepartDetail = {
            ...d,
            shippedAt: next.shippedAt,
            trackingNumber: next.trackingNumber ?? d.trackingNumber,
            eta: next.eta ?? d.eta,
            received: next.received,
            payStage: next.payStage,
            goodsStage: next.goodsStage,
            paidPct: next.paidPct,
            receivedPct: next.receivedPct,
            overdue: next.overdue,
            dueSoon: next.dueSoon,
            nextAction: next.nextAction,
            bill: d.bill ? { ...d.bill, status: (next.billStatus ?? d.bill.status) as typeof d.bill.status, balanceDue: next.balanceDue } : d.bill,
        }
        return patched
    })
}

function settle(qc: QueryClient, id?: string) {
    void qc.invalidateQueries({ queryKey: queryKeys.sparepartPurchases.lists() })
    if (id) void qc.invalidateQueries({ queryKey: queryKeys.sparepartPurchases.detail(id) })
    void qc.invalidateQueries({ queryKey: queryKeys.bills.all })
    void qc.invalidateQueries({ queryKey: queryKeys.vendorPayments.all })
    void qc.invalidateQueries({ queryKey: queryKeys.purchaseOrders.all })
    void qc.invalidateQueries({ queryKey: queryKeys.procurementDashboard.all })
    // Saving, paying and receiving also change parts, suppliers, stock, journals and AP aging.
    for (const key of [queryKeys.products.all, queryKeys.suppliers.all, queryKeys.vendors.all, queryKeys.receiving.all, queryKeys.stockMovements.all, queryKeys.journal.all, queryKeys.apAging.all]) {
        void qc.invalidateQueries({ queryKey: key })
    }
    invalidateOpsLoop(qc)
}

function failed(qc: QueryClient, id: string, snap: ReturnType<typeof snapshot> | undefined, message: string) {
    if (snap) restore(qc, id, snap)
    toast.error(message)
}

// ── Mutations ────────────────────────────────────────────────────────────────

export function usePaySparepart() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (v: { id: string; amountOriginal: number; rate: number; method?: "TRANSFER" | "CASH"; bankAccountCode?: string | null }) => {
            const r = await recordSparepartPayment(v)
            if (!r.success) throw new Error(r.error || "Pembayaran gagal")
            return r
        },
        onMutate: async (v) => {
            cancelFor(qc, v.id)
            const snap = snapshot(qc, v.id)
            patchEverywhere(qc, v.id, (r) => ({ balanceDue: Math.max(0, r.balanceDue - v.amountOriginal * v.rate) }))
            return { snap }
        },
        onError: (e, v, ctx) => failed(qc, v.id, ctx?.snap, e.message),
        onSuccess: () => toast.success("Pembayaran tercatat"),
        onSettled: (_d, _e, v) => settle(qc, v.id),
    })
}

export function useShipSparepart() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (v: { id: string; trackingNumber?: string | null; eta?: string | null }) => {
            const r = await markSparepartShipped(v)
            if (!r.success) throw new Error(r.error || "Gagal menandai dikirim")
            return r
        },
        onMutate: async (v) => {
            cancelFor(qc, v.id)
            const snap = snapshot(qc, v.id)
            patchEverywhere(qc, v.id, () => ({ shippedAt: new Date().toISOString(), trackingNumber: v.trackingNumber ?? null, eta: v.eta ?? null }))
            return { snap }
        },
        onError: (e, v, ctx) => failed(qc, v.id, ctx?.snap, e.message),
        onSuccess: () => toast.success("Ditandai dalam perjalanan"),
        onSettled: (_d, _e, v) => settle(qc, v.id),
    })
}

export function useReceiveSparepart() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (v: { id: string; warehouseId?: string | null; lines?: { poItemId: string; qty: number }[] | null; totalQty: number }) => {
            const r = await receiveSparepartGoods({ id: v.id, warehouseId: v.warehouseId, lines: v.lines })
            if (!r.success) throw new Error(r.error || "Gagal menerima barang")
            return r
        },
        onMutate: async (v) => {
            cancelFor(qc, v.id)
            const snap = snapshot(qc, v.id)
            patchEverywhere(qc, v.id, (r) => ({ received: Math.min(r.ordered, r.received + v.totalQty) }))
            return { snap }
        },
        onError: (e, v, ctx) => failed(qc, v.id, ctx?.snap, e.message),
        onSuccess: (r) => toast.success(`Barang diterima${r.grnNumber ? ` · ${r.grnNumber}` : ""}`),
        onSettled: (_d, _e, v) => {
            settle(qc, v.id)
            void qc.invalidateQueries({ queryKey: queryKeys.receiving.all })
        },
    })
}

export function usePostSparepartBill() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (v: { id: string }) => {
            const r = await postSparepartBill(v.id)
            if (!r.success) throw new Error(r.error || "Posting gagal")
            return r
        },
        onMutate: async (v) => {
            cancelFor(qc, v.id)
            const snap = snapshot(qc, v.id)
            patchEverywhere(qc, v.id, () => ({ billStatus: "ISSUED" }))
            return { snap }
        },
        onError: (e, v, ctx) => failed(qc, v.id, ctx?.snap, e.message),
        onSuccess: () => toast.success("Tagihan diposting ke jurnal"),
        onSettled: (_d, _e, v) => settle(qc, v.id),
    })
}

export type PendingRow = SparepartRow & { pending?: boolean }

/** Save shows the purchase at the top of the list immediately; the server row replaces it. */
export function useSaveSupplierInvoice() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (v: { input: SaveSupplierInvoiceInput; optimistic: PendingRow }) => {
            const r = await saveSupplierInvoice(v.input)
            if (!r.success) throw Object.assign(new Error(r.error), { result: r })
            return r
        },
        onMutate: async (v) => {
            void qc.cancelQueries({ queryKey: queryKeys.sparepartPurchases.lists() })
            const key = queryKeys.sparepartPurchases.list("all", "")
            const prev = qc.getQueryData<ListData>(key)
            if (prev) {
                qc.setQueryData<ListData>(key, {
                    ...prev,
                    pages: prev.pages.map((p, i) => (i === 0 ? { ...p, rows: [v.optimistic, ...p.rows] } : p)),
                })
            }
            return { prev, key }
        },
        onError: (_e, _v, ctx) => {
            if (ctx?.prev) qc.setQueryData(ctx.key, ctx.prev)
        },
        onSettled: () => {
            settle(qc)
            // New supplier, parts, SKUs, template and last rate: the next upload must know them.
            void qc.invalidateQueries({ queryKey: queryKeys.sparepartPurchases.lookup() })
        },
    })
}

/** Surat jalan from a vendor: receive the referenced PO's lines in one go. */
export function useReceiveByDeliveryNote() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (v: Parameters<typeof receiveByDeliveryNote>[0]) => {
            const r = await receiveByDeliveryNote(v)
            if (!r.success) throw new Error(r.error || "Gagal menerima barang")
            return r
        },
        onSuccess: (r) => toast.success(`Barang diterima${"grnNumber" in r && r.grnNumber ? ` · ${r.grnNumber}` : ""}${"received" in r && r.received ? ` · ${r.received} pcs masuk stok` : ""}`),
        onError: (e) => toast.error(e.message),
        onSettled: (_d, _e, v) => {
            settle(qc, v.captureId)
            void qc.invalidateQueries({ queryKey: queryKeys.receiving.all })
        },
    })
}

