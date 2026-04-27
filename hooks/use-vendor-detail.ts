"use client"

import { useQuery } from "@tanstack/react-query"

export type VendorDetailMetrics = {
    poTotalCount: number
    totalSpend: number
    avgPoValue: number
    /**
     * On-Time Delivery percentage — dihitung dari PO selesai yang punya
     * expectedDate + GRN: rasio (GRN receivedDate <= expectedDate) terhadap
     * total PO selesai dengan data tersebut.
     */
    otdPct: number
    /**
     * Completion rate — rasio PO selesai (RECEIVED/COMPLETED) terhadap PO
     * non-cancelled. Sebelumnya field ini disebut otdPct (menyesatkan).
     */
    completionPct: number
    completedCount: number
    cancelledCount: number
    rejectionRate: number
    ytdPurchases: number
    outstandingAp: number
}

export type VendorDetailPayload = {
    id: string
    code: string
    name: string
    contactName: string | null
    contactTitle: string | null
    email: string | null
    phone: string | null
    picPhone: string | null
    officePhone: string | null
    address: string | null
    address2: string | null
    npwp: string | null
    paymentTerm: string | null
    bankName: string | null
    bankAccountNumber: string | null
    bankAccountName: string | null
    rating: number
    onTimeRate: number
    qualityScore: number | null
    responsiveness: number | null
    isActive: boolean
    createdAt: string
    updatedAt: string
    categories: { id: string; code: string; name: string }[]
    purchaseOrders: Array<{
        id: string
        number: string
        status: string
        orderDate: string | null
        expectedDate: string | null
        totalAmount: number
        netAmount: number
        taxAmount: number
        itemCount: number
    }>
    supplierProducts: Array<{
        id: string
        price: number
        currency: string
        leadTime: number
        minOrderQty: number
        skuCode: string | null
        isPreferred: boolean
        product: { id: string; code: string; name: string; unit: string } | null
    }>
    invoices: Array<{
        id: string
        number: string
        status: string
        issueDate: string
        dueDate: string
        totalAmount: number
        balanceDue: number
    }>
    payments: Array<{
        id: string
        number: string
        date: string
        amount: number
        status: string
        method: string | null
    }>
    metrics: VendorDetailMetrics
}

export function useVendorDetail(id: string) {
    return useQuery<VendorDetailPayload>({
        queryKey: ["vendor", id],
        queryFn: async () => {
            const res = await fetch(`/api/procurement/vendors/${id}`)
            if (!res.ok) {
                if (res.status === 404) throw new Error("Vendor tidak ditemukan")
                throw new Error("Gagal memuat detail vendor")
            }
            return res.json()
        },
        enabled: !!id,
        staleTime: 30_000,
    })
}
