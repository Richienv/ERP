"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import type { CashflowScenarioSummary, CashflowScenarioFull, ScenarioConfig } from "@/lib/actions/finance-cashflow"
import { apiFetch } from "@/lib/http/api-fetch"

export function useCashflowScenarios(month: number, year: number) {
    return useQuery<CashflowScenarioSummary[]>({
        queryKey: queryKeys.cashflowScenarios.list(month, year),
        queryFn: async () => {
            const json = await apiFetch<{ scenarios?: CashflowScenarioSummary[] }>(`/api/finance/cashflow-scenarios?month=${month}&year=${year}`)
            return json.scenarios ?? []
        },
    })
}

export function useCashflowScenario(id: string | null) {
    return useQuery<CashflowScenarioFull | null>({
        queryKey: queryKeys.cashflowScenarios.detail(id ?? ""),
        queryFn: async () => {
            if (!id) return null
            const json = await apiFetch<{ scenario?: CashflowScenarioFull }>(`/api/finance/cashflow-scenarios/${id}`)
            return json.scenario ?? null
        },
        enabled: !!id,
    })
}

export function useCreateScenario(month: number, year: number) {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (name: string) => {
            const res = await fetch("/api/finance/cashflow-scenarios", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, month, year }),
            })
            if (!res.ok) throw new Error("Failed to create scenario")
            return res.json()
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: queryKeys.cashflowScenarios.list(month, year) })
        },
    })
}

export function useSaveScenario() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ id, ...data }: { id: string; name?: string; config?: ScenarioConfig; totalIn?: number; totalOut?: number; netFlow?: number }) => {
            const res = await fetch(`/api/finance/cashflow-scenarios/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            })
            if (!res.ok) throw new Error("Failed to save scenario")
        },
        onSuccess: (_data, vars) => {
            qc.invalidateQueries({ queryKey: queryKeys.cashflowScenarios.all })
            qc.invalidateQueries({ queryKey: queryKeys.cashflowScenarios.detail(vars.id) })
        },
    })
}

export function useDeleteScenario(month: number, year: number) {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/finance/cashflow-scenarios/${id}`, { method: "DELETE" })
            if (!res.ok) throw new Error("Failed to delete scenario")
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: queryKeys.cashflowScenarios.list(month, year) })
        },
    })
}
