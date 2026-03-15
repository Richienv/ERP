"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import {
    getFixedAssets,
    getFixedAssetDetail,
    getFixedAssetCategories,
    getDepreciationRuns,
    getDepreciationRunDetail,
    getGLAccountsForFixedAssets,
    getSuppliersForFixedAssets,
    getAssetRegisterReport,
    getDepreciationScheduleReport,
    getAssetMovementReport,
    getNetBookValueSummary,
} from "@/lib/actions/finance-fixed-assets"

export function useFixedAssets(filters?: { status?: string; categoryId?: string; search?: string }) {
    return useQuery({
        queryKey: queryKeys.fixedAssets.list(filters as any),
        queryFn: async () => {
            const result = await getFixedAssets(filters)
            if (!result?.success) return { assets: [], summary: { totalAssets: 0, activeCount: 0, totalCost: 0, totalAccDep: 0, totalNBV: 0 } }
            return result
        },
        retry: 1,
    })
}

export function useFixedAssetDetail(id: string) {
    return useQuery({
        queryKey: queryKeys.fixedAssets.detail(id),
        queryFn: () => getFixedAssetDetail(id),
        enabled: !!id,
        retry: 1,
    })
}

export function useFixedAssetCategories() {
    return useQuery({
        queryKey: queryKeys.fixedAssetCategories.list(),
        queryFn: async () => {
            const result = await getFixedAssetCategories()
            if (!result?.success) return { categories: [] }
            return result
        },
        retry: 1,
    })
}

export function useDepreciationRuns() {
    return useQuery({
        queryKey: queryKeys.depreciationRuns.list(),
        queryFn: async () => {
            const result = await getDepreciationRuns()
            if (!result?.success) return { runs: [] }
            return result
        },
        retry: 1,
    })
}

export function useDepreciationRunDetail(id: string) {
    return useQuery({
        queryKey: queryKeys.depreciationRuns.detail(id),
        queryFn: () => getDepreciationRunDetail(id),
        enabled: !!id,
        retry: 1,
    })
}

export function useGLAccountsForFA() {
    return useQuery({
        queryKey: [...queryKeys.glAccounts.all, "forFA"],
        queryFn: async () => {
            const result = await getGLAccountsForFixedAssets()
            if (!result?.success) return { accounts: [] }
            return result
        },
        retry: 1,
    })
}

export function useSuppliersForFA() {
    return useQuery({
        queryKey: [...queryKeys.suppliers.all, "forFA"],
        queryFn: async () => {
            const result = await getSuppliersForFixedAssets()
            if (!result?.success) return { suppliers: [] }
            return result
        },
        retry: 1,
    })
}

// Report hooks
export function useAssetRegisterReport() {
    return useQuery({
        queryKey: queryKeys.fixedAssetReports.register(),
        queryFn: () => getAssetRegisterReport(),
        retry: 1,
    })
}

export function useDepreciationScheduleReport(assetId?: string) {
    return useQuery({
        queryKey: queryKeys.fixedAssetReports.schedule(assetId),
        queryFn: () => getDepreciationScheduleReport(assetId),
        retry: 1,
    })
}

export function useAssetMovementReport(startDate?: string, endDate?: string) {
    return useQuery({
        queryKey: queryKeys.fixedAssetReports.movements(startDate, endDate),
        queryFn: () => getAssetMovementReport(startDate, endDate),
        retry: 1,
    })
}

export function useNetBookValueSummary() {
    return useQuery({
        queryKey: queryKeys.fixedAssetReports.nbv(),
        queryFn: () => getNetBookValueSummary(),
        retry: 1,
    })
}
