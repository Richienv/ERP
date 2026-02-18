"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getUnits, getBrands, getColors, getCategories, getSuppliers } from "@/lib/actions/master-data"

export function useUnits() {
    return useQuery({
        queryKey: queryKeys.units.list(),
        queryFn: getUnits,
    })
}

export function useBrands() {
    return useQuery({
        queryKey: queryKeys.brands.list(),
        queryFn: getBrands,
    })
}

export function useColors() {
    return useQuery({
        queryKey: queryKeys.colors.list(),
        queryFn: getColors,
    })
}

export function useMasterCategories() {
    return useQuery({
        queryKey: queryKeys.categories.master(),
        queryFn: getCategories,
    })
}

export function useSuppliers() {
    return useQuery({
        queryKey: queryKeys.suppliers.list(),
        queryFn: getSuppliers,
    })
}

export function useInvalidateMasterData() {
    const queryClient = useQueryClient()
    return {
        invalidateUnits: () => queryClient.invalidateQueries({ queryKey: queryKeys.units.all }),
        invalidateBrands: () => queryClient.invalidateQueries({ queryKey: queryKeys.brands.all }),
        invalidateColors: () => queryClient.invalidateQueries({ queryKey: queryKeys.colors.all }),
        invalidateCategories: () => queryClient.invalidateQueries({ queryKey: queryKeys.categories.all }),
        invalidateSuppliers: () => queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.all }),
    }
}
