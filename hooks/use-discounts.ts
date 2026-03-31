"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { toast } from "sonner"

export type DiscountSchemeRow = {
    id: string
    code: string
    name: string
    description: string | null
    type: "PERCENTAGE" | "FIXED" | "TIERED"
    scope: "GLOBAL" | "PRICELIST" | "CUSTOMER" | "PRODUCT" | "CATEGORY"
    value: string | null
    tieredRules: any
    isActive: boolean
    validFrom: string | null
    validTo: string | null
    minOrderValue: string | null
    priceListId: string | null
    customerId: string | null
    productId: string | null
    categoryId: string | null
    priceList: { id: string; name: string; code: string } | null
    customer: { id: string; name: string; code: string } | null
    product: { id: string; name: string; code: string } | null
    category: { id: string; name: string; code: string } | null
    createdAt: string
    updatedAt: string
}

export type DiscountSummary = {
    total: number
    active: number
    percentage: number
    fixed: number
    tiered: number
}

type DiscountData = {
    schemes: DiscountSchemeRow[]
    summary: DiscountSummary
}

function recalcSummary(schemes: DiscountSchemeRow[]): DiscountSummary {
    return {
        total: schemes.length,
        active: schemes.filter((s) => s.isActive).length,
        percentage: schemes.filter((s) => s.type === "PERCENTAGE").length,
        fixed: schemes.filter((s) => s.type === "FIXED").length,
        tiered: schemes.filter((s) => s.type === "TIERED").length,
    }
}

export function useDiscounts() {
    return useQuery({
        queryKey: queryKeys.discounts.list(),
        queryFn: async () => {
            const res = await fetch("/api/sales/discounts")
            if (!res.ok) throw new Error("Gagal memuat data diskon")
            const json = await res.json()
            return {
                schemes: (json.data ?? []) as DiscountSchemeRow[],
                summary: (json.summary ?? {}) as DiscountSummary,
            }
        },
    })
}

export function useCreateDiscount() {
    const queryClient = useQueryClient()
    const qk = queryKeys.discounts.list()

    return useMutation({
        mutationFn: async (data: Record<string, any>) => {
            const res = await fetch("/api/sales/discounts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || "Gagal membuat skema diskon")
            return json.data as DiscountSchemeRow
        },
        onMutate: async (data) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.discounts.all })
            const previous = queryClient.getQueryData<DiscountData>(qk)
            const optimistic: DiscountSchemeRow = {
                id: `temp-${Date.now()}`,
                code: (data.code as string) ?? "",
                name: (data.name as string) ?? "",
                description: (data.description as string) ?? null,
                type: (data.type as any) ?? "PERCENTAGE",
                scope: (data.scope as any) ?? "GLOBAL",
                value: data.value ?? null,
                tieredRules: data.tieredRules ?? null,
                isActive: data.isActive ?? true,
                validFrom: data.validFrom ?? null,
                validTo: data.validTo ?? null,
                minOrderValue: data.minOrderValue ?? null,
                priceListId: null, customerId: null, productId: null, categoryId: null,
                priceList: null, customer: null, product: null, category: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            }
            if (previous) {
                const newSchemes = [...previous.schemes, optimistic]
                queryClient.setQueryData<DiscountData>(qk, {
                    schemes: newSchemes,
                    summary: recalcSummary(newSchemes),
                })
            }
            return { previous }
        },
        onSuccess: (serverData) => {
            queryClient.setQueryData<DiscountData>(qk, (old) => {
                if (!old) return old
                const newSchemes = old.schemes.map((s) => s.id.startsWith("temp-") ? serverData : s)
                return { schemes: newSchemes, summary: recalcSummary(newSchemes) }
            })
            toast.success("Skema diskon berhasil dibuat")
        },
        onError: (err: Error, _vars, context) => {
            if (context?.previous) {
                queryClient.setQueryData(qk, context.previous)
            }
            toast.error(err.message)
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.discounts.all })
        },
    })
}

export function useUpdateDiscount() {
    const queryClient = useQueryClient()
    const qk = queryKeys.discounts.list()

    return useMutation({
        mutationFn: async (data: Record<string, any>) => {
            const res = await fetch("/api/sales/discounts", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || "Gagal mengubah skema diskon")
            return json.data as DiscountSchemeRow
        },
        onMutate: async (data) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.discounts.all })
            const previous = queryClient.getQueryData<DiscountData>(qk)
            if (previous) {
                const newSchemes = previous.schemes.map((s) =>
                    s.id === data.id ? { ...s, ...data, updatedAt: new Date().toISOString() } as DiscountSchemeRow : s
                )
                queryClient.setQueryData<DiscountData>(qk, {
                    schemes: newSchemes,
                    summary: recalcSummary(newSchemes),
                })
            }
            return { previous }
        },
        onError: (err: Error, _vars, context) => {
            if (context?.previous) {
                queryClient.setQueryData(qk, context.previous)
            }
            toast.error(err.message)
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.discounts.all })
        },
    })
}

export function useDeleteDiscount() {
    const queryClient = useQueryClient()
    const qk = queryKeys.discounts.list()

    return useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/sales/discounts?id=${id}`, {
                method: "DELETE",
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || "Gagal menghapus skema diskon")
            return json
        },
        onMutate: async (id: string) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.discounts.all })
            const previous = queryClient.getQueryData<DiscountData>(qk)
            if (previous) {
                const newSchemes = previous.schemes.filter((s) => s.id !== id)
                queryClient.setQueryData<DiscountData>(qk, {
                    schemes: newSchemes,
                    summary: recalcSummary(newSchemes),
                })
            }
            return { previous }
        },
        onError: (err: Error, _vars, context) => {
            if (context?.previous) {
                queryClient.setQueryData(qk, context.previous)
            }
            toast.error(err.message)
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.discounts.all })
        },
    })
}
