"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

interface CustomerTransaction {
    id: string
    type: "quotation" | "salesOrder" | "invoice"
    number: string
    date: string
    status: string
    amount: number
}

export interface CustomerDetail {
    id: string
    code: string
    name: string
    legalName: string | null
    customerType: string
    category?: {
        id: string
        code: string
        name: string
    } | null
    npwp: string | null
    nik: string | null
    taxStatus: string
    isTaxable: boolean
    phone: string | null
    email: string | null
    website: string | null
    creditLimit: number
    creditTerm: number
    paymentTerm: string
    creditStatus: string
    totalOrderValue: number
    lastOrderDate: string | null
    currency: string
    isActive: boolean
    isProspect: boolean
    createdAt: string
    updatedAt: string
    addresses: Array<{
        id: string
        type: string
        address1: string
        address2: string | null
        kelurahan: string | null
        kecamatan: string | null
        kabupaten: string
        provinsi: string
        postalCode: string
        isPrimary: boolean
    }>
    contacts: Array<{
        id: string
        name: string
        title: string | null
        department: string | null
        phone: string | null
        mobile: string | null
        email: string | null
        isPrimary: boolean
    }>
    transactions: CustomerTransaction[]
}

interface CustomerDetailResponse {
    success: boolean
    data?: CustomerDetail
    error?: string
}

async function fetchCustomerDetail(id: string): Promise<CustomerDetail> {
    const response = await fetch(`/api/sales/customers/${id}`)
    const payload: CustomerDetailResponse = await response.json()
    if (!payload.success || !payload.data) {
        throw new Error(payload.error || "Customer tidak ditemukan")
    }
    return payload.data
}

export function useCustomerDetail(id: string) {
    return useQuery({
        queryKey: queryKeys.customers.detail(id),
        queryFn: () => fetchCustomerDetail(id),
        enabled: !!id,
    })
}
