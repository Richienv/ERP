"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { ProductWithRelations, ProductFilters, PaginatedResponse, ApiResponse } from "@/lib/types"

interface UseProductsReturn {
    products: ProductWithRelations[]
    loading: boolean
    error: string | null
    pagination: PaginatedResponse<ProductWithRelations>["pagination"] | null
    refetch: () => void
    createProduct: (productData: any) => Promise<boolean>
    updateProduct: (id: string, productData: any) => Promise<boolean>
    deleteProduct: (id: string) => Promise<boolean>
}

function buildQueryString(filters?: ProductFilters): string {
    if (!filters) return ""
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
            params.append(key, value.toString())
        }
    })
    return params.toString()
}

export function useProducts(filters?: ProductFilters): UseProductsReturn {
    const queryClient = useQueryClient()

    // Build a stable query key that includes the active filter values
    const queryKey = [
        ...queryKeys.products.list(),
        {
            search: filters?.search,
            categoryId: filters?.categoryId,
            status: filters?.status,
            stockStatus: filters?.stockStatus,
            page: filters?.page,
            limit: filters?.limit,
        },
    ] as const

    const { data, isLoading, error: queryError } = useQuery({
        queryKey,
        queryFn: async () => {
            const qs = buildQueryString(filters)
            const response = await fetch(`/api/products?${qs}`)
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }
            const data: PaginatedResponse<ProductWithRelations> = await response.json()
            if (!data.success) {
                throw new Error(data.error || "Failed to fetch products")
            }
            return data
        },
    })

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
    }

    const createProduct = async (productData: any): Promise<boolean> => {
        try {
            const response = await fetch("/api/products", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(productData),
            })
            const result: ApiResponse<ProductWithRelations> = await response.json()
            if (result.success) {
                invalidate()
                return true
            }
            return false
        } catch {
            return false
        }
    }

    const updateProduct = async (id: string, productData: any): Promise<boolean> => {
        try {
            const response = await fetch(`/api/products/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(productData),
            })
            const result: ApiResponse<ProductWithRelations> = await response.json()
            if (result.success) {
                invalidate()
                return true
            }
            return false
        } catch {
            return false
        }
    }

    const deleteProduct = async (id: string): Promise<boolean> => {
        try {
            const response = await fetch(`/api/products/${id}`, {
                method: "DELETE",
            })
            const result: ApiResponse = await response.json()
            if (result.success) {
                invalidate()
                return true
            }
            return false
        } catch {
            return false
        }
    }

    return {
        products: data?.data ?? [],
        loading: isLoading,
        error: queryError ? (queryError instanceof Error ? queryError.message : "An error occurred") : null,
        pagination: data?.pagination ?? null,
        refetch: invalidate,
        createProduct,
        updateProduct,
        deleteProduct,
    }
}

// Hook for single product
export function useProduct(id: string) {
    const { data, isLoading, error: queryError } = useQuery({
        queryKey: queryKeys.products.detail(id),
        queryFn: async () => {
            const response = await fetch(`/api/products/${id}`)
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }
            const data: ApiResponse<ProductWithRelations> = await response.json()
            if (!data.success) {
                throw new Error(data.error || "Failed to fetch product")
            }
            return data.data ?? null
        },
        enabled: Boolean(id),
    })

    return {
        product: data ?? null,
        loading: isLoading,
        error: queryError ? (queryError instanceof Error ? queryError.message : "An error occurred") : null,
    }
}
