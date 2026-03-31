"use client"

import { useEffect, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"

/**
 * Listen to Supabase Realtime postgres_changes for a table
 * and invalidate TanStack Query cache when rows change.
 *
 * This replaces polling-based freshness for critical tables.
 * Only invalidates queries with active observers (mounted components).
 */
export function useRealtimeInvalidation(
    table: string,
    queryKeysToInvalidate: readonly (readonly unknown[])[]
) {
    const queryClient = useQueryClient()
    const keysRef = useRef(queryKeysToInvalidate)
    keysRef.current = queryKeysToInvalidate

    useEffect(() => {
        const supabase = createClient()

        const channel = supabase
            .channel(`rt-${table}`)
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table },
                () => {
                    // Invalidate all related queries — TanStack Query only refetches
                    // those with active observers (mounted components)
                    keysRef.current.forEach((key) => {
                        queryClient.invalidateQueries({
                            queryKey: key as unknown[],
                            refetchType: "active",
                        })
                    })
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [table, queryClient])
}
