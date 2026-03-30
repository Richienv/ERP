"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { toast } from "sonner"
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
        onMutate: async (newFlag) => {
            await qc.cancelQueries({ queryKey: queryKeys.ceoFlags.all })
            const previousCount = qc.getQueryData<{ count: number }>(queryKeys.ceoFlags.count())
            // Optimistically increment the pending count badge
            if (previousCount) {
                qc.setQueryData(queryKeys.ceoFlags.count(), { count: previousCount.count + 1 })
            }
            return { previousCount }
        },
        onError: (_err, _vars, context) => {
            if (context?.previousCount) {
                qc.setQueryData(queryKeys.ceoFlags.count(), context.previousCount)
            }
            toast.error("Gagal membuat flag")
        },
        onSettled: () => {
            qc.invalidateQueries({ queryKey: queryKeys.ceoFlags.all })
        },
    })
}

export function useMarkFlagRead() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: markFlagRead,
        onMutate: async (flagId: string) => {
            await qc.cancelQueries({ queryKey: queryKeys.ceoFlags.all })
            // Snapshot all flag list queries for rollback
            const queries = qc.getQueriesData<any[]>({ queryKey: queryKeys.ceoFlags.all })
            // Optimistically mark as read in all cached flag lists
            qc.setQueriesData<any[]>({ queryKey: queryKeys.ceoFlags.all }, (old) =>
                old?.map((f: any) => f.id === flagId ? { ...f, isRead: true } : f)
            )
            return { queries }
        },
        onError: (_err, _vars, context) => {
            // Rollback all flag list queries
            context?.queries?.forEach(([key, data]) => {
                if (data) qc.setQueryData(key, data)
            })
            toast.error("Gagal menandai flag")
        },
        onSettled: () => {
            qc.invalidateQueries({ queryKey: queryKeys.ceoFlags.all })
        },
    })
}

export function useMarkFlagActed() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: markFlagActed,
        onMutate: async (flagId: string) => {
            await qc.cancelQueries({ queryKey: queryKeys.ceoFlags.all })
            const queries = qc.getQueriesData<any[]>({ queryKey: queryKeys.ceoFlags.all })
            qc.setQueriesData<any[]>({ queryKey: queryKeys.ceoFlags.all }, (old) =>
                old?.map((f: any) => f.id === flagId ? { ...f, isActed: true, status: "ACTED" } : f)
            )
            const previousCount = qc.getQueryData<{ count: number }>(queryKeys.ceoFlags.count())
            if (previousCount && previousCount.count > 0) {
                qc.setQueryData(queryKeys.ceoFlags.count(), { count: previousCount.count - 1 })
            }
            return { queries, previousCount }
        },
        onError: (_err, _vars, context) => {
            context?.queries?.forEach(([key, data]) => {
                if (data) qc.setQueryData(key, data)
            })
            if (context?.previousCount) {
                qc.setQueryData(queryKeys.ceoFlags.count(), context.previousCount)
            }
            toast.error("Gagal menandai flag")
        },
        onSettled: () => {
            qc.invalidateQueries({ queryKey: queryKeys.ceoFlags.all })
        },
    })
}

export function useDismissFlag() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: dismissFlag,
        onMutate: async (flagId: string) => {
            await qc.cancelQueries({ queryKey: queryKeys.ceoFlags.all })
            const queries = qc.getQueriesData<any[]>({ queryKey: queryKeys.ceoFlags.all })
            // Optimistically remove from list
            qc.setQueriesData<any[]>({ queryKey: queryKeys.ceoFlags.all }, (old) =>
                old?.filter((f: any) => f.id !== flagId)
            )
            const previousCount = qc.getQueryData<{ count: number }>(queryKeys.ceoFlags.count())
            if (previousCount && previousCount.count > 0) {
                qc.setQueryData(queryKeys.ceoFlags.count(), { count: previousCount.count - 1 })
            }
            return { queries, previousCount }
        },
        onError: (_err, _vars, context) => {
            context?.queries?.forEach(([key, data]) => {
                if (data) qc.setQueryData(key, data)
            })
            if (context?.previousCount) {
                qc.setQueryData(queryKeys.ceoFlags.count(), context.previousCount)
            }
            toast.error("Gagal menghapus flag")
        },
        onSettled: () => {
            qc.invalidateQueries({ queryKey: queryKeys.ceoFlags.all })
        },
    })
}
