"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getAllCategories, getCategories } from "@/app/actions/inventory"

export function useCategories() {
    return useQuery({
        queryKey: queryKeys.categories.list(),
        queryFn: async () => {
            const [categories, allCategories] = await Promise.all([
                getAllCategories(),
                getCategories(),
            ])
            return { categories: categories as any[], allCategories: allCategories as { id: string; name: string }[] }
        },
    })
}

export function useInvalidateCategories() {
    const queryClient = useQueryClient()
    return () => queryClient.invalidateQueries({ queryKey: queryKeys.categories.all })
}
