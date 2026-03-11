"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import {
    getCeoFlags,
    createCeoFlag,
    markFlagRead,
    markFlagActed,
    dismissFlag,
    getPendingFlagCount,
} from "@/lib/actions/ceo-flags"

export function useCeoFlags(options?: { targetDept?: string; status?: string; limit?: number }) {
    return useQuery({
        queryKey: queryKeys.ceoFlags.list(options as any),
        queryFn: () => getCeoFlags(options),
    })
}

export function usePendingFlagCount() {
    return useQuery({
        queryKey: queryKeys.ceoFlags.count(),
        queryFn: () => getPendingFlagCount(),
        refetchInterval: 30_000,
    })
}

export function useCreateFlag() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: createCeoFlag,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: queryKeys.ceoFlags.all })
        },
    })
}

export function useMarkFlagRead() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: markFlagRead,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: queryKeys.ceoFlags.all })
        },
    })
}

export function useMarkFlagActed() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: markFlagActed,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: queryKeys.ceoFlags.all })
        },
    })
}

export function useDismissFlag() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: dismissFlag,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: queryKeys.ceoFlags.all })
        },
    })
}
