"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { toast } from "sonner"

export interface FiscalPeriod {
    id: string
    year: number
    month: number
    name: string
    startDate: string
    endDate: string
    isClosed: boolean
    closedAt: string | null
    closedBy: string | null
    createdAt: string
    updatedAt: string
}

export function useFiscalPeriods(year?: number) {
    return useQuery({
        queryKey: queryKeys.fiscalPeriods.list(year),
        queryFn: async () => {
            const params = year ? `?year=${year}` : ""
            const res = await fetch(`/api/finance/fiscal-periods${params}`)
            const json = await res.json()
            if (!res.ok) throw new Error(json.error)
            return json.data as FiscalPeriod[]
        },
    })
}

export function useGenerateFiscalYear() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (year: number) => {
            const res = await fetch("/api/finance/fiscal-periods", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "generate", year }),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error)
            return json
        },
        onSuccess: (data) => {
            toast.success(data.message)
            queryClient.invalidateQueries({ queryKey: queryKeys.fiscalPeriods.all })
        },
        onError: (error: Error) => {
            toast.error(error.message)
        },
    })
}

export function useCloseFiscalPeriod() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch("/api/finance/fiscal-periods", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "close", id }),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error)
            return json
        },
        onSuccess: (data) => {
            toast.success(data.message)
            queryClient.invalidateQueries({ queryKey: queryKeys.fiscalPeriods.all })
        },
        onError: (error: Error) => {
            toast.error(error.message)
        },
    })
}

export function useReopenFiscalPeriod() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch("/api/finance/fiscal-periods", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "reopen", id }),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error)
            return json
        },
        onSuccess: (data) => {
            toast.success(data.message)
            queryClient.invalidateQueries({ queryKey: queryKeys.fiscalPeriods.all })
        },
        onError: (error: Error) => {
            toast.error(error.message)
        },
    })
}

export function useCloseYearEnd() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (year: number) => {
            const res = await fetch("/api/finance/fiscal-periods", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "close-year", year }),
            })
            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || "Gagal tutup tahun")
            }
            return res.json()
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: queryKeys.fiscalPeriods.all })
        },
        onError: (error: Error) => {
            toast.error(error.message)
        },
    })
}
