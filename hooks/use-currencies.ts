"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { toast } from "sonner"

export type CurrencyRate = {
    id: string
    currencyId: string
    date: string
    buyRate: number | string
    sellRate: number | string
    middleRate: number | string
    source: string | null
    createdAt: string
}

export type Currency = {
    id: string
    code: string
    name: string
    symbol: string
    isActive: boolean
    rates: CurrencyRate[]
    createdAt: string
    updatedAt: string
}

export function useCurrencies() {
    return useQuery({
        queryKey: queryKeys.currencies.list(),
        queryFn: async (): Promise<Currency[]> => {
            const res = await fetch("/api/finance/currencies")
            const json = await res.json()
            if (!json.success) throw new Error(json.error || "Gagal memuat")
            return json.data ?? []
        },
    })
}

export function useCreateCurrency() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (data: { code: string; name: string; symbol: string }) => {
            const res = await fetch("/api/finance/currencies", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            })
            const json = await res.json()
            if (!json.success) throw new Error(json.error)
            return json.data as Currency
        },
        onMutate: async (data) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.currencies.all })
            const previous = queryClient.getQueryData<Currency[]>(queryKeys.currencies.list())
            const optimistic: Currency = {
                id: `temp-${Date.now()}`,
                code: data.code,
                name: data.name,
                symbol: data.symbol,
                isActive: true,
                rates: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            }
            queryClient.setQueryData<Currency[]>(queryKeys.currencies.list(), (old) =>
                [...(old ?? []), optimistic]
            )
            return { previous }
        },
        onSuccess: (serverData) => {
            queryClient.setQueryData<Currency[]>(queryKeys.currencies.list(), (old) =>
                old?.map((c) => c.id.startsWith("temp-") ? serverData : c) ?? [serverData]
            )
            toast.success("Mata uang berhasil ditambahkan")
        },
        onError: (err: Error, _vars, context) => {
            if (context?.previous) {
                queryClient.setQueryData(queryKeys.currencies.list(), context.previous)
            }
            toast.error(err.message || "Gagal menambahkan mata uang")
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.currencies.all })
        },
    })
}

export function useAddExchangeRate() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (data: {
            currencyId: string
            date: string
            buyRate: number
            sellRate: number
            middleRate: number
            source?: string
        }) => {
            const res = await fetch("/api/finance/currencies", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "add-rate", ...data }),
            })
            const json = await res.json()
            if (!json.success) throw new Error(json.error)
            return json.data
        },
        onMutate: async (data) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.currencies.all })
            const previous = queryClient.getQueryData<Currency[]>(queryKeys.currencies.list())
            const optimisticRate: CurrencyRate = {
                id: `temp-${Date.now()}`,
                currencyId: data.currencyId,
                date: data.date,
                buyRate: data.buyRate,
                sellRate: data.sellRate,
                middleRate: data.middleRate,
                source: data.source ?? null,
                createdAt: new Date().toISOString(),
            }
            queryClient.setQueryData<Currency[]>(queryKeys.currencies.list(), (old) =>
                old?.map((c) => c.id === data.currencyId
                    ? { ...c, rates: [optimisticRate, ...c.rates] }
                    : c
                ) ?? []
            )
            return { previous }
        },
        onError: (_err, _vars, context) => {
            if (context?.previous) {
                queryClient.setQueryData(queryKeys.currencies.list(), context.previous)
            }
            toast.error("Gagal menambahkan kurs")
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.currencies.all })
        },
    })
}

export function useDeleteExchangeRate() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (rateId: string) => {
            const res = await fetch(`/api/finance/currencies?rateId=${rateId}`, {
                method: "DELETE",
            })
            const json = await res.json()
            if (!json.success) throw new Error(json.error)
            return json
        },
        onMutate: async (rateId: string) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.currencies.all })
            const previous = queryClient.getQueryData<Currency[]>(queryKeys.currencies.list())
            queryClient.setQueryData<Currency[]>(queryKeys.currencies.list(), (old) =>
                old?.map((c) => ({
                    ...c,
                    rates: c.rates.filter((r) => r.id !== rateId),
                })) ?? []
            )
            return { previous }
        },
        onError: (_err, _vars, context) => {
            if (context?.previous) {
                queryClient.setQueryData(queryKeys.currencies.list(), context.previous)
            }
            toast.error("Gagal menghapus kurs")
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.currencies.all })
        },
    })
}

export function useDeleteCurrency() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (currencyId: string) => {
            const res = await fetch(`/api/finance/currencies?currencyId=${currencyId}`, {
                method: "DELETE",
            })
            const json = await res.json()
            if (!json.success) throw new Error(json.error)
            return json
        },
        onMutate: async (currencyId: string) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.currencies.all })
            const previous = queryClient.getQueryData<Currency[]>(queryKeys.currencies.list())
            queryClient.setQueryData<Currency[]>(queryKeys.currencies.list(), (old) =>
                old?.filter((c) => c.id !== currencyId) ?? []
            )
            return { previous }
        },
        onError: (_err, _vars, context) => {
            if (context?.previous) {
                queryClient.setQueryData(queryKeys.currencies.list(), context.previous)
            }
            toast.error("Gagal menghapus mata uang")
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.currencies.all })
        },
    })
}

/**
 * Helper: get latest rate for a currency (by code) from the currencies list.
 * Returns middleRate as number, or null if not found.
 */
export function getLatestRate(currencies: Currency[], currencyCode: string): number | null {
    const currency = currencies.find((c) => c.code === currencyCode)
    if (!currency || currency.rates.length === 0) return null
    return Number(currency.rates[0].middleRate)
}

/**
 * Convert foreign amount to IDR using latest middle rate.
 */
export function convertToIDR(
    currencies: Currency[],
    currencyCode: string,
    amount: number
): number | null {
    if (currencyCode === "IDR") return amount
    const rate = getLatestRate(currencies, currencyCode)
    if (!rate) return null
    return amount * rate
}
